#!/usr/bin/env python3
"""
Chronicle WebSocket Demo & Quick Test
====================================

Quick demonstration of the Chronicle WebSocket/SSE real-time system.
Tests basic functionality and shows how to use the system.

Author: C-Codey aka curl Stevens aka SWE-40
Port: 8510 (Demo from The Town!)
"""

import asyncio
import json
import time
import uuid
from datetime import datetime, timezone

# Import local modules
from database import LocalDatabase, create_local_database
from websocket import ChronicleWebSocketServer, EventMessage, create_websocket_server, connection_manager
from event_broadcaster import EventBroadcaster, create_event_broadcaster


async def demo_basic_functionality():
    """Demonstrate basic WebSocket functionality."""
    print("Chronicle WebSocket Demo - Basic Functionality")
    print("=" * 50)
    
    try:
        # Create test database
        print("Creating test database...")
        test_db = create_local_database(":memory:")
        
        if test_db.test_connection():
            print("✓ Database connection successful")
        else:
            print("✗ Database connection failed")
            return
        
        # Add test session
        print("Adding test session...")
        session_data = {
            "claude_session_id": "demo-session-123",
            "project_path": "/demo/project",
            "git_branch": "main",
            "start_time": datetime.now(timezone.utc).isoformat()
        }
        
        success, session_id = test_db.save_session(session_data)
        if success:
            print(f"✓ Session created: {session_id}")
        else:
            print("✗ Session creation failed")
            return
        
        # Add test events
        print("Adding test events...")
        event_types = ["pre_tool_use", "post_tool_use", "user_prompt_submit", "notification"]
        
        for i, event_type in enumerate(event_types):
            event_data = {
                "session_id": session_id,
                "event_type": event_type,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "data": {
                    "demo_event": True,
                    "event_number": i + 1,
                    "tool_name": f"demo_tool_{i}" if "tool" in event_type else None
                }
            }
            
            if test_db.save_event(event_data):
                print(f"✓ Event {i+1} saved: {event_type}")
            else:
                print(f"✗ Event {i+1} failed: {event_type}")
        
        # Test WebSocket server creation
        print("\nTesting WebSocket server...")
        server = create_websocket_server(test_db)
        if server:
            print("✓ WebSocket server created successfully")
        else:
            print("✗ WebSocket server creation failed")
            return
        
        # Test event broadcaster
        print("Testing event broadcaster...")
        broadcaster = create_event_broadcaster(test_db)
        if broadcaster:
            print("✓ Event broadcaster created successfully")
            
            # Test broadcasting
            await broadcaster.start_monitoring()
            print("✓ Event monitoring started")
            
            # Let it run for a moment
            await asyncio.sleep(2)
            
            # Show stats
            stats = broadcaster.get_stats()
            print(f"✓ Broadcaster stats: {stats}")
            
            await broadcaster.stop_monitoring()
            print("✓ Event monitoring stopped")
        else:
            print("✗ Event broadcaster creation failed")
        
        # Test connection manager
        print("\nTesting connection manager...")
        conn_stats = connection_manager.get_connection_stats()
        print(f"✓ Connection stats: {conn_stats}")
        
        # Test event message creation
        print("Testing event message creation...")
        test_event = EventMessage(
            id=str(uuid.uuid4()),
            event_type="demo_event",
            timestamp=datetime.now(timezone.utc).isoformat(),
            session_id="demo-session",
            data={"message": "Hello from Chronicle!", "test": True},
            created_at=time.time()
        )
        
        if test_event:
            print("✓ Event message created:")
            print(f"  ID: {test_event.id}")
            print(f"  Type: {test_event.event_type}")
            print(f"  Data: {test_event.data}")
        
        # Show database performance
        print("\nDatabase performance stats:")
        db_stats = test_db.get_performance_stats()
        for key, value in db_stats.items():
            print(f"  {key}: {value}")
        
        # Cleanup
        test_db.close()
        print("\n✓ Demo completed successfully!")
        
        print("\n" + "=" * 50)
        print("REAL SERVER USAGE:")
        print("=" * 50)
        print("1. Start server:")
        print("   python run_server.py --port 8510")
        print()
        print("2. Connect with WebSocket client:")
        print("   ws://localhost:8510/ws")
        print()
        print("3. Use SSE endpoint:")
        print("   http://localhost:8510/api/events/stream")
        print()
        print("4. Check server stats:")
        print("   http://localhost:8510/api/stats")
        print("=" * 50)
        
    except Exception as e:
        print(f"✗ Demo failed: {e}")
        import traceback
        traceback.print_exc()


async def demo_event_broadcasting():
    """Demonstrate event broadcasting functionality."""
    print("\nChronicle Event Broadcasting Demo")
    print("=" * 40)
    
    try:
        # Initialize connection manager
        await connection_manager.startup()
        print("✓ Connection manager started")
        
        # Create test events
        events = []
        for i in range(5):
            event = EventMessage(
                id=str(uuid.uuid4()),
                event_type=f"demo_event_{i}",
                timestamp=datetime.now(timezone.utc).isoformat(),
                session_id="demo-broadcast",
                data={
                    "event_number": i,
                    "message": f"Test event {i}",
                    "timestamp": time.time()
                },
                created_at=time.time()
            )
            events.append(event)
        
        # Broadcast events (simulated - no actual clients)
        print("Broadcasting test events...")
        start_time = time.time()
        
        for event in events:
            await connection_manager.broadcast_event(event)
            print(f"✓ Broadcasted: {event.event_type}")
            await asyncio.sleep(0.1)  # Small delay between events
        
        broadcast_time = (time.time() - start_time) * 1000
        print(f"✓ Broadcast completed in {broadcast_time:.2f}ms")
        
        # Show final stats
        final_stats = connection_manager.get_connection_stats()
        print(f"✓ Final connection stats: {final_stats}")
        
        # Shutdown
        await connection_manager.shutdown()
        print("✓ Connection manager shutdown")
        
    except Exception as e:
        print(f"✗ Broadcasting demo failed: {e}")


if __name__ == "__main__":
    print("Chronicle WebSocket & SSE System Demo")
    print("====================================")
    print()
    
    async def main():
        """Run all demos."""
        try:
            # Run basic functionality demo
            await demo_basic_functionality()
            
            # Run broadcasting demo
            await demo_event_broadcasting()
            
            print("\nAll demos completed successfully! 🚀")
            
        except KeyboardInterrupt:
            print("\nDemo interrupted by user")
        except Exception as e:
            print(f"\nDemo error: {e}")
    
    asyncio.run(main())