from fastapi import APIRouter, HTTPException, Body
from app.models.schemas import CreateSessionRequest, Finding
from app.services.session_service import session_service

router = APIRouter(prefix="/sessions", tags=["Audit Sessions"])

@router.post("/")
async def create_session(req: CreateSessionRequest):
    return session_service.create(req)

@router.get("/")
async def list_sessions():
    return session_service.list_all()

@router.get("/{session_id}")
async def get_session(session_id: str):
    s = session_service.get(session_id)
    if not s: raise HTTPException(404, "Session not found")
    return s

@router.post("/{session_id}/findings")
async def add_finding(session_id: str, finding: Finding):
    finding.session_id = session_id
    r = session_service.add_finding(finding)
    if "error" in r: raise HTTPException(404, r["error"])
    return r

@router.patch("/{session_id}/findings/{finding_id}")
async def update_finding(session_id: str, finding_id: str, updates: dict = Body(...)):
    r = session_service.update_finding(session_id, finding_id, updates)
    if "error" in r: raise HTTPException(404, r["error"])
    return r

@router.delete("/{session_id}/findings/{finding_id}")
async def delete_finding(session_id: str, finding_id: str):
    r = session_service.delete_finding(session_id, finding_id)
    if "error" in r: raise HTTPException(404, r["error"])
    return r

@router.post("/{session_id}/close")
async def close_session(session_id: str):
    s = session_service.close(session_id)
    if not s: raise HTTPException(404, "Session not found")
    return s

@router.post("/{session_id}/reopen")
async def reopen_session(session_id: str):
    s = session_service.reopen(session_id)
    if not s: raise HTTPException(404, "Session not found")
    return s

@router.get("/{session_id}/report")
async def export_report(session_id: str):
    r = session_service.export_report(session_id)
    if not r: raise HTTPException(404, "Session not found")
    return r
