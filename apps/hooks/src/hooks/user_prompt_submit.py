#!/usr/bin/env -S uv run
# /// script
# requires-python = ">=3.8"
# dependencies = [
#     "python-dotenv>=1.0.0",
#     "supabase>=2.0.0",
#     "ujson>=5.8.0",
# ]
# ///
"""
User Prompt Capture Hook for Claude Code - UV Single-File Script

Captures user prompts before processing to track user behavior,
prompt complexity, and intent classification for observability.

Features:
- Parse prompt text and metadata
- Intent classification and analysis
- Security screening for dangerous prompts
- Context injection based on prompt analysis
"""

import json
import os
import re
import sys
import time

# Add src directory to path for lib imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

# Import shared library modules
from lib.base_hook import BaseHook, create_event_data, setup_hook_logging
from lib.utils import load_chronicle_env

# UJSON for fast JSON processing
try:
    import ujson as json_impl
except ImportError:
    import json as json_impl

# Initialize environment and logging
load_chronicle_env()
logger = setup_hook_logging("user_prompt_submit")

# ===========================================
# Intent Classification Patterns
# ===========================================

INTENT_PATTERNS = {
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

# Security patterns for dangerous prompts
DANGEROUS_PROMPT_PATTERNS = [
    (r"delete\s+all\s+files", "Dangerous file deletion request detected"),
    (r"rm\s+-rf\s+/", "Dangerous system deletion command detected"),
    (r"format\s+(c:|hard\s+drive)", "System formatting request detected"),
    (r"access\s+(password|credential)",
        "Attempt to access sensitive credentials"),
    (r"bypass\s+(security|authentication)", "Security bypass attempt detected")
]

# ===========================================
# Utility Functions for Prompt Analysis
# ===========================================

def extract_prompt_text(input_data: Dict[str, Any]) -> str:
    """Extract prompt text from various input formats."""
    # Check common prompt fields
    prompt_fields = ["prompt", "message", "text", "content", "input"]

    for field in prompt_fields:
        if field in input_data:
            value = input_data[field]
            if isinstance(value, str):
                return value
            elif isinstance(value, dict) and "text" in value:
                return value["text"]
            elif isinstance(value, dict) and "content" in value:
                return value["content"]

    # Fallback: convert entire input to string if no specific field found
    return str(input_data).strip()

def classify_intent(prompt_text: str) -> str:
    """Classify user intent based on prompt text patterns."""
    prompt_lower = prompt_text.lower()

    # Check each intent category
    for intent, patterns in INTENT_PATTERNS.items():
        for pattern in patterns:
            if re.search(pattern, prompt_lower, re.IGNORECASE):
                return intent

    return "general"

def analyze_prompt_security(prompt_text: str) -> Tuple[bool, Optional[str]]:
    """Analyze prompt for security risks."""
    prompt_lower = prompt_text.lower()

    for pattern, reason in DANGEROUS_PROMPT_PATTERNS:
        if re.search(pattern, prompt_lower, re.IGNORECASE):
            return True, reason

    return False, None

def generate_context_injection(intent: str, prompt_text: str) -> Optional[str]:
    """Generate additional context based on intent and prompt analysis."""
    if intent == "debugging":
        return "Consider checking logs, error messages, and testing with minimal examples."
    elif intent == "code_generation":
        return "Remember to follow best practices: proper error handling, documentation, and testing."
    elif intent == "configuration":
        return "Ensure you have proper backups before making configuration changes."

    return None

def sanitize_prompt_data(prompt_text: str) -> str:
    """Sanitize prompt data for safe storage."""
    # Truncate extremely long prompts
    if len(prompt_text) > 5000:
        return prompt_text[:4990] + "... [truncated]"

    # Remove potential sensitive patterns (basic sanitization)
    sanitized = re.sub(r'\b(?:password|token|key|secret)\s*[=:]\s*\S+', '[REDACTED]', prompt_text, flags=re.IGNORECASE)

    return sanitized


class UserPromptSubmitHook(BaseHook):
    """Hook for capturing and analyzing user prompts."""

    def __init__(self):
        super().__init__()

    def process_hook(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """Process user prompt submission."""
        try:
            # Process input data using base hook functionality
            processed_data = self.process_hook_data(input_data, "UserPromptSubmit")

            # Validate input
            if not self._is_valid_prompt_input(input_data):
                return self._create_prompt_response(
                    prompt_blocked=False,
                    success=False,
                    error="Invalid prompt input format"
                )

            # Extract and analyze prompt
            prompt_text = extract_prompt_text(input_data)
            prompt_length = len(prompt_text)
            intent = classify_intent(prompt_text)

            # Security analysis
            should_block, block_reason = analyze_prompt_security(prompt_text)

            # Generate context injection if appropriate
            additional_context = generate_context_injection(intent, prompt_text)

            # Create event data using helper function
            event_data = create_event_data(
                event_type="user_prompt_submit",
                hook_event_name="UserPromptSubmit",
                data={
                    "prompt_text": sanitize_prompt_data(prompt_text),
                    "prompt_length": prompt_length,
                    "intent": intent,
                    "security_flagged": should_block,
                    "context_injected": additional_context is not None
                }
            )

            # Save event
            event_saved = self.save_event(event_data)

            # Create response
            return self._create_prompt_response(
                prompt_blocked=should_block,
                block_reason=block_reason,
                success=event_saved,
                additional_context=additional_context,
                prompt_length=prompt_length,
                intent=intent
            )

        except Exception as e:
            logger.debug(f"Hook processing error: {e}")
            return self._create_prompt_response(
                prompt_blocked=False,
                success=False,
                error=str(e)[:100]
            )

    def _is_valid_prompt_input(self, input_data: Dict[str, Any]) -> bool:
        """Check if input contains valid prompt data."""
        if not isinstance(input_data, dict):
            return False

        # Check for common prompt fields
        prompt_fields = ["prompt", "message", "text", "content"]
        return any(field in input_data for field in prompt_fields)

    def _create_prompt_response(self, prompt_blocked: bool = False,
                               block_reason: Optional[str] = None,
                               success: bool = True,
                               additional_context: Optional[str] = None,
                               error: Optional[str] = None,
                               **kwargs) -> Dict[str, Any]:
        """Create hook response for user prompt submission."""

        hook_output = self.create_hook_specific_output(
            hook_event_name="UserPromptSubmit",
            prompt_blocked=prompt_blocked,
            processing_success=success,
            event_saved=self.session_uuid is not None,
            **kwargs
        )

        if error:
            hook_output["error"] = error

        if block_reason:
            hook_output["blockReason"] = block_reason

        response = self.create_response(
            continue_execution=not prompt_blocked,
            suppress_output=False,  # User prompt responses should be visible
            hook_specific_data=hook_output
        )

        # Add context injection
        if additional_context:
            response["hookSpecificOutput"]["additionalContext"] = additional_context

        # Add stop reason if blocked
        if prompt_blocked and block_reason:
            response["stopReason"] = block_reason

        return response


def main():
    """Main entry point for user prompt submit hook."""
    try:
        logger.debug("USER PROMPT SUBMIT HOOK STARTED")

        # Read input from stdin
        try:
            input_data = json_impl.load(sys.stdin)
            logger.info(f"Parsed input data keys: {list(input_data.keys())}")
            logger.debug(
                f"Input data: {json_impl.dumps(input_data, indent=2)[:500]}...")  # Debug only, truncated
        except json.JSONDecodeError as e:
            logger.warning(f"No input data received or invalid JSON: {e}")
            input_data = {}

        # Process hook
        start_time = time.perf_counter()
        logger.info("Initializing UserPromptSubmitHook...")

        hook = UserPromptSubmitHook()
        logger.info("Processing hook...")
        result = hook.process_hook(input_data)
        logger.info(f"Hook processing result: {result}")

        # Add execution time
        execution_time = (time.perf_counter() - start_time) * 1000
        result["execution_time_ms"] = execution_time

        # Log performance
        if execution_time > 100:
            logger.warning(
                f"Hook exceeded 100ms requirement: {execution_time:.2f}ms")

        # Output result
        print(json_impl.dumps(result, indent=2))
        sys.exit(0)

    except json.JSONDecodeError:
        # Safe response for invalid JSON
        safe_response = {
            "continue": True,
            "suppressOutput": False,
            "hookSpecificOutput": {
                "hookEventName": "UserPromptSubmit",
                "promptBlocked": False,
                "processingSuccess": False,
                "error": "Invalid JSON input"
            }
        }
        print(json_impl.dumps(safe_response))
        sys.exit(0)

    except Exception as e:
        logger.debug(f"Critical error: {e}")
        # Safe default response
        safe_response = {
            "continue": True,
            "suppressOutput": False,
            "hookSpecificOutput": {
                "hookEventName": "UserPromptSubmit",
                "promptBlocked": False,
                "processingSuccess": False,
                "error": "Hook processing failed"
            }
        }
        print(json_impl.dumps(safe_response))
        sys.exit(0)


if __name__ == "__main__":
    main()
