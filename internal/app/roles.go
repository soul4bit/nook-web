package app

import "strings"

const (
	userRoleViewer = "viewer"
	userRoleEditor = "editor"
	userRoleAdmin  = "admin"
)

type roleOption struct {
	Value string
	Label string
}

func normalizeUserRole(role string) string {
	switch strings.ToLower(strings.TrimSpace(role)) {
	case userRoleAdmin:
		return userRoleAdmin
	case userRoleEditor:
		return userRoleEditor
	default:
		return userRoleViewer
	}
}

func roleLabel(role string) string {
	switch normalizeUserRole(role) {
	case userRoleAdmin:
		return "Архитектор платформы"
	case userRoleEditor:
		return "Куратор знаний"
	default:
		return "Исследователь базы"
	}
}

func allRoleOptions() []roleOption {
	return []roleOption{
		{Value: userRoleViewer, Label: roleLabel(userRoleViewer)},
		{Value: userRoleEditor, Label: roleLabel(userRoleEditor)},
		{Value: userRoleAdmin, Label: roleLabel(userRoleAdmin)},
	}
}
