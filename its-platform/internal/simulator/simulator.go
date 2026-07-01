package simulator

import (
	"context"
	"database/sql"
	"encoding/json"
	"log"
	"math/rand"
	"time"

	"github.com/google/uuid"
	"github.com/its-demo/platform/internal/domain"
	"github.com/its-demo/platform/internal/repository"
	ws "github.com/its-demo/platform/internal/websocket"
)

// activeVehicle holds the state for a simulated bus.
type activeVehicle struct {
	VehicleID  string
	OperatorID string
	BaseLat    float64
	BaseLng    float64
}

// Start launches the GPS simulator goroutine. It periodically generates positions
// for active vehicles and broadcasts them via the WebSocket hub.
// The simulator stops cleanly when the provided context is cancelled.
func Start(ctx context.Context, db *sql.DB, hub *ws.Hub) {
	go run(ctx, db, hub)
}

func run(ctx context.Context, db *sql.DB, hub *ws.Hub) {
	log.Println("[simulator] starting GPS simulator")

	// Load initial set of active vehicles
	vehicles := loadActiveVehicles(db)
	if len(vehicles) == 0 {
		log.Println("[simulator] no active vehicles found, simulator idle")
	}

	ticker := time.NewTicker(30 * time.Second)
	defer ticker.Stop()

	// Refresh vehicle list every 5 minutes
	refreshTicker := time.NewTicker(5 * time.Minute)
	defer refreshTicker.Stop()

	for {
		select {
		case <-ctx.Done():
			log.Println("[simulator] stopped")
			return

		case <-refreshTicker.C:
			vehicles = loadActiveVehicles(db)

		case <-ticker.C:
			now := time.Now().UTC().Format(time.RFC3339)
			for i := range vehicles {
				v := &vehicles[i]
				pos := generatePosition(v, now)

				if err := repository.InsertPosition(db, pos); err != nil {
					log.Printf("[simulator] insert position error: %v", err)
					continue
				}

				if msg, err := json.Marshal(pos); err == nil {
					ws.Broadcast(hub, msg)
				}
			}
			log.Printf("[simulator] broadcast %d vehicle positions", len(vehicles))
		}
	}
}

// loadActiveVehicles queries the DB for vehicles currently on active trips.
func loadActiveVehicles(db *sql.DB) []activeVehicle {
	rows, err := db.Query(`
		SELECT DISTINCT v.id, v.operator_id,
			COALESCE(s.lat, 4.65) AS base_lat,
			COALESCE(s.lng, -74.05) AS base_lng
		FROM trips t
		JOIN vehicles v ON v.id = t.vehicle_id
		LEFT JOIN route_stops rs ON rs.route_id = t.route_id AND rs.sequence = 1
		LEFT JOIN stops s ON s.id = rs.stop_id
		WHERE t.status = 'IN_PROGRESS'
		  AND v.active = 1
		LIMIT 50`)
	if err != nil {
		log.Printf("[simulator] query vehicles: %v", err)
		return nil
	}
	defer rows.Close()

	var vehicles []activeVehicle
	for rows.Next() {
		var v activeVehicle
		if err := rows.Scan(&v.VehicleID, &v.OperatorID, &v.BaseLat, &v.BaseLng); err != nil {
			continue
		}
		vehicles = append(vehicles, v)
	}

	// Fallback: if no in-progress trips, use any active vehicle from the seed data
	if len(vehicles) == 0 {
		fallbackRows, err := db.Query(`
			SELECT v.id, v.operator_id, 4.65, -74.05
			FROM vehicles v
			WHERE v.active = 1
			LIMIT 25`)
		if err != nil {
			return nil
		}
		defer fallbackRows.Close()
		for fallbackRows.Next() {
			var v activeVehicle
			if err := fallbackRows.Scan(&v.VehicleID, &v.OperatorID, &v.BaseLat, &v.BaseLng); err != nil {
				continue
			}
			vehicles = append(vehicles, v)
		}
	}

	return vehicles
}

// generatePosition creates a realistic GPS position near the vehicle's base stop.
func generatePosition(v *activeVehicle, timestamp string) domain.VehiclePosition {
	// Add small random offset: ~±500m in lat/lng degrees
	latOffset := (rand.Float64() - 0.5) * 0.009
	lngOffset := (rand.Float64() - 0.5) * 0.009

	speedKmh := 15.0 + rand.Float64()*30.0 // 15–45 km/h typical urban speed
	heading := rand.Intn(360)

	return domain.VehiclePosition{
		ID:         uuid.NewString(),
		VehicleID:  v.VehicleID,
		OperatorID: v.OperatorID,
		Lat:        v.BaseLat + latOffset,
		Lng:        v.BaseLng + lngOffset,
		SpeedKmh:   speedKmh,
		Heading:    heading,
		Timestamp:  timestamp,
	}
}
