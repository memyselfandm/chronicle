# Hook Import Pattern Standards

This document defines the standardized import patterns that all Chronicle hooks must follow for consistency, maintainability, and UV compatibility.

## Overview

All hooks in the Chronicle system follow a standardized import pattern to ensure:
- **Consistency** across the codebase
- **UV compatibility** for single-file script execution
- **Maintainability** when making updates
- **Clear dependency management**

## Standard Template

Every hook file should follow this exact import pattern:

```python
#!/usr/bin/env -S uv run
# /// script
# requires-python = ">=3.8"
# dependencies = [
#     "python-dotenv>=1.0.0",
#     "supabase>=2.0.0",
#     "ujson>=5.8.0",
# ]
# ///
"""
Hook Name - UV Single-File Script

Brief description of what this hook does.
"""

import json
import logging
import os
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Optional

# Add src directory to path for lib imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

# Import shared library modules
from lib.database import DatabaseManager
from lib.base_hook import BaseHook, create_event_data, setup_hook_logging
from lib.utils import load_chronicle_env

# UJSON for fast JSON processing
try:
    import ujson as json_impl
except ImportError:
    import json as json_impl

# Initialize environment and logging
load_chronicle_env()
logger = setup_hook_logging("hook_name")
```

## Key Components

### 1. Shebang and UV Script Header

```python
#!/usr/bin/env -S uv run
# /// script
# requires-python = ">=3.8"
# dependencies = [
#     "python-dotenv>=1.0.0",
#     "supabase>=2.0.0",
#     "ujson>=5.8.0",
# ]
# ///
```

- **Required**: Every hook must be a UV single-file script
- **Dependencies**: Include only what the specific hook needs
- **Python Version**: Minimum 3.8 for compatibility

### 2. Standard Library Imports

```python
import json
import logging
import os
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Optional
```

- **Order**: Standard library imports first
- **Typing**: Always include typing imports for better code quality
- **Only what's needed**: Import only what the hook actually uses

### 3. Path Setup

```python
# Add src directory to path for lib imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
```

- **Required**: Exactly this line - no variations
- **Purpose**: Allows importing from the lib/ directory
- **UV Compatible**: Works in both UV and regular Python execution

### 4. Library Imports

```python
# Import shared library modules
from lib.database import DatabaseManager
from lib.base_hook import BaseHook, create_event_data, setup_hook_logging
from lib.utils import load_chronicle_env
```

- **Required Imports**: Every hook must import these core modules
- **Optional Imports**: Add hook-specific utility imports as needed
- **Multi-line**: Use parentheses for multiple imports from same module

### 5. UJSON Import with Fallback

```python
# UJSON for fast JSON processing
try:
    import ujson as json_impl
except ImportError:
    import json as json_impl
```

- **Required**: Exactly this pattern for fast JSON processing
- **Fallback**: Gracefully falls back to standard json module
- **Alias**: Always use `json_impl` as the alias

### 6. Environment and Logging Setup

```python
# Initialize environment and logging
load_chronicle_env()
logger = setup_hook_logging("hook_name")
```

- **Environment**: Load environment variables first
- **Logging**: Set up logging with the hook's name
- **Order**: This must come after all imports

## Hook-Specific Imports

Some hooks may need additional utility functions:

```python
# For hooks that need specific utilities
from lib.utils import (
    load_chronicle_env,
    sanitize_data,
    extract_session_id,
    format_error_message
)
```

### Common Hook-Specific Imports

- **post_tool_use.py**: `parse_tool_response`, `calculate_duration_ms`, `is_mcp_tool`
- **session_start.py**: `get_project_path`, `extract_session_id`
- **stop.py**: `extract_session_id`, `format_error_message`

## What NOT to Do

### ❌ Redundant Try/Except Blocks

```python
# DON'T DO THIS - redundant and unnecessary
try:
    from lib.database import DatabaseManager
    from lib.base_hook import BaseHook
except ImportError:
    # For UV script compatibility, try relative imports
    sys.path.insert(0, str(Path(__file__).parent.parent / "lib"))
    from database import DatabaseManager
```

### ❌ Inconsistent Path Setup

```python
# DON'T DO THIS - different path setup pattern
sys.path.insert(0, str(Path(__file__).parent.parent / "lib"))
```

### ❌ Duplicate Imports

```python
# DON'T DO THIS - duplicate ujson imports
try:
    import ujson as json_impl
except ImportError:
    import json as json_impl

# ... later in the file ...
try:
    import ujson as json_impl
except ImportError:
    import json as json_impl
```

### ❌ Missing Required Imports

```python
# DON'T DO THIS - missing core imports
from lib.database import DatabaseManager
# Missing: BaseHook, setup_hook_logging, load_chronicle_env
```

## Validation

### Automated Testing

Run the import pattern tests to validate consistency:

```bash
# Test all hooks
python -m pytest tests/test_import_pattern_standardization.py

# Test specific hook
python -m pytest tests/test_import_pattern_standardization.py::TestImportPatternStandardization::test_hooks_follow_standard_path_setup
```

### Validation Script

Use the validation script for comprehensive checking:

```bash
# Validate all hooks
python scripts/validate_import_patterns.py

# Validate specific hook
python scripts/validate_import_patterns.py --hook notification.py

# Auto-fix common issues
python scripts/validate_import_patterns.py --fix
```

### CI/CD Integration

Add to your CI pipeline:

```yaml
- name: Validate Hook Import Patterns
  run: |
    cd apps/hooks
    python scripts/validate_import_patterns.py
```

## Development Workflow

### When Creating a New Hook

1. **Copy Template**: Start with the standard template above
2. **Update Dependencies**: Add any hook-specific dependencies to the UV script header
3. **Add Hook-Specific Imports**: Import only the additional utilities you need
4. **Update Hook Name**: Change the logger name and documentation
5. **Validate**: Run the validation script before committing

### When Updating Existing Hooks

1. **Check Pattern**: Run validation to see current compliance
2. **Auto-Fix**: Use `--fix` flag to automatically resolve common issues
3. **Manual Review**: Address any remaining validation errors
4. **Test**: Ensure the hook still functions correctly
5. **Validate**: Confirm all patterns are now compliant

## Benefits

Following this standardized pattern provides:

### For Developers
- **Predictable Structure**: Every hook follows the same pattern
- **Easy Navigation**: Imports are always in the same place
- **Quick Updates**: Changes to import patterns can be applied consistently

### For Maintenance
- **Automated Validation**: Catch deviations early in development
- **Consistent Dependencies**: Clear understanding of what each hook needs
- **Refactoring Safety**: Changes to shared modules are easier to track

### For Deployment
- **UV Compatibility**: All hooks work as single-file scripts
- **Clear Dependencies**: Each hook declares exactly what it needs
- **Portable Execution**: Hooks can run in various environments

## Migration Guide

If you have existing hooks that don't follow this pattern:

1. **Backup**: Create a backup of your hook files
2. **Run Auto-Fix**: Use `python scripts/validate_import_patterns.py --fix`
3. **Manual Cleanup**: Address any remaining issues manually
4. **Test Functionality**: Ensure hooks still work correctly
5. **Validate**: Confirm compliance with validation script

## Troubleshooting

### Import Errors

If you get import errors:
1. **Check Path Setup**: Ensure the `sys.path.insert` line is correct
2. **Verify File Location**: Hook should be in `src/hooks/` directory
3. **Check lib/ Directory**: Ensure `lib/` directory exists at `src/lib/`

### Validation Failures

If validation fails:
1. **Read Error Messages**: Validation provides specific error descriptions
2. **Use Auto-Fix**: Try `--fix` flag for common issues
3. **Check Examples**: Look at working hooks as reference
4. **Run Tests**: Use pytest for detailed validation

### UV Execution Issues

If UV scripts don't work:
1. **Check Dependencies**: Ensure all required packages are listed
2. **Verify Shebang**: Must be exactly `#!/usr/bin/env -S uv run`
3. **Test Locally**: Run `uv run hook_name.py` to test

## Examples

See the following hooks for complete examples:
- `notification.py` - Simple hook with minimal imports
- `post_tool_use.py` - Complex hook with multiple utility imports
- `session_start.py` - Hook with external library imports (subprocess)

## Version History

- **v1.0** (Sprint 4): Initial standardization of import patterns
- **v1.1** (Sprint 4): Added validation tooling and documentation

---

For questions about import patterns or to report issues with the validation tooling, please refer to the main Chronicle documentation or contact the development team.