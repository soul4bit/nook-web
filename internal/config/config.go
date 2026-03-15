package config

import (
	"os"
	"strconv"
	"strings"
	"time"
)

type Config struct {
	AppName             string
	Port                string
	AppBaseURL          string
	TrustedProxyCIDRs   string
	DatabaseURL         string
	DefaultUserRating   int
	ArticleCreateXP     int
	ArticleLikeXP       int
	RankApprenticeMin   int
	RankExpertMin       int
	RankMasterMin       int
	DBMaxOpenConns      int
	DBMaxIdleConns      int
	DBConnMaxLifetime   time.Duration
	DBConnMaxIdleTime   time.Duration
	SessionCookieName   string
	SessionTTL          time.Duration
	SecureCookies       bool
	SMTPHost            string
	SMTPPort            int
	SMTPSecure          bool
	SMTPUser            string
	SMTPPassword        string
	MailFrom            string
	TelegramBotToken    string
	TelegramAdminChatID string
	S3Endpoint          string
	S3Bucket            string
	S3AccessKey         string
	S3SecretKey         string
	S3PublicBaseURL     string
}

func Load() Config {
	appEnv := getEnv("APP_ENV", "development")
	ttlHours := getEnvInt("SESSION_TTL_HOURS", 168)
	if ttlHours < 1 {
		ttlHours = 168
	}

	secureByDefault := appEnv == "production"
	defaultDatabaseURL := "postgres://kontur_znaniy:CHANGE_ME_STRONG_PASSWORD@127.0.0.1:5432/kontur_znaniy?sslmode=disable"
	databaseURL := getEnv("DATABASE_URL", getEnv("DATABASE_DSN", defaultDatabaseURL))

	return Config{
		AppName:             getEnv("APP_NAME", "Контур Знаний"),
		Port:                getEnv("APP_PORT", "8080"),
		AppBaseURL:          strings.TrimRight(getEnv("APP_BASE_URL", "http://localhost:8080"), "/"),
		TrustedProxyCIDRs:   getEnv("TRUSTED_PROXY_CIDRS", ""),
		DatabaseURL:         databaseURL,
		DefaultUserRating:   getEnvInt("DEFAULT_USER_RATING", 1000),
		ArticleCreateXP:     getEnvInt("ARTICLE_CREATE_RATING_XP", 5),
		ArticleLikeXP:       getEnvInt("ARTICLE_LIKE_RATING_XP", 10),
		RankApprenticeMin:   getEnvInt("RANK_APPRENTICE_MIN_RATING", 1200),
		RankExpertMin:       getEnvInt("RANK_EXPERT_MIN_RATING", 1600),
		RankMasterMin:       getEnvInt("RANK_MASTER_MIN_RATING", 2200),
		DBMaxOpenConns:      getEnvInt("DB_MAX_OPEN_CONNS", 20),
		DBMaxIdleConns:      getEnvInt("DB_MAX_IDLE_CONNS", 10),
		DBConnMaxLifetime:   time.Duration(getEnvInt("DB_CONN_MAX_LIFETIME_MINUTES", 30)) * time.Minute,
		DBConnMaxIdleTime:   time.Duration(getEnvInt("DB_CONN_MAX_IDLE_TIME_MINUTES", 10)) * time.Minute,
		SessionCookieName:   getEnv("SESSION_COOKIE_NAME", "kontur_session"),
		SessionTTL:          time.Duration(ttlHours) * time.Hour,
		SecureCookies:       getEnvBool("SECURE_COOKIES", secureByDefault),
		SMTPHost:            getEnv("SMTP_HOST", ""),
		SMTPPort:            getEnvInt("SMTP_PORT", 465),
		SMTPSecure:          getEnvBool("SMTP_SECURE", true),
		SMTPUser:            getEnv("SMTP_USER", ""),
		SMTPPassword:        getEnv("SMTP_PASSWORD", ""),
		MailFrom:            getEnv("MAIL_FROM", ""),
		TelegramBotToken:    getEnv("TELEGRAM_BOT_TOKEN", ""),
		TelegramAdminChatID: getEnv("TELEGRAM_ADMIN_CHAT_ID", ""),
		S3Endpoint:          strings.TrimRight(getEnv("S3_ENDPOINT", ""), "/"),
		S3Bucket:            getEnv("S3_BUCKET", ""),
		S3AccessKey:         getEnv("S3_ACCESS_KEY", ""),
		S3SecretKey:         getEnv("S3_SECRET_KEY", ""),
		S3PublicBaseURL:     strings.TrimRight(getEnv("S3_PUBLIC_BASE_URL", ""), "/"),
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
