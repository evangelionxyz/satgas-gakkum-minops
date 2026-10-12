from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uvicorn

from config import logger
from routers.docx_merger import router as docx_merger_router

app = FastAPI(
    title="Satgas Gakkum Minops LAPHAR Engine",
    description="Word Document Merger Engine for Operasi Damai Cartenz 2026",
    version="1.0.0"
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register Router
app.include_router(docx_merger_router)

@app.get("/api/health", tags=["System"])
async def health_check():
    """System health check endpoint."""
    return {
        "status": "healthy",
        "service": "satgas-gakkum-minops-api",
        "version": "1.0.0"
    }

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Global unhandled error at {request.url.path}: {exc}")
    return JSONResponse(
        status_code=500,
        content={"detail": f"Terjadi kesalahan pada server: {str(exc)}"}
    )

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
