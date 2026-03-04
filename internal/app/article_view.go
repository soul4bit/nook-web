package app

import (
	"database/sql"
	"errors"
	"net/http"
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
	data.CurrentArticle = article
	data.ArticleID = article.ID
	data.ArticleTitle = article.Title
	data.ArticleBody = article.Body

	if section, ok := findWikiSection(article.SectionSlug); ok {
		data.CurrentSection = &section
		data.CurrentSectionSlug = section.Slug
		data.CurrentSubsection = normalizeSubsection(section, article.Subsection)
	}

	a.renderTemplate(w, "article_view.tmpl", data)
}
