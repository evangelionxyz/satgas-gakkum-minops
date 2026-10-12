import zipfile
import re

with zipfile.ZipFile('d:/Dev/satgas-gakkum-minops/frontend/src-tauri/test/example/MINOPS JAYAPURA.docx') as z:
    doc_xml = z.read('word/document.xml').decode('utf-8')

drawings = re.findall(r'<w:drawing\b[^>]*>.*?</w:drawing>', doc_xml, re.DOTALL)
print(drawings[4])
