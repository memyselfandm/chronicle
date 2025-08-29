#!/usr/bin/env python3
"""
Chronicle One-Command Installer
Cross-platform installer for Chronicle observability system.
Installs to ~/.claude/hooks/chronicle/ with zero configuration.

Usage:
    python install.py [options]
    
Options:
    --skip-deps         Skip dependency installation
    --no-start         Don't start server after installation  
    --force            Force overwrite existing installation
    --help             Show this help message
"""

import argparse
import json
import os
import platform
import shutil
import sqlite3
import subprocess
import sys
import tempfile
import time
import webbrowser
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple


class InstallationError(Exception):
    """Custom exception for installation errors."""
    pass


class ChronicleInstaller:
    """Chronicle installation manager."""
    
    def __init__(self, skip_deps: bool = False, no_start: bool = False, force: bool = False):
        """Initialize installer with configuration."""
        self.skip_deps = skip_deps
        self.no_start = no_start
        self.force = force
        
        # Paths
        self.home_dir = Path.home()
        self.install_dir = self.home_dir / ".claude" / "hooks" / "chronicle"
        self.project_dir = Path(__file__).parent
        
        # System detection
        self.system = platform.system().lower()
        self.is_windows = self.system == "windows"
        
        # State
        self.python_cmd = None
        self.node_cmd = None
        self.use_uv = False
        
        # Start time for timing
        self.start_time = time.time()
    
    def print_header(self):
        """Print installation header."""
        print("=" * 50)
        print("  Chronicle One-Command Installer")
        print("=" * 50)
        print(f"Installing Chronicle observability system to:")
        print(f"  {self.install_dir}")
        print("")
    
    def print_status(self, message: str):
        """Print status message."""
        print(f"[INFO] {message}")
    
    def print_success(self, message: str):
        """Print success message."""
        print(f"[SUCCESS] {message}")
    
    def print_warning(self, message: str):
        """Print warning message."""
        print(f"[WARNING] {message}")
    
    def print_error(self, message: str):
        """Print error message."""
        print(f"[ERROR] {message}")
    
    def ask_confirmation(self, prompt: str, default: bool = False) -> bool:
        """Ask for user confirmation."""
        default_str = "Y/n" if default else "y/N"
        try:
            response = input(f"{prompt} [{default_str}]: ").strip().lower()
            if not response:
                return default
            return response in ['y', 'yes']
        except (KeyboardInterrupt, EOFError):
            print("\nInstallation cancelled by user")
            sys.exit(1)
    
    def run_command(self, cmd: List[str], check: bool = True, capture: bool = False, cwd: Optional[Path] = None) -> subprocess.CompletedProcess:
        """Run a system command."""
        try:
            if capture:
                return subprocess.run(cmd, check=check, capture_output=True, text=True, cwd=cwd)
            else:
                return subprocess.run(cmd, check=check, cwd=cwd)
        except subprocess.CalledProcessError as e:
            if capture:
                raise InstallationError(f"Command failed: {' '.join(cmd)}\nOutput: {e.stderr}")
            else:
                raise InstallationError(f"Command failed: {' '.join(cmd)}")
        except FileNotFoundError:
            raise InstallationError(f"Command not found: {cmd[0]}")
    
    def detect_python(self) -> str:
        """Detect and validate Python installation."""
        self.print_status("Checking Python installation...")
        
        # Python commands to try
        python_commands = ['python3', 'python3.12', 'python3.11', 'python3.10', 'python3.9', 'python3.8', 'python']
        
        for cmd in python_commands:
            try:
                result = self.run_command([cmd, '--version'], capture=True)
                version_str = result.stdout.strip()
                
                # Extract version number
                import re
                version_match = re.search(r'(\d+)\.(\d+)', version_str)
                if version_match:
                    major, minor = map(int, version_match.groups())
                    if major == 3 and minor >= 8:
                        self.python_cmd = cmd
                        self.print_success(f"Found Python {major}.{minor}: {cmd}")
                        return cmd
                        
            except (InstallationError, subprocess.CalledProcessError):
                continue
        
        # Python not found or too old
        print("")
        print("Chronicle needs Python 3.8+ to run the backend server.")
        print("Python manages the local SQLite database and provides hooks for Claude Code.")
        print("")
        
        if self.ask_confirmation("Would you like to install Python automatically?"):
            return self.install_python()
        else:
            raise InstallationError("Python 3.8+ is required. Please install Python from https://python.org/ and try again.")
    
    def install_python(self) -> str:
        """Install Python for the current platform."""
        self.print_status("Installing Python...")
        
        if self.system == "darwin":
            # macOS
            if shutil.which("brew"):
                self.run_command(["brew", "install", "python@3.11"])
            else:
                raise InstallationError("Homebrew not found. Please install Python manually from https://python.org/")
                
        elif self.system == "linux":
            # Linux
            if shutil.which("apt-get"):
                self.run_command(["sudo", "apt-get", "update"])
                self.run_command(["sudo", "apt-get", "install", "-y", "python3", "python3-pip", "python3-venv"])
            elif shutil.which("yum"):
                self.run_command(["sudo", "yum", "install", "-y", "python3", "python3-pip"])
            elif shutil.which("dnf"):
                self.run_command(["sudo", "dnf", "install", "-y", "python3", "python3-pip"])
            else:
                raise InstallationError("Unsupported Linux distribution. Please install Python manually.")
                
        elif self.system == "windows":
            # Windows
            print("Please install Python from https://python.org/downloads/")
            print("Make sure to check 'Add Python to PATH' during installation.")
            raise InstallationError("Automatic Python installation not supported on Windows")
            
        else:
            raise InstallationError(f"Automatic Python installation not supported on {self.system}")
        
        # Re-detect Python after installation
        return self.detect_python()
    
    def detect_uv(self) -> bool:
        """Detect and optionally install UV package manager."""
        self.print_status("Checking UV package manager...")
        
        if shutil.which("uv"):
            try:
                result = self.run_command(["uv", "--version"], capture=True)
                self.print_success(f"Found UV: {result.stdout.strip()}")
                self.use_uv = True
                return True
            except InstallationError:
                pass
        
        print("")
        print("Chronicle uses UV for fast Python package management.")
        print("UV is 10-100x faster than pip and handles dependencies better.")
        print("Alternative: Continue with pip (slower but works everywhere).")
        print("")
        
        if self.ask_confirmation("Would you like to install UV?"):
            self.install_uv()
            self.use_uv = True
            return True
        else:
            self.print_status("Continuing with pip for Python package management")
            self.use_uv = False
            return False
    
    def install_uv(self) -> None:
        """Install UV package manager."""
        self.print_status("Installing UV...")
        
        if self.system == "windows":
            # Windows - use powershell
            cmd = ["powershell", "-c", "irm https://astral.sh/uv/install.ps1 | iex"]
        else:
            # Unix-like systems
            if shutil.which("curl"):
                cmd = ["sh", "-c", "curl -LsSf https://astral.sh/uv/install.sh | sh"]
            elif shutil.which("wget"):
                cmd = ["sh", "-c", "wget -qO- https://astral.sh/uv/install.sh | sh"]
            else:
                raise InstallationError("Neither curl nor wget found. Cannot install UV automatically.")
        
        try:
            self.run_command(cmd)
            
            # Update PATH for current session
            if self.system == "windows":
                uv_path = Path.home() / ".cargo" / "bin"
            else:
                uv_path = Path.home() / ".cargo" / "bin"
            
            if uv_path.exists():
                os.environ["PATH"] = str(uv_path) + os.pathsep + os.environ.get("PATH", "")
            
            # Verify installation
            if shutil.which("uv"):
                self.print_success("UV installed successfully")
            else:
                self.print_warning("UV installation may have failed. Falling back to pip.")
                self.use_uv = False
                
        except InstallationError:
            self.print_warning("UV installation failed. Falling back to pip.")
            self.use_uv = False
    
    def detect_nodejs(self) -> str:
        """Detect and validate Node.js installation."""
        self.print_status("Checking Node.js installation...")
        
        if shutil.which("node") and shutil.which("npm"):
            try:
                result = self.run_command(["node", "--version"], capture=True)
                version_str = result.stdout.strip().lstrip('v')
                major_version = int(version_str.split('.')[0])
                
                if major_version >= 18:
                    self.node_cmd = "node"
                    self.print_success(f"Found Node.js v{version_str} with npm")
                    return "node"
                    
            except (InstallationError, ValueError):
                pass
        
        print("")
        print("Chronicle needs Node.js 18+ to run the dashboard frontend.")
        print("The dashboard provides a web interface to view Claude Code activity.")
        print("")
        
        if self.ask_confirmation("Would you like to install Node.js automatically?"):
            return self.install_nodejs()
        else:
            raise InstallationError("Node.js 18+ is required. Please install from https://nodejs.org/ and try again.")
    
    def install_nodejs(self) -> str:
        """Install Node.js for the current platform."""
        self.print_status("Installing Node.js...")
        
        if self.system == "darwin":
            # macOS
            if shutil.which("brew"):
                self.run_command(["brew", "install", "node"])
            else:
                raise InstallationError("Homebrew not found. Please install Node.js manually from https://nodejs.org/")
                
        elif self.system == "linux":
            # Linux - use NodeSource repository
            if shutil.which("curl"):
                self.run_command(["sh", "-c", "curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -"])
                self.run_command(["sudo", "apt-get", "install", "-y", "nodejs"])
            else:
                raise InstallationError("Cannot install Node.js automatically. Please install from https://nodejs.org/")
                
        elif self.system == "windows":
            # Windows
            print("Please install Node.js from https://nodejs.org/downloads/")
            print("Download and run the Windows Installer (.msi)")
            raise InstallationError("Automatic Node.js installation not supported on Windows")
            
        else:
            raise InstallationError(f"Automatic Node.js installation not supported on {self.system}")
        
        # Re-detect Node.js after installation
        return self.detect_nodejs()
    
    def create_directories(self) -> None:
        """Create installation directory structure."""
        self.print_status("Creating directory structure...")
        
        # Check if installation directory already exists
        if self.install_dir.exists():
            if not self.force:
                print("")
                print(f"Chronicle installation already exists at: {self.install_dir}")
                if self.ask_confirmation("Would you like to overwrite the existing installation?"):
                    self.print_warning("Removing existing installation...")
                    shutil.rmtree(self.install_dir)
                else:
                    raise InstallationError("Installation cancelled. Use --force to overwrite existing installation.")
            else:
                self.print_warning("Force install: Removing existing installation...")
                shutil.rmtree(self.install_dir)
        
        # Create directory structure
        directories = [
            self.install_dir,
            self.install_dir / "server",
            self.install_dir / "server" / "data", 
            self.install_dir / "server" / "logs",
            self.install_dir / "hooks",
            self.install_dir / "hooks" / "src",
            self.install_dir / "hooks" / "config",
            self.install_dir / "dashboard",
            self.install_dir / "dashboard" / "src",
            self.install_dir / "dashboard" / "public"
        ]
        
        for directory in directories:
            directory.mkdir(parents=True, exist_ok=True)
        
        self.print_success(f"Created directory structure in {self.install_dir}")
    
    def copy_components(self) -> None:
        """Copy Chronicle components to installation directory."""
        self.print_status("Copying Chronicle components...")
        
        # Define ignore patterns function
        def ignore_patterns(dir_path, names):
            return [name for name in names if name in ['__pycache__', '.git', '.pytest_cache', '*.pyc', 'node_modules', '.next']]
        
        # Copy hooks with proper structure
        hooks_src_dir = self.project_dir / "apps" / "hooks" / "src" / "hooks"
        hooks_lib_dir = self.project_dir / "apps" / "hooks" / "src" / "lib"
        hooks_dest_dir = self.install_dir / "hooks"
        
        if hooks_src_dir.exists() and hooks_lib_dir.exists():
            # Copy hook scripts
            for hook_file in hooks_src_dir.glob("*.py"):
                dest_file = hooks_dest_dir / hook_file.name
                dest_file.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(hook_file, dest_file)
            
            # Copy lib directory inside hooks directory
            lib_dest = hooks_dest_dir / "lib"
            if lib_dest.exists():
                shutil.rmtree(lib_dest)
            shutil.copytree(hooks_lib_dir, lib_dest, ignore=ignore_patterns)
            
            # Copy requirements.txt if it exists
            hooks_req = self.project_dir / "apps" / "hooks" / "requirements.txt"
            if hooks_req.exists():
                shutil.copy2(hooks_req, hooks_dest_dir / "requirements.txt")
            
            self.print_success("Copied hooks components with lib directory")
        else:
            raise InstallationError(f"Hooks source or lib not found in {hooks_src_dir} or {hooks_lib_dir}")
        
        # Copy server components if they exist
        server_source = self.project_dir / "apps" / "server"
        if server_source.exists():
            shutil.copytree(server_source, self.install_dir / "server", dirs_exist_ok=True, ignore=ignore_patterns)
            self.print_success("Copied server components")
        else:
            # If no server directory yet, create basic structure
            self.print_warning("Server components not found, creating basic structure")
            (self.install_dir / "server").mkdir(exist_ok=True)
        
        # Copy dashboard
        dashboard_source = self.project_dir / "apps" / "dashboard"
        if dashboard_source.exists():
            shutil.copytree(dashboard_source, self.install_dir / "dashboard", dirs_exist_ok=True, ignore=ignore_patterns)
            self.print_success("Copied dashboard components")
        else:
            self.print_warning(f"Dashboard source not found in {dashboard_source}")
        
        # Create server configuration
        self.create_server_config()
    
    def create_server_config(self) -> None:
        """Create server configuration files."""
        self.print_status("Creating server configuration...")
        
        # Create SQLite database configuration
        server_config = {
            "database": {
                "type": "sqlite",
                "path": "data/chronicle.db",
                "timeout": 5000,
                "retry_attempts": 3
            },
            "server": {
                "host": "localhost",
                "port": 8080,
                "cors_origin": "http://localhost:3000"
            },
            "logging": {
                "level": "info",
                "file": "logs/chronicle.log"
            }
        }
        
        with open(self.install_dir / "server" / "config.json", 'w') as f:
            json.dump(server_config, f, indent=2)
        
        # Create environment file for hooks
        hooks_env = f"""# Chronicle Local Configuration
CLAUDE_HOOKS_DB_TYPE=sqlite
CLAUDE_HOOKS_DB_PATH={self.install_dir}/server/data/chronicle.db
LOG_LEVEL=info
CHRONICLE_LOG_FILE={self.install_dir}/server/logs/chronicle.log

# Security Configuration
SANITIZE_DATA=true
PII_FILTERING=true
MAX_INPUT_SIZE_MB=10

# Performance Configuration
HOOK_TIMEOUT_MS=100
ASYNC_OPERATIONS=true
"""
        
        with open(self.install_dir / "hooks" / ".env", 'w') as f:
            f.write(hooks_env)
        
        # Create environment file for dashboard
        dashboard_env = f"""# Chronicle Dashboard Configuration
NEXT_PUBLIC_ENVIRONMENT=production
NEXT_PUBLIC_API_URL=http://localhost:8080
NEXT_PUBLIC_DATABASE_TYPE=sqlite
NEXT_PUBLIC_DEBUG=false

# Local SQLite configuration (no external dependencies)
DATABASE_URL=file:../server/data/chronicle.db
"""
        
        with open(self.install_dir / "dashboard" / ".env.local", 'w') as f:
            f.write(dashboard_env)
        
        self.print_success("Created server configuration files")
    
    def install_python_dependencies(self) -> None:
        """Install Python dependencies."""
        if self.skip_deps:
            self.print_status("Skipping Python dependencies installation")
            return
        
        self.print_status("Installing Python dependencies...")
        
        hooks_dir = self.install_dir / "hooks"
        requirements_file = hooks_dir / "requirements.txt"
        
        if not requirements_file.exists():
            raise InstallationError(f"Requirements file not found: {requirements_file}")
        
        if self.use_uv:
            # Install dependencies with UV
            self.run_command(["uv", "pip", "install", "-r", str(requirements_file), "--system"], cwd=hooks_dir)
        else:
            # Install dependencies with pip
            self.run_command([self.python_cmd, "-m", "pip", "install", "-r", str(requirements_file), "--user"], cwd=hooks_dir)
        
        self.print_success("Python dependencies installed")
    
    def install_nodejs_dependencies(self) -> None:
        """Install Node.js dependencies."""
        if self.skip_deps:
            self.print_status("Skipping Node.js dependencies installation")
            return
        
        self.print_status("Installing Node.js dependencies...")
        
        dashboard_dir = self.install_dir / "dashboard"
        
        # Use --silent to reduce output noise
        self.run_command(["npm", "install", "--silent"], cwd=dashboard_dir)
        
        self.print_success("Node.js dependencies installed")
    
    def initialize_database(self) -> None:
        """Initialize SQLite database."""
        self.print_status("Initializing SQLite database...")
        
        # Create basic SQLite database
        db_path = self.install_dir / "server" / "data" / "chronicle.db"
        db_path.parent.mkdir(parents=True, exist_ok=True)
        
        try:
            # Try to use Chronicle's database manager
            hooks_dir = self.install_dir / "hooks"
            init_script = f"""
import sys
sys.path.append('src')
try:
    from lib.database import DatabaseManager
    db = DatabaseManager()
    if hasattr(db, 'setup_schema'):
        db.setup_schema()
    print('Database initialized successfully')
except Exception as e:
    print(f'Database initialization warning: {{e}}')
    # Create basic database file
    import sqlite3
    import os
    
    db_path = r'{db_path}'
    conn = sqlite3.connect(db_path)
    conn.execute('CREATE TABLE IF NOT EXISTS chronicle_sessions (id TEXT PRIMARY KEY, created_at TIMESTAMP)')
    conn.execute('CREATE TABLE IF NOT EXISTS chronicle_events (id TEXT PRIMARY KEY, session_id TEXT, event_type TEXT, timestamp TIMESTAMP)')
    conn.commit()
    conn.close()
    print('Basic database created')
"""
            
            if self.use_uv:
                # Create a temporary script file for UV
                with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as f:
                    f.write(init_script)
                    temp_script = f.name
                
                try:
                    self.run_command(["uv", "run", "python", temp_script], cwd=hooks_dir)
                finally:
                    os.unlink(temp_script)
            else:
                # Run with regular python - use sys.executable if python_cmd not set
                python_cmd = self.python_cmd if self.python_cmd else sys.executable
                result = self.run_command([python_cmd, "-c", init_script], cwd=hooks_dir, capture=True)
                print(result.stdout)
                
        except Exception as e:
            # Fallback: create basic SQLite database manually
            self.print_warning(f"Database initialization failed ({e}), creating basic database...")
            
            conn = sqlite3.connect(db_path)
            conn.execute('CREATE TABLE IF NOT EXISTS chronicle_sessions (id TEXT PRIMARY KEY, created_at TIMESTAMP)')
            conn.execute('CREATE TABLE IF NOT EXISTS chronicle_events (id TEXT PRIMARY KEY, session_id TEXT, event_type TEXT, timestamp TIMESTAMP)')
            conn.commit()
            conn.close()
        
        self.print_success(f"Database initialized at {db_path}")
    
    def configure_claude_hooks(self) -> None:
        """Configure Claude Code hooks."""
        self.print_status("Configuring Claude Code hooks...")
        
        # Since we already have the hooks in the right place, just use simple registration
        # The complex installer script expects a different structure than what we have
        self.simple_hook_registration()
        
        self.print_success("Claude Code hooks configured")
    
    def simple_hook_registration(self) -> None:
        """Update Claude settings.json to register Chronicle hooks."""
        self.print_status("Registering hooks in Claude settings.json...")
        
        claude_dir = self.home_dir / ".claude"
        settings_file = claude_dir / "settings.json"
        chronicle_hooks_dir = self.install_dir / "hooks"
        
        # Load existing settings or create new
        if settings_file.exists():
            with open(settings_file, 'r') as f:
                settings = json.load(f)
        else:
            settings = {}
        
        # Initialize hooks section if it doesn't exist
        if 'hooks' not in settings:
            settings['hooks'] = {}
        
        # Map of event names to hook files
        hook_mappings = {
            'SessionStart': ['session_start.py'],
            'Stop': ['stop.py'],
            'PreToolUse': ['pre_tool_use.py'],
            'PostToolUse': ['post_tool_use.py'],
            'UserPromptSubmit': ['user_prompt_submit.py'],
            'PreCompact': ['pre_compact.py'],
            'Notification': ['notification.py'],
            'SubagentStop': ['subagent_stop.py']
        }
        
        # Register each hook
        for event_name, hook_files in hook_mappings.items():
            # Initialize event array if it doesn't exist
            if event_name not in settings['hooks']:
                settings['hooks'][event_name] = []
            
            # Check if we already have Chronicle hooks registered
            existing_configs = settings['hooks'][event_name]
            chronicle_config_exists = False
            
            for config in existing_configs:
                if 'hooks' in config:
                    for hook in config['hooks']:
                        if 'chronicle' in hook.get('command', '').lower():
                            chronicle_config_exists = True
                            break
            
            # Add Chronicle hooks if not already registered
            if not chronicle_config_exists:
                hook_configs = []
                for hook_file in hook_files:
                    hook_path = chronicle_hooks_dir / hook_file
                    if hook_path.exists():
                        hook_configs.append({
                            'type': 'command',
                            'command': str(hook_path),
                            'description': f'Chronicle {event_name} hook'
                        })
                        self.print_success(f"  Registered {event_name}: {hook_file}")
                
                if hook_configs:
                    settings['hooks'][event_name].append({
                        'hooks': hook_configs
                    })
        
        # Write updated settings
        with open(settings_file, 'w') as f:
            json.dump(settings, f, indent=2)
        
        self.print_success("Hooks registered in settings.json")
    
    def build_dashboard(self) -> None:
        """Build the dashboard for production."""
        self.print_status("Building dashboard...")
        
        dashboard_dir = self.install_dir / "dashboard"
        
        # Build the dashboard
        self.run_command(["npm", "run", "build"], cwd=dashboard_dir)
        
        self.print_success("Dashboard built successfully")
    
    def create_startup_script(self) -> None:
        """Create startup script for Chronicle."""
        if self.is_windows:
            # Create Windows batch file
            startup_script = self.install_dir / "start.bat"
            content = f"""@echo off
echo Starting Chronicle Dashboard...
cd /d "{self.install_dir}\\dashboard"

REM Check if build exists
if not exist ".next" (
    echo Building dashboard...
    npm run build
)

echo Chronicle Dashboard starting at http://localhost:3000
start http://localhost:3000
npm start
"""
        else:
            # Create Unix shell script
            startup_script = self.install_dir / "start.sh"
            content = f"""#!/bin/bash

# Chronicle Startup Script
INSTALL_DIR="{self.install_dir}"

echo "Starting Chronicle Dashboard..."
cd "$INSTALL_DIR/dashboard"

# Check if build exists
if [ ! -d ".next" ]; then
    echo "Building dashboard..."
    npm run build
fi

echo "Chronicle Dashboard starting at http://localhost:3000"

# Open dashboard in browser (if available)
if command -v open &> /dev/null; then
    sleep 3 && open http://localhost:3000 &
elif command -v xdg-open &> /dev/null; then
    sleep 3 && xdg-open http://localhost:3000 &
fi

npm start
"""
        
        with open(startup_script, 'w') as f:
            f.write(content)
        
        if not self.is_windows:
            # Make executable on Unix systems
            startup_script.chmod(0o755)
        
        self.print_success(f"Created startup script: {startup_script}")
    
    def start_services(self) -> None:
        """Start Chronicle services."""
        if self.no_start:
            self.print_status("Skipping server startup")
            return
        
        self.print_status("Starting Chronicle services...")
        
        # Create startup script
        self.create_startup_script()
        
        dashboard_dir = self.install_dir / "dashboard"
        
        # Start dashboard in background
        try:
            if self.is_windows:
                # On Windows, use start command to open in new window
                subprocess.Popen(["npm", "start"], cwd=dashboard_dir, shell=True, creationflags=subprocess.CREATE_NEW_CONSOLE)
            else:
                # On Unix, start in background
                subprocess.Popen(["npm", "start"], cwd=dashboard_dir)
            
            # Give server time to start
            time.sleep(3)
            
            # Open dashboard in browser
            try:
                webbrowser.open("http://localhost:3000")
            except:
                pass
            
            self.print_success("Chronicle dashboard started!")
            print("")
            print("Dashboard: http://localhost:3000")
            
        except Exception as e:
            self.print_warning(f"Failed to start dashboard automatically: {e}")
            print("You can start it manually with:")
            if self.is_windows:
                print(f"  {self.install_dir}\\start.bat")
            else:
                print(f"  {self.install_dir}/start.sh")
    
    def show_completion(self) -> None:
        """Show installation completion message."""
        elapsed = int(time.time() - self.start_time)
        minutes, seconds = divmod(elapsed, 60)
        
        print("")
        self.print_success("Chronicle installation completed successfully!")
        print("")
        print("🎉 Chronicle is now active and monitoring Claude Code!")
        print("")
        print("What's installed:")
        print(f"  📁 Installation: {self.install_dir}")
        print("  🔗 Claude Hooks: Configured automatically")  
        print("  🗄️  Database: Local SQLite (no external dependencies)")
        print("  🌐 Dashboard: http://localhost:3000")
        print("")
        print("Next steps:")
        print("  1. Open Claude Code in any project")
        print("  2. Use Claude Code normally (read files, run commands, etc.)")
        print("  3. View real-time activity in the dashboard")
        print("")
        print("Useful commands:")
        if self.is_windows:
            print(f"  Start Chronicle: {self.install_dir}\\start.bat")
        else:
            print(f"  Start Chronicle: {self.install_dir}/start.sh")
        print(f"  View logs: {self.install_dir}/server/logs/chronicle.log")
        print(f"  Database: {self.install_dir}/server/data/chronicle.db")
        print("")
        print(f"Total installation time: {minutes}m {seconds}s")
    
    def install(self) -> None:
        """Run the complete installation process."""
        try:
            self.print_header()
            
            # Check dependencies
            if not self.skip_deps:
                self.detect_python()
                self.detect_uv()
                self.detect_nodejs()
            
            # Create installation structure
            self.create_directories()
            self.copy_components()
            
            # Install dependencies
            self.install_python_dependencies()
            self.install_nodejs_dependencies()
            
            # Initialize system
            self.initialize_database()
            self.configure_claude_hooks()
            
            # Build dashboard (skip if dependencies were skipped)
            if not self.skip_deps:
                try:
                    self.build_dashboard()
                except subprocess.CalledProcessError as e:
                    self.print_warning("Dashboard build failed (dependencies may be missing)")
                    self.print_warning("Run 'npm install' in dashboard directory to fix")
            else:
                self.print_status("Skipping dashboard build (dependencies skipped)")
            
            # Start services
            self.start_services()
            
            # Show completion message
            self.show_completion()
            
        except InstallationError as e:
            self.print_error(str(e))
            # Don't clean up - leave for debugging
            self.print_warning("Installation failed - files left in place for debugging")
            self.print_warning(f"Check: {self.install_dir}")
            sys.exit(1)
        except KeyboardInterrupt:
            self.print_error("Installation cancelled by user")
            # Clean up on error
            if self.install_dir.exists():
                try:
                    shutil.rmtree(self.install_dir)
                    self.print_status("Cleaned up partial installation")
                except:
                    pass
            sys.exit(1)


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="Chronicle One-Command Installer",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__
    )
    
    parser.add_argument(
        "--skip-deps",
        action="store_true",
        help="Skip dependency installation"
    )
    
    parser.add_argument(
        "--no-start",
        action="store_true", 
        help="Don't start server after installation"
    )
    
    parser.add_argument(
        "--force",
        action="store_true",
        help="Force overwrite existing installation"
    )
    
    args = parser.parse_args()
    
    # Create and run installer
    installer = ChronicleInstaller(
        skip_deps=args.skip_deps,
        no_start=args.no_start,
        force=args.force
    )
    
    installer.install()


if __name__ == "__main__":
    main()