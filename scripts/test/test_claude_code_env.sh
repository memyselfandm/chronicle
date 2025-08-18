#!/bin/bash
# Test script to debug Claude Code environment

echo "Testing Claude Code hook environment..."
echo "================================"

# Test as Claude Code would call it
TEST_INPUT='{"sessionId": "test-claude-env", "hookEventName": "SessionStart", "source": "startup", "transcriptPath": "/tmp/test.jsonl", "cwd": "'$(pwd)'"}'

echo "Input: $TEST_INPUT"
echo ""

# Run the hook and capture all output
echo "Running session_start hook..."
echo "$TEST_INPUT" | uv run /Users/m/.claude/hooks/chronicle/hooks/session_start.py 2>&1

echo ""
echo "Checking environment variables..."
env | grep -E "(SUPABASE|CLAUDE|CHRONICLE)" | sort

echo ""
echo "Checking .env file locations..."
ls -la ~/.claude/hooks/chronicle/.env 2>/dev/null && echo "✓ Chronicle .env exists" || echo "✗ Chronicle .env missing"
ls -la ./.env 2>/dev/null && echo "✓ Project .env exists" || echo "✗ Project .env missing"