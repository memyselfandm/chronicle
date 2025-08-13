# Python UV Package Manager Installation & Automation Guide

## Overview

UV is an extremely fast Python package and project manager written in Rust, designed to replace pip, poetry, pyenv, and other Python tooling. This guide covers installation automation, dependency management, and project setup for the Chronicle observability system.

## Why UV?

### Performance Benefits
- **10-100x faster than pip** for package operations
- Disk-space efficient with global dependency cache
- Platform-independent dependency resolution
- Concurrent downloads and installations

### Unified Tooling
UV replaces multiple tools:
- **pip** → `uv pip` (package installation)
- **poetry** → `uv` (project management)
- **pyenv** → `uv python` (Python version management)
- **pipx** → `uv tool` (tool installation)
- **venv** → `uv venv` (virtual environment management)

## Installation Methods

### Official Installer (Recommended)
```bash
# macOS and Linux
curl -LsSf https://astral.sh/uv/install.sh | sh

# Windows (PowerShell)
powershell -c "irm https://astral.sh/uv/install.ps1 | iex"
```

### Package Managers
```bash
# macOS (Homebrew)
brew install uv

# Linux (snap)
sudo snap install --classic uv

# Python Package Index
pip install uv
# or
pipx install uv
```

### Self-Update
```bash
uv self update
```

## Project Management

### Initialize New Project
```bash
# Create new Python project
uv init my-project
cd my-project

# Initialize in existing directory
uv init

# Specify Python version
uv init --python 3.11
```

### Project Structure
UV creates a standard Python project structure:
```
my-project/
├── pyproject.toml      # Project configuration
├── README.md
├── src/
│   └── my_project/
│       └── __init__.py
└── tests/
    └── __init__.py
```

### Install Dependencies
```bash
# Install project dependencies
uv install

# Add new dependency
uv add requests

# Add development dependency
uv add --dev pytest

# Add with version constraints
uv add "fastapi>=0.68.0,<1.0.0"

# Add from git repository
uv add git+https://github.com/user/repo.git

# Add with extras
uv add "requests[security]"
```

### Dependency Management
```bash
# Show dependency tree
uv tree

# Lock dependencies
uv lock

# Update dependencies
uv update

# Remove dependency
uv remove requests

# Sync environment with lockfile
uv sync
```

## Python Version Management

### Install Python Versions
```bash
# List available Python versions
uv python list

# Install specific Python version
uv python install 3.11
uv python install 3.12

# Use specific Python for project
uv python pin 3.11
```

### Virtual Environment Management
```bash
# Create virtual environment
uv venv

# Create with specific Python version
uv venv --python 3.11

# Activate virtual environment
source .venv/bin/activate  # Unix
.venv\Scripts\activate     # Windows

# Run command in virtual environment
uv run python script.py
uv run pytest
```

## Project Configuration (pyproject.toml)

### Basic Configuration
```toml
[project]
name = "chronicle-hooks"
version = "0.1.0"
description = "Claude Code observability hooks system"
authors = [
    {name = "Your Name", email = "you@example.com"}
]
requires-python = ">=3.9"
dependencies = [
    "asyncpg>=0.28.0",
    "aiofiles>=23.0.0",
    "pydantic>=2.0.0",
    "python-dotenv>=1.0.0",
    "typer>=0.9.0",
]

[project.optional-dependencies]
dev = [
    "pytest>=7.0.0",
    "pytest-asyncio>=0.21.0",
    "black>=23.0.0",
    "ruff>=0.1.0",
    "mypy>=1.5.0",
]

[project.scripts]
chronicle-install = "chronicle.cli:install"
chronicle-setup = "chronicle.cli:setup"

[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[tool.uv]
dev-dependencies = [
    "pre-commit>=3.0.0",
    "pytest-cov>=4.0.0",
]
```

### Environment-Specific Dependencies
```toml
[project.optional-dependencies]
production = [
    "gunicorn>=21.0.0",
    "uvicorn[standard]>=0.23.0",
]
development = [
    "debugpy>=1.6.0",
    "ipython>=8.0.0",
]
testing = [
    "pytest>=7.0.0",
    "pytest-mock>=3.11.0",
    "coverage>=7.0.0",
]
```

## Automation Scripts

### Installation Automation Script
```python
#!/usr/bin/env python3
"""
Chronicle Hooks Installation Script
Automated installation with UV package manager
"""

import os
import subprocess
import sys
from pathlib import Path
import json
import shutil

class ChronicleInstaller:
    def __init__(self):
        self.project_root = Path.cwd()
        self.claude_dir = self.project_root / '.claude'
        self.hooks_dir = self.project_root / 'hooks'
        
    def check_uv_installed(self):
        """Check if UV is installed, install if not"""
        try:
            result = subprocess.run(['uv', '--version'], 
                                  capture_output=True, text=True)
            if result.returncode == 0:
                print(f"✓ UV found: {result.stdout.strip()}")
                return True
        except FileNotFoundError:
            pass
        
        print("UV not found. Installing...")
        self.install_uv()
        return True
    
    def install_uv(self):
        """Install UV package manager"""
        import platform
        system = platform.system().lower()
        
        if system in ['linux', 'darwin']:  # Linux or macOS
            cmd = ['curl', '-LsSf', 'https://astral.sh/uv/install.sh']
            process = subprocess.Popen(cmd, stdout=subprocess.PIPE)
            subprocess.run(['sh'], stdin=process.stdout)
        elif system == 'windows':
            cmd = ['powershell', '-c', 
                   'irm https://astral.sh/uv/install.ps1 | iex']
            subprocess.run(cmd)
        else:
            # Fallback to pip
            subprocess.run([sys.executable, '-m', 'pip', 'install', 'uv'])
    
    def setup_project(self):
        """Initialize UV project structure"""
        print("Setting up Chronicle hooks project...")
        
        # Initialize UV project if pyproject.toml doesn't exist
        if not (self.project_root / 'pyproject.toml').exists():
            subprocess.run(['uv', 'init', '--no-readme'], 
                          cwd=self.project_root)
        
        # Install dependencies
        self.install_dependencies()
        
    def install_dependencies(self):
        """Install project dependencies"""
        dependencies = [
            'asyncpg>=0.28.0',
            'aiofiles>=23.0.0', 
            'pydantic>=2.0.0',
            'python-dotenv>=1.0.0',
            'typer>=0.9.0',
            'aiosqlite>=0.19.0',
        ]
        
        dev_dependencies = [
            'pytest>=7.0.0',
            'pytest-asyncio>=0.21.0',
            'black>=23.0.0',
            'ruff>=0.1.0',
        ]
        
        print("Installing dependencies...")
        for dep in dependencies:
            subprocess.run(['uv', 'add', dep])
        
        print("Installing dev dependencies...")
        for dep in dev_dependencies:
            subprocess.run(['uv', 'add', '--dev', dep])
    
    def create_hook_scripts(self):
        """Create hook script templates"""
        self.hooks_dir.mkdir(exist_ok=True)
        
        # Base hook template
        base_hook = '''#!/usr/bin/env python3
"""
Chronicle Base Hook
"""

import json
import sys
import asyncio
from pathlib import Path

# Add project root to path
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from chronicle.hooks.base import BaseHook

class {hook_name}Hook(BaseHook):
    async def process(self, payload: dict) -> dict:
        """Process hook payload"""
        # Implementation here
        return {"continue": True}

async def main():
    hook = {hook_name}Hook()
    await hook.run()

if __name__ == "__main__":
    asyncio.run(main())
'''
        
        hook_types = [
            'PreToolUse', 'PostToolUse', 'UserPromptSubmit',
            'SessionStart', 'Stop', 'Notification'
        ]
        
        for hook_type in hook_types:
            hook_file = self.hooks_dir / f'{hook_type.lower()}.py'
            if not hook_file.exists():
                with open(hook_file, 'w') as f:
                    f.write(base_hook.format(hook_name=hook_type))
                hook_file.chmod(0o755)
        
        print(f"✓ Created hook scripts in {self.hooks_dir}")
    
    def setup_claude_config(self):
        """Setup Claude Code configuration"""
        self.claude_dir.mkdir(exist_ok=True)
        
        settings = {
            "hooks": {
                "PreToolUse": [{
                    "matcher": ".*",
                    "hooks": [{
                        "type": "command",
                        "command": f"uv run python {self.hooks_dir}/pretooluse.py"
                    }]
                }],
                "PostToolUse": [{
                    "matcher": ".*", 
                    "hooks": [{
                        "type": "command",
                        "command": f"uv run python {self.hooks_dir}/posttooluse.py"
                    }]
                }],
                "UserPromptSubmit": [{
                    "matcher": ".*",
                    "hooks": [{
                        "type": "command",
                        "command": f"uv run python {self.hooks_dir}/userpromptsubmit.py"
                    }]
                }],
                "SessionStart": [{
                    "matcher": ".*",
                    "hooks": [{
                        "type": "command", 
                        "command": f"uv run python {self.hooks_dir}/sessionstart.py"
                    }]
                }]
            },
            "environmentVariables": {
                "CHRONICLE_PROJECT_ROOT": str(self.project_root),
                "CHRONICLE_HOOKS_ENABLED": "true"
            }
        }
        
        settings_file = self.claude_dir / 'settings.json'
        with open(settings_file, 'w') as f:
            json.dump(settings, f, indent=2)
        
        print(f"✓ Created Claude Code settings: {settings_file}")
    
    def install(self):
        """Run complete installation"""
        print("🚀 Starting Chronicle Hooks installation...")
        
        try:
            self.check_uv_installed()
            self.setup_project()
            self.create_hook_scripts()
            self.setup_claude_config()
            
            print("\n✅ Chronicle Hooks installation complete!")
            print(f"Project root: {self.project_root}")
            print(f"Hooks directory: {self.hooks_dir}")
            print(f"Claude config: {self.claude_dir}")
            
        except Exception as e:
            print(f"❌ Installation failed: {e}")
            sys.exit(1)

if __name__ == "__main__":
    installer = ChronicleInstaller()
    installer.install()
```

### Development Environment Setup
```bash
#!/bin/bash
# setup_dev_env.sh

set -e

echo "🚀 Setting up Chronicle development environment..."

# Check if UV is installed
if ! command -v uv &> /dev/null; then
    echo "Installing UV..."
    curl -LsSf https://astral.sh/uv/install.sh | sh
    source ~/.bashrc
fi

# Initialize project
if [ ! -f "pyproject.toml" ]; then
    uv init chronicle-hooks --no-readme
    cd chronicle-hooks
else
    echo "Project already initialized"
fi

# Install dependencies
echo "Installing dependencies..."
uv add asyncpg aiofiles pydantic python-dotenv typer aiosqlite

# Install dev dependencies  
echo "Installing dev dependencies..."
uv add --dev pytest pytest-asyncio black ruff mypy pre-commit

# Create directory structure
mkdir -p {hooks,tests,chronicle/{hooks,database,utils}}

# Install pre-commit hooks
uv run pre-commit install

# Create .env template
cat > .env.template << EOF
# Database Configuration
SUPABASE_URL=your_supabase_url_here
SUPABASE_KEY=your_supabase_anon_key_here
SQLITE_DB_PATH=/tmp/chronicle_fallback.db

# Environment
ENVIRONMENT=development
DEBUG=true
LOG_LEVEL=debug
EOF

echo "✅ Development environment setup complete!"
echo "Next steps:"
echo "1. Copy .env.template to .env and configure"
echo "2. Run 'uv run python install_hooks.py' to setup hooks"
echo "3. Start coding with 'uv run python -m chronicle'"
```

## Running Applications

### Execute Scripts
```bash
# Run Python script with project dependencies
uv run python script.py

# Run module
uv run -m chronicle.cli

# Run with specific Python version
uv run --python 3.11 python script.py

# Run tests
uv run pytest

# Run with environment variables
uv run --env-file .env python app.py
```

### Tool Installation
```bash
# Install command-line tools
uv tool install black
uv tool install ruff
uv tool install pytest

# List installed tools
uv tool list

# Upgrade tools
uv tool upgrade black

# Uninstall tools
uv tool uninstall black
```

## Performance Optimization

### Dependency Resolution
```bash
# Generate lockfile for reproducible installs
uv lock

# Install from lockfile (faster)
uv sync

# Skip dependency resolution (fastest)
uv sync --frozen
```

### Caching
UV automatically caches downloaded packages. Cache locations:
- **macOS**: `~/Library/Caches/uv`
- **Linux**: `~/.cache/uv`
- **Windows**: `%LOCALAPPDATA%\uv\cache`

```bash
# Clear cache
uv cache clean

# Show cache info
uv cache dir
```

## Troubleshooting

### Common Issues

1. **UV not found after installation**
   ```bash
   # Add to PATH
   export PATH="$HOME/.local/bin:$PATH"
   # or
   source ~/.bashrc
   ```

2. **Permission errors**
   ```bash
   # Fix permissions
   chmod +x ~/.local/bin/uv
   ```

3. **Python version conflicts**
   ```bash
   # Pin specific Python version
   uv python pin 3.11
   ```

4. **Dependency resolution failures**
   ```bash
   # Clear lock file and retry
   rm uv.lock
   uv install
   ```

### Debug Information
```bash
# Verbose output
uv -v install

# Show resolution information
uv tree

# Check environment
uv python list
```

## Integration with CI/CD

### GitHub Actions
```yaml
name: Test with UV
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Install UV
        run: curl -LsSf https://astral.sh/uv/install.sh | sh
        
      - name: Install dependencies
        run: uv sync
        
      - name: Run tests
        run: uv run pytest
        
      - name: Run linting
        run: |
          uv run ruff check .
          uv run black --check .
```

### Docker Integration
```dockerfile
FROM python:3.11-slim

# Install UV
COPY --from=ghcr.io/astral-sh/uv:latest /uv /bin/uv

# Copy project files
COPY . /app
WORKDIR /app

# Install dependencies
RUN uv sync --frozen

# Run application
CMD ["uv", "run", "python", "-m", "chronicle"]
```

## Best Practices

1. **Always use lockfiles** (`uv.lock`) for reproducible builds
2. **Pin Python versions** in production environments
3. **Use virtual environments** for isolation
4. **Leverage caching** for faster CI/CD pipelines
5. **Keep dependencies minimal** for security and performance
6. **Use dependency groups** for different environments
7. **Regular updates** with `uv update`

This guide provides comprehensive coverage of UV package manager for building and automating Python projects like the Chronicle observability system.