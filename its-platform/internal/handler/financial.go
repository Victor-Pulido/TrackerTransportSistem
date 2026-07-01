package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/its-demo/platform/internal/auth"
	"github.com/its-demo/platform/internal/service"
)

// FinancialHandler handles financial reporting endpoints.
type FinancialHandler struct {
	Svc *service.FinancialService
}

// NewFinancialHandler creates a new FinancialHandler.
func NewFinancialHandler(svc *service.FinancialService) *FinancialHandler {
	return &FinancialHandler{Svc: svc}
}

// Revenue returns daily revenue totals for the given period.
// GET /api/v1/financial/revenue?from=&to=
func (h *FinancialHandler) Revenue(c *gin.Context) {
	operatorID := auth.GetOperatorID(c)
	from := c.Query("from")
	to := c.Query("to")

	rows, err := h.Svc.GetRevenue(operatorID, from, to)
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

// KmOperated returns daily km operated for the given period.
// GET /api/v1/financial/km-operated?from=&to=
func (h *FinancialHandler) KmOperated(c *gin.Context) {
	operatorID := auth.GetOperatorID(c)
	from := c.Query("from")
	to := c.Query("to")

	rows, err := h.Svc.GetKmOperated(operatorID, from, to)
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

// Subsidies computes the daily subsidy (standard_cost - revenue) per operator.
// GET /api/v1/financial/subsidies?from=&to=
func (h *FinancialHandler) Subsidies(c *gin.Context) {
	operatorID := auth.GetOperatorID(c)
	from := c.Query("from")
	to := c.Query("to")

	rows, err := h.Svc.GetSubsidies(operatorID, from, to)
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
