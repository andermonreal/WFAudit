"""Audit session and findings service.

CRITICAL FIX: Sessions are now LOADED from disk on startup, not just persisted.
Previously, sessions were saved as JSON files in REPORTS_DIR via `_persist()`,
but `__init__` only initialized an empty dict — meaning every restart wiped
the in-memory session list. Now `_load_existing()` reads all session_*.json
files on init and rehydrates the session map.
"""
import os
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
        self._load_existing()

    def _load_existing(self):
        """Scan REPORTS_DIR for session_*.json files and rehydrate sessions.
        Called on startup so sessions persist across restarts."""
        try:
            settings.REPORTS_DIR.mkdir(parents=True, exist_ok=True)
            count = 0
            for path in settings.REPORTS_DIR.glob("session_*.json"):
                try:
                    with open(path, "r") as f:
                        data = json.load(f)
                    # Validate via pydantic — discards malformed files
                    sess = AuditSession.model_validate(data)
                    self._sessions[sess.id] = sess
                    count += 1
                except Exception as e:
                    logger.warning(f"Could not load session from {path}: {e}")
            if count:
                logger.info(f"Rehydrated {count} sessions from disk")
        except Exception as e:
            logger.error(f"Failed to load existing sessions: {e}")

    def create(self, req: CreateSessionRequest) -> AuditSession:
        sid = str(uuid.uuid4())[:8]
        s = AuditSession(
            id=sid, name=req.name, company=req.company, auditor=req.auditor,
            created_at=datetime.now(), notes=req.notes,
        )
        self._sessions[sid] = s
        self._persist(s)
        return s

    def get(self, sid: str) -> Optional[AuditSession]:
        return self._sessions.get(sid)

    def list_all(self) -> list[AuditSession]:
        # Sort newest first
        return sorted(self._sessions.values(),
                      key=lambda s: s.created_at or datetime.min,
                      reverse=True)

    def add_finding(self, finding: Finding) -> dict:
        s = self._sessions.get(finding.session_id)
        if not s:
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
        s.findings.append(entry)
        self._persist(s)
        return entry

    def update_finding(self, sid: str, fid: str, updates: dict) -> dict:
        """Update an existing finding (used by frontend Edit button)."""
        s = self._sessions.get(sid)
        if not s:
            return {"error": "Session not found"}
        for f in s.findings:
            if f.get("id") == fid:
                for k, v in updates.items():
                    if k in {"category", "severity", "title", "description",
                             "evidence", "recommendation"}:
                        f[k] = v
                f["updated_at"] = datetime.now().isoformat()
                self._persist(s)
                return f
        return {"error": "Finding not found"}

    def delete_finding(self, sid: str, fid: str) -> dict:
        s = self._sessions.get(sid)
        if not s:
            return {"error": "Session not found"}
        before = len(s.findings)
        s.findings = [f for f in s.findings if f.get("id") != fid]
        if len(s.findings) == before:
            return {"error": "Finding not found"}
        self._persist(s)
        return {"deleted": True, "remaining": len(s.findings)}

    def close(self, sid: str) -> Optional[AuditSession]:
        s = self._sessions.get(sid)
        if s:
            s.status = "closed"
            self._persist(s)
        return s

    def reopen(self, sid: str) -> Optional[AuditSession]:
        s = self._sessions.get(sid)
        if s:
            s.status = "active"
            self._persist(s)
        return s

    def export_report(self, sid: str) -> Optional[dict]:
        s = self._sessions.get(sid)
        if not s:
            return None
        sev_order = {"critical": 0, "high": 1, "medium": 2, "low": 3, "info": 4}
        sf = sorted(s.findings, key=lambda f: sev_order.get(f.get("severity", "info"), 5))
        return {
            "audit_report": {
                "session": s.model_dump(),
                "findings_by_severity": {
                    sev: [f for f in sf if f.get("severity") == sev]
                    for sev in sev_order
                },
                "summary": {
                    "total": len(sf),
                    **{sev: sum(1 for f in sf if f.get("severity") == sev) for sev in sev_order},
                },
                "generated_at": datetime.now().isoformat(),
            },
        }

    def _persist(self, s: AuditSession):
        settings.REPORTS_DIR.mkdir(parents=True, exist_ok=True)
        path = settings.REPORTS_DIR / f"session_{s.id}.json"
        with open(path, "w") as f:
            json.dump(s.model_dump(), f, indent=2, default=str)


session_service = SessionService()
