from fastapi import APIRouter, HTTPException, Body, UploadFile, File, Form
from fastapi.responses import FileResponse
from app.models.schemas import (
    CreateSessionRequest, Finding, ReasonRequest, EventRequest,
)
from app.services.session_service import session_service

router = APIRouter(prefix="/sessions", tags=["Audit Sessions"])


# ─── sesiones ───
@router.post("/")
async def create_session(req: CreateSessionRequest):
    return session_service.create(req)


@router.get("/")
async def list_sessions():
    return session_service.list_all()


@router.get("/{session_id}")
async def get_session(session_id: str):
    s = session_service.get(session_id)
    if not s:
        raise HTTPException(404, "Session not found")
    return s


@router.patch("/{session_id}")
async def update_session(session_id: str, updates: dict = Body(...)):
    s = session_service.update_session(session_id, updates)
    if not s:
        raise HTTPException(404, "Session not found")
    return s


@router.delete("/{session_id}")
async def delete_session(session_id: str):
    if not session_service.delete_session(session_id):
        raise HTTPException(404, "Session not found")
    return {"deleted": True}


@router.post("/{session_id}/close")
async def close_session(session_id: str, req: ReasonRequest = ReasonRequest()):
    s = session_service.close(session_id, req.reason)
    if not s:
        raise HTTPException(404, "Session not found")
    return s


@router.post("/{session_id}/reopen")
async def reopen_session(session_id: str, req: ReasonRequest = ReasonRequest()):
    if not (req.reason or "").strip():
        raise HTTPException(400, "Debes indicar un motivo para reabrir la sesión")
    s = session_service.reopen(session_id, req.reason.strip())
    if not s:
        raise HTTPException(404, "Session not found")
    return s


@router.post("/{session_id}/events")
async def add_event(session_id: str, req: EventRequest):
    if not (req.message or "").strip():
        raise HTTPException(400, "El mensaje no puede estar vacío")
    r = session_service.add_event(session_id, req.type, req.message.strip())
    if "error" in r:
        raise HTTPException(404, r["error"])
    return r


# ─── hallazgos ───
@router.post("/{session_id}/findings")
async def add_finding(session_id: str, finding: Finding):
    finding.session_id = session_id
    r = session_service.add_finding(finding)
    if "error" in r:
        code = 400 if "cerrada" in r["error"] else 404
        raise HTTPException(code, r["error"])
    return r


@router.patch("/{session_id}/findings/{finding_id}")
async def update_finding(session_id: str, finding_id: str, updates: dict = Body(...)):
    r = session_service.update_finding(session_id, finding_id, updates)
    if "error" in r:
        raise HTTPException(404, r["error"])
    return r


@router.delete("/{session_id}/findings/{finding_id}")
async def delete_finding(session_id: str, finding_id: str):
    r = session_service.delete_finding(session_id, finding_id)
    if "error" in r:
        raise HTTPException(404, r["error"])
    return r


# ─── fotos de evidencia ───
@router.post("/{session_id}/findings/{finding_id}/photos")
async def upload_photo(session_id: str, finding_id: str,
                       file: UploadFile = File(...), caption: str = Form("")):
    ct = (file.content_type or "").lower()
    if not ct.startswith("image/"):
        raise HTTPException(400, "El fichero debe ser una imagen")
    content = await file.read()
    if len(content) > 15 * 1024 * 1024:
        raise HTTPException(400, "La imagen supera 15 MB")
    r = session_service.add_photo(session_id, finding_id, file.filename, content, ct, caption)
    if "error" in r:
        raise HTTPException(404, r["error"])
    return r


@router.delete("/{session_id}/findings/{finding_id}/photos/{photo_id}")
async def delete_photo(session_id: str, finding_id: str, photo_id: str):
    r = session_service.delete_photo(session_id, finding_id, photo_id)
    if "error" in r:
        raise HTTPException(404, r["error"])
    return r


@router.get("/{session_id}/findings/{finding_id}/photos/{photo_id}")
async def get_photo(session_id: str, finding_id: str, photo_id: str):
    p = session_service.get_photo(session_id, finding_id, photo_id)
    if not p:
        raise HTTPException(404, "Photo not found")
    return FileResponse(p["path"], media_type=p.get("content_type", "image/png"),
                        filename=p.get("filename"))


# ─── informe ───
@router.get("/{session_id}/report")
async def export_report(session_id: str):
    r = session_service.export_report(session_id)
    if not r:
        raise HTTPException(404, "Session not found")
    return r


@router.get("/{session_id}/report/pdf")
async def export_report_pdf(session_id: str):
    s = session_service.get(session_id)
    if not s:
        raise HTTPException(404, "Session not found")
    try:
        path = session_service.generate_pdf(session_id)
    except Exception as e:
        raise HTTPException(500, f"No se pudo generar el PDF: {e}")
    safe = "".join(c for c in (s.name or "informe") if c.isalnum() or c in " -_").strip() or "informe"
    return FileResponse(path, media_type="application/pdf",
                        filename=f"Informe_{safe}.pdf")
