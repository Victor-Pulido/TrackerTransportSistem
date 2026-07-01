package repository

import (
	"database/sql"
	"fmt"

	"github.com/its-demo/platform/internal/domain"
)

// LoadProfileRow represents a single stop entry in the passenger load profile.
type LoadProfileRow struct {
	Sequence   int    `json:"sequence"`
	StopName   string `json:"stop_name"`
	Boardings  int    `json:"boardings"`
	Alightings int    `json:"alightings"`
	PaxOnBoard int    `json:"pax_on_board"`
}

// PeakDemandRow represents total boarding demand aggregated per hour across the query range.
type PeakDemandRow struct {
	HourOfDay      string  `json:"hour_of_day"`
	TotalBoardings int     `json:"total_boardings"`
	MovingAvg      float64 `json:"moving_avg"`
}

// EfficiencyRow holds per-route operational efficiency metrics.
type EfficiencyRow struct {
	Code            string  `json:"code"`
	Name            string  `json:"name"`
	TripsCompleted  int     `json:"trips_completed"`
	TotalPassengers int     `json:"total_passengers"`
	TotalKm         float64 `json:"total_km"`
	PaxPerKm        float64 `json:"pax_per_km"`
}

// OccupancyRow holds peak occupancy metrics per trip.
type OccupancyRow struct {
	TripID          string  `json:"trip_id"`
	InternalCode    string  `json:"internal_code"`
	Capacity        int     `json:"capacity"`
	PeakPaxOnBoard  int     `json:"peak_pax_on_board"`
	PeakOccupancyPct float64 `json:"peak_occupancy_pct"`
}

// InsertEvent inserts a single passenger event record.
func InsertEvent(db *sql.DB, e domain.PassengerEvent) error {
	_, err := db.Exec(
		`INSERT INTO passenger_events (id, trip_id, stop_id, route_id, operator_id, sequence, boardings, alightings, timestamp)
		 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
		e.ID, e.TripID, e.StopID, e.RouteID, e.OperatorID,
		e.Sequence, e.Boardings, e.Alightings, e.Timestamp,
	)
	return err
}

// LoadProfile returns the cumulative passenger load profile for a specific trip.
// Uses a SQLite window function (available since SQLite 3.25).
func LoadProfile(db *sql.DB, tripID string) ([]LoadProfileRow, error) {
	rows, err := db.Query(`
		SELECT
			pe.sequence,
			COALESCE(s.name, '') AS stop_name,
			pe.boardings,
			pe.alightings,
			SUM(pe.boardings - pe.alightings) OVER (
				PARTITION BY pe.trip_id ORDER BY pe.sequence
				ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
			) AS pax_on_board
		FROM passenger_events pe
		JOIN stops s ON s.id = pe.stop_id
		WHERE pe.trip_id = ?
		ORDER BY pe.sequence`, tripID)
	if err != nil {
		return nil, fmt.Errorf("load profile query: %w", err)
	}
	defer rows.Close()

	var result []LoadProfileRow
	for rows.Next() {
		var r LoadProfileRow
		if err := rows.Scan(&r.Sequence, &r.StopName, &r.Boardings, &r.Alightings, &r.PaxOnBoard); err != nil {
			return nil, err
		}
		result = append(result, r)
	}
	return result, rows.Err()
}

// PeakDemand returns total boardings per hour (summed across all days in the range)
// with a 2-hour smoothed moving average.
func PeakDemand(db *sql.DB, operatorID, from, to string) ([]PeakDemandRow, error) {
	query := `
		SELECT
			strftime('%H', timestamp)  AS hour_of_day,
			SUM(boardings)             AS total_boardings,
			AVG(SUM(boardings)) OVER (
				ORDER BY strftime('%H', timestamp)
				ROWS BETWEEN 2 PRECEDING AND 2 FOLLOWING
			) AS moving_avg
		FROM passenger_events
		WHERE 1=1`
	args := []interface{}{}

	if operatorID != "" {
		query += " AND operator_id = ?"
		args = append(args, operatorID)
	}
	if from != "" {
		query += " AND timestamp >= ?"
		args = append(args, from)
	}
	if to != "" {
		query += " AND timestamp <= ?"
		args = append(args, to)
	}

	query += `
		GROUP BY strftime('%H', timestamp)
		ORDER BY hour_of_day`

	rows, err := db.Query(query, args...)
	if err != nil {
		return nil, fmt.Errorf("peak demand query: %w", err)
	}
	defer rows.Close()

	var result []PeakDemandRow
	for rows.Next() {
		var r PeakDemandRow
		if err := rows.Scan(&r.HourOfDay, &r.TotalBoardings, &r.MovingAvg); err != nil {
			return nil, err
		}
		result = append(result, r)
	}
	return result, rows.Err()
}

// Efficiency returns per-route operational efficiency (passengers/km).
func Efficiency(db *sql.DB, operatorID string) ([]EfficiencyRow, error) {
	query := `
		SELECT
			r.code,
			COALESCE(r.name,'') AS name,
			COUNT(DISTINCT t.id)                        AS trips_completed,
			SUM(pe.boardings)                           AS total_passengers,
			SUM(fr.km_operated)                         AS total_km,
			ROUND(CAST(SUM(pe.boardings) AS REAL) /
				  NULLIF(SUM(fr.km_operated), 0), 2)    AS pax_per_km
		FROM routes r
		JOIN trips t          ON t.route_id = r.id
		JOIN passenger_events pe ON pe.trip_id = t.id
		JOIN financial_records fr ON fr.trip_id = t.id`
	args := []interface{}{}

	if operatorID != "" {
		query += " WHERE r.operator_id = ?"
		args = append(args, operatorID)
	}

	query += " GROUP BY r.code, r.name ORDER BY pax_per_km DESC"

	rows, err := db.Query(query, args...)
	if err != nil {
		return nil, fmt.Errorf("efficiency query: %w", err)
	}
	defer rows.Close()

	var result []EfficiencyRow
	for rows.Next() {
		var r EfficiencyRow
		if err := rows.Scan(&r.Code, &r.Name, &r.TripsCompleted, &r.TotalPassengers, &r.TotalKm, &r.PaxPerKm); err != nil {
			return nil, err
		}
		result = append(result, r)
	}
	return result, rows.Err()
}

// OccupancyRate returns peak occupancy per trip for the given operator.
func OccupancyRate(db *sql.DB, operatorID string) ([]OccupancyRow, error) {
	query := `
		SELECT
			t.id AS trip_id,
			COALESCE(v.internal_code,'') AS internal_code,
			v.capacity,
			MAX(pax_window.running_pax)                              AS peak_pax_on_board,
			ROUND(MAX(pax_window.running_pax) * 100.0 / v.capacity, 1) AS peak_occupancy_pct
		FROM trips t
		JOIN vehicles v ON v.id = t.vehicle_id
		JOIN (
			SELECT trip_id,
				   SUM(boardings - alightings) OVER (
					   PARTITION BY trip_id ORDER BY sequence
					   ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
				   ) AS running_pax
			FROM passenger_events
		) pax_window ON pax_window.trip_id = t.id`
	args := []interface{}{}

	if operatorID != "" {
		query += " WHERE t.operator_id = ?"
		args = append(args, operatorID)
	}

	query += " GROUP BY t.id, v.internal_code, v.capacity ORDER BY peak_occupancy_pct DESC LIMIT 200"

	rows, err := db.Query(query, args...)
	if err != nil {
		return nil, fmt.Errorf("occupancy rate query: %w", err)
	}
	defer rows.Close()

	var result []OccupancyRow
	for rows.Next() {
		var r OccupancyRow
		if err := rows.Scan(&r.TripID, &r.InternalCode, &r.Capacity, &r.PeakPaxOnBoard, &r.PeakOccupancyPct); err != nil {
			return nil, err
		}
		result = append(result, r)
	}
	return result, rows.Err()
}
