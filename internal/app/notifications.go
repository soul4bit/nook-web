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

func (a *Application) sendRegistrationRequestToTelegram(req *registrationRequest) error {
	if a.cfg.TelegramBotToken == "" || a.cfg.TelegramAdminChatID == "" {
		return errors.New("telegram integration is not configured")
	}

	approveURL := a.absoluteURL("/admin/registration/approve", url.Values{"token": []string{req.ModerationToken}})
	rejectURL := a.absoluteURL("/admin/registration/reject", url.Values{"token": []string{req.ModerationToken}})

	text := fmt.Sprintf(
		"Новая заявка в %s\nНик: %s\nEmail: %s\nСоздана: %s",
		a.cfg.AppName,
		req.Name,
		req.Email,
		req.CreatedAt.Format("2006-01-02 15:04:05 UTC"),
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

	if user != "" {
		auth := smtp.PlainAuth("", user, pass, host)
		if err := client.Auth(auth); err != nil {
			return err
		}
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

	if user != "" {
		auth := smtp.PlainAuth("", user, pass, host)
		if err := client.Auth(auth); err != nil {
			return err
		}
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
