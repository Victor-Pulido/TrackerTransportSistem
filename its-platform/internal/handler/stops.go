package handler

import (
	"database/sql"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/its-demo/platform/internal/auth"
	"github.com/its-demo/platform/internal/domain"
	"github.com/its-demo/platform/internal/repository"
)

// StopHandler handles stop management endpoints.
type StopHandler struct {
	DB *sql.DB
}

// NewStopHandler creates a new StopHandler.
func NewStopHandler(db *sql.DB) *StopHandler {
	return &StopHandler{DB: db}
}

// List returns stops visible to the current user.
// GET /api/v1/stops
func (h *StopHandler) List(c *gin.Context) {
	operatorID := auth.GetOperatorID(c)
	stops, err := repository.ListStops(h.DB, operatorID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if stops == nil {
		stops = []domain.Stop{}
	}
	c.JSON(http.StatusOK, stops)
}

// Create creates a new stop.
// POST /api/v1/stops
func (h *StopHandler) Create(c *gin.Context) {
	var s domain.Stop
	if err := c.ShouldBindJSON(&s); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	claims := auth.GetClaims(c)
	if claims != nil && claims.Role == "operator" {
		s.OperatorID = claims.OperatorID
	}

	s.ID = uuid.NewString()

	if err := repository.CreateStop(h.DB, s); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create stop"})
		return
	}

	c.JSON(http.StatusCreated, s)
}
