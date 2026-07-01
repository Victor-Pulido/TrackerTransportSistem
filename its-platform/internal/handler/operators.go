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

// OperatorHandler handles operator management endpoints.
type OperatorHandler struct {
	DB *sql.DB
}

// NewOperatorHandler creates a new OperatorHandler.
func NewOperatorHandler(db *sql.DB) *OperatorHandler {
	return &OperatorHandler{DB: db}
}

// List returns all operators visible to the current user.
// GET /api/v1/operators
func (h *OperatorHandler) List(c *gin.Context) {
	operatorID := auth.GetOperatorID(c)
	operators, err := repository.ListOperators(h.DB, operatorID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if operators == nil {
		operators = []domain.Operator{}
	}
	c.JSON(http.StatusOK, operators)
}

// Create creates a new operator. Only superadmin can call this.
// POST /api/v1/operators
func (h *OperatorHandler) Create(c *gin.Context) {
	var op domain.Operator
	if err := c.ShouldBindJSON(&op); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	op.ID = uuid.NewString()
	op.Active = true

	if err := repository.CreateOperator(h.DB, op); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create operator"})
		return
	}

	c.JSON(http.StatusCreated, op)
}
