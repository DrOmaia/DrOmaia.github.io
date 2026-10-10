# Changelog — IS Teaching Timetable (`/isp/`)

Letters in brackets are the cache tag suffix (`?v=20261010x`) of the release that shipped the change.

## 10 Oct 2026 — 10 approved changes (cache tag ?v=20261010b)

1. **Reserve a course/section** — Settings → member → Edit limits → Courses → "Teaches only": each course gets a time dropdown.
   "Any time" = at least one section of that course (hard in the proposal); a chosen section = reserved for that member
   (hard pin, 🔒 on the cell, never moved by "Propose again"). Same course can be added twice. Stored as `member.res[]`
   (parallel to `member.allowed[]`). Moving a reserved section away by hand resets that entry to "Any time".
2. **Section list follows the member's hours** — only sections inside First/Last class; preferred time first; reserved for
   others / clashing with his other reservations greyed last with the reason; "outside his hours" warning in red.
3. **Cell labels** — line 1 `IS201-498 (L)`, line 2 `IS201-499 (T)` / `(Lab)`; untimed courses show the plain key (as Excel).
4. **No time cell** — any number of untimed sections; dropping there always adds, never swaps.
5. **Untimed courses** (IS492, IS499, …) default to "does not count as a section", 0 load hours. Checkbox in Settings → Courses kept.
6. **Strict maximum** — proposal (`caps` in `engine.propose`) and drag never exceed the required number (MSc/PhD inside it).
   No number / part-timers: no limit. "Not assigned" row at the top (id `NA`) replaces the Bench. Excel: "Not assigned"
   block at the top, outside the `Grid` name; status "Unassigned"; choosing the section in a member's cell assigns it
   (the leftover in the block turns grey/struck through).
7. **Change list for Admissions & Registration** — Download page, next to Save project: numbered lines + Copy.
   Baseline = last "Sent to registration" snapshot (`S.sent`, saved in the project file); before the first press, the
   instructor names in the official file. Net result; moves to Not assigned / part-timers not listed
   (later: baseline = first version, see 16; ON-HOLD now listed, see 23; email text, see 18).
   Format: `1- Please reassign IS201 at 11am sections 1465/1466 to Dr. X`; untimed: `IS492 section 546`.
8. **No clashes from any path** — drag, click menu, attention-list assign, time change, back to saved place all use the
   same check (`dropCheck` / `timeOk`). Section menu: To Not assigned · Change time (free, allowed hours only) · Back to
   saved place. Empty cell: only legal sections, else "No section can go here".
9. **ON-HOLD row** always visible at the bottom; Excel grid / check table / Is Reg write ON-HOLD as the instructor.
10. **🔒 Lock** replaces Final / Reject / Review; locked member is out of the game (no drag from/to, no swaps, never ★,
    untouched by Propose again). Old files: "final" → locked; "reject"/"review" dropped. Alternatives feature removed.

Tested in Chromium (Playwright) with synthetic files in the same layout as the male files, Arabic and English;
Excel recalculated in LibreOffice: 0 formula errors, ON-HOLD in Is Reg, assigning from the Not assigned block updates
the check table and Is Reg.

## 10 Oct 2026 — follow-up changes (cache tags ?v=20261010c … k)

11. **Sections with no time in the official file** (course has timed sections, e.g. IS311-514) — free to move to any hour
    column and any row (member, Not assigned, ON-HOLD); the empty-cell menu offers them at any hour. A member always needs
    an hour (never his No time cell); Not assigned / ON-HOLD may keep "No time". Marked "request to set this time" in the
    Time requests list, the Excel Time requests sheet and the Is Reg note. (c)
12. **ON-HOLD and Not assigned rows** take any number of sections at the same hour; dropping there always adds, never swaps.
    Dropping an ON-HOLD (or part-timer) section on a member's section: it goes to the member, his section goes to Not assigned. (d, f)
13. **Change list lines for no-time sections**: "Please set IS311 section 514 at 8am and assign to Dr. X",
    "Please set … at 8am" (no member), "Please put … ON HOLD". "Sent to registration" also stores these times / ON HOLD states. (e)
14. **Course limits on moves by hand**: "Teaches only" / "Never assign" no longer block a drag or menu move — allowed with an
    orange warning ("outside his allowed courses"); never ★ best fit. The proposal still follows the limits. (f)
15. **Settings file** — "Save settings" / "Open saved settings" (Settings page and Start page): members' numbers, COOP /
    Senior, preferred time, first/last class, Teaches only + reserved sections, Never assign, keep current courses, survey
    wishes, Courses tab, MSc/PhD. Opening it in a new project: its values win over Total Sections; members matched by name
    (unmatched names listed); reserved sections not in the new official file go back to "Any time". File: `<side term> - settings.json` (app `isp-settings`). (g)
16. **Change list on the Proposal page** (under the timetable) + button "✉ Changes for registration (n)". Baseline = the first
    version she starts from (taken automatically; older projects: their last saved places) until "Sent to registration";
    net result only (moves that come back show nothing); lines wrap. (g)
17. **Clean print** of the Proposal page for presenting: title "IS Department – Male/Female Teaching Timetable – Term …";
    no legend, How to play, buttons, lock / ★ / pin / new / moved marks, proposed / conflict borders, wishes or change list;
    A4 landscape, fits in Arabic and English (printed page is left-to-right). (h)
18. **Email text** in the change box and Copy: Male "Dear Mr. Rev, … Regards, Dr. Omaia Al-Omari, Chair, Information
    Systems Department"; Female "Dear Ms. Deem, … Regards,". Intro: "We have some changes in our course assignment as the
    following, kindly implement it in the system and notify us:". Copy = whole email; Sent to registration = list starts empty. (i)
19. **"Time requests" card** on the Proposal page is clickable and scrolls to the Time change requests list. (i)
20. **Official-file note "… meets on Thursday" removed** (Files step, check table, Is Reg note, Official file notes). (j)
21. **Excel clean-up**: removed the Preps column, the long instructions line under the title, "Unofficial simulation draft,
    generated …" from the title, and all notes on member / row names (notice kept in the printed footer). "Part-timer"
    status in red in the check table and Is Reg. (k)

22. **"Replace" wording**: dropping an ON-HOLD or part-timer section on a member's section says "Replace: … , … to Not assigned". (l)
23. **ON HOLD lines for every section**: any section moved to ON-HOLD gives "Please put IS201 at 10am sections 498/499 ON HOLD"
    (untimed: "Please put IS311 section 514 ON HOLD"); "Sent to registration" remembers ON HOLD for every section. (l)
24. **Print**: the small notice line is hidden too. Female email ends with "Regards," only (decided). Other official-file notes stay. (l)
25. **Tests kept in the repo**: `isp/tests/` — Playwright tests on synthetic sample files, LibreOffice recalculation check,
    `run_all.sh`, README. Generated files are git-ignored.

26. **Clean "Timetable" tab, first in the Excel file**: Member, hours, No time, Senior, COOP, MSc / PhD, Total Load (Sections removed in o);
    rows Not assigned, members, part-timers, ON-HOLD; course colours; A4 landscape. Every cell is a formula on the detailed
    sheet, so changes made there show here too. (m)

27. **Female timetable**: every change above applies to the female side too (same code). Differences only where asked:
    email "Dear Ms. Deem, … Regards," and "Female" in titles / sheet names. Test `isp/tests/15_female.js`. (m)

28. **Print without Sections and Preps**: printing the proposal hides the Sections and Preps columns; Load stays (n). The clean Excel tab has no Sections column either (o).

29. **Graduate Studies** (replaces the MSc & PhD tab): Settings → member → Edit limits → Courses → "Graduate Studies" (+ Add,
    hours 1–6 each). No time (evening), counts as one of the member's sections, hours added to his load. Timetable: a
    "Graduate Studies" cell in his No time column that drags up / down to another member's No time cell or to Not assigned
    (locked or full members refused with the reason). Excel: text "Graduate Studies" in No time, column "Graduate Studies (hrs)".
    Not in Is Reg or the change list. Shown when printing the proposal and in the clean Excel tab (purple, wider No time
    column, q). Test `isp/tests/16_grad.js`. (p, q)

Testing: Chromium (Playwright) with synthetic files in the male-file layout (male and female projects);
LibreOffice recalculation 0 formula errors. Not yet tested with the real `262 sechd/male/` files.
Cache tag ?v=20261010q.
