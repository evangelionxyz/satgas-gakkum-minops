import glob
import os
import zipfile
import re

files = glob.glob('d:/Dev/satgas-gakkum-minops/frontend/src-tauri/test/example/*.docx')

for f in sorted(files):
    fname = os.path.basename(f)
    with zipfile.ZipFile(f) as z:
        doc_xml = z.read('word/document.xml').decode('utf-8')
        tables = re.findall(r'<w:tbl\b[^>]*>.*?</w:tbl>', doc_xml, re.DOTALL)
        if tables:
            tbl0 = tables[0]
            drawings = re.findall(r'<w:drawing\b[^>]*>.*?</w:drawing>', tbl0, re.DOTALL)
            inline_count = sum(1 for d in drawings if '<wp:inline' in d)
            anchor_count = sum(1 for d in drawings if '<wp:anchor' in d)
            print(f"{fname}: {len(drawings)} table drawings ({inline_count} inline, {anchor_count} anchor)")
