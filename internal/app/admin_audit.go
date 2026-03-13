package app

import (
	"database/sql"
	"strings"
)

const (
	adminAuditActionApproveRegistration  = "registration_approve"
	adminAuditActionRejectRegistration   = "registration_reject"
	adminAuditActionChangeUserRole       = "user_role_change"
	adminAuditActionDeleteUser           = "user_delete"
	adminAuditActionBlockUser            = "user_block"
	adminAuditActionUnblockUser          = "user_unblock"
	adminAuditActionCreateWikiSection    = "wiki_section_create"
	adminAuditActionCreateWikiSubsection = "wiki_subsection_create"
	adminAuditActionDeleteWikiSection    = "wiki_section_delete"
)

func adminAuditActionLabel(action string) string {
	switch strings.TrimSpace(action) {
	case adminAuditActionApproveRegistration:
		return "Одобрение регистрации"
	case adminAuditActionRejectRegistration:
		return "Отклонение регистрации"
	case adminAuditActionChangeUserRole:
		return "Смена роли пользователя"
	case adminAuditActionDeleteUser:
		return "Удаление пользователя"
	case adminAuditActionBlockUser:
		return "Блокировка пользователя"
	case adminAuditActionUnblockUser:
		return "Разблокировка пользователя"
	case adminAuditActionCreateWikiSection:
		return "Создание раздела wiki"
	case adminAuditActionCreateWikiSubsection:
		return "Создание подраздела wiki"
	case adminAuditActionDeleteWikiSection:
		return "Удаление раздела wiki"
	default:
		return "Действие администратора"
	}
}

func (a *Application) addAdminAuditEntry(adminUserID int64, action string, targetUserID *int64, targetEmail string, details string) {
	if adminUserID < 1 || strings.TrimSpace(action) == "" {
		return
	}
	if err := a.insertAdminAuditEntry(adminUserID, action, targetUserID, targetEmail, details); err != nil {
		a.logger.Printf("insert admin audit entry: %v", err)
	}
}

func (a *Application) insertAdminAuditEntry(adminUserID int64, action string, targetUserID *int64, targetEmail string, details string) error {
	var targetID sql.NullInt64
	if targetUserID != nil && *targetUserID > 0 {
		targetID = sql.NullInt64{Int64: *targetUserID, Valid: true}
	}

	_, err := a.db.Exec(
		`insert into admin_audit_log (
			admin_user_id,
			action,
			target_user_id,
			target_email,
			details
		) values ($1, $2, $3, $4, $5)`,
		adminUserID,
		strings.TrimSpace(action),
		targetID,
		normalizeEmail(targetEmail),
		strings.TrimSpace(details),
	)
	return err
}

func (a *Application) listAdminAuditEntries(limit int) ([]adminAuditEntry, error) {
	if limit < 1 {
		limit = 1
	}

	rows, err := a.db.Query(
		`select
			l.id,
			l.action,
			coalesce(u.name, 'system') as admin_name,
			l.target_email,
			l.details,
			l.created_at,
			l.target_user_id,
			l.admin_user_id
		from admin_audit_log l
		left join users u on u.id = l.admin_user_id
		order by l.created_at desc
		limit $1`,
		limit,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := make([]adminAuditEntry, 0, limit)
	for rows.Next() {
		var entry adminAuditEntry
		if err := rows.Scan(
			&entry.ID,
			&entry.Action,
			&entry.AdminName,
			&entry.TargetEmail,
			&entry.Details,
			&entry.CreatedAt,
			&entry.TargetUserID,
			&entry.AdminUserID,
		); err != nil {
			return nil, err
		}
		entry.ActionLabel = adminAuditActionLabel(entry.Action)
		result = append(result, entry)
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	return result, nil
}
