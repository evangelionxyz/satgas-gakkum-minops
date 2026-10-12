from typing import Optional, List, Dict, Any
from pydantic import BaseModel, EmailStr, Field

# ============================================================================
# AUTH & USER SCHEMAS
# ============================================================================

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserRegister(BaseModel):
    name: str = Field(..., min_length=2)
    email: EmailStr
    password: str = Field(..., min_length=6)
    subsatgas: str = "MINOPS"
    unit_name: str = "ALL"
    role: str = "operator"  # admin, operator, viewer

class UserResponse(BaseModel):
    id: str
    name: str
    email: EmailStr
    subsatgas: str
    unit_name: str
    role: str
    status: str
    created_at: Optional[str] = None

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str = Field(..., min_length=6)

class UpdateUserRequest(BaseModel):
    name: Optional[str] = None
    subsatgas: Optional[str] = None
    unit_name: Optional[str] = None
    role: Optional[str] = None
    status: Optional[str] = None
    new_password: Optional[str] = None

# ============================================================================
# DAILY REPORT (LAPHAR) SCHEMAS
# ============================================================================

class DailyReportCreate(BaseModel):
    report_date: str  # YYYY-MM-DD
    satgas_name: str = "Satgas Gakkum"
    subsatgas: str    # 'MINOPS', 'LIDIK', 'INVESTIGASI', 'ANALIS'
    unit_name: str    # e.g. 'UNIT JAYAPURA'
    activity_time: str # e.g. '08.00 - 12.00 WIT'
    personnel_count: str # e.g. '5 Pers', 'Brigpol Dwi'
    location: str     # Lokasi kegiatan
    activity: str     # Uraian kegiatan
    results: str      # Hasil yang dicapai
    description: Optional[str] = "" # Keterangan
    documentation_urls: Optional[List[str]] = []

class DailyReportUpdate(BaseModel):
    report_date: Optional[str] = None
    satgas_name: Optional[str] = None
    subsatgas: Optional[str] = None
    unit_name: Optional[str] = None
    activity_time: Optional[str] = None
    personnel_count: Optional[str] = None
    location: Optional[str] = None
    activity: Optional[str] = None
    results: Optional[str] = None
    description: Optional[str] = None
    documentation_urls: Optional[List[str]] = None

class DailyReportResponse(BaseModel):
    id: str
    report_date: str
    satgas_name: str
    subsatgas: str
    unit_name: str
    activity_time: str
    personnel_count: str
    location: str
    activity: str
    results: str
    description: Optional[str] = ""
    documentation_urls: Optional[List[str]] = []
    created_by: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

class BulkDailyReportCreate(BaseModel):
    reports: List[DailyReportCreate]

# ============================================================================
# PROMINENT INCIDENTS (KEJADIAN MENONJOL) SCHEMAS
# ============================================================================

class IncidentCreate(BaseModel):
    report_date: str  # YYYY-MM-DD
    incident_time: str # Hari/Tgl/Waktu kejadian
    location: str      # Lokasi kejadian
    incident_description: str # Uraian kejadian
    losses_or_results: str    # Kerugian / Hasil
    actions_taken: str        # Langkah-langkah
    notes: Optional[str] = "" # Keterangan

class IncidentUpdate(BaseModel):
    incident_time: Optional[str] = None
    location: Optional[str] = None
    incident_description: Optional[str] = None
    losses_or_results: Optional[str] = None
    actions_taken: Optional[str] = None
    notes: Optional[str] = None

class IncidentResponse(BaseModel):
    id: str
    report_date: str
    incident_time: str
    location: str
    incident_description: str
    losses_or_results: str
    actions_taken: str
    notes: Optional[str] = ""
    created_by: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None

# ============================================================================
# REPORT CONFIG / METADATA SCHEMAS
# ============================================================================

class ReportConfigUpdate(BaseModel):
    signatory_title: Optional[str] = None
    signatory_name: Optional[str] = None
    signatory_rank: Optional[str] = None
    signatory_place: Optional[str] = None
    status: Optional[str] = None

class ReportConfigResponse(BaseModel):
    id: Optional[str] = None
    report_date: str
    signatory_title: str
    signatory_name: str
    signatory_rank: str
    signatory_place: str
    status: str

# ============================================================================
# AGGREGATED FULL LAPHAR RESPONSE SCHEMAS
# ============================================================================

class SubsatgasSection(BaseModel):
    subsatgas_name: str
    units: Dict[str, List[DailyReportResponse]]

class FullLapharResponse(BaseModel):
    report_date: str
    satgas_name: str = "Satgas Gakkum"
    config: ReportConfigResponse
    minops: Dict[str, List[DailyReportResponse]]
    lidik: Dict[str, List[DailyReportResponse]]
    investigasi: Dict[str, List[DailyReportResponse]]
    analis: Dict[str, List[DailyReportResponse]]
    incidents: List[IncidentResponse]
    stats: Dict[str, int]
