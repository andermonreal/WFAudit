"""
mitmproxy addon — Logs each HTTP(S) flow to a JSON Lines file.
Compatible with mitmproxy 8.x, 9.x, 10.x, 11.x

Each line is a JSON object with request/response details.
Output file set via WFAUDIT_FLOW_LOG env var or default /tmp/wfaudit_mitm_flows.jsonl
"""

import json
import time
import os
import sys

OUTPUT_FILE = os.environ.get("WFAUDIT_FLOW_LOG", "/tmp/wfaudit_mitm_flows.jsonl")

# Log startup
sys.stderr.write(f"[WFAudit addon] Loaded. Writing flows to: {OUTPUT_FILE}\n")


class FlowLogger:
    def __init__(self):
        self.count = 0

    def response(self, flow):
        """Called when a complete request/response pair is available."""
        try:
            req = flow.request
            resp = flow.response

            # Get client IP - handle different mitmproxy versions
            client_ip = "unknown"
            try:
                if hasattr(flow, 'client_conn') and flow.client_conn:
                    peername = getattr(flow.client_conn, 'peername', None)
                    if peername:
                        client_ip = peername[0]
                    elif hasattr(flow.client_conn, 'address'):
                        client_ip = flow.client_conn.address[0]
            except Exception:
                pass

            # Calculate duration
            duration = 0
            try:
                if resp and hasattr(resp, 'timestamp_end') and hasattr(req, 'timestamp_start'):
                    duration = round((resp.timestamp_end - req.timestamp_start) * 1000, 1)
            except Exception:
                pass

            entry = {
                "id": self.count,
                "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
                "ts_epoch": time.time(),
                "client_ip": client_ip,
                "method": req.method,
                "scheme": req.scheme,
                "host": req.host,
                "port": req.port,
                "path": req.path,
                "url": req.pretty_url,
                "is_https": req.scheme == "https",
                "status_code": resp.status_code if resp else 0,
                "content_type": resp.headers.get("content-type", "") if resp else "",
                "response_size": len(resp.content) if resp and resp.content else 0,
                "request_size": len(req.content) if req.content else 0,
                "duration_ms": duration,
            }

            # Detect content type
            ct = entry["content_type"].lower()
            if "html" in ct:
                entry["type_tag"] = "HTML"
            elif "json" in ct or "/api/" in entry["path"]:
                entry["type_tag"] = "API"
            elif "javascript" in ct:
                entry["type_tag"] = "JS"
            elif "css" in ct:
                entry["type_tag"] = "CSS"
            elif "image" in ct:
                entry["type_tag"] = "IMG"
            elif "font" in ct:
                entry["type_tag"] = "FONT"
            else:
                entry["type_tag"] = "OTHER"

            # Detect credentials in POST
            if req.method == "POST" and req.content:
                try:
                    body = req.content.decode("utf-8", errors="ignore").lower()
                    cred_keywords = ["password", "passwd", "pass=", "pwd", "token", "auth", "login", "user", "email", "credential"]
                    if any(kw in body for kw in cred_keywords):
                        entry["has_credentials"] = True
                        entry["credential_hint"] = "POST body contains authentication fields"
                except Exception:
                    pass

            with open(OUTPUT_FILE, "a") as f:
                f.write(json.dumps(entry) + "\n")

            self.count += 1

            # Log every 10 flows to stderr for debugging
            if self.count % 10 == 0:
                sys.stderr.write(f"[WFAudit addon] {self.count} flows logged\n")

        except Exception as e:
            sys.stderr.write(f"[WFAudit addon] Error: {e}\n")


addons = [FlowLogger()]
