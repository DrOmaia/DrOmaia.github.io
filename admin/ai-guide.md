You are helping Dr. Omaia Al-Omari maintain his personal academic website.

SITE
- Live: https://dromaia.github.io/  ·  Repository: github.com/DrOmaia/DrOmaia.github.io  ·  Branch: main
- Plain static site on GitHub Pages: no build step, no framework, no server. A push to main is live in about a minute.
- Owner writes in Arabic; answer in Arabic, short and clear. Ask before any change he did not request.

PAGES
- index.html          English home page (hero, leadership, research, teaching, career, contact). Source of truth.
- publications.html   Searchable catalogue of verified works (one card per work).
- ar/index.html, ar/publications.html   Arabic pages. GENERATED: never edit by hand.
- cv.html             Live CV page built from the same data (has a "Save as PDF" button).
- research-data.js    The publication records (window.RESEARCH_PORTFOLIO): id, title, year, type, theme, methods,
                      contribution, APA reference, doi, verificationNote.
- data/metrics.json   Citation numbers per work and the "latest works" list.
- admin/              The owner's dashboard (browser-only). lib.js = all page-rewriting logic, cv.js = CV page,
                      app.js = interface, github.js = publishing. Contract: admin/SPEC.md.
- /isp/, /sat/, /tv/, /pr/, /mani/, /ipcam/, /residency/   Separate tools. Do not touch them unless asked.
  /isp/ has its own strict rules in isp/CLAUDE.md.

HOW TEXT AND ARABIC WORK
- Every English element carries its Arabic next to it:  <h2 data-ar="نص عربي">English text</h2>
  and attributes as data-ar-<attribute>="…" (content, aria-label, href, alt…).
- After editing index.html or publications.html run:  python3 tools/build-arabic.py   and commit the ar/ files too.

BLOCKS THE DASHBOARD REWRITES (keep the markers and the exact line format inside them)
- <!-- dash:NAME --> … <!-- /dash:NAME -->  in index.html / publications.html:
  fonts, theme, metrics, news, roles, themes, nav, section ID, courses-flagship, courses, timeline, timeline-earlier,
  cards, years; plus <!-- metrics:latest --> and <!-- cv:NAME --> blocks in cv.html.
- If you edit inside a block, keep one item per line exactly like the existing lines, or the dashboard will not read it.

ADDING A PUBLICATION BY HAND (the dashboard does all of this automatically)
1. Add the record to research-data.js (next id P41, P42…), update meta.total and the verification cutoff.
2. Add the matching card at the top of the dash:cards block in publications.html and the JSON-LD list item.
3. Update the counts (works, journal/conference/chapter numbers, "N verified works" phrases in both pages).
4. python3 tools/refresh_metrics.py --inject ; python3 tools/build-arabic.py
5. Only verified, published works with a DOI or a publisher page. Accepted-but-unpublished work goes to the CV only.

RULES
- Never invent facts, numbers, dates, DOIs or roles. Verify a publication on the publisher page or Crossref first.
- Nothing confidential or personal about other people; no student names.
- Keep English and Arabic in step. Keep the calm design (colours and fonts are variables in the dash:fonts / dash:theme
  blocks; do not hard-code new colours).
- Do not add external scripts, trackers or CDNs. Do not edit ar/ pages, vendor/ folders, or the PDF files by hand.
- Test before pushing:  node admin/tests/lib.test.js   and   python3 admin/tests/ui_test.py
  (the first must report that an unchanged site round-trips with no changed files).
- Commit messages: one clear English line saying what changed for the visitor. Commits made by the dashboard start
  with "Dashboard:"; do not rewrite history.

WHEN ASKED TO CHANGE SOMETHING
1. Read the relevant file and admin/SPEC.md.   2. Make the smallest change that does it.
3. Rebuild the Arabic pages, run the tests.     4. Show the owner what will change, then push to main.
