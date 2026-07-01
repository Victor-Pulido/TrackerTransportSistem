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

// NeedsSeeding returns true if the operators table is empty.
func NeedsSeeding(db *sql.DB) bool {
	var count int
	if err := db.QueryRow("SELECT COUNT(*) FROM operators").Scan(&count); err != nil {
		return true
	}
	return count == 0
}

// Seed populates the database with São Paulo demo data.
func Seed(db *sql.DB) error {
	log.Println("[seeder] starting seed process...")

	tx, err := db.Begin()
	if err != nil {
		return fmt.Errorf("begin transaction: %w", err)
	}
	defer func() {
		if err != nil {
			tx.Rollback()
		}
	}()

	// ── 1. Operators ──────────────────────────────────────────────────────────
	op1ID  := uuid.NewString() // SPMove Norte
	op2ID  := uuid.NewString() // SPMove Sul
	fiscID := uuid.NewString() // CMSP Control

	operators := []struct {
		id, name, code, cnpj string
	}{
		{op1ID,  "SPMove Norte S.A.",  "TRANSP-SP-001", "12.345.678/0001-90"},
		{op2ID,  "SPMove Sul Ltda.",   "TRANSP-SP-002", "12.345.679/0001-71"},
		{fiscID, "CMSP Control",       "CMSP-001",      "12.345.680/0001-52"},
	}
	for _, op := range operators {
		if _, err = tx.Exec(
			`INSERT OR IGNORE INTO operators (id, name, code, nit, active) VALUES (?, ?, ?, ?, 1)`,
			op.id, op.name, op.code, op.cnpj,
		); err != nil {
			return fmt.Errorf("insert operator %s: %w", op.code, err)
		}
	}

	// ── 2. Users ──────────────────────────────────────────────────────────────
	type userSeed struct {
		email, password, fullName, role, operatorID string
	}
	users := []userSeed{
		{"admin@spmove.com.br",           "Admin2026!", "Platform Admin",   "superadmin",   ""},
		{"operator@spmove-norte.com.br",  "Oper2026!",  "SPMove Norte Ops", "operator",     op1ID},
		{"analyst@spmove-norte.com.br",   "Anal2026!",  "Data Analyst",     "analyst",      op1ID},
		{"operator@spmove-sul.com.br",    "Oper2026!",  "SPMove Sul Ops",   "operator",     op2ID},
		{"inspector@cmsp.sp.gov.br",      "Insp2026!",  "CMSP Inspector",   "fiscalizador", ""},
	}
	for _, u := range users {
		hash, herr := bcrypt.GenerateFromPassword([]byte(u.password), bcrypt.DefaultCost)
		if herr != nil {
			return fmt.Errorf("hash password for %s: %w", u.email, herr)
		}
		opID := interface{}(nil)
		if u.operatorID != "" {
			opID = u.operatorID
		}
		if _, err = tx.Exec(
			`INSERT OR IGNORE INTO users (id, operator_id, email, password_hash, full_name, role, active) VALUES (?, ?, ?, ?, ?, ?, 1)`,
			uuid.NewString(), opID, u.email, string(hash), u.fullName, u.role,
		); err != nil {
			return fmt.Errorf("insert user %s: %w", u.email, err)
		}
	}

	// ── 3. Stops ──────────────────────────────────────────────────────────────
	// Route T1-A: Terminal Tucuruvi → Praça da Sé (Norte–Sul)
	t1aStops := []struct {
		code, name, address string
		lat, lng            float64
	}{
		{"T1A-01", "Terminal Tucuruvi",  "Av. Luís Dumont Villares, 2100",  -23.4733, -46.6095},
		{"T1A-02", "Santana",            "Av. Cruzeiro do Sul, 1800",        -23.5014, -46.6286},
		{"T1A-03", "Carandiru",          "Av. Cruzeiro do Sul, 1200",        -23.5163, -46.6327},
		{"T1A-04", "Tietê",              "Av. Cruzeiro do Sul, 600",         -23.5292, -46.6371},
		{"T1A-05", "Luz",                "Praça da Luz, 1",                  -23.5344, -46.6364},
		{"T1A-06", "República",          "Praça da República, 1",            -23.5437, -46.6407},
		{"T1A-07", "Anhangabaú",         "Viaduto do Chá, 100",              -23.5450, -46.6437},
		{"T1A-08", "Praça da Sé",        "Praça da Sé, 1",                   -23.5506, -46.6333},
	}
	t1aStopIDs := make([]string, len(t1aStops))
	for i, s := range t1aStops {
		t1aStopIDs[i] = uuid.NewString()
		if _, err = tx.Exec(
			`INSERT OR IGNORE INTO stops (id, operator_id, code, name, address, lat, lng) VALUES (?, ?, ?, ?, ?, ?, ?)`,
			t1aStopIDs[i], op1ID, s.code, s.name, s.address, s.lat, s.lng,
		); err != nil {
			return fmt.Errorf("insert stop %s: %w", s.code, err)
		}
	}

	// Route T1-B: Terminal Santo André → Praça da Sé
	t1bStops := []struct {
		code, name, address string
		lat, lng            float64
	}{
		{"T1B-01", "Terminal Santo André", "R. Coronel Oliveira Lima, 95", -23.6680, -46.5346},
		{"T1B-02", "Ipiranga",             "R. dos Estudantes, 50",        -23.5888, -46.6059},
		{"T1B-03", "Saúde",                "R. Dr. Ricardo Jafet, 1",      -23.5951, -46.6218},
		{"T1B-04", "Liberdade",            "Av. Liberdade, 50",            -23.5583, -46.6340},
		{"T1B-05", "Praça da Sé",          "Praça da Sé, 1",               -23.5506, -46.6333},
	}
	t1bStopIDs := make([]string, len(t1bStops))
	for i, s := range t1bStops {
		t1bStopIDs[i] = uuid.NewString()
		if _, err = tx.Exec(
			`INSERT OR IGNORE INTO stops (id, operator_id, code, name, address, lat, lng) VALUES (?, ?, ?, ?, ?, ?, ?)`,
			t1bStopIDs[i], op1ID, s.code, s.name, s.address, s.lat, s.lng,
		); err != nil {
			return fmt.Errorf("insert stop %s: %w", s.code, err)
		}
	}

	// Route T2-A: Terminal Lapa → Terminal Tatuapé (Leste–Oeste)
	t2aStops := []struct {
		code, name, address string
		lat, lng            float64
	}{
		{"T2A-01", "Terminal Lapa",      "Av. Antártica, 381",             -23.5226, -46.7034},
		{"T2A-02", "Pompéia",            "R. Pompeia, 200",                -23.5310, -46.6848},
		{"T2A-03", "Perdizes",           "R. Cardoso de Almeida, 500",     -23.5369, -46.6717},
		{"T2A-04", "Higienópolis",       "Av. Higienópolis, 700",          -23.5450, -46.6600},
		{"T2A-05", "Consolação",         "R. da Consolação, 2000",         -23.5536, -46.6569},
		{"T2A-06", "República",          "Praça da República, 1",          -23.5437, -46.6407},
		{"T2A-07", "Brás",               "R. do Gasômetro, 400",           -23.5458, -46.6172},
		{"T2A-08", "Terminal Tatuapé",   "Av. Radial Leste, 1000",         -23.5363, -46.5763},
	}
	t2aStopIDs := make([]string, len(t2aStops))
	for i, s := range t2aStops {
		t2aStopIDs[i] = uuid.NewString()
		if _, err = tx.Exec(
			`INSERT OR IGNORE INTO stops (id, operator_id, code, name, address, lat, lng) VALUES (?, ?, ?, ?, ?, ?, ?)`,
			t2aStopIDs[i], op2ID, s.code, s.name, s.address, s.lat, s.lng,
		); err != nil {
			return fmt.Errorf("insert stop %s: %w", s.code, err)
		}
	}

	// ── 4. Routes ─────────────────────────────────────────────────────────────
	route1AID := uuid.NewString()
	route1BID := uuid.NewString()
	route2AID := uuid.NewString()

	routes := []struct {
		id, opID, code, name, direction string
	}{
		{route1AID, op1ID, "T1-A", "Tucuruvi — Praça da Sé",    "IDA"},
		{route1BID, op1ID, "T1-B", "Santo André — Praça da Sé", "IDA"},
		{route2AID, op2ID, "T2-A", "Lapa — Tatuapé",            "IDA"},
	}
	for _, r := range routes {
		if _, err = tx.Exec(
			`INSERT OR IGNORE INTO routes (id, operator_id, code, name, direction, active) VALUES (?, ?, ?, ?, ?, 1)`,
			r.id, r.opID, r.code, r.name, r.direction,
		); err != nil {
			return fmt.Errorf("insert route %s: %w", r.code, err)
		}
	}

	// ── 5. Route–Stop links ───────────────────────────────────────────────────
	// T1-A: 8 stops, ~18 km total
	t1aKm := []float64{0, 2.5, 4.8, 7.0, 9.5, 12.2, 14.8, 18.0}
	for i, stopID := range t1aStopIDs {
		if _, err = tx.Exec(
			`INSERT OR IGNORE INTO route_stops (route_id, stop_id, sequence, distance_km) VALUES (?, ?, ?, ?)`,
			route1AID, stopID, i+1, t1aKm[i],
		); err != nil {
			return fmt.Errorf("insert route_stop T1-A seq %d: %w", i+1, err)
		}
	}

	// T1-B: 5 stops, ~22 km total
	t1bKm := []float64{0, 6.0, 11.5, 17.0, 22.0}
	for i, stopID := range t1bStopIDs {
		if _, err = tx.Exec(
			`INSERT OR IGNORE INTO route_stops (route_id, stop_id, sequence, distance_km) VALUES (?, ?, ?, ?)`,
			route1BID, stopID, i+1, t1bKm[i],
		); err != nil {
			return fmt.Errorf("insert route_stop T1-B seq %d: %w", i+1, err)
		}
	}

	// T2-A: 8 stops, ~20 km total
	t2aKm := []float64{0, 2.8, 5.2, 7.5, 10.0, 13.5, 16.5, 20.0}
	for i, stopID := range t2aStopIDs {
		if _, err = tx.Exec(
			`INSERT OR IGNORE INTO route_stops (route_id, stop_id, sequence, distance_km) VALUES (?, ?, ?, ?)`,
			route2AID, stopID, i+1, t2aKm[i],
		); err != nil {
			return fmt.Errorf("insert route_stop T2-A seq %d: %w", i+1, err)
		}
	}

	// ── 6. Vehicles ───────────────────────────────────────────────────────────
	// SPMove Norte: 15 vehicles
	op1VehicleIDs := make([]string, 15)
	for i := 0; i < 15; i++ {
		op1VehicleIDs[i] = uuid.NewString()
		code  := fmt.Sprintf("SPN-%03d", i+1)
		plate := fmt.Sprintf("ABR%d%c%03d", 1+i%9, rune('A'+i%26), i+100)
		if _, err = tx.Exec(
			`INSERT OR IGNORE INTO vehicles (id, operator_id, license_plate, internal_code, capacity, model, year, active) VALUES (?, ?, ?, ?, 80, 'Mercedes-Benz OF-1721', 2022, 1)`,
			op1VehicleIDs[i], op1ID, plate, code,
		); err != nil {
			return fmt.Errorf("insert vehicle %s: %w", code, err)
		}
	}

	// SPMove Sul: 10 vehicles
	op2VehicleIDs := make([]string, 10)
	for i := 0; i < 10; i++ {
		op2VehicleIDs[i] = uuid.NewString()
		code  := fmt.Sprintf("SPS-%03d", i+1)
		plate := fmt.Sprintf("CDT%d%c%03d", 2+i%9, rune('B'+i%26), i+200)
		if _, err = tx.Exec(
			`INSERT OR IGNORE INTO vehicles (id, operator_id, license_plate, internal_code, capacity, model, year, active) VALUES (?, ?, ?, ?, 80, 'Caio Apache VIP III', 2021, 1)`,
			op2VehicleIDs[i], op2ID, plate, code,
		); err != nil {
			return fmt.Errorf("insert vehicle %s: %w", code, err)
		}
	}

	// ── 7. Service Contracts ──────────────────────────────────────────────────
	now := time.Now().UTC()
	validFrom  := now.AddDate(0, -3, 0).Format("2006-01-02")
	validUntil := now.AddDate(1, 0, 0).Format("2006-01-02")

	for _, pair := range []struct{ opID, routeID string }{
		{op1ID, route1AID},
		{op1ID, route1BID},
		{op2ID, route2AID},
	} {
		if _, err = tx.Exec(
			`INSERT OR IGNORE INTO service_contracts (id, operator_id, route_id, min_frequency, min_daily_trips, valid_from, valid_until) VALUES (?, ?, ?, 30, 6, ?, ?)`,
			uuid.NewString(), pair.opID, pair.routeID, validFrom, validUntil,
		); err != nil {
			return fmt.Errorf("insert service contract: %w", err)
		}
	}

	// ── 8. Historical Data: 30 days ───────────────────────────────────────────
	log.Println("[seeder] generating 30 days of passenger events and financial records...")

	type routeDef struct {
		id         string
		opID       string
		stopIDs    []string
		kmPerTrip  float64
		vehicleIDs []string
	}
	routeDefs := []routeDef{
		{route1AID, op1ID, t1aStopIDs, 18.0, op1VehicleIDs},
		{route1BID, op1ID, t1bStopIDs, 22.0, op1VehicleIDs},
		{route2AID, op2ID, t2aStopIDs, 20.0, op2VehicleIDs},
	}

	scheduleHours := []int{6, 8, 10, 12, 17, 19}
	rng := rand.New(rand.NewSource(42))

	for dayOffset := 29; dayOffset >= 0; dayOffset-- {
		day     := now.AddDate(0, 0, -dayOffset)
		dateStr := day.Format("2006-01-02")
		weekday := day.Weekday()

		dayFactor := 1.0
		if weekday == time.Saturday {
			dayFactor = 0.75
		} else if weekday == time.Sunday {
			dayFactor = 0.45
		}

		for _, rd := range routeDefs {
			vehicleIdx := 0
			for _, hour := range scheduleHours {
				hourFactor := 0.6
				if hour >= 6 && hour < 9 {
					hourFactor = 1.8
				} else if hour >= 17 && hour < 20 {
					hourFactor = 2.0
				}

				vID := rd.vehicleIDs[vehicleIdx%len(rd.vehicleIDs)]
				vehicleIdx++

				scheduledStart := fmt.Sprintf("%sT%02d:00:00Z", dateStr, hour)
				actualStart    := fmt.Sprintf("%sT%02d:02:00Z", dateStr, hour)
				endHour := hour + 1
				if endHour >= 24 {
					endHour = 23
				}
				actualEnd := fmt.Sprintf("%sT%02d:45:00Z", dateStr, endHour)

				tripID := uuid.NewString()
				if _, err = tx.Exec(
					`INSERT OR IGNORE INTO trips (id, vehicle_id, route_id, operator_id, scheduled_start, actual_start, actual_end, status) VALUES (?, ?, ?, ?, ?, ?, ?, 'COMPLETED')`,
					tripID, vID, rd.id, rd.opID, scheduledStart, actualStart, actualEnd,
				); err != nil {
					return fmt.Errorf("insert trip: %w", err)
				}

				paxOnBoard     := 0
				totalBoardings := 0
				for seq, stopID := range rd.stopIDs {
					baseDemand := 15 + rng.Intn(11)
					demand     := int(float64(baseDemand) * hourFactor * dayFactor * (0.8 + rng.Float64()*0.4))
					if demand < 0 {
						demand = 0
					}
					boardings := demand

					alightingRate := 0.0
					if seq > 0 {
						alightingRate = 0.15 + float64(seq)/float64(len(rd.stopIDs))*0.6
					}
					alightings := int(float64(paxOnBoard) * alightingRate)
					if seq == len(rd.stopIDs)-1 {
						alightings = paxOnBoard
						boardings  = 0
					}
					if alightings > paxOnBoard {
						alightings = paxOnBoard
					}

					paxOnBoard = paxOnBoard - alightings + boardings
					if paxOnBoard > 80 {
						boardings -= (paxOnBoard - 80)
						if boardings < 0 {
							boardings = 0
						}
						paxOnBoard = 80
					}
					if paxOnBoard < 0 {
						paxOnBoard = 0
					}

					totalBoardings += boardings

					stopTs  := fmt.Sprintf("%sT%02d:%02d:00Z", dateStr, hour, (seq*5)%60)
					eventID := uuid.NewString()
					if _, err = tx.Exec(
						`INSERT OR IGNORE INTO passenger_events (id, trip_id, stop_id, route_id, operator_id, sequence, boardings, alightings, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
						eventID, tripID, stopID, rd.id, rd.opID, seq+1, boardings, alightings, stopTs,
					); err != nil {
						return fmt.Errorf("insert passenger event: %w", err)
					}
				}

				// BRL fare: R$ 4.40 per passenger
				revenue := float64(totalBoardings) * 4.40
				frID    := uuid.NewString()
				if _, err = tx.Exec(
					`INSERT OR IGNORE INTO financial_records (id, operator_id, trip_id, record_date, revenue, km_operated, trips_completed, record_type) VALUES (?, ?, ?, ?, ?, ?, 1, 'DAILY_REVENUE')`,
					frID, rd.opID, tripID, dateStr, revenue, rd.kmPerTrip,
				); err != nil {
					return fmt.Errorf("insert financial record: %w", err)
				}
			}
		}
	}

	// ── 9. Pre-loaded Infractions ─────────────────────────────────────────────
	log.Println("[seeder] inserting pre-loaded infractions...")

	// 3× FREQUENCY for SPMove Norte — last 3 Mondays
	monday      := now
	mondayCount := 0
	for mondayCount < 3 {
		monday = monday.AddDate(0, 0, -1)
		if monday.Weekday() == time.Monday {
			infID      := uuid.NewString()
			detectedAt := monday.Format("2006-01-02") + "T10:00:00Z"
			if _, err = tx.Exec(
				`INSERT OR IGNORE INTO infractions (id, operator_id, vehicle_id, route_id, type, description, severity, detected_at, resolved) VALUES (?, ?, ?, ?, 'FREQUENCY', 'Headway exceeded 2× contracted frequency during off-peak hours', 'HIGH', ?, 0)`,
				infID, op1ID, op1VehicleIDs[mondayCount%len(op1VehicleIDs)], route1AID, detectedAt,
			); err != nil {
				return fmt.Errorf("insert frequency infraction: %w", err)
			}
			mondayCount++
		}
	}

	// 2× OVERCAPACITY for SPMove Sul — last 2 PM peaks
	for _, offset := range []int{1, 3} {
		infID      := uuid.NewString()
		detectedAt := now.AddDate(0, 0, -offset).Format("2006-01-02") + "T18:30:00Z"
		if _, err = tx.Exec(
			`INSERT OR IGNORE INTO infractions (id, operator_id, vehicle_id, route_id, type, description, severity, detected_at, resolved) VALUES (?, ?, ?, ?, 'OVERCAPACITY', 'Peak load exceeds 100% vehicle capacity during PM rush hour', 'MEDIUM', ?, 0)`,
			infID, op2ID, op2VehicleIDs[offset%len(op2VehicleIDs)], route2AID, detectedAt,
		); err != nil {
			return fmt.Errorf("insert overcapacity infraction: %w", err)
		}
	}

	// 1× NO_SHOW for SPMove Norte — 5 days ago
	{
		infID      := uuid.NewString()
		detectedAt := now.AddDate(0, 0, -5).Format("2006-01-02") + "T08:00:00Z"
		if _, err = tx.Exec(
			`INSERT OR IGNORE INTO infractions (id, operator_id, vehicle_id, route_id, type, description, severity, detected_at, resolved) VALUES (?, ?, ?, ?, 'NO_SHOW', 'Scheduled 08:00 departure not executed — vehicle not dispatched', 'HIGH', ?, 0)`,
			infID, op1ID, op1VehicleIDs[4], route1BID, detectedAt,
		); err != nil {
			return fmt.Errorf("insert no_show infraction: %w", err)
		}
	}

	if err = tx.Commit(); err != nil {
		return fmt.Errorf("commit: %w", err)
	}

	log.Println("[seeder] seed completed successfully")
	return nil
}
