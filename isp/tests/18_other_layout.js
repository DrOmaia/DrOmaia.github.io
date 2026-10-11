// The official file in another layout (two-row headings, "CLASS TIME" 8:00-8:50, "Lecturer's NAME"), synthetic data.
const path = require('path');
const ExcelJS = require(path.join(__dirname, '../vendor/exceljs.min.js'));
const E = require(path.join(__dirname, '../engine.js'));
(async () => {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('IS Courses ');
  ws.getCell('B1').value = 'SAMPLE UNIVERSITY';
  ws.getCell('B4').value = 'CLASS SCHEDULES';
  ws.getRow(7).values = [null, 'NO', 'SECTION', 'COURSE', 'Contact', 'CLASS TIME', 'DAYS', 'ROOM/', "Lecturer's NAME"];
  ws.getRow(8).values = [null, null, 'NO.', 'CODE', 'Hrs.', null, null, 'Loc.', null];
  ws.mergeCells('F7:F8'); ws.mergeCells('G7:G8');
  ws.getCell('B9').value = 'IS - Courses';
  const data = [[1, 103, 'IS 101', 3, '8:00-8:50', 'TUES-WED-THUR', null], [2, 224, 'IS 101', 3, '1:00-1:50', 'SUN-MON-TUES', 'A note written by the office here'],
    [3, 40, 'IS 205', 4, '8:00-8:50', 'SUN-MON-TUES-WED', 'G-A10'], [4, 40, 'IS 241', 4, '9:00-9:50', 'SUN-MON-TUES-WED', null], [5, 244, 'IS 499', null, 'IS SENIOR PROJECT', null, null]];
  data.forEach((d, i) => { ws.getRow(10 + i).values = [null, ...d]; });
  ws.getCell('B15').value = '*** Nothing Follows ***';
  const wb2 = new ExcelJS.Workbook(); await wb2.xlsx.load(await wb.xlsx.writeBuffer());
  const sheets = E.sheetsFromExcelJS(wb2);
  const ok = (c, m) => console.log((c ? 'PASS ' : 'FAIL ') + m);
  ok(E.looksOfficial(sheets[0]), 'two-row headings are found');
  const o = E.parseOfficial(sheets, 'IS Courses ');
  ok(o.lectures.join() === 'IS101-103,IS101-224,IS205-40,IS241-40,IS499-244', 'sections: ' + o.lectures.join());
  ok(o.sections['IS101-103'].hour === 8 && o.sections['IS101-224'].hour === 13, '8:00-8:50 → 8, 1:00-1:50 → 1pm');
  ok(o.sections['IS101-103'].meetings[0].days.join() === '3,4,5', 'days TUES-WED-THUR');
  ok(o.sections['IS499-244'].hour == null, 'no time for the senior project');
  ok(!o.sections['IS101-224'].meetings[0].room && o.sections['IS205-40'].meetings[0].room === 'G-A10', 'a note in the room column is not a room');
  ok(o.cols.instructor === 8 && o.headerEnd === 8, "Lecturer's NAME column and two heading rows");
})();
