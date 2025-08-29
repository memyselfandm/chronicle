#!/usr/bin/env python3
"""
Chronicle FastAPI Server Tests
==============================

Comprehensive test suite for the Chronicle FastAPI server, validating
server startup, endpoints, error handling, and integration with database
and WebSocket components.

Author: C-Codey aka curl Stevens aka SWE-40
Port: 8510 (The Town stays tested!)
"""

import asyncio
import json
import pytest
import time
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import Mock, patch, AsyncMock
import tempfile
import sqlite3

# FastAPI testing imports
try:
    from fastapi.testclient import TestClient
    from httpx import AsyncClient
    import pytest_asyncio
except ImportError as e:
    print(f"Missing test dependencies: {e}")
    print("Install with: pip install pytest pytest-asyncio httpx")
    exit(1)

# Local imports
import sys
import os
sys.path.append(os.path.dirname(__file__))

from database import LocalDatabase, create_local_database
from main import app, SERVER_PORT, SERVER_HOST, API_VERSION


class TestChronicleServer:
    """Test suite for Chronicle FastAPI server."""
    
    @pytest.fixture
    def client(self):
        """Create test client for FastAPI app."""
        return TestClient(app)
    
    @pytest.fixture
    async def async_client(self):
        """Create async test client for FastAPI app."""
        async with AsyncClient(app=app, base_url="http://test") as ac:
            yield ac
    
    @pytest.fixture
    def temp_database(self):
        """Create temporary database for testing."""
        with tempfile.NamedTemporaryFile(suffix='.db', delete=False) as tmp:
            db_path = tmp.name
        
        db = LocalDatabase(db_path=db_path)
        yield db
        
        # Cleanup
        db.close()
        Path(db_path).unlink(missing_ok=True)
    
    def test_health_check_endpoint(self, client):
        """Test health check endpoint."""
        response = client.get("/health")
        
        assert response.status_code in [200, 503]  # May be unhealthy if components not initialized
        
        data = response.json()
        assert "status" in data
        assert "version" in data
        assert "timestamp" in data
        assert data["version"] == API_VERSION
    
    def test_server_info_endpoint(self, client):
        """Test server info endpoint."""
        response = client.get("/api/info")
        
        # Should return 200 even if components aren't fully initialized
        assert response.status_code == 200
        
        data = response.json()
        assert data["server"] == "Chronicle FastAPI Server"
        assert data["version"] == API_VERSION
        assert data["port"] == SERVER_PORT
        assert data["host"] == SERVER_HOST
        
        # Check endpoints structure
        assert "endpoints" in data
        endpoints = data["endpoints"]
        assert "health" in endpoints
        assert "websocket" in endpoints
        assert "api_info" in endpoints
    
    def test_statistics_endpoint(self, client):
        """Test statistics endpoint."""
        response = client.get("/api/stats")
        
        assert response.status_code == 200
        
        data = response.json()
        assert "server" in data
        assert "database" in data
        assert "websocket" in data
        assert "event_broadcaster" in data
    
    def test_sessions_endpoint_empty(self, client):
        """Test sessions endpoint when no sessions exist."""
        response = client.get("/api/sessions")
        
        # Should return 200 with empty sessions or 503 if database not available
        assert response.status_code in [200, 503]
        
        if response.status_code == 200:
            data = response.json()
            assert "sessions" in data
            assert "count" in data
            assert "limit" in data
    
    def test_cors_headers(self, client):
        """Test CORS headers are properly set."""
        response = client.options("/health")
        
        # Check CORS headers
        assert "access-control-allow-origin" in response.headers
        assert "access-control-allow-methods" in response.headers
    
    def test_error_handling_middleware(self, client):
        """Test error handling middleware."""
        # Request non-existent endpoint
        response = client.get("/nonexistent-endpoint")
        
        assert response.status_code == 404
    
    def test_session_details_not_found(self, client):
        """Test session details endpoint with non-existent session."""
        response = client.get("/api/sessions/nonexistent-session-id")
        
        # Should return 404 or 503 if database not available
        assert response.status_code in [404, 503]
    
    def test_session_events_endpoint(self, client):
        """Test session events endpoint."""
        response = client.get("/api/sessions/test-session/events")
        
        # Should return 200 with empty events or 503 if database not available
        assert response.status_code in [200, 503]


class TestServerStartupShutdown:
    """Test server startup and shutdown lifecycle."""
    
    @pytest.fixture
    def mock_database(self):
        """Mock database for testing."""
        mock_db = Mock(spec=LocalDatabase)
        mock_db.test_connection.return_value = True
        mock_db.get_performance_stats.return_value = {
            "session_count": 0,
            "event_count": 0,
            "db_size_mb": 0.1
        }
        mock_db.db_path = Path("/tmp/test.db")
        return mock_db
    
    @pytest.fixture
    def mock_event_broadcaster(self):
        """Mock event broadcaster for testing."""
        mock_broadcaster = Mock()
        mock_broadcaster._running = True
        mock_broadcaster.start_monitoring = AsyncMock()
        mock_broadcaster.stop_monitoring = AsyncMock()
        mock_broadcaster.get_stats.return_value = {
            "running": True,
            "events_broadcasted": 0,
            "avg_latency_ms": 0.0
        }
        return mock_broadcaster
    
    @pytest.mark.asyncio
    async def test_lifespan_startup_success(self, mock_database, mock_event_broadcaster):
        """Test successful server startup."""
        with patch('main.create_local_database', return_value=mock_database):
            with patch('main.create_event_broadcaster', return_value=mock_event_broadcaster):
                with patch('main.connection_manager.startup', new_callable=AsyncMock):
                    # Test lifespan startup
                    async with AsyncClient(app=app, base_url="http://test") as client:
                        response = await client.get("/health")
                        assert response.status_code in [200, 503]
    
    @pytest.mark.asyncio
    async def test_lifespan_database_failure(self):
        """Test server startup with database failure."""
        mock_db = Mock(spec=LocalDatabase)
        mock_db.test_connection.return_value = False
        
        with patch('main.create_local_database', return_value=mock_db):
            with pytest.raises(Exception):
                # Should raise exception on database failure
                async with AsyncClient(app=app, base_url="http://test"):
                    pass


class TestDatabaseIntegration:
    """Test database integration with server."""
    
    def test_database_session_creation(self):
        """Test database session creation."""
        with tempfile.NamedTemporaryFile(suffix='.db', delete=False) as tmp:
            db_path = tmp.name
        
        try:
            db = LocalDatabase(db_path=db_path)
            
            # Test session save
            session_data = {
                "claude_session_id": "test-session-123",
                "project_path": "/test/project",
                "git_branch": "main",
                "start_time": datetime.now(timezone.utc).isoformat()
            }
            
            success, session_id = db.save_session(session_data)
            assert success
            assert session_id
            
            # Test session retrieval
            retrieved_session = db.get_session(session_id)
            assert retrieved_session
            assert retrieved_session["claude_session_id"] == "test-session-123"
            
            db.close()
            
        finally:
            Path(db_path).unlink(missing_ok=True)
    
    def test_database_event_creation(self):
        """Test database event creation."""
        with tempfile.NamedTemporaryFile(suffix='.db', delete=False) as tmp:
            db_path = tmp.name
        
        try:
            db = LocalDatabase(db_path=db_path)
            
            # First create a session
            session_data = {
                "claude_session_id": "test-session-456",
                "start_time": datetime.now(timezone.utc).isoformat()
            }
            success, session_id = db.save_session(session_data)
            assert success
            
            # Test event save
            event_data = {
                "session_id": session_id,
                "event_type": "test_event",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "data": {"test": "data"}
            }
            
            start_time = time.time()
            success = db.save_event(event_data)
            duration = (time.time() - start_time) * 1000
            
            assert success
            assert duration < 100  # Should be fast
            
            # Test event retrieval
            events = db.get_session_events(session_id)
            assert len(events) > 0
            assert events[0]["event_type"] == "test_event"
            
            db.close()
            
        finally:
            Path(db_path).unlink(missing_ok=True)


class TestPerformanceMetrics:
    """Test performance monitoring and metrics."""
    
    def test_response_time_headers(self):
        """Test that performance headers are added to responses."""
        client = TestClient(app)
        
        response = client.get("/health")
        
        # Should have performance headers from middleware
        assert "x-process-time" in response.headers
        assert "x-server-version" in response.headers
        assert response.headers["x-server-version"] == API_VERSION
    
    def test_database_performance_stats(self):
        """Test database performance statistics."""
        with tempfile.NamedTemporaryFile(suffix='.db', delete=False) as tmp:
            db_path = tmp.name
        
        try:
            db = LocalDatabase(db_path=db_path)
            
            # Perform some operations to generate stats
            session_data = {
                "claude_session_id": "perf-test-session",
                "start_time": datetime.now(timezone.utc).isoformat()
            }
            success, session_id = db.save_session(session_data)
            assert success
            
            # Get performance stats
            stats = db.get_performance_stats()
            
            assert "operations_count" in stats
            assert "avg_operation_time_ms" in stats
            assert "db_size_bytes" in stats
            assert "session_count" in stats
            assert "event_count" in stats
            
            db.close()
            
        finally:
            Path(db_path).unlink(missing_ok=True)


if __name__ == "__main__":
    # Run tests if executed directly
    print("Chronicle FastAPI Server Tests")
    print("==============================")
    
    # Run pytest
    exit_code = pytest.main([
        __file__,
        "-v",
        "--tb=short",
        "--durations=5"
    ])
    
    if exit_code == 0:
        print("\n✅ All tests passed! Server is ready to slap!")
    else:
        print(f"\n❌ Some tests failed (exit code: {exit_code})")
    
    sys.exit(exit_code)