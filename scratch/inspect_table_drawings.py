import zipfile
import re

with zipfile.ZipFile('d:/Dev/satgas-gakkum-minops/frontend/src-tauri/test/example/MINOPS JAYAPURA.docx') as z:
    doc_xml = z.read('word/document.xml').decode('utf-8')

drawings = re.findall(r'<w:drawing\b[^>]*>.*?</w:drawing>', doc_xml, re.DOTALL)
for idx in range(3, len(drawings)):
    d = drawings[idx]
    print(f"\n--- DRAWING {idx} (len {len(d)}) ---")
    print(d[:300])
    blip = re.search(r'<a:blip\b[^>]*r:embed="([^"]+)"', d)
    if blip:
        print("  embed:", blip.group(1))
    docpr = re.search(r'<wp:docPr\b[^>]*id="([^"]+)"', d)
    if docpr:
        print("  docPr id:", docpr.group(1))
