"""Service for managing audit sessions and findings."""

import uuid
import json
import logging
from datetime import datetime
from typing import Optional
from app.config import settings
from app.models.schemas import AuditSession, CreateSessionRequest, Finding

logger = logging.getLogger(__name__)


class SessionService:
    def __init__(self):
        self._sessions: dict[str, AuditSession] = {}

    def create(self, req: CreateSessionRequest) -> AuditSession:
        session_id = str(uuid.uuid4())[:8]
        session = AuditSession(
            id=session_id,
            name=req.name,
            company=req.company,
            auditor=req.auditor,
            created_at=datetime.now(),
            notes=req.notes,
        )
        self._sessions[session_id] = session
        self._persist(session)
        return session

    def get(self, session_id: str) -> Optional[AuditSession]:
        return self._sessions.get(session_id)

    def list_all(self) -> list[AuditSession]:
        return list(self._sessions.values())

    def add_finding(self, finding: Finding) -> dict:
        session = self._sessions.get(finding.session_id)
        if not session:
            return {"error": "Session not found"}
        entry = {
            "id": str(uuid.uuid4())[:8],
            "category": finding.category,
            "severity": finding.severity,
            "title": finding.title,
            "description": finding.description,
            "evidence": finding.evidence,
            "recommendation": finding.recommendation,
            "timestamp": datetime.now().isoformat(),
        }
        session.findings.append(entry)
        self._persist(session)
        return entry

    def close(self, session_id: str) -> Optional[AuditSession]:
        session = self._sessions.get(session_id)
        if session:
            session.status = "closed"
            self._persist(session)
        return session

    def export_report(self, session_id: str) -> Optional[dict]:
        """Export session as a structured report."""
        session = self._sessions.get(session_id)
        if not session:
            return None

        severity_order = {"critical": 0, "high": 1, "medium": 2, "low": 3, "info": 4}
        sorted_findings = sorted(
            session.findings,
            key=lambda f: severity_order.get(f.get("severity", "info"), 5),
        )

        return {
            "audit_report": {
                "session": session.model_dump(),
                "findings_by_severity": {
                    sev: [f for f in sorted_findings if f.get("severity") == sev]
                    for sev in severity_order
                },
                "summary": {
                    "total": len(sorted_findings),
                    "critical": sum(1 for f in sorted_findings if f.get("severity") == "critical"),
                    "high": sum(1 for f in sorted_findings if f.get("severity") == "high"),
                    "medium": sum(1 for f in sorted_findings if f.get("severity") == "medium"),
                    "low": sum(1 for f in sorted_findings if f.get("severity") == "low"),
                    "info": sum(1 for f in sorted_findings if f.get("severity") == "info"),
                },
                "generated_at": datetime.now().isoformat(),
            }
        }

    def _persist(self, session: AuditSession):
        path = settings.REPORTS_DIR / f"session_{session.id}.json"
        with open(path, "w") as f:
            json.dump(session.model_dump(), f, indent=2, default=str)


session_service = SessionService()
