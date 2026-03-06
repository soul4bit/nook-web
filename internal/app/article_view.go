package app

import (
	"database/sql"
	"errors"
	"net/http"
	"net/url"
	"strings"
)

func (a *Application) handleArticleView(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	user := userFromContext(r.Context())
	if user == nil {
		http.Redirect(w, r, "/auth/login", http.StatusSeeOther)
		return
	}

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
		a.logger.Printf("get article by id for view: %v", err)
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}

	article.SectionName = wikiSectionName(article.SectionSlug)

	data := a.appViewData(user, article.Title)
	data.CurrentPage = "article-view"
	data.Success = strings.TrimSpace(r.URL.Query().Get("success"))
	data.Error = strings.TrimSpace(r.URL.Query().Get("error"))
	data.CurrentArticle = article
	data.ArticleID = article.ID
	data.ArticleTitle = article.Title
	data.ArticleBody = article.Body
	data.ArticleBodyHTML = renderMarkdownHTML(article.Body)

	if user.IsAdmin() {
		versions, err := a.listArticleVersions(article.ID, 25)
		if err != nil {
			a.logger.Printf("list article versions: %v", err)
		} else {
			data.ArticleVersions = versions
		}
	}

	comments, commentErr := a.listArticleComments(article.ID, 200)
	if commentErr != nil {
		a.logger.Printf("list article comments: %v", commentErr)
	} else {
		data.ArticleComments = a.markCommentsDeletePermissions(comments, user)
	}

	if section, ok := findWikiSection(article.SectionSlug); ok {
		data.CurrentSection = &section
		data.CurrentSectionSlug = section.Slug
		data.CurrentSubsection = normalizeSubsection(section, article.Subsection)
	}

	a.renderTemplate(w, r, "article_view.tmpl", data)
}

func (a *Application) handleArticleRestore(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	user := userFromContext(r.Context())
	if user == nil {
		http.Redirect(w, r, "/auth/login", http.StatusSeeOther)
		return
	}
	if !user.IsAdmin() {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}

	if err := r.ParseForm(); err != nil {
		http.Error(w, "invalid form data", http.StatusBadRequest)
		return
	}

	articleID, err := parseArticleID(r.FormValue("article_id"))
	if err != nil {
		http.Error(w, "invalid article id", http.StatusBadRequest)
		return
	}
	versionID, err := parseArticleID(r.FormValue("version_id"))
	if err != nil {
		http.Error(w, "invalid version id", http.StatusBadRequest)
		return
	}

	if _, err := a.getArticleByID(articleID); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			http.NotFound(w, r)
			return
		}
		a.logger.Printf("get article by id before restore: %v", err)
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}

	if _, err := a.restoreArticleVersion(articleID, versionID, user.ID); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			target := "/app/article?id=" + url.QueryEscape(r.FormValue("article_id")) +
				"&error=" + url.QueryEscape("Версия не найдена или не относится к этой статье.")
			http.Redirect(w, r, target, http.StatusSeeOther)
			return
		}
		a.logger.Printf("restore article version: %v", err)
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}

	target := "/app/article?id=" + url.QueryEscape(r.FormValue("article_id")) +
		"&success=" + url.QueryEscape("Версия статьи восстановлена.")
	http.Redirect(w, r, target, http.StatusSeeOther)
}

func (a *Application) handleArticleDelete(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	user := userFromContext(r.Context())
	if user == nil {
		http.Redirect(w, r, "/auth/login", http.StatusSeeOther)
		return
	}
	if !user.CanEdit() {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}

	if err := r.ParseForm(); err != nil {
		http.Error(w, "invalid form data", http.StatusBadRequest)
		return
	}

	articleID, err := parseArticleID(r.FormValue("article_id"))
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
		a.logger.Printf("get article by id before delete: %v", err)
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}

	if err := a.deleteArticleByID(articleID); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			http.NotFound(w, r)
			return
		}
		a.logger.Printf("delete article by id: %v", err)
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}

	target := sectionLinkWithSubsection(article.SectionSlug, article.Subsection) +
		"&success=" + url.QueryEscape("Статья удалена.")
	http.Redirect(w, r, target, http.StatusSeeOther)
}
