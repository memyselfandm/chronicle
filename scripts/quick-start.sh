#!/bin/bash

# Chronicle Quick Start & Validation Script
# Complete setup and validation in under 30 minutes

set -e  # Exit on any error

# Colors and formatting
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
START_TIME=$(date +%s)

# Function to print colored output
print_header() {
    echo -e "${BOLD}${BLUE}"
    echo "=================================================================="
    echo "  🚀 Chronicle Quick Start & Validation Script"
    echo "  Complete setup and validation in under 30 minutes"
    echo "=================================================================="
    echo -e "${NC}"
}

print_step() {
    echo -e "${BOLD}${CYAN}▶ $1${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
    exit 1
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

print_time() {
    local current_time=$(date +%s)
    local elapsed=$((current_time - START_TIME))
    local minutes=$((elapsed / 60))
    local seconds=$((elapsed % 60))
    echo -e "${PURPLE}⏱️  Elapsed time: ${minutes}m ${seconds}s${NC}"
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to get user input with default
get_input() {
    local prompt="$1"
    local default="$2"
    local input
    
    if [ -n "$default" ]; then
        read -p "$prompt [$default]: " input
        echo "${input:-$default}"
    else
        read -p "$prompt: " input
        echo "$input"
    fi
}

# Function to validate URL format
validate_url() {
    local url="$1"
    if [[ $url =~ ^https://.*\.supabase\.co$ ]]; then
        return 0
    else
        return 1
    fi
}

# Function to test network connectivity
test_network() {
    print_step "Testing network connectivity"
    
    if ping -c 1 google.com >/dev/null 2>&1; then
        print_success "Network connectivity verified"
    else
        print_error "No network connectivity. Please check your internet connection."
    fi
}

# Function to check system requirements
check_requirements() {
    print_step "Checking system requirements"
    
    local requirements_met=true
    
    # Check Node.js
    if command_exists node; then
        local node_version=$(node --version | cut -d 'v' -f 2 | cut -d '.' -f 1)
        if [ "$node_version" -ge 18 ]; then
            print_success "Node.js $(node --version) ✓"
        else
            print_error "Node.js 18+ required. Current version: $(node --version)"
            requirements_met=false
        fi
    else
        print_error "Node.js not found. Install from https://nodejs.org/"
        requirements_met=false
    fi
    
    # Check Python
    PYTHON_CMD="python3"
    if ! command_exists python3; then
        PYTHON_CMD="python"
        if ! command_exists python; then
            print_error "Python not found. Install Python 3.8+ from https://python.org/"
            requirements_met=false
        fi
    fi
    
    if command_exists $PYTHON_CMD; then
        local python_version=$($PYTHON_CMD --version 2>&1 | grep -oE '[0-9]+\.[0-9]+' | head -1)
        local major_version=$(echo $python_version | cut -d '.' -f 1)
        local minor_version=$(echo $python_version | cut -d '.' -f 2)
        
        if [ "$major_version" -eq 3 ] && [ "$minor_version" -ge 8 ]; then
            print_success "Python $($PYTHON_CMD --version) ✓"
        else
            print_error "Python 3.8+ required. Current version: $($PYTHON_CMD --version)"
            requirements_met=false
        fi
    fi
    
    # Check Git
    if command_exists git; then
        print_success "Git $(git --version | cut -d ' ' -f 3) ✓"
    else
        print_error "Git not found. Install from https://git-scm.com/"
        requirements_met=false
    fi
    
    # Check package managers
    if command_exists npm; then
        print_success "npm $(npm --version) ✓"
    else
        print_error "npm not found (should come with Node.js)"
        requirements_met=false
    fi
    
    # Check for faster alternatives
    if command_exists pnpm; then
        PACKAGE_MANAGER="pnpm"
        print_info "Using pnpm for faster installs"
    else
        PACKAGE_MANAGER="npm"
    fi
    
    if command_exists uv; then
        UV_AVAILABLE=true
        print_info "Using uv for faster Python installs"
    else
        UV_AVAILABLE=false
    fi
    
    if [ "$requirements_met" = false ]; then
        print_error "System requirements not met. Please install missing dependencies."
    fi
    
    print_success "System requirements check passed"
    print_time
}

# Function to get Supabase configuration
get_supabase_config() {
    print_step "Configuring Supabase connection"
    
    echo -e "${BOLD}Please provide your Supabase configuration:${NC}"
    echo "You can find these values in your Supabase project dashboard:"
    echo "1. Go to https://supabase.com/dashboard"
    echo "2. Select your project"
    echo "3. Navigate to Settings > API"
    echo ""
    
    # Get Supabase URL
    while true; do
        SUPABASE_URL=$(get_input "Supabase URL (https://xxx.supabase.co)")
        if validate_url "$SUPABASE_URL"; then
            break
        else
            print_warning "Invalid URL format. Expected: https://xxx.supabase.co"
        fi
    done
    
    # Get Supabase keys
    SUPABASE_ANON_KEY=$(get_input "Supabase Anonymous Key")
    SUPABASE_SERVICE_KEY=$(get_input "Supabase Service Role Key (optional)")
    
    # Test connection
    print_info "Testing Supabase connection..."
    if command_exists curl; then
        HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -H "apikey: $SUPABASE_ANON_KEY" "$SUPABASE_URL/rest/v1/")
        if [ "$HTTP_STATUS" = "200" ]; then
            print_success "Supabase connection verified"
        else
            print_warning "Could not verify Supabase connection (HTTP $HTTP_STATUS)"
            if ! get_confirmation "Continue anyway?"; then
                print_error "Setup cancelled"
            fi
        fi
    else
        print_warning "curl not available - skipping connection test"
    fi
    
    print_time
}

# Function to get confirmation
get_confirmation() {
    local prompt="$1"
    local response
    read -p "$prompt (y/N): " -n 1 -r response
    echo
    [[ $response =~ ^[Yy]$ ]]
}

# Function to install dashboard
install_dashboard() {
    print_step "Installing dashboard dependencies"
    
    cd "$PROJECT_ROOT/apps/dashboard"
    
    # Install dependencies
    if [ "$PACKAGE_MANAGER" = "pnpm" ]; then
        pnpm install --prefer-offline
    else
        npm ci --prefer-offline
    fi
    
    # Create environment file
    if [ ! -f ".env.local" ]; then
        print_info "Creating dashboard environment configuration"
        cat > .env.local << EOF
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=$SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=$SUPABASE_ANON_KEY

# Environment Settings
NEXT_PUBLIC_ENVIRONMENT=development
NEXT_PUBLIC_DEBUG=false

# Feature Flags
NEXT_PUBLIC_ENABLE_REALTIME=true
NEXT_PUBLIC_ENABLE_ANALYTICS=true
NEXT_PUBLIC_ENABLE_EXPORT=true
EOF
        print_success "Dashboard environment configured"
    else
        print_warning "Dashboard .env.local already exists - skipping"
    fi
    
    # Test build
    print_info "Testing dashboard build..."
    if [ "$PACKAGE_MANAGER" = "pnpm" ]; then
        timeout 60s pnpm run build >/dev/null 2>&1 && print_success "Dashboard builds successfully" || print_warning "Dashboard build test failed (timeout or error)"
    else
        timeout 60s npm run build >/dev/null 2>&1 && print_success "Dashboard builds successfully" || print_warning "Dashboard build test failed (timeout or error)"
    fi
    
    cd "$PROJECT_ROOT"
    print_success "Dashboard installation complete"
    print_time
}

# Function to install hooks
install_hooks() {
    print_step "Installing hooks system dependencies"
    
    cd "$PROJECT_ROOT/apps/hooks"
    
    # Install dependencies
    if [ "$UV_AVAILABLE" = true ]; then
        uv pip install -r requirements.txt
    else
        $PYTHON_CMD -m pip install -r requirements.txt
    fi
    
    # Create environment file
    if [ ! -f ".env" ]; then
        print_info "Creating hooks environment configuration"
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
CLAUDE_HOOKS_DB_PATH=$HOME/.chronicle/fallback.db

# Logging Configuration
CLAUDE_HOOKS_LOG_LEVEL=INFO
CLAUDE_HOOKS_DEBUG=false

# Security Configuration
CLAUDE_HOOKS_SANITIZE_DATA=true
CLAUDE_HOOKS_PII_FILTERING=true
CLAUDE_HOOKS_MAX_INPUT_SIZE_MB=10

# Performance Configuration
CLAUDE_HOOKS_EXECUTION_TIMEOUT_MS=100
CLAUDE_HOOKS_ASYNC_OPERATIONS=true
EOF
        print_success "Hooks environment configured"
    else
        print_warning "Hooks .env already exists - skipping"
    fi
    
    cd "$PROJECT_ROOT"
    print_success "Hooks installation complete"
    print_time
}

# Function to setup database
setup_database() {
    print_step "Setting up database schema"
    
    cd "$PROJECT_ROOT/apps/hooks"
    
    # Try to setup schema
    if $PYTHON_CMD -c "
from src.database import DatabaseManager
dm = DatabaseManager()
try:
    dm.setup_schema()
    print('SUCCESS: Schema setup complete')
except Exception as e:
    print(f'ERROR: {e}')
    exit(1)
" 2>/dev/null; then
        print_success "Database schema created successfully"
    else
        print_warning "Automatic schema setup failed"
        echo "Please manually setup the database schema:"
        echo "1. Open your Supabase dashboard"
        echo "2. Go to SQL Editor"
        echo "3. Copy and execute the schema from apps/hooks/config/schema.sql"
        
        if ! get_confirmation "Have you manually setup the database schema?"; then
            print_error "Database schema is required for Chronicle to function"
        fi
    fi
    
    cd "$PROJECT_ROOT"
    print_time
}

# Function to install Claude Code hooks
install_claude_hooks() {
    print_step "Installing Claude Code hooks"
    
    cd "$PROJECT_ROOT/apps/hooks"
    
    # Create .claude directory if it doesn't exist
    mkdir -p "$HOME/.claude"
    
    # Run hooks installer
    if $PYTHON_CMD install.py --auto-confirm >/dev/null 2>&1; then
        print_success "Claude Code hooks installed successfully"
    else
        print_warning "Hooks installer reported issues"
        
        # Manual installation
        print_info "Attempting manual hook installation..."
        mkdir -p "$HOME/.claude/hooks"
        cp *.py "$HOME/.claude/hooks/" 2>/dev/null || true
        chmod +x "$HOME/.claude/hooks"/*.py 2>/dev/null || true
        
        if [ -f "$HOME/.claude/hooks/pre_tool_use.py" ]; then
            print_success "Manual hook installation successful"
        else
            print_warning "Manual hook installation failed"
        fi
    fi
    
    cd "$PROJECT_ROOT"
    print_time
}

# Function to run comprehensive validation
run_validation() {
    print_step "Running comprehensive validation"
    
    local validation_errors=0
    
    # Check dashboard setup
    print_info "Validating dashboard setup..."
    
    if [ -f "$PROJECT_ROOT/apps/dashboard/.env.local" ]; then
        print_success "✓ Dashboard environment file exists"
    else
        print_error "✗ Dashboard environment file missing"
        ((validation_errors++))
    fi
    
    if [ -d "$PROJECT_ROOT/apps/dashboard/node_modules" ]; then
        print_success "✓ Dashboard dependencies installed"
    else
        print_error "✗ Dashboard dependencies missing"
        ((validation_errors++))
    fi
    
    # Check hooks setup
    print_info "Validating hooks setup..."
    
    if [ -f "$PROJECT_ROOT/apps/hooks/.env" ]; then
        print_success "✓ Hooks environment file exists"
    else
        print_error "✗ Hooks environment file missing"
        ((validation_errors++))
    fi
    
    # Test hooks installation
    cd "$PROJECT_ROOT/apps/hooks"
    if $PYTHON_CMD install.py --validate-only >/dev/null 2>&1; then
        print_success "✓ Hooks installation validated"
    else
        print_warning "⚠ Hooks validation reported issues"
        ((validation_errors++))
    fi
    
    # Check Claude directory
    if [ -d "$HOME/.claude/hooks" ]; then
        print_success "✓ Claude Code hooks directory exists"
        
        local hook_count=$(ls "$HOME/.claude/hooks"/*.py 2>/dev/null | wc -l)
        if [ "$hook_count" -gt 0 ]; then
            print_success "✓ Hook scripts found ($hook_count files)"
        else
            print_warning "⚠ No hook scripts found"
            ((validation_errors++))
        fi
    else
        print_warning "⚠ Claude Code hooks directory not found"
        ((validation_errors++))
    fi
    
    # Test database connection
    print_info "Testing database connection..."
    if $PYTHON_CMD -c "
from src.database import DatabaseManager
dm = DatabaseManager()
result = dm.test_connection()
print('SUCCESS' if result else 'FAILED')
" 2>/dev/null | grep -q "SUCCESS"; then
        print_success "✓ Database connection successful"
    else
        print_warning "⚠ Database connection failed"
        ((validation_errors++))
    fi
    
    # Test hook execution
    print_info "Testing hook execution..."
    if echo '{"session_id":"test","tool_name":"Read"}' | $PYTHON_CMD pre_tool_use.py >/dev/null 2>&1; then
        print_success "✓ Hook execution test passed"
    else
        print_warning "⚠ Hook execution test failed"
        ((validation_errors++))
    fi
    
    cd "$PROJECT_ROOT"
    
    # Summary
    if [ $validation_errors -eq 0 ]; then
        print_success "All validation checks passed! 🎉"
        return 0
    else
        print_warning "Validation completed with $validation_errors issues"
        return 1
    fi
}

# Function to start services
start_services() {
    print_step "Starting development services"
    
    # Check if services are already running
    if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null; then
        print_warning "Port 3000 already in use. Skipping dashboard start."
    else
        print_info "Starting dashboard on http://localhost:3000"
        cd "$PROJECT_ROOT/apps/dashboard"
        
        # Start dashboard in background
        if [ "$PACKAGE_MANAGER" = "pnpm" ]; then
            nohup pnpm run dev >/dev/null 2>&1 &
        else
            nohup npm run dev >/dev/null 2>&1 &
        fi
        
        local dashboard_pid=$!
        
        # Wait for dashboard to start
        print_info "Waiting for dashboard to start..."
        local attempts=0
        while [ $attempts -lt 30 ]; do
            if curl -s http://localhost:3000 >/dev/null 2>&1; then
                print_success "Dashboard started successfully (PID: $dashboard_pid)"
                break
            fi
            sleep 1
            ((attempts++))
        done
        
        if [ $attempts -eq 30 ]; then
            print_warning "Dashboard start timeout - check manually"
        fi
    fi
    
    cd "$PROJECT_ROOT"
    print_time
}

# Function to show next steps
show_next_steps() {
    local end_time=$(date +%s)
    local total_time=$((end_time - START_TIME))
    local minutes=$((total_time / 60))
    local seconds=$((total_time % 60))
    
    echo
    print_success "🎉 Chronicle setup complete!"
    echo -e "${PURPLE}📊 Total setup time: ${minutes}m ${seconds}s${NC}"
    echo
    echo -e "${BOLD}${BLUE}🚀 Next Steps:${NC}"
    echo
    echo "1. Open the dashboard:"
    echo "   🌐 http://localhost:3000"
    echo
    echo "2. Test Claude Code integration:"
    echo "   • Start Claude Code in any project directory"
    echo "   • Perform some actions (read files, run commands)"
    echo "   • Check the dashboard for live events"
    echo
    echo "3. Monitor and troubleshoot:"
    echo "   📋 Dashboard logs: Browser console"
    echo "   📋 Hook logs: ~/.claude/hooks.log"
    echo "   📋 Claude Code logs: ~/.claude/logs/"
    echo
    echo "4. Production deployment:"
    echo "   📖 See docs/guides/deployment.md for production setup"
    echo "   🔒 See docs/guides/security.md for security best practices"
    echo
    echo "5. Get help:"
    echo "   📚 Read TROUBLESHOOTING.md for common issues"
    echo "   🔧 Run './scripts/health-check.sh' for diagnostics"
    echo
    echo -e "${GREEN}${BOLD}Happy observing! 🔍✨${NC}"
}

# Function to show usage
show_usage() {
    echo "Usage: $0 [OPTIONS]"
    echo
    echo "Quick start script for Chronicle observability system"
    echo
    echo "Options:"
    echo "  --skip-deps        Skip dependency installation"
    echo "  --skip-validation  Skip validation tests"
    echo "  --no-start         Don't start development services"
    echo "  --help             Show this help message"
    echo
}

# Parse command line arguments
SKIP_DEPS=false
SKIP_VALIDATION=false
NO_START=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --skip-deps)
            SKIP_DEPS=true
            shift
            ;;
        --skip-validation)
            SKIP_VALIDATION=true
            shift
            ;;
        --no-start)
            NO_START=true
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

# Main execution flow
main() {
    print_header
    
    # Check network connectivity
    test_network
    
    # Check system requirements
    check_requirements
    
    # Get Supabase configuration
    get_supabase_config
    
    # Install components
    if [ "$SKIP_DEPS" = false ]; then
        install_dashboard
        install_hooks
    else
        print_info "Skipping dependency installation"
    fi
    
    # Setup database
    setup_database
    
    # Install Claude Code hooks
    install_claude_hooks
    
    # Run validation
    if [ "$SKIP_VALIDATION" = false ]; then
        if run_validation; then
            print_success "✅ All validation checks passed!"
        else
            print_warning "⚠️ Some validation issues found (see above)"
            if ! get_confirmation "Continue anyway?"; then
                print_error "Setup cancelled due to validation issues"
            fi
        fi
    else
        print_info "Skipping validation"
    fi
    
    # Start services
    if [ "$NO_START" = false ]; then
        start_services
    else
        print_info "Skipping service startup"
    fi
    
    # Show next steps
    show_next_steps
}

# Create necessary directories
mkdir -p "$HOME/.chronicle"

# Run main function
main