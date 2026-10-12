import zipfile
import re

with zipfile.ZipFile('d:/Dev/satgas-gakkum-minops/frontend/src-tauri/test/test_real_merged_output.docx') as z:
    xml = z.read('word/document.xml').decode('utf-8')

# Check w: elements with naked val=
w_naked_val = re.findall(r'<w:[^>]*?\sval\s*=\s*"[^"]*"', xml)
print(f"w: elements with naked val=: {len(w_naked_val)}")

# Check w:val count
w_val_count = len(re.findall(r'w:val\s*=\s*"', xml))
print(f"w:val count: {w_val_count}")

# Check CT_TrPr order: cantSplit before trHeight
bad_trpr = re.findall(r'<w:trHeight[^>]*/>\s*<w:cantSplit', xml)
print(f"Bad CT_TrPr ordering: {len(bad_trpr)}")

# Check cantSplit count
cant_split_count = len(re.findall(r'<w:cantSplit', xml))
print(f"cantSplit count: {cant_split_count}")
