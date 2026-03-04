package app

import (
	"bytes"
	"crypto/tls"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime"
	"net"
	"net/http"
	"net/mail"
	"net/smtp"
	"net/url"
	"strconv"
	"strings"
	"time"
)

const defaultAdminRejectReason = "Заявка отклонена модератором."

type registrationClientMeta struct {
	IP       string
	Browser  string
	Location string
}

func (a *Application) hasRegistrationIntegrations() bool {
	return a.cfg.AppBaseURL != "" &&
		a.cfg.SMTPHost != "" &&
		a.cfg.SMTPPort > 0 &&
		a.cfg.SMTPUser != "" &&
		a.cfg.SMTPPassword != "" &&
		a.cfg.MailFrom != "" &&
		a.cfg.TelegramBotToken != "" &&
		a.cfg.TelegramAdminChatID != ""
}

func (a *Application) absoluteURL(path string, query url.Values) string {
	base := strings.TrimRight(a.cfg.AppBaseURL, "/")
	if !strings.HasPrefix(path, "/") {
		path = "/" + path
	}
	out := base + path
	if query != nil && len(query) > 0 {
		out += "?" + query.Encode()
	}
	return out
}

func (a *Application) sendRegistrationRequestToTelegram(req *registrationRequest, incomingReq *http.Request) error {
	if a.cfg.TelegramBotToken == "" || a.cfg.TelegramAdminChatID == "" {
		return errors.New("telegram integration is not configured")
	}

	meta := a.collectRegistrationClientMeta(incomingReq)
	approveURL := a.absoluteURL("/admin/registration/approve", url.Values{"token": []string{req.ModerationToken}})
	rejectURL := a.absoluteURL("/admin/registration/reject", url.Values{"token": []string{req.ModerationToken}})

	text := fmt.Sprintf(
		"Новая заявка в %s\nНик: %s\nEmail: %s\nСоздана: %s\nIP: %s\nБраузер: %s\nГео: %s",
		a.cfg.AppName,
		req.Name,
		req.Email,
		req.CreatedAt.Format("2006-01-02 15:04:05 UTC"),
		meta.IP,
		meta.Browser,
		meta.Location,
	)

	type inlineButton struct {
		Text string `json:"text"`
		URL  string `json:"url"`
	}
	type inlineKeyboard struct {
		InlineKeyboard [][]inlineButton `json:"inline_keyboard"`
	}
	type sendMessagePayload struct {
		ChatID                string         `json:"chat_id"`
		Text                  string         `json:"text"`
		DisableWebPagePreview bool           `json:"disable_web_page_preview"`
		ReplyMarkup           inlineKeyboard `json:"reply_markup"`
	}

	payload := sendMessagePayload{
		ChatID:                a.cfg.TelegramAdminChatID,
		Text:                  text,
		DisableWebPagePreview: true,
		ReplyMarkup: inlineKeyboard{InlineKeyboard: [][]inlineButton{
			{
				{Text: "✅ Одобрить", URL: approveURL},
				{Text: "❌ Отклонить", URL: rejectURL},
			},
		}},
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return err
	}

	u := fmt.Sprintf("https://api.telegram.org/bot%s/sendMessage", a.cfg.TelegramBotToken)
	httpReq, err := http.NewRequest(http.MethodPost, u, bytes.NewReader(body))
	if err != nil {
		return err
	}
	httpReq.Header.Set("Content-Type", "application/json")

	client := &http.Client{Timeout: 12 * time.Second}
	resp, err := client.Do(httpReq)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(io.LimitReader(resp.Body, 16*1024))
	type telegramAPIResponse struct {
		OK          bool   `json:"ok"`
		ErrorCode   int    `json:"error_code"`
		Description string `json:"description"`
	}

	var apiResp telegramAPIResponse
	if err := json.Unmarshal(respBody, &apiResp); err == nil && !apiResp.OK {
		return fmt.Errorf(
			"telegram sendMessage rejected: error_code=%d description=%q",
			apiResp.ErrorCode,
			apiResp.Description,
		)
	}

	if resp.StatusCode >= 300 {
		return fmt.Errorf(
			"telegram sendMessage failed with status %s body=%q",
			resp.Status,
			strings.TrimSpace(string(respBody)),
		)
	}

	return nil
}

func (a *Application) collectRegistrationClientMeta(r *http.Request) registrationClientMeta {
	if r == nil {
		return registrationClientMeta{
			IP:       "unknown",
			Browser:  "unknown",
			Location: "не определено",
		}
	}

	ip := extractClientIP(r)
	if ip == "" {
		ip = "unknown"
	}

	browser := normalizeUserAgent(r.UserAgent())
	if browser == "" {
		browser = "unknown"
	}

	location := "не определено"
	if ip != "unknown" {
		if resolved, err := a.lookupIPLocation(ip); err == nil && resolved != "" {
			location = resolved
		}
	}

	return registrationClientMeta{
		IP:       ip,
		Browser:  browser,
		Location: location,
	}
}

func extractClientIP(r *http.Request) string {
	headerCandidates := []string{"CF-Connecting-IP", "X-Forwarded-For", "X-Real-IP"}

	for _, key := range headerCandidates {
		raw := strings.TrimSpace(r.Header.Get(key))
		if raw == "" {
			continue
		}

		if key == "X-Forwarded-For" {
			parts := strings.Split(raw, ",")
			for _, part := range parts {
				if ip := normalizeIP(part); ip != "" {
					return ip
				}
			}
			continue
		}

		if ip := normalizeIP(raw); ip != "" {
			return ip
		}
	}

	host, _, err := net.SplitHostPort(strings.TrimSpace(r.RemoteAddr))
	if err == nil {
		if ip := normalizeIP(host); ip != "" {
			return ip
		}
	}

	return normalizeIP(strings.TrimSpace(r.RemoteAddr))
}

func normalizeIP(value string) string {
	clean := strings.TrimSpace(strings.Trim(value, "[]"))
	if clean == "" {
		return ""
	}

	parsed := net.ParseIP(clean)
	if parsed == nil {
		return ""
	}
	return parsed.String()
}

func normalizeUserAgent(ua string) string {
	clean := strings.TrimSpace(ua)
	if clean == "" {
		return ""
	}
	if len(clean) > 200 {
		return clean[:197] + "..."
	}
	return clean
}

func (a *Application) lookupIPLocation(ip string) (string, error) {
	parsed := net.ParseIP(ip)
	if parsed == nil {
		return "", errors.New("invalid ip")
	}

	if parsed.IsPrivate() || parsed.IsLoopback() || parsed.IsUnspecified() || parsed.IsLinkLocalMulticast() || parsed.IsLinkLocalUnicast() {
		return "локальная/приватная сеть", nil
	}

	geoURL := fmt.Sprintf("https://ipapi.co/%s/json/", url.PathEscape(ip))
	req, err := http.NewRequest(http.MethodGet, geoURL, nil)
	if err != nil {
		return "", err
	}

	client := &http.Client{Timeout: 3 * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		return "", fmt.Errorf("geo lookup status: %s", resp.Status)
	}

	type geoResponse struct {
		Error       bool   `json:"error"`
		Reason      string `json:"reason"`
		City        string `json:"city"`
		Region      string `json:"region"`
		CountryName string `json:"country_name"`
		Org         string `json:"org"`
		Timezone    string `json:"timezone"`
	}

	var geo geoResponse
	if err := json.NewDecoder(io.LimitReader(resp.Body, 16*1024)).Decode(&geo); err != nil {
		return "", err
	}

	if geo.Error {
		if geo.Reason == "" {
			geo.Reason = "unknown geo provider error"
		}
		return "", errors.New(geo.Reason)
	}

	parts := make([]string, 0, 4)
	if geo.City != "" {
		parts = append(parts, geo.City)
	}
	if geo.Region != "" {
		parts = append(parts, geo.Region)
	}
	if geo.CountryName != "" {
		parts = append(parts, geo.CountryName)
	}
	if geo.Org != "" {
		parts = append(parts, geo.Org)
	}

	location := strings.Join(parts, ", ")
	if geo.Timezone != "" {
		if location == "" {
			location = geo.Timezone
		} else {
			location = location + " (" + geo.Timezone + ")"
		}
	}

	if location == "" {
		return "", errors.New("empty geo response")
	}
	return location, nil
}

func (a *Application) sendRegistrationApprovedEmail(req *registrationRequest) error {
	if !req.EmailVerifyToken.Valid || strings.TrimSpace(req.EmailVerifyToken.String) == "" {
		return errors.New("email verify token is empty")
	}

	verifyURL := a.absoluteURL("/auth/verify-email", url.Values{"token": []string{req.EmailVerifyToken.String}})
	subject := "Заявка одобрена: подтвердите email"
	body := fmt.Sprintf(
		"Привет, %s!\n\nВаша заявка в %s одобрена.\nОстался последний шаг: подтвердите email по ссылке:\n%s\n\nЕсли это были не вы, просто проигнорируйте письмо.",
		req.Name,
		a.cfg.AppName,
		verifyURL,
	)
	return a.sendEmail(req.Email, subject, body)
}

func (a *Application) sendRegistrationRejectedEmail(req *registrationRequest, reason string) error {
	rejectReason := strings.TrimSpace(reason)
	if rejectReason == "" {
		rejectReason = defaultAdminRejectReason
	}

	subject := "Заявка отклонена"
	body := fmt.Sprintf(
		"Привет, %s!\n\nК сожалению, заявка в %s отклонена.\nПричина: %s\n\nМожно отправить новую заявку позже.",
		req.Name,
		a.cfg.AppName,
		rejectReason,
	)
	return a.sendEmail(req.Email, subject, body)
}

func (a *Application) sendEmail(to string, subject string, body string) error {
	toAddr, err := mail.ParseAddress(strings.TrimSpace(to))
	if err != nil {
		return fmt.Errorf("invalid recipient address: %w", err)
	}

	fromHeader, fromAddr, err := resolveFromAddress(a.cfg.MailFrom, a.cfg.SMTPUser)
	if err != nil {
		return err
	}

	headers := []string{
		fmt.Sprintf("From: %s", fromHeader),
		fmt.Sprintf("To: %s", toAddr.String()),
		fmt.Sprintf("Subject: %s", mime.BEncoding.Encode("UTF-8", subject)),
		"MIME-Version: 1.0",
		"Content-Type: text/plain; charset=UTF-8",
		"Content-Transfer-Encoding: 8bit",
		fmt.Sprintf("Date: %s", time.Now().UTC().Format(time.RFC1123Z)),
	}
	msg := strings.Join(headers, "\r\n") + "\r\n\r\n" + body

	host := strings.TrimSpace(a.cfg.SMTPHost)
	port := a.cfg.SMTPPort
	if host == "" || port <= 0 {
		return errors.New("smtp host/port is not configured")
	}

	addr := net.JoinHostPort(host, strconv.Itoa(port))
	if a.cfg.SMTPSecure {
		return sendMailWithImplicitTLS(addr, host, a.cfg.SMTPUser, a.cfg.SMTPPassword, fromAddr, toAddr.Address, msg)
	}
	return sendMailWithSMTP(addr, host, a.cfg.SMTPUser, a.cfg.SMTPPassword, fromAddr, toAddr.Address, msg)
}

func resolveFromAddress(raw string, fallback string) (string, string, error) {
	candidate := strings.TrimSpace(raw)
	if candidate == "" {
		candidate = strings.TrimSpace(fallback)
	}
	if candidate == "" {
		return "", "", errors.New("mail sender is not configured")
	}

	addr, err := mail.ParseAddress(candidate)
	if err != nil {
		if strings.Contains(candidate, "@") {
			return candidate, candidate, nil
		}
		return "", "", fmt.Errorf("invalid mail sender address: %w", err)
	}

	return addr.String(), addr.Address, nil
}

func sendMailWithImplicitTLS(addr string, host string, user string, pass string, from string, to string, msg string) error {
	err := sendMailWithImplicitTLSMode(addr, host, user, pass, from, to, msg, smtpAuthModeAuto)
	if err != nil && shouldRetrySMTPWithLoginOnNewConnection(err) {
		retryErr := sendMailWithImplicitTLSMode(addr, host, user, pass, from, to, msg, smtpAuthModeLoginOnly)
		if retryErr == nil {
			return nil
		}
		return fmt.Errorf("smtp send failed and retry with login also failed: first=%v; retry=%w", err, retryErr)
	}
	return err
}

func sendMailWithImplicitTLSMode(addr string, host string, user string, pass string, from string, to string, msg string, mode smtpAuthMode) error {
	conn, err := tls.Dial("tcp", addr, &tls.Config{ServerName: host, MinVersion: tls.VersionTLS12})
	if err != nil {
		return err
	}

	client, err := smtp.NewClient(conn, host)
	if err != nil {
		_ = conn.Close()
		return err
	}
	defer client.Close()

	if err := authenticateSMTPClient(client, host, user, pass, mode); err != nil {
		return err
	}

	if err := client.Mail(from); err != nil {
		return err
	}
	if err := client.Rcpt(to); err != nil {
		return err
	}

	writer, err := client.Data()
	if err != nil {
		return err
	}
	if _, err := writer.Write([]byte(msg)); err != nil {
		_ = writer.Close()
		return err
	}
	if err := writer.Close(); err != nil {
		return err
	}

	return client.Quit()
}

func sendMailWithSMTP(addr string, host string, user string, pass string, from string, to string, msg string) error {
	err := sendMailWithSMTPMode(addr, host, user, pass, from, to, msg, smtpAuthModeAuto)
	if err != nil && shouldRetrySMTPWithLoginOnNewConnection(err) {
		retryErr := sendMailWithSMTPMode(addr, host, user, pass, from, to, msg, smtpAuthModeLoginOnly)
		if retryErr == nil {
			return nil
		}
		return fmt.Errorf("smtp send failed and retry with login also failed: first=%v; retry=%w", err, retryErr)
	}
	return err
}

func sendMailWithSMTPMode(addr string, host string, user string, pass string, from string, to string, msg string, mode smtpAuthMode) error {
	client, err := smtp.Dial(addr)
	if err != nil {
		return err
	}
	defer client.Close()

	if ok, _ := client.Extension("STARTTLS"); ok {
		if err := client.StartTLS(&tls.Config{ServerName: host, MinVersion: tls.VersionTLS12}); err != nil {
			return err
		}
	}

	if err := authenticateSMTPClient(client, host, user, pass, mode); err != nil {
		return err
	}

	if err := client.Mail(from); err != nil {
		return err
	}
	if err := client.Rcpt(to); err != nil {
		return err
	}

	writer, err := client.Data()
	if err != nil {
		return err
	}
	if _, err := writer.Write([]byte(msg)); err != nil {
		_ = writer.Close()
		return err
	}
	if err := writer.Close(); err != nil {
		return err
	}

	return client.Quit()
}

type smtpAuthMode int

const (
	smtpAuthModeAuto smtpAuthMode = iota
	smtpAuthModeLoginOnly
)

type smtpAuthReconnectRequiredError struct {
	plainErr error
	loginErr error
}

func (e *smtpAuthReconnectRequiredError) Error() string {
	if e == nil {
		return "smtp auth reconnect required"
	}
	return fmt.Sprintf("smtp auth requires reconnect: plain=%v; login=%v", e.plainErr, e.loginErr)
}

func shouldRetrySMTPWithLoginOnNewConnection(err error) bool {
	var reconnectErr *smtpAuthReconnectRequiredError
	return errors.As(err, &reconnectErr)
}

func smtpAuthCapabilities(client *smtp.Client) (supportsPlain bool, supportsLogin bool) {
	ok, raw := client.Extension("AUTH")
	if !ok {
		return false, false
	}

	upper := strings.ToUpper(raw)
	fields := strings.Fields(upper)
	for _, f := range fields {
		switch f {
		case "PLAIN":
			supportsPlain = true
		case "LOGIN":
			supportsLogin = true
		}
	}

	return supportsPlain, supportsLogin
}

func isClosedNetworkConnectionError(err error) bool {
	if err == nil {
		return false
	}
	return strings.Contains(strings.ToLower(err.Error()), "use of closed network connection")
}

func authenticateSMTPClient(client *smtp.Client, host string, user string, pass string, mode smtpAuthMode) error {
	if strings.TrimSpace(user) == "" {
		return nil
	}

	if mode == smtpAuthModeLoginOnly {
		return client.Auth(newSMTPLoginAuth(user, pass))
	}

	supportsPlain, supportsLogin := smtpAuthCapabilities(client)

	if supportsLogin {
		loginErr := client.Auth(newSMTPLoginAuth(user, pass))
		if loginErr == nil {
			return nil
		}

		if !supportsPlain {
			return loginErr
		}

		if isClosedNetworkConnectionError(loginErr) {
			return &smtpAuthReconnectRequiredError{
				plainErr: errors.New("login-first failed and connection was closed"),
				loginErr: loginErr,
			}
		}

		plainErr := client.Auth(smtp.PlainAuth("", user, pass, host))
		if plainErr == nil {
			return nil
		}

		return fmt.Errorf("smtp auth failed: login=%v; plain=%w", loginErr, plainErr)
	}

	plainErr := client.Auth(smtp.PlainAuth("", user, pass, host))
	if plainErr == nil {
		return nil
	}

	if !supportsLogin || !shouldFallbackToLoginAuth(plainErr) {
		return plainErr
	}

	loginErr := client.Auth(newSMTPLoginAuth(user, pass))
	if loginErr == nil {
		return nil
	}

	if isClosedNetworkConnectionError(loginErr) {
		return &smtpAuthReconnectRequiredError{
			plainErr: plainErr,
			loginErr: loginErr,
		}
	}

	return fmt.Errorf("smtp auth failed: plain=%v; login=%w", plainErr, loginErr)
}

func shouldFallbackToLoginAuth(err error) bool {
	if err == nil {
		return false
	}

	msg := strings.ToLower(err.Error())
	return strings.Contains(msg, "plain authentication mechanism not supported") ||
		strings.Contains(msg, "unsupported authentication mechanism") ||
		strings.Contains(msg, "unrecognized authentication type") ||
		strings.Contains(msg, "504")
}

type smtpLoginAuth struct {
	username string
	password string
	step     int
}

func newSMTPLoginAuth(username string, password string) smtp.Auth {
	return &smtpLoginAuth{
		username: username,
		password: password,
	}
}

func (a *smtpLoginAuth) Start(server *smtp.ServerInfo) (string, []byte, error) {
	if !server.TLS && !isSMTPAuthLocalhost(server.Name) {
		return "", nil, errors.New("unencrypted connection")
	}
	a.step = 0
	return "LOGIN", nil, nil
}

func (a *smtpLoginAuth) Next(_ []byte, more bool) ([]byte, error) {
	if !more {
		return nil, nil
	}

	switch a.step {
	case 0:
		a.step++
		return []byte(a.username), nil
	case 1:
		a.step++
		return []byte(a.password), nil
	default:
		return nil, nil
	}
}

func isSMTPAuthLocalhost(name string) bool {
	host := strings.TrimSpace(strings.Trim(name, "[]"))
	if host == "localhost" || strings.HasPrefix(host, "localhost.") {
		return true
	}

	parsed := net.ParseIP(host)
	if parsed == nil {
		return false
	}
	return parsed.IsLoopback()
}
