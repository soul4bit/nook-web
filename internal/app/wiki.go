package app

import "strings"

type wikiSection struct {
	Slug        string
	Name        string
	Subsections []string
}

var wikiSectionCatalog = []wikiSection{
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

func wikiSections() []wikiSection {
	result := make([]wikiSection, 0, len(wikiSectionCatalog))
	for _, section := range wikiSectionCatalog {
		copySection := wikiSection{
			Slug:        section.Slug,
			Name:        section.Name,
			Subsections: append([]string(nil), section.Subsections...),
		}
		result = append(result, copySection)
	}
	return result
}

func findWikiSection(slug string) (wikiSection, bool) {
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
