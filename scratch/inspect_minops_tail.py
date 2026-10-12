import zipfile
import re

with zipfile.ZipFile('d:/Dev/satgas-gakkum-minops/old-backup/laporan/hasil/LAPHAR MINOPS 05 OKTOBER 2026.docx') as z:
    doc_xml = z.read('word/document.xml').decode('utf-8')
    rels_xml = z.read('word/_rels/document.xml.rels').decode('utf-8')

# Find p[53] to p[57]
paras = re.findall(r'<w:p\b[^>]*>.*?</w:p>', doc_xml, re.DOTALL)
print(f"Total paragraphs in doc: {len(paras)}")
for idx in range(max(0, len(paras)-10), len(paras)):
    p = paras[idx]
    has_dw = '<w:drawing' in p
    # text
    txt = "".join(re.findall(r'<w:t\b[^>]*>([^<]*)</w:t>', p))
    blips = re.findall(r'<a:blip\b[^>]*r:embed="([^"]+)"', p)
    print(f"  P[{idx}]: text='{txt}' has_drawing={has_dw} blips={blips}")
