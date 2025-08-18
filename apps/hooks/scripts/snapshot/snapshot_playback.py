#!/usr/bin/env python3
"""
Chronicle Data Snapshot Playback Script

Replays captured snapshot data to simulate real Claude Code sessions for testing.
Supports both in-memory simulation and actual database insertion for integration tests.
"""

import os
import sys
import json
import argparse
import asyncio
import logging
import sqlite3
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Union
from pathlib import Path

# Add the hooks src directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'src'))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'src', 'lib'))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'config'))

try:
    from models import Session, Event, EventType, get_sqlite_schema_sql
    from database import SupabaseClient, DatabaseManager
    from utils import validate_json
except ImportError as e:
    print(f"⚠️ Import error: {e}")
    print("Make sure you're running from the Chronicle root directory")
    sys.exit(1)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class SnapshotPlayback:
    """Replays Chronicle snapshot data for testing."""
    
    def __init__(self, snapshot_file: str, target: str = "memory"):
        """
        Initialize playback system.
        
        Args:
            snapshot_file: Path to snapshot JSON file
            target: Where to replay data ("memory", "sqlite", "supabase")
        """
        self.snapshot_file = snapshot_file
        self.target = target
        self.snapshot_data = {}
        self.database_manager = None
        self.sqlite_connection = None
        
        # Load snapshot data
        self.load_snapshot()
        
        # Initialize target system
        if target == "sqlite":
            self.init_sqlite()
        elif target == "supabase":
            self.init_supabase()
    
    def load_snapshot(self) -> None:
        """Load snapshot data from file."""
        try:
            with open(self.snapshot_file, 'r') as f:
                self.snapshot_data = json.load(f)
            
            sessions_count = len(self.snapshot_data.get('sessions', []))
            events_count = len(self.snapshot_data.get('events', []))
            
            logger.info(f"📂 Loaded snapshot: {sessions_count} sessions, {events_count} events")
            
            # Validate snapshot structure
            if not self.validate_snapshot():
                raise ValueError("Invalid snapshot structure")
                
        except Exception as e:
            logger.error(f"❌ Failed to load snapshot: {e}")
            raise
    
    def validate_snapshot(self) -> bool:
        """Validate snapshot data structure."""
        required_keys = ['metadata', 'sessions', 'events']
        
        for key in required_keys:
            if key not in self.snapshot_data:
                logger.error(f"Missing required key in snapshot: {key}")
                return False
        
        # Validate metadata
        metadata = self.snapshot_data['metadata']
        if not isinstance(metadata, dict) or 'captured_at' not in metadata:
            logger.error("Invalid metadata structure")
            return False
        
        # Basic validation of sessions and events
        if not isinstance(self.snapshot_data['sessions'], list):
            logger.error("Sessions must be a list")
            return False
        
        if not isinstance(self.snapshot_data['events'], list):
            logger.error("Events must be a list")
            return False
        
        logger.info("✅ Snapshot validation passed")
        return True
    
    def init_sqlite(self) -> None:
        """Initialize SQLite database for playback."""
        try:
            # Use temporary database for testing
            db_path = ":memory:"  # In-memory for speed
            self.sqlite_connection = sqlite3.connect(db_path)
            self.sqlite_connection.row_factory = sqlite3.Row
            
            # Create schema
            schema_sql = get_sqlite_schema_sql()
            for statement in schema_sql.split(';'):
                if statement.strip():
                    self.sqlite_connection.execute(statement)
            
            self.sqlite_connection.commit()
            logger.info("✅ SQLite database initialized for playback")
            
        except Exception as e:
            logger.error(f"❌ Failed to initialize SQLite: {e}")
            raise
    
    def init_supabase(self) -> None:
        """Initialize Supabase connection for playback."""
        try:
            self.database_manager = DatabaseManager()
            
            if not self.database_manager.supabase_client.health_check():
                raise ConnectionError("Cannot connect to Supabase")
            
            logger.info("✅ Supabase connection initialized for playback")
            
        except Exception as e:
            logger.error(f"❌ Failed to initialize Supabase: {e}")
            raise
    
    async def replay_sessions(self, time_acceleration: float = 1.0) -> List[Dict[str, Any]]:
        """
        Replay session data.
        
        Args:
            time_acceleration: Speed up playback (1.0 = real time, 10.0 = 10x faster)
            
        Returns:
            List of processed session records
        """
        sessions = self.snapshot_data.get('sessions', [])
        processed_sessions = []
        
        logger.info(f"🎬 Replaying {len(sessions)} sessions (acceleration: {time_acceleration}x)")
        
        for i, session_data in enumerate(sessions):
            try:
                # Update timestamps to current time for realism
                session_copy = session_data.copy()
                base_time = datetime.utcnow() - timedelta(hours=len(sessions) - i)
                session_copy['start_time'] = base_time.isoformat() + 'Z'
                
                if self.target == "memory":
                    # Just validate and store in memory
                    session_obj = Session.from_dict(session_copy)
                    processed_sessions.append(session_obj.to_dict())
                    
                elif self.target == "sqlite":
                    # Insert into SQLite
                    success = self.insert_session_sqlite(session_copy)
                    if success:
                        processed_sessions.append(session_copy)
                        
                elif self.target == "supabase":
                    # Insert into Supabase
                    success = self.database_manager.save_session(session_copy)
                    if success:
                        processed_sessions.append(session_copy)
                
                # Simulate time delay
                if time_acceleration > 0:
                    await asyncio.sleep(0.1 / time_acceleration)
                
            except Exception as e:
                logger.error(f"❌ Failed to replay session {i}: {e}")
                continue
        
        logger.info(f"✅ Replayed {len(processed_sessions)} sessions successfully")
        return processed_sessions
    
    async def replay_events(self, session_ids: Optional[List[str]] = None, 
                          time_acceleration: float = 1.0) -> List[Dict[str, Any]]:
        """
        Replay event data.
        
        Args:
            session_ids: Filter events to specific sessions (None = all)
            time_acceleration: Speed up playback
            
        Returns:
            List of processed event records
        """
        events = self.snapshot_data.get('events', [])
        
        # Filter events by session if requested
        if session_ids:
            events = [e for e in events if e.get('session_id') in session_ids]
        
        processed_events = []
        
        logger.info(f"🎬 Replaying {len(events)} events (acceleration: {time_acceleration}x)")
        
        # Sort events by timestamp for realistic playback
        events.sort(key=lambda x: x.get('timestamp', ''))
        
        for i, event_data in enumerate(events):
            try:
                # Update timestamps to current time for realism
                event_copy = event_data.copy()
                base_time = datetime.utcnow() - timedelta(minutes=len(events) - i)
                event_copy['timestamp'] = base_time.isoformat() + 'Z'
                
                if self.target == "memory":
                    # Just validate and store in memory
                    event_obj = Event.from_dict(event_copy)
                    processed_events.append(event_obj.to_dict())
                    
                elif self.target == "sqlite":
                    # Insert into SQLite
                    success = self.insert_event_sqlite(event_copy)
                    if success:
                        processed_events.append(event_copy)
                        
                elif self.target == "supabase":
                    # Insert into Supabase
                    success = self.database_manager.save_event(event_copy)
                    if success:
                        processed_events.append(event_copy)
                
                # Simulate time delay
                if time_acceleration > 0:
                    await asyncio.sleep(0.05 / time_acceleration)
                
            except Exception as e:
                logger.error(f"❌ Failed to replay event {i}: {e}")
                continue
        
        logger.info(f"✅ Replayed {len(processed_events)} events successfully")
        return processed_events
    
    def insert_session_sqlite(self, session_data: Dict[str, Any]) -> bool:
        """Insert session into SQLite database."""
        try:
            columns = list(session_data.keys())
            placeholders = ', '.join(['?' for _ in columns])
            column_names = ', '.join(columns)
            
            sql = f"INSERT OR REPLACE INTO sessions ({column_names}) VALUES ({placeholders})"
            values = [session_data[col] for col in columns]
            
            self.sqlite_connection.execute(sql, values)
            self.sqlite_connection.commit()
            return True
            
        except Exception as e:
            logger.error(f"Failed to insert session into SQLite: {e}")
            return False
    
    def insert_event_sqlite(self, event_data: Dict[str, Any]) -> bool:
        """Insert event into SQLite database."""
        try:
            # Ensure data field is JSON string
            event_copy = event_data.copy()
            if isinstance(event_copy.get('data'), dict):
                event_copy['data'] = json.dumps(event_copy['data'])
            
            columns = list(event_copy.keys())
            placeholders = ', '.join(['?' for _ in columns])
            column_names = ', '.join(columns)
            
            sql = f"INSERT INTO events ({column_names}) VALUES ({placeholders})"
            values = [event_copy[col] for col in columns]
            
            self.sqlite_connection.execute(sql, values)
            self.sqlite_connection.commit()
            return True
            
        except Exception as e:
            logger.error(f"Failed to insert event into SQLite: {e}")
            return False
    
    async def full_replay(self, time_acceleration: float = 10.0) -> Dict[str, Any]:
        """
        Perform full replay of snapshot data.
        
        Args:
            time_acceleration: Speed up playback
            
        Returns:
            Summary of replay results
        """
        start_time = datetime.utcnow()
        
        logger.info("🚀 Starting full snapshot replay...")
        
        # Replay sessions first
        sessions = await self.replay_sessions(time_acceleration)
        
        # Extract session IDs for event filtering
        session_ids = [s.get('id') or s.get('claude_session_id') for s in sessions]
        session_ids = [sid for sid in session_ids if sid]
        
        # Replay events
        events = await self.replay_events(session_ids, time_acceleration)
        
        end_time = datetime.utcnow()
        duration = (end_time - start_time).total_seconds()
        
        results = {
            "replay_summary": {
                "sessions_replayed": len(sessions),
                "events_replayed": len(events),
                "duration_seconds": duration,
                "target": self.target,
                "time_acceleration": time_acceleration,
                "completed_at": end_time.isoformat() + 'Z'
            },
            "sessions": sessions,
            "events": events
        }
        
        logger.info(f"✅ Full replay complete in {duration:.2f}s")
        return results
    
    def get_replay_stats(self) -> Dict[str, Any]:
        """Get statistics about the loaded snapshot."""
        sessions = self.snapshot_data.get('sessions', [])
        events = self.snapshot_data.get('events', [])
        
        # Analyze event types
        event_types = {}
        tool_names = {}
        
        for event in events:
            event_type = event.get('event_type', 'unknown')
            event_types[event_type] = event_types.get(event_type, 0) + 1
            
            tool_name = event.get('tool_name')
            if tool_name:
                tool_names[tool_name] = tool_names.get(tool_name, 0) + 1
        
        return {
            "snapshot_metadata": self.snapshot_data.get('metadata', {}),
            "sessions_count": len(sessions),
            "events_count": len(events),
            "event_types": event_types,
            "tool_usage": tool_names,
            "unique_sessions": len(set(e.get('session_id') for e in events if e.get('session_id')))
        }
    
    def cleanup(self) -> None:
        """Clean up resources."""
        if self.sqlite_connection:
            self.sqlite_connection.close()
            logger.info("🧹 SQLite connection closed")


async def main():
    """Main function for CLI usage."""
    parser = argparse.ArgumentParser(description="Replay Chronicle snapshot data")
    parser.add_argument("snapshot", help="Path to snapshot JSON file")
    parser.add_argument("--target", choices=["memory", "sqlite", "supabase"], 
                       default="memory", help="Replay target (default: memory)")
    parser.add_argument("--speed", type=float, default=10.0, 
                       help="Time acceleration factor (default: 10.0)")
    parser.add_argument("--stats-only", action="store_true", 
                       help="Only show snapshot statistics")
    parser.add_argument("--verbose", action="store_true", help="Enable verbose logging")
    
    args = parser.parse_args()
    
    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)
    
    # Initialize playback
    try:
        playback = SnapshotPlayback(args.snapshot, args.target)
        
        if args.stats_only:
            # Just show statistics
            stats = playback.get_replay_stats()
            print("\n📊 Snapshot Statistics:")
            print(json.dumps(stats, indent=2, default=str))
            return
        
        # Perform full replay
        results = await playback.full_replay(args.speed)
        
        print(f"\n🎉 Replay complete!")
        print(f"📊 Sessions: {results['replay_summary']['sessions_replayed']}")
        print(f"📊 Events: {results['replay_summary']['events_replayed']}")
        print(f"⏱️ Duration: {results['replay_summary']['duration_seconds']:.2f}s")
        print(f"🎯 Target: {results['replay_summary']['target']}")
        
        # Cleanup
        playback.cleanup()
        
    except Exception as e:
        logger.error(f"❌ Playback failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())