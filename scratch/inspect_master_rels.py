import zipfile

with zipfile.ZipFile('d:/Dev/satgas-gakkum-minops/frontend/src-tauri/templates/TEMPLATE_LAPHAR_MASTER.docx') as z:
    ct = z.read('[Content_Types].xml').decode('utf-8')
    rels = z.read('word/_rels/document.xml.rels').decode('utf-8')

print("Content Types in Master Template:")
print(ct)

print("\nDocument.xml.rels in Master Template:")
print(rels)
