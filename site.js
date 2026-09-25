/* Shared behaviour for every page: theme toggle, language link, mobile menu, footer year.
   The English and Arabic pages are separate static files; the language link just remembers the choice. */
(() => {
  const root = document.documentElement;
  const ar = root.lang === "ar";
  const store = {
    get(key) {
      try {
        return localStorage.getItem(key);
      } catch (_) {
        return null;
      }
    },
    set(key, value) {
      try {
        localStorage.setItem(key, value);
      } catch (_) {}
    },
  };

  /* Theme */
  const themeButton = document.getElementById("theme");
  const themeColor = document.getElementById("themeColor");
  if (!root.dataset.theme) {
    root.dataset.theme =
      store.get("theme") || (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");
  }
  function syncTheme() {
    const light = root.dataset.theme === "light";
    if (themeButton) {
      themeButton.setAttribute("aria-pressed", String(light));
      themeButton.setAttribute(
        "aria-label",
        ar ? (light ? "استخدام الوضع الداكن" : "استخدام الوضع الفاتح") : light ? "Use dark theme" : "Use light theme",
      );
    }
    if (themeColor) themeColor.setAttribute("content", light ? "#f4f7fa" : "#07111d");
  }
  syncTheme();
  if (themeButton) {
    themeButton.addEventListener("click", () => {
      root.dataset.theme = root.dataset.theme === "light" ? "dark" : "light";
      store.set("theme", root.dataset.theme);
      syncTheme();
    });
  }

  /* Language link: remember the choice, then let the link navigate */
  const langLink = document.getElementById("lang");
  if (langLink) langLink.addEventListener("click", () => store.set("lang", ar ? "en" : "ar"));

  /* Mobile menu */
  const nav = document.getElementById("nav");
  const menu = document.getElementById("menu");
  if (nav && menu) {
    const setMenu = (open) => {
      nav.classList.toggle("open", open);
      document.body.classList.toggle("nav-open", open);
      menu.setAttribute("aria-expanded", String(open));
      menu.setAttribute("aria-label", ar ? (open ? "إغلاق القائمة" : "فتح القائمة") : open ? "Close menu" : "Open menu");
    };
    menu.addEventListener("click", () => setMenu(!nav.classList.contains("open")));
    nav.querySelectorAll("a").forEach((link) => link.addEventListener("click", () => setMenu(false)));
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && nav.classList.contains("open")) setMenu(false);
    });
  }

  /* Footer year */
  const year = document.getElementById("year");
  if (year) year.textContent = String(new Date().getFullYear());
})();
