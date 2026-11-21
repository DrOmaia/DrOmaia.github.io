(() => {
  const portfolio = window.RESEARCH_PORTFOLIO;
  if (!portfolio?.works?.length) return;

  const works = portfolio.works;

  // Every count and the cutoff date are read from the catalogue (research-data.js), so they never fall out of step with it.
  const meta = portfolio.meta || {};
  const monthsEn = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const monthsAr = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
  const countType = (type) => works.filter((work) => work.type === type).length;
  const countYears = (from, to) => works.filter((work) => work.year >= from && work.year <= to).length;
  const stats = {
    total: works.length,
    journals: countType("Journal article"),
    conferences: countType("Conference paper"),
    chapters: countType("Book chapter"),
    recent: countYears(2024, 2026),
    in2025: countYears(2025, 2025),
  };
  const cutoff = (() => {
    const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(meta.verificationCutoff || "");
    const en = meta.verificationCutoffDisplay || (iso ? `${Number(iso[3])} ${monthsEn[Number(iso[2]) - 1]} ${iso[1]}` : "");
    const ar = iso ? `${Number(iso[3])} ${monthsAr[Number(iso[2]) - 1]} ${iso[1]}` : en;
    return { en, ar };
  })();
  const knownYears = [...new Set(works.map((work) => work.year))].sort((a, b) => a - b);
  const latestYear = knownYears[knownYears.length - 1];
  // A number written out for the start of an English sentence; digits above 99.
  const numberWord = (n) => {
    const small = ["Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve",
      "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
    const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];
    if (!Number.isInteger(n) || n < 0 || n > 99) return String(n);
    if (n < 20) return small[n];
    return n % 10 ? `${tens[Math.floor(n / 10)]}-${small[n % 10].toLowerCase()}` : tens[Math.floor(n / 10)];
  };
  const text = {
    header: (ar) => (ar
      ? `موثق في ${stats.total} عملاً · تاريخ القطع ${cutoff.ar}`
      : `Grounded in ${stats.total} verified works · cutoff ${cutoff.en}`),
    source: (ar) => (ar
      ? `المصدر: محفظة الأعمال الموثقة، تاريخ القطع ${cutoff.ar}.`
      : `Source: verified portfolio corpus, cutoff ${cutoff.en}.`),
    welcome: (ar) => (ar
      ? `اسأل عن الأعمال الموثقة الـ${stats.total}، أو الموضوعات البحثية الستة، أو المنهجيات، أو المسار الزمني، أو مراجع APA، أو روابط DOI. أجيب من المحفظة الموثقة فقط.`
      : `Ask about the ${stats.total} verified works, six research themes, methodologies, timeline, APA references, or DOI links. I answer only from the curated portfolio.`),
    totals: (ar) => (ar
      ? `تضم المحفظة ${stats.total} عملاً موثقاً: ${stats.journals} مقالة دورية، و${stats.conferences} ورقة مؤتمر، و${stats.chapters} فصول كتب. نُشر ${stats.recent} عملاً خلال 2024-2026، منها ${stats.in2025} عملاً في 2025.`
      : `The portfolio contains ${stats.total} verified works: ${stats.journals} journal articles, ${stats.conferences} conference papers, and ${stats.chapters} book chapters. ${numberWord(stats.recent)} works appeared during 2024-2026, including ${stats.in2025} in 2025.`),
    noMatch: (ar) => (ar
      ? `لم أجد تطابقاً موثوقاً في الأعمال الـ${stats.total}. جرّب اسماً محدداً للمنهجية مثل SHAP أو YOLOv8، أو سنة، أو موضوعاً بحثياً.`
      : `I could not find a reliable match in the ${stats.total}-work corpus. Try a specific method such as SHAP or YOLOv8, a year, or one of the six research themes.`),
  };
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
      "صحة", "صحي", "طبي", "سريري", "سرطان", "باركنسون", "رنين",
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
        <small></small>
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
    launcher.textContent = ar ? "اسأل عن أبحاثي" : "Ask about my research";
    panel.setAttribute("aria-label", ar ? "اسأل عن أبحاثي" : "Ask about my research");
    panel.querySelector(".assistant-header strong").textContent = ar
      ? "اسأل عن أبحاثي"
      : "Ask about my research";
    panel.querySelector(".assistant-header small").textContent = text.header(ar);
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
    source.textContent = text.source(Boolean(options.arabic));
    box.append(source);
    messages.scrollTop = messages.scrollHeight;
  }

  function welcome() {
    const ar = document.documentElement.lang === "ar";
    const box = addTextMessage(text.welcome(ar));
    const quick = document.createElement("div");
    quick.className = "assistant-quick";
    const prompts = ar
      ? ["الموضوعات البحثية", "دراسات تستخدم SHAP", "أبحاث الذكاء الاصطناعي الصحي", `منشورات ${latestYear}`]
      : ["Research themes", "Studies using SHAP", "Healthcare AI works", `${latestYear} publications`];
    prompts.forEach((label) => {
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
      "ما", "هي", "التي", "تستخدم", "اعرض", "اظهر", "ابحاث", "دراسات", "حول", "منشورات", "اعمال",
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
      addAnswer(text.totals(ar), [], { arabic: ar });
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
    const yearMatch = question.match(new RegExp(`\\b(${knownYears.join("|")})\\b`));
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
      addAnswer(text.noMatch(ar), [], { arabic: ar });
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
