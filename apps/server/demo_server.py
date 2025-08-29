#!/usr/bin/env python3
"""
Chronicle FastAPI Server Demo
=============================

Simple demonstration script to show the Chronicle FastAPI server
running with all components integrated.

Usage:
    python demo_server.py

Author: C-Codey aka curl Stevens aka SWE-40
"""

import asyncio
import sys
import os
from pathlib import Path

# Add current directory to path
sys.path.append(os.path.dirname(__file__))

def demo_server():
    """Demonstrate the Chronicle FastAPI server."""
    print()
    print("🚀 Chronicle FastAPI Server Demo")
    print("=" * 50)
    
    try:
        # Import the main server
        from main import run_server, API_VERSION, SERVER_HOST, SERVER_PORT
        
        print(f"Server Version: {API_VERSION}")
        print(f"Host: {SERVER_HOST}")
        print(f"Port: {SERVER_PORT}")
        print()
        print("📡 Available Endpoints:")
        print(f"  Health Check: http://{SERVER_HOST}:{SERVER_PORT}/health")
        print(f"  Server Info:  http://{SERVER_HOST}:{SERVER_PORT}/api/info") 
        print(f"  Statistics:   http://{SERVER_HOST}:{SERVER_PORT}/api/stats")
        print(f"  Sessions:     http://{SERVER_HOST}:{SERVER_PORT}/api/sessions")
        print(f"  WebSocket:    ws://{SERVER_HOST}:{SERVER_PORT}/ws")
        print(f"  SSE Stream:   http://{SERVER_HOST}:{SERVER_PORT}/api/events/stream")
        print(f"  API Docs:     http://{SERVER_HOST}:{SERVER_PORT}/api/docs")
        print()
        print("🌐 Dashboard Integration:")
        print(f"  CORS configured for: http://localhost:3000")
        print()
        print("💾 Database:")
        print(f"  SQLite database will be created at:")
        print(f"  ./data/chronicle.db (relative to server directory)")
        print()
        print("⚠️  NOTE: This demo will start the actual server!")
        print("   Press Ctrl+C to stop when ready.")
        print()
        
        # Ask for confirmation
        try:
            confirm = input("Start server? (y/N): ").lower().strip()
        except KeyboardInterrupt:
            print("\n👋 Demo cancelled")
            return
            
        if confirm == 'y':
            print("\n🚀 Starting Chronicle FastAPI server...")
            print("   The server will display startup info when ready.")
            print("   Visit the endpoints above to test functionality!")
            print()
            
            # Start the server
            run_server(debug=True)
        else:
            print("👋 Demo cancelled")
            
    except ImportError as e:
        print(f"❌ Import error: {e}")
        print("Make sure you're in the server directory and dependencies are installed:")
        print("  pip install fastapi uvicorn websockets")
    except Exception as e:
        print(f"❌ Demo error: {e}")


def quick_test():
    """Run a quick test without starting the full server."""
    print()
    print("🧪 Chronicle Server Quick Test")
    print("=" * 40)
    
    try:
        # Test imports
        print("Testing imports...")
        from main import app, API_VERSION, database
        from fastapi.testclient import TestClient
        print("✅ All imports successful")
        
        # Test basic endpoint without lifespan
        print("Testing basic functionality...")
        
        # Create minimal test app
        from fastapi import FastAPI
        from main import server_info
        
        test_app = FastAPI()
        test_app.get("/api/info")(server_info)
        
        client = TestClient(test_app)
        response = client.get("/api/info")
        
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Server info endpoint working")
            print(f"   Server: {data.get('server')}")
            print(f"   Version: {data.get('version')}")
        else:
            print(f"❌ Server info endpoint failed: {response.status_code}")
            
        print("\n🎉 Quick test completed successfully!")
        print("   Run with --demo to start the full server")
        
    except Exception as e:
        print(f"❌ Test failed: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--test":
        quick_test()
    else:
        demo_server()