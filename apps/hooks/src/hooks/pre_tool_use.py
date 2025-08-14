#!/usr/bin/env python3
"""
Pre Tool Use Hook for Claude Code Observability with Permission Controls

Captures tool execution context before tool execution including:
- Tool name and input parameters
- Context analysis and parameter validation
- Security checks and input sanitization
- Pre-execution environment state
- Permission decision logic (allow/deny/ask)
- Auto-approval rules for safe operations
- Sensitive operation detection and blocking
- Clear permission reason generation

This hook implements both pre-execution observability and permission control requirements.
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

# Add the core directory to the path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'core'))

from base_hook import BaseHook

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class PreToolUseHook(BaseHook):
    """Hook for capturing pre-tool execution data with permission controls."""
    
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        """Initialize the pre-tool use hook."""
        super().__init__(config or {})
        self.hook_event_name = "PreToolUse"
        self._init_permission_rules()
    
    def _init_permission_rules(self) -> None:
        """Initialize permission rules and patterns."""
        # Default permission configuration - can be overridden via config
        permission_config = self.config.get("permission_rules", {})
        
        # Auto-approve patterns (safe operations)
        self.auto_approve_patterns = {
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
        
        # Deny patterns (sensitive/dangerous operations)
        self.deny_patterns = {
            "sensitive_files": [
                r"^\.env$", r"^\.env\..*$", r".*/secrets/.*", r".*password.*",
                r".*\.aws/.*", r".*\.ssh/.*", r".*private.*key.*", r".*credentials.*",
                r".*token.*", r".*secret.*", r"^/etc/passwd$", r"^/etc/hosts$",
                r"^/etc/sudoers$", r".*\.pem$", r".*\.p12$", r".*\.keystore$",
                r".*database\.(yml|yaml|conf)$", r".*config.*database.*"
            ],
            "dangerous_bash_commands": [
                r"rm\s+-rf\s+/", r"sudo\s+rm\s+-rf", r"dd\s+if=/dev/zero",
                r"curl.*\|.*bash", r"wget.*\|.*sh", r":\(\)\{.*\|.*&.*\}\;:",  # fork bomb
                r"chmod\s+777\s+/etc", r"mkfs\.", r"fdisk", r"format\s+C:"
            ],
            "system_files": [
                r"^/etc/.*", r"^/boot/.*", r"^/usr/bin/.*", r"^/usr/sbin/.*",
                r"^C:\\Windows\\System32.*", r"^/System/.*", r"^/Library/.*"
            ],
            "suspicious_domains": [
                r".*malware.*", r".*phishing.*", r".*suspicious.*", r".*evil.*",
                r".*bit\.ly.*", r".*tinyurl.*"  # Shortened URLs often used maliciously
            ]
        }
        
        # Ask patterns (require user confirmation)
        self.ask_patterns = {
            "critical_config_files": [
                r"package\.json$", r"requirements\.txt$", r"Dockerfile$",
                r"docker-compose\.ya?ml$", r"\.github/workflows/.*\.ya?ml$",
                r"tsconfig\.json$", r"babel\.config\.(js|json)$", r"webpack\.config\.(js|ts)$"
            ],
            "sudo_commands": [
                r"^sudo\s+.*"
            ],
            "deployment_commands": [
                r".*deploy.*", r".*publish.*", r".*release.*", r"docker\s+push",
                r"kubectl\s+apply", r"terraform\s+apply"
            ]
        }
        
        # Override with custom config if provided
        if "auto_approve_patterns" in permission_config:
            self.auto_approve_patterns.update(permission_config["auto_approve_patterns"])
        if "deny_patterns" in permission_config:
            self.deny_patterns.update(permission_config["deny_patterns"])
        if "ask_patterns" in permission_config:
            self.ask_patterns.update(permission_config["ask_patterns"])
        
        # Compile regex patterns for performance
        self._compile_patterns()
    
    def _compile_patterns(self) -> None:
        """Compile regex patterns for better performance."""
        self.compiled_auto_approve = {}
        self.compiled_deny = {}
        self.compiled_ask = {}
        
        for category, patterns in self.auto_approve_patterns.items():
            self.compiled_auto_approve[category] = [re.compile(p, re.IGNORECASE) for p in patterns]
        
        for category, patterns in self.deny_patterns.items():
            self.compiled_deny[category] = [re.compile(p, re.IGNORECASE) for p in patterns]
        
        for category, patterns in self.ask_patterns.items():
            self.compiled_ask[category] = [re.compile(p, re.IGNORECASE) for p in patterns]
    
    def process_hook_input(self, hook_input: Dict[str, Any]) -> Dict[str, Any]:
        """
        Process pre-tool use hook input.
        
        Args:
            hook_input: The input data from Claude Code
            
        Returns:
            Processed data to save
        """
        try:
            # Extract tool information
            tool_name = hook_input.get('toolName', 'unknown')
            tool_input = hook_input.get('toolInput', {})
            
            # Analyze tool input size and complexity
            input_size = len(str(tool_input))
            param_count = len(tool_input) if isinstance(tool_input, dict) else 0
            
            # Check for potentially sensitive parameters
            sensitive_params = self._check_sensitive_parameters(tool_input)
            
            # Prepare event data
            event_data = {
                'tool_name': tool_name,
                'tool_input': tool_input,
                'analysis': {
                    'input_size_bytes': input_size,
                    'parameter_count': param_count,
                    'has_sensitive_params': len(sensitive_params) > 0,
                    'sensitive_param_types': sensitive_params
                },
                'timestamp': datetime.utcnow().isoformat() + 'Z',
                'execution_context': {
                    'working_directory': os.getcwd(),
                    'environment_vars_count': len(os.environ)
                }
            }
            
            logger.info(f"Pre-tool execution captured for {tool_name}")
            return event_data
            
        except Exception as e:
            logger.error(f"Error processing pre-tool use hook: {e}")
            return {
                'error': str(e),
                'tool_name': hook_input.get('toolName', 'unknown'),
                'timestamp': datetime.utcnow().isoformat() + 'Z'
            }
    
    def _check_sensitive_parameters(self, tool_input: Dict[str, Any]) -> list:
        """
        Check for potentially sensitive parameters in tool input.
        
        Args:
            tool_input: Tool input parameters
            
        Returns:
            List of sensitive parameter types found
        """
        sensitive_types = []
        
        if not isinstance(tool_input, dict):
            return sensitive_types
        
        # Check for common sensitive parameter names
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
            
            # Check for URLs that might contain secrets
            if isinstance(param_value, str):
                if any(protocol in param_value.lower() for protocol in ['http://', 'https://']):
                    if any(indicator in param_value.lower() for indicator in ['token=', 'key=', 'secret=']):
                        sensitive_types.append('url_with_credentials')
        
        return list(set(sensitive_types))  # Remove duplicates
    
    def evaluate_permission_decision(self, hook_input: Dict[str, Any]) -> Dict[str, str]:
        """
        Evaluate permission decision for a tool execution.
        
        Args:
            hook_input: The hook input containing tool information
            
        Returns:
            Dictionary with permissionDecision and permissionDecisionReason
        """
        try:
            tool_name = hook_input.get('toolName', '')
            tool_input = hook_input.get('toolInput', {})
            
            # Handle malformed input
            if not tool_name:
                return {
                    "permissionDecision": "ask",
                    "permissionDecisionReason": "Unable to evaluate tool request - missing tool name. Please review manually."
                }
            
            if not isinstance(tool_input, dict):
                return {
                    "permissionDecision": "ask",
                    "permissionDecisionReason": "Unable to evaluate tool request - malformed input. Please review manually."
                }
            
            # Check for denial first (sensitive/dangerous operations take precedence)
            denial_result = self._check_denial(tool_name, tool_input)
            if denial_result:
                return denial_result
            
            # Check for auto-approval (safe operations)
            approval_result = self._check_auto_approval(tool_name, tool_input)
            if approval_result:
                return approval_result
            
            # Check for ask confirmation (critical operations)
            ask_result = self._check_ask_confirmation(tool_name, tool_input)
            if ask_result:
                return ask_result
            
            # Default behavior for standard tools not explicitly handled
            standard_tools = ["Read", "Write", "Edit", "MultiEdit", "Bash", "Glob", "Grep", "LS", "WebFetch", "WebSearch", "Task", "NotebookRead", "NotebookEdit"]
            
            if tool_name in standard_tools:
                # Standard tools that don't match any specific patterns default to ask
                return {
                    "permissionDecision": "ask",
                    "permissionDecisionReason": f"Standard operation requires user confirmation: {tool_name}"
                }
            else:
                # Unknown tools require manual review
                return {
                    "permissionDecision": "ask", 
                    "permissionDecisionReason": f"Unknown tool '{tool_name}' requires manual review for safety."
                }
            
        except Exception as e:
            logger.error(f"Error evaluating permission decision: {e}")
            return {
                "permissionDecision": "ask",
                "permissionDecisionReason": "Permission evaluation failed - please review manually for safety."
            }
    
    def _check_auto_approval(self, tool_name: str, tool_input: Dict[str, Any]) -> Optional[Dict[str, str]]:
        """Check if operation should be auto-approved."""
        # Documentation file reading
        if tool_name == "Read":
            file_path = tool_input.get('file_path', '')
            
            # Check standard documentation files
            if self._matches_patterns(file_path, self.compiled_auto_approve.get('documentation_files', [])):
                return {
                    "permissionDecision": "allow",
                    "permissionDecisionReason": f"Auto-approved reading of documentation file: {os.path.basename(file_path)}"
                }
            
            # Check custom read file patterns
            for category in self.compiled_auto_approve:
                if 'read' in category.lower() or 'file' in category.lower():
                    if self._matches_patterns(file_path, self.compiled_auto_approve[category]):
                        return {
                            "permissionDecision": "allow",
                            "permissionDecisionReason": f"Auto-approved file read (custom rule): {os.path.basename(file_path)}"
                        }
        
        # Safe glob patterns
        elif tool_name == "Glob":
            pattern = tool_input.get('pattern', '')
            if self._matches_patterns(pattern, self.compiled_auto_approve.get('safe_glob_patterns', [])):
                return {
                    "permissionDecision": "allow",
                    "permissionDecisionReason": f"Auto-approved safe pattern search: {pattern}"
                }
        
        # Safe grep operations
        elif tool_name == "Grep":
            return {
                "permissionDecision": "allow",
                "permissionDecisionReason": "Auto-approved content search operation - no file system changes"
            }
        
        # Directory listing operations
        elif tool_name == "LS":
            return {
                "permissionDecision": "allow",
                "permissionDecisionReason": "Auto-approved directory listing - no file system changes"
            }
        
        # Safe bash commands
        elif tool_name == "Bash":
            command = tool_input.get('command', '')
            if self._matches_patterns(command, self.compiled_auto_approve.get('safe_bash_commands', [])):
                return {
                    "permissionDecision": "allow",
                    "permissionDecisionReason": f"Auto-approved safe command: {command[:50]}..."
                }
        
        return None
    
    def _check_denial(self, tool_name: str, tool_input: Dict[str, Any]) -> Optional[Dict[str, str]]:
        """Check if operation should be denied."""
        # Sensitive file operations
        if tool_name in ["Read", "Edit", "MultiEdit", "Write"]:
            file_path = tool_input.get('file_path', '')
            
            # Check sensitive files
            if self._matches_patterns(file_path, self.compiled_deny.get('sensitive_files', [])):
                return {
                    "permissionDecision": "deny",
                    "permissionDecisionReason": f"Access denied to sensitive file: {os.path.basename(file_path)}. This file may contain secrets or credentials."
                }
            
            # Check system files (for modifications)
            if tool_name in ["Edit", "MultiEdit", "Write"] and self._matches_patterns(file_path, self.compiled_deny.get('system_files', [])):
                return {
                    "permissionDecision": "deny",
                    "permissionDecisionReason": f"Modification denied for system file: {file_path}. This could damage your system."
                }
        
        # Dangerous bash commands
        elif tool_name == "Bash":
            command = tool_input.get('command', '')
            if self._matches_patterns(command, self.compiled_deny.get('dangerous_bash_commands', [])):
                return {
                    "permissionDecision": "deny",
                    "permissionDecisionReason": f"Command blocked as potentially dangerous: {command[:100]}..."
                }
        
        # Suspicious network operations
        elif tool_name in ["WebFetch", "WebSearch"]:
            url = tool_input.get('url', '')
            if self._matches_patterns(url, self.compiled_deny.get('suspicious_domains', [])):
                return {
                    "permissionDecision": "deny",
                    "permissionDecisionReason": f"Network request denied to suspicious domain: {url}"
                }
        
        # Check file size for large file operations
        if tool_name == "Read":
            file_path = tool_input.get('file_path', '')
            try:
                if os.path.exists(file_path) and os.path.getsize(file_path) > 100 * 1024 * 1024:  # 100MB
                    return {
                        "permissionDecision": "deny",
                        "permissionDecisionReason": f"File too large to read safely: {os.path.basename(file_path)} (>100MB)"
                    }
            except (OSError, IOError):
                pass  # File doesn't exist or can't check size
        
        return None
    
    def _check_ask_confirmation(self, tool_name: str, tool_input: Dict[str, Any]) -> Optional[Dict[str, str]]:
        """Check if operation requires user confirmation."""
        # Critical configuration files
        if tool_name in ["Edit", "MultiEdit", "Write"]:
            file_path = tool_input.get('file_path', '')
            if self._matches_patterns(file_path, self.compiled_ask.get('critical_config_files', [])):
                return {
                    "permissionDecision": "ask",
                    "permissionDecisionReason": f"Confirm modification of critical configuration file: {os.path.basename(file_path)}"
                }
        
        # Sudo commands
        elif tool_name == "Bash":
            command = tool_input.get('command', '')
            if self._matches_patterns(command, self.compiled_ask.get('sudo_commands', [])):
                return {
                    "permissionDecision": "ask",
                    "permissionDecisionReason": f"Confirm command with elevated privileges: {command[:100]}..."
                }
            
            # Deployment commands
            if self._matches_patterns(command, self.compiled_ask.get('deployment_commands', [])):
                return {
                    "permissionDecision": "ask",
                    "permissionDecisionReason": f"Confirm deployment command: {command[:100]}..."
                }
        
        # Large file operations (ask for confirmation)
        if tool_name == "Read":
            file_path = tool_input.get('file_path', '')
            try:
                if os.path.exists(file_path) and os.path.getsize(file_path) > 10 * 1024 * 1024:  # 10MB
                    return {
                        "permissionDecision": "ask",
                        "permissionDecisionReason": f"Confirm reading large file: {os.path.basename(file_path)} ({os.path.getsize(file_path) / (1024*1024):.1f}MB)"
                    }
            except (OSError, IOError):
                pass  # File doesn't exist or can't check size
        
        # MCP tools - default to asking for confirmation
        if tool_name.startswith('mcp__'):
            server = tool_name.split('__')[1] if '__' in tool_name else 'unknown'
            return {
                "permissionDecision": "ask",
                "permissionDecisionReason": f"Confirm MCP tool operation from {server} server: {tool_name}"
            }
        
        return None
    
    def _matches_patterns(self, text: str, compiled_patterns: List[re.Pattern]) -> bool:
        """Check if text matches any of the compiled patterns."""
        return any(pattern.search(text) for pattern in compiled_patterns)
    
    def create_permission_response(self, hook_input: Dict[str, Any]) -> Dict[str, Any]:
        """
        Create a full hook response with permission decision.
        
        Args:
            hook_input: The hook input data
            
        Returns:
            Complete hook response dictionary
        """
        # Get permission decision
        permission_result = self.evaluate_permission_decision(hook_input)
        
        # Create hook-specific output
        hook_specific_output = {
            "hookEventName": "PreToolUse",
            "permissionDecision": permission_result["permissionDecision"],
            "permissionDecisionReason": permission_result["permissionDecisionReason"]
        }
        
        # Create full response using base class method
        response = self.create_response(
            continue_execution=True,  # Always continue, let Claude Code handle the decision
            suppress_output=False,   # Show decision reasoning to user
            hook_specific_data=hook_specific_output
        )
        
        return response
    
    def process_hook_input(self, hook_input: Dict[str, Any]) -> Dict[str, Any]:
        """
        Process pre-tool use hook input with permission evaluation.
        
        Args:
            hook_input: The input data from Claude Code
            
        Returns:
            Processed data to save including permission decision
        """
        try:
            # Get base analysis from parent class
            base_data = super().process_hook_input(hook_input)
            
            # Add permission evaluation
            permission_result = self.evaluate_permission_decision(hook_input)
            
            # Enhanced event data with permission information
            enhanced_data = {
                **base_data,
                'permission_decision': permission_result["permissionDecision"],
                'permission_reason': permission_result["permissionDecisionReason"],
                'tool_classification': self._classify_tool_operation(
                    hook_input.get('toolName', ''),
                    hook_input.get('toolInput', {})
                )
            }
            
            logger.info(f"Permission decision for {hook_input.get('toolName', 'unknown')}: {permission_result['permissionDecision']}")
            return enhanced_data
            
        except Exception as e:
            logger.error(f"Error processing pre-tool use hook with permissions: {e}")
            return {
                'error': str(e),
                'tool_name': hook_input.get('toolName', 'unknown'),
                'permission_decision': 'ask',  # Safe default
                'permission_reason': 'Error during permission evaluation - manual review required',
                'timestamp': datetime.utcnow().isoformat() + 'Z'
            }
    
    def _classify_tool_operation(self, tool_name: str, tool_input: Dict[str, Any]) -> str:
        """Classify the tool operation for analytics purposes."""
        if tool_name in ["Read", "LS", "Glob", "Grep"]:
            return "read_only"
        elif tool_name in ["Edit", "MultiEdit", "Write"]:
            return "file_modification"
        elif tool_name == "Bash":
            return "command_execution"
        elif tool_name in ["WebFetch", "WebSearch"]:
            return "network_operation"
        elif tool_name.startswith("mcp__"):
            return "mcp_tool"
        elif tool_name == "Task":
            return "subagent"
        else:
            return "unknown"
    
    def run(self) -> None:
        """
        Main execution method for the hook with permission controls.
        """
        try:
            # Read input from stdin
            hook_input = json.load(sys.stdin)
            
            # Process the hook data (includes permission evaluation)
            processed_data = self.process_hook_data(hook_input)
            
            # Process hook-specific input (includes observability data)
            hook_specific_data = self.process_hook_input(hook_input)
            
            # Combine all data for database save
            combined_data = {
                **processed_data,
                **hook_specific_data
            }
            
            # Save to database
            self.save_event(combined_data)
            
            # Create and output permission response
            response = self.create_permission_response(hook_input)
            
            # Output the response as JSON
            print(json.dumps(response))
            
        except json.JSONDecodeError as e:
            logger.error(f"Invalid JSON input: {e}")
            # Output minimal error response
            error_response = {
                "continue": True,
                "suppressOutput": False,
                "hookSpecificOutput": {
                    "hookEventName": "PreToolUse",
                    "permissionDecision": "ask",
                    "permissionDecisionReason": "Invalid input format - manual review required"
                }
            }
            print(json.dumps(error_response))
            sys.exit(1)
            
        except Exception as e:
            logger.error(f"Hook execution error: {e}")
            self.log_error(e, "hook execution")
            # Output safe fallback response
            fallback_response = {
                "continue": True,
                "suppressOutput": False,
                "hookSpecificOutput": {
                    "hookEventName": "PreToolUse",
                    "permissionDecision": "ask",
                    "permissionDecisionReason": "Hook execution error - manual review required for safety"
                }
            }
            print(json.dumps(fallback_response))
            sys.exit(1)


def main():
    """Main function for hook execution."""
    hook = PreToolUseHook()
    hook.run()


if __name__ == "__main__":
    main()