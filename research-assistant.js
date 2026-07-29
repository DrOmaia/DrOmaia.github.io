(() => {
  const portfolio = window.RESEARCH_PORTFOLIO;
  if (!portfolio?.works?.length) return;

  const works = portfolio.works;
  const isArabic = (text = "") => /[\u0600-\u06ff]/.test(text);
  const normalize = (value = "") =>
    value
      .toLocaleLowerCase()
      .normalize("NFKD")
      .replace(/[\u064B-\u065F\u0670]/g, "")
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .trim();

  const aliases = {
    "Cybersecurity, IoT, and cloud infrastructure": [
      "cybersecurity", "cyber", "security", "phishing", "iot", "cloud",
      "امن سيبراني", "الأمن السيبراني", "تصيد", "انترنت الاشياء", "سحابة",
    ],
    "NLP, education, and knowledge systems": [
      "nlp", "language", "arabic", "education", "knowledge", "document",
      "لغة", "العربية", "تعليم", "معرفة", "وثائق",
    ],
    "Healthcare and clinical decision support": [
      "health", "healthcare", "clinical", "medical", "cancer", "parkinson", "mri",
      "صحة", "طبي", "سريري", "سرطان", "باركنسون", "رنين",
    ],
    "Decision analytics and intelligent systems": [
      "decision", "analytics", "forecast", "stock", "telecom", "agile",
      "قرار", "تحليلات", "تنبؤ", "اسهم", "اتصالات", "اجايل",
    ],
    "Computer vision and environmental intelligence": [
      "vision", "yolo", "object detection", "environment", "climate", "lidar",
      "رؤية حاسوبية", "كشف الاجسام", "بيئة", "مناخ", "ليدار",
    ],
    "Responsible AI, governance, and society": [
      "responsible ai", "governance", "ethics", "regulation", "posthuman",
      "ذكاء مسؤول", "حوكمة", "اخلاق", "تنظيم", "ما بعد الانسانيه",
    ],
  };

  const timeline = {
    en: [
      ["2011-2020", "Arabic NLP, feature engineering, statistical comparison, and connected educational systems."],
      ["2023-2024", "Applied classification, multimodal attention, blockchain, reinforcement learning, and optimization."],
      ["2025", "Deep learning across clinical AI, cybersecurity, environment, governance, and decision support."],
      ["2026", "Hybrid neural architectures, real-time detection, optimization, and on-demand explainable AI."],
    ],
    ar: [
      ["2011-2020", "معالجة اللغة العربية وهندسة الخصائص والمقارنة الإحصائية وأنظمة التعليم المتصلة."],
      ["2023-2024", "التصنيف التطبيقي والانتباه متعدد الوسائط والبلوك تشين والتعلم المعزز والتحسين."],
      ["2025", "التعلم العميق في الذكاء السريري والأمن السيبراني والبيئة والحوكمة ودعم القرار."],
      ["2026", "بنى عصبية هجينة وكشف آني وتحسين وذكاء اصطناعي تفسيري عند الطلب."],
    ],
  };

  const launcher = document.createElement("button");
  launcher.type = "button";
  launcher.className = "research-assistant-launcher";
  launcher.textContent = "Research Assistant";
  launcher.setAttribute("aria-haspopup", "dialog");
  launcher.setAttribute("aria-expanded", "false");

  const panel = document.createElement("section");
  panel.className = "research-assistant";
  panel.hidden = true;
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-modal", "false");
  panel.setAttribute("aria-label", "Research Assistant");
  panel.innerHTML = `
    <div class="assistant-header">
      <span class="assistant-badge">OA</span>
      <span>
        <strong>Research Assistant</strong>
        <small>Grounded in 37 verified works · cutoff 24 July 2026</small>
      </span>
      <button class="assistant-close" type="button" aria-label="Close">×</button>
    </div>
    <div class="assistant-messages" aria-live="polite"></div>
    <form class="assistant-form">
      <input type="text" aria-label="Ask about the research portfolio" autocomplete="off" placeholder="Ask about a theme, method, year, or paper…">
      <button type="submit" aria-label="Send">→</button>
    </form>
  `;

  document.body.append(launcher, panel);

  const messages = panel.querySelector(".assistant-messages");
  const form = panel.querySelector(".assistant-form");
  const input = form.querySelector("input");
  const close = panel.querySelector(".assistant-close");

  function syncAssistantLanguage() {
    const ar = document.documentElement.lang === "ar";
    launcher.textContent = ar ? "المساعد البحثي" : "Research Assistant";
    panel.setAttribute("aria-label", ar ? "المساعد البحثي" : "Research Assistant");
    panel.querySelector(".assistant-header strong").textContent = ar
      ? "المساعد البحثي"
      : "Research Assistant";
    panel.querySelector(".assistant-header small").textContent = ar
      ? "موثق في 37 عملاً · تاريخ القطع 24 يوليو 2026"
      : "Grounded in 37 verified works · cutoff 24 July 2026";
    input.placeholder = ar
      ? "اسأل عن مجال أو منهجية أو سنة أو بحث…"
      : "Ask about a theme, method, year, or paper…";
  }

  function openAssistant() {
    syncAssistantLanguage();
    panel.hidden = false;
    launcher.setAttribute("aria-expanded", "true");
    if (!messages.childElementCount) welcome();
    window.setTimeout(() => input.focus(), 0);
  }

  function closeAssistant() {
    panel.hidden = true;
    launcher.setAttribute("aria-expanded", "false");
    launcher.focus();
  }

  function addTextMessage(text, className = "") {
    const box = document.createElement("div");
    box.className = `assistant-message ${className}`.trim();
    const paragraph = document.createElement("p");
    paragraph.textContent = text;
    box.append(paragraph);
    messages.append(box);
    messages.scrollTop = messages.scrollHeight;
    return box;
  }

  function addAnswer(intro, matched = [], options = {}) {
    const box = addTextMessage(intro);
    if (options.timeline) {
      const list = document.createElement("ul");
      options.timeline.forEach(([period, description]) => {
        const item = document.createElement("li");
        const strong = document.createElement("strong");
        strong.textContent = `${period}: `;
        item.append(strong, document.createTextNode(description));
        list.append(item);
      });
      box.append(list);
    }

    if (options.themes) {
      const list = document.createElement("ul");
      options.themes.forEach(([themeName, total]) => {
        const item = document.createElement("li");
        item.textContent = `${themeName}: ${total}`;
        list.append(item);
      });
      box.append(list);
    }

    if (matched.length) {
      const list = document.createElement("ul");
      matched.slice(0, 6).forEach((work) => {
        const item = document.createElement("li");
        const title = document.createElement(work.doi ? "a" : "strong");
        title.textContent = `${work.id} · ${work.title}`;
        if (work.doi) {
          title.href = work.doi;
          title.target = "_blank";
          title.rel = "noopener";
        }
        item.append(title);
        const meta = document.createElement("span");
        meta.className = "assistant-citation";
        meta.textContent = `${work.year} · ${work.type} · ${work.theme}`;
        item.append(meta);
        if (options.references) {
          const ref = document.createElement("span");
          ref.className = "assistant-citation";
          ref.textContent = work.reference;
          item.append(ref);
        }
        list.append(item);
      });
      box.append(list);
    }

    const source = document.createElement("span");
    source.className = "assistant-citation";
    source.textContent = options.arabic
      ? "المصدر: محفظة الأعمال الموثقة، تاريخ القطع 24 يوليو 2026."
      : "Source: verified portfolio corpus, cutoff 24 July 2026.";
    box.append(source);
    messages.scrollTop = messages.scrollHeight;
  }

  function welcome() {
    const box = addTextMessage(
      "Ask about the 37 verified works, six research themes, methodologies, timeline, APA references, or DOI links. I answer only from the curated portfolio.",
    );
    const quick = document.createElement("div");
    quick.className = "assistant-quick";
    [
      "Research themes",
      "Studies using SHAP",
      "Healthcare AI works",
      "2026 publications",
    ].forEach((label) => {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = label;
      button.addEventListener("click", () => ask(label));
      quick.append(button);
    });
    box.append(quick);
  }

  function scoreWork(work, normalizedQuery) {
    const stopWords = new Set([
      "which", "what", "show", "give", "tell", "studies", "study", "works",
      "work", "papers", "paper", "publications", "publication", "using", "uses",
      "use", "about", "the", "and", "for", "with", "are", "there", "me",
      "ما", "هي", "التي", "تستخدم", "اعرض", "اظهر", "ابحاث", "دراسات", "حول",
    ]);
    const terms = normalizedQuery
      .split(" ")
      .filter((term) => term.length > 1 && !stopWords.has(term));
    const title = normalize(work.title);
    const methods = normalize(work.methods.join(" "));
    const contribution = normalize(work.contribution);
    const theme = normalize(work.theme);
    const reference = normalize(work.reference);
    let score = 0;
    terms.forEach((term) => {
      if (title.includes(term)) score += 6;
      if (methods.includes(term)) score += 5;
      if (theme.includes(term)) score += 4;
      if (contribution.includes(term)) score += 3;
      if (reference.includes(term)) score += 1;
      if (normalize(work.id) === term) score += 20;
    });
    return score;
  }

  function answer(question) {
    const ar = isArabic(question);
    const lang = ar ? "ar" : "en";
    const query = normalize(question);
    const wantsReference = /(apa|reference|citation|doi|مرجع|توثيق|استشهاد)/i.test(question);

    if (/(how many|count|total|كم|عدد)/.test(query)) {
      addAnswer(
        ar
          ? "تضم المحفظة 37 عملاً موثقاً: 20 مقالة دورية، و13 ورقة مؤتمر، و4 فصول كتب. نُشر 25 عملاً خلال 2024-2026، منها 17 عملاً في 2025."
          : "The portfolio contains 37 verified works: 20 journal articles, 13 conference papers, and 4 book chapters. Twenty-five works appeared during 2024-2026, including 17 in 2025.",
        [],
        { arabic: ar },
      );
      return;
    }

    if (/(timeline|trajectory|evolution|changed|develop|مسار|تطور|تغير)/.test(query)) {
      addAnswer(
        ar ? "يمكن تلخيص التطور المنهجي في أربع مراحل:" : "The methodological trajectory can be summarized in four stages:",
        [],
        { timeline: timeline[lang], arabic: ar },
      );
      return;
    }

    if (/(themes|theme|areas|topics|مجالات|مواضيع|موضوعات)/.test(query) && !/\d{4}/.test(query)) {
      const themeCounts = Object.keys(aliases).map((themeName) => [
        themeName,
        works.filter((work) => work.theme === themeName).length,
      ]);
      addAnswer(
        ar ? "صُنفت الأعمال ضمن ستة موضوعات رئيسية:" : "The works are coded into six primary portfolio themes:",
        [],
        { themes: themeCounts, arabic: ar },
      );
      return;
    }

    let candidates = works;
    const yearMatch = question.match(/\b(2011|2014|2017|2018|2019|2020|2023|2024|2025|2026)\b/);
    if (yearMatch) {
      candidates = candidates.filter((work) => String(work.year) === yearMatch[1]);
    } else if (/(latest|newest|recent|احدث|الأحدث)/.test(query)) {
      candidates = candidates.filter((work) => work.year === Math.max(...works.map((work) => work.year)));
    }

    if (/(journal|article|مقال|دورية)/.test(query)) {
      candidates = candidates.filter((work) => work.type === "Journal article");
    } else if (/(conference|مؤتمر)/.test(query)) {
      candidates = candidates.filter((work) => work.type === "Conference paper");
    } else if (/(book chapter|chapter|فصل|كتاب)/.test(query)) {
      candidates = candidates.filter((work) => work.type === "Book chapter");
    }

    const matchedTheme = Object.entries(aliases).find(([, terms]) =>
      terms.some((term) => query.includes(normalize(term))),
    );
    if (matchedTheme) {
      candidates = candidates.filter((work) => work.theme === matchedTheme[0]);
    }

    const knownMethods = [...new Set(works.flatMap((work) => work.methods))]
      .sort((a, b) => b.length - a.length);
    const matchedMethod = knownMethods.find((method) => {
      const normalizedMethod = normalize(method);
      return normalizedMethod.length >= 3 && query.includes(normalizedMethod);
    });
    if (matchedMethod) {
      candidates = candidates.filter((work) =>
        work.methods.some((method) => normalize(method) === normalize(matchedMethod)),
      );
    }

    const scored = candidates
      .map((work) => ({ work, score: scoreWork(work, query) }))
      .filter(({ score }) => score > 0 || candidates.length < works.length)
      .sort((a, b) => b.score - a.score || b.work.year - a.work.year)
      .map(({ work }) => work);

    if (!scored.length) {
      addAnswer(
        ar
          ? "لم أجد تطابقاً موثوقاً في الأعمال الـ37. جرّب اسماً محدداً للمنهجية مثل SHAP أو YOLOv8، أو سنة، أو موضوعاً بحثياً."
          : "I could not find a reliable match in the 37-work corpus. Try a specific method such as SHAP or YOLOv8, a year, or one of the six research themes.",
        [],
        { arabic: ar },
      );
      return;
    }

    const countText = ar
      ? `وجدت ${scored.length} عملاً مطابقاً.`
      : `I found ${scored.length} matching ${scored.length === 1 ? "work" : "works"}.`;
    addAnswer(countText, scored, { references: wantsReference, arabic: ar });
  }

  function ask(question) {
    const trimmed = question.trim();
    if (!trimmed) return;
    addTextMessage(trimmed, "user");
    answer(trimmed);
  }

  launcher.addEventListener("click", openAssistant);
  close.addEventListener("click", closeAssistant);
  document.querySelectorAll("[data-open-research-assistant]").forEach((button) => {
    button.addEventListener("click", openAssistant);
  });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const question = input.value;
    input.value = "";
    ask(question);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !panel.hidden) closeAssistant();
  });
  new MutationObserver(syncAssistantLanguage).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["lang"],
  });
  syncAssistantLanguage();
})();
