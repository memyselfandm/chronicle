#!/usr/bin/env python3
"""
Check and report database imports across the hooks system.

This script identifies files using the deprecated compatibility layer
and suggests the proper imports to use.
"""

import os
import sys
from pathlib import Path


def find_database_imports(directory):
    """Find all database imports in Python files."""
    imports = {
        "deprecated": [],  # Files using src.database
        "correct": [],     # Files using src.core.database
        "mixed": []        # Files using both
    }
    
    for root, dirs, files in os.walk(directory):
        for file in files:
            if file.endswith('.py'):
                file_path = os.path.join(root, file)
                try:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        content = f.read()
                    
                    has_deprecated = 'from .database import' in content or 'from src.database import' in content
                    has_correct = 'from .core.database import' in content or 'from src.core.database import' in content
                    
                    if has_deprecated and has_correct:
                        imports["mixed"].append(file_path)
                    elif has_deprecated:
                        imports["deprecated"].append(file_path)
                    elif has_correct:
                        imports["correct"].append(file_path)
                        
                except Exception as e:
                    print(f"Error reading {file_path}: {e}")
    
    return imports


def main():
    """Run import analysis."""
    hooks_dir = Path(__file__).parent.parent
    print(f"🔍 Analyzing database imports in: {hooks_dir}")
    
    imports = find_database_imports(hooks_dir)
    
    print("\n" + "=" * 60)
    print("DATABASE IMPORT ANALYSIS")
    print("=" * 60)
    
    # Show correct imports
    if imports["correct"]:
        print(f"\n✅ Files using correct imports ({len(imports['correct'])}):")
        for file_path in imports["correct"]:
            rel_path = os.path.relpath(file_path, hooks_dir)
            print(f"   {rel_path}")
    
    # Show deprecated imports
    if imports["deprecated"]:
        print(f"\n⚠️  Files using deprecated imports ({len(imports['deprecated'])}):")
        for file_path in imports["deprecated"]:
            rel_path = os.path.relpath(file_path, hooks_dir)
            print(f"   {rel_path}")
        
        print("\n📝 Recommended fixes:")
        print("   Replace 'from .database import' with 'from .core.database import'")
        print("   Replace 'from src.database import' with 'from src.core.database import'")
    
    # Show mixed imports
    if imports["mixed"]:
        print(f"\n🔄 Files with mixed imports ({len(imports['mixed'])}):")
        for file_path in imports["mixed"]:
            rel_path = os.path.relpath(file_path, hooks_dir)
            print(f"   {rel_path}")
        
        print("\n📝 These files should consolidate to use only core imports")
    
    # Summary
    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)
    
    total_files = len(imports["correct"]) + len(imports["deprecated"]) + len(imports["mixed"])
    needs_update = len(imports["deprecated"]) + len(imports["mixed"])
    
    print(f"Total files with database imports: {total_files}")
    print(f"Files using correct imports: {len(imports['correct'])}")
    print(f"Files needing updates: {needs_update}")
    
    if needs_update == 0:
        print("\n✅ All imports are using the correct pattern!")
    else:
        print(f"\n⚠️  {needs_update} files need import updates")
        print("The compatibility layer will continue to work but may be removed in the future.")
    
    print("\n📚 For more information, see the database layer documentation.")


if __name__ == "__main__":
    main()