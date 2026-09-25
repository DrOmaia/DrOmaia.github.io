# dromaia.github.io

Personal academic website of Dr. Omaia Al-Omari — https://dromaia.github.io/

## Pages

| URL | File | Notes |
| --- | --- | --- |
| `/` | `index.html` | English home page (single page: education, research, teaching, experience, service, contact) |
| `/ar/` | `ar/index.html` | Arabic home page — **generated**, do not edit by hand |
| `/publications.html` | `publications.html` | Searchable catalogue of the 37 verified works |
| `/ar/publications.html` | `ar/publications.html` | Arabic catalogue — **generated**, do not edit by hand |

Shared files: `site.js` (theme, language link, mobile menu), `research-data.js` (the publication records used by the
Research Assistant), `research-assistant.js/.css` (the on-page assistant), `publications.js/.css`, the two PDFs, and the
images/icons. `/sat/` and `/isp/` are separate tools kept out of search engines with `noindex`.

## How the two languages work

The English files are the source of truth. Arabic text lives next to the English text as attributes:

```html
<h2 data-ar="أساس أكاديمي بُني بالبحث والاستقصاء.">An academic foundation built through inquiry.</h2>
<meta name="description" content="Academic portfolio…" data-ar-content="الملف الأكاديمي…">
```

* `data-ar="…"` — Arabic for the element's text.
* `data-ar-<attribute>="…"` — Arabic value for an attribute (`aria-label`, `content`, `href`, `placeholder`, `alt`, …).

After editing `index.html` or `publications.html`, regenerate the Arabic pages:

```bash
python3 tools/build-arabic.py
```

The script needs only Python 3. It rewrites `ar/index.html` and `ar/publications.html`, fixes asset paths, and points the
canonical/structured-data URLs at the Arabic addresses. Commit the regenerated files together with your change.

Visitors whose browser language is Arabic are sent to `/ar/` on their first visit; the language button remembers the
choice. Search engines see both versions through `hreflang` links and `sitemap.xml`.

## Updating content checklist

1. Edit the English file (and its `data-ar` text).
2. Run `python3 tools/build-arabic.py`.
3. If publications changed, update `research-data.js` and the matching card in `publications.html`.
4. Update `lastmod` in `sitemap.xml` and the "Profile last updated" line in the footer.
5. Commit to `main`; GitHub Pages republishes automatically.

Preview locally with any static server from the repository root, for example `python3 -m http.server 8000`, then open
http://localhost:8000/ (the language links use root-relative paths, so open the site through a server rather than as a file).
