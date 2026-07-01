package service

import (
	"database/sql"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/its-demo/platform/internal/domain"
	"github.com/its-demo/platform/internal/repository"
)

// FiscalizationService handles compliance checking and infraction management.
type FiscalizationService struct {
	DB *sql.DB
}

// NewFiscalizationService creates a new FiscalizationService.
func NewFiscalizationService(db *sql.DB) *FiscalizationService {
	return &FiscalizationService{DB: db}
}

// GetComplianceReport returns the compliance report for an operator.
func (s *FiscalizationService) GetComplianceReport(operatorID string) (repository.ComplianceReport, error) {
	return repository.GetComplianceReport(s.DB, operatorID)
}

// ListInfractions returns infractions with optional filters.
func (s *FiscalizationService) ListInfractions(operatorID, severity, infrType, resolved string) ([]domain.Infraction, error) {
	return repository.ListInfractions(s.DB, operatorID, severity, infrType, resolved)
}

// ResolveInfraction marks an infraction as resolved.
func (s *FiscalizationService) ResolveInfraction(id string) error {
	return repository.ResolveInfraction(s.DB, id)
}

// CreateInfraction creates a new infraction record.
func (s *FiscalizationService) CreateInfraction(inf domain.Infraction) error {
	if inf.ID == "" {
		inf.ID = uuid.NewString()
	}
	if inf.DetectedAt == "" {
		inf.DetectedAt = time.Now().UTC().Format(time.RFC3339)
	}
	return repository.CreateInfraction(s.DB, inf)
}

// DetectFrequencyInfractions checks trips completed vs service_contracts.min_daily_trips
// for the given operator and creates infraction records for any violations found.
func (s *FiscalizationService) DetectFrequencyInfractions(operatorID string) (int, error) {
	report, err := repository.GetComplianceReport(s.DB, operatorID)
	if err != nil {
		return 0, err
	}

	count := 0
	for _, rc := range report.RouteResults {
		if rc.Compliant {
			continue
		}

		inf := domain.Infraction{
			ID:          uuid.NewString(),
			OperatorID:  operatorID,
			RouteID:     rc.RouteID,
			Type:        "FREQUENCY",
			Description: fmt.Sprintf("Route %s: expected %d trips, completed %d today", rc.RouteCode, rc.MinDailyTrips, rc.ActualTrips),
			Severity:    "HIGH",
			DetectedAt:  time.Now().UTC().Format(time.RFC3339),
			Resolved:    false,
		}
		if err := repository.CreateInfraction(s.DB, inf); err != nil {
			return count, err
		}
		count++
	}
	return count, nil
}
