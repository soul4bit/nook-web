package app

import (
	"crypto/subtle"
	"errors"
	"net/http"
	"strings"
	"time"
)

const (
	csrfCookieName  = "nook_csrf"
	csrfFormField   = "csrf_token"
	csrfHeaderName  = "X-CSRF-Token"
	csrfCookieTTL   = 30 * 24 * time.Hour
	csrfErrorHeader = "invalid csrf token"
)

func isSafeHTTPMethod(method string) bool {
	switch strings.ToUpper(strings.TrimSpace(method)) {
	case http.MethodGet, http.MethodHead, http.MethodOptions, http.MethodTrace:
		return true
	default:
		return false
	}
}

func isValidCSRFToken(token string) bool {
	clean := strings.TrimSpace(token)
	if clean == "" {
		return false
	}
	if len(clean) < 20 || len(clean) > 200 {
		return false
	}
	if strings.ContainsAny(clean, " \t\r\n") {
		return false
	}
	return true
}

func (a *Application) csrfCookie(token string) *http.Cookie {
	maxAge := int(csrfCookieTTL / time.Second)
	return &http.Cookie{
		Name:     csrfCookieName,
		Value:    token,
		Path:     "/",
		HttpOnly: false,
		Secure:   a.cfg.SecureCookies,
		SameSite: http.SameSiteLaxMode,
		Expires:  time.Now().UTC().Add(csrfCookieTTL),
		MaxAge:   maxAge,
	}
}

func (a *Application) csrfTokenFromCookie(r *http.Request) string {
	if r == nil {
		return ""
	}
	cookie, err := r.Cookie(csrfCookieName)
	if err != nil {
		return ""
	}
	token := strings.TrimSpace(cookie.Value)
	if !isValidCSRFToken(token) {
		return ""
	}
	return token
}

func (a *Application) ensureCSRFToken(w http.ResponseWriter, r *http.Request) (string, error) {
	if r == nil {
		return "", errors.New("request is nil")
	}

	if token := a.csrfTokenFromCookie(r); token != "" {
		return token, nil
	}

	token, err := generateSessionToken()
	if err != nil {
		return "", err
	}

	http.SetCookie(w, a.csrfCookie(token))
	return token, nil
}

func csrfTokenFromRequest(r *http.Request) string {
	if r == nil {
		return ""
	}

	if headerToken := strings.TrimSpace(r.Header.Get(csrfHeaderName)); headerToken != "" {
		return headerToken
	}
	return strings.TrimSpace(r.FormValue(csrfFormField))
}

func (a *Application) validateCSRFToken(r *http.Request) bool {
	if r == nil {
		return false
	}

	cookieToken := a.csrfTokenFromCookie(r)
	requestToken := csrfTokenFromRequest(r)
	if !isValidCSRFToken(cookieToken) || !isValidCSRFToken(requestToken) {
		return false
	}

	return subtle.ConstantTimeCompare([]byte(cookieToken), []byte(requestToken)) == 1
}

func (a *Application) withCSRF(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if isSafeHTTPMethod(r.Method) {
			if _, err := a.ensureCSRFToken(w, r); err != nil {
				a.logger.Printf("ensure csrf token: %v", err)
				http.Error(w, "internal server error", http.StatusInternalServerError)
				return
			}
			next(w, r)
			return
		}

		if !a.validateCSRFToken(r) {
			http.Error(w, csrfErrorHeader, http.StatusForbidden)
			return
		}

		next(w, r)
	}
}
