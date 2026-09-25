/* Publications catalogue: search, filters, sorting and reference copying.
   Theme, language link and the mobile menu are handled by site.js. */
(() => {
  const root = document.documentElement;
  const arabic = root.lang === "ar";
  const list = document.getElementById("publicationList");
  const cards = [...list.querySelectorAll(".publication-card")];
  const total = cards.length;
  const search = document.getElementById("searchInput");
  const theme = document.getElementById("themeFilter");
  const year = document.getElementById("yearFilter");
  const type = document.getElementById("typeFilter");
  const sort = document.getElementById("sortOrder");
  const count = document.getElementById("resultCount");
  const empty = document.getElementById("emptyState");
  const clear = document.getElementById("clearFilters");

  const normalize = (value) =>
    value
      .toLocaleLowerCase()
      .normalize("NFKD")
      .replace(/[ً-ٰٟ]/g, "")
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .trim();

  function applyFilters() {
    const query = normalize(search.value);
    const visible = cards.filter((card) => {
      const matchesQuery = !query || normalize(card.dataset.search).includes(query);
      const matchesTheme = !theme.value || card.dataset.theme === theme.value;
      const matchesYear = !year.value || card.dataset.year === year.value;
      const matchesType = !type.value || card.dataset.type === type.value;
      const show = matchesQuery && matchesTheme && matchesYear && matchesType;
      card.hidden = !show;
      return show;
    });

    visible
      .sort((a, b) => {
        const direction = sort.value === "oldest" ? 1 : -1;
        return (
          direction * (Number(a.dataset.year) - Number(b.dataset.year)) ||
          direction * a.dataset.id.localeCompare(b.dataset.id)
        );
      })
      .forEach((card) => list.appendChild(card));

    count.textContent = arabic
      ? `${visible.length} نتيجة من ${total}`
      : `${visible.length} of ${total} results`;
    empty.hidden = visible.length !== 0;
  }

  [search, theme, year, type, sort].forEach((control) => {
    control.addEventListener(control === search ? "input" : "change", applyFilters);
  });

  clear.addEventListener("click", () => {
    search.value = "";
    theme.value = "";
    year.value = "";
    type.value = "";
    sort.value = "newest";
    applyFilters();
    search.focus();
  });

  document.querySelectorAll(".copy-reference").forEach((button) => {
    button.addEventListener("click", async () => {
      const original = button.textContent;
      try {
        await navigator.clipboard.writeText(button.dataset.reference);
        button.textContent = arabic ? "تم النسخ" : "Copied";
      } catch (_) {
        button.textContent = arabic ? "تعذر النسخ" : "Copy failed";
      }
      window.setTimeout(() => {
        button.textContent = original;
      }, 1400);
    });
  });

  applyFilters();
})();
