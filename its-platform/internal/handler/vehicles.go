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

// VehicleHandler handles vehicle management endpoints.
type VehicleHandler struct {
	DB *sql.DB
}

// NewVehicleHandler creates a new VehicleHandler.
func NewVehicleHandler(db *sql.DB) *VehicleHandler {
	return &VehicleHandler{DB: db}
}

// List returns vehicles visible to the current user.
// GET /api/v1/vehicles
func (h *VehicleHandler) List(c *gin.Context) {
	operatorID := auth.GetOperatorID(c)
	vehicles, err := repository.ListVehicles(h.DB, operatorID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if vehicles == nil {
		vehicles = []domain.Vehicle{}
	}
	c.JSON(http.StatusOK, vehicles)
}

// Create creates a new vehicle.
// POST /api/v1/vehicles
func (h *VehicleHandler) Create(c *gin.Context) {
	var v domain.Vehicle
	if err := c.ShouldBindJSON(&v); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	// Enforce tenant: operator users can only create vehicles for their own operator
	claims := auth.GetClaims(c)
	if claims != nil && claims.Role == "operator" {
		v.OperatorID = claims.OperatorID
	}

	v.ID = uuid.NewString()
	v.Active = true

	if err := repository.CreateVehicle(h.DB, v); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create vehicle"})
		return
	}

	c.JSON(http.StatusCreated, v)
}
