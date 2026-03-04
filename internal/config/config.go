package config

import (
	"os"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	AppName           string
	Port              string
	DatabaseDSN       string
	SessionCookieName string
	SessionTTL        time.Duration
	SecureCookies     bool
}

func Load() Config {
	appEnv := getEnv("APP_ENV", "development")
	ttlHours := getEnvInt("SESSION_TTL_HOURS", 168)
	if ttlHours < 1 {
		ttlHours = 168
	}

	secureByDefault := appEnv == "production"

	return Config{
		AppName:           getEnv("APP_NAME", "Контур Знаний"),
		Port:              getEnv("APP_PORT", "8080"),
		DatabaseDSN:       getEnv("DATABASE_DSN", "file:data/kontur.db"),
		SessionCookieName: getEnv("SESSION_COOKIE_NAME", "kontur_session"),
		SessionTTL:        time.Duration(ttlHours) * time.Hour,
		SecureCookies:     getEnvBool("SECURE_COOKIES", secureByDefault),
	}
}

func getEnv(key string, fallback string) string {
	value := strings.TrimSpace(os.Getenv(key))
	if value == "" {
		return fallback
	}
	return value
}

func getEnvInt(key string, fallback int) int {
	raw := strings.TrimSpace(os.Getenv(key))
	if raw == "" {
		return fallback
	}

	value, err := strconv.Atoi(raw)
	if err != nil {
		return fallback
	}

	return value
}

func getEnvBool(key string, fallback bool) bool {
	raw := strings.TrimSpace(strings.ToLower(os.Getenv(key)))
	if raw == "" {
		return fallback
	}

	switch raw {
	case "1", "true", "yes", "on":
		return true
	case "0", "false", "no", "off":
		return false
	default:
		return fallback
	}
}
