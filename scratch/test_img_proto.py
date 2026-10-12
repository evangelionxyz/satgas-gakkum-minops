import zipfile
import re
import docx

# Test taking MINOPS JAYAPURA and merging into master with images
master_path = 'd:/Dev/satgas-gakkum-minops/frontend/src-tauri/templates/TEMPLATE_LAPHAR_MASTER.docx'
minops_path = 'd:/Dev/satgas-gakkum-minops/frontend/src-tauri/test/example/MINOPS JAYAPURA.docx'

with zipfile.ZipFile(minops_path) as z_src:
    src_doc = z_src.read('word/document.xml').decode('utf-8')
    src_rels = z_src.read('word/_rels/document.xml.rels').decode('utf-8')
    src_media = {name: z_src.read(name) for name in z_src.namelist() if name.startswith('word/media/')}

# Extract rels map
re_rel = re.findall(r'<Relationship\b[^>]*Id="([^"]+)"[^>]*Type="[^"]*image"[^>]*Target="([^"]+)"', src_rels)
rel_map = {r_id: target for r_id, target in re_rel}
print("Source rel map:", rel_map)
print("Source media files:", list(src_media.keys()))

# Extract drawings in table
tables = re.findall(r'<w:tbl\b[^>]*>.*?</w:tbl>', src_doc, re.DOTALL)
tbl0 = tables[0]
re_tr = re.findall(r'<w:tr\b[^>]*>.*?</w:tr>', tbl0, re.DOTALL)
rows_drawings = []
for r in re_tr:
    dws = re.findall(r'<w:drawing\b[^>]*>.*?</w:drawing>', r, re.DOTALL)
    rows_drawings.append(dws)

print(f"Total rows in src table: {len(re_tr)}, rows with drawings: {sum(1 for d in rows_drawings if d)}")
