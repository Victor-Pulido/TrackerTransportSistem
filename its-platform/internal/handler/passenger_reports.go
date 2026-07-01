package handler

import (
	"database/sql"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/its-demo/platform/internal/auth"
	"github.com/its-demo/platform/internal/repository"
)

// PassengerReportHandler handles daily ridership report endpoints.
type PassengerReportHandler struct{ db *sql.DB }

// NewPassengerReportHandler creates a new PassengerReportHandler.
func NewPassengerReportHandler(db *sql.DB) *PassengerReportHandler {
	return &PassengerReportHandler{db: db}
}

type createReportReq struct {
	RouteID         string `json:"route_id"         binding:"required"`
	ReportDate      string `json:"report_date"      binding:"required"`
	TotalPassengers int    `json:"total_passengers" binding:"min=0"`
	Notes           string `json:"notes"`
}

// Create submits a daily passenger report for the authenticated operator.
// POST /api/v1/reports/passengers
func (h *PassengerReportHandler) Create(c *gin.Context) {
	var req createReportReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	claims := auth.GetClaims(c)
	if claims == nil || claims.OperatorID == "" {
		c.JSON(http.StatusForbidden, gin.H{"error": "operator context required"})
		return
	}

	r := repository.PassengerReport{
		ID:              uuid.NewString(),
		OperatorID:      claims.OperatorID,
		RouteID:         req.RouteID,
		ReportDate:      req.ReportDate,
		TotalPassengers: req.TotalPassengers,
		Notes:           req.Notes,
		SubmittedBy:     claims.UserID,
	}

	if err := repository.CreatePassengerReport(h.db, r); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to save report"})
		return
	}

	c.JSON(http.StatusCreated, r)
}

// List returns passenger reports.
// Operators see only their own reports; fiscalizadores/superadmin see all.
// GET /api/v1/reports/passengers?operator_id=&from=&to=
func (h *PassengerReportHandler) List(c *gin.Context) {
	operatorID := auth.GetOperatorID(c)

	// Fiscalizador/superadmin can filter by a specific operator
	if qOp := c.Query("operator_id"); qOp != "" && operatorID == "" {
		operatorID = qOp
	}

	reports, err := repository.ListPassengerReports(h.db, operatorID, c.Query("from"), c.Query("to"))
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if reports == nil {
		reports = []repository.PassengerReport{}
	}
	c.JSON(http.StatusOK, gin.H{"reports": reports, "total": len(reports)})
}
