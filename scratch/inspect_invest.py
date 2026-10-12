import docx

doc = docx.Document('d:/Dev/satgas-gakkum-minops/frontend/src-tauri/test/example/LAPHAR SUBSATGAS INVEST 5 OKTOBER 2026.docx')
for i, p in enumerate(doc.paragraphs):
    if '<w:drawing' in p._p.xml:
        print(f"Invest doc paragraph {i}: text='{p.text}'")

# Also check header/footer
for s in doc.sections:
    for p in s.header.paragraphs:
        if '<w:drawing' in p._p.xml:
            print(f"Header paragraph drawing: '{p.text}'")

# Check table 0
tbl = doc.tables[0]
for idx, c in enumerate(tbl.rows[0].cells):
    print(f"  Col {idx}: {c.text.strip().replace(chr(10), ' ')}")

for r_idx, row in enumerate(tbl.rows):
    for c_idx, cell in enumerate(row.cells):
        if '<w:drawing' in cell._tc.xml:
            col_header = tbl.rows[0].cells[c_idx].text.strip().replace(chr(10), ' ') if c_idx < len(tbl.rows[0].cells) else '?'
            print(f"  Invest row {r_idx}, Col {c_idx} ({col_header})")
