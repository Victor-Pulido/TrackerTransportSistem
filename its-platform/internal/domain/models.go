package domain

// Operator represents a transport company registered in the platform.
type Operator struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	Code      string `json:"code"`
	NIT       string `json:"nit"`
	Active    bool   `json:"active"`
	CreatedAt string `json:"created_at"`
}

// User represents a platform user with a role and optional operator association.
type User struct {
	ID           string `json:"id"`
	OperatorID   string `json:"operator_id"`
	Email        string `json:"email"`
	PasswordHash string `json:"-"`
	FullName     string `json:"full_name"`
	Role         string `json:"role"`
	Active       bool   `json:"active"`
	CreatedAt    string `json:"created_at"`
}

// Vehicle represents a bus belonging to an operator.
type Vehicle struct {
	ID           string `json:"id"`
	OperatorID   string `json:"operator_id"`
	LicensePlate string `json:"license_plate"`
	InternalCode string `json:"internal_code"`
	Model        string `json:"model"`
	Capacity     int    `json:"capacity"`
	Year         int    `json:"year"`
	Active       bool   `json:"active"`
}

// Route represents a bus line (route) operated by an operator.
type Route struct {
	ID         string `json:"id"`
	OperatorID string `json:"operator_id"`
	Code       string `json:"code"`
	Name       string `json:"name"`
	Direction  string `json:"direction"`
	Active     bool   `json:"active"`
}

// Stop represents a physical bus stop with geographic coordinates.
type Stop struct {
	ID         string  `json:"id"`
	OperatorID string  `json:"operator_id"`
	Code       string  `json:"code"`
	Name       string  `json:"name"`
	Address    string  `json:"address"`
	Lat        float64 `json:"lat"`
	Lng        float64 `json:"lng"`
}

// RouteStop links a stop to a route with sequence and distance metadata.
type RouteStop struct {
	RouteID    string  `json:"route_id"`
	StopID     string  `json:"stop_id"`
	Sequence   int     `json:"sequence"`
	DistanceKm float64 `json:"distance_km"`
}

// RouteWithStops is Route plus its ordered stops.
type RouteWithStops struct {
	Route
	Stops []Stop `json:"stops"`
}

// Trip represents a single bus service execution on a route.
type Trip struct {
	ID             string `json:"id"`
	VehicleID      string `json:"vehicle_id"`
	RouteID        string `json:"route_id"`
	OperatorID     string `json:"operator_id"`
	ScheduledStart string `json:"scheduled_start"`
	ActualStart    string `json:"actual_start"`
	ActualEnd      string `json:"actual_end"`
	Status         string `json:"status"`
}

// PassengerEvent records boardings and alightings at a specific stop during a trip.
type PassengerEvent struct {
	ID         string `json:"id"`
	TripID     string `json:"trip_id"`
	StopID     string `json:"stop_id"`
	RouteID    string `json:"route_id"`
	OperatorID string `json:"operator_id"`
	Sequence   int    `json:"sequence"`
	Boardings  int    `json:"boardings"`
	Alightings int    `json:"alightings"`
	Timestamp  string `json:"timestamp"`
}

// VehiclePosition is a GPS telemetry record from a bus.
type VehiclePosition struct {
	ID         string  `json:"id"`
	VehicleID  string  `json:"vehicle_id"`
	OperatorID string  `json:"operator_id"`
	Lat        float64 `json:"lat"`
	Lng        float64 `json:"lng"`
	SpeedKmh   float64 `json:"speed_kmh"`
	Heading    int     `json:"heading"`
	Timestamp  string  `json:"timestamp"`
}

// ServiceContract defines the minimum service obligations for an operator on a route.
type ServiceContract struct {
	ID             string `json:"id"`
	OperatorID     string `json:"operator_id"`
	RouteID        string `json:"route_id"`
	MinFrequency   int    `json:"min_frequency"`
	MinDailyTrips  int    `json:"min_daily_trips"`
	ValidFrom      string `json:"valid_from"`
	ValidUntil     string `json:"valid_until"`
}

// Infraction records a regulatory violation by an operator.
type Infraction struct {
	ID           string `json:"id"`
	OperatorID   string `json:"operator_id"`
	OperatorName string `json:"operator_name,omitempty"`
	VehicleID    string `json:"vehicle_id"`
	VehicleCode  string `json:"vehicle_code,omitempty"`
	RouteID      string `json:"route_id"`
	RouteCode    string `json:"route_code,omitempty"`
	Type         string `json:"type"`
	Description  string `json:"description"`
	Severity     string `json:"severity"`
	DetectedAt   string `json:"detected_at"`
	Resolved     bool   `json:"resolved"`
}

// FinancialRecord stores daily revenue and operational data for an operator.
type FinancialRecord struct {
	ID             string  `json:"id"`
	OperatorID     string  `json:"operator_id"`
	TripID         string  `json:"trip_id"`
	RecordDate     string  `json:"record_date"`
	RecordType     string  `json:"record_type"`
	Revenue        float64 `json:"revenue"`
	KmOperated     float64 `json:"km_operated"`
	TripsCompleted int     `json:"trips_completed"`
}
