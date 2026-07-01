package service

import (
	"database/sql"

	"github.com/its-demo/platform/internal/repository"
)

// AnalyticsService provides business logic wrappers over analytics repository queries.
type AnalyticsService struct {
	DB *sql.DB
}

// NewAnalyticsService creates a new AnalyticsService.
func NewAnalyticsService(db *sql.DB) *AnalyticsService {
	return &AnalyticsService{DB: db}
}

// GetLoadProfile returns the passenger load profile for a trip.
func (s *AnalyticsService) GetLoadProfile(tripID string) ([]repository.LoadProfileRow, error) {
	return repository.LoadProfile(s.DB, tripID)
}

// GetPeakDemand returns hourly demand aggregated for the given operator and period.
func (s *AnalyticsService) GetPeakDemand(operatorID, from, to string) ([]repository.PeakDemandRow, error) {
	return repository.PeakDemand(s.DB, operatorID, from, to)
}

// GetEfficiency returns per-route efficiency metrics.
func (s *AnalyticsService) GetEfficiency(operatorID string) ([]repository.EfficiencyRow, error) {
	return repository.Efficiency(s.DB, operatorID)
}

// GetOccupancyRate returns peak occupancy per trip.
func (s *AnalyticsService) GetOccupancyRate(operatorID string) ([]repository.OccupancyRow, error) {
	return repository.OccupancyRate(s.DB, operatorID)
}
