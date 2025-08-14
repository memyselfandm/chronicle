#!/usr/bin/env python3
"""
Custom Chronicle Hooks Example

Demonstrates how to create custom hooks that extend Chronicle functionality.
"""

import json
import os
import sys
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Optional

# Add the core directory to path
sys.path.insert(0, str(Path(__file__).parent.parent / "src" / "core"))

from base_hook import BaseHook


class CustomAnalyticsHook(BaseHook):
    """
    Example custom hook that adds project-specific analytics.
    
    This hook demonstrates how to extend Chronicle with custom tracking
    for specific project needs.
    """
    
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        """Initialize custom analytics hook."""
        super().__init__(config or {})
        self.hook_event_name = "custom_analytics"
        
        # Custom configuration
        self.project_type = config.get("project_type", "unknown") if config else "unknown"
        self.track_file_changes = config.get("track_file_changes", True) if config else True
    
    def process_hook_input(self, hook_input: Dict[str, Any]) -> Dict[str, Any]:
        """
        Process custom analytics hook input.
        
        This example tracks:
        - Project-specific metrics
        - File modification patterns
        - Custom performance indicators
        """
        try:
            # Extract basic tool information
            tool_name = hook_input.get('toolName', 'unknown')
            tool_input = hook_input.get('toolInput', {})
            
            # Custom analytics based on tool type
            analytics_data = {
                'project_type': self.project_type,
                'tool_name': tool_name,
                'timestamp': datetime.utcnow().isoformat() + 'Z'
            }
            
            # File modification tracking
            if self.track_file_changes and tool_name in ['Edit', 'Write', 'MultiEdit']:
                analytics_data['file_modification'] = self._analyze_file_changes(tool_input)
            
            # Code analysis for development projects
            if self.project_type == 'development':
                analytics_data['code_analysis'] = self._analyze_code_operations(tool_name, tool_input)
            
            # Performance tracking
            analytics_data['performance_metrics'] = self._calculate_custom_metrics(hook_input)
            
            return analytics_data
            
        except Exception as e:
            return {
                'error': str(e),
                'tool_name': hook_input.get('toolName', 'unknown'),
                'timestamp': datetime.utcnow().isoformat() + 'Z'
            }
    
    def _analyze_file_changes(self, tool_input: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze file modification patterns."""
        analysis = {}
        
        file_path = tool_input.get('file_path', '')
        if file_path:
            # Extract file information
            path_obj = Path(file_path)
            analysis['file_extension'] = path_obj.suffix
            analysis['file_name'] = path_obj.name
            analysis['directory_depth'] = len(path_obj.parents)
            
            # Categorize file types
            if path_obj.suffix in ['.py', '.js', '.ts', '.java', '.cpp']:
                analysis['file_category'] = 'source_code'
            elif path_obj.suffix in ['.md', '.txt', '.rst']:
                analysis['file_category'] = 'documentation'
            elif path_obj.suffix in ['.json', '.yaml', '.yml', '.toml']:
                analysis['file_category'] = 'configuration'
            else:
                analysis['file_category'] = 'other'
        
        # Track content changes for Edit operations
        if 'old_string' in tool_input and 'new_string' in tool_input:
            old_len = len(tool_input['old_string'])
            new_len = len(tool_input['new_string'])
            analysis['content_change'] = {
                'old_length': old_len,
                'new_length': new_len,
                'size_delta': new_len - old_len,
                'change_type': 'expansion' if new_len > old_len else 'reduction' if new_len < old_len else 'replacement'
            }
        
        return analysis
    
    def _analyze_code_operations(self, tool_name: str, tool_input: Dict[str, Any]) -> Dict[str, Any]:
        """Analyze code-specific operations."""
        analysis = {'operation_type': tool_name}
        
        # Analyze different tool types
        if tool_name == 'Read':
            # Track what types of files are being read
            file_path = tool_input.get('file_path', '')
            if file_path:
                if any(pattern in file_path for pattern in ['test', 'spec']):
                    analysis['file_purpose'] = 'testing'
                elif any(pattern in file_path for pattern in ['config', 'settings']):
                    analysis['file_purpose'] = 'configuration'
                elif any(pattern in file_path for pattern in ['src', 'lib']):
                    analysis['file_purpose'] = 'source_code'
                else:
                    analysis['file_purpose'] = 'other'
        
        elif tool_name == 'Bash':
            # Analyze command patterns
            command = tool_input.get('command', '')
            if command:
                if any(cmd in command for cmd in ['git', 'commit', 'push', 'pull']):
                    analysis['command_category'] = 'version_control'
                elif any(cmd in command for cmd in ['npm', 'pip', 'yarn', 'install']):
                    analysis['command_category'] = 'package_management'
                elif any(cmd in command for cmd in ['test', 'pytest', 'jest']):
                    analysis['command_category'] = 'testing'
                elif any(cmd in command for cmd in ['build', 'compile', 'make']):
                    analysis['command_category'] = 'build'
                else:
                    analysis['command_category'] = 'other'
        
        return analysis
    
    def _calculate_custom_metrics(self, hook_input: Dict[str, Any]) -> Dict[str, Any]:
        """Calculate custom performance metrics."""
        metrics = {}
        
        # Extract execution time if available
        if 'executionTime' in hook_input:
            execution_time = hook_input['executionTime']
            metrics['execution_time_ms'] = execution_time
            
            # Categorize performance
            if execution_time < 100:
                metrics['performance_category'] = 'fast'
            elif execution_time < 1000:
                metrics['performance_category'] = 'normal'
            elif execution_time < 5000:
                metrics['performance_category'] = 'slow'
            else:
                metrics['performance_category'] = 'very_slow'
        
        # Track tool usage patterns
        tool_name = hook_input.get('toolName', '')
        metrics['tool_complexity'] = self._assess_tool_complexity(tool_name, hook_input.get('toolInput', {}))
        
        return metrics
    
    def _assess_tool_complexity(self, tool_name: str, tool_input: Dict[str, Any]) -> str:
        """Assess the complexity of tool operations."""
        
        # Simple complexity assessment based on tool type and input
        if tool_name in ['Read', 'LS']:
            return 'simple'
        elif tool_name in ['Write', 'Edit']:
            content_size = len(str(tool_input.get('content', tool_input.get('new_string', ''))))
            if content_size > 10000:
                return 'complex'
            elif content_size > 1000:
                return 'medium'
            else:
                return 'simple'
        elif tool_name in ['MultiEdit', 'Bash']:
            return 'complex'
        else:
            return 'medium'


def demonstrate_custom_hook():
    """Demonstrate how to use custom hooks."""
    
    print("🔧 Custom Chronicle Hooks Example")
    print("=" * 50)
    
    # Create custom hook configuration
    config = {
        "project_type": "development",
        "track_file_changes": True,
        "custom_analytics": {
            "enabled": True,
            "track_performance": True
        }
    }
    
    # Initialize custom hook
    custom_hook = CustomAnalyticsHook(config)
    
    # Example hook input (simulating Claude Code tool usage)
    example_input = {
        "toolName": "Edit",
        "toolInput": {
            "file_path": "/project/src/main.py",
            "old_string": "def hello():\n    pass",
            "new_string": "def hello():\n    print('Hello, Chronicle!')\n    return True"
        },
        "executionTime": 250
    }
    
    # Process the hook input
    result = custom_hook.process_hook_input(example_input)
    
    print("\n📊 Custom Analytics Result:")
    print(json.dumps(result, indent=2))
    
    print("\n💡 Integration Tips:")
    print("1. Save custom hooks in your project directory")
    print("2. Configure them in Claude Code settings.json")
    print("3. Use Chronicle dashboard to view custom analytics")
    print("4. Extend BaseHook for consistent behavior")


if __name__ == "__main__":
    demonstrate_custom_hook()