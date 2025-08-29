#!/usr/bin/env python3
"""
Chronicle Health Check Utility - Server Monitoring and Diagnostics
================================================================

Provides health check and diagnostic utilities for Chronicle server and hooks
system. Can be used for monitoring, debugging, and operational insights.

Features:
- Server health checks with detailed diagnostics
- Hook system validation
- Database connectivity testing
- Process monitoring and resource usage
- Network connectivity validation
- Performance metrics collection

Author: C-Codey aka curl Stevens aka SWE-40
"""

import json
import logging
import os
import sys
import time
from pathlib import Path
from typing import Any, Dict, List, Optional
import requests
from datetime import datetime, timezone

# Add lib directory to path
sys.path.insert(0, os.path.dirname(__file__))
from server_manager import get_chronicle_server_status

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Health check configuration
SERVER_HOST = "127.0.0.1"
SERVER_PORT = 8510
HEALTH_ENDPOINTS = {
    "health": f"http://{SERVER_HOST}:{SERVER_PORT}/health",
    "info": f"http://{SERVER_HOST}:{SERVER_PORT}/api/info",
    "stats": f"http://{SERVER_HOST}:{SERVER_PORT}/api/stats",
}
DEFAULT_TIMEOUT = 5


class HealthCheckResult:
    """Container for health check results."""
    
    def __init__(self, check_name: str):
        self.check_name = check_name
        self.success = False
        self.error = None
        self.details = {}
        self.execution_time_ms = 0
        self.timestamp = datetime.now(timezone.utc).isoformat()
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return {
            "check_name": self.check_name,
            "success": self.success,
            "error": self.error,
            "details": self.details,
            "execution_time_ms": self.execution_time_ms,
            "timestamp": self.timestamp
        }


class ChronicleHealthChecker:
    """Comprehensive health checker for Chronicle system."""
    
    def __init__(self, timeout: int = DEFAULT_TIMEOUT):
        """Initialize health checker with optional timeout."""
        self.timeout = timeout
        self.results = {}
    
    def run_all_checks(self) -> Dict[str, Any]:
        """
        Run all health checks and return comprehensive results.
        
        Returns:
            Dictionary with all check results and summary
        """
        logger.info("Starting comprehensive Chronicle health check...")
        
        # Run individual checks
        self.results = {
            "server_status": self.check_server_status(),
            "server_health": self.check_server_health(),
            "server_endpoints": self.check_server_endpoints(),
            "database_connectivity": self.check_database_connectivity(),
            "process_management": self.check_process_management(),
            "network_connectivity": self.check_network_connectivity(),
            "hook_system": self.check_hook_system(),
        }
        
        # Calculate overall health
        overall_success = all(result.success for result in self.results.values())
        failed_checks = [name for name, result in self.results.items() if not result.success]
        
        # Create summary
        summary = {
            "overall_healthy": overall_success,
            "total_checks": len(self.results),
            "passed_checks": len(self.results) - len(failed_checks),
            "failed_checks": failed_checks,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "execution_summary": {
                name: {
                    "success": result.success,
                    "execution_time_ms": result.execution_time_ms
                }
                for name, result in self.results.items()
            }
        }
        
        return {
            "summary": summary,
            "details": {name: result.to_dict() for name, result in self.results.items()}
        }
    
    def check_server_status(self) -> HealthCheckResult:
        """Check server process status via server manager."""
        result = HealthCheckResult("server_status")
        start_time = time.perf_counter()
        
        try:
            status = get_chronicle_server_status()
            result.details = status
            result.success = status.get("running", False)
            
            if not result.success:
                result.error = "Server not running"
                
        except Exception as e:
            result.error = f"Failed to check server status: {e}"
        
        result.execution_time_ms = round((time.perf_counter() - start_time) * 1000, 2)
        return result
    
    def check_server_health(self) -> HealthCheckResult:
        """Check server health via HTTP endpoint."""
        result = HealthCheckResult("server_health")
        start_time = time.perf_counter()
        
        try:
            response = requests.get(HEALTH_ENDPOINTS["health"], timeout=self.timeout)
            result.details = {
                "status_code": response.status_code,
                "response_time_ms": round(response.elapsed.total_seconds() * 1000, 2),
                "content_type": response.headers.get("content-type", ""),
            }
            
            if response.status_code == 200:
                try:
                    health_data = response.json()
                    result.details["health_data"] = health_data
                    result.success = health_data.get("status") == "healthy"
                    
                    if not result.success:
                        result.error = f"Server reports unhealthy: {health_data.get('status')}"
                        
                except json.JSONDecodeError:
                    result.error = "Invalid JSON response from health endpoint"
            else:
                result.error = f"HTTP {response.status_code}: {response.reason}"
                
        except requests.exceptions.ConnectionError:
            result.error = "Cannot connect to server - server not running or port blocked"
        except requests.exceptions.Timeout:
            result.error = f"Health check timed out after {self.timeout}s"
        except Exception as e:
            result.error = f"Health check failed: {e}"
        
        result.execution_time_ms = round((time.perf_counter() - start_time) * 1000, 2)
        return result
    
    def check_server_endpoints(self) -> HealthCheckResult:
        """Check all server endpoints for availability."""
        result = HealthCheckResult("server_endpoints")
        start_time = time.perf_counter()
        
        endpoint_results = {}
        
        for name, url in HEALTH_ENDPOINTS.items():
            endpoint_result = {"url": url}
            try:
                response = requests.get(url, timeout=self.timeout)
                endpoint_result.update({
                    "status_code": response.status_code,
                    "response_time_ms": round(response.elapsed.total_seconds() * 1000, 2),
                    "success": 200 <= response.status_code < 300
                })
                
            except requests.exceptions.ConnectionError:
                endpoint_result.update({
                    "error": "Connection failed",
                    "success": False
                })
            except Exception as e:
                endpoint_result.update({
                    "error": str(e),
                    "success": False
                })
            
            endpoint_results[name] = endpoint_result
        
        # Overall success if all endpoints are reachable
        result.details = endpoint_results
        result.success = all(ep.get("success", False) for ep in endpoint_results.values())
        
        if not result.success:
            failed_endpoints = [name for name, ep in endpoint_results.items() if not ep.get("success")]
            result.error = f"Failed endpoints: {', '.join(failed_endpoints)}"
        
        result.execution_time_ms = round((time.perf_counter() - start_time) * 1000, 2)
        return result
    
    def check_database_connectivity(self) -> HealthCheckResult:
        """Check database connectivity via server API."""
        result = HealthCheckResult("database_connectivity")
        start_time = time.perf_counter()
        
        try:
            # Try to get stats which tests database connectivity
            response = requests.get(HEALTH_ENDPOINTS["stats"], timeout=self.timeout)
            
            if response.status_code == 200:
                stats = response.json()
                db_stats = stats.get("database", {})
                
                result.details = {
                    "database_stats": db_stats,
                    "has_stats": bool(db_stats),
                }
                
                # Consider database healthy if we got stats
                result.success = bool(db_stats)
                
                if not result.success:
                    result.error = "No database statistics available"
                    
            else:
                result.error = f"Stats endpoint failed: HTTP {response.status_code}"
                
        except requests.exceptions.ConnectionError:
            result.error = "Cannot connect to server to test database"
        except Exception as e:
            result.error = f"Database connectivity check failed: {e}"
        
        result.execution_time_ms = round((time.perf_counter() - start_time) * 1000, 2)
        return result
    
    def check_process_management(self) -> HealthCheckResult:
        """Check process management capabilities."""
        result = HealthCheckResult("process_management")
        start_time = time.perf_counter()
        
        try:
            # Get server status which includes process info
            status = get_chronicle_server_status()
            
            result.details = {
                "pid_file_exists": status.get("pid") is not None,
                "process_running": status.get("running", False),
                "pid": status.get("pid"),
                "active_sessions": status.get("active_sessions", 0),
            }
            
            # Add process info if available
            if "process_info" in status:
                result.details["process_info"] = status["process_info"]
            
            # Success if process management is working
            result.success = True  # If we got status, process management is working
            
        except Exception as e:
            result.error = f"Process management check failed: {e}"
        
        result.execution_time_ms = round((time.perf_counter() - start_time) * 1000, 2)
        return result
    
    def check_network_connectivity(self) -> HealthCheckResult:
        """Check network connectivity and port availability."""
        result = HealthCheckResult("network_connectivity")
        start_time = time.perf_counter()
        
        try:
            import socket
            
            # Test if port is open
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
                sock.settimeout(self.timeout)
                port_result = sock.connect_ex((SERVER_HOST, SERVER_PORT))
                port_open = port_result == 0
            
            result.details = {
                "host": SERVER_HOST,
                "port": SERVER_PORT,
                "port_open": port_open,
                "port_connect_result": port_result,
            }
            
            result.success = port_open
            
            if not result.success:
                result.error = f"Port {SERVER_PORT} not accessible on {SERVER_HOST}"
                
        except Exception as e:
            result.error = f"Network connectivity check failed: {e}"
        
        result.execution_time_ms = round((time.perf_counter() - start_time) * 1000, 2)
        return result
    
    def check_hook_system(self) -> HealthCheckResult:
        """Check hook system files and configuration."""
        result = HealthCheckResult("hook_system")
        start_time = time.perf_counter()
        
        try:
            # Get current directory (lib)
            lib_dir = Path(__file__).parent
            hooks_dir = lib_dir.parent / "hooks"
            
            # Check for key hook files
            hook_files = [
                "session_start.py",
                "stop.py",
                "user_prompt_submit.py",
                "post_tool_use.py",
            ]
            
            file_status = {}
            for filename in hook_files:
                hook_path = hooks_dir / filename
                file_status[filename] = {
                    "exists": hook_path.exists(),
                    "path": str(hook_path),
                    "executable": hook_path.is_file() and os.access(hook_path, os.X_OK) if hook_path.exists() else False
                }
            
            # Check server_manager module
            server_manager_path = lib_dir / "server_manager.py"
            file_status["server_manager.py"] = {
                "exists": server_manager_path.exists(),
                "path": str(server_manager_path),
            }
            
            result.details = {
                "hooks_directory": str(hooks_dir),
                "lib_directory": str(lib_dir),
                "file_status": file_status,
                "hooks_found": sum(1 for fs in file_status.values() if fs.get("exists")),
                "total_checked": len(file_status),
            }
            
            # Success if all critical files exist
            critical_files = ["session_start.py", "stop.py", "server_manager.py"]
            missing_critical = [f for f in critical_files if not file_status.get(f, {}).get("exists")]
            
            result.success = len(missing_critical) == 0
            
            if not result.success:
                result.error = f"Missing critical files: {', '.join(missing_critical)}"
                
        except Exception as e:
            result.error = f"Hook system check failed: {e}"
        
        result.execution_time_ms = round((time.perf_counter() - start_time) * 1000, 2)
        return result


def run_quick_health_check() -> bool:
    """
    Run a quick health check and return overall status.
    
    Returns:
        True if system is healthy, False otherwise
    """
    try:
        checker = ChronicleHealthChecker(timeout=3)
        
        # Just check the essentials quickly
        server_health = checker.check_server_health()
        server_status = checker.check_server_status()
        
        return server_health.success and server_status.success
        
    except Exception:
        return False


def main():
    """CLI interface for health checking."""
    import argparse
    
    parser = argparse.ArgumentParser(description="Chronicle Health Checker")
    parser.add_argument("--quick", "-q", action="store_true",
                       help="Run quick health check only")
    parser.add_argument("--timeout", "-t", type=int, default=DEFAULT_TIMEOUT,
                       help="Request timeout in seconds")
    parser.add_argument("--verbose", "-v", action="store_true",
                       help="Enable verbose logging")
    parser.add_argument("--json", action="store_true",
                       help="Output results as JSON")
    
    args = parser.parse_args()
    
    if args.verbose:
        logging.basicConfig(level=logging.DEBUG, force=True)
    
    if args.quick:
        # Quick check
        healthy = run_quick_health_check()
        if args.json:
            print(json.dumps({"healthy": healthy, "quick_check": True}))
        else:
            status = "✅ HEALTHY" if healthy else "❌ UNHEALTHY"
            print(f"Chronicle System: {status}")
        
        sys.exit(0 if healthy else 1)
    
    else:
        # Full health check
        checker = ChronicleHealthChecker(timeout=args.timeout)
        results = checker.run_all_checks()
        
        if args.json:
            print(json.dumps(results, indent=2))
        else:
            # Human readable output
            summary = results["summary"]
            
            print("=" * 60)
            print("📊 CHRONICLE HEALTH CHECK REPORT")
            print("=" * 60)
            print(f"Overall Status: {'✅ HEALTHY' if summary['overall_healthy'] else '❌ UNHEALTHY'}")
            print(f"Checks Passed: {summary['passed_checks']}/{summary['total_checks']}")
            print(f"Timestamp: {summary['timestamp']}")
            print()
            
            if summary['failed_checks']:
                print("❌ FAILED CHECKS:")
                for check_name in summary['failed_checks']:
                    check_result = results['details'][check_name]
                    print(f"  • {check_name}: {check_result.get('error', 'Unknown error')}")
                print()
            
            print("📋 CHECK DETAILS:")
            for check_name, check_result in results['details'].items():
                status = "✅" if check_result['success'] else "❌"
                exec_time = check_result['execution_time_ms']
                print(f"  {status} {check_name} ({exec_time:.1f}ms)")
            
            print("=" * 60)
        
        # Exit code based on overall health
        sys.exit(0 if results["summary"]["overall_healthy"] else 1)


if __name__ == "__main__":
    main()