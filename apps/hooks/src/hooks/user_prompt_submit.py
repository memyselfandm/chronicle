#!/usr/bin/env python3
"""
User Prompt Capture Hook for Claude Code.

This hook captures user prompts before processing to track user behavior,
prompt complexity, and intent classification for observability.

Features:
- Parse Claude Code input JSON to extract prompt text and metadata
- Capture prompt length, timestamp, and session context
- Store as event_type='prompt' with data containing: {prompt_text, prompt_length, context}
- Handle both direct prompts and follow-up messages
- Output original JSON unchanged (pass-through behavior)
"""

import json
import os
import re
import sys
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

# Add the core directory to Python path for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'core'))

try:
    from base_hook import BaseHook
    from utils import sanitize_data, extract_session_context, get_git_info
except ImportError:
    # Try importing from core package
    from core.base_hook import BaseHook
    from core.utils import sanitize_data, extract_session_context, get_git_info


class UserPromptSubmitHook(BaseHook):
    """Hook for capturing and analyzing user prompts."""
    
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        """Initialize the user prompt capture hook."""
        super().__init__(config)
        
        # Intent classification patterns
        self.intent_patterns = {
            'code_generation': [
                r'\b(create|write|generate|implement|build)\b.*\b(function|class|component|file|script|code)\b',
                r'\bhelp me (write|create|build|implement)\b',
                r'\bneed (a|an|some)\b.*\b(function|class|script|component)\b'
            ],
            'code_modification': [
                r'\b(fix|update|modify|change|refactor|optimize|improve)\b',
                r'\b(add|remove|delete)\b.*\b(to|from)\b',
                r'\bmake.*\b(better|faster|cleaner|more efficient)\b'
            ],
            'debugging': [
                r'\b(debug|fix|error|issue|problem|bug|failing|broken)\b',
                r'\b(not working|doesn\'t work|isn\'t working)\b',
                r'\bwhy (is|does|doesn\'t|isn\'t)\b',
                r'\bthrows?\s+(an?\s+)?(error|exception)\b'
            ],
            'explanation': [
                r'\b(explain|what|how|why)\b',
                r'\b(tell me about|describe|clarify|understand)\b',
                r'\b(meaning|purpose|does this do)\b'
            ],
            'configuration': [
                r'\b(setup|configure|install|settings)\b',
                r'\b(environment|config|preferences)\b'
            ]
        }
    
    def process_prompt_input(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Process user prompt input and capture analytics data.
        
        Args:
            input_data: Raw hook input data from Claude Code
            
        Returns:
            Original input data unchanged (pass-through behavior)
        """
        try:
            # Process hook data to extract common fields and session ID
            hook_data = self.process_hook_data(input_data)
            
            # Check if this is a valid prompt event
            if not self._is_valid_prompt_input(input_data):
                return input_data
            
            # Extract prompt data and analytics
            prompt_data = self.extract_prompt_data(input_data)
            
            # Create event data for database storage
            event_data = {
                "event_type": "prompt",
                "hook_event_name": hook_data["hook_event_name"],
                "timestamp": prompt_data["timestamp"],
                "data": {
                    "prompt_text": prompt_data["prompt_text"],
                    "prompt_length": prompt_data["prompt_length"],
                    "context": prompt_data["context"]
                },
                "raw_input": hook_data["raw_input"]
            }
            
            # Save event to database (non-blocking)
            success = self.save_event(event_data)
            if not success:
                # Log error but don't break the hook
                self.log_error(Exception("Failed to save prompt event"), "process_prompt_input")
        
        except Exception as e:
            # Log error but ensure we return the original input
            self.log_error(e, "process_prompt_input")
        
        # Always return original input unchanged (pass-through behavior)
        return input_data
    
    def extract_prompt_data(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Extract and analyze prompt data from input.
        
        Args:
            input_data: Hook input containing prompt information
            
        Returns:
            Dictionary with prompt text, length, and analytical context
        """
        # Get the prompt text
        prompt_text = input_data.get("prompt", "")
        
        # Sanitize prompt text to remove sensitive information
        sanitized_prompt = sanitize_data(prompt_text)
        if isinstance(sanitized_prompt, str):
            prompt_text = sanitized_prompt
        
        # Calculate prompt length (using original for accuracy, after sanitization for safety)
        prompt_length = len(prompt_text)
        
        # Extract timestamp from metadata or generate one
        metadata = input_data.get("metadata", {})
        timestamp = metadata.get("timestamp")
        if not timestamp:
            timestamp = datetime.now().isoformat()
        
        # Analyze prompt for context information
        context = self._analyze_prompt_context(prompt_text, input_data, metadata)
        
        return {
            "prompt_text": prompt_text,
            "prompt_length": prompt_length,
            "timestamp": timestamp,
            "context": context,
            "event_type": "prompt"
        }
    
    def _analyze_prompt_context(self, prompt_text: str, input_data: Dict[str, Any], 
                               metadata: Dict[str, Any]) -> Dict[str, Any]:
        """
        Analyze prompt for contextual information.
        
        Args:
            prompt_text: The user's prompt text
            input_data: Full input data 
            metadata: Metadata from input
            
        Returns:
            Dictionary containing analytical context
        """
        context = {
            # Basic session context
            "cwd": input_data.get("cwd", os.getcwd()),
            "user": os.getenv("USER", "unknown"),
            "transcript_path": input_data.get("transcriptPath"),
            
            # Prompt analysis
            "intent": self._classify_intent(prompt_text),
            "complexity_score": self._calculate_complexity_score(prompt_text),
            "has_code_blocks": self._has_code_blocks(prompt_text),
            "question_count": prompt_text.count('?'),
            "file_references": self._extract_file_references(prompt_text),
            
            # Interaction patterns
            "is_follow_up": metadata.get("isFollowUp", False),
            "prompt_type": self._classify_prompt_type(prompt_text, metadata),
            
            # Git context if available
            "git_info": get_git_info(input_data.get("cwd"))
        }
        
        return context
    
    def _classify_intent(self, prompt_text: str) -> str:
        """
        Classify the user's intent based on prompt content.
        
        Args:
            prompt_text: The user's prompt
            
        Returns:
            Intent classification string
        """
        prompt_lower = prompt_text.lower()
        intent_scores = {}
        
        for intent, patterns in self.intent_patterns.items():
            score = 0
            for pattern in patterns:
                matches = len(re.findall(pattern, prompt_lower, re.IGNORECASE))
                score += matches
            
            if patterns:  # Avoid division by zero
                intent_scores[intent] = score / len(patterns)
        
        if not intent_scores or max(intent_scores.values()) == 0:
            return "general"
        
        # Return the intent with the highest score
        return max(intent_scores.items(), key=lambda x: x[1])[0]
    
    def _calculate_complexity_score(self, prompt_text: str) -> float:
        """
        Calculate a complexity score for the prompt.
        
        Args:
            prompt_text: The user's prompt
            
        Returns:
            Complexity score as float
        """
        # Base score from word count
        base_score = len(prompt_text.split()) * 0.1
        
        # Add complexity for code blocks
        code_complexity = len(re.findall(r'```[\s\S]*?```', prompt_text)) * 2.0
        
        # Add complexity for questions
        question_complexity = prompt_text.count('?') * 0.5
        
        # Add complexity for technical terms
        tech_terms = len(re.findall(
            r'\b(function|class|variable|import|export|error|exception|debug|api|database|server|client)\b', 
            prompt_text, 
            re.IGNORECASE
        )) * 0.3
        
        # Add complexity for file references
        file_complexity = len(self._extract_file_references(prompt_text)) * 0.4
        
        return base_score + code_complexity + question_complexity + tech_terms + file_complexity
    
    def _has_code_blocks(self, prompt_text: str) -> bool:
        """Check if prompt contains code blocks."""
        return bool(re.search(r'```[\s\S]*?```', prompt_text))
    
    def _extract_file_references(self, prompt_text: str) -> List[str]:
        """
        Extract file references from prompt text.
        
        Args:
            prompt_text: The user's prompt
            
        Returns:
            List of file references found
        """
        # Pattern to match common file extensions
        file_pattern = r'\b\w+\.\w{1,6}\b'
        
        # Find potential file references
        potential_files = re.findall(file_pattern, prompt_text)
        
        # Filter out common false positives (like URLs, versions, etc.)
        file_extensions = {
            'py', 'js', 'ts', 'jsx', 'tsx', 'html', 'css', 'json', 'yaml', 'yml', 
            'xml', 'md', 'txt', 'csv', 'sql', 'sh', 'bash', 'php', 'java', 'cpp', 
            'c', 'h', 'go', 'rs', 'rb', 'swift', 'kt', 'scala', 'clj', 'r', 'pl',
            'config', 'conf', 'ini', 'toml', 'properties', 'env', 'log'
        }
        
        valid_files = []
        for potential_file in potential_files:
            extension = potential_file.split('.')[-1].lower()
            if extension in file_extensions:
                valid_files.append(potential_file)
        
        return valid_files
    
    def _classify_prompt_type(self, prompt_text: str, metadata: Dict[str, Any]) -> str:
        """
        Classify the type of prompt.
        
        Args:
            prompt_text: The user's prompt
            metadata: Metadata from input
            
        Returns:
            Prompt type classification
        """
        # Check metadata first
        if metadata.get("isFollowUp", False):
            return "followup"
        
        # Classify based on content
        if len(prompt_text.split()) < 5:
            return "brief"
        elif self._has_code_blocks(prompt_text):
            return "technical"
        elif prompt_text.count('?') > 0:
            return "question"
        elif any(word in prompt_text.lower() for word in ['help', 'please', 'can you']):
            return "request"
        else:
            return "statement"
    
    def _is_valid_prompt_input(self, input_data: Dict[str, Any]) -> bool:
        """
        Check if input data contains a valid prompt to process.
        
        Args:
            input_data: Hook input data
            
        Returns:
            True if valid prompt input, False otherwise
        """
        return (
            isinstance(input_data, dict) and
            "prompt" in input_data and
            isinstance(input_data["prompt"], str) and
            len(input_data["prompt"].strip()) > 0
        )


def main():
    """Main entry point for standalone script execution."""
    try:
        # Read input from stdin
        input_data = sys.stdin.read()
        
        # Parse JSON input
        parsed_input = json.loads(input_data)
        
        # Create hook instance and process
        hook = UserPromptSubmitHook()
        result = hook.process_prompt_input(parsed_input)
        
        # Write result to stdout (pass-through behavior)
        sys.stdout.write(json.dumps(result))
        sys.stdout.flush()
        
        # Exit with success
        sys.exit(0)
        
    except json.JSONDecodeError as e:
        # Invalid JSON input
        sys.stderr.write(f"Invalid JSON input: {e}\n")
        sys.exit(2)
    
    except Exception as e:
        # Unexpected error
        sys.stderr.write(f"Hook execution error: {e}\n")
        sys.exit(1)


if __name__ == "__main__":
    main()