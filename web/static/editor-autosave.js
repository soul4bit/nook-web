(() => {
  const SAVE_DELAY_MS = 1200;

  function formatSavedAt(raw) {
    if (!raw) {
      return "";
    }
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) {
      return "";
    }
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  function setStatus(node, text, state) {
    if (!(node instanceof HTMLElement)) {
      return;
    }
    node.textContent = text;
    node.classList.remove("is-saving", "is-error", "is-ok");
    if (state) {
      node.classList.add(state);
    }
  }

  function initAutosave(form) {
    if (!(form instanceof HTMLFormElement)) {
      return;
    }

    const endpoint = (form.dataset.autosaveEndpoint || "").trim();
    if (!endpoint) {
      return;
    }

    const titleInput = form.querySelector("input[name='title']");
    const bodyInput = form.querySelector("textarea[name='body']");
    if (!(titleInput instanceof HTMLInputElement) || !(bodyInput instanceof HTMLTextAreaElement)) {
      return;
    }

    const statusNode = form.querySelector("[data-autosave-status]");
    const articleID = (form.dataset.autosaveArticleId || "").trim();
    const section = (form.dataset.autosaveSection || "").trim();
    const subsection = (form.dataset.autosaveSubsection || "").trim();
    const csrfInput = form.querySelector("input[name='csrf_token']");
    const csrfToken = csrfInput instanceof HTMLInputElement ? csrfInput.value.trim() : "";

    if (articleID === "" && section === "") {
      return;
    }

    let debounceTimer = null;
    let inFlight = false;
    let rerunAfterFlight = false;
    let destroyed = false;
    let lastPayload = "";

    const buildPayload = () => {
      const params = new URLSearchParams();
      params.set("title", titleInput.value);
      params.set("body", bodyInput.value);

      if (articleID !== "") {
        params.set("article_id", articleID);
      } else {
        params.set("section", section);
        params.set("subsection", subsection);
      }
      if (csrfToken !== "") {
        params.set("csrf_token", csrfToken);
      }

      return params.toString();
    };

    const saveNow = async (force) => {
      if (destroyed) {
        return;
      }

      const payload = buildPayload();
      if (!force && payload === lastPayload) {
        return;
      }

      if (inFlight) {
        rerunAfterFlight = true;
        return;
      }

      inFlight = true;
      setStatus(statusNode, "Сохраняем черновик...", "is-saving");

      try {
        const response = await fetch(endpoint, {
          method: "POST",
          credentials: "same-origin",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
            "X-Requested-With": "fetch",
            ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
          },
          body: payload,
        });

        const data = await response.json().catch(() => null);
        if (!response.ok || !data || data.ok !== true) {
          throw new Error(data && data.error ? String(data.error) : "request failed");
        }

        lastPayload = payload;
        if (data.deleted) {
          setStatus(statusNode, "Черновик очищен", "is-ok");
        } else {
          const suffix = formatSavedAt(data.saved_at);
          const message = suffix ? `Черновик сохранен в ${suffix}` : "Черновик сохранен";
          setStatus(statusNode, message, "is-ok");
        }
      } catch (_) {
        setStatus(statusNode, "Не удалось автосохранить, повторим при следующем изменении", "is-error");
      } finally {
        inFlight = false;
        if (rerunAfterFlight) {
          rerunAfterFlight = false;
          void saveNow(true);
        }
      }
    };

    const scheduleSave = () => {
      if (destroyed) {
        return;
      }
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      debounceTimer = setTimeout(() => {
        void saveNow(false);
      }, SAVE_DELAY_MS);
    };

    titleInput.addEventListener("input", scheduleSave);
    bodyInput.addEventListener("input", scheduleSave);
    titleInput.addEventListener("blur", () => void saveNow(true));
    bodyInput.addEventListener("blur", () => void saveNow(true));

    form.addEventListener("submit", () => {
      destroyed = true;
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
    });

    setStatus(statusNode, "Автосохранение включено", "");
  }

  document.addEventListener("DOMContentLoaded", () => {
    const forms = document.querySelectorAll("form[data-article-autosave]");
    for (const form of forms) {
      initAutosave(form);
    }
  });
})();
