#!/usr/bin/env python3
"""
Quick test script to verify server functionality after relocation.
Run from the server directory: python test_server.py
"""

import sys
import os
import time
import json
from pathlib import Path

# Add current directory to path
sys.path.insert(0, str(Path(__file__).parent))

def test_imports():
    """Test all module imports."""
    print("\n1️⃣  Testing module imports...")
    try:
        from main import app, API_VERSION
        from database import LocalDatabase
        from websocket import ChronicleWebSocketServer, ConnectionManager
        from api_endpoints import router
        from event_broadcaster import EventBroadcaster
        print("   ✅ All modules import successfully")
        return True
    except ImportError as e:
        print(f"   ❌ Import failed: {e}")
        return False

def test_database():
    """Test database functionality."""
    print("\n2️⃣  Testing database...")
    try:
        from database import LocalDatabase
        from datetime import datetime
        
        db = LocalDatabase()
        print(f"   ✅ Database initialized at: {db.db_path}")
        
        # Test connection
        if db.test_connection():
            print("   ✅ Database connection verified")
        
        # Test operations
        session_data = {
            'session_id': f'test-{int(time.time())}',
            'start_time': datetime.now().isoformat(),
            'metadata': {'test': True}
        }
        db.save_session(session_data)
        print("   ✅ Database write operations work")
        
        sessions = db.get_recent_sessions(limit=1)
        print(f"   ✅ Database read operations work ({len(sessions)} sessions)")
        
        stats = db.get_performance_stats()
        print(f"   ✅ Performance stats: {stats['event_count']} events, {stats['session_count']} sessions")
        
        db.close()
        return True
    except Exception as e:
        print(f"   ❌ Database test failed: {e}")
        return False

def test_api():
    """Test API endpoints."""
    print("\n3️⃣  Testing API endpoints...")
    try:
        from fastapi.testclient import TestClient
        from main import app
        
        client = TestClient(app)
        
        # Test endpoints
        endpoints = [
            '/health',
            '/api/info', 
            '/api/stats',
            '/api/sessions',
        ]
        
        all_good = True
        for endpoint in endpoints:
            response = client.get(endpoint)
            if response.status_code == 200:
                print(f"   ✅ {endpoint:20} OK")
            else:
                print(f"   ❌ {endpoint:20} Status: {response.status_code}")
                all_good = False
        
        return all_good
    except Exception as e:
        print(f"   ❌ API test failed: {e}")
        return False

def test_websocket():
    """Test WebSocket components."""
    print("\n4️⃣  Testing WebSocket components...")
    try:
        from websocket import ConnectionManager
        from event_broadcaster import EventBroadcaster
        from database import LocalDatabase
        
        conn_mgr = ConnectionManager()
        print("   ✅ WebSocket connection manager initialized")
        
        db = LocalDatabase()
        broadcaster = EventBroadcaster(db)
        print("   ✅ Event broadcaster initialized")
        
        db.close()
        return True
    except Exception as e:
        print(f"   ❌ WebSocket test failed: {e}")
        return False

def main():
    """Run all tests."""
    print("=" * 60)
    print("🧪 CHRONICLE SERVER TEST SUITE")
    print("=" * 60)
    print(f"📍 Working directory: {os.getcwd()}")
    print(f"🐍 Python version: {sys.version.split()[0]}")
    
    results = []
    
    # Run tests
    results.append(("Imports", test_imports()))
    results.append(("Database", test_database()))
    results.append(("API", test_api()))
    results.append(("WebSocket", test_websocket()))
    
    # Summary
    print("\n" + "=" * 60)
    print("📊 TEST SUMMARY")
    print("=" * 60)
    
    all_passed = True
    for name, passed in results:
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"   {name:15} {status}")
        if not passed:
            all_passed = False
    
    print("=" * 60)
    if all_passed:
        print("🎉 ALL TESTS PASSED!")
        print("✅ Server is fully functional after relocation")
        print("🚀 Ready to run on port 8510 (Oakland represent!)")
    else:
        print("⚠️  Some tests failed - review output above")
    print("=" * 60)
    
    return 0 if all_passed else 1

if __name__ == "__main__":
    sys.exit(main())