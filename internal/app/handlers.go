package app

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"html"
	"net/http"
	"net/mail"
	"net/url"
	"strings"
	"unicode/utf8"

	"golang.org/x/crypto/bcrypt"
)

func (a *Application) requireAuth(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		user, err := a.currentUser(r)
		if err != nil {
			a.logger.Printf("resolve user: %v", err)
			http.Error(w, "internal server error", http.StatusInternalServerError)
			return
		}

		if user == nil {
			a.clearSessionCookie(w)
			http.Redirect(w, r, "/auth/login?next="+r.URL.Path, http.StatusSeeOther)
			return
		}

		ctx := r.Context()
		ctx = contextWithUser(ctx, user)
		next(w, r.WithContext(ctx))
	}
}

func contextWithUser(ctx context.Context, user *User) context.Context {
	return context.WithValue(ctx, userContextKey, user)
}

func (a *Application) authViewData(title string) viewData {
	data := viewData{
		AppName: a.cfg.AppName,
		Title:   title,
	}

	stats, err := a.getAuthStats()
	if err != nil {
		a.logger.Printf("get auth stats: %v", err)
		return data
	}

	data.UsersTotal = stats.UsersTotal
	data.ActiveSessions = stats.ActiveSessions
	return data
}

func (a *Application) appViewData(user *User, title string) viewData {
	return viewData{
		AppName:         a.cfg.AppName,
		Title:           title,
		User:            user,
		Sections:        wikiSections(),
		S3Endpoint:      a.cfg.S3Endpoint,
		S3Bucket:        a.cfg.S3Bucket,
		S3PublicBaseURL: a.cfg.S3PublicBaseURL,
	}
}

func decorateArticles(articles []Article) {
	for i := range articles {
		articles[i].SectionName = wikiSectionName(articles[i].SectionSlug)
	}
}

func (a *Application) handleRoot(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path != "/" {
		http.NotFound(w, r)
		return
	}

	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	user, err := a.currentUser(r)
	if err != nil {
		a.logger.Printf("root user lookup: %v", err)
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}

	if user != nil {
		http.Redirect(w, r, "/app", http.StatusSeeOther)
		return
	}

	http.Redirect(w, r, "/auth/login", http.StatusSeeOther)
}

func (a *Application) handleLogin(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		user, err := a.currentUser(r)
		if err != nil {
			a.logger.Printf("login user lookup: %v", err)
			http.Error(w, "internal server error", http.StatusInternalServerError)
			return
		}
		if user != nil {
			http.Redirect(w, r, "/app", http.StatusSeeOther)
			return
		}

		data := a.authViewData("Р вЂ™РЎвЂ¦Р С•Р Т‘")
		data.Success = strings.TrimSpace(r.URL.Query().Get("success"))
		data.Next = strings.TrimSpace(r.URL.Query().Get("next"))
		a.renderTemplate(w, "login.tmpl", data)
	case http.MethodPost:
		if err := r.ParseForm(); err != nil {
			http.Error(w, "invalid form data", http.StatusBadRequest)
			return
		}

		email := normalizeEmail(r.FormValue("email"))
		password := r.FormValue("password")
		next := strings.TrimSpace(r.FormValue("next"))

		data := a.authViewData("Р вЂ™РЎвЂ¦Р С•Р Т‘")
		data.Email = email
		data.Next = next

		if email == "" || password == "" {
			data.Error = "Р вЂ™Р Р†Р ВµР Т‘Р С‘РЎвЂљР Вµ email Р С‘ Р С—Р В°РЎР‚Р С•Р В»РЎРЉ."
			a.renderTemplate(w, "login.tmpl", data)
			return
		}

		creds, err := a.getCredentialsByEmail(email)
		if err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				if reg, regErr := a.getRegistrationRequestByEmail(email); regErr == nil {
					switch reg.Status {
					case registrationStatusPending:
						data.Error = "Р вЂ”Р В°РЎРЏР Р†Р С”Р В° Р ВµРЎвЂ°Р Вµ Р Р…Р В° РЎР‚Р В°РЎРѓРЎРѓР СР С•РЎвЂљРЎР‚Р ВµР Р…Р С‘Р С‘. Р вЂќР С•Р В¶Р Т‘Р С‘РЎвЂљР ВµРЎРѓРЎРЉ РЎР‚Р ВµРЎв‚¬Р ВµР Р…Р С‘РЎРЏ Р Р† Р С—Р С‘РЎРѓРЎРЉР СР Вµ."
					case registrationStatusApproved:
						data.Error = "Р вЂ”Р В°РЎРЏР Р†Р С”Р В° Р С•Р Т‘Р С•Р В±РЎР‚Р ВµР Р…Р В°. Р СџР С•Р Т‘РЎвЂљР Р†Р ВµРЎР‚Р Т‘Р С‘РЎвЂљР Вµ email Р С—Р С• РЎРѓРЎРѓРЎвЂ№Р В»Р С”Р Вµ Р С‘Р В· Р С—Р С‘РЎРѓРЎРЉР СР В°."
					case registrationStatusRejected:
						data.Error = "Р вЂ”Р В°РЎРЏР Р†Р С”Р В° Р С•РЎвЂљР С”Р В»Р С•Р Р…Р ВµР Р…Р В°. Р СљР С•Р В¶Р Р…Р С• Р С•РЎвЂљР С—РЎР‚Р В°Р Р†Р С‘РЎвЂљРЎРЉ Р Р…Р С•Р Р†РЎС“РЎР‹ РЎР‚Р ВµР С–Р С‘РЎРѓРЎвЂљРЎР‚Р В°РЎвЂ Р С‘РЎР‹."
					default:
						data.Error = "Р СњР ВµР Р†Р ВµРЎР‚Р Р…РЎвЂ№Р в„– email Р С‘Р В»Р С‘ Р С—Р В°РЎР‚Р С•Р В»РЎРЉ."
					}
				} else {
					data.Error = "Р СњР ВµР Р†Р ВµРЎР‚Р Р…РЎвЂ№Р в„– email Р С‘Р В»Р С‘ Р С—Р В°РЎР‚Р С•Р В»РЎРЉ."
				}
				a.renderTemplate(w, "login.tmpl", data)
				return
			}
			a.logger.Printf("get credentials by email: %v", err)
			http.Error(w, "internal server error", http.StatusInternalServerError)
			return
		}

		if err := bcrypt.CompareHashAndPassword([]byte(creds.PasswordHash), []byte(password)); err != nil {
			data.Error = "Р СњР ВµР Р†Р ВµРЎР‚Р Р…РЎвЂ№Р в„– email Р С‘Р В»Р С‘ Р С—Р В°РЎР‚Р С•Р В»РЎРЉ."
			a.renderTemplate(w, "login.tmpl", data)
			return
		}

		token, expiresAt, err := a.createSession(creds.ID)
		if err != nil {
			a.logger.Printf("create session: %v", err)
			http.Error(w, "internal server error", http.StatusInternalServerError)
			return
		}

		http.SetCookie(w, a.sessionCookie(token, expiresAt))

		target := "/app"
		if isSafeRedirectTarget(next) {
			target = next
		}
		http.Redirect(w, r, target, http.StatusSeeOther)
	default:
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
	}
}

func (a *Application) handleRegister(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		user, err := a.currentUser(r)
		if err != nil {
			a.logger.Printf("register user lookup: %v", err)
			http.Error(w, "internal server error", http.StatusInternalServerError)
			return
		}
		if user != nil {
			http.Redirect(w, r, "/app", http.StatusSeeOther)
			return
		}

		a.renderTemplate(w, "register.tmpl", a.authViewData("Р В Р ВµР С–Р С‘РЎРѓРЎвЂљРЎР‚Р В°РЎвЂ Р С‘РЎРЏ"))
	case http.MethodPost:
		if err := r.ParseForm(); err != nil {
			http.Error(w, "invalid form data", http.StatusBadRequest)
			return
		}

		name := strings.TrimSpace(r.FormValue("name"))
		email := normalizeEmail(r.FormValue("email"))
		password := r.FormValue("password")
		confirmPassword := r.FormValue("confirm_password")

		data := a.authViewData("Р В Р ВµР С–Р С‘РЎРѓРЎвЂљРЎР‚Р В°РЎвЂ Р С‘РЎРЏ")
		data.Name = name
		data.Email = email

		if !a.hasRegistrationIntegrations() {
			data.Error = "Р В Р ВµР С–Р С‘РЎРѓРЎвЂљРЎР‚Р В°РЎвЂ Р С‘РЎРЏ Р Р†РЎР‚Р ВµР СР ВµР Р…Р Р…Р С• Р Р…Р ВµР Т‘Р С•РЎРѓРЎвЂљРЎС“Р С—Р Р…Р В°: Р Р…Р Вµ Р Р…Р В°РЎРѓРЎвЂљРЎР‚Р С•Р ВµР Р…РЎвЂ№ SMTP/Telegram Р С‘Р Р…РЎвЂљР ВµР С–РЎР‚Р В°РЎвЂ Р С‘Р С‘."
			a.renderTemplate(w, "register.tmpl", data)
			return
		}

		if len(name) < 2 {
			data.Error = "Р СњР С‘Р С” Р Т‘Р С•Р В»Р В¶Р ВµР Р… Р В±РЎвЂ№РЎвЂљРЎРЉ Р СР С‘Р Р…Р С‘Р СРЎС“Р С 2 РЎРѓР С‘Р СР Р†Р С•Р В»Р В°."
			a.renderTemplate(w, "register.tmpl", data)
			return
		}

		if _, err := mail.ParseAddress(email); err != nil {
			data.Error = "Р вЂ™Р Р†Р ВµР Т‘Р С‘РЎвЂљР Вµ Р С”Р С•РЎР‚РЎР‚Р ВµР С”РЎвЂљР Р…РЎвЂ№Р в„– email."
			a.renderTemplate(w, "register.tmpl", data)
			return
		}

		if len(password) < 10 {
			data.Error = "Р СџР В°РЎР‚Р С•Р В»РЎРЉ Р Т‘Р С•Р В»Р В¶Р ВµР Р… Р В±РЎвЂ№РЎвЂљРЎРЉ Р Р…Р Вµ Р С”Р С•РЎР‚Р С•РЎвЂЎР Вµ 10 РЎРѓР С‘Р СР Р†Р С•Р В»Р С•Р Р†."
			a.renderTemplate(w, "register.tmpl", data)
			return
		}

		if password != confirmPassword {
			data.Error = "Р СџР В°РЎР‚Р С•Р В»Р С‘ Р Р…Р Вµ РЎРѓР С•Р Р†Р С—Р В°Р Т‘Р В°РЎР‹РЎвЂљ."
			a.renderTemplate(w, "register.tmpl", data)
			return
		}

		if existingUser, err := a.getUserByEmail(email); err == nil && existingUser != nil {
			data.Error = "Р С’Р С”Р С”Р В°РЎС“Р Р…РЎвЂљ РЎРѓ РЎвЂљР В°Р С”Р С‘Р С email РЎС“Р В¶Р Вµ РЎРѓРЎС“РЎвЂ°Р ВµРЎРѓРЎвЂљР Р†РЎС“Р ВµРЎвЂљ."
			a.renderTemplate(w, "register.tmpl", data)
			return
		} else if err != nil && !errors.Is(err, sql.ErrNoRows) {
			a.logger.Printf("lookup existing user by email: %v", err)
			http.Error(w, "internal server error", http.StatusInternalServerError)
			return
		}

		if existingReq, err := a.getRegistrationRequestByEmail(email); err == nil {
			switch existingReq.Status {
			case registrationStatusPending:
				data.Error = "Р вЂ”Р В°РЎРЏР Р†Р С”Р В° РЎС“Р В¶Р Вµ Р С•РЎвЂљР С—РЎР‚Р В°Р Р†Р В»Р ВµР Р…Р В° Р С‘ Р В¶Р Т‘Р ВµРЎвЂљ РЎР‚Р ВµРЎв‚¬Р ВµР Р…Р С‘РЎРЏ Р СР С•Р Т‘Р ВµРЎР‚Р В°РЎвЂљР С•РЎР‚Р В°."
				a.renderTemplate(w, "register.tmpl", data)
				return
			case registrationStatusApproved:
				data.Error = "Р вЂ”Р В°РЎРЏР Р†Р С”Р В° РЎС“Р В¶Р Вµ Р С•Р Т‘Р С•Р В±РЎР‚Р ВµР Р…Р В°. Р СџРЎР‚Р С•Р Р†Р ВµРЎР‚РЎРЉРЎвЂљР Вµ Р С—Р С‘РЎРѓРЎРЉР СР С• Р С‘ Р С—Р С•Р Т‘РЎвЂљР Р†Р ВµРЎР‚Р Т‘Р С‘РЎвЂљР Вµ email."
				a.renderTemplate(w, "register.tmpl", data)
				return
			case registrationStatusCompleted:
				data.Error = "Р В­РЎвЂљР С•РЎвЂљ email РЎС“Р В¶Р Вµ Р С—Р С•Р Т‘РЎвЂљР Р†Р ВµРЎР‚Р В¶Р Т‘Р ВµР Р… Р С‘ Р В°Р С”РЎвЂљР С‘Р Р†Р С‘РЎР‚Р С•Р Р†Р В°Р Р…. Р вЂ™Р С•Р в„–Р Т‘Р С‘РЎвЂљР Вµ Р Р† Р В°Р С”Р С”Р В°РЎС“Р Р…РЎвЂљ."
				a.renderTemplate(w, "register.tmpl", data)
				return
			}
		} else if !errors.Is(err, sql.ErrNoRows) {
			a.logger.Printf("lookup registration request by email: %v", err)
			http.Error(w, "internal server error", http.StatusInternalServerError)
			return
		}

		passwordHash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
		if err != nil {
			a.logger.Printf("hash password: %v", err)
			http.Error(w, "internal server error", http.StatusInternalServerError)
			return
		}

		moderationToken, err := generateSessionToken()
		if err != nil {
			a.logger.Printf("generate moderation token: %v", err)
			http.Error(w, "internal server error", http.StatusInternalServerError)
			return
		}

		request, err := a.upsertRegistrationRequest(name, email, string(passwordHash), moderationToken)
		if err != nil {
			a.logger.Printf("upsert registration request: %v", err)
			http.Error(w, "internal server error", http.StatusInternalServerError)
			return
		}

		if err := a.sendRegistrationRequestToTelegram(request, r); err != nil {
			a.logger.Printf("send registration request to telegram: %v", err)
			if delErr := a.deleteRegistrationRequestByEmail(email); delErr != nil {
				a.logger.Printf("rollback registration request after telegram error: %v", delErr)
			}
			data.Error = "Р СњР Вµ РЎС“Р Т‘Р В°Р В»Р С•РЎРѓРЎРЉ Р С•РЎвЂљР С—РЎР‚Р В°Р Р†Р С‘РЎвЂљРЎРЉ Р В·Р В°РЎРЏР Р†Р С”РЎС“ Р СР С•Р Т‘Р ВµРЎР‚Р В°РЎвЂљР С•РЎР‚РЎС“. Р СџР С•Р С—РЎР‚Р С•Р В±РЎС“Р в„–РЎвЂљР Вµ Р ВµРЎвЂ°Р Вµ РЎР‚Р В°Р В· РЎвЂЎРЎС“РЎвЂљРЎРЉ Р С—Р С•Р В·Р В¶Р Вµ."
			a.renderTemplate(w, "register.tmpl", data)
			return
		}

		success := url.QueryEscape("Р вЂ”Р В°РЎРЏР Р†Р С”Р В° Р С•РЎвЂљР С—РЎР‚Р В°Р Р†Р В»Р ВµР Р…Р В°. Р СџР С•РЎРѓР В»Р Вµ РЎР‚Р ВµРЎв‚¬Р ВµР Р…Р С‘РЎРЏ Р СР С•Р Т‘Р ВµРЎР‚Р В°РЎвЂљР С•РЎР‚Р В° Р С—РЎР‚Р С‘Р Т‘Р ВµРЎвЂљ Р С—Р С‘РЎРѓРЎРЉР СР С•.")
		http.Redirect(w, r, "/auth/login?success="+success, http.StatusSeeOther)
	default:
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
	}
}

func (a *Application) handleApproveRegistration(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	token := strings.TrimSpace(r.URL.Query().Get("token"))
	if token == "" {
		a.renderModerationPage(w, http.StatusBadRequest, "Р СњР ВµР С”Р С•РЎР‚РЎР‚Р ВµР С”РЎвЂљР Р…Р В°РЎРЏ РЎРѓРЎРѓРЎвЂ№Р В»Р С”Р В°", "Р СџРЎС“РЎРѓРЎвЂљР С•Р в„– РЎвЂљР С•Р С”Р ВµР Р… Р СР С•Р Т‘Р ВµРЎР‚Р В°РЎвЂ Р С‘Р С‘.")
		return
	}

	emailVerifyToken, err := generateSessionToken()
	if err != nil {
		a.logger.Printf("generate email verify token: %v", err)
		a.renderModerationPage(w, http.StatusInternalServerError, "Р С›РЎв‚¬Р С‘Р В±Р С”Р В° РЎРѓР ВµРЎР‚Р Р†Р ВµРЎР‚Р В°", "Р СњР Вµ РЎС“Р Т‘Р В°Р В»Р С•РЎРѓРЎРЉ РЎРѓР С–Р ВµР Р…Р ВµРЎР‚Р С‘РЎР‚Р С•Р Р†Р В°РЎвЂљРЎРЉ РЎвЂљР С•Р С”Р ВµР Р… Р С—Р С•Р Т‘РЎвЂљР Р†Р ВµРЎР‚Р В¶Р Т‘Р ВµР Р…Р С‘РЎРЏ email.")
		return
	}

	req, err := a.approveRegistrationRequest(token, emailVerifyToken)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			existing, lookupErr := a.getRegistrationRequestByModerationToken(token)
			if lookupErr != nil {
				a.renderModerationPage(w, http.StatusNotFound, "Р вЂ”Р В°РЎРЏР Р†Р С”Р В° Р Р…Р Вµ Р Р…Р В°Р в„–Р Т‘Р ВµР Р…Р В°", "Р вЂ”Р В°РЎРЏР Р†Р С”Р В° Р Р…Р Вµ Р Р…Р В°Р в„–Р Т‘Р ВµР Р…Р В° Р С‘Р В»Р С‘ РЎРѓРЎРѓРЎвЂ№Р В»Р С”Р В° РЎС“РЎРѓРЎвЂљР В°РЎР‚Р ВµР В»Р В°.")
				return
			}

			switch existing.Status {
			case registrationStatusApproved:
				if existing.EmailVerifyToken.Valid && strings.TrimSpace(existing.EmailVerifyToken.String) != "" {
					if mailErr := a.sendRegistrationApprovedEmail(existing); mailErr != nil {
						a.logger.Printf("resend approved email: %v", mailErr)
						a.renderModerationPage(w, http.StatusInternalServerError, "Р СџР С‘РЎРѓРЎРЉР СР С• Р Р…Р Вµ Р С•РЎвЂљР С—РЎР‚Р В°Р Р†Р В»Р ВµР Р…Р С•", "Р вЂ”Р В°РЎРЏР Р†Р С”Р В° РЎС“Р В¶Р Вµ Р С•Р Т‘Р С•Р В±РЎР‚Р ВµР Р…Р В°, Р Р…Р С• Р С—Р С‘РЎРѓРЎРЉР СР С• Р С—Р С•Р Р†РЎвЂљР С•РЎР‚Р Р…Р С• Р С•РЎвЂљР С—РЎР‚Р В°Р Р†Р С‘РЎвЂљРЎРЉ Р Р…Р Вµ РЎС“Р Т‘Р В°Р В»Р С•РЎРѓРЎРЉ.")
						return
					}
					a.renderModerationPage(w, http.StatusOK, "Р вЂ”Р В°РЎРЏР Р†Р С”Р В° РЎС“Р В¶Р Вµ Р С•Р Т‘Р С•Р В±РЎР‚Р ВµР Р…Р В°", "Р СџР С‘РЎРѓРЎРЉР СР С• РЎРѓ Р С—Р С•Р Т‘РЎвЂљР Р†Р ВµРЎР‚Р В¶Р Т‘Р ВµР Р…Р С‘Р ВµР С Р С•РЎвЂљР С—РЎР‚Р В°Р Р†Р В»Р ВµР Р…Р С• Р С—Р С•Р Р†РЎвЂљР С•РЎР‚Р Р…Р С•.")
					return
				}
				a.renderModerationPage(w, http.StatusOK, "Р вЂ”Р В°РЎРЏР Р†Р С”Р В° РЎС“Р В¶Р Вµ Р С•Р Т‘Р С•Р В±РЎР‚Р ВµР Р…Р В°", "Р В­РЎвЂљР В° Р В·Р В°РЎРЏР Р†Р С”Р В° РЎС“Р В¶Р Вµ Р В±РЎвЂ№Р В»Р В° Р С•Р В±РЎР‚Р В°Р В±Р С•РЎвЂљР В°Р Р…Р В° РЎР‚Р В°Р Р…Р ВµР Вµ.")
			case registrationStatusRejected:
				a.renderModerationPage(w, http.StatusConflict, "Р вЂ”Р В°РЎРЏР Р†Р С”Р В° РЎС“Р В¶Р Вµ Р С•РЎвЂљР С”Р В»Р С•Р Р…Р ВµР Р…Р В°", "Р В­РЎвЂљР В° Р В·Р В°РЎРЏР Р†Р С”Р В° РЎС“Р В¶Р Вµ Р С•РЎвЂљР С”Р В»Р С•Р Р…Р ВµР Р…Р В°.")
			case registrationStatusCompleted:
				a.renderModerationPage(w, http.StatusConflict, "Р СџР С•Р В»РЎРЉР В·Р С•Р Р†Р В°РЎвЂљР ВµР В»РЎРЉ РЎС“Р В¶Р Вµ Р В°Р С”РЎвЂљР С‘Р Р†Р С‘РЎР‚Р С•Р Р†Р В°Р Р…", "Email РЎС“Р В¶Р Вµ Р С—Р С•Р Т‘РЎвЂљР Р†Р ВµРЎР‚Р В¶Р Т‘Р ВµР Р…, Р С—Р С•Р В»РЎРЉР В·Р С•Р Р†Р В°РЎвЂљР ВµР В»РЎРЉ Р В°Р С”РЎвЂљР С‘Р Р†Р С‘РЎР‚Р С•Р Р†Р В°Р Р….")
			default:
				a.renderModerationPage(w, http.StatusConflict, "Р вЂ”Р В°РЎРЏР Р†Р С”Р В° РЎС“Р В¶Р Вµ Р С•Р В±РЎР‚Р В°Р В±Р С•РЎвЂљР В°Р Р…Р В°", "Р В­РЎвЂљР В° РЎРѓРЎРѓРЎвЂ№Р В»Р С”Р В° РЎС“Р В¶Р Вµ Р В±РЎвЂ№Р В»Р В° Р С‘РЎРѓР С—Р С•Р В»РЎРЉР В·Р С•Р Р†Р В°Р Р…Р В°.")
			}
			return
		}

		a.logger.Printf("approve registration request: %v", err)
		a.renderModerationPage(w, http.StatusInternalServerError, "Р С›РЎв‚¬Р С‘Р В±Р С”Р В° РЎРѓР ВµРЎР‚Р Р†Р ВµРЎР‚Р В°", "Р С›РЎв‚¬Р С‘Р В±Р С”Р В° Р С—РЎР‚Р С‘ Р С•Р Т‘Р С•Р В±РЎР‚Р ВµР Р…Р С‘Р С‘ Р В·Р В°РЎРЏР Р†Р С”Р С‘.")
		return
	}

	if err := a.sendRegistrationApprovedEmail(req); err != nil {
		a.logger.Printf("send approved email: %v", err)
		a.renderModerationPage(
			w,
			http.StatusInternalServerError,
			"Р СџР С‘РЎРѓРЎРЉР СР С• Р Р…Р Вµ Р С•РЎвЂљР С—РЎР‚Р В°Р Р†Р В»Р ВµР Р…Р С•",
			"Р вЂ”Р В°РЎРЏР Р†Р С”Р В° Р С•Р Т‘Р С•Р В±РЎР‚Р ВµР Р…Р В°, Р Р…Р С• Р С—Р С‘РЎРѓРЎРЉР СР С• Р С•РЎвЂљР С—РЎР‚Р В°Р Р†Р С‘РЎвЂљРЎРЉ Р Р…Р Вµ РЎС“Р Т‘Р В°Р В»Р С•РЎРѓРЎРЉ. Р СњР В°Р В¶Р СР С‘РЎвЂљР Вµ РЎРЊРЎвЂљРЎС“ Р В¶Р Вµ РЎРѓРЎРѓРЎвЂ№Р В»Р С”РЎС“ Р ВµРЎвЂ°Р Вµ РЎР‚Р В°Р В· Р Т‘Р В»РЎРЏ Р С—Р С•Р Р†РЎвЂљР С•РЎР‚Р Р…Р С•Р в„– Р С•РЎвЂљР С—РЎР‚Р В°Р Р†Р С”Р С‘.",
		)
		return
	}

	a.renderModerationPage(w, http.StatusOK, "Р вЂ”Р В°РЎРЏР Р†Р С”Р В° Р С•Р Т‘Р С•Р В±РЎР‚Р ВµР Р…Р В°", fmt.Sprintf("Р СњР В° %s Р С•РЎвЂљР С—РЎР‚Р В°Р Р†Р В»Р ВµР Р…Р С• Р С—Р С‘РЎРѓРЎРЉР СР С• РЎРѓ Р С—Р С•Р Т‘РЎвЂљР Р†Р ВµРЎР‚Р В¶Р Т‘Р ВµР Р…Р С‘Р ВµР С.", req.Email))
}

func (a *Application) handleRejectRegistration(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	token := strings.TrimSpace(r.URL.Query().Get("token"))
	if token == "" {
		a.renderModerationPage(w, http.StatusBadRequest, "Р СњР ВµР С”Р С•РЎР‚РЎР‚Р ВµР С”РЎвЂљР Р…Р В°РЎРЏ РЎРѓРЎРѓРЎвЂ№Р В»Р С”Р В°", "Р СџРЎС“РЎРѓРЎвЂљР С•Р в„– РЎвЂљР С•Р С”Р ВµР Р… Р СР С•Р Т‘Р ВµРЎР‚Р В°РЎвЂ Р С‘Р С‘.")
		return
	}

	reason := strings.TrimSpace(r.URL.Query().Get("reason"))
	if reason == "" {
		reason = defaultAdminRejectReason
	}

	req, err := a.rejectRegistrationRequest(token, reason)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			existing, lookupErr := a.getRegistrationRequestByModerationToken(token)
			if lookupErr != nil {
				a.renderModerationPage(w, http.StatusNotFound, "Р вЂ”Р В°РЎРЏР Р†Р С”Р В° Р Р…Р Вµ Р Р…Р В°Р в„–Р Т‘Р ВµР Р…Р В°", "Р вЂ”Р В°РЎРЏР Р†Р С”Р В° Р Р…Р Вµ Р Р…Р В°Р в„–Р Т‘Р ВµР Р…Р В° Р С‘Р В»Р С‘ РЎРѓРЎРѓРЎвЂ№Р В»Р С”Р В° РЎС“РЎРѓРЎвЂљР В°РЎР‚Р ВµР В»Р В°.")
				return
			}

			switch existing.Status {
			case registrationStatusRejected:
				rejectReason := defaultAdminRejectReason
				if existing.RejectionReason.Valid && strings.TrimSpace(existing.RejectionReason.String) != "" {
					rejectReason = existing.RejectionReason.String
				}
				if mailErr := a.sendRegistrationRejectedEmail(existing, rejectReason); mailErr != nil {
					a.logger.Printf("resend rejected email: %v", mailErr)
					a.renderModerationPage(w, http.StatusInternalServerError, "Р СџР С‘РЎРѓРЎРЉР СР С• Р Р…Р Вµ Р С•РЎвЂљР С—РЎР‚Р В°Р Р†Р В»Р ВµР Р…Р С•", "Р вЂ”Р В°РЎРЏР Р†Р С”Р В° РЎС“Р В¶Р Вµ Р С•РЎвЂљР С”Р В»Р С•Р Р…Р ВµР Р…Р В°, Р Р…Р С• Р С—Р С•Р Р†РЎвЂљР С•РЎР‚Р Р…Р С• Р С•РЎвЂљР С—РЎР‚Р В°Р Р†Р С‘РЎвЂљРЎРЉ Р С—Р С‘РЎРѓРЎРЉР СР С• Р Р…Р Вµ РЎС“Р Т‘Р В°Р В»Р С•РЎРѓРЎРЉ.")
					return
				}
				a.renderModerationPage(w, http.StatusOK, "Р вЂ”Р В°РЎРЏР Р†Р С”Р В° РЎС“Р В¶Р Вµ Р С•РЎвЂљР С”Р В»Р С•Р Р…Р ВµР Р…Р В°", "Р СџР С‘РЎРѓРЎРЉР СР С• РЎРѓ РЎР‚Р ВµРЎв‚¬Р ВµР Р…Р С‘Р ВµР С Р С•РЎвЂљР С—РЎР‚Р В°Р Р†Р В»Р ВµР Р…Р С• Р С—Р С•Р Р†РЎвЂљР С•РЎР‚Р Р…Р С•.")
			case registrationStatusApproved:
				a.renderModerationPage(w, http.StatusConflict, "Р вЂ”Р В°РЎРЏР Р†Р С”Р В° РЎС“Р В¶Р Вµ Р С•Р Т‘Р С•Р В±РЎР‚Р ВµР Р…Р В°", "Р В­РЎвЂљР В° Р В·Р В°РЎРЏР Р†Р С”Р В° РЎС“Р В¶Р Вµ Р С•Р Т‘Р С•Р В±РЎР‚Р ВµР Р…Р В°.")
			case registrationStatusCompleted:
				a.renderModerationPage(w, http.StatusConflict, "Р СџР С•Р В»РЎРЉР В·Р С•Р Р†Р В°РЎвЂљР ВµР В»РЎРЉ РЎС“Р В¶Р Вµ Р В°Р С”РЎвЂљР С‘Р Р†Р С‘РЎР‚Р С•Р Р†Р В°Р Р…", "Email РЎС“Р В¶Р Вµ Р С—Р С•Р Т‘РЎвЂљР Р†Р ВµРЎР‚Р В¶Р Т‘Р ВµР Р…, Р С—Р С•Р В»РЎРЉР В·Р С•Р Р†Р В°РЎвЂљР ВµР В»РЎРЉ Р В°Р С”РЎвЂљР С‘Р Р†Р С‘РЎР‚Р С•Р Р†Р В°Р Р….")
			default:
				a.renderModerationPage(w, http.StatusConflict, "Р вЂ”Р В°РЎРЏР Р†Р С”Р В° РЎС“Р В¶Р Вµ Р С•Р В±РЎР‚Р В°Р В±Р С•РЎвЂљР В°Р Р…Р В°", "Р В­РЎвЂљР В° РЎРѓРЎРѓРЎвЂ№Р В»Р С”Р В° РЎС“Р В¶Р Вµ Р В±РЎвЂ№Р В»Р В° Р С‘РЎРѓР С—Р С•Р В»РЎРЉР В·Р С•Р Р†Р В°Р Р…Р В°.")
			}
			return
		}

		a.logger.Printf("reject registration request: %v", err)
		a.renderModerationPage(w, http.StatusInternalServerError, "Р С›РЎв‚¬Р С‘Р В±Р С”Р В° РЎРѓР ВµРЎР‚Р Р†Р ВµРЎР‚Р В°", "Р С›РЎв‚¬Р С‘Р В±Р С”Р В° Р С—РЎР‚Р С‘ Р С•РЎвЂљР С”Р В»Р С•Р Р…Р ВµР Р…Р С‘Р С‘ Р В·Р В°РЎРЏР Р†Р С”Р С‘.")
		return
	}

	if err := a.sendRegistrationRejectedEmail(req, reason); err != nil {
		a.logger.Printf("send rejected email: %v", err)
		a.renderModerationPage(
			w,
			http.StatusInternalServerError,
			"Р СџР С‘РЎРѓРЎРЉР СР С• Р Р…Р Вµ Р С•РЎвЂљР С—РЎР‚Р В°Р Р†Р В»Р ВµР Р…Р С•",
			"Р вЂ”Р В°РЎРЏР Р†Р С”Р В° Р С•РЎвЂљР С”Р В»Р С•Р Р…Р ВµР Р…Р В°, Р Р…Р С• Р С—Р С‘РЎРѓРЎРЉР СР С• Р С•РЎвЂљР С—РЎР‚Р В°Р Р†Р С‘РЎвЂљРЎРЉ Р Р…Р Вµ РЎС“Р Т‘Р В°Р В»Р С•РЎРѓРЎРЉ. Р СњР В°Р В¶Р СР С‘РЎвЂљР Вµ РЎРЊРЎвЂљРЎС“ Р В¶Р Вµ РЎРѓРЎРѓРЎвЂ№Р В»Р С”РЎС“ Р ВµРЎвЂ°Р Вµ РЎР‚Р В°Р В· Р Т‘Р В»РЎРЏ Р С—Р С•Р Р†РЎвЂљР С•РЎР‚Р Р…Р С•Р в„– Р С•РЎвЂљР С—РЎР‚Р В°Р Р†Р С”Р С‘.",
		)
		return
	}

	a.renderModerationPage(w, http.StatusOK, "Р вЂ”Р В°РЎРЏР Р†Р С”Р В° Р С•РЎвЂљР С”Р В»Р С•Р Р…Р ВµР Р…Р В°", fmt.Sprintf("Р СњР В° %s Р С•РЎвЂљР С—РЎР‚Р В°Р Р†Р В»Р ВµР Р…Р С• Р С—Р С‘РЎРѓРЎРЉР СР С• РЎРѓ РЎР‚Р ВµРЎв‚¬Р ВµР Р…Р С‘Р ВµР С.", req.Email))
}

func (a *Application) handleVerifyEmail(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	token := strings.TrimSpace(r.URL.Query().Get("token"))
	if token == "" {
		a.renderPlainMessage(w, http.StatusBadRequest, "Р СџРЎС“РЎРѓРЎвЂљР С•Р в„– РЎвЂљР С•Р С”Р ВµР Р… Р С—Р С•Р Т‘РЎвЂљР Р†Р ВµРЎР‚Р В¶Р Т‘Р ВµР Р…Р С‘РЎРЏ email.")
		return
	}

	user, err := a.completeRegistrationByVerifyToken(token)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			a.renderPlainMessage(w, http.StatusBadRequest, "Р РЋРЎРѓРЎвЂ№Р В»Р С”Р В° Р С—Р С•Р Т‘РЎвЂљР Р†Р ВµРЎР‚Р В¶Р Т‘Р ВµР Р…Р С‘РЎРЏ Р Р…Р ВµР Т‘Р ВµР в„–РЎРѓРЎвЂљР Р†Р С‘РЎвЂљР ВµР В»РЎРЉР Р…Р В° Р С‘Р В»Р С‘ РЎС“Р В¶Р Вµ Р С‘РЎРѓР С—Р С•Р В»РЎРЉР В·Р С•Р Р†Р В°Р Р…Р В°.")
			return
		}
		a.logger.Printf("complete registration by verify token: %v", err)
		a.renderPlainMessage(w, http.StatusInternalServerError, "Р С›РЎв‚¬Р С‘Р В±Р С”Р В° Р С—РЎР‚Р С‘ Р С—Р С•Р Т‘РЎвЂљР Р†Р ВµРЎР‚Р В¶Р Т‘Р ВµР Р…Р С‘Р С‘ email.")
		return
	}

	sessionToken, expiresAt, err := a.createSession(user.ID)
	if err != nil {
		a.logger.Printf("create session after email verify: %v", err)
		a.renderPlainMessage(w, http.StatusInternalServerError, "Email Р С—Р С•Р Т‘РЎвЂљР Р†Р ВµРЎР‚Р В¶Р Т‘Р ВµР Р…, Р Р…Р С• Р Р†РЎвЂ¦Р С•Р Т‘ Р Р†РЎвЂ№Р С—Р С•Р В»Р Р…Р С‘РЎвЂљРЎРЉ Р Р…Р Вµ РЎС“Р Т‘Р В°Р В»Р С•РЎРѓРЎРЉ.")
		return
	}

	http.SetCookie(w, a.sessionCookie(sessionToken, expiresAt))
	http.Redirect(w, r, "/app", http.StatusSeeOther)
}

func (a *Application) handleDashboard(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	user := userFromContext(r.Context())
	if user == nil {
		http.Redirect(w, r, "/auth/login", http.StatusSeeOther)
		return
	}

	data := a.appViewData(user, "РљРѕРЅС‚СѓСЂ Р·РЅР°РЅРёР№")
	data.CurrentPage = "dashboard"
	data.Success = strings.TrimSpace(r.URL.Query().Get("success"))

	recent, err := a.getRecentArticles(8)
	if err != nil {
		a.logger.Printf("get recent articles: %v", err)
	} else {
		decorateArticles(recent)
		data.RecentArticles = recent
	}

	a.renderTemplate(w, "dashboard.tmpl", data)
}

func (a *Application) handleSection(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	user := userFromContext(r.Context())
	if user == nil {
		http.Redirect(w, r, "/auth/login", http.StatusSeeOther)
		return
	}

	sectionSlug := strings.TrimSpace(r.URL.Query().Get("slug"))
	section, ok := findWikiSection(sectionSlug)
	if !ok {
		http.NotFound(w, r)
		return
	}
	currentSubsection := normalizeSubsection(section, r.URL.Query().Get("sub"))

	data := a.appViewData(user, "Раздел: "+section.Name)
	data.CurrentPage = "section"
	data.CurrentSection = &section
	data.CurrentSectionSlug = section.Slug
	data.CurrentSubsection = currentSubsection
	data.Success = strings.TrimSpace(r.URL.Query().Get("success"))

	articles, err := a.getArticlesBySection(section.Slug, 100)
	if err != nil {
		a.logger.Printf("get articles by section: %v", err)
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}
	decorateArticles(articles)
	data.SectionArticles = articles

	a.renderTemplate(w, "section.tmpl", data)
}
func (a *Application) handleArticleNew(w http.ResponseWriter, r *http.Request) {
	user := userFromContext(r.Context())
	if user == nil {
		http.Redirect(w, r, "/auth/login", http.StatusSeeOther)
		return
	}

	switch r.Method {
	case http.MethodGet:
		sectionSlug := strings.TrimSpace(r.URL.Query().Get("section"))
		section, ok := findWikiSection(sectionSlug)
		if !ok {
			http.Redirect(w, r, "/app", http.StatusSeeOther)
			return
		}
		currentSubsection := normalizeSubsection(section, r.URL.Query().Get("sub"))

		data := a.appViewData(user, "Новая статья")
		data.CurrentPage = "article-new"
		data.CurrentSection = &section
		data.CurrentSectionSlug = section.Slug
		data.CurrentSubsection = currentSubsection
		a.renderTemplate(w, "article_new.tmpl", data)
	case http.MethodPost:
		if err := r.ParseForm(); err != nil {
			http.Error(w, "invalid form data", http.StatusBadRequest)
			return
		}

		sectionSlug := strings.TrimSpace(r.FormValue("section"))
		section, ok := findWikiSection(sectionSlug)
		if !ok {
			http.Error(w, "unknown section", http.StatusBadRequest)
			return
		}
		currentSubsection := normalizeSubsection(section, r.FormValue("subsection"))

		title := strings.TrimSpace(r.FormValue("title"))
		body := strings.TrimSpace(r.FormValue("body"))

		data := a.appViewData(user, "Новая статья")
		data.CurrentPage = "article-new"
		data.CurrentSection = &section
		data.CurrentSectionSlug = section.Slug
		data.CurrentSubsection = currentSubsection
		data.ArticleTitle = title
		data.ArticleBody = body

		if utf8.RuneCountInString(title) < 4 {
			data.Error = "Заголовок должен быть минимум 4 символа."
			a.renderTemplate(w, "article_new.tmpl", data)
			return
		}

		if utf8.RuneCountInString(body) < 20 {
			data.Error = "Текст статьи должен быть минимум 20 символов."
			a.renderTemplate(w, "article_new.tmpl", data)
			return
		}

		if _, err := a.createArticle(user.ID, section.Slug, title, body); err != nil {
			a.logger.Printf("create article: %v", err)
			http.Error(w, "internal server error", http.StatusInternalServerError)
			return
		}

		success := url.QueryEscape("Статья сохранена.")
		target := "/app/section?slug=" + url.QueryEscape(section.Slug)
		if currentSubsection != "" {
			target += "&sub=" + url.QueryEscape(currentSubsection)
		}
		target += "&success=" + success
		http.Redirect(w, r, target, http.StatusSeeOther)
	default:
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
	}
}
func (a *Application) handleS3Check(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	user := userFromContext(r.Context())
	if user == nil {
		http.Redirect(w, r, "/auth/login", http.StatusSeeOther)
		return
	}

	data := a.appViewData(user, "РџСЂРѕРІРµСЂРєР° S3")
	data.CurrentPage = "s3"

	if strings.TrimSpace(r.URL.Query().Get("run")) == "1" {
		result := a.checkS3(r.Context())
		data.S3Check = &result
	}

	a.renderTemplate(w, "s3_check.tmpl", data)
}
func (a *Application) handleLogout(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	if cookie, err := r.Cookie(a.cfg.SessionCookieName); err == nil {
		if err := a.deleteSessionByToken(cookie.Value); err != nil {
			a.logger.Printf("delete session on logout: %v", err)
		}
	}

	a.clearSessionCookie(w)
	http.Redirect(w, r, "/auth/login?success=Р вЂ™РЎвЂ№ Р Р†РЎвЂ№РЎв‚¬Р В»Р С‘ Р С‘Р В· РЎРѓР С‘РЎРѓРЎвЂљР ВµР СРЎвЂ№.", http.StatusSeeOther)
}

func (a *Application) renderModerationPage(w http.ResponseWriter, status int, title string, message string) {
	pageTitle := strings.TrimSpace(title)
	if pageTitle == "" {
		pageTitle = "Р РЋРЎвЂљР В°РЎвЂљРЎС“РЎРѓ Р СР С•Р Т‘Р ВµРЎР‚Р В°РЎвЂ Р С‘Р С‘"
	}

	pageMessage := strings.TrimSpace(message)
	if pageMessage == "" {
		pageMessage = "Р С›Р С—Р ВµРЎР‚Р В°РЎвЂ Р С‘РЎРЏ Р В·Р В°Р Р†Р ВµРЎР‚РЎв‚¬Р ВµР Р…Р В°."
	}

	appName := strings.TrimSpace(a.cfg.AppName)
	if appName == "" {
		appName = "Kontur Znaniy"
	}

	accent := "#0d766d"
	glow := "rgba(13, 118, 109, 0.28)"
	badge := "Р СљР С•Р Т‘Р ВµРЎР‚Р В°РЎвЂ Р С‘РЎРЏ"
	if status >= http.StatusInternalServerError {
		accent = "#8f2d3f"
		glow = "rgba(143, 45, 63, 0.28)"
		badge = "Р РЋР В±Р С•Р в„–"
	} else if status >= http.StatusBadRequest {
		accent = "#9a5b2f"
		glow = "rgba(154, 91, 47, 0.28)"
		badge = "Р вЂ™Р Р…Р С‘Р СР В°Р Р…Р С‘Р Вµ"
	}

	escapedTitle := html.EscapeString(pageTitle)
	escapedMessage := html.EscapeString(pageMessage)
	escapedMessage = strings.ReplaceAll(escapedMessage, "\n", "<br />")
	escapedAppName := html.EscapeString(appName)
	escapedBadge := html.EscapeString(badge)

	actionHref := "/auth/login"
	actionLabel := "Р С›РЎвЂљР С”РЎР‚РЎвЂ№РЎвЂљРЎРЉ Р Р†РЎвЂ¦Р С•Р Т‘"
	if status >= http.StatusBadRequest {
		actionHref = "/auth/register"
		actionLabel = "Р вЂ™Р ВµРЎР‚Р Р…РЎС“РЎвЂљРЎРЉРЎРѓРЎРЏ Р С” РЎвЂћР С•РЎР‚Р СР Вµ"
	}

	page := fmt.Sprintf(`<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>%s Р’В· %s</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@500;600&family=Manrope:wght@500;600;700;800&display=swap" rel="stylesheet" />
  <style>
    :root { color-scheme: only light; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      display: grid;
      place-items: center;
      padding: 24px;
      font-family: "Manrope", "Segoe UI", "Trebuchet MS", sans-serif;
      background:
        radial-gradient(circle at 12%% 10%%, rgba(13, 118, 109, 0.25), transparent 36%%),
        radial-gradient(circle at 86%% 8%%, rgba(201, 153, 96, 0.22), transparent 30%%),
        linear-gradient(160deg, #f2f4ee 0%%, #e7ece4 100%%);
      color: #17211f;
    }
    .panel {
      width: min(640px, 100%%);
      border: 1px solid #d3ddd7;
      border-radius: 22px;
      overflow: hidden;
      background: rgba(255, 255, 255, 0.9);
      box-shadow: 0 22px 58px %s;
      animation: panel-in .28s ease-out both;
    }
    .head {
      padding: 20px 24px;
      color: #f4fffc;
      background: linear-gradient(145deg, #0b5e57 0%%, #0d766d 58%%, #1a8d84 100%%);
    }
    .eyebrow {
      margin: 0 0 8px;
      letter-spacing: .14em;
      text-transform: uppercase;
      font-size: 12px;
      font-family: "IBM Plex Mono", "Consolas", monospace;
      color: rgba(237, 253, 248, .88);
    }
    .title {
      margin: 0;
      font-size: clamp(28px, 4vw, 34px);
      line-height: 1.1;
    }
    .body {
      padding: 22px 24px 24px;
      display: grid;
      gap: 16px;
    }
    .badge {
      width: fit-content;
      border-radius: 999px;
      padding: 6px 12px;
      border: 1px solid rgba(23, 33, 31, 0.14);
      background: #f8fbf8;
      color: #52645e;
      font-size: 12px;
      font-family: "IBM Plex Mono", "Consolas", monospace;
      text-transform: uppercase;
      letter-spacing: .08em;
    }
    .message {
      margin: 0;
      line-height: 1.65;
      color: #31413c;
      font-size: 16px;
    }
    .actions {
      display: flex;
      gap: 12px;
      align-items: center;
      flex-wrap: wrap;
      padding-top: 6px;
    }
    .action-link {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      border-radius: 12px;
      padding: 11px 16px;
      font-weight: 700;
      color: #ffffff;
      text-decoration: none;
      background: %s;
      box-shadow: 0 14px 34px %s;
    }
    .action-link:hover { filter: brightness(1.05); }
    .muted {
      font-size: 13px;
      color: #63766f;
    }
    @keyframes panel-in {
      from { opacity: 0; transform: translateY(8px) scale(.992); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }
    @media (max-width: 680px) {
      .head { padding: 18px 18px; }
      .body { padding: 18px 18px 20px; }
      .title { font-size: 27px; }
    }
  </style>
</head>
<body>
  <main class="panel">
    <header class="head">
      <p class="eyebrow">%s Р’В· %s</p>
      <h1 class="title">%s</h1>
    </header>
    <section class="body">
      <span class="badge">%s</span>
      <p class="message">%s</p>
      <div class="actions">
        <a class="action-link" href="%s">%s</a>
        <span class="muted">Р СљР С•Р В¶Р Р…Р С• Р В·Р В°Р С”РЎР‚РЎвЂ№РЎвЂљРЎРЉ Р Р†Р С”Р В»Р В°Р Т‘Р С”РЎС“ Р С—Р С•РЎРѓР В»Р Вµ Р С—РЎР‚Р С•РЎРѓР СР С•РЎвЂљРЎР‚Р В°.</span>
      </div>
    </section>
  </main>
</body>
</html>`,
		escapedTitle,
		escapedAppName,
		glow,
		accent,
		glow,
		escapedAppName,
		escapedBadge,
		escapedTitle,
		escapedBadge,
		escapedMessage,
		html.EscapeString(actionHref),
		html.EscapeString(actionLabel),
	)

	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.WriteHeader(status)
	_, _ = w.Write([]byte(page))
}

func (a *Application) renderPlainMessage(w http.ResponseWriter, status int, message string) {
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	w.WriteHeader(status)
	_, _ = w.Write([]byte(message))
}
