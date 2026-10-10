# Open the exported workbook in LibreOffice, recalculate everything, report formula errors, save a recalculated copy.
import subprocess, time, sys, uno
from com.sun.star.beans import PropertyValue
src, dst = sys.argv[1], sys.argv[2]
p = subprocess.Popen(['soffice', '--headless', '--invisible', '--norestore', '--accept=socket,host=127.0.0.1,port=2099;urp;'])
ctx = None
for _ in range(60):
    try:
        local = uno.getComponentContext()
        ctx = local.ServiceManager.createInstanceWithContext('com.sun.star.bridge.UnoUrlResolver', local).resolve('uno:socket,host=127.0.0.1,port=2099;urp;StarOffice.ComponentContext')
        break
    except Exception: time.sleep(1)
desktop = ctx.ServiceManager.createInstanceWithContext('com.sun.star.frame.Desktop', ctx)
def pv(n, v): x = PropertyValue(); x.Name = n; x.Value = v; return x
doc = desktop.loadComponentFromURL(uno.systemPathToFileUrl(src), '_blank', 0, (pv('Hidden', True),))
doc.calculateAll()
errs = 0
for sh in doc.Sheets:
    cur = sh.createCursor(); cur.gotoEndOfUsedArea(False)
    a = cur.RangeAddress
    for r in range(a.EndRow + 1):
        for c in range(a.EndColumn + 1):
            cell = sh.getCellByPosition(c, r)
            if cell.getFormula().startswith('=') and cell.getError() != 0:
                errs += 1
                if errs <= 10: print('ERR', sh.Name, r + 1, c + 1, cell.getFormula()[:90], cell.getError())
print('formula errors:', errs)
doc.storeToURL(uno.systemPathToFileUrl(dst), (pv('FilterName', 'Calc MS Excel 2007 XML'),))
doc.close(True)
try: desktop.terminate()
except Exception: pass
p.wait(timeout=30)
