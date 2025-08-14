#!/usr/bin/env python3
"""
Notification Hook for Claude Code Observability

Captures system notifications and alerts from Claude Code including:
- Error notifications and warnings
- System status messages
- User interface notifications
- Performance alerts and resource usage warnings

This hook implements notification tracking requirements.
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


class NotificationHook(BaseHook):
    """Hook for capturing Claude Code notifications."""
    
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        """Initialize the notification hook."""
        super().__init__(config or {})
        self.hook_event_name = "notification"
    
    def process_hook_input(self, hook_input: Dict[str, Any]) -> Dict[str, Any]:
        """
        Process notification hook input.
        
        Args:
            hook_input: The input data from Claude Code
            
        Returns:
            Processed notification data to save
        """
        try:
            # Extract notification information
            notification_type = hook_input.get('type', 'unknown')
            message = hook_input.get('message', '')
            level = hook_input.get('level', 'info')
            source = hook_input.get('source', 'system')
            
            # Analyze notification properties
            message_length = len(message)
            contains_error_indicators = self._check_error_indicators(message)
            severity_score = self._calculate_severity_score(level, message)
            
            # Categorize notification type
            category = self._categorize_notification(notification_type, message, level)
            
            # Prepare event data
            event_data = {
                'notification_type': notification_type,
                'message': message,
                'level': level,
                'source': source,
                'analysis': {
                    'message_length': message_length,
                    'contains_error_indicators': contains_error_indicators,
                    'severity_score': severity_score,
                    'category': category
                },
                'timestamp': datetime.utcnow().isoformat() + 'Z',
                'context': {
                    'session_context': self._extract_session_context(),
                    'system_state': {
                        'working_directory': os.getcwd()
                    }
                }
            }
            
            # Add additional context for error notifications
            if level.lower() in ['error', 'critical', 'fatal']:
                event_data['error_context'] = self._extract_error_context(hook_input)
            
            logger.info(f"Notification captured: {notification_type} ({level})")
            return event_data
            
        except Exception as e:
            logger.error(f"Error processing notification hook: {e}")
            return {
                'error': str(e),
                'notification_type': hook_input.get('type', 'unknown'),
                'level': 'error',
                'timestamp': datetime.utcnow().isoformat() + 'Z'
            }
    
    def _check_error_indicators(self, message: str) -> bool:
        """
        Check if message contains error indicators.
        
        Args:
            message: Notification message
            
        Returns:
            True if error indicators found
        """
        error_keywords = [
            'error', 'failed', 'exception', 'timeout', 'crashed',
            'abort', 'fatal', 'critical', 'denied', 'forbidden',
            'not found', 'unavailable', 'unreachable', 'invalid'
        ]
        
        message_lower = message.lower()
        return any(keyword in message_lower for keyword in error_keywords)
    
    def _calculate_severity_score(self, level: str, message: str) -> int:
        """
        Calculate severity score for notification.
        
        Args:
            level: Notification level
            message: Notification message
            
        Returns:
            Severity score (1-10, 10 being most severe)
        """
        base_scores = {
            'debug': 1,
            'info': 2,
            'notice': 3,
            'warning': 5,
            'error': 7,
            'critical': 9,
            'fatal': 10
        }
        
        base_score = base_scores.get(level.lower(), 5)
        
        # Adjust based on message content
        if self._check_error_indicators(message):
            base_score = min(base_score + 2, 10)
        
        # Check for performance-related issues
        performance_keywords = ['slow', 'timeout', 'memory', 'cpu', 'resource']
        if any(keyword in message.lower() for keyword in performance_keywords):
            base_score = min(base_score + 1, 10)
        
        return base_score
    
    def _categorize_notification(self, notification_type: str, message: str, level: str) -> str:
        """
        Categorize the notification type.
        
        Args:
            notification_type: Type of notification
            message: Notification message
            level: Notification level
            
        Returns:
            Notification category
        """
        message_lower = message.lower()
        
        # Performance-related
        if any(keyword in message_lower for keyword in ['performance', 'slow', 'timeout', 'memory', 'cpu']):
            return 'performance'
        
        # Security-related
        if any(keyword in message_lower for keyword in ['security', 'denied', 'forbidden', 'unauthorized', 'auth']):
            return 'security'
        
        # Network-related
        if any(keyword in message_lower for keyword in ['network', 'connection', 'unreachable', 'connectivity']):
            return 'network'
        
        # System errors
        if level.lower() in ['error', 'critical', 'fatal']:
            return 'system_error'
        
        # Tool-related
        if any(keyword in message_lower for keyword in ['tool', 'command', 'execution']):
            return 'tool_execution'
        
        # Default category
        return 'general'
    
    def _extract_error_context(self, hook_input: Dict[str, Any]) -> Dict[str, Any]:
        """
        Extract additional context for error notifications.
        
        Args:
            hook_input: Hook input data
            
        Returns:
            Error context dictionary
        """
        context = {}
        
        # Extract stack trace if available
        if 'stackTrace' in hook_input:
            context['stack_trace'] = hook_input['stackTrace']
        
        # Extract error code if available
        if 'errorCode' in hook_input:
            context['error_code'] = hook_input['errorCode']
        
        # Extract component information
        if 'component' in hook_input:
            context['component'] = hook_input['component']
        
        # Extract related tool information
        if 'relatedTool' in hook_input:
            context['related_tool'] = hook_input['relatedTool']
        
        return context
    
    def _extract_session_context(self) -> Dict[str, Any]:
        """Extract current session context."""
        return {
            'session_id': os.getenv('CLAUDE_SESSION_ID', 'unknown'),
            'project_dir': os.getenv('CLAUDE_PROJECT_DIR', os.getcwd()),
            'environment': os.getenv('CLAUDE_ENVIRONMENT', 'unknown')
        }


def main():
    """Main function for hook execution."""
    hook = NotificationHook()
    hook.run()


if __name__ == "__main__":
    main()