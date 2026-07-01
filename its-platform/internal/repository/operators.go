package repository

import (
	"database/sql"
	"fmt"

	"github.com/its-demo/platform/internal/domain"
)

// ListOperators returns all operators. If operatorID is non-empty only that operator is returned.
func ListOperators(db *sql.DB, operatorID string) ([]domain.Operator, error) {
	query := `SELECT id, name, code, COALESCE(nit,''), active, created_at FROM operators`
	args := []interface{}{}

	if operatorID != "" {
		query += " WHERE id = ?"
		args = append(args, operatorID)
	}

	rows, err := db.Query(query, args...)
	if err != nil {
		return nil, fmt.Errorf("list operators: %w", err)
	}
	defer rows.Close()

	var operators []domain.Operator
	for rows.Next() {
		var o domain.Operator
		var active int
		if err := rows.Scan(&o.ID, &o.Name, &o.Code, &o.NIT, &active, &o.CreatedAt); err != nil {
			return nil, err
		}
		o.Active = active == 1
		operators = append(operators, o)
	}
	return operators, rows.Err()
}

// GetOperator returns a single operator by ID.
func GetOperator(db *sql.DB, id string) (*domain.Operator, error) {
	row := db.QueryRow(`SELECT id, name, code, COALESCE(nit,''), active, created_at FROM operators WHERE id = ?`, id)
	var o domain.Operator
	var active int
	if err := row.Scan(&o.ID, &o.Name, &o.Code, &o.NIT, &active, &o.CreatedAt); err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("get operator: %w", err)
	}
	o.Active = active == 1
	return &o, nil
}

// CreateOperator inserts a new operator record.
func CreateOperator(db *sql.DB, o domain.Operator) error {
	_, err := db.Exec(
		`INSERT INTO operators (id, name, code, nit, active) VALUES (?, ?, ?, ?, ?)`,
		o.ID, o.Name, o.Code, o.NIT, boolToInt(o.Active),
	)
	return err
}

// UpdateOperator modifies name, code, nit and active fields for the given operator.
func UpdateOperator(db *sql.DB, o domain.Operator) error {
	_, err := db.Exec(
		`UPDATE operators SET name=?, code=?, nit=?, active=? WHERE id=?`,
		o.Name, o.Code, o.NIT, boolToInt(o.Active), o.ID,
	)
	return err
}

func boolToInt(b bool) int {
	if b {
		return 1
	}
	return 0
}
