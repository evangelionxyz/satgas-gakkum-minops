import unittest
import sys
from pathlib import Path

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(backend_dir))

from fastapi.testclient import TestClient
from main import app
from services.auth_service import hash_password, verify_password, create_access_token, decode_access_token
from config import OFFICIAL_UNITS

class TestSatgasBackend(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)

    def test_health_check(self):
        response = self.client.get("/api/health")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["status"], "healthy")
        self.assertEqual(data["schema"], "satgas")

    def test_password_hashing(self):
        plain = "DamkarMimika123!"
        hashed = hash_password(plain)
        self.assertNotEqual(hashed, plain)
        self.assertTrue(verify_password(plain, hashed))
        self.assertFalse(verify_password("WrongPassword!", hashed))

    def test_jwt_token_flow(self):
        token = create_access_token(
            user_id="user-123",
            email="test@satgas.polri.go.id",
            role="operator",
            name="Bripka Test",
            subsatgas="MINOPS",
            unit_name="UNIT JAYAPURA"
        )
        self.assertIsInstance(token, str)

        payload = decode_access_token(token)
        self.assertEqual(payload["sub"], "user-123")
        self.assertEqual(payload["email"], "test@satgas.polri.go.id")
        self.assertEqual(payload["role"], "operator")
        self.assertEqual(payload["subsatgas"], "MINOPS")
        self.assertEqual(payload["unit_name"], "UNIT JAYAPURA")

    def test_official_units_endpoint(self):
        response = self.client.get("/api/reports/units")
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn("MINOPS", data)
        self.assertIn("LIDIK", data)
        self.assertIn("INVESTIGASI", data)
        self.assertIn("ANALIS", data)
        self.assertIn("UNIT JAYAPURA", data["MINOPS"])
        self.assertIn("UNIT TIMIKA", data["MINOPS"])
        self.assertEqual(len(data["LIDIK"]), 11)
        self.assertEqual(len(data["INVESTIGASI"]), 10)
        self.assertEqual(len(data["ANALIS"]), 10)

    def test_unauthenticated_protected_route(self):
        response = self.client.get("/api/reports")
        self.assertEqual(response.status_code, 401)

if __name__ == "__main__":
    unittest.main()
