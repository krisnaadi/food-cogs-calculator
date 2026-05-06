package main

import (
	"context"
	"fmt"
	"log"
	"net/http"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/chi/v5/middleware"
	"github.com/go-chi/cors"
	"github.com/krisnaadi/cogs-app/internal/config"
	"github.com/krisnaadi/cogs-app/internal/db"
	"github.com/krisnaadi/cogs-app/internal/handler"
)

func main() {
	cfg := config.Load()
	ctx := context.Background()

	pool := db.NewPool(ctx, cfg.DatabaseURL)
	defer pool.Close()

	queries := db.New(pool)

	ingredientsHandler := handler.NewIngredientsHandler(queries)
	recipesHandler := handler.NewRecipesHandler(queries)
	cogsHandler := handler.NewCOGSHandler(queries)
	suppliersHandler := handler.NewSuppliersHandler(queries)
	dashboardHandler := handler.NewDashboardHandler(queries)

	r := chi.NewRouter()
	r.Use(middleware.Logger)
	r.Use(middleware.Recoverer)
	r.Use(middleware.RequestID)
	r.Use(cors.Handler(cors.Options{
		AllowedOrigins: []string{"http://localhost:5173"},
		AllowedMethods: []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders: []string{"Accept", "Content-Type"},
	}))

	r.Get("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte(`{"status":"ok"}`))
	})

	r.Route("/ingredients", ingredientsHandler.Routes())
	r.Route("/recipes", recipesHandler.Routes())
	r.Route("/suppliers", suppliersHandler.Routes())
	r.Post("/cogs/calculate", cogsHandler.Calculate)
	r.Get("/cogs/overheads", cogsHandler.ListOverheads)
	r.Post("/cogs/overheads", cogsHandler.CreateOverhead)
	r.Get("/cogs/history", cogsHandler.ListHistory)
	r.Delete("/cogs/history/{id}", cogsHandler.DeleteSnapshot)
	r.Get("/dashboard/stats", dashboardHandler.Stats)
	r.Get("/dashboard/top-ingredients", dashboardHandler.TopIngredients)
	r.Get("/dashboard/recent-snapshots", dashboardHandler.RecentSnapshots)

	addr := fmt.Sprintf(":%s", cfg.Port)
	log.Printf("server listening on %s", addr)
	if err := http.ListenAndServe(addr, r); err != nil {
		log.Fatal(err)
	}
}
