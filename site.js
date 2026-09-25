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


  /* Reading progress on both language versions of the home and publications pages. */
  const progress = document.querySelector(".progress");
  if (progress) {
    let scheduled = false;
    const renderProgress = () => {
      const doc = document.documentElement;
      const remaining = doc.scrollHeight - doc.clientHeight;
      progress.style.width = `${remaining > 0 ? Math.min(100, Math.max(0, doc.scrollTop / remaining * 100)) : 0}%`;
      scheduled = false;
    };
    const requestProgress = () => {
      if (!scheduled) {
        scheduled = true;
        requestAnimationFrame(renderProgress);
      }
    };
    addEventListener("scroll", requestProgress, { passive: true });
    addEventListener("resize", requestProgress, { passive: true });
    requestProgress();
  }

  /* Reveal home-page cards only after JS loads; respect reduced motion. */
  if (document.getElementById("research") && "IntersectionObserver" in window) {
    const cards = document.querySelectorAll(".featured-work, .card, .service-notes, .flagship-course, .timeline .role, .degree-card");
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("in");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.15 });
    cards.forEach((card) => {
      if (card.closest("details:not([open])")) return;
      card.classList.add("reveal");
      observer.observe(card);
    });
  }

  /* On a phone, show the assistant after the first screen so it cannot cover the metrics link. */
  if (document.getElementById("home")) {
    const syncAssistantPosition = () => {
      document.body.classList.toggle(
        "home-before-fold",
        matchMedia("(max-width: 620px)").matches && scrollY < innerHeight,
      );
    };
    addEventListener("scroll", syncAssistantPosition, { passive: true });
    addEventListener("resize", syncAssistantPosition, { passive: true });
    syncAssistantPosition();
  }

  /* Footer year */
  const year = document.getElementById("year");
  if (year) year.textContent = String(new Date().getFullYear());
})();
