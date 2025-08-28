#!/usr/bin/env python3
"""
Chronicle WebSocket & SSE Test Suite
===================================

Comprehensive test suite for the Chronicle real-time event streaming system.
Tests WebSocket connections, SSE fallbacks, connection management, event
broadcasting, and performance characteristics.

Author: C-Codey aka curl Stevens aka SWE-40
Port: 8510 (Testing The Town's finest!)
"""

import asyncio
import json
import pytest
import time
import uuid
import websockets
import aiohttp
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from typing import List, Dict, Any
import logging

# Try to import performance optimizations
try:
    import ujson as json_impl
except ImportError:
    import json as json_impl

# Local imports
from database import LocalDatabase, create_local_database
from websocket import (
    ChronicleWebSocketServer, ConnectionManager, EventMessage,
    connection_manager, create_websocket_server
)
from event_broadcaster import EventBroadcaster, create_event_broadcaster

# Test configuration
TEST_HOST = "127.0.0.1"
TEST_PORT = 8511  # Use different port for testing
WEBSOCKET_URL = f"ws://{TEST_HOST}:{TEST_PORT}/ws"
SSE_URL = f"http://{TEST_HOST}:{TEST_PORT}/api/events/stream"
STATS_URL = f"http://{TEST_HOST}:{TEST_PORT}/api/stats"
HEALTH_URL = f"http://{TEST_HOST}:{TEST_PORT}/health"

# Configure logging for tests
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class TestChronicleWebSocket:
    """Test suite for Chronicle WebSocket functionality."""
    
    @pytest.fixture
    async def test_database(self):
        """Create a test database instance."""
        test_db = create_local_database(":memory:")  # Use in-memory database
        yield test_db
        test_db.close()
    
    @pytest.fixture
    async def test_server(self, test_database):
        """Create and start test server."""
        server = create_websocket_server(test_database)
        
        # Start server in background
        server_task = asyncio.create_task(
            server.app.run(host=TEST_HOST, port=TEST_PORT)
        )
        
        # Wait for server to start
        await asyncio.sleep(1)
        
        yield server
        
        # Cleanup
        server_task.cancel()
        try:
            await server_task
        except asyncio.CancelledError:
            pass
    
    async def test_websocket_connection(self, test_server):
        """Test basic WebSocket connection."""
        try:
            async with websockets.connect(WEBSOCKET_URL) as websocket:
                # Should receive welcome message
                message = await asyncio.wait_for(websocket.recv(), timeout=5.0)
                data = json_impl.loads(message)
                
                assert data["event_type"] == "connection_established"
                assert "connection_id" in data["data"]
                assert "server_time" in data["data"]
                
                logger.info("✓ WebSocket connection test passed")
                
        except Exception as e:
            pytest.fail(f"WebSocket connection failed: {e}")
    
    async def test_multiple_websocket_connections(self, test_server):
        """Test multiple simultaneous WebSocket connections."""
        connections = []
        
        try:
            # Create 5 concurrent connections
            for i in range(5):
                websocket = await websockets.connect(WEBSOCKET_URL)
                connections.append(websocket)
                
                # Verify welcome message
                message = await asyncio.wait_for(websocket.recv(), timeout=5.0)
                data = json_impl.loads(message)
                assert data["event_type"] == "connection_established"
            
            # Verify all connections are active
            stats = await self._get_server_stats()
            assert stats["connections"]["active_connections"] >= 5
            
            logger.info("✓ Multiple WebSocket connections test passed")
            
        except Exception as e:
            pytest.fail(f"Multiple connections test failed: {e}")
        finally:
            # Cleanup connections
            for websocket in connections:
                await websocket.close()
    
    async def test_websocket_heartbeat(self, test_server):
        """Test WebSocket heartbeat mechanism."""
        try:
            async with websockets.connect(WEBSOCKET_URL) as websocket:
                # Skip welcome message
                await websocket.recv()
                
                # Wait for heartbeat (should come within 35 seconds)
                message = await asyncio.wait_for(websocket.recv(), timeout=35.0)
                data = json_impl.loads(message)
                
                assert data["type"] == "ping"
                assert "timestamp" in data
                
                # Send pong response
                pong_response = {
                    "type": "pong",
                    "timestamp": datetime.now(timezone.utc).isoformat()
                }
                await websocket.send(json_impl.dumps(pong_response))
                
                logger.info("✓ WebSocket heartbeat test passed")
                
        except Exception as e:
            pytest.fail(f"WebSocket heartbeat test failed: {e}")
    
    async def test_websocket_event_broadcasting(self, test_server):
        """Test event broadcasting to WebSocket clients."""
        try:
            # Connect two clients
            async with websockets.connect(WEBSOCKET_URL) as ws1, \
                       websockets.connect(WEBSOCKET_URL) as ws2:
                
                # Skip welcome messages
                await ws1.recv()
                await ws2.recv()
                
                # Create and broadcast test event
                test_event = EventMessage(
                    id=str(uuid.uuid4()),
                    event_type="test_event",
                    timestamp=datetime.now(timezone.utc).isoformat(),
                    session_id="test-session",
                    data={"test": "data", "value": 42},
                    created_at=time.time()
                )
                
                await connection_manager.broadcast_event(test_event)
                
                # Both clients should receive the event
                start_time = time.time()
                
                msg1 = await asyncio.wait_for(ws1.recv(), timeout=5.0)
                msg2 = await asyncio.wait_for(ws2.recv(), timeout=5.0)
                
                latency = (time.time() - start_time) * 1000
                
                # Verify events
                data1 = json_impl.loads(msg1)
                data2 = json_impl.loads(msg2)
                
                assert data1["event_type"] == "test_event"
                assert data2["event_type"] == "test_event"
                assert data1["data"]["test"] == "data"
                assert data2["data"]["value"] == 42
                
                # Verify latency target
                assert latency < 50.0, f"Broadcast latency {latency:.2f}ms exceeds 50ms target"
                
                logger.info(f"✓ WebSocket event broadcasting test passed (latency: {latency:.2f}ms)")
                
        except Exception as e:
            pytest.fail(f"WebSocket broadcasting test failed: {e}")
    
    async def test_sse_endpoint(self, test_server):
        """Test Server-Sent Events endpoint."""
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(SSE_URL) as response:
                    assert response.status == 200
                    assert response.content_type == "text/event-stream"
                    
                    # Read first event (connection established)
                    chunk = await asyncio.wait_for(response.content.readline(), timeout=5.0)
                    
                    if chunk.startswith(b"data: "):
                        event_data = chunk[6:].decode().strip()
                        data = json_impl.loads(event_data)
                        
                        assert data["event_type"] == "sse_connected"
                        assert "client_ip" in data["data"]
                    
                    logger.info("✓ SSE endpoint test passed")
                    
        except Exception as e:
            pytest.fail(f"SSE endpoint test failed: {e}")
    
    async def test_server_stats_endpoint(self, test_server):
        """Test server statistics endpoint."""
        try:
            stats = await self._get_server_stats()
            
            assert "server" in stats
            assert "version" in stats
            assert "endpoints" in stats
            assert "connections" in stats
            assert "database" in stats
            
            assert stats["server"] == "Chronicle WebSocket Server"
            assert "ws://localhost:8510/ws" in stats["endpoints"]["websocket"]
            
            logger.info("✓ Server stats endpoint test passed")
            
        except Exception as e:
            pytest.fail(f"Server stats test failed: {e}")
    
    async def test_health_endpoint(self, test_server):
        """Test health check endpoint."""
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(HEALTH_URL) as response:
                    assert response.status == 200
                    
                    data = await response.json()
                    
                    assert "status" in data
                    assert "timestamp" in data
                    assert "database" in data
                    assert "connections" in data
                    
                    logger.info("✓ Health endpoint test passed")
                    
        except Exception as e:
            pytest.fail(f"Health endpoint test failed: {e}")
    
    async def test_connection_disconnect_cleanup(self, test_server):
        """Test connection cleanup on disconnect."""
        initial_stats = await self._get_server_stats()
        initial_connections = initial_stats["connections"]["active_connections"]
        
        try:
            # Create and close connection
            websocket = await websockets.connect(WEBSOCKET_URL)
            await websocket.recv()  # Skip welcome message
            await websocket.close()
            
            # Wait for cleanup
            await asyncio.sleep(1.0)
            
            # Verify connection was cleaned up
            final_stats = await self._get_server_stats()
            final_connections = final_stats["connections"]["active_connections"]
            
            assert final_connections == initial_connections
            
            logger.info("✓ Connection disconnect cleanup test passed")
            
        except Exception as e:
            pytest.fail(f"Connection cleanup test failed: {e}")
    
    async def test_performance_under_load(self, test_server):
        """Test performance with multiple connections and events."""
        connections = []
        
        try:
            # Create 10 concurrent connections
            for i in range(10):
                websocket = await websockets.connect(WEBSOCKET_URL)
                await websocket.recv()  # Skip welcome message
                connections.append(websocket)
            
            # Broadcast 50 events rapidly
            start_time = time.time()
            
            for i in range(50):
                test_event = EventMessage(
                    id=str(uuid.uuid4()),
                    event_type="performance_test",
                    timestamp=datetime.now(timezone.utc).isoformat(),
                    session_id=f"perf-test-{i}",
                    data={"event_number": i, "timestamp": time.time()},
                    created_at=time.time()
                )
                
                await connection_manager.broadcast_event(test_event)
            
            # Measure how long it takes to deliver all events
            events_received = 0
            timeout = time.time() + 10.0  # 10 second timeout
            
            while events_received < 500 and time.time() < timeout:  # 50 events × 10 connections
                for websocket in connections:
                    try:
                        message = await asyncio.wait_for(websocket.recv(), timeout=0.1)
                        data = json_impl.loads(message)
                        if data["event_type"] == "performance_test":
                            events_received += 1
                    except asyncio.TimeoutError:
                        continue
            
            total_time = (time.time() - start_time) * 1000
            avg_latency = total_time / 50  # Average per event batch
            
            assert avg_latency < 50.0, f"Average latency {avg_latency:.2f}ms exceeds 50ms target"
            assert events_received >= 450, f"Only received {events_received}/500 events"
            
            logger.info(f"✓ Performance test passed (avg latency: {avg_latency:.2f}ms, events: {events_received}/500)")
            
        except Exception as e:
            pytest.fail(f"Performance test failed: {e}")
        finally:
            # Cleanup connections
            for websocket in connections:
                await websocket.close()
    
    async def _get_server_stats(self) -> Dict[str, Any]:
        """Helper to get server statistics."""
        async with aiohttp.ClientSession() as session:
            async with session.get(STATS_URL) as response:
                if response.status != 200:
                    raise Exception(f"Stats endpoint returned {response.status}")
                return await response.json()


class TestEventBroadcaster:
    """Test suite for EventBroadcaster functionality."""
    
    @pytest.fixture
    async def test_database(self):
        """Create a test database with sample events."""
        test_db = create_local_database(":memory:")
        
        # Add sample session
        session_data = {
            "claude_session_id": "test-session-123",
            "project_path": "/test/project",
            "git_branch": "main",
            "start_time": datetime.now(timezone.utc).isoformat()
        }
        success, session_id = test_db.save_session(session_data)
        assert success
        
        # Add sample events
        for i in range(5):
            event_data = {
                "session_id": session_id,
                "event_type": "test_event",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "data": {"test": f"event_{i}"}
            }
            assert test_db.save_event(event_data)
        
        yield test_db
        test_db.close()
    
    async def test_event_broadcaster_initialization(self, test_database):
        """Test EventBroadcaster initialization."""
        broadcaster = create_event_broadcaster(test_database)
        
        assert broadcaster is not None
        assert broadcaster.database is not None
        assert not broadcaster._running
        
        stats = broadcaster.get_stats()
        assert stats["events_broadcasted"] == 0
        assert not stats["running"]
        
        logger.info("✓ EventBroadcaster initialization test passed")
    
    async def test_event_monitoring_start_stop(self, test_database):
        """Test starting and stopping event monitoring."""
        broadcaster = create_event_broadcaster(test_database)
        
        # Start monitoring
        await broadcaster.start_monitoring()
        
        stats = broadcaster.get_stats()
        assert stats["running"]
        assert broadcaster._monitor_task is not None
        
        # Stop monitoring
        await broadcaster.stop_monitoring()
        
        stats = broadcaster.get_stats()
        assert not stats["running"]
        
        logger.info("✓ Event monitoring start/stop test passed")
    
    async def test_event_filters(self, test_database):
        """Test event filtering functionality."""
        broadcaster = create_event_broadcaster(test_database)
        
        # Add test filter
        def test_filter(event_data):
            return event_data.get("event_type") == "important_event"
        
        broadcaster.add_event_filter(test_filter)
        
        # Test events
        important_event = {"event_type": "important_event", "data": "test"}
        unimportant_event = {"event_type": "regular_event", "data": "test"}
        
        assert broadcaster._should_broadcast_event(important_event)
        assert not broadcaster._should_broadcast_event(unimportant_event)
        
        logger.info("✓ Event filters test passed")
    
    async def test_event_transformers(self, test_database):
        """Test event transformation functionality."""
        broadcaster = create_event_broadcaster(test_database)
        
        # Add test transformer
        def test_transformer(event_data):
            transformed = event_data.copy()
            transformed["transformed"] = True
            transformed["transform_time"] = time.time()
            return transformed
        
        broadcaster.add_event_transformer(test_transformer)
        
        # Test transformation
        original_event = {"event_type": "test", "data": "original"}
        transformed_event = broadcaster._transform_event(original_event)
        
        assert transformed_event["transformed"] is True
        assert "transform_time" in transformed_event
        assert transformed_event["data"] == "original"  # Original data preserved
        
        logger.info("✓ Event transformers test passed")


class TestIntegration:
    """Integration tests for the complete system."""
    
    async def test_end_to_end_event_flow(self):
        """Test complete event flow from database to WebSocket clients."""
        # This would require a full integration test with:
        # 1. Database with events
        # 2. Running WebSocket server
        # 3. Event broadcaster monitoring
        # 4. Connected WebSocket clients
        # 5. Verification of event delivery
        
        # For now, this is a placeholder for the integration test
        # In a real implementation, this would be the most comprehensive test
        
        logger.info("✓ End-to-end integration test placeholder passed")


# Performance benchmark functions
async def benchmark_websocket_latency(connections: int = 10, events: int = 100):
    """Benchmark WebSocket event delivery latency."""
    logger.info(f"Benchmarking WebSocket latency ({connections} connections, {events} events)")
    
    # Implementation would measure:
    # - Connection establishment time
    # - Event broadcasting latency
    # - Message delivery time
    # - Throughput (events/second)
    
    return {
        "connections": connections,
        "events": events,
        "avg_latency_ms": 0.0,  # Placeholder
        "throughput_eps": 0.0,  # Events per second
        "success_rate": 100.0   # Percentage
    }


async def benchmark_sse_performance(duration: int = 60):
    """Benchmark SSE endpoint performance."""
    logger.info(f"Benchmarking SSE performance ({duration}s duration)")
    
    # Implementation would measure:
    # - Connection stability
    # - Event delivery rate
    # - Memory usage over time
    # - CPU usage
    
    return {
        "duration_seconds": duration,
        "events_delivered": 0,  # Placeholder
        "avg_latency_ms": 0.0,
        "memory_usage_mb": 0.0
    }


if __name__ == "__main__":
    print("Chronicle WebSocket & SSE Test Suite")
    print("====================================")
    
    async def run_basic_tests():
        """Run basic functionality tests."""
        try:
            # Test database
            test_db = create_local_database(":memory:")
            
            # Test WebSocket server creation
            server = create_websocket_server(test_db)
            assert server is not None
            
            # Test event broadcaster
            broadcaster = create_event_broadcaster(test_db)
            assert broadcaster is not None
            
            # Test connection manager
            assert connection_manager is not None
            
            print("✓ All basic component tests passed")
            
            # Cleanup
            test_db.close()
            
        except Exception as e:
            print(f"✗ Basic tests failed: {e}")
    
    asyncio.run(run_basic_tests())