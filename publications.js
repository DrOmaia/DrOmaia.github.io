(() => {
  const root = document.documentElement;
  const list = document.getElementById("publicationList");
  const cards = [...list.querySelectorAll(".publication-card")];
  const search = document.getElementById("searchInput");
  const theme = document.getElementById("themeFilter");
  const year = document.getElementById("yearFilter");
  const type = document.getElementById("typeFilter");
  const sort = document.getElementById("sortOrder");
  const count = document.getElementById("resultCount");
  const empty = document.getElementById("emptyState");
  const clear = document.getElementById("clearFilters");
  const languageButton = document.getElementById("languageButton");
  const themeButton = document.getElementById("themeButton");

  const normalize = (value) =>
    value
      .toLocaleLowerCase()
      .normalize("NFKD")
      .replace(/[\u064B-\u065F\u0670]/g, "")
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

    const arabic = root.lang === "ar";
    count.textContent = arabic
      ? `${visible.length} نتيجة من 37`
      : `${visible.length} of 37 results`;
    empty.hidden = visible.length !== 0;
  }

  function setLanguage(lang) {
    const arabic = lang === "ar";
    root.lang = lang;
    root.dir = arabic ? "rtl" : "ltr";
    document.querySelectorAll("[data-en][data-ar]").forEach((element) => {
      element.textContent = element.dataset[lang];
    });
    search.placeholder = arabic
      ? "العنوان أو المنهجية أو الموضوع أو المؤلف أو كلمة مفتاحية…"
      : "Title, method, topic, author, keyword…";
    languageButton.textContent = arabic ? "English" : "العربية";
    languageButton.setAttribute(
      "aria-label",
      arabic ? "Switch to English" : "التبديل إلى العربية",
    );
    try {
      localStorage.setItem("language", lang);
    } catch (_) {}
    applyFilters();
  }

  function setTheme(value) {
    root.dataset.theme = value;
    themeButton.textContent = value === "light" ? "◐" : "☼";
    themeButton.setAttribute(
      "aria-label",
      value === "light" ? "Switch to dark theme" : "Switch to light theme",
    );
    try {
      localStorage.setItem("theme", value);
    } catch (_) {}
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
        button.textContent = root.lang === "ar" ? "تم النسخ" : "Copied";
      } catch (_) {
        button.textContent = root.lang === "ar" ? "تعذر النسخ" : "Copy failed";
      }
      window.setTimeout(() => {
        button.textContent = original;
      }, 1400);
    });
  });

  languageButton.addEventListener("click", () => {
    setLanguage(root.lang === "ar" ? "en" : "ar");
  });

  themeButton.addEventListener("click", () => {
    setTheme(root.dataset.theme === "light" ? "dark" : "light");
  });

  let initialLanguage = "en";
  try {
    initialLanguage = localStorage.getItem("language") || "en";
  } catch (_) {}
  setTheme(root.dataset.theme || "dark");
  setLanguage(initialLanguage);
})();
