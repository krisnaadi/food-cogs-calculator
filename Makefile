.PHONY: up down migrate-up migrate-down sqlc-gen backend frontend

DB_URL=postgres://cogs_user:cogs_secret@localhost:5432/cogs_db?sslmode=disable

up:
	docker compose up -d db

down:
	docker compose down

migrate-up:
	migrate -path backend/migrations -database "$(DB_URL)" up

migrate-down:
	migrate -path backend/migrations -database "$(DB_URL)" down 1

migrate-new:
	migrate create -ext sql -dir backend/migrations -seq $(name)

sqlc:
	cd backend && sqlc generate

backend:
	cd backend && air

frontend:
	cd frontend && npm run dev

test:
	cd backend && go test ./...