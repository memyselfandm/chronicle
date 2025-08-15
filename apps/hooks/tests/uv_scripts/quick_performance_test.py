#!/usr/bin/env python3
"""
Quick performance test for UV single-file scripts.

This script runs a basic performance test on all hooks to ensure they meet the <100ms requirement.
"""

import json
import os
import subprocess
import sys
import time
from pathlib import Path
from statistics import mean, stdev

# Script directory
SCRIPT_DIR = Path(__file__).parent.parent.parent / "src" / "hooks" / "uv_scripts"

# Hook configurations
HOOKS = [
    {
        "name": "SessionStart",
        "script": "session_start_uv.py",
        "input": {
            "sessionId": "perf-test",
            "transcriptPath": "/tmp/test.jsonl",
            "cwd": "/tmp",
            "hookEventName": "SessionStart",
            "source": "startup"
        }
    },
    {
        "name": "PreToolUse",
        "script": "pre_tool_use_uv.py",
        "input": {
            "sessionId": "perf-test",
            "transcriptPath": "/tmp/test.jsonl",
            "cwd": "/tmp",
            "hookEventName": "PreToolUse",
            "toolName": "Read",
            "toolInput": {"file_path": "/tmp/test.txt"}
        }
    },
    {
        "name": "PostToolUse",
        "script": "post_tool_use_uv.py",
        "input": {
            "sessionId": "perf-test",
            "transcriptPath": "/tmp/test.jsonl",
            "cwd": "/tmp",
            "hookEventName": "PostToolUse",
            "toolName": "Read",
            "toolInput": {"file_path": "/tmp/test.txt"},
            "toolResponse": {"content": "test", "success": True}
        }
    },
    {
        "name": "UserPromptSubmit",
        "script": "user_prompt_submit_uv.py",
        "input": {
            "sessionId": "perf-test",
            "transcriptPath": "/tmp/test.jsonl",
            "cwd": "/tmp",
            "hookEventName": "UserPromptSubmit",
            "prompt": "Test prompt"
        }
    },
    {
        "name": "Notification",
        "script": "notification_uv.py",
        "input": {
            "sessionId": "perf-test",
            "transcriptPath": "/tmp/test.jsonl",
            "cwd": "/tmp",
            "hookEventName": "Notification",
            "message": "Test notification"
        }
    },
    {
        "name": "Stop",
        "script": "stop_uv.py",
        "input": {
            "sessionId": "perf-test",
            "transcriptPath": "/tmp/test.jsonl",
            "cwd": "/tmp",
            "hookEventName": "Stop",
            "stopHookActive": False
        }
    },
    {
        "name": "SubagentStop",
        "script": "subagent_stop_uv.py",
        "input": {
            "sessionId": "perf-test",
            "transcriptPath": "/tmp/test.jsonl",
            "cwd": "/tmp",
            "hookEventName": "SubagentStop",
            "taskId": "task-123"
        }
    },
    {
        "name": "PreCompact",
        "script": "pre_compact_uv.py",
        "input": {
            "sessionId": "perf-test",
            "transcriptPath": "/tmp/test.jsonl",
            "cwd": "/tmp",
            "hookEventName": "PreCompact",
            "trigger": "manual"
        }
    }
]

def test_hook_performance(hook_config, iterations=5):
    """Test performance of a single hook."""
    script_path = SCRIPT_DIR / hook_config["script"]
    
    if not script_path.exists():
        return {
            "success": False,
            "error": f"Script not found: {script_path}"
        }
    
    execution_times = []
    
    # Set test environment
    env = os.environ.copy()
    env["CHRONICLE_TEST_MODE"] = "1"
    env["CLAUDE_SESSION_ID"] = "perf-test"
    
    for i in range(iterations):
        cmd = ["uv", "run", str(script_path)]
        input_json = json.dumps(hook_config["input"])
        
        start_time = time.perf_counter()
        try:
            result = subprocess.run(
                cmd,
                input=input_json,
                capture_output=True,
                text=True,
                timeout=5.0,
                env=env
            )
            execution_time_ms = (time.perf_counter() - start_time) * 1000
            
            if result.returncode == 0:
                execution_times.append(execution_time_ms)
            else:
                return {
                    "success": False,
                    "error": f"Hook failed: {result.stderr}"
                }
                
        except subprocess.TimeoutExpired:
            return {
                "success": False,
                "error": "Hook timed out (>5s)"
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
    
    # Calculate statistics
    avg_time = mean(execution_times)
    min_time = min(execution_times)
    max_time = max(execution_times)
    std_dev = stdev(execution_times) if len(execution_times) > 1 else 0
    
    return {
        "success": True,
        "avg_ms": avg_time,
        "min_ms": min_time,
        "max_ms": max_time,
        "std_dev": std_dev,
        "all_times": execution_times,
        "under_100ms": avg_time < 100
    }

def main():
    """Run performance tests for all hooks."""
    print("🚀 UV Hook Performance Test")
    print("=" * 60)
    print(f"Testing {len(HOOKS)} hooks with 5 iterations each...")
    print()
    
    results = {}
    all_passed = True
    
    for hook in HOOKS:
        print(f"Testing {hook['name']}...", end="", flush=True)
        result = test_hook_performance(hook)
        results[hook['name']] = result
        
        if result["success"]:
            status = "✅" if result["under_100ms"] else "⚠️"
            print(f" {status} {result['avg_ms']:.2f}ms average")
        else:
            print(f" ❌ {result['error']}")
            all_passed = False
    
    print("\n" + "=" * 60)
    print("📊 SUMMARY")
    print("=" * 60)
    
    # Performance summary
    successful_hooks = [h for h, r in results.items() if r["success"]]
    if successful_hooks:
        avg_times = [results[h]["avg_ms"] for h in successful_hooks]
        overall_avg = mean(avg_times)
        
        print(f"\nSuccessful hooks: {len(successful_hooks)}/{len(HOOKS)}")
        print(f"Overall average: {overall_avg:.2f}ms")
        
        # Show hooks over 100ms
        slow_hooks = [h for h in successful_hooks if results[h]["avg_ms"] >= 100]
        if slow_hooks:
            print(f"\n⚠️  Hooks exceeding 100ms limit:")
            for hook in slow_hooks:
                print(f"  - {hook}: {results[hook]['avg_ms']:.2f}ms")
        else:
            print("\n✅ All hooks under 100ms limit!")
        
        # Show detailed stats
        print("\nDetailed Performance:")
        for hook in successful_hooks:
            r = results[hook]
            print(f"  {hook}:")
            print(f"    Average: {r['avg_ms']:.2f}ms")
            print(f"    Min/Max: {r['min_ms']:.2f}ms / {r['max_ms']:.2f}ms")
            print(f"    Std Dev: {r['std_dev']:.2f}ms")
    
    print("\n" + "=" * 60)
    
    # Return appropriate exit code
    if not all_passed:
        sys.exit(1)
    elif any(not r["under_100ms"] for r in results.values() if r["success"]):
        sys.exit(2)  # Performance warning
    else:
        sys.exit(0)

if __name__ == "__main__":
    main()