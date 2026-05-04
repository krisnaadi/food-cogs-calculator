package db

import (
	"context"
	"log"

	"github.com/jackc/pgx/v5/pgxpool"
)

func NewPool(ctx context.Context, databaseURL string) *pgxpool.Pool {
	pool, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		log.Fatalf("unable to connect to database: %v", err)
	}
	if err := pool.Ping(ctx); err != nil {
		log.Fatalf("database ping failed: %v", err)
	}
	log.Println("database connection established")
	return pool
}
