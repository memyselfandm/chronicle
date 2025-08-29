#!/usr/bin/env python3
"""
MVP Performance Test - 100 Events/Second
=========================================

Tests that Chronicle can handle 100 events per second with:
- Memory usage under 100MB
- Database indexes working correctly
- Event queue memory management functioning

Author: Agent-1 for CHR-46 MVP
"""

import asyncio
import time
import sqlite3
import psutil
import os
import sys
from pathlib import Path
import uuid
from datetime import datetime, timezone
import json

# Add parent directory to path for imports
sys.path.append(os.path.dirname(os.path.dirname(__file__)))

from database import LocalDatabase, create_local_database
from websocket import ConnectionManager, EventMessage

# Test configuration
TARGET_EVENTS_PER_SECOND = 100
TEST_DURATION_SECONDS = 10
MEMORY_LIMIT_MB = 100
BATCH_SIZE = 10  # Send events in batches


class PerformanceTestMVP:
    """MVP Performance test for Chronicle."""
    
    def __init__(self):
        self.database = create_local_database()
        self.connection_manager = ConnectionManager()
        self.events_sent = 0
        self.start_time = 0
        self.memory_samples = []
        self.process = psutil.Process()
        
        # Create test session
        self.session_id = str(uuid.uuid4())
        self.claude_session_id = f"test-mvp-{uuid.uuid4()}"
        
    async def setup(self):
        """Setup test environment."""
        print("Setting up MVP performance test...")
        
        # Initialize connection manager
        await self.connection_manager.startup()
        
        # Create test session in database directly with SQL
        import sqlite3
        with sqlite3.connect(self.database.db_path) as conn:
            conn.execute("""
                INSERT INTO chronicle_sessions 
                (id, claude_session_id, start_time, project_path, git_branch)
                VALUES (?, ?, ?, ?, ?)
            """, (
                self.session_id,
                self.claude_session_id,
                datetime.now(timezone.utc).isoformat(),
                "/test/mvp",
                "test-branch"
            ))
            conn.commit()
        
        print(f"Test session created: {self.session_id}")
        
    async def teardown(self):
        """Cleanup test environment."""
        print("Cleaning up...")
        await self.connection_manager.shutdown()
        self.database.close()
        
    def get_memory_usage_mb(self):
        """Get current memory usage in MB."""
        return self.process.memory_info().rss / 1024 / 1024
        
    async def generate_events(self):
        """Generate events at target rate."""
        print(f"Generating {TARGET_EVENTS_PER_SECOND} events/second for {TEST_DURATION_SECONDS} seconds...")
        
        self.start_time = time.time()
        event_interval = 1.0 / TARGET_EVENTS_PER_SECOND
        
        for i in range(TARGET_EVENTS_PER_SECOND * TEST_DURATION_SECONDS):
            # Create event with valid event type
            event_data = {
                "id": str(uuid.uuid4()),
                "session_id": self.session_id,
                "event_type": "notification",  # Use valid event type
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "tool_name": f"test_tool_{i % 10}",
                "duration_ms": 10 + (i % 50),
                "metadata": {
                    "test_index": i,
                    "batch": i // BATCH_SIZE,
                    "test_run": "mvp_performance"
                }
            }
            
            # Save to database
            success = self.database.save_event(event_data)
            if not success:
                print(f"Warning: Failed to save event {i}")
                continue
            
            # Broadcast via WebSocket
            event_message = EventMessage(
                id=event_data["id"],
                event_type=event_data["event_type"],
                timestamp=event_data["timestamp"],
                session_id=self.claude_session_id,
                data=event_data,
                created_at=time.time()
            )
            
            await self.connection_manager.broadcast_event(event_message)
            self.events_sent += 1
            
            # Sample memory every 10 events
            if i % 10 == 0:
                memory_mb = self.get_memory_usage_mb()
                self.memory_samples.append(memory_mb)
                
                if memory_mb > MEMORY_LIMIT_MB:
                    print(f"⚠️  Memory limit exceeded: {memory_mb:.1f}MB > {MEMORY_LIMIT_MB}MB")
            
            # Sleep to maintain rate
            elapsed = time.time() - self.start_time
            expected_elapsed = (i + 1) * event_interval
            if expected_elapsed > elapsed:
                await asyncio.sleep(expected_elapsed - elapsed)
            
            # Progress update every second
            if i > 0 and i % TARGET_EVENTS_PER_SECOND == 0:
                current_rate = self.events_sent / elapsed
                print(f"Progress: {i}/{TARGET_EVENTS_PER_SECOND * TEST_DURATION_SECONDS} events, "
                      f"Rate: {current_rate:.1f} events/sec, "
                      f"Memory: {memory_mb:.1f}MB")
    
    def verify_indexes(self):
        """Verify database indexes are created."""
        print("\nVerifying database indexes...")
        
        with sqlite3.connect(self.database.db_path) as conn:
            cursor = conn.execute("""
                SELECT name, sql FROM sqlite_master 
                WHERE type='index' AND tbl_name='chronicle_events'
            """)
            
            indexes = cursor.fetchall()
            required_indexes = ['session_id', 'timestamp', 'event_type']
            found_indexes = []
            
            for idx_name, idx_sql in indexes:
                print(f"  Found index: {idx_name}")
                # idx_sql might be None for auto-indexes
                if idx_sql:
                    for required in required_indexes:
                        if required in idx_sql.lower():
                            found_indexes.append(required)
                # Also check index name
                for required in required_indexes:
                    if required in idx_name.lower():
                        found_indexes.append(required)
            
            missing = set(required_indexes) - set(found_indexes)
            if missing:
                print(f"  ⚠️  Missing indexes for: {missing}")
                return False
            
            print(f"  ✅ All required indexes present")
            return True
    
    def verify_performance(self):
        """Verify performance metrics."""
        print("\nPerformance Results:")
        print("=" * 50)
        
        total_duration = time.time() - self.start_time
        actual_rate = self.events_sent / total_duration
        
        print(f"Events sent: {self.events_sent}")
        print(f"Duration: {total_duration:.2f} seconds")
        print(f"Actual rate: {actual_rate:.2f} events/second")
        print(f"Target rate: {TARGET_EVENTS_PER_SECOND} events/second")
        
        # Check event rate
        rate_success = actual_rate >= TARGET_EVENTS_PER_SECOND * 0.95  # Allow 5% tolerance
        if rate_success:
            print(f"✅ Event rate test PASSED")
        else:
            print(f"❌ Event rate test FAILED")
        
        # Check memory usage
        avg_memory = sum(self.memory_samples) / len(self.memory_samples) if self.memory_samples else 0
        max_memory = max(self.memory_samples) if self.memory_samples else 0
        
        print(f"\nMemory Usage:")
        print(f"  Average: {avg_memory:.1f}MB")
        print(f"  Maximum: {max_memory:.1f}MB")
        print(f"  Limit: {MEMORY_LIMIT_MB}MB")
        
        memory_success = max_memory <= MEMORY_LIMIT_MB
        if memory_success:
            print(f"✅ Memory usage test PASSED")
        else:
            print(f"❌ Memory usage test FAILED")
        
        # Query performance test
        print(f"\nQuery Performance Test:")
        query_start = time.time()
        
        with sqlite3.connect(self.database.db_path) as conn:
            # Test indexed queries
            cursor = conn.execute("""
                SELECT COUNT(*) FROM chronicle_events 
                WHERE session_id = ? AND event_type = ?
            """, (self.session_id, 'notification'))
            
            count = cursor.fetchone()[0]
            
        query_time = (time.time() - query_start) * 1000
        print(f"  Indexed query time: {query_time:.2f}ms")
        print(f"  Events in database: {count}")
        
        query_success = query_time < 100  # Should be fast with indexes
        if query_success:
            print(f"✅ Query performance test PASSED")
        else:
            print(f"❌ Query performance test FAILED")
        
        # Overall result
        print("\n" + "=" * 50)
        all_passed = rate_success and memory_success and query_success
        if all_passed:
            print("🎉 ALL MVP PERFORMANCE TESTS PASSED!")
        else:
            print("❌ Some tests failed. See details above.")
        
        return all_passed
    
    async def run(self):
        """Run the MVP performance test."""
        try:
            await self.setup()
            
            # Verify indexes before test
            if not self.verify_indexes():
                print("Warning: Some indexes missing, continuing anyway...")
            
            # Run performance test
            await self.generate_events()
            
            # Verify results
            success = self.verify_performance()
            
            await self.teardown()
            
            return success
            
        except Exception as e:
            print(f"Test failed with error: {e}")
            await self.teardown()
            return False


async def main():
    """Main test entry point."""
    print("Chronicle MVP Performance Test (CHR-46)")
    print("=" * 50)
    
    test = PerformanceTestMVP()
    success = await test.run()
    
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    asyncio.run(main())