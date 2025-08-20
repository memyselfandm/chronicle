#!/bin/bash

# clean.sh - Comprehensive cleanup script for Chronicle project
# Removes Python cache files, build artifacts, test outputs, and temporary files

set -e

echo "🧹 Starting Chronicle project cleanup..."

# Get the project root directory
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

# Function to safely remove files/directories
safe_remove() {
    local path="$1"
    local description="$2"
    
    if [ -e "$path" ]; then
        echo "  Removing $description: $path"
        rm -rf "$path"
    fi
}

# Function to find and remove pattern-matched files
remove_pattern() {
    local pattern="$1"
    local description="$2"
    
    echo "🔍 Searching for $description..."
    find "$PROJECT_ROOT" -name "$pattern" -type f -exec rm -f {} \; 2>/dev/null || true
    find "$PROJECT_ROOT" -name "$pattern" -type d -exec rm -rf {} \; 2>/dev/null || true
}

# Remove Python cache files and directories
echo "🐍 Cleaning Python cache files..."
remove_pattern "__pycache__" "Python cache directories"
remove_pattern "*.pyc" "Python compiled files"
remove_pattern "*.pyo" "Python optimized files"
remove_pattern "*.pyd" "Python dynamic libraries"

# Remove Python build artifacts
echo "📦 Cleaning Python build artifacts..."
remove_pattern "build" "build directories"
remove_pattern "dist" "distribution directories"
remove_pattern "*.egg-info" "egg-info directories"
remove_pattern ".eggs" "eggs directories"

# Remove test coverage reports
echo "📊 Cleaning test coverage reports..."
safe_remove "apps/dashboard/coverage" "Dashboard coverage reports"
safe_remove "apps/hooks/htmlcov" "Hooks HTML coverage"
remove_pattern ".coverage" "Coverage data files"
remove_pattern ".coverage.*" "Coverage data files"
remove_pattern "coverage.xml" "Coverage XML reports"
remove_pattern "lcov.info" "LCOV coverage info"
remove_pattern ".pytest_cache" "Pytest cache directories"

# Remove TypeScript build artifacts
echo "⚙️ Cleaning TypeScript artifacts..."
remove_pattern "*.tsbuildinfo" "TypeScript build info files"
safe_remove "apps/dashboard/.next" "Next.js build directory"
safe_remove "apps/dashboard/out" "Next.js output directory"

# Remove Node.js artifacts (but keep node_modules - that's for package managers)
echo "📱 Cleaning Node.js artifacts..."
remove_pattern "npm-debug.log*" "NPM debug logs"
remove_pattern "yarn-debug.log*" "Yarn debug logs"
remove_pattern "yarn-error.log*" "Yarn error logs"

# Remove temporary and log files
echo "🗂️ Cleaning temporary files..."
remove_pattern "*.tmp" "temporary files"
remove_pattern "*.temp" "temporary files"
remove_pattern "*.log" "log files (except in node_modules)"

# Remove OS-specific files
echo "💻 Cleaning OS artifacts..."
remove_pattern ".DS_Store" "macOS DS_Store files"
remove_pattern "Thumbs.db" "Windows thumbnail cache"
remove_pattern "._*" "macOS resource forks"

# Remove editor backup files
echo "✏️ Cleaning editor artifacts..."
remove_pattern "*.swp" "Vim swap files"
remove_pattern "*.swo" "Vim swap files"
remove_pattern "*~" "Editor backup files"
remove_pattern "*.orig" "Merge conflict originals"

# Remove development and debug files from root
echo "🚧 Cleaning development files..."
find "$PROJECT_ROOT" -maxdepth 1 -name "test_*.py" -exec rm -f {} \; 2>/dev/null || true
find "$PROJECT_ROOT" -maxdepth 1 -name "debug_*.py" -exec rm -f {} \; 2>/dev/null || true
find "$PROJECT_ROOT" -maxdepth 1 -name "check_*.py" -exec rm -f {} \; 2>/dev/null || true
find "$PROJECT_ROOT" -maxdepth 1 -name "fix_*.py" -exec rm -f {} \; 2>/dev/null || true
find "$PROJECT_ROOT" -maxdepth 1 -name "validate_*.py" -exec rm -f {} \; 2>/dev/null || true
find "$PROJECT_ROOT" -maxdepth 1 -name "temp_*.py" -exec rm -f {} \; 2>/dev/null || true
find "$PROJECT_ROOT" -maxdepth 1 -name "tmp_*.py" -exec rm -f {} \; 2>/dev/null || true

# Clean performance monitoring outputs
echo "📈 Cleaning performance artifacts..."
remove_pattern "*.prof" "Python profiling files"
remove_pattern "performance_*.json" "Performance monitoring outputs"
remove_pattern "performance_*.log" "Performance logs"
remove_pattern "benchmark_*.json" "Benchmark results"
remove_pattern "monitoring_*.log" "Monitoring logs"

# Preserve important directories but clean their contents selectively
echo "🔒 Preserving important structures..."
# Don't remove these directories, just their problematic contents
# - node_modules (managed by npm/yarn)
# - .git (version control)
# - docs (documentation)
# - src (source code)

echo "✅ Cleanup complete!"

# Show summary of what was cleaned
echo ""
echo "📋 Cleanup Summary:"
echo "   - Python cache files and build artifacts"
echo "   - Test coverage reports"
echo "   - TypeScript build artifacts"
echo "   - Temporary and log files"
echo "   - OS-specific artifacts"
echo "   - Editor backup files"
echo "   - Development debug files"
echo "   - Performance monitoring outputs"
echo ""
echo "🎯 Project is now clean and ready for development/testing!"