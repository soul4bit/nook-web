package app

import (
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"
)

type adminUserListItem struct {
	ID            int64
	Email         string
	Name          string
	Role          string
	RoleLabel     string
	Blocked       bool
	CreatedAt     time.Time
	ArticlesCount int
}

type registrationRequestListItem struct {
	ID        int64
	Email     string
	Name      string
	CreatedAt time.Time
}

const (
	adminTabCatalog = "catalog"
	adminTabUsers   = "users"
	adminTabAudit   = "audit"
)

type adminJSONResponse struct {
	OK    bool   `json:"ok"`
	Error string `json:"error,omitempty"`
}

func normalizeAdminTab(raw string) string {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case adminTabCatalog:
		return adminTabCatalog
	case adminTabAudit:
		return adminTabAudit
	default:
		return adminTabUsers
	}
}

func parsePositiveID(raw string) (int64, error) {
	value, err := strconv.ParseInt(strings.TrimSpace(raw), 10, 64)
	if err != nil || value < 1 {
		return 0, errors.New("invalid id")
	}
	return value, nil
}

func selectedRole(raw string) (string, error) {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case userRoleViewer:
		return userRoleViewer, nil
	case userRoleEditor:
		return userRoleEditor, nil
	case userRoleAdmin:
		return userRoleAdmin, nil
	default:
		return "", errors.New("invalid role")
	}
}

func adminUsersRedirectURLForTab(tab string, success string, failure string) string {
	resolvedTab := normalizeAdminTab(tab)
	query := url.Values{}
	query.Set("tab", resolvedTab)
	if strings.TrimSpace(success) != "" {
		query.Set("success", strings.TrimSpace(success))
	}
	if strings.TrimSpace(failure) != "" {
		query.Set("error", strings.TrimSpace(failure))
	}

	target := "/app/admin/users"
	if encoded := query.Encode(); encoded != "" {
		target += "?" + encoded
	}
	return target
}

func adminUsersRedirectURL(success string, failure string) string {
	return adminUsersRedirectURLForTab(adminTabUsers, success, failure)
}

func writeAdminJSON(w http.ResponseWriter, status int, payload adminJSONResponse) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

func wantsJSONResponse(r *http.Request) bool {
	if r == nil {
		return false
	}

	if strings.EqualFold(strings.TrimSpace(r.Header.Get("X-Requested-With")), "fetch") {
		return true
	}

	accept := strings.ToLower(strings.TrimSpace(r.Header.Get("Accept")))
	return strings.Contains(accept, "application/json")
}

func parseSectionOrder(raw string) []string {
	clean := strings.TrimSpace(raw)
	if clean == "" {
		return nil
	}

	parts := strings.Split(clean, ",")
	result := make([]string, 0, len(parts))
	seen := make(map[string]struct{}, len(parts))
	for _, part := range parts {
		slug := normalizeWikiSectionSlug(part)
		if slug == "" {
			continue
		}
		if _, exists := seen[slug]; exists {
			continue
		}
		seen[slug] = struct{}{}
		result = append(result, slug)
	}
	return result
}

func (a *Application) requireAdmin(w http.ResponseWriter, r *http.Request) *User {
	user := userFromContext(r.Context())
	if user == nil {
		http.Redirect(w, r, "/auth/login", http.StatusSeeOther)
		return nil
	}
	if !user.IsAdmin() {
		http.Error(w, "forbidden", http.StatusForbidden)
		return nil
	}
	return user
}

func (a *Application) listUsersForAdmin() ([]adminUserListItem, error) {
	rows, err := a.db.Query(
		`select
			u.id,
			u.email,
			u.name,
			u.role,
			u.is_blocked,
			u.created_at,
			count(ar.id) as articles_count
		from users u
		left join articles ar on ar.author_id = u.id
		group by u.id
		order by
			case
				when u.role = 'admin' then 0
				when u.role = 'editor' then 1
				else 2
			end,
			u.created_at asc`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := make([]adminUserListItem, 0)
	for rows.Next() {
		var item adminUserListItem
		if err := rows.Scan(
			&item.ID,
			&item.Email,
			&item.Name,
			&item.Role,
			&item.Blocked,
			&item.CreatedAt,
			&item.ArticlesCount,
		); err != nil {
			return nil, err
		}
		item.Role = normalizeUserRole(item.Role)
		item.RoleLabel = roleLabel(item.Role)
		result = append(result, item)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return result, nil
}

func (a *Application) listPendingRegistrationRequests() ([]registrationRequestListItem, error) {
	rows, err := a.db.Query(
		`select id, email, name, created_at
		from registration_requests
		where status = $1
		order by created_at asc`,
		registrationStatusPending,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := make([]registrationRequestListItem, 0)
	for rows.Next() {
		var item registrationRequestListItem
		if err := rows.Scan(&item.ID, &item.Email, &item.Name, &item.CreatedAt); err != nil {
			return nil, err
		}
		result = append(result, item)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return result, nil
}

func (a *Application) approveRegistrationRequestByID(requestID int64, emailVerifyToken string) (*registrationRequest, error) {
	now := time.Now().UTC()
	row := a.db.QueryRow(
		`update registration_requests
		set
			status = $2,
			email_verify_token = $3,
			rejection_reason = null,
			moderated_at = $4,
			updated_at = $4
		where id = $1 and status = $5
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
		requestID,
		registrationStatusApproved,
		emailVerifyToken,
		now,
		registrationStatusPending,
	)
	return scanRegistrationRequest(row)
}

func (a *Application) rollbackApprovedRegistrationRequestByID(requestID int64, emailVerifyToken string) (bool, error) {
	now := time.Now().UTC()
	result, err := a.db.Exec(
		`update registration_requests
		set
			status = $2,
			email_verify_token = null,
			rejection_reason = null,
			moderated_at = null,
			updated_at = $3
		where id = $1 and status = $4 and email_verify_token = $5 and email_verified_at is null`,
		requestID,
		registrationStatusPending,
		now,
		registrationStatusApproved,
		emailVerifyToken,
	)
	if err != nil {
		return false, err
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return false, err
	}

	return rowsAffected > 0, nil
}

func (a *Application) rejectRegistrationRequestByID(requestID int64, reason string) (*registrationRequest, error) {
	now := time.Now().UTC()
	row := a.db.QueryRow(
		`update registration_requests
		set
			status = $2,
			rejection_reason = $3,
			email_verify_token = null,
			moderated_at = $4,
			updated_at = $4
		where id = $1 and status = $5
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
		requestID,
		registrationStatusRejected,
		reason,
		now,
		registrationStatusPending,
	)
	return scanRegistrationRequest(row)
}

func (a *Application) updateUserRoleByID(userID int64, role string) (*User, error) {
	row := a.db.QueryRow(
		`update users
		set role = $2
		where id = $1
		returning id, email, name, role, rating, is_blocked, avatar_url, created_at, password_changed_at`,
		userID,
		role,
	)

	var user User
	if err := row.Scan(&user.ID, &user.Email, &user.Name, &user.Role, &user.Rating, &user.Blocked, &user.AvatarURL, &user.CreatedAt, &user.PasswordChangedAt); err != nil {
		return nil, err
	}
	user.Role = normalizeUserRole(user.Role)
	return &user, nil
}

func (a *Application) updateUserBlockedStateByID(userID int64, blocked bool) (*User, error) {
	row := a.db.QueryRow(
		`update users
		set is_blocked = $2
		where id = $1
		returning id, email, name, role, rating, is_blocked, avatar_url, created_at, password_changed_at`,
		userID,
		blocked,
	)

	var user User
	if err := row.Scan(&user.ID, &user.Email, &user.Name, &user.Role, &user.Rating, &user.Blocked, &user.AvatarURL, &user.CreatedAt, &user.PasswordChangedAt); err != nil {
		return nil, err
	}
	user.Role = normalizeUserRole(user.Role)
	return &user, nil
}

func (a *Application) deleteSessionsByUserID(userID int64) error {
	_, err := a.db.Exec(`delete from sessions where user_id = $1`, userID)
	return err
}

func (a *Application) deleteUserAndRegistrationByID(userID int64, email string) error {
	tx, err := a.db.Begin()
	if err != nil {
		return err
	}
	defer func() {
		_ = tx.Rollback()
	}()

	result, err := tx.Exec(`delete from users where id = $1`, userID)
	if err != nil {
		return err
	}
	affected, err := result.RowsAffected()
	if err != nil {
		return err
	}
	if affected == 0 {
		return sql.ErrNoRows
	}

	if _, err := tx.Exec(`delete from registration_requests where email = $1`, normalizeEmail(email)); err != nil {
		return err
	}

	return tx.Commit()
}

func (a *Application) countAdminUsers() (int, error) {
	row := a.db.QueryRow(`select count(*) from users where role = $1`, userRoleAdmin)
	var total int
	if err := row.Scan(&total); err != nil {
		return 0, err
	}
	return total, nil
}

func (a *Application) countActiveAdminUsers() (int, error) {
	row := a.db.QueryRow(`select count(*) from users where role = $1 and is_blocked = false`, userRoleAdmin)
	var total int
	if err := row.Scan(&total); err != nil {
		return 0, err
	}
	return total, nil
}

func (a *Application) handleAdminUsers(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	user := a.requireAdmin(w, r)
	if user == nil {
		return
	}

	data := a.appViewData(user, "Админка")
	data.CurrentPage = "admin-users"
	data.AdminTab = normalizeAdminTab(r.URL.Query().Get("tab"))
	data.Success = strings.TrimSpace(r.URL.Query().Get("success"))
	data.Error = strings.TrimSpace(r.URL.Query().Get("error"))
	data.AvailableRoles = allRoleOptions()

	switch data.AdminTab {
	case adminTabUsers:
		users, err := a.listUsersForAdmin()
		if err != nil {
			a.logger.Printf("admin list users: %v", err)
			http.Error(w, "internal server error", http.StatusInternalServerError)
			return
		}
		data.AdminUsers = users

		requests, err := a.listPendingRegistrationRequests()
		if err != nil {
			a.logger.Printf("admin list pending requests: %v", err)
			http.Error(w, "internal server error", http.StatusInternalServerError)
			return
		}
		data.PendingRequests = requests
	case adminTabAudit:
		auditEntries, err := a.listAdminAuditEntries(40)
		if err != nil {
			a.logger.Printf("admin list audit entries: %v", err)
		} else {
			data.AdminAuditEntries = auditEntries
		}
	}

	a.renderTemplate(w, r, "admin_users.tmpl", data)
}

func (a *Application) handleAdminApproveRegistration(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	if a.requireAdmin(w, r) == nil {
		return
	}

	if err := r.ParseForm(); err != nil {
		http.Error(w, "invalid form data", http.StatusBadRequest)
		return
	}

	requestID, err := parsePositiveID(r.FormValue("request_id"))
	if err != nil {
		http.Redirect(w, r, adminUsersRedirectURL("", "Некорректный ID заявки."), http.StatusSeeOther)
		return
	}

	emailVerifyToken, err := generateSessionToken()
	if err != nil {
		a.logger.Printf("generate email verify token for admin panel: %v", err)
		http.Redirect(w, r, adminUsersRedirectURL("", "Не удалось обработать заявку."), http.StatusSeeOther)
		return
	}

	req, err := a.approveRegistrationRequestByID(requestID, emailVerifyToken)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			http.Redirect(w, r, adminUsersRedirectURL("", "Заявка не найдена или уже обработана."), http.StatusSeeOther)
			return
		}
		a.logger.Printf("admin approve registration by id: %v", err)
		http.Redirect(w, r, adminUsersRedirectURL("", "Не удалось одобрить заявку."), http.StatusSeeOther)
		return
	}

	if err := a.sendRegistrationApprovedEmail(req); err != nil {
		a.logger.Printf("admin send approved email: %v", err)

		rolledBack, rollbackErr := a.rollbackApprovedRegistrationRequestByID(requestID, emailVerifyToken)
		if rollbackErr != nil {
			a.logger.Printf("admin rollback approved registration request: %v", rollbackErr)
		}

		failureMessage := "Заявка одобрена, но письмо отправить не удалось."
		if rollbackErr != nil {
			failureMessage = "Заявка одобрена, но письмо не отправлено. Откат в pending не удался, проверьте вручную."
		} else if rolledBack {
			failureMessage = "Письмо не отправлено. Статус заявки возвращен в pending, попробуйте снова."
		}

		http.Redirect(w, r, adminUsersRedirectURL("", failureMessage), http.StatusSeeOther)
		return
	}

	success := fmt.Sprintf("Заявка для %s одобрена.", req.Email)
	http.Redirect(w, r, adminUsersRedirectURL(success, ""), http.StatusSeeOther)
}

func (a *Application) handleAdminRejectRegistration(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	if a.requireAdmin(w, r) == nil {
		return
	}

	if err := r.ParseForm(); err != nil {
		http.Error(w, "invalid form data", http.StatusBadRequest)
		return
	}

	requestID, err := parsePositiveID(r.FormValue("request_id"))
	if err != nil {
		http.Redirect(w, r, adminUsersRedirectURL("", "Некорректный ID заявки."), http.StatusSeeOther)
		return
	}

	reason := strings.TrimSpace(r.FormValue("reason"))
	if reason == "" {
		reason = defaultAdminRejectReason
	}

	req, err := a.rejectRegistrationRequestByID(requestID, reason)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			http.Redirect(w, r, adminUsersRedirectURL("", "Заявка не найдена или уже обработана."), http.StatusSeeOther)
			return
		}
		a.logger.Printf("admin reject registration by id: %v", err)
		http.Redirect(w, r, adminUsersRedirectURL("", "Не удалось отклонить заявку."), http.StatusSeeOther)
		return
	}

	if err := a.sendRegistrationRejectedEmail(req, reason); err != nil {
		a.logger.Printf("admin send rejected email: %v", err)
		http.Redirect(w, r, adminUsersRedirectURL("", "Заявка отклонена, но письмо отправить не удалось."), http.StatusSeeOther)
		return
	}

	success := fmt.Sprintf("Заявка для %s отклонена.", req.Email)
	http.Redirect(w, r, adminUsersRedirectURL(success, ""), http.StatusSeeOther)
}

func (a *Application) handleAdminAddWikiSection(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	if a.requireAdmin(w, r) == nil {
		return
	}

	if err := r.ParseForm(); err != nil {
		http.Error(w, "invalid form data", http.StatusBadRequest)
		return
	}

	name := strings.TrimSpace(r.FormValue("name"))
	slug := normalizeWikiSectionSlug(r.FormValue("slug"))
	if utf8.RuneCountInString(name) < 2 || utf8.RuneCountInString(name) > 80 {
		http.Redirect(w, r, adminUsersRedirectURLForTab(adminTabCatalog, "", "Название раздела: от 2 до 80 символов."), http.StatusSeeOther)
		return
	}
	if !isValidWikiSectionSlug(slug) {
		http.Redirect(w, r, adminUsersRedirectURLForTab(adminTabCatalog, "", "Slug должен быть в формате `devops-runbooks` (латиница, цифры, дефисы)."), http.StatusSeeOther)
		return
	}

	if err := a.createWikiSection(slug, name); err != nil {
		if isWikiSectionDuplicateError(err) {
			http.Redirect(w, r, adminUsersRedirectURLForTab(adminTabCatalog, "", "Раздел с таким slug или названием уже существует."), http.StatusSeeOther)
			return
		}
		a.logger.Printf("admin create wiki section: %v", err)
		http.Redirect(w, r, adminUsersRedirectURLForTab(adminTabCatalog, "", "Не удалось добавить раздел."), http.StatusSeeOther)
		return
	}

	http.Redirect(w, r, adminUsersRedirectURLForTab(adminTabCatalog, "Раздел добавлен.", ""), http.StatusSeeOther)
}

func (a *Application) handleAdminRenameWikiSection(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	if a.requireAdmin(w, r) == nil {
		return
	}

	if err := r.ParseForm(); err != nil {
		http.Error(w, "invalid form data", http.StatusBadRequest)
		return
	}

	sectionSlug := normalizeWikiSectionSlug(r.FormValue("section_slug"))
	newName := normalizeWikiSectionName(r.FormValue("new_name"))
	if !isValidWikiSectionSlug(sectionSlug) {
		http.Redirect(w, r, adminUsersRedirectURLForTab(adminTabCatalog, "", "Некорректный slug раздела."), http.StatusSeeOther)
		return
	}
	if utf8.RuneCountInString(newName) < 2 || utf8.RuneCountInString(newName) > 80 {
		http.Redirect(w, r, adminUsersRedirectURLForTab(adminTabCatalog, "", "Название раздела: от 2 до 80 символов."), http.StatusSeeOther)
		return
	}

	if err := a.renameWikiSection(sectionSlug, newName); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			http.Redirect(w, r, adminUsersRedirectURLForTab(adminTabCatalog, "", "Раздел не найден."), http.StatusSeeOther)
			return
		}
		if isWikiSectionDuplicateError(err) {
			http.Redirect(w, r, adminUsersRedirectURLForTab(adminTabCatalog, "", "Раздел с таким названием уже существует."), http.StatusSeeOther)
			return
		}

		a.logger.Printf("admin rename wiki section: %v", err)
		http.Redirect(w, r, adminUsersRedirectURLForTab(adminTabCatalog, "", "Не удалось переименовать раздел."), http.StatusSeeOther)
		return
	}

	http.Redirect(w, r, adminUsersRedirectURLForTab(adminTabCatalog, "Раздел переименован.", ""), http.StatusSeeOther)
}

func (a *Application) handleAdminReorderWikiSections(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	if a.requireAdmin(w, r) == nil {
		return
	}

	if err := r.ParseForm(); err != nil {
		if wantsJSONResponse(r) {
			writeAdminJSON(w, http.StatusBadRequest, adminJSONResponse{
				OK:    false,
				Error: "invalid form data",
			})
			return
		}

		http.Error(w, "invalid form data", http.StatusBadRequest)
		return
	}

	order := parseSectionOrder(r.FormValue("order"))
	if len(order) == 0 {
		if wantsJSONResponse(r) {
			writeAdminJSON(w, http.StatusBadRequest, adminJSONResponse{
				OK:    false,
				Error: "section order is empty",
			})
			return
		}

		http.Redirect(w, r, adminUsersRedirectURLForTab(adminTabCatalog, "", "Не удалось сохранить порядок разделов."), http.StatusSeeOther)
		return
	}

	if err := a.reorderWikiSections(order); err != nil {
		if wantsJSONResponse(r) {
			writeAdminJSON(w, http.StatusBadRequest, adminJSONResponse{
				OK:    false,
				Error: "failed to reorder sections",
			})
			return
		}

		a.logger.Printf("admin reorder wiki sections: %v", err)
		http.Redirect(w, r, adminUsersRedirectURLForTab(adminTabCatalog, "", "Не удалось сохранить порядок разделов."), http.StatusSeeOther)
		return
	}

	if wantsJSONResponse(r) {
		writeAdminJSON(w, http.StatusOK, adminJSONResponse{OK: true})
		return
	}

	http.Redirect(w, r, adminUsersRedirectURLForTab(adminTabCatalog, "Порядок разделов обновлен.", ""), http.StatusSeeOther)
}

func (a *Application) handleAdminAddWikiSubsection(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	if a.requireAdmin(w, r) == nil {
		return
	}

	if err := r.ParseForm(); err != nil {
		http.Error(w, "invalid form data", http.StatusBadRequest)
		return
	}

	sectionSlug := normalizeWikiSectionSlug(r.FormValue("section_slug"))
	title := strings.TrimSpace(r.FormValue("title"))
	if !isValidWikiSectionSlug(sectionSlug) {
		http.Redirect(w, r, adminUsersRedirectURLForTab(adminTabCatalog, "", "Выберите корректный раздел."), http.StatusSeeOther)
		return
	}
	if utf8.RuneCountInString(title) < 2 || utf8.RuneCountInString(title) > 120 {
		http.Redirect(w, r, adminUsersRedirectURLForTab(adminTabCatalog, "", "Название подраздела: от 2 до 120 символов."), http.StatusSeeOther)
		return
	}

	if err := a.createWikiSubsection(sectionSlug, title); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			http.Redirect(w, r, adminUsersRedirectURLForTab(adminTabCatalog, "", "Раздел не найден."), http.StatusSeeOther)
			return
		}
		if isWikiSubsectionDuplicateError(err) {
			http.Redirect(w, r, adminUsersRedirectURLForTab(adminTabCatalog, "", "Такой подраздел уже есть в выбранном разделе."), http.StatusSeeOther)
			return
		}
		a.logger.Printf("admin create wiki subsection: %v", err)
		http.Redirect(w, r, adminUsersRedirectURLForTab(adminTabCatalog, "", "Не удалось добавить подраздел."), http.StatusSeeOther)
		return
	}

	http.Redirect(w, r, adminUsersRedirectURLForTab(adminTabCatalog, "Подраздел добавлен.", ""), http.StatusSeeOther)
}

func (a *Application) handleAdminDeleteWikiSection(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	if a.requireAdmin(w, r) == nil {
		return
	}

	if err := r.ParseForm(); err != nil {
		http.Error(w, "invalid form data", http.StatusBadRequest)
		return
	}

	sectionSlug := normalizeWikiSectionSlug(r.FormValue("section_slug"))
	if !isValidWikiSectionSlug(sectionSlug) {
		http.Redirect(w, r, adminUsersRedirectURLForTab(adminTabCatalog, "", "Некорректный slug раздела."), http.StatusSeeOther)
		return
	}

	if err := a.deleteWikiSection(sectionSlug); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			http.Redirect(w, r, adminUsersRedirectURLForTab(adminTabCatalog, "", "Раздел не найден."), http.StatusSeeOther)
			return
		}
		if count, hasArticles := isWikiSectionHasArticlesError(err); hasArticles {
			http.Redirect(
				w,
				r,
				adminUsersRedirectURLForTab(adminTabCatalog, "", fmt.Sprintf("Нельзя удалить раздел: в нем %d статей.", count)),
				http.StatusSeeOther,
			)
			return
		}
		if isWikiLastSectionDeleteError(err) {
			http.Redirect(w, r, adminUsersRedirectURLForTab(adminTabCatalog, "", "Нельзя удалить последний раздел."), http.StatusSeeOther)
			return
		}

		a.logger.Printf("admin delete wiki section: %v", err)
		http.Redirect(w, r, adminUsersRedirectURLForTab(adminTabCatalog, "", "Не удалось удалить раздел."), http.StatusSeeOther)
		return
	}

	http.Redirect(w, r, adminUsersRedirectURLForTab(adminTabCatalog, "Раздел удален.", ""), http.StatusSeeOther)
}

func (a *Application) handleAdminRenameWikiSubsection(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	if a.requireAdmin(w, r) == nil {
		return
	}

	if err := r.ParseForm(); err != nil {
		http.Error(w, "invalid form data", http.StatusBadRequest)
		return
	}

	sectionSlug := normalizeWikiSectionSlug(r.FormValue("section_slug"))
	currentTitle := normalizeWikiSubsectionTitle(r.FormValue("subsection_title"))
	newTitle := normalizeWikiSubsectionTitle(r.FormValue("new_title"))
	if !isValidWikiSectionSlug(sectionSlug) {
		http.Redirect(w, r, adminUsersRedirectURLForTab(adminTabCatalog, "", "Некорректный slug раздела."), http.StatusSeeOther)
		return
	}
	if utf8.RuneCountInString(currentTitle) < 2 || utf8.RuneCountInString(currentTitle) > 120 {
		http.Redirect(w, r, adminUsersRedirectURLForTab(adminTabCatalog, "", "Некорректное текущее название подраздела."), http.StatusSeeOther)
		return
	}
	if utf8.RuneCountInString(newTitle) < 2 || utf8.RuneCountInString(newTitle) > 120 {
		http.Redirect(w, r, adminUsersRedirectURLForTab(adminTabCatalog, "", "Новое название подраздела: от 2 до 120 символов."), http.StatusSeeOther)
		return
	}

	if err := a.renameWikiSubsection(sectionSlug, currentTitle, newTitle); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			http.Redirect(w, r, adminUsersRedirectURLForTab(adminTabCatalog, "", "Раздел или подраздел не найден."), http.StatusSeeOther)
			return
		}
		if isWikiSubsectionDuplicateError(err) {
			http.Redirect(w, r, adminUsersRedirectURLForTab(adminTabCatalog, "", "В этом разделе уже есть подраздел с таким названием."), http.StatusSeeOther)
			return
		}

		a.logger.Printf("admin rename wiki subsection: %v", err)
		http.Redirect(w, r, adminUsersRedirectURLForTab(adminTabCatalog, "", "Не удалось переименовать подраздел."), http.StatusSeeOther)
		return
	}

	http.Redirect(w, r, adminUsersRedirectURLForTab(adminTabCatalog, "Подраздел переименован.", ""), http.StatusSeeOther)
}

func (a *Application) handleAdminMoveWikiSubsection(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	if a.requireAdmin(w, r) == nil {
		return
	}

	if err := r.ParseForm(); err != nil {
		http.Error(w, "invalid form data", http.StatusBadRequest)
		return
	}

	sectionSlug := normalizeWikiSectionSlug(r.FormValue("section_slug"))
	subsectionTitle := normalizeWikiSubsectionTitle(r.FormValue("subsection_title"))
	direction := normalizeMoveDirection(r.FormValue("direction"))
	if !isValidWikiSectionSlug(sectionSlug) {
		http.Redirect(w, r, adminUsersRedirectURLForTab(adminTabCatalog, "", "Некорректный slug раздела."), http.StatusSeeOther)
		return
	}
	if utf8.RuneCountInString(subsectionTitle) < 2 || utf8.RuneCountInString(subsectionTitle) > 120 {
		http.Redirect(w, r, adminUsersRedirectURLForTab(adminTabCatalog, "", "Некорректное название подраздела."), http.StatusSeeOther)
		return
	}
	if direction == "" {
		http.Redirect(w, r, adminUsersRedirectURLForTab(adminTabCatalog, "", "Некорректное направление перемещения."), http.StatusSeeOther)
		return
	}

	if err := a.moveWikiSubsection(sectionSlug, subsectionTitle, direction); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			http.Redirect(w, r, adminUsersRedirectURLForTab(adminTabCatalog, "", "Раздел или подраздел не найден."), http.StatusSeeOther)
			return
		}
		if isWikiSubsectionMoveEdgeError(err, "up") {
			http.Redirect(w, r, adminUsersRedirectURLForTab(adminTabCatalog, "", "Подраздел уже на первом месте."), http.StatusSeeOther)
			return
		}
		if isWikiSubsectionMoveEdgeError(err, "down") {
			http.Redirect(w, r, adminUsersRedirectURLForTab(adminTabCatalog, "", "Подраздел уже внизу списка."), http.StatusSeeOther)
			return
		}

		a.logger.Printf("admin move wiki subsection: %v", err)
		http.Redirect(w, r, adminUsersRedirectURLForTab(adminTabCatalog, "", "Не удалось изменить порядок подраздела."), http.StatusSeeOther)
		return
	}

	http.Redirect(w, r, adminUsersRedirectURLForTab(adminTabCatalog, "Порядок подраздела обновлен.", ""), http.StatusSeeOther)
}

func (a *Application) handleAdminDeleteWikiSubsection(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	if a.requireAdmin(w, r) == nil {
		return
	}

	if err := r.ParseForm(); err != nil {
		http.Error(w, "invalid form data", http.StatusBadRequest)
		return
	}

	sectionSlug := normalizeWikiSectionSlug(r.FormValue("section_slug"))
	subsectionTitle := normalizeWikiSubsectionTitle(r.FormValue("subsection_title"))
	if !isValidWikiSectionSlug(sectionSlug) {
		http.Redirect(w, r, adminUsersRedirectURLForTab(adminTabCatalog, "", "Некорректный slug раздела."), http.StatusSeeOther)
		return
	}
	if utf8.RuneCountInString(subsectionTitle) < 2 || utf8.RuneCountInString(subsectionTitle) > 120 {
		http.Redirect(w, r, adminUsersRedirectURLForTab(adminTabCatalog, "", "Некорректное название подраздела."), http.StatusSeeOther)
		return
	}

	if err := a.deleteWikiSubsection(sectionSlug, subsectionTitle); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			http.Redirect(w, r, adminUsersRedirectURLForTab(adminTabCatalog, "", "Раздел или подраздел не найден."), http.StatusSeeOther)
			return
		}
		if count, hasArticles := isWikiSubsectionHasArticlesError(err); hasArticles {
			http.Redirect(
				w,
				r,
				adminUsersRedirectURLForTab(adminTabCatalog, "", fmt.Sprintf("Нельзя удалить подраздел: в нем %d статей.", count)),
				http.StatusSeeOther,
			)
			return
		}

		a.logger.Printf("admin delete wiki subsection: %v", err)
		http.Redirect(w, r, adminUsersRedirectURLForTab(adminTabCatalog, "", "Не удалось удалить подраздел."), http.StatusSeeOther)
		return
	}

	http.Redirect(w, r, adminUsersRedirectURLForTab(adminTabCatalog, "Подраздел удален.", ""), http.StatusSeeOther)
}

func (a *Application) handleAdminChangeUserRole(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	currentUser := a.requireAdmin(w, r)
	if currentUser == nil {
		return
	}

	if err := r.ParseForm(); err != nil {
		http.Error(w, "invalid form data", http.StatusBadRequest)
		return
	}

	userID, err := parsePositiveID(r.FormValue("user_id"))
	if err != nil {
		http.Redirect(w, r, adminUsersRedirectURL("", "Некорректный ID пользователя."), http.StatusSeeOther)
		return
	}

	role, err := selectedRole(r.FormValue("role"))
	if err != nil {
		http.Redirect(w, r, adminUsersRedirectURL("", "Некорректная роль."), http.StatusSeeOther)
		return
	}

	target, err := a.getUserByID(userID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			http.Redirect(w, r, adminUsersRedirectURL("", "Пользователь не найден."), http.StatusSeeOther)
			return
		}
		a.logger.Printf("admin get target user for role change: %v", err)
		http.Redirect(w, r, adminUsersRedirectURL("", "Не удалось обновить роль."), http.StatusSeeOther)
		return
	}

	if target.ID == currentUser.ID && role != userRoleAdmin {
		http.Redirect(w, r, adminUsersRedirectURL("", "Нельзя снять роль администратора с собственного аккаунта."), http.StatusSeeOther)
		return
	}

	if target.Role == userRoleAdmin && role != userRoleAdmin {
		adminsCount, err := a.countAdminUsers()
		if err != nil {
			a.logger.Printf("admin count users before role change: %v", err)
			http.Redirect(w, r, adminUsersRedirectURL("", "Не удалось обновить роль."), http.StatusSeeOther)
			return
		}
		if adminsCount <= 1 {
			http.Redirect(w, r, adminUsersRedirectURL("", "В системе должен остаться минимум один администратор."), http.StatusSeeOther)
			return
		}
	}

	updated, err := a.updateUserRoleByID(userID, role)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			http.Redirect(w, r, adminUsersRedirectURL("", "Пользователь не найден."), http.StatusSeeOther)
			return
		}
		a.logger.Printf("admin update user role: %v", err)
		http.Redirect(w, r, adminUsersRedirectURL("", "Не удалось обновить роль."), http.StatusSeeOther)
		return
	}

	success := fmt.Sprintf("Роль пользователя %s обновлена: %s.", updated.Email, roleLabel(updated.Role))
	http.Redirect(w, r, adminUsersRedirectURL(success, ""), http.StatusSeeOther)
}

func (a *Application) handleAdminDeleteUser(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	currentUser := a.requireAdmin(w, r)
	if currentUser == nil {
		return
	}

	if err := r.ParseForm(); err != nil {
		http.Error(w, "invalid form data", http.StatusBadRequest)
		return
	}

	userID, err := parsePositiveID(r.FormValue("user_id"))
	if err != nil {
		http.Redirect(w, r, adminUsersRedirectURL("", "Некорректный ID пользователя."), http.StatusSeeOther)
		return
	}

	if userID == currentUser.ID {
		http.Redirect(w, r, adminUsersRedirectURL("", "Нельзя удалить собственный аккаунт."), http.StatusSeeOther)
		return
	}

	target, err := a.getUserByID(userID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			http.Redirect(w, r, adminUsersRedirectURL("", "Пользователь не найден."), http.StatusSeeOther)
			return
		}
		a.logger.Printf("admin get target user for delete: %v", err)
		http.Redirect(w, r, adminUsersRedirectURL("", "Не удалось удалить пользователя."), http.StatusSeeOther)
		return
	}

	if target.Role == userRoleAdmin {
		adminsCount, err := a.countAdminUsers()
		if err != nil {
			a.logger.Printf("admin count users before delete: %v", err)
			http.Redirect(w, r, adminUsersRedirectURL("", "Не удалось удалить пользователя."), http.StatusSeeOther)
			return
		}
		if adminsCount <= 1 {
			http.Redirect(w, r, adminUsersRedirectURL("", "Нельзя удалить последнего администратора."), http.StatusSeeOther)
			return
		}
	}

	if err := a.deleteUserAndRegistrationByID(userID, target.Email); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			http.Redirect(w, r, adminUsersRedirectURL("", "Пользователь не найден."), http.StatusSeeOther)
			return
		}
		a.logger.Printf("admin delete user: %v", err)
		http.Redirect(w, r, adminUsersRedirectURL("", "Не удалось удалить пользователя."), http.StatusSeeOther)
		return
	}

	success := fmt.Sprintf("Пользователь %s удален.", target.Email)
	http.Redirect(w, r, adminUsersRedirectURL(success, ""), http.StatusSeeOther)
}

func (a *Application) handleAdminBlockUser(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	currentUser := a.requireAdmin(w, r)
	if currentUser == nil {
		return
	}

	if err := r.ParseForm(); err != nil {
		http.Error(w, "invalid form data", http.StatusBadRequest)
		return
	}

	userID, err := parsePositiveID(r.FormValue("user_id"))
	if err != nil {
		http.Redirect(w, r, adminUsersRedirectURL("", "Некорректный ID пользователя."), http.StatusSeeOther)
		return
	}

	if userID == currentUser.ID {
		http.Redirect(w, r, adminUsersRedirectURL("", "Себя блокировать нельзя."), http.StatusSeeOther)
		return
	}

	target, err := a.getUserByID(userID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			http.Redirect(w, r, adminUsersRedirectURL("", "Пользователь не найден."), http.StatusSeeOther)
			return
		}
		a.logger.Printf("admin get target user for block: %v", err)
		http.Redirect(w, r, adminUsersRedirectURL("", "Не удалось заблокировать пользователя."), http.StatusSeeOther)
		return
	}

	if target.Blocked {
		http.Redirect(w, r, adminUsersRedirectURL("", "Этот пользователь уже заблокирован."), http.StatusSeeOther)
		return
	}

	if target.Role == userRoleAdmin {
		adminsCount, err := a.countActiveAdminUsers()
		if err != nil {
			a.logger.Printf("admin count active admins before block: %v", err)
			http.Redirect(w, r, adminUsersRedirectURL("", "Не удалось заблокировать пользователя."), http.StatusSeeOther)
			return
		}
		if adminsCount <= 1 {
			http.Redirect(w, r, adminUsersRedirectURL("", "Нельзя блокировать последнего активного админа."), http.StatusSeeOther)
			return
		}
	}

	updated, err := a.updateUserBlockedStateByID(userID, true)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			http.Redirect(w, r, adminUsersRedirectURL("", "Пользователь не найден."), http.StatusSeeOther)
			return
		}
		a.logger.Printf("admin block user: %v", err)
		http.Redirect(w, r, adminUsersRedirectURL("", "Не удалось заблокировать пользователя."), http.StatusSeeOther)
		return
	}

	if err := a.deleteSessionsByUserID(updated.ID); err != nil {
		a.logger.Printf("admin delete sessions for blocked user: %v", err)
	}

	success := fmt.Sprintf("Пользователь %s заблокирован.", updated.Email)
	http.Redirect(w, r, adminUsersRedirectURL(success, ""), http.StatusSeeOther)
}

func (a *Application) handleAdminUnblockUser(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	currentUser := a.requireAdmin(w, r)
	if currentUser == nil {
		return
	}

	if err := r.ParseForm(); err != nil {
		http.Error(w, "invalid form data", http.StatusBadRequest)
		return
	}

	userID, err := parsePositiveID(r.FormValue("user_id"))
	if err != nil {
		http.Redirect(w, r, adminUsersRedirectURL("", "Некорректный ID пользователя."), http.StatusSeeOther)
		return
	}

	target, err := a.getUserByID(userID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			http.Redirect(w, r, adminUsersRedirectURL("", "Пользователь не найден."), http.StatusSeeOther)
			return
		}
		a.logger.Printf("admin get target user for unblock: %v", err)
		http.Redirect(w, r, adminUsersRedirectURL("", "Не удалось разблокировать пользователя."), http.StatusSeeOther)
		return
	}

	if !target.Blocked {
		http.Redirect(w, r, adminUsersRedirectURL("", "Этот пользователь и так активен."), http.StatusSeeOther)
		return
	}

	updated, err := a.updateUserBlockedStateByID(userID, false)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			http.Redirect(w, r, adminUsersRedirectURL("", "Пользователь не найден."), http.StatusSeeOther)
			return
		}
		a.logger.Printf("admin unblock user: %v", err)
		http.Redirect(w, r, adminUsersRedirectURL("", "Не удалось разблокировать пользователя."), http.StatusSeeOther)
		return
	}

	success := fmt.Sprintf("Пользователь %s разблокирован.", updated.Email)
	http.Redirect(w, r, adminUsersRedirectURL(success, ""), http.StatusSeeOther)
}
