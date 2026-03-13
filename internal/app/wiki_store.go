package app

import (
	"database/sql"
	"errors"
	"strings"
	"unicode/utf8"

	"github.com/jackc/pgx/v5/pgconn"
)

type wikiSectionHasArticlesError struct {
	Count int
}

func (e *wikiSectionHasArticlesError) Error() string {
	if e == nil {
		return "wiki section has articles"
	}
	return "wiki section has articles"
}

type wikiLastSectionDeleteError struct{}

func (e *wikiLastSectionDeleteError) Error() string {
	return "cannot delete last wiki section"
}

type wikiSubsectionHasArticlesError struct {
	Count int
}

func (e *wikiSubsectionHasArticlesError) Error() string {
	if e == nil {
		return "wiki subsection has articles"
	}
	return "wiki subsection has articles"
}

type wikiSubsectionMoveEdgeError struct {
	Direction string
}

func (e *wikiSubsectionMoveEdgeError) Error() string {
	if e == nil {
		return "wiki subsection cannot be moved"
	}
	return "wiki subsection cannot be moved: " + strings.TrimSpace(e.Direction)
}

func isWikiSectionHasArticlesError(err error) (int, bool) {
	var sectionErr *wikiSectionHasArticlesError
	if !errors.As(err, &sectionErr) {
		return 0, false
	}
	if sectionErr == nil {
		return 0, true
	}
	return sectionErr.Count, true
}

func isWikiLastSectionDeleteError(err error) bool {
	var sectionErr *wikiLastSectionDeleteError
	return errors.As(err, &sectionErr)
}

func isWikiSubsectionHasArticlesError(err error) (int, bool) {
	var subsectionErr *wikiSubsectionHasArticlesError
	if !errors.As(err, &subsectionErr) {
		return 0, false
	}
	if subsectionErr == nil {
		return 0, true
	}
	return subsectionErr.Count, true
}

func isWikiSubsectionMoveEdgeError(err error, direction string) bool {
	var subsectionErr *wikiSubsectionMoveEdgeError
	if !errors.As(err, &subsectionErr) {
		return false
	}
	return strings.EqualFold(strings.TrimSpace(subsectionErr.Direction), strings.TrimSpace(direction))
}

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

type wikiSubsectionRecord struct {
	ID        int64
	SectionID int64
	Title     string
	Position  int
}

func normalizeWikiSubsectionTitle(raw string) string {
	return strings.TrimSpace(raw)
}

func normalizeMoveDirection(raw string) string {
	switch strings.ToLower(strings.TrimSpace(raw)) {
	case "up":
		return "up"
	case "down":
		return "down"
	default:
		return ""
	}
}

func selectWikiSubsectionByTitleTx(tx *sql.Tx, sectionID int64, title string, forUpdate bool) (*wikiSubsectionRecord, error) {
	query := `select id, section_id, title, position
		from wiki_subsections
		where section_id = $1 and lower(title) = lower($2)
		limit 1`
	if forUpdate {
		query += " for update"
	}

	row := tx.QueryRow(query, sectionID, title)
	var subsection wikiSubsectionRecord
	if err := row.Scan(&subsection.ID, &subsection.SectionID, &subsection.Title, &subsection.Position); err != nil {
		return nil, err
	}
	return &subsection, nil
}

func selectNeighborSubsectionTx(tx *sql.Tx, sectionID int64, current wikiSubsectionRecord, direction string) (*wikiSubsectionRecord, error) {
	moveDirection := normalizeMoveDirection(direction)
	if moveDirection == "" {
		return nil, errors.New("invalid move direction")
	}

	var row *sql.Row
	if moveDirection == "up" {
		row = tx.QueryRow(
			`select id, section_id, title, position
			from wiki_subsections
			where section_id = $1 and (position < $2 or (position = $2 and id < $3))
			order by position desc, id desc
			limit 1
			for update`,
			sectionID,
			current.Position,
			current.ID,
		)
	} else {
		row = tx.QueryRow(
			`select id, section_id, title, position
			from wiki_subsections
			where section_id = $1 and (position > $2 or (position = $2 and id > $3))
			order by position asc, id asc
			limit 1
			for update`,
			sectionID,
			current.Position,
			current.ID,
		)
	}

	var neighbor wikiSubsectionRecord
	if err := row.Scan(&neighbor.ID, &neighbor.SectionID, &neighbor.Title, &neighbor.Position); err != nil {
		return nil, err
	}
	return &neighbor, nil
}

func resolveWikiSectionBySlugTx(tx *sql.Tx, slug string, forUpdate bool) (int64, error) {
	query := `select id from wiki_sections where slug = $1 limit 1`
	if forUpdate {
		query += " for update"
	}
	var sectionID int64
	if err := tx.QueryRow(query, slug).Scan(&sectionID); err != nil {
		return 0, err
	}
	return sectionID, nil
}

func (a *Application) deleteWikiSubsection(sectionSlug string, subsectionTitle string) error {
	if a == nil || a.db == nil {
		return errors.New("application database is not initialized")
	}

	cleanSectionSlug := normalizeWikiSectionSlug(sectionSlug)
	cleanSubsectionTitle := normalizeWikiSubsectionTitle(subsectionTitle)
	if !isValidWikiSectionSlug(cleanSectionSlug) {
		return errors.New("invalid section slug")
	}
	if utf8.RuneCountInString(cleanSubsectionTitle) < 2 || utf8.RuneCountInString(cleanSubsectionTitle) > 120 {
		return errors.New("invalid subsection title")
	}

	tx, err := a.db.Begin()
	if err != nil {
		return err
	}
	defer func() {
		_ = tx.Rollback()
	}()

	sectionID, err := resolveWikiSectionBySlugTx(tx, cleanSectionSlug, true)
	if err != nil {
		return err
	}

	subsection, err := selectWikiSubsectionByTitleTx(tx, sectionID, cleanSubsectionTitle, true)
	if err != nil {
		return err
	}

	var articleCount int
	if err := tx.QueryRow(
		`select count(*) from articles where section_slug = $1 and lower(subsection) = lower($2)`,
		cleanSectionSlug,
		cleanSubsectionTitle,
	).Scan(&articleCount); err != nil {
		return err
	}
	if articleCount > 0 {
		return &wikiSubsectionHasArticlesError{Count: articleCount}
	}

	if _, err := tx.Exec(`delete from wiki_subsections where id = $1`, subsection.ID); err != nil {
		return err
	}

	if _, err := tx.Exec(
		`update article_drafts
		set subsection = ''
		where section_slug = $1 and lower(subsection) = lower($2)`,
		cleanSectionSlug,
		cleanSubsectionTitle,
	); err != nil {
		return err
	}

	if err := tx.Commit(); err != nil {
		return err
	}

	return a.reloadWikiCatalog()
}

func (a *Application) renameWikiSubsection(sectionSlug string, currentTitle string, newTitle string) error {
	if a == nil || a.db == nil {
		return errors.New("application database is not initialized")
	}

	cleanSectionSlug := normalizeWikiSectionSlug(sectionSlug)
	cleanCurrentTitle := normalizeWikiSubsectionTitle(currentTitle)
	cleanNewTitle := normalizeWikiSubsectionTitle(newTitle)
	if !isValidWikiSectionSlug(cleanSectionSlug) {
		return errors.New("invalid section slug")
	}
	if utf8.RuneCountInString(cleanCurrentTitle) < 2 || utf8.RuneCountInString(cleanCurrentTitle) > 120 {
		return errors.New("invalid current subsection title")
	}
	if utf8.RuneCountInString(cleanNewTitle) < 2 || utf8.RuneCountInString(cleanNewTitle) > 120 {
		return errors.New("invalid new subsection title")
	}

	tx, err := a.db.Begin()
	if err != nil {
		return err
	}
	defer func() {
		_ = tx.Rollback()
	}()

	sectionID, err := resolveWikiSectionBySlugTx(tx, cleanSectionSlug, true)
	if err != nil {
		return err
	}

	subsection, err := selectWikiSubsectionByTitleTx(tx, sectionID, cleanCurrentTitle, true)
	if err != nil {
		return err
	}

	if strings.EqualFold(cleanCurrentTitle, cleanNewTitle) {
		if err := tx.Commit(); err != nil {
			return err
		}
		return nil
	}

	if _, err := tx.Exec(
		`update wiki_subsections set title = $2 where id = $1`,
		subsection.ID,
		cleanNewTitle,
	); err != nil {
		return err
	}

	if _, err := tx.Exec(
		`update articles
		set subsection = $3
		where section_slug = $1 and lower(subsection) = lower($2)`,
		cleanSectionSlug,
		cleanCurrentTitle,
		cleanNewTitle,
	); err != nil {
		return err
	}

	if _, err := tx.Exec(
		`update article_drafts
		set subsection = $3
		where section_slug = $1 and lower(subsection) = lower($2)`,
		cleanSectionSlug,
		cleanCurrentTitle,
		cleanNewTitle,
	); err != nil {
		return err
	}

	if err := tx.Commit(); err != nil {
		return err
	}

	return a.reloadWikiCatalog()
}

func (a *Application) moveWikiSubsection(sectionSlug string, subsectionTitle string, direction string) error {
	if a == nil || a.db == nil {
		return errors.New("application database is not initialized")
	}

	cleanSectionSlug := normalizeWikiSectionSlug(sectionSlug)
	cleanSubsectionTitle := normalizeWikiSubsectionTitle(subsectionTitle)
	cleanDirection := normalizeMoveDirection(direction)
	if !isValidWikiSectionSlug(cleanSectionSlug) {
		return errors.New("invalid section slug")
	}
	if utf8.RuneCountInString(cleanSubsectionTitle) < 2 || utf8.RuneCountInString(cleanSubsectionTitle) > 120 {
		return errors.New("invalid subsection title")
	}
	if cleanDirection == "" {
		return errors.New("invalid move direction")
	}

	tx, err := a.db.Begin()
	if err != nil {
		return err
	}
	defer func() {
		_ = tx.Rollback()
	}()

	sectionID, err := resolveWikiSectionBySlugTx(tx, cleanSectionSlug, true)
	if err != nil {
		return err
	}

	currentSubsection, err := selectWikiSubsectionByTitleTx(tx, sectionID, cleanSubsectionTitle, true)
	if err != nil {
		return err
	}

	neighborSubsection, err := selectNeighborSubsectionTx(tx, sectionID, *currentSubsection, cleanDirection)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return &wikiSubsectionMoveEdgeError{Direction: cleanDirection}
		}
		return err
	}

	if _, err := tx.Exec(
		`update wiki_subsections
		set position = case
			when id = $1 then $4
			when id = $2 then $3
			else position
		end
		where id in ($1, $2)`,
		currentSubsection.ID,
		neighborSubsection.ID,
		currentSubsection.Position,
		neighborSubsection.Position,
	); err != nil {
		return err
	}

	if err := tx.Commit(); err != nil {
		return err
	}

	return a.reloadWikiCatalog()
}

func (a *Application) deleteWikiSection(sectionSlug string) error {
	if a == nil || a.db == nil {
		return errors.New("application database is not initialized")
	}

	cleanSlug := normalizeWikiSectionSlug(sectionSlug)
	if !isValidWikiSectionSlug(cleanSlug) {
		return errors.New("invalid section slug")
	}

	tx, err := a.db.Begin()
	if err != nil {
		return err
	}
	defer func() {
		_ = tx.Rollback()
	}()

	var (
		sectionID    int64
		totalSection int
	)

	if err := tx.QueryRow(`select count(*) from wiki_sections`).Scan(&totalSection); err != nil {
		return err
	}
	if totalSection <= 1 {
		return &wikiLastSectionDeleteError{}
	}

	if err := tx.QueryRow(
		`select id from wiki_sections where slug = $1 limit 1`,
		cleanSlug,
	).Scan(&sectionID); err != nil {
		return err
	}

	var articleCount int
	if err := tx.QueryRow(
		`select count(*) from articles where section_slug = $1`,
		cleanSlug,
	).Scan(&articleCount); err != nil {
		return err
	}
	if articleCount > 0 {
		return &wikiSectionHasArticlesError{Count: articleCount}
	}

	if _, err := tx.Exec(`delete from wiki_sections where id = $1`, sectionID); err != nil {
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
