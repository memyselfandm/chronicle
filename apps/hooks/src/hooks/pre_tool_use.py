#!/usr/bin/env python3
"""
Pre Tool Use Hook for Claude Code Observability

Captures tool execution context before tool execution including:
- Tool name and input parameters
- Context analysis and parameter validation
- Security checks and input sanitization
- Pre-execution environment state

This hook implements pre-execution observability requirements.
"""

import json
import logging
import os
import sys
import time
from datetime import datetime
from typing import Any, Dict, Optional

# Add the core directory to the path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'core'))

from base_hook import BaseHook

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class PreToolUseHook(BaseHook):
    """Hook for capturing pre-tool execution data."""
    
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        """Initialize the pre-tool use hook."""
        super().__init__(config or {})
        self.hook_event_name = "pre_tool_use"
    
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


def main():
    """Main function for hook execution."""
    hook = PreToolUseHook()
    hook.run()


if __name__ == "__main__":
    main()