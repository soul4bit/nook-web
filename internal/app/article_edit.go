package app

import (
	"database/sql"
	"errors"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"unicode/utf8"
)

func parseArticleID(raw string) (int64, error) {
	id, err := strconv.ParseInt(strings.TrimSpace(raw), 10, 64)
	if err != nil || id < 1 {
		return 0, errors.New("invalid article id")
	}
	return id, nil
}

func sectionLinkWithSubsection(sectionSlug string, subsection string) string {
	target := "/app/section?slug=" + url.QueryEscape(sectionSlug)
	if subsection != "" {
		target += "&sub=" + url.QueryEscape(subsection)
	}
	return target
}

func (a *Application) articleEditViewData(user *User, section wikiSection, subsection string, articleID int64, title string, body string) viewData {
	data := a.appViewData(user, "Редактирование статьи")
	data.CurrentPage = "article-edit"
	data.CurrentSection = &section
	data.CurrentSectionSlug = section.Slug
	data.CurrentSubsection = subsection
	data.ArticleID = articleID
	data.ArticleTitle = title
	data.ArticleBody = body
	return data
}

func (a *Application) handleArticleEdit(w http.ResponseWriter, r *http.Request) {
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
		articleID, err := parseArticleID(r.URL.Query().Get("id"))
		if err != nil {
			http.Error(w, "invalid article id", http.StatusBadRequest)
			return
		}

		article, err := a.getArticleByID(articleID)
		if err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				http.NotFound(w, r)
				return
			}
			a.logger.Printf("get article by id: %v", err)
			http.Error(w, "internal server error", http.StatusInternalServerError)
			return
		}

		if article.AuthorID != user.ID && !user.IsAdmin() {
			http.Error(w, "forbidden", http.StatusForbidden)
			return
		}

		section, ok := findWikiSection(article.SectionSlug)
		if !ok {
			http.NotFound(w, r)
			return
		}
		currentSubsection := normalizeSubsection(section, article.Subsection)

		data := a.articleEditViewData(user, section, currentSubsection, article.ID, article.Title, article.Body)
		draft, draftErr := a.resolveDraftForExistingArticle(user.ID, article.ID)
		if draftErr != nil {
			a.logger.Printf("resolve draft for article edit: %v", draftErr)
		} else if draft != nil {
			data.ArticleTitle = draft.Title
			data.ArticleBody = draft.Body
			if strings.TrimSpace(draft.Title) != "" || strings.TrimSpace(draft.Body) != "" {
				data.DraftLoaded = true
			}
		}
		a.renderTemplate(w, r, "article_edit.tmpl", data)
	case http.MethodPost:
		if err := r.ParseForm(); err != nil {
			http.Error(w, "invalid form data", http.StatusBadRequest)
			return
		}

		articleID, err := parseArticleID(r.FormValue("id"))
		if err != nil {
			http.Error(w, "invalid article id", http.StatusBadRequest)
			return
		}

		article, err := a.getArticleByID(articleID)
		if err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				http.NotFound(w, r)
				return
			}
			a.logger.Printf("get article by id before update: %v", err)
			http.Error(w, "internal server error", http.StatusInternalServerError)
			return
		}

		if article.AuthorID != user.ID && !user.IsAdmin() {
			http.Error(w, "forbidden", http.StatusForbidden)
			return
		}

		section, ok := findWikiSection(article.SectionSlug)
		if !ok {
			http.NotFound(w, r)
			return
		}

		currentSubsection := normalizeSubsection(section, r.FormValue("subsection"))
		title := strings.TrimSpace(r.FormValue("title"))
		body := strings.TrimSpace(r.FormValue("body"))

		data := a.articleEditViewData(user, section, currentSubsection, article.ID, title, body)

		if utf8.RuneCountInString(title) < 4 {
			data.Error = "Заголовок должен быть минимум 4 символа."
			a.renderTemplate(w, r, "article_edit.tmpl", data)
			return
		}

		if utf8.RuneCountInString(body) < 20 {
			data.Error = "Текст статьи должен быть минимум 20 символов."
			a.renderTemplate(w, r, "article_edit.tmpl", data)
			return
		}

		var updateErr error
		if article.AuthorID == user.ID {
			_, updateErr = a.updateArticleByAuthor(articleID, user.ID, currentSubsection, title, body)
		} else {
			_, updateErr = a.updateArticleByID(articleID, user.ID, currentSubsection, title, body)
		}

		if updateErr != nil {
			a.logger.Printf("update article: %v", updateErr)
			if errors.Is(updateErr, sql.ErrNoRows) {
				http.Error(w, "forbidden", http.StatusForbidden)
				return
			}
			http.Error(w, "internal server error", http.StatusInternalServerError)
			return
		}
		if err := a.deleteArticleDraftByKey(user.ID, articleDraftKeyForArticle(articleID)); err != nil {
			a.logger.Printf("delete article edit draft: %v", err)
		}

		success := url.QueryEscape("Статья обновлена.")
		target := sectionLinkWithSubsection(section.Slug, currentSubsection) + "&success=" + success
		http.Redirect(w, r, target, http.StatusSeeOther)
	default:
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
	}
}
