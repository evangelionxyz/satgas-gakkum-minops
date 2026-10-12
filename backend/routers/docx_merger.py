from pathlib import Path
from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Response
from pydantic import BaseModel
from typing import List, Optional
import os

from services.docx_service import parse_docx_bytes, merge_items_to_master
from config import logger

router = APIRouter(prefix="/api/docx", tags=["Word Docx Import & Merger"])

TEMPLATE_PATH = Path(__file__).parent.parent / "templates" / "TEMPLATE_LAPHAR_MASTER.docx"

class SignatureConfig(BaseModel):
    signature_city: Optional[str] = "Jayapura"
    kasatgas_name: Optional[str] = "I G.G. ERA ADHINATA, S.I.K."
    kasatgas_rank_nrp: Optional[str] = "KOMISARIS BESAR POLISI NRP 80020993"

class MergeRequest(BaseModel):
    date: str
    items: List[dict]
    incidents: Optional[List[dict]] = []
    signature_config: Optional[SignatureConfig] = None

@router.post("/parse-files")
async def parse_docx_files(
    files: List[UploadFile] = File(...)
):
    """
    Parse multiple uploaded DOCX files from regional units or subsatgas.
    Extracts all activity rows, incident rows, and auto-detects subsatgas and unit.
    """
    if not files:
        raise HTTPException(status_code=400, detail="Tidak ada file yang diunggah.")

    all_items = []
    all_incidents = []
    file_summaries = []
    detected_dates = []

    for file in files:
        if not file.filename.lower().endswith(".docx"):
            continue

        try:
            content = await file.read()
            res = parse_docx_bytes(content, file.filename)
            
            if res.get("detected_date"):
                detected_dates.append(res["detected_date"])

            file_summaries.append({
                "filename": file.filename,
                "subsatgas": res["subsatgas"],
                "items_count": len(res["items"]),
                "incidents_count": len(res["incidents"]),
                "detected_date": res["detected_date"]
            })

            all_items.extend(res["items"])
            all_incidents.extend(res["incidents"])
        except Exception as e:
            logger.error(f"Gagal memproses file {file.filename}: {e}")
            file_summaries.append({
                "filename": file.filename,
                "error": str(e)
            })

    # Pick the most frequent detected date or default
    overall_date = None
    if detected_dates:
        overall_date = max(set(detected_dates), key=detected_dates.count)

    return {
        "total_files": len(files),
        "detected_date": overall_date,
        "files": file_summaries,
        "total_items": len(all_items),
        "total_incidents": len(all_incidents),
        "items": all_items,
        "incidents": all_incidents
    }

@router.post("/merge-to-docx")
async def merge_items_to_docx_endpoint(
    payload: MergeRequest
):
    """
    Merge the provided items and incidents into the official LAPHAR master Word document template.
    Returns the compiled DOCX as a downloadable binary.
    """
    if not os.path.exists(TEMPLATE_PATH):
        raise HTTPException(status_code=500, detail="File master template Word tidak ditemukan.")

    sig_cfg_dict = payload.signature_config.dict() if payload.signature_config else None

    try:
        docx_bytes = merge_items_to_master(
            str(TEMPLATE_PATH),
            payload.items,
            payload.incidents or [],
            payload.date,
            sig_cfg_dict
        )

        filename = f"LAPHAR_{payload.date}_SATGAS_GAKKUM.docx"
        return Response(
            content=docx_bytes,
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}"'
            }
        )
    except Exception as e:
        logger.error(f"Gagal melakukan merge Word: {e}")
        raise HTTPException(status_code=500, detail=f"Gagal menggabungkan dokumen Word: {str(e)}")

@router.post("/upload-and-merge")
async def upload_and_merge_direct(
    files: List[UploadFile] = File(...),
    target_date: Optional[str] = Form(None)
):
    """
    Direct upload & merge in 1 single step: Upload multiple DOCX files, parse and merge into master template.
    """
    if not os.path.exists(TEMPLATE_PATH):
        raise HTTPException(status_code=500, detail="Master template Word tidak ditemukan.")

    all_items = []
    all_incidents = []
    detected_dates = []

    for file in files:
        if not file.filename.lower().endswith(".docx"):
            continue
        try:
            content = await file.read()
            res = parse_docx_bytes(content, file.filename)
            if res.get("detected_date"):
                detected_dates.append(res["detected_date"])
            all_items.extend(res["items"])
            all_incidents.extend(res["incidents"])
        except Exception as e:
            logger.error(f"Error parsing {file.filename}: {e}")

    date_to_use = target_date
    if not date_to_use and detected_dates:
        date_to_use = max(set(detected_dates), key=detected_dates.count)
    if not date_to_use:
        from datetime import date
        date_to_use = date.today().isoformat()

    docx_bytes = merge_items_to_master(
        str(TEMPLATE_PATH),
        all_items,
        all_incidents,
        date_to_use,
        None
    )

    filename = f"LAPHAR_{date_to_use}_SATGAS_GAKKUM.docx"
    return Response(
        content=docx_bytes,
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"'
        }
    )
