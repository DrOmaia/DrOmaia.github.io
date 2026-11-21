# Site dashboard (`/admin/`) – contract between the library and the interface

Private control panel for https://dromaia.github.io/. Browser-only, no build step, no CDN, no frameworks.
The owner signs in with his own GitHub fine-grained token (kept in his browser only); the page reads the site
files from the repository, lets him edit, shows a preview, and publishes one commit to `main`.
Source of truth = the site files themselves (no separate database), so edits made by hand stay in sync.

## Files
| File | Owner | What |
| --- | --- | --- |
| `admin/lib.js` | library | Pure functions, no DOM, no network. `window.DashLib` in the browser, `module.exports` in Node. |
| `admin/tests/lib.test.js` | library | Node tests (`node admin/tests/lib.test.js`). |
| `admin/index.html`, `admin/app.js`, `admin/github.js`, `admin/admin.css` | interface | UI (Arabic, RTL, phone first), GitHub API, Crossref lookup. |
| `admin/tests/ui_test.py` | interface | Playwright test with a mocked GitHub API. |

## Markers in the site files (already in place)
- `index.html` and `publications.html` `<head>`: `<!-- dash:fonts -->` … `<!-- /dash:fonts -->` (one `<link>` to Google Fonts
  + `<style>:root{--font-en:"…";--font-ar:"…";}</style>`).
- `index.html`: `<!-- dash:metrics -->` (the tiles), `<!-- dash:news -->` (the `<li>` lines), `<!-- dash:roles -->`
  (`<article class="society-item">` lines), `<!-- dash:themes -->` (theme strip `<li>`), `<!-- metrics:latest -->`
  (latest works, same markup as `tools/refresh_metrics.py: latest_markup`).
- `publications.html`: `<!-- dash:cards -->` (all cards, newest id first), `<!-- dash:years -->` (year `<option>`s),
  `<strong data-count="works|journal|conference|chapter">`, one JSON-LD `ItemList`.
Every block has a closing `<!-- /dash:NAME -->`. Line formats inside blocks must be reproduced exactly (see the files).

## Library API
```js
DashLib.FILES   // paths read: index.html, publications.html, research-data.js, data/metrics.json, sitemap.xml
DashLib.THEMES  // [{en, ar}] the six themes;  DashLib.TYPES // [{en, ar}] Journal article / Conference paper / Book chapter
DashLib.FONTS   // {ar:[{name, weights}], en:[{name, weights}]}
model = DashLib.read(files)            // files: {path: text}
// model = { works:[{id,title,year,type,theme,methods:[],contribution,reference,doi,verificationNote}],
//           metrics:[{value,en,ar,href,auto}]   (auto:'works' = value follows the number of works),
//           news:[{year,en,ar}], roles:[{org,orgAr,en,ar}], fonts:{ar,en},
//           texts:[{id,page,en,ar}]   (every other text-only element that has data-ar; id is stable for this load) }
out = DashLib.build(files, model, {today:'YYYY-MM-DD'})
// out = { files:{path:text}  only files whose content changed (incl. ar/index.html, ar/publications.html),
//         warnings:[arabic strings], summary:[arabic strings, one per kind of change] }
DashLib.validate(model)                // [arabic error strings]; empty = ok
DashLib.nextId(works)                  // 'P41'
DashLib.fromCrossref(message)          // Crossref "message" object -> partial work {title,year,type,reference,doi}
DashLib.buildArabic(page, html)        // port of tools/build-arabic.py, byte-identical output
```
`build` with an unchanged model must return `files: {}` (round trip is the main test).
What `build` regenerates when works change: `research-data.js` (works, meta.total, cutoff = today), the cards block,
year options, data-count numbers, JSON-LD list, count phrases (EN + `data-ar`) in both pages, cutoff phrases, theme
strip numbers, latest block + `data/metrics.json` (`latest`, `works_verified`), "Profile last updated" month,
JSON-LD `dateModified`, `sitemap.xml` lastmod, then both Arabic pages.
All user text is HTML-escaped on write and unescaped on read.

Notes from the implementation (additions, nothing above changed):
- `model.warnings` (Arabic) lists what `read` could not find (missing file or marker); `texts[]` items also carry `tag`.
- A work may carry an optional `venue` (shown in the latest block; `fromCrossref` returns it too). It is stored in
  `research-data.js` only when given. `doi` may be typed bare (`10.x/…`), as `doi:…` or as a link: `build` stores
  `https://doi.org/…` (`DashLib.normalizeDoi`). Another address (a publisher PDF) is kept and shown as a plain link.
- `FONTS` weights are arrays of numbers (`[400, 600, 700]`). `DashLib.counts(works)` gives the totals `build` uses.
- Cards: a work that did not change keeps its existing card markup byte for byte; only new or edited works are
  rendered from the template (35 of the 40 hand-checked cards equal the template exactly; the rest differ by layout or
  by a note that lives only in the page). Citation text comes from `data/metrics.json` (`per_work`); a DOI with no row
  there shows "Cited by 0 · Crossref".
- Dates (cutoff phrases, "Profile last updated", JSON-LD `dateModified`, `sitemap.xml`) move only when works change.
  Count phrases and numbers are matched with `\d+`, so a page that is out of step with the catalogue is repaired by the
  next build; a phrase or marker that is not found gives an Arabic warning, never an exception.
- `research-assistant.js` no longer holds numbers: it computes them from `window.RESEARCH_PORTFOLIO` at run time.

## Interface
Tabs: الأبحاث · الأرقام والمستجدات · اللجان والأدوار · النصوص · المظهر · النشر.
Repository `DrOmaia/DrOmaia.github.io`, branch `main`. Token: `localStorage['dash.token']` (or session only).
Draft kept in `localStorage['dash.draft']`. Publish = Git Data API (tree → commit → update ref), message starts with
`Dashboard:`. Undo = new commit restoring the tree of the commit before the last `Dashboard:` commit (only if it is HEAD).
Preview = iframe `srcdoc` of the built page with `<base href="https://dromaia.github.io/">`.

---

# Version 2 (contract for the three agents)

Owner's decisions: dashboard in Arabic and English; more fonts; colour palettes + custom colours; show / hide /
reorder the home-page sections, edit the items inside them, and add his own sections; every change is reflected in a
**live CV page** (`cv.html`, with a "Save as PDF" button); refresh citations with one button; import the result of
his ChatGPT achievements prompt; upload a new portrait and files; a tab with a prompt that explains the site to any AI tool.

## New markers (already in the site files)
- `index.html`: `<!-- dash:section ID -->` … `<!-- /dash:section ID -->` around each `<section id="ID">` after the hero
  (leadership, research, teaching, experience, contact); `<!-- dash:nav -->` (the six nav links, one per line);
  `<!-- dash:courses-flagship -->`, `<!-- dash:courses -->`, `<!-- dash:timeline -->`, `<!-- dash:timeline-earlier -->`.
- Both pages `<head>`: fonts block now `:root{--font-en:"…";--font-ar:"…";--font-head-en:"…";}` (Georgia and other
  system fonts are not requested from Google Fonts), followed by `<!-- dash:theme -->` holding one `<style>`; empty = the
  default calm palette. Overrides are written as `html:root[data-theme="light"]{…}` and `html:root[data-theme="dark"]{…}`.
  Variable names differ per page: index.html uses `--bg --surface --surface2 --text --muted --line --gold --blue --green`;
  publications.css uses `--bg --surface --surface-2 --text --muted --line --accent --accent-strong --amber --blue`.
  Write both sets in the block so one block text serves both pages.
- CV links in index.html now point to `cv.html` (`data-ar-href="../cv.html"`).
- Portrait: `PhotoDrOmaia.webp` (1127×1396) in `<img id="portraitImage">` and one `<link rel="preload">`; after an upload
  add or bump a `?v=YYYYMMDDHHMM` on both.

## Library (admin/lib.js) – additions
```js
DashLib.setLang('ar' | 'en')         // language of warnings / summary / validate messages (default 'ar')
DashLib.FILES                        // + 'cv.html'
DashLib.FONTS                        // {ar:[…16+], en:[…12+], head:[…]} each {name, weights, system?:true}
DashLib.PALETTES                     // [{id, ar, en, light:{bg,surface,surface2,text,muted,line,accent,link,green}, dark:{…}}]  six calm presets; id 'default' = empty block
DashLib.contrast(hexA, hexB)         // WCAG ratio (number)
// model additions (read) and their handling (build):
model.fonts      = {ar, en, head}
model.theme      = {palette:'default'|id|'custom', light:{bg,surface,text,accent,link}, dark:{…}}   // custom: owner's colours; the rest is derived
model.sections   = [{id, title:{en,ar}, hidden:boolean, custom:boolean,
                     // custom sections only:
                     kicker:{en,ar}, intro:{en,ar}, cards:[{title:{en,ar}, text:{en,ar}, link}]}]   // order = page order; hero and footer are fixed
model.nav        = [{href, en, ar, hidden}]      // follows sections: hidden section => its link hidden; custom section => link added
model.flagship   = [{code, en, ar}];  model.courses = [{code, en, ar}]
model.timeline   = [{time, title:{en,ar}, text:{en,ar}}];  model.timelineEarlier = same shape
model.photoVersion = '' | 'YYYYMMDDHHMM'         // set by the UI after a portrait upload
model.citations  = {doi(lowercase): number}      // from data/metrics.json per_work; the UI may replace values, build writes them
                                                 // into metrics.json and into the cite span of every card (unchanged cards included)
model.cv         = see "CV module"
DashLib.parseAchievements(text)      // the ChatGPT "ITEM n" format -> [{n, category, titleEn, titleAr, organisation, role, date, year, link, suggest, why}] + {askMe:[], numbers:[]}
```
Hidden section = the `hidden` attribute on its `<section>` and on its nav link (never delete its markup).
Custom sections are rendered entirely by the library inside their own `dash:section custom-N` markers using the existing
classes (`wrap`, `section-head`, `kicker`, `grid3`, `card`) so they can be parsed back; Arabic via `data-ar`.
Round trip on the current files must still return `files: {}`.

**Library notes (as built; nothing in the contract above changed, these fill its gaps):**
- `FONTS.head` ends with `{name:"body", system:true, same:true, label:{ar,en}}` = "same as the body text"
  (`--font-head-en` then carries the English font). `fonts.head` missing in an old draft = keep the current one.
- `model.theme` on read always carries the five main colours of both modes (of the palette in use), so a custom edit can
  start from them. Custom: a `dark` equal to the site's own dark colours, or left out, writes no dark rule.
  `DashLib.themeWarnings(theme)` gives the contrast warnings for a live preview; `build` adds them when the theme changes.
- Sections: a custom section may come without `id` (the library assigns `custom-N`; `DashLib.nextSectionId(sections)`).
  Leaving a custom section out of `model.sections` deletes it; a built-in one left out is kept. `model.nav[i].hidden` means
  "hide this link although its section shows"; link text of a built-in section = its nav item (or a changed `section.title`).
  Card `link`: `https://…`, a relative path such as `files/x.pdf`, `#id` or `mailto:`; other schemes are refused.
- Also read (read-only helpers): `model.degrees = [{year,title,institution}]`, `model.theses = [text]`.
- `model.citations` has one entry per work with a DOI (0 when unknown). Changed numbers are written as Crossref counts;
  `data/metrics.json` Crossref totals and `checked` are recomputed.
- `parseAchievements` returns the array of items; the same array carries `.items`, `.askMe`, `.numbers`, `.total`.
  Each item also has `evidence`, `confidence` and `suggestKind` (`website | cv | both | skip | ""`).
- CV module: `DashCV.build(model, cvHtml, {today, lang})` gets the model re-read from the files as they will be after
  the build (plus `model.cv` from the dashboard and `model.today`). No `cv.html` among the files, or no module: skipped.
- Optional: if `publications.html` gets a `<!-- dash:nav -->` block (one link per line), its links follow the home page
  as `index.html#id`. Today it has none, so its header links do not change when sections are hidden or added.

## CV module (admin/cv.js, `window.DashCV` / module.exports) – owned by the CV agent
```js
DashCV.read(cvHtml)  -> model.cv = { profile:{en}, pillars:[{title, text}], accepted:[{year, text}], selected:number (how many newest works to list, default 17),
                                     community:[{title, text}], development:[{title, text}], languages, openTo, extraService:[{title, org, date, text}] }
DashCV.build(model, cvHtml) -> new cv.html text   // called by DashLib.build; must be byte-identical when nothing changed
```
`cv.html` (repository root) is a normal web page in the site's calm style, English, A4/Letter print stylesheet, a
"Save as PDF" button (`window.print()`), `noindex` off (it is public). It contains `<!-- cv:NAME -->` blocks:
- auto blocks, rebuilt on every publish from the rest of the model: `cv:header` (name, titles, links), `cv:appointments`
  (from model.timeline + timelineEarlier), `cv:education` (degree cards + theses read from index.html), `cv:publications`
  (the newest `selected` works: authors/title/venue from each work's APA reference, DOI link), `cv:teaching` (courses),
  `cv:service` (model.roles + extraService), `cv:updated` (month and year of the build);
- owner blocks, edited in the dashboard and kept as they are otherwise: `cv:profile`, `cv:pillars`, `cv:accepted`,
  `cv:community`, `cv:development`, `cv:languages`.
Initial content: everything now in `tools/cv-source.html` (the current three-page CV).

## Interface – additions
- Language switch (العربية / English) for the whole dashboard, remembered in localStorage; RTL/LTR flips.
- Tabs: الأبحاث · الأرقام والمستجدات · الأقسام (sections: show/hide/reorder/custom; inside it the lists: courses,
  flagship courses, career timeline, earlier roles, committees and roles) · النصوص · المظهر (fonts incl. heading font,
  palettes, custom colours with contrast warning, portrait upload) · السيرة (owner blocks of the CV + preview of cv.html) ·
  استيراد (paste the ChatGPT result → accept each item as a news line, a role, a CV service entry, or skip) ·
  الملفات (upload PDF/images to `files/`, copy link) · مساعد AI (the guide prompt from `admin/ai-guide.md`, copy button) · النشر.
- Citations: a button in الأبحاث that reads `is-referenced-by-count` from Crossref for every DOI (sequential, progress,
  tolerant of failures) and stores the numbers in `model.citations`.
- Binary uploads: `GH.commit` accepts `{path: {base64}}` entries next to text entries (blob API, then tree by sha).
  Portrait: chosen image is centre-cropped to 1127:1396, scaled to 1127×1396, encoded as WebP in the browser, shown
  for confirmation, published as `PhotoDrOmaia.webp`. Files: max 5 MB each, safe ASCII file names.
