package app

import "testing"

func TestIsValidWikiSectionSlug(t *testing.T) {
	tests := []struct {
		slug  string
		valid bool
	}{
		{slug: "linux", valid: true},
		{slug: "ci-cd", valid: true},
		{slug: "devops-runbooks-2", valid: true},
		{slug: "", valid: false},
		{slug: "-bad", valid: false},
		{slug: "bad-", valid: false},
		{slug: "bad--slug", valid: false},
		{slug: "bad slug", valid: false},
		{slug: "русский", valid: false},
		{slug: "BadCaps", valid: true},
	}

	for _, tt := range tests {
		got := isValidWikiSectionSlug(tt.slug)
		if got != tt.valid {
			t.Fatalf("isValidWikiSectionSlug(%q) = %v, want %v", tt.slug, got, tt.valid)
		}
	}
}

func TestSetWikiSectionCatalogFallbackToDefault(t *testing.T) {
	t.Cleanup(func() {
		setWikiSectionCatalog(defaultWikiSections())
	})

	setWikiSectionCatalog(nil)
	sections := wikiSections()
	if len(sections) == 0 {
		t.Fatal("wikiSections() returned empty catalog after fallback")
	}
}
