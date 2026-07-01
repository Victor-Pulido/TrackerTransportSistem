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

// RouteHandler handles route management endpoints.
type RouteHandler struct {
	DB *sql.DB
}

// NewRouteHandler creates a new RouteHandler.
func NewRouteHandler(db *sql.DB) *RouteHandler {
	return &RouteHandler{DB: db}
}

// List returns routes visible to the current user.
// GET /api/v1/routes
func (h *RouteHandler) List(c *gin.Context) {
	operatorID := auth.GetOperatorID(c)
	routes, err := repository.ListRoutes(h.DB, operatorID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if routes == nil {
		routes = []domain.Route{}
	}
	c.JSON(http.StatusOK, routes)
}

// Get returns a single route with its stops.
// GET /api/v1/routes/:id
func (h *RouteHandler) Get(c *gin.Context) {
	id := c.Param("id")
	rws, err := repository.GetRouteWithStops(h.DB, id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if rws == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "route not found"})
		return
	}
	c.JSON(http.StatusOK, rws)
}

// Create creates a new route.
// POST /api/v1/routes
func (h *RouteHandler) Create(c *gin.Context) {
	var r domain.Route
	if err := c.ShouldBindJSON(&r); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	claims := auth.GetClaims(c)
	if claims != nil && claims.Role == "operator" {
		r.OperatorID = claims.OperatorID
	}

	r.ID = uuid.NewString()
	r.Active = true

	if err := repository.CreateRoute(h.DB, r); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create route"})
		return
	}

	c.JSON(http.StatusCreated, r)
}
