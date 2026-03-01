"use client";

import { useEffect, useMemo, useRef } from "react";
import hljs from "highlight.js";
import { cn } from "@/lib/utils";

type WikiLink = {
  slug: string;
  title: string;
  href: string;
};

type ArticleContentProps = {
  html: string;
  wikiLinks: WikiLink[];
  className?: string;
};

function normalizeWikiSlug(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, "-");
}

function getCodeLanguage(codeElement: HTMLElement) {
  const languageClass = Array.from(codeElement.classList).find(
    (className) =>
      className.startsWith("language-") || className.startsWith("lang-")
  );

  if (!languageClass) {
    return "text";
  }

  return languageClass.split("-").slice(1).join("-") || "text";
}

function replaceWikiTokens(root: HTMLElement, wikiMap: Map<string, WikiLink>) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const text = node.nodeValue ?? "";
      const parent = node.parentElement;

      if (!text.includes("[[") || !parent) {
        return NodeFilter.FILTER_REJECT;
      }

      if (parent.closest("pre, code, a")) {
        return NodeFilter.FILTER_REJECT;
      }

      return NodeFilter.FILTER_ACCEPT;
    },
  });

  const textNodes: Text[] = [];
  let currentNode: Node | null = null;

  while ((currentNode = walker.nextNode())) {
    textNodes.push(currentNode as Text);
  }

  const tokenPattern = /\[\[([^[\]]+)\]\]/g;

  for (const textNode of textNodes) {
    const text = textNode.nodeValue ?? "";
    let match: RegExpExecArray | null = null;
    let lastIndex = 0;
    const fragment = document.createDocumentFragment();
    let replaced = false;

    while ((match = tokenPattern.exec(text)) !== null) {
      const [rawToken, rawSlug] = match;
      const start = match.index;

      if (start > lastIndex) {
        fragment.append(document.createTextNode(text.slice(lastIndex, start)));
      }

      const normalizedSlug = normalizeWikiSlug(rawSlug);
      const link = wikiMap.get(normalizedSlug);

      if (link) {
        const anchor = document.createElement("a");
        anchor.href = link.href;
        anchor.className = "nook-wiki-link";
        anchor.textContent = link.title;
        anchor.title = `Открыть: ${link.title}`;
        fragment.append(anchor);
      } else {
        const missing = document.createElement("span");
        missing.className = "nook-wiki-missing";
        missing.textContent = rawToken;
        missing.title = `Статья не найдена: ${normalizedSlug}`;
        fragment.append(missing);
      }

      lastIndex = start + rawToken.length;
      replaced = true;
    }

    if (!replaced) {
      continue;
    }

    if (lastIndex < text.length) {
      fragment.append(document.createTextNode(text.slice(lastIndex)));
    }

    textNode.parentNode?.replaceChild(fragment, textNode);
  }
}

function enhanceCodeBlocks(root: HTMLElement) {
  const codeElements = root.querySelectorAll("pre > code");

  for (const codeNode of codeElements) {
    const codeElement = codeNode as HTMLElement;
    const preElement = codeElement.parentElement;

    if (!preElement) {
      continue;
    }

    try {
      hljs.highlightElement(codeElement);
    } catch {
      // Если язык не определился, оставляем блок как есть.
    }

    const snippetWrapper = document.createElement("div");
    snippetWrapper.className = "nook-snippet";

    const toolbar = document.createElement("div");
    toolbar.className = "nook-snippet-toolbar";

    const languageBadge = document.createElement("span");
    languageBadge.className = "nook-snippet-lang";
    languageBadge.textContent = getCodeLanguage(codeElement).toUpperCase();

    const copyButton = document.createElement("button");
    copyButton.type = "button";
    copyButton.className = "nook-snippet-copy";
    copyButton.textContent = "Копировать";

    const codeText = codeElement.textContent ?? "";
    copyButton.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(codeText);
        copyButton.textContent = "Скопировано";
      } catch {
        copyButton.textContent = "Ошибка";
      } finally {
        window.setTimeout(() => {
          copyButton.textContent = "Копировать";
        }, 1500);
      }
    });

    toolbar.append(languageBadge, copyButton);
    preElement.parentNode?.insertBefore(snippetWrapper, preElement);
    snippetWrapper.append(toolbar, preElement);
  }
}

export function ArticleContent({
  html,
  wikiLinks,
  className,
}: ArticleContentProps) {
  const rootRef = useRef<HTMLElement | null>(null);
  const wikiMap = useMemo(() => {
    const entries = wikiLinks.map((link) => [normalizeWikiSlug(link.slug), link] as const);
    return new Map(entries);
  }, [wikiLinks]);

  useEffect(() => {
    const root = rootRef.current;

    if (!root) {
      return;
    }

    root.innerHTML = html;
    replaceWikiTokens(root, wikiMap);
    enhanceCodeBlocks(root);
  }, [html, wikiMap]);

  return <article ref={rootRef} className={cn("nook-editor", className)} />;
}
