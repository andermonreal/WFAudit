"""
Manages long-running subprocesses (airodump, mitmproxy, etc.)
with cancellation, output streaming, and cleanup.
"""

import asyncio
import subprocess
import uuid
import signal
import logging
from datetime import datetime
from dataclasses import dataclass, field
from typing import Optional, Callable

logger = logging.getLogger(__name__)


@dataclass
class ManagedProcess:
    id: str
    command: list[str]
    process: Optional[asyncio.subprocess.Process] = None
    status: str = "pending"
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None
    stdout_lines: list[str] = field(default_factory=list)
    stderr_lines: list[str] = field(default_factory=list)
    return_code: Optional[int] = None
    output_file: Optional[str] = None


class ProcessManager:
    def __init__(self):
        self._processes: dict[str, ManagedProcess] = {}

    async def run(
        self,
        command: list[str],
        timeout: Optional[int] = None,
        output_file: Optional[str] = None,
        on_stdout: Optional[Callable] = None,
        env: Optional[dict] = None,
        proc_id: Optional[str] = None,
    ) -> ManagedProcess:
        proc_id = proc_id or str(uuid.uuid4())[:8]
        managed = ManagedProcess(
            id=proc_id,
            command=command,
            output_file=output_file,
        )
        self._processes[proc_id] = managed

        try:
            managed.started_at = datetime.now()
            managed.status = "running"
            logger.info(f"[{proc_id}] Running: {' '.join(command)}")

            proc = await asyncio.create_subprocess_exec(
                *command,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
                env=env,
            )
            managed.process = proc

            async def read_stream(stream, lines_list):
                while True:
                    line = await stream.readline()
                    if not line:
                        break
                    decoded = line.decode("utf-8", errors="replace").strip()
                    lines_list.append(decoded)
                    if on_stdout and stream == proc.stdout:
                        await on_stdout(decoded)

            tasks = [
                asyncio.create_task(read_stream(proc.stdout, managed.stdout_lines)),
                asyncio.create_task(read_stream(proc.stderr, managed.stderr_lines)),
            ]

            if timeout:
                try:
                    await asyncio.wait_for(
                        asyncio.gather(*tasks), timeout=timeout
                    )
                    await proc.wait()
                except asyncio.TimeoutError:
                    logger.warning(f"[{proc_id}] Timeout after {timeout}s, terminating")
                    proc.terminate()
                    await proc.wait()
            else:
                await asyncio.gather(*tasks)
                await proc.wait()

            managed.return_code = proc.returncode
            managed.status = "completed" if proc.returncode == 0 else "failed"

        except Exception as e:
            managed.status = "failed"
            managed.stderr_lines.append(str(e))
            logger.error(f"[{proc_id}] Error: {e}")

        finally:
            managed.finished_at = datetime.now()

        return managed

    async def run_sync(self, command: list[str], timeout: int = 30) -> tuple[str, str, int]:
        """Simple synchronous-style run, returns (stdout, stderr, returncode)."""
        try:
            proc = await asyncio.create_subprocess_exec(
                *command,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )
            stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=timeout)
            return (
                stdout.decode("utf-8", errors="replace"),
                stderr.decode("utf-8", errors="replace"),
                proc.returncode,
            )
        except asyncio.TimeoutError:
            proc.kill()
            return "", "timeout", -1

    async def cancel(self, proc_id: str) -> bool:
        managed = self._processes.get(proc_id)
        if not managed or not managed.process:
            return False
        try:
            managed.process.terminate()
            await asyncio.sleep(1)
            if managed.process.returncode is None:
                managed.process.kill()
            managed.status = "cancelled"
            managed.finished_at = datetime.now()
            return True
        except ProcessLookupError:
            return False

    def get(self, proc_id: str) -> Optional[ManagedProcess]:
        return self._processes.get(proc_id)

    def list_all(self) -> list[ManagedProcess]:
        return list(self._processes.values())

    async def cleanup(self):
        for proc_id, managed in self._processes.items():
            if managed.process and managed.process.returncode is None:
                try:
                    managed.process.kill()
                except ProcessLookupError:
                    pass


# Singleton
process_manager = ProcessManager()
