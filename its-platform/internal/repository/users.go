package repository

import (
	"database/sql"
	"fmt"

	"github.com/its-demo/platform/internal/domain"
)

// GetUserByEmail returns a user by their email address.
func GetUserByEmail(db *sql.DB, email string) (*domain.User, error) {
	row := db.QueryRow(`
		SELECT id, COALESCE(operator_id,''), email, password_hash, COALESCE(full_name,''), role, active, created_at
		FROM users WHERE email = ? AND active = 1`, email)

	var u domain.User
	var active int
	if err := row.Scan(&u.ID, &u.OperatorID, &u.Email, &u.PasswordHash, &u.FullName, &u.Role, &active, &u.CreatedAt); err != nil {
		if err == sql.ErrNoRows {
			return nil, nil
		}
		return nil, fmt.Errorf("get user by email: %w", err)
	}
	u.Active = active == 1
	return &u, nil
}

// CreateUser inserts a new user record.
func CreateUser(db *sql.DB, u domain.User) error {
	operatorID := interface{}(nil)
	if u.OperatorID != "" {
		operatorID = u.OperatorID
	}
	_, err := db.Exec(
		`INSERT INTO users (id, operator_id, email, password_hash, full_name, role, active) VALUES (?, ?, ?, ?, ?, ?, ?)`,
		u.ID, operatorID, u.Email, u.PasswordHash, u.FullName, u.Role, boolToInt(u.Active),
	)
	return err
}
