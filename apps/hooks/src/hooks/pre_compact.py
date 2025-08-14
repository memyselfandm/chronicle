#!/usr/bin/env python3
"""
Pre-Compact Hook for Claude Code Observability

Captures conversation compaction events before context compression including:
- Conversation state before compaction
- Memory usage and token count metrics  
- Content analysis and preservation strategies
- Performance impact assessment

This hook implements pre-compaction observability requirements.
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


class PreCompactHook(BaseHook):
    """Hook for capturing pre-compaction conversation state."""
    
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        """Initialize the pre-compact hook."""
        super().__init__(config or {})
        self.hook_event_name = "pre_compact"
    
    def process_hook_input(self, hook_input: Dict[str, Any]) -> Dict[str, Any]:
        """
        Process pre-compact hook input.
        
        Args:
            hook_input: The input data from Claude Code
            
        Returns:
            Processed pre-compaction data to save
        """
        try:
            # Extract conversation metrics
            conversation_metrics = self._extract_conversation_metrics(hook_input)
            
            # Analyze content types and distribution
            content_analysis = self._analyze_content_distribution(hook_input)
            
            # Calculate memory and performance impact
            performance_impact = self._calculate_performance_impact(hook_input)
            
            # Determine compaction trigger reason
            trigger_reason = self._determine_compaction_trigger(hook_input)
            
            # Prepare event data
            event_data = {
                'trigger_reason': trigger_reason,
                'conversation_metrics': conversation_metrics,
                'content_analysis': content_analysis,
                'performance_impact': performance_impact,
                'timestamp': datetime.utcnow().isoformat() + 'Z',
                'context': {
                    'session_id': os.getenv('CLAUDE_SESSION_ID', 'unknown'),
                    'project_context': {
                        'working_directory': os.getcwd(),
                        'project_dir': os.getenv('CLAUDE_PROJECT_DIR', os.getcwd())
                    }
                }
            }
            
            # Add preservation strategy if available
            if 'preservationStrategy' in hook_input:
                event_data['preservation_strategy'] = hook_input['preservationStrategy']
            
            # Add expected compression ratio
            expected_ratio = self._estimate_compression_ratio(conversation_metrics, content_analysis)
            event_data['estimated_compression_ratio'] = expected_ratio
            
            logger.info(f"Pre-compact state captured: {trigger_reason}")
            return event_data
            
        except Exception as e:
            logger.error(f"Error processing pre-compact hook: {e}")
            return {
                'error': str(e),
                'trigger_reason': hook_input.get('triggerReason', 'unknown'),
                'timestamp': datetime.utcnow().isoformat() + 'Z'
            }
    
    def _extract_conversation_metrics(self, hook_input: Dict[str, Any]) -> Dict[str, Any]:
        """
        Extract conversation metrics before compaction.
        
        Args:
            hook_input: Hook input data
            
        Returns:
            Conversation metrics dictionary
        """
        metrics = {}
        
        # Message counts
        metrics['total_messages'] = hook_input.get('totalMessages', 0)
        metrics['user_messages'] = hook_input.get('userMessages', 0)
        metrics['assistant_messages'] = hook_input.get('assistantMessages', 0)
        metrics['system_messages'] = hook_input.get('systemMessages', 0)
        
        # Token metrics
        metrics['total_tokens'] = hook_input.get('totalTokens', 0)
        metrics['input_tokens'] = hook_input.get('inputTokens', 0)
        metrics['output_tokens'] = hook_input.get('outputTokens', 0)
        
        # Content size metrics
        metrics['total_characters'] = hook_input.get('totalCharacters', 0)
        metrics['average_message_length'] = 0
        if metrics['total_messages'] > 0:
            metrics['average_message_length'] = metrics['total_characters'] / metrics['total_messages']
        
        # Conversation duration
        if 'conversationStartTime' in hook_input:
            start_time = hook_input['conversationStartTime']
            try:
                start_dt = datetime.fromisoformat(start_time.replace('Z', '+00:00'))
                duration_seconds = (datetime.utcnow() - start_dt.replace(tzinfo=None)).total_seconds()
                metrics['conversation_duration_seconds'] = duration_seconds
                metrics['conversation_duration_hours'] = duration_seconds / 3600
            except ValueError:
                metrics['conversation_duration_seconds'] = 0
        
        # Tool usage in conversation
        metrics['tools_used_count'] = hook_input.get('toolsUsedCount', 0)
        metrics['unique_tools_count'] = hook_input.get('uniqueToolsCount', 0)
        
        return metrics
    
    def _analyze_content_distribution(self, hook_input: Dict[str, Any]) -> Dict[str, Any]:
        """
        Analyze content type distribution in conversation.
        
        Args:
            hook_input: Hook input data
            
        Returns:
            Content analysis dictionary
        """
        analysis = {}
        
        # Content type breakdown
        content_types = hook_input.get('contentTypes', {})
        analysis['content_types'] = content_types
        
        # Calculate percentages
        total_content = sum(content_types.values()) if content_types else 0
        if total_content > 0:
            analysis['content_type_percentages'] = {
                content_type: (count / total_content) * 100
                for content_type, count in content_types.items()
            }
        
        # Code vs text ratio
        code_content = content_types.get('code', 0)
        text_content = content_types.get('text', 0)
        total_main_content = code_content + text_content
        
        if total_main_content > 0:
            analysis['code_to_text_ratio'] = code_content / total_main_content
        else:
            analysis['code_to_text_ratio'] = 0.0
        
        # Identify high-value content
        analysis['high_value_content'] = self._identify_high_value_content(hook_input)
        
        # Repetitive content detection
        analysis['repetitive_content_detected'] = hook_input.get('repetitiveContentDetected', False)
        analysis['repetitive_content_percentage'] = hook_input.get('repetitiveContentPercentage', 0.0)
        
        return analysis
    
    def _calculate_performance_impact(self, hook_input: Dict[str, Any]) -> Dict[str, Any]:
        """
        Calculate performance impact metrics.
        
        Args:
            hook_input: Hook input data
            
        Returns:
            Performance impact dictionary
        """
        impact = {}
        
        # Memory usage
        impact['memory_usage_mb'] = hook_input.get('memoryUsageMB', 0)
        impact['memory_pressure'] = hook_input.get('memoryPressure', 'normal')
        
        # Processing time metrics
        impact['average_response_time_ms'] = hook_input.get('averageResponseTimeMs', 0)
        impact['last_response_time_ms'] = hook_input.get('lastResponseTimeMs', 0)
        
        # Context window usage
        impact['context_window_usage_percentage'] = hook_input.get('contextWindowUsagePercentage', 0.0)
        impact['approaching_context_limit'] = impact['context_window_usage_percentage'] > 80.0
        
        # Quality degradation indicators
        impact['quality_degradation_detected'] = hook_input.get('qualityDegradationDetected', False)
        impact['response_coherence_score'] = hook_input.get('responseCoherenceScore', 1.0)
        
        return impact
    
    def _determine_compaction_trigger(self, hook_input: Dict[str, Any]) -> str:
        """
        Determine what triggered the compaction.
        
        Args:
            hook_input: Hook input data
            
        Returns:
            Trigger reason string
        """
        # Check for explicit trigger reason
        if 'triggerReason' in hook_input:
            return hook_input['triggerReason']
        
        # Infer from context
        context_usage = hook_input.get('contextWindowUsagePercentage', 0.0)
        memory_pressure = hook_input.get('memoryPressure', 'normal')
        
        if context_usage > 90.0:
            return 'context_window_full'
        elif context_usage > 80.0:
            return 'context_window_near_full'
        elif memory_pressure == 'high':
            return 'memory_pressure'
        elif hook_input.get('qualityDegradationDetected', False):
            return 'quality_degradation'
        elif hook_input.get('userRequested', False):
            return 'user_requested'
        else:
            return 'automatic_threshold'
    
    def _identify_high_value_content(self, hook_input: Dict[str, Any]) -> Dict[str, Any]:
        """
        Identify high-value content that should be preserved.
        
        Args:
            hook_input: Hook input data
            
        Returns:
            High-value content analysis
        """
        high_value = {}
        
        # Code definitions and implementations
        high_value['code_definitions_count'] = hook_input.get('codeDefinitionsCount', 0)
        high_value['function_definitions_count'] = hook_input.get('functionDefinitionsCount', 0)
        
        # Important decisions and reasoning
        high_value['decision_points_count'] = hook_input.get('decisionPointsCount', 0)
        high_value['reasoning_chains_count'] = hook_input.get('reasoningChainsCount', 0)
        
        # Error patterns and solutions
        high_value['error_patterns_count'] = hook_input.get('errorPatternsCount', 0)
        high_value['solution_patterns_count'] = hook_input.get('solutionPatternsCount', 0)
        
        # Tool usage patterns
        high_value['tool_usage_patterns_count'] = hook_input.get('toolUsagePatternsCount', 0)
        
        # User preferences and context
        high_value['user_preferences_count'] = hook_input.get('userPreferencesCount', 0)
        high_value['project_context_items_count'] = hook_input.get('projectContextItemsCount', 0)
        
        return high_value
    
    def _estimate_compression_ratio(self, conversation_metrics: Dict[str, Any], 
                                  content_analysis: Dict[str, Any]) -> float:
        """
        Estimate expected compression ratio.
        
        Args:
            conversation_metrics: Conversation metrics
            content_analysis: Content analysis
            
        Returns:
            Estimated compression ratio (0.0 to 1.0)
        """
        # Base compression ratio
        base_ratio = 0.5  # 50% typical compression
        
        # Adjust based on repetitive content
        repetitive_percentage = content_analysis.get('repetitive_content_percentage', 0.0)
        if repetitive_percentage > 20.0:
            base_ratio *= 0.7  # More aggressive compression for repetitive content
        
        # Adjust based on content types
        content_types = content_analysis.get('content_types', {})
        total_content = sum(content_types.values()) if content_types else 1
        
        # Code content compresses less well
        code_percentage = content_types.get('code', 0) / total_content if total_content > 0 else 0
        if code_percentage > 0.5:
            base_ratio *= 1.2  # Less compression for code-heavy conversations
        
        # High-value content should be preserved more
        high_value = content_analysis.get('high_value_content', {})
        high_value_indicators = sum(high_value.values())
        if high_value_indicators > 10:
            base_ratio *= 1.1  # Less compression for high-value content
        
        # Ensure ratio stays within bounds
        return max(0.1, min(0.9, base_ratio))


def main():
    """Main function for hook execution."""
    hook = PreCompactHook()
    hook.run()


if __name__ == "__main__":
    main()