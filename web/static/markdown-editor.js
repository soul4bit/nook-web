(() => {
  const BLOCK_ACTIONS = {
    h1: "# ",
    h2: "## ",
    h3: "### ",
    quote: "> ",
    ul: "- ",
    ol: "1. ",
    task: "- [ ] ",
  };

  function escapeHTML(value) {
    return value
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function decodeEntities(value) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(value, "text/html");
    return doc.documentElement.textContent || "";
  }

  function sanitizeURL(raw) {
    const value = decodeEntities((raw || "").trim());
    if (value === "") {
      return "";
    }
    try {
      const url = new URL(value, window.location.origin);
      if (url.protocol === "http:" || url.protocol === "https:") {
        return url.href;
      }
    } catch (_) {
      return "";
    }
    return "";
  }

  function replaceSelection(textarea, before, after, placeholder) {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const source = textarea.value;
    const selected = source.slice(start, end) || placeholder;
    const replacement = `${before}${selected}${after}`;
    textarea.setRangeText(replacement, start, end, "end");
    const cursorPos = start + replacement.length;
    textarea.setSelectionRange(cursorPos, cursorPos);
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    textarea.focus();
  }

  function prefixSelectionLines(textarea, prefix) {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const source = textarea.value;

    const lineStart = source.lastIndexOf("\n", Math.max(0, start - 1)) + 1;
    let lineEnd = source.indexOf("\n", end);
    if (lineEnd === -1) {
      lineEnd = source.length;
    }

    const block = source.slice(lineStart, lineEnd);
    const prefixed = block
      .split("\n")
      .map((line) => `${prefix}${line}`)
      .join("\n");

    textarea.setRangeText(prefixed, lineStart, lineEnd, "end");
    textarea.setSelectionRange(lineStart, lineStart + prefixed.length);
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    textarea.focus();
  }

  function insertSnippet(textarea, snippet) {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const source = textarea.value;
    const before = source.slice(0, start);
    const needsLeadingBreak = before !== "" && !before.endsWith("\n");
    const replacement = `${needsLeadingBreak ? "\n" : ""}${snippet}\n`;

    textarea.setRangeText(replacement, start, end, "end");
    const cursorPos = start + replacement.length;
    textarea.setSelectionRange(cursorPos, cursorPos);
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    textarea.focus();
  }

  function insertLink(textarea, isImage) {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = textarea.value.slice(start, end).trim();
    const label = selected || (isImage ? "image" : "link");

    const defaultURL = "https://";
    const rawURL = window.prompt(isImage ? "Image URL" : "Link URL", defaultURL);
    if (!rawURL) {
      return;
    }
    const safeURL = sanitizeURL(rawURL);
    if (!safeURL) {
      window.alert("Only http/https URLs are allowed.");
      return;
    }

    const replacement = isImage ? `![${label}](${safeURL})` : `[${label}](${safeURL})`;
    textarea.setRangeText(replacement, start, end, "end");
    const cursorPos = start + replacement.length;
    textarea.setSelectionRange(cursorPos, cursorPos);
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    textarea.focus();
  }

  function renderInline(markdown) {
    let safe = escapeHTML(markdown);
    const tokens = [];
    const reserve = (html) => {
      const id = tokens.length;
      tokens.push(html);
      return `@@MDTOKEN${id}@@`;
    };

    safe = safe.replace(/`([^`\n]+)`/g, (_, code) => reserve(`<code>${code}</code>`));

    safe = safe.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g, (_, alt, url, title) => {
      const safeURL = sanitizeURL(url);
      if (!safeURL) {
        return reserve(`<span class="atlas-md-bad-url">[blocked image]</span>`);
      }
      const altSafe = alt || "image";
      const titleSafe = title ? ` title="${escapeHTML(decodeEntities(title))}"` : "";
      return reserve(
        `<img src="${escapeHTML(safeURL)}" alt="${altSafe}"${titleSafe} loading="lazy" decoding="async" />`
      );
    });

    safe = safe.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g, (_, label, url, title) => {
      const safeURL = sanitizeURL(url);
      if (!safeURL) {
        return reserve(`<span class="atlas-md-bad-url">[blocked link]</span>`);
      }
      const titleSafe = title ? ` title="${escapeHTML(decodeEntities(title))}"` : "";
      return reserve(
        `<a href="${escapeHTML(safeURL)}" target="_blank" rel="noopener noreferrer"${titleSafe}>${label}</a>`
      );
    });

    safe = safe.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    safe = safe.replace(/\*([^*]+)\*/g, "<em>$1</em>");
    safe = safe.replace(/~~([^~]+)~~/g, "<del>$1</del>");
    safe = safe.replace(/@@MDTOKEN(\d+)@@/g, (_, idx) => tokens[Number(idx)] || "");

    return safe;
  }

  function renderListItem(item) {
    const task = item.match(/^\[([ xX])\]\s+(.*)$/);
    if (!task) {
      return `<li>${renderInline(item)}</li>`;
    }

    const checked = task[1].toLowerCase() === "x";
    const label = renderInline(task[2]);
    return `<li><label><input type="checkbox" disabled${checked ? " checked" : ""} /> ${label}</label></li>`;
  }

  function isTableSeparatorLine(line) {
    return /^\s*\|?(?:\s*:?-{3,}:?\s*\|)+\s*:?-{3,}:?\s*\|?\s*$/.test(line);
  }

  function splitTableRow(line) {
    const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
    return trimmed.split("|").map((cell) => cell.trim());
  }

  function renderMarkdown(markdown) {
    const lines = markdown.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
    const chunks = [];
    let index = 0;

    const isStartOfBlock = (line) => {
      return (
        /^#{1,6}\s+/.test(line) ||
        /^>\s?/.test(line) ||
        /^```/.test(line) ||
        /^[-*+]\s+/.test(line) ||
        /^\d+\.\s+/.test(line) ||
        /^\s*\|.+\|\s*$/.test(line) ||
        /^\s*([-*_]){3,}\s*$/.test(line)
      );
    };

    while (index < lines.length) {
      const line = lines[index];

      if (/^\s*$/.test(line)) {
        index += 1;
        continue;
      }

      if (/^```/.test(line)) {
        const lang = line.replace(/^```/, "").trim();
        const code = [];
        index += 1;
        while (index < lines.length && !/^```/.test(lines[index])) {
          code.push(lines[index]);
          index += 1;
        }
        if (index < lines.length && /^```/.test(lines[index])) {
          index += 1;
        }
        const langClass = lang ? ` class="language-${escapeHTML(lang)}"` : "";
        chunks.push(`<pre><code${langClass}>${escapeHTML(code.join("\n"))}</code></pre>`);
        continue;
      }

      const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
      if (headingMatch) {
        const level = headingMatch[1].length;
        chunks.push(`<h${level}>${renderInline(headingMatch[2])}</h${level}>`);
        index += 1;
        continue;
      }

      if (/^\s*([-*_]){3,}\s*$/.test(line)) {
        chunks.push("<hr />");
        index += 1;
        continue;
      }

      if (line.includes("|") && index + 1 < lines.length && isTableSeparatorLine(lines[index + 1])) {
        const headerCells = splitTableRow(line);
        index += 2;

        const bodyRows = [];
        while (index < lines.length && !/^\s*$/.test(lines[index]) && lines[index].includes("|")) {
          bodyRows.push(splitTableRow(lines[index]));
          index += 1;
        }

        const head = `<thead><tr>${headerCells.map((cell) => `<th>${renderInline(cell)}</th>`).join("")}</tr></thead>`;
        const body = `<tbody>${bodyRows
          .map((row) => {
            const normalized = [...row];
            while (normalized.length < headerCells.length) {
              normalized.push("");
            }
            return `<tr>${normalized.slice(0, headerCells.length).map((cell) => `<td>${renderInline(cell)}</td>`).join("")}</tr>`;
          })
          .join("")}</tbody>`;

        chunks.push(`<table>${head}${body}</table>`);
        continue;
      }

      if (/^>\s?/.test(line)) {
        const quote = [];
        while (index < lines.length && /^>\s?/.test(lines[index])) {
          quote.push(lines[index].replace(/^>\s?/, ""));
          index += 1;
        }
        chunks.push(`<blockquote><p>${renderInline(quote.join("\n")).replaceAll("\n", "<br />")}</p></blockquote>`);
        continue;
      }

      if (/^[-*+]\s+/.test(line)) {
        const items = [];
        while (index < lines.length && /^[-*+]\s+/.test(lines[index])) {
          items.push(lines[index].replace(/^[-*+]\s+/, ""));
          index += 1;
        }
        chunks.push(`<ul>${items.map((item) => renderListItem(item)).join("")}</ul>`);
        continue;
      }

      if (/^\d+\.\s+/.test(line)) {
        const items = [];
        while (index < lines.length && /^\d+\.\s+/.test(lines[index])) {
          items.push(lines[index].replace(/^\d+\.\s+/, ""));
          index += 1;
        }
        chunks.push(`<ol>${items.map((item) => renderListItem(item)).join("")}</ol>`);
        continue;
      }

      const paragraph = [];
      while (index < lines.length && !/^\s*$/.test(lines[index]) && !isStartOfBlock(lines[index])) {
        paragraph.push(lines[index]);
        index += 1;
      }
      chunks.push(`<p>${renderInline(paragraph.join("\n")).replaceAll("\n", "<br />")}</p>`);
    }

    return chunks.join("");
  }

  function buildToolbarButton(label, action, titleText) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "atlas-md-btn";
    button.dataset.mdAction = action;
    button.textContent = label;
    button.title = titleText;
    return button;
  }

  function initEditor(textarea) {
    const wrapper = document.createElement("div");
    wrapper.className = "atlas-md-editor";

    const toolbar = document.createElement("div");
    toolbar.className = "atlas-md-toolbar";

    const toolbarButtons = [
      ["H1", "h1", "Big title"],
      ["H2", "h2", "Section title"],
      ["H3", "h3", "Small title"],
      ["B", "bold", "Bold"],
      ["I", "italic", "Italic"],
      ["Code", "code", "Inline code"],
      ["Code+", "codeblock", "Code block"],
      ["Quote", "quote", "Quote block"],
      ["List", "ul", "Bulleted list"],
      ["1.", "ol", "Numbered list"],
      ["Task", "task", "Checklist item"],
      ["Table", "table", "Insert table"],
      ["Hr", "hr", "Horizontal rule"],
      ["Link", "link", "Insert link"],
      ["Image", "image", "Insert image URL"],
    ];

    for (const [label, action, titleText] of toolbarButtons) {
      toolbar.append(buildToolbarButton(label, action, titleText));
    }

    const modeSwitch = document.createElement("div");
    modeSwitch.className = "atlas-md-mode";

    const writeBtn = buildToolbarButton("Write", "mode-write", "Edit markdown");
    writeBtn.classList.add("atlas-md-btn-active");
    writeBtn.dataset.mdMode = "write";
    const previewBtn = buildToolbarButton("Preview", "mode-preview", "Preview rendered markdown");
    previewBtn.dataset.mdMode = "preview";

    modeSwitch.append(writeBtn, previewBtn);
    toolbar.append(modeSwitch);

    const preview = document.createElement("div");
    preview.className = "atlas-md-preview";
    preview.hidden = true;

    textarea.classList.add("atlas-md-input");
    textarea.dataset.mdEditorReady = "1";

    textarea.parentNode.insertBefore(wrapper, textarea);
    wrapper.append(toolbar);
    wrapper.append(textarea);
    wrapper.append(preview);

    const setMode = (mode) => {
      const previewMode = mode === "preview";
      writeBtn.classList.toggle("atlas-md-btn-active", !previewMode);
      previewBtn.classList.toggle("atlas-md-btn-active", previewMode);
      textarea.hidden = previewMode;
      preview.hidden = !previewMode;
      if (previewMode) {
        preview.innerHTML = renderMarkdown(textarea.value.trim());
      }
    };

    toolbar.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLButtonElement)) {
        return;
      }
      const action = target.dataset.mdAction;
      if (!action) {
        return;
      }

      switch (action) {
        case "bold":
          replaceSelection(textarea, "**", "**", "bold text");
          break;
        case "italic":
          replaceSelection(textarea, "*", "*", "italic text");
          break;
        case "code":
          replaceSelection(textarea, "`", "`", "code");
          break;
        case "codeblock":
          insertSnippet(textarea, "```bash\n# command\n```");
          break;
        case "table":
          insertSnippet(textarea, "| Column 1 | Column 2 |\n| --- | --- |\n| Value | Value |");
          break;
        case "hr":
          insertSnippet(textarea, "---");
          break;
        case "link":
          insertLink(textarea, false);
          break;
        case "image":
          insertLink(textarea, true);
          break;
        case "h1":
        case "h2":
        case "h3":
        case "quote":
        case "ul":
        case "ol":
        case "task":
          prefixSelectionLines(textarea, BLOCK_ACTIONS[action]);
          break;
        case "mode-write":
          setMode("write");
          break;
        case "mode-preview":
          setMode("preview");
          break;
        default:
          break;
      }
    });

    textarea.addEventListener("input", () => {
      if (!preview.hidden) {
        preview.innerHTML = renderMarkdown(textarea.value.trim());
      }
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    const editors = document.querySelectorAll("textarea[data-md-editor]");
    for (const node of editors) {
      if (!(node instanceof HTMLTextAreaElement)) {
        continue;
      }
      initEditor(node);
    }
  });
})();
