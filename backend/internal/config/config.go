package config

import (
	"log"
	"os"

	"github.com/joho/godotenv"
)

type Config struct {
	DatabaseURL string
	Port        string
	Env         string
}

func Load() *Config {
	if err := godotenv.Load(); err != nil {
		log.Println("no .env file found, reading from environment")
	}
	return &Config{
		DatabaseURL: mustGet("DATABASE_URL"),
		Port:        getOrDefault("PORT", "8000"),
		Env:         getOrDefault("ENV", "development"),
	}
}

func mustGet(key string) string {
	v := os.Getenv(key)
	if v == "" {
		log.Fatalf("required env variable %s is not set", key)
	}
	return v
}

func getOrDefault(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
