"""API routes for audit sessions and reporting."""

from fastapi import APIRouter, HTTPException
from app.models.schemas import CreateSessionRequest, Finding
from app.services.session_service import session_service

router = APIRouter(prefix="/sessions", tags=["Audit Sessions"])


@router.post("/")
async def create_session(req: CreateSessionRequest):
    """Create a new audit session to group findings."""
    return session_service.create(req)


@router.get("/")
async def list_sessions():
    """List all audit sessions."""
    return session_service.list_all()


@router.get("/{session_id}")
async def get_session(session_id: str):
    session = session_service.get(session_id)
    if not session:
        raise HTTPException(404, "Session not found")
    return session


@router.post("/{session_id}/findings")
async def add_finding(session_id: str, finding: Finding):
    """Add a security finding to a session."""
    finding.session_id = session_id
    result = session_service.add_finding(finding)
    if "error" in result:
        raise HTTPException(404, result["error"])
    return result


@router.post("/{session_id}/close")
async def close_session(session_id: str):
    """Close an audit session."""
    session = session_service.close(session_id)
    if not session:
        raise HTTPException(404, "Session not found")
    return session


@router.get("/{session_id}/report")
async def export_report(session_id: str):
    """Export session as a structured audit report."""
    report = session_service.export_report(session_id)
    if not report:
        raise HTTPException(404, "Session not found")
    return report
