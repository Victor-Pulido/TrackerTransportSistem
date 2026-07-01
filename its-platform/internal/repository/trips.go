package repository

import (
	"database/sql"
	"fmt"
	"strings"

	"github.com/its-demo/platform/internal/domain"
)

// ListTrips returns trips with optional filtering by operatorID, date range, and routeID.
// limit caps the result set (default 500). Results include route_code and vehicle_code.
func ListTrips(db *sql.DB, operatorID, from, to, routeID string, limit int) ([]domain.Trip, error) {
	if limit <= 0 || limit > 500 {
		limit = 500
	}
	query := `
		SELECT t.id, t.vehicle_id, t.route_id, t.operator_id,
			COALESCE(t.scheduled_start,''), COALESCE(t.actual_start,''), COALESCE(t.actual_end,''),
			t.status,
			COALESCE(r.code,''), COALESCE(v.internal_code,'')
		FROM trips t
		LEFT JOIN routes r   ON r.id = t.route_id
		LEFT JOIN vehicles v ON v.id = t.vehicle_id
		WHERE 1=1`
	args := []interface{}{}

	if operatorID != "" {
		query += " AND t.operator_id = ?"
		args = append(args, operatorID)
	}
	if from != "" {
		query += " AND t.scheduled_start >= ?"
		args = append(args, from)
	}
	if to != "" {
		query += " AND t.scheduled_start <= ?"
		args = append(args, to)
	}
	if routeID != "" {
		query += " AND t.route_id = ?"
		args = append(args, routeID)
	}

	query += fmt.Sprintf(" ORDER BY t.scheduled_start DESC LIMIT %d", limit)

	rows, err := db.Query(query, args...)
	if err != nil {
		return nil, fmt.Errorf("list trips: %w", err)
	}
	defer rows.Close()

	var trips []domain.Trip
	for rows.Next() {
		var t domain.Trip
		if err := rows.Scan(
			&t.ID, &t.VehicleID, &t.RouteID, &t.OperatorID,
			&t.ScheduledStart, &t.ActualStart, &t.ActualEnd, &t.Status,
			&t.RouteCode, &t.VehicleCode,
		); err != nil {
			return nil, err
		}
		trips = append(trips, t)
	}
	return trips, rows.Err()
}

// GetTrip returns a single trip by ID.
func GetTrip(db *sql.DB, id string) (*domain.Trip, error) {
	row := db.QueryRow(`SELECT id, vehicle_id, route_id, operator_id,
		COALESCE(scheduled_start,''), COALESCE(actual_start,''), COALESCE(actual_end,''), status
		FROM trips WHERE id = ?`, id)

	var t domain.Trip
	if err := row.Scan(&t.ID, &t.VehicleID, &t.RouteID, &t.OperatorID,
		&t.ScheduledStart, &t.ActualStart, &t.ActualEnd, &t.Status); err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("get trip: %w", err)
	}
	return &t, nil
}

// CreateTrip inserts a new trip record.
func CreateTrip(db *sql.DB, t domain.Trip) error {
	_, err := db.Exec(
		`INSERT INTO trips (id, vehicle_id, route_id, operator_id, scheduled_start, actual_start, actual_end, status)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		t.ID, t.VehicleID, t.RouteID, t.OperatorID,
		t.ScheduledStart, t.ActualStart, t.ActualEnd, t.Status,
	)
	return err
}

// UpdateTripStatus changes the status and actual_end of a trip.
func UpdateTripStatus(db *sql.DB, id, status, actualEnd string) error {
	fields := []string{"status = ?"}
	args := []interface{}{status}

	if actualEnd != "" {
		fields = append(fields, "actual_end = ?")
		args = append(args, actualEnd)
	}
	args = append(args, id)

	_, err := db.Exec(
		fmt.Sprintf("UPDATE trips SET %s WHERE id = ?", strings.Join(fields, ", ")),
		args...,
	)
	return err
}
