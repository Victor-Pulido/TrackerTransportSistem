package service

import (
	"database/sql"

	"github.com/its-demo/platform/internal/repository"
)

const standardCostPerKm = 4500.0 // COP per km (subsidy reference cost)

// FinancialService handles revenue, km, and subsidy calculations.
type FinancialService struct {
	DB *sql.DB
}

// NewFinancialService creates a new FinancialService.
func NewFinancialService(db *sql.DB) *FinancialService {
	return &FinancialService{DB: db}
}

// GetRevenue returns daily revenue rows for the given operator and period.
func (s *FinancialService) GetRevenue(operatorID, from, to string) ([]repository.RevenueRow, error) {
	return repository.GetRevenue(s.DB, operatorID, from, to)
}

// GetKmOperated returns daily km operated rows for the given operator and period.
func (s *FinancialService) GetKmOperated(operatorID, from, to string) ([]repository.KmRow, error) {
	return repository.GetKmOperated(s.DB, operatorID, from, to)
}

// SubsidyRow holds daily subsidy calculation results.
type SubsidyRow struct {
	RecordDate   string  `json:"record_date"`
	OperatorID   string  `json:"operator_id"`
	Revenue      float64 `json:"revenue"`
	KmOperated   float64 `json:"km_operated"`
	StandardCost float64 `json:"standard_cost"`
	Subsidy      float64 `json:"subsidy"`
}

// GetSubsidies computes daily subsidy = standard_cost - revenue for each day in the range.
// standard_cost = km_operated * 4500 COP/km
func (s *FinancialService) GetSubsidies(operatorID, from, to string) ([]SubsidyRow, error) {
	revenues, err := repository.GetRevenue(s.DB, operatorID, from, to)
	if err != nil {
		return nil, err
	}
	kms, err := repository.GetKmOperated(s.DB, operatorID, from, to)
	if err != nil {
		return nil, err
	}

	// Index km rows by (date, operator)
	type key struct{ date, op string }
	kmMap := make(map[key]float64)
	for _, k := range kms {
		kmMap[key{k.RecordDate, k.OperatorID}] = k.KmOperated
	}

	var result []SubsidyRow
	for _, rev := range revenues {
		km := kmMap[key{rev.RecordDate, rev.OperatorID}]
		standardCost := km * standardCostPerKm
		subsidy := standardCost - rev.Revenue
		result = append(result, SubsidyRow{
			RecordDate:   rev.RecordDate,
			OperatorID:   rev.OperatorID,
			Revenue:      rev.Revenue,
			KmOperated:   km,
			StandardCost: standardCost,
			Subsidy:      subsidy,
		})
	}
	return result, nil
}
