# Dr. Omaia Al-Omari Academic Website — Deployment Guide

Target website: <https://dromaia.github.io/>

## Publish through the GitHub website

1. Download and extract `dromaia-complete-website.zip`.
2. Open the GitHub repository named `DrOmaia.github.io`.
3. Open the `Code` tab.
4. Remove the old website files only after confirming that you are inside the
   correct repository.
5. Select **Add file → Upload files**.
6. Upload the extracted files themselves to the repository root. Do not upload
   the ZIP file as one item and do not place the files inside an extra folder.
   `index.html` must appear at the top level of the repository.
7. Use this commit message:

   `Add verified publications page and research assistant`

8. Select **Commit changes**.
9. Open **Settings → Pages**.
10. Under **Build and deployment**, select:
    - Source: **Deploy from a branch**
    - Branch: **main**
    - Folder: **/(root)**
11. Select **Save**.
12. Wait for GitHub Pages to finish publishing, then open
    <https://dromaia.github.io/>.
13. Confirm that these addresses work:
    - Home: <https://dromaia.github.io/>
    - Publications: <https://dromaia.github.io/publications.html>
    - Sitemap: <https://dromaia.github.io/sitemap.xml>
    - Research PDF:
      <https://dromaia.github.io/Dr-Omaia-Al-Omari-Verified-Research-Portfolio-2011-2026.pdf>

GitHub's official instructions:

- [Adding files to a repository](https://docs.github.com/en/repositories/working-with-files/managing-files/adding-a-file-to-a-repository)
- [Configuring the publishing source for GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
- [What is GitHub Pages?](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)

## Important publication safeguards

- Keep `Dr-Omaia-Al-Omari-Verified-Research-Portfolio-2011-2026.pdf` public.
- Do not upload the source Word manuscript.
- Do not remove the verification warnings attached to records P01, P03, and
  P05.
- The portfolio is a curated website reference edition verified through
  24 July 2026. It is not presented as a peer-reviewed or published synthesis
  manuscript.

## Updating the website later

Replace only the files that changed, then commit the update to `main`. GitHub
Pages republishes changes made to the configured source branch and folder.
