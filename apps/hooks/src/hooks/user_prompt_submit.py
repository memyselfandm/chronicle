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
        Process user prompt input and return new JSON response format.
        
        Args:
            input_data: Raw hook input data from Claude Code
            
        Returns:
            JSON response with hookSpecificOutput containing analysis and optional additionalContext
        """
        try:
            # Process hook data to extract common fields and session ID
            hook_data = self.process_hook_data(input_data)
            
            # Check if this is a valid prompt event
            if not self._is_valid_prompt_input(input_data):
                return self.create_user_prompt_response(
                    prompt_blocked=False,
                    success=False
                )
            
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
            
            # Analyze prompt for potential context injection
            additional_context = self._generate_context_injection(prompt_data, input_data)
            
            # Check if prompt should be blocked
            block_prompt, block_reason = self._analyze_prompt_security(prompt_data)
            
            return self.create_user_prompt_response(
                additional_context=additional_context,
                prompt_blocked=block_prompt,
                block_reason=block_reason,
                success=success,
                prompt_length=prompt_data["prompt_length"],
                intent=prompt_data["context"]["intent"]
            )
        
        except Exception as e:
            # Log error and return safe response
            self.log_error(e, "process_prompt_input")
            return self.create_user_prompt_response(
                prompt_blocked=False,
                success=False
            )
    
    def create_user_prompt_response(self, additional_context: Optional[str] = None,
                                   prompt_blocked: bool = False,
                                   block_reason: Optional[str] = None,
                                   success: bool = True,
                                   **kwargs) -> Dict[str, Any]:
        """
        Create UserPromptSubmit hook response with new JSON format.
        
        Args:
            additional_context: Optional context to inject into the prompt
            prompt_blocked: Whether the prompt should be blocked
            block_reason: Reason for blocking (if blocked)
            success: Whether hook processing succeeded
            **kwargs: Additional fields for hookSpecificOutput
            
        Returns:
            Formatted hook response
        """
        hook_data = self.create_hook_specific_output(
            hook_event_name="UserPromptSubmit",
            prompt_blocked=prompt_blocked,
            processing_success=success,
            **kwargs
        )
        
        # Add additionalContext if provided
        if additional_context:
            hook_data["additionalContext"] = additional_context
        
        # Add blockReason if prompt is blocked
        if prompt_blocked and block_reason:
            hook_data["blockReason"] = block_reason
        
        return self.create_response(
            continue_execution=not prompt_blocked,
            suppress_output=False,  # User prompt responses should be visible
            hook_specific_data=hook_data,
            stop_reason=block_reason if prompt_blocked else None
        )
    
    def _generate_context_injection(self, prompt_data: Dict[str, Any], 
                                   input_data: Dict[str, Any]) -> Optional[str]:
        """
        Generate additional context based on prompt analysis and configuration.
        
        Args:
            prompt_data: Analyzed prompt data
            input_data: Original input data
            
        Returns:
            Additional context string or None if no context should be injected
        """
        context_config = self.config.get("user_prompt_submit", {})
        if not context_config.get("enable_context_injection", False):
            return None
        
        context_rules = context_config.get("context_injection_rules", {})
        prompt_text = prompt_data.get("prompt_text", "").lower()
        intent = prompt_data.get("context", {}).get("intent", "general")
        
        # Check for keyword-based context injection
        for rule_name, rule in context_rules.items():
            keywords = rule.get("keywords", [])
            context_text = rule.get("context", "")
            
            if any(keyword in prompt_text for keyword in keywords):
                return context_text
        
        # Intent-based context injection
        if intent == "debugging":
            return "Consider using systematic debugging approaches: check error messages, add logging, and isolate the problem step by step."
        elif intent == "code_generation":
            return "Remember to follow best practices: write clear, readable code with proper error handling and documentation."
        elif intent == "explanation" and "security" in prompt_text:
            return "When implementing security features, always follow the principle of least privilege and validate all inputs."
        
        return None
    
    def _analyze_prompt_security(self, prompt_data: Dict[str, Any]) -> tuple[bool, Optional[str]]:
        """
        Analyze prompt for security concerns that might require blocking.
        
        Args:
            prompt_data: Analyzed prompt data
            
        Returns:
            Tuple of (should_block, reason)
        """
        prompt_text = prompt_data.get("prompt_text", "").lower()
        
        # Check for potentially dangerous requests
        dangerous_patterns = [
            (r"delete\s+all\s+files", "Dangerous file deletion request detected"),
            (r"rm\s+-rf\s+/", "Dangerous system deletion command detected"),
            (r"format\s+(c:|hard\s+drive)", "System formatting request detected"),
            (r"access\s+(password|credential)", "Attempt to access sensitive credentials")
        ]
        
        import re
        for pattern, reason in dangerous_patterns:
            if re.search(pattern, prompt_text):
                return True, reason
        
        # Check for overly long prompts that might be injection attempts
        if len(prompt_text) > 50000:  # 50k character limit
            return True, "Prompt exceeds maximum length for security reasons"
        
        return False, None
    
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