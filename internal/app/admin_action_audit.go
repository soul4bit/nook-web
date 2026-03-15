package app

import (
	"fmt"
	"net/http"
	"net/url"
	"strconv"
	"strings"
)

type statusCapturingResponseWriter struct {
	http.ResponseWriter
	statusCode int
}

func newStatusCapturingResponseWriter(w http.ResponseWriter) *statusCapturingResponseWriter {
	return &statusCapturingResponseWriter{
		ResponseWriter: w,
		statusCode:     http.StatusOK,
	}
}

func (w *statusCapturingResponseWriter) WriteHeader(statusCode int) {
	w.statusCode = statusCode
	w.ResponseWriter.WriteHeader(statusCode)
}

func (w *statusCapturingResponseWriter) Write(payload []byte) (int, error) {
	if w.statusCode == 0 {
		w.statusCode = http.StatusOK
	}
	return w.ResponseWriter.Write(payload)
}

func parseAdminActionResult(r *http.Request, location string, statusCode int) (tab string, result string, message string) {
	tab = adminTabUsers
	if r != nil {
		tab = normalizeAdminTab(r.URL.Query().Get("tab"))
		if formTab := strings.TrimSpace(r.FormValue("tab")); formTab != "" {
			tab = normalizeAdminTab(formTab)
		}
	}
	if statusCode >= http.StatusBadRequest {
		result = "error"
	} else {
		result = "success"
	}

	cleanLocation := strings.TrimSpace(location)
	if cleanLocation == "" {
		return tab, result, message
	}

	parsed, err := url.Parse(cleanLocation)
	if err != nil {
		return tab, result, message
	}

	query := parsed.Query()
	tab = normalizeAdminTab(query.Get("tab"))
	if errText := strings.TrimSpace(query.Get("error")); errText != "" {
		return tab, "error", errText
	}
	if successText := strings.TrimSpace(query.Get("success")); successText != "" {
		return tab, "success", successText
	}

	return tab, result, message
}

func auditValue(raw string) string {
	value := strings.TrimSpace(raw)
	if value == "" {
		return ""
	}
	if len(value) > 180 {
		value = value[:180] + "..."
	}
	return value
}

func appendAdminAuditDetail(parts []string, key string, value string) []string {
	cleanKey := strings.TrimSpace(key)
	cleanValue := auditValue(value)
	if cleanKey == "" || cleanValue == "" {
		return parts
	}
	return append(parts, fmt.Sprintf("%s=%q", cleanKey, cleanValue))
}

func buildAdminActionDetails(r *http.Request, statusCode int, tab string, result string, message string) string {
	if r == nil {
		return ""
	}

	if strings.EqualFold(strings.TrimSpace(r.Method), http.MethodPost) {
		_ = r.ParseForm()
	}

	parts := []string{
		fmt.Sprintf("result=%q", auditValue(result)),
		fmt.Sprintf("status=%q", strconv.Itoa(statusCode)),
		fmt.Sprintf("tab=%q", auditValue(tab)),
		fmt.Sprintf("path=%q", auditValue(r.URL.Path)),
	}
	parts = appendAdminAuditDetail(parts, "user_id", r.FormValue("user_id"))
	parts = appendAdminAuditDetail(parts, "request_id", r.FormValue("request_id"))
	parts = appendAdminAuditDetail(parts, "section_slug", r.FormValue("section_slug"))
	parts = appendAdminAuditDetail(parts, "subsection_title", r.FormValue("subsection_title"))
	parts = appendAdminAuditDetail(parts, "new_title", r.FormValue("new_title"))
	parts = appendAdminAuditDetail(parts, "new_name", r.FormValue("new_name"))
	parts = appendAdminAuditDetail(parts, "direction", r.FormValue("direction"))
	parts = appendAdminAuditDetail(parts, "order", r.FormValue("order"))
	parts = appendAdminAuditDetail(parts, "slug", r.FormValue("slug"))
	parts = appendAdminAuditDetail(parts, "role", r.FormValue("role"))
	parts = appendAdminAuditDetail(parts, "rating", r.FormValue("rating"))
	parts = appendAdminAuditDetail(parts, "name", r.FormValue("name"))
	parts = appendAdminAuditDetail(parts, "title", r.FormValue("title"))
	parts = appendAdminAuditDetail(parts, "message", message)

	return strings.Join(parts, " ")
}

func (a *Application) withAdminActionAudit(action string, next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		recorder := newStatusCapturingResponseWriter(w)
		next(recorder, r)

		currentUser := userFromContext(r.Context())
		if currentUser == nil || !currentUser.IsAdmin() {
			return
		}

		tab, result, message := parseAdminActionResult(r, recorder.Header().Get("Location"), recorder.statusCode)
		details := buildAdminActionDetails(r, recorder.statusCode, tab, result, message)
		a.addAdminAuditEntry(currentUser.ID, action, nil, "", details)
	}
}
