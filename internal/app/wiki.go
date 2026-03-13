package app

import (
	"strings"
	"sync"
)

type wikiSection struct {
	Slug        string
	Name        string
	Subsections []string
}

var defaultWikiSectionCatalog = []wikiSection{
	{
		Slug: "linux",
		Name: "Linux",
		Subsections: []string{
			"Файловая система",
			"systemd и сервисы",
			"Shell и bash",
			"Права и пользователи",
		},
	},
	{
		Slug: "docker",
		Name: "Docker",
		Subsections: []string{
			"Dockerfile паттерны",
			"Compose и окружения",
			"Volumes и сети",
			"Registry и образы",
		},
	},
	{
		Slug: "network",
		Name: "Сети",
		Subsections: []string{
			"DNS и домены",
			"Nginx reverse proxy",
			"Firewall правила",
			"SSL и сертификаты",
		},
	},
	{
		Slug: "k8s",
		Name: "K8s",
		Subsections: []string{
			"Pods и Deployments",
			"Services и Ingress",
			"ConfigMap/Secrets",
			"Helm chart notes",
		},
	},
	{
		Slug: "ci-cd",
		Name: "CI/CD",
		Subsections: []string{
			"GitHub Actions",
			"Стратегии деплоя",
			"Rollback сценарии",
			"Release checklist",
		},
	},
	{
		Slug: "general",
		Name: "Общее",
		Subsections: []string{
			"Чеклисты дежурств",
			"FAQ и шпаргалки",
			"Postmortem шаблоны",
			"Внутренние стандарты",
		},
	},
}

var (
	wikiCatalogMu      sync.RWMutex
	wikiSectionCatalog = cloneWikiSections(defaultWikiSectionCatalog)
)

func cloneWikiSections(source []wikiSection) []wikiSection {
	result := make([]wikiSection, 0, len(source))
	for _, section := range source {
		copySection := wikiSection{
			Slug:        section.Slug,
			Name:        section.Name,
			Subsections: append([]string(nil), section.Subsections...),
		}
		result = append(result, copySection)
	}
	return result
}

func defaultWikiSections() []wikiSection {
	return cloneWikiSections(defaultWikiSectionCatalog)
}

func setWikiSectionCatalog(sections []wikiSection) {
	normalized := cloneWikiSections(sections)
	if len(normalized) == 0 {
		normalized = defaultWikiSections()
	}

	wikiCatalogMu.Lock()
	wikiSectionCatalog = normalized
	wikiCatalogMu.Unlock()
}

func normalizeWikiSectionSlug(raw string) string {
	return strings.ToLower(strings.TrimSpace(raw))
}

func isValidWikiSectionSlug(slug string) bool {
	value := normalizeWikiSectionSlug(slug)
	if value == "" || len(value) > 64 {
		return false
	}

	previousWasDash := true
	for _, r := range value {
		if (r >= 'a' && r <= 'z') || (r >= '0' && r <= '9') {
			previousWasDash = false
			continue
		}
		if r == '-' {
			if previousWasDash {
				return false
			}
			previousWasDash = true
			continue
		}
		return false
	}

	return !previousWasDash
}

func wikiSections() []wikiSection {
	wikiCatalogMu.RLock()
	defer wikiCatalogMu.RUnlock()
	return cloneWikiSections(wikiSectionCatalog)
}

func findWikiSection(slug string) (wikiSection, bool) {
	wikiCatalogMu.RLock()
	defer wikiCatalogMu.RUnlock()

	for _, section := range wikiSectionCatalog {
		if section.Slug != slug {
			continue
		}
		return wikiSection{
			Slug:        section.Slug,
			Name:        section.Name,
			Subsections: append([]string(nil), section.Subsections...),
		}, true
	}

	return wikiSection{}, false
}

func wikiSectionName(slug string) string {
	wikiCatalogMu.RLock()
	defer wikiCatalogMu.RUnlock()

	for _, section := range wikiSectionCatalog {
		if section.Slug == slug {
			return section.Name
		}
	}
	return "Разное"
}

func normalizeSubsection(section wikiSection, raw string) string {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return ""
	}

	for _, subsection := range section.Subsections {
		if trimmed == subsection {
			return subsection
		}
	}

	return ""
}
