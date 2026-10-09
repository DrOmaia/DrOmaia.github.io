/* IS Timetable — built-in members and settings (the user edits them in the site; a saved project keeps her edits). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ISPDefaults = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  // m(name, required sections, COOP hrs, extra settings)
  const m = (name, required, coop, extra) => Object.assign({ name, required, coop: coop || 0, senior: 0, keepCurrent: true, first: 8, last: 18, allowed: [], never: [], prefTime: 'any', prefs: ['', '', ''] }, extra || {});

  const MEMBERS = {
    male: [
      m('Dr. Omaia Al-Omari', 2, 0, { allowed: ['IS201', 'IS492', 'IS499'] }),
      m('Dr. Suliman Fati', 1, 0, { allowed: ['IS201'] }),
      m('Dr. Ahmed Almasoud', 4, 2),
      m('Dr. Amjad Rehman', 4, 2, { never: ['CYS'] }),
      m('Prof. M G Abbas Malik', 4, 2),
      m('Dr. Esam Othman', 4, 0),
      m('Dr. Awad Alyousef', 3, 0),
      m('Dr. Saeed Abo Oleet', 4, 2, { last: 11 }),
      m('Dr. Shafiq ur Rehman', 4, 1),
      m('Dr. Yazan Alshboul', 4, 0, { allowed: ['CYS'] }),
    ],
    female: [
      m('Dr. Bayan Alghofaily', 2),
      m('Dr. Amirah Alghanim', 4),
      m('Prof. Tanzila Saba', 2),
      m('Dr. Nor Shahida Mohd Jamail', 3),
      m('Dr. Rabia Latif', 3),
      m('Ms. Fatima Khan', 3),
      m('Ms. Hanaa A. AlAhmari', 4),
      m('Ms. Nermeen El Hakim', 3),
      m('Dr. Abeer Mirdad', 1),
      m('Dr. Samah Almutlaq', 4),
      m('Dr. Asmaa Ali', 4),
      m('Dr. Ruba Awawdeh', 4),
      m('Prof. Nor Shahriza Abdul Karim', 4),
      m('Dr. Fatimah Alotaibi', 4),
      m('Dr. Bayan Al Muhander', 4),
    ],
  };

  // course decisions that cannot be read from the files (the user changes them in Settings → Courses)
  const COURSES = {
    male: { IS472: { cat: 'onhold' }, IS487: { cat: 'onhold' } },
    female: {},
  };

  // course colours (same palette as the approved Male 262 Excel file)
  const COLOURS = {
    IS101: 'BFBFBF', IS201: 'FFC000', IS205: '92D050', IS231: 'F4B084', IS241: '9BC2E6', IS311: 'B4A7D6', IS321: 'FF99CC',
    IS361: '4DD2C6', IS362: '8FD9D2', IS371: 'FFFF66', IS446: 'C9A27E', CYS403: 'D883FF', CYS401: 'F2CEEF', IS450: 'FFE4B5',
    IS452: 'E0BBE4', IS453: 'B5EAD7', IS454: 'FFDAC1', IS466: 'C7CEEA', BCE483: 'F6EAC2', IS472: 'D3D3A4', IS487: 'E8D3B9',
    IS492: 'FFD1DC', IS499: 'D9EAD3', CYS402: 'E6C9F5', CYS405: 'D5B3E8', CYS406: 'EBD9F7', SE201: 'CFE2F3',
  };
  function colourFor(code) {
    if (COLOURS[code]) return COLOURS[code];
    let h = 0; for (const ch of String(code)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    const hue = h % 360, s = 0.55, l = 0.82;
    const f = (n) => { const k = (n + hue / 30) % 12; const a = s * Math.min(l, 1 - l); const c = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); return Math.round(c * 255).toString(16).padStart(2, '0'); };
    return (f(0) + f(8) + f(4)).toUpperCase();
  }

  return { MEMBERS, COURSES, COLOURS, colourFor };
});
