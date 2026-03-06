package app

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"html"
	"net"
	"net/http"
	"net/mail"
	"net/url"
	"strings"
	"sync"
	"time"
	"unicode/utf8"

	"golang.org/x/crypto/bcrypt"
)

func blockedLoginMessage() string {
	return "Ваш аккаунт на паузе: доступ временно выключен администратором. Логи не паникуют, сервер тоже."
}

const (
	rateLimitActionLoginIP    = "login_ip"
	rateLimitActionLoginEmail = "login_email"
	rateLimitActionRegisterIP = "register_ip"

	loginRateLimitWindow      = 15 * time.Minute
	loginRateLimitBlockFor    = 20 * time.Minute
	loginRateLimitMaxAttempts = 5

	registerRateLimitWindow      = 40 * time.Minute
	registerRateLimitBlockFor    = 45 * time.Minute
	registerRateLimitMaxAttempts = 8
)

func requestClientIdentifier(r *http.Request) string {
	if r == nil {
		return ""
	}

	if forwarded := strings.TrimSpace(r.Header.Get("X-Forwarded-For")); forwarded != "" {
		parts := strings.Split(forwarded, ",")
		if len(parts) > 0 {
			if value := strings.TrimSpace(parts[0]); value != "" {
				return value
			}
		}
	}

	if realIP := strings.TrimSpace(r.Header.Get("X-Real-IP")); realIP != "" {
		return realIP
	}

	host, _, err := net.SplitHostPort(strings.TrimSpace(r.RemoteAddr))
	if err == nil {
		return strings.TrimSpace(host)
	}

	return strings.TrimSpace(r.RemoteAddr)
}

func rateLimitMessage(until time.Time, now time.Time) string {
	if until.IsZero() {
		return "Слишком много попыток. Повторите чуть позже."
	}

	remaining := until.Sub(now)
	if remaining <= 0 {
		return "Слишком много попыток. Повторите чуть позже."
	}

	minutes := int(remaining.Minutes())
	if remaining%time.Minute != 0 {
		minutes++
	}
	if minutes < 1 {
		minutes = 1
	}

	return fmt.Sprintf("Слишком много попыток. Попробуйте снова через %d мин.", minutes)
}
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
		if user.Blocked {
			if cookie, cookieErr := r.Cookie(a.cfg.SessionCookieName); cookieErr == nil {
				if delErr := a.deleteSessionByToken(cookie.Value); delErr != nil {
					a.logger.Printf("delete blocked user session: %v", delErr)
				}
			}
			a.clearSessionCookie(w)
			a.renderBlockedAccessPage(w, user)
			return
		}

		next(w, r.WithContext(contextWithUser(r.Context(), user)))
	}
}

func contextWithUser(ctx context.Context, user *User) context.Context {
	return context.WithValue(ctx, userContextKey, user)
}

func (a *Application) authViewData(title string) viewData {
	data := viewData{AppName: a.cfg.AppName, Title: title}

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
		AppName:             a.cfg.AppName,
		Title:               title,
		User:                user,
		Sections:            wikiSections(),
		MediaUploadEndpoint: a.mediaUploadEndpoint(),
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
		if user.Blocked {
			a.renderBlockedAccessPage(w, user)
			return
		}
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
			if user.Blocked {
				a.clearSessionCookie(w)
				data := a.authViewData("Вход")
				data.Error = blockedLoginMessage()
				data.Next = strings.TrimSpace(r.URL.Query().Get("next"))
				a.renderTemplate(w, r, "login.tmpl", data)
				return
			}
			http.Redirect(w, r, "/app", http.StatusSeeOther)
			return
		}

		data := a.authViewData("Вход")
		data.Success = strings.TrimSpace(r.URL.Query().Get("success"))
		data.Next = strings.TrimSpace(r.URL.Query().Get("next"))
		a.renderTemplate(w, r, "login.tmpl", data)
	case http.MethodPost:
		if err := r.ParseForm(); err != nil {
			http.Error(w, "invalid form data", http.StatusBadRequest)
			return
		}

		email := normalizeEmail(r.FormValue("email"))
		password := r.FormValue("password")
		next := strings.TrimSpace(r.FormValue("next"))
		now := time.Now().UTC()
		clientKey := requestClientIdentifier(r)

		data := a.authViewData("Вход")
		data.Email = email
		data.Next = next

		maxBlockUntil := time.Time{}
		if until, blocked, err := a.getRateLimitBlockUntil(rateLimitActionLoginIP, clientKey, now); err != nil {
			a.logger.Printf("check login ip rate limit: %v", err)
			http.Error(w, "internal server error", http.StatusInternalServerError)
			return
		} else if blocked {
			maxBlockUntil = until
		}
		if email != "" {
			if until, blocked, err := a.getRateLimitBlockUntil(rateLimitActionLoginEmail, email, now); err != nil {
				a.logger.Printf("check login email rate limit: %v", err)
				http.Error(w, "internal server error", http.StatusInternalServerError)
				return
			} else if blocked && until.After(maxBlockUntil) {
				maxBlockUntil = until
			}
		}
		if !maxBlockUntil.IsZero() {
			data.Error = rateLimitMessage(maxBlockUntil, now)
			a.renderTemplate(w, r, "login.tmpl", data)
			return
		}

		renderFailedLogin := func(message string) {
			blockUntil := time.Time{}

			if until, blocked, err := a.registerRateLimitFailure(rateLimitActionLoginIP, clientKey, now, loginRateLimitWindow, loginRateLimitMaxAttempts, loginRateLimitBlockFor); err != nil {
				a.logger.Printf("register login ip rate limit failure: %v", err)
			} else if blocked {
				blockUntil = until
			}

			if email != "" {
				if until, blocked, err := a.registerRateLimitFailure(rateLimitActionLoginEmail, email, now, loginRateLimitWindow, loginRateLimitMaxAttempts, loginRateLimitBlockFor); err != nil {
					a.logger.Printf("register login email rate limit failure: %v", err)
				} else if blocked && until.After(blockUntil) {
					blockUntil = until
				}
			}

			if !blockUntil.IsZero() {
				message = rateLimitMessage(blockUntil, now)
			}

			data.Error = message
			a.renderTemplate(w, r, "login.tmpl", data)
		}

		if email == "" || password == "" {
			renderFailedLogin("Введите email и пароль.")
			return
		}

		creds, err := a.getCredentialsByEmail(email)
		if err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				message := "Неверный email или пароль."
				if reg, regErr := a.getRegistrationRequestByEmail(email); regErr == nil {
					switch reg.Status {
					case registrationStatusPending:
						message = "Заявка еще на рассмотрении. Дождитесь решения по почте."
					case registrationStatusApproved:
						message = "Заявка уже одобрена. Подтвердите email из письма."
					case registrationStatusRejected:
						message = "Заявка отклонена. Можно отправить новую."
					}
				}
				renderFailedLogin(message)
				return
			}
			a.logger.Printf("get credentials by email: %v", err)
			http.Error(w, "internal server error", http.StatusInternalServerError)
			return
		}

		if err := bcrypt.CompareHashAndPassword([]byte(creds.PasswordHash), []byte(password)); err != nil {
			renderFailedLogin("Неверный email или пароль.")
			return
		}
		if creds.Blocked {
			data.Error = blockedLoginMessage()
			a.renderTemplate(w, r, "login.tmpl", data)
			return
		}

		token, expiresAt, err := a.createSession(creds.ID)
		if err != nil {
			a.logger.Printf("create session: %v", err)
			http.Error(w, "internal server error", http.StatusInternalServerError)
			return
		}

		if err := a.clearRateLimit(rateLimitActionLoginIP, clientKey); err != nil {
			a.logger.Printf("clear login ip rate limit: %v", err)
		}
		if email != "" {
			if err := a.clearRateLimit(rateLimitActionLoginEmail, email); err != nil {
				a.logger.Printf("clear login email rate limit: %v", err)
			}
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
			if user.Blocked {
				a.clearSessionCookie(w)
				data := a.authViewData("Вход")
				data.Error = blockedLoginMessage()
				a.renderTemplate(w, r, "login.tmpl", data)
				return
			}
			http.Redirect(w, r, "/app", http.StatusSeeOther)
			return
		}

		a.renderTemplate(w, r, "register.tmpl", a.authViewData("Регистрация"))
	case http.MethodPost:
		if err := r.ParseForm(); err != nil {
			http.Error(w, "invalid form data", http.StatusBadRequest)
			return
		}

		name := strings.TrimSpace(r.FormValue("name"))
		email := normalizeEmail(r.FormValue("email"))
		password := r.FormValue("password")
		confirmPassword := r.FormValue("confirm_password")
		now := time.Now().UTC()
		clientKey := requestClientIdentifier(r)

		data := a.authViewData("Регистрация")
		data.Name = name
		data.Email = email

		if until, blocked, err := a.getRateLimitBlockUntil(rateLimitActionRegisterIP, clientKey, now); err != nil {
			a.logger.Printf("check register ip rate limit: %v", err)
			http.Error(w, "internal server error", http.StatusInternalServerError)
			return
		} else if blocked {
			data.Error = rateLimitMessage(until, now)
			a.renderTemplate(w, r, "register.tmpl", data)
			return
		}

		renderRegisterFailure := func(message string, countFailure bool) {
			if countFailure {
				if until, blocked, err := a.registerRateLimitFailure(rateLimitActionRegisterIP, clientKey, now, registerRateLimitWindow, registerRateLimitMaxAttempts, registerRateLimitBlockFor); err != nil {
					a.logger.Printf("register ip rate limit failure: %v", err)
				} else if blocked {
					message = rateLimitMessage(until, now)
				}
			}

			data.Error = message
			a.renderTemplate(w, r, "register.tmpl", data)
		}

		if !a.hasRegistrationIntegrations() {
			renderRegisterFailure("Регистрация временно недоступна: не настроены SMTP/Telegram интеграции.", false)
			return
		}

		if len(name) < 2 {
			renderRegisterFailure("Ник должен быть минимум 2 символа.", true)
			return
		}

		if _, err := mail.ParseAddress(email); err != nil {
			renderRegisterFailure("Введите корректный email.", true)
			return
		}

		if len(password) < 10 {
			renderRegisterFailure("Пароль должен быть не короче 10 символов.", true)
			return
		}

		if password != confirmPassword {
			renderRegisterFailure("Пароли не совпадают.", true)
			return
		}

		if existingUser, err := a.getUserByEmail(email); err == nil && existingUser != nil {
			renderRegisterFailure("Аккаунт с таким email уже существует.", true)
			return
		} else if err != nil && !errors.Is(err, sql.ErrNoRows) {
			a.logger.Printf("lookup existing user by email: %v", err)
			http.Error(w, "internal server error", http.StatusInternalServerError)
			return
		}

		if existingReq, err := a.getRegistrationRequestByEmail(email); err == nil {
			switch existingReq.Status {
			case registrationStatusPending:
				renderRegisterFailure("Заявка уже отправлена и ожидает решения.", true)
				return
			case registrationStatusApproved:
				renderRegisterFailure("Заявка уже одобрена. Подтвердите email из письма.", true)
				return
			case registrationStatusCompleted:
				if _, userErr := a.getUserByEmail(email); userErr == nil {
					renderRegisterFailure("Этот email уже подтвержден. Войдите в аккаунт.", true)
					return
				} else if !errors.Is(userErr, sql.ErrNoRows) {
					a.logger.Printf("lookup user for completed registration request: %v", userErr)
					http.Error(w, "internal server error", http.StatusInternalServerError)
					return
				}
			}
		} else if !errors.Is(err, sql.ErrNoRows) {
			a.logger.Printf("lookup registration request by email: %v", err)
			http.Error(w, "internal server error", http.StatusInternalServerError)
			return
		}

		if existingByName, err := a.getUserByName(name); err == nil && existingByName != nil {
			renderRegisterFailure("Ник уже занят. Выберите другой.", true)
			return
		} else if err != nil && !errors.Is(err, sql.ErrNoRows) {
			a.logger.Printf("lookup existing user by name: %v", err)
			http.Error(w, "internal server error", http.StatusInternalServerError)
			return
		}

		if activeReqByName, err := a.getActiveRegistrationRequestByName(name); err == nil && activeReqByName != nil {
			renderRegisterFailure("Ник уже занят в другой заявке. Выберите другой.", true)
			return
		} else if err != nil && !errors.Is(err, sql.ErrNoRows) {
			a.logger.Printf("lookup registration request by name: %v", err)
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
			if isUniqueNameError(err) {
				renderRegisterFailure("Ник уже занят. Выберите другой.", true)
				return
			}
			a.logger.Printf("upsert registration request: %v", err)
			http.Error(w, "internal server error", http.StatusInternalServerError)
			return
		}

		if err := a.sendRegistrationRequestToTelegram(request, r); err != nil {
			a.logger.Printf("send registration request to telegram: %v", err)
			if delErr := a.deleteRegistrationRequestByEmail(email); delErr != nil {
				a.logger.Printf("rollback registration request after telegram error: %v", delErr)
			}
			renderRegisterFailure("Не удалось отправить заявку модератору. Попробуйте еще раз позже.", false)
			return
		}

		if err := a.clearRateLimit(rateLimitActionRegisterIP, clientKey); err != nil {
			a.logger.Printf("clear register ip rate limit: %v", err)
		}

		success := url.QueryEscape("Заявка отправлена. После решения модератора придет письмо.")
		http.Redirect(w, r, "/auth/login?success="+success, http.StatusSeeOther)
	default:
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
	}
}

func (a *Application) handleApproveRegistration(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		token := strings.TrimSpace(r.URL.Query().Get("token"))
		if token == "" {
			a.renderModerationPage(w, http.StatusBadRequest, "Некорректная ссылка", "Пустой токен модерации.")
			return
		}

		req, err := a.getRegistrationRequestByModerationToken(token)
		if err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				a.renderModerationPage(w, http.StatusNotFound, "Заявка не найдена", "Заявка не найдена или ссылка устарела.")
				return
			}
			a.logger.Printf("lookup registration request for approve page: %v", err)
			a.renderModerationPage(w, http.StatusInternalServerError, "Ошибка сервера", "Не удалось открыть страницу модерации.")
			return
		}

		switch req.Status {
		case registrationStatusPending:
			message := fmt.Sprintf("Заявка от %s (%s) ожидает одобрения. После подтверждения отправим письмо для верификации email.", req.Name, req.Email)
			a.renderModerationConfirmPage(w, r, "Подтвердить одобрение", message, "/admin/registration/approve", token, "Одобрить заявку", false, "")
		case registrationStatusApproved:
			if req.EmailVerifyToken.Valid && strings.TrimSpace(req.EmailVerifyToken.String) != "" {
				message := fmt.Sprintf("Заявка для %s уже одобрена. Можно отправить письмо с подтверждением повторно.", req.Email)
				a.renderModerationConfirmPage(w, r, "Заявка уже одобрена", message, "/admin/registration/approve", token, "Отправить письмо повторно", false, "")
				return
			}
			a.renderModerationPage(w, http.StatusOK, "Заявка уже одобрена", "Эта заявка уже была обработана ранее.")
		case registrationStatusRejected:
			a.renderModerationPage(w, http.StatusConflict, "Заявка уже отклонена", "Эта заявка уже отклонена.")
		case registrationStatusCompleted:
			a.renderModerationPage(w, http.StatusConflict, "Пользователь уже активирован", "Email уже подтвержден, пользователь активирован.")
		default:
			a.renderModerationPage(w, http.StatusConflict, "Заявка уже обработана", "Эта ссылка уже использована.")
		}
	case http.MethodPost:
		if err := r.ParseForm(); err != nil {
			a.renderModerationPage(w, http.StatusBadRequest, "Некорректный запрос", "Не удалось прочитать форму.")
			return
		}

		token := strings.TrimSpace(r.FormValue("token"))
		if token == "" {
			a.renderModerationPage(w, http.StatusBadRequest, "Некорректная ссылка", "Пустой токен модерации.")
			return
		}

		emailVerifyToken, err := generateSessionToken()
		if err != nil {
			a.logger.Printf("generate email verify token: %v", err)
			a.renderModerationPage(w, http.StatusInternalServerError, "Ошибка сервера", "Не удалось сгенерировать токен подтверждения email.")
			return
		}

		req, err := a.approveRegistrationRequest(token, emailVerifyToken)
		if err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				existing, lookupErr := a.getRegistrationRequestByModerationToken(token)
				if lookupErr != nil {
					a.renderModerationPage(w, http.StatusNotFound, "Заявка не найдена", "Заявка не найдена или ссылка устарела.")
					return
				}

				switch existing.Status {
				case registrationStatusApproved:
					if existing.EmailVerifyToken.Valid && strings.TrimSpace(existing.EmailVerifyToken.String) != "" {
						if mailErr := a.sendRegistrationApprovedEmail(existing); mailErr != nil {
							a.logger.Printf("resend approved email: %v", mailErr)
							a.renderModerationPage(w, http.StatusInternalServerError, "Письмо не отправлено", "Заявка уже одобрена, но письмо отправить не удалось.")
							return
						}
						a.renderModerationPage(w, http.StatusOK, "Заявка уже одобрена", "Письмо отправлено повторно.")
						return
					}
					a.renderModerationPage(w, http.StatusOK, "Заявка уже одобрена", "Эта заявка уже была обработана ранее.")
				case registrationStatusRejected:
					a.renderModerationPage(w, http.StatusConflict, "Заявка уже отклонена", "Эта заявка уже отклонена.")
				case registrationStatusCompleted:
					a.renderModerationPage(w, http.StatusConflict, "Пользователь уже активирован", "Email уже подтвержден, пользователь активирован.")
				default:
					a.renderModerationPage(w, http.StatusConflict, "Заявка уже обработана", "Эта ссылка уже использована.")
				}
				return
			}

			a.logger.Printf("approve registration request: %v", err)
			a.renderModerationPage(w, http.StatusInternalServerError, "Ошибка сервера", "Ошибка при одобрении заявки.")
			return
		}

		if err := a.sendRegistrationApprovedEmail(req); err != nil {
			a.logger.Printf("send approved email: %v", err)
			a.renderModerationPage(w, http.StatusInternalServerError, "Письмо не отправлено", "Заявка одобрена, но письмо отправить не удалось. Нажмите эту ссылку снова для повторной отправки.")
			return
		}

		a.renderModerationPage(w, http.StatusOK, "Заявка одобрена", fmt.Sprintf("На %s отправлено письмо с подтверждением.", req.Email))
	default:
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
	}
}

func (a *Application) handleRejectRegistration(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case http.MethodGet:
		token := strings.TrimSpace(r.URL.Query().Get("token"))
		if token == "" {
			a.renderModerationPage(w, http.StatusBadRequest, "Некорректная ссылка", "Пустой токен модерации.")
			return
		}

		req, err := a.getRegistrationRequestByModerationToken(token)
		if err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				a.renderModerationPage(w, http.StatusNotFound, "Заявка не найдена", "Заявка не найдена или ссылка устарела.")
				return
			}
			a.logger.Printf("lookup registration request for reject page: %v", err)
			a.renderModerationPage(w, http.StatusInternalServerError, "Ошибка сервера", "Не удалось открыть страницу модерации.")
			return
		}

		reason := strings.TrimSpace(r.URL.Query().Get("reason"))
		if reason == "" {
			reason = defaultAdminRejectReason
		}

		switch req.Status {
		case registrationStatusPending:
			message := fmt.Sprintf("Заявка от %s (%s) ожидает решения. Укажите причину (опционально) и подтвердите отклонение.", req.Name, req.Email)
			a.renderModerationConfirmPage(w, r, "Подтвердить отклонение", message, "/admin/registration/reject", token, "Отклонить заявку", true, reason)
		case registrationStatusRejected:
			rejectReason := defaultAdminRejectReason
			if req.RejectionReason.Valid && strings.TrimSpace(req.RejectionReason.String) != "" {
				rejectReason = strings.TrimSpace(req.RejectionReason.String)
			}
			message := fmt.Sprintf("Заявка для %s уже отклонена. Можно отправить письмо с текущей причиной повторно.", req.Email)
			a.renderModerationConfirmPage(w, r, "Заявка уже отклонена", message, "/admin/registration/reject", token, "Отправить письмо повторно", true, rejectReason)
		case registrationStatusApproved:
			a.renderModerationPage(w, http.StatusConflict, "Заявка уже одобрена", "Эта заявка уже одобрена.")
		case registrationStatusCompleted:
			a.renderModerationPage(w, http.StatusConflict, "Пользователь уже активирован", "Email уже подтвержден, пользователь активирован.")
		default:
			a.renderModerationPage(w, http.StatusConflict, "Заявка уже обработана", "Эта ссылка уже использована.")
		}
	case http.MethodPost:
		if err := r.ParseForm(); err != nil {
			a.renderModerationPage(w, http.StatusBadRequest, "Некорректный запрос", "Не удалось прочитать форму.")
			return
		}

		token := strings.TrimSpace(r.FormValue("token"))
		if token == "" {
			a.renderModerationPage(w, http.StatusBadRequest, "Некорректная ссылка", "Пустой токен модерации.")
			return
		}

		reason := strings.TrimSpace(r.FormValue("reason"))
		if reason == "" {
			reason = defaultAdminRejectReason
		}

		req, err := a.rejectRegistrationRequest(token, reason)
		if err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				existing, lookupErr := a.getRegistrationRequestByModerationToken(token)
				if lookupErr != nil {
					a.renderModerationPage(w, http.StatusNotFound, "Заявка не найдена", "Заявка не найдена или ссылка устарела.")
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
						a.renderModerationPage(w, http.StatusInternalServerError, "Письмо не отправлено", "Заявка уже отклонена, но письмо отправить не удалось.")
						return
					}
					a.renderModerationPage(w, http.StatusOK, "Заявка уже отклонена", "Письмо отправлено повторно.")
				case registrationStatusApproved:
					a.renderModerationPage(w, http.StatusConflict, "Заявка уже одобрена", "Эта заявка уже одобрена.")
				case registrationStatusCompleted:
					a.renderModerationPage(w, http.StatusConflict, "Пользователь уже активирован", "Email уже подтвержден, пользователь активирован.")
				default:
					a.renderModerationPage(w, http.StatusConflict, "Заявка уже обработана", "Эта ссылка уже использована.")
				}
				return
			}

			a.logger.Printf("reject registration request: %v", err)
			a.renderModerationPage(w, http.StatusInternalServerError, "Ошибка сервера", "Ошибка при отклонении заявки.")
			return
		}

		if err := a.sendRegistrationRejectedEmail(req, reason); err != nil {
			a.logger.Printf("send rejected email: %v", err)
			a.renderModerationPage(w, http.StatusInternalServerError, "Письмо не отправлено", "Заявка отклонена, но письмо отправить не удалось. Нажмите эту ссылку снова для повторной отправки.")
			return
		}

		a.renderModerationPage(w, http.StatusOK, "Заявка отклонена", fmt.Sprintf("На %s отправлено письмо с решением.", req.Email))
	default:
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
	}
}

func (a *Application) handleVerifyEmail(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	token := strings.TrimSpace(r.URL.Query().Get("token"))
	if token == "" {
		a.renderPlainMessage(w, http.StatusBadRequest, "Пустой токен подтверждения email.")
		return
	}

	user, err := a.completeRegistrationByVerifyToken(token)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			a.renderPlainMessage(w, http.StatusBadRequest, "Ссылка подтверждения недействительна или уже использована.")
			return
		}
		if errors.Is(err, errRegistrationNameTaken) {
			a.renderPlainMessage(w, http.StatusConflict, "Ник уже занят другим пользователем. Отправьте новую заявку с другим ником.")
			return
		}
		a.logger.Printf("complete registration by verify token: %v", err)
		a.renderPlainMessage(w, http.StatusInternalServerError, "Ошибка при подтверждении email.")
		return
	}

	sessionToken, expiresAt, err := a.createSession(user.ID)
	if err != nil {
		a.logger.Printf("create session after email verify: %v", err)
		a.renderPlainMessage(w, http.StatusInternalServerError, "Email подтвержден, но выполнить вход не удалось.")
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

	data := a.appViewData(user, "Контур знаний")
	data.CurrentPage = "dashboard"
	data.Success = strings.TrimSpace(r.URL.Query().Get("success"))

	var (
		sectionCounts  map[string]int
		recentArticles []Article
	)
	var queryWG sync.WaitGroup
	queryWG.Add(2)

	go func() {
		defer queryWG.Done()
		counts, err := a.getArticleCountsBySection()
		if err != nil {
			a.logger.Printf("get article counts by section: %v", err)
			sectionCounts = map[string]int{}
			return
		}
		sectionCounts = counts
	}()

	go func() {
		defer queryWG.Done()
		recent, err := a.getRecentArticles(8)
		if err != nil {
			a.logger.Printf("get recent articles: %v", err)
			return
		}
		decorateArticles(recent)
		recentArticles = recent
	}()

	queryWG.Wait()
	if sectionCounts == nil {
		sectionCounts = map[string]int{}
	}
	if len(data.Sections) > 0 {
		data.SectionOverviews = make([]sectionOverview, 0, len(data.Sections))
		for _, section := range data.Sections {
			lead := "Без подразделов"
			if len(section.Subsections) > 0 {
				lead = section.Subsections[0]
			}
			data.SectionOverviews = append(data.SectionOverviews, sectionOverview{
				Slug:  section.Slug,
				Name:  section.Name,
				Lead:  lead,
				Count: sectionCounts[section.Slug],
			})
		}
	}

	data.RecentArticles = recentArticles

	a.renderTemplate(w, r, "dashboard.tmpl", data)
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

	articles, err := a.getArticlesBySection(section.Slug, currentSubsection, 100)
	if err != nil {
		a.logger.Printf("get articles by section: %v", err)
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}
	decorateArticles(articles)
	data.SectionArticles = articles

	a.renderTemplate(w, r, "section.tmpl", data)
}

func (a *Application) handleArticleNew(w http.ResponseWriter, r *http.Request) {
	user := userFromContext(r.Context())
	if user == nil {
		http.Redirect(w, r, "/auth/login", http.StatusSeeOther)
		return
	}
	if !user.CanEdit() {
		http.Error(w, "forbidden", http.StatusForbidden)
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
		draft, draftErr := a.resolveDraftForNewArticle(user.ID, section.Slug, currentSubsection)
		if draftErr != nil {
			a.logger.Printf("resolve draft for article new: %v", draftErr)
		} else if draft != nil {
			data.ArticleTitle = draft.Title
			data.ArticleBody = draft.Body
			if strings.TrimSpace(draft.Title) != "" || strings.TrimSpace(draft.Body) != "" {
				data.DraftLoaded = true
			}
		}
		a.renderTemplate(w, r, "article_new.tmpl", data)
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
			a.renderTemplate(w, r, "article_new.tmpl", data)
			return
		}

		if utf8.RuneCountInString(body) < 20 {
			data.Error = "Текст статьи должен быть минимум 20 символов."
			a.renderTemplate(w, r, "article_new.tmpl", data)
			return
		}

		if _, err := a.createArticle(user.ID, section.Slug, currentSubsection, title, body); err != nil {
			a.logger.Printf("create article: %v", err)
			http.Error(w, "internal server error", http.StatusInternalServerError)
			return
		}
		if err := a.deleteArticleDraftByKey(user.ID, articleDraftKeyForNew(section.Slug, currentSubsection)); err != nil {
			a.logger.Printf("delete article new draft: %v", err)
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
	http.Redirect(w, r, "/auth/login?success=Вы вышли из системы.", http.StatusSeeOther)
}

func (a *Application) renderModerationConfirmPage(
	w http.ResponseWriter,
	r *http.Request,
	title string,
	message string,
	actionPath string,
	token string,
	submitLabel string,
	withReason bool,
	reason string,
) {
	if strings.TrimSpace(title) == "" {
		title = "Подтверждение действия"
	}
	if strings.TrimSpace(message) == "" {
		message = "Проверьте данные и подтвердите операцию."
	}
	if strings.TrimSpace(actionPath) == "" {
		actionPath = "/auth/login"
	}
	if strings.TrimSpace(submitLabel) == "" {
		submitLabel = "Подтвердить"
	}

	csrfToken, err := a.ensureCSRFToken(w, r)
	if err != nil {
		a.logger.Printf("ensure csrf token for moderation page: %v", err)
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}

	appName := strings.TrimSpace(a.cfg.AppName)
	if appName == "" {
		appName = "Контур знаний"
	}

	reasonRow := ""
	if withReason {
		reasonRow = fmt.Sprintf(
			`<label style="display:grid;gap:7px;margin-top:14px;">
         <span style="font-size:13px;color:#586863;">Причина (необязательно)</span>
         <input type="text" name="reason" value="%s" maxlength="220" placeholder="Причина отклонения" style="min-height:38px;border:1px solid #cfdad5;border-radius:10px;padding:0 11px;font:inherit;" />
       </label>`,
			html.EscapeString(strings.TrimSpace(reason)),
		)
	}

	page := fmt.Sprintf(`<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>%s · %s</title>
  <link rel="icon" href="/static/favicon.svg" type="image/svg+xml" />
  <style>
    body { margin:0; min-height:100vh; display:grid; place-items:center; font-family: Manrope, Arial, sans-serif; background:#eef3ef; padding:16px; }
    .box { width:min(640px, 100%%); background:#fff; border:1px solid #d4ddd8; border-radius:18px; overflow:hidden; box-shadow:0 14px 36px rgba(28,52,46,0.14); }
    .head { padding:18px 20px; color:#fff; background:#0d766d; }
    .head h1 { margin:0; font-size:28px; line-height:1.16; }
    .body { padding:18px 20px 22px; color:#2d403b; line-height:1.6; }
    .actions { margin-top:14px; display:flex; gap:9px; flex-wrap:wrap; }
    .btn { display:inline-flex; align-items:center; justify-content:center; min-height:40px; padding:0 14px; border-radius:10px; border:1px solid transparent; font-weight:700; text-decoration:none; cursor:pointer; font:inherit; }
    .btn-primary { background:#0d766d; color:#fff; }
    .btn-ghost { background:#f5f9f7; color:#2f5049; border-color:#cedad5; }
  </style>
</head>
<body>
  <main class="box">
    <header class="head"><h1>%s</h1></header>
    <section class="body">
      <p>%s</p>
      <form method="post" action="%s">
        <input type="hidden" name="%s" value="%s" />
        <input type="hidden" name="%s" value="%s" />
        %s
        <div class="actions">
          <button class="btn btn-primary" type="submit">%s</button>
          <a class="btn btn-ghost" href="/auth/login">Отмена</a>
        </div>
      </form>
    </section>
  </main>
</body>
</html>`,
		html.EscapeString(title),
		html.EscapeString(appName),
		html.EscapeString(title),
		html.EscapeString(message),
		html.EscapeString(actionPath),
		html.EscapeString(csrfFormField),
		html.EscapeString(csrfToken),
		html.EscapeString("token"),
		html.EscapeString(strings.TrimSpace(token)),
		reasonRow,
		html.EscapeString(submitLabel),
	)

	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write([]byte(page))
}

func (a *Application) renderModerationPage(w http.ResponseWriter, status int, title string, message string) {
	if strings.TrimSpace(title) == "" {
		title = "Статус модерации"
	}
	if strings.TrimSpace(message) == "" {
		message = "Операция завершена."
	}

	appName := strings.TrimSpace(a.cfg.AppName)
	if appName == "" {
		appName = "Контур знаний"
	}

	accent := "#0d766d"
	if status >= http.StatusInternalServerError {
		accent = "#8f2d3f"
	} else if status >= http.StatusBadRequest {
		accent = "#9a5b2f"
	}

	actionHref := "/auth/login"
	actionLabel := "Ко входу"
	if status >= http.StatusBadRequest {
		actionHref = "/auth/register"
		actionLabel = "К форме"
	}

	page := fmt.Sprintf(`<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>%s · %s</title>
  <link rel="icon" href="/static/favicon.svg" type="image/svg+xml" />
  <style>
    body { margin:0; min-height:100vh; display:grid; place-items:center; font-family: Manrope, Arial, sans-serif; background:#eef3ef; }
    .box { width:min(620px, 92%%); background:#fff; border:1px solid #d4ddd8; border-radius:18px; overflow:hidden; }
    .head { padding:18px 20px; color:#fff; background:%s; }
    .head h1 { margin:0; font-size:28px; }
    .body { padding:18px 20px 22px; color:#2d403b; line-height:1.6; }
    .btn { display:inline-block; margin-top:10px; padding:10px 14px; border-radius:10px; color:#fff; text-decoration:none; background:%s; font-weight:700; }
  </style>
</head>
<body>
  <main class="box">
    <header class="head"><h1>%s</h1></header>
    <section class="body">
      <p>%s</p>
      <a class="btn" href="%s">%s</a>
    </section>
  </main>
</body>
</html>`,
		html.EscapeString(title),
		html.EscapeString(appName),
		accent,
		accent,
		html.EscapeString(title),
		html.EscapeString(message),
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

func (a *Application) renderBlockedAccessPage(w http.ResponseWriter, user *User) {
	appName := strings.TrimSpace(a.cfg.AppName)
	if appName == "" {
		appName = "Контур знаний"
	}

	name := "Коллега"
	if user != nil && strings.TrimSpace(user.Name) != "" {
		name = strings.TrimSpace(user.Name)
	}

	title := "Доступ поставлен на паузу"
	message := fmt.Sprintf("%s, админ включил режим \"read-only для души\": ваш аккаунт временно заблокирован. Паники ноль, просто пингните администратора.", name)

	page := fmt.Sprintf(`<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>%s · %s</title>
  <link rel="icon" href="/static/favicon.svg" type="image/svg+xml" />
  <style>
    :root { --accent:#8f2d3f; --accent-2:#d26b7c; --text:#2e3b37; --bg:#eef3ef; --line:#d5dfda; }
    * { box-sizing: border-box; }
    body { margin:0; min-height:100vh; display:grid; place-items:center; font-family: Manrope, Arial, sans-serif; color:var(--text); background:
      radial-gradient(circle at 9%% 10%%, rgba(143,45,63,0.18), transparent 34%%),
      radial-gradient(circle at 87%% 12%%, rgba(210,107,124,0.2), transparent 32%%),
      linear-gradient(168deg, #f4f6f3 0%%, #e8ece7 100%%); padding:16px; }
    .box { width:min(700px, 100%%); background:#fff; border:1px solid var(--line); border-radius:20px; overflow:hidden; box-shadow:0 16px 42px rgba(46,59,55,0.16); }
    .head { padding:18px 22px; color:#fff; background:linear-gradient(135deg, var(--accent), var(--accent-2)); }
    .head p { margin:0; font-size:12px; letter-spacing:0.13em; text-transform:uppercase; opacity:0.92; font-family: "IBM Plex Mono","Consolas",monospace; }
    .head h1 { margin:8px 0 0; font-size:30px; line-height:1.14; }
    .body { padding:20px 22px 24px; line-height:1.6; }
    .msg { margin:0; font-size:17px; }
    .note { margin:12px 0 0; font-size:14px; color:#5a6864; }
    .btn { display:inline-flex; align-items:center; justify-content:center; margin-top:14px; min-height:42px; padding:0 14px; border-radius:12px; border:1px solid #d6deda; color:#2b3d38; background:#f3f8f5; text-decoration:none; font-weight:700; }
    .btn:hover { background:#eaf1ee; }
  </style>
</head>
<body>
  <main class="box">
    <header class="head">
      <p>%s</p>
      <h1>%s</h1>
    </header>
    <section class="body">
      <p class="msg">%s</p>
      <p class="note">Как только админ снимет блокировку, можно снова возвращаться к runbook-магии.</p>
      <a class="btn" href="/auth/login">К форме входа</a>
    </section>
  </main>
</body>
</html>`,
		html.EscapeString(title),
		html.EscapeString(appName),
		html.EscapeString(appName),
		html.EscapeString(title),
		html.EscapeString(message),
	)

	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.WriteHeader(http.StatusForbidden)
	_, _ = w.Write([]byte(page))
}
