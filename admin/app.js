/* Site dashboard interface (version 2). Arabic and English, phone first.
   Works only through DashLib (lib.js), DashCV (cv.js, called by the library) and GH (github.js).
   Everything shown is built with DOM nodes and textContent; no HTML strings, no alert/confirm/prompt.
   All interface text lives in I18N below: the same keys in "ar" and "en". */
(function () {
  "use strict";

  var L = window.DashLib, GH = window.GH;
  var TOKEN_KEY = "dash.token", DRAFT_KEY = "dash.draft", LANG_KEY = "dash.lang";
  var SITE = "https://dromaia.github.io/";
  var PHOTO = "PhotoDrOmaia.webp", PHOTO_W = 1127, PHOTO_H = 1396;
  var MAX_FILE = 5 * 1024 * 1024, MAX_PHOTO_SOURCE = 25 * 1024 * 1024;
  var ASSET_TAG = "20261121c";
  /* Parts of the model that count as "a change" (nav follows sections; binary uploads are counted apart). */
  var KEYS = ["works", "metrics", "news", "roles", "texts", "fonts", "theme", "sections", "flagship", "courses", "timeline", "timelineEarlier", "citations", "cv", "photoVersion",
    "leadBullets", "leadCards", "contacts", "contactLinks", "degreeCards", "thesisItems", "portfolio"];
  var TABS = ["works", "numbers", "sections", "texts", "look", "cv", "import", "files", "ai", "publish"];
  var FILE_TYPES = { pdf: "application/pdf", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif" };

  var I18N = {
    ar: {
      appTitle: "لوحة التحكم بالموقع",
      appIntro: "صفحة خاصة بصاحب الموقع dromaia.github.io: تعدّل منها الأبحاث والأقسام والنصوص والمظهر والسيرة، ثم تنشر بضغطة.",
      langGroup: "لغة اللوحة",
      cancel: "إلغاء", del: "حذف", yesDelete: "نعم، احذف", moveUp: "تحريك للأعلى", moveDown: "تحريك للأسفل",
      unexpected: "حدث خطأ غير متوقع: {x}", copied: "نُسخ ✓", copyLink: "انسخ الرابط", remove: "إزالة",
      needLib: "هذه الميزة تحتاج النسخة الجديدة من مكتبة اللوحة. أعد تحميل الصفحة بعد قليل.",
      /* sign in */
      stepsTitle: "أول مرة؟ إعداد المفتاح (مرة واحدة، دقيقتان)",
      step1: "افتح github.com وسجّل الدخول بحسابك.",
      step2: "اضغط صورتك أعلى الصفحة، ثم Settings، ثم Developer settings في آخر القائمة.",
      step3: "اختر Personal access tokens، ثم Fine-grained tokens، ثم Generate new token.",
      step4: "اكتب اسمًا للمفتاح مثل Admin، واختر مدة الصلاحية.",
      step5: "في Repository access اختر Only select repositories، ثم اختر DrOmaia.github.io فقط.",
      step6: "في Permissions اضغط زر + بجانب Repositories، اختر Contents، ثم غيّر الوصول إلى Read and write.",
      step7: "اضغط Generate token، وانسخ المفتاح (يبدأ بـ github_pat_) والصقه في الخانة أدناه.",
      openTokenPage: "افتح صفحة إنشاء المفتاح في GitHub ↗",
      tokenLabel: "مفتاح GitHub", remember: "تذكّرني على هذا الجهاز", signIn: "دخول",
      tokenNote: "المفتاح يبقى في متصفحك فقط، ولا يُرسل إلا إلى api.github.com. لا تشاركه مع أحد، ولا تفعّل «تذكّرني» على جهاز مشترك. تستطيع حذف المفتاح من GitHub في أي وقت.",
      pasteFirst: "الصق المفتاح أولًا.", loadingFiles: "جارٍ قراءة ملفات الموقع من GitHub…",
      parseFail: "قُرئت الملفات، لكن تعذّر تحليلها: {x}",
      gh_auth: "المفتاح غير صحيح أو انتهت صلاحيته. أنشئ مفتاحًا جديدًا والصقه.",
      gh_forbidden: "المفتاح لا يملك الصلاحية المطلوبة. تأكد أن Contents مضبوطة على Read and write للمستودع DrOmaia.github.io.",
      gh_rate: "تجاوزت حد الطلبات المسموح من GitHub. انتظر قليلًا ثم حاول مرة أخرى.",
      gh_notfound: "المفتاح لا يصل إلى المستودع DrOmaia.github.io. تأكد أنك اخترته في Repository access.",
      gh_network: "تعذّر الاتصال بـ GitHub. تحقق من الإنترنت ثم حاول مرة أخرى.",
      gh_stale: "تغيّر الموقع منذ فتحت اللوحة، فلم يُنشر شيء. أعد التحميل ثم أعد تعديلاتك.",
      gh_notdash: "آخر تعديل على الموقع لم يكن من لوحة التحكم، فلا يمكن التراجع عنه من هنا.",
      gh_noparent: "لا يوجد إصدار سابق للرجوع إليه.",
      gh_other: "رفض GitHub الطلب. حاول مرة أخرى بعد قليل.",
      /* frame */
      unpublished: "تعديلات غير منشورة: {n}", reload: "إعادة التحميل", signOut: "خروج", tabsLabel: "أقسام اللوحة",
      tab_works: "الأبحاث", tab_numbers: "الأرقام والمستجدات", tab_sections: "الأقسام", tab_texts: "النصوص", tab_look: "المظهر",
      tab_cv: "السيرة", tab_import: "استيراد", tab_files: "الملفات", tab_ai: "مساعد AI", tab_publish: "النشر",
      draftTitle: "عندك مسودة غير منشورة", draftText: "وجدت تعديلات حفظتها هنا ولم تنشرها{when}. هل تتابعها؟",
      draftKeep: "متابعة المسودة", draftDrop: "تجاهلها",
      draftOldTitle: "تغيّر الموقع منذ آخر مسودة", draftOldText: "عندك مسودة قديمة{when}، لكن الموقع تغيّر بعدها، فلا يمكن متابعتها بأمان.",
      draftDelete: "حذف المسودة والمتابعة", draftYesDelete: "نعم، احذفها",
      draftFiles: "المسودة لا تحفظ الملفات المرفوعة. اختر هذه الملفات من جديد: {x}", dismiss: "فهمت",
      /* works */
      worksTitle: "الأبحاث ({n})", addWork: "＋ بحث جديد", searchWorks: "ابحث بالعنوان أو السنة أو الرقم", searchWorksLabel: "بحث في الأبحاث",
      noWorks: "لا توجد أبحاث مطابقة.", edit: "تعديل", newWork: "بحث جديد ({id})", editWork: "تعديل {id}",
      doiNumber: "رقم DOI", doiHint: "الصق الرقم أو الرابط، ثم اضغط «اجلب البيانات» لتُملأ الخانات تلقائيًا.",
      fetchData: "اجلب البيانات", fetching: "جارٍ الجلب…",
      doiFirst: "اكتب رقم DOI أولًا، مثل 10.3390/computers15110825", doiLoading: "جارٍ جلب البيانات من Crossref…",
      doiOk: "جُلبت البيانات. راجعها، وبخاصة مرجع APA، ثم اختر الموضوع واكتب المنهجيات والمساهمة.",
      doiNotFound: "لم يجد Crossref هذا الرقم. تأكد منه، أو اكتب البيانات يدويًا.",
      doiFail: "تعذّر جلب البيانات من Crossref. اكتب البيانات يدويًا أو حاول لاحقًا.",
      fTitle: "العنوان", fYear: "السنة", fType: "نوع العمل", fTheme: "الموضوع", fMethods: "المنهجيات",
      fMethodsHint: "بالإنجليزية، وبينها فواصل. مثال: YOLOv8, SHAP", fContribution: "المساهمة",
      fContributionHint: "جملة أو جملتان بالإنجليزية تلخّصان ما قدّمه البحث.", fReference: "مرجع APA", fDoi: "رابط DOI",
      fDoiHint: "اتركه فارغًا إن لم يكن للبحث DOI.", fNote: "ملاحظة تحقق (اختياري)", saveDraft: "حفظ في المسودة",
      errTitle: "اكتب عنوان البحث.", errYear: "اكتب السنة بأربعة أرقام.", errType: "اختر نوع العمل.", errTheme: "اختر الموضوع.", errRef: "اكتب مرجع APA.",
      validateFail: "تعذّر فحص البيانات: {x}",
      cites: "تحديث الاستشهادات", citesHint: "يقرأ من Crossref عدد الاستشهادات لكل بحث له DOI، واحدًا بعد الآخر.",
      citesProgress: "جارٍ القراءة: {i} من {n}…", citesStop: "إيقاف", citesNone: "لا توجد أبحاث لها DOI.",
      citesDone: "قُرئ {ok} بحثًا وتعذّر {fail}. مجموع الاستشهادات: {old} ← {now}.",
      /* numbers and news */
      tilesTitle: "الأرقام في أعلى الصفحة الرئيسية", value: "الرقم", labelEn: "الوصف بالإنجليزية", labelAr: "الوصف بالعربية",
      autoNote: "هذا الرقم يتبع عدد الأبحاث تلقائيًا.", newsTitle: "المستجدات", addNews: "＋ سطر جديد",
      newsHint: "تظهر تحت الأرقام في الصفحة الرئيسية بهذا الترتيب.", lineEn: "السطر بالإنجليزية", lineAr: "السطر بالعربية",
      /* sections */
      sectionsTitle: "أقسام الصفحة الرئيسية",
      sectionsHint: "أخفِ قسمًا أو غيّر ترتيبه. القسم المخفي يبقى محفوظًا، ويختفي من الصفحة ومن القائمة العلوية.",
      hide: "إخفاء", show: "إظهار", hiddenTag: "مخفي", customTag: "قسم من عندك", addSection: "＋ قسم جديد", untitled: "بلا عنوان",
      secDetails: "محتوى القسم", secKickerEn: "العنوان الصغير بالإنجليزية", secKickerAr: "العنوان الصغير بالعربية",
      secTitleEn: "عنوان القسم بالإنجليزية", secTitleAr: "عنوان القسم بالعربية", secIntroEn: "المقدمة بالإنجليزية", secIntroAr: "المقدمة بالعربية",
      cards: "البطاقات", addCard: "＋ بطاقة", cardTitleEn: "عنوان البطاقة بالإنجليزية", cardTitleAr: "عنوان البطاقة بالعربية",
      cardTextEn: "نص البطاقة بالإنجليزية", cardTextAr: "نص البطاقة بالعربية", cardLink: "رابط (اختياري)",
      listsTitle: "القوائم داخل الأقسام", listsHint: "افتح القائمة لتضيف أو تحذف أو ترتب عناصرها.",
      list_leadBullets: "نقاط بطاقة القيادة", list_leadCards: "بطاقات القيادة", list_contacts: "وسائل التواصل", list_contactLinks: "أزرار التواصل",
      list_degreeCards: "الشهادات العلمية", list_thesisItems: "عناوين الرسائل",
      textEn: "النص بالإنجليزية", textAr: "النص بالعربية", tagEn: "الوسم بالإنجليزية", tagAr: "الوسم بالعربية",
      leadCardsHint: "البطاقات الثلاث تحت بطاقة رئاسة القسم. البطاقة التي فيها روابط تبقى كما هي وتُعدَّل نصوصها من تبويب النصوص.",
      richCard: "هذه البطاقة فيها روابط داخل النص، فتُعدَّل نصوصها من تبويب «النصوص». تستطيع هنا ترتيبها أو حذفها فقط.",
      contactsHint: "بطاقات التواصل في آخر الصفحة. الرابط يبدأ بـ mailto: للبريد و tel: للهاتف و https:// للمواقع.",
      labelEn: "الاسم بالإنجليزية", labelAr: "الاسم بالعربية", contactValue: "القيمة الظاهرة", contactValueAr: "القيمة بالعربية (اختياري)",
      hintEn: "السطر الصغير بالإنجليزية", hintAr: "السطر الصغير بالعربية", linkHref: "الرابط", linkHrefAr: "رابط الصفحة العربية (اختياري)",
      isPhone: "رقم هاتف (يظهر بأرقام كبيرة)", isPrimary: "زر رئيسي ملوّن",
      degreesHint: "بطاقات الشهادات في قسم المسيرة، وتظهر كذلك في السيرة الذاتية.",
      degreeEn: "اسم الشهادة بالإنجليزية", degreeAr: "اسم الشهادة بالعربية", instEn: "الجامعة بالإنجليزية", instAr: "الجامعة بالعربية",
      linkTextEn: "نص الرابط بالإنجليزية (اختياري)", linkTextAr: "نص الرابط بالعربية", thesisEn: "عنوان الرسالة بالإنجليزية", thesisAr: "عنوان الرسالة بالعربية",
      cvLang: "لغة السيرة", cvProfileAr: "النبذة المهنية بالعربية", cvArHint: "إن تركت الحقل العربي فارغًا يظهر النص الإنجليزي في السيرة العربية.",
      cvLanguagesAr: "اللغات بالعربية", cvOpenToAr: "«منفتح على» بالعربية", cvTitleAr: "العنوان بالعربية", cvTextAr: "النص بالعربية",
      cvLinesAr: "السطور بالعربية (سطر لكل عنصر)", cvBulletsAr: "النقاط بالعربية (سطر لكل نقطة)",
      pvPf: "ملف الأبحاث", pfTitle: "ملف الأبحاث الحيّ", pfHint: "صفحة ملف الأبحاث تُبنى من فهرس الأبحاث مع كل نشر. الجزء الوحيد الذي تكتبه أنت هو «المسار المنهجي».",
      pfLink: "رابط الصفحة:", pfPreview: "معاينة ملف الأبحاث", pfPreviewTitle: "معاينة ملف الأبحاث", pfTrajectory: "المسار المنهجي", pfLine: "السطر (بالإنجليزية)",
      list_flagship: "المقررات المميزة", list_courses: "كل المقررات", list_timeline: "المسيرة المهنية",
      list_timelineEarlier: "أدوار سابقة", list_roles: "اللجان والأدوار", addItem: "＋ عنصر جديد", count: "({n})",
      code: "رمز المقرر", nameEn: "الاسم بالإنجليزية", nameAr: "الاسم بالعربية", period: "الفترة",
      titleEn: "العنوان بالإنجليزية", titleAr: "العنوان بالعربية", descEn: "الوصف بالإنجليزية", descAr: "الوصف بالعربية",
      org: "الجهة", orgAr: "الجهة بالعربية (اختياري)", roleEn: "الدور بالإنجليزية", roleAr: "الدور بالعربية",
      rolesHint: "تظهر في قسم القيادة تحت «مزيد من اللجان والأدوار».",
      /* texts */
      textsTitle: "نصوص الموقع", textsHint: "كل نص في الموقع له صيغتان: إنجليزية وعربية. عدّل أيهما ثم انشر.",
      searchTexts: "ابحث عن كلمة بالعربية أو الإنجليزية", searchTextsLabel: "بحث في النصوص",
      textsCountAll: "تظهر أول {a} من {b}. اكتب في البحث للوصول إلى أي نص.", textsCountQ: "النتائج: {n}", textsFirst: " (تظهر أول {n})",
      noText: "لا يوجد نص مطابق.", inEn: "بالإنجليزية", inAr: "بالعربية", page_index: "الصفحة الرئيسية", page_pubs: "صفحة الأبحاث",
      /* look */
      lookHint: "اختر الخطوط والألوان والصورة، ثم راجع الشكل في تبويب «النشر» قبل أن تنشر.",
      fontAr: "الخط العربي", fontEn: "الخط الإنجليزي", fontHead: "خط العناوين الإنجليزية",
      palettes: "باقات الألوان", palCustom: "ألوان من اختيارك", palCustomHint: "تبدأ من الباقة الحالية، وتغيّر ما تشاء.",
      lightGroup: "الوضع الفاتح", darkGroup: "داكن",
      c_bg: "الخلفية", c_surface: "البطاقات", c_text: "النص", c_accent: "اللون المميّز", c_link: "الروابط",
      contrastTitle: "وضوح النص (التباين)", ct_textBg: "النص على الخلفية", ct_textSurface: "النص على البطاقات",
      ct_accentBg: "اللون المميّز على الخلفية", ct_linkBg: "الروابط على الخلفية",
      contrastOk: "واضح", contrastBad: "ضعيف: أقل من 4.5، وستصعب قراءة النص", hexBad: "اكتب اللون هكذا: #RRGGBB",
      portrait: "الصورة الشخصية",
      portraitHint: "اختر صورة واضحة. تُقصّ من الوسط إلى مقاس الصورة الحالية (1127×1396) وتُحوَّل إلى WebP.",
      choosePhoto: "اختر صورة", photoCurrent: "الحالية", photoNew: "الجديدة", photoUse: "اعتمد الصورة الجديدة",
      photoPending: "الصورة الجديدة جاهزة، وستُنشر مع بقية التعديلات.", photoRemove: "تراجع عن الصورة الجديدة",
      photoBadType: "اختر ملف صورة: JPG أو PNG أو WebP.", photoFail: "تعذّرت قراءة الصورة.",
      photoNoWebp: "متصفحك لا يحفظ بصيغة WebP. استخدم Chrome أو Edge.", photoWorking: "جارٍ تجهيز الصورة…",
      /* cv */
      cvTitle: "السيرة الذاتية الحيّة",
      cvHint: "صفحة السيرة تُبنى من بيانات الموقع مع كل نشر. هنا تعدّل الأجزاء الخاصة بالسيرة فقط، وتُكتب بالإنجليزية.",
      cvProfile: "الملف المهني", cvPillars: "محاور الخبرة", cvAccepted: "أبحاث مقبولة / قيد النشر",
      cvCommunity: "خدمة المجتمع والتقدير", cvDevelopment: "التطوير المهني", cvLanguages: "اللغات", cvOpenTo: "متاح لـ",
      cvService: "خدمة إضافية في السيرة", cvSelected: "عدد أحدث الأبحاث المعروضة في السيرة", cvText: "النص", cvDate: "التاريخ",
      cvPreview: "معاينة السيرة", cvPreviewHide: "إخفاء المعاينة", cvPreviewTitle: "معاينة صفحة السيرة",
      cvEmpty: "صفحة السيرة غير موجودة بعد. ستظهر بعد أول نشر يبنيها.",
      cvLinkShort: "السيرة المختصرة:", cvLinkFull: "السيرة الكاملة:", cvModeShort: "مختصرة", cvModeFull: "كاملة", cvMode: "نسخة السيرة",
      cvFullExtra: "أقسام تظهر في السيرة الكاملة فقط", cvFullExtraHint: "مثل: الدورات والشهادات، العضويات. لكل قسم عنوان وأسطر.",
      cvLines: "الأسطر (سطر لكل بند)", cvAppt: "تفاصيل الوظائف في السيرة الكاملة", cvApptHint: "اختر الوظيفة، ثم اكتب نقاطها. تظهر تحتها في السيرة الكاملة فقط.",
      cvApptPick: "الوظيفة", cvBullets: "النقاط (سطر لكل نقطة)",
      cviTitle: "استيراد سيرة من ملف", cviHint: "اختر سيرتك بصيغة PDF أو DOCX. تُقرأ داخل متصفحك، ثم تختار ما يُضاف من أقسامها.",
      cviPrivacy: "الملف لا يُرفع إلى أي مكان بهذه الميزة. إن أردت استضافة الملف الأصلي على الموقع فارفعه من تبويب «الملفات».",
      cviChoose: "اختر ملف السيرة", cviBusy: "جارٍ قراءة الملف…", cviTooLarge: "الملف أكبر من المسموح. جرّب نسخة أصغر.",
      cviType: "النوع غير مدعوم. اختر ملف PDF أو DOCX.", cviFail: "تعذّرت قراءة الملف.",
      cviNoText: "هذا PDF ممسوح ضوئيًا ولا يحتوي نصًا. صدّر السيرة بصيغة DOCX أو PDF نصي ثم أعد المحاولة.",
      cviPassword: "الملف محمي بكلمة مرور. أزل الحماية ثم أعد المحاولة.", cviFewText: "وُجد نص قليل جدًا في الملف، وقد تكون بعض صفحاته صورًا.",
      cviNone: "لم أجد أقسامًا واضحة في الملف.", cviFound: "الأقسام المكتشفة: {n}", cviSecTitle: "عنوان القسم", cviAction: "ماذا أفعل به؟",
      cviActFull: "أضف كقسم في السيرة الكاملة", cviActAppt: "أضف كتفاصيل وظيفة", cviActSkip: "تجاهل", cviApply: "طبّق الاختيارات",
      cviApplied: "أُضيف {n} إلى المسودة. راجع النتيجة في المعاينة ثم انشر.", cviNothing: "لم تختر إضافة أي قسم.", cviDone: "أُضيف ✓",
      /* approved versions */
      verTitle: "النسخ المعتمدة", verHint: "احفظ حالة الموقع حين تكون راضيًا عنها، لتعود إليها إن أخطأ تعديل لاحق.",
      verName: "اسم النسخة", verSave: "احفظ الموقع الحالي كنسخة معتمدة",
      verPublishFirst: "عندك تعديلات غير منشورة. انشرها أولًا، ثم احفظ النسخة.", verNameFirst: "اكتب اسمًا قصيرًا للنسخة.",
      verSaving: "جارٍ حفظ النسخة…", verSaved: "حُفظت النسخة المعتمدة.", verLoading: "جارٍ قراءة النسخ المعتمدة…",
      verFail: "تعذّرت قراءة النسخ المعتمدة.", verNone: "لا توجد نسخ معتمدة بعد.", verCurrent: "تطابق الموقع الحالي",
      verRestore: "استرجع هذه النسخة", verRestoreYes: "نعم، استرجع",
      verRestoreNote: "يُنشر محتوى هذه النسخة من جديد في تعديل واحد، ولا يُحذف شيء من السجل.",
      verRestoreNoteDraft: "يُنشر محتوى هذه النسخة من جديد، وتُحذف تعديلاتك غير المنشورة.",
      verRestoring: "جارٍ استرجاع النسخة…", verRestored: "تم استرجاع النسخة. يعود الموقع إليها خلال دقيقة تقريبًا، وزر التراجع يلغي الاسترجاع.",
      verDelete: "احذف من القائمة", verDeleteYes: "نعم، احذفها من القائمة", verDeleteNote: "تُحذف العلامة فقط، والموقع لا يتغير.",
      verDeleting: "جارٍ الحذف من القائمة…", verDeleted: "حُذفت النسخة من القائمة. الموقع لم يتغير.",
      verMax: "وصلت إلى 20 نسخة. احذف نسخة قديمة قبل حفظ نسخة جديدة.", verMore: "تظهر أحدث 20 نسخة فقط. احذف القديمة لتظهر البقية.",
      /* import */
      impTitle: "استيراد نتيجة ChatGPT",
      impHint: "الصق هنا نتيجة برومت الإنجازات كما هي، ثم اضغط «حلّل». لا يُضاف شيء إلا بموافقتك.",
      impPaste: "نتيجة ChatGPT", impGo: "حلّل", impClear: "امسح", impNone: "لم أجد بنودًا بصيغة ITEM في النص.", impCount: "البنود: {n}",
      impDate: "التاريخ", impSuggest: "اقتراح ChatGPT", impWhy: "السبب",
      impNews: "أضف كسطر مستجدات", impRole: "أضف كدور في اللجان والأدوار", impCv: "أضف إلى خدمة السيرة", impSkip: "تجاهل",
      impAdded: "أُضيف ✓", impSkipped: "تم تجاهل هذا البند.", impRestore: "أعده",
      impAsk: "يحتاج تأكيدك (ASK ME)", impNumbers: "أرقام وردت في النتيجة (NUMBERS)",
      /* files */
      filesTitle: "رفع الملفات",
      filesHint: "ملفات PDF أو صور، حتى 5 ميغابايت للملف. تُنشر في مجلد files مع بقية التعديلات، ثم يظهر رابط كل ملف هنا.",
      chooseFiles: "اختر ملفات", filesPending: "بانتظار النشر",
      fileBadType: "«{x}»: النوع غير مسموح. المسموح: PDF و PNG و JPG و WebP و GIF.", fileTooBig: "«{x}»: أكبر من 5 ميغابايت.",
      fileReadFail: "«{x}»: تعذّرت قراءته.", filesPublished: "ملفات منشورة", filesNone: "لا توجد ملفات منشورة بعد.",
      filesLoading: "جارٍ قراءة قائمة الملفات…", filesJust: "نُشر الآن",
      /* ai helper */
      aiTitle: "برومت يشرح الموقع لأي أداة AI",
      aiHint: "انسخه والصقه في أي أداة AI مع إعطائها صلاحية الوصول إلى المستودع، فتعرف بنية الموقع وقواعده قبل أي تعديل.",
      aiCopy: "انسخ البرومت", aiLoading: "جارٍ تحميل البرومت…", aiFail: "تعذّر تحميل البرومت. أعد تحميل الصفحة.", aiLabel: "نص البرومت",
      /* publish */
      pubWhat: "ما الذي سيتغيّر؟", buildFail: "تعذّر تجهيز الصفحات: {x}", noFileChange: "تعديلاتك لم تغيّر أي ملف.", noChanges: "لا توجد تعديلات للنشر.",
      filesChanged: "الملفات التي ستتغير ({n})", binPending: "ملفات مرفوعة ستُنشر ({n})",
      preview: "المعاينة", pvHome: "الصفحة الرئيسية", pvPubs: "الأبحاث", pvCv: "السيرة", pvAr: "عربي", pvEn: "إنجليزي",
      pvTitle: "معاينة الصفحة قبل النشر", pvStatic: "المعاينة ثابتة: الأزرار والقوائم داخلها لا تعمل.",
      pubAsk: "سيظهر هذا التعديل لزوار الموقع خلال دقيقة تقريبًا. هل تنشر؟", pubYes: "نعم، انشر", pubBtn: "انشر على الموقع",
      publishing: "جارٍ النشر على الموقع…", pubOk: "تم النشر. يظهر التعديل على الموقع خلال دقيقة تقريبًا.", staleReload: "إعادة التحميل الآن",
      undoTitle: "التراجع", lastLoading: "جارٍ قراءة آخر تعديل…", lastFail: "تعذّرت قراءة آخر تعديل على الموقع.", lastIs: "آخر تعديل على الموقع: ",
      undoBtn: "تراجع عن آخر نشر", undoYes: "نعم، تراجع", undoNoteDraft: "ستُحذف أيضًا تعديلاتك غير المنشورة.",
      undoNote: "يعود الموقع إلى ما قبل آخر نشر من اللوحة.", undoOff: "التراجع متاح فقط حين يكون آخر تعديل على الموقع من لوحة التحكم.",
      undoing: "جارٍ التراجع عن آخر نشر…", undoOk: "تم التراجع. يعود الموقع إلى ما كان عليه خلال دقيقة تقريبًا.",
      bootFail: "تعذّر تحميل ملفات اللوحة. أعد تحميل الصفحة."
    },
    en: {
      appTitle: "Site dashboard",
      appIntro: "Private page for the owner of dromaia.github.io: edit publications, sections, texts, appearance and the CV, then publish with one tap.",
      langGroup: "Dashboard language",
      cancel: "Cancel", del: "Delete", yesDelete: "Yes, delete", moveUp: "Move up", moveDown: "Move down",
      unexpected: "Unexpected error: {x}", copied: "Copied ✓", copyLink: "Copy link", remove: "Remove",
      needLib: "This feature needs the new version of the dashboard library. Reload the page in a moment.",
      stepsTitle: "First time? Set up the token (once, two minutes)",
      step1: "Open github.com and sign in to your account.",
      step2: "Tap your picture at the top, then Settings, then Developer settings at the end of the menu.",
      step3: "Choose Personal access tokens, then Fine-grained tokens, then Generate new token.",
      step4: "Give the token a name such as Admin, and choose how long it lasts.",
      step5: "Under Repository access choose Only select repositories, then pick DrOmaia.github.io only.",
      step6: "Under Permissions press the + button next to Repositories, choose Contents, then change its access to Read and write.",
      step7: "Press Generate token, copy the token (it starts with github_pat_) and paste it in the box below.",
      openTokenPage: "Open the token page on GitHub ↗",
      tokenLabel: "GitHub token", remember: "Remember me on this device", signIn: "Sign in",
      tokenNote: "The token stays in your browser and is sent only to api.github.com. Do not share it, and do not tick “Remember me” on a shared device. You can delete the token on GitHub at any time.",
      pasteFirst: "Paste the token first.", loadingFiles: "Reading the site files from GitHub…",
      parseFail: "The files were read, but could not be understood: {x}",
      gh_auth: "The token is wrong or has expired. Create a new token and paste it.",
      gh_forbidden: "The token lacks the needed permission. Make sure Contents is set to Read and write for the repository DrOmaia.github.io.",
      gh_rate: "GitHub's request limit was reached. Wait a little, then try again.",
      gh_notfound: "The token cannot reach the repository DrOmaia.github.io. Make sure you selected it under Repository access.",
      gh_network: "Could not reach GitHub. Check the internet connection, then try again.",
      gh_stale: "The site changed since you opened the dashboard, so nothing was published. Reload, then redo your edits.",
      gh_notdash: "The last change on the site did not come from the dashboard, so it cannot be undone from here.",
      gh_noparent: "There is no earlier version to return to.",
      gh_other: "GitHub refused the request. Try again in a moment.",
      unpublished: "Unpublished changes: {n}", reload: "Reload", signOut: "Sign out", tabsLabel: "Dashboard tabs",
      tab_works: "Publications", tab_numbers: "Numbers & news", tab_sections: "Sections", tab_texts: "Texts", tab_look: "Appearance",
      tab_cv: "CV", tab_import: "Import", tab_files: "Files", tab_ai: "AI helper", tab_publish: "Publish",
      draftTitle: "You have an unpublished draft", draftText: "I found edits saved here that were not published{when}. Continue with them?",
      draftKeep: "Continue the draft", draftDrop: "Discard it",
      draftOldTitle: "The site changed since your last draft", draftOldText: "You have an older draft{when}, but the site changed after it, so it cannot be continued safely.",
      draftDelete: "Delete the draft and continue", draftYesDelete: "Yes, delete it",
      draftFiles: "The draft does not keep uploaded files. Choose these files again: {x}", dismiss: "Got it",
      worksTitle: "Publications ({n})", addWork: "＋ New publication", searchWorks: "Search by title, year or id", searchWorksLabel: "Search publications",
      noWorks: "No matching publications.", edit: "Edit", newWork: "New publication ({id})", editWork: "Edit {id}",
      doiNumber: "DOI", doiHint: "Paste the DOI or its link, then press “Fetch details” to fill the fields automatically.",
      fetchData: "Fetch details", fetching: "Fetching…",
      doiFirst: "Enter a DOI first, for example 10.3390/computers15110825", doiLoading: "Fetching details from Crossref…",
      doiOk: "Details fetched. Review them, especially the APA reference, then choose the theme and write the methods and contribution.",
      doiNotFound: "Crossref does not know this DOI. Check it, or type the details by hand.",
      doiFail: "Could not fetch details from Crossref. Type the details by hand or try later.",
      fTitle: "Title", fYear: "Year", fType: "Type of work", fTheme: "Theme", fMethods: "Methods",
      fMethodsHint: "In English, separated by commas. Example: YOLOv8, SHAP", fContribution: "Contribution",
      fContributionHint: "One or two sentences in English that sum up what the work adds.", fReference: "APA reference", fDoi: "DOI link",
      fDoiHint: "Leave empty if the work has no DOI.", fNote: "Verification note (optional)", saveDraft: "Save to draft",
      errTitle: "Write the title.", errYear: "Write the year with four digits.", errType: "Choose the type of work.", errTheme: "Choose the theme.", errRef: "Write the APA reference.",
      validateFail: "Could not check the data: {x}",
      cites: "Refresh citations", citesHint: "Reads from Crossref the citation count of every work with a DOI, one at a time.",
      citesProgress: "Reading: {i} of {n}…", citesStop: "Stop", citesNone: "No works have a DOI.",
      citesDone: "{ok} works read, {fail} failed. Total citations: {old} → {now}.",
      tilesTitle: "Numbers at the top of the home page", value: "Value", labelEn: "Label in English", labelAr: "Label in Arabic",
      autoNote: "This number follows the count of publications automatically.", newsTitle: "News", addNews: "＋ New line",
      newsHint: "Shown under the numbers on the home page, in this order.", lineEn: "Line in English", lineAr: "Line in Arabic",
      sectionsTitle: "Home page sections",
      sectionsHint: "Hide a section or change its order. A hidden section is kept, and disappears from the page and the top menu.",
      hide: "Hide", show: "Show", hiddenTag: "Hidden", customTag: "Your section", addSection: "＋ New section", untitled: "Untitled",
      secDetails: "Section content", secKickerEn: "Kicker in English", secKickerAr: "Kicker in Arabic",
      secTitleEn: "Section title in English", secTitleAr: "Section title in Arabic", secIntroEn: "Intro in English", secIntroAr: "Intro in Arabic",
      cards: "Cards", addCard: "＋ Card", cardTitleEn: "Card title in English", cardTitleAr: "Card title in Arabic",
      cardTextEn: "Card text in English", cardTextAr: "Card text in Arabic", cardLink: "Link (optional)",
      listsTitle: "Lists inside the sections", listsHint: "Open a list to add, delete or reorder its items.",
      list_leadBullets: "Leadership bullet points", list_leadCards: "Leadership cards", list_contacts: "Contact paths", list_contactLinks: "Contact buttons",
      list_degreeCards: "Degrees", list_thesisItems: "Thesis titles",
      textEn: "Text in English", textAr: "Text in Arabic", tagEn: "Tag in English", tagAr: "Tag in Arabic",
      leadCardsHint: "The three cards under the department-chair card. A card with links inside it stays as it is; edit its texts from the Texts tab.",
      richCard: "This card has links inside its text, so its texts are edited from the Texts tab. Here you can only move or delete it.",
      contactsHint: "The contact cards at the end of the page. A link starts with mailto: for email, tel: for a phone and https:// for a website.",
      labelEn: "Label in English", labelAr: "Label in Arabic", contactValue: "Value shown", contactValueAr: "Value in Arabic (optional)",
      hintEn: "Small line in English", hintAr: "Small line in Arabic", linkHref: "Link", linkHrefAr: "Link on the Arabic page (optional)",
      isPhone: "Phone number (shown in large digits)", isPrimary: "Main coloured button",
      degreesHint: "The degree cards in the Career section; they also appear in the CV.",
      degreeEn: "Degree in English", degreeAr: "Degree in Arabic", instEn: "University in English", instAr: "University in Arabic",
      linkTextEn: "Link text in English (optional)", linkTextAr: "Link text in Arabic", thesisEn: "Thesis title in English", thesisAr: "Thesis title in Arabic",
      cvLang: "CV language", cvProfileAr: "Professional profile in Arabic", cvArHint: "If an Arabic field is left empty, the English text is shown in the Arabic CV.",
      cvLanguagesAr: "Languages in Arabic", cvOpenToAr: "“Open to” in Arabic", cvTitleAr: "Title in Arabic", cvTextAr: "Text in Arabic",
      cvLinesAr: "Lines in Arabic (one per item)", cvBulletsAr: "Bullet points in Arabic (one per line)",
      pvPf: "Portfolio", pfTitle: "Live research portfolio", pfHint: "The portfolio page is rebuilt from the publication catalogue on every publish. The only part you write is the “Methodological trajectory”.",
      pfLink: "Page link:", pfPreview: "Preview the portfolio", pfPreviewTitle: "Portfolio preview", pfTrajectory: "Methodological trajectory", pfLine: "Line (in English)",
      list_flagship: "Flagship courses", list_courses: "All courses", list_timeline: "Career timeline",
      list_timelineEarlier: "Earlier roles", list_roles: "Committees and roles", addItem: "＋ New item", count: "({n})",
      code: "Course code", nameEn: "Name in English", nameAr: "Name in Arabic", period: "Period",
      titleEn: "Title in English", titleAr: "Title in Arabic", descEn: "Description in English", descAr: "Description in Arabic",
      org: "Organisation", orgAr: "Organisation in Arabic (optional)", roleEn: "Role in English", roleAr: "Role in Arabic",
      rolesHint: "Shown in the Leadership section under “More committees and roles”.",
      textsTitle: "Site texts", textsHint: "Every text on the site has two forms: English and Arabic. Edit either, then publish.",
      searchTexts: "Search for a word in Arabic or English", searchTextsLabel: "Search texts",
      textsCountAll: "Showing the first {a} of {b}. Type in the search box to reach any text.", textsCountQ: "Results: {n}", textsFirst: " (first {n} shown)",
      noText: "No matching text.", inEn: "In English", inAr: "In Arabic", page_index: "Home page", page_pubs: "Publications page",
      lookHint: "Choose fonts, colours and the portrait, then check the result in the Publish tab before publishing.",
      fontAr: "Arabic font", fontEn: "English font", fontHead: "English heading font",
      palettes: "Colour palettes", palCustom: "Your own colours", palCustomHint: "Starts from the current palette; change what you like.",
      lightGroup: "Light mode", darkGroup: "Dark",
      c_bg: "Background", c_surface: "Cards", c_text: "Text", c_accent: "Accent", c_link: "Links",
      contrastTitle: "Text clarity (contrast)", ct_textBg: "Text on background", ct_textSurface: "Text on cards",
      ct_accentBg: "Accent on background", ct_linkBg: "Links on background",
      contrastOk: "Clear", contrastBad: "Weak: under 4.5, text will be hard to read", hexBad: "Write the colour like this: #RRGGBB",
      portrait: "Portrait",
      portraitHint: "Choose a clear photo. It is cropped from the centre to the current size (1127×1396) and converted to WebP.",
      choosePhoto: "Choose a photo", photoCurrent: "Current", photoNew: "New", photoUse: "Use the new photo",
      photoPending: "The new photo is ready and will be published with your other changes.", photoRemove: "Remove the new photo",
      photoBadType: "Choose an image file: JPG, PNG or WebP.", photoFail: "Could not read the image.",
      photoNoWebp: "Your browser cannot save WebP. Use Chrome or Edge.", photoWorking: "Preparing the photo…",
      cvTitle: "Live CV",
      cvHint: "The CV page is rebuilt from the site data on every publish. Here you edit the CV-only parts, written in English.",
      cvProfile: "Professional profile", cvPillars: "Expertise pillars", cvAccepted: "Accepted / in press",
      cvCommunity: "Community and recognition", cvDevelopment: "Professional development", cvLanguages: "Languages", cvOpenTo: "Open to",
      cvService: "Extra service entries", cvSelected: "Number of newest publications listed in the CV", cvText: "Text", cvDate: "Date",
      cvPreview: "Preview the CV", cvPreviewHide: "Hide the preview", cvPreviewTitle: "CV page preview",
      cvEmpty: "The CV page does not exist yet. It appears after the first publish that builds it.",
      cvLinkShort: "Short CV:", cvLinkFull: "Full CV:", cvModeShort: "Short", cvModeFull: "Full", cvMode: "CV version",
      cvFullExtra: "Sections shown in the full CV only", cvFullExtraHint: "For example: training and certificates, memberships. Each section has a title and lines.",
      cvLines: "Lines (one item per line)", cvAppt: "Appointment details in the full CV", cvApptHint: "Pick the appointment, then write its bullet points. They appear under it in the full CV only.",
      cvApptPick: "Appointment", cvBullets: "Bullet points (one per line)",
      cviTitle: "Import a CV file", cviHint: "Choose your CV as PDF or DOCX. It is read inside your browser, then you pick which of its sections to add.",
      cviPrivacy: "This feature does not upload the file anywhere. If you also want the original file hosted on the site, upload it from the Files tab.",
      cviChoose: "Choose the CV file", cviBusy: "Reading the file…", cviTooLarge: "The file is larger than allowed. Try a smaller copy.",
      cviType: "This type is not supported. Choose a PDF or DOCX file.", cviFail: "Could not read the file.",
      cviNoText: "This PDF is a scan with no text in it. Export the CV as DOCX or as a text PDF, then try again.",
      cviPassword: "The file is password-protected. Remove the protection, then try again.", cviFewText: "Very little text was found in the file; some pages may be images.",
      cviNone: "No clear sections were found in the file.", cviFound: "Sections found: {n}", cviSecTitle: "Section title", cviAction: "What should I do with it?",
      cviActFull: "Add as a section in the full CV", cviActAppt: "Add as appointment details", cviActSkip: "Skip", cviApply: "Apply the choices",
      cviApplied: "{n} added to the draft. Check the result in the preview, then publish.", cviNothing: "You did not choose to add any section.", cviDone: "Added ✓",
      verTitle: "Approved versions", verHint: "Save the site's state when you are happy with it, so you can return to it if a later edit goes wrong.",
      verName: "Version name", verSave: "Save the current site as an approved version",
      verPublishFirst: "You have unpublished changes. Publish them first, then save the version.", verNameFirst: "Write a short name for the version.",
      verSaving: "Saving the version…", verSaved: "The approved version was saved.", verLoading: "Reading the approved versions…",
      verFail: "Could not read the approved versions.", verNone: "No approved versions yet.", verCurrent: "Matches the current site",
      verRestore: "Restore this version", verRestoreYes: "Yes, restore",
      verRestoreNote: "This version's content is published again as one change; nothing is removed from the history.",
      verRestoreNoteDraft: "This version's content is published again, and your unpublished edits are deleted.",
      verRestoring: "Restoring the version…", verRestored: "The version was restored. The site returns to it in about a minute, and the undo button cancels the restore.",
      verDelete: "Remove from the list", verDeleteYes: "Yes, remove it from the list", verDeleteNote: "Only the marker is removed; the site does not change.",
      verDeleting: "Removing from the list…", verDeleted: "The version was removed from the list. The site did not change.",
      verMax: "You have reached 20 versions. Remove an old one before saving a new one.", verMore: "Only the newest 20 versions are shown. Remove old ones to see the rest.",
      impTitle: "Import the ChatGPT result",
      impHint: "Paste the result of the achievements prompt here as it is, then press Analyse. Nothing is added without your approval.",
      impPaste: "ChatGPT result", impGo: "Analyse", impClear: "Clear", impNone: "No ITEM entries were found in the text.", impCount: "Items: {n}",
      impDate: "Date", impSuggest: "ChatGPT suggests", impWhy: "Reason",
      impNews: "Add as a news line", impRole: "Add as a committee or role", impCv: "Add to CV service", impSkip: "Skip",
      impAdded: "Added ✓", impSkipped: "This item was skipped.", impRestore: "Bring back",
      impAsk: "Needs your confirmation (ASK ME)", impNumbers: "Numbers in the result (NUMBERS)",
      filesTitle: "Upload files",
      filesHint: "PDF or image files, up to 5 MB each. They are published to the files folder with your other changes, then each file's link appears here.",
      chooseFiles: "Choose files", filesPending: "Waiting to be published",
      fileBadType: "“{x}”: this type is not allowed. Allowed: PDF, PNG, JPG, WebP, GIF.", fileTooBig: "“{x}”: larger than 5 MB.",
      fileReadFail: "“{x}”: could not be read.", filesPublished: "Published files", filesNone: "No published files yet.",
      filesLoading: "Reading the file list…", filesJust: "Just published",
      aiTitle: "A prompt that explains the site to any AI tool",
      aiHint: "Copy it and paste it into any AI tool together with access to the repository, so it knows the site's structure and rules before changing anything.",
      aiCopy: "Copy the prompt", aiLoading: "Loading the prompt…", aiFail: "Could not load the prompt. Reload the page.", aiLabel: "Prompt text",
      pubWhat: "What will change?", buildFail: "Could not prepare the pages: {x}", noFileChange: "Your edits did not change any file.", noChanges: "Nothing to publish.",
      filesChanged: "Files that will change ({n})", binPending: "Uploaded files to publish ({n})",
      preview: "Preview", pvHome: "Home page", pvPubs: "Publications", pvCv: "CV", pvAr: "Arabic", pvEn: "English",
      pvTitle: "Page preview before publishing", pvStatic: "The preview is static: buttons and menus inside it do not work.",
      pubAsk: "This change will be visible to visitors in about a minute. Publish?", pubYes: "Yes, publish", pubBtn: "Publish to the site",
      publishing: "Publishing to the site…", pubOk: "Published. The change appears on the site in about a minute.", staleReload: "Reload now",
      undoTitle: "Undo", lastLoading: "Reading the last change…", lastFail: "Could not read the last change on the site.", lastIs: "Last change on the site: ",
      undoBtn: "Undo the last publish", undoYes: "Yes, undo", undoNoteDraft: "Your unpublished edits will be deleted too.",
      undoNote: "The site returns to what it was before the last dashboard publish.", undoOff: "Undo is available only when the last change on the site came from the dashboard.",
      undoing: "Undoing the last publish…", undoOk: "Undone. The site returns to its earlier state in about a minute.",
      bootFail: "Could not load the dashboard files. Reload the page."
    }
  };

  var app = document.getElementById("app");
  var lang = "ar";
  var S = { token: "", remember: false, files: null, head: "", base: null, model: null, baseJson: {}, readWarnings: [], tab: "works", out: null, pending: {}, ui: freshUi() };
  var saveTimer = 0, copyTimer = 0;

  function freshUi() {
    return { q: "", form: null, confirm: "", tq: "", pv: { page: "index.html", lang: "ar" }, pub: null, last: null, lastState: "", busy: "", draft: null, signErr: null,
      fontsLoaded: {}, doiBusy: false, open: { ar: true }, cites: null, photo: null, cvPreview: false, imp: { text: "", items: null, askMe: [], numbers: [], done: {} },
      fileErr: [], dir: null, dirState: "", uploaded: [], guide: null, guideState: "", copied: "", restoreNote: "", toTop: false,
      cvMode: "short", cvLang: "en", pfPreview: false, cvi: null, ver: { state: "", list: [], headTree: "", name: "", msg: null } };
  }

  /* ---------- language ---------- */
  function t(key, vars) {
    var s = I18N[lang][key];
    if (s == null) s = I18N.ar[key] == null ? key : I18N.ar[key];
    if (vars) Object.keys(vars).forEach(function (k) { s = s.split("{" + k + "}").join(String(vars[k])); });
    return s;
  }
  function applyLang() {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
    document.title = t("appTitle");
    try { if (L && L.setLang) L.setLang(lang); } catch (e) { /* older library */ }
  }
  function setLang(next) {
    next = next === "en" ? "en" : "ar";
    if (next === lang) return;
    lang = next;
    sset("local", LANG_KEY, lang);
    applyLang();
    S.out = null;
    if (S.files && L && L.read) { try { S.readWarnings = L.read(S.files).warnings || []; } catch (e) { /* keep the old list */ } }
    if (S.ui.busy) S.ui.busy = t("loadingFiles");
    if (S.model) render(); else renderSign();
  }
  function lbl(o) { return o ? (lang === "en" ? (o.en || o.ar) : (o.ar || o.en)) || "" : ""; }
  function locale() { return lang === "ar" ? "ar-SA-u-nu-latn" : "en-GB"; }
  function langSwitch() {
    var opt = function (code, label) {
      return el("button", { type: "button", "data-lang": code, lang: code, "aria-pressed": lang === code ? "true" : "false", text: label, onclick: function () { setLang(code); } });
    };
    return el("div", { class: "seg lang", role: "group", "aria-label": t("langGroup") }, [opt("ar", "العربية"), opt("en", "English")]);
  }

  /* ---------- small helpers ---------- */
  function el(tag, props, kids) {
    var n = document.createElement(tag);
    if (props) Object.keys(props).forEach(function (k) {
      var v = props[k];
      if (v == null || v === false) return;
      if (k === "class") n.className = v;
      else if (k === "text") n.textContent = v;
      else if (k.slice(0, 2) === "on") n.addEventListener(k.slice(2), v);
      else if (k === "value") n.value = v;
      else if (k === "checked" || k === "disabled" || k === "readOnly" || k === "hidden" || k === "open" || k === "multiple") n[k] = true;
      else n.setAttribute(k, v === true ? "" : String(v));
    });
    (kids || []).forEach(function (c) {
      if (c == null || c === false) return;
      n.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    });
    return n;
  }
  function clone(x) { return JSON.parse(JSON.stringify(x)); }
  function store(kind) { try { return kind === "session" ? window.sessionStorage : window.localStorage; } catch (e) { return null; } }
  function sget(kind, key) { try { var s = store(kind); return s ? s.getItem(key) : null; } catch (e) { return null; } }
  function sset(kind, key, value) { try { var s = store(kind); if (s) s.setItem(key, value); return true; } catch (e) { return false; } }
  function sdel(kind, key) { try { var s = store(kind); if (s) s.removeItem(key); } catch (e) { /* ignore */ } }
  function pad2(n) { return String(n).padStart(2, "0"); }
  function today() { var d = new Date(); return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate()); }
  function stamp() { var d = new Date(); return d.getFullYear() + pad2(d.getMonth() + 1) + pad2(d.getDate()) + pad2(d.getHours()) + pad2(d.getMinutes()); }
  function errText(e) {
    if (e && e.name === "GHError") return I18N[lang]["gh_" + e.code] ? t("gh_" + e.code) : t("gh_other");
    return t("unexpected", { x: String((e && e.message) || e) });
  }
  function sizeText(n) { return n >= 1048576 ? (n / 1048576).toFixed(1) + " MB" : Math.max(1, Math.round(n / 1024)) + " KB"; }
  function getp(o, path) { return path.split(".").reduce(function (a, k) { return a == null ? undefined : a[k]; }, o); }
  function setp(o, path, v) {
    var ks = path.split("."), a = o;
    for (var i = 0; i < ks.length - 1; i++) { if (a[ks[i]] == null || typeof a[ks[i]] !== "object") a[ks[i]] = {}; a = a[ks[i]]; }
    a[ks[ks.length - 1]] = v;
  }
  function btn(label, onclick, cls, extra) {
    var p = { type: "button", class: "btn " + (cls || ""), onclick: onclick, text: label };
    if (extra) Object.keys(extra).forEach(function (k) { p[k] = extra[k]; });
    return el("button", p);
  }
  /* A delete / publish button that asks again in place instead of a dialog. */
  function confirmBtn(key, label, yesLabel, onYes, cls, note) {
    if (S.ui.confirm !== key) return btn(label, function () { S.ui.confirm = key; render(); }, cls || "danger", { "data-ask": key });
    return el("span", { class: "confirm", role: "group" }, [
      note ? el("span", { class: "confirm-note", text: note }) : null,
      btn(yesLabel, function () { S.ui.confirm = ""; onYes(); }, "danger solid", { "data-yes": key }),
      btn(t("cancel"), function () { S.ui.confirm = ""; render(); }, "ghost", { "data-no": key })
    ]);
  }
  function field(label, control, hint) {
    return el("label", { class: "f" }, [el("span", { class: "f-l", text: label }), control, hint ? el("span", { class: "f-h", text: hint }) : null]);
  }
  function input(value, oninput, props) {
    var p = { type: "text", value: value == null ? "" : String(value), oninput: function (e) { oninput(e.target.value); } };
    if (props) Object.keys(props).forEach(function (k) { p[k] = props[k]; });
    return el("input", p);
  }
  function area(value, oninput, props) {
    var p = { rows: "2", dir: "auto", oninput: function (e) { oninput(e.target.value); } };
    if (props) Object.keys(props).forEach(function (k) { p[k] = props[k]; });
    var a = el("textarea", p);
    a.value = value == null ? "" : String(value);
    return a;
  }
  function select(value, options, onchange) {
    var s = el("select", { onchange: function (e) { onchange(e.target.value); } });
    options.forEach(function (o) { var op = el("option", { value: o[0], text: o[1] }); if (o[0] === value) op.selected = true; s.appendChild(op); });
    return s;
  }
  function move(list, i, d) {
    var j = i + d;
    if (j < 0 || j >= list.length) return;
    var x = list[i]; list[i] = list[j]; list[j] = x;
    touch(); render();
  }
  function moveBtns(list, i) {
    return el("span", { class: "moves" }, [
      btn("↑", function () { move(list, i, -1); }, "ghost sm", { "aria-label": t("moveUp"), "data-move": "up", disabled: i === 0 }),
      btn("↓", function () { move(list, i, 1); }, "ghost sm", { "aria-label": t("moveDown"), "data-move": "down", disabled: i === list.length - 1 })
    ]);
  }
  function seg(options, current, onpick, attr) {
    return el("div", { class: "seg", role: "group" }, options.map(function (o) {
      var p = { type: "button", "aria-pressed": current === o[0] ? "true" : "false", text: o[1], onclick: function () { onpick(o[0]); } };
      p[attr || "data-opt"] = o[0];
      return el("button", p);
    }));
  }
  /* A collapsible block that remembers whether it is open across re-renders. */
  function fold(key, title, kids, extra) {
    var p = { class: "fold card", "data-editor": key, open: !!S.ui.open[key], ontoggle: function (e) { S.ui.open[key] = e.target.open; if (extra && extra.onopen && e.target.open) extra.onopen(); } };
    var head = typeof title === "string" ? el("summary", { text: title }) : el("summary", null, title);
    return el("details", p, [head].concat(kids));
  }
  function copyText(text, key) {
    var done = function () {
      S.ui.copied = key; render();
      window.clearTimeout(copyTimer);
      copyTimer = window.setTimeout(function () { S.ui.copied = ""; if (S.model) render(); }, 1800);
    };
    var fallback = function () {
      var a = el("textarea", { class: "offscreen", readOnly: true, "aria-hidden": "true", tabindex: "-1" });
      a.value = text; document.body.appendChild(a); a.select();
      try { document.execCommand("copy"); } catch (e) { /* nothing more to try */ }
      document.body.removeChild(a); done();
    };
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fallback);
      else fallback();
    } catch (e) { fallback(); }
  }
  /* A real button-looking label around a visually hidden file input (the browser's own "Choose file" text is never shown). */
  function fileButton(id, label, accept, multiple, onpick) {
    var inp = el("input", { type: "file", id: id, class: "vh", accept: accept, multiple: multiple,
      onchange: function (e) { var list = Array.prototype.slice.call(e.target.files || []); e.target.value = ""; onpick(list); } });
    return el("label", { class: "btn ghost filebtn" }, [inp, el("span", { text: label })]);
  }
  function copyBtn(text, key, label, cls, id) {
    return btn(S.ui.copied === key ? t("copied") : label, function () { copyText(text, key); }, cls || "ghost sm", { id: id, "data-copy": key });
  }

  /* ---------- state: changes and draft ---------- */
  function setBase(files, head) {
    S.files = files; S.head = head;
    S.base = L.read(files);
    S.readWarnings = S.base.warnings || [];
    S.baseJson = {};
    KEYS.forEach(function (k) { S.baseJson[k] = JSON.stringify(S.base[k] === undefined ? null : S.base[k]); });
    S.model = clone(S.base);
    S.out = null;
  }
  function changed() {
    if (!S.model) return [];
    var list = KEYS.filter(function (k) { return JSON.stringify(S.model[k] === undefined ? null : S.model[k]) !== S.baseJson[k]; });
    if (pendingPaths().some(function (p) { return p !== PHOTO; })) list.push("files");
    else if (S.pending[PHOTO] && list.indexOf("photoVersion") < 0) list.push("photoVersion");
    return list;
  }
  function pendingPaths() { return Object.keys(S.pending); }
  function saveDraftNow() {
    window.clearTimeout(saveTimer); saveTimer = 0;
    if (!S.model || S.ui.draft) return;
    if (changed().length) {
      sset("local", DRAFT_KEY, JSON.stringify({ head: S.head, at: Date.now(), model: S.model, pendingNames: pendingPaths(),
        imp: { text: S.ui.imp.text, done: S.ui.imp.done, parsed: !!S.ui.imp.items } }));
    } else sdel("local", DRAFT_KEY);
    updateBadge();
  }
  function touch() {
    S.out = null; S.ui.pub = null;
    updateBadge();
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(saveDraftNow, 250);
  }
  function updateBadge() {
    var b = document.getElementById("badge");
    if (!b) return;
    var n = changed().length;
    b.hidden = !n;
    b.textContent = n ? t("unpublished", { n: n }) : "";
  }
  window.addEventListener("pagehide", function () { if (saveTimer) saveDraftNow(); });
  window.addEventListener("beforeunload", function () { if (saveTimer) saveDraftNow(); });

  function readDraft() {
    var raw = sget("local", DRAFT_KEY);
    if (!raw) return null;
    try {
      var d = JSON.parse(raw);
      if (!d || !d.model || !Array.isArray(d.model.works)) throw new Error("bad");
      return d;
    } catch (e) { sdel("local", DRAFT_KEY); return null; }
  }
  function keepDraft(d) {
    var m = d.model;
    Object.keys(S.base).forEach(function (k) { if (m[k] === undefined) m[k] = clone(S.base[k]); });
    var names = Array.isArray(d.pendingNames) ? d.pendingNames.map(String) : [];
    if (names.indexOf(PHOTO) >= 0) m.photoVersion = clone(S.base.photoVersion === undefined ? "" : S.base.photoVersion);
    S.model = m; S.pending = {}; S.ui.draft = null; S.out = null;
    S.ui.restoreNote = names.join(", ");
    if (d.imp && typeof d.imp.text === "string") {
      S.ui.imp = { text: d.imp.text, items: null, askMe: [], numbers: [], done: d.imp.done || {} };
      if (d.imp.parsed) parseImport(true);
    }
    render();
  }

  /* ---------- sign in / load ---------- */
  async function signIn(token, remember) {
    token = String(token || "").trim();
    if (!token) { S.ui.signErr = { key: "pasteFirst" }; renderSign(); return; }
    S.ui.busy = t("loadingFiles"); S.ui.signErr = null;
    if (S.model) render(); else renderSign();
    try {
      var got = await GH.load(token, L.FILES);
      S.token = token; S.remember = !!remember; S.ui = freshUi(); S.pending = {};
      try { setBase(got.files, got.head); }
      catch (e) {
        S.model = null; S.ui.signErr = { key: "parseFail", vars: { x: String((e && e.message) || e) } };
        renderSign(); return;
      }
      sdel("local", TOKEN_KEY); sdel("session", TOKEN_KEY);
      sset(remember ? "local" : "session", TOKEN_KEY, token);
      var d = readDraft();
      if (d) S.ui.draft = { same: d.head === S.head, data: d };
      render();
    } catch (e) {
      S.ui.busy = "";
      if (e && e.name === "GHError" && e.code === "auth") { sdel("local", TOKEN_KEY); sdel("session", TOKEN_KEY); S.token = ""; S.model = null; }
      S.ui.signErr = { err: e };
      if (S.model) { S.ui.pub = { kind: "err", err: e }; render(); } else renderSign();
    }
  }
  function signOut() {
    if (saveTimer) saveDraftNow();
    sdel("local", TOKEN_KEY); sdel("session", TOKEN_KEY);
    S.token = ""; S.files = null; S.model = null; S.base = null; S.out = null; S.pending = {}; S.ui = freshUi();
    renderSign();
  }

  function renderSign() {
    var keep = document.getElementById("token"), typed = keep ? keep.value : "", ticked = !!(document.getElementById("remember") || {}).checked;
    app.textContent = "";
    var tokenInput = el("input", { type: "password", id: "token", dir: "ltr", autocomplete: "off", spellcheck: "false", autocapitalize: "off", placeholder: "github_pat_…", "aria-label": t("tokenLabel"), value: typed });
    var remember = el("input", { type: "checkbox", id: "remember", checked: ticked });
    var go = function () { signIn(tokenInput.value, remember.checked); };
    tokenInput.addEventListener("keydown", function (e) { if (e.key === "Enter") go(); });
    var steps = [1, 2, 3, 4, 5, 6, 7].map(function (i) { return t("step" + i); });
    app.appendChild(el("main", { class: "sign" }, [
      el("div", { class: "sign-top" }, [el("h1", { text: t("appTitle") }), langSwitch()]),
      el("p", { class: "muted", text: t("appIntro") }),
      el("details", { class: "card steps" }, [
        el("summary", { text: t("stepsTitle") }),
        el("ol", null, steps.map(function (s) { return el("li", { text: s, dir: "auto" }); })),
        el("a", { class: "btn ghost", href: "https://github.com/settings/personal-access-tokens/new", target: "_blank", rel: "noopener noreferrer", text: t("openTokenPage") })
      ]),
      el("div", { class: "card" }, [
        field(t("tokenLabel"), tokenInput),
        el("label", { class: "check" }, [remember, el("span", { text: t("remember") })]),
        S.ui.signErr ? el("p", { class: "msg err", role: "alert", id: "signErr", text: S.ui.signErr.err ? errText(S.ui.signErr.err) : t(S.ui.signErr.key, S.ui.signErr.vars) }) : null,
        S.ui.busy ? el("p", { class: "msg info", id: "busy", text: S.ui.busy }) : null,
        btn(t("signIn"), go, "primary big", { id: "signBtn", disabled: !!S.ui.busy }),
        el("p", { class: "muted small", text: t("tokenNote") })
      ])
    ]));
  }

  /* ---------- main frame ---------- */
  function render() {
    if (!S.model) { renderSign(); return; }
    var y = window.scrollY || 0, toTop = S.ui.toTop;
    S.ui.toTop = false;
    app.textContent = "";
    var n = changed().length;
    app.appendChild(el("header", { class: "top" }, [
      el("div", { class: "top-t" }, [el("strong", { text: t("appTitle") }), el("span", { class: "muted small", dir: "ltr", text: "dromaia.github.io" })]),
      el("span", { class: "badge", id: "badge", hidden: !n, text: n ? t("unpublished", { n: n }) : "" }),
      el("div", { class: "top-a" }, [
        langSwitch(),
        btn(t("reload"), function () { if (saveTimer) saveDraftNow(); signIn(S.token, S.remember); }, "ghost sm", { id: "reloadBtn" }),
        btn(t("signOut"), signOut, "ghost sm", { id: "outBtn" })
      ])
    ]));
    if (S.ui.busy) app.appendChild(el("p", { class: "msg info", id: "busy", text: S.ui.busy }));
    if (S.ui.draft) { app.appendChild(draftGate()); return; }
    var strip = el("nav", { class: "tabs", role: "tablist", "aria-label": t("tabsLabel") }, TABS.map(function (k) {
      return el("button", { type: "button", role: "tab", class: "tab", "data-tab": k, "aria-selected": S.tab === k ? "true" : "false", text: t("tab_" + k),
        onclick: function () { S.tab = k; S.ui.confirm = ""; render(); } });
    }));
    app.appendChild(strip);
    if (S.ui.restoreNote) {
      app.appendChild(el("div", { class: "msg warn", id: "restoreNote", role: "status" }, [
        el("span", { dir: "auto", text: t("draftFiles", { x: S.ui.restoreNote }) }), " ",
        btn(t("dismiss"), function () { S.ui.restoreNote = ""; render(); }, "ghost sm", { id: "restoreOk" })
      ]));
    }
    var views = { works: viewWorks, numbers: viewNumbers, sections: viewSections, texts: viewTexts, look: viewLook, cv: viewCv, "import": viewImport, files: viewFiles, ai: viewAi, publish: viewPublish };
    app.appendChild(el("main", { class: "view", id: "view" }, [views[S.tab]()]));
    /* keep the active tab in view inside the strip, without moving the page */
    var active = strip.querySelector('[aria-selected="true"]');
    if (active && strip.scrollWidth > strip.clientWidth) {
      var r = active.getBoundingClientRect(), sr = strip.getBoundingClientRect();
      strip.scrollLeft += (r.left + r.width / 2) - (sr.left + sr.width / 2);
    }
    window.scrollTo(0, toTop ? 0 : y);
  }

  function draftGate() {
    var d = S.ui.draft;
    var when = d.data.at ? " (" + new Date(d.data.at).toLocaleString(locale()) + ")" : "";
    if (d.same) {
      return el("section", { class: "card gate", id: "draftGate" }, [
        el("h2", { text: t("draftTitle") }),
        el("p", { text: t("draftText", { when: when }) }),
        el("div", { class: "row" }, [
          btn(t("draftKeep"), function () { keepDraft(d.data); }, "primary", { id: "draftKeep" }),
          btn(t("draftDrop"), function () { sdel("local", DRAFT_KEY); S.ui.draft = null; render(); }, "ghost", { id: "draftDrop" })
        ])
      ]);
    }
    return el("section", { class: "card gate", id: "draftGate" }, [
      el("h2", { text: t("draftOldTitle") }),
      el("p", { text: t("draftOldText", { when: when }) }),
      el("div", { class: "row" }, [confirmBtn("dropDraft", t("draftDelete"), t("draftYesDelete"), function () { sdel("local", DRAFT_KEY); S.ui.draft = null; render(); }, "danger")])
    ]);
  }

  /* A list of records with add / delete / move. fields: [{p: "title.en", label, dir, long}] */
  function listEditor(o) {
    var list = o.get() || [];
    var items = el("div", { class: "list", id: "list-" + o.key }, list.map(function (it, i) {
      var locked = o.readonly ? o.readonly(it) : "";
      var controls = locked ? [el("div", { class: "locked", "data-locked": "1" }, [
        el("strong", { dir: "auto", text: o.title ? o.title(it) : "" }), el("p", { class: "muted small", text: locked })])] : o.fields.map(function (f) {
        var props = { dir: f.dir || "auto", "data-k": f.p };
        if (f.bool) {
          return el("label", { class: "check" }, [el("input", { type: "checkbox", checked: !!getp(it, f.p), "data-k": f.p,
            onchange: function (e) { setp(it, f.p, !!e.target.checked); touch(); } }), el("span", { text: t(f.label) })]);
        }
        if (f.mode) props.inputmode = f.mode;
        var onin = function (v) { setp(it, f.p, v); touch(); };
        if (f.lines) {
          props.rows = "4";
          return field(t(f.label), area((getp(it, f.p) || []).join("\n"), function (v) { setp(it, f.p, toLines(v)); touch(); }, props));
        }
        if (f.options) {
          var cur = String(getp(it, f.p) == null ? "" : getp(it, f.p)), opts = f.options();
          if (cur && !opts.some(function (x) { return x[0] === cur; })) opts = [[cur, cur]].concat(opts);
          var sel = select(cur, opts, onin);
          sel.setAttribute("data-k", f.p);
          return field(t(f.label), sel);
        }
        return field(t(f.label), f.long ? area(getp(it, f.p), onin, props) : input(getp(it, f.p), onin, props));
      });
      return el("article", { class: "item", "data-list": o.key, "data-i": String(i) }, [
        el("div", { class: locked ? "grid1" : (o.grid || "grid2") }, controls),
        el("div", { class: "row" }, [moveBtns(list, i), confirmBtn(o.key + "-" + i, t("del"), t("yesDelete"), function () { list.splice(i, 1); touch(); render(); }, "danger sm")])
      ]);
    }));
    return el("div", { class: "editor" }, [
      o.hint ? el("p", { class: "muted small", text: o.hint }) : null,
      el("div", { class: "row" }, [btn(t("addItem"), function () {
        var arr = o.get();
        if (!arr) { arr = []; o.set(arr); }
        if (o.top) arr.unshift(o.blank()); else arr.push(o.blank());
        touch(); render();
      }, "primary sm", { id: "add-" + o.key })]),
      items
    ]);
  }
  function toLines(v) { return String(v || "").split(/\r?\n/).map(function (x) { return x.trim(); }).filter(Boolean); }
  /* Appointments the CV knows about: English titles from the career timeline and the earlier roles. */
  function appointmentOptions() {
    var seen = {}, out = [];
    (S.model.timeline || []).concat(S.model.timelineEarlier || []).forEach(function (r) {
      var en = String(((r || {}).title || {}).en || "").trim();
      if (en && !seen[en]) { seen[en] = true; out.push([en, en]); }
    });
    return out;
  }
  function modelList(key) { return { get: function () { return S.model[key]; }, set: function (a) { S.model[key] = a; } }; }

  /* ---------- tab: works ---------- */
  function blankForm() {
    return { title: "", year: String(new Date().getFullYear()), type: (L.TYPES[0] || {}).en || "", theme: (L.THEMES[0] || {}).en || "", methods: "", contribution: "", reference: "", doi: "", verificationNote: "" };
  }
  function typeLabel(v) { var x = (L.TYPES || []).filter(function (o) { return o.en === v; })[0]; return x ? lbl(x) : v; }
  function openForm(work) {
    var f = blankForm();
    if (work) {
      f = { title: work.title || "", year: String(work.year || ""), type: work.type || "", theme: work.theme || "", methods: (work.methods || []).join(", "),
        contribution: work.contribution || "", reference: work.reference || "", doi: work.doi || "", verificationNote: work.verificationNote || "" };
    }
    S.ui.form = { isNew: !work, id: work ? work.id : L.nextId(S.model.works), f: f, lookup: work && work.doi ? work.doi : "", note: null, errors: [] };
    S.ui.confirm = ""; S.ui.toTop = true;
    render();
  }
  function bareDoi(v) {
    return String(v || "").trim().replace(/^https?:\/\/(dx\.)?doi\.org\//i, "").replace(/^doi:\s*/i, "");
  }
  async function crossref(doi) {
    var res = await fetch("https://api.crossref.org/works/" + encodeURIComponent(doi), { headers: { "Accept": "application/json" }, credentials: "omit", referrerPolicy: "no-referrer" });
    if (!res.ok) throw new Error(res.status === 404 ? "notfound" : "http");
    var json = await res.json();
    return (json && json.message) || {};
  }
  async function lookupDoi() {
    var fm = S.ui.form;
    var doi = bareDoi(fm.lookup);
    if (!doi) { fm.note = { kind: "err", key: "doiFirst" }; render(); return; }
    S.ui.doiBusy = true; fm.note = { kind: "info", key: "doiLoading" }; render();
    try {
      var got = L.fromCrossref(await crossref(doi)) || {};
      if (S.ui.form !== fm) return;
      ["title", "type", "reference", "doi"].forEach(function (k) { if (got[k]) fm.f[k] = String(got[k]); });
      if (got.year) fm.f.year = String(got.year);
      if (!fm.f.doi) fm.f.doi = "https://doi.org/" + doi;
      fm.note = { kind: "ok", key: "doiOk" };
    } catch (e) {
      if (S.ui.form !== fm) return;
      fm.note = { kind: "err", key: e && e.message === "notfound" ? "doiNotFound" : "doiFail" };
    }
    S.ui.doiBusy = false;
    render();
  }
  function safeValidate(m) { try { return L.validate(m) || []; } catch (e) { return [t("validateFail", { x: String((e && e.message) || e) })]; } }
  function saveForm() {
    var fm = S.ui.form, f = fm.f, errs = [];
    var year = parseInt(f.year, 10);
    if (!f.title.trim()) errs.push(t("errTitle"));
    if (!(year >= 1990 && year <= 2100)) errs.push(t("errYear"));
    if (!f.type) errs.push(t("errType"));
    if (!f.theme) errs.push(t("errTheme"));
    if (!f.reference.trim()) errs.push(t("errRef"));
    var old = S.model.works.filter(function (w) { return w.id === fm.id; })[0];
    var work = Object.assign({}, old || {}, {
      id: fm.id, title: f.title.trim(), year: year, type: f.type, theme: f.theme,
      methods: f.methods.split(/[,،;\n]/).map(function (x) { return x.trim(); }).filter(Boolean),
      contribution: f.contribution.trim(), reference: f.reference.trim(),
      doi: f.doi.trim() ? (/^https?:\/\//i.test(f.doi.trim()) ? f.doi.trim() : "https://doi.org/" + bareDoi(f.doi)) : null,
      verificationNote: f.verificationNote.trim() || null
    });
    if (!errs.length) {
      var next = clone(S.model);
      if (old) next.works = next.works.map(function (w) { return w.id === fm.id ? work : w; }); else next.works.push(work);
      var before = safeValidate(S.model), after = safeValidate(next);
      errs = after.filter(function (e) { return before.indexOf(e) < 0; });
      if (!errs.length) { S.model.works = next.works; S.ui.form = null; touch(); render(); return; }
    }
    fm.errors = errs; render();
  }

  function workForm() {
    var fm = S.ui.form, f = fm.f;
    var set = function (k) { return function (v) { f[k] = v; }; };
    return el("section", { class: "card form", id: "workForm" }, [
      el("h2", { text: fm.isNew ? t("newWork", { id: fm.id }) : t("editWork", { id: fm.id }) }),
      el("div", { class: "doi-row" }, [
        field(t("doiNumber"), input(fm.lookup, function (v) { fm.lookup = v; }, { id: "doiLookup", dir: "ltr", placeholder: "10.xxxx/…", inputmode: "url" }), t("doiHint")),
        btn(S.ui.doiBusy ? t("fetching") : t("fetchData"), lookupDoi, "primary", { id: "doiBtn", disabled: S.ui.doiBusy })
      ]),
      fm.note ? el("p", { class: "msg " + fm.note.kind, id: "doiNote", role: "status", text: t(fm.note.key) }) : null,
      field(t("fTitle"), area(f.title, set("title"), { id: "fTitle", dir: "ltr", rows: "2" })),
      el("div", { class: "grid2" }, [
        field(t("fYear"), input(f.year, set("year"), { id: "fYear", dir: "ltr", inputmode: "numeric", maxlength: "4" })),
        field(t("fType"), select(f.type, L.TYPES.map(function (x) { return [x.en, lbl(x)]; }), set("type")))
      ]),
      field(t("fTheme"), select(f.theme, L.THEMES.map(function (x) { return [x.en, lbl(x)]; }), set("theme"))),
      field(t("fMethods"), input(f.methods, set("methods"), { id: "fMethods", dir: "ltr" }), t("fMethodsHint")),
      field(t("fContribution"), area(f.contribution, set("contribution"), { id: "fContribution", dir: "ltr", rows: "3" }), t("fContributionHint")),
      field(t("fReference"), area(f.reference, set("reference"), { id: "fReference", dir: "ltr", rows: "3" })),
      field(t("fDoi"), input(f.doi, set("doi"), { id: "fDoi", dir: "ltr", inputmode: "url", placeholder: "https://doi.org/…" }), t("fDoiHint")),
      field(t("fNote"), area(f.verificationNote, set("verificationNote"), { id: "fNote", dir: "ltr", rows: "2" })),
      fm.errors.length ? el("ul", { class: "msg err", id: "formErrors", role: "alert" }, fm.errors.map(function (e) { return el("li", { text: e, dir: "auto" }); })) : null,
      el("div", { class: "row" }, [
        btn(t("saveDraft"), saveForm, "primary", { id: "saveWork" }),
        btn(t("cancel"), function () { S.ui.form = null; render(); }, "ghost", { id: "cancelWork" })
      ])
    ]);
  }

  function workList() {
    var q = S.ui.q.trim().toLowerCase();
    var list = S.model.works.slice().reverse().filter(function (w) {
      return !q || [w.id, w.title, w.year, w.reference, w.theme].join(" ").toLowerCase().indexOf(q) >= 0;
    });
    var box = el("div", { class: "list", id: "workList" });
    if (!list.length) box.appendChild(el("p", { class: "muted", text: t("noWorks") }));
    list.forEach(function (w) {
      box.appendChild(el("article", { class: "item", "data-id": w.id }, [
        el("div", { class: "item-h" }, [el("strong", { dir: "ltr", text: w.id, "data-content": "" }), el("span", { class: "muted small", text: String(w.year) + " · " + typeLabel(w.type) })]),
        el("p", { class: "item-t", dir: "ltr", lang: "en", text: w.title, "data-content": "" }),
        el("div", { class: "row" }, [
          btn(t("edit"), function () { openForm(w); }, "ghost sm", { "data-edit": w.id }),
          confirmBtn("del-" + w.id, t("del"), t("yesDelete"), function () {
            S.model.works = S.model.works.filter(function (x) { return x.id !== w.id; });
            if (S.ui.form && S.ui.form.id === w.id) S.ui.form = null;
            touch(); render();
          }, "danger sm")
        ])
      ]));
    });
    return box;
  }

  /* Citations: one Crossref request at a time; failures are counted and skipped. */
  async function refreshCitations() {
    var dois = [];
    S.model.works.forEach(function (w) { var d = bareDoi(w.doi).toLowerCase(); if (d && dois.indexOf(d) < 0) dois.push(d); });
    var run = { i: 0, n: dois.length, ok: 0, fail: 0, old: 0, now: 0, stop: false, done: false };
    S.ui.cites = run;
    if (!dois.length) { run.done = true; render(); return; }
    render();
    var next = Object.assign({}, S.model.citations || {});
    for (var i = 0; i < dois.length && !run.stop; i++) {
      run.i = i + 1;
      var note = document.getElementById("citesNote");
      if (note && S.ui.cites === run) note.textContent = t("citesProgress", { i: run.i, n: run.n });
      try {
        var m = await crossref(dois[i]), c = m["is-referenced-by-count"];
        if (typeof c !== "number" || !(c >= 0)) throw new Error("no count");
        run.old += Number(next[dois[i]]) || 0; run.now += c; run.ok++;
        next[dois[i]] = c;
      } catch (e) { run.fail++; }
      if (S.ui.cites !== run) return; /* a reload or sign-out replaced the run */
    }
    run.done = true;
    if (run.ok) { S.model.citations = next; touch(); }
    render();
  }
  function citesBox() {
    var run = S.ui.cites, busy = !!(run && !run.done);
    var note = null;
    if (run && !run.n) note = el("p", { class: "msg info", id: "citesNote", role: "status", text: t("citesNone") });
    else if (busy) note = el("p", { class: "msg info", id: "citesNote", role: "status", text: t("citesProgress", { i: run.i, n: run.n }) });
    else if (run) note = el("p", { class: "msg " + (run.ok ? "ok" : "err"), id: "citesNote", role: "status", text: t("citesDone", { ok: run.ok, fail: run.fail, old: run.old, now: run.now }) });
    return el("div", { class: "cites" }, [
      el("div", { class: "row" }, [
        btn(t("cites"), refreshCitations, "ghost", { id: "citesBtn", disabled: busy }),
        busy ? btn(t("citesStop"), function () { run.stop = true; }, "ghost sm", { id: "citesStop" }) : null
      ]),
      el("p", { class: "muted small", text: t("citesHint") }),
      note
    ]);
  }
  function viewWorks() {
    var listBox = workList();
    var search = input(S.ui.q, function (v) {
      S.ui.q = v;
      var fresh = workList(); listBox.parentNode.replaceChild(fresh, listBox); listBox = fresh;
    }, { id: "workSearch", type: "search", placeholder: t("searchWorks"), "aria-label": t("searchWorksLabel") });
    return el("div", null, [
      S.ui.form ? workForm() : null,
      el("div", { class: "bar" }, [
        el("h2", { text: t("worksTitle", { n: S.model.works.length }) }),
        btn(t("addWork"), function () { openForm(null); }, "primary", { id: "addWork" })
      ]),
      citesBox(),
      search, listBox
    ]);
  }

  /* ---------- tab: numbers and news ---------- */
  function viewNumbers() {
    var m = S.model;
    var tiles = el("div", { class: "list" }, (m.metrics || []).map(function (x, i) {
      var auto = !!x.auto;
      return el("article", { class: "item", "data-metric": String(i) }, [
        el("div", { class: "grid3" }, [
          field(t("value"), input(auto ? String(m.works.length) : x.value, function (v) { x.value = v; touch(); }, { dir: "ltr", readOnly: auto, "data-k": "value" })),
          field(t("labelEn"), input(x.en, function (v) { x.en = v; touch(); }, { dir: "ltr", "data-k": "en" })),
          field(t("labelAr"), input(x.ar, function (v) { x.ar = v; touch(); }, { dir: "rtl", "data-k": "ar" }))
        ]),
        auto ? el("p", { class: "muted small", text: t("autoNote") }) : null
      ]);
    }));
    var news = el("div", { class: "list", id: "newsList" }, (m.news || []).map(function (n, i) {
      return el("article", { class: "item", "data-news": String(i) }, [
        el("div", { class: "grid-news" }, [
          field(t("fYear"), input(n.year, function (v) { n.year = v; touch(); }, { dir: "ltr", inputmode: "numeric", maxlength: "4", "data-k": "year" })),
          field(t("lineEn"), area(n.en, function (v) { n.en = v; touch(); }, { dir: "ltr", "data-k": "en" })),
          field(t("lineAr"), area(n.ar, function (v) { n.ar = v; touch(); }, { dir: "rtl", "data-k": "ar" }))
        ]),
        el("div", { class: "row" }, [moveBtns(m.news, i), confirmBtn("news-" + i, t("del"), t("yesDelete"), function () { m.news.splice(i, 1); touch(); render(); }, "danger sm")])
      ]);
    }));
    return el("div", null, [
      el("h2", { text: t("tilesTitle") }),
      tiles,
      el("div", { class: "bar" }, [
        el("h2", { text: t("newsTitle") }),
        btn(t("addNews"), function () { m.news = m.news || []; m.news.unshift({ year: String(new Date().getFullYear()), en: "", ar: "" }); touch(); render(); }, "primary", { id: "addNews" })
      ]),
      el("p", { class: "muted small", text: t("newsHint") }),
      news
    ]);
  }

  /* ---------- tab: sections ---------- */
  /* The top menu follows the sections: hidden section => hidden link; custom section => its own link. */
  function syncNav() {
    var m = S.model;
    if (!Array.isArray(m.nav) || !Array.isArray(m.sections)) return;
    var byHref = {};
    m.sections.forEach(function (s) { byHref["#" + s.id] = s; });
    m.nav = m.nav.filter(function (n) { return !/^#custom-/.test(String(n.href)) || byHref[n.href]; });
    m.nav.forEach(function (n) {
      var s = byHref[n.href];
      if (!s) return;
      n.hidden = !!s.hidden;
      if (s.custom) { n.en = (s.title || {}).en || ""; n.ar = (s.title || {}).ar || ""; }
    });
    m.sections.forEach(function (s) {
      if (s.custom && !m.nav.some(function (n) { return n.href === "#" + s.id; })) m.nav.push({ href: "#" + s.id, en: (s.title || {}).en || "", ar: (s.title || {}).ar || "", hidden: !!s.hidden });
    });
  }
  function addSection() {
    var m = S.model, max = 0;
    m.sections.forEach(function (s) { var x = /^custom-(\d+)$/.exec(String(s.id)); if (x) max = Math.max(max, parseInt(x[1], 10)); });
    var sec = { id: "custom-" + (max + 1), title: { en: "", ar: "" }, hidden: false, custom: true, kicker: { en: "", ar: "" }, intro: { en: "", ar: "" }, cards: [] };
    var at = m.sections.length && m.sections[m.sections.length - 1].id === "contact" ? m.sections.length - 1 : m.sections.length;
    m.sections.splice(at, 0, sec);
    S.ui.open["sec-" + sec.id] = true;
    syncNav(); touch(); render();
  }
  function customFields(s) {
    var both = function (p, en, ar, long) {
      var mk = long ? area : input;
      return el("div", { class: "grid2" }, [
        field(t(en), mk(getp(s, p + ".en"), function (v) { setp(s, p + ".en", v); syncNav(); touch(); }, { dir: "ltr", "data-k": p + ".en" })),
        field(t(ar), mk(getp(s, p + ".ar"), function (v) { setp(s, p + ".ar", v); syncNav(); touch(); }, { dir: "rtl", "data-k": p + ".ar" }))
      ]);
    };
    var cards = el("div", { class: "list" }, (s.cards || []).map(function (c, i) {
      var bothC = function (p, en, ar, long) {
        var mk = long ? area : input;
        return el("div", { class: "grid2" }, [
          field(t(en), mk(getp(c, p + ".en"), function (v) { setp(c, p + ".en", v); touch(); }, { dir: "ltr", "data-k": p + ".en" })),
          field(t(ar), mk(getp(c, p + ".ar"), function (v) { setp(c, p + ".ar", v); touch(); }, { dir: "rtl", "data-k": p + ".ar" }))
        ]);
      };
      return el("article", { class: "item sub", "data-card": String(i) }, [
        bothC("title", "cardTitleEn", "cardTitleAr"), bothC("text", "cardTextEn", "cardTextAr", true),
        field(t("cardLink"), input(c.link, function (v) { c.link = v; touch(); }, { dir: "ltr", inputmode: "url", placeholder: "https://…", "data-k": "link" })),
        el("div", { class: "row" }, [moveBtns(s.cards, i), confirmBtn("card-" + s.id + "-" + i, t("del"), t("yesDelete"), function () { s.cards.splice(i, 1); touch(); render(); }, "danger sm")])
      ]);
    }));
    return fold("sec-" + s.id, t("secDetails"), [
      both("kicker", "secKickerEn", "secKickerAr"), both("title", "secTitleEn", "secTitleAr"), both("intro", "secIntroEn", "secIntroAr", true),
      el("div", { class: "bar" }, [
        el("h3", { text: t("cards") + " " + t("count", { n: (s.cards || []).length }) }),
        btn(t("addCard"), function () { s.cards = s.cards || []; s.cards.push({ title: { en: "", ar: "" }, text: { en: "", ar: "" }, link: "" }); touch(); render(); }, "primary sm", { "data-add-card": s.id })
      ]),
      cards
    ]);
  }
  function sectionList() {
    var m = S.model;
    return el("div", { class: "list", id: "secList" }, m.sections.map(function (s, i) {
      var title = lbl(s.title) || t("untitled");
      return el("article", { class: "item" + (s.hidden ? " off" : ""), "data-sec": s.id }, [
        el("div", { class: "item-h" }, [
          el("strong", { class: "sec-t", dir: "auto", text: title, "data-content": "" }),
          s.hidden ? el("span", { class: "tag", text: t("hiddenTag") }) : null,
          s.custom ? el("span", { class: "tag alt", text: t("customTag") }) : null
        ]),
        el("div", { class: "row" }, [
          btn(s.hidden ? t("show") : t("hide"), function () { s.hidden = !s.hidden; syncNav(); touch(); render(); }, "ghost sm", { "data-sec-toggle": s.id, "aria-pressed": s.hidden ? "true" : "false" }),
          moveBtns(m.sections, i),
          s.custom ? confirmBtn("sec-" + s.id, t("del"), t("yesDelete"), function () { m.sections.splice(i, 1); syncNav(); touch(); render(); }, "danger sm") : null
        ]),
        s.custom ? customFields(s) : null
      ]);
    }));
  }
  function viewSections() {
    var m = S.model, kids = [];
    if (Array.isArray(m.sections)) {
      kids.push(el("div", { class: "bar" }, [el("h2", { text: t("sectionsTitle") }), btn(t("addSection"), addSection, "primary", { id: "addSection" })]));
      kids.push(el("p", { class: "muted small", text: t("sectionsHint") }));
      kids.push(sectionList());
    } else kids.push(el("p", { class: "msg info", id: "needLib", text: t("needLib") }));
    kids.push(el("h2", { text: t("listsTitle") }));
    kids.push(el("p", { class: "muted small", text: t("listsHint") }));
    var course = [{ p: "code", label: "code", dir: "ltr" }, { p: "en", label: "nameEn", dir: "ltr" }, { p: "ar", label: "nameAr", dir: "rtl" }];
    var role = [{ p: "time", label: "period", dir: "ltr" }, { p: "title.en", label: "titleEn", dir: "ltr" }, { p: "title.ar", label: "titleAr", dir: "rtl" },
      { p: "text.en", label: "descEn", dir: "ltr", long: true }, { p: "text.ar", label: "descAr", dir: "rtl", long: true }];
    var lists = [
      { key: "flagship", fields: course, grid: "grid3", blank: function () { return { code: "", en: "", ar: "" }; } },
      { key: "courses", fields: course, grid: "grid3", blank: function () { return { code: "", en: "", ar: "" }; } },
      { key: "timeline", fields: role, top: true, blank: function () { return { time: String(new Date().getFullYear()), title: { en: "", ar: "" }, text: { en: "", ar: "" } }; } },
      { key: "timelineEarlier", fields: role, top: true, blank: function () { return { time: "", title: { en: "", ar: "" }, text: { en: "", ar: "" } }; } },
      { key: "roles", top: true, hint: t("rolesHint"), blank: function () { return { org: "", orgAr: "", en: "", ar: "" }; },
        fields: [{ p: "org", label: "org", dir: "ltr" }, { p: "orgAr", label: "orgAr", dir: "rtl" }, { p: "en", label: "roleEn", dir: "ltr", long: true }, { p: "ar", label: "roleAr", dir: "rtl", long: true }] }
    ];
    var two = function (base, en, ar, long) {
      return [{ p: base + ".en", label: en, dir: "ltr", long: long }, { p: base + ".ar", label: ar, dir: "rtl", long: long }];
    };
    lists = lists.concat([
      { key: "leadBullets", blank: function () { return { en: "", ar: "" }; },
        fields: [{ p: "en", label: "textEn", dir: "ltr", long: true }, { p: "ar", label: "textAr", dir: "rtl", long: true }] },
      { key: "leadCards", hint: t("leadCardsHint"), blank: function () { return { tag: { en: "", ar: "" }, title: { en: "", ar: "" }, text: { en: "", ar: "" }, rich: false }; },
        readonly: function (it) { return it && it.rich ? t("richCard") : ""; },
        title: function (it) { return lbl((it || {}).title) || lbl((it || {}).tag); },
        fields: two("tag", "tagEn", "tagAr").concat(two("title", "titleEn", "titleAr"), two("text", "cardTextEn", "cardTextAr", true)) },
      { key: "contacts", hint: t("contactsHint"), blank: function () { return { label: { en: "", ar: "" }, value: "", valueAr: "", hint: { en: "", ar: "" }, href: "", hrefAr: "", phone: false }; },
        fields: two("label", "labelEn", "labelAr").concat([{ p: "value", label: "contactValue", dir: "ltr" }, { p: "valueAr", label: "contactValueAr", dir: "rtl" }],
          two("hint", "hintEn", "hintAr"), [{ p: "href", label: "linkHref", dir: "ltr" }, { p: "hrefAr", label: "linkHrefAr", dir: "ltr" }, { p: "phone", label: "isPhone", bool: true }]) },
      { key: "contactLinks", blank: function () { return { en: "", ar: "", href: "", hrefAr: "", primary: false }; },
        fields: [{ p: "en", label: "textEn", dir: "ltr" }, { p: "ar", label: "textAr", dir: "rtl" }, { p: "href", label: "linkHref", dir: "ltr" },
          { p: "hrefAr", label: "linkHrefAr", dir: "ltr" }, { p: "primary", label: "isPrimary", bool: true }] },
      { key: "degreeCards", top: true, hint: t("degreesHint"), blank: function () { return { year: String(new Date().getFullYear()), title: { en: "", ar: "" }, institution: { en: "", ar: "" }, link: null }; },
        fields: [{ p: "year", label: "fYear", dir: "ltr", mode: "numeric" }].concat(two("title", "degreeEn", "degreeAr"), two("institution", "instEn", "instAr"),
          [{ p: "link.en", label: "linkTextEn", dir: "ltr" }, { p: "link.ar", label: "linkTextAr", dir: "rtl" }, { p: "link.href", label: "linkHref", dir: "ltr" }]) },
      { key: "thesisItems", blank: function () { return { label: { en: "Thesis", ar: "عنوان الرسالة" }, text: { en: "", ar: "" } }; },
        fields: two("label", "labelEn", "labelAr").concat(two("text", "thesisEn", "thesisAr", true)) }
    ]);
    lists.forEach(function (o) {
      if (!Array.isArray(m[o.key])) return;
      var ml = modelList(o.key);
      o.get = ml.get; o.set = ml.set;
      kids.push(fold(o.key, t("list_" + o.key) + " " + t("count", { n: m[o.key].length }), [listEditor(o)]));
    });
    return el("div", null, kids);
  }

  /* ---------- tab: texts ---------- */
  function pageName(p) { return p === "index.html" ? t("page_index") : p === "publications.html" ? t("page_pubs") : p; }
  function textsList() {
    var q = S.ui.tq.trim().toLowerCase();
    var all = S.model.texts || [];
    var hits = all.filter(function (x) { return !q || (String(x.en) + " " + String(x.ar)).toLowerCase().indexOf(q) >= 0; });
    var limit = q ? 100 : 30;
    var shown = hits.slice(0, limit);
    var box = el("div", { id: "textList" });
    box.appendChild(el("p", { class: "muted small", id: "textCount", text: q
      ? t("textsCountQ", { n: hits.length }) + (hits.length > limit ? t("textsFirst", { n: limit }) : "")
      : t("textsCountAll", { a: shown.length, b: all.length }) }));
    var pages = [];
    shown.forEach(function (x) { if (pages.indexOf(x.page) < 0) pages.push(x.page); });
    pages.forEach(function (p) {
      box.appendChild(el("h3", { text: pageName(p) }));
      var list = el("div", { class: "list" });
      shown.filter(function (x) { return x.page === p; }).forEach(function (x) {
        list.appendChild(el("article", { class: "item", "data-text": String(x.id) }, [
          field(t("inEn"), area(x.en, function (v) { x.en = v; touch(); }, { "data-k": "en" })),
          field(t("inAr"), area(x.ar, function (v) { x.ar = v; touch(); }, { "data-k": "ar" }))
        ]));
      });
      box.appendChild(list);
    });
    if (!shown.length) box.appendChild(el("p", { class: "muted", text: t("noText") }));
    return box;
  }
  function viewTexts() {
    var listBox = textsList();
    var search = input(S.ui.tq, function (v) {
      S.ui.tq = v;
      var fresh = textsList(); listBox.parentNode.replaceChild(fresh, listBox); listBox = fresh;
    }, { id: "textSearch", type: "search", placeholder: t("searchTexts"), "aria-label": t("searchTextsLabel") });
    return el("div", null, [
      el("h2", { text: t("textsTitle") }),
      el("p", { class: "muted small", text: t("textsHint") }),
      search, listBox
    ]);
  }

  /* ---------- tab: look (fonts, colours, portrait) ---------- */
  function loadPreviewFonts(kind) {
    if (S.ui.fontsLoaded[kind]) return;
    S.ui.fontsLoaded[kind] = true;
    ((L.FONTS || {})[kind] || []).forEach(function (f) {
      if (f.system || document.head.querySelector('link[data-preview-font="' + String(f.name).replace(/"/g, "") + '"]')) return;
      document.head.appendChild(el("link", { rel: "stylesheet", "data-preview-font": f.name,
        href: "https://fonts.googleapis.com/css2?family=" + encodeURIComponent(f.name).replace(/%20/g, "+") + "&display=swap" }));
    });
  }
  function fontPicker(kind, title, sample, dir) {
    var fonts = (L.FONTS || {})[kind] || [];
    if (!fonts.length) return null;
    var current = (S.model.fonts || {})[kind];
    if (S.ui.open[kind]) loadPreviewFonts(kind);
    var curFont = fonts.filter(function (f) { return f.name === current; })[0];
    var curName = curFont && curFont.label ? el("bdi", { text: lbl(curFont.label) }) : el("bdi", { dir: "ltr", text: current || "—", "data-content": "" });
    return fold(kind, [el("span", { text: title + " · " }), curName], [
      el("div", { class: "fonts", role: "radiogroup", "aria-label": title }, fonts.map(function (f) {
        var radio = el("input", { type: "radio", name: "font-" + kind, value: f.name, checked: f.name === current,
          onchange: function () { S.model.fonts = S.model.fonts || {}; S.model.fonts[kind] = f.name; touch(); render(); } });
        var smp = el("span", { class: "font-s", dir: dir, text: sample, "data-content": "" });
        /* "same as body text" entries are shown in the body font chosen above */
        var face = f.same ? String((S.model.fonts || {}).en || "") : String(f.name);
        smp.style.fontFamily = '"' + face.replace(/["\\]/g, "") + '", ' + (kind === "head" && !f.same ? "serif" : "sans-serif");
        var nameEl = f.label
          ? el("span", { class: "font-n", text: lbl(f.label) + (f.name === current ? " ✓" : "") })
          : el("span", { class: "font-n", dir: "ltr", text: f.name + (f.name === current ? " ✓" : ""), "data-content": "" });
        return el("label", { class: "font" + (f.name === current ? " on" : ""), "data-font": f.name }, [
          radio, el("span", { class: "font-b" }, [nameEl, smp])
        ]);
      }))
    ], { onopen: function () { loadPreviewFonts(kind); } });
  }

  function hexOk(v) { return /^#[0-9a-f]{6}$/i.test(String(v || "")); }
  function hex6(v) {
    v = String(v || "").trim();
    if (hexOk(v)) return v.toLowerCase();
    var s = /^#([0-9a-f])([0-9a-f])([0-9a-f])$/i.exec(v);
    return s ? ("#" + s[1] + s[1] + s[2] + s[2] + s[3] + s[3]).toLowerCase() : "#000000";
  }
  function contrastOf(a, b) {
    try { if (L.contrast) { var r = Number(L.contrast(a, b)); if (r > 0) return r; } } catch (e) { /* fall back */ }
    var lum = function (h) {
      var m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex6(h));
      var c = [m[1], m[2], m[3]].map(function (x) { var v = parseInt(x, 16) / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
      return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
    };
    var x = lum(a), y = lum(b);
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  }
  function paletteOf(id) { return (L.PALETTES || []).filter(function (p) { return p.id === id; })[0] || null; }
  function pickColours(p) { p = p || {}; return { bg: hex6(p.bg), surface: hex6(p.surface), text: hex6(p.text), accent: hex6(p.accent), link: hex6(p.link) }; }
  function choosePalette(id) {
    var m = S.model, cur = m.theme || { palette: "default" }, baseTheme = S.base.theme;
    if (baseTheme && id === baseTheme.palette) m.theme = clone(baseTheme);
    else if (id === "custom") {
      var from = paletteOf(cur.palette) || paletteOf("default") || {};
      m.theme = { palette: "custom",
        light: cur.palette === "custom" && cur.light ? cur.light : pickColours(from.light || cur.light),
        dark: cur.palette === "custom" && cur.dark ? cur.dark : pickColours(from.dark || cur.dark) };
    } else m.theme = { palette: id, light: clone((baseTheme || cur).light || {}), dark: clone((baseTheme || cur).dark || {}) };
    touch(); render();
  }
  function swatches(c) {
    return el("span", { class: "sw", "aria-hidden": "true" }, ["bg", "surface", "text", "accent", "link"].map(function (k) {
      var s = el("span");
      s.style.background = hexOk(hex6((c || {})[k])) ? hex6((c || {})[k]) : "#ffffff";
      return s;
    }));
  }
  function contrastRows(mode, c) {
    var rows = [["textBg", c.text, c.bg], ["textSurface", c.text, c.surface], ["accentBg", c.accent, c.bg], ["linkBg", c.link, c.bg]];
    return el("div", { class: "contrast", id: "contrast-" + mode }, [el("h3", { text: t("contrastTitle") })].concat(rows.map(function (r) {
      var ok = hexOk(r[1]) && hexOk(r[2]), ratio = ok ? contrastOf(r[1], r[2]) : 0, good = ratio >= 4.5;
      return el("p", { class: "ct " + (good ? "good" : "bad"), "data-ct": r[0], "data-ok": good ? "1" : "0" }, [
        el("span", { text: t("ct_" + r[0]) + ": " }), el("strong", { dir: "ltr", text: ok ? ratio.toFixed(1) : "—" }), " ",
        el("span", { class: "ct-v", text: good ? t("contrastOk") : t("contrastBad") })
      ]);
    })));
  }
  function colourGroup(mode, title) {
    var m = S.model, c = m.theme[mode] = m.theme[mode] || {};
    var rows = ["bg", "surface", "text", "accent", "link"].map(function (k) {
      var key = mode + "." + k;
      var err = el("span", { class: "f-h bad-t", hidden: hexOk(c[k]), text: t("hexBad") });
      var txt, pick;
      var redraw = function () {
        var box = document.getElementById("contrast-" + mode);
        if (box) box.parentNode.replaceChild(contrastRows(mode, c), box);
      };
      pick = el("input", { type: "color", value: hex6(c[k]), "data-colorpick": key, "aria-label": t("c_" + k),
        oninput: function (e) { c[k] = e.target.value; txt.value = c[k]; err.hidden = true; touch(); redraw(); } });
      txt = input(c[k], function (v) {
        v = v.trim();
        if (hexOk(v)) { c[k] = v.toLowerCase(); pick.value = c[k]; err.hidden = true; touch(); redraw(); }
        else err.hidden = false;
      }, { dir: "ltr", maxlength: "7", spellcheck: "false", autocapitalize: "off", "data-color": key });
      return el("div", { class: "colour" }, [el("span", { class: "f-l", text: t("c_" + k) }), el("div", { class: "colour-c" }, [pick, txt]), err]);
    });
    return el("section", { class: "card", "data-mode": mode }, [el("h3", { text: title }), el("div", { class: "colours" }, rows), contrastRows(mode, c)]);
  }
  function paletteBox() {
    if (!Array.isArray(L.PALETTES) || !S.model.theme) return el("p", { class: "msg info", text: t("needLib") });
    var cur = S.model.theme.palette || "default";
    var card = function (id, name, hint, c) {
      var radio = el("input", { type: "radio", name: "palette", value: id, checked: id === cur, onchange: function () { choosePalette(id); } });
      return el("label", { class: "pal" + (id === cur ? " on" : ""), "data-palette": id }, [
        radio, el("span", { class: "pal-b" }, [el("span", { class: "pal-n", text: name + (id === cur ? " ✓" : "") }), hint ? el("span", { class: "muted small", text: hint }) : null, c ? swatches(c) : null])
      ]);
    };
    var kids = [el("h2", { text: t("palettes") }), el("div", { class: "pals", role: "radiogroup", "aria-label": t("palettes") },
      L.PALETTES.map(function (p) { return card(p.id, lbl(p), "", p.light); }).concat([card("custom", t("palCustom"), t("palCustomHint"), cur === "custom" ? S.model.theme.light : null)]))];
    if (cur === "custom") { kids.push(colourGroup("light", t("lightGroup"))); kids.push(colourGroup("dark", t("darkGroup"))); }
    return el("section", { id: "paletteBox" }, kids);
  }

  /* Portrait: centre-crop to 1127:1396, scale, encode as WebP in the browser. */
  function pickPhoto(file) {
    if (!file) return;
    var fail = function (key) { S.ui.photo = { err: key || "photoFail" }; render(); };
    if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size > MAX_PHOTO_SOURCE) { fail("photoBadType"); return; }
    S.ui.photo = { busy: true }; render();
    var fr = new FileReader();
    fr.onerror = function () { fail(); };
    fr.onload = function () {
      var img = new Image();
      img.onerror = function () { fail(); };
      img.onload = function () {
        try {
          var w = img.naturalWidth, h = img.naturalHeight, ratio = PHOTO_W / PHOTO_H, sx = 0, sy = 0, sw = w, sh = h;
          if (!(w > 0 && h > 0)) { fail(); return; }
          if (w / h > ratio) { sw = h * ratio; sx = (w - sw) / 2; } else { sh = w / ratio; sy = (h - sh) / 2; }
          var cv = document.createElement("canvas");
          cv.width = PHOTO_W; cv.height = PHOTO_H;
          var ctx = cv.getContext("2d");
          ctx.imageSmoothingQuality = "high";
          ctx.drawImage(img, sx, sy, sw, sh, 0, 0, PHOTO_W, PHOTO_H);
          var url = cv.toDataURL("image/webp", 0.86);
          if (url.indexOf("data:image/webp;base64,") !== 0) { fail("photoNoWebp"); return; }
          var b64 = url.slice(url.indexOf(",") + 1);
          S.ui.photo = { url: url, base64: b64, size: Math.floor(b64.length * 3 / 4) };
          render();
        } catch (e) { fail(); }
      };
      img.src = String(fr.result);
    };
    fr.readAsDataURL(file);
  }
  function photoBox() {
    var ph = S.ui.photo, pend = S.pending[PHOTO];
    var pic = function (src, label, id) {
      return el("figure", { class: "ph" }, [el("img", { src: src, alt: label, id: id, width: "140", height: "173" }), el("figcaption", { text: label })]);
    };
    var chooser = fileButton("photoInput", t("choosePhoto"), "image/jpeg,image/png,image/webp", false, function (list) { pickPhoto(list[0]); });
    var kids = [el("h2", { text: t("portrait") }), el("p", { class: "muted small", text: t("portraitHint") }), el("div", { class: "row" }, [chooser])];
    if (ph && ph.busy) kids.push(el("p", { class: "msg info", id: "photoBusy", text: t("photoWorking") }));
    if (ph && ph.err) kids.push(el("p", { class: "msg err", id: "photoErr", role: "alert", text: t(ph.err) }));
    var fresh = ph && ph.url ? ph.url : pend ? pend.preview : "";
    kids.push(el("div", { class: "phs" }, [pic("../" + PHOTO, t("photoCurrent"), "photoNow"), fresh ? pic(fresh, t("photoNew"), "photoNew") : null]));
    if (ph && ph.url) {
      kids.push(el("div", { class: "row" }, [
        btn(t("photoUse"), function () {
          S.pending[PHOTO] = { base64: ph.base64, size: ph.size, preview: ph.url };
          S.model.photoVersion = stamp(); S.ui.photo = null; touch(); render();
        }, "primary", { id: "photoUse" }),
        btn(t("cancel"), function () { S.ui.photo = null; render(); }, "ghost", { id: "photoCancel" })
      ]));
    } else if (pend) {
      kids.push(el("p", { class: "msg ok", id: "photoPending", role: "status", text: t("photoPending") + " (" + sizeText(pend.size) + ")" }));
      kids.push(btn(t("photoRemove"), function () {
        delete S.pending[PHOTO];
        S.model.photoVersion = clone(S.base.photoVersion === undefined ? "" : S.base.photoVersion);
        touch(); render();
      }, "ghost sm", { id: "photoRemove" }));
    }
    return el("section", { class: "card", id: "photoBox" }, kids);
  }
  function viewLook() {
    return el("div", null, [
      el("p", { class: "muted small", text: t("lookHint") }),
      fontPicker("ar", t("fontAr"), "رئيس قسم نظم المعلومات · أبحاث الذكاء الاصطناعي 2026", "rtl"),
      fontPicker("en", t("fontEn"), "Chair, Information Systems Department · AI research 2026", "ltr"),
      fontPicker("head", t("fontHead"), "Research, teaching and leadership", "ltr"),
      paletteBox(),
      photoBox()
    ]);
  }

  /* ---------- tab: cv ---------- */
  /* The preview iframe runs no scripts, so the short / full switch is done by the class the CV page uses. */
  /* The CV has an Arabic page when cv.html carries data-ar texts (or the CV module says so). */
  function cvHasArabic(html) {
    return !!(window.DashCV && window.DashCV.ARABIC === true) || /\sdata-ar(?:-[a-zA-Z-]+)?="/.test(String(html || S.files["cv.html"] || ""));
  }
  function cvArabicFields() {
    var cv = (S.model || {}).cv;
    if (window.DashCV && window.DashCV.ARABIC === true) return true;
    var found = false;
    (function walk(o) {
      if (found || !o || typeof o !== "object") return;
      Object.keys(o).forEach(function (k) { if (/Ar$/.test(k) || (k === "ar" && o === cv.profile)) found = true; else walk(o[k]); });
    })(cv);
    return found;
  }
  function cvLangSwitch() {
    return el("div", { class: "seg-wrap", role: "group", "aria-label": t("cvLang") }, [
      seg([["en", t("pvEn")], ["ar", t("pvAr")]], S.ui.cvLang === "ar" ? "ar" : "en", function (v) { S.ui.cvLang = v; render(); }, "data-cvlang")
    ]);
  }
  function cvDoc(html) {
    var arabic = S.ui.cvLang === "ar" && cvHasArabic(html) && L.PAGES && L.PAGES["cv.html"];
    var doc = arabic ? withBase(L.buildArabic("cv.html", html), SITE + "ar/") : withBase(html, SITE);
    if (S.ui.cvMode !== "full") return doc;
    var cls = String((window.DashCV && window.DashCV.MODE_CLASS) || "cv-full").replace(/[^A-Za-z0-9_-]/g, "");
    return doc.replace(/<html\b([^>]*)>/i, function (m, attrs) {
      if (/\sclass="/.test(attrs)) return "<html" + attrs.replace(/\sclass="([^"]*)"/, function (x, c) { return ' class="' + (c ? c + " " : "") + cls + '"'; }) + ">";
      return "<html" + attrs + ' class="' + cls + '">';
    });
  }
  function cvModeSwitch() {
    return el("div", { class: "seg-wrap", role: "group", "aria-label": t("cvMode") }, [
      seg([["short", t("cvModeShort")], ["full", t("cvModeFull")]], S.ui.cvMode, function (v) { S.ui.cvMode = v; render(); }, "data-cvmode")
    ]);
  }
  /* --- import a CV file (read in the browser by DashImport; nothing is uploaded) --- */
  var CVI_SKIP = { publications: 1, education: 1, profile: 1, languages: 1, experience: 1, teaching: 1, service: 1 };
  function pickCvFile(file) {
    var DI = window.DashImport;
    if (!file || !DI) return;
    var run = { state: "busy", name: file.name, cards: [], warn: [], err: "", msg: "" };
    S.ui.cvi = run; render();
    var fail = function (e) {
      if (S.ui.cvi !== run) return;
      var code = e && e.code;
      run.state = "err"; run.err = code === "too-large" ? "cviTooLarge" : code === "type" || code === "unsupported" ? "cviType" : code === "password" ? "cviPassword" : "cviFail";
      render();
    };
    var fr = new FileReader();
    fr.onerror = function () { fail(); };
    fr.onload = function () {
      Promise.resolve().then(function () { return DI.extract(fr.result, file.name); }).then(function (got) {
        if (S.ui.cvi !== run) return;
        got = got || {};
        run.warn = (got.warnings || []).map(String);
        var first = appointmentOptions()[0];
        run.cards = (DI.sections(String(got.text || "")) || []).filter(function (x) { return x && (x.lines || []).length; }).map(function (sec) {
          var kind = "other", skip = false;
          try { kind = String(DI.guess(sec) || "other"); } catch (e) { /* keep other */ }
          try { skip = !!DI.suggest && DI.suggest(sec) === "skip"; } catch (e) { /* keep our own rule */ }
          return { title: String(sec.title || ""), text: (sec.lines || []).map(String).join("\n"), kind: kind, action: skip || CVI_SKIP[kind] ? "skip" : "full", appt: first ? first[0] : "", done: false };
        });
        run.state = "done";
        render();
      }).catch(fail);
    };
    fr.readAsArrayBuffer(file);
  }
  function applyCvImport() {
    var run = S.ui.cvi, cv = S.model.cv, n = 0;
    run.cards.forEach(function (c) {
      var lines = toLines(c.text);
      if (c.done || c.action === "skip" || !lines.length) return;
      if (c.action === "full") {
        cv.fullExtra = cv.fullExtra || [];
        cv.fullExtra.push({ title: c.title.trim(), items: lines });
      } else if (c.action === "appt" && c.appt) {
        cv.appointmentDetails = cv.appointmentDetails || [];
        var hit = cv.appointmentDetails.filter(function (x) { return x.match === c.appt; })[0];
        if (hit) hit.bullets = (hit.bullets || []).concat(lines); else cv.appointmentDetails.push({ match: c.appt, bullets: lines });
      } else return;
      c.done = true; n++;
    });
    run.msg = n ? { key: "cviApplied", vars: { n: n } } : { key: "cviNothing" }; run.msgKind = n ? "ok" : "info";
    if (n) { S.ui.open["cv-fullExtra"] = true; touch(); }
    render();
  }
  function cvImportBox() {
    if (!window.DashImport || !window.DashImport.extract) return null;
    var run = S.ui.cvi, appts = appointmentOptions();
    var chooser = fileButton("cviInput", t("cviChoose"), ".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document", false, function (list) { pickCvFile(list[0]); });
    var kids = [el("p", { class: "muted small", text: t("cviHint") }), el("p", { class: "muted small", id: "cviPrivacy", text: t("cviPrivacy") }), el("div", { class: "row" }, [chooser]),
      run && run.name ? el("p", { class: "muted small", id: "cviName", dir: "auto", text: run.name, "data-content": "" }) : null];
    if (run && run.state === "busy") kids.push(el("p", { class: "msg info", id: "cviBusy", role: "status", text: t("cviBusy") }));
    if (run && run.state === "err") kids.push(el("p", { class: "msg err", id: "cviErr", role: "alert", text: t(run.err) }));
    if (run && run.state === "done") {
      if (run.warn.indexOf("no-text") >= 0) kids.push(el("p", { class: "msg warn", id: "cviNoText", role: "alert", text: t("cviNoText") }));
      else if (!run.cards.length) kids.push(el("p", { class: "msg warn", id: "cviNone", text: t("cviNone") }));
      else if (run.warn.indexOf("few-text") >= 0) kids.push(el("p", { class: "msg warn", id: "cviFewText", text: t("cviFewText") }));
      if (run.cards.length) {
        kids.push(el("p", { class: "muted small", id: "cviFound", text: t("cviFound", { n: run.cards.length }) }));
        kids.push(el("div", { class: "list", id: "cviList" }, run.cards.map(function (c, i) {
          var acts = [["full", t("cviActFull")]].concat(appts.length ? [["appt", t("cviActAppt")]] : []).concat([["skip", t("cviActSkip")]]);
          var act = select(c.action, acts, function (v) { c.action = v; render(); });
          act.setAttribute("data-k", "action"); act.disabled = c.done;
          var ap = null;
          if (c.action === "appt" && appts.length) { ap = select(c.appt, appts, function (v) { c.appt = v; }); ap.setAttribute("data-k", "appt"); ap.disabled = c.done; }
          return el("article", { class: "item" + (c.done ? " off" : ""), "data-cvi": String(i), "data-kind": c.kind }, [
            field(t("cviSecTitle"), input(c.title, function (v) { c.title = v; }, { dir: "auto", "data-k": "title", disabled: c.done })),
            field(t("cvLines"), area(c.text, function (v) { c.text = v; }, { dir: "auto", rows: "4", "data-k": "text", disabled: c.done })),
            el("div", { class: "grid2" }, [field(t("cviAction"), act), ap ? field(t("cvApptPick"), ap) : null]),
            c.done ? el("span", { class: "tag ok", "data-done": "1", text: t("cviDone") }) : null
          ]);
        })));
        if (run.msg) kids.push(el("p", { class: "msg " + (run.msgKind || "info"), id: "cviMsg", role: "status", text: t(run.msg.key, run.msg.vars) }));
        kids.push(el("div", { class: "row" }, [btn(t("cviApply"), applyCvImport, "primary", { id: "cviApply" })]));
      }
    }
    return fold("cv-import", t("cviTitle"), kids);
  }
  /* --- the live research portfolio page (portfolio.html): its only owner text is the trajectory --- */
  function portfolioBox() {
    var pf = S.model.portfolio;
    if (!pf || typeof pf !== "object") return null;
    if (!Array.isArray(pf.trajectory)) pf.trajectory = [];
    var url = SITE + "portfolio.html";
    var kids = [
      el("h2", { text: t("pfTitle") }),
      el("p", { class: "muted small", text: t("pfHint") }),
      el("p", { class: "small linkrow", "data-link": "portfolio" }, [el("span", { text: t("pfLink") + " " }),
        el("a", { href: url, target: "_blank", rel: "noopener noreferrer", dir: "ltr", text: url, "data-content": "" }), " ", copyBtn(url, "pf:link", t("copyLink"))]),
      el("div", { class: "row" }, [btn(S.ui.pfPreview ? t("cvPreviewHide") : t("pfPreview"), function () { S.ui.pfPreview = !S.ui.pfPreview; render(); }, "ghost",
        { id: "pfPreviewBtn", "aria-pressed": S.ui.pfPreview ? "true" : "false" })])
    ];
    if (S.ui.pfPreview) {
      var html = (compute().files || {})["portfolio.html"] || S.files["portfolio.html"] || "";
      if (html) {
        var frame = el("iframe", { id: "pfPreview", class: "preview", title: t("pfPreviewTitle"), sandbox: "", referrerpolicy: "no-referrer" });
        try { frame.srcdoc = withBase(html, SITE); } catch (e) { frame.srcdoc = ""; }
        kids.push(frame);
        kids.push(el("p", { class: "muted small", text: t("pvStatic") }));
      }
    }
    var lines = pf.trajectory.map(function (line, i) {
      return el("article", { class: "item", "data-list": "pf-trajectory", "data-i": String(i) }, [
        field(t("pfLine"), area(line, function (v) { pf.trajectory[i] = v.replace(/\s*\n\s*/g, " "); touch(); }, { dir: "ltr", rows: "2", "data-k": "line" })),
        el("div", { class: "row" }, [moveBtns(pf.trajectory, i), confirmBtn("pf-trajectory-" + i, t("del"), t("yesDelete"), function () { pf.trajectory.splice(i, 1); touch(); render(); }, "danger sm")])
      ]);
    });
    kids.push(fold("pf-trajectory", t("pfTrajectory") + " " + t("count", { n: pf.trajectory.length }), [
      el("div", { class: "row" }, [btn(t("addItem"), function () { pf.trajectory.push(""); touch(); render(); }, "primary sm", { id: "add-pf-trajectory" })]),
      el("div", { class: "list", id: "list-pf-trajectory" }, lines)
    ]));
    return el("section", { class: "pfbox", id: "pfBox" }, kids);
  }
  function viewCv() {
    var cv = S.model.cv;
    if (!cv || typeof cv !== "object") return el("div", null, [el("h2", { text: t("cvTitle") }), el("p", { class: "msg info", id: "needLib", text: t("needLib") }), portfolioBox()]);
    var cvList = function (key, fields, blank, grid) {
      return listEditor({ key: "cv-" + key, fields: fields, blank: blank, grid: grid, get: function () { return cv[key]; }, set: function (a) { cv[key] = a; } });
    };
    var withAr = cvArabicFields();
    var arF = function (fields) { return withAr ? fields : []; };
    var pair = [{ p: "title", label: "fTitle", dir: "ltr" }].concat(arF([{ p: "titleAr", label: "cvTitleAr", dir: "rtl" }]),
      [{ p: "text", label: "cvText", dir: "ltr", long: true }], arF([{ p: "textAr", label: "cvTextAr", dir: "rtl", long: true }]));
    var blankPair = function () { return withAr ? { title: "", text: "", titleAr: "", textAr: "" } : { title: "", text: "" }; };
    var n = function (key) { return " " + t("count", { n: (cv[key] || []).length }); };
    var link = function (label, url, key) {
      return el("p", { class: "small linkrow", "data-link": key }, [el("span", { text: label + " " }),
        el("a", { href: url, target: "_blank", rel: "noopener noreferrer", dir: "ltr", text: url, "data-content": "" }), " ", copyBtn(url, "cv:" + key, t("copyLink"))]);
    };
    var kids = [
      el("h2", { text: t("cvTitle") }),
      el("p", { class: "muted small", text: t("cvHint") }),
      el("div", { id: "cvLinks" }, [link(t("cvLinkShort"), SITE + "cv.html", "short"), link(t("cvLinkFull"), SITE + "cv.html#full", "full")]),
      el("div", { class: "row" }, [
        btn(S.ui.cvPreview ? t("cvPreviewHide") : t("cvPreview"), function () { S.ui.cvPreview = !S.ui.cvPreview; render(); }, "ghost", { id: "cvPreviewBtn", "aria-pressed": S.ui.cvPreview ? "true" : "false" }),
        S.ui.cvPreview ? cvModeSwitch() : null,
        S.ui.cvPreview && cvHasArabic((compute().files || {})["cv.html"]) ? cvLangSwitch() : null
      ])
    ];
    if (S.ui.cvPreview) {
      var html = (compute().files || {})["cv.html"] || S.files["cv.html"] || "";
      if (html) {
        var frame = el("iframe", { id: "cvPreview", class: "preview", title: t("cvPreviewTitle"), sandbox: "", referrerpolicy: "no-referrer" });
        try { frame.srcdoc = cvDoc(html); } catch (e) { frame.srcdoc = ""; }
        kids.push(frame);
        kids.push(el("p", { class: "muted small", text: t("pvStatic") }));
      } else kids.push(el("p", { class: "msg info", id: "cvEmpty", text: t("cvEmpty") }));
    }
    kids.push(cvImportBox());
    kids.push(el("section", { class: "card" }, [
      field(t("cvProfile"), area((cv.profile || {}).en, function (v) { cv.profile = cv.profile || {}; cv.profile.en = v; touch(); }, { id: "cvProfile", dir: "ltr", rows: "5" })),
      withAr ? field(t("cvProfileAr"), area((cv.profile || {}).ar, function (v) { cv.profile = cv.profile || {}; cv.profile.ar = v; touch(); }, { id: "cvProfileAr", dir: "rtl", rows: "5" }), t("cvArHint")) : null,
      el("div", { class: "grid2" }, [
        field(t("cvLanguages"), area(cv.languages, function (v) { cv.languages = v; touch(); }, { id: "cvLanguages", dir: "ltr" })),
        withAr ? field(t("cvLanguagesAr"), area(cv.languagesAr, function (v) { cv.languagesAr = v; touch(); }, { id: "cvLanguagesAr", dir: "rtl" })) : null,
        field(t("cvOpenTo"), area(cv.openTo, function (v) { cv.openTo = v; touch(); }, { id: "cvOpenTo", dir: "ltr" })),
        withAr ? field(t("cvOpenToAr"), area(cv.openToAr, function (v) { cv.openToAr = v; touch(); }, { id: "cvOpenToAr", dir: "rtl" })) : null
      ]),
      field(t("cvSelected"), input(cv.selected, function (v) { var x = parseInt(v, 10); if (x >= 1 && x <= 200) { cv.selected = x; touch(); } }, { id: "cvSelected", dir: "ltr", inputmode: "numeric", maxlength: "3" }))
    ]));
    kids.push(fold("cv-accepted", t("cvAccepted") + n("accepted"), [cvList("accepted", [{ p: "year", label: "fYear", dir: "ltr", mode: "numeric" }, { p: "text", label: "cvText", dir: "ltr", long: true }].concat(arF([{ p: "textAr", label: "cvTextAr", dir: "rtl", long: true }])), function () { return { year: String(new Date().getFullYear()), text: "" }; })]));
    kids.push(fold("cv-extraService", t("cvService") + n("extraService"), [cvList("extraService", [{ p: "title", label: "fTitle", dir: "ltr" }, { p: "org", label: "org", dir: "ltr" }, { p: "date", label: "cvDate", dir: "ltr" }, { p: "text", label: "cvText", dir: "ltr", long: true }].concat(arF([{ p: "titleAr", label: "cvTitleAr", dir: "rtl" }, { p: "orgAr", label: "orgAr", dir: "rtl" }, { p: "textAr", label: "cvTextAr", dir: "rtl", long: true }])), function () { return { title: "", org: "", date: "", text: "" }; })]));
    kids.push(fold("cv-fullExtra", t("cvFullExtra") + n("fullExtra"), [
      el("p", { class: "muted small", text: t("cvFullExtraHint") }),
      cvList("fullExtra", [{ p: "title", label: "fTitle", dir: "ltr" }, { p: "items", label: "cvLines", dir: "ltr", lines: true }].concat(arF([{ p: "titleAr", label: "cvTitleAr", dir: "rtl" }, { p: "itemsAr", label: "cvLinesAr", dir: "rtl", lines: true }])), function () { return { title: "", items: [] }; }, "grid1")
    ]));
    kids.push(fold("cv-appointmentDetails", t("cvAppt") + n("appointmentDetails"), [
      el("p", { class: "muted small", text: t("cvApptHint") }),
      cvList("appointmentDetails", [{ p: "match", label: "cvApptPick", options: appointmentOptions }, { p: "bullets", label: "cvBullets", dir: "ltr", lines: true }].concat(arF([{ p: "bulletsAr", label: "cvBulletsAr", dir: "rtl", lines: true }])),
        function () { var o = appointmentOptions()[0]; return { match: o ? o[0] : "", bullets: [] }; }, "grid1")
    ]));
    kids.push(fold("cv-pillars", t("cvPillars") + n("pillars"), [cvList("pillars", pair, blankPair)]));
    kids.push(fold("cv-community", t("cvCommunity") + n("community"), [cvList("community", pair, blankPair)]));
    kids.push(fold("cv-development", t("cvDevelopment") + n("development"), [cvList("development", pair, blankPair)]));
    kids.push(portfolioBox());
    return el("div", null, kids);
  }

  /* ---------- tab: import ---------- */
  function parseImport(quiet) {
    var imp = S.ui.imp, r;
    try { r = L.parseAchievements(imp.text) || []; } catch (e) { r = []; }
    var items = Array.isArray(r) ? r : (r.items || []);
    imp.items = items.map(function (x, i) { var y = Object.assign({}, x); if (y.n == null) y.n = i + 1; return y; });
    imp.askMe = (r.askMe || []).map(String); imp.numbers = (r.numbers || []).map(String);
    if (!quiet) render();
  }
  function importItem(it) {
    var imp = S.ui.imp, key = String(it.n), done = imp.done[key] || (imp.done[key] = {});
    var mark = function (k) { done[k] = true; touch(); saveDraftSoon(); render(); };
    var act = function (k, label, fn, can) {
      if (done[k]) return el("span", { class: "tag ok", "data-done": k, text: label + " · " + t("impAdded") });
      return btn(label, function () { fn(); mark(k); }, "ghost sm", { "data-imp": k, disabled: can === false });
    };
    if (done.skip) {
      return el("article", { class: "item imp-item off", "data-n": key }, [
        el("p", { class: "muted small", dir: "auto" }, [el("bdi", { text: it.titleEn || it.titleAr || "", "data-content": "" }), " — ", el("span", { text: t("impSkipped") })]),
        btn(t("impRestore"), function () { delete done.skip; saveDraftSoon(); render(); }, "ghost sm", { "data-imp": "restore" })
      ]);
    }
    var year = it.year || String(new Date().getFullYear());
    var line = function (label, value) { return value ? el("div", { class: "small imp-l" }, [el("span", { class: "muted imp-k", text: label }), el("span", { class: "imp-v", dir: "auto", text: String(value), "data-content": "" })]) : null; };
    return el("article", { class: "item imp-item", "data-n": key }, [
      el("div", { class: "item-h" }, [el("strong", { dir: "ltr", text: "#" + key, "data-content": "" }), it.category ? el("span", { class: "muted small", dir: "auto", text: it.category, "data-content": "" }) : null]),
      it.titleEn ? el("p", { class: "item-t", dir: "ltr", lang: "en", text: it.titleEn, "data-content": "" }) : null,
      it.titleAr ? el("p", { class: "item-t ar", dir: "rtl", lang: "ar", text: it.titleAr, "data-content": "" }) : null,
      line(t("org"), it.organisation), line(t("impDate"), it.date), line(t("impSuggest"), it.suggest), line(t("impWhy"), it.why),
      el("div", { class: "row" }, [
        act("news", t("impNews"), function () { S.model.news = S.model.news || []; S.model.news.unshift({ year: year, en: it.titleEn || "", ar: it.titleAr || "" }); }),
        act("role", t("impRole"), function () { S.model.roles = S.model.roles || []; S.model.roles.unshift({ org: it.organisation || "", orgAr: "", en: it.titleEn || "", ar: it.titleAr || "" }); }),
        act("cv", t("impCv"), function () {
          var cv = S.model.cv; cv.extraService = cv.extraService || [];
          cv.extraService.unshift({ title: it.titleEn || "", org: it.organisation || "", date: it.date || "", text: it.role || "" });
        }, !!(S.model.cv && typeof S.model.cv === "object")),
        btn(t("impSkip"), function () { done.skip = true; saveDraftSoon(); render(); }, "ghost sm", { "data-imp": "skip" })
      ])
    ]);
  }
  function saveDraftSoon() { window.clearTimeout(saveTimer); saveTimer = window.setTimeout(saveDraftNow, 250); }
  function viewImport() {
    var imp = S.ui.imp;
    if (!L.parseAchievements) return el("div", null, [el("h2", { text: t("impTitle") }), el("p", { class: "msg info", id: "needLib", text: t("needLib") })]);
    var kids = [
      el("h2", { text: t("impTitle") }),
      el("p", { class: "muted small", text: t("impHint") }),
      field(t("impPaste"), area(imp.text, function (v) { imp.text = v; }, { id: "impText", rows: "8", dir: "auto", spellcheck: "false" })),
      el("div", { class: "row" }, [
        btn(t("impGo"), function () { parseImport(false); }, "primary", { id: "impGo" }),
        btn(t("impClear"), function () { S.ui.imp = { text: "", items: null, askMe: [], numbers: [], done: {} }; saveDraftSoon(); render(); }, "ghost", { id: "impClear" })
      ])
    ];
    if (imp.items) {
      kids.push(imp.items.length
        ? el("p", { class: "muted small", id: "impCount", text: t("impCount", { n: imp.items.length }) })
        : el("p", { class: "msg warn", id: "impNone", text: t("impNone") }));
      kids.push(el("div", { class: "list", id: "impList" }, imp.items.map(importItem)));
      var notes = function (id, title, list) {
        return list.length ? el("section", { class: "card", id: id }, [el("h3", { text: title }), el("ul", { class: "notes" }, list.map(function (x) { return el("li", { dir: "auto", text: x, "data-content": "" }); }))]) : null;
      };
      kids.push(notes("impAsk", t("impAsk"), imp.askMe));
      kids.push(notes("impNumbers", t("impNumbers"), imp.numbers));
    }
    return el("div", null, kids);
  }

  /* ---------- tab: files ---------- */
  function safeName(name, ext) {
    var stem = String(name).replace(/\.[^.]*$/, "");
    try { stem = stem.normalize("NFKD"); } catch (e) { /* keep as is */ }
    stem = stem.replace(/[^\x20-\x7E]/g, "").replace(/[^A-Za-z0-9._-]+/g, "-").replace(/-{2,}/g, "-").replace(/\.{2,}/g, ".").replace(/^[-._]+|[-._]+$/g, "").slice(0, 60);
    return (stem || "file") + "." + ext;
  }
  function magicOk(ext, b64) {
    var head;
    try { head = window.atob(b64.slice(0, 24)); } catch (e) { return false; }
    var at = function (i) { return head.charCodeAt(i); };
    if (ext === "pdf") return head.slice(0, 4) === "%PDF";
    if (ext === "png") return at(0) === 0x89 && head.slice(1, 4) === "PNG";
    if (ext === "jpg" || ext === "jpeg") return at(0) === 0xFF && at(1) === 0xD8 && at(2) === 0xFF;
    if (ext === "gif") return head.slice(0, 4) === "GIF8";
    if (ext === "webp") return head.slice(0, 4) === "RIFF" && head.slice(8, 12) === "WEBP";
    return false;
  }
  function addFiles(fileList) {
    var files = Array.prototype.slice.call(fileList || []), left = files.length;
    S.ui.fileErr = [];
    if (!left) return;
    var finish = function () { left--; if (left <= 0) { touch(); render(); } };
    files.forEach(function (file) {
      var ext = (/\.([A-Za-z0-9]+)$/.exec(file.name) || ["", ""])[1].toLowerCase();
      if (!FILE_TYPES[ext] || (file.type && file.type !== FILE_TYPES[ext])) { S.ui.fileErr.push({ key: "fileBadType", x: file.name }); finish(); return; }
      if (file.size > MAX_FILE) { S.ui.fileErr.push({ key: "fileTooBig", x: file.name }); finish(); return; }
      var fr = new FileReader();
      fr.onerror = function () { S.ui.fileErr.push({ key: "fileReadFail", x: file.name }); finish(); };
      fr.onload = function () {
        var url = String(fr.result), b64 = url.slice(url.indexOf(",") + 1);
        if (!b64 || !magicOk(ext, b64)) S.ui.fileErr.push({ key: "fileBadType", x: file.name });
        else S.pending["files/" + safeName(file.name, ext)] = { base64: b64, size: file.size };
        finish();
      };
      fr.readAsDataURL(file);
    });
  }
  function loadDir() {
    if (S.ui.dirState || !GH.listDir) return;
    S.ui.dirState = "loading";
    GH.listDir(S.token, "files").then(function (list) { S.ui.dir = list; S.ui.dirState = "ok"; }, function () { S.ui.dir = []; S.ui.dirState = "err"; })
      .then(function () { if (S.tab === "files" && S.model && !S.ui.busy) render(); });
  }
  function viewFiles() {
    loadDir();
    var pend = pendingPaths().filter(function (p) { return p !== PHOTO; });
    var chooser = fileButton("fileInput", t("chooseFiles"), ".pdf,.png,.jpg,.jpeg,.webp,.gif,application/pdf,image/png,image/jpeg,image/webp,image/gif", true, addFiles);
    var kids = [el("h2", { text: t("filesTitle") }), el("p", { class: "muted small", text: t("filesHint") }), el("div", { class: "row" }, [chooser])];
    if (S.ui.fileErr.length) kids.push(el("ul", { class: "msg err", id: "fileErr", role: "alert" }, S.ui.fileErr.map(function (x) { return el("li", { dir: "auto", text: t(x.key, { x: x.x }) }); })));
    if (pend.length) {
      kids.push(el("h3", { text: t("filesPending") + " " + t("count", { n: pend.length }) }));
      kids.push(el("ul", { class: "flist", id: "pendingFiles" }, pend.map(function (p) {
        return el("li", { "data-path": p }, [
          el("span", { class: "fname", dir: "ltr", text: p, "data-content": "" }), el("span", { class: "muted small", dir: "ltr", text: sizeText(S.pending[p].size) }),
          btn(t("remove"), function () { delete S.pending[p]; touch(); render(); }, "ghost sm", { "data-remove": p })
        ]);
      })));
    }
    var seen = {}, pub = [];
    S.ui.uploaded.forEach(function (p) { seen[p] = true; pub.push({ path: p, fresh: true }); });
    (S.ui.dir || []).forEach(function (f) { if (!seen[f.path]) { seen[f.path] = true; pub.push({ path: f.path, size: f.size }); } });
    kids.push(el("h3", { text: t("filesPublished") }));
    if (S.ui.dirState === "loading" && !pub.length) kids.push(el("p", { class: "muted small", id: "dirLoading", text: t("filesLoading") }));
    else if (!pub.length) kids.push(el("p", { class: "muted small", id: "filesNone", text: t("filesNone") }));
    else {
      kids.push(el("ul", { class: "flist", id: "publishedFiles" }, pub.map(function (f) {
        var url = SITE + f.path.split("/").map(encodeURIComponent).join("/");
        return el("li", { "data-path": f.path }, [
          el("a", { class: "fname", href: url, target: "_blank", rel: "noopener noreferrer", dir: "ltr", text: url, "data-content": "" }),
          f.fresh ? el("span", { class: "tag ok", text: t("filesJust") }) : el("span", { class: "muted small", dir: "ltr", text: f.size ? sizeText(f.size) : "" }),
          copyBtn(url, "file:" + f.path, t("copyLink"))
        ]);
      })));
    }
    return el("div", null, kids);
  }

  /* ---------- tab: ai helper ---------- */
  function loadGuide() {
    if (S.ui.guideState) return;
    S.ui.guideState = "loading";
    fetch("ai-guide.md?v=" + ASSET_TAG, { credentials: "omit", cache: "no-store", referrerPolicy: "no-referrer" })
      .then(function (r) { if (!r.ok) throw new Error("http"); return r.text(); })
      .then(function (text) { S.ui.guide = text; S.ui.guideState = "ok"; }, function () { S.ui.guide = null; S.ui.guideState = "err"; })
      .then(function () { if (S.tab === "ai" && S.model && !S.ui.busy) render(); });
  }
  function viewAi() {
    loadGuide();
    var kids = [el("h2", { text: t("aiTitle") }), el("p", { class: "muted small", text: t("aiHint") })];
    if (S.ui.guideState === "ok") {
      kids.push(el("div", { class: "row" }, [copyBtn(S.ui.guide, "guide", t("aiCopy"), "primary", "guideCopy")]));
      kids.push(field(t("aiLabel"), area(S.ui.guide, function () { /* read only */ }, { id: "guideText", readOnly: true, dir: "ltr", lang: "en", rows: "18", spellcheck: "false", class: "mono" })));
    } else if (S.ui.guideState === "err") kids.push(el("p", { class: "msg err", id: "guideErr", role: "alert", text: t("aiFail") }));
    else kids.push(el("p", { class: "msg info", id: "guideBusy", text: t("aiLoading") }));
    return el("div", null, kids);
  }

  /* ---------- tab: publish ---------- */
  function compute() {
    if (S.out) return S.out;
    try {
      var o = L.build(S.files, S.model, { today: today() }) || {};
      S.out = { files: o.files || {}, warnings: o.warnings || [], summary: o.summary || [] };
    } catch (e) {
      S.out = { files: {}, warnings: [], summary: [], error: String((e && e.message) || e) };
    }
    return S.out;
  }
  function englishSummary() {
    var parts = [], ch = changed(), has = function (k) { return ch.indexOf(k) >= 0; };
    if (has("works")) {
      var baseIds = {}, nowIds = {}, added = 0, removed = 0, edited = 0;
      S.base.works.forEach(function (w) { baseIds[w.id] = JSON.stringify(w); });
      S.model.works.forEach(function (w) { nowIds[w.id] = 1; if (!baseIds[w.id]) added++; else if (baseIds[w.id] !== JSON.stringify(w)) edited++; });
      S.base.works.forEach(function (w) { if (!nowIds[w.id]) removed++; });
      var bits = [];
      if (added) bits.push("+" + added); if (edited) bits.push("~" + edited); if (removed) bits.push("-" + removed);
      parts.push("publications " + bits.join(" "));
    }
    [["metrics", "numbers"], ["news", "news"], ["roles", "roles"], ["texts", "texts"], ["fonts", "fonts"], ["theme", "colours"], ["sections", "sections"]].forEach(function (x) { if (has(x[0])) parts.push(x[1]); });
    if (has("flagship") || has("courses")) parts.push("courses");
    if (has("timeline") || has("timelineEarlier")) parts.push("career");
    if (has("leadBullets") || has("leadCards")) parts.push("leadership");
    if (has("contacts") || has("contactLinks")) parts.push("contact");
    if (has("degreeCards") || has("thesisItems")) parts.push("education");
    if (has("portfolio")) parts.push("portfolio");
    if (has("citations")) parts.push("citations");
    if (has("cv")) parts.push("cv");
    if (has("photoVersion")) parts.push("portrait");
    var up = pendingPaths().filter(function (p) { return p !== PHOTO; }).length;
    if (up) parts.push("files +" + up);
    return parts.join(", ") || "update";
  }
  function withBase(html, base) {
    return String(html).replace('data-theme="dark"', 'data-theme="light"').replace(/<head([^>]*)>/i, function (m) { return m + '<base href="' + base + '">'; });
  }
  function previewHtml(out) {
    var page = S.ui.pv.page, html = out.files[page] || S.files[page] || "";
    if (page === "cv.html") return html ? cvDoc(html) : "";
    if (page === "portfolio.html") return html ? withBase(html, SITE) : "";
    if (S.ui.pv.lang === "ar") return withBase(out.files["ar/" + page] || L.buildArabic(page, html), SITE + "ar/");
    return withBase(html, SITE);
  }
  async function doPublish() {
    if (S.ui.busy) return;
    var out = compute(), files = {}, uploaded = [];
    Object.keys(out.files).forEach(function (p) { files[p] = out.files[p]; });
    pendingPaths().forEach(function (p) { files[p] = { base64: S.pending[p].base64 }; if (p !== PHOTO) uploaded.push(p); });
    S.ui.busy = t("publishing"); S.ui.pub = null; render();
    try {
      var message = "Dashboard: " + englishSummary();
      var sha = await GH.commit(S.token, files, message, S.head);
      var next = clone(S.files);
      Object.keys(out.files).forEach(function (p) { if (Object.prototype.hasOwnProperty.call(next, p)) next[p] = out.files[p]; });
      sdel("local", DRAFT_KEY);
      S.pending = {}; S.ui.busy = ""; S.ui.photo = null;
      var keepUi = { uploaded: uploaded.concat(S.ui.uploaded.filter(function (p) { return uploaded.indexOf(p) < 0; })), imp: S.ui.imp, open: S.ui.open, fontsLoaded: S.ui.fontsLoaded, guide: S.ui.guide, guideState: S.ui.guideState };
      try { setBase(next, sha); }
      catch (e) { await signIn(S.token, S.remember); }
      Object.keys(keepUi).forEach(function (k) { S.ui[k] = keepUi[k]; });
      S.ui.last = null; S.ui.lastState = ""; S.ui.dir = null; S.ui.dirState = "";
      S.ui.ver = { state: "", list: [], headTree: "", name: "", msg: null };
      S.ui.pub = { kind: "ok", key: "pubOk" };
    } catch (e) {
      S.ui.busy = "";
      S.ui.pub = { kind: "err", err: e, stale: !!(e && e.code === "stale") };
    }
    render();
  }
  async function doUndo() {
    if (S.ui.busy) return;
    S.ui.busy = t("undoing"); S.ui.pub = null; render();
    try {
      await GH.undo(S.token);
      sdel("local", DRAFT_KEY);
      var got = await GH.load(S.token, L.FILES);
      S.ui.busy = ""; S.pending = {};
      setBase(got.files, got.head);
      S.ui.last = null; S.ui.lastState = ""; S.ui.dir = null; S.ui.dirState = ""; S.ui.uploaded = [];
      S.ui.ver = { state: "", list: [], headTree: "", name: "", msg: null };
      S.ui.pub = { kind: "ok", key: "undoOk" };
    } catch (e) {
      S.ui.busy = "";
      S.ui.pub = { kind: "err", err: e };
    }
    render();
  }
  function fetchLast() {
    if (S.ui.lastState) return;
    S.ui.lastState = "loading";
    GH.lastCommit(S.token).then(function (c) { S.ui.last = c; S.ui.lastState = "ok"; }, function () { S.ui.last = null; S.ui.lastState = "err"; })
      .then(function () { if (S.tab === "publish" && S.model && !S.ui.busy) render(); });
  }
  function viewPublish() {
    var out = compute(), paths = Object.keys(out.files), bins = pendingPaths(), errors = safeValidate(S.model), n = changed().length;
    var can = (paths.length > 0 || bins.length > 0) && !out.error && !errors.length && !S.ui.busy;
    fetchLast();
    var box = el("div");
    if (S.ui.pub) {
      box.appendChild(el("p", { class: "msg " + S.ui.pub.kind, id: "pubMsg", role: "status", text: S.ui.pub.err ? errText(S.ui.pub.err) : t(S.ui.pub.key) }));
      if (S.ui.pub.stale) box.appendChild(btn(t("staleReload"), function () { signIn(S.token, S.remember); }, "primary", { id: "staleReload" }));
    }
    box.appendChild(el("h2", { text: t("pubWhat") }));
    if (out.error) box.appendChild(el("p", { class: "msg err", id: "buildErr", role: "alert", text: t("buildFail", { x: out.error }) }));
    if (errors.length) box.appendChild(el("ul", { class: "msg err", id: "validErr", role: "alert" }, errors.map(function (e) { return el("li", { text: e, dir: "auto" }); })));
    if (!paths.length && !bins.length && !out.error) box.appendChild(el("p", { class: "muted", id: "noChanges", text: n ? t("noFileChange") : t("noChanges") }));
    if (out.summary.length) box.appendChild(el("ul", { class: "sum", id: "summary" }, out.summary.map(function (s) { return el("li", { dir: "auto", text: s, "data-content": "" }); })));
    var warns = (S.readWarnings || []).concat(out.warnings);
    if (warns.length) box.appendChild(el("ul", { class: "msg warn", id: "warnings" }, warns.map(function (s) { return el("li", { dir: "auto", text: s, "data-content": "" }); })));
    if (paths.length) box.appendChild(el("details", { class: "files" }, [
      el("summary", { text: t("filesChanged", { n: paths.length }) }),
      el("ul", { id: "fileList", dir: "ltr" }, paths.map(function (p) { return el("li", { text: p, "data-content": "" }); }))
    ]));
    if (bins.length) box.appendChild(el("div", { class: "bins" }, [
      el("h3", { text: t("binPending", { n: bins.length }) }),
      el("ul", { class: "flist", id: "binList" }, bins.map(function (p) {
        return el("li", { "data-path": p }, [el("span", { class: "fname", dir: "ltr", text: p, "data-content": "" }), el("span", { class: "muted small", dir: "ltr", text: sizeText(S.pending[p].size) })]);
      }))
    ]));

    box.appendChild(el("h2", { text: t("preview") }));
    var isCv = S.ui.pv.page === "cv.html", isPf = S.ui.pv.page === "portfolio.html";
    box.appendChild(el("div", { class: "row" }, [
      seg([["index.html", t("pvHome")], ["publications.html", t("pvPubs")], ["cv.html", t("pvCv")]].concat(S.files["portfolio.html"] ? [["portfolio.html", t("pvPf")]] : []), S.ui.pv.page, function (v) { S.ui.pv.page = v; render(); }, "data-pv"),
      isCv ? cvModeSwitch() : isPf ? null : seg([["ar", t("pvAr")], ["en", t("pvEn")]], S.ui.pv.lang, function (v) { S.ui.pv.lang = v; render(); }, "data-pv"),
      isCv && cvHasArabic(out.files["cv.html"]) ? cvLangSwitch() : null
    ]));
    var doc = "";
    try { doc = previewHtml(out); } catch (e) { doc = ""; }
    if (isCv && !doc) box.appendChild(el("p", { class: "msg info", id: "cvEmpty", text: t("cvEmpty") }));
    else {
      var frame = el("iframe", { id: "preview", class: "preview", title: t("pvTitle"), sandbox: "", referrerpolicy: "no-referrer" });
      frame.srcdoc = doc;
      box.appendChild(frame);
      box.appendChild(el("p", { class: "muted small", text: t("pvStatic") }));
    }

    box.appendChild(el("h2", { text: t("tab_publish") }));
    if (S.ui.confirm === "publish" && can) {
      box.appendChild(el("div", { class: "card", id: "publishConfirm" }, [
        el("p", { text: t("pubAsk") }),
        el("div", { class: "row" }, [
          btn(t("pubYes"), function () { S.ui.confirm = ""; doPublish(); }, "primary big", { id: "publishYes" }),
          btn(t("cancel"), function () { S.ui.confirm = ""; render(); }, "ghost", { id: "publishNo" })
        ])
      ]));
    } else {
      box.appendChild(btn(t("pubBtn"), function () { S.ui.confirm = "publish"; render(); }, "primary big", { id: "publishBtn", disabled: !can }));
    }

    box.appendChild(el("h2", { text: t("undoTitle") }));
    var last = S.ui.last, isDash = !!(last && String(last.message).indexOf(GH.PREFIX) === 0);
    if (S.ui.lastState === "loading" || !last) {
      box.appendChild(el("p", { class: "muted small", id: "lastInfo", text: S.ui.lastState === "loading" ? t("lastLoading") : t("lastFail") }));
    } else {
      box.appendChild(el("p", { class: "muted small", id: "lastInfo" }, [
        el("span", { text: t("lastIs") }),
        el("bdi", { text: String(last.message).split("\n")[0], "data-content": "" }),
        last.date ? " · " : null,
        last.date ? el("bdi", { text: new Date(last.date).toLocaleString(locale()) }) : null
      ]));
    }
    if (isDash) box.appendChild(confirmBtn("undo", t("undoBtn"), t("undoYes"), doUndo, "danger", n ? t("undoNoteDraft") : t("undoNote")));
    else if (last) box.appendChild(el("p", { class: "muted small", id: "undoOff", text: t("undoOff") }));
    box.appendChild(versionsBox());
    return box;
  }

  /* ---------- approved versions (git tags; a restore is one new commit, history is never rewritten) ---------- */
  function loadVersions(force) {
    var v = S.ui.ver;
    if (!GH.listVersions || (v.state && !force)) return;
    v.state = "loading";
    GH.listVersions(S.token).then(function (list) { v.list = list || []; v.headTree = (list && list.headTree) || ""; v.state = "ok"; }, function () { v.list = []; v.state = "err"; })
      .then(function () { if (S.ui.ver === v && S.tab === "publish" && S.model && !S.ui.busy) render(); });
  }
  async function saveVersion() {
    var v = S.ui.ver, name = String(v.name || "").replace(/\s+/g, " ").trim().slice(0, 60);
    if (S.ui.busy) return;
    if (changed().length) { v.msg = { kind: "warn", key: "verPublishFirst" }; render(); return; }
    if (!name) { v.msg = { kind: "err", key: "verNameFirst" }; render(); return; }
    if (v.list.length >= (GH.MAX_VERSIONS || 20)) { v.msg = { kind: "warn", key: "verMax" }; render(); return; }
    S.ui.busy = t("verSaving"); v.msg = null; render();
    try {
      await GH.saveVersion(S.token, name, S.head);
      v.name = ""; v.msg = { kind: "ok", key: "verSaved" };
    } catch (e) { v.msg = { kind: "err", err: e }; }
    S.ui.busy = "";
    loadVersions(true); render();
  }
  async function restoreVersion(item) {
    var v = S.ui.ver;
    if (S.ui.busy) return;
    S.ui.busy = t("verRestoring"); S.ui.pub = null; v.msg = null; render();
    try {
      await GH.restoreVersion(S.token, item.tag, S.head);
      sdel("local", DRAFT_KEY);
      var got = await GH.load(S.token, L.FILES);
      S.ui.busy = ""; S.pending = {};
      setBase(got.files, got.head);
      S.ui.last = null; S.ui.lastState = ""; S.ui.dir = null; S.ui.dirState = ""; S.ui.uploaded = []; S.ui.photo = null;
      v.msg = { kind: "ok", key: "verRestored" };
    } catch (e) {
      S.ui.busy = "";
      v.msg = { kind: "err", err: e, stale: !!(e && e.code === "stale") };
    }
    loadVersions(true); render();
  }
  async function deleteVersion(item) {
    var v = S.ui.ver;
    if (S.ui.busy) return;
    S.ui.busy = t("verDeleting"); v.msg = null; render();
    try { await GH.deleteVersion(S.token, item.tag); v.msg = { kind: "ok", key: "verDeleted" }; }
    catch (e) { v.msg = { kind: "err", err: e }; }
    S.ui.busy = "";
    loadVersions(true); render();
  }
  function versionsBox() {
    var v = S.ui.ver, max = GH.MAX_VERSIONS || 20, n = changed().length;
    if (!GH.listVersions) return el("span");
    loadVersions(false);
    var kids = [el("h2", { text: t("verTitle") }), el("p", { class: "muted small", text: t("verHint") })];
    if (v.msg) {
      kids.push(el("p", { class: "msg " + v.msg.kind, id: "verMsg", role: "status", text: v.msg.err ? errText(v.msg.err) : t(v.msg.key) }));
      if (v.msg.stale) kids.push(btn(t("staleReload"), function () { signIn(S.token, S.remember); }, "primary", { id: "verStaleReload" }));
    }
    kids.push(el("div", { class: "card" }, [
      field(t("verName"), input(v.name, function (x) { v.name = x; }, { id: "verName", dir: "auto", maxlength: "60" })),
      btn(t("verSave"), saveVersion, "primary", { id: "verSave", disabled: !!S.ui.busy })
    ]));
    if (v.state === "loading" && !v.list.length) kids.push(el("p", { class: "muted small", id: "verLoading", text: t("verLoading") }));
    else if (v.state === "err") kids.push(el("p", { class: "msg err", id: "verFail", text: t("verFail") }));
    else if (!v.list.length) kids.push(el("p", { class: "muted small", id: "verNone", text: t("verNone") }));
    else {
      if (v.list.length > max) kids.push(el("p", { class: "msg warn", id: "verMore", text: t("verMore") }));
      kids.push(el("div", { class: "list", id: "verList" }, v.list.slice(0, max).map(function (it) {
        var isNow = !!(v.headTree && it.tree === v.headTree);
        var when = it.date ? new Date(it.date).toLocaleString(locale()) : "";
        return el("article", { class: "item ver", "data-tag": it.tag, "data-current": isNow ? "1" : "0" }, [
          el("div", { class: "item-h" }, [
            el("strong", { dir: "auto", text: it.name, "data-content": "" }),
            isNow ? el("span", { class: "tag ok", "data-now": "1", text: t("verCurrent") }) : null
          ]),
          el("p", { class: "muted small" }, [when ? el("bdi", { text: when }) : null, when ? " · " : null, el("bdi", { dir: "ltr", class: "mono", text: String(it.sha).slice(0, 7), "data-content": "" })]),
          el("div", { class: "row" }, [
            isNow ? null : confirmBtn("ver-restore-" + it.tag, t("verRestore"), t("verRestoreYes"), function () { restoreVersion(it); }, "ghost sm", n ? t("verRestoreNoteDraft") : t("verRestoreNote")),
            confirmBtn("ver-del-" + it.tag, t("verDelete"), t("verDeleteYes"), function () { deleteVersion(it); }, "danger sm", t("verDeleteNote"))
          ])
        ]);
      })));
    }
    return el("section", { id: "versions" }, kids);
  }

  /* ---------- start ---------- */
  function start() {
    lang = sget("local", LANG_KEY) === "en" ? "en" : "ar";
    applyLang();
    if (!L || !GH || !L.read || !L.build) {
      app.textContent = "";
      app.appendChild(el("p", { class: "msg err boot", role: "alert", text: t("bootFail") }));
      return;
    }
    var saved = sget("local", TOKEN_KEY), remember = true;
    if (!saved) { saved = sget("session", TOKEN_KEY); remember = false; }
    if (saved) { S.ui.busy = t("loadingFiles"); renderSign(); signIn(saved, remember); }
    else renderSign();
  }
  /* Read-only hook for the tests: the two dictionaries must have the same keys. */
  window.DashUI = { keys: { ar: Object.keys(I18N.ar), en: Object.keys(I18N.en) }, lang: function () { return lang; } };
  start();
})();
