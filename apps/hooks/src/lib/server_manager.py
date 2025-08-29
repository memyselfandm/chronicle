#!/usr/bin/env python3
"""
Chronicle Server Manager - Non-Blocking Process Management
=========================================================

Provides non-blocking server management for Chronicle FastAPI server with session
lifecycle integration. Handles auto-start/stop with graceful failure and resource cleanup.

Key Features:
- Non-blocking server startup/shutdown (< 100ms impact)
- PID file management for process tracking
- Health checks and server status monitoring  
- Session-aware lifecycle management
- Graceful failure handling without impacting Claude Code
- Process cleanup and zombie prevention
- Support for delayed shutdown after last session

Author: C-Codey aka curl Stevens aka SWE-40
"""

import asyncio
import json
import logging
import os
import signal
import subprocess
import sys
import tempfile
import threading
import time
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple
import psutil
import requests

# Configure logging
logger = logging.getLogger(__name__)

# Server configuration
SERVER_HOST = "127.0.0.1"
SERVER_PORT = 8510
SERVER_HEALTH_URL = f"http://{SERVER_HOST}:{SERVER_PORT}/health"
SERVER_STARTUP_TIMEOUT = 30  # seconds
SERVER_SHUTDOWN_DELAY = 30   # seconds before shutdown after last session
PID_FILE_NAME = "chronicle_server.pid"


class ChronicleServerManager:
    """
    Non-blocking server manager for Chronicle with session lifecycle integration.
    
    Handles automatic server startup/shutdown tied to Claude Code sessions with
    proper process management, health checking, and resource cleanup.
    """
    
    def __init__(self):
        """Initialize server manager with session tracking."""
        self.active_sessions = set()
        self.server_process = None
        self.startup_notified = False
        self.shutdown_timer = None
        self.lock = threading.Lock()
        
        # Determine PID file path
        self.pid_file_path = self._get_pid_file_path()
        
        # Get server script path
        self.server_script_path = self._get_server_script_path()
        
        logger.debug(f"Server manager initialized - PID file: {self.pid_file_path}")
    
    def _get_pid_file_path(self) -> Path:
        """Get the PID file path in a writable location."""
        try:
            # Try system temp directory first
            temp_dir = Path(tempfile.gettempdir())
            pid_path = temp_dir / PID_FILE_NAME
            
            # Test write access
            test_file = temp_dir / f"chronicle_test_{os.getpid()}.tmp"
            test_file.write_text("test")
            test_file.unlink()
            
            return pid_path
            
        except (OSError, PermissionError):
            # Fallback to home directory
            home_dir = Path.home()
            return home_dir / f".{PID_FILE_NAME}"
    
    def _get_server_script_path(self) -> Path:
        """Get the path to Chronicle server main.py."""
        current_file = Path(__file__)
        
        # First, try installed location: ~/.claude/hooks/chronicle/server/main.py
        # This will be the path when running from installed hooks
        try:
            # Check if we're in an installed environment
            if ".claude/hooks/chronicle" in str(current_file):
                installed_server_path = current_file.parent.parent.parent / "server" / "main.py"
                if installed_server_path.exists():
                    logger.debug(f"Found server script at installed location: {installed_server_path}")
                    return installed_server_path
        except Exception as e:
            logger.debug(f"Error checking installed location: {e}")
        
        # Fallback to development paths
        # Navigate from hooks/src/lib to apps/server (development structure)
        # Path structure: .../apps/hooks/src/lib/server_manager.py -> .../apps/server/main.py
        hooks_dir = current_file.parent.parent.parent  # Go up to apps/hooks
        apps_dir = hooks_dir.parent  # Go up to apps/
        dev_server_path = apps_dir / "server" / "main.py"
        
        if dev_server_path.exists():
            logger.debug(f"Found server script at development location: {dev_server_path}")
            return dev_server_path
        
        # Try alternative development path
        logger.debug(f"Server not found at development path: {dev_server_path}")
        chronicle_root = apps_dir.parent
        alt_server_path = chronicle_root / "apps" / "server" / "main.py"
        if alt_server_path.exists():
            logger.debug(f"Found server script at alternative path: {alt_server_path}")
            return alt_server_path
        
        # If none found, return the development path (will fail with better error)
        logger.warning(f"Server script not found at any expected location. Tried: {[dev_server_path, alt_server_path]}")
        return dev_server_path
    
    def is_server_running(self) -> Tuple[bool, Optional[int]]:
        """
        Check if Chronicle server is running.
        
        Returns:
            Tuple of (is_running, pid) where pid is None if not running
        """
        try:
            # Check PID file first
            pid = self._read_pid_file()
            if pid:
                if self._is_process_alive(pid):
                    # Verify it's actually our server by checking port
                    if self._check_server_health(timeout=2):
                        return (True, pid)
                    else:
                        logger.debug(f"Process {pid} alive but server not responding")
                else:
                    logger.debug(f"PID file exists but process {pid} not running")
                    self._cleanup_pid_file()
            
            # Fallback: check if anything is listening on the port
            if self._check_port_in_use():
                logger.debug("Port in use but no PID file - unknown process")
                return (True, None)
                
            return (False, None)
            
        except Exception as e:
            logger.debug(f"Error checking server status: {e}")
            return (False, None)
    
    def start_server_async(self, session_id: str) -> bool:
        """
        Start Chronicle server asynchronously (non-blocking).
        
        Args:
            session_id: Claude Code session ID
            
        Returns:
            True if startup initiated successfully, False otherwise
        """
        with self.lock:
            self.active_sessions.add(session_id)
            
            # Cancel any pending shutdown
            if self.shutdown_timer:
                self.shutdown_timer.cancel()
                self.shutdown_timer = None
                logger.debug("Cancelled pending server shutdown")
            
            # Check if server is already running
            is_running, pid = self.is_server_running()
            if is_running:
                logger.debug(f"Server already running (PID: {pid})")
                return True
            
            # Start server in background thread
            try:
                thread = threading.Thread(
                    target=self._start_server_background,
                    args=(session_id,),
                    daemon=True
                )
                thread.start()
                return True
                
            except Exception as e:
                logger.error(f"Failed to start server background thread: {e}")
                return False
    
    def _start_server_background(self, session_id: str):
        """Background thread function to start the server."""
        try:
            # Show notification ONLY when actually starting
            if not self.startup_notified:
                print("🚀 Starting Chronicle server...")
                logger.info(f"Starting Chronicle server for session: {session_id}")
                self.startup_notified = True
            
            # Check server script exists
            if not self.server_script_path.exists():
                logger.error(f"Server script not found: {self.server_script_path}")
                print("⚠️  Chronicle server script not found")
                return
            
            # Start server process
            cmd = [sys.executable, str(self.server_script_path)]
            
            self.server_process = subprocess.Popen(
                cmd,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                cwd=self.server_script_path.parent,
                # Detach from parent process
                start_new_session=True if os.name != 'nt' else None,
                creationflags=subprocess.CREATE_NEW_PROCESS_GROUP if os.name == 'nt' else 0
            )
            
            # Write PID file
            self._write_pid_file(self.server_process.pid)
            
            # Wait for server to become healthy (with timeout)
            start_time = time.time()
            healthy = False
            
            while time.time() - start_time < SERVER_STARTUP_TIMEOUT:
                if self._check_server_health(timeout=2):
                    healthy = True
                    break
                time.sleep(1)
            
            if healthy:
                logger.info(f"✅ Chronicle server started successfully (PID: {self.server_process.pid})")
            else:
                logger.warning("⚠️  Chronicle server may not be fully healthy")
            
        except Exception as e:
            logger.error(f"❌ Failed to start Chronicle server: {e}")
            # Clean up on failure
            if self.server_process:
                try:
                    self.server_process.terminate()
                except:
                    pass
            self._cleanup_pid_file()
    
    def stop_server_session(self, session_id: str):
        """
        Handle session end - may schedule server shutdown if last session.
        
        Args:
            session_id: Claude Code session ID that ended
        """
        with self.lock:
            self.active_sessions.discard(session_id)
            
            if not self.active_sessions:
                # Last session ended - schedule delayed shutdown
                logger.info(f"Last session ended - scheduling server shutdown in {SERVER_SHUTDOWN_DELAY}s")
                
                if self.shutdown_timer:
                    self.shutdown_timer.cancel()
                
                self.shutdown_timer = threading.Timer(
                    SERVER_SHUTDOWN_DELAY,
                    self._shutdown_server
                )
                self.shutdown_timer.start()
    
    def _shutdown_server(self):
        """Shutdown the Chronicle server gracefully."""
        try:
            logger.info("🛑 Shutting down Chronicle server...")
            
            # Check if server is still running
            is_running, pid = self.is_server_running()
            if not is_running:
                logger.debug("Server already stopped")
                return
            
            # Try graceful shutdown first (SIGTERM)
            if pid:
                try:
                    process = psutil.Process(pid)
                    process.terminate()
                    
                    # Wait for graceful shutdown
                    try:
                        process.wait(timeout=10)
                        logger.info("✅ Server shut down gracefully")
                    except psutil.TimeoutExpired:
                        # Force kill if needed
                        logger.warning("Forcing server shutdown...")
                        process.kill()
                        process.wait(timeout=5)
                        logger.info("✅ Server force-stopped")
                    
                except (psutil.NoSuchProcess, psutil.AccessDenied) as e:
                    logger.debug(f"Process shutdown: {e}")
            
            # Clean up
            self._cleanup_pid_file()
            self.server_process = None
            
        except Exception as e:
            logger.error(f"Error shutting down server: {e}")
            # Force cleanup anyway
            self._cleanup_pid_file()
    
    def force_stop_server(self):
        """Force stop the server immediately (for cleanup/debugging)."""
        try:
            is_running, pid = self.is_server_running()
            if is_running and pid:
                process = psutil.Process(pid)
                process.kill()
                logger.info("Server force-stopped")
            
            self._cleanup_pid_file()
            
        except Exception as e:
            logger.error(f"Error force-stopping server: {e}")
    
    def get_server_status(self) -> Dict[str, Any]:
        """
        Get comprehensive server status information.
        
        Returns:
            Dictionary with server status details
        """
        is_running, pid = self.is_server_running()
        
        status = {
            "running": is_running,
            "pid": pid,
            "active_sessions": len(self.active_sessions),
            "session_ids": list(self.active_sessions),
            "pid_file": str(self.pid_file_path),
            "server_script": str(self.server_script_path),
            "health_endpoint": SERVER_HEALTH_URL,
        }
        
        if is_running:
            # Get health check data
            health_data = self._get_health_data()
            if health_data:
                status["health"] = health_data
            
            # Get process info if available
            if pid:
                try:
                    process = psutil.Process(pid)
                    status["process_info"] = {
                        "memory_mb": round(process.memory_info().rss / 1024 / 1024, 2),
                        "cpu_percent": process.cpu_percent(),
                        "create_time": process.create_time(),
                        "num_threads": process.num_threads(),
                    }
                except:
                    pass
        
        return status
    
    # Private helper methods
    
    def _read_pid_file(self) -> Optional[int]:
        """Read PID from file."""
        try:
            if self.pid_file_path.exists():
                pid_text = self.pid_file_path.read_text().strip()
                return int(pid_text)
        except (ValueError, OSError):
            pass
        return None
    
    def _write_pid_file(self, pid: int):
        """Write PID to file."""
        try:
            self.pid_file_path.write_text(str(pid))
        except OSError as e:
            logger.error(f"Failed to write PID file: {e}")
    
    def _cleanup_pid_file(self):
        """Remove PID file."""
        try:
            if self.pid_file_path.exists():
                self.pid_file_path.unlink()
        except OSError:
            pass
    
    def _is_process_alive(self, pid: int) -> bool:
        """Check if process is alive."""
        try:
            return psutil.pid_exists(pid)
        except:
            return False
    
    def _check_server_health(self, timeout: int = 5) -> bool:
        """Check server health via HTTP."""
        try:
            response = requests.get(SERVER_HEALTH_URL, timeout=timeout)
            return response.status_code == 200
        except:
            return False
    
    def _check_port_in_use(self) -> bool:
        """Check if server port is in use."""
        try:
            import socket
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
                sock.settimeout(1)
                result = sock.connect_ex((SERVER_HOST, SERVER_PORT))
                return result == 0
        except:
            return False
    
    def _get_health_data(self) -> Optional[Dict[str, Any]]:
        """Get health check data from server."""
        try:
            response = requests.get(SERVER_HEALTH_URL, timeout=3)
            if response.status_code == 200:
                return response.json()
        except:
            pass
        return None


# Global server manager instance
_server_manager = None
_manager_lock = threading.Lock()


def get_server_manager() -> ChronicleServerManager:
    """Get global server manager instance (singleton pattern)."""
    global _server_manager
    
    if _server_manager is None:
        with _manager_lock:
            if _server_manager is None:
                _server_manager = ChronicleServerManager()
    
    return _server_manager


# Convenience functions for hooks

def start_chronicle_server_if_needed(session_id: str) -> bool:
    """
    Start Chronicle server if not running (non-blocking).
    
    Args:
        session_id: Claude Code session ID
        
    Returns:
        True if server is running or startup initiated
    """
    try:
        manager = get_server_manager()
        
        # Quick check if already running
        is_running, _ = manager.is_server_running()
        if is_running:
            # Add session to tracking but don't restart
            with manager.lock:
                manager.active_sessions.add(session_id)
            return True
        
        # Start server asynchronously
        return manager.start_server_async(session_id)
        
    except Exception as e:
        logger.error(f"Error in start_chronicle_server_if_needed: {e}")
        # Never block Claude Code - fail gracefully
        return False


def stop_chronicle_server_session(session_id: str):
    """
    Handle session end for Chronicle server management.
    
    Args:
        session_id: Claude Code session ID that ended
    """
    try:
        manager = get_server_manager()
        manager.stop_server_session(session_id)
        
    except Exception as e:
        logger.error(f"Error in stop_chronicle_server_session: {e}")
        # Fail gracefully


def get_chronicle_server_status() -> Dict[str, Any]:
    """Get Chronicle server status information."""
    try:
        manager = get_server_manager()
        return manager.get_server_status()
    except Exception as e:
        logger.error(f"Error getting server status: {e}")
        return {"error": str(e), "running": False}


def force_stop_chronicle_server():
    """Force stop Chronicle server (for debugging/cleanup)."""
    try:
        manager = get_server_manager()
        manager.force_stop_server()
    except Exception as e:
        logger.error(f"Error force-stopping server: {e}")


# CLI interface for testing and debugging

def main():
    """CLI interface for server management."""
    import argparse
    
    parser = argparse.ArgumentParser(description="Chronicle Server Manager")
    parser.add_argument("action", choices=["start", "stop", "status", "force-stop"],
                       help="Action to perform")
    parser.add_argument("--session-id", default="cli-test",
                       help="Session ID for start command")
    parser.add_argument("--verbose", "-v", action="store_true",
                       help="Enable verbose logging")
    
    args = parser.parse_args()
    
    if args.verbose:
        logging.basicConfig(level=logging.DEBUG)
    
    manager = get_server_manager()
    
    if args.action == "start":
        print(f"Starting server for session: {args.session_id}")
        success = start_chronicle_server_if_needed(args.session_id)
        print(f"Start initiated: {success}")
        
        # Wait a bit and show status
        time.sleep(3)
        status = manager.get_server_status()
        print(f"Server running: {status['running']}")
        
    elif args.action == "stop":
        print(f"Stopping server session: {args.session_id}")
        stop_chronicle_server_session(args.session_id)
        
    elif args.action == "force-stop":
        print("Force stopping server...")
        force_stop_chronicle_server()
        
    elif args.action == "status":
        status = manager.get_server_status()
        print(json.dumps(status, indent=2))


if __name__ == "__main__":
    main()