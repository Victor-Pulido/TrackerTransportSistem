package seeder

import (
	"database/sql"
	"fmt"
	"log"
	"math/rand"
	"time"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

// ── Schedule parameters (shared between Seed and RefreshTimeSeries) ───────────
//
// opHours covers the SPTrans service window: 5:00–21:00.
// One scheduled trip per route per hour gives 17 trips/route/day at 60-min headway.

var opHours = []int{5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21}

// opHourFactor encodes São Paulo's characteristic bimodal demand curve:
//   AM peak  08:00 → 2.00×   (workers + schools)
//   PM peak  18:00 → 2.10×   (workers + leisure, always slightly higher)
//   Trough   14:00 → 0.75×   (post-lunch lull)
var opHourFactor = map[int]float64{
	5: 0.40, 6: 0.75, 7: 1.40, 8: 2.00, 9: 1.60,
	10: 0.85, 11: 0.80, 12: 1.10, 13: 0.95, 14: 0.75,
	15: 0.90, 16: 1.35, 17: 1.90, 18: 2.10, 19: 1.65,
	20: 1.10, 21: 0.65,
}

// tsRoute is the minimal description needed by seedTSCore to generate
// time-series trips, passenger events, and financial records.
type tsRoute struct {
	id, opID, code string
	stopIDs        []string
	kmPerTrip      float64
	demandBase     int
}

// routeDemandBase returns per-stop boardings/trip for each SPTrans route,
// reflecting real-world ridership hierarchy in the São Paulo network.
func routeDemandBase(code string) int {
	switch code {
	case "5110-10":
		return 38 // Main ABC→Capital corridor — highest ridership in the network
	case "407E-10":
		return 32 // East zone express — concentrated, high-demand stops
	case "3021-10":
		return 28 // North corridor — dense residential catchment
	case "5110-21":
		return 24 // ABC variant — parallel to main route, distributed load
	case "407A-10":
		return 22 // East zone local — many stops, lower per-stop demand
	default:
		return 20
	}
}

// ─────────────────────────────────────────────────────────────────────────────
// Public interface
// ─────────────────────────────────────────────────────────────────────────────

// NeedsSeeding returns true when the DB is empty or still contains old demo
// routes (Tx-A style) instead of the official SPTrans route nomenclature.
func NeedsSeeding(db *sql.DB) bool {
	var ops int
	if err := db.QueryRow("SELECT COUNT(*) FROM operators").Scan(&ops); err != nil || ops == 0 {
		return true
	}
	// Re-seed when no routes match SP prefixes → old T1-A/T1-B data still present.
	var spRoutes int
	db.QueryRow(`
		SELECT COUNT(*) FROM routes
		WHERE code LIKE '40%' OR code LIKE '51%'
		   OR code LIKE '30%' OR code LIKE '43%'`).Scan(&spRoutes)
	return spRoutes == 0
}

// NeedsTimeSeriesRefresh returns true when passenger_events has no rows in
// the past 7 days — happens when seeded data ages out of dashboard windows.
func NeedsTimeSeriesRefresh(db *sql.DB) bool {
	var count int
	err := db.QueryRow(
		`SELECT COUNT(*) FROM passenger_events WHERE timestamp >= datetime('now', '-7 days')`,
	).Scan(&count)
	return err != nil || count == 0
}

// Seed wipes all application data and rebuilds the full demo dataset using
// official SPTrans route nomenclature and real São Paulo coordinates.
func Seed(db *sql.DB) error {
	log.Println("[seeder] wiping existing data and re-seeding...")
	if err := wipeAll(db); err != nil {
		return err
	}

	tx, err := db.Begin()
	if err != nil {
		return fmt.Errorf("begin tx: %w", err)
	}
	defer func() {
		if err != nil {
			tx.Rollback()
		}
	}()

	// ── 1. Operators ──────────────────────────────────────────────────────────
	op1ID  := uuid.NewString() // SPMove Norte — north/east corridors
	op2ID  := uuid.NewString() // SPMove Sul   — south/ABC corridors
	fiscID := uuid.NewString() // CMSP Control — regulatory only

	type opDef struct{ id, name, code, cnpj string }
	for _, op := range []opDef{
		{op1ID,  "SPMove Norte S.A.", "TRANSP-SP-001", "12.345.678/0001-90"},
		{op2ID,  "SPMove Sul Ltda.",  "TRANSP-SP-002", "12.345.679/0001-71"},
		{fiscID, "CMSP Control",      "CMSP-001",      "12.345.680/0001-52"},
	} {
		if _, err = tx.Exec(
			`INSERT OR IGNORE INTO operators (id, name, code, nit, active) VALUES (?, ?, ?, ?, 1)`,
			op.id, op.name, op.code, op.cnpj,
		); err != nil {
			return fmt.Errorf("insert operator %s: %w", op.code, err)
		}
	}
	_ = fiscID // CMSP has no routes/vehicles; login access only

	// ── 2. Users ──────────────────────────────────────────────────────────────
	type userDef struct {
		email, password, fullName, role, opID string
	}
	for _, u := range []userDef{
		{"admin@spmove.com.br",          "Admin2026!", "Platform Admin",   "superadmin",   ""},
		{"operator@spmove-norte.com.br", "Oper2026!",  "SPMove Norte Ops", "operator",     op1ID},
		{"analyst@spmove-norte.com.br",  "Anal2026!",  "Data Analyst",     "analyst",      op1ID},
		{"operator@spmove-sul.com.br",   "Oper2026!",  "SPMove Sul Ops",   "operator",     op2ID},
		{"inspector@cmsp.sp.gov.br",     "Insp2026!",  "CMSP Inspector",   "fiscalizador", ""},
	} {
		hash, herr := bcrypt.GenerateFromPassword([]byte(u.password), bcrypt.DefaultCost)
		if herr != nil {
			return fmt.Errorf("hash %s: %w", u.email, herr)
		}
		var opIDVal interface{}
		if u.opID != "" {
			opIDVal = u.opID
		}
		if _, err = tx.Exec(
			`INSERT OR IGNORE INTO users
			 (id, operator_id, email, password_hash, full_name, role, active)
			 VALUES (?, ?, ?, ?, ?, ?, 1)`,
			uuid.NewString(), opIDVal, u.email, string(hash), u.fullName, u.role,
		); err != nil {
			return fmt.Errorf("insert user %s: %w", u.email, err)
		}
	}

	// ── 3. Stops ──────────────────────────────────────────────────────────────
	type stopDef struct {
		code, name, address string
		lat, lng            float64
	}

	// 407E-10 — Expresso Sapopemba → Praça da Sé (25 km, 5 stops, east express)
	stops407E := []stopDef{
		{"407E-01", "Terminal Sapopemba",  "Av. Sapopemba, 8701",            -23.6086, -46.4834},
		{"407E-02", "Tatuapé",             "Av. Radial Leste, 1000",          -23.5363, -46.5763},
		{"407E-03", "Bresser",             "Av. Bresser, 2200",               -23.5457, -46.6060},
		{"407E-04", "Brás",                "R. do Gasômetro, 400",            -23.5457, -46.6172},
		{"407E-05", "Praça da Sé",         "Praça da Sé, 1",                  -23.5506, -46.6333},
	}
	// 407A-10 — Local Sapopemba → Praça da Sé (27 km, 7 stops, east local)
	stops407A := []stopDef{
		{"407A-01", "Terminal Sapopemba",  "Av. Sapopemba, 8701",            -23.6086, -46.4834},
		{"407A-02", "Aricanduva",          "Av. Aricanduva, 1500",            -23.5598, -46.5284},
		{"407A-03", "Vila Matilde",        "R. Cons. Moreira Barros, 1",      -23.5327, -46.5499},
		{"407A-04", "Penha",               "R. Dr. João Ribeiro, 200",        -23.5175, -46.5501},
		{"407A-05", "Brás",                "R. do Gasômetro, 400",            -23.5457, -46.6172},
		{"407A-06", "Mercado Municipal",   "R. da Cantareira, 306",           -23.5428, -46.6327},
		{"407A-07", "Praça da Sé",         "Praça da Sé, 1",                  -23.5506, -46.6333},
	}
	// 3021-10 — Jardim Peri → Praça da Sé (20 km, 6 stops, north corridor)
	stops3021 := []stopDef{
		{"3021-01", "Terminal Jardim Peri", "R. Voluntários da Pátria, 3700", -23.4420, -46.6380},
		{"3021-02", "Santana",              "Av. Cruzeiro do Sul, 1800",       -23.5014, -46.6286},
		{"3021-03", "Carandiru",            "Av. Cruzeiro do Sul, 1200",       -23.5163, -46.6327},
		{"3021-04", "Tietê",                "Av. Cruzeiro do Sul, 600",        -23.5292, -46.6371},
		{"3021-05", "Luz",                  "Praça da Luz, 1",                 -23.5344, -46.6364},
		{"3021-06", "Praça da Sé",          "Praça da Sé, 1",                  -23.5506, -46.6333},
	}
	// 5110-10 — Santo André → Largo São Bento (30 km, 6 stops, ABC main axis)
	stops5110 := []stopDef{
		{"5110-01", "Terminal Santo André", "R. Coronel Oliveira Lima, 95",   -23.6680, -46.5346},
		{"5110-02", "Rudge Ramos (SBC)",    "Av. Kennedy, 1200",              -23.6398, -46.5552},
		{"5110-03", "São Caetano do Sul",   "Av. Goiás, 3900",                -23.6198, -46.5633},
		{"5110-04", "Ipiranga",             "R. dos Estudantes, 50",           -23.5888, -46.6059},
		{"5110-05", "Liberdade",            "Av. Liberdade, 50",               -23.5583, -46.6340},
		{"5110-06", "Largo São Bento",      "Largo São Bento, 64",             -23.5393, -46.6331},
	}
	// 5110-21 — Santo André → Largo São Bento via Av. do Estado (28 km, 6 stops)
	stops5110v := []stopDef{
		{"5110V-01", "Terminal Santo André", "R. Coronel Oliveira Lima, 95",  -23.6680, -46.5346},
		{"5110V-02", "Fundação ABC",         "Av. Industrial, 3330",           -23.6385, -46.5481},
		{"5110V-03", "Mooca",                "R. da Mooca, 2000",              -23.5504, -46.5885},
		{"5110V-04", "Bresser",              "Av. Bresser, 2200",              -23.5457, -46.6060},
		{"5110V-05", "Brás",                 "R. do Gasômetro, 400",           -23.5457, -46.6172},
		{"5110V-06", "Largo São Bento",      "Largo São Bento, 64",            -23.5393, -46.6331},
	}
	// 4310-10 — Terminal Santo Amaro → Praça da República via Av. Paulista (24 km, 6 stops)
	stops4310 := []stopDef{
		{"4310-01", "Terminal Santo Amaro", "Praça Floriano Peixoto, s/n",    -23.6546, -46.7045},
		{"4310-02", "Campo Belo",           "Av. Nações Unidas, 12901",        -23.6119, -46.6748},
		{"4310-03", "Ibirapuera",           "Av. 23 de Maio, 1900",            -23.5873, -46.6587},
		{"4310-04", "MASP / Av. Paulista",  "Av. Paulista, 1578",              -23.5619, -46.6560},
		{"4310-05", "Consolação",           "R. da Consolação, 2000",          -23.5536, -46.6569},
		{"4310-06", "Praça da República",   "Praça da República, 1",           -23.5437, -46.6407},
	}

	type stopGroup struct {
		opID string
		defs []stopDef
		km   []float64
	}
	groups := []stopGroup{
		{op1ID, stops407E,  []float64{0, 9.0, 18.5, 21.0, 25.0}},
		{op1ID, stops407A,  []float64{0, 5.5, 10.0, 14.0, 22.0, 25.5, 27.0}},
		{op1ID, stops3021,  []float64{0, 6.5, 10.0, 13.0, 15.5, 20.0}},
		{op2ID, stops5110,  []float64{0, 4.5, 8.0, 14.5, 22.0, 30.0}},
		{op2ID, stops5110v, []float64{0, 4.0, 13.0, 19.0, 23.5, 28.0}},
		{op2ID, stops4310,  []float64{0, 5.0, 9.5, 15.0, 17.0, 24.0}},
	}

	stopIDsByGroup := make([][]string, len(groups))
	for gi, g := range groups {
		ids := make([]string, len(g.defs))
		for i, s := range g.defs {
			ids[i] = uuid.NewString()
			if _, err = tx.Exec(
				`INSERT OR IGNORE INTO stops
				 (id, operator_id, code, name, address, lat, lng)
				 VALUES (?, ?, ?, ?, ?, ?, ?)`,
				ids[i], g.opID, s.code, s.name, s.address, s.lat, s.lng,
			); err != nil {
				return fmt.Errorf("insert stop %s: %w", s.code, err)
			}
		}
		stopIDsByGroup[gi] = ids
	}

	// ── 4. Routes ─────────────────────────────────────────────────────────────
	type routeEntry struct {
		id, opID, code, name string
		groupIdx             int
		kmPerTrip            float64
	}
	routeEntries := []routeEntry{
		{uuid.NewString(), op1ID, "407E-10", "Expresso Sapopemba → Praça da Sé",                    0, 25.0},
		{uuid.NewString(), op1ID, "407A-10", "Local Sapopemba → Praça da Sé",                       1, 27.0},
		{uuid.NewString(), op1ID, "3021-10", "Jardim Peri → Praça da Sé",                           2, 20.0},
		{uuid.NewString(), op2ID, "5110-10", "Santo André → Largo São Bento",                       3, 30.0},
		{uuid.NewString(), op2ID, "5110-21", "Santo André → Largo São Bento (Var. Av. do Estado)", 4, 28.0},
		{uuid.NewString(), op2ID, "4310-10", "Terminal Santo Amaro → Praça da República",           5, 24.0},
	}

	var tsRoutes []tsRoute
	for _, r := range routeEntries {
		if _, err = tx.Exec(
			`INSERT OR IGNORE INTO routes
			 (id, operator_id, code, name, direction, active)
			 VALUES (?, ?, ?, ?, 'IDA', 1)`,
			r.id, r.opID, r.code, r.name,
		); err != nil {
			return fmt.Errorf("insert route %s: %w", r.code, err)
		}
		g    := groups[r.groupIdx]
		sIDs := stopIDsByGroup[r.groupIdx]
		for i, stopID := range sIDs {
			if _, err = tx.Exec(
				`INSERT OR IGNORE INTO route_stops
				 (route_id, stop_id, sequence, distance_km)
				 VALUES (?, ?, ?, ?)`,
				r.id, stopID, i+1, g.km[i],
			); err != nil {
				return fmt.Errorf("insert route_stop %s seq %d: %w", r.code, i+1, err)
			}
		}
		tsRoutes = append(tsRoutes, tsRoute{
			id:         r.id,
			opID:       r.opID,
			code:       r.code,
			stopIDs:    sIDs,
			kmPerTrip:  r.kmPerTrip,
			demandBase: routeDemandBase(r.code),
		})
	}

	// ── 5. Service Contracts ──────────────────────────────────────────────────
	now        := time.Now().UTC()
	validFrom  := now.AddDate(0, -3, 0).Format("2006-01-02")
	validUntil := now.AddDate(1, 0, 0).Format("2006-01-02")
	for _, r := range routeEntries {
		if _, err = tx.Exec(
			`INSERT OR IGNORE INTO service_contracts
			 (id, operator_id, route_id, min_frequency, min_daily_trips, valid_from, valid_until)
			 VALUES (?, ?, ?, 30, 17, ?, ?)`,
			uuid.NewString(), r.opID, r.id, validFrom, validUntil,
		); err != nil {
			return fmt.Errorf("insert contract %s: %w", r.code, err)
		}
	}

	// ── 6. Vehicles ───────────────────────────────────────────────────────────
	op1Vehicles := make([]string, 25) // SPMove Norte fleet — SPN series
	modelsN := []string{"Mercedes-Benz OF-1721 R", "Caio Apache VIP IV"}
	for i := range op1Vehicles {
		op1Vehicles[i] = uuid.NewString()
		if _, err = tx.Exec(
			`INSERT OR IGNORE INTO vehicles
			 (id, operator_id, license_plate, internal_code, capacity, model, year, active)
			 VALUES (?, ?, ?, ?, 80, ?, 2022, 1)`,
			op1Vehicles[i], op1ID,
			fmt.Sprintf("SPN%d%c%03d", 1+i%9, rune('A'+i%26), i+100),
			fmt.Sprintf("SPN-%03d", i+1),
			modelsN[i%len(modelsN)],
		); err != nil {
			return fmt.Errorf("insert SPN vehicle %d: %w", i+1, err)
		}
	}

	op2Vehicles := make([]string, 20) // SPMove Sul fleet — SPS series
	modelsS := []string{"Marcopolo Gran Viale BRT", "Mercedes-Benz OH-1525 L BT5"}
	for i := range op2Vehicles {
		op2Vehicles[i] = uuid.NewString()
		if _, err = tx.Exec(
			`INSERT OR IGNORE INTO vehicles
			 (id, operator_id, license_plate, internal_code, capacity, model, year, active)
			 VALUES (?, ?, ?, ?, 80, ?, 2021, 1)`,
			op2Vehicles[i], op2ID,
			fmt.Sprintf("SPS%d%c%03d", 2+i%9, rune('B'+i%26), i+200),
			fmt.Sprintf("SPS-%03d", i+1),
			modelsS[i%len(modelsS)],
		); err != nil {
			return fmt.Errorf("insert SPS vehicle %d: %w", i+1, err)
		}
	}

	vehiclesByOp := map[string][]string{op1ID: op1Vehicles, op2ID: op2Vehicles}

	// ── 7. Historical time-series — 30 days ───────────────────────────────────
	log.Println("[seeder] generating 30 days of demand and financial records...")
	rng := rand.New(rand.NewSource(42))
	if err = seedTSCore(tx, tsRoutes, vehiclesByOp, now, rng); err != nil {
		return err
	}

	// ── 8. Pre-loaded Infractions ─────────────────────────────────────────────
	log.Println("[seeder] inserting pre-loaded infractions...")

	// 3× FREQUENCY violations for 407E-10 on the last 3 Mondays
	route407E := routeEntries[0]
	d, count := now, 0
	for count < 3 {
		d = d.AddDate(0, 0, -1)
		if d.Weekday() != time.Monday {
			continue
		}
		if _, err = tx.Exec(
			`INSERT OR IGNORE INTO infractions
			 (id, operator_id, vehicle_id, route_id, type, description, severity, detected_at, resolved)
			 VALUES (?, ?, ?, ?, 'FREQUENCY',
			   'Headway exceeded 2× contracted frequency during off-peak period', 'HIGH', ?, 0)`,
			uuid.NewString(), op1ID, op1Vehicles[count%len(op1Vehicles)],
			route407E.id, d.Format("2006-01-02")+"T10:00:00Z",
		); err != nil {
			return fmt.Errorf("insert frequency infraction: %w", err)
		}
		count++
	}

	// 2× OVERCAPACITY for 5110-10 on PM peaks of the last 2 days
	route5110 := routeEntries[3]
	for _, offset := range []int{1, 3} {
		if _, err = tx.Exec(
			`INSERT OR IGNORE INTO infractions
			 (id, operator_id, vehicle_id, route_id, type, description, severity, detected_at, resolved)
			 VALUES (?, ?, ?, ?, 'OVERCAPACITY',
			   'Peak occupancy exceeded 100% vehicle capacity during PM rush — ABC corridor', 'MEDIUM', ?, 0)`,
			uuid.NewString(), op2ID, op2Vehicles[offset%len(op2Vehicles)],
			route5110.id, now.AddDate(0, 0, -offset).Format("2006-01-02")+"T18:30:00Z",
		); err != nil {
			return fmt.Errorf("insert overcapacity infraction: %w", err)
		}
	}

	// 1× NO_SHOW for 3021-10 — missed 08:00 departure 5 days ago
	route3021 := routeEntries[2]
	if _, err = tx.Exec(
		`INSERT OR IGNORE INTO infractions
		 (id, operator_id, vehicle_id, route_id, type, description, severity, detected_at, resolved)
		 VALUES (?, ?, ?, ?, 'NO_SHOW',
		   'Scheduled 08:00 departure not executed — vehicle not dispatched on time', 'HIGH', ?, 0)`,
		uuid.NewString(), op1ID, op1Vehicles[4], route3021.id,
		now.AddDate(0, 0, -5).Format("2006-01-02")+"T08:00:00Z",
	); err != nil {
		return fmt.Errorf("insert no_show infraction: %w", err)
	}

	if err = tx.Commit(); err != nil {
		return fmt.Errorf("commit: %w", err)
	}
	log.Println("[seeder] seed completed successfully")
	return nil
}

// RefreshTimeSeries deletes stale trip/event/financial data and regenerates
// 30 fresh days using routes, stops, and vehicles already in the DB.
func RefreshTimeSeries(db *sql.DB) error {
	log.Println("[seeder] time-series data is stale — refreshing...")

	rows, err := db.Query(`
		SELECT r.id, r.operator_id, r.code,
		       COALESCE(MAX(rs.distance_km), 20.0)
		FROM routes r
		LEFT JOIN route_stops rs ON rs.route_id = r.id
		GROUP BY r.id, r.operator_id, r.code
		ORDER BY r.code`)
	if err != nil {
		return fmt.Errorf("query routes: %w", err)
	}

	type dbRoute struct {
		id, opID, code string
		kmPerTrip       float64
	}
	var dbRoutes []dbRoute
	for rows.Next() {
		var r dbRoute
		if scanErr := rows.Scan(&r.id, &r.opID, &r.code, &r.kmPerTrip); scanErr != nil {
			rows.Close()
			return scanErr
		}
		dbRoutes = append(dbRoutes, r)
	}
	rows.Close()

	vehiclesByOp := map[string][]string{}
	var tsRoutes []tsRoute

	for _, dr := range dbRoutes {
		sRows, _ := db.Query(
			`SELECT stop_id FROM route_stops WHERE route_id = ? ORDER BY sequence`, dr.id)
		var sIDs []string
		for sRows.Next() {
			var sid string
			sRows.Scan(&sid) //nolint:errcheck
			sIDs = append(sIDs, sid)
		}
		sRows.Close()

		if _, ok := vehiclesByOp[dr.opID]; !ok {
			vRows, _ := db.Query(
				`SELECT id FROM vehicles WHERE operator_id = ? ORDER BY internal_code`, dr.opID)
			for vRows.Next() {
				var vid string
				vRows.Scan(&vid) //nolint:errcheck
				vehiclesByOp[dr.opID] = append(vehiclesByOp[dr.opID], vid)
			}
			vRows.Close()
		}

		tsRoutes = append(tsRoutes, tsRoute{
			id:         dr.id,
			opID:       dr.opID,
			code:       dr.code,
			stopIDs:    sIDs,
			kmPerTrip:  dr.kmPerTrip,
			demandBase: routeDemandBase(dr.code),
		})
	}

	tx, txErr := db.Begin()
	if txErr != nil {
		return fmt.Errorf("begin tx: %w", txErr)
	}
	defer func() {
		if txErr != nil {
			tx.Rollback()
		}
	}()

	for _, tbl := range []string{"financial_records", "passenger_events", "trips"} {
		if _, txErr = tx.Exec("DELETE FROM " + tbl); txErr != nil {
			return fmt.Errorf("clear %s: %w", tbl, txErr)
		}
	}

	log.Println("[seeder] regenerating 30 days of demand and financial records...")
	rng := rand.New(rand.NewSource(time.Now().UnixNano()))
	if txErr = seedTSCore(tx, tsRoutes, vehiclesByOp, time.Now().UTC(), rng); txErr != nil {
		return txErr
	}

	if txErr = tx.Commit(); txErr != nil {
		return fmt.Errorf("commit: %w", txErr)
	}
	log.Println("[seeder] time-series refresh completed")
	return nil
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal helpers
// ─────────────────────────────────────────────────────────────────────────────

func wipeAll(db *sql.DB) error {
	// Disable FK enforcement for the wipe so order doesn't matter.
	if _, err := db.Exec("PRAGMA foreign_keys = OFF"); err != nil {
		return fmt.Errorf("disable fk: %w", err)
	}
	defer db.Exec("PRAGMA foreign_keys = ON") //nolint:errcheck
	for _, t := range []string{
		"financial_records", "passenger_events", "passenger_reports",
		"vehicle_positions", "infractions", "trips",
		"service_contracts", "route_stops",
		"routes", "stops", "vehicles", "users", "operators",
	} {
		if _, err := db.Exec("DELETE FROM " + t); err != nil {
			return fmt.Errorf("wipe %s: %w", t, err)
		}
	}
	return nil
}

// seedTSCore generates 30 days of trips, passenger_events, and financial_records
// using the bimodal São Paulo demand curve defined in opHours / opHourFactor.
func seedTSCore(
	tx *sql.Tx,
	routes []tsRoute,
	vehiclesByOp map[string][]string,
	now time.Time,
	rng *rand.Rand,
) error {
	for dayOffset := 29; dayOffset >= 0; dayOffset-- {
		day     := now.AddDate(0, 0, -dayOffset)
		dateStr := day.Format("2006-01-02")

		// Day-of-week ridership factor: weekday full, Saturday ~70%, Sunday ~45%.
		dayFactor := 1.0
		switch day.Weekday() {
		case time.Saturday:
			dayFactor = 0.70
		case time.Sunday:
			dayFactor = 0.45
		}

		for _, r := range routes {
			vehicles := vehiclesByOp[r.opID]
			if len(vehicles) == 0 || len(r.stopIDs) == 0 {
				continue
			}
			vehicleIdx := 0

			for _, hour := range opHours {
				hf  := opHourFactor[hour]
				vID := vehicles[vehicleIdx%len(vehicles)]
				vehicleIdx++

				tripID := uuid.NewString()
				endH   := hour + 1
				if endH > 23 {
					endH = 23
				}
				if _, err := tx.Exec(
					`INSERT INTO trips
					 (id, vehicle_id, route_id, operator_id,
					  scheduled_start, actual_start, actual_end, status)
					 VALUES (?, ?, ?, ?, ?, ?, ?, 'COMPLETED')`,
					tripID, vID, r.id, r.opID,
					fmt.Sprintf("%sT%02d:00:00Z", dateStr, hour),
					fmt.Sprintf("%sT%02d:02:00Z", dateStr, hour),
					fmt.Sprintf("%sT%02d:45:00Z", dateStr, endH),
				); err != nil {
					return fmt.Errorf("insert trip %s h%02d: %w", r.code, hour, err)
				}

				paxOnBoard     := 0
				totalBoardings := 0

				for seq, stopID := range r.stopIDs {
					// Per-stop demand: base × hour factor × day factor × ±20% variance.
					variance := 0.80 + rng.Float64()*0.40
					demand   := int(float64(r.demandBase+rng.Intn(12)) * hf * dayFactor * variance)
					if demand < 0 {
						demand = 0
					}
					boardings := demand

					// Alightings increase toward end of route (progressive unloading).
					alightings := 0
					if seq > 0 {
						rate       := 0.12 + float64(seq)/float64(len(r.stopIDs))*0.65
						alightings  = int(float64(paxOnBoard) * rate)
					}
					// Last stop: everyone alights, no new boardings.
					if seq == len(r.stopIDs)-1 {
						alightings = paxOnBoard
						boardings  = 0
					}
					if alightings > paxOnBoard {
						alightings = paxOnBoard
					}

					paxOnBoard = paxOnBoard - alightings + boardings
					// Hard capacity cap at 80 seats.
					if paxOnBoard > 80 {
						excess    := paxOnBoard - 80
						boardings -= excess
						if boardings < 0 {
							boardings = 0
						}
						paxOnBoard = 80
					}
					if paxOnBoard < 0 {
						paxOnBoard = 0
					}
					totalBoardings += boardings

					if _, err := tx.Exec(
						`INSERT INTO passenger_events
						 (id, trip_id, stop_id, route_id, operator_id,
						  sequence, boardings, alightings, timestamp)
						 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
						uuid.NewString(), tripID, stopID, r.id, r.opID,
						seq+1, boardings, alightings,
						fmt.Sprintf("%sT%02d:%02d:00Z", dateStr, hour, (seq*5)%60),
					); err != nil {
						return fmt.Errorf("insert event %s h%02d seq%d: %w", r.code, hour, seq+1, err)
					}
				}

				// BRL 4.40 fare (SPTrans 2026 base tariff).
				if _, err := tx.Exec(
					`INSERT INTO financial_records
					 (id, operator_id, trip_id, record_date, revenue, km_operated, trips_completed, record_type)
					 VALUES (?, ?, ?, ?, ?, ?, 1, 'DAILY_REVENUE')`,
					uuid.NewString(), r.opID, tripID, dateStr,
					float64(totalBoardings)*4.40, r.kmPerTrip,
				); err != nil {
					return fmt.Errorf("insert financial %s: %w", r.code, err)
				}
			}
		}
	}
	return nil
}
