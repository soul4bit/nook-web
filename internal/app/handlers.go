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

		data := a.authViewData("Вход")
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

		data := a.authViewData("Вход")
		data.Email = email
		data.Next = next

		if email == "" || password == "" {
			data.Error = "Введите email и пароль."
			a.renderTemplate(w, "login.tmpl", data)
			return
		}

		creds, err := a.getCredentialsByEmail(email)
		if err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				if reg, regErr := a.getRegistrationRequestByEmail(email); regErr == nil {
					switch reg.Status {
					case registrationStatusPending:
						data.Error = "Заявка еще на рассмотрении. Дождитесь решения по почте."
					case registrationStatusApproved:
						data.Error = "Заявка уже одобрена. Подтвердите email из письма."
					case registrationStatusRejected:
						data.Error = "Заявка отклонена. Можно отправить новую."
					default:
						data.Error = "Неверный email или пароль."
					}
				} else {
					data.Error = "Неверный email или пароль."
				}
				a.renderTemplate(w, "login.tmpl", data)
				return
			}
			a.logger.Printf("get credentials by email: %v", err)
			http.Error(w, "internal server error", http.StatusInternalServerError)
			return
		}

		if err := bcrypt.CompareHashAndPassword([]byte(creds.PasswordHash), []byte(password)); err != nil {
			data.Error = "Неверный email или пароль."
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

		a.renderTemplate(w, "register.tmpl", a.authViewData("Регистрация"))
	case http.MethodPost:
		if err := r.ParseForm(); err != nil {
			http.Error(w, "invalid form data", http.StatusBadRequest)
			return
		}

		name := strings.TrimSpace(r.FormValue("name"))
		email := normalizeEmail(r.FormValue("email"))
		password := r.FormValue("password")
		confirmPassword := r.FormValue("confirm_password")

		data := a.authViewData("Регистрация")
		data.Name = name
		data.Email = email

		if !a.hasRegistrationIntegrations() {
			data.Error = "Регистрация временно недоступна: не настроены SMTP/Telegram интеграции."
			a.renderTemplate(w, "register.tmpl", data)
			return
		}

		if len(name) < 2 {
			data.Error = "Ник должен быть минимум 2 символа."
			a.renderTemplate(w, "register.tmpl", data)
			return
		}

		if _, err := mail.ParseAddress(email); err != nil {
			data.Error = "Введите корректный email."
			a.renderTemplate(w, "register.tmpl", data)
			return
		}

		if len(password) < 10 {
			data.Error = "Пароль должен быть не короче 10 символов."
			a.renderTemplate(w, "register.tmpl", data)
			return
		}

		if password != confirmPassword {
			data.Error = "Пароли не совпадают."
			a.renderTemplate(w, "register.tmpl", data)
			return
		}

		if existingUser, err := a.getUserByEmail(email); err == nil && existingUser != nil {
			data.Error = "Аккаунт с таким email уже существует."
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
				data.Error = "Заявка уже отправлена и ожидает решения."
				a.renderTemplate(w, "register.tmpl", data)
				return
			case registrationStatusApproved:
				data.Error = "Заявка уже одобрена. Подтвердите email из письма."
				a.renderTemplate(w, "register.tmpl", data)
				return
			case registrationStatusCompleted:
				data.Error = "Этот email уже подтвержден. Войдите в аккаунт."
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
			data.Error = "Не удалось отправить заявку модератору. Попробуйте еще раз позже."
			a.renderTemplate(w, "register.tmpl", data)
			return
		}

		success := url.QueryEscape("Заявка отправлена. После решения модератора придет письмо.")
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
}

func (a *Application) handleRejectRegistration(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	token := strings.TrimSpace(r.URL.Query().Get("token"))
	if token == "" {
		a.renderModerationPage(w, http.StatusBadRequest, "Некорректная ссылка", "Пустой токен модерации.")
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

	articles, err := a.getArticlesBySection(section.Slug, currentSubsection, 100)
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

		if _, err := a.createArticle(user.ID, section.Slug, currentSubsection, title, body); err != nil {
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

	data := a.appViewData(user, "Проверка S3")
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
	http.Redirect(w, r, "/auth/login?success=Вы вышли из системы.", http.StatusSeeOther)
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
