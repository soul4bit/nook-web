package app

import (
	"bytes"
	"html/template"
	"strings"

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

func renderMarkdownHTML(markdown string) template.HTML {
	source := strings.TrimSpace(markdown)
	if source == "" {
		return template.HTML("")
	}

	var out bytes.Buffer
	if err := articleMarkdownRenderer.Convert([]byte(source), &out); err != nil {
		escaped := template.HTMLEscapeString(source)
		escaped = strings.ReplaceAll(escaped, "\n", "<br>")
		return template.HTML("<p>" + escaped + "</p>")
	}

	return template.HTML(out.String())
}
