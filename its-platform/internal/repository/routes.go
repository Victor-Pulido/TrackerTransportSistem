package repository

import (
	"database/sql"
	"fmt"

	"github.com/its-demo/platform/internal/domain"
)

// ListRoutes returns all routes, filtered by operatorID when non-empty.
func ListRoutes(db *sql.DB, operatorID string) ([]domain.Route, error) {
	query := `SELECT id, operator_id, code, COALESCE(name,''), COALESCE(direction,''), active FROM routes`
	args := []interface{}{}

	if operatorID != "" {
		query += " WHERE operator_id = ?"
		args = append(args, operatorID)
	}

	rows, err := db.Query(query, args...)
	if err != nil {
		return nil, fmt.Errorf("list routes: %w", err)
	}
	defer rows.Close()

	var routes []domain.Route
	for rows.Next() {
		var r domain.Route
		var active int
		if err := rows.Scan(&r.ID, &r.OperatorID, &r.Code, &r.Name, &r.Direction, &active); err != nil {
			return nil, err
		}
		r.Active = active == 1
		routes = append(routes, r)
	}
	return routes, rows.Err()
}

// GetRoute returns a single route by ID.
func GetRoute(db *sql.DB, id string) (*domain.Route, error) {
	row := db.QueryRow(`SELECT id, operator_id, code, COALESCE(name,''), COALESCE(direction,''), active FROM routes WHERE id = ?`, id)
	var r domain.Route
	var active int
	if err := row.Scan(&r.ID, &r.OperatorID, &r.Code, &r.Name, &r.Direction, &active); err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("get route: %w", err)
	}
	r.Active = active == 1
	return &r, nil
}

// GetRouteWithStops returns a route and all its ordered stops.
func GetRouteWithStops(db *sql.DB, routeID string) (*domain.RouteWithStops, error) {
	route, err := GetRoute(db, routeID)
	if err != nil {
		return nil, err
	}
	if route == nil {
		return nil, nil
	}

	rows, err := db.Query(`
		SELECT s.id, s.operator_id, s.code, COALESCE(s.name,''), COALESCE(s.address,''), COALESCE(s.lat,0), COALESCE(s.lng,0)
		FROM route_stops rs
		JOIN stops s ON s.id = rs.stop_id
		WHERE rs.route_id = ?
		ORDER BY rs.sequence`, routeID)
	if err != nil {
		return nil, fmt.Errorf("get route stops: %w", err)
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
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return &domain.RouteWithStops{Route: *route, Stops: stops}, nil
}

// CreateRoute inserts a new route record.
func CreateRoute(db *sql.DB, r domain.Route) error {
	_, err := db.Exec(
		`INSERT INTO routes (id, operator_id, code, name, direction, active) VALUES (?, ?, ?, ?, ?, ?)`,
		r.ID, r.OperatorID, r.Code, r.Name, r.Direction, boolToInt(r.Active),
	)
	return err
}
