#!/usr/bin/env python3
"""
Chronicle Event Broadcaster - Hook Integration for Real-time Events
==================================================================

Integrates Chronicle hooks with the WebSocket/SSE streaming system to provide
real-time event broadcasting to connected clients.

This module monitors the Chronicle database for new events and broadcasts
them to all connected WebSocket/SSE clients with sub-50ms latency.

Features:
- Database event monitoring and streaming
- Async event broadcasting to WebSocket clients
- Event filtering and transformation
- Performance monitoring and metrics
- Graceful error handling and recovery

Author: C-Codey aka curl Stevens aka SWE-40
Port: 8510 (The Town stays winning!)
"""

import asyncio
import json
import logging
import time
import threading
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Callable
from pathlib import Path
import sqlite3

# Try to import performance optimizations
try:
    import ujson as json_impl
except ImportError:
    import json as json_impl

# Local imports
try:
    from .database import LocalDatabase, create_local_database
    from .websocket import EventMessage, connection_manager
except ImportError:
    # Fallback for standalone execution
    import sys
    import os
    sys.path.append(os.path.dirname(__file__))
    from database import LocalDatabase, create_local_database
    from websocket import EventMessage, connection_manager

# Configure logging
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

# Configuration
POLL_INTERVAL = 0.1  # 100ms polling interval for real-time feel
BATCH_SIZE = 50  # Max events to process per batch
LATENCY_TARGET_MS = 50.0


class EventBroadcaster:
    """
    Broadcasts Chronicle events to WebSocket/SSE clients in real-time.
    
    Monitors the Chronicle database for new events and streams them to
    all connected clients with minimal latency.
    """
    
    def __init__(self, database: Optional[LocalDatabase] = None):
        self.database = database or create_local_database()
        self._running = False
        self._last_event_id: Optional[str] = None
        self._last_poll_time = 0.0
        
        # Performance metrics
        self._events_broadcasted = 0
        self._total_broadcast_time = 0.0
        self._avg_latency_ms = 0.0
        
        # Event filters and transformers
        self._event_filters: List[Callable[[Dict[str, Any]], bool]] = []
        self._event_transformers: List[Callable[[Dict[str, Any]], Dict[str, Any]]] = []
        
        # Background tasks
        self._monitor_task: Optional[asyncio.Task] = None
        
        logger.info("EventBroadcaster initialized")
    
    def add_event_filter(self, filter_func: Callable[[Dict[str, Any]], bool]):
        """
        Add an event filter function.
        
        Args:
            filter_func: Function that returns True to include event
        """
        self._event_filters.append(filter_func)
        logger.info(f"Added event filter: {filter_func.__name__}")
    
    def add_event_transformer(self, transform_func: Callable[[Dict[str, Any]], Dict[str, Any]]):
        """
        Add an event transformer function.
        
        Args:
            transform_func: Function to transform event data
        """
        self._event_transformers.append(transform_func)
        logger.info(f"Added event transformer: {transform_func.__name__}")
    
    async def start_monitoring(self):
        """Start monitoring database for new events."""
        if self._running:
            logger.warning("EventBroadcaster already running")
            return
        
        self._running = True
        self._last_poll_time = time.time()
        
        # Get the last event ID to start monitoring from
        await self._initialize_last_event_id()
        
        # Start monitoring task
        self._monitor_task = asyncio.create_task(self._monitor_loop())
        
        logger.info("EventBroadcaster monitoring started")
    
    async def stop_monitoring(self):
        """Stop monitoring database for events."""
        self._running = False
        
        if self._monitor_task:
            self._monitor_task.cancel()
            try:
                await self._monitor_task
            except asyncio.CancelledError:
                pass
        
        logger.info("EventBroadcaster monitoring stopped")
    
    async def _initialize_last_event_id(self):
        """Initialize the last event ID from database."""
        try:
            # Get the most recent event ID
            with self.database._get_connection() as conn:
                cursor = conn.execute(
                    "SELECT id FROM chronicle_events ORDER BY created_at DESC LIMIT 1"
                )
                result = cursor.fetchone()
                
                if result:
                    self._last_event_id = result[0]
                    logger.info(f"Starting monitoring from event ID: {self._last_event_id}")
                else:
                    logger.info("No existing events found, monitoring all new events")
                    
        except Exception as e:
            logger.error(f"Failed to initialize last event ID: {e}")
    
    async def _monitor_loop(self):
        """Main monitoring loop for database events."""
        logger.info("Event monitoring loop started")
        
        try:
            while self._running:
                start_time = time.time()
                
                # Get new events from database
                new_events = await self._get_new_events()
                
                if new_events:
                    # Process and broadcast events
                    await self._process_events(new_events)
                    
                    # Update last event ID
                    self._last_event_id = new_events[-1]["id"]
                
                # Calculate processing time
                process_time = (time.time() - start_time) * 1000
                
                # Log performance warning if over target
                if process_time > LATENCY_TARGET_MS:
                    logger.warning(f"Event processing exceeded target: {process_time:.2f}ms > {LATENCY_TARGET_MS}ms")
                
                # Sleep until next poll
                sleep_time = max(0, POLL_INTERVAL - (time.time() - start_time))
                if sleep_time > 0:
                    await asyncio.sleep(sleep_time)
                
        except asyncio.CancelledError:
            logger.info("Event monitoring loop cancelled")
        except Exception as e:
            logger.error(f"Event monitoring loop error: {e}")
            
            # Restart monitoring after delay if still running
            if self._running:
                await asyncio.sleep(5.0)
                if self._running:
                    self._monitor_task = asyncio.create_task(self._monitor_loop())
    
    async def _get_new_events(self) -> List[Dict[str, Any]]:
        """Get new events from the database."""
        try:
            with self.database._get_connection() as conn:
                conn.row_factory = sqlite3.Row
                
                if self._last_event_id:
                    # Get events after last processed event
                    cursor = conn.execute("""
                        SELECT e.*, s.claude_session_id, s.project_path, s.git_branch
                        FROM chronicle_events e
                        JOIN chronicle_sessions s ON e.session_id = s.id
                        WHERE e.id > ? 
                        ORDER BY e.created_at ASC
                        LIMIT ?
                    """, (self._last_event_id, BATCH_SIZE))
                else:
                    # Get most recent events
                    cursor = conn.execute("""
                        SELECT e.*, s.claude_session_id, s.project_path, s.git_branch
                        FROM chronicle_events e
                        JOIN chronicle_sessions s ON e.session_id = s.id
                        ORDER BY e.created_at DESC
                        LIMIT ?
                    """, (BATCH_SIZE,))
                
                events = []
                for row in cursor.fetchall():
                    event = dict(row)
                    
                    # Parse JSON metadata
                    if event.get("metadata"):
                        try:
                            event["metadata"] = json_impl.loads(event["metadata"])
                        except:
                            event["metadata"] = {}
                    
                    events.append(event)
                
                return events
                
        except Exception as e:
            logger.error(f"Failed to get new events: {e}")
            return []
    
    async def _process_events(self, events: List[Dict[str, Any]]):
        """Process and broadcast events to clients."""
        broadcast_start = time.time()
        
        for event_data in events:
            try:
                # Apply event filters
                if not self._should_broadcast_event(event_data):
                    continue
                
                # Transform event data
                transformed_event = self._transform_event(event_data)
                
                # Create event message
                event_message = EventMessage(
                    id=transformed_event.get("id", "unknown"),
                    event_type=transformed_event.get("event_type", "notification"),
                    timestamp=transformed_event.get("timestamp", datetime.now(timezone.utc).isoformat()),
                    session_id=transformed_event.get("claude_session_id", "unknown"),
                    data={
                        "session_id": transformed_event.get("session_id"),
                        "claude_session_id": transformed_event.get("claude_session_id"),
                        "project_path": transformed_event.get("project_path"),
                        "git_branch": transformed_event.get("git_branch"),
                        "tool_name": transformed_event.get("tool_name"),
                        "duration_ms": transformed_event.get("duration_ms"),
                        "metadata": transformed_event.get("metadata", {}),
                        "created_at": transformed_event.get("created_at")
                    },
                    created_at=time.time()
                )
                
                # Broadcast to all connected clients
                await connection_manager.broadcast_event(event_message)
                
                self._events_broadcasted += 1
                
                logger.debug(f"Broadcasted event: {event_message.event_type} for session {event_message.session_id}")
                
            except Exception as e:
                logger.error(f"Failed to process event {event_data.get('id', 'unknown')}: {e}")
        
        # Update performance metrics
        broadcast_time = (time.time() - broadcast_start) * 1000
        self._total_broadcast_time += broadcast_time
        
        if self._events_broadcasted > 0:
            self._avg_latency_ms = self._total_broadcast_time / self._events_broadcasted
        
        logger.debug(f"Processed {len(events)} events in {broadcast_time:.2f}ms")
    
    def _should_broadcast_event(self, event_data: Dict[str, Any]) -> bool:
        """Apply filters to determine if event should be broadcasted."""
        # Apply all registered filters
        for filter_func in self._event_filters:
            try:
                if not filter_func(event_data):
                    return False
            except Exception as e:
                logger.error(f"Event filter error: {e}")
                # Continue with other filters on error
        
        return True
    
    def _transform_event(self, event_data: Dict[str, Any]) -> Dict[str, Any]:
        """Apply transformations to event data."""
        transformed = event_data.copy()
        
        # Apply all registered transformers
        for transform_func in self._event_transformers:
            try:
                transformed = transform_func(transformed)
            except Exception as e:
                logger.error(f"Event transformer error: {e}")
                # Continue with original data on error
        
        return transformed
    
    def get_stats(self) -> Dict[str, Any]:
        """Get broadcaster statistics."""
        return {
            "running": self._running,
            "events_broadcasted": self._events_broadcasted,
            "avg_latency_ms": round(self._avg_latency_ms, 2),
            "total_broadcast_time_ms": round(self._total_broadcast_time, 2),
            "last_event_id": self._last_event_id,
            "poll_interval_ms": POLL_INTERVAL * 1000,
            "batch_size": BATCH_SIZE
        }


# Default event filters
def filter_important_events(event_data: Dict[str, Any]) -> bool:
    """Filter to only broadcast important event types."""
    important_types = {
        "session_start", "session_end", "pre_tool_use", "post_tool_use", 
        "user_prompt_submit", "error", "stop", "subagent_stop"
    }
    
    event_type = event_data.get("event_type", "")
    return event_type in important_types


def filter_recent_events(event_data: Dict[str, Any], max_age_seconds: int = 300) -> bool:
    """Filter to only broadcast recent events."""
    try:
        created_at = event_data.get("created_at")
        if not created_at:
            return True  # Include if no timestamp
        
        # Parse timestamp
        if isinstance(created_at, str):
            try:
                event_time = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
            except:
                return True  # Include if can't parse
        else:
            return True
        
        # Check age
        current_time = datetime.now(timezone.utc)
        age_seconds = (current_time - event_time).total_seconds()
        
        return age_seconds <= max_age_seconds
        
    except Exception as e:
        logger.error(f"Recent events filter error: {e}")
        return True  # Include on error


# Default event transformers
def enhance_event_metadata(event_data: Dict[str, Any]) -> Dict[str, Any]:
    """Enhance event with additional metadata for clients."""
    enhanced = event_data.copy()
    
    # Add broadcast timestamp
    enhanced["broadcast_timestamp"] = datetime.now(timezone.utc).isoformat()
    
    # Add event category
    event_type = event_data.get("event_type", "")
    if event_type in ["pre_tool_use", "post_tool_use"]:
        enhanced["category"] = "tool_execution"
    elif event_type in ["session_start", "session_end"]:
        enhanced["category"] = "session_lifecycle"
    elif event_type in ["user_prompt_submit"]:
        enhanced["category"] = "user_interaction"
    elif event_type in ["error", "notification"]:
        enhanced["category"] = "system_event"
    else:
        enhanced["category"] = "other"
    
    # Add performance indicators
    if event_data.get("duration_ms"):
        duration = event_data["duration_ms"]
        if duration < 100:
            enhanced["performance"] = "fast"
        elif duration < 1000:
            enhanced["performance"] = "normal"
        else:
            enhanced["performance"] = "slow"
    
    return enhanced


def sanitize_sensitive_data(event_data: Dict[str, Any]) -> Dict[str, Any]:
    """Sanitize sensitive data from events before broadcasting."""
    sanitized = event_data.copy()
    
    # Sanitize metadata
    metadata = sanitized.get("metadata", {})
    if isinstance(metadata, dict):
        # Remove potentially sensitive keys
        sensitive_keys = ["password", "token", "key", "secret", "auth", "credential"]
        
        for key in list(metadata.keys()):
            if any(sensitive in key.lower() for sensitive in sensitive_keys):
                metadata[key] = "[REDACTED]"
        
        sanitized["metadata"] = metadata
    
    return sanitized


# Global broadcaster instance
event_broadcaster = EventBroadcaster()

# Register default filters and transformers
event_broadcaster.add_event_filter(filter_important_events)
event_broadcaster.add_event_filter(lambda e: filter_recent_events(e, max_age_seconds=300))
event_broadcaster.add_event_transformer(enhance_event_metadata)
event_broadcaster.add_event_transformer(sanitize_sensitive_data)


# Factory function for easy initialization
def create_event_broadcaster(database: Optional[LocalDatabase] = None) -> EventBroadcaster:
    """
    Create an EventBroadcaster instance.
    
    Args:
        database: Optional database instance
        
    Returns:
        Configured broadcaster instance
    """
    broadcaster = EventBroadcaster(database=database)
    
    # Register default filters and transformers
    broadcaster.add_event_filter(filter_important_events)
    broadcaster.add_event_filter(lambda e: filter_recent_events(e, max_age_seconds=300))
    broadcaster.add_event_transformer(enhance_event_metadata)
    broadcaster.add_event_transformer(sanitize_sensitive_data)
    
    return broadcaster


if __name__ == "__main__":
    # Quick test if run directly
    print("Chronicle Event Broadcaster")
    print("===========================")
    
    async def test_broadcaster():
        try:
            # Create and start broadcaster
            broadcaster = create_event_broadcaster()
            await broadcaster.start_monitoring()
            
            print("Event broadcaster started - monitoring for events...")
            print("Stats:", broadcaster.get_stats())
            
            # Monitor for 10 seconds
            await asyncio.sleep(10)
            
            # Stop broadcaster
            await broadcaster.stop_monitoring()
            
            print("Final stats:", broadcaster.get_stats())
            print("Test completed successfully!")
            
        except KeyboardInterrupt:
            print("\nTest interrupted by user")
        except Exception as e:
            print(f"Test error: {e}")
    
    asyncio.run(test_broadcaster())