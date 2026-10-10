#!/bin/sh
# Runs every browser test against a local copy of the site (synthetic files only, no real data).
# Needs: node + playwright (NODE_PATH pointing to it), and the site served at http://127.0.0.1:8099/
#   from the repository root:  npx http-server -p 8099 -s -c-1 .
cd "$(dirname "$0")" || exit 1
set -e
echo "== original sample data (53 rows)"; node make_data_old.js
node 01_build.js | grep -E "errors|cut"
node 02_board.js | grep -E "^(PASS|FAIL)"
node 03_old_project_phone.js
node 06_hold_add.js | grep -E "^(PASS|FAIL)"
node 09_course_warning.js | grep -E "^(PASS|FAIL)"
node 11_email.js | grep -E "^(PASS|FAIL)"
node 12_time_requests_card.js
node 13_print.js
node 14_excel.js && python3 recalc.py "$PWD/outx.xlsx" "$PWD/outx_recalc.xlsx"
node 17_phone_taps.js | grep -E "^(PASS|FAIL)"
node 16_grad.js | grep -E "^(PASS|FAIL)"
node 15_female.js && python3 recalc.py "$PWD/female.xlsx" "$PWD/female_recalc.xlsx"
echo "== sample data with a section that has no official time (IS311-514)"; node make_data.js
node 01_build.js | grep -E "errors|cut"
node 05_no_time_section.js | grep -E "^(PASS|FAIL)"
node 07_change_lines.js | grep -E "^(PASS|FAIL)"
node 10_settings_and_changes.js | grep -E "^(PASS|FAIL)"
