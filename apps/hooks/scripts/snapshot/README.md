# Chronicle Snapshot Scripts

This directory contains scripts for capturing, replaying, and validating Chronicle session and event data for testing purposes.

## Overview

The snapshot functionality allows you to:
- **Capture** live session data from Supabase for creating test datasets
- **Replay** captured data to simulate real Claude Code sessions  
- **Validate** snapshot data for privacy compliance and structural integrity

## Scripts

### snapshot_capture.py
**Purpose:** Capture live Chronicle data from Supabase for testing

**Features:**
- Connects to Supabase to capture recent sessions and events
- Sanitizes sensitive data (API keys, file paths, user info)
- Configurable time ranges and limits
- Exports to JSON format for test usage

**Usage:**
```bash
python snapshot_capture.py --url YOUR_SUPABASE_URL --key YOUR_ANON_KEY --hours 24 --sessions 5 --output test_data.json
```

**Arguments:**
- `--url`: Supabase project URL
- `--key`: Supabase anon key
- `--hours`: Hours back to capture (default: 24)
- `--sessions`: Max sessions to capture (default: 5)  
- `--events`: Max events per session (default: 100)
- `--output`: Output JSON file path
- `--verbose`: Enable detailed logging

### snapshot_playback.py  
**Purpose:** Replay captured snapshot data to simulate Claude Code sessions

**Features:**
- Supports memory, SQLite, and Supabase replay targets
- Time acceleration for fast testing
- Realistic timestamp simulation
- Comprehensive session/event validation

**Usage:**
```bash
python snapshot_playback.py test_data.json --target memory --speed 10.0
```

**Arguments:**
- `snapshot`: Path to snapshot JSON file (required)
- `--target`: Replay destination (memory/sqlite/supabase, default: memory)
- `--speed`: Time acceleration factor (default: 10.0)
- `--stats-only`: Only show snapshot statistics
- `--verbose`: Enable detailed logging

**Replay Targets:**
- **memory**: Validate and process in memory only
- **sqlite**: Create in-memory SQLite database and insert data
- **supabase**: Insert into actual Supabase database (requires config)

### snapshot_validator.py
**Purpose:** Validate and sanitize snapshot data for privacy and structural integrity  

**Features:**
- Validates snapshot structure and data integrity
- Detects and sanitizes sensitive information patterns
- Privacy compliance for sharing test data
- Detailed validation reporting

**Usage:**
```bash
python snapshot_validator.py input.json --output sanitized.json --report validation_report.json
```

**Arguments:**
- `input`: Input snapshot file (required)
- `--output`: Output sanitized snapshot file
- `--strict`: Strict validation mode (fail on any issues)
- `--report`: Save detailed validation report
- `--verbose`: Show detailed validation results

**Sensitive Data Detection:**
- API keys and tokens
- Email addresses  
- File paths with usernames
- Passwords and secrets
- Personal identifiers

## Data Flow

```
Live Supabase → snapshot_capture.py → Raw Snapshot JSON
                                           ↓
Raw Snapshot → snapshot_validator.py → Sanitized Snapshot JSON
                                           ↓  
Sanitized Snapshot → snapshot_playback.py → Test Environment
```

## Integration Testing

The snapshot scripts integrate with the main test suite:

- `tests/test_snapshot_integration.py` - Integration tests using snapshot data
- Test cases validate snapshot loading, replay, and data integrity
- Supports automated testing with realistic data patterns

**Running Integration Tests:**
```bash
python -m pytest tests/test_snapshot_integration.py -v
```

## Best Practices

### Security & Privacy
- Always run `snapshot_validator.py` before sharing snapshots
- Review sanitization changes to ensure completeness
- Never commit raw snapshots with real user data
- Use sanitized snapshots for CI/CD and shared development

### Data Quality
- Capture diverse session types (different tools, patterns)
- Include both successful and error scenarios
- Validate captured data before using in tests
- Keep snapshots reasonably small for test performance

### Development Workflow
1. Capture recent data with `snapshot_capture.py`
2. Validate and sanitize with `snapshot_validator.py`  
3. Use sanitized snapshots in development and testing
4. Replay with different targets to test components

## File Structure

```
scripts/snapshot/
├── README.md                    # This documentation
├── snapshot_capture.py         # Live data capture
├── snapshot_playback.py        # Data replay simulation
└── snapshot_validator.py       # Validation and sanitization
```

## Dependencies

The snapshot scripts require:
- Python 3.8+
- Chronicle hooks src modules (models, database, utils)
- Optional: supabase-py for Supabase capture
- Standard library modules for validation and file operations

## Troubleshooting

**Import Errors:**
- Ensure you're running from the Chronicle root directory
- Check that the hooks src modules are available
- Verify sys.path modifications in script headers

**Supabase Connection Issues:**  
- Verify URL and anon key are correct
- Check network connectivity and Supabase status
- Ensure database schema matches expected structure

**Validation Failures:**
- Review validation report for specific issues
- Check snapshot file structure and required fields
- Ensure event types and session IDs are valid

**Performance Issues:**
- Reduce capture limits (sessions, events, time range)
- Use higher time acceleration for faster replay
- Consider memory vs SQLite targets for testing

## Contributing

When modifying snapshot scripts:
- Maintain backward compatibility with existing snapshots
- Update tests in `test_snapshot_integration.py`
- Document any new command line options
- Follow privacy-first design for any new data handling