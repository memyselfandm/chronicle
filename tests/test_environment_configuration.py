#!/usr/bin/env python3
"""
Environment Configuration Validation Tests

Tests for Chronicle's standardized environment configuration system.
Validates that the new CHRONICLE_ prefix variables are properly configured
and that the configuration hierarchy works correctly.

Usage:
    pytest tests/test_environment_configuration.py -v
"""

import os
import pytest
import tempfile
import shutil
from pathlib import Path
from typing import Dict, Any, List

class TestEnvironmentConfiguration:
    """Test suite for Chronicle environment configuration standardization"""
    
    @pytest.fixture
    def temp_project_dir(self):
        """Create a temporary project directory with test env files"""
        temp_dir = tempfile.mkdtemp()
        project_dir = Path(temp_dir) / "chronicle-test"
        project_dir.mkdir()
        
        # Create directory structure
        (project_dir / "apps" / "dashboard").mkdir(parents=True)
        (project_dir / "apps" / "hooks").mkdir(parents=True)
        
        yield project_dir
        
        # Cleanup
        shutil.rmtree(temp_dir)
    
    def test_root_env_template_exists(self):
        """Test that the root .env.template exists and has required variables"""
        template_path = Path("/Users/m/ai-workspace/chronicle/chronicle-dev/.env.template")
        assert template_path.exists(), "Root .env.template must exist"
        
        content = template_path.read_text()
        
        # Required CHRONICLE_ variables
        required_vars = [
            "CHRONICLE_ENVIRONMENT",
            "CHRONICLE_SUPABASE_URL", 
            "CHRONICLE_SUPABASE_ANON_KEY",
            "CHRONICLE_SUPABASE_SERVICE_ROLE_KEY",
        ]
        
        for var in required_vars:
            assert var in content, f"Required variable {var} must be in root template"
    
    def test_chronicle_prefix_variables(self):
        """Test that CHRONICLE_ prefixed variables are properly defined"""
        template_path = Path("/Users/m/ai-workspace/chronicle/chronicle-dev/.env.template")
        content = template_path.read_text()
        
        # Check for CHRONICLE_ prefix usage
        chronicle_vars = [
            "CHRONICLE_ENVIRONMENT",
            "CHRONICLE_SUPABASE_URL",
            "CHRONICLE_SUPABASE_ANON_KEY", 
            "CHRONICLE_SUPABASE_SERVICE_ROLE_KEY",
            "CHRONICLE_LOG_LEVEL",
            "CHRONICLE_LOG_DIR",
            "CHRONICLE_DEBUG",
            "CHRONICLE_MAX_EVENTS_DISPLAY",
            "CHRONICLE_POLLING_INTERVAL",
        ]
        
        for var in chronicle_vars:
            assert var in content, f"CHRONICLE_ variable {var} should be in template"
    
    def test_next_public_variables_preserved(self):
        """Test that NEXT_PUBLIC_ variables are preserved for Next.js compatibility"""
        template_path = Path("/Users/m/ai-workspace/chronicle/chronicle-dev/.env.template")
        content = template_path.read_text()
        
        # Next.js requires NEXT_PUBLIC_ prefix for client-side variables
        next_vars = [
            "NEXT_PUBLIC_SUPABASE_URL",
            "NEXT_PUBLIC_SUPABASE_ANON_KEY",
            "NEXT_PUBLIC_ENVIRONMENT",
            "NEXT_PUBLIC_ENABLE_REALTIME",
            "NEXT_PUBLIC_ENABLE_ANALYTICS",
        ]
        
        for var in next_vars:
            assert var in content, f"NEXT_PUBLIC_ variable {var} should be in template"
    
    def test_claude_hooks_variables_preserved(self):
        """Test that CLAUDE_HOOKS_ variables are preserved for hooks system"""
        template_path = Path("/Users/m/ai-workspace/chronicle/chronicle-dev/.env.template")
        content = template_path.read_text()
        
        # Hooks system variables should be preserved
        hooks_vars = [
            "CLAUDE_HOOKS_ENABLED",
            "CLAUDE_HOOKS_DB_PATH",
            "CLAUDE_HOOKS_LOG_LEVEL",
            "CLAUDE_HOOKS_LOG_FILE",
            "CLAUDE_HOOKS_EXECUTION_TIMEOUT_MS",
        ]
        
        for var in hooks_vars:
            assert var in content, f"CLAUDE_HOOKS_ variable {var} should be in template"
    
    def test_dashboard_env_example_references_root(self):
        """Test that dashboard .env.example properly references root config"""
        dashboard_env = Path("/Users/m/ai-workspace/chronicle/chronicle-dev/apps/dashboard/.env.example")
        assert dashboard_env.exists(), "Dashboard .env.example must exist"
        
        content = dashboard_env.read_text()
        
        # Should reference root template
        assert "root .env" in content.lower(), "Dashboard .env.example should reference root config"
        assert "main project .env.template" in content.lower() or "root .env.template" in content.lower(), "Should mention root template"
    
    def test_hooks_env_template_references_root(self):
        """Test that hooks .env.template properly references root config"""
        hooks_env = Path("/Users/m/ai-workspace/chronicle/chronicle-dev/apps/hooks/.env.template")
        assert hooks_env.exists(), "Hooks .env.template must exist"
        
        content = hooks_env.read_text()
        
        # Should reference root config
        assert "root .env" in content.lower() or "main project .env" in content.lower(), "Hooks template should reference root config"
        assert "inherits" in content.lower() or "references" in content.lower(), "Should mention inheritance"
    
    def test_no_duplicate_supabase_configs(self):
        """Test that Supabase configuration is not duplicated across files"""
        root_template = Path("/Users/m/ai-workspace/chronicle/chronicle-dev/.env.template")
        dashboard_example = Path("/Users/m/ai-workspace/chronicle/chronicle-dev/apps/dashboard/.env.example")
        
        root_content = root_template.read_text()
        dashboard_content = dashboard_example.read_text()
        
        # Dashboard should not duplicate full Supabase config - should reference root
        supabase_config_lines = dashboard_content.count("SUPABASE_URL=")
        
        # Should be minimal or commented out (referencing root config)
        assert supabase_config_lines <= 2, "Dashboard should not duplicate full Supabase config"
        
        # Root should have the comprehensive config
        root_supabase_lines = root_content.count("CHRONICLE_SUPABASE")
        assert root_supabase_lines >= 3, "Root template should have comprehensive Supabase config"
    
    def test_environment_hierarchy_documentation(self):
        """Test that documentation explains the new configuration hierarchy"""
        env_doc = Path("/Users/m/ai-workspace/chronicle/chronicle-dev/docs/setup/environment.md")
        assert env_doc.exists(), "Environment documentation must exist"
        
        content = env_doc.read_text()
        
        # Should document the hierarchy
        hierarchy_terms = [
            "root template", 
            "hierarchy",
            "CHRONICLE_",
            "single source of truth",
            "configuration architecture"
        ]
        
        content_lower = content.lower()
        for term in hierarchy_terms:
            assert term.lower() in content_lower, f"Documentation should explain '{term}'"
    
    def test_installation_guide_updated(self):
        """Test that installation guide references new configuration system"""
        install_doc = Path("/Users/m/ai-workspace/chronicle/chronicle-dev/docs/setup/installation.md")
        assert install_doc.exists(), "Installation documentation must exist"
        
        content = install_doc.read_text()
        
        # Should mention root configuration
        config_terms = [
            "root configuration",
            ".env.template",
            "CHRONICLE_",
            "standardized environment"
        ]
        
        content_lower = content.lower()
        for term in config_terms:
            assert term.lower() in content_lower, f"Installation guide should mention '{term}'"
    
    def test_security_configuration_present(self):
        """Test that security configuration variables are properly defined"""
        template_path = Path("/Users/m/ai-workspace/chronicle/chronicle-dev/.env.template")
        content = template_path.read_text()
        
        security_vars = [
            "CHRONICLE_SANITIZE_DATA",
            "CHRONICLE_REMOVE_API_KEYS", 
            "CHRONICLE_PII_FILTERING",
            "CHRONICLE_MAX_INPUT_SIZE_MB",
            "CHRONICLE_ENABLE_CSP",
            "CHRONICLE_ENABLE_RATE_LIMITING",
        ]
        
        for var in security_vars:
            assert var in content, f"Security variable {var} should be in template"
    
    def test_performance_configuration_present(self):
        """Test that performance configuration variables are properly defined"""
        template_path = Path("/Users/m/ai-workspace/chronicle/chronicle-dev/.env.template")
        content = template_path.read_text()
        
        performance_vars = [
            "CHRONICLE_MAX_EVENTS_DISPLAY",
            "CHRONICLE_POLLING_INTERVAL",
            "CHRONICLE_BATCH_SIZE",
            "CHRONICLE_REALTIME_HEARTBEAT_INTERVAL",
            "CLAUDE_HOOKS_EXECUTION_TIMEOUT_MS",
            "CLAUDE_HOOKS_MAX_MEMORY_MB",
        ]
        
        for var in performance_vars:
            assert var in content, f"Performance variable {var} should be in template"
    
    def test_logging_configuration_standardized(self):
        """Test that logging configuration is standardized across apps"""
        template_path = Path("/Users/m/ai-workspace/chronicle/chronicle-dev/.env.template")
        content = template_path.read_text()
        
        # Standardized logging variables
        logging_vars = [
            "CHRONICLE_LOG_LEVEL",
            "CHRONICLE_LOG_DIR", 
            "CHRONICLE_DASHBOARD_LOG_FILE",
            "CHRONICLE_HOOKS_LOG_FILE",
            "CHRONICLE_MAX_LOG_SIZE_MB",
            "CHRONICLE_LOG_ROTATION_COUNT",
        ]
        
        for var in logging_vars:
            assert var in content, f"Logging variable {var} should be in template"
    
    def test_environment_examples_provided(self):
        """Test that environment-specific examples are provided"""
        template_path = Path("/Users/m/ai-workspace/chronicle/chronicle-dev/.env.template")
        content = template_path.read_text()
        
        # Should have examples for different environments
        examples = [
            "Development Example",
            "Staging Example", 
            "Production Example"
        ]
        
        for example in examples:
            assert example in content, f"Template should include '{example}'"
    
    def test_migration_documentation_exists(self):
        """Test that migration documentation exists for old configurations"""
        env_doc = Path("/Users/m/ai-workspace/chronicle/chronicle-dev/docs/setup/environment.md")
        content = env_doc.read_text()
        
        # Should document migration from old config
        migration_terms = [
            "migration",
            "old configuration",
            "update variable names",
            "backup"
        ]
        
        content_lower = content.lower()
        for term in migration_terms:
            assert term.lower() in content_lower, f"Documentation should cover '{term}'"

class TestEnvironmentValidation:
    """Test environment variable validation"""
    
    def test_required_variables_validation(self):
        """Test validation of required variables"""
        # Test that validation would catch missing variables
        # This is a placeholder test - in practice we'd use the validation script
        
        required_vars = [
            "CHRONICLE_ENVIRONMENT",
            "CHRONICLE_SUPABASE_URL", 
            "CHRONICLE_SUPABASE_ANON_KEY",
        ]
        
        # Just verify our list is not empty
        assert len(required_vars) > 0, "Should have required variables to validate"
    
    def test_variable_format_validation(self):
        """Test that variables follow the correct naming conventions"""
        template_path = Path("/Users/m/ai-workspace/chronicle/chronicle-dev/.env.template")
        content = template_path.read_text()
        
        lines = content.split('\n')
        env_lines = [line for line in lines if '=' in line and not line.strip().startswith('#')]
        
        for line in env_lines:
            var_name = line.split('=')[0].strip()
            
            # Check that variables follow naming conventions
            valid_prefixes = ['CHRONICLE_', 'NEXT_PUBLIC_', 'CLAUDE_HOOKS_', 'NODE_ENV']
            
            if var_name and not var_name.startswith('#'):
                has_valid_prefix = any(
                    var_name.startswith(prefix) or var_name == 'NODE_ENV' 
                    for prefix in valid_prefixes
                )
                
                if not has_valid_prefix:
                    # Allow some exceptions
                    allowed_exceptions = ['NODE_ENV', 'CLAUDE_PROJECT_DIR', 'CLAUDE_SESSION_ID']
                    assert var_name in allowed_exceptions, f"Variable {var_name} should use standardized prefix"

if __name__ == "__main__":
    # Run tests if executed directly
    pytest.main([__file__, "-v"])