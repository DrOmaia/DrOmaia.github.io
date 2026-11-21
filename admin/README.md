# Site dashboard (`/admin/`)

Private control panel for the owner of https://dromaia.github.io/ — open https://dromaia.github.io/admin/.

- Sign in with a GitHub fine-grained token (Repository: `DrOmaia.github.io`, Permissions → Contents: Read and write).
  The token stays in the browser and is sent only to `api.github.com`.
- Interface in Arabic or English. Tabs: publications (DOI lookup, one-button citation refresh), numbers and news,
  sections (show / hide / reorder, the owner's own sections, courses, career timeline, committees and roles), any page
  text, appearance (20 Arabic / 13 English / 6 heading fonts, six palettes, custom colours with a contrast check,
  portrait upload), CV (owner blocks, import of an existing CV file as PDF or DOCX, preview), import of the ChatGPT
  achievements result, files (upload to `files/`), AI helper (the guide prompt in `ai-guide.md`), publish.
- Every publish is one commit on `main` whose message starts with `Dashboard:`; "undo" adds a commit that restores
  the previous state. **Approved versions** are annotated git tags `stable-YYYYMMDD-HHMMSS` (name = tag message);
  restoring one adds a commit with that version's tree. The site updates about a minute after any of these.
- `cv.html` is the live CV (short and full versions: `cv.html` and `cv.html#full`), rebuilt on every publish from the
  same data by `cv.js`; blocks are marked `<!-- cv:NAME -->`.
- The page edits the site files themselves (see the `dash:*` markers in `index.html` / `publications.html`), so
  edits made by hand or by other tools stay in sync. Contract and design notes: [`SPEC.md`](SPEC.md).
- Modules: `lib.js` (all page rewriting, no DOM), `cv.js` (CV page), `cvimport.js` (reads PDF / DOCX in the browser;
  pdf.js 3.11.174 vendored in `vendor/pdfjs/`, loaded only when a PDF is read), `github.js` (`GH.load`, `commit` with
  text and binary files, `lastCommit`, `undo`, `listDir`, `listVersions`, `saveVersion`, `restoreVersion`,
  `deleteVersion`), `app.js` (interface).
- The two PDF files in the repository root (old CV and research portfolio) are not rebuilt by the dashboard.

Tests: `node admin/tests/lib.test.js`, `node admin/tests/cv.test.js`, `python3 admin/tests/ui_test.py` and
`python3 admin/tests/cvimport_test.py` (Playwright + Chromium, fake GitHub API).
After changing a file here, bump the cache tag `?v=YYYYMMDDx` in `admin/index.html`.
