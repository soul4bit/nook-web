package app

import (
	"html/template"
	"strings"
	"testing"
)

func resetMarkdownCacheForTest() {
	markdownRenderCacheMu.Lock()
	defer markdownRenderCacheMu.Unlock()
	markdownRenderCache = make(map[string]template.HTML, markdownRenderCacheLimit)
	markdownRenderCacheOrder = make([]string, 0, markdownRenderCacheLimit)
}

func TestAddImageLoadingAttrsAddsMissingAttributes(t *testing.T) {
	input := `<p><img src="https://example.com/a.jpg" alt="a"></p>`
	output := addImageLoadingAttrs(input)

	if !strings.Contains(output, `loading="lazy"`) {
		t.Fatalf("expected loading attr in %q", output)
	}
	if !strings.Contains(output, `decoding="async"`) {
		t.Fatalf("expected decoding attr in %q", output)
	}
}

func TestAddImageLoadingAttrsDoesNotDuplicateAttributes(t *testing.T) {
	input := `<p><img src="https://example.com/a.jpg" alt="a" loading="lazy" decoding="async"></p>`
	output := addImageLoadingAttrs(input)

	if strings.Count(output, `loading="lazy"`) != 1 {
		t.Fatalf("expected one loading attr in %q", output)
	}
	if strings.Count(output, `decoding="async"`) != 1 {
		t.Fatalf("expected one decoding attr in %q", output)
	}
}

func TestRenderMarkdownHTMLCachesResult(t *testing.T) {
	resetMarkdownCacheForTest()

	source := "![img](https://example.com/a.jpg)"
	key := markdownCacheKey(source)

	if _, ok := markdownCacheGet(key); ok {
		t.Fatal("cache should be empty before rendering")
	}

	first := renderMarkdownHTML(source)
	second := renderMarkdownHTML(source)

	if string(first) != string(second) {
		t.Fatalf("rendered html mismatch: %q != %q", first, second)
	}
	if !strings.Contains(string(first), `loading="lazy"`) {
		t.Fatalf("expected loading attr in rendered html: %q", first)
	}
	if _, ok := markdownCacheGet(key); !ok {
		t.Fatal("expected cached value after rendering")
	}
}
