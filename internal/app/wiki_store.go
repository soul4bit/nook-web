package app

import (
	"database/sql"
	"errors"
	"fmt"
	"strings"
	"unicode/utf8"

	"github.com/jackc/pgx/v5/pgconn"
)

func initializeWikiCatalog(db *sql.DB) error {
	if db == nil {
		setWikiSectionCatalog(defaultWikiSections())
		return nil
	}

	if err := ensureWikiCatalogSeed(db); err != nil {
		return err
	}

	sections, err := loadWikiSectionsFromDB(db)
	if err != nil {
		return err
	}

	setWikiSectionCatalog(sections)
	return nil
}

func ensureWikiCatalogSeed(db *sql.DB) error {
	var count int
	if err := db.QueryRow(`select count(*) from wiki_sections`).Scan(&count); err != nil {
		return err
	}
	if count > 0 {
		return nil
	}

	tx, err := db.Begin()
	if err != nil {
		return err
	}
	defer func() {
		_ = tx.Rollback()
	}()

	for sectionPosition, section := range defaultWikiSections() {
		slug := normalizeWikiSectionSlug(section.Slug)
		name := strings.TrimSpace(section.Name)
		if slug == "" || name == "" {
			continue
		}

		var sectionID int64
		if err := tx.QueryRow(
			`insert into wiki_sections (slug, name, position)
			values ($1, $2, $3)
			returning id`,
			slug,
			name,
			sectionPosition+1,
		).Scan(&sectionID); err != nil {
			return err
		}

		for subsectionPosition, subsection := range section.Subsections {
			title := strings.TrimSpace(subsection)
			if title == "" {
				continue
			}
			if _, err := tx.Exec(
				`insert into wiki_subsections (section_id, title, position)
				values ($1, $2, $3)`,
				sectionID,
				title,
				subsectionPosition+1,
			); err != nil {
				return err
			}
		}
	}

	return tx.Commit()
}

func loadWikiSectionsFromDB(db *sql.DB) ([]wikiSection, error) {
	rows, err := db.Query(
		`select
			s.id,
			s.slug,
			s.name,
			sub.title
		from wiki_sections s
		left join wiki_subsections sub on sub.section_id = s.id
		order by
			s.position asc,
			s.id asc,
			sub.position asc,
			sub.id asc`,
	)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := make([]wikiSection, 0)
	indexBySectionID := map[int64]int{}

	for rows.Next() {
		var (
			sectionID  int64
			slug       string
			name       string
			subsection sql.NullString
		)
		if err := rows.Scan(&sectionID, &slug, &name, &subsection); err != nil {
			return nil, err
		}

		position, exists := indexBySectionID[sectionID]
		if !exists {
			result = append(result, wikiSection{
				Slug:        normalizeWikiSectionSlug(slug),
				Name:        strings.TrimSpace(name),
				Subsections: []string{},
			})
			position = len(result) - 1
			indexBySectionID[sectionID] = position
		}

		if subsection.Valid {
			title := strings.TrimSpace(subsection.String)
			if title != "" {
				result[position].Subsections = append(result[position].Subsections, title)
			}
		}
	}

	if err := rows.Err(); err != nil {
		return nil, err
	}

	if len(result) == 0 {
		return defaultWikiSections(), nil
	}

	return result, nil
}

func (a *Application) reloadWikiCatalog() error {
	if a == nil || a.db == nil {
		return errors.New("application database is not initialized")
	}

	sections, err := loadWikiSectionsFromDB(a.db)
	if err != nil {
		return err
	}

	setWikiSectionCatalog(sections)
	return nil
}

func (a *Application) createWikiSection(slug string, name string) error {
	if a == nil || a.db == nil {
		return errors.New("application database is not initialized")
	}

	cleanSlug := normalizeWikiSectionSlug(slug)
	cleanName := strings.TrimSpace(name)
	if !isValidWikiSectionSlug(cleanSlug) {
		return errors.New("invalid section slug")
	}
	if utf8.RuneCountInString(cleanName) < 2 || utf8.RuneCountInString(cleanName) > 80 {
		return errors.New("invalid section name")
	}

	tx, err := a.db.Begin()
	if err != nil {
		return err
	}
	defer func() {
		_ = tx.Rollback()
	}()

	var nextPosition int
	if err := tx.QueryRow(`select coalesce(max(position), 0) + 1 from wiki_sections`).Scan(&nextPosition); err != nil {
		return err
	}

	if _, err := tx.Exec(
		`insert into wiki_sections (slug, name, position)
		values ($1, $2, $3)`,
		cleanSlug,
		cleanName,
		nextPosition,
	); err != nil {
		return err
	}

	if err := tx.Commit(); err != nil {
		return err
	}

	return a.reloadWikiCatalog()
}

func (a *Application) createWikiSubsection(sectionSlug string, title string) error {
	if a == nil || a.db == nil {
		return errors.New("application database is not initialized")
	}

	cleanSectionSlug := normalizeWikiSectionSlug(sectionSlug)
	cleanTitle := strings.TrimSpace(title)
	if !isValidWikiSectionSlug(cleanSectionSlug) {
		return errors.New("invalid section slug")
	}
	if utf8.RuneCountInString(cleanTitle) < 2 || utf8.RuneCountInString(cleanTitle) > 120 {
		return errors.New("invalid subsection title")
	}

	tx, err := a.db.Begin()
	if err != nil {
		return err
	}
	defer func() {
		_ = tx.Rollback()
	}()

	var sectionID int64
	if err := tx.QueryRow(
		`select id from wiki_sections where slug = $1 limit 1`,
		cleanSectionSlug,
	).Scan(&sectionID); err != nil {
		return err
	}

	var nextPosition int
	if err := tx.QueryRow(
		`select coalesce(max(position), 0) + 1
		from wiki_subsections
		where section_id = $1`,
		sectionID,
	).Scan(&nextPosition); err != nil {
		return err
	}

	if _, err := tx.Exec(
		`insert into wiki_subsections (section_id, title, position)
		values ($1, $2, $3)`,
		sectionID,
		cleanTitle,
		nextPosition,
	); err != nil {
		return err
	}

	if err := tx.Commit(); err != nil {
		return err
	}

	return a.reloadWikiCatalog()
}

func isWikiUniqueViolation(err error, constraints ...string) bool {
	if err == nil {
		return false
	}

	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		if pgErr.Code != "23505" {
			return false
		}
		constraint := strings.ToLower(strings.TrimSpace(pgErr.ConstraintName))
		for _, expected := range constraints {
			if constraint == strings.ToLower(strings.TrimSpace(expected)) {
				return true
			}
		}
		return true
	}

	text := strings.ToLower(err.Error())
	if !strings.Contains(text, "duplicate key") {
		return false
	}
	if len(constraints) == 0 {
		return true
	}
	for _, expected := range constraints {
		if strings.Contains(text, strings.ToLower(strings.TrimSpace(expected))) {
			return true
		}
	}
	return false
}

func isWikiSectionDuplicateError(err error) bool {
	return isWikiUniqueViolation(
		err,
		"wiki_sections_slug_key",
		"idx_wiki_sections_name_ci_unique",
	)
}

func isWikiSubsectionDuplicateError(err error) bool {
	return isWikiUniqueViolation(
		err,
		"idx_wiki_subsections_section_title_ci_unique",
	)
}

func wikiSectionAdminDetails(slug string, name string) string {
	return fmt.Sprintf("section_slug=%s section_name=%s", strings.TrimSpace(slug), strings.TrimSpace(name))
}

func wikiSubsectionAdminDetails(sectionSlug string, title string) string {
	return fmt.Sprintf("section_slug=%s subsection=%s", strings.TrimSpace(sectionSlug), strings.TrimSpace(title))
}
