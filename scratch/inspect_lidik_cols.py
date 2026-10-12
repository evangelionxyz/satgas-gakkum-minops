import docx

doc = docx.Document('d:/Dev/satgas-gakkum-minops/frontend/src-tauri/test/example/LAPHAR_2026-10-05_SUBSATGAS LIDIK.docx')
tbl = doc.tables[0]

print("LIDIK Rows count:", len(tbl.rows))
print("LIDIK Header row texts:")
for idx, c in enumerate(tbl.rows[0].cells):
    print(f"  Col {idx}: {c.text.strip().replace(chr(10), ' ')}")

print("\nLIDIK Rows with drawings:")
for r_idx, row in enumerate(tbl.rows):
    for c_idx, cell in enumerate(row.cells):
        if '<w:drawing' in cell._tc.xml:
            col_header = tbl.rows[0].cells[c_idx].text.strip().replace(chr(10), ' ') if c_idx < len(tbl.rows[0].cells) else '?'
            print(f"  Row {r_idx}, Col {c_idx} ({col_header})")
