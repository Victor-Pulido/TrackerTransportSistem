package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/its-demo/platform/internal/auth"
	"github.com/its-demo/platform/internal/service"
)

// AnalyticsHandler handles analytics query endpoints.
type AnalyticsHandler struct {
	Svc *service.AnalyticsService
}

// NewAnalyticsHandler creates a new AnalyticsHandler.
func NewAnalyticsHandler(svc *service.AnalyticsService) *AnalyticsHandler {
	return &AnalyticsHandler{Svc: svc}
}

// LoadProfile returns the passenger load profile for a specific trip.
// GET /api/v1/analytics/load-profile?trip_id=
func (h *AnalyticsHandler) LoadProfile(c *gin.Context) {
	tripID := c.Query("trip_id")
	if tripID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "trip_id is required"})
		return
	}

	rows, err := h.Svc.GetLoadProfile(tripID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if rows == nil {
		c.JSON(http.StatusOK, []interface{}{})
		return
	}
	c.JSON(http.StatusOK, rows)
}

// PeakDemand returns aggregated hourly demand with moving average.
// GET /api/v1/analytics/peak-demand?from=&to=
func (h *AnalyticsHandler) PeakDemand(c *gin.Context) {
	operatorID := auth.GetOperatorID(c)
	from := c.Query("from")
	to := c.Query("to")

	rows, err := h.Svc.GetPeakDemand(operatorID, from, to)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if rows == nil {
		c.JSON(http.StatusOK, []interface{}{})
		return
	}
	c.JSON(http.StatusOK, rows)
}

// Efficiency returns per-route operational efficiency metrics.
// GET /api/v1/analytics/efficiency
func (h *AnalyticsHandler) Efficiency(c *gin.Context) {
	operatorID := auth.GetOperatorID(c)

	rows, err := h.Svc.GetEfficiency(operatorID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if rows == nil {
		c.JSON(http.StatusOK, []interface{}{})
		return
	}
	c.JSON(http.StatusOK, rows)
}

// OccupancyRate returns peak occupancy per trip.
// GET /api/v1/analytics/occupancy-rate
func (h *AnalyticsHandler) OccupancyRate(c *gin.Context) {
	operatorID := auth.GetOperatorID(c)

	rows, err := h.Svc.GetOccupancyRate(operatorID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if rows == nil {
		c.JSON(http.StatusOK, []interface{}{})
		return
	}
	c.JSON(http.StatusOK, rows)
}
