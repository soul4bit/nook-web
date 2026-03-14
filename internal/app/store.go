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

var errRegistrationNameTaken = errors.New("registration nickname already taken")
var errArticleSelfLike = errors.New("cannot like own article")

const registrationNameTakenReason = "Ник уже занят другим пользователем. Отправьте новую заявку с другим ником."

func (a *Application) createUser(name string, email string, passwordHash string) (*User, error) {
	now := time.Now().UTC()
	row := a.db.QueryRow(
		`insert into users (email, name, password_hash, role, created_at)
		 values ($1, $2, $3, $4, $5)
		 returning id, email, name, role, rating, is_blocked, avatar_url, created_at, password_changed_at`,
		email,
		name,
		passwordHash,
		userRoleViewer,
		now,
	)

	var user User
	if err := row.Scan(
		&user.ID,
		&user.Email,
		&user.Name,
		&user.Role,
		&user.Rating,
		&user.Blocked,
		&user.AvatarURL,
		&user.CreatedAt,
		&user.PasswordChangedAt,
	); err != nil {
		return nil, err
	}
	user.Role = normalizeUserRole(user.Role)

	return &user, nil
}

func (a *Application) getUserByID(userID int64) (*User, error) {
	row := a.db.QueryRow(
		`select id, email, name, role, rating, is_blocked, avatar_url, created_at, password_changed_at from users where id = $1 limit 1`,
		userID,
	)

	var user User
	if err := row.Scan(
		&user.ID,
		&user.Email,
		&user.Name,
		&user.Role,
		&user.Rating,
		&user.Blocked,
		&user.AvatarURL,
		&user.CreatedAt,
		&user.PasswordChangedAt,
	); err != nil {
		return nil, err
	}
	user.Role = normalizeUserRole(user.Role)

	return &user, nil
}

func (a *Application) getUserByEmail(email string) (*User, error) {
	row := a.db.QueryRow(
		`select id, email, name, role, rating, is_blocked, avatar_url, created_at, password_changed_at from users where email = $1 limit 1`,
		email,
	)

	var user User
	if err := row.Scan(
		&user.ID,
		&user.Email,
		&user.Name,
		&user.Role,
		&user.Rating,
		&user.Blocked,
		&user.AvatarURL,
		&user.CreatedAt,
		&user.PasswordChangedAt,
	); err != nil {
		return nil, err
	}
	user.Role = normalizeUserRole(user.Role)

	return &user, nil
}

func (a *Application) getUserByName(name string) (*User, error) {
	row := a.db.QueryRow(
		`select id, email, name, role, rating, is_blocked, avatar_url, created_at, password_changed_at
		from users
		where lower(name) = lower($1)
		limit 1`,
		name,
	)

	var user User
	if err := row.Scan(
		&user.ID,
		&user.Email,
		&user.Name,
		&user.Role,
		&user.Rating,
		&user.Blocked,
		&user.AvatarURL,
		&user.CreatedAt,
		&user.PasswordChangedAt,
	); err != nil {
		return nil, err
	}
	user.Role = normalizeUserRole(user.Role)

	return &user, nil
}

func (a *Application) getCredentialsByEmail(email string) (*userCredentials, error) {
	row := a.db.QueryRow(
		`select id, email, name, role, rating, is_blocked, avatar_url, password_hash, created_at, password_changed_at from users where email = $1 limit 1`,
		email,
	)

	var creds userCredentials
	if err := row.Scan(
		&creds.ID,
		&creds.Email,
		&creds.Name,
		&creds.Role,
		&creds.Rating,
		&creds.Blocked,
		&creds.AvatarURL,
		&creds.PasswordHash,
		&creds.CreatedAt,
		&creds.PasswordChangedAt,
	); err != nil {
		return nil, err
	}
	creds.Role = normalizeUserRole(creds.Role)

	return &creds, nil
}

func (a *Application) getCredentialsByUserID(userID int64) (*userCredentials, error) {
	row := a.db.QueryRow(
		`select id, email, name, role, rating, is_blocked, avatar_url, password_hash, created_at, password_changed_at
		from users
		where id = $1
		limit 1`,
		userID,
	)

	var creds userCredentials
	if err := row.Scan(
		&creds.ID,
		&creds.Email,
		&creds.Name,
		&creds.Role,
		&creds.Rating,
		&creds.Blocked,
		&creds.AvatarURL,
		&creds.PasswordHash,
		&creds.CreatedAt,
		&creds.PasswordChangedAt,
	); err != nil {
		return nil, err
	}
	creds.Role = normalizeUserRole(creds.Role)

	return &creds, nil
}

func (a *Application) updateUserAvatarByID(userID int64, avatarURL string) error {
	result, err := a.db.Exec(
		`update users
		set avatar_url = $2
		where id = $1`,
		userID,
		avatarURL,
	)
	if err != nil {
		return err
	}

	affected, err := result.RowsAffected()
	if err == nil && affected == 0 {
		return sql.ErrNoRows
	}

	return nil
}

func (a *Application) updateUserPasswordByID(userID int64, passwordHash string, changedAt time.Time) error {
	result, err := a.db.Exec(
		`update users
		set
			password_hash = $2,
			password_changed_at = $3
		where id = $1`,
		userID,
		passwordHash,
		changedAt,
	)
	if err != nil {
		return err
	}

	affected, err := result.RowsAffected()
	if err == nil && affected == 0 {
		return sql.ErrNoRows
	}

	return nil
}

func (a *Application) createSession(userID int64) (token string, expiresAt time.Time, err error) {
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
			u.role,
			u.rating,
			u.is_blocked,
			u.avatar_url,
			u.created_at,
			u.password_changed_at,
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
		&user.Role,
		&user.Rating,
		&user.Blocked,
		&user.AvatarURL,
		&user.CreatedAt,
		&user.PasswordChangedAt,
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
	user.Role = normalizeUserRole(user.Role)

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
	tx, err := a.db.Begin()
	if err != nil {
		return nil, err
	}
	defer tx.Rollback()

	row := tx.QueryRow(
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
	article, err := scanArticle(row)
	if err != nil {
		return nil, err
	}

	if _, err := tx.Exec(
		`update users
		set rating = rating + $2
		where id = $1`,
		authorID,
		articleCreateRatingXP,
	); err != nil {
		return nil, err
	}

	if err := tx.Commit(); err != nil {
		return nil, err
	}

	return article, nil
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

func (a *Application) getArticleLikeState(articleID int64, userID int64) (count int, liked bool, err error) {
	row := a.db.QueryRow(
		`select
			(select count(*) from article_likes where article_id = $1),
			exists(
				select 1
				from article_likes
				where article_id = $1 and user_id = $2
			)`,
		articleID,
		userID,
	)
	if err := row.Scan(&count, &liked); err != nil {
		return 0, false, err
	}
	return count, liked, nil
}

func (a *Application) setArticleLike(articleID int64, userID int64, shouldLike bool) (count int, liked bool, err error) {
	tx, err := a.db.Begin()
	if err != nil {
		return 0, false, err
	}
	defer tx.Rollback()

	var authorID int64
	if err := tx.QueryRow(
		`select author_id
		from articles
		where id = $1
		limit 1`,
		articleID,
	).Scan(&authorID); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return 0, false, sql.ErrNoRows
		}
		return 0, false, err
	}

	if authorID == userID {
		return 0, false, errArticleSelfLike
	}

	if shouldLike {
		result, err := tx.Exec(
			`insert into article_likes (article_id, user_id, created_at)
			values ($1, $2, $3)
			on conflict (article_id, user_id) do nothing`,
			articleID,
			userID,
			time.Now().UTC(),
		)
		if err != nil {
			return 0, false, err
		}
		if affected, affErr := result.RowsAffected(); affErr == nil && affected > 0 {
			if _, err := tx.Exec(
				`update users
				set rating = rating + $2
				where id = $1`,
				authorID,
				articleLikeRatingXP,
			); err != nil {
				return 0, false, err
			}
		}
		liked = true
	} else {
		result, err := tx.Exec(
			`delete from article_likes
			where article_id = $1 and user_id = $2`,
			articleID,
			userID,
		)
		if err != nil {
			return 0, false, err
		}
		if affected, affErr := result.RowsAffected(); affErr == nil && affected > 0 {
			if _, err := tx.Exec(
				`update users
				set rating = greatest(0, rating - $2)
				where id = $1`,
				authorID,
				articleLikeRatingXP,
			); err != nil {
				return 0, false, err
			}
		}
		liked = false
	}

	if err := tx.QueryRow(
		`select count(*) from article_likes where article_id = $1`,
		articleID,
	).Scan(&count); err != nil {
		return 0, false, err
	}

	if err := tx.Commit(); err != nil {
		return 0, false, err
	}

	return count, liked, nil
}

func (a *Application) deleteArticleByID(articleID int64) error {
	result, err := a.db.Exec(`delete from articles where id = $1`, articleID)
	if err != nil {
		return err
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if rowsAffected == 0 {
		return sql.ErrNoRows
	}

	return nil
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
	article, err := scanArticle(row)
	if err != nil {
		return nil, err
	}

	return article, nil
}

func (a *Application) updateArticleByID(articleID int64, _ int64, subsection string, title string, body string) (*Article, error) {
	now := time.Now().UTC()
	row := a.db.QueryRow(
		`update articles
		set
			subsection = $2,
			title = $3,
			body = $4,
			updated_at = $5
		where id = $1
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
		subsection,
		title,
		body,
		now,
	)
	article, err := scanArticle(row)
	if err != nil {
		return nil, err
	}

	return article, nil
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

func (a *Application) searchArticles(searchQuery string, sectionSlug string, subsection string, limit int) ([]Article, error) {
	if limit < 1 {
		limit = 1
	}

	normalizedQuery := strings.TrimSpace(searchQuery)
	if normalizedQuery == "" {
		return []Article{}, nil
	}

	const (
		tsVectorExpr = "to_tsvector('simple', coalesce(a.title, '') || ' ' || coalesce(a.body, ''))"
		tsQueryExpr  = "plainto_tsquery('simple', $1)"
	)

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
		where ` + tsVectorExpr + ` @@ ` + tsQueryExpr
	args := []any{normalizedQuery}

	if section := strings.TrimSpace(sectionSlug); section != "" {
		args = append(args, section)
		query += fmt.Sprintf(" and a.section_slug = $%d", len(args))
	}
	if sub := strings.TrimSpace(subsection); sub != "" {
		args = append(args, sub)
		query += fmt.Sprintf(" and a.subsection = $%d", len(args))
	}

	query += ` order by ts_rank_cd(` + tsVectorExpr + `, ` + tsQueryExpr + `) desc, a.updated_at desc`
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

func (a *Application) getArticleCountsBySection() (map[string]int, error) {
	rows, err := a.db.Query(
		`select section_slug, count(*)
		from articles
		group by section_slug`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := make(map[string]int)
	for rows.Next() {
		var sectionSlug string
		var count int
		if scanErr := rows.Scan(&sectionSlug, &count); scanErr != nil {
			return nil, scanErr
		}
		result[sectionSlug] = count
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

func (a *Application) getActiveRegistrationRequestByName(name string) (*registrationRequest, error) {
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
		where lower(name) = lower($1) and status in ($2, $3)
		order by created_at desc
		limit 1`,
		name,
		registrationStatusPending,
		registrationStatusApproved,
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

	rejectRequestBecauseNameTaken := func(requestID int64) error {
		_, updateErr := tx.Exec(
			`update registration_requests
			set
				status = $2,
				rejection_reason = $3,
				email_verify_token = null,
				updated_at = $4
			where id = $1`,
			requestID,
			registrationStatusRejected,
			registrationNameTakenReason,
			now,
		)
		return updateErr
	}

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
		`select id, email, name, role, rating, is_blocked, avatar_url, created_at, password_changed_at
		from users
		where email = $1
		limit 1`,
		req.Email,
	).Scan(
		&user.ID,
		&user.Email,
		&user.Name,
		&user.Role,
		&user.Rating,
		&user.Blocked,
		&user.AvatarURL,
		&user.CreatedAt,
		&user.PasswordChangedAt,
	)
	if err != nil {
		if !errors.Is(err, sql.ErrNoRows) {
			return nil, err
		}

		var existingNameUserID int64
		nameLookupErr := tx.QueryRow(
			`select id from users where lower(name) = lower($1) limit 1`,
			req.Name,
		).Scan(&existingNameUserID)
		if nameLookupErr == nil {
			if err := rejectRequestBecauseNameTaken(req.ID); err != nil {
				return nil, err
			}
			if commitErr := tx.Commit(); commitErr != nil {
				return nil, commitErr
			}
			return nil, errRegistrationNameTaken
		}
		if !errors.Is(nameLookupErr, sql.ErrNoRows) {
			return nil, nameLookupErr
		}

		err = tx.QueryRow(
			`insert into users (email, name, password_hash, role, created_at)
			 values ($1, $2, $3, $4, $5)
			 returning id, email, name, role, rating, is_blocked, avatar_url, created_at, password_changed_at`,
			req.Email,
			req.Name,
			req.PasswordHash,
			userRoleViewer,
			now,
		).Scan(
			&user.ID,
			&user.Email,
			&user.Name,
			&user.Role,
			&user.Rating,
			&user.Blocked,
			&user.AvatarURL,
			&user.CreatedAt,
			&user.PasswordChangedAt,
		)
		if err != nil {
			if isUniqueNameError(err) {
				if updateErr := rejectRequestBecauseNameTaken(req.ID); updateErr != nil {
					return nil, updateErr
				}
				if commitErr := tx.Commit(); commitErr != nil {
					return nil, commitErr
				}
				return nil, errRegistrationNameTaken
			}
			return nil, err
		}
	}
	user.Role = normalizeUserRole(user.Role)

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

func isUniqueNameError(err error) bool {
	if err == nil {
		return false
	}

	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		if pgErr.Code != "23505" {
			return false
		}

		constraint := strings.ToLower(pgErr.ConstraintName)
		if constraint == "idx_users_name_ci_unique" || constraint == "idx_registration_requests_name_active_unique" {
			return true
		}

		return strings.Contains(strings.ToLower(pgErr.Message), "name")
	}

	text := strings.ToLower(err.Error())
	return strings.Contains(text, "idx_users_name_ci_unique") ||
		strings.Contains(text, "idx_registration_requests_name_active_unique") ||
		(strings.Contains(text, "duplicate key") && strings.Contains(text, "name"))
}
