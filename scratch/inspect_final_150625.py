import docx

doc = docx.Document('d:/Dev/satgas-gakkum-minops/old-backup/laporan/hasil/LAPHAR_FINAL_06102026_150625.docx')
tbl = doc.tables[0]
print(f"Table 0 has {len(tbl.rows)} rows")
for r_idx, r in enumerate(tbl.rows):
    for c_idx, c in enumerate(r.cells):
        if '<w:drawing' in c._tc.xml:
            print(f"  Row {r_idx}, Col {c_idx}: text='{c.text.strip()[:30]}'")
