from pathlib import Path
import os
import logging
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")
load_dotenv(ROOT_DIR.parent / ".env")

# Official Subsatgas and Unit Reference
OFFICIAL_UNITS = {
    "MINOPS": [
        "UNIT JAYAPURA",
        "UNIT TIMIKA",
        "UNIT LANNY JAYA - KRING JAYAWIJAYA"
    ],
    "LIDIK": [
        "UNIT JAYAPURA",
        "UNIT LANNY JAYA",
        "UNIT YAHUKIMO",
        "UNIT PEGUNUNGAN BINTANG",
        "UNIT MIMIKA",
        "UNIT NDUGA",
        "UNIT INTAN JAYA",
        "UNIT NABIRE",
        "UNIT PUNCAK JAYA",
        "UNIT PUNCAK",
        "UNIT PUNCAK KRING SINAK"
    ],
    "INVESTIGASI": [
        "UNIT JAYAPURA",
        "UNIT TIMIKA",
        "UNIT LANNY JAYA",
        "UNIT NABIRE",
        "UNIT PUNCAK / ILAGA",
        "UNIT NDUGA",
        "UNIT INTAN JAYA",
        "UNIT YAHUKIMO",
        "UNIT PEGUNUNGAN BINTANG",
        "UNIT PUNCAK JAYA"
    ],
    "ANALIS": [
        "WILAYAH NDUGA",
        "WILAYAH PUNCAK",
        "WILAYAH INTAN JAYA",
        "WILAYAH PEGUNUNGAN BINTANG",
        "WILAYAH YAHUKIMO",
        "WILAYAH MIMIKA",
        "WILAYAH LANNY JAYA",
        "WILAYAH NABIRE",
        "WILAYAH JAYAPURA",
        "WILAYAH PUNCAK JAYA"
    ]
}

# Logger setup
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("satgas-backend")
