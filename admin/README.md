# Site dashboard (`/admin/`)

Private control panel for the owner of https://dromaia.github.io/ — open https://dromaia.github.io/admin/.

- Sign in with a GitHub fine-grained token (Repository: `DrOmaia.github.io`, Permissions → Contents: Read and write).
  The token stays in the browser and is sent only to `api.github.com`.
- Tabs: publications (with DOI lookup), numbers and news, committees and roles, any page text, fonts, publish.
- Every publish is one commit on `main` whose message starts with `Dashboard:`; "undo" adds a commit that restores
  the previous state. The site updates about a minute later.
- The page edits the site files themselves (see the `dash:*` markers in `index.html` / `publications.html`), so
  edits made by hand or by other tools stay in sync. Contract and design notes: [`SPEC.md`](SPEC.md).
- Not covered yet: the two PDF files (CV and research portfolio). Rebuild them with `tools/build-portfolio.py` and
  `tools/cv-source.html`.

Tests: `node admin/tests/lib.test.js` and `python3 admin/tests/ui_test.py` (Playwright + Chromium, fake GitHub API).
After changing a file here, bump the cache tag `?v=YYYYMMDDx` in `admin/index.html`.
