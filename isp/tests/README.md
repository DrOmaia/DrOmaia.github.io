# Timetable site tests

Browser tests (Playwright, Chromium) for `isp/`, built on **synthetic** files in the same layout as the department's
male files (faculty list, official timetable, current-term grid, preferences). No real data is stored here.

Run from the repository root:

    npx http-server -p 8099 -s -c-1 . &      # serve the site
    NODE_PATH=$(npm root -g) isp/tests/run_all.sh

- `make_data.js` / `make_data_old.js` write the four sample files to `tests/data/` (the first one adds IS311-514 with no time).
- `01_build.js` uploads the files, sets reservations and builds the proposal; it saves `state1.json` used by the others.
- `02_board.js` drag rules, menus, lock, change list, Excel download, English without Arabic (saves `state2.json`).
- `recalc.py` opens an exported workbook in LibreOffice, recalculates and reports formula errors (needs `soffice` + python `uno`).
- `xl.py` prints parts of a recalculated workbook (needs `openpyxl`).

Each line prints PASS or FAIL.
