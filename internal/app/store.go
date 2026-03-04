package app

import (
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"time"

	"github.com/jackc/pgx/v5/pgconn"
)

type authStats struct {
	UsersTotal     int
	ActiveSessions int
}

type registrationRequestStatus string

const (
	registrationStatusPending   registrationRequestStatus = "pending"
	registrationStatusApproved  registrationRequestStatus = "approved"
	registrationStatusRejected  registrationRequestStatus = "rejected"
	registrationStatusCompleted registrationRequestStatus = "completed"
)

type registrationRequest struct {
	ID               int64
	Name             string
	Email            string
	PasswordHash     string
	Status           registrationRequestStatus
	ModerationToken  string
	EmailVerifyToken sql.NullString
	RejectionReason  sql.NullString
	CreatedAt        time.Time
	UpdatedAt        time.Time
	ModeratedAt      sql.NullTime
	EmailVerifiedAt  sql.NullTime
}

func (a *Application) createUser(name string, email string, passwordHash string) (*User, error) {
	now := time.Now().UTC()
	row := a.db.QueryRow(
		`insert into users (email, name, password_hash, created_at)
		 values ($1, $2, $3, $4)
		 returning id, email, name, created_at`,
		email,
		name,
		passwordHash,
		now,
	)

	var user User
	if err := row.Scan(&user.ID, &user.Email, &user.Name, &user.CreatedAt); err != nil {
		return nil, err
	}

	return &user, nil
}

func (a *Application) getUserByID(userID int64) (*User, error) {
	row := a.db.QueryRow(
		`select id, email, name, created_at from users where id = $1 limit 1`,
		userID,
	)

	var user User
	if err := row.Scan(&user.ID, &user.Email, &user.Name, &user.CreatedAt); err != nil {
		return nil, err
	}

	return &user, nil
}

func (a *Application) getUserByEmail(email string) (*User, error) {
	row := a.db.QueryRow(
		`select id, email, name, created_at from users where email = $1 limit 1`,
		email,
	)

	var user User
	if err := row.Scan(&user.ID, &user.Email, &user.Name, &user.CreatedAt); err != nil {
		return nil, err
	}

	return &user, nil
}

func (a *Application) getCredentialsByEmail(email string) (*userCredentials, error) {
	row := a.db.QueryRow(
		`select id, email, name, password_hash, created_at from users where email = $1 limit 1`,
		email,
	)

	var creds userCredentials
	if err := row.Scan(
		&creds.ID,
		&creds.Email,
		&creds.Name,
		&creds.PasswordHash,
		&creds.CreatedAt,
	); err != nil {
		return nil, err
	}

	return &creds, nil
}

func (a *Application) createSession(userID int64) (token string, expiresAt time.Time, err error) {
	if err := a.cleanupExpiredSessions(); err != nil {
		return "", time.Time{}, err
	}

	token, err = generateSessionToken()
	if err != nil {
		return "", time.Time{}, err
	}

	now := time.Now().UTC()
	expiresAt = now.Add(a.cfg.SessionTTL)
	tokenHash := hashSessionToken(token)

	_, err = a.db.Exec(
		`insert into sessions (user_id, token_hash, created_at, expires_at) values ($1, $2, $3, $4)`,
		userID,
		tokenHash,
		now,
		expiresAt,
	)
	if err != nil {
		return "", time.Time{}, err
	}

	return token, expiresAt, nil
}

func (a *Application) getUserBySessionToken(token string) (*User, error) {
	tokenHash := hashSessionToken(token)
	row := a.db.QueryRow(
		`select
			u.id,
			u.email,
			u.name,
			u.created_at,
			s.expires_at
		from sessions s
		join users u on u.id = s.user_id
		where s.token_hash = $1
		limit 1`,
		tokenHash,
	)

	var user User
	var expiresAt time.Time
	err := row.Scan(
		&user.ID,
		&user.Email,
		&user.Name,
		&user.CreatedAt,
		&expiresAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}

	if !expiresAt.After(time.Now().UTC()) {
		if delErr := a.deleteSessionByToken(token); delErr != nil {
			a.logger.Printf("delete expired session: %v", delErr)
		}
		return nil, nil
	}

	return &user, nil
}

func (a *Application) deleteSessionByToken(token string) error {
	tokenHash := hashSessionToken(token)
	_, err := a.db.Exec(`delete from sessions where token_hash = $1`, tokenHash)
	return err
}

func (a *Application) cleanupExpiredSessions() error {
	_, err := a.db.Exec(
		`delete from sessions where expires_at <= $1`,
		time.Now().UTC(),
	)
	return err
}

func (a *Application) getAuthStats() (authStats, error) {
	now := time.Now().UTC()
	row := a.db.QueryRow(
		`select
			(select count(*) from users),
			(select count(*) from sessions where expires_at > $1)`,
		now,
	)

	var stats authStats
	if err := row.Scan(&stats.UsersTotal, &stats.ActiveSessions); err != nil {
		return authStats{}, err
	}

	return stats, nil
}

func scanArticle(scanner interface {
	Scan(dest ...any) error
}) (*Article, error) {
	var article Article
	if err := scanner.Scan(
		&article.ID,
		&article.AuthorID,
		&article.AuthorName,
		&article.SectionSlug,
		&article.Subsection,
		&article.Title,
		&article.Body,
		&article.CreatedAt,
		&article.UpdatedAt,
	); err != nil {
		return nil, err
	}
	return &article, nil
}

func (a *Application) createArticle(authorID int64, sectionSlug string, subsection string, title string, body string) (*Article, error) {
	now := time.Now().UTC()
	row := a.db.QueryRow(
		`insert into articles (author_id, section_slug, subsection, title, body, created_at, updated_at)
		 values ($1, $2, $3, $4, $5, $6, $6)
		 returning
			id,
			author_id,
			'' as author_name,
			section_slug,
			subsection,
			title,
			body,
			created_at,
			updated_at`,
		authorID,
		sectionSlug,
		subsection,
		title,
		body,
		now,
	)
	return scanArticle(row)
}

func (a *Application) getArticleByID(articleID int64) (*Article, error) {
	row := a.db.QueryRow(
		`select
			a.id,
			a.author_id,
			u.name as author_name,
			a.section_slug,
			a.subsection,
			a.title,
			a.body,
			a.created_at,
			a.updated_at
		from articles a
		join users u on u.id = a.author_id
		where a.id = $1
		limit 1`,
		articleID,
	)
	return scanArticle(row)
}

func (a *Application) updateArticleByAuthor(articleID int64, authorID int64, subsection string, title string, body string) (*Article, error) {
	now := time.Now().UTC()
	row := a.db.QueryRow(
		`update articles
		set
			subsection = $3,
			title = $4,
			body = $5,
			updated_at = $6
		where id = $1 and author_id = $2
		returning
			id,
			author_id,
			'' as author_name,
			section_slug,
			subsection,
			title,
			body,
			created_at,
			updated_at`,
		articleID,
		authorID,
		subsection,
		title,
		body,
		now,
	)
	return scanArticle(row)
}

func (a *Application) getArticlesBySection(sectionSlug string, subsection string, limit int) ([]Article, error) {
	if limit < 1 {
		limit = 1
	}

	query := `select
			a.id,
			a.author_id,
			u.name as author_name,
			a.section_slug,
			a.subsection,
			a.title,
			a.body,
			a.created_at,
			a.updated_at
		from articles a
		join users u on u.id = a.author_id
		where a.section_slug = $1`
	args := []any{sectionSlug}
	if subsection != "" {
		query += ` and a.subsection = $2`
		args = append(args, subsection)
	}
	query += ` order by a.updated_at desc`
	query += fmt.Sprintf(" limit $%d", len(args)+1)
	args = append(args, limit)

	rows, err := a.db.Query(query, args...)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := make([]Article, 0, limit)
	for rows.Next() {
		article, scanErr := scanArticle(rows)
		if scanErr != nil {
			return nil, scanErr
		}
		result = append(result, *article)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return result, nil
}

func (a *Application) getRecentArticles(limit int) ([]Article, error) {
	if limit < 1 {
		limit = 1
	}

	rows, err := a.db.Query(
		`select
			a.id,
			a.author_id,
			u.name as author_name,
			a.section_slug,
			a.subsection,
			a.title,
			a.body,
			a.created_at,
			a.updated_at
		from articles a
		join users u on u.id = a.author_id
		order by a.updated_at desc
		limit $1`,
		limit,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := make([]Article, 0, limit)
	for rows.Next() {
		article, scanErr := scanArticle(rows)
		if scanErr != nil {
			return nil, scanErr
		}
		result = append(result, *article)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return result, nil
}

func scanRegistrationRequest(scanner interface {
	Scan(dest ...any) error
}) (*registrationRequest, error) {
	var req registrationRequest
	if err := scanner.Scan(
		&req.ID,
		&req.Name,
		&req.Email,
		&req.PasswordHash,
		&req.Status,
		&req.ModerationToken,
		&req.EmailVerifyToken,
		&req.RejectionReason,
		&req.CreatedAt,
		&req.UpdatedAt,
		&req.ModeratedAt,
		&req.EmailVerifiedAt,
	); err != nil {
		return nil, err
	}
	return &req, nil
}

func (a *Application) getRegistrationRequestByEmail(email string) (*registrationRequest, error) {
	row := a.db.QueryRow(
		`select
			id,
			name,
			email,
			password_hash,
			status,
			moderation_token,
			email_verify_token,
			rejection_reason,
			created_at,
			updated_at,
			moderated_at,
			email_verified_at
		from registration_requests
		where email = $1
		limit 1`,
		email,
	)
	return scanRegistrationRequest(row)
}

func (a *Application) getRegistrationRequestByModerationToken(token string) (*registrationRequest, error) {
	row := a.db.QueryRow(
		`select
			id,
			name,
			email,
			password_hash,
			status,
			moderation_token,
			email_verify_token,
			rejection_reason,
			created_at,
			updated_at,
			moderated_at,
			email_verified_at
		from registration_requests
		where moderation_token = $1
		limit 1`,
		token,
	)
	return scanRegistrationRequest(row)
}

func (a *Application) getRegistrationRequestByVerifyToken(token string) (*registrationRequest, error) {
	row := a.db.QueryRow(
		`select
			id,
			name,
			email,
			password_hash,
			status,
			moderation_token,
			email_verify_token,
			rejection_reason,
			created_at,
			updated_at,
			moderated_at,
			email_verified_at
		from registration_requests
		where email_verify_token = $1
		limit 1`,
		token,
	)
	return scanRegistrationRequest(row)
}

func (a *Application) upsertRegistrationRequest(name string, email string, passwordHash string, moderationToken string) (*registrationRequest, error) {
	now := time.Now().UTC()
	row := a.db.QueryRow(
		`insert into registration_requests (
			name,
			email,
			password_hash,
			status,
			moderation_token,
			email_verify_token,
			rejection_reason,
			created_at,
			updated_at,
			moderated_at,
			email_verified_at
		) values ($1, $2, $3, $4, $5, null, null, $6, $6, null, null)
		on conflict (email) do update set
			name = excluded.name,
			password_hash = excluded.password_hash,
			status = excluded.status,
			moderation_token = excluded.moderation_token,
			email_verify_token = null,
			rejection_reason = null,
			updated_at = excluded.updated_at,
			moderated_at = null,
			email_verified_at = null
		returning
			id,
			name,
			email,
			password_hash,
			status,
			moderation_token,
			email_verify_token,
			rejection_reason,
			created_at,
			updated_at,
			moderated_at,
			email_verified_at`,
		name,
		email,
		passwordHash,
		registrationStatusPending,
		moderationToken,
		now,
	)
	return scanRegistrationRequest(row)
}

func (a *Application) deleteRegistrationRequestByEmail(email string) error {
	_, err := a.db.Exec(`delete from registration_requests where email = $1`, email)
	return err
}

func (a *Application) approveRegistrationRequest(moderationToken string, emailVerifyToken string) (*registrationRequest, error) {
	now := time.Now().UTC()
	row := a.db.QueryRow(
		`update registration_requests
		set
			status = $2,
			email_verify_token = $3,
			rejection_reason = null,
			moderated_at = $4,
			updated_at = $4
		where moderation_token = $1 and status = $5
		returning
			id,
			name,
			email,
			password_hash,
			status,
			moderation_token,
			email_verify_token,
			rejection_reason,
			created_at,
			updated_at,
			moderated_at,
			email_verified_at`,
		moderationToken,
		registrationStatusApproved,
		emailVerifyToken,
		now,
		registrationStatusPending,
	)
	return scanRegistrationRequest(row)
}

func (a *Application) rejectRegistrationRequest(moderationToken string, reason string) (*registrationRequest, error) {
	now := time.Now().UTC()
	row := a.db.QueryRow(
		`update registration_requests
		set
			status = $2,
			rejection_reason = $3,
			email_verify_token = null,
			moderated_at = $4,
			updated_at = $4
		where moderation_token = $1 and status = $5
		returning
			id,
			name,
			email,
			password_hash,
			status,
			moderation_token,
			email_verify_token,
			rejection_reason,
			created_at,
			updated_at,
			moderated_at,
			email_verified_at`,
		moderationToken,
		registrationStatusRejected,
		reason,
		now,
		registrationStatusPending,
	)
	return scanRegistrationRequest(row)
}

func (a *Application) completeRegistrationByVerifyToken(verifyToken string) (*User, error) {
	now := time.Now().UTC()
	tx, err := a.db.Begin()
	if err != nil {
		return nil, err
	}
	defer func() {
		_ = tx.Rollback()
	}()

	var req registrationRequest
	err = tx.QueryRow(
		`select
			id,
			name,
			email,
			password_hash,
			status,
			moderation_token,
			email_verify_token,
			rejection_reason,
			created_at,
			updated_at,
			moderated_at,
			email_verified_at
		from registration_requests
		where email_verify_token = $1 and status = $2
		for update`,
		verifyToken,
		registrationStatusApproved,
	).Scan(
		&req.ID,
		&req.Name,
		&req.Email,
		&req.PasswordHash,
		&req.Status,
		&req.ModerationToken,
		&req.EmailVerifyToken,
		&req.RejectionReason,
		&req.CreatedAt,
		&req.UpdatedAt,
		&req.ModeratedAt,
		&req.EmailVerifiedAt,
	)
	if err != nil {
		return nil, err
	}

	var user User
	err = tx.QueryRow(
		`select id, email, name, created_at from users where email = $1 limit 1`,
		req.Email,
	).Scan(&user.ID, &user.Email, &user.Name, &user.CreatedAt)
	if err != nil {
		if !errors.Is(err, sql.ErrNoRows) {
			return nil, err
		}

		err = tx.QueryRow(
			`insert into users (email, name, password_hash, created_at)
			 values ($1, $2, $3, $4)
			 returning id, email, name, created_at`,
			req.Email,
			req.Name,
			req.PasswordHash,
			now,
		).Scan(&user.ID, &user.Email, &user.Name, &user.CreatedAt)
		if err != nil {
			return nil, err
		}
	}

	_, err = tx.Exec(
		`update registration_requests
		set
			status = $2,
			email_verified_at = $3,
			email_verify_token = null,
			updated_at = $3
		where id = $1`,
		req.ID,
		registrationStatusCompleted,
		now,
	)
	if err != nil {
		return nil, err
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	return &user, nil
}

func isUniqueEmailError(err error) bool {
	if err == nil {
		return false
	}

	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		if pgErr.Code != "23505" {
			return false
		}

		if pgErr.ConstraintName == "users_email_key" {
			return true
		}

		return strings.Contains(strings.ToLower(pgErr.Message), "email")
	}

	text := strings.ToLower(err.Error())
	return strings.Contains(text, "users_email_key") ||
		(strings.Contains(text, "duplicate key") && strings.Contains(text, "email"))
}
