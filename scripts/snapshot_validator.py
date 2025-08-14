#!/usr/bin/env python3
"""
Chronicle Snapshot Validation and Sanitization Script

Validates and sanitizes Chronicle snapshot data for privacy and security compliance.
Ensures snapshot data is safe for testing while maintaining realistic patterns.
"""

import os
import sys
import json
import argparse
import re
from typing import Dict, List, Any, Optional, Union, Tuple
from datetime import datetime
from pathlib import Path

# Add the hooks src directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'apps', 'hooks', 'src'))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'apps', 'hooks', 'config'))

try:
    from models import EventType, validate_session_data, validate_event_data
    from utils import validate_json
except ImportError as e:
    print(f"⚠️ Import error: {e}")
    print("Make sure you're running from the Chronicle root directory")
    sys.exit(1)


class SnapshotValidator:
    """Validates and sanitizes Chronicle snapshot data."""
    
    def __init__(self, strict_mode: bool = False):
        """
        Initialize validator.
        
        Args:
            strict_mode: Enable strict validation (fails on any issues)
        """
        self.strict_mode = strict_mode
        self.validation_errors = []
        self.sanitization_changes = []
        
        # Sensitive patterns to detect and sanitize
        self.sensitive_patterns = {
            'api_keys': [
                r'sk-[a-zA-Z0-9]{48,}',  # OpenAI API keys
                r'pk_[a-zA-Z0-9]{24,}',  # Stripe keys
                r'[0-9a-f]{32,64}',      # Generic hex tokens
            ],
            'secrets': [
                r'secret[_-]?key',
                r'api[_-]?secret',
                r'private[_-]?key',
                r'access[_-]?token',
                r'bearer\s+[a-zA-Z0-9]+',
            ],
            'emails': [
                r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}',
            ],
            'file_paths': [
                r'/Users/[^/\s]+',        # macOS user paths
                r'/home/[^/\s]+',         # Linux user paths  
                r'C:\\Users\\[^\\\\]+',   # Windows user paths
            ],
            'passwords': [
                r'password["\']?\s*[:=]\s*["\'][^"\']+["\']',
                r'pwd["\']?\s*[:=]\s*["\'][^"\']+["\']',
            ]
        }
    
    def validate_snapshot_structure(self, snapshot: Dict[str, Any]) -> bool:
        """
        Validate overall snapshot structure.
        
        Args:
            snapshot: Snapshot data dictionary
            
        Returns:
            True if structure is valid
        """
        required_keys = ['metadata', 'sessions', 'events']
        
        for key in required_keys:
            if key not in snapshot:
                self.validation_errors.append(f"Missing required key: {key}")
                return False
        
        # Validate metadata
        metadata = snapshot['metadata']
        if not isinstance(metadata, dict):
            self.validation_errors.append("Metadata must be a dictionary")
            return False
        
        required_metadata = ['captured_at', 'source', 'version']
        for key in required_metadata:
            if key not in metadata:
                self.validation_errors.append(f"Missing metadata key: {key}")
        
        # Validate sessions and events are lists
        if not isinstance(snapshot['sessions'], list):
            self.validation_errors.append("Sessions must be a list")
            return False
        
        if not isinstance(snapshot['events'], list):
            self.validation_errors.append("Events must be a list")
            return False
        
        return len(self.validation_errors) == 0
    
    def validate_sessions(self, sessions: List[Dict[str, Any]]) -> bool:
        """
        Validate session data.
        
        Args:
            sessions: List of session dictionaries
            
        Returns:
            True if all sessions are valid
        """
        valid = True
        
        for i, session in enumerate(sessions):
            if not validate_session_data(session):
                self.validation_errors.append(f"Session {i}: Invalid structure")
                valid = False
                continue
            
            # Check required fields
            if not session.get('claude_session_id'):
                self.validation_errors.append(f"Session {i}: Missing claude_session_id")
                valid = False
            
            # Validate timestamps
            start_time = session.get('start_time')
            if start_time:
                try:
                    datetime.fromisoformat(start_time.replace('Z', '+00:00'))
                except ValueError:
                    self.validation_errors.append(f"Session {i}: Invalid start_time format")
                    valid = False
            
            # Check for duplicates
            session_id = session.get('id') or session.get('claude_session_id')
            for j, other_session in enumerate(sessions[i+1:], i+1):
                other_id = other_session.get('id') or other_session.get('claude_session_id')
                if session_id == other_id:
                    self.validation_errors.append(f"Duplicate session ID: {session_id} (sessions {i}, {j})")
                    valid = False
        
        return valid
    
    def validate_events(self, events: List[Dict[str, Any]], 
                       session_ids: set) -> bool:
        """
        Validate event data.
        
        Args:
            events: List of event dictionaries
            session_ids: Set of valid session IDs
            
        Returns:
            True if all events are valid
        """
        valid = True
        
        for i, event in enumerate(events):
            if not validate_event_data(event):
                self.validation_errors.append(f"Event {i}: Invalid structure")
                valid = False
                continue
            
            # Check session reference
            session_id = event.get('session_id')
            if session_id not in session_ids:
                self.validation_errors.append(f"Event {i}: References unknown session {session_id}")
                valid = False
            
            # Validate event type
            event_type = event.get('event_type')
            if not EventType.is_valid(event_type):
                self.validation_errors.append(f"Event {i}: Invalid event type '{event_type}'")
                valid = False
            
            # Validate timestamp
            timestamp = event.get('timestamp')
            if timestamp:
                try:
                    datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
                except ValueError:
                    self.validation_errors.append(f"Event {i}: Invalid timestamp format")
                    valid = False
            
            # Tool events should have tool_name
            if event_type == EventType.TOOL_USE and not event.get('tool_name'):
                self.validation_errors.append(f"Event {i}: Tool event missing tool_name")
                valid = False
            
            # Validate duration if present
            duration = event.get('duration_ms')
            if duration is not None:
                if not isinstance(duration, int) or duration < 0:
                    self.validation_errors.append(f"Event {i}: Invalid duration_ms")
                    valid = False
        
        return valid
    
    def detect_sensitive_data(self, text: str) -> List[Tuple[str, str]]:
        """
        Detect sensitive data patterns in text.
        
        Args:
            text: Text to scan
            
        Returns:
            List of (pattern_type, matched_text) tuples
        """
        findings = []
        
        for pattern_type, patterns in self.sensitive_patterns.items():
            for pattern in patterns:
                matches = re.finditer(pattern, text, re.IGNORECASE)
                for match in matches:
                    findings.append((pattern_type, match.group()))
        
        return findings
    
    def sanitize_text(self, text: str, context: str = "") -> str:
        """
        Sanitize sensitive data in text.
        
        Args:
            text: Text to sanitize
            context: Context for logging
            
        Returns:
            Sanitized text
        """
        original_text = text
        
        # Replace sensitive patterns
        for pattern_type, patterns in self.sensitive_patterns.items():
            for pattern in patterns:
                matches = list(re.finditer(pattern, text, re.IGNORECASE))
                if matches:
                    # Replace with appropriate placeholder
                    if pattern_type == 'api_keys':
                        replacement = '[API_KEY_REDACTED]'
                    elif pattern_type == 'secrets':
                        replacement = '[SECRET_REDACTED]'
                    elif pattern_type == 'emails':
                        replacement = 'user@example.com'
                    elif pattern_type == 'file_paths':
                        replacement = '/[PATH_REDACTED]'
                    elif pattern_type == 'passwords':
                        replacement = 'password="[REDACTED]"'
                    else:
                        replacement = '[REDACTED]'
                    
                    text = re.sub(pattern, replacement, text, flags=re.IGNORECASE)
                    
                    for match in matches:
                        self.sanitization_changes.append({
                            "context": context,
                            "pattern_type": pattern_type,
                            "original": match.group(),
                            "replacement": replacement
                        })
        
        return text
    
    def sanitize_dict_recursive(self, data: Dict[str, Any], 
                               context: str = "") -> Dict[str, Any]:
        """
        Recursively sanitize dictionary data.
        
        Args:
            data: Dictionary to sanitize
            context: Context for logging
            
        Returns:
            Sanitized dictionary
        """
        if not isinstance(data, dict):
            return data
        
        sanitized = {}
        
        for key, value in data.items():
            key_context = f"{context}.{key}" if context else key
            
            if isinstance(value, str):
                sanitized[key] = self.sanitize_text(value, key_context)
            elif isinstance(value, dict):
                sanitized[key] = self.sanitize_dict_recursive(value, key_context)
            elif isinstance(value, list):
                sanitized[key] = [
                    self.sanitize_dict_recursive(item, f"{key_context}[{i}]") 
                    if isinstance(item, dict) 
                    else self.sanitize_text(str(item), f"{key_context}[{i}]") 
                    if isinstance(item, str)
                    else item
                    for i, item in enumerate(value)
                ]
            else:
                sanitized[key] = value
        
        return sanitized
    
    def sanitize_snapshot(self, snapshot: Dict[str, Any]) -> Dict[str, Any]:
        """
        Sanitize entire snapshot data.
        
        Args:
            snapshot: Snapshot to sanitize
            
        Returns:
            Sanitized snapshot
        """
        sanitized = {
            "metadata": snapshot.get("metadata", {}).copy(),
            "sessions": [],
            "events": []
        }
        
        # Update metadata to indicate sanitization
        sanitized["metadata"]["sanitized_at"] = datetime.utcnow().isoformat() + 'Z'
        sanitized["metadata"]["sanitization_applied"] = True
        
        # Sanitize sessions
        for i, session in enumerate(snapshot.get("sessions", [])):
            sanitized_session = self.sanitize_dict_recursive(
                session.copy(), f"session[{i}]"
            )
            
            # Anonymize project paths while preserving structure
            if 'project_path' in sanitized_session:
                path = sanitized_session['project_path']
                if path and not path.startswith('['):  # Don't double-sanitize
                    path_parts = Path(path).parts
                    if len(path_parts) > 2:
                        # Keep last 2 parts, anonymize the rest
                        anonymized_parts = ['[ANONYMIZED]'] * (len(path_parts) - 2) + list(path_parts[-2:])
                        sanitized_session['project_path'] = str(Path(*anonymized_parts))
            
            sanitized["sessions"].append(sanitized_session)
        
        # Sanitize events
        for i, event in enumerate(snapshot.get("events", [])):
            sanitized_event = self.sanitize_dict_recursive(
                event.copy(), f"event[{i}]"
            )
            
            # Parse and sanitize JSON data field if it's a string
            if 'data' in sanitized_event and isinstance(sanitized_event['data'], str):
                try:
                    data_obj = json.loads(sanitized_event['data'])
                    sanitized_data = self.sanitize_dict_recursive(data_obj, f"event[{i}].data")
                    sanitized_event['data'] = json.dumps(sanitized_data)
                except json.JSONDecodeError:
                    # Leave as-is if not valid JSON
                    pass
            
            sanitized["events"].append(sanitized_event)
        
        return sanitized
    
    def validate_and_sanitize(self, snapshot: Dict[str, Any]) -> Tuple[bool, Dict[str, Any]]:
        """
        Validate and sanitize snapshot data.
        
        Args:
            snapshot: Snapshot to process
            
        Returns:
            Tuple of (is_valid, sanitized_snapshot)
        """
        # Reset state
        self.validation_errors = []
        self.sanitization_changes = []
        
        # Validate structure
        structure_valid = self.validate_snapshot_structure(snapshot)
        
        if not structure_valid and self.strict_mode:
            return False, {}
        
        # Extract session IDs for event validation
        sessions = snapshot.get('sessions', [])
        session_ids = set()
        for session in sessions:
            session_id = session.get('id') or session.get('claude_session_id')
            if session_id:
                session_ids.add(session_id)
        
        # Validate sessions and events
        sessions_valid = self.validate_sessions(sessions)
        events_valid = self.validate_events(snapshot.get('events', []), session_ids)
        
        is_valid = structure_valid and sessions_valid and events_valid
        
        if not is_valid and self.strict_mode:
            return False, {}
        
        # Sanitize the data
        sanitized_snapshot = self.sanitize_snapshot(snapshot)
        
        return is_valid, sanitized_snapshot
    
    def get_validation_report(self) -> Dict[str, Any]:
        """
        Get detailed validation and sanitization report.
        
        Returns:
            Report dictionary
        """
        return {
            "validation": {
                "errors_count": len(self.validation_errors),
                "errors": self.validation_errors,
                "is_valid": len(self.validation_errors) == 0
            },
            "sanitization": {
                "changes_count": len(self.sanitization_changes),
                "changes": self.sanitization_changes,
                "patterns_found": {
                    pattern_type: len([c for c in self.sanitization_changes 
                                     if c['pattern_type'] == pattern_type])
                    for pattern_type in self.sensitive_patterns.keys()
                }
            }
        }


def main():
    """Main function for CLI usage."""
    parser = argparse.ArgumentParser(description="Validate and sanitize Chronicle snapshots")
    parser.add_argument("input", help="Input snapshot file")
    parser.add_argument("--output", help="Output sanitized snapshot file")
    parser.add_argument("--strict", action="store_true", help="Strict validation mode")
    parser.add_argument("--report", help="Save validation report to file")
    parser.add_argument("--verbose", action="store_true", help="Verbose output")
    
    args = parser.parse_args()
    
    # Load snapshot
    try:
        with open(args.input, 'r') as f:
            snapshot = json.load(f)
    except Exception as e:
        print(f"❌ Failed to load snapshot: {e}")
        sys.exit(1)
    
    # Validate and sanitize
    validator = SnapshotValidator(strict_mode=args.strict)
    is_valid, sanitized_snapshot = validator.validate_and_sanitize(snapshot)
    
    # Get report
    report = validator.get_validation_report()
    
    # Output results
    if args.verbose or not is_valid:
        print(f"\n📊 Validation Results:")
        print(f"Valid: {'✅' if is_valid else '❌'}")
        print(f"Errors: {report['validation']['errors_count']}")
        print(f"Sanitization changes: {report['sanitization']['changes_count']}")
        
        if report['validation']['errors']:
            print(f"\n❌ Validation Errors:")
            for error in report['validation']['errors']:
                print(f"  - {error}")
        
        if report['sanitization']['changes'] and args.verbose:
            print(f"\n🔧 Sanitization Changes:")
            for change in report['sanitization']['changes'][:10]:  # Show first 10
                print(f"  - {change['context']}: {change['pattern_type']}")
            
            if len(report['sanitization']['changes']) > 10:
                remaining = len(report['sanitization']['changes']) - 10
                print(f"  ... and {remaining} more changes")
    
    # Save sanitized snapshot
    if args.output and sanitized_snapshot:
        try:
            os.makedirs(os.path.dirname(os.path.abspath(args.output)), exist_ok=True)
            with open(args.output, 'w') as f:
                json.dump(sanitized_snapshot, f, indent=2, default=str)
            print(f"💾 Sanitized snapshot saved to {args.output}")
        except Exception as e:
            print(f"❌ Failed to save sanitized snapshot: {e}")
            sys.exit(1)
    
    # Save report
    if args.report:
        try:
            os.makedirs(os.path.dirname(os.path.abspath(args.report)), exist_ok=True)
            with open(args.report, 'w') as f:
                json.dump(report, f, indent=2, default=str)
            print(f"📄 Validation report saved to {args.report}")
        except Exception as e:
            print(f"❌ Failed to save report: {e}")
    
    # Exit with appropriate code
    if args.strict and not is_valid:
        sys.exit(1)
    else:
        print(f"\n✅ Processing complete!")
        sys.exit(0)


if __name__ == "__main__":
    main()