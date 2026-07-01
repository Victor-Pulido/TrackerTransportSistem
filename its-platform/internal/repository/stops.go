package repository

import (
	"database/sql"
	"fmt"

	"github.com/its-demo/platform/internal/domain"
)

// ListStops returns all stops, filtered by operatorID when non-empty.
func ListStops(db *sql.DB, operatorID string) ([]domain.Stop, error) {
	query := `SELECT id, operator_id, code, COALESCE(name,''), COALESCE(address,''), COALESCE(lat,0), COALESCE(lng,0) FROM stops`
	args := []interface{}{}

	if operatorID != "" {
		query += " WHERE operator_id = ?"
		args = append(args, operatorID)
	}

	rows, err := db.Query(query, args...)
	if err != nil {
		return nil, fmt.Errorf("list stops: %w", err)
	}
	defer rows.Close()

	var stops []domain.Stop
	for rows.Next() {
		var s domain.Stop
		if err := rows.Scan(&s.ID, &s.OperatorID, &s.Code, &s.Name, &s.Address, &s.Lat, &s.Lng); err != nil {
			return nil, err
		}
		stops = append(stops, s)
	}
	return stops, rows.Err()
}

// GetStop returns a single stop by ID.
func GetStop(db *sql.DB, id string) (*domain.Stop, error) {
	row := db.QueryRow(`SELECT id, operator_id, code, COALESCE(name,''), COALESCE(address,''), COALESCE(lat,0), COALESCE(lng,0) FROM stops WHERE id = ?`, id)
	var s domain.Stop
	if err := row.Scan(&s.ID, &s.OperatorID, &s.Code, &s.Name, &s.Address, &s.Lat, &s.Lng); err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("get stop: %w", err)
	}
	return &s, nil
}

// CreateStop inserts a new stop record.
func CreateStop(db *sql.DB, s domain.Stop) error {
	_, err := db.Exec(
		`INSERT INTO stops (id, operator_id, code, name, address, lat, lng) VALUES (?, ?, ?, ?, ?, ?, ?)`,
		s.ID, s.OperatorID, s.Code, s.Name, s.Address, s.Lat, s.Lng,
	)
	return err
}

// GetStopsByRoute returns ordered stops for a given route.
func GetStopsByRoute(db *sql.DB, routeID string) ([]domain.Stop, error) {
	rows, err := db.Query(`
		SELECT s.id, s.operator_id, s.code, COALESCE(s.name,''), COALESCE(s.address,''), COALESCE(s.lat,0), COALESCE(s.lng,0)
		FROM route_stops rs
		JOIN stops s ON s.id = rs.stop_id
		WHERE rs.route_id = ?
		ORDER BY rs.sequence`, routeID)
	if err != nil {
		return nil, fmt.Errorf("get stops by route: %w", err)
	}
	defer rows.Close()

	var stops []domain.Stop
	for rows.Next() {
		var s domain.Stop
		if err := rows.Scan(&s.ID, &s.OperatorID, &s.Code, &s.Name, &s.Address, &s.Lat, &s.Lng); err != nil {
			return nil, err
		}
		stops = append(stops, s)
	}
	return stops, rows.Err()
}
