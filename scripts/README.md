# Chronicle Development Scripts

Development utilities including testing, cleanup, and maintenance scripts for the Chronicle project.

## 🎯 Overview

These scripts enable you to:
1. **Clean** build artifacts, cache files, and temporary development files
2. **Capture** live session data from your Supabase instance
3. **Validate & Sanitize** the data for privacy and security compliance  
4. **Playback** the data to test Chronicle components with realistic usage patterns

## 📋 Scripts

### 🧹 `clean.sh` - Project Cleanup
Comprehensive cleanup script that removes build artifacts, cache files, and temporary development files.

```bash
# Run full cleanup
./scripts/clean.sh

# Make script executable (if needed)
chmod +x scripts/clean.sh
```

**What gets cleaned:**
- Python cache files (`__pycache__/`, `*.pyc`, `*.pyo`)
- Python build artifacts (`build/`, `dist/`, `*.egg-info/`)
- Test coverage reports (`coverage/`, `lcov-report/`, `.coverage`)
- TypeScript build artifacts (`*.tsbuildinfo`, `.next/`)
- Node.js artifacts (debug logs, yarn logs)
- Temporary files (`*.tmp`, `*.temp`, `*.log`)
- OS-specific files (`.DS_Store`, `Thumbs.db`)
- Editor backup files (`*.swp`, `*.swo`, `*~`)
- Development debug files from root (`test_*.py`, `debug_*.py`, etc.)
- Performance monitoring outputs (`*.prof`, `performance_*.json`)

**When to use:**
- Before running tests to ensure clean environment
- After switching branches to clean old artifacts
- During development to free up disk space
- Before committing to ensure no artifacts are included

**Safe cleanup:** The script preserves source code, documentation, configuration files, and essential project structure.

### 1. `snapshot_capture.py` - Data Capture
Captures live Chronicle data from Supabase for testing purposes.

```bash
# Basic capture (last 24 hours, 5 sessions)
python scripts/snapshot_capture.py \
  --url "https://your-project.supabase.co" \
  --key "your-anon-key"

# Custom capture parameters
python scripts/snapshot_capture.py \
  --url "https://your-project.supabase.co" \
  --key "your-anon-key" \
  --hours 48 \
  --sessions 10 \
  --events 200 \
  --output "./test_data/my_snapshot.json"
```

**Options:**
- `--hours`: Hours back to capture (default: 24)
- `--sessions`: Max sessions to capture (default: 5)  
- `--events`: Max events per session (default: 100)
- `--output`: Output file path (default: `./test_snapshots/live_snapshot.json`)
- `--verbose`: Enable verbose logging

### 2. `snapshot_validator.py` - Validation & Sanitization
Validates snapshot structure and sanitizes sensitive data for safe testing.

```bash
# Validate and sanitize
python scripts/snapshot_validator.py \
  input_snapshot.json \
  --output sanitized_snapshot.json \
  --report validation_report.json

# Strict validation (fails on any issues)
python scripts/snapshot_validator.py \
  input_snapshot.json \
  --strict \
  --verbose
```

**Features:**
- Validates snapshot structure and data integrity
- Detects and sanitizes sensitive data (API keys, passwords, file paths, emails)
- Anonymizes project paths while preserving structure
- Generates detailed validation reports
- Supports strict mode for CI/CD validation

### 3. `snapshot_playback.py` - Data Playback
Replays captured data to test Chronicle components with realistic patterns.

```bash
# Memory playback (fast testing)
python scripts/snapshot_playback.py snapshot.json --target memory

# SQLite playback (database integration testing)
python scripts/snapshot_playback.py snapshot.json --target sqlite

# Supabase playback (full integration testing)
python scripts/snapshot_playback.py snapshot.json --target supabase

# Speed up playback 50x for faster testing
python scripts/snapshot_playback.py snapshot.json --speed 50.0

# Just show snapshot statistics
python scripts/snapshot_playback.py snapshot.json --stats-only
```

**Targets:**
- `memory`: In-memory simulation (fastest, good for unit tests)
- `sqlite`: SQLite database replay (integration testing)
- `supabase`: Full Supabase replay (end-to-end testing)

## 🧪 Integration Tests

### 4. `test_snapshot_integration.py` - Comprehensive Testing
Pytest-based integration tests using real snapshot data.

```bash
# Run with pytest
pytest tests/test_snapshot_integration.py::TestSnapshotIntegration -v

# Run programmatically
python tests/test_snapshot_integration.py snapshot.json --verbose
```

**Test Coverage:**
- Snapshot loading and validation
- Memory, SQLite, and Supabase replay modes
- Data sanitization verification
- Event type validation
- Session-event relationship integrity
- Tool usage event structure validation
- Timestamp ordering verification

## 📊 Complete Workflow Example

Here's a complete workflow for capturing, validating, and testing with real data:

```bash
# 1. Capture live data from your Supabase
python scripts/snapshot_capture.py \
  --url "https://your-project.supabase.co" \
  --key "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9..." \
  --hours 24 \
  --sessions 5 \
  --output "./test_snapshots/production_snapshot.json"

# 2. Validate and sanitize the captured data
python scripts/snapshot_validator.py \
  "./test_snapshots/production_snapshot.json" \
  --output "./test_snapshots/sanitized_snapshot.json" \
  --report "./test_snapshots/validation_report.json" \
  --verbose

# 3. Run integration tests with the sanitized data
python tests/test_snapshot_integration.py \
  "./test_snapshots/sanitized_snapshot.json" \
  --verbose

# 4. Test different playback scenarios
python scripts/snapshot_playback.py \
  "./test_snapshots/sanitized_snapshot.json" \
  --target sqlite \
  --speed 20.0

# 5. Use in your own tests
pytest tests/ -k "test_with_real_data" \
  --snapshot="./test_snapshots/sanitized_snapshot.json"
```

## 🔒 Privacy & Security

The validation script automatically detects and sanitizes:

- **API Keys**: OpenAI, Stripe, generic hex tokens
- **Secrets**: Secret keys, access tokens, bearer tokens
- **Personal Data**: Email addresses, file paths with usernames
- **Passwords**: Password fields and credential strings
- **Project Paths**: User-specific paths anonymized while preserving structure

Example anonymization:
```
/Users/john/Projects/my-app/src/main.py
↓
/[ANONYMIZED]/my-app/src/main.py
```

## 📁 Directory Structure

```
test_snapshots/
├── live_snapshot.json          # Raw captured data
├── sanitized_snapshot.json     # Sanitized for testing
├── validation_report.json      # Validation results
└── sample_snapshots/
    ├── basic_session.json      # Simple test case
    ├── complex_workflow.json   # Multi-tool workflow
    └── error_scenarios.json    # Error handling tests
```

## 🔧 Development Usage

### In Your Tests

```python
from scripts.snapshot_playback import SnapshotPlayback

# Load and replay in memory for fast testing
playback = SnapshotPlayback("test_snapshot.json", "memory")
results = await playback.full_replay(time_acceleration=100.0)

# Use the replayed data in your tests
sessions = results['sessions']
events = results['events']
```

### Custom Validation

```python
from scripts.snapshot_validator import SnapshotValidator

validator = SnapshotValidator(strict_mode=True)
is_valid, sanitized = validator.validate_and_sanitize(snapshot_data)
report = validator.get_validation_report()
```

## 🚀 CI/CD Integration

```yaml
# GitHub Actions example
- name: Validate test snapshots
  run: |
    python scripts/snapshot_validator.py \
      test_snapshots/baseline.json \
      --strict \
      --report validation_report.json

- name: Run snapshot integration tests  
  run: |
    python tests/test_snapshot_integration.py \
      test_snapshots/baseline.json
```

## 🛟 Troubleshooting

**Import Errors:**
- Ensure you're running from the Chronicle root directory
- Check Python path includes the hooks src directory

**Supabase Connection Issues:**
- Verify URL and key are correct
- Check network connectivity
- Ensure Supabase project is accessible

**Memory Issues with Large Snapshots:**
- Reduce `--sessions` and `--events` parameters during capture
- Use `--speed` parameter to accelerate playback
- Consider processing snapshots in smaller chunks

**Validation Failures:**
- Use `--verbose` to see detailed error messages
- Check the validation report for specific issues
- Use non-strict mode for development testing

This testing system gives you hella comprehensive coverage using real Claude Code session patterns, fasho! 🎯