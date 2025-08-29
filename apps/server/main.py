#!/usr/bin/env python3
"""
Chronicle FastAPI Server - Production Ready HTTP/WebSocket Server
================================================================

A lightweight, high-performance FastAPI server that brokers data between Chronicle
hooks and dashboard, providing both HTTP and WebSocket endpoints for real-time
event streaming.

Features:
- FastAPI server on localhost:8510 (The Town's port!)
- CORS configured for dashboard access (localhost:3000)
- JSON request/response handling
- Structured logging system
- Graceful shutdown handling (SIGTERM/SIGINT)
- Integration with LocalDatabase and WebSocket modules
- Comprehensive error handling middleware
- Health check and monitoring endpoints

Author: C-Codey aka curl Stevens aka SWE-40
Port: 8510 (Oakland represent!)
"""

import asyncio
import logging
import signal
import sys
import time
import traceback
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

# FastAPI and related imports
try:
    from fastapi import FastAPI, HTTPException, Request, Response, WebSocket, WebSocketDisconnect
    from fastapi.middleware.cors import CORSMiddleware
    from fastapi.middleware.trustedhost import TrustedHostMiddleware
    from fastapi.responses import JSONResponse, StreamingResponse
    import uvicorn
except ImportError as e:
    print(f"Missing dependencies: {e}")
    print("Install with: pip install fastapi uvicorn")
    sys.exit(1)

# Try to import performance optimizations
try:
    import ujson as json_impl
except ImportError:
    import json as json_impl

# Local imports - handle both package and standalone execution
try:
    from .database import LocalDatabase, create_local_database
    from .websocket import ChronicleWebSocketServer, connection_manager
    from .event_broadcaster import create_event_broadcaster
except ImportError:
    # Fallback for standalone execution
    import os
    sys.path.append(os.path.dirname(__file__))
    from database import LocalDatabase, create_local_database
    from websocket import ChronicleWebSocketServer, connection_manager
    from event_broadcaster import create_event_broadcaster

# Configure structured logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)

logger = logging.getLogger(__name__)

# Server configuration
SERVER_HOST = "127.0.0.1"
SERVER_PORT = 8510
DASHBOARD_ORIGIN = "http://localhost:3000"
API_VERSION = "1.0.0"

# Global components
database: Optional[LocalDatabase] = None
event_broadcaster = None
websocket_server = None


class ChronicleError(Exception):
    """Base exception for Chronicle server."""
    pass


class DatabaseError(ChronicleError):
    """Database related errors."""
    pass


class ServerError(ChronicleError):
    """Server initialization or runtime errors."""
    pass


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    FastAPI lifespan context manager for startup and shutdown.
    Handles graceful initialization and cleanup of all components.
    """
    global database, event_broadcaster, websocket_server
    
    # Startup
    logger.info("🚀 Starting Chronicle FastAPI Server...")
    
    try:
        # Initialize database
        logger.info("Initializing database connection...")
        database = create_local_database()
        
        if not database.test_connection():
            raise DatabaseError("Database connection test failed")
            
        logger.info(f"✅ Database initialized: {database.db_path}")
        
        # Set database instance for API endpoints
        try:
            set_database(database)
            logger.info("✅ Database instance configured for API endpoints")
        except Exception as e:
            logger.warning(f"⚠️ Could not set database for API endpoints: {e}")
        
        # Initialize event broadcaster
        logger.info("Setting up event broadcaster...")
        event_broadcaster = create_event_broadcaster(database)
        await event_broadcaster.start_monitoring()
        logger.info("✅ Event broadcaster started")
        
        # Initialize WebSocket manager
        logger.info("Setting up WebSocket connection manager...")
        await connection_manager.startup()
        logger.info("✅ WebSocket connection manager initialized")
        
        # Display server info
        _display_startup_info()
        
        logger.info("🎉 Chronicle server startup completed successfully!")
        
    except Exception as e:
        logger.error(f"❌ Server startup failed: {e}")
        logger.error(traceback.format_exc())
        raise ServerError(f"Failed to start server: {e}")
    
    # Yield control to the application
    yield
    
    # Shutdown
    logger.info("🛑 Shutting down Chronicle FastAPI Server...")
    
    try:
        # Stop event broadcaster
        if event_broadcaster:
            await event_broadcaster.stop_monitoring()
            logger.info("✅ Event broadcaster stopped")
        
        # Stop WebSocket manager
        await connection_manager.shutdown()
        logger.info("✅ WebSocket connection manager stopped")
        
        # Close database
        if database:
            database.close()
            logger.info("✅ Database connection closed")
            
        logger.info("✅ Chronicle server shutdown completed")
        
    except Exception as e:
        logger.error(f"❌ Shutdown error: {e}")


def _display_startup_info():
    """Display server startup information."""
    print()
    print("=" * 70)
    print("🚀 CHRONICLE FASTAPI SERVER - READY TO SLAP!")
    print("=" * 70)
    print(f"Host:          {SERVER_HOST}")
    print(f"Port:          {SERVER_PORT}")
    print(f"Version:       {API_VERSION}")
    print(f"Dashboard:     {DASHBOARD_ORIGIN}")
    print()
    print("📡 ENDPOINTS:")
    print(f"Health Check:  http://{SERVER_HOST}:{SERVER_PORT}/health")
    print(f"API Info:      http://{SERVER_HOST}:{SERVER_PORT}/api/info")
    print(f"WebSocket:     ws://{SERVER_HOST}:{SERVER_PORT}/ws")
    print(f"SSE Stream:    http://{SERVER_HOST}:{SERVER_PORT}/api/events/stream")
    print(f"Statistics:    http://{SERVER_HOST}:{SERVER_PORT}/api/stats")
    print()
    if database:
        stats = database.get_performance_stats()
        print("💾 DATABASE:")
        print(f"Path:          {database.db_path}")
        print(f"Status:        ✅ Connected")
        print(f"Sessions:      {stats.get('session_count', 0)}")
        print(f"Events:        {stats.get('event_count', 0)}")
        print(f"Size:          {stats.get('db_size_mb', 0)} MB")
    print()
    print("=" * 70)
    print("Server is live and ready! Dashboard at http://localhost:3000")
    print("Press Ctrl+C to stop the server")
    print("=" * 70)
    print()


# Create FastAPI application with lifespan management
app = FastAPI(
    title="Chronicle Local Server",
    description="High-performance local server for Chronicle hooks and dashboard",
    version=API_VERSION,
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url="/api/redoc"
)

# Add CORS middleware for dashboard access
app.add_middleware(
    CORSMiddleware,
    allow_origins=[DASHBOARD_ORIGIN, "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Add trusted host middleware for security
app.add_middleware(
    TrustedHostMiddleware,
    allowed_hosts=["localhost", "127.0.0.1", "0.0.0.0"]
)


# Import and mount API endpoints
try:
    from .api_endpoints import router as api_router, set_database
    # Include the API router in the main app with /api prefix
    app.include_router(api_router, prefix="/api")
    logger.info("✅ API endpoints router mounted successfully")
except ImportError as e:
    logger.error(f"❌ Failed to import API endpoints: {e}")
    # Fallback for standalone execution
    try:
        import os
        sys.path.append(os.path.dirname(__file__))
        from api_endpoints import router as api_router, set_database
        app.include_router(api_router, prefix="/api")
        logger.info("✅ API endpoints router mounted successfully (fallback)")
    except ImportError:
        logger.error("❌ Could not load API endpoints module")


@app.middleware("http")
async def error_handling_middleware(request: Request, call_next):
    """
    Global error handling middleware for comprehensive error management.
    """
    start_time = time.time()
    
    try:
        # Process request
        response = await call_next(request)
        
        # Add performance headers
        process_time = time.time() - start_time
        response.headers["X-Process-Time"] = f"{process_time:.4f}"
        response.headers["X-Server-Version"] = API_VERSION
        
        return response
        
    except Exception as e:
        # Log error with context
        process_time = time.time() - start_time
        logger.error(f"Request error: {e}")
        logger.error(f"Request: {request.method} {request.url}")
        logger.error(f"Process time: {process_time:.4f}s")
        logger.error(traceback.format_exc())
        
        # Return structured error response
        error_response = {
            "error": "Internal Server Error",
            "message": "An unexpected error occurred",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "path": str(request.url.path),
            "method": request.method
        }
        
        return JSONResponse(
            status_code=500,
            content=error_response
        )


@app.middleware("http") 
async def logging_middleware(request: Request, call_next):
    """
    Request logging middleware for monitoring and debugging.
    """
    start_time = time.time()
    
    # Log request
    logger.info(f"📥 {request.method} {request.url.path}")
    
    # Process request
    response = await call_next(request)
    
    # Log response
    process_time = time.time() - start_time
    logger.info(f"📤 {response.status_code} {request.method} {request.url.path} - {process_time*1000:.2f}ms")
    
    return response


# Core API Routes
@app.get("/health")
async def health_check():
    """
    Health check endpoint - verifies all system components are operational.
    """
    start_time = time.time()
    
    try:
        # Check database health
        db_healthy = database.test_connection() if database else False
        
        # Check event broadcaster health
        broadcaster_healthy = event_broadcaster._running if event_broadcaster else False
        
        # Check WebSocket connections
        connection_stats = connection_manager.get_connection_stats()
        
        # Overall health status
        overall_healthy = db_healthy and broadcaster_healthy
        
        health_data = {
            "status": "healthy" if overall_healthy else "unhealthy",
            "version": API_VERSION,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "uptime_ms": round((time.time() - start_time) * 1000, 2),
            "components": {
                "database": {
                    "status": "healthy" if db_healthy else "unhealthy",
                    "path": str(database.db_path) if database else None
                },
                "event_broadcaster": {
                    "status": "healthy" if broadcaster_healthy else "unhealthy",
                    "running": broadcaster_healthy
                },
                "websocket": {
                    "status": "healthy",
                    "active_connections": connection_stats.get("active_connections", 0)
                }
            }
        }
        
        status_code = 200 if overall_healthy else 503
        return JSONResponse(content=health_data, status_code=status_code)
        
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return JSONResponse(
            content={
                "status": "unhealthy",
                "error": str(e),
                "timestamp": datetime.now(timezone.utc).isoformat()
            },
            status_code=503
        )


@app.get("/api/info")
async def server_info():
    """
    Server information endpoint - provides comprehensive server details.
    """
    try:
        # Get database stats
        db_stats = database.get_performance_stats() if database else {}
        
        # Get connection stats
        connection_stats = connection_manager.get_connection_stats()
        
        # Get broadcaster stats
        broadcaster_stats = event_broadcaster.get_stats() if event_broadcaster else {}
        
        server_info = {
            "server": "Chronicle FastAPI Server",
            "version": API_VERSION,
            "port": SERVER_PORT,
            "host": SERVER_HOST,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "endpoints": {
                "health": f"http://{SERVER_HOST}:{SERVER_PORT}/health",
                "api_info": f"http://{SERVER_HOST}:{SERVER_PORT}/api/info",
                "websocket": f"ws://{SERVER_HOST}:{SERVER_PORT}/ws",
                "sse": f"http://{SERVER_HOST}:{SERVER_PORT}/api/events/stream",
                "stats": f"http://{SERVER_HOST}:{SERVER_PORT}/api/stats",
                "docs": f"http://{SERVER_HOST}:{SERVER_PORT}/api/docs"
            },
            "dashboard": {
                "url": DASHBOARD_ORIGIN,
                "cors_enabled": True
            },
            "database": db_stats,
            "websocket": connection_stats,
            "event_broadcaster": broadcaster_stats
        }
        
        return JSONResponse(content=server_info)
        
    except Exception as e:
        logger.error(f"Server info request failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/stats")
async def server_statistics():
    """
    Server statistics endpoint - provides performance metrics.
    """
    try:
        stats = {
            "server": {
                "version": API_VERSION,
                "uptime": "runtime", # TODO: Calculate actual uptime
                "timestamp": datetime.now(timezone.utc).isoformat()
            },
            "database": database.get_performance_stats() if database else {},
            "websocket": connection_manager.get_connection_stats(),
            "event_broadcaster": event_broadcaster.get_stats() if event_broadcaster else {}
        }
        
        return JSONResponse(content=stats)
        
    except Exception as e:
        logger.error(f"Statistics request failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Session Management Routes
@app.get("/api/sessions")
async def get_recent_sessions(limit: int = 50):
    """Get recent Chronicle sessions."""
    try:
        if not database:
            raise HTTPException(status_code=503, detail="Database not available")
            
        sessions = database.get_recent_sessions(limit=limit)
        
        return JSONResponse(content={
            "sessions": sessions,
            "count": len(sessions),
            "limit": limit,
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
        
    except Exception as e:
        logger.error(f"Failed to get sessions: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/sessions/{session_id}")
async def get_session_details(session_id: str):
    """Get details for a specific session."""
    try:
        if not database:
            raise HTTPException(status_code=503, detail="Database not available")
            
        session = database.get_session(session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")
        
        events = database.get_session_events(session_id, limit=1000)
        
        return JSONResponse(content={
            "session": session,
            "events": events,
            "event_count": len(events),
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get session {session_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/sessions/{session_id}/events")
async def get_session_events(session_id: str, limit: int = 1000):
    """Get events for a specific session."""
    try:
        if not database:
            raise HTTPException(status_code=503, detail="Database not available")
            
        events = database.get_session_events(session_id, limit=limit)
        
        return JSONResponse(content={
            "session_id": session_id,
            "events": events,
            "count": len(events),
            "limit": limit,
            "timestamp": datetime.now(timezone.utc).isoformat()
        })
        
    except Exception as e:
        logger.error(f"Failed to get events for session {session_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Add WebSocket endpoints directly to this FastAPI app

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for real-time events."""
    connection_id = None
    
    try:
        # Extract client info from query params
        client_info = dict(websocket.query_params)
        
        # Connect client
        connection_id = await connection_manager.connect(websocket, client_info)
        
        # Listen for messages
        while True:
            try:
                # Wait for message with timeout
                message = await asyncio.wait_for(
                    websocket.receive_text(),
                    timeout=60.0  # 60 second timeout
                )
                
                # Parse and handle message
                try:
                    data = json_impl.loads(message)
                    await _handle_client_message(connection_id, data)
                except json.JSONDecodeError:
                    logger.warning(f"Invalid JSON from {connection_id}")
                
            except asyncio.TimeoutError:
                logger.debug(f"No message from {connection_id} (timeout)")
                break
            
    except WebSocketDisconnect:
        logger.debug(f"WebSocket disconnected: {connection_id}")
    except Exception as e:
        logger.error(f"WebSocket error for {connection_id}: {e}")
    finally:
        if connection_id:
            await connection_manager.disconnect(connection_id)

@app.get("/api/events/stream")
async def sse_endpoint(request: Request):
    """Server-Sent Events endpoint as WebSocket fallback."""
    
    async def event_generator():
        """Generate SSE events."""
        try:
            # Send connection established event
            connection_event = {
                "id": f"conn-{time.time()}",
                "event_type": "sse_connected",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "data": {
                    "client_ip": request.client.host if request.client else "unknown",
                    "user_agent": request.headers.get("user-agent", "unknown")
                }
            }
            
            yield f"data: {json_impl.dumps(connection_event)}\n\n"
            
            # Monitor for new events (simplified polling approach)
            last_check = time.time()
            
            while True:
                # Check for client disconnect
                if await request.is_disconnected():
                    logger.debug("SSE client disconnected")
                    break
                
                # Send heartbeat every 30 seconds
                current_time = time.time()
                if current_time - last_check > 30:
                    heartbeat = {
                        "type": "heartbeat",
                        "timestamp": datetime.now(timezone.utc).isoformat(),
                        "server_time": current_time
                    }
                    yield f"data: {json_impl.dumps(heartbeat)}\n\n"
                    last_check = current_time
                
                await asyncio.sleep(1.0)
                
        except Exception as e:
            logger.error(f"SSE generator error: {e}")
            
            error_event = {
                "type": "error",
                "message": "Server error occurred"
            }
            yield f"data: {json_impl.dumps(error_event)}\n\n"
    
    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "Access-Control-Allow-Origin": "*"
        }
    )

async def _handle_client_message(connection_id: str, data: Dict[str, Any]):
    """Handle message from WebSocket client."""
    message_type = data.get("type", "unknown")
    
    if message_type == "pong":
        # Update pong timestamp
        with connection_manager._connection_lock:
            if connection_id in connection_manager._connections:
                connection_manager._connections[connection_id].last_pong = time.time()
        
        logger.debug(f"Received pong from {connection_id}")
        
    elif message_type == "subscribe":
        # Client requesting event subscription
        filters = data.get("filters", {})
        logger.info(f"Client {connection_id} subscribed with filters: {filters}")
        
    else:
        logger.debug(f"Unknown message type from {connection_id}: {message_type}")

# All endpoints are defined directly in this file for simplicity


def setup_signal_handlers():
    """
    Setup signal handlers for graceful shutdown.
    """
    def signal_handler(signum, frame):
        logger.info(f"🛑 Received signal {signum} - initiating graceful shutdown...")
        
        # Create shutdown task
        loop = asyncio.get_event_loop()
        if loop.is_running():
            # Schedule shutdown
            task = asyncio.create_task(_graceful_shutdown())
            
        sys.exit(0)
    
    # Register signal handlers
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    logger.info("✅ Signal handlers registered for graceful shutdown")


async def _graceful_shutdown():
    """Perform graceful shutdown of all components."""
    logger.info("Performing graceful shutdown...")
    
    try:
        # Stop event broadcaster
        if event_broadcaster:
            await event_broadcaster.stop_monitoring()
        
        # Stop WebSocket manager  
        await connection_manager.shutdown()
        
        # Close database
        if database:
            database.close()
            
        logger.info("✅ Graceful shutdown completed")
        
    except Exception as e:
        logger.error(f"Error during shutdown: {e}")


def run_server(host: str = SERVER_HOST, port: int = SERVER_PORT, debug: bool = False):
    """
    Run the Chronicle FastAPI server.
    
    Args:
        host: Host to bind to
        port: Port to bind to  
        debug: Enable debug mode
    """
    # Setup signal handlers
    setup_signal_handlers()
    
    # Configure uvicorn
    log_level = "debug" if debug else "info"
    
    logger.info(f"🚀 Starting Chronicle FastAPI server on {host}:{port}")
    
    try:
        uvicorn.run(
            "main:app",
            host=host,
            port=port,
            log_level=log_level,
            access_log=True,
            reload=debug,
            workers=1  # Keep single worker for SQLite compatibility
        )
    except Exception as e:
        logger.error(f"❌ Server failed to start: {e}")
        sys.exit(1)


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Chronicle FastAPI Server")
    parser.add_argument("--host", default=SERVER_HOST, help="Host to bind to")
    parser.add_argument("--port", type=int, default=SERVER_PORT, help="Port to bind to")
    parser.add_argument("--debug", action="store_true", help="Enable debug mode")
    
    args = parser.parse_args()
    
    # Run server
    run_server(host=args.host, port=args.port, debug=args.debug)