package app

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"html/template"
	"regexp"
	"strings"
	"sync"

	"github.com/yuin/goldmark"
	"github.com/yuin/goldmark/extension"
	"github.com/yuin/goldmark/parser"
	gmhtml "github.com/yuin/goldmark/renderer/html"
)

var articleMarkdownRenderer = goldmark.New(
	goldmark.WithExtensions(
		extension.GFM,
	),
	goldmark.WithParserOptions(
		parser.WithAutoHeadingID(),
	),
	goldmark.WithRendererOptions(
		gmhtml.WithHardWraps(),
	),
)

const markdownRenderCacheLimit = 1024

var (
	markdownRenderCacheMu    sync.RWMutex
	markdownRenderCache      = make(map[string]template.HTML, markdownRenderCacheLimit)
	markdownRenderCacheOrder = make([]string, 0, markdownRenderCacheLimit)
	imageTagPattern          = regexp.MustCompile(`(?i)<img\b[^>]*>`)
)

func markdownCacheKey(source string) string {
	sum := sha256.Sum256([]byte(source))
	return hex.EncodeToString(sum[:])
}

func markdownCacheGet(key string) (template.HTML, bool) {
	markdownRenderCacheMu.RLock()
	defer markdownRenderCacheMu.RUnlock()
	value, ok := markdownRenderCache[key]
	return value, ok
}

func markdownCacheSet(key string, value template.HTML) {
	markdownRenderCacheMu.Lock()
	defer markdownRenderCacheMu.Unlock()

	if _, exists := markdownRenderCache[key]; exists {
		return
	}

	if len(markdownRenderCacheOrder) >= markdownRenderCacheLimit {
		evictKey := markdownRenderCacheOrder[0]
		markdownRenderCacheOrder = markdownRenderCacheOrder[1:]
		delete(markdownRenderCache, evictKey)
	}

	markdownRenderCache[key] = value
	markdownRenderCacheOrder = append(markdownRenderCacheOrder, key)
}

func addImageLoadingAttrs(html string) string {
	if !strings.Contains(strings.ToLower(html), "<img") {
		return html
	}

	return imageTagPattern.ReplaceAllStringFunc(html, func(tag string) string {
		lower := strings.ToLower(tag)
		hasLoading := strings.Contains(lower, " loading=")
		hasDecoding := strings.Contains(lower, " decoding=")
		if hasLoading && hasDecoding {
			return tag
		}

		var (
			base   string
			suffix string
		)
		switch {
		case strings.HasSuffix(tag, "/>"):
			base = strings.TrimSuffix(tag, "/>")
			suffix = " />"
		case strings.HasSuffix(tag, ">"):
			base = strings.TrimSuffix(tag, ">")
			suffix = ">"
		default:
			return tag
		}

		addons := make([]string, 0, 2)
		if !hasLoading {
			addons = append(addons, `loading="lazy"`)
		}
		if !hasDecoding {
			addons = append(addons, `decoding="async"`)
		}
		if len(addons) == 0 {
			return tag
		}

		return strings.TrimRight(base, " ") + " " + strings.Join(addons, " ") + suffix
	})
}

func renderMarkdownHTML(markdown string) template.HTML {
	source := strings.TrimSpace(markdown)
	if source == "" {
		return template.HTML("")
	}

	cacheKey := markdownCacheKey(source)
	if cached, ok := markdownCacheGet(cacheKey); ok {
		return cached
	}

	var out bytes.Buffer
	if err := articleMarkdownRenderer.Convert([]byte(source), &out); err != nil {
		escaped := template.HTMLEscapeString(source)
		escaped = strings.ReplaceAll(escaped, "\n", "<br>")
		fallback := template.HTML("<p>" + escaped + "</p>")
		markdownCacheSet(cacheKey, fallback)
		return fallback
	}

	rendered := template.HTML(addImageLoadingAttrs(out.String()))
	markdownCacheSet(cacheKey, rendered)
	return rendered
}
