"""Audit session and findings service.

Sessions se cargan de disco al arrancar (REPORTS_DIR/session_*.json) y se
persisten en cada cambio. Cada sesión mantiene:
  - findings: lista de hallazgos (con fotos de evidencia opcionales)
  - events:   timeline (creación, hallazgos +/-/editados, cierre/reapertura
              con motivo, comentarios) para trazabilidad completa
  - status:   active (abierta) | closed (cerrada)

Las fotos de evidencia se guardan en EVIDENCE_DIR/{sid}/{fid}/ y se referencian
desde cada hallazgo. El informe PDF se genera con reportlab.
"""
import os
import uuid
import json
import shutil
import logging
from datetime import datetime
from typing import Optional
from app.config import settings
from app.models.schemas import AuditSession, CreateSessionRequest, Finding

logger = logging.getLogger(__name__)

SEV_ORDER = {"critical": 0, "high": 1, "medium": 2, "low": 3, "info": 4}
_ALLOWED_UPDATE = {"category", "severity", "title", "description",
                   "evidence", "recommendation", "cvss"}


def _now() -> str:
    return datetime.now().isoformat()


class SessionService:
    def __init__(self):
        self._sessions: dict[str, AuditSession] = {}
        self._load_existing()

    # ─────────────────────────── persistencia ───────────────────────────
    def _load_existing(self):
        try:
            settings.REPORTS_DIR.mkdir(parents=True, exist_ok=True)
            count = 0
            for path in settings.REPORTS_DIR.glob("session_*.json"):
                try:
                    with open(path, "r") as f:
                        data = json.load(f)
                    sess = AuditSession.model_validate(data)
                    self._sessions[sess.id] = sess
                    count += 1
                except Exception as e:
                    logger.warning(f"Could not load session from {path}: {e}")
            if count:
                logger.info(f"Rehydrated {count} sessions from disk")
        except Exception as e:
            logger.error(f"Failed to load existing sessions: {e}")

    def _persist(self, s: AuditSession):
        s.updated_at = datetime.now()
        settings.REPORTS_DIR.mkdir(parents=True, exist_ok=True)
        path = settings.REPORTS_DIR / f"session_{s.id}.json"
        with open(path, "w") as f:
            json.dump(s.model_dump(), f, indent=2, default=str)

    def _log(self, s: AuditSession, etype: str, message: str, **meta):
        ev = {"id": str(uuid.uuid4())[:8], "type": etype, "message": message,
              "timestamp": _now()}
        ev.update(meta)
        s.events.append(ev)
        return ev

    # ─────────────────────────── sesiones ───────────────────────────
    def create(self, req: CreateSessionRequest) -> AuditSession:
        sid = str(uuid.uuid4())[:8]
        s = AuditSession(
            id=sid, name=req.name, company=req.company, auditor=req.auditor,
            created_at=datetime.now(), notes=req.notes, scope=req.scope,
        )
        self._log(s, "session_created", f"Sesión «{req.name}» creada")
        self._sessions[sid] = s
        self._persist(s)
        return s

    def get(self, sid: str) -> Optional[AuditSession]:
        return self._sessions.get(sid)

    def list_all(self) -> list[AuditSession]:
        return sorted(self._sessions.values(),
                      key=lambda s: s.created_at or datetime.min, reverse=True)

    def update_session(self, sid: str, updates: dict) -> Optional[AuditSession]:
        s = self._sessions.get(sid)
        if not s:
            return None
        for k in ("name", "company", "auditor", "notes", "scope"):
            if k in updates and updates[k] is not None:
                setattr(s, k, updates[k])
        self._log(s, "session_updated", "Metadatos de la sesión actualizados")
        self._persist(s)
        return s

    def close(self, sid: str, reason: Optional[str] = None) -> Optional[AuditSession]:
        s = self._sessions.get(sid)
        if not s:
            return None
        s.status = "closed"
        s.closed_at = datetime.now()
        self._log(s, "session_closed",
                  f"Sesión cerrada{': ' + reason if reason else ''}", reason=reason or "")
        self._persist(s)
        return s

    def reopen(self, sid: str, reason: str) -> Optional[AuditSession]:
        s = self._sessions.get(sid)
        if not s:
            return None
        s.status = "active"
        s.closed_at = None
        self._log(s, "session_reopened", f"Sesión reabierta: {reason}", reason=reason)
        self._persist(s)
        return s

    def add_event(self, sid: str, etype: str, message: str) -> dict:
        s = self._sessions.get(sid)
        if not s:
            return {"error": "Session not found"}
        etype = etype if etype in ("comment", "note", "correction") else "comment"
        ev = self._log(s, etype, message)
        self._persist(s)
        return ev

    # ─────────────────────────── hallazgos ───────────────────────────
    def add_finding(self, finding: Finding) -> dict:
        s = self._sessions.get(finding.session_id)
        if not s:
            return {"error": "Session not found"}
        if s.status == "closed":
            return {"error": "La sesión está cerrada. Reábrela para añadir hallazgos."}
        entry = {
            "id": str(uuid.uuid4())[:8],
            "category": finding.category,
            "severity": finding.severity,
            "title": finding.title,
            "description": finding.description,
            "evidence": finding.evidence,
            "recommendation": finding.recommendation,
            "cvss": finding.cvss,
            "photos": [],
            "timestamp": _now(),
        }
        s.findings.append(entry)
        self._log(s, "finding_added", f"Hallazgo añadido: {finding.title}",
                  finding_id=entry["id"], severity=finding.severity)
        self._persist(s)
        return entry

    def update_finding(self, sid: str, fid: str, updates: dict) -> dict:
        s = self._sessions.get(sid)
        if not s:
            return {"error": "Session not found"}
        for f in s.findings:
            if f.get("id") == fid:
                changed = []
                for k, v in updates.items():
                    if k in _ALLOWED_UPDATE and f.get(k) != v:
                        f[k] = v
                        changed.append(k)
                f["updated_at"] = _now()
                self._log(s, "finding_updated",
                          f"Hallazgo editado: {f.get('title')}"
                          + (f" ({', '.join(changed)})" if changed else ""),
                          finding_id=fid)
                self._persist(s)
                return f
        return {"error": "Finding not found"}

    def delete_finding(self, sid: str, fid: str) -> dict:
        s = self._sessions.get(sid)
        if not s:
            return {"error": "Session not found"}
        target = next((f for f in s.findings if f.get("id") == fid), None)
        if not target:
            return {"error": "Finding not found"}
        s.findings = [f for f in s.findings if f.get("id") != fid]
        # borrar carpeta de evidencias del hallazgo
        try:
            d = settings.EVIDENCE_DIR / sid / fid
            if d.exists():
                shutil.rmtree(d, ignore_errors=True)
        except Exception:
            pass
        self._log(s, "finding_deleted", f"Hallazgo eliminado: {target.get('title')}",
                  finding_id=fid)
        self._persist(s)
        return {"deleted": True, "remaining": len(s.findings)}

    def _find(self, sid: str, fid: str):
        s = self._sessions.get(sid)
        if not s:
            return None, None
        return s, next((f for f in s.findings if f.get("id") == fid), None)

    # ─────────────────────────── fotos de evidencia ───────────────────────────
    def add_photo(self, sid: str, fid: str, orig_name: str, content: bytes,
                  content_type: str, caption: str = "") -> dict:
        s, f = self._find(sid, fid)
        if not s:
            return {"error": "Session not found"}
        if not f:
            return {"error": "Finding not found"}
        ext = os.path.splitext(orig_name or "")[1].lower() or {
            "image/png": ".png", "image/jpeg": ".jpg", "image/gif": ".gif",
            "image/webp": ".webp",
        }.get(content_type, ".png")
        pid = str(uuid.uuid4())[:12]
        d = settings.EVIDENCE_DIR / sid / fid
        d.mkdir(parents=True, exist_ok=True)
        stored = d / f"{pid}{ext}"
        with open(stored, "wb") as out:
            out.write(content)
        meta = {
            "id": pid,
            "filename": orig_name or f"{pid}{ext}",
            "path": str(stored),
            "content_type": content_type or "image/png",
            "caption": caption or "",
            "size": len(content),
            "uploaded_at": _now(),
        }
        f.setdefault("photos", []).append(meta)
        self._log(s, "photo_added", f"Evidencia añadida a: {f.get('title')}",
                  finding_id=fid)
        self._persist(s)
        return meta

    def delete_photo(self, sid: str, fid: str, pid: str) -> dict:
        s, f = self._find(sid, fid)
        if not s or not f:
            return {"error": "Not found"}
        photo = next((p for p in f.get("photos", []) if p.get("id") == pid), None)
        if not photo:
            return {"error": "Photo not found"}
        try:
            if photo.get("path") and os.path.isfile(photo["path"]):
                os.remove(photo["path"])
        except Exception:
            pass
        f["photos"] = [p for p in f.get("photos", []) if p.get("id") != pid]
        self._persist(s)
        return {"deleted": True}

    def get_photo(self, sid: str, fid: str, pid: str):
        _, f = self._find(sid, fid)
        if not f:
            return None
        photo = next((p for p in f.get("photos", []) if p.get("id") == pid), None)
        if not photo or not photo.get("path") or not os.path.isfile(photo["path"]):
            return None
        return photo

    # ─────────────────────────── informe ───────────────────────────
    def export_report(self, sid: str) -> Optional[dict]:
        s = self._sessions.get(sid)
        if not s:
            return None
        sf = sorted(s.findings, key=lambda f: SEV_ORDER.get(f.get("severity", "info"), 5))
        return {
            "audit_report": {
                "session": s.model_dump(),
                "findings_by_severity": {
                    sev: [f for f in sf if f.get("severity") == sev] for sev in SEV_ORDER
                },
                "summary": {
                    "total": len(sf),
                    **{sev: sum(1 for f in sf if f.get("severity") == sev) for sev in SEV_ORDER},
                },
                "generated_at": _now(),
            },
        }

    def delete_session(self, sid: str) -> bool:
        s = self._sessions.pop(sid, None)
        if not s:
            return False
        for p in (settings.REPORTS_DIR / f"session_{sid}.json",
                  settings.REPORTS_DIR / f"informe_{sid}.pdf"):
            try:
                if p.exists():
                    p.unlink()
            except Exception:
                pass
        try:
            d = settings.EVIDENCE_DIR / sid
            if d.exists():
                shutil.rmtree(d, ignore_errors=True)
        except Exception:
            pass
        return True

    def generate_pdf(self, sid: str) -> Optional[str]:
        s = self._sessions.get(sid)
        if not s:
            return None
        from app.utils.pdf_report import build_session_pdf
        out = settings.REPORTS_DIR / f"informe_{s.id}.pdf"
        build_session_pdf(s.model_dump(), str(out))
        return str(out)


session_service = SessionService()
