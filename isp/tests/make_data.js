// Synthetic files in the same layout as the department's male files (no real data).
const ExcelJS = require(require('path').join(__dirname, '../vendor/exceljs.min.js'));
const OUT = __dirname + '/data/';
require('fs').mkdirSync(OUT, { recursive: true });
const members = [
  ['Dr. Omaia Al-Omari', 1, 0, 3], ['Dr. Bayan Alghofaily', 3, 0, 0], ['Dr. Ahmed Hassan', 3, 1, 0], ['Dr. Khalid Saleh', 3, 0, 0],
  ['Dr. Faisal Noor', 3, 0, 0], ['Dr. Mohammed Ali', 3, 0, 2], ['Dr. Yousef Karim', 3, 0, 0], ['Dr. Tariq Aziz', 3, 2, 0],
  ['Dr. Sami Fahad', 2, 0, 0], ['Dr. Omar Zaid', 2, 0, 0], ['Mr. Nasser Adel', null, 0, 0],
];
const fmtH = (h) => `${h > 12 ? h - 12 : h}:00 ${h >= 12 ? 'PM' : 'AM'}`;
const endH = (h) => `${h > 12 ? h - 12 : h}:50 ${h >= 12 ? 'PM' : 'AM'}`;
let sec = 400;
const rows = [];
function add(course, name, hours, comp, opts = {}) {
  hours.forEach((h, i) => {
    const s = opts.secs ? opts.secs[i] : (sec += 2);
    rows.push([s, course, name, 'Lecture', 3, h == null ? '' : fmtH(h), h == null ? '' : endH(h), h == null ? '' : '1 2 4', h == null ? '' : (comp === 'Lab' ? 'G-A1' : 'G-A1') + (i % 4), (opts.instr || {})[s] || '']);
    if (comp) rows.push([s + 1, course, name, comp === 'Lab' ? 'Lab' : 'Tutorial', 0, fmtH(h), endH(h), '3', comp === 'Lab' ? `F-${i}01 CLAB` : 'Online', '']);
  });
}
add('IS101', 'Intro to IS', [8, 9, 10, 11]);
add('IS201', 'Fundamentals of IS', [11, 10, 8, 13, 14], 'T', { secs: [1465, 498, 500, 502, 504], instr: { 1465: 'Dr. Khalid Saleh', 498: 'Dr. Ahmed Hassan' } });
add('IS205', 'Business Process', [9, 13, 15], 'T');
add('IS231', 'Databases', [8, 10, 14], 'Lab', { secs: [506, 510, 514] });
add('IS241', 'Systems Analysis', [9, 11, 13], 'T');
add('IS311', 'Web Systems', [10, 14, null], null, { secs: [422, 424, 514] });
add('IS321', 'IS Security', [11, 15]);
add('IS361', 'Data Mining', [9, 13], 'Lab');
add('IS371', 'Project Management', [10, 16], 'T');
add('IS446', 'IT Governance', [11]);
add('CYS403', 'Network Security', [14]);
add('IS466', 'ERP Systems', [15]);
add('IS450', 'Selected Topics', [null]);
add('IS492', 'Senior Project', [null, null, null], null, { secs: [546, 547, 548] });
add('IS499', 'COOP Training', [null, null], null, { secs: [560, 561] });

(async () => {
  // faculty list
  let wb = new ExcelJS.Workbook(); let ws = wb.addWorksheet('Sheet1');
  ws.addRow(['No', 'Full name', 'Sections', 'COOP', 'Senior']);
  members.forEach(([n, s, c, sr], i) => ws.addRow([i + 1, n, s == null ? '' : s, c || '', sr || '']));
  ws.addRow(['', 'Need part time', 4, '', '']);
  require('fs').writeFileSync(OUT + 'Total Sections.xlsx', Buffer.from(await wb.xlsx.writeBuffer()));
  // official file
  wb = new ExcelJS.Workbook();
  for (const name of ['IS', 'CS', 'SE']) {
    ws = wb.addWorksheet(name);
    ws.addRow(['T262 CCIS timetable']);
    ws.addRow(['SECTION', 'COURSE', 'COURSE_NAME', 'ACTIVITY', 'CRD', 'START', 'END', 'DAYS', 'ROOMS', "INSTRUCTOR'S NAME"]);
    if (name === 'IS') rows.forEach((r) => ws.addRow(r));
    else ws.addRow([900, name + '101', 'Intro', 'Lecture', 3, '10:00 AM', '10:50 AM', '1 2 4', 'G-A10', '']);
  }
  require('fs').writeFileSync(OUT + 'T262_CCIS_TIMETABLE.xlsx', Buffer.from(await wb.xlsx.writeBuffer()));
  // current term grid
  wb = new ExcelJS.Workbook(); ws = wb.addWorksheet('Male 261');
  ws.addRow(['IS Department - Male timetable 261']); ws.addRow([]); ws.addRow(['', '', 'Timeslots']);
  ws.addRow(['', 'Unit load', 8, 9, 10, 11, 1, 2, 3, 4, 5, 6, 'No time']);
  const cols = { 8: 3, 9: 4, 10: 5, 11: 6, 13: 7, 14: 8, 15: 9, 16: 10, 17: 11, 18: 12 };
  const cur = {
    'Dr. Omaia Al-Omari': [['IS201', 10]], 'Dr. Bayan Alghofaily': [['IS201', 11], ['IS241', 9], ['IS205', 13]], 'Dr. Ahmed Hassan': [['IS231', 8], ['IS231', 10], ['IS311', 14]],
    'Dr. Khalid Saleh': [['IS241', 11], ['IS361', 13], ['IS205', 9]], 'Dr. Faisal Noor': [['IS321', 11], ['CYS403', 14], ['IS371', 10]], 'Dr. Mohammed Ali': [['IS201', 8], ['IS371', 16], ['IS466', 15]],
    'Dr. Yousef Karim': [['IS361', 9], ['IS241', 13], ['IS205', 15]], 'Dr. Tariq Aziz': [['IS201', 13], ['IS201', 14], ['IS231', 14]], 'Dr. Sami Fahad': [['IS311', 10], ['IS446', 11]], 'Dr. Omar Zaid': [['IS321', 15], ['IS201', 10]],
    'Part-timers': [['IS101', 8], ['IS101', 9], ['IS101', 10], ['IS101', 11]], 'ON-Hold': [],
  };
  Object.entries(cur).forEach(([n, items]) => {
    const r1 = ws.addRow([n]); const r2 = ws.addRow([]);
    items.forEach(([c, h]) => { r1.getCell(cols[h]).value = `${c}(L)`; });
  });
  require('fs').writeFileSync(OUT + '261 male timetable.xlsx', Buffer.from(await wb.xlsx.writeBuffer()));
  // preferences
  wb = new ExcelJS.Workbook(); ws = wb.addWorksheet('Form Responses 1');
  ws.addRow(['Timestamp', 'Email Address', 'Full Name', 'First preferred course', 'Second preferred course', 'Third preferred course', 'Preferred class time (Morning / Afternoon)', 'Comments']);
  ws.addRow([new Date(), 'bayan@x.edu', 'Bayan Alghofaily', 'IS201 Fundamentals', 'IS241', 'IS205', 'Morning', '']);
  ws.addRow([new Date(), 'ahmed@x.edu', 'Ahmed Hassan', 'IS231', 'IS311', 'IS361', 'Morning', 'Labs please']);
  ws.addRow([new Date(), 'yousef@x.edu', 'Yousef Karim', 'IS361', 'IS241', '', 'Afternoon', '']);
  require('fs').writeFileSync(OUT + '262 male Preferences.xlsx', Buffer.from(await wb.xlsx.writeBuffer()));
  console.log('ok', rows.length, 'rows');
})();
