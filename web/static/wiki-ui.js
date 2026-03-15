(() => {
  const SIDEBAR_QUERY_KEY = "atlas_sidebar_query";
  const MAIN_CONTENT_ID = "atlas-main-content";

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function isTypingTarget(target) {
    if (!(target instanceof HTMLElement)) {
      return false;
    }
    if (target.isContentEditable) {
      return true;
    }
    return (
      target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.tagName === "SELECT"
    );
  }

  function readStoredSidebarQuery() {
    try {
      return window.sessionStorage.getItem(SIDEBAR_QUERY_KEY) || "";
    } catch (_) {
      return "";
    }
  }

  function storeSidebarQuery(query) {
    try {
      window.sessionStorage.setItem(SIDEBAR_QUERY_KEY, query);
    } catch (_) {
      // Ignore storage restrictions in private/incognito modes.
    }
  }

  function setSearchStatus(node, query, sectionCount, subsectionCount) {
    if (!(node instanceof HTMLElement)) {
      return;
    }
    if (query === "") {
      node.hidden = true;
      node.textContent = "";
      node.removeAttribute("data-state");
      return;
    }

    node.hidden = false;
    if (sectionCount > 0) {
      node.dataset.state = "has-results";
      node.textContent = `Matches: ${sectionCount} sections, ${subsectionCount} topics`;
      return;
    }

    node.dataset.state = "empty";
    node.textContent = "No matches";
  }

  function filterSidebar(sidebar, query, statusNode) {
    const items = Array.from(sidebar.querySelectorAll(".atlas-nav-item"));
    let anyVisible = false;
    let visibleSections = 0;
    let visibleSubsections = 0;

    for (const item of items) {
      const titleNode = item.querySelector(".atlas-nav-title");
      if (!titleNode) {
        item.style.display = "none";
        continue;
      }

      const sectionText = titleNode.textContent.toLowerCase();
      const subsectionLinks = Array.from(item.querySelectorAll(".atlas-sub-link"));
      const sectionMatches = query !== "" && sectionText.includes(query);
      item.classList.toggle("atlas-nav-item-match", sectionMatches);

      let hasVisibleSubsection = false;
      for (const link of subsectionLinks) {
        const row = link.closest("li");
        if (!row) {
          continue;
        }

        const subsectionMatches = query !== "" && link.textContent.toLowerCase().includes(query);
        const isVisible = query === "" || sectionMatches || subsectionMatches;
        row.style.display = isVisible ? "" : "none";
        link.classList.toggle("atlas-sub-link-match", subsectionMatches);
        if (isVisible) {
          hasVisibleSubsection = true;
          visibleSubsections += 1;
        }
      }

      const showSection = query === "" || sectionMatches || hasVisibleSubsection;
      item.style.display = showSection ? "" : "none";
      if (showSection) {
        anyVisible = true;
        visibleSections += 1;
      }
    }

    const emptyNode = sidebar.querySelector("[data-nav-empty]");
    if (emptyNode) {
      emptyNode.hidden = anyVisible;
    }

    setSearchStatus(statusNode, query, visibleSections, visibleSubsections);
  }

  function initSidebarSearch() {
    const sidebars = document.querySelectorAll(".atlas-sections-sidebar");
    const storedQuery = readStoredSidebarQuery().trim().toLowerCase();

    for (const sidebar of sidebars) {
      const input = sidebar.querySelector(".atlas-nav-search");
      if (!(input instanceof HTMLInputElement)) {
        continue;
      }

      input.autocomplete = "off";
      input.spellcheck = false;
      if (storedQuery !== "") {
        input.value = storedQuery;
      }

      const statusNode = document.createElement("p");
      statusNode.className = "atlas-nav-search-status";
      statusNode.hidden = true;
      const searchWrap = input.closest(".atlas-nav-search-wrap");
      if (searchWrap && searchWrap.parentNode) {
        searchWrap.parentNode.insertBefore(statusNode, searchWrap.nextSibling);
      }

      const applyFilter = (persist) => {
        const query = input.value.trim().toLowerCase();
        filterSidebar(sidebar, query, statusNode);
        if (persist) {
          storeSidebarQuery(query);
        }
      };

      input.addEventListener("input", () => applyFilter(true));
      input.addEventListener("keydown", (event) => {
        if (event.key !== "Escape") {
          return;
        }
        if (input.value !== "") {
          input.value = "";
          applyFilter(true);
        }
        input.blur();
      });

      const active = sidebar.querySelector(".atlas-sub-link-active, .atlas-nav-link-active");
      if (active instanceof HTMLElement) {
        active.scrollIntoView({ block: "nearest" });
      }

      applyFilter(false);
    }
  }

  function initGlobalHotkeys() {
    document.addEventListener("keydown", (event) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) {
        return;
      }
      if (event.key !== "/" || isTypingTarget(event.target)) {
        return;
      }
      const input = document.querySelector(".atlas-nav-search");
      if (!(input instanceof HTMLInputElement)) {
        return;
      }
      event.preventDefault();
      input.focus();
      input.select();
    });
  }

  function initSkipLink() {
    const main = document.querySelector(".atlas-main");
    if (!(main instanceof HTMLElement)) {
      return;
    }
    if (!main.id) {
      main.id = MAIN_CONTENT_ID;
    }
    if (document.querySelector(".atlas-skip-link")) {
      return;
    }

    const skipLink = document.createElement("a");
    skipLink.className = "atlas-skip-link";
    skipLink.href = `#${main.id}`;
    skipLink.textContent = "Skip to content";
    document.body.prepend(skipLink);
  }

  function initReadingProgress() {
    const articleBody = document.querySelector(".atlas-article-view-body");
    if (!(articleBody instanceof HTMLElement)) {
      return;
    }

    const progress = document.createElement("div");
    progress.className = "atlas-reading-progress";
    progress.innerHTML = '<span class="atlas-reading-progress-fill"></span>';
    const fill = progress.querySelector(".atlas-reading-progress-fill");
    if (!(fill instanceof HTMLElement)) {
      return;
    }

    document.body.prepend(progress);
    let ticking = false;

    const update = () => {
      ticking = false;
      const viewportHeight = window.innerHeight || document.documentElement.clientHeight;
      const scrollTop = window.scrollY || document.documentElement.scrollTop || 0;
      const rect = articleBody.getBoundingClientRect();
      const articleTop = scrollTop + rect.top - 112;
      const availableDistance = Math.max(articleBody.offsetHeight - viewportHeight * 0.48, 1);
      const ratio = clamp((scrollTop - articleTop) / availableDistance, 0, 1);

      fill.style.transform = `scaleX(${ratio.toFixed(4)})`;
      progress.hidden = articleBody.offsetHeight <= viewportHeight * 0.6;
    };

    const scheduleUpdate = () => {
      if (ticking) {
        return;
      }
      ticking = true;
      window.requestAnimationFrame(update);
    };

    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    window.addEventListener("resize", scheduleUpdate);
    scheduleUpdate();
  }

  function attachCounter(field, control) {
    if (!(field instanceof HTMLElement) || !(control instanceof HTMLElement)) {
      return;
    }
    const maxLength = control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement ? control.maxLength : -1;
    if (!(maxLength > 0)) {
      return;
    }

    const counter = document.createElement("small");
    counter.className = "atlas-char-counter";
    field.append(counter);

    const update = () => {
      const valueLength =
        control instanceof HTMLInputElement || control instanceof HTMLTextAreaElement ? control.value.length : 0;
      counter.textContent = `${valueLength}/${maxLength}`;

      const ratio = valueLength / maxLength;
      counter.classList.toggle("is-near-limit", ratio >= 0.85 && ratio < 1);
      counter.classList.toggle("is-limit", ratio >= 1);
    };

    control.addEventListener("input", update);
    update();
  }

  function initArticleFormUX() {
    const forms = document.querySelectorAll("form[data-article-autosave]");
    for (const form of forms) {
      if (!(form instanceof HTMLFormElement)) {
        continue;
      }

      const titleInput = form.querySelector("input[name='title']");
      const bodyInput = form.querySelector("textarea[name='body']");
      if (titleInput instanceof HTMLInputElement) {
        attachCounter(titleInput.closest(".field"), titleInput);
      }
      if (bodyInput instanceof HTMLTextAreaElement) {
        attachCounter(bodyInput.closest(".field"), bodyInput);
      }

      form.addEventListener("keydown", (event) => {
        const saveHotkey = (event.ctrlKey || event.metaKey) && !event.altKey && event.key.toLowerCase() === "s";
        if (!saveHotkey) {
          return;
        }
        event.preventDefault();
        const submitButton = form.querySelector("button[type='submit']");
        if (submitButton instanceof HTMLButtonElement && !submitButton.disabled) {
          submitButton.click();
          return;
        }
        form.requestSubmit();
      });
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    initSkipLink();
    initSidebarSearch();
    initGlobalHotkeys();
    initReadingProgress();

    // Wait until editor scripts finish moving textarea nodes inside wrappers.
    window.setTimeout(() => {
      initArticleFormUX();
    }, 0);
  });
})();
