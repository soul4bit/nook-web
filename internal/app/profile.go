package app

import (
	"bytes"
	"context"
	"database/sql"
	"errors"
	"fmt"
	"io"
	"net/http"
	neturl "net/url"
	"strings"
	"time"

	"github.com/minio/minio-go/v7"
	"golang.org/x/crypto/bcrypt"
)

const (
	profilePasswordChangeInterval = 7 * 24 * time.Hour
	maxAvatarUploadBytes          = 5 << 20
	maxAvatarURLLength            = 900
)

func passwordChangeBlockedUntil(lastChanged sql.NullTime, now time.Time) (time.Time, bool) {
	if !lastChanged.Valid {
		return time.Time{}, false
	}

	base := lastChanged.Time.UTC()
	nextAllowedAt := base.Add(profilePasswordChangeInterval)
	return nextAllowedAt, now.UTC().Before(nextAllowedAt)
}

func formatProfileDateTime(value time.Time) string {
	if value.IsZero() {
		return ""
	}
	return value.Local().Format("02.01.2006 15:04")
}

func formatProfileWaitDuration(duration time.Duration) string {
	if duration <= 0 {
		return "меньше минуты"
	}
	if duration < time.Minute {
		return "меньше минуты"
	}

	totalMinutes := int(duration.Minutes())
	if duration%time.Minute != 0 {
		totalMinutes++
	}
	if totalMinutes < 1 {
		totalMinutes = 1
	}

	days := totalMinutes / (24 * 60)
	totalMinutes -= days * 24 * 60
	hours := totalMinutes / 60
	minutes := totalMinutes % 60

	parts := make([]string, 0, 3)
	if days > 0 {
		parts = append(parts, fmt.Sprintf("%d дн", days))
	}
	if hours > 0 {
		parts = append(parts, fmt.Sprintf("%d ч", hours))
	}
	if minutes > 0 {
		parts = append(parts, fmt.Sprintf("%d мин", minutes))
	}
	if len(parts) == 0 {
		return "меньше минуты"
	}

	return strings.Join(parts, " ")
}

func normalizeAvatarURL(raw string) (string, error) {
	value := strings.TrimSpace(raw)
	if value == "" {
		return "", nil
	}

	if len(value) > maxAvatarURLLength {
		return "", errors.New("avatar url is too long")
	}
	if strings.ContainsAny(value, "\r\n") {
		return "", errors.New("avatar url contains invalid characters")
	}

	parsed, err := neturl.Parse(value)
	if err != nil {
		return "", err
	}
	if parsed == nil || parsed.Scheme == "" || parsed.Host == "" {
		return "", errors.New("avatar url must be absolute")
	}

	switch strings.ToLower(strings.TrimSpace(parsed.Scheme)) {
	case "http", "https":
		return value, nil
	default:
		return "", errors.New("unsupported avatar url scheme")
	}
}

func profileRedirectWithSuccess(success string) string {
	message := strings.TrimSpace(success)
	if message == "" {
		return "/app/profile"
	}
	return "/app/profile?success=" + neturl.QueryEscape(message)
}

func (a *Application) profileViewData(user *User, title string) viewData {
	data := a.appViewData(user, title)
	data.CurrentPage = "profile"
	data.ProfileAvatarURL = strings.TrimSpace(user.AvatarURL)
	data.ProfileRoleLabel = roleLabel(user.Role)
	data.ProfilePasswordCanChange = true
	now := time.Now().UTC()

	if user.PasswordChangedAt.Valid {
		data.ProfilePasswordChangedAt = formatProfileDateTime(user.PasswordChangedAt.Time)

		nextAllowedAt, blocked := passwordChangeBlockedUntil(user.PasswordChangedAt, now)
		if blocked {
			data.ProfilePasswordCanChange = false
			data.ProfilePasswordNextChangeAt = formatProfileDateTime(nextAllowedAt)
			data.ProfilePasswordWait = formatProfileWaitDuration(nextAllowedAt.Sub(now))
		}
	}

	return data
}

func (a *Application) renderProfileWithError(w http.ResponseWriter, r *http.Request, user *User, message string, avatarInput string) {
	data := a.profileViewData(user, "Профиль")
	data.Error = strings.TrimSpace(message)

	if avatarInput != "" || strings.TrimSpace(user.AvatarURL) == "" {
		data.ProfileAvatarURL = strings.TrimSpace(avatarInput)
	}

	a.renderTemplate(w, r, "profile.tmpl", data)
}

func (a *Application) handleProfile(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	user := userFromContext(r.Context())
	if user == nil {
		http.Redirect(w, r, "/auth/login", http.StatusSeeOther)
		return
	}

	data := a.profileViewData(user, "Профиль")
	data.Success = strings.TrimSpace(r.URL.Query().Get("success"))
	data.Error = strings.TrimSpace(r.URL.Query().Get("error"))
	a.renderTemplate(w, r, "profile.tmpl", data)
}

func (a *Application) handleProfileAvatarUpdate(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	user := userFromContext(r.Context())
	if user == nil {
		http.Redirect(w, r, "/auth/login", http.StatusSeeOther)
		return
	}

	if err := r.ParseForm(); err != nil {
		a.renderProfileWithError(w, r, user, "Не удалось прочитать форму обновления аватара.", strings.TrimSpace(r.FormValue("avatar_url")))
		return
	}

	rawAvatarURL := strings.TrimSpace(r.FormValue("avatar_url"))
	avatarURL, err := normalizeAvatarURL(rawAvatarURL)
	if err != nil {
		a.renderProfileWithError(w, r, user, "Введите корректный URL аватара (http/https) или оставьте поле пустым, чтобы удалить аватар.", rawAvatarURL)
		return
	}

	if err := a.updateUserAvatarByID(user.ID, avatarURL); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			a.clearSessionCookie(w)
			http.Redirect(w, r, "/auth/login", http.StatusSeeOther)
			return
		}
		a.logger.Printf("update user avatar: %v", err)
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}

	success := "Аватар обновлен."
	if avatarURL == "" {
		success = "Аватар удален."
	}

	http.Redirect(w, r, profileRedirectWithSuccess(success), http.StatusSeeOther)
}

func (a *Application) handleProfileAvatarUpload(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	user := userFromContext(r.Context())
	if user == nil {
		http.Redirect(w, r, "/auth/login", http.StatusSeeOther)
		return
	}

	if a.objectStorage == nil || a.objectStorage.client == nil {
		a.renderProfileWithError(w, r, user, "Загрузка файла недоступна: S3-хранилище не настроено.", strings.TrimSpace(user.AvatarURL))
		return
	}

	r.Body = http.MaxBytesReader(w, r.Body, maxAvatarUploadBytes+maxMultipartOverhead)
	if err := r.ParseMultipartForm(maxAvatarUploadBytes + maxMultipartOverhead); err != nil {
		var maxBytesErr *http.MaxBytesError
		if errors.As(err, &maxBytesErr) {
			a.renderProfileWithError(w, r, user, "Файл слишком большой. Максимальный размер: 5 МБ.", strings.TrimSpace(user.AvatarURL))
			return
		}
		a.renderProfileWithError(w, r, user, "Не удалось разобрать форму загрузки файла.", strings.TrimSpace(user.AvatarURL))
		return
	}
	if r.MultipartForm != nil {
		defer r.MultipartForm.RemoveAll()
	}

	file, header, err := r.FormFile("avatar_file")
	if err != nil {
		a.renderProfileWithError(w, r, user, "Выберите изображение для загрузки.", strings.TrimSpace(user.AvatarURL))
		return
	}
	defer file.Close()

	if header != nil && header.Size > maxAvatarUploadBytes {
		a.renderProfileWithError(w, r, user, "Файл слишком большой. Максимальный размер: 5 МБ.", strings.TrimSpace(user.AvatarURL))
		return
	}

	payload, err := io.ReadAll(io.LimitReader(file, maxAvatarUploadBytes+1))
	if err != nil {
		a.renderProfileWithError(w, r, user, "Не удалось прочитать файл аватара.", strings.TrimSpace(user.AvatarURL))
		return
	}
	if len(payload) == 0 {
		a.renderProfileWithError(w, r, user, "Файл пустой. Выберите изображение.", strings.TrimSpace(user.AvatarURL))
		return
	}
	if len(payload) > maxAvatarUploadBytes {
		a.renderProfileWithError(w, r, user, "Файл слишком большой. Максимальный размер: 5 МБ.", strings.TrimSpace(user.AvatarURL))
		return
	}

	sniffLen := len(payload)
	if sniffLen > 512 {
		sniffLen = 512
	}
	contentType := http.DetectContentType(payload[:sniffLen])
	ext, allowed := allowedImageMIMEs[contentType]
	if !allowed {
		a.renderProfileWithError(w, r, user, "Поддерживаются только JPG, PNG, GIF и WEBP.", strings.TrimSpace(user.AvatarURL))
		return
	}

	objectToken, err := generateSessionToken()
	if err != nil {
		a.logger.Printf("generate avatar object token: %v", err)
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}

	objectKey := fmt.Sprintf(
		"avatars/%s/user-%d-%s%s",
		time.Now().UTC().Format("2006/01/02"),
		user.ID,
		strings.TrimSpace(objectToken),
		ext,
	)

	ctx, cancel := context.WithTimeout(r.Context(), uploadPutTimeout)
	defer cancel()

	_, err = a.objectStorage.client.PutObject(
		ctx,
		a.objectStorage.bucket,
		objectKey,
		bytes.NewReader(payload),
		int64(len(payload)),
		minio.PutObjectOptions{ContentType: contentType},
	)
	if err != nil {
		a.logger.Printf("upload avatar to s3: %v", err)
		a.renderProfileWithError(w, r, user, "Не удалось загрузить изображение в хранилище.", strings.TrimSpace(user.AvatarURL))
		return
	}

	avatarURL := a.objectStorage.publicObjectURL(objectKey)
	if err := a.updateUserAvatarByID(user.ID, avatarURL); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			a.clearSessionCookie(w)
			http.Redirect(w, r, "/auth/login", http.StatusSeeOther)
			return
		}
		a.logger.Printf("update avatar URL after upload: %v", err)
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}

	http.Redirect(w, r, profileRedirectWithSuccess("Аватар обновлен."), http.StatusSeeOther)
}

func (a *Application) handleProfilePasswordUpdate(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	user := userFromContext(r.Context())
	if user == nil {
		http.Redirect(w, r, "/auth/login", http.StatusSeeOther)
		return
	}

	if err := r.ParseForm(); err != nil {
		a.renderProfileWithError(w, r, user, "Не удалось прочитать форму смены пароля.", strings.TrimSpace(user.AvatarURL))
		return
	}

	currentPassword := r.FormValue("current_password")
	newPassword := r.FormValue("new_password")
	confirmPassword := r.FormValue("confirm_password")

	creds, err := a.getCredentialsByUserID(user.ID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			a.clearSessionCookie(w)
			http.Redirect(w, r, "/auth/login", http.StatusSeeOther)
			return
		}
		a.logger.Printf("get credentials by user id for profile password change: %v", err)
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}

	if currentPassword == "" || newPassword == "" || confirmPassword == "" {
		a.renderProfileWithError(w, r, user, "Заполните все поля для смены пароля.", strings.TrimSpace(user.AvatarURL))
		return
	}

	nextAllowedAt, blocked := passwordChangeBlockedUntil(creds.PasswordChangedAt, time.Now().UTC())
	if blocked {
		waitFor := formatProfileWaitDuration(nextAllowedAt.Sub(time.Now().UTC()))
		a.renderProfileWithError(
			w,
			r,
			user,
			fmt.Sprintf("Пароль можно менять не чаще 1 раза в 7 дней. Следующая смена доступна после %s (осталось: %s).", formatProfileDateTime(nextAllowedAt), waitFor),
			strings.TrimSpace(user.AvatarURL),
		)
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(creds.PasswordHash), []byte(currentPassword)); err != nil {
		a.renderProfileWithError(w, r, user, "Текущий пароль введен неверно.", strings.TrimSpace(user.AvatarURL))
		return
	}

	if len(newPassword) < 10 {
		a.renderProfileWithError(w, r, user, "Новый пароль должен быть не короче 10 символов.", strings.TrimSpace(user.AvatarURL))
		return
	}
	if newPassword == currentPassword {
		a.renderProfileWithError(w, r, user, "Новый пароль должен отличаться от текущего.", strings.TrimSpace(user.AvatarURL))
		return
	}
	if newPassword != confirmPassword {
		a.renderProfileWithError(w, r, user, "Новый пароль и подтверждение не совпадают.", strings.TrimSpace(user.AvatarURL))
		return
	}

	passwordHash, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		a.logger.Printf("hash new profile password: %v", err)
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}

	changedAt := time.Now().UTC()
	if err := a.updateUserPasswordByID(user.ID, string(passwordHash), changedAt); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			a.clearSessionCookie(w)
			http.Redirect(w, r, "/auth/login", http.StatusSeeOther)
			return
		}
		a.logger.Printf("update profile password: %v", err)
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}

	http.Redirect(w, r, profileRedirectWithSuccess("Пароль обновлен. Следующая смена будет доступна через 7 дней."), http.StatusSeeOther)
}
