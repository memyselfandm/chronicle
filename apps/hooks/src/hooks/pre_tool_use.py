#!/usr/bin/env -S uv run
# /// script
# requires-python = ">=3.8"
# dependencies = [
#     "aiosqlite>=0.19.0",
#     "python-dotenv>=1.0.0",
#     "typing-extensions>=4.7.0",
#     "ujson>=5.8.0",
# ]
# ///
"""
Pre Tool Use Hook for Claude Code Observability - UV Single-File Script

Captures tool execution context before tool execution including:
- Tool name and input parameters
- Security checks and permission decisions
- Auto-approval rules for safe operations
- Sensitive operation detection and blocking
"""

import json
import logging
import os
import re
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

# Add src directory to path for lib imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

# Import shared library modules
from lib.database import DatabaseManager
from lib.base_hook import BaseHook, create_event_data, setup_hook_logging
from lib.utils import load_chronicle_env

# UJSON for fast JSON processing
try:
    import ujson as json_impl
except ImportError:
    import json as json_impl

# Initialize environment and logging
load_chronicle_env()
logger = setup_hook_logging("pre_tool_use")

# ===========================================
# Permission Patterns and Rules
# ===========================================

# Auto-approve patterns (safe operations)
AUTO_APPROVE_PATTERNS = {
    "documentation_files": [
        r".*\.md$", r".*\.mdx$", r".*\.rst$", r".*README.*", r".*CHANGELOG.*", r".*LICENSE.*"
    ],
    "safe_glob_patterns": [
        r"^\*\.(md|txt|json|py|js|ts|html|css)$",
        r"^\*\*/\*\.(md|txt|json|py|js|ts)$",
        r"^docs/\*\*", r"^README\*", r"^\*\.py$"
    ],
    "safe_bash_commands": [
        r"^git status$", r"^git log", r"^git diff", r"^git branch",
        r"^ls -la?$", r"^pwd$", r"^whoami$", r"^date$",
        r"^npm (list|ls)$", r"^pip (list|show)"
    ]
}

# Deny patterns (dangerous operations)
DENY_PATTERNS = {
    "sensitive_files": [
        r"^\.env$", r"^\.env\..*$", r".*/secrets/.*", r".*password.*",
        r".*\.aws/.*", r".*\.ssh/.*", r".*private.*key.*", r".*credentials.*",
        r".*token.*", r".*secret.*", r"^/etc/passwd$", r"^/etc/hosts$",
        r"^/etc/sudoers$", r".*\.pem$", r".*\.p12$", r".*\.keystore$"
    ],
    "dangerous_bash_commands": [
        r"rm\s+-rf\s+/", r"sudo\s+rm\s+-rf", r"dd\s+if=/dev/zero",
        r"curl.*\|.*bash", r"wget.*\|.*sh", r":\(\)\{.*\|.*&.*\}\;:",
        r"chmod\s+777\s+/etc", r"mkfs\.", r"fdisk", r"format\s+C:"
    ],
    "system_files": [
        r"^/etc/.*", r"^/boot/.*", r"^/usr/bin/.*", r"^/usr/sbin/.*",
        r"^C:\\Windows\\System32.*", r"^/System/.*", r"^/Library/.*"
    ]
}

# Ask patterns (require confirmation)
ASK_PATTERNS = {
    "critical_config_files": [
        r"package\.json$", r"requirements\.txt$", r"Dockerfile$",
        r"docker-compose\.ya?ml$", r"\.github/workflows/.*\.ya?ml$"
    ],
    "sudo_commands": [r"^sudo\s+.*"],
    "deployment_commands": [
        r".*deploy.*", r".*publish.*", r".*release.*", r"docker\s+push"
    ]
}

# ===========================================
# Compiled Patterns for Performance
# ===========================================

def compile_patterns():
    """Compile regex patterns for performance."""
    compiled = {
        "auto_approve": {},
        "deny": {},
        "ask": {}
    }
    
    for category, patterns in AUTO_APPROVE_PATTERNS.items():
        compiled["auto_approve"][category] = [re.compile(p, re.IGNORECASE) for p in patterns]
    
    for category, patterns in DENY_PATTERNS.items():
        compiled["deny"][category] = [re.compile(p, re.IGNORECASE) for p in patterns]
    
    for category, patterns in ASK_PATTERNS.items():
        compiled["ask"][category] = [re.compile(p, re.IGNORECASE) for p in patterns]
    
    return compiled

COMPILED_PATTERNS = compile_patterns()

# ===========================================
# Utility Functions
# ===========================================

def matches_patterns(text: str, compiled_patterns: List[re.Pattern]) -> bool:
    """Check if text matches any of the compiled patterns."""
    if not text:
        return False
    
    for pattern in compiled_patterns:
        if pattern.search(text):
            return True
    return False

def check_sensitive_parameters(tool_input: Dict[str, Any]) -> List[str]:
    """Check for sensitive parameters in tool input."""
    sensitive_types = []
    
    if not isinstance(tool_input, dict):
        return sensitive_types
    
    sensitive_keys = {
        'password': 'password',
        'token': 'token', 
        'secret': 'secret',
        'key': 'api_key',
        'auth': 'auth',
        'credential': 'credential'
    }
    
    for param_name, param_value in tool_input.items():
        param_lower = param_name.lower()
        
        for sensitive_key, sensitive_type in sensitive_keys.items():
            if sensitive_key in param_lower:
                sensitive_types.append(sensitive_type)
                break
        
        # Check for URLs with credentials
        if isinstance(param_value, str):
            if any(protocol in param_value.lower() for protocol in ['http://', 'https://']):
                if any(indicator in param_value.lower() for indicator in ['token=', 'key=', 'secret=']):
                    sensitive_types.append('url_with_credentials')
    
    return list(set(sensitive_types))


class PreToolUseHook(BaseHook):
    """Hook for pre-tool execution with permission controls."""
    
    def __init__(self):
        super().__init__()
    
    def process_hook(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """Process pre-tool use hook with permission evaluation."""
        try:
            # Process input data using base hook functionality
            processed_data = self.process_hook_data(input_data, "PreToolUse")
            
            # Extract tool information as per Claude Code spec
            tool_name = input_data.get('tool_name', 'unknown')
            tool_input = input_data.get('tool_input', {})
            
            # Fast permission evaluation
            permission_result = self.evaluate_permission_decision(input_data)
            
            # Create event data for logging
            event_data = create_event_data(
                event_type="pre_tool_use",
                hook_event_name="PreToolUse",
                data={
                    "tool_name": tool_name,
                    "tool_input": self._sanitize_tool_input(tool_input),
                    "permission_decision": permission_result["permissionDecision"],
                    "permission_reason": permission_result["permissionDecisionReason"],
                    "analysis": {
                        "input_size_bytes": len(str(tool_input)),
                        "parameter_count": len(tool_input) if isinstance(tool_input, dict) else 0,
                        "sensitive_params": check_sensitive_parameters(tool_input)
                    }
                }
            )
            
            # Save event
            save_success = self.save_event(event_data)
            logger.debug(f"Event save result: {save_success}")
            
            # Create response based on permission decision
            return self._create_permission_response(tool_name, permission_result, save_success)
            
        except Exception as e:
            logger.debug(f"Hook processing error: {e}")
            
            # Default to ask for safety
            return self.create_response(
                continue_execution=False,
                suppress_output=False,
                hook_specific_data=self.create_hook_specific_output(
                    hook_event_name="PreToolUse",
                    permission_decision="ask",
                    permission_decision_reason="Error in permission evaluation",
                    tool_name=input_data.get('tool_name', 'unknown')
                )
            )
    
    def evaluate_permission_decision(self, hook_input: Dict[str, Any]) -> Dict[str, str]:
        """Evaluate permission decision for tool execution."""
        tool_name = hook_input.get('tool_name', '')
        tool_input = hook_input.get('tool_input', {})
        
        if not tool_name:
            return {
                "permissionDecision": "ask",
                "permissionDecisionReason": "Missing tool name - manual review required"
            }
        
        if not isinstance(tool_input, dict):
            return {
                "permissionDecision": "ask",
                "permissionDecisionReason": "Malformed input - manual review required"
            }
        
        # Check for denial first
        denial_result = self._check_denial(tool_name, tool_input)
        if denial_result:
            return denial_result
        
        # Check for auto-approval
        approval_result = self._check_auto_approval(tool_name, tool_input)
        if approval_result:
            return approval_result
        
        # Check for ask confirmation
        ask_result = self._check_ask_confirmation(tool_name, tool_input)
        if ask_result:
            return ask_result
        
        # Default for standard tools - allow to respect auto-approve mode
        standard_tools = ["Read", "Write", "Edit", "MultiEdit", "Bash", "Glob", "Grep", "LS", "WebFetch", "WebSearch", "TodoWrite"]
        
        if tool_name in standard_tools:
            return {
                "permissionDecision": "allow",
                "permissionDecisionReason": f"Standard operation auto-approved: {tool_name}"
            }
        
        # Unknown tools
        return {
            "permissionDecision": "ask", 
            "permissionDecisionReason": f"Unknown tool '{tool_name}' requires review"
        }
    
    def _check_denial(self, tool_name: str, tool_input: Dict[str, Any]) -> Optional[Dict[str, str]]:
        """Check if operation should be denied."""
        # Dangerous bash commands
        if tool_name == "Bash":
            command = tool_input.get('command', '')
            if matches_patterns(command, COMPILED_PATTERNS["deny"].get("dangerous_bash_commands", [])):
                return {
                    "permissionDecision": "deny",
                    "permissionDecisionReason": f"Dangerous bash command blocked: {command[:50]}..."
                }
        
        # Sensitive file access
        if tool_name in ["Read", "Write", "Edit", "MultiEdit"]:
            file_path = tool_input.get('file_path', '')
            if matches_patterns(file_path, COMPILED_PATTERNS["deny"].get("sensitive_files", [])):
                return {
                    "permissionDecision": "deny",
                    "permissionDecisionReason": f"Sensitive file access blocked: {file_path}"
                }
            
            if matches_patterns(file_path, COMPILED_PATTERNS["deny"].get("system_files", [])):
                return {
                    "permissionDecision": "deny",
                    "permissionDecisionReason": f"System file access blocked: {file_path}"
                }
        
        return None
    
    def _check_auto_approval(self, tool_name: str, tool_input: Dict[str, Any]) -> Optional[Dict[str, str]]:
        """Check if operation should be auto-approved."""
        # Auto-approve all Read operations except sensitive files (handled by _check_denial)
        if tool_name == "Read":
            return {
                "permissionDecision": "allow",
                "permissionDecisionReason": "Auto-approved: Read operation (sensitive files blocked by deny rules)"
            }
        
        # Auto-approve standard file editing operations (except sensitive files)
        if tool_name in ["Write", "Edit", "MultiEdit"]:
            return {
                "permissionDecision": "allow", 
                "permissionDecisionReason": f"Auto-approved: {tool_name} operation (sensitive files blocked by deny rules)"
            }
        
        # Auto-approve all Glob operations except dangerous patterns (handled by _check_denial)
        if tool_name == "Glob":
            return {
                "permissionDecision": "allow",
                "permissionDecisionReason": "Auto-approved: Glob pattern search"
            }
        
        # Auto-approve safe bash commands, let dangerous ones be caught by _check_denial
        if tool_name == "Bash":
            command = tool_input.get('command', '')
            if matches_patterns(command, COMPILED_PATTERNS["auto_approve"].get("safe_bash_commands", [])):
                return {
                    "permissionDecision": "allow",
                    "permissionDecisionReason": f"Auto-approved: Safe bash command {command}"
                }
        
        # Auto-approve all safe read-only and utility tools
        safe_tools = ["LS", "WebSearch", "Grep", "WebFetch", "TodoWrite"]
        if tool_name in safe_tools:
            return {
                "permissionDecision": "allow",
                "permissionDecisionReason": f"Auto-approved: Safe utility tool {tool_name}"
            }
        
        return None
    
    def _check_ask_confirmation(self, tool_name: str, tool_input: Dict[str, Any]) -> Optional[Dict[str, str]]:
        """Check if operation requires user confirmation.
        
        NOTE: This method is disabled to respect Claude Code's auto-approve mode.
        Chronicle should be purely observational and not interfere with tool execution.
        Dangerous operations are still blocked by _check_denial().
        """
        # Disabled to respect auto-approve mode - Chronicle should not interfere
        return None
    
    def _sanitize_tool_input(self, tool_input: Dict[str, Any]) -> Dict[str, Any]:
        """Sanitize tool input for logging."""
        if not isinstance(tool_input, dict):
            return {}
        
        # Remove sensitive values but keep structure
        sanitized = {}
        for key, value in tool_input.items():
            if any(sensitive in key.lower() for sensitive in ['password', 'token', 'secret', 'key']):
                sanitized[key] = "[REDACTED]"
            elif isinstance(value, str) and len(value) > 200:
                sanitized[key] = f"{value[:100]}...[TRUNCATED]"
            else:
                sanitized[key] = value
        
        return sanitized
    
    def _create_permission_response(self, tool_name: str, permission_result: Dict[str, str], 
                                   event_saved: bool) -> Dict[str, Any]:
        """Create response based on permission decision."""
        decision = permission_result["permissionDecision"]
        reason = permission_result["permissionDecisionReason"]
        
        hook_output = self.create_hook_specific_output(
            hook_event_name="PreToolUse",
            tool_name=tool_name,
            permission_decision=decision,
            permission_decision_reason=reason,
            event_saved=event_saved
        )
        
        if decision == "allow":
            return self.create_response(
                continue_execution=True,
                suppress_output=True,  # Don't show permission grants
                hook_specific_data=hook_output
            )
        elif decision == "deny":
            response = self.create_response(
                continue_execution=False,
                suppress_output=False,
                hook_specific_data=hook_output
            )
            response["stopReason"] = reason
            return response
        else:  # ask
            response = self.create_response(
                continue_execution=True,
                suppress_output=False,
                hook_specific_data=hook_output
            )
            response["stopReason"] = reason
            return response


def main():
    """Main entry point for pre-tool use hook."""
    try:
        logger.info("=" * 60)
        logger.info("PRE TOOL USE HOOK STARTED")
        logger.info("=" * 60)
        
        # Read input from stdin
        try:
            input_data = json_impl.load(sys.stdin)
            logger.info(f"Parsed input data keys: {list(input_data.keys())}")
            
            # Log specific PreToolUse data as per Claude Code spec
            tool_name = input_data.get('tool_name', 'unknown')
            tool_input = input_data.get('tool_input', {})
            logger.info(f"Tool name: {tool_name}")
            logger.info(f"Tool input keys: {list(tool_input.keys()) if isinstance(tool_input, dict) else 'non-dict'}")
            
            # Log session ID extraction attempt
            session_id = input_data.get('session_id') or os.getenv('CLAUDE_SESSION_ID')
            logger.info(f"Session ID extracted: {'Yes' if session_id else 'No'}")
        except json.JSONDecodeError as e:
            logger.warning(f"No input data received or invalid JSON: {e}")
            input_data = {}
        
        # Process hook
        start_time = time.perf_counter()
        logger.info("Initializing PreToolUseHook...")
        
        hook = PreToolUseHook()
        logger.info("Processing permission evaluation...")
        result = hook.process_hook(input_data)
        
        # Log permission decision
        hook_output = result.get('hookSpecificOutput', {})
        permission_decision = hook_output.get('permissionDecision', 'unknown')
        permission_reason = hook_output.get('permissionDecisionReason', 'no reason')
        logger.info(f"Permission decision: {permission_decision}")
        logger.info(f"Permission reason: {permission_reason}")
        logger.info(f"Hook processing result keys: {list(result.keys())}")
        
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
        # Default safe response for invalid JSON
        safe_response = {
            "continue": False,
            "suppressOutput": False,
            "stopReason": "Invalid JSON input - manual review required",
            "hookSpecificOutput": {
                "hookEventName": "PreToolUse",
                "permissionDecision": "ask",
                "permissionDecisionReason": "Input parsing failed"
            }
        }
        print(json_impl.dumps(safe_response))
        sys.exit(0)
        
    except Exception as e:
        logger.debug(f"Critical error: {e}")
        # Default safe response
        safe_response = {
            "continue": False,
            "suppressOutput": False,
            "stopReason": "Permission system error - manual review required",
            "hookSpecificOutput": {
                "hookEventName": "PreToolUse",
                "permissionDecision": "ask",
                "permissionDecisionReason": "System error in permission evaluation"
            }
        }
        print(json_impl.dumps(safe_response))
        sys.exit(0)


if __name__ == "__main__":
    main()