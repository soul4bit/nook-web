package app

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"html/template"
	"log"
	"net/http"
	"path/filepath"
	"strings"
	"time"

	"nook/internal/config"

	_ "github.com/jackc/pgx/v5/stdlib"
)

type Application struct {
	cfg       config.Config
	logger    *log.Logger
	db        *sql.DB
	templates map[string]*template.Template
}

type User struct {
	ID        int64
	Email     string
	Name      string
	CreatedAt time.Time
}

type Article struct {
	ID          int64
	AuthorID    int64
	AuthorName  string
	SectionSlug string
	Subsection  string
	SectionName string
	Title       string
	Body        string
	CreatedAt   time.Time
	UpdatedAt   time.Time
}

type s3CheckResult struct {
	Checked  bool
	OK       bool
	Message  string
	Endpoint string
	Bucket   string
}

type userCredentials struct {
	User
	PasswordHash string
}

type viewData struct {
	AppName            string
	Title              string
	Error              string
	Success            string
	User               *User
	Name               string
	Email              string
	Next               string
	UsersTotal         int
	ActiveSessions     int
	Sections           []wikiSection
	CurrentSection     *wikiSection
	CurrentSectionSlug string
	CurrentSubsection  string
	CurrentPage        string
	RecentArticles     []Article
	SectionArticles    []Article
	ArticleID          int64
	ArticleTitle       string
	ArticleBody        string
	S3Check            *s3CheckResult
	S3Endpoint         string
	S3Bucket           string
	S3PublicBaseURL    string
}

type contextKey string

const userContextKey contextKey = "authenticated_user"

func New(cfg config.Config, logger *log.Logger) (*Application, error) {
	db, err := sql.Open("pgx", cfg.DatabaseURL)
	if err != nil {
		return nil, err
	}

	if err := db.Ping(); err != nil {
		_ = db.Close()
		return nil, err
	}

	if err := runMigrations(db); err != nil {
		_ = db.Close()
		return nil, err
	}

	templates, err := loadTemplates()
	if err != nil {
		_ = db.Close()
		return nil, err
	}

	return &Application{
		cfg:       cfg,
		logger:    logger,
		db:        db,
		templates: templates,
	}, nil
}

func (a *Application) Close() error {
	if a.db == nil {
		return nil
	}
	return a.db.Close()
}

func (a *Application) Routes() http.Handler {
	mux := http.NewServeMux()

	staticHandler := http.FileServer(http.Dir("web/static"))
	mux.Handle("/static/", http.StripPrefix("/static/", staticHandler))

	mux.HandleFunc("/", a.handleRoot)
	mux.HandleFunc("/auth/login", a.handleLogin)
	mux.HandleFunc("/auth/register", a.handleRegister)
	mux.HandleFunc("/auth/verify-email", a.handleVerifyEmail)
	mux.HandleFunc("/auth/logout", a.requireAuth(a.handleLogout))
	mux.HandleFunc("/app", a.requireAuth(a.handleDashboard))
	mux.HandleFunc("/app/section", a.requireAuth(a.handleSection))
	mux.HandleFunc("/app/article/new", a.requireAuth(a.handleArticleNew))
	mux.HandleFunc("/app/article/edit", a.requireAuth(a.handleArticleEdit))
	mux.HandleFunc("/app/s3", a.requireAuth(a.handleS3Check))
	mux.HandleFunc("/admin/registration/approve", a.handleApproveRegistration)
	mux.HandleFunc("/admin/registration/reject", a.handleRejectRegistration)

	return a.logRequests(mux)
}

func loadTemplates() (map[string]*template.Template, error) {
	templateDir := filepath.Join("web", "templates")
	names := []string{
		"login.tmpl",
		"register.tmpl",
		"dashboard.tmpl",
		"section.tmpl",
		"article_new.tmpl",
		"article_edit.tmpl",
		"s3_check.tmpl",
	}

	result := make(map[string]*template.Template, len(names))
	for _, name := range names {
		fullPath := filepath.Join(templateDir, name)
		tmpl, err := template.ParseFiles(fullPath)
		if err != nil {
			return nil, err
		}
		result[name] = tmpl
	}

	return result, nil
}

func runMigrations(db *sql.DB) error {
	statements := []string{
		`create table if not exists users (
			id bigserial primary key,
			email text not null unique,
			name text not null,
			password_hash text not null,
			created_at timestamptz not null default now()
		);`,
		`create table if not exists sessions (
			id bigserial primary key,
			user_id bigint not null,
			token_hash text not null unique,
			created_at timestamptz not null,
			expires_at timestamptz not null,
			foreign key(user_id) references users(id) on delete cascade
		);`,
		`create table if not exists registration_requests (
			id bigserial primary key,
			email text not null unique,
			name text not null,
			password_hash text not null,
			status text not null default 'pending',
			moderation_token text not null unique,
			email_verify_token text,
			rejection_reason text,
			created_at timestamptz not null default now(),
			updated_at timestamptz not null default now(),
			moderated_at timestamptz,
			email_verified_at timestamptz
		);`,
		`create table if not exists articles (
			id bigserial primary key,
			author_id bigint not null,
			section_slug text not null,
			subsection text not null default '',
			title text not null,
			body text not null,
			created_at timestamptz not null default now(),
			updated_at timestamptz not null default now(),
			foreign key(author_id) references users(id) on delete cascade
		);`,
		`alter table if exists articles add column if not exists subsection text not null default '';`,
		`create index if not exists idx_sessions_user_id on sessions(user_id);`,
		`create index if not exists idx_sessions_expires_at on sessions(expires_at);`,
		`create index if not exists idx_articles_author_id on articles(author_id);`,
		`create index if not exists idx_articles_section_updated_at on articles(section_slug, updated_at desc);`,
		`create index if not exists idx_articles_section_subsection_updated_at on articles(section_slug, subsection, updated_at desc);`,
		`create unique index if not exists idx_registration_requests_email_verify_token
			on registration_requests(email_verify_token)
			where email_verify_token is not null;`,
	}

	for _, stmt := range statements {
		if _, err := db.Exec(stmt); err != nil {
			return err
		}
	}

	return nil
}

func (a *Application) renderTemplate(w http.ResponseWriter, templateName string, data viewData) {
	tmpl, ok := a.templates[templateName]
	if !ok {
		http.Error(w, "template not found", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	if err := tmpl.Execute(w, data); err != nil {
		a.logger.Printf("render template %s: %v", templateName, err)
		http.Error(w, "internal server error", http.StatusInternalServerError)
	}
}

func (a *Application) logRequests(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		started := time.Now()
		next.ServeHTTP(w, r)
		a.logger.Printf("%s %s %s", r.Method, r.URL.Path, time.Since(started))
	})
}

func normalizeEmail(value string) string {
	return strings.ToLower(strings.TrimSpace(value))
}

func generateSessionToken() (string, error) {
	buffer := make([]byte, 32)
	if _, err := rand.Read(buffer); err != nil {
		return "", err
	}

	return base64.RawURLEncoding.EncodeToString(buffer), nil
}

func hashSessionToken(token string) string {
	sum := sha256.Sum256([]byte(token))
	return hex.EncodeToString(sum[:])
}

func isSafeRedirectTarget(target string) bool {
	if target == "" {
		return false
	}

	if !strings.HasPrefix(target, "/") {
		return false
	}

	return !strings.HasPrefix(target, "//")
}

func (a *Application) sessionCookie(token string, expiresAt time.Time) *http.Cookie {
	return &http.Cookie{
		Name:     a.cfg.SessionCookieName,
		Value:    token,
		Path:     "/",
		HttpOnly: true,
		Secure:   a.cfg.SecureCookies,
		SameSite: http.SameSiteLaxMode,
		Expires:  expiresAt,
	}
}

func (a *Application) clearSessionCookie(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{
		Name:     a.cfg.SessionCookieName,
		Value:    "",
		Path:     "/",
		HttpOnly: true,
		Secure:   a.cfg.SecureCookies,
		SameSite: http.SameSiteLaxMode,
		Expires:  time.Unix(0, 0),
		MaxAge:   -1,
	})
}

func userFromContext(ctx context.Context) *User {
	user, ok := ctx.Value(userContextKey).(*User)
	if !ok {
		return nil
	}
	return user
}

func (a *Application) currentUser(r *http.Request) (*User, error) {
	cookie, err := r.Cookie(a.cfg.SessionCookieName)
	if err != nil {
		if errors.Is(err, http.ErrNoCookie) {
			return nil, nil
		}
		return nil, err
	}

	token := strings.TrimSpace(cookie.Value)
	if token == "" {
		return nil, nil
	}

	return a.getUserBySessionToken(token)
}
