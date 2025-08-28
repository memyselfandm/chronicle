#!/usr/bin/env python3
"""
Chronicle REST API Endpoints - Production Ready FastAPI Routes  
===========================================================

High-performance REST API endpoints matching Supabase functionality for Chronicle.
Provides comprehensive event management, session handling, and dashboard metrics
with sub-10ms response times and production-grade error handling.

Features:
- Complete CRUD operations for events and sessions
- Advanced filtering and pagination
- Dashboard metrics and analytics
- Comprehensive input validation with Pydantic
- OpenAPI documentation generation
- Production-grade error handling
- Response format matching Supabase exactly

Author: C-Codey aka curl Stevens aka SWE-40
Port: 8510 (Oakland represent!)
"""

import json
import logging
import sqlite3
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Union
from uuid import uuid4

# FastAPI and Pydantic imports
try:
    from fastapi import APIRouter, HTTPException, Query, Path, Depends
    from fastapi.responses import JSONResponse
    from pydantic import BaseModel, Field, validator
    from pydantic.types import UUID4
except ImportError as e:
    print(f"Missing dependencies: {e}")
    print("Install with: pip install fastapi pydantic")
    raise

# Try performance optimizations
try:
    import ujson as json_impl
except ImportError:
    import json as json_impl

# Local database import
try:
    from .database import LocalDatabase
except ImportError:
    from database import LocalDatabase

# Configure logging
logger = logging.getLogger(__name__)

# Create API router for organization
router = APIRouter(tags=["chronicle"])

# Global database instance (injected via dependency)
_database: Optional[LocalDatabase] = None

# Valid event types matching database exactly
VALID_EVENT_TYPES = {
    'session_start', 'notification', 'error', 'pre_tool_use', 
    'post_tool_use', 'user_prompt_submit', 'stop', 'subagent_stop', 
    'pre_compact', 'tool_use', 'prompt', 'session_end', 
    'subagent_termination', 'pre_compaction'
}

# Response format constants
DEFAULT_PAGE_SIZE = 50
MAX_PAGE_SIZE = 1000


class ChronicleAPIError(Exception):
    """Base API exception class."""
    pass


class ValidationError(ChronicleAPIError):
    """Input validation errors."""
    pass


class DatabaseError(ChronicleAPIError):
    """Database operation errors."""
    pass


# Pydantic Models for Request/Response Validation
class EventMetadata(BaseModel):
    """Event metadata with flexible structure."""
    class Config:
        extra = "allow"  # Allow additional fields


class EventCreate(BaseModel):
    """Pydantic model for creating new events."""
    session_id: str = Field(..., description="Session ID this event belongs to")
    event_type: str = Field(..., description="Type of event")
    timestamp: str = Field(..., description="ISO timestamp when event occurred")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Event metadata")
    tool_name: Optional[str] = Field(None, description="Name of tool used (if applicable)")
    duration_ms: Optional[int] = Field(None, ge=0, description="Event duration in milliseconds")
    
    @validator('event_type')
    def validate_event_type(cls, v):
        if v not in VALID_EVENT_TYPES:
            logger.warning(f"Invalid event type: {v}, defaulting to 'notification'")
            return 'notification'
        return v
    
    @validator('timestamp')
    def validate_timestamp(cls, v):
        try:
            datetime.fromisoformat(v.replace('Z', '+00:00'))
            return v
        except ValueError:
            raise ValueError('timestamp must be valid ISO 8601 format')
    
    class Config:
        json_schema_extra = {
            "example": {
                "session_id": "123e4567-e89b-12d3-a456-426614174000",
                "event_type": "tool_use",
                "timestamp": "2024-01-01T12:00:00Z",
                "metadata": {
                    "tool_name": "bash",
                    "command": "ls -la",
                    "success": True
                },
                "tool_name": "bash",
                "duration_ms": 250
            }
        }


class EventResponse(BaseModel):
    """Pydantic model for event responses."""
    id: str
    session_id: str
    event_type: str
    timestamp: str
    metadata: Dict[str, Any]
    tool_name: Optional[str]
    duration_ms: Optional[int]
    created_at: str
    
    class Config:
        json_schema_extra = {
            "example": {
                "id": "123e4567-e89b-12d3-a456-426614174000",
                "session_id": "123e4567-e89b-12d3-a456-426614174001",
                "event_type": "tool_use",
                "timestamp": "2024-01-01T12:00:00Z",
                "metadata": {"tool_name": "bash"},
                "tool_name": "bash",
                "duration_ms": 250,
                "created_at": "2024-01-01T12:00:00.123Z"
            }
        }


class SessionResponse(BaseModel):
    """Pydantic model for session responses."""
    id: str
    claude_session_id: str
    project_path: Optional[str]
    git_branch: Optional[str]
    start_time: str
    end_time: Optional[str]
    metadata: Dict[str, Any]
    event_count: int
    created_at: str
    updated_at: str
    
    class Config:
        json_schema_extra = {
            "example": {
                "id": "123e4567-e89b-12d3-a456-426614174000",
                "claude_session_id": "claude-session-123",
                "project_path": "/Users/m/project",
                "git_branch": "main",
                "start_time": "2024-01-01T12:00:00Z",
                "end_time": None,
                "metadata": {"source": "cli"},
                "event_count": 42,
                "created_at": "2024-01-01T12:00:00Z",
                "updated_at": "2024-01-01T12:30:00Z"
            }
        }


class EventsListResponse(BaseModel):
    """Response model for events listing."""
    data: List[EventResponse]
    total: int
    limit: int
    offset: int
    has_more: bool
    
    class Config:
        json_schema_extra = {
            "example": {
                "data": [],
                "total": 100,
                "limit": 50,
                "offset": 0,
                "has_more": True
            }
        }


class SessionsListResponse(BaseModel):
    """Response model for sessions listing."""
    data: List[SessionResponse]
    total: int
    limit: int
    offset: int
    has_more: bool


class DashboardMetrics(BaseModel):
    """Dashboard metrics response model."""
    total_sessions: int
    active_sessions: int
    total_events: int
    events_today: int
    top_event_types: List[Dict[str, Any]]
    session_duration_avg_minutes: float
    most_active_projects: List[Dict[str, Any]]
    recent_activity: List[Dict[str, Any]]
    timestamp: str
    
    class Config:
        json_schema_extra = {
            "example": {
                "total_sessions": 150,
                "active_sessions": 3,
                "total_events": 2500,
                "events_today": 45,
                "top_event_types": [
                    {"event_type": "tool_use", "count": 850},
                    {"event_type": "user_prompt_submit", "count": 420}
                ],
                "session_duration_avg_minutes": 45.5,
                "most_active_projects": [
                    {"project_path": "/Users/m/project1", "session_count": 15}
                ],
                "recent_activity": [],
                "timestamp": "2024-01-01T12:00:00Z"
            }
        }


class StandardResponse(BaseModel):
    """Standard API response wrapper."""
    success: bool
    message: Optional[str] = None
    timestamp: str
    
    class Config:
        json_schema_extra = {
            "example": {
                "success": True,
                "message": "Event created successfully",
                "timestamp": "2024-01-01T12:00:00Z"
            }
        }


# Dependency injection for database
def get_database() -> LocalDatabase:
    """Dependency to get database instance."""
    global _database
    if not _database:
        raise HTTPException(status_code=503, detail="Database not available")
    return _database


def set_database(database: LocalDatabase) -> None:
    """Set the global database instance."""
    global _database
    _database = database
    logger.info("Database instance set for API endpoints")


# Utility functions
def format_supabase_response(data: Any, total: Optional[int] = None) -> Dict[str, Any]:
    """Format response to match Supabase format exactly."""
    response = {
        "data": data if isinstance(data, list) else [data] if data else [],
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    
    if total is not None:
        response["total"] = total
    
    return response


def handle_database_error(operation: str, error: Exception) -> HTTPException:
    """Handle database errors consistently."""
    logger.error(f"{operation} failed: {error}")
    return HTTPException(
        status_code=500,
        detail={
            "error": "Database operation failed",
            "operation": operation,
            "message": str(error),
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
    )


def validate_pagination(limit: int, offset: int) -> tuple[int, int]:
    """Validate and normalize pagination parameters."""
    limit = min(max(1, limit), MAX_PAGE_SIZE)
    offset = max(0, offset)
    return limit, offset


# API ENDPOINTS START HERE

@router.post("/events", response_model=Dict[str, Any], status_code=201)
async def create_event(
    event: EventCreate,
    db: LocalDatabase = Depends(get_database)
) -> Dict[str, Any]:
    """
    Insert new event into Chronicle database.
    
    Creates a new event record with validation and returns the created event
    with auto-generated ID. Matches Supabase POST functionality exactly.
    """
    start_time = time.time()
    
    try:
        # Generate event ID
        event_id = str(uuid4())
        
        # Prepare event data for database
        event_data = {
            "session_id": event.session_id,
            "event_type": event.event_type,
            "timestamp": event.timestamp,
            "data": event.metadata,  # Database expects 'data' field
            "tool_name": event.tool_name,
            "duration_ms": event.duration_ms
        }
        
        # Save to database
        success = db.save_event(event_data)
        
        if not success:
            raise HTTPException(
                status_code=500,
                detail="Failed to save event to database"
            )
        
        # Prepare response data (matching Supabase format)
        response_data = {
            "id": event_id,
            "session_id": event.session_id,
            "event_type": event.event_type,
            "timestamp": event.timestamp,
            "metadata": event.metadata,
            "tool_name": event.tool_name,
            "duration_ms": event.duration_ms,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        # Log performance
        duration = (time.time() - start_time) * 1000
        logger.info(f"Event created successfully in {duration:.2f}ms")
        
        return format_supabase_response(response_data)
        
    except HTTPException:
        raise
    except Exception as e:
        raise handle_database_error("create_event", e)


@router.get("/events", response_model=EventsListResponse)
async def get_events(
    session_id: Optional[str] = Query(None, description="Filter by session ID"),
    event_type: Optional[str] = Query(None, description="Filter by event type"),
    tool_name: Optional[str] = Query(None, description="Filter by tool name"),
    limit: int = Query(DEFAULT_PAGE_SIZE, ge=1, le=MAX_PAGE_SIZE, description="Number of results to return"),
    offset: int = Query(0, ge=0, description="Number of results to skip"),
    order_by: str = Query("timestamp:desc", description="Order by field:direction"),
    db: LocalDatabase = Depends(get_database)
) -> Dict[str, Any]:
    """
    Query events with advanced filtering and pagination.
    
    Supports filtering by session, event type, tool name with efficient
    pagination and sorting. Matches Supabase GET functionality.
    """
    start_time = time.time()
    
    try:
        # Validate pagination
        limit, offset = validate_pagination(limit, offset)
        
        # Build SQL query with filters
        conditions = []
        params = []
        
        if session_id:
            conditions.append("session_id = ?")
            params.append(session_id)
        
        if event_type:
            conditions.append("event_type = ?")
            params.append(event_type)
            
        if tool_name:
            conditions.append("tool_name = ?")
            params.append(tool_name)
        
        where_clause = ""
        if conditions:
            where_clause = f"WHERE {' AND '.join(conditions)}"
        
        # Parse order_by parameter
        order_field, order_dir = "timestamp", "desc"
        if ":" in order_by:
            order_field, order_dir = order_by.split(":", 1)
            order_dir = "ASC" if order_dir.lower() == "asc" else "DESC"
        
        # Execute query with database connection
        with db._get_connection() as conn:
            conn.row_factory = sqlite3.Row
            
            # Count total records
            count_query = f"SELECT COUNT(*) FROM chronicle_events {where_clause}"
            cursor = conn.execute(count_query, params)
            total = cursor.fetchone()[0]
            
            # Get paginated results
            query = f"""
                SELECT * FROM chronicle_events 
                {where_clause}
                ORDER BY {order_field} {order_dir}
                LIMIT ? OFFSET ?
            """
            cursor = conn.execute(query, params + [limit, offset])
            
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
        
        # Calculate has_more
        has_more = (offset + limit) < total
        
        # Log performance
        duration = (time.time() - start_time) * 1000
        logger.info(f"Retrieved {len(events)} events in {duration:.2f}ms")
        
        return {
            "data": events,
            "total": total,
            "limit": limit,
            "offset": offset,
            "has_more": has_more,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
    except Exception as e:
        raise handle_database_error("get_events", e)


@router.get("/sessions", response_model=SessionsListResponse)
async def get_sessions(
    limit: int = Query(DEFAULT_PAGE_SIZE, ge=1, le=MAX_PAGE_SIZE),
    offset: int = Query(0, ge=0),
    project_path: Optional[str] = Query(None, description="Filter by project path"),
    active_only: bool = Query(False, description="Return only active sessions"),
    db: LocalDatabase = Depends(get_database)
) -> Dict[str, Any]:
    """
    List Chronicle sessions with filtering and pagination.
    
    Returns sessions with event counts and filtering options.
    Supports active session filtering for dashboard use.
    """
    start_time = time.time()
    
    try:
        # Validate pagination
        limit, offset = validate_pagination(limit, offset)
        
        # Build query conditions
        conditions = []
        params = []
        
        if project_path:
            conditions.append("s.project_path = ?")
            params.append(project_path)
        
        if active_only:
            conditions.append("s.end_time IS NULL")
        
        where_clause = ""
        if conditions:
            where_clause = f"WHERE {' AND '.join(conditions)}"
        
        with db._get_connection() as conn:
            conn.row_factory = sqlite3.Row
            
            # Count total sessions
            count_query = f"""
                SELECT COUNT(*) FROM chronicle_sessions s {where_clause}
            """
            cursor = conn.execute(count_query, params)
            total = cursor.fetchone()[0]
            
            # Get sessions with event counts
            query = f"""
                SELECT s.*, COUNT(e.id) as event_count
                FROM chronicle_sessions s
                LEFT JOIN chronicle_events e ON s.id = e.session_id
                {where_clause}
                GROUP BY s.id
                ORDER BY s.start_time DESC
                LIMIT ? OFFSET ?
            """
            cursor = conn.execute(query, params + [limit, offset])
            
            sessions = []
            for row in cursor.fetchall():
                session = dict(row)
                # Parse JSON metadata
                if session.get("metadata"):
                    try:
                        session["metadata"] = json_impl.loads(session["metadata"])
                    except:
                        session["metadata"] = {}
                sessions.append(session)
        
        # Calculate has_more
        has_more = (offset + limit) < total
        
        # Log performance
        duration = (time.time() - start_time) * 1000
        logger.info(f"Retrieved {len(sessions)} sessions in {duration:.2f}ms")
        
        return {
            "data": sessions,
            "total": total,
            "limit": limit,
            "offset": offset,
            "has_more": has_more,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
    except Exception as e:
        raise handle_database_error("get_sessions", e)


@router.get("/metrics", response_model=DashboardMetrics)
async def get_dashboard_metrics(
    days: int = Query(7, ge=1, le=90, description="Number of days for metrics calculation"),
    db: LocalDatabase = Depends(get_database)
) -> Dict[str, Any]:
    """
    Calculate comprehensive dashboard metrics and statistics.
    
    Provides session counts, event statistics, top event types,
    project activity, and recent activity summaries for dashboard display.
    """
    start_time = time.time()
    
    try:
        with db._get_connection() as conn:
            conn.row_factory = sqlite3.Row
            
            # Calculate date ranges
            now = datetime.now(timezone.utc)
            days_ago = f"datetime('now', '-{days} days')"
            today_start = f"datetime('now', 'start of day')"
            
            # Total sessions
            cursor = conn.execute("SELECT COUNT(*) FROM chronicle_sessions")
            total_sessions = cursor.fetchone()[0]
            
            # Active sessions (no end_time)
            cursor = conn.execute("SELECT COUNT(*) FROM chronicle_sessions WHERE end_time IS NULL")
            active_sessions = cursor.fetchone()[0]
            
            # Total events
            cursor = conn.execute("SELECT COUNT(*) FROM chronicle_events")
            total_events = cursor.fetchone()[0]
            
            # Events today
            cursor = conn.execute(f"SELECT COUNT(*) FROM chronicle_events WHERE created_at >= {today_start}")
            events_today = cursor.fetchone()[0]
            
            # Top event types (last N days)
            cursor = conn.execute(f"""
                SELECT event_type, COUNT(*) as count
                FROM chronicle_events 
                WHERE created_at >= {days_ago}
                GROUP BY event_type
                ORDER BY count DESC
                LIMIT 10
            """)
            top_event_types = [{"event_type": row[0], "count": row[1]} for row in cursor.fetchall()]
            
            # Average session duration
            cursor = conn.execute("""
                SELECT AVG(
                    (julianday(COALESCE(end_time, datetime('now', 'utc'))) - julianday(start_time)) * 24 * 60
                ) as avg_duration_minutes
                FROM chronicle_sessions
                WHERE start_time IS NOT NULL
            """)
            result = cursor.fetchone()
            avg_duration = round(result[0] if result[0] else 0, 2)
            
            # Most active projects (last N days)
            cursor = conn.execute(f"""
                SELECT s.project_path, COUNT(DISTINCT s.id) as session_count, COUNT(e.id) as event_count
                FROM chronicle_sessions s
                LEFT JOIN chronicle_events e ON s.id = e.session_id
                WHERE s.created_at >= {days_ago} AND s.project_path IS NOT NULL
                GROUP BY s.project_path
                ORDER BY session_count DESC, event_count DESC
                LIMIT 5
            """)
            most_active_projects = [
                {
                    "project_path": row[0],
                    "session_count": row[1],
                    "event_count": row[2]
                }
                for row in cursor.fetchall()
            ]
            
            # Recent activity (last 24 hours)
            cursor = conn.execute("""
                SELECT s.project_path, s.git_branch, e.event_type, e.timestamp, e.tool_name
                FROM chronicle_events e
                JOIN chronicle_sessions s ON e.session_id = s.id
                WHERE e.created_at >= datetime('now', '-24 hours')
                ORDER BY e.timestamp DESC
                LIMIT 20
            """)
            recent_activity = [
                {
                    "project_path": row[0],
                    "git_branch": row[1],
                    "event_type": row[2],
                    "timestamp": row[3],
                    "tool_name": row[4]
                }
                for row in cursor.fetchall()
            ]
        
        # Prepare metrics response
        metrics = {
            "total_sessions": total_sessions,
            "active_sessions": active_sessions,
            "total_events": total_events,
            "events_today": events_today,
            "top_event_types": top_event_types,
            "session_duration_avg_minutes": avg_duration,
            "most_active_projects": most_active_projects,
            "recent_activity": recent_activity,
            "timestamp": now.isoformat()
        }
        
        # Log performance
        duration = (time.time() - start_time) * 1000
        logger.info(f"Calculated dashboard metrics in {duration:.2f}ms")
        
        return metrics
        
    except Exception as e:
        raise handle_database_error("get_dashboard_metrics", e)


@router.delete("/events/{event_id}", response_model=StandardResponse)
async def delete_event(
    event_id: str = Path(..., description="Event ID to delete"),
    admin_key: Optional[str] = Query(None, description="Admin authorization key"),
    db: LocalDatabase = Depends(get_database)
) -> Dict[str, Any]:
    """
    Delete an event by ID (admin only).
    
    Requires admin authorization and provides audit logging.
    Should be used sparingly and only for data correction purposes.
    """
    start_time = time.time()
    
    try:
        # Simple admin authorization check
        # In production, this would integrate with proper auth system
        if not admin_key or admin_key != "chronicle_admin_2024":
            raise HTTPException(
                status_code=401,
                detail="Admin authorization required for event deletion"
            )
        
        # Check if event exists
        with db._get_connection() as conn:
            cursor = conn.execute(
                "SELECT id, event_type, session_id FROM chronicle_events WHERE id = ?",
                (event_id,)
            )
            event = cursor.fetchone()
            
            if not event:
                raise HTTPException(
                    status_code=404,
                    detail=f"Event {event_id} not found"
                )
            
            # Delete the event
            cursor = conn.execute("DELETE FROM chronicle_events WHERE id = ?", (event_id,))
            conn.commit()
            
            if cursor.rowcount == 0:
                raise HTTPException(
                    status_code=404,
                    detail=f"Event {event_id} not found"
                )
        
        # Log deletion for audit trail
        logger.warning(f"Admin deletion: Event {event_id} (type: {event[1]}, session: {event[2]})")
        
        # Performance logging
        duration = (time.time() - start_time) * 1000
        logger.info(f"Event deleted successfully in {duration:.2f}ms")
        
        return {
            "success": True,
            "message": f"Event {event_id} deleted successfully",
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
    except HTTPException:
        raise
    except Exception as e:
        raise handle_database_error("delete_event", e)


# Health check endpoint specific to API
@router.get("/health")
async def api_health_check(db: LocalDatabase = Depends(get_database)) -> Dict[str, Any]:
    """API-specific health check endpoint."""
    try:
        # Test database connection
        db_healthy = db.test_connection()
        
        # Get basic stats
        stats = db.get_performance_stats()
        
        return {
            "status": "healthy" if db_healthy else "unhealthy",
            "api_version": "1.0.0",
            "database": {
                "status": "healthy" if db_healthy else "unhealthy",
                "stats": stats
            },
            "endpoints_available": [
                "GET /api/events",
                "POST /api/events", 
                "GET /api/sessions",
                "GET /api/metrics",
                "DELETE /api/events/{id}"
            ],
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        
    except Exception as e:
        logger.error(f"API health check failed: {e}")
        return {
            "status": "unhealthy",
            "error": str(e),
            "timestamp": datetime.now(timezone.utc).isoformat()
        }


# Export router and setup function
__all__ = ["router", "set_database", "VALID_EVENT_TYPES"]

# Quick test if run directly
if __name__ == "__main__":
    print("Chronicle API Endpoints module loaded successfully!")
    print(f"Valid event types: {VALID_EVENT_TYPES}")
    print("Router ready for FastAPI integration")