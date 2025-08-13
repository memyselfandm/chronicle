#!/usr/bin/env python3
"""
Claude Code Hook: Session End Tracking (stop.py)

This hook is triggered when Claude Code main agent execution completes.
It captures session end data, calculates duration, and stores final metrics.

Features:
- Updates existing session record with end_time
- Calculates total session duration from start to end
- Counts total events that occurred during session
- Stores session_end event with comprehensive metrics
- Handles gracefully when session_start wasn't captured

Hook Event: Stop
Matchers: N/A (triggered on agent completion)
"""

import json
import sys
import time
import logging
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, Optional

# Add src directory to path for imports
sys.path.insert(0, str(Path(__file__).parent / "src"))

from base_hook import BaseHook

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


class StopHook(BaseHook):
    """
    Hook for tracking session end and calculating final session metrics.
    
    Responsibilities:
    - Query database for existing session record
    - Calculate session duration if start_time available
    - Count events that occurred during the session
    - Update session record with end_time and final metrics
    - Create session_end event with comprehensive data
    - Handle missing session_start scenarios gracefully
    """
    
    def __init__(self, config: Optional[Dict[str, Any]] = None):
        """Initialize the StopHook with database connectivity."""
        super().__init__(config)
        self.hook_name = "stop"
        logger.info("StopHook initialized")
    
    def find_existing_session(self, session_id: str) -> Optional[Dict[str, Any]]:
        """
        Find existing session record in database.
        
        Args:
            session_id: The session ID to search for
            
        Returns:
            Session data dictionary if found, None otherwise
        """
        try:
            # Try to query Supabase first
            if hasattr(self.db_manager, 'supabase_client') and self.db_manager.supabase_client._supabase_client:
                supabase = self.db_manager.supabase_client._supabase_client
                result = supabase.table('sessions').select('*').eq('session_id', session_id).execute()
                
                if result.data and len(result.data) > 0:
                    logger.debug(f"Found existing session: {session_id}")
                    return result.data[0]
                else:
                    logger.warning(f"No existing session found for: {session_id}")
                    return None
            else:
                logger.warning("Supabase client not available for session lookup")
                return None
                
        except Exception as e:
            logger.error(f"Error finding existing session {session_id}: {e}")
            self.log_error(e, "find_existing_session")
            return None
    
    def count_session_events(self, session_id: str) -> int:
        """
        Count total events that occurred during this session.
        
        Args:
            session_id: The session ID to count events for
            
        Returns:
            Number of events in the session
        """
        try:
            # Try to query Supabase for event count
            if hasattr(self.db_manager, 'supabase_client') and self.db_manager.supabase_client._supabase_client:
                supabase = self.db_manager.supabase_client._supabase_client
                result = supabase.table('events').select('event_id').eq('session_id', session_id).execute()
                
                if result.data:
                    event_count = len(result.data)
                    logger.debug(f"Counted {event_count} events for session {session_id}")
                    return event_count
                else:
                    logger.info(f"No events found for session {session_id}")
                    return 0
            else:
                logger.warning("Supabase client not available for event counting")
                return 0
                
        except Exception as e:
            logger.error(f"Error counting events for session {session_id}: {e}")
            self.log_error(e, "count_session_events")
            return 0
    
    def calculate_session_duration(self, start_time_str: Optional[str], end_time: datetime) -> Optional[int]:
        """
        Calculate session duration in milliseconds.
        
        Args:
            start_time_str: ISO format start time string
            end_time: End time as datetime object
            
        Returns:
            Duration in milliseconds, or None if start_time not available
        """
        if not start_time_str:
            logger.warning("Cannot calculate duration: no start_time available")
            return None
        
        try:
            # Parse start time from ISO format
            start_time = datetime.fromisoformat(start_time_str.replace('Z', '+00:00'))
            
            # Calculate duration in milliseconds
            duration_seconds = (end_time - start_time).total_seconds()
            duration_ms = int(duration_seconds * 1000)
            
            logger.debug(f"Calculated session duration: {duration_ms}ms ({duration_seconds:.2f}s)")
            return duration_ms
            
        except Exception as e:
            logger.error(f"Error calculating session duration: {e}")
            self.log_error(e, "calculate_session_duration")
            return None
    
    def update_session_record(self, session_id: str, existing_session: Optional[Dict[str, Any]], 
                            end_time: datetime, duration_ms: Optional[int], events_count: int) -> bool:
        """
        Update session record with end time and final metrics.
        
        Args:
            session_id: Session ID to update
            existing_session: Existing session data if found
            end_time: Session end time
            duration_ms: Session duration in milliseconds
            events_count: Total events in session
            
        Returns:
            True if update successful, False otherwise
        """
        try:
            if existing_session:
                # Update existing session with end data
                updated_session = existing_session.copy()
                updated_session.update({
                    "end_time": end_time.isoformat(),
                    "duration_ms": duration_ms,
                    "events_count": events_count,
                    "updated_at": datetime.now().isoformat()
                })
                
                logger.debug(f"Updating existing session {session_id} with end data")
            else:
                # Create minimal session record for sessions without session_start
                updated_session = {
                    "session_id": session_id,
                    "start_time": None,
                    "end_time": end_time.isoformat(),
                    "duration_ms": duration_ms,
                    "events_count": events_count,
                    "source": "unknown",  # We don't know how it started
                    "project_path": self.load_project_context().get("cwd"),
                    "created_at": datetime.now().isoformat(),
                    "missing_session_start": True
                }
                
                logger.info(f"Creating new session record for {session_id} (missing session_start)")
            
            # Save the updated/new session
            success = self.save_session(updated_session)
            
            if success:
                logger.info(f"Successfully updated session record for {session_id}")
            else:
                logger.error(f"Failed to update session record for {session_id}")
                
            return success
            
        except Exception as e:
            logger.error(f"Error updating session record: {e}")
            self.log_error(e, "update_session_record")
            return False
    
    def create_session_end_event(self, session_id: str, end_time: datetime, 
                                duration_ms: Optional[int], events_count: int,
                                missing_session_start: bool = False) -> bool:
        """
        Create session_end event with comprehensive metrics.
        
        Args:
            session_id: Session ID
            end_time: Session end time
            duration_ms: Session duration in milliseconds
            events_count: Total events in session
            missing_session_start: Whether session_start was captured
            
        Returns:
            True if event created successfully, False otherwise
        """
        try:
            event_data = {
                "session_id": session_id,
                "hook_event_name": "Stop",
                "event_type": "session_end",
                "timestamp": end_time.isoformat(),
                "success": True,
                "data": {
                    "end_time": end_time.isoformat(),
                    "duration_ms": duration_ms,
                    "events_count": events_count,
                    "missing_session_start": missing_session_start
                },
                "raw_input": {
                    "hook_event_name": "Stop",
                    "session_id": session_id,
                    "processed_at": end_time.isoformat()
                }
            }
            
            success = self.save_event(event_data)
            
            if success:
                logger.info(f"Successfully created session_end event for {session_id}")
                if duration_ms:
                    logger.info(f"Session duration: {duration_ms}ms, Events: {events_count}")
                else:
                    logger.info(f"Session end tracked (duration unknown), Events: {events_count}")
            else:
                logger.error(f"Failed to create session_end event for {session_id}")
                
            return success
            
        except Exception as e:
            logger.error(f"Error creating session_end event: {e}")
            self.log_error(e, "create_session_end_event")
            return False
    
    def process_stop_hook(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Main processing logic for the stop hook.
        
        Args:
            input_data: Hook input data from Claude Code
            
        Returns:
            Hook response dictionary
        """
        try:
            # Process common hook data
            processed_data = self.process_hook_data(input_data)
            
            if not self.session_id:
                logger.error("No session ID available for stop hook")
                return self.create_response(continue_execution=True, suppress_output=True)
            
            end_time = datetime.now()
            
            # Find existing session record
            existing_session = self.find_existing_session(self.session_id)
            
            # Calculate duration if possible
            duration_ms = None
            missing_session_start = existing_session is None
            
            if existing_session and existing_session.get("start_time"):
                duration_ms = self.calculate_session_duration(
                    existing_session["start_time"], 
                    end_time
                )
            
            # Count events in session
            events_count = self.count_session_events(self.session_id)
            
            # Update session record
            session_updated = self.update_session_record(
                self.session_id, 
                existing_session, 
                end_time, 
                duration_ms, 
                events_count
            )
            
            # Create session_end event
            event_created = self.create_session_end_event(
                self.session_id,
                end_time,
                duration_ms,
                events_count,
                missing_session_start
            )
            
            # Determine overall success
            overall_success = session_updated and event_created
            
            if overall_success:
                logger.info(f"Stop hook completed successfully for session {self.session_id}")
            else:
                logger.warning(f"Stop hook completed with some failures for session {self.session_id}")
            
            # Return success response (don't block Claude Code execution)
            return self.create_response(
                continue_execution=True,
                suppress_output=True,
                hook_specific_data={
                    "hookEventName": "Stop",
                    "sessionEndTracked": overall_success,
                    "durationMs": duration_ms,
                    "eventsCount": events_count,
                    "missingSessionStart": missing_session_start
                }
            )
            
        except Exception as e:
            logger.error(f"Unexpected error in stop hook: {e}")
            self.log_error(e, "process_stop_hook")
            
            # Always return success to avoid blocking Claude Code
            return self.create_response(continue_execution=True, suppress_output=True)


def main():
    """Main entry point for the stop hook."""
    try:
        # Read input from stdin
        input_text = sys.stdin.read().strip()
        
        if not input_text:
            logger.warning("No input received from stdin")
            print(json.dumps({"continue": True, "suppressOutput": True}))
            return
        
        # Parse JSON input
        try:
            input_data = json.loads(input_text)
        except json.JSONDecodeError as e:
            logger.error(f"Invalid JSON input: {e}")
            print(json.dumps({"continue": True, "suppressOutput": True}))
            return
        
        # Create and run the hook
        hook = StopHook()
        response = hook.process_stop_hook(input_data)
        
        # Output response as JSON
        print(json.dumps(response))
        
    except Exception as e:
        logger.error(f"Fatal error in stop hook: {e}")
        # Always output a valid response to avoid breaking Claude Code
        print(json.dumps({"continue": True, "suppressOutput": True}))
        sys.exit(0)  # Exit successfully to avoid blocking Claude Code


if __name__ == "__main__":
    main()