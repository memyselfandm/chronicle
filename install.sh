#!/bin/bash

# Chronicle One-Command Installer
# Installs Chronicle with zero configuration to ~/.claude/hooks/chronicle/

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Installation configuration
INSTALL_DIR="$HOME/.claude/hooks/chronicle"
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT_NAME="$(basename "$0")"

# Default values
SKIP_DEPS=false
SKIP_SERVER_START=false
FORCE_INSTALL=false

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
    exit 1
}

print_header() {
    echo -e "${BLUE}"
    echo "=========================================="
    echo "  Chronicle One-Command Installer"
    echo "=========================================="
    echo -e "${NC}"
    echo "Installing Chronicle observability system to:"
    echo "  ~/.claude/hooks/chronicle/"
    echo ""
}

# Function to ask for user confirmation
ask_confirmation() {
    local prompt="$1"
    local default="${2:-N}"
    
    while true; do
        if [[ "$default" == "y" || "$default" == "Y" ]]; then
            read -p "$prompt [Y/n]: " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Nn]$ ]]; then
                return 1
            else
                return 0
            fi
        else
            read -p "$prompt [y/N]: " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                return 0
            else
                return 1
            fi
        fi
    done
}

# Function to detect OS and architecture
detect_system() {
    OS=$(uname -s)
    ARCH=$(uname -m)
    
    case "$OS" in
        Linux*)     PLATFORM="linux" ;;
        Darwin*)    PLATFORM="darwin" ;;
        CYGWIN*|MINGW*|MSYS*) PLATFORM="windows" ;;
        *)          PLATFORM="unknown" ;;
    esac
    
    case "$ARCH" in
        x86_64)     ARCH="x64" ;;
        arm64)      ARCH="arm64" ;;
        aarch64)    ARCH="arm64" ;;
        *)          ARCH="unknown" ;;
    esac
    
    print_status "Detected system: $PLATFORM ($ARCH)"
}

# Function to check and optionally install Python
check_python() {
    print_status "Checking Python installation..."
    
    # Check if Python 3.8+ is available
    PYTHON_CMD=""
    for cmd in python3 python3.12 python3.11 python3.10 python3.9 python3.8 python; do
        if command -v "$cmd" &> /dev/null; then
            VERSION=$($cmd --version 2>&1 | grep -oE '[0-9]+\.[0-9]+' | head -1)
            MAJOR=$(echo $VERSION | cut -d '.' -f 1)
            MINOR=$(echo $VERSION | cut -d '.' -f 2)
            
            if [ "$MAJOR" -eq 3 ] && [ "$MINOR" -ge 8 ]; then
                PYTHON_CMD="$cmd"
                print_success "Found Python $VERSION: $cmd"
                break
            fi
        fi
    done
    
    if [ -z "$PYTHON_CMD" ]; then
        echo ""
        echo "Chronicle needs Python 3.8+ to run the backend server."
        echo "Python manages the local SQLite database and provides hooks for Claude Code."
        echo ""
        if ask_confirmation "Would you like to install Python automatically?"; then
            install_python
        else
            print_error "Python 3.8+ is required. Please install Python from https://python.org/ and try again."
        fi
    fi
    
    export PYTHON_CMD
}

# Function to install Python
install_python() {
    print_status "Installing Python..."
    
    case "$PLATFORM" in
        "darwin")
            if command -v brew &> /dev/null; then
                brew install python@3.11
            else
                print_error "Homebrew not found. Please install Python manually from https://python.org/"
            fi
            ;;
        "linux")
            if command -v apt-get &> /dev/null; then
                sudo apt-get update && sudo apt-get install -y python3 python3-pip python3-venv
            elif command -v yum &> /dev/null; then
                sudo yum install -y python3 python3-pip
            elif command -v dnf &> /dev/null; then
                sudo dnf install -y python3 python3-pip
            else
                print_error "Unsupported Linux distribution. Please install Python manually."
            fi
            ;;
        *)
            print_error "Automatic Python installation not supported on $PLATFORM. Please install Python manually."
            ;;
    esac
    
    # Re-check Python after installation
    check_python
}

# Function to check and optionally install UV
check_uv() {
    print_status "Checking UV package manager..."
    
    if command -v uv &> /dev/null; then
        UV_VERSION=$(uv --version | head -1)
        print_success "Found UV: $UV_VERSION"
        export USE_UV=true
        return 0
    fi
    
    echo ""
    echo "Chronicle uses UV for fast Python package management."
    echo "UV is 10-100x faster than pip and handles dependencies better."
    echo "Alternative: Continue with pip (slower but works everywhere)."
    echo ""
    if ask_confirmation "Would you like to install UV?"; then
        install_uv
        export USE_UV=true
    else
        print_status "Continuing with pip for Python package management"
        export USE_UV=false
    fi
}

# Function to install UV
install_uv() {
    print_status "Installing UV..."
    
    # Use the official UV installer
    if command -v curl &> /dev/null; then
        curl -LsSf https://astral.sh/uv/install.sh | sh
        # Source the new shell environment
        export PATH="$HOME/.cargo/bin:$PATH"
    elif command -v wget &> /dev/null; then
        wget -qO- https://astral.sh/uv/install.sh | sh
        export PATH="$HOME/.cargo/bin:$PATH"
    else
        print_error "Neither curl nor wget found. Cannot install UV automatically."
    fi
    
    # Verify installation
    if command -v uv &> /dev/null; then
        print_success "UV installed successfully"
    else
        print_warning "UV installation may have failed. Falling back to pip."
        export USE_UV=false
    fi
}

# Function to check and optionally install Node.js
check_nodejs() {
    print_status "Checking Node.js installation..."
    
    if command -v node &> /dev/null && command -v npm &> /dev/null; then
        NODE_VERSION=$(node --version | cut -d 'v' -f 2 | cut -d '.' -f 1)
        if [ "$NODE_VERSION" -ge 18 ]; then
            print_success "Found Node.js $(node --version) with npm"
            return 0
        fi
    fi
    
    echo ""
    echo "Chronicle needs Node.js 18+ to run the dashboard frontend."
    echo "The dashboard provides a web interface to view Claude Code activity."
    echo ""
    if ask_confirmation "Would you like to install Node.js automatically?"; then
        install_nodejs
    else
        print_error "Node.js 18+ is required. Please install from https://nodejs.org/ and try again."
    fi
}

# Function to install Node.js
install_nodejs() {
    print_status "Installing Node.js..."
    
    case "$PLATFORM" in
        "darwin")
            if command -v brew &> /dev/null; then
                brew install node
            else
                print_error "Homebrew not found. Please install Node.js manually from https://nodejs.org/"
            fi
            ;;
        "linux")
            # Use NodeSource repository for latest Node.js
            if command -v curl &> /dev/null; then
                curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
                sudo apt-get install -y nodejs
            else
                print_error "Cannot install Node.js automatically. Please install from https://nodejs.org/"
            fi
            ;;
        *)
            print_error "Automatic Node.js installation not supported on $PLATFORM. Please install manually."
            ;;
    esac
    
    # Re-check Node.js after installation
    check_nodejs
}

# Function to create directory structure
create_directories() {
    print_status "Creating directory structure..."
    
    # Check if installation directory already exists
    if [ -d "$INSTALL_DIR" ]; then
        if [ "$FORCE_INSTALL" = false ]; then
            echo ""
            echo "Chronicle installation already exists at: $INSTALL_DIR"
            if ask_confirmation "Would you like to overwrite the existing installation?"; then
                print_warning "Removing existing installation..."
                rm -rf "$INSTALL_DIR"
            else
                print_error "Installation cancelled. Use --force to overwrite existing installation."
            fi
        else
            print_warning "Force install: Removing existing installation..."
            rm -rf "$INSTALL_DIR"
        fi
    fi
    
    # Create directory structure
    mkdir -p "$INSTALL_DIR"/{server,hooks,dashboard}
    mkdir -p "$INSTALL_DIR"/server/{data,logs}
    mkdir -p "$INSTALL_DIR"/hooks/{src,config}
    mkdir -p "$INSTALL_DIR"/dashboard/{src,public}
    
    print_success "Created directory structure in $INSTALL_DIR"
}

# Function to copy Chronicle components
copy_components() {
    print_status "Copying Chronicle components..."
    
    # Copy hooks
    if [ -d "$PROJECT_DIR/apps/hooks" ]; then
        cp -r "$PROJECT_DIR/apps/hooks/"* "$INSTALL_DIR/hooks/"
        print_success "Copied hooks components"
    else
        print_error "Hooks source not found in $PROJECT_DIR/apps/hooks"
    fi
    
    # Copy dashboard
    if [ -d "$PROJECT_DIR/apps/dashboard" ]; then
        cp -r "$PROJECT_DIR/apps/dashboard/"* "$INSTALL_DIR/dashboard/"
        print_success "Copied dashboard components"
    else
        print_error "Dashboard source not found in $PROJECT_DIR/apps/dashboard"
    fi
    
    # Create server configuration
    create_server_config
}

# Function to create server configuration
create_server_config() {
    print_status "Creating server configuration..."
    
    # Create SQLite database configuration
    cat > "$INSTALL_DIR/server/config.json" << 'EOF'
{
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
EOF
    
    # Create environment file for hooks
    cat > "$INSTALL_DIR/hooks/.env" << EOF
# Chronicle Local Configuration
CLAUDE_HOOKS_DB_TYPE=sqlite
CLAUDE_HOOKS_DB_PATH=$INSTALL_DIR/server/data/chronicle.db
LOG_LEVEL=info
CHRONICLE_LOG_FILE=$INSTALL_DIR/server/logs/chronicle.log

# Security Configuration
SANITIZE_DATA=true
PII_FILTERING=true
MAX_INPUT_SIZE_MB=10

# Performance Configuration
HOOK_TIMEOUT_MS=100
ASYNC_OPERATIONS=true
EOF
    
    # Create environment file for dashboard
    cat > "$INSTALL_DIR/dashboard/.env.local" << EOF
# Chronicle Dashboard Configuration
NEXT_PUBLIC_ENVIRONMENT=production
NEXT_PUBLIC_API_URL=http://localhost:8080
NEXT_PUBLIC_DATABASE_TYPE=sqlite
NEXT_PUBLIC_DEBUG=false

# Local SQLite configuration (no external dependencies)
DATABASE_URL=file:../server/data/chronicle.db
EOF
    
    print_success "Created server configuration files"
}

# Function to install Python dependencies
install_python_dependencies() {
    if [ "$SKIP_DEPS" = true ]; then
        print_status "Skipping Python dependencies installation"
        return 0
    fi
    
    print_status "Installing Python dependencies..."
    
    cd "$INSTALL_DIR/hooks"
    
    if [ "$USE_UV" = true ]; then
        # Install dependencies with UV
        uv pip install -r requirements.txt --system
    else
        # Install dependencies with pip
        $PYTHON_CMD -m pip install -r requirements.txt --user
    fi
    
    print_success "Python dependencies installed"
}

# Function to install Node.js dependencies
install_nodejs_dependencies() {
    if [ "$SKIP_DEPS" = true ]; then
        print_status "Skipping Node.js dependencies installation"
        return 0
    fi
    
    print_status "Installing Node.js dependencies..."
    
    cd "$INSTALL_DIR/dashboard"
    npm install --silent
    
    print_success "Node.js dependencies installed"
}

# Function to initialize SQLite database
initialize_database() {
    print_status "Initializing SQLite database..."
    
    cd "$INSTALL_DIR/hooks"
    
    # Use Python to initialize the database
    if [ "$USE_UV" = true ]; then
        uv run python -c "
import sys
sys.path.append('src')
from lib.database import DatabaseManager
try:
    db = DatabaseManager()
    if hasattr(db, 'setup_schema'):
        db.setup_schema()
    print('Database initialized successfully')
except Exception as e:
    print(f'Database initialization warning: {e}')
    # Create basic database file
    import sqlite3
    import os
    db_path = '$INSTALL_DIR/server/data/chronicle.db'
    os.makedirs(os.path.dirname(db_path), exist_ok=True)
    conn = sqlite3.connect(db_path)
    conn.execute('CREATE TABLE IF NOT EXISTS chronicle_sessions (id TEXT PRIMARY KEY, created_at TIMESTAMP)')
    conn.commit()
    conn.close()
    print('Basic database created')
"
    else
        $PYTHON_CMD -c "
import sys
sys.path.append('src')
from lib.database import DatabaseManager
try:
    db = DatabaseManager()
    if hasattr(db, 'setup_schema'):
        db.setup_schema()
    print('Database initialized successfully')
except Exception as e:
    print(f'Database initialization warning: {e}')
    # Create basic database file
    import sqlite3
    import os
    db_path = '$INSTALL_DIR/server/data/chronicle.db'
    os.makedirs(os.path.dirname(db_path), exist_ok=True)
    conn = sqlite3.connect(db_path)
    conn.execute('CREATE TABLE IF NOT EXISTS chronicle_sessions (id TEXT PRIMARY KEY, created_at TIMESTAMP)')
    conn.commit()
    conn.close()
    print('Basic database created')
"
    fi
    
    print_success "Database initialized at $INSTALL_DIR/server/data/chronicle.db"
}

# Function to configure Claude Code hooks
configure_claude_hooks() {
    print_status "Configuring Claude Code hooks..."
    
    cd "$INSTALL_DIR/hooks"
    
    # Run the hooks installer
    if [ "$USE_UV" = true ]; then
        uv run python scripts/install.py --claude-dir "$HOME/.claude" --hooks-dir "." --no-backup
    else
        $PYTHON_CMD scripts/install.py --claude-dir "$HOME/.claude" --hooks-dir "." --no-backup
    fi
    
    print_success "Claude Code hooks configured"
}

# Function to build dashboard
build_dashboard() {
    print_status "Building dashboard..."
    
    cd "$INSTALL_DIR/dashboard"
    npm run build --silent
    
    print_success "Dashboard built successfully"
}

# Function to start server and dashboard
start_services() {
    if [ "$SKIP_SERVER_START" = true ]; then
        print_status "Skipping server startup"
        return 0
    fi
    
    print_status "Starting Chronicle services..."
    
    # Create startup script
    cat > "$INSTALL_DIR/start.sh" << 'EOF'
#!/bin/bash

# Chronicle Startup Script
INSTALL_DIR="$(dirname "$0")"

echo "Starting Chronicle Dashboard..."
cd "$INSTALL_DIR/dashboard"

# Check if build exists
if [ ! -d ".next" ]; then
    echo "Building dashboard..."
    npm run build
fi

# Start the dashboard
npm start &
DASHBOARD_PID=$!

echo "Chronicle Dashboard started (PID: $DASHBOARD_PID)"
echo "Opening dashboard at http://localhost:3000"

# Open dashboard in browser (if available)
if command -v open &> /dev/null; then
    sleep 3 && open http://localhost:3000 &
elif command -v xdg-open &> /dev/null; then
    sleep 3 && xdg-open http://localhost:3000 &
fi

echo "Press Ctrl+C to stop Chronicle"
wait $DASHBOARD_PID
EOF
    
    chmod +x "$INSTALL_DIR/start.sh"
    
    # Start services
    print_success "Starting Chronicle dashboard..."
    "$INSTALL_DIR/start.sh" &
    
    # Wait a moment for services to start
    sleep 2
    
    print_success "Chronicle is now running!"
    echo ""
    echo "Dashboard: http://localhost:3000"
    echo "To restart Chronicle: $INSTALL_DIR/start.sh"
    echo "To stop Chronicle: Press Ctrl+C or kill the dashboard process"
}

# Function to show completion message
show_completion() {
    echo ""
    print_success "Chronicle installation completed successfully!"
    echo ""
    echo -e "${GREEN}🎉 Chronicle is now active and monitoring Claude Code!${NC}"
    echo ""
    echo "What's installed:"
    echo "  📁 Installation: ~/.claude/hooks/chronicle/"
    echo "  🔗 Claude Hooks: Configured automatically"
    echo "  🗄️  Database: Local SQLite (no external dependencies)"
    echo "  🌐 Dashboard: http://localhost:3000"
    echo ""
    echo "Next steps:"
    echo "  1. Open Claude Code in any project"
    echo "  2. Use Claude Code normally (read files, run commands, etc.)"
    echo "  3. View real-time activity in the dashboard"
    echo ""
    echo "Useful commands:"
    echo "  Start Chronicle: ~/.claude/hooks/chronicle/start.sh"
    echo "  View logs: tail -f ~/.claude/hooks/chronicle/server/logs/chronicle.log"
    echo "  Database: ~/.claude/hooks/chronicle/server/data/chronicle.db"
    echo ""
    echo -e "${BLUE}Total installation time: $(($SECONDS / 60))m $(($SECONDS % 60))s${NC}"
}

# Function to handle cleanup on error
cleanup_on_error() {
    if [ $? -ne 0 ]; then
        print_error "Installation failed. Cleaning up..."
        if [ -d "$INSTALL_DIR" ]; then
            rm -rf "$INSTALL_DIR"
        fi
        exit 1
    fi
}

# Function to show usage
show_usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Options:"
    echo "  --skip-deps          Skip dependency installation"
    echo "  --no-start          Don't start server after installation"
    echo "  --force             Force overwrite existing installation"
    echo "  --help              Show this help message"
    echo ""
    echo "This installer will:"
    echo "  • Install Chronicle to ~/.claude/hooks/chronicle/"
    echo "  • Set up local SQLite database (no external services)"
    echo "  • Configure Claude Code hooks automatically"
    echo "  • Install and start the web dashboard"
    echo "  • Complete setup in under 5 minutes"
    echo ""
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --skip-deps)
            SKIP_DEPS=true
            shift
            ;;
        --no-start)
            SKIP_SERVER_START=true
            shift
            ;;
        --force)
            FORCE_INSTALL=true
            shift
            ;;
        --help)
            show_usage
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            show_usage
            exit 1
            ;;
    esac
done

# Set up error handling
trap cleanup_on_error ERR

# Main installation flow
main() {
    print_header
    
    # System detection
    detect_system
    
    # Check and install dependencies
    if [ "$SKIP_DEPS" = false ]; then
        check_python
        check_uv
        check_nodejs
    fi
    
    # Create installation structure
    create_directories
    copy_components
    
    # Install dependencies
    install_python_dependencies
    install_nodejs_dependencies
    
    # Initialize system
    initialize_database
    configure_claude_hooks
    build_dashboard
    
    # Start services
    start_services
    
    # Show completion
    show_completion
}

# Run main installation
main

print_success "Installation script completed successfully!"