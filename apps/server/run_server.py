#!/usr/bin/env python3
"""
Chronicle Real-time Server Launcher
===================================

Easy launcher for the Chronicle WebSocket and SSE server with event broadcasting.
Handles server startup, database initialization, and graceful shutdown.

Usage:
    python run_server.py [--port 8510] [--host 127.0.0.1] [--debug]

Author: C-Codey aka curl Stevens aka SWE-40
Port: 8510 (The Town's official port!)
"""

import argparse
import asyncio
import logging
import signal
import sys
import time
from pathlib import Path

# Local imports
try:
    from .database import create_local_database
    from .websocket import create_websocket_server
    from .event_broadcaster import create_event_broadcaster
except ImportError:
    # Fallback for standalone execution
    import sys
    import os
    sys.path.append(os.path.dirname(__file__))
    from database import create_local_database
    from websocket import create_websocket_server
    from event_broadcaster import create_event_broadcaster

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


class ChronicleServerLauncher:
    """Launcher for Chronicle real-time server with all components."""
    
    def __init__(self, host: str = "127.0.0.1", port: int = 8510, debug: bool = False):
        self.host = host
        self.port = port
        self.debug = debug
        
        # Components
        self.database = None
        self.server = None
        self.broadcaster = None
        
        # Server task
        self.server_task = None
        self.shutdown_event = asyncio.Event()
        
        if debug:
            logging.getLogger().setLevel(logging.DEBUG)
            logger.debug("Debug mode enabled")
    
    async def initialize_components(self):
        """Initialize all server components."""
        try:
            logger.info("Initializing Chronicle server components...")
            
            # Initialize database
            logger.info("Setting up database...")
            self.database = create_local_database()
            
            if not self.database.test_connection():
                raise Exception("Database connection test failed")
            
            logger.info(f"✓ Database initialized: {self.database.db_path}")
            
            # Initialize WebSocket server
            logger.info("Setting up WebSocket server...")
            self.server = create_websocket_server(self.database)
            logger.info("✓ WebSocket server initialized")
            
            # Initialize event broadcaster
            logger.info("Setting up event broadcaster...")
            self.broadcaster = create_event_broadcaster(self.database)
            await self.broadcaster.start_monitoring()
            logger.info("✓ Event broadcaster started")
            
            logger.info("All components initialized successfully!")
            
        except Exception as e:
            logger.error(f"Component initialization failed: {e}")
            raise
    
    async def start_server(self):
        """Start the Chronicle server."""
        try:
            logger.info(f"Starting Chronicle server on {self.host}:{self.port}")
            
            # Display server information
            self._display_server_info()
            
            # Start server (this blocks)
            import uvicorn
            config = uvicorn.Config(
                self.server.app,
                host=self.host,
                port=self.port,
                log_level="debug" if self.debug else "info",
                access_log=True
            )
            server = uvicorn.Server(config)
            await server.serve()
            
        except Exception as e:
            logger.error(f"Server startup failed: {e}")
            raise
    
    async def shutdown(self):
        """Gracefully shutdown all components."""
        logger.info("Shutting down Chronicle server...")
        
        try:
            # Stop event broadcaster
            if self.broadcaster:
                await self.broadcaster.stop_monitoring()
                logger.info("✓ Event broadcaster stopped")
            
            # Close database
            if self.database:
                self.database.close()
                logger.info("✓ Database closed")
            
            logger.info("Chronicle server shutdown complete")
            
        except Exception as e:
            logger.error(f"Shutdown error: {e}")
    
    def _display_server_info(self):
        """Display server startup information."""
        print()
        print("=" * 60)
        print("🚀 CHRONICLE REAL-TIME SERVER")
        print("=" * 60)
        print(f"Host:      {self.host}")
        print(f"Port:      {self.port}")
        print(f"Debug:     {self.debug}")
        print()
        print("ENDPOINTS:")
        print(f"WebSocket: ws://{self.host}:{self.port}/ws")
        print(f"SSE:       http://{self.host}:{self.port}/api/events/stream")
        print(f"Stats:     http://{self.host}:{self.port}/api/stats")
        print(f"Health:    http://{self.host}:{self.port}/health")
        print()
        print("DATABASE:")
        if self.database:
            print(f"Path:      {self.database.db_path}")
            print(f"Status:    {'✓ Connected' if self.database.test_connection() else '✗ Error'}")
            
            # Show database stats
            stats = self.database.get_performance_stats()
            print(f"Sessions:  {stats.get('session_count', 0)}")
            print(f"Events:    {stats.get('event_count', 0)}")
            print(f"Size:      {stats.get('db_size_mb', 0)} MB")
        print()
        print("EVENT BROADCASTING:")
        if self.broadcaster:
            broadcaster_stats = self.broadcaster.get_stats()
            print(f"Status:    {'✓ Active' if broadcaster_stats['running'] else '✗ Stopped'}")
            print(f"Events:    {broadcaster_stats['events_broadcasted']}")
            print(f"Latency:   {broadcaster_stats['avg_latency_ms']} ms")
        print()
        print("=" * 60)
        print("Server is running! Press Ctrl+C to stop.")
        print("=" * 60)
        print()


def setup_signal_handlers(launcher: ChronicleServerLauncher):
    """Setup signal handlers for graceful shutdown."""
    
    def signal_handler(signum, frame):
        logger.info(f"Received signal {signum}, initiating shutdown...")
        launcher.shutdown_event.set()
    
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)


async def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(description="Chronicle Real-time Server")
    parser.add_argument("--host", default="127.0.0.1", help="Host to bind to")
    parser.add_argument("--port", type=int, default=8510, help="Port to bind to")
    parser.add_argument("--debug", action="store_true", help="Enable debug mode")
    
    args = parser.parse_args()
    
    # Create launcher
    launcher = ChronicleServerLauncher(
        host=args.host,
        port=args.port,
        debug=args.debug
    )
    
    # Setup signal handlers
    setup_signal_handlers(launcher)
    
    try:
        # Initialize components
        await launcher.initialize_components()
        
        # Start server (this blocks until shutdown)
        server_task = asyncio.create_task(launcher.start_server())
        shutdown_task = asyncio.create_task(launcher.shutdown_event.wait())
        
        # Wait for either server completion or shutdown signal
        done, pending = await asyncio.wait(
            [server_task, shutdown_task],
            return_when=asyncio.FIRST_COMPLETED
        )
        
        # Cancel pending tasks
        for task in pending:
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass
        
    except KeyboardInterrupt:
        logger.info("Keyboard interrupt received")
    except Exception as e:
        logger.error(f"Server error: {e}")
        sys.exit(1)
    finally:
        # Always attempt graceful shutdown
        await launcher.shutdown()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nServer stopped by user")
    except Exception as e:
        print(f"Server failed: {e}")
        sys.exit(1)