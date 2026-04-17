#!/usr/bin/env python3
"""
Stealth MITM Monitor — Captures network metadata without breaking HTTPS.

Uses tshark to extract:
  - DNS queries (what domains the target resolves)
  - TLS Client Hello SNI (what HTTPS sites the target connects to)
  - HTTP requests (full content for unencrypted traffic)

Writes JSON Lines to the output file for the frontend flow viewer.

Usage:
  python3 mitm_stealth_monitor.py --interface wlan0 --targets 192.168.1.98 --output /path/to/flows.jsonl
"""

import argparse
import asyncio
import json
import os
import signal
import sys
import time
import shutil
from datetime import datetime


class StealthMonitor:
    def __init__(self, interface: str, targets: list, output: str):
        self.interface = interface
        self.targets = targets
        self.output = output
        self.count = 0
        self.running = True
        self.seen_dns = set()   # Track unique DNS queries
        self.seen_tls = set()   # Track unique TLS connections
        self.dns_cache = {}     # domain → IP mapping from DNS responses

    def write_entry(self, entry: dict):
        """Write a flow entry to the JSONL file."""
        entry["id"] = self.count
        entry["timestamp"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        entry["ts_epoch"] = time.time()
        self.count += 1
        try:
            with open(self.output, "a") as f:
                f.write(json.dumps(entry) + "\n")
        except Exception as e:
            sys.stderr.write(f"[stealth] Write error: {e}\n")

    async def run_dns_monitor(self):
        """Monitor DNS queries using tshark."""
        # Filter: DNS queries (not responses) from target IPs
        target_filter = " or ".join(f"ip.src == {t}" for t in self.targets)
        display_filter = f"dns.flags.response == 0 and ({target_filter})"

        cmd = [
            "tshark", "-i", self.interface, "-l",
            "-Y", display_filter,
            "-T", "fields",
            "-e", "frame.time_epoch",
            "-e", "ip.src",
            "-e", "dns.qry.name",
            "-e", "dns.qry.type",
            "-E", "separator=|",
        ]

        sys.stderr.write(f"[stealth] DNS monitor: {' '.join(cmd)}\n")

        try:
            proc = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.DEVNULL,
            )

            while self.running:
                line = await proc.stdout.readline()
                if not line:
                    break
                try:
                    parts = line.decode("utf-8", errors="ignore").strip().split("|")
                    if len(parts) >= 3:
                        ts, client_ip, domain = parts[0], parts[1], parts[2]
                        qtype = parts[3] if len(parts) > 3 else "A"
                        if not domain:
                            continue

                        # Deduplicate within 5 second windows
                        key = f"{client_ip}:{domain}:{int(float(ts))//5}"
                        if key in self.seen_dns:
                            continue
                        self.seen_dns.add(key)
                        # Keep set from growing unbounded
                        if len(self.seen_dns) > 10000:
                            self.seen_dns = set(list(self.seen_dns)[-5000:])

                        self.write_entry({
                            "client_ip": client_ip,
                            "method": "DNS",
                            "scheme": "dns",
                            "host": domain,
                            "port": 53,
                            "path": f"/{qtype}",
                            "url": f"dns://{domain}/{qtype}",
                            "is_https": False,
                            "status_code": 0,
                            "content_type": f"dns/{qtype}",
                            "response_size": 0,
                            "request_size": 0,
                            "duration_ms": 0,
                            "type_tag": "DNS",
                        })
                except Exception as e:
                    sys.stderr.write(f"[stealth] DNS parse error: {e}\n")

        except Exception as e:
            sys.stderr.write(f"[stealth] DNS monitor error: {e}\n")

    async def run_tls_monitor(self):
        """Monitor TLS Client Hello SNI using tshark."""
        target_filter = " or ".join(f"ip.src == {t}" for t in self.targets)
        display_filter = f"tls.handshake.type == 1 and ({target_filter})"

        cmd = [
            "tshark", "-i", self.interface, "-l",
            "-Y", display_filter,
            "-T", "fields",
            "-e", "frame.time_epoch",
            "-e", "ip.src",
            "-e", "ip.dst",
            "-e", "tcp.dstport",
            "-e", "tls.handshake.extensions_server_name",
            "-E", "separator=|",
        ]

        sys.stderr.write(f"[stealth] TLS monitor: {' '.join(cmd)}\n")

        try:
            proc = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.DEVNULL,
            )

            while self.running:
                line = await proc.stdout.readline()
                if not line:
                    break
                try:
                    parts = line.decode("utf-8", errors="ignore").strip().split("|")
                    if len(parts) >= 5:
                        ts, client_ip, dst_ip, dst_port, sni = parts[0], parts[1], parts[2], parts[3], parts[4]
                        if not sni:
                            continue

                        # Deduplicate within 3 second windows
                        key = f"{client_ip}:{sni}:{int(float(ts))//3}"
                        if key in self.seen_tls:
                            continue
                        self.seen_tls.add(key)
                        if len(self.seen_tls) > 10000:
                            self.seen_tls = set(list(self.seen_tls)[-5000:])

                        self.write_entry({
                            "client_ip": client_ip,
                            "method": "TLS",
                            "scheme": "https",
                            "host": sni,
                            "port": int(dst_port) if dst_port else 443,
                            "path": f"→ {dst_ip}",
                            "url": f"https://{sni}/ → {dst_ip}:{dst_port}",
                            "is_https": True,
                            "status_code": 0,
                            "content_type": "tls/handshake",
                            "response_size": 0,
                            "request_size": 0,
                            "duration_ms": 0,
                            "type_tag": "TLS",
                            "dst_ip": dst_ip,
                        })
                except Exception as e:
                    sys.stderr.write(f"[stealth] TLS parse error: {e}\n")

        except Exception as e:
            sys.stderr.write(f"[stealth] TLS monitor error: {e}\n")

    async def run_http_monitor(self):
        """Monitor unencrypted HTTP traffic using tshark."""
        target_filter = " or ".join(f"ip.src == {t}" for t in self.targets)
        display_filter = f"http.request and ({target_filter})"

        cmd = [
            "tshark", "-i", self.interface, "-l",
            "-Y", display_filter,
            "-T", "fields",
            "-e", "frame.time_epoch",
            "-e", "ip.src",
            "-e", "ip.dst",
            "-e", "http.request.method",
            "-e", "http.host",
            "-e", "http.request.uri",
            "-e", "http.user_agent",
            "-e", "http.content_type",
            "-e", "http.content_length",
            "-E", "separator=|",
        ]

        sys.stderr.write(f"[stealth] HTTP monitor: {' '.join(cmd)}\n")

        try:
            proc = await asyncio.create_subprocess_exec(
                *cmd,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.DEVNULL,
            )

            while self.running:
                line = await proc.stdout.readline()
                if not line:
                    break
                try:
                    parts = line.decode("utf-8", errors="ignore").strip().split("|")
                    if len(parts) >= 6:
                        ts = parts[0]
                        client_ip = parts[1]
                        dst_ip = parts[2]
                        method = parts[3] or "GET"
                        host = parts[4] or dst_ip
                        uri = parts[5] or "/"
                        user_agent = parts[6] if len(parts) > 6 else ""
                        ct = parts[7] if len(parts) > 7 else ""
                        cl = parts[8] if len(parts) > 8 else "0"

                        self.write_entry({
                            "client_ip": client_ip,
                            "method": method,
                            "scheme": "http",
                            "host": host,
                            "port": 80,
                            "path": uri,
                            "url": f"http://{host}{uri}",
                            "is_https": False,
                            "status_code": 0,
                            "content_type": ct,
                            "response_size": int(cl) if cl.isdigit() else 0,
                            "request_size": 0,
                            "duration_ms": 0,
                            "type_tag": "HTTP",
                            "dst_ip": dst_ip,
                            "user_agent": user_agent[:100] if user_agent else "",
                        })
                except Exception as e:
                    sys.stderr.write(f"[stealth] HTTP parse error: {e}\n")

        except Exception as e:
            sys.stderr.write(f"[stealth] HTTP monitor error: {e}\n")

    async def run(self):
        """Run all monitors concurrently."""
        sys.stderr.write(f"[stealth] Starting monitors on {self.interface} for targets {self.targets}\n")
        sys.stderr.write(f"[stealth] Output: {self.output}\n")

        tasks = [
            asyncio.create_task(self.run_dns_monitor()),
            asyncio.create_task(self.run_tls_monitor()),
            asyncio.create_task(self.run_http_monitor()),
        ]

        def stop(sig, frame):
            sys.stderr.write(f"[stealth] Stopping...\n")
            self.running = False
            for t in tasks:
                t.cancel()

        signal.signal(signal.SIGTERM, stop)
        signal.signal(signal.SIGINT, stop)

        await asyncio.gather(*tasks, return_exceptions=True)
        sys.stderr.write(f"[stealth] Stopped. Total entries: {self.count}\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Stealth MITM Monitor")
    parser.add_argument("--interface", "-i", required=True)
    parser.add_argument("--targets", "-t", required=True, help="Comma-separated target IPs")
    parser.add_argument("--output", "-o", required=True, help="JSONL output file")
    args = parser.parse_args()

    if not shutil.which("tshark"):
        sys.stderr.write("[stealth] ERROR: tshark not found. Install: sudo apt install tshark\n")
        sys.exit(1)

    targets = [t.strip() for t in args.targets.split(",") if t.strip()]
    monitor = StealthMonitor(args.interface, targets, args.output)
    asyncio.run(monitor.run())
