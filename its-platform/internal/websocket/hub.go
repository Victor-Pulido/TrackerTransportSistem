package websocket

import (
	"log"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		// Allow all origins for demo purposes
		return true
	},
}

// Client represents a single WebSocket connection.
type Client struct {
	conn *websocket.Conn
	send chan []byte
	hub  *Hub
}

// Hub maintains the set of active WebSocket clients and broadcasts messages to them.
type Hub struct {
	clients    map[*Client]bool
	broadcast  chan []byte
	register   chan *Client
	unregister chan *Client
}

// NewHub creates a new Hub instance.
func NewHub() *Hub {
	return &Hub{
		clients:    make(map[*Client]bool),
		broadcast:  make(chan []byte, 256),
		register:   make(chan *Client),
		unregister: make(chan *Client),
	}
}

// Run starts the Hub event loop. It must be called in a goroutine.
func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.clients[client] = true
			log.Printf("[ws] client connected (total: %d)", len(h.clients))

		case client := <-h.unregister:
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				close(client.send)
				log.Printf("[ws] client disconnected (total: %d)", len(h.clients))
			}

		case message := <-h.broadcast:
			for client := range h.clients {
				select {
				case client.send <- message:
				default:
					// Slow client: drop and disconnect
					close(client.send)
					delete(h.clients, client)
				}
			}
		}
	}
}

// Broadcast sends a message to all connected WebSocket clients.
func Broadcast(h *Hub, msg []byte) {
	select {
	case h.broadcast <- msg:
	default:
		// Drop message if broadcast channel is full
	}
}

// ServeWs upgrades an HTTP connection to WebSocket and registers the client.
func ServeWs(hub *Hub, c *gin.Context) {
	conn, err := upgrader.Upgrade(c.Writer, c.Request, nil)
	if err != nil {
		log.Printf("[ws] upgrade error: %v", err)
		return
	}

	client := &Client{
		conn: conn,
		send: make(chan []byte, 256),
		hub:  hub,
	}
	hub.register <- client

	go client.writePump()
	go client.readPump()
}

// readPump drains incoming messages from the WebSocket (we don't process them in this demo).
func (c *Client) readPump() {
	defer func() {
		c.hub.unregister <- c
		c.conn.Close()
	}()
	c.conn.SetReadLimit(512)
	c.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	c.conn.SetPongHandler(func(string) error {
		c.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		return nil
	})
	for {
		_, _, err := c.conn.ReadMessage()
		if err != nil {
			break
		}
	}
}

// writePump sends messages from the send channel to the WebSocket connection.
func (c *Client) writePump() {
	ticker := time.NewTicker(30 * time.Second)
	defer func() {
		ticker.Stop()
		c.conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.send:
			c.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if !ok {
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}
			if err := c.conn.WriteMessage(websocket.TextMessage, message); err != nil {
				return
			}

		case <-ticker.C:
			c.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}
