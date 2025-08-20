"""
Test SQL migration file organization.

Validates that migration files are properly organized with timestamps and documentation.
"""

import os
import pytest
from pathlib import Path
import re
from datetime import datetime


class TestMigrationOrganization:
    """Test cases for SQL migration organization."""
    
    @pytest.fixture
    def hooks_root(self):
        """Get the hooks root directory."""
        return Path(__file__).parent.parent
    
    def test_migrations_directory_exists(self, hooks_root):
        """Test that migrations directory exists."""
        migrations_dir = hooks_root / "migrations"
        assert migrations_dir.exists(), "migrations/ directory should exist"
        assert migrations_dir.is_dir(), "migrations/ should be a directory"
    
    def test_migration_files_have_timestamps(self, hooks_root):
        """Test that migration files have proper timestamp prefixes."""
        migrations_dir = hooks_root / "migrations"
        if not migrations_dir.exists():
            pytest.skip("migrations/ directory not found")
            
        sql_files = list(migrations_dir.glob("*.sql"))
        assert len(sql_files) > 0, "Should have SQL migration files"
        
        # Check timestamp pattern: YYYYMMDD_HHMMSS_name.sql
        timestamp_pattern = re.compile(r'^\d{8}_\d{6}_.*\.sql$')
        
        for sql_file in sql_files:
            assert timestamp_pattern.match(sql_file.name), f"File {sql_file.name} should have timestamp prefix"
            
            # Validate timestamp is parseable
            timestamp_part = sql_file.name[:15]  # YYYYMMDD_HHMMSS
            try:
                datetime.strptime(timestamp_part, '%Y%m%d_%H%M%S')
            except ValueError:
                pytest.fail(f"Invalid timestamp format in {sql_file.name}")
    
    def test_migration_readme_exists(self, hooks_root):
        """Test that migrations directory has README documentation."""
        migrations_dir = hooks_root / "migrations"
        readme_file = migrations_dir / "README.md"
        
        assert readme_file.exists(), "migrations/README.md should exist"
        
        # Check README content has expected sections
        content = readme_file.read_text()
        assert "# SQL Migrations" in content or "# Migration Files" in content
        assert "add_event_types_migration" in content
        assert "fix_supabase_schema" in content
    
    def test_migration_files_contain_descriptions(self, hooks_root):
        """Test that migration files contain descriptive comments."""
        migrations_dir = hooks_root / "migrations"
        if not migrations_dir.exists():
            pytest.skip("migrations/ directory not found")
            
        sql_files = list(migrations_dir.glob("*.sql"))
        
        for sql_file in sql_files:
            content = sql_file.read_text()
            # Should have comment describing what the migration does
            assert content.startswith("--"), f"{sql_file.name} should start with descriptive comment"
            
            # Should have meaningful description in first few lines
            first_lines = content.split('\n')[:5]
            description_found = any(
                len(line.strip()) > 10 and line.strip().startswith("--")
                for line in first_lines
            )
            assert description_found, f"{sql_file.name} should have descriptive comments"
    
    def test_original_sql_files_removed_from_root(self):
        """Test that original SQL files are no longer in project root."""
        project_root = Path(__file__).parent.parent.parent.parent
        
        original_files = [
            "add_event_types_migration.sql",
            "check_actual_schema.sql", 
            "fix_supabase_schema.sql",
            "fix_supabase_schema_complete.sql",
            "migrate_event_types.sql"
        ]
        
        for filename in original_files:
            file_path = project_root / filename
            assert not file_path.exists(), f"Original file {filename} should be moved from root"


class TestSnapshotOrganization:
    """Test cases for snapshot script organization."""
    
    @pytest.fixture 
    def hooks_root(self):
        """Get the hooks root directory."""
        return Path(__file__).parent.parent
    
    def test_snapshot_directory_exists(self, hooks_root):
        """Test that scripts/snapshot directory exists."""
        snapshot_dir = hooks_root / "scripts" / "snapshot"
        assert snapshot_dir.exists(), "scripts/snapshot/ directory should exist"
        assert snapshot_dir.is_dir(), "scripts/snapshot/ should be a directory"
    
    def test_snapshot_scripts_moved(self, hooks_root):
        """Test that snapshot scripts are in the correct location."""
        snapshot_dir = hooks_root / "scripts" / "snapshot"
        
        expected_files = [
            "snapshot_capture.py",
            "snapshot_playback.py", 
            "snapshot_validator.py"
        ]
        
        for filename in expected_files:
            file_path = snapshot_dir / filename
            assert file_path.exists(), f"{filename} should exist in scripts/snapshot/"
            assert file_path.is_file(), f"{filename} should be a file"
    
    def test_snapshot_readme_exists(self, hooks_root):
        """Test that snapshot directory has README documentation."""
        snapshot_dir = hooks_root / "scripts" / "snapshot"
        readme_file = snapshot_dir / "README.md"
        
        assert readme_file.exists(), "scripts/snapshot/README.md should exist"
        
        # Check README content
        content = readme_file.read_text()
        assert "# Snapshot Scripts" in content or "# Chronicle Snapshot" in content
        assert "snapshot_capture.py" in content
        assert "snapshot_playback.py" in content
        assert "snapshot_validator.py" in content
    
    def test_snapshot_scripts_have_proper_imports(self, hooks_root):
        """Test that snapshot scripts have updated import paths.""" 
        snapshot_dir = hooks_root / "scripts" / "snapshot"
        
        script_files = [
            "snapshot_capture.py",
            "snapshot_playback.py",
            "snapshot_validator.py"
        ]
        
        for filename in script_files:
            file_path = snapshot_dir / filename
            if file_path.exists():
                content = file_path.read_text()
                
                # Should have sys.path modifications for the new location
                assert "sys.path.insert" in content, f"{filename} should have sys.path modifications"
                
                # Should reference apps/hooks directories
                assert "apps" in content and "hooks" in content, f"{filename} should reference apps/hooks"
    
    def test_snapshot_integration_test_updated(self, hooks_root):
        """Test that snapshot integration test has updated import path."""
        test_file = hooks_root / "tests" / "test_snapshot_integration.py"
        
        if test_file.exists():
            content = test_file.read_text()
            
            # Should import from scripts.snapshot
            assert "scripts" in content, "test should reference scripts directory"
            
            # Should have proper sys.path for snapshot imports
            import_lines = [line for line in content.split('\n') if 'sys.path.insert' in line]
            assert any('scripts' in line for line in import_lines), "test should add scripts to path"
    
    def test_original_snapshot_files_removed_from_root(self):
        """Test that original snapshot files are no longer in project root scripts."""
        project_root = Path(__file__).parent.parent.parent.parent
        root_scripts = project_root / "scripts"
        
        original_files = [
            "snapshot_capture.py",
            "snapshot_playback.py",
            "snapshot_validator.py"
        ]
        
        for filename in original_files:
            file_path = root_scripts / filename
            assert not file_path.exists(), f"Original file {filename} should be moved from root/scripts"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])