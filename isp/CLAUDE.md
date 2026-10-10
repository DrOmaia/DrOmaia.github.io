# Instructions for anyone (AI or human) changing `/isp/`

Read [`README.md`](README.md) first: what the tool does, the business rules, the data model and where each thing
lives in the code. History of changes and decisions: [`CHANGELOG.md`](CHANGELOG.md).

## Who asks and how
- The user is the department Chair. She writes in Arabic; answer in Arabic, short and clear.
- When a request is ambiguous or changes a rule, **ask first** (short multiple-choice questions), then build.
- Keep it simple: no extra text, no new concepts beyond what was asked. Less clutter is a goal.

## Hard rules
1. **Plain static site**: no build step, no frameworks, no server. Scripts load in `index.html`; keep working from
   GitHub Pages. Do not touch `vendor/`.
2. **Bump the cache tag** in `index.html` (`?v=YYYYMMDDx`, all six links) on every change, or users get old files.
3. **Arabic and English in parity**: every text lives in `i18n.js` under the same key in `ar` and `en`; the English UI
   contains no Arabic. File contents (Excel, email) are English only.
4. **One rule check for every path**: any new way to move a section must go through `dropCheck()` / `timeOk()`
   (no clash, member hours, strict count, locked members). Never let a member get two sections at the same time.
5. **Male and Female share all code.** A change for one side applies to both unless the user says otherwise
   (today only titles and the email wrapper differ).
6. **No real data in the repository** (names of real staff timetables, official files). Tests use synthetic files
   made by `tests/make_data*.js`.
7. Old project / settings files must keep opening: upgrade them in `normalize()` / `applySettings()`.
8. Excel formulas must stay valid: after changing `export.js`, run `tests/14_excel.js` and `tests/recalc.py`
   (LibreOffice) — expect `formula errors: 0`.

## Checklist for a change
1. Edit the code (`engine.js` rules · `app.js` interface · `export.js` Excel · `i18n.js` texts · `styles.css`).
2. `node --check isp/*.js`; check `ar`/`en` keys match.
3. Bump the cache tag.
4. Test in Chromium: `NODE_PATH=$(npm root -g) isp/tests/run_all.sh` (serve the repo on port 8099 first);
   add or update a test in `isp/tests/` for the new behaviour.
5. Commit with a clear message (what changed for the user), push to the working branch and to `main` to publish.
6. Add a numbered entry to `CHANGELOG.md` (with the cache tag letter), and update `README.md` if a rule changed.
