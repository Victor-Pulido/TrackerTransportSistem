import { useEffect, useRef, useState, useCallback } from 'react'

/**
 * useWebSocket(url)
 * Connects to a WebSocket endpoint, auto-reconnects every 3 s on disconnect.
 * Returns { data, isConnected, lastMessage }
 */
export function useWebSocket(url) {
  const [data, setData]               = useState(null)
  const [isConnected, setIsConnected] = useState(false)
  const wsRef                         = useRef(null)
  const reconnectTimerRef             = useRef(null)
  const activeRef                     = useRef(true)  // tracks intentional close

  const connect = useCallback(() => {
    if (!activeRef.current) return

    // Build absolute WS URL
    const protocol  = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host      = window.location.host
    const wsUrl     = url.startsWith('ws') ? url : `${protocol}//${host}${url}`

    try {
      const ws = new WebSocket(wsUrl)
      wsRef.current = ws

      ws.onopen = () => {
        if (activeRef.current) {
          setIsConnected(true)
          clearTimeout(reconnectTimerRef.current)
        }
      }

      ws.onmessage = (event) => {
        try {
          const parsed = JSON.parse(event.data)
          setData(parsed)
        } catch {
          setData(event.data)
        }
      }

      ws.onclose = () => {
        setIsConnected(false)
        if (activeRef.current) {
          // Reconnect after 3 s
          reconnectTimerRef.current = setTimeout(() => {
            connect()
          }, 3000)
        }
      }

      ws.onerror = () => {
        ws.close()
      }
    } catch {
      // If construction fails, retry after 3 s
      if (activeRef.current) {
        reconnectTimerRef.current = setTimeout(() => {
          connect()
        }, 3000)
      }
    }
  }, [url])

  useEffect(() => {
    activeRef.current = true
    connect()

    return () => {
      activeRef.current = false
      clearTimeout(reconnectTimerRef.current)
      if (wsRef.current) {
        wsRef.current.onclose = null  // prevent reconnect on intentional close
        wsRef.current.close()
      }
    }
  }, [connect])

  return { data, isConnected }
}

export default useWebSocket
