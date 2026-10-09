/* IS Timetable — course colour palette only. Members and all term decisions come from the uploaded files and the saved project. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ISPDefaults = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
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

  return { COLOURS, colourFor };
});
