import glob
import os
import xml.etree.ElementTree as ET
import zipfile

namespaces = {
    'w': 'http://schemas.openxmlformats.org/wordprocessingml/2006/main',
    'a': 'http://schemas.openxmlformats.org/drawingml/2006/main',
    'r': 'http://schemas.openxmlformats.org/officeDocument/2006/relationships',
}

files = glob.glob('d:/Dev/satgas-gakkum-minops/frontend/src-tauri/test/example/*.docx')

for f in sorted(files):
    fname = os.path.basename(f)
    with zipfile.ZipFile(f) as z:
        doc_xml = z.read('word/document.xml').decode('utf-8')
        rels_xml = z.read('word/_rels/document.xml.rels').decode('utf-8')
        
        root_doc = ET.fromstring(doc_xml)
        root_rels = ET.fromstring(rels_xml)
        
        img_rels = {r.attrib['Id']: r.attrib['Target'] for r in root_rels if 'image' in r.attrib.get('Type', '')}
        
        body = root_doc.find('w:body', namespaces)
        
        table_drawings = 0
        for tbl in body.findall('w:tbl', namespaces):
            table_drawings += len(tbl.findall('.//w:drawing', namespaces))
            
        p_drawings_after_tables = 0
        found_table = False
        tail_paragraphs = []
        for child in body:
            if child.tag.endswith('tbl'):
                found_table = True
            elif found_table and child.tag.endswith('p'):
                ds = child.findall('.//w:drawing', namespaces)
                if ds:
                    p_drawings_after_tables += len(ds)
                    # get text
                    text = "".join(child.itertext()).strip()
                    tail_paragraphs.append((text, len(ds)))
                    
        print(f"{fname}:")
        print(f"  Total media: {len(img_rels)}, In-table drawings: {table_drawings}, After-table drawings: {p_drawings_after_tables}")
        if tail_paragraphs:
            print(f"  Tail paragraphs with drawings: {tail_paragraphs}")
