import zipfile
import os

sample_path = 'd:/Dev/satgas-gakkum-minops/frontend/src-tauri/test/example/LAPHAR_2026-10-05_SUBSATGAS LIDIK.docx'

with zipfile.ZipFile(sample_path) as z:
    names = z.namelist()
    media_files = [n for n in names if n.startswith('word/media/')]
    print(f"Total files in docx: {len(names)}")
    print(f"Media files count: {len(media_files)}")
    for m in media_files[:10]:
        print(f"  {m} ({z.getinfo(m).file_size} bytes)")
    
    # Check document.xml for image drawings/blips
    doc_xml = z.read('word/document.xml').decode('utf-8')
    print(f"blip mentions: {doc_xml.count('<a:blip')}")
    print(f"drawing mentions: {doc_xml.count('<w:drawing')}")
    
    # Also check rels
    if 'word/_rels/document.xml.rels' in names:
        rels_xml = z.read('word/_rels/document.xml.rels').decode('utf-8')
        print(f"rels mentions: {rels_xml.count('http://schemas.openxmlformats.org/officeDocument/2006/relationships/image')}")
