#!/bin/bash

# Chronicle Health Check Script
# Comprehensive system validation and diagnostics

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
NC='\033[0m'
BOLD='\033[1m'

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

print_header() {
    echo -e "${BOLD}${BLUE}"
    echo "=============================================="
    echo "  🏥 Chronicle Health Check & Diagnostics"
    echo "=============================================="
    echo -e "${NC}"
    echo "Checking system health and configuration..."
    echo
}

print_section() {
    echo -e "${BOLD}${PURPLE}📋 $1${NC}"
    echo "----------------------------------------"
}

print_check() {
    echo -n "  $1: "
}

print_pass() {
    echo -e "${GREEN}✅ PASS${NC} $1"
}

print_fail() {
    echo -e "${RED}❌ FAIL${NC} $1"
}

print_warn() {
    echo -e "${YELLOW}⚠️ WARN${NC} $1"
}

print_info() {
    echo -e "${BLUE}ℹ️ INFO${NC} $1"
}

# System Requirements Check
check_system() {
    print_section "System Requirements"
    
    # Node.js
    if command -v node >/dev/null 2>&1; then
        local node_version=$(node --version | cut -d 'v' -f 2)
        local major_version=$(echo $node_version | cut -d '.' -f 1)
        if [ "$major_version" -ge 18 ]; then
            print_pass "Node.js $node_version"
        else
            print_fail "Node.js version too old ($node_version). Need 18+"
        fi
    else
        print_fail "Node.js not found"
    fi
    
    # Python
    if command -v python3 >/dev/null 2>&1; then
        local python_version=$(python3 --version | cut -d ' ' -f 2)
        print_pass "Python $python_version"
    elif command -v python >/dev/null 2>&1; then
        local python_version=$(python --version | cut -d ' ' -f 2)
        print_pass "Python $python_version"
    else
        print_fail "Python not found"
    fi
    
    # Git
    if command -v git >/dev/null 2>&1; then
        local git_version=$(git --version | cut -d ' ' -f 3)
        print_pass "Git $git_version"
    else
        print_fail "Git not found"
    fi
    
    # Package managers
    if command -v npm >/dev/null 2>&1; then
        print_pass "npm $(npm --version)"
    else
        print_fail "npm not found"
    fi
    
    if command -v pnpm >/dev/null 2>&1; then
        print_info "pnpm $(pnpm --version) available"
    fi
    
    if command -v uv >/dev/null 2>&1; then
        print_info "uv $(uv --version) available"
    fi
    
    echo
}

# Project Structure Check
check_project_structure() {
    print_section "Project Structure"
    
    local required_files=(
        "apps/dashboard/package.json"
        "apps/dashboard/next.config.ts"
        "apps/hooks/requirements.txt"
        "apps/hooks/install.py"
        "apps/hooks/src/database.py"
        "apps/hooks/config/schema.sql"
    )
    
    for file in "${required_files[@]}"; do
        if [ -f "$PROJECT_ROOT/$file" ]; then
            print_pass "$file exists"
        else
            print_fail "$file missing"
        fi
    done
    
    # Check for documentation
    local docs=(
        "README.md"
        "INSTALLATION.md"
        "CONFIGURATION.md"
        "DEPLOYMENT.md"
        "TROUBLESHOOTING.md"
        "SECURITY.md"
        "SUPABASE_SETUP.md"
    )
    
    for doc in "${docs[@]}"; do
        if [ -f "$PROJECT_ROOT/$doc" ]; then
            print_pass "$doc exists"
        else
            print_warn "$doc missing"
        fi
    done
    
    echo
}

# Configuration Check
check_configuration() {
    print_section "Configuration"
    
    # Dashboard configuration
    if [ -f "$PROJECT_ROOT/apps/dashboard/.env.local" ]; then
        print_pass "Dashboard environment file exists"
        
        # Check required variables
        if grep -q "NEXT_PUBLIC_SUPABASE_URL" "$PROJECT_ROOT/apps/dashboard/.env.local"; then
            print_pass "NEXT_PUBLIC_SUPABASE_URL configured"
        else
            print_fail "NEXT_PUBLIC_SUPABASE_URL not configured"
        fi
        
        if grep -q "NEXT_PUBLIC_SUPABASE_ANON_KEY" "$PROJECT_ROOT/apps/dashboard/.env.local"; then
            print_pass "NEXT_PUBLIC_SUPABASE_ANON_KEY configured"
        else
            print_fail "NEXT_PUBLIC_SUPABASE_ANON_KEY not configured"
        fi
    else
        print_fail "Dashboard environment file missing (.env.local)"
    fi
    
    # Hooks configuration
    if [ -f "$PROJECT_ROOT/apps/hooks/.env" ]; then
        print_pass "Hooks environment file exists"
        
        # Check required variables
        if grep -q "SUPABASE_URL" "$PROJECT_ROOT/apps/hooks/.env"; then
            print_pass "SUPABASE_URL configured"
        else
            print_fail "SUPABASE_URL not configured"
        fi
        
        if grep -q "SUPABASE_ANON_KEY" "$PROJECT_ROOT/apps/hooks/.env"; then
            print_pass "SUPABASE_ANON_KEY configured"
        else
            print_fail "SUPABASE_ANON_KEY not configured"
        fi
    else
        print_fail "Hooks environment file missing (.env)"
    fi
    
    # File permissions
    if [ -f "$PROJECT_ROOT/apps/dashboard/.env.local" ]; then
        local perms=$(stat -c "%a" "$PROJECT_ROOT/apps/dashboard/.env.local" 2>/dev/null || stat -f "%A" "$PROJECT_ROOT/apps/dashboard/.env.local" 2>/dev/null)
        if [ "$perms" = "600" ] || [ "$perms" = "0600" ]; then
            print_pass "Dashboard .env.local has secure permissions ($perms)"
        else
            print_warn "Dashboard .env.local permissions not secure ($perms, should be 600)"
        fi
    fi
    
    echo
}

# Dependencies Check
check_dependencies() {
    print_section "Dependencies"
    
    # Dashboard dependencies
    if [ -d "$PROJECT_ROOT/apps/dashboard/node_modules" ]; then
        print_pass "Dashboard dependencies installed"
        
        # Check key dependencies
        local key_deps=("next" "@supabase/supabase-js" "react" "typescript")
        for dep in "${key_deps[@]}"; do
            if [ -d "$PROJECT_ROOT/apps/dashboard/node_modules/$dep" ]; then
                print_pass "$dep installed"
            else
                print_fail "$dep not installed"
            fi
        done
    else
        print_fail "Dashboard dependencies not installed"
    fi
    
    # Hooks dependencies
    cd "$PROJECT_ROOT/apps/hooks"
    
    local python_cmd="python3"
    if ! command -v python3 >/dev/null 2>&1; then
        python_cmd="python"
    fi
    
    # Check if requirements are satisfied
    if $python_cmd -m pip check >/dev/null 2>&1; then
        print_pass "Hooks dependencies satisfied"
    else
        print_warn "Hooks dependencies have conflicts"
    fi
    
    # Check key Python packages
    local key_packages=("asyncpg" "aiofiles" "pydantic" "python-dotenv")
    for package in "${key_packages[@]}"; do
        if $python_cmd -c "import $package" >/dev/null 2>&1; then
            print_pass "$package available"
        else
            print_fail "$package not available"
        fi
    done
    
    cd "$PROJECT_ROOT"
    echo
}

# Database Connection Check
check_database() {
    print_section "Database Connection"
    
    cd "$PROJECT_ROOT/apps/hooks"
    
    local python_cmd="python3"
    if ! command -v python3 >/dev/null 2>&1; then
        python_cmd="python"
    fi
    
    # Test database connection
    if $python_cmd -c "
import os
from src.database import DatabaseManager
try:
    dm = DatabaseManager()
    result = dm.test_connection()
    if result:
        print('SUCCESS')
    else:
        print('FAILED')
except Exception as e:
    print(f'ERROR: {e}')
" 2>/dev/null | grep -q "SUCCESS"; then
        print_pass "Database connection successful"
    else
        print_fail "Database connection failed"
    fi
    
    # Check SQLite fallback
    local fallback_path="$HOME/.chronicle/fallback.db"
    if [ -f "$fallback_path" ]; then
        print_info "SQLite fallback database exists"
        if command -v sqlite3 >/dev/null 2>&1; then
            local table_count=$(sqlite3 "$fallback_path" ".tables" 2>/dev/null | wc -w)
            if [ "$table_count" -gt 0 ]; then
                print_pass "SQLite fallback has $table_count tables"
            else
                print_warn "SQLite fallback database is empty"
            fi
        fi
    else
        print_info "SQLite fallback database not yet created"
    fi
    
    # Test Supabase URL if available
    if [ -f ".env" ] && grep -q "SUPABASE_URL" ".env"; then
        local supabase_url=$(grep "SUPABASE_URL" ".env" | cut -d '=' -f 2)
        local supabase_key=$(grep "SUPABASE_ANON_KEY" ".env" | cut -d '=' -f 2)
        
        if command -v curl >/dev/null 2>&1 && [ -n "$supabase_url" ] && [ -n "$supabase_key" ]; then
            local http_status=$(curl -s -o /dev/null -w "%{http_code}" -H "apikey: $supabase_key" "$supabase_url/rest/v1/" 2>/dev/null)
            if [ "$http_status" = "200" ]; then
                print_pass "Supabase API accessible"
            else
                print_fail "Supabase API not accessible (HTTP $http_status)"
            fi
        fi
    fi
    
    cd "$PROJECT_ROOT"
    echo
}

# Claude Code Integration Check
check_claude_integration() {
    print_section "Claude Code Integration"
    
    # Check Claude directory
    if [ -d "$HOME/.claude" ]; then
        print_pass "Claude directory exists"
        
        # Check hooks directory
        if [ -d "$HOME/.claude/hooks" ]; then
            print_pass "Claude hooks directory exists"
            
            local hook_count=$(ls "$HOME/.claude/hooks"/*.py 2>/dev/null | wc -l)
            if [ "$hook_count" -gt 0 ]; then
                print_pass "$hook_count hook scripts found"
                
                # Check hook permissions
                local executable_count=$(find "$HOME/.claude/hooks" -name "*.py" -executable 2>/dev/null | wc -l)
                if [ "$executable_count" -eq "$hook_count" ]; then
                    print_pass "All hooks are executable"
                else
                    print_warn "Some hooks are not executable ($executable_count/$hook_count)"
                fi
            else
                print_fail "No hook scripts found"
            fi
        else
            print_fail "Claude hooks directory not found"
        fi
        
        # Check settings.json
        if [ -f "$HOME/.claude/settings.json" ]; then
            print_pass "Claude settings.json exists"
            
            if command -v jq >/dev/null 2>&1; then
                if jq . "$HOME/.claude/settings.json" >/dev/null 2>&1; then
                    print_pass "settings.json is valid JSON"
                    
                    if jq '.hooks' "$HOME/.claude/settings.json" >/dev/null 2>&1; then
                        print_pass "Hooks configuration present"
                    else
                        print_warn "No hooks configuration in settings.json"
                    fi
                else
                    print_fail "settings.json is invalid JSON"
                fi
            else
                print_info "jq not available - cannot validate JSON"
            fi
        else
            print_warn "Claude settings.json not found"
        fi
    else
        print_fail "Claude directory not found"
    fi
    
    # Test hook execution
    cd "$PROJECT_ROOT/apps/hooks"
    
    local python_cmd="python3"
    if ! command -v python3 >/dev/null 2>&1; then
        python_cmd="python"
    fi
    
    if [ -f "$HOME/.claude/hooks/pre_tool_use.py" ]; then
        if echo '{"session_id":"test","tool_name":"Read"}' | $python_cmd "$HOME/.claude/hooks/pre_tool_use.py" >/dev/null 2>&1; then
            print_pass "Hook execution test successful"
        else
            print_fail "Hook execution test failed"
        fi
    else
        print_warn "pre_tool_use.py not found - cannot test execution"
    fi
    
    cd "$PROJECT_ROOT"
    echo
}

# Service Status Check
check_services() {
    print_section "Service Status"
    
    # Check if dashboard is running
    if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null 2>&1; then
        print_pass "Dashboard service running on port 3000"
        
        # Test HTTP response
        if command -v curl >/dev/null 2>&1; then
            local http_status=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 2>/dev/null)
            if [ "$http_status" = "200" ]; then
                print_pass "Dashboard responds to HTTP requests"
            else
                print_warn "Dashboard not responding properly (HTTP $http_status)"
            fi
        fi
    else
        print_info "Dashboard service not running"
    fi
    
    # Check for other common ports
    local ports=(80 443 5432)
    for port in "${ports[@]}"; do
        if lsof -Pi :$port -sTCP:LISTEN -t >/dev/null 2>&1; then
            print_info "Service running on port $port"
        fi
    done
    
    echo
}

# Log Files Check
check_logs() {
    print_section "Log Files"
    
    # Chronicle logs
    if [ -d "$HOME/.chronicle/logs" ]; then
        print_pass "Chronicle logs directory exists"
        
        local log_count=$(ls "$HOME/.chronicle/logs"/*.log 2>/dev/null | wc -l)
        if [ "$log_count" -gt 0 ]; then
            print_pass "$log_count log files found"
        else
            print_info "No log files found"
        fi
    else
        print_info "Chronicle logs directory not found"
    fi
    
    # Claude logs
    if [ -f "$HOME/.claude/hooks.log" ]; then
        print_pass "Claude hooks log exists"
        
        local log_size=$(du -h "$HOME/.claude/hooks.log" 2>/dev/null | cut -f1)
        print_info "Hooks log size: $log_size"
        
        # Check for recent activity
        if [ -f "$HOME/.claude/hooks.log" ]; then
            local recent_lines=$(tail -n 10 "$HOME/.claude/hooks.log" 2>/dev/null | wc -l)
            if [ "$recent_lines" -gt 0 ]; then
                print_info "Recent activity in hooks log"
            fi
        fi
    else
        print_info "Claude hooks log not found"
    fi
    
    # Claude Code logs
    if [ -d "$HOME/.claude/logs" ]; then
        print_pass "Claude Code logs directory exists"
    else
        print_info "Claude Code logs directory not found"
    fi
    
    echo
}

# Performance Check
check_performance() {
    print_section "Performance"
    
    # Disk space
    local disk_usage=$(df -h "$HOME" | awk 'NR==2 {print $5}' | sed 's/%//')
    if [ "$disk_usage" -lt 90 ]; then
        print_pass "Disk usage: $disk_usage%"
    else
        print_warn "Disk usage high: $disk_usage%"
    fi
    
    # Memory usage
    if command -v free >/dev/null 2>&1; then
        local mem_usage=$(free | grep Mem | awk '{printf "%.0f", $3/$2 * 100.0}')
        if [ "$mem_usage" -lt 80 ]; then
            print_pass "Memory usage: $mem_usage%"
        else
            print_warn "Memory usage high: $mem_usage%"
        fi
    elif command -v vm_stat >/dev/null 2>&1; then
        print_info "Memory info available via vm_stat (macOS)"
    fi
    
    # Load average (Linux/macOS)
    if [ -f "/proc/loadavg" ]; then
        local load_avg=$(cut -d ' ' -f 1 /proc/loadavg)
        print_info "Load average: $load_avg"
    elif command -v uptime >/dev/null 2>&1; then
        local load_avg=$(uptime | awk -F'load average:' '{print $2}' | awk '{print $1}' | sed 's/,//')
        print_info "Load average: $load_avg"
    fi
    
    echo
}

# Network Connectivity Check
check_network() {
    print_section "Network Connectivity"
    
    # Test internet connectivity
    if ping -c 1 google.com >/dev/null 2>&1; then
        print_pass "Internet connectivity"
    else
        print_fail "No internet connectivity"
    fi
    
    # Test Supabase connectivity
    if command -v curl >/dev/null 2>&1; then
        if curl -s --max-time 5 https://supabase.com >/dev/null 2>&1; then
            print_pass "Supabase.com reachable"
        else
            print_warn "Cannot reach supabase.com"
        fi
    fi
    
    # Check DNS resolution
    if nslookup google.com >/dev/null 2>&1; then
        print_pass "DNS resolution working"
    else
        print_warn "DNS resolution issues"
    fi
    
    echo
}

# Generate Summary Report
generate_summary() {
    print_section "Health Check Summary"
    
    echo "Health check completed at $(date)"
    echo
    echo "Key findings:"
    echo "• Check each section above for detailed results"
    echo "• Look for ❌ FAIL items that need immediate attention"
    echo "• Review ⚠️ WARN items for potential improvements"
    echo "• ✅ PASS items indicate healthy components"
    echo
    echo "Next steps:"
    echo "• Fix any failed checks before using Chronicle"
    echo "• Review warnings for optimization opportunities"
    echo "• Run this health check periodically"
    echo
    echo "For help with issues, see:"
    echo "• TROUBLESHOOTING.md for common problems"
    echo "• INSTALLATION.md for setup guidance"
    echo "• CONFIGURATION.md for config help"
}

# Main execution
main() {
    print_header
    
    check_system
    check_project_structure
    check_configuration
    check_dependencies
    check_database
    check_claude_integration
    check_services
    check_logs
    check_performance
    check_network
    
    generate_summary
}

# Run health check
main