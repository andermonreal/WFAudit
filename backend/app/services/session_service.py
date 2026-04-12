"""Audit session and findings service."""
import uuid, json, logging
from datetime import datetime
from typing import Optional
from app.config import settings
from app.models.schemas import AuditSession, CreateSessionRequest, Finding
logger = logging.getLogger(__name__)

class SessionService:
    def __init__(self):
        self._sessions: dict[str, AuditSession] = {}

    def create(self, req: CreateSessionRequest) -> AuditSession:
        sid = str(uuid.uuid4())[:8]
        s = AuditSession(id=sid, name=req.name, company=req.company, auditor=req.auditor, created_at=datetime.now(), notes=req.notes)
        self._sessions[sid] = s
        self._persist(s)
        return s

    def get(self, sid: str) -> Optional[AuditSession]:
        return self._sessions.get(sid)

    def list_all(self) -> list[AuditSession]:
        return list(self._sessions.values())

    def add_finding(self, finding: Finding) -> dict:
        s = self._sessions.get(finding.session_id)
        if not s:
            return {"error": "Session not found"}
        entry = {"id": str(uuid.uuid4())[:8], "category": finding.category, "severity": finding.severity, "title": finding.title, "description": finding.description, "evidence": finding.evidence, "recommendation": finding.recommendation, "timestamp": datetime.now().isoformat()}
        s.findings.append(entry)
        self._persist(s)
        return entry

    def close(self, sid: str) -> Optional[AuditSession]:
        s = self._sessions.get(sid)
        if s:
            s.status = "closed"
            self._persist(s)
        return s

    def export_report(self, sid: str) -> Optional[dict]:
        s = self._sessions.get(sid)
        if not s:
            return None
        sev_order = {"critical": 0, "high": 1, "medium": 2, "low": 3, "info": 4}
        sf = sorted(s.findings, key=lambda f: sev_order.get(f.get("severity", "info"), 5))
        return {"audit_report": {"session": s.model_dump(), "findings_by_severity": {sev: [f for f in sf if f.get("severity") == sev] for sev in sev_order}, "summary": {"total": len(sf), **{sev: sum(1 for f in sf if f.get("severity") == sev) for sev in sev_order}}, "generated_at": datetime.now().isoformat()}}

    def _persist(self, s: AuditSession):
        path = settings.REPORTS_DIR / f"session_{s.id}.json"
        with open(path, "w") as f:
            json.dump(s.model_dump(), f, indent=2, default=str)

session_service = SessionService()
