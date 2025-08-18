#!/usr/bin/env python3
"""
Chronicle Data Snapshot Capture Script

Captures live session and event data from Supabase for testing purposes.
Real data from real Claude Code sessions to create comprehensive test scenarios.
"""

import os
import sys
import json
import argparse
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional
import asyncio
import logging

# Add the hooks src directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'src'))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'src', 'lib'))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..', 'config'))

try:
    from supabase import create_client, Client
    SUPABASE_AVAILABLE = True
except ImportError:
    print("⚠️ Supabase library not available. Install with: pip install supabase")
    SUPABASE_AVAILABLE = False

try:
    from models import Session, Event, sanitize_data
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


class SnapshotCapture:
    """Captures live Chronicle data for test scenarios."""
    
    def __init__(self, supabase_url: str, supabase_key: str):
        """Initialize with Supabase credentials."""
        if not SUPABASE_AVAILABLE:
            raise ImportError("Supabase library required for snapshot capture")
        
        self.supabase: Client = create_client(supabase_url, supabase_key)
        self.captured_data = {
            "metadata": {
                "captured_at": datetime.utcnow().isoformat() + 'Z',
                "source": "live_supabase",
                "version": "1.0.0"
            },
            "sessions": [],
            "events": []
        }
    
    async def capture_recent_sessions(self, hours: int = 24, limit: int = 10) -> List[Dict[str, Any]]:
        """
        Capture recent sessions from Supabase.
        
        Args:
            hours: How many hours back to look for sessions
            limit: Maximum number of sessions to capture
            
        Returns:
            List of session dictionaries
        """
        try:
            cutoff_time = datetime.utcnow() - timedelta(hours=hours)
            cutoff_iso = cutoff_time.isoformat() + 'Z'
            
            logger.info(f"🔍 Capturing sessions from last {hours} hours (since {cutoff_iso})")
            
            # Query recent sessions
            response = self.supabase.table('sessions').select('*').gte(
                'start_time', cutoff_iso
            ).order('start_time', desc=True).limit(limit).execute()
            
            sessions = response.data if response.data else []
            logger.info(f"📦 Captured {len(sessions)} sessions")
            
            # Sanitize sensitive data
            sanitized_sessions = []
            for session in sessions:
                sanitized = sanitize_data(session)
                # Anonymize project paths while keeping structure
                if 'project_path' in sanitized:
                    path_parts = sanitized['project_path'].split('/')
                    if len(path_parts) > 2:
                        sanitized['project_path'] = '/'.join(['[ANONYMIZED]'] + path_parts[-2:])
                
                sanitized_sessions.append(sanitized)
            
            return sanitized_sessions
            
        except Exception as e:
            logger.error(f"❌ Failed to capture sessions: {e}")
            return []
    
    async def capture_events_for_sessions(self, session_ids: List[str], 
                                        events_per_session: int = 50) -> List[Dict[str, Any]]:
        """
        Capture events for specific sessions.
        
        Args:
            session_ids: List of session IDs to capture events for
            events_per_session: Maximum events per session
            
        Returns:
            List of event dictionaries
        """
        all_events = []
        
        for session_id in session_ids:
            try:
                logger.info(f"🔍 Capturing events for session {session_id[:8]}...")
                
                # Query events for this session
                response = self.supabase.table('events').select('*').eq(
                    'session_id', session_id
                ).order('timestamp', desc=False).limit(events_per_session).execute()
                
                events = response.data if response.data else []
                logger.info(f"📦 Captured {len(events)} events for session {session_id[:8]}")
                
                # Sanitize event data
                for event in events:
                    sanitized_event = sanitize_data(event)
                    
                    # Parse and sanitize JSONB data field
                    if 'data' in sanitized_event and isinstance(sanitized_event['data'], str):
                        try:
                            data_obj = json.loads(sanitized_event['data'])
                            sanitized_event['data'] = sanitize_data(data_obj)
                        except json.JSONDecodeError:
                            sanitized_event['data'] = {}
                    
                    all_events.append(sanitized_event)
                
            except Exception as e:
                logger.error(f"❌ Failed to capture events for session {session_id}: {e}")
                continue
        
        return all_events
    
    async def capture_comprehensive_snapshot(self, hours: int = 24, 
                                           max_sessions: int = 5,
                                           events_per_session: int = 100) -> Dict[str, Any]:
        """
        Capture a comprehensive snapshot of recent Chronicle data.
        
        Args:
            hours: How many hours back to capture
            max_sessions: Maximum sessions to include
            events_per_session: Maximum events per session
            
        Returns:
            Comprehensive snapshot dictionary
        """
        logger.info("🚀 Starting comprehensive snapshot capture...")
        
        # Capture recent sessions
        sessions = await self.capture_recent_sessions(hours, max_sessions)
        if not sessions:
            logger.warning("⚠️ No sessions captured")
            return self.captured_data
        
        self.captured_data["sessions"] = sessions
        
        # Extract session IDs for event capture
        session_ids = [s.get('id') or s.get('claude_session_id') for s in sessions]
        session_ids = [sid for sid in session_ids if sid]  # Filter out None values
        
        if session_ids:
            # Capture events for these sessions
            events = await self.capture_events_for_sessions(session_ids, events_per_session)
            self.captured_data["events"] = events
        
        # Add summary metadata
        self.captured_data["metadata"].update({
            "sessions_captured": len(sessions),
            "events_captured": len(self.captured_data["events"]),
            "session_ids": session_ids[:5],  # First 5 for reference
            "capture_parameters": {
                "hours_back": hours,
                "max_sessions": max_sessions,
                "events_per_session": events_per_session
            }
        })
        
        logger.info(f"✅ Snapshot complete: {len(sessions)} sessions, {len(self.captured_data['events'])} events")
        return self.captured_data
    
    def save_snapshot(self, output_file: str, data: Optional[Dict[str, Any]] = None) -> bool:
        """
        Save snapshot data to file.
        
        Args:
            output_file: Path to save snapshot
            data: Data to save (defaults to captured_data)
            
        Returns:
            True if successful
        """
        try:
            snapshot_data = data or self.captured_data
            
            # Ensure directory exists
            os.makedirs(os.path.dirname(os.path.abspath(output_file)), exist_ok=True)
            
            with open(output_file, 'w') as f:
                json.dump(snapshot_data, f, indent=2, default=str)
            
            logger.info(f"💾 Snapshot saved to {output_file}")
            return True
            
        except Exception as e:
            logger.error(f"❌ Failed to save snapshot: {e}")
            return False


async def main():
    """Main function for CLI usage."""
    parser = argparse.ArgumentParser(description="Capture Chronicle data snapshots from Supabase")
    parser.add_argument("--url", required=True, help="Supabase URL")
    parser.add_argument("--key", required=True, help="Supabase anon key")
    parser.add_argument("--hours", type=int, default=24, help="Hours back to capture (default: 24)")
    parser.add_argument("--sessions", type=int, default=5, help="Max sessions to capture (default: 5)")
    parser.add_argument("--events", type=int, default=100, help="Max events per session (default: 100)")
    parser.add_argument("--output", default="./test_snapshots/live_snapshot.json", 
                       help="Output file path (default: ./test_snapshots/live_snapshot.json)")
    parser.add_argument("--verbose", action="store_true", help="Enable verbose logging")
    
    args = parser.parse_args()
    
    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)
    
    # Initialize capture
    try:
        capture = SnapshotCapture(args.url, args.key)
        
        # Capture comprehensive snapshot
        snapshot_data = await capture.capture_comprehensive_snapshot(
            hours=args.hours,
            max_sessions=args.sessions, 
            events_per_session=args.events
        )
        
        # Save to file
        if capture.save_snapshot(args.output, snapshot_data):
            print(f"🎉 Snapshot capture complete!")
            print(f"📊 Sessions: {len(snapshot_data['sessions'])}")
            print(f"📊 Events: {len(snapshot_data['events'])}")
            print(f"📁 Saved to: {args.output}")
        else:
            print("❌ Failed to save snapshot")
            sys.exit(1)
            
    except Exception as e:
        logger.error(f"❌ Snapshot capture failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    if not SUPABASE_AVAILABLE:
        print("❌ Supabase library required. Install with: pip install supabase")
        sys.exit(1)
    
    asyncio.run(main())