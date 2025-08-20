#!/bin/bash

# Chronicle Environment Configuration Validation Script
# ==============================================================================
# Validates the Chronicle environment configuration for consistency and completeness
# 
# Usage:
#   ./scripts/validate-env.sh [--verbose] [--fix]
#
# Options:
#   --verbose    Show detailed output
#   --fix        Attempt to fix common issues
# ==============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
VERBOSE=false
FIX_MODE=false
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --verbose)
            VERBOSE=true
            shift
            ;;
        --fix)
            FIX_MODE=true
            shift
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_verbose() {
    if [[ "$VERBOSE" == "true" ]]; then
        echo -e "${BLUE}[DEBUG]${NC} $1"
    fi
}

# Validation functions
validate_file_exists() {
    local file_path="$1"
    local description="$2"
    
    if [[ -f "$file_path" ]]; then
        log_success "$description exists: $file_path"
        return 0
    else
        log_error "$description missing: $file_path"
        return 1
    fi
}

validate_variable_in_file() {
    local file_path="$1"
    local variable="$2"
    local description="$3"
    
    if [[ ! -f "$file_path" ]]; then
        log_error "File not found: $file_path"
        return 1
    fi
    
    if grep -q "^${variable}=" "$file_path" || grep -q "^#.*${variable}=" "$file_path"; then
        log_verbose "$description: $variable found in $file_path"
        return 0
    else
        log_error "$description: $variable missing from $file_path"
        return 1
    fi
}

validate_no_duplicate_config() {
    local file1="$1"
    local file2="$2"
    local variable_pattern="$3"
    local description="$4"
    
    if [[ ! -f "$file1" ]] || [[ ! -f "$file2" ]]; then
        return 0
    fi
    
    local count1=$(grep -c "$variable_pattern" "$file1" 2>/dev/null || echo 0)
    local count2=$(grep -c "$variable_pattern" "$file2" 2>/dev/null || echo 0)
    
    if [[ "$count1" -gt 0 ]] && [[ "$count2" -gt 0 ]]; then
        log_warning "$description: Configuration may be duplicated between $file1 and $file2"
        return 1
    fi
    
    return 0
}

validate_prefix_consistency() {
    local file_path="$1"
    local description="$2"
    
    if [[ ! -f "$file_path" ]]; then
        return 0
    fi
    
    log_verbose "Checking prefix consistency in $file_path"
    
    # Extract variable names (non-comment lines with =)
    local variables=$(grep -E "^[A-Z_]+=.*" "$file_path" | cut -d'=' -f1)
    
    local valid_prefixes=("CHRONICLE_" "NEXT_PUBLIC_" "CLAUDE_HOOKS_" "CLAUDE_PROJECT_DIR" "CLAUDE_SESSION_ID" "NODE_ENV" "SENTRY_")
    local invalid_vars=()
    
    while IFS= read -r var; do
        if [[ -z "$var" ]]; then
            continue
        fi
        
        local has_valid_prefix=false
        for prefix in "${valid_prefixes[@]}"; do
            if [[ "$var" == "$prefix"* ]] || [[ "$var" == "NODE_ENV" ]] || [[ "$var" == "CLAUDE_PROJECT_DIR" ]] || [[ "$var" == "CLAUDE_SESSION_ID" ]]; then
                has_valid_prefix=true
                break
            fi
        done
        
        if [[ "$has_valid_prefix" == "false" ]]; then
            invalid_vars+=("$var")
        fi
    done <<< "$variables"
    
    if [[ ${#invalid_vars[@]} -gt 0 ]]; then
        log_warning "$description: Variables with non-standard prefixes found:"
        for var in "${invalid_vars[@]}"; do
            log_warning "  - $var"
        done
        return 1
    fi
    
    return 0
}

# Main validation
main() {
    log_info "Chronicle Environment Configuration Validation"
    log_info "Project root: $PROJECT_ROOT"
    echo
    
    local errors=0
    local warnings=0
    
    # Check root configuration files
    log_info "Validating root configuration files..."
    
    if ! validate_file_exists "$PROJECT_ROOT/.env.template" "Root environment template"; then
        ((errors++))
    fi
    
    # Check required variables in root template
    if [[ -f "$PROJECT_ROOT/.env.template" ]]; then
        log_info "Validating required variables in root template..."
        
        local required_vars=(
            "CHRONICLE_ENVIRONMENT"
            "CHRONICLE_SUPABASE_URL"
            "CHRONICLE_SUPABASE_ANON_KEY"
            "CHRONICLE_SUPABASE_SERVICE_ROLE_KEY"
            "NEXT_PUBLIC_SUPABASE_URL"
            "NEXT_PUBLIC_SUPABASE_ANON_KEY"
        )
        
        for var in "${required_vars[@]}"; do
            if ! validate_variable_in_file "$PROJECT_ROOT/.env.template" "$var" "Root template"; then
                ((errors++))
            fi
        done
    fi
    
    # Check dashboard configuration
    log_info "Validating dashboard configuration..."
    
    if ! validate_file_exists "$PROJECT_ROOT/apps/dashboard/.env.example" "Dashboard environment example"; then
        ((errors++))
    fi
    
    # Check hooks configuration  
    log_info "Validating hooks configuration..."
    
    if ! validate_file_exists "$PROJECT_ROOT/apps/hooks/.env.template" "Hooks environment template"; then
        ((errors++))
    fi
    
    # Check for configuration duplication
    log_info "Checking for configuration duplication..."
    
    if ! validate_no_duplicate_config \
        "$PROJECT_ROOT/.env.template" \
        "$PROJECT_ROOT/apps/dashboard/.env.example" \
        "SUPABASE_URL=" \
        "Supabase configuration"; then
        ((warnings++))
    fi
    
    # Check prefix consistency
    log_info "Validating naming convention consistency..."
    
    if ! validate_prefix_consistency "$PROJECT_ROOT/.env.template" "Root template"; then
        ((warnings++))
    fi
    
    if ! validate_prefix_consistency "$PROJECT_ROOT/apps/dashboard/.env.example" "Dashboard example"; then
        ((warnings++))
    fi
    
    if ! validate_prefix_consistency "$PROJECT_ROOT/apps/hooks/.env.template" "Hooks template"; then
        ((warnings++))
    fi
    
    # Check documentation
    log_info "Validating documentation..."
    
    if ! validate_file_exists "$PROJECT_ROOT/docs/setup/environment.md" "Environment documentation"; then
        ((errors++))
    fi
    
    # Check that documentation mentions new configuration system
    if [[ -f "$PROJECT_ROOT/docs/setup/environment.md" ]]; then
        if ! grep -q -i "CHRONICLE_" "$PROJECT_ROOT/docs/setup/environment.md"; then
            log_error "Environment documentation should mention CHRONICLE_ prefix"
            ((errors++))
        fi
    fi
    
    # Summary
    echo
    log_info "Validation Summary:"
    
    if [[ $errors -eq 0 ]] && [[ $warnings -eq 0 ]]; then
        log_success "✓ All validations passed! Environment configuration is properly standardized."
    elif [[ $errors -eq 0 ]]; then
        log_warning "⚠ Validation completed with $warnings warnings. Configuration is functional but could be improved."
    else
        log_error "✗ Validation failed with $errors errors and $warnings warnings."
    fi
    
    # Provide fix suggestions
    if [[ $errors -gt 0 ]] || [[ $warnings -gt 0 ]]; then
        echo
        log_info "Fix suggestions:"
        
        if [[ ! -f "$PROJECT_ROOT/.env.template" ]]; then
            echo "  1. Create root .env.template with CHRONICLE_ prefixed variables"
        fi
        
        if [[ $warnings -gt 0 ]]; then
            echo "  2. Review configuration for duplications and inconsistent naming"
        fi
        
        echo "  3. Run with --verbose flag for detailed information"
        
        if [[ "$FIX_MODE" == "true" ]]; then
            echo "  4. Fix mode is experimental - manual fixes recommended"
        fi
    fi
    
    # Exit with appropriate code
    if [[ $errors -gt 0 ]]; then
        exit 1
    elif [[ $warnings -gt 0 ]]; then
        exit 2
    else
        exit 0
    fi
}

# Run main function
main "$@"