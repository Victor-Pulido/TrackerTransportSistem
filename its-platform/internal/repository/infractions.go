package repository

import (
	"database/sql"
	"fmt"

	"github.com/its-demo/platform/internal/domain"
)

// ComplianceReport summarizes contract compliance per route.
type ComplianceReport struct {
	OperatorID      string            `json:"operator_id"`
	RouteResults    []RouteCompliance `json:"route_results"`
	TotalRoutes     int               `json:"total_routes"`
	CompliantRoutes int               `json:"compliant_routes"`
}

// RouteCompliance holds compliance data for a specific route.
type RouteCompliance struct {
	RouteID       string `json:"route_id"`
	RouteCode     string `json:"route_code"`
	OperatorName  string `json:"operator_name"`
	MinDailyTrips int    `json:"min_daily_trips"`
	ActualTrips   int    `json:"actual_trips"`
	CompliancePct float64 `json:"compliance_pct"`
	Compliant     bool   `json:"compliant"`
}

// ListInfractions returns infractions with optional filters.
// Includes operator name, vehicle code, and route code via JOIN.
func ListInfractions(db *sql.DB, operatorID, severity, infrType, resolved string) ([]domain.Infraction, error) {
	q := `
		SELECT i.id,
		       i.operator_id,  COALESCE(o.name, ''),
		       COALESCE(i.vehicle_id,''),  COALESCE(v.internal_code,''),
		       COALESCE(i.route_id,''),    COALESCE(r.code,''),
		       i.type, COALESCE(i.description,''), i.severity, i.detected_at, i.resolved
		FROM   infractions i
		LEFT JOIN operators o ON i.operator_id = o.id
		LEFT JOIN vehicles  v ON i.vehicle_id  = v.id
		LEFT JOIN routes    r ON i.route_id    = r.id
		WHERE  1=1`
	args := []interface{}{}

	if operatorID != "" {
		q += " AND i.operator_id = ?"
		args = append(args, operatorID)
	}
	if severity != "" {
		q += " AND i.severity = ?"
		args = append(args, severity)
	}
	if infrType != "" {
		q += " AND i.type = ?"
		args = append(args, infrType)
	}
	if resolved != "" {
		q += " AND i.resolved = ?"
		args = append(args, resolved)
	}
	q += " ORDER BY i.detected_at DESC"

	rows, err := db.Query(q, args...)
	if err != nil {
		return nil, fmt.Errorf("list infractions: %w", err)
	}
	defer rows.Close()

	var infractions []domain.Infraction
	for rows.Next() {
		var inf domain.Infraction
		var resolvedInt int
		if err := rows.Scan(
			&inf.ID, &inf.OperatorID, &inf.OperatorName,
			&inf.VehicleID, &inf.VehicleCode,
			&inf.RouteID, &inf.RouteCode,
			&inf.Type, &inf.Description, &inf.Severity, &inf.DetectedAt, &resolvedInt,
		); err != nil {
			return nil, err
		}
		inf.Resolved = resolvedInt == 1
		infractions = append(infractions, inf)
	}
	return infractions, rows.Err()
}

// CreateInfraction inserts a new infraction record.
func CreateInfraction(db *sql.DB, inf domain.Infraction) error {
	_, err := db.Exec(
		`INSERT INTO infractions
		    (id, operator_id, vehicle_id, route_id, type, description, severity, detected_at, resolved)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		inf.ID, inf.OperatorID, inf.VehicleID, inf.RouteID,
		inf.Type, inf.Description, inf.Severity, inf.DetectedAt, boolToInt(inf.Resolved),
	)
	return err
}

// ResolveInfraction marks an infraction as resolved.
func ResolveInfraction(db *sql.DB, id string) error {
	res, err := db.Exec(`UPDATE infractions SET resolved = 1 WHERE id = ?`, id)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return fmt.Errorf("infraction %s not found", id)
	}
	return nil
}

// GetComplianceReport checks actual daily trips vs contracted minimums.
func GetComplianceReport(db *sql.DB, operatorID string) (ComplianceReport, error) {
	report := ComplianceReport{OperatorID: operatorID}

	q := `
		SELECT sc.route_id, r.code, COALESCE(o.name,''),
		       sc.min_daily_trips,
		       COUNT(t.id) AS actual_trips
		FROM   service_contracts sc
		LEFT JOIN routes    r ON r.id = sc.route_id
		LEFT JOIN operators o ON o.id = sc.operator_id
		LEFT JOIN trips     t ON t.route_id = sc.route_id
		    AND DATE(t.scheduled_start) = DATE('now')
		    AND t.status = 'COMPLETED'`
	args := []interface{}{}

	if operatorID != "" {
		q += " WHERE sc.operator_id = ?"
		args = append(args, operatorID)
	}
	q += " GROUP BY sc.route_id, r.code, o.name, sc.min_daily_trips"

	rows, err := db.Query(q, args...)
	if err != nil {
		return report, fmt.Errorf("compliance query: %w", err)
	}
	defer rows.Close()

	for rows.Next() {
		var rc RouteCompliance
		if err := rows.Scan(&rc.RouteID, &rc.RouteCode, &rc.OperatorName,
			&rc.MinDailyTrips, &rc.ActualTrips); err != nil {
			return report, err
		}
		rc.Compliant = rc.ActualTrips >= rc.MinDailyTrips
		if rc.MinDailyTrips > 0 {
			rc.CompliancePct = float64(rc.ActualTrips) / float64(rc.MinDailyTrips) * 100
			if rc.CompliancePct > 100 {
				rc.CompliancePct = 100
			}
		}
		report.RouteResults = append(report.RouteResults, rc)
		report.TotalRoutes++
		if rc.Compliant {
			report.CompliantRoutes++
		}
	}
	return report, rows.Err()
}
