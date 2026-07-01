package handler

import (
	"database/sql"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/its-demo/platform/internal/auth"
	"github.com/its-demo/platform/internal/domain"
	"github.com/its-demo/platform/internal/repository"
)

// TripHandler handles trip query endpoints.
type TripHandler struct {
	DB *sql.DB
}

// NewTripHandler creates a new TripHandler.
func NewTripHandler(db *sql.DB) *TripHandler {
	return &TripHandler{DB: db}
}

// List returns trips with optional filtering by date range and route.
// GET /api/v1/trips?from=&to=&route_id=&limit=
func (h *TripHandler) List(c *gin.Context) {
	operatorID := auth.GetOperatorID(c)
	from       := c.Query("from")
	to         := c.Query("to")
	routeID    := c.Query("route_id")
	limit, _   := strconv.Atoi(c.DefaultQuery("limit", "500"))

	trips, err := repository.ListTrips(h.DB, operatorID, from, to, routeID, limit)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if trips == nil {
		trips = []domain.Trip{}
	}
	c.JSON(http.StatusOK, trips)
}
