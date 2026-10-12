import os
import unittest
from fastapi.testclient import TestClient
from main import app
from services.auth_service import create_access_token

class TestDocxMergerAPI(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        self.token = create_access_token(
            "test-operator-id",
            "operator@test.com",
            "operator",
            "Test Operator",
            "MINOPS",
            "UNIT JAYAPURA"
        )
        self.headers = {"Authorization": f"Bearer {self.token}"}
        self.sample_dir = r"d:\Dev\satgas-gakkum-minops\old-backup\laporan\example"

    def test_parse_files_endpoint(self):
        sample_file = os.path.join(self.sample_dir, "MINOPS JAYAPURA.docx")
        if not os.path.exists(sample_file):
            self.skipTest("Sample file not found")

        with open(sample_file, "rb") as f:
            files = [("files", ("MINOPS JAYAPURA.docx", f.read(), "application/vnd.openxmlformats-officedocument.wordprocessingml.document"))]

        res = self.client.post("/api/docx/parse-files", files=files, headers=self.headers)
        self.assertEqual(res.status_code, 200, res.text)
        data = res.json()
        self.assertEqual(data["total_files"], 1)
        self.assertEqual(data["files"][0]["subsatgas"], "MINOPS")
        self.assertGreater(data["total_items"], 0)
        self.assertEqual(data["detected_date"], "2026-10-05")
        print(f"Verified test_parse_files_endpoint: {data['total_items']} items parsed successfully.")

    def test_direct_upload_and_merge_endpoint(self):
        f1_path = os.path.join(self.sample_dir, "MINOPS JAYAPURA.docx")
        f2_path = os.path.join(self.sample_dir, "MINOPS TIMIKA.docx")
        if not os.path.exists(f1_path) or not os.path.exists(f2_path):
            self.skipTest("Sample files not found")

        with open(f1_path, "rb") as f1, open(f2_path, "rb") as f2:
            files = [
                ("files", ("MINOPS JAYAPURA.docx", f1.read(), "application/vnd.openxmlformats-officedocument.wordprocessingml.document")),
                ("files", ("MINOPS TIMIKA.docx", f2.read(), "application/vnd.openxmlformats-officedocument.wordprocessingml.document")),
            ]

        res = self.client.post(
            "/api/docx/upload-and-merge",
            files=files,
            data={"target_date": "2026-10-05"},
            headers=self.headers
        )
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.headers["content-type"], "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
        self.assertGreater(len(res.content), 50000)
        print(f"Verified test_direct_upload_and_merge_endpoint: Output DOCX size = {len(res.content)} bytes.")

if __name__ == "__main__":
    unittest.main()
