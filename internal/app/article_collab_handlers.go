package app

import (
	"database/sql"
	"encoding/json"
	"errors"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"
)

type draftSaveResponse struct {
	OK      bool   `json:"ok"`
	Deleted bool   `json:"deleted,omitempty"`
	SavedAt string `json:"saved_at,omitempty"`
	Error   string `json:"error,omitempty"`
}

func articleViewRedirectURL(articleID int64, success string, failure string) string {
	query := url.Values{}
	query.Set("id", strconv.FormatInt(articleID, 10))
	if strings.TrimSpace(success) != "" {
		query.Set("success", strings.TrimSpace(success))
	}
	if strings.TrimSpace(failure) != "" {
		query.Set("error", strings.TrimSpace(failure))
	}
	return "/app/article?" + query.Encode()
}

func writeDraftSaveResponse(w http.ResponseWriter, status int, payload draftSaveResponse) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(payload)
}

func (a *Application) handleArticleDraftSave(w http.ResponseWriter, r *http.Request) {
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
		writeDraftSaveResponse(w, http.StatusBadRequest, draftSaveResponse{
			OK:    false,
			Error: "invalid form data",
		})
		return
	}

	title := r.FormValue("title")
	body := r.FormValue("body")
	articleIDRaw := strings.TrimSpace(r.FormValue("article_id"))

	var (
		articleID   int64
		sectionSlug string
		subsection  string
		draftKey    string
	)

	if articleIDRaw != "" {
		parsedID, err := parseArticleID(articleIDRaw)
		if err != nil {
			writeDraftSaveResponse(w, http.StatusBadRequest, draftSaveResponse{
				OK:    false,
				Error: "invalid article id",
			})
			return
		}
		articleID = parsedID

		article, err := a.getArticleByID(articleID)
		if err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				writeDraftSaveResponse(w, http.StatusNotFound, draftSaveResponse{
					OK:    false,
					Error: "article not found",
				})
				return
			}
			a.logger.Printf("get article by id before draft save: %v", err)
			writeDraftSaveResponse(w, http.StatusInternalServerError, draftSaveResponse{
				OK:    false,
				Error: "internal server error",
			})
			return
		}

		if article.AuthorID != user.ID && !user.IsAdmin() {
			writeDraftSaveResponse(w, http.StatusForbidden, draftSaveResponse{
				OK:    false,
				Error: "forbidden",
			})
			return
		}

		sectionSlug = article.SectionSlug
		subsection = article.Subsection
		draftKey = articleDraftKeyForArticle(articleID)
	} else {
		sectionSlug = strings.TrimSpace(r.FormValue("section"))
		section, ok := findWikiSection(sectionSlug)
		if !ok {
			writeDraftSaveResponse(w, http.StatusBadRequest, draftSaveResponse{
				OK:    false,
				Error: "unknown section",
			})
			return
		}

		sectionSlug = section.Slug
		subsection = normalizeSubsection(section, r.FormValue("subsection"))
		draftKey = articleDraftKeyForNew(sectionSlug, subsection)
	}

	if strings.TrimSpace(title) == "" && strings.TrimSpace(body) == "" {
		if err := a.deleteArticleDraftByKey(user.ID, draftKey); err != nil {
			a.logger.Printf("delete article draft by key: %v", err)
			writeDraftSaveResponse(w, http.StatusInternalServerError, draftSaveResponse{
				OK:    false,
				Error: "internal server error",
			})
			return
		}
		writeDraftSaveResponse(w, http.StatusOK, draftSaveResponse{
			OK:      true,
			Deleted: true,
		})
		return
	}

	draft, err := a.upsertArticleDraft(user.ID, draftKey, articleID, sectionSlug, subsection, title, body)
	if err != nil {
		a.logger.Printf("upsert article draft: %v", err)
		writeDraftSaveResponse(w, http.StatusInternalServerError, draftSaveResponse{
			OK:    false,
			Error: "internal server error",
		})
		return
	}

	writeDraftSaveResponse(w, http.StatusOK, draftSaveResponse{
		OK:      true,
		SavedAt: draft.UpdatedAt.Format(time.RFC3339),
	})
}

func (a *Application) handleArticleCommentAdd(w http.ResponseWriter, r *http.Request) {
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

	body := strings.TrimSpace(r.FormValue("body"))
	if utf8.RuneCountInString(body) < 2 {
		http.Redirect(
			w,
			r,
			articleViewRedirectURL(articleID, "", "Комментарий слишком короткий."),
			http.StatusSeeOther,
		)
		return
	}
	if utf8.RuneCountInString(body) > 2000 {
		http.Redirect(
			w,
			r,
			articleViewRedirectURL(articleID, "", "Комментарий слишком длинный (максимум 2000 символов)."),
			http.StatusSeeOther,
		)
		return
	}

	if _, err := a.getArticleByID(articleID); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			http.NotFound(w, r)
			return
		}
		a.logger.Printf("get article by id before add comment: %v", err)
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}

	if _, err := a.createArticleComment(articleID, user.ID, body); err != nil {
		a.logger.Printf("create article comment: %v", err)
		http.Redirect(
			w,
			r,
			articleViewRedirectURL(articleID, "", "Не удалось добавить комментарий."),
			http.StatusSeeOther,
		)
		return
	}

	http.Redirect(
		w,
		r,
		articleViewRedirectURL(articleID, "Комментарий добавлен.", ""),
		http.StatusSeeOther,
	)
}

func (a *Application) handleArticleCommentDelete(w http.ResponseWriter, r *http.Request) {
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
	commentID, err := parsePositiveID(r.FormValue("comment_id"))
	if err != nil {
		http.Error(w, "invalid comment id", http.StatusBadRequest)
		return
	}

	comment, err := a.getArticleCommentByID(commentID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			http.Redirect(
				w,
				r,
				articleViewRedirectURL(articleID, "", "Комментарий не найден."),
				http.StatusSeeOther,
			)
			return
		}
		a.logger.Printf("get article comment by id: %v", err)
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}

	if comment.ArticleID != articleID {
		http.Redirect(
			w,
			r,
			articleViewRedirectURL(articleID, "", "Комментарий не относится к этой статье."),
			http.StatusSeeOther,
		)
		return
	}

	if !a.canManageComment(user, comment) {
		http.Error(w, "forbidden", http.StatusForbidden)
		return
	}

	if err := a.deleteArticleCommentByID(commentID); err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			http.Redirect(
				w,
				r,
				articleViewRedirectURL(articleID, "", "Комментарий уже удалён."),
				http.StatusSeeOther,
			)
			return
		}
		a.logger.Printf("delete article comment by id: %v", err)
		http.Error(w, "internal server error", http.StatusInternalServerError)
		return
	}

	http.Redirect(
		w,
		r,
		articleViewRedirectURL(articleID, "Комментарий удалён.", ""),
		http.StatusSeeOther,
	)
}
