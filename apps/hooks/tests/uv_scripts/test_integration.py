#!/usr/bin/env python3
"""
Integration tests for UV single-file scripts.

Tests end-to-end scenarios with multiple hooks interacting.
"""

import json
import os
import sqlite3
import time
import pytest
from pathlib import Path
from test_utils import (
    HookTestCase, assert_performance, temp_env_vars, 
    temp_sqlite_db, create_test_git_repo
)


@pytest.mark.integration
class TestEndToEndScenarios:
    """Test complete Claude Code session scenarios."""
    
    def test_full_session_lifecycle(self, test_env, sqlite_db):
        """Test a complete session from start to stop."""
        session_id = f"integration-test-{int(time.time())}"
        
        # 1. Session Start
        session_hook = HookTestCase("SessionStart", "session_start_uv.py")
        session_input = session_hook.create_test_input(
            sessionId=session_id,
            source="startup"
        )
        
        exit_code, stdout, stderr, exec_time = session_hook.run_hook(session_input)
        assert exit_code == 0
        assert_performance(exec_time)
        
        session_response = session_hook.parse_hook_output(stdout)
        session_uuid = session_response["hookSpecificOutput"].get("sessionUuid")
        assert session_uuid is not None
        
        # 2. User Prompt
        prompt_hook = HookTestCase("UserPromptSubmit", "user_prompt_submit_uv.py")
        prompt_input = prompt_hook.create_test_input(
            sessionId=session_id,
            prompt="Create a hello world Python script"
        )
        
        exit_code, stdout, stderr, exec_time = prompt_hook.run_hook(prompt_input)
        assert exit_code == 0
        assert_performance(exec_time)
        
        # 3. Pre Tool Use (Write)
        pre_hook = HookTestCase("PreToolUse", "pre_tool_use_uv.py")
        pre_input = pre_hook.create_test_input(
            sessionId=session_id,
            toolName="Write",
            toolInput={
                "file_path": "/tmp/hello.py",
                "content": "print('Hello, World!')"
            }
        )
        
        exit_code, stdout, stderr, exec_time = pre_hook.run_hook(pre_input)
        assert exit_code == 0
        assert_performance(exec_time)
        
        # 4. Post Tool Use
        post_hook = HookTestCase("PostToolUse", "post_tool_use_uv.py")
        post_input = post_hook.create_test_input(
            sessionId=session_id,
            toolName="Write",
            toolInput={
                "file_path": "/tmp/hello.py",
                "content": "print('Hello, World!')"
            },
            toolResponse={
                "filePath": "/tmp/hello.py",
                "success": True
            }
        )
        
        exit_code, stdout, stderr, exec_time = post_hook.run_hook(post_input)
        assert exit_code == 0
        assert_performance(exec_time)
        
        # 5. Stop
        stop_hook = HookTestCase("Stop", "stop_uv.py")
        stop_input = stop_hook.create_test_input(
            sessionId=session_id,
            stopHookActive=False
        )
        
        exit_code, stdout, stderr, exec_time = stop_hook.run_hook(stop_input)
        assert exit_code == 0
        assert_performance(exec_time)
        
        # Verify database contains all events
        with sqlite3.connect(sqlite_db) as conn:
            # Check session
            cursor = conn.execute(
                "SELECT COUNT(*) FROM sessions WHERE claude_session_id = ?",
                (session_id,)
            )
            assert cursor.fetchone()[0] == 1
            
            # Check events
            cursor = conn.execute(
                "SELECT event_type FROM events WHERE session_id IN "
                "(SELECT id FROM sessions WHERE claude_session_id = ?) "
                "ORDER BY created_at",
                (session_id,)
            )
            events = [row[0] for row in cursor.fetchall()]
            
            assert "session_start" in events
            assert "user_prompt_submit" in events
            assert "pre_tool_use" in events
            assert "post_tool_use" in events
            assert "stop" in events
    
    def test_subagent_task_flow(self, test_env, sqlite_db):
        """Test subagent task execution flow."""
        session_id = f"subagent-test-{int(time.time())}"
        task_id = "task-123"
        
        # Start session
        session_hook = HookTestCase("SessionStart", "session_start_uv.py")
        session_input = session_hook.create_test_input(
            sessionId=session_id,
            source="startup"
        )
        exit_code, _, _, _ = session_hook.run_hook(session_input)
        assert exit_code == 0
        
        # Pre tool use for Task
        pre_hook = HookTestCase("PreToolUse", "pre_tool_use_uv.py")
        pre_input = pre_hook.create_test_input(
            sessionId=session_id,
            toolName="Task",
            toolInput={
                "task": "Analyze code quality",
                "context": "Focus on Python files"
            }
        )
        
        exit_code, stdout, stderr, exec_time = pre_hook.run_hook(pre_input)
        assert exit_code == 0
        assert_performance(exec_time)
        
        # Post tool use for Task
        post_hook = HookTestCase("PostToolUse", "post_tool_use_uv.py")
        post_input = post_hook.create_test_input(
            sessionId=session_id,
            toolName="Task",
            toolInput={
                "task": "Analyze code quality"
            },
            toolResponse={
                "result": "Analysis complete. Found 3 issues.",
                "success": True
            }
        )
        
        exit_code, stdout, stderr, exec_time = post_hook.run_hook(post_input)
        assert exit_code == 0
        assert_performance(exec_time)
        
        # Subagent stop
        subagent_hook = HookTestCase("SubagentStop", "subagent_stop_uv.py")
        subagent_input = subagent_hook.create_test_input(
            sessionId=session_id,
            taskId=task_id,
            taskDescription="Analyze code quality"
        )
        
        exit_code, stdout, stderr, exec_time = subagent_hook.run_hook(subagent_input)
        assert exit_code == 0
        assert_performance(exec_time)
    
    def test_notification_and_permission_flow(self, test_env):
        """Test notification and permission request flow."""
        session_id = f"notification-test-{int(time.time())}"
        
        # Notification for permission request
        notif_hook = HookTestCase("Notification", "notification_uv.py")
        notif_input = notif_hook.create_test_input(
            sessionId=session_id,
            message="Claude needs your permission to use Bash"
        )
        
        exit_code, stdout, stderr, exec_time = notif_hook.run_hook(notif_input)
        assert exit_code == 0
        assert_performance(exec_time)
        
        # Pre tool use with potential denial
        pre_hook = HookTestCase("PreToolUse", "pre_tool_use_uv.py")
        pre_input = pre_hook.create_test_input(
            sessionId=session_id,
            toolName="Bash",
            toolInput={
                "command": "rm -rf /important/files"
            }
        )
        
        exit_code, stdout, stderr, exec_time = pre_hook.run_hook(pre_input)
        # Could be denied (exit code 2) or allowed with warning
        assert exit_code in [0, 2]
        assert_performance(exec_time)
    
    def test_compaction_flow(self, test_env, sqlite_db):
        """Test conversation compaction flow."""
        session_id = f"compact-test-{int(time.time())}"
        
        # Simulate a session with multiple events
        hooks = [
            ("SessionStart", "session_start_uv.py", {"source": "startup"}),
            ("UserPromptSubmit", "user_prompt_submit_uv.py", {"prompt": "Test 1"}),
            ("UserPromptSubmit", "user_prompt_submit_uv.py", {"prompt": "Test 2"}),
            ("UserPromptSubmit", "user_prompt_submit_uv.py", {"prompt": "Test 3"}),
        ]
        
        for hook_name, script_name, extra_data in hooks:
            hook = HookTestCase(hook_name, script_name)
            input_data = hook.create_test_input(sessionId=session_id, **extra_data)
            exit_code, _, _, _ = hook.run_hook(input_data)
            assert exit_code == 0
        
        # Trigger manual compaction
        compact_hook = HookTestCase("PreCompact", "pre_compact_uv.py")
        compact_input = compact_hook.create_test_input(
            sessionId=session_id,
            trigger="manual",
            customInstructions="Keep only important context"
        )
        
        exit_code, stdout, stderr, exec_time = compact_hook.run_hook(compact_input)
        assert exit_code == 0
        assert_performance(exec_time)
        
        # Verify compaction event was logged
        with sqlite3.connect(sqlite_db) as conn:
            cursor = conn.execute(
                "SELECT COUNT(*) FROM events WHERE event_type = 'pre_compact'"
            )
            assert cursor.fetchone()[0] > 0
    
    def test_error_recovery_flow(self, test_env):
        """Test error handling and recovery across hooks."""
        session_id = f"error-test-{int(time.time())}"
        
        # Pre tool use with problematic input
        pre_hook = HookTestCase("PreToolUse", "pre_tool_use_uv.py")
        pre_input = pre_hook.create_test_input(
            sessionId=session_id,
            toolName="Write",
            toolInput={
                "file_path": "/root/system/critical.conf",
                "content": "dangerous content"
            }
        )
        
        exit_code, stdout, stderr, exec_time = pre_hook.run_hook(pre_input)
        # Should handle gracefully
        assert exit_code in [0, 2]
        assert_performance(exec_time)
        
        # Post tool use with failure
        post_hook = HookTestCase("PostToolUse", "post_tool_use_uv.py")
        post_input = post_hook.create_test_input(
            sessionId=session_id,
            toolName="Write",
            toolInput={
                "file_path": "/root/system/critical.conf",
                "content": "dangerous content"
            },
            toolResponse={
                "error": "Permission denied",
                "success": False
            }
        )
        
        exit_code, stdout, stderr, exec_time = post_hook.run_hook(post_input)
        assert exit_code == 0
        assert_performance(exec_time)
    
    def test_concurrent_hook_execution(self, test_env):
        """Test that hooks can handle concurrent execution."""
        import concurrent.futures
        import threading
        
        def run_hook_concurrent(hook_name, script_name, session_num):
            hook = HookTestCase(hook_name, script_name)
            input_data = hook.create_test_input(
                sessionId=f"concurrent-{session_num}",
                source="startup"
            )
            return hook.run_hook(input_data)
        
        # Run multiple hooks concurrently
        with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
            futures = []
            
            for i in range(10):
                future = executor.submit(
                    run_hook_concurrent,
                    "SessionStart",
                    "session_start_uv.py",
                    i
                )
                futures.append(future)
            
            # Wait for all to complete
            for future in concurrent.futures.as_completed(futures):
                exit_code, stdout, stderr, exec_time = future.result()
                assert exit_code == 0
                assert_performance(exec_time, max_time_ms=200)  # Allow more time under load


@pytest.mark.integration
class TestDatabaseIntegration:
    """Test database integration across hooks."""
    
    def test_sqlite_fallback(self, test_env):
        """Test that SQLite fallback works when Supabase is not configured."""
        with temp_env_vars(SUPABASE_URL=None, SUPABASE_ANON_KEY=None):
            with temp_sqlite_db() as db_path:
                session_id = f"sqlite-test-{int(time.time())}"
                
                # Run session start
                hook = HookTestCase("SessionStart", "session_start_uv.py")
                input_data = hook.create_test_input(
                    sessionId=session_id,
                    source="startup"
                )
                
                exit_code, stdout, stderr, exec_time = hook.run_hook(input_data)
                assert exit_code == 0
                
                # Verify SQLite database was used
                assert db_path.exists()
                
                with sqlite3.connect(db_path) as conn:
                    cursor = conn.execute("SELECT COUNT(*) FROM sessions")
                    assert cursor.fetchone()[0] > 0
    
    def test_database_migration(self, test_env):
        """Test handling of database schema changes."""
        with temp_sqlite_db() as db_path:
            # Create old schema
            with sqlite3.connect(db_path) as conn:
                conn.execute("DROP TABLE IF EXISTS sessions")
                conn.execute("DROP TABLE IF EXISTS events")
                
                # Create minimal old schema
                conn.execute("""
                    CREATE TABLE sessions (
                        id TEXT PRIMARY KEY,
                        claude_session_id TEXT
                    )
                """)
                conn.commit()
            
            # Run hook - should handle migration
            hook = HookTestCase("SessionStart", "session_start_uv.py")
            input_data = hook.create_test_input(source="startup")
            
            exit_code, stdout, stderr, exec_time = hook.run_hook(input_data)
            assert exit_code == 0
            
            # Verify new schema exists
            with sqlite3.connect(db_path) as conn:
                cursor = conn.execute("PRAGMA table_info(sessions)")
                columns = [row[1] for row in cursor.fetchall()]
                assert "start_time" in columns  # New column


@pytest.mark.integration  
class TestEnvironmentIntegration:
    """Test integration with various environments."""
    
    def test_git_repository_integration(self, test_env, git_repo):
        """Test hooks in a git repository context."""
        with temp_env_vars(CLAUDE_PROJECT_DIR=git_repo["path"]):
            hook = HookTestCase("SessionStart", "session_start_uv.py")
            input_data = hook.create_test_input(
                source="startup",
                cwd=git_repo["path"]
            )
            
            exit_code, stdout, stderr, exec_time = hook.run_hook(input_data)
            assert exit_code == 0
            
            response = hook.parse_hook_output(stdout)
            hook_output = response["hookSpecificOutput"]
            
            assert hook_output["gitBranch"] == git_repo["branch"]
            assert hook_output["gitCommit"] == git_repo["commit"]
    
    def test_project_type_detection_integration(self, test_env):
        """Test project type detection across different project structures."""
        import tempfile
        
        project_configs = [
            ("Python", ["requirements.txt", "setup.py"]),
            ("Node.js", ["package.json", "node_modules/"]),
            ("Rust", ["Cargo.toml", "src/"]),
            ("Go", ["go.mod", "go.sum"])
        ]
        
        for project_type, files in project_configs:
            with tempfile.TemporaryDirectory() as tmpdir:
                project_path = Path(tmpdir)
                
                # Create project files
                for file_name in files:
                    if file_name.endswith('/'):
                        (project_path / file_name).mkdir()
                    else:
                        (project_path / file_name).touch()
                
                # Run session start
                hook = HookTestCase("SessionStart", "session_start_uv.py")
                input_data = hook.create_test_input(
                    source="startup",
                    cwd=str(project_path)
                )
                
                exit_code, stdout, stderr, exec_time = hook.run_hook(input_data)
                assert exit_code == 0
                
                response = hook.parse_hook_output(stdout)
                if "additionalContext" in response["hookSpecificOutput"]:
                    context = response["hookSpecificOutput"]["additionalContext"]
                    assert project_type.lower() in context.lower()