#!/bin/bash

# Chronicle Observability System - Automated Installer
# Installs both dashboard and hooks components with configuration

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
DASHBOARD_DIR="$PROJECT_ROOT/apps/dashboard"
HOOKS_DIR="$PROJECT_ROOT/apps/hooks"
CLAUDE_DIR="${HOME}/.claude"

# Default values
INSTALL_MODE="full"
SKIP_DEPS=false
SKIP_DB_SETUP=false
VALIDATE_ONLY=false

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
    echo "=============================================="
    echo "  Chronicle Observability System Installer"
    echo "=============================================="
    echo -e "${NC}"
}

# Function to check system requirements
check_requirements() {
    print_status "Checking system requirements..."
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        print_error "Node.js not found. Please install Node.js 18+ from https://nodejs.org/"
    fi
    
    NODE_VERSION=$(node --version | cut -d 'v' -f 2 | cut -d '.' -f 1)
    if [ "$NODE_VERSION" -lt 18 ]; then
        print_error "Node.js version 18+ required. Current version: $(node --version)"
    fi
    
    # Check Python
    if ! command -v python3 &> /dev/null && ! command -v python &> /dev/null; then
        print_error "Python not found. Please install Python 3.8+ from https://python.org/"
    fi
    
    # Use python3 if available, otherwise python
    PYTHON_CMD="python3"
    if ! command -v python3 &> /dev/null; then
        PYTHON_CMD="python"
    fi
    
    PYTHON_VERSION=$($PYTHON_CMD --version 2>&1 | grep -oE '[0-9]+\.[0-9]+' | head -1)
    MAJOR_VERSION=$(echo $PYTHON_VERSION | cut -d '.' -f 1)
    MINOR_VERSION=$(echo $PYTHON_VERSION | cut -d '.' -f 2)
    
    if [ "$MAJOR_VERSION" -lt 3 ] || ([ "$MAJOR_VERSION" -eq 3 ] && [ "$MINOR_VERSION" -lt 8 ]); then
        print_error "Python 3.8+ required. Current version: $($PYTHON_CMD --version)"
    fi
    
    # Check Git
    if ! command -v git &> /dev/null; then
        print_error "Git not found. Please install Git from https://git-scm.com/"
    fi
    
    # Check for package managers
    PACKAGE_MANAGER="npm"
    if command -v pnpm &> /dev/null; then
        PACKAGE_MANAGER="pnpm"
        print_status "Using pnpm for Node.js packages"
    else
        print_status "Using npm for Node.js packages"
    fi
    
    UV_AVAILABLE=false
    if command -v uv &> /dev/null; then
        UV_AVAILABLE=true
        print_status "Using uv for Python packages (faster)"
    else
        print_status "Using pip for Python packages"
    fi
    
    print_success "System requirements check passed"
}

# Function to prompt for Supabase configuration
configure_supabase() {
    print_status "Configuring Supabase connection..."
    
    echo
    echo "Please provide your Supabase configuration:"
    echo "You can find these values in your Supabase project dashboard under Settings > API"
    echo
    
    read -p "Supabase URL (https://xxx.supabase.co): " SUPABASE_URL
    read -p "Supabase Anonymous Key: " SUPABASE_ANON_KEY
    read -p "Supabase Service Role Key (optional, for advanced features): " SUPABASE_SERVICE_KEY
    
    # Validate URL format
    if [[ ! $SUPABASE_URL =~ ^https://.*\.supabase\.co$ ]]; then
        print_warning "URL format looks incorrect. Expected format: https://xxx.supabase.co"
        read -p "Continue anyway? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_error "Installation cancelled"
        fi
    fi
    
    # Test connection
    print_status "Testing Supabase connection..."
    if command -v curl &> /dev/null; then
        HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -H "apikey: $SUPABASE_ANON_KEY" "$SUPABASE_URL/rest/v1/")
        if [ "$HTTP_STATUS" != "200" ]; then
            print_warning "Could not connect to Supabase (HTTP $HTTP_STATUS). Please verify your credentials."
            read -p "Continue with installation? (y/N): " -n 1 -r
            echo
            if [[ ! $REPLY =~ ^[Yy]$ ]]; then
                print_error "Installation cancelled"
            fi
        else
            print_success "Supabase connection verified"
        fi
    fi
}

# Function to install dashboard dependencies
install_dashboard() {
    print_status "Installing dashboard dependencies..."
    
    cd "$DASHBOARD_DIR"
    
    if [ "$SKIP_DEPS" = false ]; then
        $PACKAGE_MANAGER install
        print_success "Dashboard dependencies installed"
    fi
    
    # Create environment file
    if [ ! -f ".env.local" ]; then
        print_status "Creating dashboard environment configuration..."
        cat > .env.local << EOF
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=$SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY

# Environment
NEXT_PUBLIC_ENVIRONMENT=development
NEXT_PUBLIC_DEBUG=false
EOF
        print_success "Dashboard environment configured"
    else
        print_warning "Dashboard .env.local already exists, skipping configuration"
    fi
}

# Function to install hooks dependencies
install_hooks() {
    print_status "Installing hooks system dependencies..."
    
    cd "$HOOKS_DIR"
    
    if [ "$SKIP_DEPS" = false ]; then
        if [ "$UV_AVAILABLE" = true ]; then
            uv pip install -r requirements.txt
        else
            $PYTHON_CMD -m pip install -r requirements.txt
        fi
        print_success "Hooks dependencies installed"
    fi
    
    # Create environment file
    if [ ! -f ".env" ]; then
        print_status "Creating hooks environment configuration..."
        cat > .env << EOF
# Database Configuration - Primary
SUPABASE_URL=$SUPABASE_URL
SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY
EOF
        
        if [ -n "$SUPABASE_SERVICE_KEY" ]; then
            echo "SUPABASE_SERVICE_ROLE_KEY=$SUPABASE_SERVICE_KEY" >> .env
        fi
        
        cat >> .env << EOF

# Database Configuration - Fallback
SQLITE_FALLBACK_PATH=$HOME/.chronicle/fallback.db

# Logging Configuration
LOG_LEVEL=INFO
HOOKS_DEBUG=false

# Security Configuration
SANITIZE_DATA=true
PII_FILTERING=true
MAX_INPUT_SIZE_MB=10

# Performance Configuration
HOOK_TIMEOUT_MS=100
ASYNC_OPERATIONS=true
EOF
        print_success "Hooks environment configured"
    else
        print_warning "Hooks .env already exists, skipping configuration"
    fi
}

# Function to setup database schema
setup_database() {
    if [ "$SKIP_DB_SETUP" = true ]; then
        print_status "Skipping database setup"
        return
    fi
    
    print_status "Setting up database schema..."
    
    cd "$HOOKS_DIR"
    
    # Try to setup schema programmatically
    if $PYTHON_CMD -c "from src.database import DatabaseManager; DatabaseManager().setup_schema()" 2>/dev/null; then
        print_success "Database schema created successfully"
    else
        print_warning "Automatic schema setup failed. Please manually run the schema from apps/hooks/config/schema.sql in your Supabase dashboard"
        read -p "Have you manually setup the database schema? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_error "Database schema is required for Chronicle to function"
        fi
    fi
}

# Function to install Claude Code hooks
install_claude_hooks() {
    print_status "Installing Claude Code hooks..."
    
    cd "$HOOKS_DIR"
    
    # Run the hooks installer
    if $PYTHON_CMD install.py --auto-confirm; then
        print_success "Claude Code hooks installed successfully"
    else
        print_warning "Automatic hook installation failed. You may need to run 'python install.py' manually"
    fi
}

# Function to validate installation
validate_installation() {
    print_status "Validating installation..."
    
    local validation_errors=0
    
    # Check dashboard
    print_status "Checking dashboard setup..."
    if [ -f "$DASHBOARD_DIR/.env.local" ]; then
        print_success "Dashboard environment file exists"
    else
        print_error "Dashboard environment file missing"
        ((validation_errors++))
    fi
    
    if [ -d "$DASHBOARD_DIR/node_modules" ]; then
        print_success "Dashboard dependencies installed"
    else
        print_error "Dashboard dependencies missing"
        ((validation_errors++))
    fi
    
    # Check hooks
    print_status "Checking hooks setup..."
    if [ -f "$HOOKS_DIR/.env" ]; then
        print_success "Hooks environment file exists"
    else
        print_error "Hooks environment file missing"
        ((validation_errors++))
    fi
    
    # Test hooks installation
    cd "$HOOKS_DIR"
    if $PYTHON_CMD install.py --validate-only &>/dev/null; then
        print_success "Hooks installation validated"
    else
        print_warning "Hooks validation failed - may need manual setup"
        ((validation_errors++))
    fi
    
    # Check Claude directory
    if [ -d "$CLAUDE_DIR/hooks" ]; then
        print_success "Claude Code hooks directory exists"
    else
        print_warning "Claude Code hooks directory not found"
        ((validation_errors++))
    fi
    
    # Test database connection
    if $PYTHON_CMD -c "from src.database import DatabaseManager; dm = DatabaseManager(); print(dm.test_connection())" 2>/dev/null | grep -q "True"; then
        print_success "Database connection successful"
    else
        print_warning "Database connection failed - check Supabase configuration"
        ((validation_errors++))
    fi
    
    if [ $validation_errors -eq 0 ]; then
        print_success "Installation validation passed"
        return 0
    else
        print_warning "Installation validation found $validation_errors issues"
        return 1
    fi
}

# Function to run quick test
run_quick_test() {
    print_status "Running quick functionality test..."
    
    # Test dashboard can start
    print_status "Testing dashboard startup..."
    cd "$DASHBOARD_DIR"
    timeout 10s $PACKAGE_MANAGER run build >/dev/null 2>&1 && print_success "Dashboard builds successfully" || print_warning "Dashboard build test failed"
    
    # Test hooks can execute
    print_status "Testing hooks execution..."
    cd "$HOOKS_DIR"
    if echo '{"session_id":"test","tool_name":"Read"}' | $PYTHON_CMD pre_tool_use.py >/dev/null 2>&1; then
        print_success "Hooks execution test passed"
    else
        print_warning "Hooks execution test failed"
    fi
}

# Function to show next steps
show_next_steps() {
    echo
    print_success "Chronicle installation complete!"
    echo
    echo -e "${BLUE}Next Steps:${NC}"
    echo
    echo "1. Start the dashboard:"
    echo "   cd apps/dashboard"
    echo "   $PACKAGE_MANAGER run dev"
    echo "   Open http://localhost:3000"
    echo
    echo "2. Test Claude Code integration:"
    echo "   Start Claude Code in any project"
    echo "   Perform some actions (read files, run commands)"
    echo "   Check the dashboard for live events"
    echo
    echo "3. Monitor logs:"
    echo "   Dashboard: Browser console and terminal"
    echo "   Hooks: ~/.claude/hooks.log"
    echo "   Claude Code: ~/.claude/logs/"
    echo
    echo "4. Troubleshooting:"
    echo "   - Review INSTALLATION.md for detailed guidance"
    echo "   - Check environment variables in .env files"
    echo "   - Verify database schema in Supabase dashboard"
    echo
    echo -e "${GREEN}Happy observing!${NC}"
}

# Function to show usage
show_usage() {
    echo "Usage: $0 [OPTIONS]"
    echo
    echo "Options:"
    echo "  --dashboard-only    Install only the dashboard component"
    echo "  --hooks-only        Install only the hooks component"
    echo "  --skip-deps         Skip dependency installation"
    echo "  --skip-db-setup     Skip database schema setup"
    echo "  --validate-only     Only validate existing installation"
    echo "  --help             Show this help message"
    echo
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --dashboard-only)
            INSTALL_MODE="dashboard"
            shift
            ;;
        --hooks-only)
            INSTALL_MODE="hooks"
            shift
            ;;
        --skip-deps)
            SKIP_DEPS=true
            shift
            ;;
        --skip-db-setup)
            SKIP_DB_SETUP=true
            shift
            ;;
        --validate-only)
            VALIDATE_ONLY=true
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

# Main installation flow
main() {
    print_header
    
    if [ "$VALIDATE_ONLY" = true ]; then
        validate_installation
        exit $?
    fi
    
    check_requirements
    
    if [ "$INSTALL_MODE" = "full" ] || [ "$INSTALL_MODE" = "dashboard" ] || [ "$INSTALL_MODE" = "hooks" ]; then
        configure_supabase
    fi
    
    if [ "$INSTALL_MODE" = "full" ] || [ "$INSTALL_MODE" = "dashboard" ]; then
        install_dashboard
    fi
    
    if [ "$INSTALL_MODE" = "full" ] || [ "$INSTALL_MODE" = "hooks" ]; then
        install_hooks
        setup_database
        install_claude_hooks
    fi
    
    if validate_installation; then
        run_quick_test
        show_next_steps
    else
        print_warning "Installation completed with validation issues. Please review the output above."
    fi
}

# Create necessary directories
mkdir -p "$HOME/.chronicle"

# Run main installation
main