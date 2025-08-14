#!/usr/bin/env python3
"""
Subagent Stop Hook for Claude Code Observability

Captures subagent termination events and resource cleanup including:
- Subagent lifecycle tracking
- Resource usage summary
- Final state capture
- Performance metrics for subagent operations

This hook implements subagent lifecycle tracking requirements.
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


class SubagentStopHook(BaseHook):
    """Hook for capturing subagent termination events."""
    
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        """Initialize the subagent stop hook."""
        super().__init__(config or {})
        self.hook_event_name = "SubagentStop"
    
    def process_hook_input(self, hook_input: Dict[str, Any]) -> Dict[str, Any]:
        """
        Process subagent stop hook input.
        
        Args:
            hook_input: The input data from Claude Code
            
        Returns:
            Processed subagent termination data to save
        """
        try:
            # Extract subagent information
            subagent_id = hook_input.get('subagentId', 'unknown')
            subagent_type = hook_input.get('subagentType', 'unknown')
            exit_status = hook_input.get('exitStatus', 'unknown')
            duration_ms = hook_input.get('durationMs')
            
            # Extract performance metrics
            performance_metrics = self._extract_performance_metrics(hook_input)
            
            # Extract resource usage if available
            resource_usage = self._extract_resource_usage(hook_input)
            
            # Determine termination reason
            termination_reason = self._determine_termination_reason(hook_input, exit_status)
            
            # Prepare event data
            event_data = {
                'subagent_id': subagent_id,
                'subagent_type': subagent_type,
                'exit_status': exit_status,
                'duration_ms': duration_ms,
                'termination_reason': termination_reason,
                'performance_metrics': performance_metrics,
                'resource_usage': resource_usage,
                'timestamp': datetime.utcnow().isoformat() + 'Z',
                'context': {
                    'parent_session_id': os.getenv('CLAUDE_SESSION_ID', 'unknown'),
                    'project_context': {
                        'working_directory': os.getcwd(),
                        'project_dir': os.getenv('CLAUDE_PROJECT_DIR', os.getcwd())
                    }
                }
            }
            
            # Add error information if subagent failed
            if exit_status != 'success' and exit_status != 0:
                event_data['error_info'] = self._extract_error_info(hook_input)
            
            # Add task completion summary
            event_data['task_summary'] = self._extract_task_summary(hook_input)
            
            logger.info(f"Subagent stop captured: {subagent_id} ({subagent_type}) - {exit_status}")
            return event_data
            
        except Exception as e:
            logger.error(f"Error processing subagent stop hook: {e}")
            return {
                'error': str(e),
                'subagent_id': hook_input.get('subagentId', 'unknown'),
                'subagent_type': hook_input.get('subagentType', 'unknown'),
                'timestamp': datetime.utcnow().isoformat() + 'Z'
            }
    
    def _extract_performance_metrics(self, hook_input: Dict[str, Any]) -> Dict[str, Any]:
        """
        Extract performance metrics from subagent execution.
        
        Args:
            hook_input: Hook input data
            
        Returns:
            Performance metrics dictionary
        """
        metrics = {}
        
        # Tool usage metrics
        if 'toolsUsed' in hook_input:
            tools_used = hook_input['toolsUsed']
            metrics['tools_used_count'] = len(tools_used) if isinstance(tools_used, list) else 0
            metrics['unique_tools'] = len(set(tools_used)) if isinstance(tools_used, list) else 0
        
        # Task completion metrics
        if 'tasksCompleted' in hook_input:
            metrics['tasks_completed'] = hook_input['tasksCompleted']
        
        if 'tasksFailed' in hook_input:
            metrics['tasks_failed'] = hook_input['tasksFailed']
        
        # Response/output metrics
        if 'outputSize' in hook_input:
            metrics['output_size_bytes'] = hook_input['outputSize']
        
        # Execution efficiency
        duration_ms = hook_input.get('durationMs')
        if duration_ms and isinstance(duration_ms, (int, float)):
            metrics['duration_ms'] = duration_ms
            metrics['duration_seconds'] = duration_ms / 1000
            
            # Calculate efficiency if we have task counts
            tasks_total = metrics.get('tasks_completed', 0) + metrics.get('tasks_failed', 0)
            if tasks_total > 0:
                metrics['avg_task_duration_ms'] = duration_ms / tasks_total
        
        return metrics
    
    def _extract_resource_usage(self, hook_input: Dict[str, Any]) -> Dict[str, Any]:
        """
        Extract resource usage information.
        
        Args:
            hook_input: Hook input data
            
        Returns:
            Resource usage dictionary
        """
        usage = {}
        
        # Memory usage
        if 'memoryUsage' in hook_input:
            memory_info = hook_input['memoryUsage']
            if isinstance(memory_info, dict):
                usage['memory'] = memory_info
            else:
                usage['memory'] = {'peak_mb': memory_info}
        
        # CPU usage
        if 'cpuUsage' in hook_input:
            usage['cpu'] = hook_input['cpuUsage']
        
        # Network activity
        if 'networkActivity' in hook_input:
            usage['network'] = hook_input['networkActivity']
        
        # File system activity
        if 'fileSystemActivity' in hook_input:
            usage['filesystem'] = hook_input['fileSystemActivity']
        
        return usage
    
    def _determine_termination_reason(self, hook_input: Dict[str, Any], exit_status: Any) -> str:
        """
        Determine the reason for subagent termination.
        
        Args:
            hook_input: Hook input data
            exit_status: Exit status of subagent
            
        Returns:
            Termination reason string
        """
        # Check for explicit termination reason
        if 'terminationReason' in hook_input:
            return hook_input['terminationReason']
        
        # Infer from exit status
        if exit_status == 'success' or exit_status == 0:
            return 'completed_successfully'
        elif exit_status == 'timeout':
            return 'timeout'
        elif exit_status == 'cancelled':
            return 'user_cancelled'
        elif exit_status == 'error' or (isinstance(exit_status, int) and exit_status != 0):
            return 'error_occurred'
        elif 'interrupted' in str(exit_status).lower():
            return 'interrupted'
        else:
            return 'unknown'
    
    def _extract_error_info(self, hook_input: Dict[str, Any]) -> Dict[str, Any]:
        """
        Extract error information for failed subagents.
        
        Args:
            hook_input: Hook input data
            
        Returns:
            Error information dictionary
        """
        error_info = {}
        
        # Error message
        if 'errorMessage' in hook_input:
            error_info['message'] = hook_input['errorMessage']
        
        # Error type/code
        if 'errorType' in hook_input:
            error_info['type'] = hook_input['errorType']
        
        if 'errorCode' in hook_input:
            error_info['code'] = hook_input['errorCode']
        
        # Stack trace
        if 'stackTrace' in hook_input:
            error_info['stack_trace'] = hook_input['stackTrace']
        
        # Last successful operation
        if 'lastSuccessfulOperation' in hook_input:
            error_info['last_successful_operation'] = hook_input['lastSuccessfulOperation']
        
        return error_info
    
    def _extract_task_summary(self, hook_input: Dict[str, Any]) -> Dict[str, Any]:
        """
        Extract task completion summary.
        
        Args:
            hook_input: Hook input data
            
        Returns:
            Task summary dictionary
        """
        summary = {}
        
        # Task counts
        summary['tasks_attempted'] = hook_input.get('tasksAttempted', 0)
        summary['tasks_completed'] = hook_input.get('tasksCompleted', 0)
        summary['tasks_failed'] = hook_input.get('tasksFailed', 0)
        
        # Success rate
        attempted = summary['tasks_attempted']
        if attempted > 0:
            summary['success_rate'] = summary['tasks_completed'] / attempted
        else:
            summary['success_rate'] = 0.0
        
        # Final output/result
        if 'finalOutput' in hook_input:
            final_output = hook_input['finalOutput']
            summary['final_output_present'] = bool(final_output)
            if isinstance(final_output, str):
                summary['final_output_length'] = len(final_output)
        
        # Task types handled
        if 'taskTypes' in hook_input:
            task_types = hook_input['taskTypes']
            if isinstance(task_types, list):
                summary['task_types_handled'] = task_types
                summary['unique_task_types_count'] = len(set(task_types))
        
        return summary


def main():
    """Main function for hook execution."""
    hook = SubagentStopHook()
    hook.run()


if __name__ == "__main__":
    main()