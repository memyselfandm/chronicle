# Project Context Extraction Reference

## Overview

Project context extraction provides essential environmental and situational awareness for development tools and AI assistants. This reference covers comprehensive techniques for capturing git state, environment detection, file tree analysis, and project metadata to enable intelligent assistance and observability.

## Git State Capture

### 1. Core Git Information

**Repository Status Extraction**
```python
import subprocess
import json
from typing import Dict, List, Optional, Any
from pathlib import Path

class GitStateExtractor:
    def __init__(self, repo_path: str):
        self.repo_path = Path(repo_path)
    
    def extract_complete_git_state(self) -> Dict[str, Any]:
        if not self.is_git_repository():
            return {"is_git_repo": False}
        
        return {
            "is_git_repo": True,
            "basic_info": self.get_basic_repository_info(),
            "branch_info": self.get_branch_information(),
            "commit_info": self.get_commit_information(),
            "working_tree": self.get_working_tree_status(),
            "remote_info": self.get_remote_information(),
            "stash_info": self.get_stash_information(),
            "tag_info": self.get_tag_information(),
            "submodule_info": self.get_submodule_information()
        }
    
    def get_basic_repository_info(self) -> Dict[str, Any]:
        return {
            "root_directory": str(self.get_git_root()),
            "git_directory": str(self.get_git_directory()),
            "config": self.get_git_config(),
            "head_ref": self.get_head_ref()
        }
    
    def get_branch_information(self) -> Dict[str, Any]:
        return {
            "current_branch": self.get_current_branch(),
            "all_branches": self.get_all_branches(),
            "remote_branches": self.get_remote_branches(),
            "upstream_branch": self.get_upstream_branch(),
            "branch_status": self.get_branch_status()
        }
    
    def get_working_tree_status(self) -> Dict[str, Any]:
        return {
            "modified_files": self.get_modified_files(),
            "staged_files": self.get_staged_files(),
            "untracked_files": self.get_untracked_files(),
            "deleted_files": self.get_deleted_files(),
            "renamed_files": self.get_renamed_files(),
            "is_clean": self.is_working_tree_clean(),
            "conflicted_files": self.get_conflicted_files()
        }
    
    def run_git_command(self, args: List[str], capture_output: bool = True) -> subprocess.CompletedProcess:
        """Execute git command safely with proper error handling"""
        try:
            return subprocess.run(
                ["git"] + args,
                cwd=self.repo_path,
                capture_output=capture_output,
                text=True,
                check=True,
                timeout=30  # Prevent hanging
            )
        except subprocess.CalledProcessError as e:
            # Log error but don't crash
            return subprocess.CompletedProcess(
                args=e.cmd, 
                returncode=e.returncode, 
                stdout="", 
                stderr=e.stderr or ""
            )
```

**Advanced Git Analysis**
```python
class AdvancedGitAnalyzer:
    def analyze_commit_patterns(self, limit: int = 100) -> Dict[str, Any]:
        """Analyze recent commit patterns for insights"""
        commits = self.get_recent_commits(limit)
        
        return {
            "commit_frequency": self.calculate_commit_frequency(commits),
            "author_activity": self.analyze_author_activity(commits),
            "commit_message_patterns": self.analyze_commit_messages(commits),
            "file_change_patterns": self.analyze_file_changes(commits),
            "development_velocity": self.calculate_development_velocity(commits)
        }
    
    def get_project_timeline(self) -> Dict[str, Any]:
        """Extract project development timeline"""
        return {
            "first_commit": self.get_first_commit(),
            "latest_commit": self.get_latest_commit(),
            "total_commits": self.get_total_commit_count(),
            "active_periods": self.identify_active_development_periods(),
            "milestone_tags": self.get_milestone_tags(),
            "release_pattern": self.analyze_release_pattern()
        }
    
    def analyze_branching_strategy(self) -> Dict[str, Any]:
        """Identify the branching strategy being used"""
        branches = self.get_all_branches()
        
        patterns = {
            "gitflow": self.detect_gitflow_pattern(branches),
            "github_flow": self.detect_github_flow_pattern(branches),
            "gitlab_flow": self.detect_gitlab_flow_pattern(branches),
            "custom": self.analyze_custom_branching(branches)
        }
        
        return {
            "strategy": self.determine_primary_strategy(patterns),
            "confidence": self.calculate_strategy_confidence(patterns),
            "branch_categories": self.categorize_branches(branches),
            "merge_patterns": self.analyze_merge_patterns()
        }
```

### 2. Change Detection and Diff Analysis

**Intelligent Diff Processing**
```python
class GitDiffAnalyzer:
    def analyze_working_directory_changes(self) -> Dict[str, Any]:
        """Comprehensive analysis of current changes"""
        return {
            "staged_changes": self.analyze_staged_changes(),
            "unstaged_changes": self.analyze_unstaged_changes(),
            "change_summary": self.generate_change_summary(),
            "impact_analysis": self.assess_change_impact(),
            "conflict_prediction": self.predict_potential_conflicts()
        }
    
    def analyze_staged_changes(self) -> Dict[str, Any]:
        staged_diff = self.run_git_command(["diff", "--cached", "--name-status"]).stdout
        
        return {
            "files": self.parse_change_status(staged_diff),
            "statistics": self.get_change_statistics("--cached"),
            "by_type": self.categorize_changes_by_file_type(staged_diff),
            "complexity_score": self.calculate_change_complexity("--cached")
        }
    
    def assess_change_impact(self) -> Dict[str, Any]:
        """Assess the potential impact of current changes"""
        changed_files = self.get_changed_files()
        
        return {
            "critical_files_changed": self.identify_critical_files(changed_files),
            "test_impact": self.assess_test_impact(changed_files),
            "dependency_impact": self.assess_dependency_impact(changed_files),
            "documentation_impact": self.assess_documentation_impact(changed_files),
            "ci_cd_impact": self.assess_ci_cd_impact(changed_files)
        }
```

## Environment Detection

### 1. Development Environment Analysis

**Comprehensive Environment Profiling**
```python
import os
import platform
import shutil
import json
from pathlib import Path

class EnvironmentDetector:
    def detect_complete_environment(self) -> Dict[str, Any]:
        return {
            "system_info": self.get_system_information(),
            "development_tools": self.detect_development_tools(),
            "runtime_environments": self.detect_runtime_environments(),
            "package_managers": self.detect_package_managers(),
            "editors_ides": self.detect_editors_and_ides(),
            "containerization": self.detect_containerization(),
            "cloud_environment": self.detect_cloud_environment(),
            "ci_cd_environment": self.detect_ci_cd_environment()
        }
    
    def get_system_information(self) -> Dict[str, Any]:
        return {
            "platform": platform.platform(),
            "system": platform.system(),
            "release": platform.release(),
            "version": platform.version(),
            "machine": platform.machine(),
            "processor": platform.processor(),
            "architecture": platform.architecture(),
            "python_version": platform.python_version(),
            "hostname": platform.node(),
            "user": os.getenv("USER") or os.getenv("USERNAME"),
            "shell": os.getenv("SHELL"),
            "terminal": os.getenv("TERM"),
            "working_directory": os.getcwd(),
            "home_directory": str(Path.home())
        }
    
    def detect_development_tools(self) -> Dict[str, Any]:
        tools = {}
        
        # Version control
        tools["git"] = self.check_tool_version("git", ["--version"])
        tools["svn"] = self.check_tool_version("svn", ["--version"])
        tools["hg"] = self.check_tool_version("hg", ["--version"])
        
        # Build tools
        tools["make"] = self.check_tool_version("make", ["--version"])
        tools["cmake"] = self.check_tool_version("cmake", ["--version"])
        tools["ninja"] = self.check_tool_version("ninja", ["--version"])
        
        # Compilers
        tools["gcc"] = self.check_tool_version("gcc", ["--version"])
        tools["clang"] = self.check_tool_version("clang", ["--version"])
        tools["rustc"] = self.check_tool_version("rustc", ["--version"])
        tools["go"] = self.check_tool_version("go", ["version"])
        
        return {k: v for k, v in tools.items() if v is not None}
    
    def detect_runtime_environments(self) -> Dict[str, Any]:
        runtimes = {}
        
        # Language runtimes
        runtimes["python"] = self.detect_python_environment()
        runtimes["node"] = self.detect_node_environment()
        runtimes["ruby"] = self.detect_ruby_environment()
        runtimes["java"] = self.detect_java_environment()
        runtimes["dotnet"] = self.detect_dotnet_environment()
        runtimes["php"] = self.detect_php_environment()
        
        return {k: v for k, v in runtimes.items() if v is not None}
    
    def detect_python_environment(self) -> Optional[Dict[str, Any]]:
        python_info = {}
        
        # Python version and executable
        python_info["version"] = self.check_tool_version("python", ["--version"])
        python_info["executable"] = shutil.which("python")
        python_info["python3_executable"] = shutil.which("python3")
        
        # Virtual environment detection
        python_info["virtual_env"] = self.detect_virtual_environment()
        
        # Package information
        python_info["pip_version"] = self.check_tool_version("pip", ["--version"])
        python_info["conda_info"] = self.detect_conda_environment()
        
        return python_info if any(python_info.values()) else None
    
    def detect_virtual_environment(self) -> Optional[Dict[str, Any]]:
        venv_info = {}
        
        # Check various virtual environment indicators
        if os.getenv("VIRTUAL_ENV"):
            venv_info["type"] = "virtualenv"
            venv_info["path"] = os.getenv("VIRTUAL_ENV")
            venv_info["name"] = Path(venv_info["path"]).name
        
        elif os.getenv("CONDA_DEFAULT_ENV"):
            venv_info["type"] = "conda"
            venv_info["name"] = os.getenv("CONDA_DEFAULT_ENV")
            venv_info["path"] = os.getenv("CONDA_PREFIX")
        
        elif os.getenv("PIPENV_ACTIVE"):
            venv_info["type"] = "pipenv"
            venv_info["active"] = True
        
        elif Path(".venv").exists():
            venv_info["type"] = "local_venv"
            venv_info["path"] = str(Path(".venv").absolute())
        
        return venv_info if venv_info else None
```

### 2. Project Technology Stack Detection

**Technology Stack Analyzer**
```python
class TechnologyStackDetector:
    def detect_project_technologies(self, project_path: Path) -> Dict[str, Any]:
        return {
            "primary_languages": self.detect_primary_languages(project_path),
            "frameworks": self.detect_frameworks(project_path),
            "databases": self.detect_databases(project_path),
            "build_systems": self.detect_build_systems(project_path),
            "testing_frameworks": self.detect_testing_frameworks(project_path),
            "deployment_tools": self.detect_deployment_tools(project_path),
            "configuration_files": self.analyze_configuration_files(project_path)
        }
    
    def detect_primary_languages(self, project_path: Path) -> Dict[str, Any]:
        language_files = {}
        
        # Count files by extension
        for file_path in project_path.rglob("*"):
            if file_path.is_file() and file_path.suffix:
                ext = file_path.suffix.lower()
                if ext in language_files:
                    language_files[ext] += 1
                else:
                    language_files[ext] = 1
        
        # Map extensions to languages
        language_mapping = {
            ".py": "Python",
            ".js": "JavaScript",
            ".ts": "TypeScript",
            ".jsx": "React/JSX",
            ".tsx": "TypeScript React",
            ".java": "Java",
            ".cpp": "C++",
            ".c": "C",
            ".cs": "C#",
            ".go": "Go",
            ".rs": "Rust",
            ".rb": "Ruby",
            ".php": "PHP",
            ".swift": "Swift",
            ".kt": "Kotlin",
            ".scala": "Scala",
            ".sh": "Shell",
            ".ps1": "PowerShell"
        }
        
        detected_languages = {}
        for ext, count in language_files.items():
            if ext in language_mapping:
                lang = language_mapping[ext]
                detected_languages[lang] = {
                    "file_count": count,
                    "extension": ext
                }
        
        # Sort by file count to identify primary language
        sorted_languages = sorted(
            detected_languages.items(), 
            key=lambda x: x[1]["file_count"], 
            reverse=True
        )
        
        return {
            "languages": dict(sorted_languages),
            "primary_language": sorted_languages[0][0] if sorted_languages else None,
            "total_code_files": sum(detected_languages[lang]["file_count"] for lang in detected_languages)
        }
    
    def detect_frameworks(self, project_path: Path) -> Dict[str, Any]:
        frameworks = {}
        
        # Framework detection patterns
        framework_indicators = {
            "React": ["package.json", "react"],
            "Vue": ["package.json", "vue"],
            "Angular": ["package.json", "@angular"],
            "Django": ["requirements.txt", "django", "manage.py"],
            "Flask": ["requirements.txt", "flask"],
            "FastAPI": ["requirements.txt", "fastapi"],
            "Express": ["package.json", "express"],
            "Spring Boot": ["pom.xml", "spring-boot", "build.gradle"],
            "Ruby on Rails": ["Gemfile", "rails"],
            "Laravel": ["composer.json", "laravel"],
            "Next.js": ["package.json", "next"],
            "Svelte": ["package.json", "svelte"],
            "Nuxt": ["package.json", "nuxt"]
        }
        
        for framework, (config_file, indicator) in framework_indicators.items():
            config_path = project_path / config_file
            if config_path.exists():
                try:
                    content = config_path.read_text()
                    if indicator in content.lower():
                        frameworks[framework] = {
                            "detected_via": config_file,
                            "config_file": str(config_path)
                        }
                except Exception:
                    pass  # Skip files that can't be read
        
        return frameworks
```

## File Tree Analysis

### 1. Intelligent File System Scanning

**Comprehensive File Tree Analyzer**
```python
import mimetypes
from collections import defaultdict, Counter
from pathlib import Path
import hashlib

class FileTreeAnalyzer:
    def __init__(self, root_path: str, ignore_patterns: List[str] = None):
        self.root_path = Path(root_path)
        self.ignore_patterns = ignore_patterns or [
            ".git", ".gitignore", "__pycache__", "node_modules", 
            ".venv", "venv", ".env", "*.pyc", "*.log", ".DS_Store"
        ]
    
    def analyze_complete_file_tree(self) -> Dict[str, Any]:
        return {
            "structure": self.generate_file_tree_structure(),
            "statistics": self.calculate_file_statistics(),
            "content_analysis": self.analyze_file_contents(),
            "organization_patterns": self.analyze_organization_patterns(),
            "important_files": self.identify_important_files(),
            "security_analysis": self.perform_security_analysis(),
            "dependency_analysis": self.analyze_dependencies()
        }
    
    def generate_file_tree_structure(self, max_depth: int = 5) -> Dict[str, Any]:
        """Generate hierarchical file tree structure"""
        def build_tree(path: Path, current_depth: int = 0) -> Dict[str, Any]:
            if current_depth > max_depth:
                return {"truncated": True}
            
            tree = {
                "name": path.name,
                "type": "directory" if path.is_dir() else "file",
                "path": str(path.relative_to(self.root_path)),
                "size": path.stat().st_size if path.is_file() else 0,
                "modified": path.stat().st_mtime,
                "children": []
            }
            
            if path.is_dir() and not self.should_ignore(path):
                try:
                    for child in sorted(path.iterdir()):
                        if not self.should_ignore(child):
                            tree["children"].append(build_tree(child, current_depth + 1))
                except PermissionError:
                    tree["permission_denied"] = True
            
            return tree
        
        return build_tree(self.root_path)
    
    def calculate_file_statistics(self) -> Dict[str, Any]:
        """Calculate comprehensive file system statistics"""
        stats = {
            "total_files": 0,
            "total_directories": 0,
            "total_size": 0,
            "file_types": Counter(),
            "largest_files": [],
            "recently_modified": [],
            "directory_sizes": {}
        }
        
        for path in self.root_path.rglob("*"):
            if self.should_ignore(path):
                continue
                
            if path.is_file():
                stats["total_files"] += 1
                file_size = path.stat().st_size
                stats["total_size"] += file_size
                
                # File type analysis
                mime_type, _ = mimetypes.guess_type(str(path))
                file_type = mime_type or f"unknown/{path.suffix}"
                stats["file_types"][file_type] += 1
                
                # Track largest files
                stats["largest_files"].append({
                    "path": str(path.relative_to(self.root_path)),
                    "size": file_size,
                    "size_human": self.format_file_size(file_size)
                })
                
                # Track recently modified files
                mtime = path.stat().st_mtime
                stats["recently_modified"].append({
                    "path": str(path.relative_to(self.root_path)),
                    "modified": mtime,
                    "modified_human": self.format_timestamp(mtime)
                })
                
            elif path.is_dir():
                stats["total_directories"] += 1
                
                # Calculate directory size
                dir_size = sum(
                    f.stat().st_size for f in path.rglob("*") 
                    if f.is_file() and not self.should_ignore(f)
                )
                stats["directory_sizes"][str(path.relative_to(self.root_path))] = dir_size
        
        # Sort and limit lists
        stats["largest_files"] = sorted(
            stats["largest_files"], 
            key=lambda x: x["size"], 
            reverse=True
        )[:10]
        
        stats["recently_modified"] = sorted(
            stats["recently_modified"], 
            key=lambda x: x["modified"], 
            reverse=True
        )[:10]
        
        return stats
    
    def analyze_file_contents(self) -> Dict[str, Any]:
        """Analyze file contents for patterns and insights"""
        content_analysis = {
            "text_files": 0,
            "binary_files": 0,
            "code_files": 0,
            "documentation_files": 0,
            "configuration_files": 0,
            "line_count_distribution": Counter(),
            "encoding_distribution": Counter(),
            "complexity_analysis": {}
        }
        
        code_extensions = {
            ".py", ".js", ".ts", ".jsx", ".tsx", ".java", ".cpp", ".c", 
            ".cs", ".go", ".rs", ".rb", ".php", ".swift", ".kt", ".scala"
        }
        
        doc_extensions = {
            ".md", ".rst", ".txt", ".doc", ".docx", ".pdf", ".html", ".adoc"
        }
        
        config_extensions = {
            ".json", ".yaml", ".yml", ".toml", ".ini", ".cfg", ".conf", ".xml"
        }
        
        for file_path in self.root_path.rglob("*"):
            if not file_path.is_file() or self.should_ignore(file_path):
                continue
            
            try:
                # Determine file category
                ext = file_path.suffix.lower()
                
                if ext in code_extensions:
                    content_analysis["code_files"] += 1
                    content_analysis["complexity_analysis"][str(file_path.relative_to(self.root_path))] = \
                        self.analyze_code_complexity(file_path)
                elif ext in doc_extensions:
                    content_analysis["documentation_files"] += 1
                elif ext in config_extensions:
                    content_analysis["configuration_files"] += 1
                
                # Try to read as text
                try:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        content = f.read()
                        content_analysis["text_files"] += 1
                        content_analysis["encoding_distribution"]["utf-8"] += 1
                        
                        # Line count analysis
                        line_count = len(content.splitlines())
                        if line_count < 50:
                            content_analysis["line_count_distribution"]["small"] += 1
                        elif line_count < 200:
                            content_analysis["line_count_distribution"]["medium"] += 1
                        elif line_count < 1000:
                            content_analysis["line_count_distribution"]["large"] += 1
                        else:
                            content_analysis["line_count_distribution"]["very_large"] += 1
                            
                except UnicodeDecodeError:
                    # Try other encodings
                    for encoding in ['latin-1', 'cp1252', 'iso-8859-1']:
                        try:
                            with open(file_path, 'r', encoding=encoding) as f:
                                f.read()
                                content_analysis["text_files"] += 1
                                content_analysis["encoding_distribution"][encoding] += 1
                                break
                        except UnicodeDecodeError:
                            continue
                    else:
                        content_analysis["binary_files"] += 1
                        
            except Exception:
                content_analysis["binary_files"] += 1
        
        return content_analysis
```

### 2. Project Structure Pattern Recognition

**Project Organization Analyzer**
```python
class ProjectOrganizationAnalyzer:
    def analyze_organization_patterns(self, file_tree: Dict) -> Dict[str, Any]:
        """Analyze how the project is organized"""
        return {
            "architecture_pattern": self.detect_architecture_pattern(file_tree),
            "naming_conventions": self.analyze_naming_conventions(file_tree),
            "directory_structure": self.analyze_directory_structure(file_tree),
            "separation_of_concerns": self.analyze_separation_of_concerns(file_tree),
            "configuration_organization": self.analyze_configuration_organization(file_tree),
            "test_organization": self.analyze_test_organization(file_tree)
        }
    
    def detect_architecture_pattern(self, file_tree: Dict) -> Dict[str, Any]:
        """Detect common architecture patterns"""
        patterns = {
            "mvc": self.detect_mvc_pattern(file_tree),
            "microservices": self.detect_microservices_pattern(file_tree),
            "monorepo": self.detect_monorepo_pattern(file_tree),
            "layered": self.detect_layered_architecture(file_tree),
            "component_based": self.detect_component_based_architecture(file_tree)
        }
        
        # Determine the most likely pattern
        confidence_scores = {k: v.get("confidence", 0) for k, v in patterns.items()}
        primary_pattern = max(confidence_scores.items(), key=lambda x: x[1])
        
        return {
            "patterns": patterns,
            "primary_pattern": primary_pattern[0],
            "confidence": primary_pattern[1],
            "hybrid_indicators": self.detect_hybrid_patterns(patterns)
        }
    
    def analyze_naming_conventions(self, file_tree: Dict) -> Dict[str, Any]:
        """Analyze naming conventions used in the project"""
        file_names = self.extract_all_file_names(file_tree)
        dir_names = self.extract_all_directory_names(file_tree)
        
        return {
            "file_naming": {
                "snake_case": self.count_snake_case(file_names),
                "camel_case": self.count_camel_case(file_names),
                "kebab_case": self.count_kebab_case(file_names),
                "pascal_case": self.count_pascal_case(file_names)
            },
            "directory_naming": {
                "snake_case": self.count_snake_case(dir_names),
                "camel_case": self.count_camel_case(dir_names),
                "kebab_case": self.count_kebab_case(dir_names),
                "pascal_case": self.count_pascal_case(dir_names)
            },
            "consistency_score": self.calculate_naming_consistency(file_names, dir_names),
            "recommendations": self.generate_naming_recommendations(file_names, dir_names)
        }
```

## Security and Privacy Considerations

### 1. Sensitive Data Detection

**Security Scanner for Project Context**
```python
class ProjectSecurityScanner:
    def scan_for_sensitive_data(self, project_path: Path) -> Dict[str, Any]:
        """Scan project for potentially sensitive information"""
        return {
            "credentials": self.scan_for_credentials(project_path),
            "api_keys": self.scan_for_api_keys(project_path),
            "personal_information": self.scan_for_pii(project_path),
            "security_files": self.identify_security_files(project_path),
            "configuration_risks": self.assess_configuration_risks(project_path),
            "dependency_vulnerabilities": self.scan_dependency_vulnerabilities(project_path)
        }
    
    def scan_for_credentials(self, project_path: Path) -> List[Dict[str, Any]]:
        """Detect potential credentials in files"""
        findings = []
        credential_patterns = [
            (r'password\s*[:=]\s*["\']([^"\']+)["\']', "password"),
            (r'api_key\s*[:=]\s*["\']([^"\']+)["\']', "api_key"),
            (r'secret\s*[:=]\s*["\']([^"\']+)["\']', "secret"),
            (r'token\s*[:=]\s*["\']([^"\']+)["\']', "token"),
            (r'aws_access_key_id\s*[:=]\s*["\']([^"\']+)["\']', "aws_key"),
            (r'database_url\s*[:=]\s*["\']([^"\']+)["\']', "database_url")
        ]
        
        for file_path in project_path.rglob("*"):
            if not file_path.is_file() or self.should_skip_file(file_path):
                continue
            
            try:
                with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                    content = f.read()
                    
                for pattern, cred_type in credential_patterns:
                    matches = re.finditer(pattern, content, re.IGNORECASE)
                    for match in matches:
                        findings.append({
                            "type": cred_type,
                            "file": str(file_path.relative_to(project_path)),
                            "line": content[:match.start()].count('\n') + 1,
                            "masked_value": self.mask_sensitive_value(match.group(1)),
                            "severity": self.assess_credential_severity(cred_type, file_path)
                        })
            except Exception:
                continue  # Skip files that can't be read
        
        return findings
    
    def assess_configuration_risks(self, project_path: Path) -> Dict[str, Any]:
        """Assess security risks in configuration files"""
        risks = {
            "debug_mode_enabled": [],
            "insecure_settings": [],
            "exposed_services": [],
            "weak_security_configs": []
        }
        
        config_files = [
            ".env", ".env.local", ".env.production",
            "config.json", "settings.py", "application.yml",
            "docker-compose.yml", "Dockerfile"
        ]
        
        for config_file in config_files:
            config_path = project_path / config_file
            if config_path.exists():
                risks.update(self.analyze_config_file_security(config_path))
        
        return risks
```

### 2. Privacy-Preserving Context Extraction

**Anonymized Context Extractor**
```python
class PrivacyPreservingExtractor:
    def extract_anonymized_context(self, project_path: Path, privacy_level: str = "medium") -> Dict[str, Any]:
        """Extract project context while preserving privacy"""
        context = {}
        
        if privacy_level == "minimal":
            context = self.extract_minimal_context(project_path)
        elif privacy_level == "medium":
            context = self.extract_medium_privacy_context(project_path)
        elif privacy_level == "full":
            context = self.extract_full_context_with_sanitization(project_path)
        
        # Apply additional anonymization
        context = self.anonymize_context_data(context, privacy_level)
        
        return context
    
    def anonymize_context_data(self, context: Dict[str, Any], privacy_level: str) -> Dict[str, Any]:
        """Apply anonymization to context data"""
        anonymized = context.copy()
        
        # Anonymize file paths
        if "file_tree" in anonymized:
            anonymized["file_tree"] = self.anonymize_file_paths(
                anonymized["file_tree"], privacy_level
            )
        
        # Anonymize git information
        if "git_state" in anonymized:
            anonymized["git_state"] = self.anonymize_git_data(
                anonymized["git_state"], privacy_level
            )
        
        # Remove or hash sensitive environment information
        if "environment" in anonymized:
            anonymized["environment"] = self.anonymize_environment_data(
                anonymized["environment"], privacy_level
            )
        
        return anonymized
    
    def anonymize_file_paths(self, file_tree: Dict, privacy_level: str) -> Dict[str, Any]:
        """Anonymize file paths while preserving structure information"""
        if privacy_level == "minimal":
            # Only keep extension and structure information
            return self.abstract_file_structure(file_tree)
        elif privacy_level == "medium":
            # Hash file names but keep directory structure
            return self.hash_file_names(file_tree)
        else:
            # Full paths with sensitive parts masked
            return self.mask_sensitive_path_components(file_tree)
```

## Implementation Best Practices

### 1. Performance Optimization

**Efficient Context Extraction**
- Implement lazy loading for expensive operations
- Use file system caching for repeated scans
- Optimize git operations with appropriate flags
- Implement configurable depth limits for deep directory structures

### 2. Error Handling and Resilience

**Robust Error Handling**
- Graceful degradation when tools are unavailable
- Timeout protection for long-running operations
- Fallback mechanisms for partial failures
- Comprehensive logging for debugging

### 3. Extensibility and Configuration

**Flexible Architecture**
- Plugin system for custom extractors
- Configurable extraction rules and patterns
- User-defined ignore patterns
- Extensible technology detection rules

### 4. Data Quality and Validation

**Context Validation**
- Consistency checks across different data sources
- Validation of extracted metadata
- Anomaly detection for unusual project structures
- Quality scoring for extracted information

This reference provides comprehensive guidance for implementing robust project context extraction that balances observability needs with performance, privacy, and reliability requirements.