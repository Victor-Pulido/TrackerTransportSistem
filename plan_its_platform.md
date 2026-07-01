# Sistema Fiscalizador de Transporte — Plan de Proyecto
> Plataforma web ITS para fiscalización y regulación del transporte público  
> Versión: 1.1 | Fecha: 2026-06-29

---

## 1. Descripción General

Plataforma web centralizada que recibe, procesa y analiza datos operacionales provenientes de la flota de buses (torniquetes electrónicos + sensores de descenso + GPS), con módulos especializados de análisis de transporte, fiscalización y control financiero. Soporta múltiples operadores de transporte y un rol de fiscalizador con acceso transversal.

### Supuestos del sistema

- Los buses disponen de equipamiento ITS embarcado: torniquete electrónico (subidas), sensor de infrarrojos en puerta trasera (bajadas), unidad GPS/AVL.
- Los datos se envían al servidor vía REST HTTP desde el bus o desde un gateway de comunicaciones del operador.
- Para el demo, un simulador en Go genera eventos realistas que reemplazan los buses físicos.

---

## 2. Stack Tecnológico — Demo simplificado

### Principio de diseño

> Un solo binario Go compilado contiene el servidor API, el frontend React (embebido) y la base de datos SQLite. Para correr el demo basta ejecutar `./its-demo` — sin Docker, sin instalaciones externas, sin configuración.

### 2.1 Backend: Go + Gin ✅

| Criterio | Justificación |
|---|---|
| **Concurrencia** | Goroutines para procesar eventos de N buses simultáneamente sin bloqueo |
| **Binario único** | `go build` produce un ejecutable sin dependencias de runtime |
| **WebSocket nativo** | `gorilla/websocket` maneja broadcast de posiciones GPS en tiempo real |
| **Embed frontend** | `//go:embed` incluye el build de React dentro del mismo binario |
| **Tipado estático** | Previene errores en el modelado del dominio |

**Framework:** `gin-gonic/gin`  
**Auth:** `golang-jwt/jwt` v5  
**WebSocket:** `gorilla/websocket`  
**Migraciones:** `golang-migrate/migrate` con driver SQLite  

### 2.2 Base de datos: SQLite ✅

SQLite es la opción correcta para un demo por:

| Criterio | SQLite |
|---|---|
| Instalación | Cero — archivo `.db` local |
| Window functions | ✅ Soportadas desde SQLite 3.25 (2018) |
| Queries analíticos | ✅ CTEs, subconsultas, agregaciones completas |
| Coordenadas | `REAL lat, lng` — suficiente para Leaflet |
| Concurrencia escritura | WAL mode — soporta lecturas concurrentes sin bloqueo |
| Driver Go | `modernc.org/sqlite` — pure Go, sin CGO, compila en cualquier plataforma |

Las únicas limitaciones respecto a PostgreSQL son geoespaciales avanzadas (PostGIS) y tipos `UUID` nativos — ambas prescindibles para el demo.

### 2.3 Frontend: React + Vite ✅

| Librería | Función |
|---|---|
| `react-leaflet` | Mapa de rutas, paradas y buses en tiempo real |
| `recharts` | Gráficos de perfil de carga, demanda horaria, KPIs |
| `@tanstack/react-query` | Cache y gestión de estado servidor |
| `zustand` | Estado global (usuario autenticado, operador activo) |
| `tailwindcss` | Utilidades CSS sobre paleta institucional |
| `react-router-dom` v6 | Enrutamiento SPA |
| `lucide-react` | Iconografía institucional line-art |

### 2.4 Distribución del demo

```
its-demo/
├── its-demo.exe (o ./its-demo en Linux/Mac)   ← binario único compilado
│   ├── [embebido] frontend/dist/              ← build React servido por Go
│   └── [embebido] migrations/                ← schema SQL
└── its-demo.db                                ← SQLite (se crea automáticamente)
```

**Para correr:**
```bash
./its-demo          # levanta en localhost:8080, abre el navegador
```

Al primer arranque: crea `its-demo.db`, aplica migraciones y ejecuta el seeder.

---

## 3. Arquitectura del Sistema

```
┌─────────────────────────────────────────────────────────────────┐
│                        FUENTES DE DATOS                         │
│                                                                 │
│  Bus 001..N ──► Torniquete   ──► POST /ingest/event             │
│             ──► Sensor bajada ──► (mismo endpoint, campo type)  │
│             ──► GPS/AVL      ──► POST /ingest/position          │
│                                                                 │
│  [Demo: goroutine-simulator genera N buses en paralelo]         │
└────────────────────────┬────────────────────────────────────────┘
                         │ HTTP REST / WebSocket
┌────────────────────────▼────────────────────────────────────────┐
│                 GO BACKEND (Gin)                                 │
│                                                                 │
│  Middleware: JWT Auth ──► Role Check ──► TenantFilter           │
│                                                                 │
│  /auth/login             → Autenticación, emisión JWT           │
│  /ingest/event           → Torniquete / sensor por parada       │
│  /ingest/position        → GPS del bus                          │
│  /ws/positions           → WebSocket broadcast posiciones       │
│                                                                 │
│  /api/v1/operators       → CRUD operadores                      │
│  /api/v1/vehicles        → Flota por operador                   │
│  /api/v1/routes          → Líneas y configuración               │
│  /api/v1/stops           → Paradas con lat/lng                  │
│  /api/v1/trips           → Servicios ejecutados                 │
│                                                                 │
│  /api/v1/analytics/load-profile      → Perfil de carga         │
│  /api/v1/analytics/peak-demand       → Horas de máx. demanda   │
│  /api/v1/analytics/efficiency        → Eficiencia operacional  │
│  /api/v1/analytics/occupancy-rate    → Tasa de ocupación       │
│                                                                 │
│  /api/v1/fiscalization/compliance    → Cumplimiento contratos  │
│  /api/v1/fiscalization/infractions   → Registro infracciones   │
│                                                                 │
│  /api/v1/financial/revenue           → Recaudo por operador    │
│  /api/v1/financial/km-operated       → Km operados vs prog.    │
│  /api/v1/financial/subsidies         → Cálculo subsidios       │
│                                                                 │
│  /* (catch-all)          → Sirve frontend React embebido        │
└────────────────────────┬────────────────────────────────────────┘
                         │ modernc.org/sqlite (pure Go)
┌────────────────────────▼────────────────────────────────────────┐
│                  SQLite (its-demo.db)                           │
│   WAL mode | Multi-tenant por operator_id en todas las tablas  │
│   Índices optimizados para queries analíticos temporales        │
└─────────────────────────────────────────────────────────────────┘
                         ↑
           //go:embed frontend/dist
┌──────────────────────────────────────────────────────────────── ┐
│              FRONTEND React + Vite (embebido en Go)             │
│                                                                 │
│  /              → Redirige a /dashboard o /login               │
│  /login         → Autenticación                                 │
│  /dashboard     → Panel principal con KPIs                      │
│  /map           → Mapa en tiempo real (Leaflet + WebSocket)     │
│  /analytics     → Módulos de análisis de transporte             │
│  /fiscalization → Panel fiscalizador (rol FISCALIZADOR)         │
│  /financial     → Control financiero                            │
└─────────────────────────────────────────────────────────────────┘
```

### 3.1 Multi-tenancy y Roles

```
Roles:
  SUPERADMIN    → Gestión de plataforma (crear operadores/usuarios)
  OPERATOR      → Solo ve datos de su empresa (operator_id del JWT)
  FISCALIZADOR  → Lectura cruzada de TODOS los operadores
  ANALYST       → Lectura + exportación, sin módulo de fiscalización

Implementación:
  - operator_id embebido en el JWT claims al hacer login
  - Middleware Go inyecta el filtro en cada función del repository
  - FISCALIZADOR tiene operator_id = "" → sin filtro de tenant
  - El filtro NUNCA viene del request del cliente
```

---

## 4. Modelo de Datos

### 4.1 Schema SQL (SQLite-compatible)

```sql
-- ============================================================
-- CONFIGURACIÓN INICIAL
-- ============================================================
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- ============================================================
-- NÚCLEO MULTI-TENANT
-- ============================================================

CREATE TABLE IF NOT EXISTS operators (
    id          TEXT PRIMARY KEY,              -- UUID generado en Go
    name        TEXT NOT NULL,
    code        TEXT UNIQUE NOT NULL,          -- ej: 'TRANSP-001'
    nit         TEXT,
    active      INTEGER NOT NULL DEFAULT 1,   -- 0/1 = false/true
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS users (
    id              TEXT PRIMARY KEY,
    operator_id     TEXT REFERENCES operators(id),  -- NULL = fiscalizador
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

-- Núcleo analítico: un registro por cada parada visitada
CREATE TABLE IF NOT EXISTS passenger_events (
    id          TEXT PRIMARY KEY,
    trip_id     TEXT NOT NULL REFERENCES trips(id),
    stop_id     TEXT NOT NULL REFERENCES stops(id),
    route_id    TEXT NOT NULL,      -- desnormalizado para queries rápidos
    operator_id TEXT NOT NULL,      -- desnormalizado para multi-tenant
    sequence    INTEGER NOT NULL,
    boardings   INTEGER NOT NULL DEFAULT 0,
    alightings  INTEGER NOT NULL DEFAULT 0,
    timestamp   TEXT NOT NULL       -- ISO8601: '2026-06-01T06:15:00Z'
);
CREATE INDEX IF NOT EXISTS idx_pe_operator_time ON passenger_events(operator_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_pe_route_time    ON passenger_events(route_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_pe_trip          ON passenger_events(trip_id, sequence);

-- Posiciones GPS (telemetría continua)
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
    min_frequency   INTEGER,    -- minutos entre servicios contratados
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
    record_date     TEXT NOT NULL,      -- 'YYYY-MM-DD'
    revenue         REAL,               -- recaudo en COP
    km_operated     REAL,
    trips_completed INTEGER,
    record_type     TEXT
                    CHECK (record_type IN ('DAILY_REVENUE','SUBSIDY','PENALTY','ADJUSTMENT'))
);
CREATE INDEX IF NOT EXISTS idx_fr_operator_date ON financial_records(operator_id, record_date);
```

### 4.2 Queries Analíticos Clave (SQLite)

```sql
-- PERFIL DE CARGA: pasajeros a bordo por tramo (window function SQLite 3.25+)
SELECT
    pe.sequence,
    s.name AS stop_name,
    pe.boardings,
    pe.alightings,
    SUM(pe.boardings - pe.alightings) OVER (
        PARTITION BY pe.trip_id ORDER BY pe.sequence
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    ) AS pax_on_board
FROM passenger_events pe
JOIN stops s ON s.id = pe.stop_id
WHERE pe.trip_id = ?
ORDER BY pe.sequence;

-- HORAS DE MÁXIMA DEMANDA (strftime en SQLite reemplaza DATE_TRUNC)
SELECT
    strftime('%H', timestamp)       AS hour_of_day,
    strftime('%w', timestamp)       AS day_of_week,   -- 0=Dom, 1=Lun...
    SUM(boardings)                  AS total_boardings,
    AVG(SUM(boardings)) OVER (
        ORDER BY strftime('%H', timestamp)
        ROWS BETWEEN 2 PRECEDING AND 2 FOLLOWING
    ) AS moving_avg
FROM passenger_events
WHERE operator_id = ?
  AND timestamp BETWEEN ? AND ?
GROUP BY strftime('%H', timestamp), strftime('%w', timestamp)
ORDER BY hour_of_day;

-- EFICIENCIA OPERACIONAL (pasajeros/km por línea)
SELECT
    r.code,
    r.name,
    COUNT(DISTINCT t.id)                        AS trips_completed,
    SUM(pe.boardings)                           AS total_passengers,
    SUM(fr.km_operated)                         AS total_km,
    ROUND(CAST(SUM(pe.boardings) AS REAL) /
          NULLIF(SUM(fr.km_operated), 0), 2)    AS pax_per_km
FROM routes r
JOIN trips t       ON t.route_id = r.id
JOIN passenger_events pe ON pe.trip_id = t.id
JOIN financial_records fr ON fr.trip_id = t.id
WHERE r.operator_id = ?
GROUP BY r.code, r.name;

-- TASA DE OCUPACIÓN MÁXIMA POR VIAJE
SELECT
    t.id AS trip_id,
    v.internal_code,
    v.capacity,
    MAX(running_pax) AS peak_pax_on_board,
    ROUND(MAX(running_pax) * 100.0 / v.capacity, 1) AS peak_occupancy_pct
FROM trips t
JOIN vehicles v ON v.id = t.vehicle_id
JOIN (
    SELECT trip_id,
           SUM(boardings - alightings) OVER (
               PARTITION BY trip_id ORDER BY sequence
               ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
           ) AS running_pax
    FROM passenger_events
) pax_window ON pax_window.trip_id = t.id
WHERE t.operator_id = ?
GROUP BY t.id, v.internal_code, v.capacity;
```

---

## 5. Datos Precargados (Demo Seeder)

El seeder corre automáticamente al primer arranque si `its-demo.db` no existe o está vacía. Genera un escenario verosímil basado en el contexto del Área Metropolitana de Bogotá D.C.

### 5.1 Operadores

| Código | Nombre | Rol |
|---|---|---|
| `TRANSP-001` | Transportes Urbanos del Norte S.A.S. | Operador |
| `TRANSP-002` | Buses Metropolitanos del Sur Ltda. | Operador |
| `FISCALIZADOR` | Secretaría Distrital de Movilidad | Fiscalizador |

### 5.2 Usuarios Precargados

| Email | Contraseña | Rol | Operador |
|---|---|---|---|
| `admin@its-demo.co` | `Admin2026!` | superadmin | — |
| `operador@transnorte.co` | `Oper2026!` | operator | TRANSP-001 |
| `analista@transnorte.co` | `Anal2026!` | analyst | TRANSP-001 |
| `operador@transur.co` | `Oper2026!` | operator | TRANSP-002 |
| `fiscal@sdm.gov.co` | `Fisc2026!` | fiscalizador | — |

### 5.3 Rutas y Paradas

**Ruta T1-A — Carrera 7 Norte–Sur (IDA) — TRANSP-001**  
12 paradas | 18 km aprox.  
Portal Norte → Toberín → Calle 170 → Calle 147 → Calle 127 → Calle 116 → Calle 100 → Calle 85 → Calle 72 → Calle 63 → Av. Chile → Centro Internacional

**Ruta T1-B — Av. Caracas (CIRCULAR) — TRANSP-001**  
10 paradas | 14 km aprox.

**Ruta T2-A — Autopista Sur (IDA) — TRANSP-002**  
8 paradas | 12 km aprox.

### 5.4 Flota

| Operador | Vehículos | Capacidad |
|---|---|---|
| TRANSP-001 | 15 buses (TN-001 a TN-015) | 80 pax c/u |
| TRANSP-002 | 10 buses (TS-001 a TS-010) | 80 pax c/u |

### 5.5 Historial Simulado (30 días)

```
Por cada día:
  Servicios: 6 por ruta (06:00 / 08:00 / 10:00 / 12:00 / 17:00 / 19:00)

  Perfil de demanda (factor × demanda base de 15–25 pax/parada):
    Pico AM  06:00–09:00  → ×1.8
    Valle    10:00–16:00  → ×0.6
    Pico PM  17:00–20:00  → ×2.0  (máximo)

  Variación aleatoria: ±20% (distribución uniforme)
  Restricción: pax_a_bordo ∈ [0, capacidad_vehículo]

  Factor día:
    Lunes–Viernes: 100%
    Sábados:        70%
    Domingos:       45%

  Posiciones GPS: 1 registro/minuto/bus activo
  Tarifa demo: $2.950 COP/pasajero (referencia SITP 2026)
  Revenue diario: SUM(boardings) × tarifa
  km_operated: calculado desde route_stops.distance_km × servicios completados
```

### 5.6 Infracciones Precargadas

| Tipo | Descripción | Operador | Severidad |
|---|---|---|---|
| `FREQUENCY` ×3 | Headway real > 2× el contratado | TRANSP-001 | HIGH |
| `OVERCAPACITY` ×2 | Carga pico > 100% capacidad | TRANSP-002 | MEDIUM |
| `NO_SHOW` ×1 | Servicio programado no ejecutado | TRANSP-001 | HIGH |

---

## 6. Guía de Estilo Visual — Institucional

Inspirado en los portales del Estado colombiano: Secretaría Distrital de Movilidad, datos.gov.co, Inventario Bogotá (Secretaría de Planeación).

### 6.1 Paleta de Colores

```css
/* ── Primarios ──────────────────────────────── */
--color-primary:       #1A3A5C;   /* Azul institucional oscuro */
--color-primary-dark:  #0F2540;   /* Hover / elemento activo */
--color-primary-light: #2C5282;   /* Sidebar item activo */

/* ── Acento ─────────────────────────────────── */
--color-accent:        #E8A020;   /* Dorado institucional */
--color-accent-light:  #F6C453;   /* Hover acento */

/* ── Semáforo operacional ───────────────────── */
--color-success:       #2D7A47;   /* Cumplimiento / normal */
--color-warning:       #D97706;   /* Alerta / desvío */
--color-danger:        #B91C1C;   /* Infracción / crítico */

/* ── Neutros ────────────────────────────────── */
--color-bg:            #F4F6F9;   /* Fondo general */
--color-surface:       #FFFFFF;   /* Cards, modales */
--color-border:        #DDE3EC;   /* Bordes */
--color-text-primary:  #1A2533;   /* Texto principal */
--color-text-secondary:#5A6A7E;   /* Labels, subtítulos */
--color-text-inverse:  #FFFFFF;   /* Texto sobre fondo oscuro */

/* ── Series de gráficos ─────────────────────── */
--chart-1: #1A3A5C;
--chart-2: #E8A020;
--chart-3: #2D7A47;
--chart-4: #6B7DB3;
--chart-5: #D97706;
```

### 6.2 Tipografía

```css
font-family: 'Inter', 'Segoe UI', system-ui, sans-serif;

/* Escala */
--text-xs:   0.75rem;    /* 12px — badges, etiquetas */
--text-sm:   0.875rem;   /* 14px — datos en tabla */
--text-base: 1rem;       /* 16px — cuerpo */
--text-lg:   1.125rem;   /* 18px — subtítulos */
--text-xl:   1.25rem;    /* 20px — títulos de sección */
--text-2xl:  1.5rem;     /* 24px — títulos de módulo */
--text-3xl:  1.875rem;   /* 30px — KPI principal */
```

### 6.3 Layout

```
┌──────────────────────────────────────────────────────────────┐
│  TOPBAR 64px  [🚌 Sistema ITS]  [Operador activo]  [Usuario] │
│  bg: #1A3A5C  |  texto: blanco  |  acento: #E8A020           │
├───────────┬──────────────────────────────────────────────────┤
│           │  Breadcrumb                                      │
│  SIDEBAR  ├──────────────────────────────────────────────────┤
│  240px    │                                                  │
│  bg:      │  ┌────────────┐ ┌────────────┐ ┌────────────┐   │
│  #0F2540  │  │  KPI Card  │ │  KPI Card  │ │  KPI Card  │   │
│           │  └────────────┘ └────────────┘ └────────────┘   │
│  nav con  │                                                  │
│  iconos   │  ┌──────────────────────────────────────────┐   │
│  lucide   │  │  Gráfico / Mapa / Tabla                  │   │
│           │  └──────────────────────────────────────────┘   │
└───────────┴──────────────────────────────────────────────────┘
```

**KPI Cards:** borde superior 4px `--color-accent` | sombra suave | valor en `text-3xl bold --color-primary` | variación Δ en verde/rojo

**Tablas:** cabecera `bg: --color-primary text-white` | filas alternas `bg: #F8FAFC` | badges de estado con bordes pill

**Mapa Leaflet:** tile CartoDB Positron (fondo claro neutro) | rutas en `--color-primary` | buses en movimiento en `--color-accent` | popups con card blanca

**Gráficos Recharts:** área de carga con gradiente `--color-primary` | barras de pico PM en `--color-danger` | grid en `--color-border`

### 6.4 Header institucional

```
[🚌]  SISTEMA ITS — FISCALIZACIÓN DE TRANSPORTE    [Logo SDM]
      Plataforma de Inteligencia Regulatoria
```

Fondo: `#1A3A5C` | Subtítulo: `#E8A020`

---

## 7. Estructura del Repositorio

```
its-platform/
│
├── main.go                         ← Entry point: servidor HTTP + embed frontend
│
├── internal/
│   ├── auth/
│   │   ├── jwt.go                  ← Emisión/validación JWT
│   │   └── middleware.go           ← Gin middleware: auth + roles + tenant
│   ├── domain/
│   │   ├── operator.go
│   │   ├── vehicle.go
│   │   ├── trip.go
│   │   └── passenger_event.go
│   ├── handler/
│   │   ├── auth.go
│   │   ├── ingest.go
│   │   ├── analytics.go
│   │   ├── fiscalization.go
│   │   └── financial.go
│   ├── repository/
│   │   ├── db.go                   ← Inicialización SQLite, WAL mode
│   │   ├── trips.go
│   │   ├── passenger_events.go
│   │   └── positions.go
│   ├── service/
│   │   ├── analytics.go            ← Perfiles de carga, picos, eficiencia
│   │   ├── fiscalization.go
│   │   └── financial.go
│   ├── seeder/
│   │   └── seeder.go               ← Genera 30 días de historial al primer boot
│   ├── simulator/
│   │   └── simulator.go            ← Goroutines: simula N buses en tiempo real
│   └── websocket/
│       └── hub.go                  ← Broadcast posiciones GPS
│
├── migrations/
│   ├── 001_create_schema.sql
│   └── 002_indexes.sql
│
├── frontend/                       ← React + Vite
│   ├── src/
│   │   ├── components/
│   │   │   ├── layout/
│   │   │   │   ├── Topbar.jsx
│   │   │   │   ├── Sidebar.jsx
│   │   │   │   └── Layout.jsx
│   │   │   ├── ui/
│   │   │   │   ├── KpiCard.jsx
│   │   │   │   ├── DataTable.jsx
│   │   │   │   └── StatusBadge.jsx
│   │   │   └── charts/
│   │   │       ├── LoadProfileChart.jsx
│   │   │       ├── PeakDemandChart.jsx
│   │   │       └── EfficiencyChart.jsx
│   │   ├── pages/
│   │   │   ├── Login.jsx
│   │   │   ├── Dashboard.jsx
│   │   │   ├── MapView.jsx
│   │   │   ├── Analytics.jsx
│   │   │   ├── Fiscalization.jsx
│   │   │   └── Financial.jsx
│   │   ├── hooks/
│   │   │   ├── useWebSocket.js
│   │   │   └── useAuth.js
│   │   ├── store/
│   │   │   └── authStore.js        ← Zustand
│   │   └── styles/
│   │       └── tokens.css          ← CSS custom properties
│   ├── package.json
│   └── vite.config.js
│
└── go.mod
```

> **Sin Dockerfile. Sin docker-compose.yml.**  
> El build final es: `cd frontend && npm run build && cd .. && go build -o its-demo .`

---

## 8. Plan de Implementación

### Fase 1 — Fundación (2 días)

| ID | Tarea | Prioridad |
|---|---|---|
| F1-01 | `go mod init`, estructura de directorios, `main.go` con embed | CRÍTICA |
| F1-02 | `repository/db.go`: inicializar SQLite en WAL mode, aplicar migraciones | CRÍTICA |
| F1-03 | Auth: JWT multi-tenant, middleware de roles y tenant filter | CRÍTICA |
| F1-04 | Seeder: operadores, usuarios, rutas, paradas, flota (datos fijos) | ALTA |

**Entregable:** `go run .` levanta API en :8080, login funcional, schema cargado.

### Fase 2 — Ingestión ITS + Historial (2 días)

| ID | Tarea | Prioridad |
|---|---|---|
| F2-01 | `POST /ingest/event` — recibe boardings/alightings por parada | CRÍTICA |
| F2-02 | `POST /ingest/position` — recibe GPS del bus | CRÍTICA |
| F2-03 | Seeder histórico: 30 días de `passenger_events` + `financial_records` | ALTA |
| F2-04 | Simulador goroutine: genera posiciones GPS en tiempo real | ALTA |
| F2-05 | WebSocket `/ws/positions`: broadcast de posiciones al frontend | ALTA |

**Entregable:** Base de datos con 30 días de historial, WebSocket operativo.

### Fase 3 — API REST + Módulos Analíticos (3 días)

| ID | Tarea | Prioridad |
|---|---|---|
| F3-01 | CRUD `/api/v1/operators`, `/vehicles`, `/routes`, `/stops` | ALTA |
| F3-02 | `GET /api/v1/trips` — lista con filtros de fecha y ruta | ALTA |
| F3-03 | `GET /api/v1/analytics/load-profile?trip_id=` | CRÍTICA |
| F3-04 | `GET /api/v1/analytics/peak-demand?from=&to=` | CRÍTICA |
| F3-05 | `GET /api/v1/analytics/efficiency?period=` | CRÍTICA |
| F3-06 | `GET /api/v1/analytics/occupancy-rate` | ALTA |
| F3-07 | Filtrado multi-tenant automático vía middleware | CRÍTICA |

**Entregable:** Todos los endpoints respondiendo con datos reales del seeder.

### Fase 4 — Frontend Dashboard + Mapa (4 días)

| ID | Tarea | Prioridad |
|---|---|---|
| F4-01 | Setup React + Vite + TailwindCSS + `tokens.css` institucional | CRÍTICA |
| F4-02 | Login con JWT, protección de rutas por rol, layout Topbar+Sidebar | CRÍTICA |
| F4-03 | Dashboard: 6 KPI cards (pasajeros/día, km operados, viajes, ocupación, recaudo, infracciones) | ALTA |
| F4-04 | Mapa Leaflet: rutas, paradas, buses en tiempo real (WebSocket) | ALTA |
| F4-05 | Gráfico perfil de carga (AreaChart, selector de viaje) | ALTA |
| F4-06 | Gráfico horas de máxima demanda (BarChart + promedio móvil) | ALTA |
| F4-07 | Tabla de eficiencia por línea con ordenamiento y export CSV | MEDIA |

**Entregable:** Dashboard completo navegable con datos reales.

### Fase 5 — Módulo de Fiscalización (2 días)

| ID | Tarea | Prioridad |
|---|---|---|
| F5-01 | Backend: cumplimiento de frecuencias vs contratos | ALTA |
| F5-02 | Backend: CRUD infracciones | ALTA |
| F5-03 | Frontend: panel fiscalizador con vista cruzada de operadores | ALTA |
| F5-04 | Frontend: tabla infracciones con filtros y badges de severidad | MEDIA |
| F5-05 | Export CSV del período | MEDIA |

**Entregable:** Panel funcional con infracciones precargadas visibles.

### Fase 6 — Control Financiero (2 días)

| ID | Tarea | Prioridad |
|---|---|---|
| F6-01 | Backend: recaudo diario, km operados, ingresos por línea | ALTA |
| F6-02 | Backend: subsidio = costo estándar − recaudo | MEDIA |
| F6-03 | Frontend: gráfico de ingresos por período (LineChart) | ALTA |
| F6-04 | Frontend: comparativo entre operadores (solo FISCALIZADOR) | MEDIA |

**Entregable:** Módulo financiero con 30 días de datos históricos.

### Cronograma estimado

```
Semana 1                         Semana 2
D1  D2  D3  D4  D5  D6  D7  D8  D9  D10 D11 D12 D13 D14 D15
├──F1───┤├──F2───┤├──────F3──────┤├────────F4────────┤
                                              ├──F5───┤├──F6──┤
```

**Tiempo total: ~15 días de desarrollo para demo funcional completo.**

---

## 9. Riesgos y Mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| Filtro multi-tenant omitido en una query | Media | Alto | El `operator_id` se inyecta desde el middleware como parámetro de función — nunca llega del request del cliente |
| SQLite bloqueado por escrituras concurrentes del simulador | Baja | Medio | WAL mode (`PRAGMA journal_mode=WAL`) permite lecturas concurrentes mientras el simulador escribe |
| Window functions no disponibles (SQLite < 3.25) | Muy baja | Medio | SQLite 3.25 es de 2018; cualquier sistema moderno lo incluye. Verificar con `SELECT sqlite_version()` |
| Seeder genera datos inconsistentes (pax_on_board < 0) | Media | Bajo | Lógica del seeder garantiza `alightings ≤ pax_on_board` en cada parada |
| Complejidad del módulo financiero | Media | Bajo | Para demo: `revenue = boardings × $2.950`. Subsidio es opcional en fase inicial |

---

## 10. Dependencias

### Backend Go

```
github.com/gin-gonic/gin           v1.9.x   ← HTTP framework
github.com/golang-jwt/jwt/v5       v5.x     ← Autenticación JWT
modernc.org/sqlite                 v1.x     ← Driver SQLite pure Go (sin CGO)
github.com/golang-migrate/migrate  v4.x     ← Migraciones SQL
github.com/gorilla/websocket       v1.5.x   ← WebSocket GPS broadcast
github.com/google/uuid             v1.x     ← Generación de IDs
golang.org/x/crypto                         ← bcrypt para contraseñas
```

### Frontend React

```
react + react-dom          ^18.x
vite                       ^5.x
react-router-dom           ^6.x
@tanstack/react-query      ^5.x
zustand                    ^4.x
react-leaflet + leaflet    ^4.x / ^1.9.x
recharts                   ^2.x
tailwindcss                ^3.x
lucide-react               ^0.x
```

---

*Documento generado el 2026-06-29 | Sistema Fiscalizador de Transporte — Demo ITS*  
*Stack: Go + SQLite + React | Sin Docker | Binario único autocontenido*
