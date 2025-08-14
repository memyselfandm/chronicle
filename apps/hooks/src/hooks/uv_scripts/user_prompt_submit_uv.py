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
import sqlite3
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

# Load environment variables
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

# UJSON for fast JSON processing
try:
    import ujson as json_impl
except ImportError:
    import json as json_impl

# Configure logging
import logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

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
    (r"access\s+(password|credential)", "Attempt to access sensitive credentials"),
    (r"bypass\s+(security|authentication)", "Security bypass attempt detected")
]

# ===========================================
# Database Manager
# ===========================================

class DatabaseManager:
    """Simplified database manager for prompt tracking."""
    
    def __init__(self):
        self.sqlite_path = os.path.expanduser("~/.claude/hooks_data.db")
        self._ensure_sqlite_tables()
    
    def _ensure_sqlite_tables(self):
        """Ensure SQLite tables exist."""
        try:
            os.makedirs(os.path.dirname(self.sqlite_path), exist_ok=True)
            
            with sqlite3.connect(self.sqlite_path) as conn:
                conn.execute('''
                    CREATE TABLE IF NOT EXISTS sessions (
                        id TEXT PRIMARY KEY,
                        claude_session_id TEXT UNIQUE,
                        start_time TIMESTAMP,
                        project_path TEXT,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                ''')
                
                conn.execute('''
                    CREATE TABLE IF NOT EXISTS events (
                        id TEXT PRIMARY KEY,
                        session_id TEXT,
                        event_type TEXT,
                        hook_event_name TEXT,
                        timestamp TIMESTAMP,
                        data TEXT,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                ''')
                conn.commit()
        except Exception as e:
            logger.debug(f"SQLite setup failed: {e}")
    
    def save_session(self, session_data: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
        """Save session and return success, session_uuid."""
        try:
            session_uuid = str(uuid.uuid4())
            
            with sqlite3.connect(self.sqlite_path) as conn:
                conn.execute('''
                    INSERT OR REPLACE INTO sessions 
                    (id, claude_session_id, start_time, project_path)
                    VALUES (?, ?, ?, ?)
                ''', (
                    session_uuid,
                    session_data.get("claude_session_id"),
                    session_data.get("start_time", datetime.now().isoformat()),
                    session_data.get("project_path", os.getcwd())
                ))
                conn.commit()
            
            return True, session_uuid
        except Exception:
            return False, None
    
    def save_event(self, event_data: Dict[str, Any]) -> bool:
        """Save event data."""
        try:
            with sqlite3.connect(self.sqlite_path) as conn:
                conn.execute('''
                    INSERT INTO events 
                    (id, session_id, event_type, hook_event_name, timestamp, data)
                    VALUES (?, ?, ?, ?, ?, ?)
                ''', (
                    event_data.get("event_id", str(uuid.uuid4())),
                    event_data.get("session_id"),
                    event_data.get("event_type"),
                    event_data.get("hook_event_name"),
                    event_data.get("timestamp"),
                    json_impl.dumps(event_data.get("data", {}))
                ))
                conn.commit()
            return True
        except Exception:
            return False

# ===========================================
# Utility Functions
# ===========================================

def classify_intent(prompt_text: str) -> str:
    """Classify user intent based on prompt text."""
    prompt_lower = prompt_text.lower()
    
    for intent, patterns in INTENT_PATTERNS.items():
        for pattern in patterns:
            if re.search(pattern, prompt_lower):
                return intent
    
    return "general"

def analyze_prompt_security(prompt_text: str) -> Tuple[bool, Optional[str]]:
    """Analyze prompt for security concerns."""
    prompt_lower = prompt_text.lower()
    
    # Check for dangerous patterns
    for pattern, reason in DANGEROUS_PROMPT_PATTERNS:
        if re.search(pattern, prompt_lower):
            return True, reason
    
    # Check for overly long prompts (injection attempts)
    if len(prompt_text) > 50000:
        return True, "Prompt exceeds maximum length for security reasons"
    
    return False, None

def extract_prompt_text(input_data: Dict[str, Any]) -> str:
    """Extract prompt text from various input formats."""
    # Try different locations where prompt text might be
    if "prompt" in input_data:
        if isinstance(input_data["prompt"], str):
            return input_data["prompt"]
        elif isinstance(input_data["prompt"], dict) and "text" in input_data["prompt"]:
            return input_data["prompt"]["text"]
    
    if "message" in input_data:
        if isinstance(input_data["message"], str):
            return input_data["message"]
        elif isinstance(input_data["message"], dict) and "content" in input_data["message"]:
            return input_data["message"]["content"]
    
    if "text" in input_data:
        return str(input_data["text"])
    
    if "content" in input_data:
        return str(input_data["content"])
    
    # Fallback: convert entire input to string if no specific field found
    return str(input_data)

def generate_context_injection(intent: str, prompt_text: str) -> Optional[str]:
    """Generate helpful context based on intent and content."""
    prompt_lower = prompt_text.lower()
    
    # Intent-based context
    if intent == "debugging":
        return "Consider using systematic debugging: check error messages, add logging, isolate the problem."
    elif intent == "code_generation":
        return "Follow best practices: write clear, readable code with proper error handling and documentation."
    elif intent == "explanation" and "security" in prompt_lower:
        return "For security implementations, follow principle of least privilege and validate all inputs."
    
    # Keyword-based context
    if any(keyword in prompt_lower for keyword in ["performance", "optimize", "slow"]):
        return "Consider profiling before optimizing. Measure first, then improve bottlenecks."
    elif any(keyword in prompt_lower for keyword in ["test", "testing", "unit test"]):
        return "Good tests are readable, maintainable, and test behavior rather than implementation."
    
    return None

def sanitize_prompt_data(prompt_text: str) -> str:
    """Sanitize prompt text for logging (remove potential sensitive info)."""
    # Truncate very long prompts
    if len(prompt_text) > 1000:
        return prompt_text[:500] + "...[TRUNCATED]..." + prompt_text[-100:]
    
    # Remove potential API keys or tokens (simple patterns)
    sanitized = re.sub(r'sk-[a-zA-Z0-9]{20,}', '[API_KEY_REDACTED]', prompt_text)
    sanitized = re.sub(r'token["\']?\s*[:=]\s*["\'][^"\']{20,}["\']', 'token="[REDACTED]"', sanitized)
    
    return sanitized

# ===========================================
# User Prompt Submit Hook
# ===========================================

class UserPromptSubmitHook:
    """Hook for capturing and analyzing user prompts."""
    
    def __init__(self):
        self.db_manager = DatabaseManager()
        self.claude_session_id: Optional[str] = None
        self.session_uuid: Optional[str] = None
    
    def get_claude_session_id(self, input_data: Dict[str, Any]) -> Optional[str]:
        """Extract Claude session ID."""
        if "sessionId" in input_data:
            return input_data["sessionId"]
        return os.getenv("CLAUDE_SESSION_ID")
    
    def process_hook(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """Process user prompt submission."""
        try:
            # Extract session ID
            self.claude_session_id = self.get_claude_session_id(input_data)
            
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
            
            # Create event data
            event_data = {
                "event_type": "prompt",
                "hook_event_name": "UserPromptSubmit",
                "timestamp": datetime.now().isoformat(),
                "data": {
                    "prompt_text": sanitize_prompt_data(prompt_text),
                    "prompt_length": prompt_length,
                    "intent": intent,
                    "security_flagged": should_block,
                    "context_injected": additional_context is not None
                }
            }
            
            # Save event (ensure session exists first)
            self._ensure_session_exists()
            event_saved = False
            if self.session_uuid:
                event_data["session_id"] = self.session_uuid
                event_saved = self.db_manager.save_event(event_data)
            
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
    
    def _ensure_session_exists(self):
        """Ensure session exists for event logging."""
        if not self.session_uuid and self.claude_session_id:
            session_data = {
                "claude_session_id": self.claude_session_id,
                "start_time": datetime.now().isoformat(),
                "project_path": os.getcwd()
            }
            success, session_uuid = self.db_manager.save_session(session_data)
            if success:
                self.session_uuid = session_uuid
    
    def _create_prompt_response(self, prompt_blocked: bool = False,
                               block_reason: Optional[str] = None,
                               success: bool = True,
                               additional_context: Optional[str] = None,
                               error: Optional[str] = None,
                               **kwargs) -> Dict[str, Any]:
        """Create hook response for user prompt submission."""
        
        hook_output = {
            "hookEventName": "UserPromptSubmit",
            "promptBlocked": prompt_blocked,
            "processingSuccess": success,
            "eventSaved": self.session_uuid is not None
        }
        
        # Add additional fields
        for key, value in kwargs.items():
            if value is not None:
                camel_key = self._snake_to_camel(key)
                hook_output[camel_key] = value
        
        if error:
            hook_output["error"] = error
        
        if block_reason:
            hook_output["blockReason"] = block_reason
        
        response = {
            "continue": not prompt_blocked,
            "suppressOutput": False,  # User prompt responses should be visible
            "hookSpecificOutput": hook_output
        }
        
        # Add context injection
        if additional_context:
            response["hookSpecificOutput"]["additionalContext"] = additional_context
        
        # Add stop reason if blocked
        if prompt_blocked and block_reason:
            response["stopReason"] = block_reason
        
        return response
    
    def _snake_to_camel(self, snake_str: str) -> str:
        """Convert snake_case to camelCase."""
        if not snake_str:
            return snake_str
        components = snake_str.split('_')
        return components[0] + ''.join(word.capitalize() for word in components[1:])

# ===========================================
# Main Entry Point
# ===========================================

def main():
    """Main entry point for user prompt submit hook."""
    try:
        # Read input from stdin
        input_text = sys.stdin.read().strip()
        if not input_text:
            input_data = {}
        else:
            input_data = json_impl.loads(input_text)
        
        # Process hook
        start_time = time.perf_counter()
        
        hook = UserPromptSubmitHook()
        result = hook.process_hook(input_data)
        
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