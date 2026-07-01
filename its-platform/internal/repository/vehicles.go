package repository

import (
	"database/sql"
	"fmt"

	"github.com/its-demo/platform/internal/domain"
)

// ListVehicles returns vehicles, filtered by operatorID when non-empty.
func ListVehicles(db *sql.DB, operatorID string) ([]domain.Vehicle, error) {
	query := `SELECT id, operator_id, license_plate, COALESCE(internal_code,''), capacity, COALESCE(model,''), COALESCE(year,0), active FROM vehicles`
	args := []interface{}{}

	if operatorID != "" {
		query += " WHERE operator_id = ?"
		args = append(args, operatorID)
	}

	rows, err := db.Query(query, args...)
	if err != nil {
		return nil, fmt.Errorf("list vehicles: %w", err)
	}
	defer rows.Close()

	var vehicles []domain.Vehicle
	for rows.Next() {
		var v domain.Vehicle
		var active int
		if err := rows.Scan(&v.ID, &v.OperatorID, &v.LicensePlate, &v.InternalCode, &v.Capacity, &v.Model, &v.Year, &active); err != nil {
			return nil, err
		}
		v.Active = active == 1
		vehicles = append(vehicles, v)
	}
	return vehicles, rows.Err()
}

// GetVehicle returns a single vehicle by ID, optionally enforcing tenant isolation.
func GetVehicle(db *sql.DB, id, operatorID string) (*domain.Vehicle, error) {
	query := `SELECT id, operator_id, license_plate, COALESCE(internal_code,''), capacity, COALESCE(model,''), COALESCE(year,0), active FROM vehicles WHERE id = ?`
	args := []interface{}{id}

	if operatorID != "" {
		query += " AND operator_id = ?"
		args = append(args, operatorID)
	}

	row := db.QueryRow(query, args...)
	var v domain.Vehicle
	var active int
	if err := row.Scan(&v.ID, &v.OperatorID, &v.LicensePlate, &v.InternalCode, &v.Capacity, &v.Model, &v.Year, &active); err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("get vehicle: %w", err)
	}
	v.Active = active == 1
	return &v, nil
}

// CreateVehicle inserts a new vehicle record.
func CreateVehicle(db *sql.DB, v domain.Vehicle) error {
	_, err := db.Exec(
		`INSERT INTO vehicles (id, operator_id, license_plate, internal_code, capacity, model, year, active) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
		v.ID, v.OperatorID, v.LicensePlate, v.InternalCode, v.Capacity, v.Model, v.Year, boolToInt(v.Active),
	)
	return err
}
