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

	likeCount, likedByUser, likeErr := a.getArticleLikeState(article.ID, user.ID)
	if likeErr != nil {
		a.logger.Printf("get article like state: %v", likeErr)
	} else {
		data.ArticleLikeCount = likeCount
		data.ArticleLikedByUser = likedByUser
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

func (a *Application) handleArticleLikeToggle(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
		return
	}

	user := userFromContext(r.Context())
	if user == nil {
		http.Redirect(w, r, "/auth/login", http.StatusSeeOther)
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

	action := strings.ToLower(strings.TrimSpace(r.FormValue("action")))
	shouldLike := action != "unlike"

	_, _, setErr := a.setArticleLike(articleID, user.ID, shouldLike)
	if setErr != nil {
		if errors.Is(setErr, sql.ErrNoRows) {
			http.NotFound(w, r)
			return
		}
		if errors.Is(setErr, errArticleSelfLike) {
			http.Redirect(w, r, articleViewRedirectURL(articleID, "", "Нельзя лайкать свою статью."), http.StatusSeeOther)
			return
		}
		a.logger.Printf("set article like: %v", setErr)
		http.Redirect(w, r, articleViewRedirectURL(articleID, "", "Не удалось обновить лайк."), http.StatusSeeOther)
		return
	}

	success := "Лайк добавлен. Автор получил +10 рейтинга."
	if !shouldLike {
		success = "Лайк снят."
	}
	http.Redirect(w, r, articleViewRedirectURL(articleID, success, ""), http.StatusSeeOther)
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
	if !canManageArticle(user, article) {
		http.Error(w, "forbidden", http.StatusForbidden)
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
