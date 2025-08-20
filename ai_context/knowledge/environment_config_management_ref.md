# Environment Configuration Management Reference

## Overview

This guide provides comprehensive patterns for environment detection, configuration management, and deployment automation across development, testing, and production environments. Essential for building robust, maintainable systems like the Chronicle observability platform.

## Environment Detection Strategies

### 1. Environment Variable Based Detection
```python
import os
from enum import Enum
from typing import Optional

class Environment(Enum):
    DEVELOPMENT = "development"
    TESTING = "testing"
    STAGING = "staging" 
    PRODUCTION = "production"

def detect_environment() -> Environment:
    """Detect current environment from environment variables"""
    env_name = os.getenv('ENVIRONMENT', '').lower()
    
    # Direct environment variable
    if env_name:
        try:
            return Environment(env_name)
        except ValueError:
            pass
    
    # Infer from other environment variables
    if os.getenv('CI'):
        return Environment.TESTING
    elif os.getenv('PRODUCTION'):
        return Environment.PRODUCTION
    elif os.getenv('DEBUG', '').lower() in ('true', '1'):
        return Environment.DEVELOPMENT
    
    # Default to development
    return Environment.DEVELOPMENT
```

### 2. File-Based Environment Detection
```python
from pathlib import Path
import json

def detect_environment_from_files() -> Environment:
    """Detect environment from configuration files"""
    project_root = Path.cwd()
    
    # Check for environment-specific files
    env_files = {
        Environment.PRODUCTION: ['.production', 'production.json'],
        Environment.STAGING: ['.staging', 'staging.json'], 
        Environment.TESTING: ['.testing', 'pytest.ini', 'tox.ini'],
        Environment.DEVELOPMENT: ['.development', '.dev', '.env.local']
    }
    
    for env, files in env_files.items():
        if any((project_root / file).exists() for file in files):
            return env
    
    return Environment.DEVELOPMENT
```

### 3. Git Branch Based Detection
```python
import subprocess
from pathlib import Path

def detect_environment_from_git() -> Optional[Environment]:
    """Detect environment from git branch name"""
    try:
        result = subprocess.run(
            ['git', 'rev-parse', '--abbrev-ref', 'HEAD'],
            capture_output=True, text=True, check=True
        )
        branch = result.stdout.strip()
        
        if branch in ['main', 'master']:
            return Environment.PRODUCTION
        elif branch.startswith('release/') or branch.startswith('staging/'):
            return Environment.STAGING
        elif branch.startswith('test/') or branch.startswith('ci/'):
            return Environment.TESTING
        else:
            return Environment.DEVELOPMENT
            
    except (subprocess.CalledProcessError, FileNotFoundError):
        return None
```

## Configuration Management Patterns

### 1. Hierarchical Configuration System
```python
import os
import json
import yaml
from pathlib import Path
from typing import Dict, Any, Optional
from dataclasses import dataclass, field

@dataclass
class DatabaseConfig:
    host: str = "localhost"
    port: int = 5432
    database: str = "chronicle"
    username: str = "postgres"
    password: str = ""
    ssl_mode: str = "prefer"
    pool_size: int = 10
    
    @property
    def url(self) -> str:
        return f"postgresql://{self.username}:{self.password}@{self.host}:{self.port}/{self.database}"

@dataclass 
class Config:
    environment: Environment = Environment.DEVELOPMENT
    debug: bool = False
    log_level: str = "INFO"
    database: DatabaseConfig = field(default_factory=DatabaseConfig)
    supabase_url: Optional[str] = None
    supabase_key: Optional[str] = None
    sqlite_fallback: str = "/tmp/chronicle.db"
    
    @classmethod
    def load(cls, env: Optional[Environment] = None) -> 'Config':
        """Load configuration with environment-specific overrides"""
        if env is None:
            env = detect_environment()
        
        config = cls()
        config.environment = env
        
        # Load base configuration
        config._load_from_file('config.yaml')
        
        # Load environment-specific configuration
        config._load_from_file(f'config.{env.value}.yaml')
        
        # Load local overrides (not in version control)
        config._load_from_file('config.local.yaml')
        
        # Environment variables override everything
        config._load_from_env()
        
        return config
    
    def _load_from_file(self, filename: str):
        """Load configuration from YAML file"""
        config_file = Path(filename)
        if not config_file.exists():
            return
        
        with open(config_file) as f:
            data = yaml.safe_load(f)
        
        self._update_from_dict(data)
    
    def _load_from_env(self):
        """Load configuration from environment variables"""
        env_mapping = {
            'DEBUG': ('debug', bool),
            'LOG_LEVEL': ('log_level', str),
            'SUPABASE_URL': ('supabase_url', str),
            'SUPABASE_KEY': ('supabase_key', str),
            'SQLITE_FALLBACK': ('sqlite_fallback', str),
            'DB_HOST': ('database.host', str),
            'DB_PORT': ('database.port', int),
            'DB_NAME': ('database.database', str),
            'DB_USER': ('database.username', str),
            'DB_PASSWORD': ('database.password', str),
        }
        
        for env_var, (attr_path, type_func) in env_mapping.items():
            value = os.getenv(env_var)
            if value is not None:
                self._set_nested_attr(attr_path, self._convert_value(value, type_func))
    
    def _convert_value(self, value: str, type_func: type) -> Any:
        """Convert string value to appropriate type"""
        if type_func == bool:
            return value.lower() in ('true', '1', 'yes', 'on')
        elif type_func == int:
            return int(value)
        else:
            return value
    
    def _set_nested_attr(self, attr_path: str, value: Any):
        """Set nested attribute using dot notation"""
        parts = attr_path.split('.')
        obj = self
        
        for part in parts[:-1]:
            obj = getattr(obj, part)
        
        setattr(obj, parts[-1], value)
    
    def _update_from_dict(self, data: Dict[str, Any]):
        """Update configuration from dictionary"""
        for key, value in data.items():
            if hasattr(self, key):
                if isinstance(value, dict) and hasattr(getattr(self, key), '__dict__'):
                    # Nested object - update recursively
                    nested_obj = getattr(self, key)
                    for nested_key, nested_value in value.items():
                        if hasattr(nested_obj, nested_key):
                            setattr(nested_obj, nested_key, nested_value)
                else:
                    setattr(self, key, value)
```

### 2. Configuration File Templates

#### Base Configuration (config.yaml)
```yaml
# Base configuration - shared across all environments
debug: false
log_level: "INFO"

database:
  host: "localhost"
  port: 5432
  database: "chronicle"
  username: "postgres"
  pool_size: 10
  ssl_mode: "prefer"

# Feature flags
features:
  real_time_updates: true
  advanced_analytics: true
  export_functionality: true

# Security settings
security:
  max_file_size: 10485760  # 10MB
  allowed_file_types: [".py", ".js", ".ts", ".json", ".yaml", ".md"]
  blocked_paths: [".env", ".git/", "node_modules/"]
```

#### Development Configuration (config.development.yaml)
```yaml
debug: true
log_level: "DEBUG"

database:
  database: "chronicle_dev"
  pool_size: 5

# Development-specific features
features:
  debug_toolbar: true
  hot_reload: true
  mock_external_apis: true

# Relaxed security for development
security:
  max_file_size: 52428800  # 50MB
  strict_validation: false
```

#### Production Configuration (config.production.yaml)
```yaml
debug: false
log_level: "WARNING"

database:
  ssl_mode: "require"
  pool_size: 20

# Production-only features
features:
  monitoring: true
  error_reporting: true
  performance_tracking: true

# Strict security for production
security:
  strict_validation: true
  rate_limiting: true
  audit_logging: true
```

#### Testing Configuration (config.testing.yaml)
```yaml
debug: false
log_level: "ERROR"

database:
  database: "chronicle_test"
  pool_size: 2

sqlite_fallback: "/tmp/chronicle_test.db"

# Testing-specific settings
features:
  mock_external_apis: true
  disable_auth: true
  fast_mode: true
```

### 3. Environment Variable Templates

#### Development Environment (.env.development)
```bash
# Development Environment Configuration
ENVIRONMENT=development
DEBUG=true
LOG_LEVEL=debug

# Database Configuration
DB_HOST=localhost
DB_PORT=5432
DB_NAME=chronicle_dev
DB_USER=postgres
DB_PASSWORD=password

# Supabase Configuration (for testing real-time features)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your_anon_key_here

# SQLite Fallback
SQLITE_FALLBACK=/tmp/chronicle_dev.db

# Claude Code Integration
CLAUDE_PROJECT_ROOT=/path/to/your/project
CLAUDE_HOOKS_ENABLED=true
CLAUDE_DEBUG=true

# Feature Flags
ENABLE_REAL_TIME=true
ENABLE_ANALYTICS=true
ENABLE_EXPORT=true
```

#### Production Environment (.env.production)
```bash
# Production Environment Configuration
ENVIRONMENT=production
DEBUG=false
LOG_LEVEL=warning

# Database Configuration (use secrets management in real production)
DB_HOST=${DATABASE_HOST}
DB_PORT=${DATABASE_PORT}
DB_NAME=${DATABASE_NAME}
DB_USER=${DATABASE_USER}
DB_PASSWORD=${DATABASE_PASSWORD}

# Supabase Configuration
SUPABASE_URL=${SUPABASE_URL}
SUPABASE_KEY=${SUPABASE_ANON_KEY}

# SQLite Fallback
SQLITE_FALLBACK=/var/lib/chronicle/fallback.db

# Claude Code Integration  
CLAUDE_PROJECT_ROOT=${PROJECT_ROOT}
CLAUDE_HOOKS_ENABLED=true
CLAUDE_DEBUG=false

# Security
ENABLE_RATE_LIMITING=true
ENABLE_AUDIT_LOGGING=true

# Performance
DATABASE_POOL_SIZE=20
CACHE_TTL=3600
```

## Configuration Validation

### Validation Schema
```python
from pydantic import BaseModel, validator, Field
from typing import Optional, List
import os

class DatabaseConfigModel(BaseModel):
    host: str = Field(..., min_length=1)
    port: int = Field(default=5432, ge=1, le=65535)
    database: str = Field(..., min_length=1)
    username: str = Field(..., min_length=1)
    password: str = Field(default="")
    ssl_mode: str = Field(default="prefer", regex="^(disable|allow|prefer|require)$")
    pool_size: int = Field(default=10, ge=1, le=100)
    
    @validator('password')
    def validate_password(cls, v, values):
        env = os.getenv('ENVIRONMENT', 'development')
        if env == 'production' and not v:
            raise ValueError('Password required in production')
        return v

class ConfigModel(BaseModel):
    environment: str = Field(..., regex="^(development|testing|staging|production)$")
    debug: bool = False
    log_level: str = Field(default="INFO", regex="^(DEBUG|INFO|WARNING|ERROR|CRITICAL)$")
    database: DatabaseConfigModel
    supabase_url: Optional[str] = None
    supabase_key: Optional[str] = None
    sqlite_fallback: str = Field(..., min_length=1)
    
    @validator('supabase_url', 'supabase_key')
    def validate_supabase_config(cls, v, values, field):
        """Validate Supabase configuration is complete"""
        if field.name == 'supabase_key' and v:
            if not values.get('supabase_url'):
                raise ValueError('supabase_url required when supabase_key is provided')
        return v
    
    @validator('sqlite_fallback')
    def validate_sqlite_path(cls, v):
        """Validate SQLite fallback path is writable"""
        path = Path(v)
        parent_dir = path.parent
        
        if not parent_dir.exists():
            try:
                parent_dir.mkdir(parents=True, exist_ok=True)
            except PermissionError:
                raise ValueError(f'Cannot create directory: {parent_dir}')
        
        if not os.access(parent_dir, os.W_OK):
            raise ValueError(f'Directory not writable: {parent_dir}')
        
        return v

def validate_config(config: Config) -> Config:
    """Validate configuration using Pydantic model"""
    config_dict = {
        'environment': config.environment.value,
        'debug': config.debug,
        'log_level': config.log_level,
        'database': {
            'host': config.database.host,
            'port': config.database.port,
            'database': config.database.database,
            'username': config.database.username,
            'password': config.database.password,
            'ssl_mode': config.database.ssl_mode,
            'pool_size': config.database.pool_size,
        },
        'supabase_url': config.supabase_url,
        'supabase_key': config.supabase_key,
        'sqlite_fallback': config.sqlite_fallback,
    }
    
    # Validate using Pydantic
    validated = ConfigModel(**config_dict)
    
    # Update original config with validated values
    config.debug = validated.debug
    config.log_level = validated.log_level
    # ... update other fields
    
    return config
```

## Deployment Configuration

### 1. Docker Environment Configuration
```dockerfile
# Multi-stage build for different environments
FROM python:3.11-slim as base

# Install UV
COPY --from=ghcr.io/astral-sh/uv:latest /uv /bin/uv

WORKDIR /app

# Copy dependency files
COPY pyproject.toml uv.lock ./

# Development stage
FROM base as development
RUN uv sync --group dev
COPY . .
ENV ENVIRONMENT=development
CMD ["uv", "run", "python", "-m", "chronicle.dev"]

# Testing stage  
FROM base as testing
RUN uv sync --group test
COPY . .
ENV ENVIRONMENT=testing
CMD ["uv", "run", "pytest"]

# Production stage
FROM base as production
RUN uv sync --frozen --no-dev
COPY . .
ENV ENVIRONMENT=production
RUN adduser --disabled-password --gecos '' appuser && \
    chown -R appuser:appuser /app
USER appuser
CMD ["uv", "run", "python", "-m", "chronicle"]
```

### 2. Docker Compose Configuration
```yaml
# docker-compose.yml
version: '3.8'

services:
  chronicle-dev:
    build:
      context: .
      target: development
    environment:
      - ENVIRONMENT=development
      - DEBUG=true
      - DB_HOST=db
    env_file:
      - .env.development
    volumes:
      - .:/app
      - /app/.venv  # Exclude venv from mount
    ports:
      - "8000:8000"
    depends_on:
      - db

  chronicle-prod:
    build:
      context: .
      target: production
    environment:
      - ENVIRONMENT=production
      - DEBUG=false
    env_file:
      - .env.production
    ports:
      - "80:8000"
    depends_on:
      - db
    restart: unless-stopped

  db:
    image: postgres:15
    environment:
      POSTGRES_DB: chronicle
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

volumes:
  postgres_data:
```

### 3. Kubernetes Configuration
```yaml
# k8s/configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: chronicle-config
data:
  ENVIRONMENT: "production"
  LOG_LEVEL: "warning"
  DATABASE_POOL_SIZE: "20"
  SQLITE_FALLBACK: "/data/chronicle_fallback.db"

---
# k8s/secret.yaml
apiVersion: v1
kind: Secret
metadata:
  name: chronicle-secrets
type: Opaque
stringData:
  DB_PASSWORD: "your-secure-password"
  SUPABASE_KEY: "your-supabase-key"

---
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: chronicle
spec:
  replicas: 3
  selector:
    matchLabels:
      app: chronicle
  template:
    metadata:
      labels:
        app: chronicle
    spec:
      containers:
      - name: chronicle
        image: chronicle:latest
        env:
        - name: ENVIRONMENT
          value: "production"
        envFrom:
        - configMapRef:
            name: chronicle-config
        - secretRef:
            name: chronicle-secrets
        volumeMounts:
        - name: data
          mountPath: /data
      volumes:
      - name: data
        persistentVolumeClaim:
          claimName: chronicle-data
```

## Environment-Specific Scripts

### 1. Setup Script for Each Environment
```python
#!/usr/bin/env python3
"""
Environment-specific setup script
"""

import os
import sys
import subprocess
from pathlib import Path

class EnvironmentSetup:
    def __init__(self, environment: Environment):
        self.env = environment
        self.project_root = Path.cwd()
    
    def setup(self):
        """Run environment-specific setup"""
        print(f"Setting up {self.env.value} environment...")
        
        # Common setup
        self._ensure_directories()
        self._copy_config_files()
        self._install_dependencies()
        
        # Environment-specific setup
        if self.env == Environment.DEVELOPMENT:
            self._setup_development()
        elif self.env == Environment.TESTING:
            self._setup_testing()
        elif self.env == Environment.PRODUCTION:
            self._setup_production()
    
    def _ensure_directories(self):
        """Create required directories"""
        dirs = [
            'logs',
            'data',
            'temp',
            '.claude',
            'hooks'
        ]
        
        for dir_name in dirs:
            (self.project_root / dir_name).mkdir(exist_ok=True)
    
    def _copy_config_files(self):
        """Copy environment-specific configuration files"""
        env_file = f".env.{self.env.value}"
        if Path(env_file).exists() and not Path('.env').exists():
            subprocess.run(['cp', env_file, '.env'])
            print(f"Copied {env_file} to .env")
    
    def _install_dependencies(self):
        """Install environment-specific dependencies"""
        if self.env == Environment.DEVELOPMENT:
            subprocess.run(['uv', 'sync', '--group', 'dev'])
        elif self.env == Environment.TESTING:
            subprocess.run(['uv', 'sync', '--group', 'test'])
        else:
            subprocess.run(['uv', 'sync', '--frozen'])
    
    def _setup_development(self):
        """Development-specific setup"""
        # Install pre-commit hooks
        subprocess.run(['uv', 'run', 'pre-commit', 'install'])
        
        # Setup git hooks
        git_hooks_dir = Path('.git/hooks')
        if git_hooks_dir.exists():
            hook_script = git_hooks_dir / 'pre-push'
            with open(hook_script, 'w') as f:
                f.write('#!/bin/bash\nuv run pytest\n')
            hook_script.chmod(0o755)
        
        print("Development environment ready!")
        print("- Pre-commit hooks installed")
        print("- Git hooks configured")
        print("- Development dependencies installed")
    
    def _setup_testing(self):
        """Testing-specific setup"""
        # Create test database
        subprocess.run(['createdb', 'chronicle_test'], check=False)
        
        # Run database migrations
        subprocess.run(['uv', 'run', 'python', '-m', 'chronicle.database', 'migrate'])
        
        print("Testing environment ready!")
        print("- Test database created")
        print("- Database migrations applied")
    
    def _setup_production(self):
        """Production-specific setup"""
        # Validate configuration
        config = Config.load(Environment.PRODUCTION)
        validate_config(config)
        
        # Create systemd service (if on Linux)
        if sys.platform.startswith('linux'):
            self._create_systemd_service()
        
        print("Production environment ready!")
        print("- Configuration validated")
        print("- System service configured")
    
    def _create_systemd_service(self):
        """Create systemd service for production"""
        service_content = f"""[Unit]
Description=Chronicle Observability System
After=network.target

[Service]
Type=simple
User=chronicle
WorkingDirectory={self.project_root}
Environment=ENVIRONMENT=production
ExecStart={self.project_root}/.venv/bin/python -m chronicle
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
"""
        
        service_file = Path('/etc/systemd/system/chronicle.service')
        try:
            with open(service_file, 'w') as f:
                f.write(service_content)
            
            subprocess.run(['systemctl', 'daemon-reload'])
            subprocess.run(['systemctl', 'enable', 'chronicle'])
            print("Systemd service created and enabled")
        except PermissionError:
            print("Note: Run with sudo to create systemd service")

if __name__ == "__main__":
    env_name = sys.argv[1] if len(sys.argv) > 1 else "development"
    try:
        env = Environment(env_name)
        setup = EnvironmentSetup(env)
        setup.setup()
    except ValueError:
        print(f"Invalid environment: {env_name}")
        print("Valid environments: development, testing, staging, production")
        sys.exit(1)
```

## Best Practices

### 1. Configuration Security
- **Never commit secrets** to version control
- **Use environment variables** for sensitive data
- **Implement proper secret rotation** in production
- **Validate all configuration** before startup
- **Use different databases** for each environment

### 2. Environment Isolation
- **Separate infrastructure** for each environment
- **Different access controls** per environment
- **Environment-specific monitoring** and alerting
- **Automated deployment pipelines** with proper gates

### 3. Configuration Management
- **Use configuration hierarchy** (files → env vars → command line)
- **Implement validation** at startup
- **Document all configuration options**
- **Provide sensible defaults** for development
- **Make production configuration explicit**

### 4. Deployment Automation
- **Infrastructure as Code** (Terraform, CloudFormation)
- **Configuration as Code** (Ansible, Puppet)
- **Automated testing** of configuration changes
- **Blue-green deployments** for zero-downtime updates
- **Rollback capabilities** for failed deployments

This comprehensive guide provides the foundation for robust environment configuration management across the entire application lifecycle.