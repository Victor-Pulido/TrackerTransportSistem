-- ============================================================
-- CONFIGURACIÓN INICIAL
-- ============================================================
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- ============================================================
-- NÚCLEO MULTI-TENANT
-- ============================================================

CREATE TABLE IF NOT EXISTS operators (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    code        TEXT UNIQUE NOT NULL,
    nit         TEXT,
    active      INTEGER NOT NULL DEFAULT 1,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS users (
    id              TEXT PRIMARY KEY,
    operator_id     TEXT REFERENCES operators(id),
    email           TEXT UNIQUE NOT NULL,
    password_hash   TEXT NOT NULL,
    full_name       TEXT,
    role            TEXT NOT NULL
                    CHECK (role IN ('superadmin','operator','fiscalizador','analyst')),
    active          INTEGER NOT NULL DEFAULT 1,
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================
-- FLOTA E INFRAESTRUCTURA
-- ============================================================

CREATE TABLE IF NOT EXISTS vehicles (
    id              TEXT PRIMARY KEY,
    operator_id     TEXT NOT NULL REFERENCES operators(id),
    license_plate   TEXT NOT NULL,
    internal_code   TEXT,
    capacity        INTEGER NOT NULL DEFAULT 80,
    model           TEXT,
    year            INTEGER,
    active          INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS routes (
    id          TEXT PRIMARY KEY,
    operator_id TEXT NOT NULL REFERENCES operators(id),
    code        TEXT NOT NULL,
    name        TEXT,
    direction   TEXT CHECK (direction IN ('IDA','VUELTA','CIRCULAR')),
    active      INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS stops (
    id          TEXT PRIMARY KEY,
    operator_id TEXT NOT NULL REFERENCES operators(id),
    code        TEXT NOT NULL,
    name        TEXT,
    lat         REAL,
    lng         REAL,
    address     TEXT
);

CREATE TABLE IF NOT EXISTS route_stops (
    route_id    TEXT NOT NULL REFERENCES routes(id),
    stop_id     TEXT NOT NULL REFERENCES stops(id),
    sequence    INTEGER NOT NULL,
    distance_km REAL,
    PRIMARY KEY (route_id, stop_id)
);

-- ============================================================
-- OPERACIÓN Y TELEMETRÍA
-- ============================================================

CREATE TABLE IF NOT EXISTS trips (
    id              TEXT PRIMARY KEY,
    vehicle_id      TEXT NOT NULL REFERENCES vehicles(id),
    route_id        TEXT NOT NULL REFERENCES routes(id),
    operator_id     TEXT NOT NULL,
    scheduled_start TEXT,
    actual_start    TEXT,
    actual_end      TEXT,
    status          TEXT NOT NULL DEFAULT 'IN_PROGRESS'
                    CHECK (status IN ('SCHEDULED','IN_PROGRESS','COMPLETED','CANCELLED'))
);

CREATE TABLE IF NOT EXISTS passenger_events (
    id          TEXT PRIMARY KEY,
    trip_id     TEXT NOT NULL REFERENCES trips(id),
    stop_id     TEXT NOT NULL REFERENCES stops(id),
    route_id    TEXT NOT NULL,
    operator_id TEXT NOT NULL,
    sequence    INTEGER NOT NULL,
    boardings   INTEGER NOT NULL DEFAULT 0,
    alightings  INTEGER NOT NULL DEFAULT 0,
    timestamp   TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_pe_operator_time ON passenger_events(operator_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_pe_route_time    ON passenger_events(route_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_pe_trip          ON passenger_events(trip_id, sequence);

CREATE TABLE IF NOT EXISTS vehicle_positions (
    id          TEXT PRIMARY KEY,
    vehicle_id  TEXT NOT NULL REFERENCES vehicles(id),
    operator_id TEXT NOT NULL,
    lat         REAL,
    lng         REAL,
    speed_kmh   REAL,
    heading     INTEGER,
    timestamp   TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_vpos_vehicle_time ON vehicle_positions(vehicle_id, timestamp);

-- ============================================================
-- FISCALIZACIÓN
-- ============================================================

CREATE TABLE IF NOT EXISTS service_contracts (
    id              TEXT PRIMARY KEY,
    operator_id     TEXT NOT NULL REFERENCES operators(id),
    route_id        TEXT REFERENCES routes(id),
    min_frequency   INTEGER,
    min_daily_trips INTEGER,
    valid_from      TEXT,
    valid_until     TEXT
);

CREATE TABLE IF NOT EXISTS infractions (
    id              TEXT PRIMARY KEY,
    operator_id     TEXT NOT NULL REFERENCES operators(id),
    vehicle_id      TEXT REFERENCES vehicles(id),
    route_id        TEXT REFERENCES routes(id),
    type            TEXT CHECK (type IN ('FREQUENCY','OVERCAPACITY','NO_SHOW')),
    description     TEXT,
    severity        TEXT CHECK (severity IN ('LOW','MEDIUM','HIGH')),
    detected_at     TEXT NOT NULL DEFAULT (datetime('now')),
    resolved        INTEGER NOT NULL DEFAULT 0
);

-- ============================================================
-- CONTROL FINANCIERO
-- ============================================================

CREATE TABLE IF NOT EXISTS financial_records (
    id              TEXT PRIMARY KEY,
    operator_id     TEXT NOT NULL REFERENCES operators(id),
    trip_id         TEXT REFERENCES trips(id),
    record_date     TEXT NOT NULL,
    revenue         REAL,
    km_operated     REAL,
    trips_completed INTEGER,
    record_type     TEXT
                    CHECK (record_type IN ('DAILY_REVENUE','SUBSIDY','PENALTY','ADJUSTMENT'))
);

CREATE INDEX IF NOT EXISTS idx_fr_operator_date ON financial_records(operator_id, record_date);
