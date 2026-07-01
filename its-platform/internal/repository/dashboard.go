package repository

import (
	"database/sql"
	"math"
)

// DashboardSummaryRow holds all KPI metrics for the dashboard overview.
type DashboardSummaryRow struct {
	PassengersToday   int     `json:"passengers_today"`
	PassengersDelta   float64 `json:"passengers_delta"`
	ActiveInfractions int     `json:"active_infractions"`
	InfractionsDelta  float64 `json:"infractions_delta"`
	RevenueToday      float64 `json:"revenue_today"`
	RevenueDelta      float64 `json:"revenue_delta"`
	KmToday           float64 `json:"km_today"`
	KmDelta           float64 `json:"km_delta"`
	TripsCompleted    int     `json:"trips_completed"`
	TripsDelta        float64 `json:"trips_delta"`
	AvgOccupancy      float64 `json:"avg_occupancy"`
	OccupancyDelta    float64 `json:"occupancy_delta"`
}

func pctDelta(today, yesterday float64) float64 {
	if yesterday == 0 {
		if today > 0 {
			return 100
		}
		return 0
	}
	return math.Round((today-yesterday)/yesterday*1000) / 10
}

// scalar runs a single-value query and returns 0 on any error (safe for dashboards).
func scalar(db *sql.DB, q string, args ...interface{}) float64 {
	var v float64
	db.QueryRow(q, args...).Scan(&v) //nolint:errcheck
	return v
}

// DashboardSummary aggregates all KPI values for the dashboard overview page.
// operatorID may be empty for superadmin/fiscalizador (cross-tenant view).
func DashboardSummary(db *sql.DB, operatorID string) (DashboardSummaryRow, error) {
	var s DashboardSummaryRow

	// opClause / opArgs append an operator filter when operatorID is set.
	opClause := ""
	opArgs := []interface{}{}
	if operatorID != "" {
		opClause = " AND operator_id = ?"
		opArgs = []interface{}{operatorID}
	}

	// Same filter but prefixed for JOIN queries that use the pe alias.
	peOpClause := ""
	peOpArgs := []interface{}{}
	if operatorID != "" {
		peOpClause = " AND pe.operator_id = ?"
		peOpArgs = []interface{}{operatorID}
	}

	// ── Passengers ─────────────────────────────────────────────────────────
	paxBase := `SELECT COALESCE(SUM(boardings),0) FROM passenger_events WHERE DATE(timestamp)=DATE('now'`
	paxToday := scalar(db, paxBase+`)` +opClause, opArgs...)
	paxYest  := scalar(db, paxBase+`,'-1 day')` +opClause, opArgs...)
	s.PassengersToday = int(paxToday)
	s.PassengersDelta = pctDelta(paxToday, paxYest)

	// ── Active Infractions ─────────────────────────────────────────────────
	infrActive := scalar(db, `SELECT COUNT(*) FROM infractions WHERE resolved=0`+opClause, opArgs...)
	infrToday  := scalar(db, `SELECT COUNT(*) FROM infractions WHERE DATE(detected_at)=DATE('now')`+opClause, opArgs...)
	infrYest   := scalar(db, `SELECT COUNT(*) FROM infractions WHERE DATE(detected_at)=DATE('now','-1 day')`+opClause, opArgs...)
	s.ActiveInfractions = int(infrActive)
	s.InfractionsDelta  = pctDelta(infrToday, infrYest)

	// ── Revenue ────────────────────────────────────────────────────────────
	revBase := `SELECT COALESCE(SUM(revenue),0) FROM financial_records WHERE record_type='DAILY_REVENUE' AND record_date=DATE('now'`
	revToday := scalar(db, revBase+`)` +opClause, opArgs...)
	revYest  := scalar(db, revBase+`,'-1 day')` +opClause, opArgs...)
	s.RevenueToday = revToday
	s.RevenueDelta  = pctDelta(revToday, revYest)

	// ── Km Operated ────────────────────────────────────────────────────────
	kmBase := `SELECT COALESCE(SUM(km_operated),0) FROM financial_records WHERE record_type='DAILY_REVENUE' AND record_date=DATE('now'`
	kmToday := scalar(db, kmBase+`)` +opClause, opArgs...)
	kmYest  := scalar(db, kmBase+`,'-1 day')` +opClause, opArgs...)
	s.KmToday = math.Round(kmToday*10) / 10
	s.KmDelta  = pctDelta(kmToday, kmYest)

	// ── Trips Completed ────────────────────────────────────────────────────
	tripBase := `SELECT COUNT(*) FROM trips WHERE status='COMPLETED' AND DATE(scheduled_start)=DATE('now'`
	tripsToday := scalar(db, tripBase+`)` +opClause, opArgs...)
	tripsYest  := scalar(db, tripBase+`,'-1 day')` +opClause, opArgs...)
	s.TripsCompleted = int(tripsToday)
	s.TripsDelta     = pctDelta(tripsToday, tripsYest)

	// ── Avg Occupancy (peak pax on board / vehicle capacity) ───────────────
	occQ := `
		SELECT COALESCE(ROUND(AVG(peak_ratio)*100,1),0) FROM (
			SELECT MAX(running_pax)*1.0/NULLIF(MAX(capacity),0) AS peak_ratio
			FROM (
				SELECT pe.trip_id, v.capacity,
					SUM(pe.boardings-pe.alightings) OVER (
						PARTITION BY pe.trip_id ORDER BY pe.sequence
						ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
					) AS running_pax
				FROM passenger_events pe
				JOIN trips t ON t.id=pe.trip_id
				JOIN vehicles v ON v.id=t.vehicle_id
				WHERE DATE(pe.timestamp)=DATE('now'`

	occQToday := occQ + `)` + peOpClause + `) GROUP BY trip_id)`
	occQYest  := occQ + `,'-1 day')` + peOpClause + `) GROUP BY trip_id)`

	occToday := scalar(db, occQToday, peOpArgs...)
	occYest  := scalar(db, occQYest,  peOpArgs...)
	s.AvgOccupancy  = occToday
	s.OccupancyDelta = pctDelta(occToday, occYest)

	return s, nil
}
