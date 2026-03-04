(() => {
  function filterSidebar(sidebar, query) {
    const items = Array.from(sidebar.querySelectorAll(".atlas-nav-item"));
    let anyVisible = false;

    for (const item of items) {
      const titleNode = item.querySelector(".atlas-nav-title");
      if (!titleNode) {
        item.style.display = "none";
        continue;
      }

      const sectionText = titleNode.textContent.toLowerCase();
      const subsectionLinks = Array.from(item.querySelectorAll(".atlas-sub-link"));
      const sectionMatches = sectionText.includes(query);
      let hasVisibleSubsection = false;

      for (const link of subsectionLinks) {
        const row = link.closest("li");
        if (!row) {
          continue;
        }

        const subsectionMatches = link.textContent.toLowerCase().includes(query);
        const isVisible = query === "" || sectionMatches || subsectionMatches;
        row.style.display = isVisible ? "" : "none";
        if (isVisible) {
          hasVisibleSubsection = true;
        }
      }

      const showSection = query === "" || sectionMatches || hasVisibleSubsection;
      item.style.display = showSection ? "" : "none";
      if (showSection) {
        anyVisible = true;
      }
    }

    const emptyNode = sidebar.querySelector("[data-nav-empty]");
    if (emptyNode) {
      emptyNode.hidden = anyVisible;
    }
  }

  function initSidebarSearch() {
    const sidebars = document.querySelectorAll(".atlas-sections-sidebar");
    for (const sidebar of sidebars) {
      const input = sidebar.querySelector(".atlas-nav-search");
      if (!(input instanceof HTMLInputElement)) {
        continue;
      }

      const applyFilter = () => {
        filterSidebar(sidebar, input.value.trim().toLowerCase());
      };

      input.addEventListener("input", applyFilter);
      applyFilter();
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    initSidebarSearch();
  });
})();
