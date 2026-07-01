package main

import (
	"context"
	"embed"
	"io/fs"
	"log"
	"net/http"
	"os"
	"os/exec"
	"runtime"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/its-demo/platform/internal/auth"
	"github.com/its-demo/platform/internal/handler"
	"github.com/its-demo/platform/internal/repository"
	"github.com/its-demo/platform/internal/seeder"
	"github.com/its-demo/platform/internal/service"
	"github.com/its-demo/platform/internal/simulator"
	ws "github.com/its-demo/platform/internal/websocket"
)

//go:embed migrations
var migrationsFS embed.FS

//go:embed frontend/dist
var frontendFS embed.FS

func main() {
	// ── 1. Initialize database ─────────────────────────────────────────────────
	db, err := repository.InitDB("its-demo.db", migrationsFS)
	if err != nil {
		log.Fatalf("[main] failed to initialize database: %v", err)
	}
	defer db.Close()

	// ── 2. Seed if first run ───────────────────────────────────────────────────
	if seeder.NeedsSeeding(db) {
		log.Println("[main] first run detected, seeding database...")
		if err := seeder.Seed(db); err != nil {
			log.Fatalf("[main] seed failed: %v", err)
		}
	} else {
		log.Println("[main] database already seeded, skipping")
	}

	// ── 3. WebSocket hub ───────────────────────────────────────────────────────
	hub := ws.NewHub()
	go hub.Run()

	// ── 4. GPS Simulator ───────────────────────────────────────────────────────
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	simulator.Start(ctx, db, hub)

	// ── 5. Services ────────────────────────────────────────────────────────────
	analyticsSvc := service.NewAnalyticsService(db)
	fiscSvc := service.NewFiscalizationService(db)
	financialSvc := service.NewFinancialService(db)

	// ── 6. Handlers ────────────────────────────────────────────────────────────
	authH := handler.NewAuthHandler(db)
	ingestH := handler.NewIngestHandler(db, hub)
	operatorH := handler.NewOperatorHandler(db)
	vehicleH := handler.NewVehicleHandler(db)
	routeH := handler.NewRouteHandler(db)
	stopH := handler.NewStopHandler(db)
	tripH := handler.NewTripHandler(db)
	analyticsH := handler.NewAnalyticsHandler(analyticsSvc)
	fiscH := handler.NewFiscalizationHandler(fiscSvc)
	financialH := handler.NewFinancialHandler(financialSvc)
	reportH := handler.NewPassengerReportHandler(db)

	// ── 7. Router ──────────────────────────────────────────────────────────────
	gin.SetMode(gin.ReleaseMode)
	r := gin.New()
	r.Use(gin.Logger())
	r.Use(gin.Recovery())

	// CORS middleware
	r.Use(func(c *gin.Context) {
		origin := c.Request.Header.Get("Origin")
		if origin == "http://localhost:5173" || origin == "http://localhost:3000" || origin == "" {
			c.Writer.Header().Set("Access-Control-Allow-Origin", origin)
		} else {
			c.Writer.Header().Set("Access-Control-Allow-Origin", "*")
		}
		c.Writer.Header().Set("Access-Control-Allow-Credentials", "true")
		c.Writer.Header().Set("Access-Control-Allow-Headers", "Content-Type, Content-Length, Accept-Encoding, Authorization, X-Requested-With")
		c.Writer.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}
		c.Next()
	})

	// Public routes
	r.POST("/auth/login", authH.Login)

	// WebSocket — no auth required for demo
	r.GET("/ws/positions", func(c *gin.Context) {
		ws.ServeWs(hub, c)
	})

	// Ingest endpoints — JWT required, no tenant filter (device sends its own operator_id)
	ingest := r.Group("/ingest", auth.RequireAuth())
	{
		ingest.POST("/event", ingestH.IngestEvent)
		ingest.POST("/position", ingestH.IngestPosition)
	}

	// API v1 — JWT + tenant filter
	api := r.Group("/api/v1", auth.RequireAuth(), auth.TenantFilter())
	{
		// Operators — superadmin only for POST
		api.GET("/operators", operatorH.List)
		api.POST("/operators", auth.RequireRole("superadmin"), operatorH.Create)

		// Vehicles
		api.GET("/vehicles", vehicleH.List)
		api.POST("/vehicles", auth.RequireRole("superadmin", "operator"), vehicleH.Create)

		// Routes
		api.GET("/routes", routeH.List)
		api.GET("/routes/:id", routeH.Get)
		api.POST("/routes", auth.RequireRole("superadmin", "operator"), routeH.Create)

		// Stops
		api.GET("/stops", stopH.List)
		api.POST("/stops", auth.RequireRole("superadmin", "operator"), stopH.Create)

		// Trips
		api.GET("/trips", tripH.List)

		// Analytics
		analytics := api.Group("/analytics")
		{
			analytics.GET("/load-profile", analyticsH.LoadProfile)
			analytics.GET("/peak-demand", analyticsH.PeakDemand)
			analytics.GET("/efficiency", analyticsH.Efficiency)
			analytics.GET("/occupancy-rate", analyticsH.OccupancyRate)
		}

		// Fiscalization
		fiscalization := api.Group("/fiscalization")
		{
			fiscalization.GET("/compliance", fiscH.Compliance)
			fiscalization.GET("/infractions", fiscH.ListInfractions)
			fiscalization.POST("/infractions", auth.RequireRole("fiscalizador", "superadmin"), fiscH.CreateInfraction)
			fiscalization.PATCH("/infractions/:id/resolve", auth.RequireRole("fiscalizador", "superadmin"), fiscH.ResolveInfraction)
		}

		// Passenger reports
		reports := api.Group("/reports")
		{
			reports.POST("/passengers", auth.RequireRole("operator", "superadmin"), reportH.Create)
			reports.GET("/passengers", reportH.List)
		}

		// Financial
		financial := api.Group("/financial")
		{
			financial.GET("/revenue", financialH.Revenue)
			financial.GET("/km-operated", financialH.KmOperated)
			financial.GET("/subsidies", financialH.Subsidies)
		}
	}

	// ── 8. Frontend catch-all ──────────────────────────────────────────────────
	// Serve the embedded React build; SPA fallback to index.html
	distFS, err := fs.Sub(frontendFS, "frontend/dist")
	if err != nil {
		log.Fatalf("[main] failed to sub frontend/dist: %v", err)
	}
	fileServer := http.FileServer(http.FS(distFS))

	r.NoRoute(func(c *gin.Context) {
		// Try to serve the static file; if not found, serve index.html for SPA routing
		path := c.Request.URL.Path
		stripPath := strings.TrimPrefix(path, "/")
		if stripPath == "" {
			stripPath = "index.html"
		}
		f, ferr := distFS.Open(stripPath)
		if ferr == nil {
			f.Close()
			fileServer.ServeHTTP(c.Writer, c.Request)
			return
		}
		// SPA fallback
		c.FileFromFS("index.html", http.FS(distFS))
	})

	// ── 9. Open browser on Windows (local dev only) ────────────────────────────
	if runtime.GOOS == "windows" {
		go func() {
			time.Sleep(1 * time.Second)
			if err := exec.Command("cmd", "/c", "start", "http://localhost:8080").Start(); err != nil {
				log.Printf("[main] could not open browser: %v", err)
			}
		}()
	}

	// ── 10. Start server ───────────────────────────────────────────────────────
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	log.Printf("[main] ITS platform listening on :%s", port)
	if err := r.Run(":" + port); err != nil {
		log.Fatalf("[main] server error: %v", err)
	}
}
