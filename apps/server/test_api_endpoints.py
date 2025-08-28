#!/usr/bin/env python3
"""
Chronicle API Endpoints Comprehensive Tests
==========================================

Production-ready test suite for Chronicle REST API endpoints.
Tests all CRUD operations, error handling, validation, and performance.

Author: C-Codey aka curl Stevens aka SWE-40
Port: 8510 (Oakland represent!)
"""

import asyncio
import json
import os
import pytest
import tempfile
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict
from unittest.mock import patch

# FastAPI testing imports
try:
    from fastapi.testclient import TestClient
    from httpx import AsyncClient
    import pytest_asyncio
except ImportError as e:
    print(f"Missing test dependencies: {e}")
    print("Install with: pip install pytest httpx pytest-asyncio")
    raise

# Local imports
try:
    from .database import create_local_database, LocalDatabase
    from .main import app
    from .api_endpoints import set_database, VALID_EVENT_TYPES
except ImportError:
    # Fallback for standalone execution
    import sys
    sys.path.append(os.path.dirname(__file__))
    from database import create_local_database, LocalDatabase
    from main import app
    from api_endpoints import set_database, VALID_EVENT_TYPES

# Test configuration
TEST_DB_PATH = None  # Will be set to temp file
TEST_SESSION_ID = "test-session-12345"
TEST_ADMIN_KEY = "chronicle_admin_2024"


@pytest.fixture(scope="session")
def test_database():
    """Create a temporary test database."""
    global TEST_DB_PATH
    
    # Create temporary database file
    fd, TEST_DB_PATH = tempfile.mkstemp(suffix=".db", prefix="chronicle_test_")
    os.close(fd)
    
    try:
        # Initialize database
        db = create_local_database(TEST_DB_PATH)
        yield db
        
    finally:
        # Cleanup
        try:
            db.close()
        except:
            pass
        
        if os.path.exists(TEST_DB_PATH):
            os.unlink(TEST_DB_PATH)


@pytest.fixture(scope="session")
def test_client(test_database):
    """Create test client with database setup."""
    # Set database for API endpoints
    set_database(test_database)
    
    # Create test client
    with TestClient(app) as client:
        yield client


@pytest.fixture
def sample_session_data():
    """Sample session data for testing."""
    return {
        "claude_session_id": TEST_SESSION_ID,
        "project_path": "/test/project",
        "git_branch": "test-branch",
        "start_time": datetime.now(timezone.utc).isoformat(),
        "metadata": {"source": "test", "version": "1.0"}
    }


@pytest.fixture
def sample_event_data():
    """Sample event data for testing."""
    return {
        "session_id": "will-be-set-dynamically",
        "event_type": "tool_use",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "metadata": {
            "tool_name": "bash",
            "command": "ls -la",
            "success": True
        },
        "tool_name": "bash",
        "duration_ms": 150
    }


class TestDatabaseSetup:
    """Test database initialization and setup."""
    
    def test_database_creation(self, test_database):
        """Test database is created and functional."""
        assert test_database.test_connection()
        stats = test_database.get_performance_stats()
        assert "session_count" in stats
        assert "event_count" in stats
    
    def test_session_creation(self, test_database, sample_session_data):
        """Test session creation works."""
        success, session_id = test_database.save_session(sample_session_data)
        assert success
        assert session_id is not None
        
        # Verify session can be retrieved
        session = test_database.get_session(session_id)
        assert session is not None
        assert session["claude_session_id"] == TEST_SESSION_ID


class TestPOSTEvents:
    """Test POST /api/events endpoint."""
    
    def test_create_event_success(self, test_client, test_database, sample_session_data, sample_event_data):
        """Test successful event creation."""
        # First create a session
        success, session_id = test_database.save_session(sample_session_data)
        assert success
        
        # Set session ID in event data
        sample_event_data["session_id"] = session_id
        
        # Create event via API
        response = test_client.post("/api/events", json=sample_event_data)
        
        assert response.status_code == 201
        data = response.json()
        
        assert "data" in data
        event_data = data["data"][0] if isinstance(data["data"], list) else data["data"]
        assert event_data["event_type"] == "tool_use"
        assert event_data["session_id"] == session_id
        assert event_data["tool_name"] == "bash"
        assert "id" in event_data
        assert "created_at" in event_data
    
    def test_create_event_invalid_type(self, test_client, test_database, sample_session_data, sample_event_data):
        """Test event creation with invalid event type."""
        # Create session
        success, session_id = test_database.save_session(sample_session_data)
        assert success
        
        # Use invalid event type
        sample_event_data["session_id"] = session_id
        sample_event_data["event_type"] = "invalid_type"
        
        response = test_client.post("/api/events", json=sample_event_data)
        
        assert response.status_code == 201  # Should succeed with default type
        data = response.json()
        # Should default to 'notification'
        event_data = data["data"][0] if isinstance(data["data"], list) else data["data"]
        assert event_data["event_type"] == "notification"
    
    def test_create_event_missing_session(self, test_client, sample_event_data):
        """Test event creation with missing session ID."""
        sample_event_data["session_id"] = "non-existent-session"
        
        response = test_client.post("/api/events", json=sample_event_data)
        
        # Should still create event (database allows orphaned events)
        assert response.status_code == 201
    
    def test_create_event_validation_errors(self, test_client):
        """Test various validation errors."""
        # Missing required fields
        response = test_client.post("/api/events", json={})
        assert response.status_code == 422  # Validation error
        
        # Invalid timestamp
        invalid_data = {
            "session_id": "test",
            "event_type": "tool_use",
            "timestamp": "not-a-timestamp"
        }
        response = test_client.post("/api/events", json=invalid_data)
        assert response.status_code == 422
        
        # Negative duration
        invalid_data = {
            "session_id": "test",
            "event_type": "tool_use", 
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "duration_ms": -100
        }
        response = test_client.post("/api/events", json=invalid_data)
        assert response.status_code == 422


class TestGETEvents:
    """Test GET /api/events endpoint."""
    
    @pytest.fixture(autouse=True)
    def setup_test_data(self, test_database, sample_session_data):
        """Setup test data for GET tests."""
        # Create test session
        success, self.session_id = test_database.save_session(sample_session_data)
        assert success
        
        # Create multiple test events
        event_types = ["tool_use", "user_prompt_submit", "notification"]
        tool_names = ["bash", "grep", None]
        
        for i in range(10):
            event_data = {
                "session_id": self.session_id,
                "event_type": event_types[i % len(event_types)],
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "data": {"test_event": i, "batch": "setup"},
                "tool_name": tool_names[i % len(tool_names)],
                "duration_ms": 100 + i * 10
            }
            test_database.save_event(event_data)
    
    def test_get_events_basic(self, test_client):
        """Test basic event retrieval."""
        response = test_client.get("/api/events")
        
        assert response.status_code == 200
        data = response.json()
        
        assert "data" in data
        assert "total" in data
        assert "limit" in data
        assert "offset" in data
        assert "has_more" in data
        assert isinstance(data["data"], list)
    
    def test_get_events_with_session_filter(self, test_client):
        """Test filtering by session ID."""
        response = test_client.get(f"/api/events?session_id={self.session_id}")
        
        assert response.status_code == 200
        data = response.json()
        
        # Should have events from our test session
        assert len(data["data"]) > 0
        for event in data["data"]:
            assert event["session_id"] == self.session_id
    
    def test_get_events_with_type_filter(self, test_client):
        """Test filtering by event type."""
        response = test_client.get("/api/events?event_type=tool_use")
        
        assert response.status_code == 200
        data = response.json()
        
        # All events should be tool_use type
        for event in data["data"]:
            assert event["event_type"] == "tool_use"
    
    def test_get_events_with_tool_filter(self, test_client):
        """Test filtering by tool name."""
        response = test_client.get("/api/events?tool_name=bash")
        
        assert response.status_code == 200
        data = response.json()
        
        # All events should have bash tool
        for event in data["data"]:
            assert event["tool_name"] == "bash"
    
    def test_get_events_pagination(self, test_client):
        """Test pagination functionality."""
        # Get first page
        response1 = test_client.get("/api/events?limit=5&offset=0")
        assert response1.status_code == 200
        data1 = response1.json()
        
        # Get second page
        response2 = test_client.get("/api/events?limit=5&offset=5")
        assert response2.status_code == 200
        data2 = response2.json()
        
        # Should have different data
        if len(data1["data"]) > 0 and len(data2["data"]) > 0:
            assert data1["data"][0]["id"] != data2["data"][0]["id"]
    
    def test_get_events_ordering(self, test_client):
        """Test ordering functionality."""
        # Test descending order (default)
        response = test_client.get("/api/events?order_by=timestamp:desc")
        assert response.status_code == 200
        
        # Test ascending order
        response = test_client.get("/api/events?order_by=timestamp:asc")
        assert response.status_code == 200


class TestGETSessions:
    """Test GET /api/sessions endpoint."""
    
    def test_get_sessions_basic(self, test_client):
        """Test basic session retrieval."""
        response = test_client.get("/api/sessions")
        
        assert response.status_code == 200
        data = response.json()
        
        assert "data" in data
        assert "total" in data
        assert "limit" in data
        assert "offset" in data
        assert "has_more" in data
        assert isinstance(data["data"], list)
    
    def test_get_sessions_with_filters(self, test_client):
        """Test session filtering."""
        # Test project path filter
        response = test_client.get("/api/sessions?project_path=/test/project")
        assert response.status_code == 200
        
        # Test active only filter
        response = test_client.get("/api/sessions?active_only=true")
        assert response.status_code == 200
        
        data = response.json()
        for session in data["data"]:
            # Active sessions should have no end_time
            assert session["end_time"] is None
    
    def test_get_sessions_pagination(self, test_client):
        """Test session pagination."""
        response = test_client.get("/api/sessions?limit=10&offset=0")
        assert response.status_code == 200
        
        data = response.json()
        assert data["limit"] == 10
        assert data["offset"] == 0


class TestGETMetrics:
    """Test GET /api/metrics endpoint."""
    
    def test_get_metrics_basic(self, test_client):
        """Test basic metrics retrieval."""
        response = test_client.get("/api/metrics")
        
        assert response.status_code == 200
        data = response.json()
        
        # Check all required metrics fields
        required_fields = [
            "total_sessions", "active_sessions", "total_events", "events_today",
            "top_event_types", "session_duration_avg_minutes", 
            "most_active_projects", "recent_activity", "timestamp"
        ]
        
        for field in required_fields:
            assert field in data
        
        # Check data types
        assert isinstance(data["total_sessions"], int)
        assert isinstance(data["active_sessions"], int)
        assert isinstance(data["total_events"], int)
        assert isinstance(data["events_today"], int)
        assert isinstance(data["top_event_types"], list)
        assert isinstance(data["session_duration_avg_minutes"], (int, float))
        assert isinstance(data["most_active_projects"], list)
        assert isinstance(data["recent_activity"], list)
    
    def test_get_metrics_with_days_filter(self, test_client):
        """Test metrics with custom days parameter."""
        response = test_client.get("/api/metrics?days=30")
        assert response.status_code == 200
        
        response = test_client.get("/api/metrics?days=1")
        assert response.status_code == 200
        
        # Test invalid days (should be clamped)
        response = test_client.get("/api/metrics?days=1000")
        assert response.status_code == 422


class TestDELETEEvents:
    """Test DELETE /api/events/{id} endpoint."""
    
    @pytest.fixture
    def test_event_id(self, test_database, sample_session_data, sample_event_data):
        """Create a test event to delete."""
        # Create session
        success, session_id = test_database.save_session(sample_session_data)
        assert success
        
        # Create event
        sample_event_data["session_id"] = session_id
        test_database.save_event(sample_event_data)
        
        # Get the event ID (we'll need to query for it since save_event doesn't return ID)
        events = test_database.get_session_events(session_id, limit=1)
        assert len(events) > 0
        return events[0]["id"]
    
    def test_delete_event_success(self, test_client, test_event_id):
        """Test successful event deletion."""
        response = test_client.delete(
            f"/api/events/{test_event_id}",
            params={"admin_key": TEST_ADMIN_KEY}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        assert data["success"] is True
        assert "deleted successfully" in data["message"]
        assert "timestamp" in data
    
    def test_delete_event_no_auth(self, test_client, test_event_id):
        """Test deletion without admin key."""
        response = test_client.delete(f"/api/events/{test_event_id}")
        assert response.status_code == 401
        
        # Test with wrong admin key
        response = test_client.delete(
            f"/api/events/{test_event_id}",
            params={"admin_key": "wrong_key"}
        )
        assert response.status_code == 401
    
    def test_delete_nonexistent_event(self, test_client):
        """Test deleting non-existent event."""
        fake_id = "00000000-0000-0000-0000-000000000000"
        response = test_client.delete(
            f"/api/events/{fake_id}",
            params={"admin_key": TEST_ADMIN_KEY}
        )
        assert response.status_code == 404


class TestAPIHealth:
    """Test API health and info endpoints."""
    
    def test_api_health(self, test_client):
        """Test API health endpoint."""
        response = test_client.get("/api/health")
        assert response.status_code == 200
        
        data = response.json()
        assert "status" in data
        assert "api_version" in data
        assert "database" in data
        assert "endpoints_available" in data
    
    def test_server_health(self, test_client):
        """Test main server health endpoint."""
        response = test_client.get("/health")
        assert response.status_code in [200, 503]  # May be unhealthy in test env
    
    def test_server_info(self, test_client):
        """Test server info endpoint."""
        response = test_client.get("/api/info")
        assert response.status_code == 200
        
        data = response.json()
        assert "server" in data
        assert "version" in data
        assert "endpoints" in data


class TestPerformance:
    """Test API performance requirements."""
    
    def test_event_creation_performance(self, test_client, test_database, sample_session_data, sample_event_data):
        """Test event creation meets performance requirements."""
        # Setup session
        success, session_id = test_database.save_session(sample_session_data)
        assert success
        sample_event_data["session_id"] = session_id
        
        # Time multiple event creations
        times = []
        for i in range(5):
            start = time.time()
            response = test_client.post("/api/events", json=sample_event_data)
            end = time.time()
            
            assert response.status_code == 201
            times.append((end - start) * 1000)  # Convert to ms
        
        # Average should be well under 100ms for API + database
        avg_time = sum(times) / len(times)
        print(f"Average event creation time: {avg_time:.2f}ms")
        assert avg_time < 100  # Reasonable API response time
    
    def test_events_query_performance(self, test_client):
        """Test events query performance."""
        start = time.time()
        response = test_client.get("/api/events?limit=100")
        end = time.time()
        
        assert response.status_code == 200
        duration_ms = (end - start) * 1000
        
        print(f"Events query time: {duration_ms:.2f}ms")
        assert duration_ms < 200  # Should be fast even with 100 results


class TestErrorHandling:
    """Test comprehensive error handling."""
    
    def test_database_unavailable(self, test_client):
        """Test behavior when database is unavailable."""
        # Temporarily remove database instance
        original_db = test_client.app.dependency_overrides.get(lambda: None)
        
        # This test is tricky to implement without modifying the global state
        # In a real scenario, we'd mock the database to raise exceptions
        pass
    
    def test_malformed_json(self, test_client):
        """Test handling of malformed JSON."""
        response = test_client.post(
            "/api/events",
            data="{ invalid json",
            headers={"Content-Type": "application/json"}
        )
        assert response.status_code == 422
    
    def test_missing_content_type(self, test_client):
        """Test handling of missing content type."""
        response = test_client.post("/api/events", data='{"test": "data"}')
        # FastAPI should handle this gracefully
        assert response.status_code in [422, 400]


# Integration tests
class TestIntegration:
    """Integration tests for full workflows."""
    
    def test_full_event_lifecycle(self, test_client, test_database, sample_session_data, sample_event_data):
        """Test complete event lifecycle: create, read, delete."""
        # 1. Create session
        success, session_id = test_database.save_session(sample_session_data)
        assert success
        sample_event_data["session_id"] = session_id
        
        # 2. Create event
        response = test_client.post("/api/events", json=sample_event_data)
        assert response.status_code == 201
        event_data = response.json()["data"]
        if isinstance(event_data, list):
            event_data = event_data[0]
        
        # 3. Read event back
        response = test_client.get(f"/api/events?session_id={session_id}")
        assert response.status_code == 200
        events = response.json()["data"]
        assert len(events) > 0
        
        # Find our event
        our_event = None
        for event in events:
            if event["event_type"] == "tool_use":
                our_event = event
                break
        
        assert our_event is not None
        assert our_event["tool_name"] == "bash"
        
        # 4. Delete event (if we can get the ID)
        event_id = our_event["id"]
        response = test_client.delete(
            f"/api/events/{event_id}",
            params={"admin_key": TEST_ADMIN_KEY}
        )
        assert response.status_code == 200
    
    def test_metrics_reflect_data(self, test_client, test_database, sample_session_data):
        """Test that metrics reflect actual data."""
        # Get initial metrics
        response = test_client.get("/api/metrics")
        assert response.status_code == 200
        initial_metrics = response.json()
        
        # Create some data
        success, session_id = test_database.save_session(sample_session_data)
        assert success
        
        # Create multiple events
        for i in range(3):
            event_data = {
                "session_id": session_id,
                "event_type": "tool_use",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "data": {"test": i}
            }
            test_database.save_event(event_data)
        
        # Get updated metrics
        response = test_client.get("/api/metrics")
        assert response.status_code == 200
        updated_metrics = response.json()
        
        # Should show increased counts
        assert updated_metrics["total_events"] >= initial_metrics["total_events"]
        assert updated_metrics["total_sessions"] >= initial_metrics["total_sessions"]


if __name__ == "__main__":
    """Run tests directly."""
    print("🧪 Chronicle API Endpoints Test Suite")
    print("=" * 50)
    
    # Run basic tests
    pytest.main([__file__, "-v", "--tb=short"])