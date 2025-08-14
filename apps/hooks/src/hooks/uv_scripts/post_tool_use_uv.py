#!/usr/bin/env -S uv run
# /// script
# requires-python = ">=3.8"
# dependencies = [
#     "aiosqlite>=0.19.0",
#     "asyncpg>=0.28.0",
#     "python-dotenv>=1.0.0",
#     "typing-extensions>=4.7.0",
#     "supabase>=2.0.0",
#     "ujson>=5.8.0",
# ]
# ///
"""
Post Tool Use Hook for Claude Code Observability - UV Single-File Script

Captures tool execution results after tool completion including:
- Tool name and execution duration
- Success/failure status and error messages  
- Result size and metadata
- MCP tool detection and server identification
- Timeout and partial result handling
"""

import json
import logging
import os
import re
import sys
import time
import sqlite3
import subprocess
import threading
import uuid
from contextlib import contextmanager
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Optional, List, Tuple, Union

# Load environment variables
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

# Supabase client
try:
    from supabase import create_client, Client
    SUPABASE_AVAILABLE = True
except ImportError:
    SUPABASE_AVAILABLE = False
    Client = None

# UJSON for fast JSON processing
try:
    import ujson as json_impl
except ImportError:
    import json as json_impl

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ===========================================
# Inline Constants and Patterns
# ===========================================

# MCP tool detection patterns
MCP_TOOL_PATTERN = re.compile(r'^mcp__(.+?)__(.+)$')
LARGE_RESULT_THRESHOLD = 100000  # 100KB threshold for large results

# Security patterns (simplified for performance)
SENSITIVE_PATTERNS = {
    "api_keys": [
        r'sk-[a-zA-Z0-9]{20,}',  # OpenAI API keys
        r'sk-ant-api03-[a-zA-Z0-9_-]{95}',  # Anthropic API keys
    ],
    "user_paths": [
        r'/Users/[^/\s,}]+',  # macOS user paths
        r'/home/[^/\s,}]+',   # Linux user paths
        r'C:\\Users\\[^\\s,}]+',  # Windows user paths
    ]
}

# ===========================================
# Inline Utility Functions
# ===========================================

def sanitize_data(data: Any) -> Any:
    """Fast sanitization for tool data."""
    if data is None:
        return None
    
    data_str = json_impl.dumps(data) if not isinstance(data, str) else data
    sanitized_str = data_str
    
    # Only sanitize most critical patterns for performance
    for pattern in SENSITIVE_PATTERNS["api_keys"]:
        sanitized_str = re.sub(pattern, '[REDACTED]', sanitized_str)
    
    for pattern in SENSITIVE_PATTERNS["user_paths"]:
        sanitized_str = re.sub(pattern, '/Users/[USER]', sanitized_str)
    
    try:
        if isinstance(data, dict):
            return json_impl.loads(sanitized_str)
        return sanitized_str
    except:
        return sanitized_str

def is_mcp_tool(tool_name: str) -> bool:
    """Determine if a tool is an MCP tool based on naming pattern."""
    if not tool_name or not isinstance(tool_name, str):
        return False
    return bool(MCP_TOOL_PATTERN.match(tool_name))

def extract_mcp_server_name(tool_name: str) -> Optional[str]:
    """Extract MCP server name from tool name."""
    if not tool_name or not isinstance(tool_name, str):
        return None
    
    match = MCP_TOOL_PATTERN.match(tool_name)
    return match.group(1) if match else None

def parse_tool_response(response_data: Any) -> Dict[str, Any]:
    """Parse tool response data and extract key metrics."""
    if response_data is None:
        return {
            "success": False,
            "error": "No response data",
            "result_size": 0,
            "large_result": False
        }
    
    # Calculate response size
    try:
        response_str = json_impl.dumps(response_data) if not isinstance(response_data, str) else response_data
        result_size = len(response_str.encode('utf-8'))
    except (TypeError, UnicodeEncodeError):
        result_size = 0
    
    # Extract success/failure status
    success = True
    error = None
    error_type = None
    
    if isinstance(response_data, dict):
        status = response_data.get("status", "success")
        if status in ["error", "timeout", "failed"]:
            success = False
        
        if "error" in response_data:
            success = False
            error = response_data["error"]
        
        if "error_type" in response_data:
            error_type = response_data["error_type"]
        
        if error and "timeout" in str(error).lower():
            error_type = "timeout"
    
    parsed = {
        "success": success,
        "error": error,
        "error_type": error_type,
        "result_size": result_size,
        "large_result": result_size > LARGE_RESULT_THRESHOLD,
        "metadata": response_data if isinstance(response_data, dict) else None
    }
    
    # Include partial results if available
    if isinstance(response_data, dict) and "partial_result" in response_data:
        parsed["partial_result"] = response_data["partial_result"]
    
    return parsed

def calculate_duration_ms(start_time: Optional[float] = None, 
                         end_time: Optional[float] = None,
                         execution_time_ms: Optional[int] = None) -> Optional[int]:
    """Calculate execution duration in milliseconds."""
    if execution_time_ms is not None:
        return execution_time_ms
    
    if start_time is not None and end_time is not None:
        duration_seconds = end_time - start_time
        if duration_seconds >= 0:
            return int(duration_seconds * 1000)
    
    return None

# ===========================================
# Inline Database Module
# ===========================================

class DatabaseManager:
    """Simplified database manager for hooks."""
    
    def __init__(self):
        self.supabase_client = None
        self.sqlite_path = os.path.expanduser("~/.claude/hooks_data.db")
        
        # Initialize Supabase if available
        if SUPABASE_AVAILABLE:
            supabase_url = os.getenv("SUPABASE_URL")
            supabase_key = os.getenv("SUPABASE_ANON_KEY")
            
            if supabase_url and supabase_key:
                try:
                    self.supabase_client = create_client(supabase_url, supabase_key)
                except Exception as e:
                    logger.debug(f"Supabase init failed: {e}")
        
        # Ensure SQLite exists
        self._ensure_sqlite_tables()
    
    def _ensure_sqlite_tables(self):
        """Ensure SQLite tables exist."""
        try:
            os.makedirs(os.path.dirname(self.sqlite_path), exist_ok=True)
            
            with sqlite3.connect(self.sqlite_path) as conn:
                conn.execute('''
                    CREATE TABLE IF NOT EXISTS sessions (
                        id TEXT PRIMARY KEY,
                        claude_session_id TEXT UNIQUE,
                        start_time TIMESTAMP,
                        project_path TEXT,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                ''')
                
                conn.execute('''
                    CREATE TABLE IF NOT EXISTS events (
                        id TEXT PRIMARY KEY,
                        session_id TEXT,
                        event_type TEXT,
                        hook_event_name TEXT,
                        timestamp TIMESTAMP,
                        data TEXT,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY(session_id) REFERENCES sessions(id)
                    )
                ''')
                conn.commit()
        
        except Exception as e:
            logger.debug(f"SQLite setup failed: {e}")
    
    def save_session(self, session_data: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
        """Save session data and return success, session_uuid."""
        try:
            session_uuid = session_data.get("id", str(uuid.uuid4()))
            
            # Try SQLite (simpler for tool tracking)
            with sqlite3.connect(self.sqlite_path) as conn:
                conn.execute('''
                    INSERT OR REPLACE INTO sessions 
                    (id, claude_session_id, start_time, project_path)
                    VALUES (?, ?, ?, ?)
                ''', (
                    session_uuid,
                    session_data.get("claude_session_id"),
                    session_data.get("start_time"),
                    session_data.get("project_path", os.getcwd())
                ))
                conn.commit()
            
            return True, session_uuid
            
        except Exception as e:
            logger.debug(f"Session save failed: {e}")
            return False, None
    
    def save_event(self, event_data: Dict[str, Any]) -> bool:
        """Save event data to database."""
        try:
            event_id = event_data.get("event_id", str(uuid.uuid4()))
            
            # SQLite save
            with sqlite3.connect(self.sqlite_path) as conn:
                conn.execute('''
                    INSERT INTO events 
                    (id, session_id, event_type, hook_event_name, timestamp, data)
                    VALUES (?, ?, ?, ?, ?, ?)
                ''', (
                    event_id,
                    event_data.get("session_id"),
                    event_data.get("event_type"),
                    event_data.get("hook_event_name"),
                    event_data.get("timestamp"),
                    json_impl.dumps(event_data.get("data", {}))
                ))
                conn.commit()
            
            return True
            
        except Exception as e:
            logger.debug(f"Event save failed: {e}")
            return False

# ===========================================
# Simplified Base Hook
# ===========================================

class BaseHook:
    """Simplified base hook for performance."""
    
    def __init__(self):
        self.db_manager = DatabaseManager()
        self.claude_session_id: Optional[str] = None
        self.session_uuid: Optional[str] = None
    
    def get_claude_session_id(self, input_data: Optional[Dict[str, Any]] = None) -> Optional[str]:
        """Extract Claude session ID."""
        if input_data and "sessionId" in input_data:
            return input_data["sessionId"]
        return os.getenv("CLAUDE_SESSION_ID")
    
    def process_hook_data(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """Process and validate input data."""
        if not isinstance(input_data, dict):
            return {"hook_event_name": "Unknown", "error": "Invalid input"}
        
        self.claude_session_id = self.get_claude_session_id(input_data)
        sanitized_input = sanitize_data(input_data)
        
        return {
            "hook_event_name": "PostToolUse",
            "claude_session_id": self.claude_session_id,
            "raw_input": sanitized_input,
            "timestamp": datetime.now().isoformat(),
        }
    
    def save_event(self, event_data: Dict[str, Any]) -> bool:
        """Save event with auto session creation."""
        try:
            # Ensure session exists
            if not self.session_uuid and self.claude_session_id:
                session_data = {
                    "claude_session_id": self.claude_session_id,
                    "start_time": datetime.now().isoformat(),
                    "project_path": os.getcwd(),
                }
                success, session_uuid = self.db_manager.save_session(session_data)
                if success:
                    self.session_uuid = session_uuid
            
            if not self.session_uuid:
                return False
            
            # Add required fields
            event_data["session_id"] = self.session_uuid
            if "timestamp" not in event_data:
                event_data["timestamp"] = datetime.now().isoformat()
            if "event_id" not in event_data:
                event_data["event_id"] = str(uuid.uuid4())
            
            return self.db_manager.save_event(event_data)
            
        except Exception:
            return False
    
    def create_response(self, continue_execution: bool = True, 
                       suppress_output: bool = False,
                       hook_specific_data: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Create hook response."""
        response = {
            "continue": continue_execution,
            "suppressOutput": suppress_output,
        }
        
        if hook_specific_data:
            response["hookSpecificOutput"] = hook_specific_data
        
        return response
    
    def create_hook_specific_output(self, **kwargs) -> Dict[str, Any]:
        """Create hookSpecificOutput with camelCase keys."""
        output = {}
        for key, value in kwargs.items():
            if value is not None:
                camel_key = self._snake_to_camel(key)
                output[camel_key] = value
        return output
    
    def _snake_to_camel(self, snake_str: str) -> str:
        """Convert snake_case to camelCase."""
        if not snake_str:
            return snake_str
        components = snake_str.split('_')
        return components[0] + ''.join(word.capitalize() for word in components[1:])

# ===========================================
# Post Tool Use Hook Implementation
# ===========================================

class PostToolUseHook(BaseHook):
    """Hook to capture tool execution results and performance metrics."""
    
    def __init__(self):
        super().__init__()
    
    def process_hook(self, input_data: Any) -> Dict[str, Any]:
        """Process tool execution completion and capture metrics."""
        try:
            if input_data is None:
                return self.create_response()
            
            # Process input data
            processed_data = self.process_hook_data(input_data)
            
            # Extract tool execution details
            raw_input = processed_data.get("raw_input", {})
            tool_name = raw_input.get("toolName")
            tool_input = raw_input.get("toolInput", {})
            tool_response = raw_input.get("toolResponse")
            execution_time = raw_input.get("executionTime")
            start_time = raw_input.get("startTime")
            end_time = raw_input.get("endTime")
            
            if not tool_name:
                return self.create_response()
            
            # Parse tool response
            response_parsed = parse_tool_response(tool_response)
            
            # Calculate execution duration
            duration_ms = calculate_duration_ms(start_time, end_time, execution_time)
            
            # Detect MCP tool information
            is_mcp = is_mcp_tool(tool_name)
            mcp_server = extract_mcp_server_name(tool_name) if is_mcp else None
            
            # Create tool usage event data
            tool_event_data = {
                "event_type": "tool_use",
                "hook_event_name": "PostToolUse",
                "timestamp": processed_data.get("timestamp"),
                "data": {
                    "tool_name": tool_name,
                    "duration_ms": duration_ms,
                    "success": response_parsed["success"],
                    "result_size": response_parsed["result_size"],
                    "error": response_parsed["error"],
                    "error_type": response_parsed["error_type"],
                    "is_mcp_tool": is_mcp,
                    "mcp_server": mcp_server,
                    "large_result": response_parsed["large_result"],
                    "tool_input_summary": self._summarize_tool_input(tool_input),
                }
            }
            
            # Include partial results for timeout scenarios
            if "partial_result" in response_parsed:
                tool_event_data["data"]["partial_result"] = response_parsed["partial_result"]
                tool_event_data["data"]["timeout_detected"] = True
            
            # Save the event
            save_success = self.save_event(tool_event_data)
            
            # Analyze for security concerns
            security_decision, security_reason = self.analyze_tool_security(
                tool_name, tool_input, response_parsed
            )
            
            # Create response
            if security_decision == "allow":
                return self.create_response(
                    continue_execution=True,
                    suppress_output=False,
                    hook_specific_data=self.create_hook_specific_output(
                        hook_event_name="PostToolUse",
                        tool_name=tool_name,
                        tool_success=response_parsed["success"],
                        mcp_tool=is_mcp,
                        mcp_server=mcp_server,
                        execution_time=duration_ms,
                        event_saved=save_success,
                        permission_decision=security_decision
                    )
                )
            else:
                # Block or ask for permission
                return self.create_response(
                    continue_execution=security_decision != "deny",
                    suppress_output=False,
                    hook_specific_data=self.create_hook_specific_output(
                        hook_event_name="PostToolUse",
                        tool_name=tool_name,
                        mcp_tool=is_mcp,
                        execution_time=duration_ms,
                        event_saved=save_success,
                        permission_decision=security_decision,
                        permission_decision_reason=security_reason
                    )
                )
            
        except Exception as e:
            logger.debug(f"Hook processing error: {e}")
            
            return self.create_response(
                continue_execution=True,
                suppress_output=False,
                hook_specific_data=self.create_hook_specific_output(
                    hook_event_name="PostToolUse",
                    error=str(e)[:100],
                    event_saved=False,
                    tool_success=False
                )
            )
    
    def _summarize_tool_input(self, tool_input: Any) -> Dict[str, Any]:
        """Create a summary of tool input for logging."""
        if not tool_input:
            return {"input_provided": False}
        
        summary = {"input_provided": True}
        
        if isinstance(tool_input, dict):
            summary["param_count"] = len(tool_input)
            summary["param_names"] = list(tool_input.keys())
            
            try:
                input_str = json_impl.dumps(tool_input)
                summary["input_size"] = len(input_str.encode('utf-8'))
            except:
                summary["input_size"] = 0
            
            # Check for operations
            if any(key in tool_input for key in ["file_path", "path"]):
                summary["involves_file_operations"] = True
            
            if any(key in tool_input for key in ["url", "endpoint"]):
                summary["involves_network"] = True
            
            if "command" in tool_input:
                summary["involves_command_execution"] = True
        
        return summary
    
    def analyze_tool_security(self, tool_name: str, tool_input: Any, 
                             tool_response: Dict[str, Any]) -> Tuple[str, str]:
        """Fast security analysis for tool execution."""
        # Safe tools (fast path)
        safe_tools = {
            "Read", "Glob", "Grep", "LS", "WebFetch", "WebSearch", 
            "mcp__ide__getDiagnostics", "mcp__ide__executeCode"
        }
        
        if tool_name in safe_tools:
            return "allow", f"Safe operation: {tool_name}"
        
        # Quick security checks for common dangerous patterns
        if tool_name == "Bash":
            return self._analyze_bash_security(tool_input)
        
        if tool_name in ["Write", "Edit", "MultiEdit"]:
            return self._analyze_file_security(tool_input)
        
        if tool_name.startswith("mcp__"):
            return "allow", f"MCP tool allowed: {tool_name}"
        
        # Default allow
        return "allow", f"Tool {tool_name} allowed"
    
    def _analyze_bash_security(self, tool_input: Any) -> Tuple[str, str]:
        """Quick bash security analysis."""
        if not isinstance(tool_input, dict) or "command" not in tool_input:
            return "allow", "No command to analyze"
        
        command = str(tool_input["command"]).lower()
        
        # Only check most dangerous patterns for performance
        dangerous_patterns = [
            "rm -rf /",
            "sudo rm -rf",
            "mkfs.",
            "dd if=/dev/zero",
            ":(){ :|:& };:"
        ]
        
        for pattern in dangerous_patterns:
            if pattern in command:
                return "deny", f"Dangerous command blocked: {pattern}"
        
        return "allow", "Command appears safe"
    
    def _analyze_file_security(self, tool_input: Any) -> Tuple[str, str]:
        """Quick file operation security analysis."""
        if not isinstance(tool_input, dict):
            return "allow", "No file path to analyze"
        
        file_path = str(tool_input.get("file_path", "")).lower()
        
        # Check for critical system paths
        critical_paths = ["/etc/passwd", "/etc/shadow", "c:\\windows\\system32"]
        
        for critical in critical_paths:
            if critical in file_path:
                return "deny", f"Critical system file access blocked: {file_path}"
        
        return "allow", "File operation appears safe"

# ===========================================
# Main Entry Point
# ===========================================

def main():
    """Main entry point for the hook script."""
    try:
        # Read input from stdin
        input_data = {}
        if not sys.stdin.isatty():
            input_text = sys.stdin.read().strip()
            if input_text:
                input_data = json_impl.loads(input_text)
        
        # Initialize and run the hook
        start_time = time.perf_counter()
        
        hook = PostToolUseHook()
        result = hook.process_hook(input_data)
        
        # Add execution time
        execution_time = (time.perf_counter() - start_time) * 1000
        result["execution_time_ms"] = execution_time
        
        # Log performance
        if execution_time > 100:
            logger.warning(f"Hook exceeded 100ms requirement: {execution_time:.2f}ms")
        
        # Output result
        print(json_impl.dumps(result, indent=2))
        sys.exit(0)
        
    except json.JSONDecodeError:
        print(json_impl.dumps({"continue": True, "suppressOutput": False}))
        sys.exit(0)
        
    except Exception as e:
        logger.debug(f"Hook execution failed: {e}")
        print(json_impl.dumps({"continue": True, "suppressOutput": False}))
        sys.exit(0)

if __name__ == "__main__":
    main()