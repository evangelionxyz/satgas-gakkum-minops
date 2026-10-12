import zipfile
import xml.etree.ElementTree as ET

doc_path = 'd:/Dev/satgas-gakkum-minops/frontend/src-tauri/test/example/MINOPS JAYAPURA.docx'

with zipfile.ZipFile(doc_path) as z:
    doc_xml = z.read('word/document.xml').decode('utf-8')
    rels_xml = z.read('word/_rels/document.xml.rels').decode('utf-8')
    media_files = [f for f in z.namelist() if f.startswith('word/media/')]

print("Media files in MINOPS JAYAPURA:", media_files)

# Parse rels
root_rels = ET.fromstring(rels_xml)
image_rels = {}
for r in root_rels:
    if 'image' in r.attrib.get('Type', ''):
        image_rels[r.attrib['Id']] = r.attrib['Target']

print("Image rels:", image_rels)

# Find <w:drawing> elements in doc_xml
root_doc = ET.fromstring(doc_xml)
namespaces = {
    'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main',
    'a': 'http://schemas.openxmlformats.org/drawingml/2006/main',
    'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
}

drawings = root_doc.findall('.//w:drawing', namespaces)
print(f"Total drawings in doc: {len(drawings)}")

# Find drawings in table vs body
body = root_doc.find('w:body', namespaces)
for tbl_idx, tbl in enumerate(body.findall('w:tbl', namespaces)):
    tbl_drawings = tbl.findall('.//w:drawing', namespaces)
    print(f"Table {tbl_idx} has {len(tbl_drawings)} drawings")
    for d_idx, d in enumerate(tbl_drawings):
        blip = d.find('.//a:blip', namespaces)
        if blip is not None:
            r_embed = blip.attrib.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}embed')
            target = image_rels.get(r_embed, 'UNKNOWN')
            print(f"  Drawing {d_idx}: embed={r_embed} -> {target}")

# Paragraph drawings outside table:
p_drawings = []
for child in body:
    if child.tag.endswith('p'):
        for d in child.findall('.//w:drawing', namespaces):
            blip = d.find('.//a:blip', namespaces)
            if blip is not None:
                r_embed = blip.attrib.get('{http://schemas.openxmlformats.org/officeDocument/2006/relationships}embed')
                target = image_rels.get(r_embed, 'UNKNOWN')
                p_drawings.append((r_embed, target))

print(f"Paragraph drawings outside tables: {len(p_drawings)} -> {p_drawings}")
