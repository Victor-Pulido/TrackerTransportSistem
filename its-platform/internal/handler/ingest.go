package handler

import (
	"database/sql"
	"encoding/json"
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/its-demo/platform/internal/domain"
	"github.com/its-demo/platform/internal/repository"
	ws "github.com/its-demo/platform/internal/websocket"
)

// IngestHandler handles data ingestion endpoints from ITS devices.
type IngestHandler struct {
	DB  *sql.DB
	Hub *ws.Hub
}

// NewIngestHandler creates a new IngestHandler.
func NewIngestHandler(db *sql.DB, hub *ws.Hub) *IngestHandler {
	return &IngestHandler{DB: db, Hub: hub}
}

// ingestEventRequest is the expected body for POST /ingest/event.
type ingestEventRequest struct {
	TripID     string `json:"trip_id" binding:"required"`
	StopID     string `json:"stop_id" binding:"required"`
	RouteID    string `json:"route_id" binding:"required"`
	OperatorID string `json:"operator_id" binding:"required"`
	Sequence   int    `json:"sequence"`
	Boardings  int    `json:"boardings"`
	Alightings int    `json:"alightings"`
	Timestamp  string `json:"timestamp"`
}

// IngestEvent receives a passenger boarding/alighting event from a bus.
// POST /ingest/event
func (h *IngestHandler) IngestEvent(c *gin.Context) {
	var req ingestEventRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ts := req.Timestamp
	if ts == "" {
		ts = time.Now().UTC().Format(time.RFC3339)
	}

	event := domain.PassengerEvent{
		ID:         uuid.NewString(),
		TripID:     req.TripID,
		StopID:     req.StopID,
		RouteID:    req.RouteID,
		OperatorID: req.OperatorID,
		Sequence:   req.Sequence,
		Boardings:  req.Boardings,
		Alightings: req.Alightings,
		Timestamp:  ts,
	}

	if err := repository.InsertEvent(h.DB, event); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to store event"})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"id": event.ID, "status": "accepted"})
}

// ingestPositionRequest is the expected body for POST /ingest/position.
type ingestPositionRequest struct {
	VehicleID  string  `json:"vehicle_id" binding:"required"`
	OperatorID string  `json:"operator_id" binding:"required"`
	Lat        float64 `json:"lat"`
	Lng        float64 `json:"lng"`
	SpeedKmh   float64 `json:"speed_kmh"`
	Heading    int     `json:"heading"`
	Timestamp  string  `json:"timestamp"`
}

// IngestPosition receives a GPS position update from a bus and broadcasts it via WebSocket.
// POST /ingest/position
func (h *IngestHandler) IngestPosition(c *gin.Context) {
	var req ingestPositionRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	ts := req.Timestamp
	if ts == "" {
		ts = time.Now().UTC().Format(time.RFC3339)
	}

	pos := domain.VehiclePosition{
		ID:         uuid.NewString(),
		VehicleID:  req.VehicleID,
		OperatorID: req.OperatorID,
		Lat:        req.Lat,
		Lng:        req.Lng,
		SpeedKmh:   req.SpeedKmh,
		Heading:    req.Heading,
		Timestamp:  ts,
	}

	if err := repository.InsertPosition(h.DB, pos); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to store position"})
		return
	}

	// Broadcast to all WebSocket clients
	if msg, err := json.Marshal(pos); err == nil {
		ws.Broadcast(h.Hub, msg)
	}

	c.JSON(http.StatusCreated, gin.H{"id": pos.ID, "status": "accepted"})
}
