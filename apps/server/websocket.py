#!/usr/bin/env python3
"""
Chronicle WebSocket & SSE Real-time Event Streaming - Production Ready
====================================================================

High-performance real-time event streaming system for Chronicle using WebSocket
and Server-Sent Events to replace Supabase real-time functionality.

Features:
- WebSocket bidirectional communication at ws://localhost:8510/ws
- SSE fallback endpoint at http://localhost:8510/api/events/stream
- Connection management with heartbeat/ping-pong
- Event broadcasting to all connected clients
- <50ms latency event delivery
- Graceful reconnection handling
- Performance monitoring and metrics

Author: C-Codey aka curl Stevens aka SWE-40
Port: 8510 (The Town's port, fasho!)
"""

import asyncio
import json
import logging
import time
import uuid
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Set
from dataclasses import dataclass, asdict
from concurrent.futures import ThreadPoolExecutor
import threading
import weakref

# FastAPI and WebSocket imports
try:
    from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request
    from fastapi.responses import StreamingResponse
    import uvicorn
except ImportError as e:
    print(f"Missing dependencies: {e}")
    print("Install with: pip install fastapi uvicorn websockets")
    exit(1)

# Try to import performance optimizations
try:
    import ujson as json_impl
except ImportError:
    import json as json_impl

# Database integration
try:
    from .database import LocalDatabase, create_local_database
except ImportError:
    # Fallback for standalone execution
    import sys
    import os
    sys.path.append(os.path.dirname(__file__))
    from database import LocalDatabase, create_local_database

# Configure logging
logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

# Configuration constants
WEBSOCKET_ENDPOINT = "/ws"
SSE_ENDPOINT = "/api/events/stream"
HEARTBEAT_INTERVAL = 30.0  # seconds
MAX_MESSAGE_SIZE = 1024 * 1024  # 1MB
EVENT_QUEUE_SIZE = 10000
LATENCY_TARGET_MS = 50.0


@dataclass
class ConnectionInfo:
    """Information about a WebSocket connection."""
    id: str
    websocket: WebSocket
    connected_at: float
    last_ping: Optional[float] = None
    last_pong: Optional[float] = None
    client_info: Optional[Dict[str, Any]] = None
    message_count: int = 0
    bytes_sent: int = 0
    latency_ms: float = 0.0


@dataclass
class EventMessage:
    """Event message for broadcasting."""
    id: str
    event_type: str
    timestamp: str
    session_id: str
    data: Dict[str, Any]
    created_at: float
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to dictionary for JSON serialization."""
        return asdict(self)
    
    def to_json(self) -> str:
        """Convert to JSON string."""
        return json_impl.dumps(self.to_dict())


class ConnectionManager:
    """
    Manages WebSocket connections and event broadcasting.
    
    Handles connection lifecycle, heartbeat monitoring, and efficient
    event distribution to all connected clients.
    """
    
    def __init__(self):
        # Active WebSocket connections
        self._connections: Dict[str, ConnectionInfo] = {}
        self._connection_lock = threading.RLock()
        
        # Event queue for broadcasting
        self._event_queue: asyncio.Queue = None  # Initialized in startup
        self._broadcast_task: Optional[asyncio.Task] = None
        self._heartbeat_task: Optional[asyncio.Task] = None
        
        # Performance metrics
        self._total_connections = 0
        self._total_messages_sent = 0
        self._total_bytes_sent = 0
        self._avg_latency_ms = 0.0
        
        # Database for event monitoring
        self._database: Optional[LocalDatabase] = None
        
        logger.info("ConnectionManager initialized")
    
    async def startup(self):
        """Initialize async components."""
        try:
            # Initialize event queue
            self._event_queue = asyncio.Queue(maxsize=EVENT_QUEUE_SIZE)
            
            # Initialize database
            self._database = create_local_database()
            
            # Start background tasks
            self._broadcast_task = asyncio.create_task(self._broadcast_loop())
            self._heartbeat_task = asyncio.create_task(self._heartbeat_loop())
            
            logger.info("ConnectionManager startup completed")
            
        except Exception as e:
            logger.error(f"ConnectionManager startup failed: {e}")
            raise
    
    async def shutdown(self):
        """Cleanup async components."""
        try:
            # Cancel background tasks
            if self._broadcast_task:
                self._broadcast_task.cancel()
                
            if self._heartbeat_task:
                self._heartbeat_task.cancel()
            
            # Close all connections
            with self._connection_lock:
                for connection_info in list(self._connections.values()):
                    try:
                        await connection_info.websocket.close()
                    except:
                        pass
                
                self._connections.clear()
            
            # Close database
            if self._database:
                self._database.close()
            
            logger.info("ConnectionManager shutdown completed")
            
        except Exception as e:
            logger.error(f"ConnectionManager shutdown error: {e}")
    
    async def connect(self, websocket: WebSocket, client_info: Optional[Dict[str, Any]] = None) -> str:
        """
        Accept a new WebSocket connection.
        
        Args:
            websocket: WebSocket instance
            client_info: Optional client information
            
        Returns:
            Connection ID
        """
        connection_id = str(uuid.uuid4())
        
        try:
            await websocket.accept()
            
            with self._connection_lock:
                connection_info = ConnectionInfo(
                    id=connection_id,
                    websocket=websocket,
                    connected_at=time.time(),
                    client_info=client_info or {}
                )
                
                self._connections[connection_id] = connection_info
                self._total_connections += 1
            
            logger.info(f"WebSocket connected: {connection_id} (total: {len(self._connections)})")
            
            # Send welcome message
            welcome_event = EventMessage(
                id=str(uuid.uuid4()),
                event_type="connection_established", 
                timestamp=datetime.now(timezone.utc).isoformat(),
                session_id="system",
                data={
                    "connection_id": connection_id,
                    "server_time": datetime.now(timezone.utc).isoformat(),
                    "heartbeat_interval": HEARTBEAT_INTERVAL
                },
                created_at=time.time()
            )
            
            await self._send_to_connection(connection_id, welcome_event)
            
            return connection_id
            
        except Exception as e:
            logger.error(f"Failed to accept connection: {e}")
            raise
    
    async def disconnect(self, connection_id: str):
        """
        Remove a WebSocket connection.
        
        Args:
            connection_id: Connection ID to remove
        """
        with self._connection_lock:
            connection_info = self._connections.pop(connection_id, None)
            
        if connection_info:
            logger.info(f"WebSocket disconnected: {connection_id} (total: {len(self._connections)})")
            
            # Log connection metrics
            duration = time.time() - connection_info.connected_at
            logger.info(f"Connection {connection_id} stats: "
                       f"duration={duration:.1f}s, "
                       f"messages={connection_info.message_count}, "
                       f"bytes={connection_info.bytes_sent}")
    
    async def broadcast_event(self, event: EventMessage):
        """
        Broadcast an event to all connected clients.
        
        Args:
            event: Event to broadcast
        """
        if not self._event_queue:
            logger.warning("Event queue not initialized")
            return
            
        try:
            # Add to broadcast queue (non-blocking)
            self._event_queue.put_nowait(event)
            
        except asyncio.QueueFull:
            logger.error("Event queue is full, dropping event")
            # TODO: Implement event persistence for recovery
    
    async def _broadcast_loop(self):
        """Background task for broadcasting events."""
        logger.info("Broadcast loop started")
        
        try:
            while True:
                # Get event from queue
                event = await self._event_queue.get()
                
                if not self._connections:
                    # No connections, skip event
                    self._event_queue.task_done()
                    continue
                
                # Broadcast to all connections
                start_time = time.time()
                
                broadcast_tasks = []
                with self._connection_lock:
                    for connection_id in list(self._connections.keys()):
                        task = asyncio.create_task(
                            self._send_to_connection(connection_id, event)
                        )
                        broadcast_tasks.append(task)
                
                # Wait for all broadcasts with timeout
                if broadcast_tasks:
                    try:
                        await asyncio.wait_for(
                            asyncio.gather(*broadcast_tasks, return_exceptions=True),
                            timeout=0.1  # 100ms timeout
                        )
                    except asyncio.TimeoutError:
                        logger.warning("Broadcast timeout exceeded")
                
                # Calculate and log latency
                broadcast_time = (time.time() - start_time) * 1000
                if broadcast_time > LATENCY_TARGET_MS:
                    logger.warning(f"Broadcast latency exceeded target: {broadcast_time:.2f}ms > {LATENCY_TARGET_MS}ms")
                else:
                    logger.debug(f"Event broadcast completed: {broadcast_time:.2f}ms")
                
                self._event_queue.task_done()
                
        except asyncio.CancelledError:
            logger.info("Broadcast loop cancelled")
        except Exception as e:
            logger.error(f"Broadcast loop error: {e}")
    
    async def _send_to_connection(self, connection_id: str, event: EventMessage):
        """Send event to a specific connection."""
        with self._connection_lock:
            connection_info = self._connections.get(connection_id)
        
        if not connection_info:
            return
            
        try:
            # Prepare message
            message = event.to_json()
            message_bytes = len(message.encode('utf-8'))
            
            # Check message size
            if message_bytes > MAX_MESSAGE_SIZE:
                logger.warning(f"Message too large: {message_bytes} bytes")
                return
            
            # Send message
            send_start = time.time()
            await connection_info.websocket.send_text(message)
            send_duration = (time.time() - send_start) * 1000
            
            # Update connection stats
            with self._connection_lock:
                if connection_id in self._connections:
                    connection_info.message_count += 1
                    connection_info.bytes_sent += message_bytes
                    connection_info.latency_ms = send_duration
                    
                    self._total_messages_sent += 1
                    self._total_bytes_sent += message_bytes
            
            logger.debug(f"Sent to {connection_id}: {event.event_type} ({send_duration:.2f}ms)")
            
        except Exception as e:
            logger.warning(f"Failed to send to connection {connection_id}: {e}")
            # Remove failed connection
            await self.disconnect(connection_id)
    
    async def _heartbeat_loop(self):
        """Background task for connection heartbeat."""
        logger.info("Heartbeat loop started")
        
        try:
            while True:
                await asyncio.sleep(HEARTBEAT_INTERVAL)
                
                current_time = time.time()
                disconnected_connections = []
                
                with self._connection_lock:
                    for connection_id, connection_info in self._connections.items():
                        try:
                            # Send ping
                            ping_data = {
                                "type": "ping",
                                "timestamp": datetime.now(timezone.utc).isoformat(),
                                "server_time": current_time
                            }
                            
                            await connection_info.websocket.send_text(json_impl.dumps(ping_data))
                            connection_info.last_ping = current_time
                            
                        except Exception as e:
                            logger.warning(f"Heartbeat failed for {connection_id}: {e}")
                            disconnected_connections.append(connection_id)
                
                # Clean up failed connections
                for connection_id in disconnected_connections:
                    await self.disconnect(connection_id)
                
                if self._connections:
                    logger.debug(f"Heartbeat sent to {len(self._connections)} connections")
                
        except asyncio.CancelledError:
            logger.info("Heartbeat loop cancelled")
        except Exception as e:
            logger.error(f"Heartbeat loop error: {e}")
    
    def get_connection_stats(self) -> Dict[str, Any]:
        """Get connection statistics."""
        with self._connection_lock:
            active_connections = len(self._connections)
            
            if active_connections > 0:
                avg_latency = sum(c.latency_ms for c in self._connections.values()) / active_connections
            else:
                avg_latency = 0.0
        
        return {
            "active_connections": active_connections,
            "total_connections": self._total_connections,
            "total_messages_sent": self._total_messages_sent,
            "total_bytes_sent": self._total_bytes_sent,
            "avg_latency_ms": round(avg_latency, 2),
            "event_queue_size": self._event_queue.qsize() if self._event_queue else 0
        }


# Global connection manager instance
connection_manager = ConnectionManager()


class ChronicleWebSocketServer:
    """
    Chronicle WebSocket and SSE server implementation.
    
    Provides real-time event streaming to replace Supabase functionality
    with high-performance local implementation.
    """
    
    def __init__(self, database: Optional[LocalDatabase] = None):
        self.database = database or create_local_database()
        self.app = FastAPI(
            title="Chronicle Real-time Events",
            description="WebSocket and SSE endpoints for Chronicle event streaming",
            version="1.0.0"
        )
        
        # Setup lifespan events
        @self.app.on_event("startup")
        async def startup_event():
            await connection_manager.startup()
            logger.info("Chronicle WebSocket server started on port 8510")
        
        @self.app.on_event("shutdown")
        async def shutdown_event():
            await connection_manager.shutdown()
            logger.info("Chronicle WebSocket server shutdown")
        
        self._setup_routes()
        
        logger.info("ChronicleWebSocketServer initialized")
    
    def _setup_routes(self):
        """Setup WebSocket and HTTP routes."""
        
        @self.app.websocket(WEBSOCKET_ENDPOINT)
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
                            timeout=HEARTBEAT_INTERVAL * 2
                        )
                        
                        # Parse message
                        try:
                            data = json_impl.loads(message)
                            await self._handle_client_message(connection_id, data)
                        except json.JSONDecodeError:
                            logger.warning(f"Invalid JSON from {connection_id}")
                        
                    except asyncio.TimeoutError:
                        logger.debug(f"No message from {connection_id} (timeout)")
                        # Client should be sending pings, disconnect if silent
                        break
                    
            except WebSocketDisconnect:
                logger.debug(f"WebSocket disconnected: {connection_id}")
            except Exception as e:
                logger.error(f"WebSocket error for {connection_id}: {e}")
            finally:
                if connection_id:
                    await connection_manager.disconnect(connection_id)
        
        @self.app.get(SSE_ENDPOINT)
        async def sse_endpoint(request: Request):
            """Server-Sent Events endpoint as WebSocket fallback."""
            
            async def event_generator():
                """Generate SSE events."""
                try:
                    # Send connection established event
                    connection_event = EventMessage(
                        id=str(uuid.uuid4()),
                        event_type="sse_connected",
                        timestamp=datetime.now(timezone.utc).isoformat(),
                        session_id="system",
                        data={
                            "client_ip": request.client.host,
                            "user_agent": request.headers.get("user-agent", "unknown")
                        },
                        created_at=time.time()
                    )
                    
                    yield f"data: {connection_event.to_json()}\n\n"
                    
                    # Monitor for new events
                    last_event_time = time.time()
                    
                    while True:
                        # Check for client disconnect
                        if await request.is_disconnected():
                            logger.debug("SSE client disconnected")
                            break
                        
                        # Poll database for new events
                        current_time = time.time()
                        if current_time - last_event_time > 1.0:  # Poll every second
                            recent_events = self._get_recent_events(since=last_event_time)
                            
                            for event_data in recent_events:
                                event = self._database_event_to_message(event_data)
                                yield f"data: {event.to_json()}\n\n"
                            
                            last_event_time = current_time
                        
                        # Send heartbeat every 30 seconds
                        if current_time % 30 < 1:
                            heartbeat = {
                                "type": "heartbeat",
                                "timestamp": datetime.now(timezone.utc).isoformat()
                            }
                            yield f"data: {json_impl.dumps(heartbeat)}\n\n"
                        
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
        
        @self.app.get("/api/stats")
        async def stats_endpoint():
            """Get server statistics."""
            return {
                "server": "Chronicle WebSocket Server",
                "version": "1.0.0", 
                "port": 8510,
                "endpoints": {
                    "websocket": f"ws://localhost:8510{WEBSOCKET_ENDPOINT}",
                    "sse": f"http://localhost:8510{SSE_ENDPOINT}"
                },
                "connections": connection_manager.get_connection_stats(),
                "database": self.database.get_performance_stats() if self.database else None
            }
        
        @self.app.get("/health")
        async def health_check():
            """Health check endpoint."""
            db_healthy = self.database.test_connection() if self.database else False
            
            return {
                "status": "healthy" if db_healthy else "unhealthy",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "database": db_healthy,
                "connections": len(connection_manager._connections)
            }
    
    async def _handle_client_message(self, connection_id: str, data: Dict[str, Any]):
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
    
    def _get_recent_events(self, since: float, limit: int = 100) -> List[Dict[str, Any]]:
        """Get recent events from database for SSE."""
        try:
            if not self.database:
                return []
            
            # Convert timestamp to ISO format for database query
            since_iso = datetime.fromtimestamp(since, timezone.utc).isoformat()
            
            # Query recent events (simplified - would need proper filtering)
            with self.database._get_connection() as conn:
                conn.row_factory = lambda cursor, row: {
                    col[0]: row[idx] for idx, col in enumerate(cursor.description)
                }
                
                cursor = conn.execute("""
                    SELECT e.*, s.claude_session_id, s.project_path
                    FROM chronicle_events e
                    JOIN chronicle_sessions s ON e.session_id = s.id
                    WHERE e.created_at > ?
                    ORDER BY e.timestamp DESC
                    LIMIT ?
                """, (since_iso, limit))
                
                return cursor.fetchall()
                
        except Exception as e:
            logger.error(f"Failed to get recent events: {e}")
            return []
    
    def _database_event_to_message(self, event_data: Dict[str, Any]) -> EventMessage:
        """Convert database event to EventMessage."""
        return EventMessage(
            id=event_data.get("id", str(uuid.uuid4())),
            event_type=event_data.get("event_type", "unknown"),
            timestamp=event_data.get("timestamp", datetime.now(timezone.utc).isoformat()),
            session_id=event_data.get("session_id", "unknown"),
            data={
                "metadata": json_impl.loads(event_data.get("metadata", "{}")),
                "tool_name": event_data.get("tool_name"),
                "duration_ms": event_data.get("duration_ms"),
                "claude_session_id": event_data.get("claude_session_id"),
                "project_path": event_data.get("project_path")
            },
            created_at=time.time()
        )
    
    async def broadcast_database_event(self, event_data: Dict[str, Any]):
        """Broadcast a database event to all connected clients."""
        event = self._database_event_to_message(event_data)
        await connection_manager.broadcast_event(event)
    
    def run_server(self, host: str = "127.0.0.1", port: int = 8510):
        """Run the WebSocket server."""
        logger.info(f"Starting Chronicle WebSocket server on {host}:{port}")
        
        uvicorn.run(
            self.app,
            host=host,
            port=port,
            log_level="info",
            access_log=True
        )


# Factory function for easy initialization
def create_websocket_server(database: Optional[LocalDatabase] = None) -> ChronicleWebSocketServer:
    """
    Create a ChronicleWebSocketServer instance.
    
    Args:
        database: Optional database instance
        
    Returns:
        Configured server instance
    """
    return ChronicleWebSocketServer(database=database)


if __name__ == "__main__":
    # Quick test if run directly
    print("Chronicle WebSocket & SSE Server")
    print("=================================")
    print(f"WebSocket: ws://localhost:8510{WEBSOCKET_ENDPOINT}")
    print(f"SSE:       http://localhost:8510{SSE_ENDPOINT}")
    print(f"Stats:     http://localhost:8510/api/stats")
    print(f"Health:    http://localhost:8510/health")
    print()
    
    try:
        server = create_websocket_server()
        server.run_server()
    except KeyboardInterrupt:
        print("\nShutting down server...")
    except Exception as e:
        print(f"Server error: {e}")