package repository

import (
	"database/sql"
	"fmt"
)

// PassengerReport represents a daily ridership submission by an operator.
type PassengerReport struct {
	ID              string `json:"id"`
	OperatorID      string `json:"operator_id"`
	OperatorName    string `json:"operator_name"`
	RouteID         string `json:"route_id"`
	RouteCode       string `json:"route_code"`
	RouteName       string `json:"route_name"`
	ReportDate      string `json:"report_date"`
	TotalPassengers int    `json:"total_passengers"`
	Notes           string `json:"notes"`
	SubmittedBy     string `json:"submitted_by"`
	CreatedAt       string `json:"created_at"`
}

// CreatePassengerReport inserts or upserts a passenger report.
func CreatePassengerReport(db *sql.DB, r PassengerReport) error {
	_, err := db.Exec(`
		INSERT INTO passenger_reports
		    (id, operator_id, route_id, report_date, total_passengers, notes, submitted_by)
		VALUES (?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(operator_id, route_id, report_date) DO UPDATE SET
		    total_passengers = excluded.total_passengers,
		    notes            = excluded.notes,
		    submitted_by     = excluded.submitted_by`,
		r.ID, r.OperatorID, r.RouteID, r.ReportDate, r.TotalPassengers, r.Notes, r.SubmittedBy,
	)
	return err
}

// ListPassengerReports returns reports filtered by operator and/or date range.
// If operatorID is empty, returns reports from all operators.
func ListPassengerReports(db *sql.DB, operatorID, from, to string) ([]PassengerReport, error) {
	q := `
		SELECT pr.id, pr.operator_id, o.name, pr.route_id,
		       r.code, COALESCE(r.name, ''),
		       pr.report_date, pr.total_passengers,
		       COALESCE(pr.notes, ''), COALESCE(pr.submitted_by, ''), pr.created_at
		FROM   passenger_reports pr
		JOIN   operators o ON pr.operator_id = o.id
		JOIN   routes    r ON pr.route_id    = r.id
		WHERE  1=1`
	args := []interface{}{}

	if operatorID != "" {
		q += " AND pr.operator_id = ?"
		args = append(args, operatorID)
	}
	if from != "" {
		q += " AND pr.report_date >= ?"
		args = append(args, from)
	}
	if to != "" {
		q += " AND pr.report_date <= ?"
		args = append(args, to)
	}
	q += " ORDER BY pr.report_date DESC, o.name ASC"

	rows, err := db.Query(q, args...)
	if err != nil {
		return nil, fmt.Errorf("list passenger reports: %w", err)
	}
	defer rows.Close()

	var reports []PassengerReport
	for rows.Next() {
		var r PassengerReport
		if err := rows.Scan(
			&r.ID, &r.OperatorID, &r.OperatorName,
			&r.RouteID, &r.RouteCode, &r.RouteName,
			&r.ReportDate, &r.TotalPassengers, &r.Notes, &r.SubmittedBy, &r.CreatedAt,
		); err != nil {
			return nil, err
		}
		reports = append(reports, r)
	}
	return reports, rows.Err()
}
