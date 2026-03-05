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
	cfg           config.Config
	logger        *log.Logger
	db            *sql.DB
	templates     map[string]*template.Template
	staticVersion string
}

type User struct {
	ID        int64
	Email     string
	Name      string
	Role      string
	Blocked   bool
	CreatedAt time.Time
}

func (u *User) IsAdmin() bool {
	if u == nil {
		return false
	}
	return normalizeUserRole(u.Role) == userRoleAdmin
}

func (u *User) CanEdit() bool {
	if u == nil {
		return false
	}
	role := normalizeUserRole(u.Role)
	return role == userRoleEditor || role == userRoleAdmin
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

type ArticleVersion struct {
	ID           int64
	ArticleID    int64
	VersionNo    int
	Title        string
	Body         string
	Subsection   string
	EditedByName string
	CreatedAt    time.Time
}

type adminAuditEntry struct {
	ID           int64
	Action       string
	ActionLabel  string
	AdminName    string
	TargetEmail  string
	Details      string
	CreatedAt    time.Time
	TargetUserID sql.NullInt64
	AdminUserID  sql.NullInt64
}

type sectionOverview struct {
	Slug  string
	Name  string
	Lead  string
	Count int
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
	SectionOverviews   []sectionOverview
	RecentArticles     []Article
	SectionArticles    []Article
	CurrentArticle     *Article
	ArticleID          int64
	ArticleTitle       string
	ArticleBody        string
	ArticleBodyHTML    template.HTML
	ArticleVersions    []ArticleVersion
	AdminUsers         []adminUserListItem
	PendingRequests    []registrationRequestListItem
	AdminAuditEntries  []adminAuditEntry
	AvailableRoles     []roleOption
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

	staticVersion := time.Now().UTC().Format("20060102150405")

	templates, err := loadTemplates(staticVersion)
	if err != nil {
		_ = db.Close()
		return nil, err
	}

	return &Application{
		cfg:           cfg,
		logger:        logger,
		db:            db,
		templates:     templates,
		staticVersion: staticVersion,
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
	mux.Handle("/static/", http.StripPrefix("/static/", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Versioned assets are safe to cache aggressively.
		w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
		staticHandler.ServeHTTP(w, r)
	})))

	mux.HandleFunc("/", a.handleRoot)
	mux.HandleFunc("/auth/login", a.handleLogin)
	mux.HandleFunc("/auth/register", a.handleRegister)
	mux.HandleFunc("/auth/verify-email", a.handleVerifyEmail)
	mux.HandleFunc("/auth/logout", a.requireAuth(a.handleLogout))
	mux.HandleFunc("/app", a.requireAuth(a.handleDashboard))
	mux.HandleFunc("/app/section", a.requireAuth(a.handleSection))
	mux.HandleFunc("/app/article", a.requireAuth(a.handleArticleView))
	mux.HandleFunc("/app/article/new", a.requireAuth(a.handleArticleNew))
	mux.HandleFunc("/app/article/edit", a.requireAuth(a.handleArticleEdit))
	mux.HandleFunc("/app/article/restore", a.requireAuth(a.handleArticleRestore))
	mux.HandleFunc("/app/article/delete", a.requireAuth(a.handleArticleDelete))
	mux.HandleFunc("/app/admin/users", a.requireAuth(a.handleAdminUsers))
	mux.HandleFunc("/app/admin/registrations/approve", a.requireAuth(a.handleAdminApproveRegistration))
	mux.HandleFunc("/app/admin/registrations/reject", a.requireAuth(a.handleAdminRejectRegistration))
	mux.HandleFunc("/app/admin/users/role", a.requireAuth(a.handleAdminChangeUserRole))
	mux.HandleFunc("/app/admin/users/block", a.requireAuth(a.handleAdminBlockUser))
	mux.HandleFunc("/app/admin/users/unblock", a.requireAuth(a.handleAdminUnblockUser))
	mux.HandleFunc("/app/admin/users/delete", a.requireAuth(a.handleAdminDeleteUser))
	mux.HandleFunc("/admin/registration/approve", a.handleApproveRegistration)
	mux.HandleFunc("/admin/registration/reject", a.handleRejectRegistration)

	return a.logRequests(mux)
}

func loadTemplates(staticVersion string) (map[string]*template.Template, error) {
	templateDir := filepath.Join("web", "templates")
	names := []string{
		"login.tmpl",
		"register.tmpl",
		"dashboard.tmpl",
		"section.tmpl",
		"article_view.tmpl",
		"article_new.tmpl",
		"article_edit.tmpl",
		"admin_users.tmpl",
	}

	funcMap := template.FuncMap{
		"asset": func(name string) string {
			path := "/static/" + strings.TrimPrefix(strings.TrimSpace(name), "/")
			if staticVersion == "" {
				return path
			}
			return path + "?v=" + staticVersion
		},
	}

	result := make(map[string]*template.Template, len(names))
	for _, name := range names {
		fullPath := filepath.Join(templateDir, name)
		tmpl, err := template.New(name).Funcs(funcMap).ParseFiles(fullPath)
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
		`do $$
		begin
			if not exists (
				select 1
				from information_schema.columns
				where table_schema = 'public'
				  and table_name = 'users'
				  and column_name = 'role'
			) then
				alter table users add column role text not null default 'viewer';
				update users set role = 'editor' where role = 'viewer';
			end if;
		end
		$$;`,
		`do $$
		begin
			if not exists (
				select 1
				from pg_constraint
				where conname = 'users_role_check'
			) then
				alter table users add constraint users_role_check check (role in ('viewer', 'editor', 'admin'));
			end if;
		end
		$$;`,
		`update users
		set role = 'viewer'
		where role is null or role not in ('viewer', 'editor', 'admin');`,
		`alter table if exists users add column if not exists is_blocked boolean not null default false;`,
		`update users set is_blocked = false where is_blocked is null;`,
		`with ranked as (
			select
				id,
				row_number() over (partition by lower(name) order by created_at, id) as rn
			from users
		)
		update users u
		set name = concat(u.name, '_', u.id)
		from ranked r
		where u.id = r.id and r.rn > 1;`,
		`create unique index if not exists idx_users_name_ci_unique on users ((lower(name)));`,
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
		`with ranked as (
			select
				id,
				row_number() over (partition by lower(name) order by created_at, id) as rn
			from registration_requests
			where status in ('pending', 'approved')
		)
		update registration_requests rr
		set
			status = 'rejected',
			rejection_reason = coalesce(nullif(rr.rejection_reason, ''), 'Автоотклонение: ник уже занят.'),
			email_verify_token = null,
			updated_at = now(),
			moderated_at = coalesce(rr.moderated_at, now())
		from ranked r
		where rr.id = r.id and r.rn > 1 and rr.status in ('pending', 'approved');`,
		`create unique index if not exists idx_registration_requests_name_active_unique
			on registration_requests ((lower(name)))
			where status in ('pending', 'approved');`,
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
		`create table if not exists article_versions (
			id bigserial primary key,
			article_id bigint not null,
			version_no integer not null,
			edited_by bigint,
			title text not null,
			body text not null,
			subsection text not null default '',
			created_at timestamptz not null default now(),
			foreign key(article_id) references articles(id) on delete cascade,
			foreign key(edited_by) references users(id) on delete set null
		);`,
		`alter table if exists articles add column if not exists subsection text not null default '';`,
		`create unique index if not exists idx_article_versions_article_version_no on article_versions(article_id, version_no);`,
		`create index if not exists idx_article_versions_article_created_at on article_versions(article_id, created_at desc);`,
		`insert into article_versions (article_id, version_no, edited_by, title, body, subsection, created_at)
		select
			a.id,
			1,
			a.author_id,
			a.title,
			a.body,
			a.subsection,
			a.created_at
		from articles a
		where not exists (
			select 1
			from article_versions v
			where v.article_id = a.id
		);`,
		`create table if not exists admin_audit_log (
			id bigserial primary key,
			admin_user_id bigint,
			action text not null,
			target_user_id bigint,
			target_email text not null default '',
			details text not null default '',
			created_at timestamptz not null default now(),
			foreign key(admin_user_id) references users(id) on delete set null,
			foreign key(target_user_id) references users(id) on delete set null
		);`,
		`create index if not exists idx_admin_audit_log_created_at on admin_audit_log(created_at desc);`,
		`create index if not exists idx_admin_audit_log_action_created_at on admin_audit_log(action, created_at desc);`,
		`create table if not exists auth_rate_limits (
			action text not null,
			identifier text not null,
			attempts integer not null default 0,
			window_started_at timestamptz not null,
			blocked_until timestamptz,
			updated_at timestamptz not null default now(),
			primary key (action, identifier)
		);`,
		`create index if not exists idx_auth_rate_limits_blocked_until on auth_rate_limits(blocked_until);`,
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
	w.Header().Set("Cache-Control", "no-store")
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
