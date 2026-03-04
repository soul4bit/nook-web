package app

import (
	"database/sql"
	"errors"
	"strings"
	"time"
)

func (a *Application) createUser(name string, email string, passwordHash string) (*User, error) {
	nowUnix := time.Now().UTC().Unix()

	result, err := a.db.Exec(
		`insert into users (email, name, password_hash, created_at) values (?, ?, ?, ?)`,
		email,
		name,
		passwordHash,
		nowUnix,
	)
	if err != nil {
		return nil, err
	}

	userID, err := result.LastInsertId()
	if err != nil {
		return nil, err
	}

	return a.getUserByID(userID)
}

func (a *Application) getUserByID(userID int64) (*User, error) {
	row := a.db.QueryRow(
		`select id, email, name, created_at from users where id = ? limit 1`,
		userID,
	)

	var user User
	var createdAtUnix int64
	if err := row.Scan(&user.ID, &user.Email, &user.Name, &createdAtUnix); err != nil {
		return nil, err
	}

	user.CreatedAt = time.Unix(createdAtUnix, 0).UTC()
	return &user, nil
}

func (a *Application) getCredentialsByEmail(email string) (*userCredentials, error) {
	row := a.db.QueryRow(
		`select id, email, name, password_hash, created_at from users where email = ? limit 1`,
		email,
	)

	var creds userCredentials
	var createdAtUnix int64
	if err := row.Scan(
		&creds.ID,
		&creds.Email,
		&creds.Name,
		&creds.PasswordHash,
		&createdAtUnix,
	); err != nil {
		return nil, err
	}

	creds.CreatedAt = time.Unix(createdAtUnix, 0).UTC()
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
		`insert into sessions (user_id, token_hash, created_at, expires_at) values (?, ?, ?, ?)`,
		userID,
		tokenHash,
		now.Unix(),
		expiresAt.Unix(),
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
		where s.token_hash = ?
		limit 1`,
		tokenHash,
	)

	var user User
	var userCreatedAtUnix int64
	var expiresAtUnix int64
	err := row.Scan(
		&user.ID,
		&user.Email,
		&user.Name,
		&userCreatedAtUnix,
		&expiresAtUnix,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, nil
		}
		return nil, err
	}

	if expiresAtUnix <= time.Now().UTC().Unix() {
		if delErr := a.deleteSessionByToken(token); delErr != nil {
			a.logger.Printf("delete expired session: %v", delErr)
		}
		return nil, nil
	}

	user.CreatedAt = time.Unix(userCreatedAtUnix, 0).UTC()
	return &user, nil
}

func (a *Application) deleteSessionByToken(token string) error {
	tokenHash := hashSessionToken(token)
	_, err := a.db.Exec(`delete from sessions where token_hash = ?`, tokenHash)
	return err
}

func (a *Application) cleanupExpiredSessions() error {
	_, err := a.db.Exec(
		`delete from sessions where expires_at <= ?`,
		time.Now().UTC().Unix(),
	)
	return err
}

func isUniqueEmailError(err error) bool {
	if err == nil {
		return false
	}

	text := strings.ToLower(err.Error())
	return strings.Contains(text, "unique") && strings.Contains(text, "users.email")
}
