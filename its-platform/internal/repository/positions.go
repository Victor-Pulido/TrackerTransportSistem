package repository

import (
	"database/sql"
	"fmt"

	"github.com/its-demo/platform/internal/domain"
)

// InsertPosition inserts a GPS telemetry record.
func InsertPosition(db *sql.DB, p domain.VehiclePosition) error {
	_, err := db.Exec(
		`INSERT INTO vehicle_positions (id, vehicle_id, operator_id, lat, lng, speed_kmh, heading, timestamp)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		p.ID, p.VehicleID, p.OperatorID, p.Lat, p.Lng, p.SpeedKmh, p.Heading, p.Timestamp,
	)
	return err
}

// GetLatestPositions returns the most recent GPS position for each active vehicle of an operator.
func GetLatestPositions(db *sql.DB, operatorID string) ([]domain.VehiclePosition, error) {
	query := `
		SELECT vp.id, vp.vehicle_id, vp.operator_id, vp.lat, vp.lng, vp.speed_kmh, vp.heading, vp.timestamp
		FROM vehicle_positions vp
		INNER JOIN (
			SELECT vehicle_id, MAX(timestamp) AS max_ts
			FROM vehicle_positions`
	args := []interface{}{}

	if operatorID != "" {
		query += " WHERE operator_id = ?"
		args = append(args, operatorID)
	}

	query += `
			GROUP BY vehicle_id
		) latest ON latest.vehicle_id = vp.vehicle_id AND latest.max_ts = vp.timestamp`

	if operatorID != "" {
		query += " WHERE vp.operator_id = ?"
		args = append(args, operatorID)
	}

	rows, err := db.Query(query, args...)
	if err != nil {
		return nil, fmt.Errorf("get latest positions: %w", err)
	}
	defer rows.Close()

	var positions []domain.VehiclePosition
	for rows.Next() {
		var p domain.VehiclePosition
		if err := rows.Scan(&p.ID, &p.VehicleID, &p.OperatorID, &p.Lat, &p.Lng, &p.SpeedKmh, &p.Heading, &p.Timestamp); err != nil {
			return nil, err
		}
		positions = append(positions, p)
	}
	return positions, rows.Err()
}
