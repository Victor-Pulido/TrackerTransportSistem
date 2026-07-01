package handler

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/its-demo/platform/internal/auth"
	"github.com/its-demo/platform/internal/domain"
	"github.com/its-demo/platform/internal/service"
)

// FiscalizationHandler handles fiscalization endpoints.
type FiscalizationHandler struct {
	Svc *service.FiscalizationService
}

// NewFiscalizationHandler creates a new FiscalizationHandler.
func NewFiscalizationHandler(svc *service.FiscalizationService) *FiscalizationHandler {
	return &FiscalizationHandler{Svc: svc}
}

// Compliance returns the compliance report comparing actual trips vs contracted minimums.
// GET /api/v1/fiscalization/compliance
func (h *FiscalizationHandler) Compliance(c *gin.Context) {
	operatorID := auth.GetOperatorID(c)
	if qOp := c.Query("operator_id"); qOp != "" && operatorID == "" {
		operatorID = qOp
	}
	report, err := h.Svc.GetComplianceReport(operatorID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, report)
}

// ListInfractions returns infractions with optional filters.
// GET /api/v1/fiscalization/infractions?operator_id=&severity=&type=&resolved=
func (h *FiscalizationHandler) ListInfractions(c *gin.Context) {
	operatorID := auth.GetOperatorID(c)
	if qOp := c.Query("operator_id"); qOp != "" && operatorID == "" {
		operatorID = qOp
	}
	infractions, err := h.Svc.ListInfractions(
		operatorID,
		c.Query("severity"),
		c.Query("type"),
		c.Query("resolved"),
	)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if infractions == nil {
		infractions = []domain.Infraction{}
	}
	c.JSON(http.StatusOK, gin.H{"infractions": infractions, "total": len(infractions)})
}

// CreateInfraction registers a new infraction.
// POST /api/v1/fiscalization/infractions
func (h *FiscalizationHandler) CreateInfraction(c *gin.Context) {
	var inf domain.Infraction
	if err := c.ShouldBindJSON(&inf); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}
	claims := auth.GetClaims(c)
	if claims != nil && claims.Role == "operator" {
		inf.OperatorID = claims.OperatorID
	}
	if err := h.Svc.CreateInfraction(inf); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create infraction"})
		return
	}
	c.JSON(http.StatusCreated, inf)
}

// ResolveInfraction marks an infraction as resolved.
// PATCH /api/v1/fiscalization/infractions/:id/resolve
func (h *FiscalizationHandler) ResolveInfraction(c *gin.Context) {
	id := c.Param("id")
	if err := h.Svc.ResolveInfraction(id); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	c.JSON(http.StatusOK, gin.H{"message": "infraction resolved"})
}
