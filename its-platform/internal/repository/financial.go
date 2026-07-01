package repository

import (
	"database/sql"
	"fmt"

	"github.com/its-demo/platform/internal/domain"
)

// RevenueRow holds daily revenue aggregation per operator.
type RevenueRow struct {
	RecordDate string  `json:"record_date"`
	Revenue    float64 `json:"revenue"`
	OperatorID string  `json:"operator_id"`
}

// KmRow holds daily km operated per operator.
type KmRow struct {
	RecordDate string  `json:"record_date"`
	KmOperated float64 `json:"km_operated"`
	OperatorID string  `json:"operator_id"`
}

// GetRevenue returns daily revenue totals for a date range.
func GetRevenue(db *sql.DB, operatorID, from, to string) ([]RevenueRow, error) {
	query := `
		SELECT record_date, SUM(revenue) AS revenue, operator_id
		FROM financial_records
		WHERE record_type = 'DAILY_REVENUE'`
	args := []interface{}{}

	if operatorID != "" {
		query += " AND operator_id = ?"
		args = append(args, operatorID)
	}
	if from != "" {
		query += " AND record_date >= ?"
		args = append(args, from)
	}
	if to != "" {
		query += " AND record_date <= ?"
		args = append(args, to)
	}

	query += " GROUP BY record_date, operator_id ORDER BY record_date"

	rows, err := db.Query(query, args...)
	if err != nil {
		return nil, fmt.Errorf("get revenue: %w", err)
	}
	defer rows.Close()

	var result []RevenueRow
	for rows.Next() {
		var r RevenueRow
		if err := rows.Scan(&r.RecordDate, &r.Revenue, &r.OperatorID); err != nil {
			return nil, err
		}
		result = append(result, r)
	}
	return result, rows.Err()
}

// GetKmOperated returns daily km operated for a date range.
func GetKmOperated(db *sql.DB, operatorID, from, to string) ([]KmRow, error) {
	query := `
		SELECT record_date, SUM(km_operated) AS km_operated, operator_id
		FROM financial_records
		WHERE record_type = 'DAILY_REVENUE'`
	args := []interface{}{}

	if operatorID != "" {
		query += " AND operator_id = ?"
		args = append(args, operatorID)
	}
	if from != "" {
		query += " AND record_date >= ?"
		args = append(args, from)
	}
	if to != "" {
		query += " AND record_date <= ?"
		args = append(args, to)
	}

	query += " GROUP BY record_date, operator_id ORDER BY record_date"

	rows, err := db.Query(query, args...)
	if err != nil {
		return nil, fmt.Errorf("get km operated: %w", err)
	}
	defer rows.Close()

	var result []KmRow
	for rows.Next() {
		var r KmRow
		if err := rows.Scan(&r.RecordDate, &r.KmOperated, &r.OperatorID); err != nil {
			return nil, err
		}
		result = append(result, r)
	}
	return result, rows.Err()
}

// InsertFinancialRecord inserts a single financial record.
func InsertFinancialRecord(db *sql.DB, r domain.FinancialRecord) error {
	_, err := db.Exec(
		`INSERT INTO financial_records (id, operator_id, trip_id, record_date, revenue, km_operated, trips_completed, record_type)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		r.ID, r.OperatorID, r.TripID, r.RecordDate, r.Revenue, r.KmOperated, r.TripsCompleted, r.RecordType,
	)
	return err
}
