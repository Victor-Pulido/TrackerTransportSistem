package repository

import (
	"database/sql"
	"embed"
	"fmt"
	"io/fs"
	"log"
	"sort"
	"strings"

	_ "modernc.org/sqlite"
)

// InitDB opens (or creates) the SQLite database at dbPath, enables WAL mode and
// foreign keys, then applies all pending migrations from the embedded FS.
func InitDB(dbPath string, migrationsFS embed.FS) (*sql.DB, error) {
	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		return nil, fmt.Errorf("open db: %w", err)
	}

	// SQLite concurrency settings
	if _, err := db.Exec("PRAGMA journal_mode=WAL;"); err != nil {
		return nil, fmt.Errorf("set WAL mode: %w", err)
	}
	if _, err := db.Exec("PRAGMA foreign_keys=ON;"); err != nil {
		return nil, fmt.Errorf("enable foreign keys: %w", err)
	}

	// Ensure schema_migrations table exists
	if _, err := db.Exec(`
		CREATE TABLE IF NOT EXISTS schema_migrations (
			version     TEXT PRIMARY KEY,
			applied_at  TEXT NOT NULL DEFAULT (datetime('now'))
		)`); err != nil {
		return nil, fmt.Errorf("create schema_migrations: %w", err)
	}

	// Apply migrations
	if err := runMigrations(db, migrationsFS); err != nil {
		return nil, fmt.Errorf("migrations: %w", err)
	}

	return db, nil
}

// runMigrations reads all *.up.sql files from the migrations/ directory inside
// the embedded FS, applies them in sorted order, and skips already-applied ones.
func runMigrations(db *sql.DB, migrationsFS embed.FS) error {
	entries, err := fs.ReadDir(migrationsFS, "migrations")
	if err != nil {
		return fmt.Errorf("read migrations dir: %w", err)
	}

	// Collect .up.sql files sorted by name (001_, 002_, …)
	var upFiles []string
	for _, e := range entries {
		if !e.IsDir() && strings.HasSuffix(e.Name(), ".up.sql") {
			upFiles = append(upFiles, e.Name())
		}
	}
	sort.Strings(upFiles)

	for _, fname := range upFiles {
		version := strings.TrimSuffix(fname, ".up.sql")

		// Check if already applied
		var count int
		if err := db.QueryRow(`SELECT COUNT(*) FROM schema_migrations WHERE version = ?`, version).Scan(&count); err != nil {
			return fmt.Errorf("check migration %s: %w", version, err)
		}
		if count > 0 {
			log.Printf("[db] migration %s already applied, skipping", version)
			continue
		}

		// Read SQL file
		content, err := migrationsFS.ReadFile("migrations/" + fname)
		if err != nil {
			return fmt.Errorf("read migration %s: %w", fname, err)
		}

		// Execute each statement (split on semicolons)
		statements := splitSQL(string(content))
		for _, stmt := range statements {
			stmt = strings.TrimSpace(stmt)
			if stmt == "" {
				continue
			}
			if _, err := db.Exec(stmt); err != nil {
				return fmt.Errorf("execute migration %s stmt [%s]: %w", version, stmt[:min(50, len(stmt))], err)
			}
		}

		// Record the migration
		if _, err := db.Exec(`INSERT INTO schema_migrations (version) VALUES (?)`, version); err != nil {
			return fmt.Errorf("record migration %s: %w", version, err)
		}

		log.Printf("[db] applied migration: %s", version)
	}
	return nil
}

// splitSQL splits a SQL script into individual statements on semicolons,
// while respecting that -- comments may contain semicolons.
func splitSQL(script string) []string {
	var statements []string
	var current strings.Builder

	lines := strings.Split(script, "\n")
	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		// Skip comment-only lines
		if strings.HasPrefix(trimmed, "--") {
			continue
		}
		current.WriteString(line)
		current.WriteString("\n")
		// If line ends with semicolon (ignoring whitespace), it ends a statement
		if strings.HasSuffix(trimmed, ";") {
			statements = append(statements, current.String())
			current.Reset()
		}
	}
	// Any remaining content without trailing semicolon
	if strings.TrimSpace(current.String()) != "" {
		statements = append(statements, current.String())
	}
	return statements
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
