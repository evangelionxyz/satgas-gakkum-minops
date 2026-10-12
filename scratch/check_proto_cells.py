import docx

doc = docx.Document('d:/Dev/satgas-gakkum-minops/scratch/test_proto_out.docx')
tbl = doc.tables[0]
found = []
for r_idx, r in enumerate(tbl.rows):
    for c_idx, c in enumerate(r.cells):
        if '<w:drawing' in c._tc.xml:
            found.append((r_idx, c_idx))

print("Cells with drawing:", found)
