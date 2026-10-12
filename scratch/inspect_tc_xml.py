import zipfile
import re

with zipfile.ZipFile('d:/Dev/satgas-gakkum-minops/frontend/src-tauri/test/example/MINOPS JAYAPURA.docx') as z:
    doc_xml = z.read('word/document.xml').decode('utf-8')

# Find a <w:tc> containing <w:drawing>
re_tc = re.findall(r'<w:tc\b[^>]*>.*?</w:tc>', doc_xml, re.DOTALL)
for tc in re_tc:
    if '<w:drawing' in tc:
        print("=== FOUND TC WITH DRAWING ===")
        print(tc[:1000])
        print("...\n" + tc[-300:])
        break
