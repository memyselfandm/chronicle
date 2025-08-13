# Chronicle Security Guide

> **Security best practices and configuration guidelines for Chronicle observability system**

## Security Overview

Chronicle handles sensitive development data including code snippets, file paths, user prompts, and system information. This guide ensures secure deployment and operation.

## Table of Contents

- [Threat Model](#threat-model)
- [Data Classification](#data-classification)
- [Configuration Security](#configuration-security)
- [Database Security](#database-security)
- [Network Security](#network-security)
- [Application Security](#application-security)
- [Monitoring & Auditing](#monitoring--auditing)
- [Incident Response](#incident-response)

## Threat Model

### Assets to Protect

1. **Source Code**: File contents, project structure
2. **User Data**: Prompts, commands, personal information
3. **System Information**: File paths, environment variables
4. **API Keys**: Supabase credentials, webhook tokens
5. **Session Data**: Agent behavior patterns, usage analytics

### Threat Actors

1. **External Attackers**: Unauthorized access to dashboard/database
2. **Insider Threats**: Malicious users with system access
3. **Data Breaches**: Accidental exposure of sensitive information
4. **Supply Chain**: Compromised dependencies or infrastructure

### Attack Vectors

1. **API Exploitation**: Unauthorized database access
2. **Configuration Exposure**: Leaked environment variables
3. **Data Injection**: Malicious input through hooks
4. **Network Interception**: Man-in-the-middle attacks
5. **File System Access**: Unauthorized local data access

## Data Classification

### Highly Sensitive
- **API Keys & Tokens**: Supabase service role keys
- **User Credentials**: Authentication tokens
- **Source Code**: Proprietary or confidential code

### Sensitive  
- **User Prompts**: May contain personal information
- **File Paths**: Can reveal system structure
- **System Commands**: May expose configuration

### Internal Use
- **Session Metadata**: Timestamps, tool usage counts
- **Performance Metrics**: Execution times, error rates
- **System Logs**: Non-sensitive operational data

## Configuration Security

### Environment Variables

**❌ Never Commit These**:
```bash
# These should NEVER be in version control
SUPABASE_SERVICE_ROLE_KEY=eyJ0eXAiOiJKV1Q...
SUPABASE_ANON_KEY=eyJ0eXAiOiJKV1Q...
WEBHOOK_SECRET=secret-token-here
SMTP_PASSWORD=email-password
```

**✅ Secure Storage Methods**:

1. **Local Development**:
   ```bash
   # Use .env files (add to .gitignore)
   echo ".env*" >> .gitignore
   echo "!.env.example" >> .gitignore
   
   # Set restrictive permissions
   chmod 600 .env
   chmod 600 .env.local
   ```

2. **Production Servers**:
   ```bash
   # Use systemd environment files
   sudo mkdir -p /etc/chronicle
   sudo chmod 700 /etc/chronicle
   
   # Create environment file
   sudo tee /etc/chronicle/environment << EOF
   SUPABASE_URL=https://prod-project.supabase.co
   SUPABASE_ANON_KEY=production-key-here
   EOF
   
   sudo chmod 600 /etc/chronicle/environment
   sudo chown root:root /etc/chronicle/environment
   ```

3. **Container Deployment**:
   ```yaml
   # Use Kubernetes secrets
   apiVersion: v1
   kind: Secret
   metadata:
     name: chronicle-secrets
   type: Opaque
   stringData:
     SUPABASE_URL: "https://prod-project.supabase.co"
     SUPABASE_ANON_KEY: "production-key"
   ```

### File Permissions

```bash
# Secure configuration files
chmod 600 apps/dashboard/.env.local
chmod 600 apps/hooks/.env
chmod 700 ~/.claude/hooks/
chmod 755 ~/.claude/hooks/*.py

# Secure log files
mkdir -p ~/.chronicle/logs
chmod 700 ~/.chronicle/logs
chmod 600 ~/.chronicle/logs/*.log
```

### Data Sanitization

**Enable in Production** (apps/hooks/.env):
```env
# Data protection settings
CLAUDE_HOOKS_SANITIZE_DATA=true
CLAUDE_HOOKS_PII_FILTERING=true
CLAUDE_HOOKS_REMOVE_API_KEYS=true
CLAUDE_HOOKS_REMOVE_FILE_PATHS=true

# Input validation
CLAUDE_HOOKS_MAX_INPUT_SIZE_MB=10
CLAUDE_HOOKS_ALLOWED_EXTENSIONS=.py,.js,.ts,.json,.md,.txt
CLAUDE_HOOKS_BLOCKED_PATHS=.env,.git/,node_modules/,__pycache__/
```

**Custom Sanitization Patterns**:
```python
# In apps/hooks/src/utils.py
import re

SENSITIVE_PATTERNS = [
    # API Keys
    r'(sk-[a-zA-Z0-9]{32,})',  # OpenAI keys
    r'(eyJ[a-zA-Z0-9_-]*\.eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*)',  # JWT tokens
    
    # Personal Information
    r'(\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b)',  # Email
    r'(\b\d{3}-\d{2}-\d{4}\b)',  # SSN
    r'(\b\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}\b)',  # Credit card
    
    # System Paths
    r'(/Users/[^/\s]+)',  # macOS user paths
    r'(/home/[^/\s]+)',   # Linux user paths
    r'(C:\\Users\\[^\\]+)', # Windows user paths
]

def sanitize_data(data):
    """Remove sensitive information from data"""
    if isinstance(data, str):
        for pattern in SENSITIVE_PATTERNS:
            data = re.sub(pattern, '[REDACTED]', data, flags=re.IGNORECASE)
    return data
```

## Database Security

### Supabase Security

1. **Row Level Security (RLS)**:
   ```sql
   -- Enable RLS on all tables
   ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
   ALTER TABLE events ENABLE ROW LEVEL SECURITY;
   ALTER TABLE tool_events ENABLE ROW LEVEL SECURITY;
   ALTER TABLE prompt_events ENABLE ROW LEVEL SECURITY;
   ```

2. **Security Policies**:
   ```sql
   -- Example: Restrict access based on user context
   CREATE POLICY "Users can only see their own sessions" ON sessions
   FOR SELECT USING (
     metadata->>'user_id' = auth.uid()::text
   );
   
   -- Service role has full access
   CREATE POLICY "Service role full access" ON sessions
   FOR ALL USING (
     auth.jwt() ->> 'role' = 'service_role'
   );
   ```

3. **API Key Rotation**:
   ```bash
   # Regularly rotate API keys (quarterly)
   # 1. Generate new keys in Supabase dashboard
   # 2. Update environment variables
   # 3. Restart applications
   # 4. Revoke old keys
   ```

### Database Connections

```python
# Use connection pooling with limits
import asyncpg

async def create_secure_pool():
    return await asyncpg.create_pool(
        dsn=DATABASE_URL,
        min_size=1,
        max_size=10,
        command_timeout=30,
        server_settings={
            'application_name': 'chronicle_hooks',
            'search_path': 'public',  # Restrict schema access
        }
    )
```

### Data Encryption

```env
# Enable SSL for database connections
DATABASE_URL=postgresql://user:pass@host:5432/db?sslmode=require

# Use encrypted columns for sensitive data (if needed)
SUPABASE_ENCRYPTION_KEY=your-encryption-key
```

## Network Security

### TLS/SSL Configuration

1. **Dashboard (Production)**:
   ```nginx
   # nginx SSL configuration
   server {
       listen 443 ssl http2;
       ssl_certificate /path/to/cert.pem;
       ssl_certificate_key /path/to/key.pem;
       
       # Strong SSL configuration
       ssl_protocols TLSv1.2 TLSv1.3;
       ssl_ciphers ECDHE+AESGCM:ECDHE+CHACHA20:DHE+AESGCM:DHE+CHACHA20:!aNULL:!MD5:!DSS;
       ssl_prefer_server_ciphers off;
       
       # Security headers
       add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
       add_header X-Frame-Options DENY always;
       add_header X-Content-Type-Options nosniff always;
       add_header Referrer-Policy "strict-origin-when-cross-origin" always;
   }
   ```

2. **CORS Configuration**:
   ```javascript
   // Restrictive CORS for production
   const corsOptions = {
     origin: [
       'https://your-domain.com',
       'https://dashboard.your-domain.com'
     ],
     credentials: true,
     optionsSuccessStatus: 200
   }
   ```

### Firewall Configuration

```bash
# Configure UFW (Ubuntu)
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22     # SSH
sudo ufw allow 80     # HTTP
sudo ufw allow 443    # HTTPS
sudo ufw allow out 5432  # PostgreSQL to Supabase
sudo ufw enable

# Restrict SSH access
sudo ufw allow from 192.168.1.0/24 to any port 22
```

### Network Monitoring

```bash
# Monitor network connections
netstat -tulpn | grep LISTEN
ss -tulpn | grep chronicle

# Monitor SSL certificates
openssl x509 -in /path/to/cert.pem -text -noout -dates
```

## Application Security

### Input Validation

```python
# Validate all hook inputs
import json
from pydantic import BaseModel, validator

class HookInput(BaseModel):
    session_id: str
    tool_name: str
    data: dict
    
    @validator('session_id')
    def validate_session_id(cls, v):
        if not re.match(r'^[a-zA-Z0-9-]{8,64}$', v):
            raise ValueError('Invalid session ID format')
        return v
    
    @validator('tool_name')
    def validate_tool_name(cls, v):
        allowed_tools = ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep']
        if v not in allowed_tools:
            raise ValueError(f'Tool {v} not allowed')
        return v
```

### Output Sanitization

```python
def sanitize_output(data):
    """Sanitize hook output before sending to Claude Code"""
    
    # Remove sensitive information
    if isinstance(data, dict):
        for key in ['password', 'secret', 'token', 'key']:
            if key in data:
                data[key] = '[REDACTED]'
    
    # Limit output size
    output_str = json.dumps(data)
    if len(output_str) > 50000:  # 50KB limit
        return {"error": "Output too large", "size": len(output_str)}
    
    return data
```

### Dependency Security

```bash
# Regular security audits
cd apps/dashboard && npm audit
cd apps/hooks && pip-audit

# Update dependencies
npm update
pip install --upgrade -r requirements.txt

# Pin dependency versions
npm shrinkwrap
pip freeze > requirements.lock
```

### Code Signing

```bash
# Sign Python hooks (optional)
gpg --detach-sign --armor ~/.claude/hooks/pre_tool_use.py

# Verify signatures
gpg --verify ~/.claude/hooks/pre_tool_use.py.asc ~/.claude/hooks/pre_tool_use.py
```

## Monitoring & Auditing

### Security Logging

```python
# Security-focused logging
import logging
import sys

security_logger = logging.getLogger('chronicle.security')
security_logger.setLevel(logging.INFO)

# Log security events
def log_security_event(event_type, details):
    security_logger.info(f"SECURITY_EVENT: {event_type}", extra={
        'event_type': event_type,
        'details': details,
        'timestamp': datetime.utcnow(),
        'source_ip': get_client_ip(),
        'user_agent': get_user_agent()
    })

# Example usage
log_security_event('UNAUTHORIZED_ACCESS', {
    'endpoint': '/api/events',
    'attempted_action': 'DELETE',
    'blocked': True
})
```

### Audit Trail

```env
# Enable comprehensive auditing
CLAUDE_HOOKS_AUDIT_LOGGING=true
CLAUDE_HOOKS_LOG_LEVEL=INFO

# Log all database operations
CLAUDE_HOOKS_LOG_DB_OPERATIONS=true

# Log all API calls
CLAUDE_HOOKS_LOG_API_CALLS=true
```

### Alerting

```python
# Security alert system
def send_security_alert(severity, message, details=None):
    """Send security alerts to administrators"""
    
    if severity in ['critical', 'high']:
        # Immediate notification
        send_slack_alert(message, details)
        send_email_alert(message, details)
    
    # Log all alerts
    security_logger.critical(f"SECURITY_ALERT: {message}", extra=details)

# Example alerts
send_security_alert('high', 'Multiple failed authentication attempts', {
    'source_ip': '192.168.1.100',
    'attempts': 5,
    'timeframe': '5 minutes'
})
```

### Performance Security

```env
# Rate limiting
CLAUDE_HOOKS_RATE_LIMIT_ENABLED=true
CLAUDE_HOOKS_MAX_REQUESTS_PER_MINUTE=100

# Resource limits
CLAUDE_HOOKS_MAX_MEMORY_MB=256
CLAUDE_HOOKS_MAX_CPU_PERCENT=50

# Timeout protection
CLAUDE_HOOKS_EXECUTION_TIMEOUT_MS=5000
```

## Incident Response

### Security Incident Response Plan

1. **Detection**:
   - Monitor security logs
   - Automated alerting
   - User reports

2. **Containment**:
   ```bash
   # Immediate response steps
   
   # 1. Isolate affected systems
   sudo ufw deny from suspicious-ip
   
   # 2. Revoke compromised credentials
   # - Rotate Supabase API keys
   # - Update environment variables
   # - Restart applications
   
   # 3. Preserve evidence
   cp -r /var/log/chronicle /tmp/incident-logs-$(date +%Y%m%d)
   ```

3. **Investigation**:
   ```bash
   # Analyze logs
   grep "SECURITY_EVENT" /var/log/chronicle/*.log
   
   # Check database access
   # Review Supabase audit logs in dashboard
   
   # System forensics
   sudo last | head -20
   sudo netstat -tulpn
   ```

4. **Recovery**:
   ```bash
   # Clean and restore
   # - Update all passwords/keys
   # - Patch vulnerabilities
   # - Restore from clean backups if needed
   ```

### Backup Security

```bash
# Encrypted backups
gpg --symmetric --cipher-algo AES256 \
    --output chronicle-backup-$(date +%Y%m%d).tar.gz.gpg \
    chronicle-backup-$(date +%Y%m%d).tar.gz

# Secure backup storage
aws s3 cp chronicle-backup-*.gpg \
    s3://secure-backup-bucket/ \
    --server-side-encryption AES256
```

## Security Checklist

### Pre-Deployment

- [ ] Environment variables secured (not in version control)
- [ ] File permissions configured (600 for secrets, 755 for executables)
- [ ] Data sanitization enabled
- [ ] Input validation implemented
- [ ] Dependencies audited and updated
- [ ] SSL/TLS configured
- [ ] Firewall rules applied

### Production

- [ ] Row Level Security enabled in Supabase
- [ ] API keys rotated and secured
- [ ] Security logging enabled
- [ ] Monitoring and alerting configured
- [ ] Backup strategy implemented
- [ ] Incident response plan documented
- [ ] Regular security reviews scheduled

### Ongoing

- [ ] Monthly dependency updates
- [ ] Quarterly API key rotation
- [ ] Regular log review
- [ ] Security training for team
- [ ] Penetration testing (annually)

## Security Updates

### Staying Current

1. **Monitor Security Advisories**:
   - Supabase security updates
   - Node.js security releases
   - Python security patches

2. **Update Schedule**:
   - Critical: Immediate
   - High: Within 1 week
   - Medium: Within 1 month
   - Low: Next maintenance window

3. **Testing Updates**:
   ```bash
   # Test in staging first
   npm audit --audit-level high
   pip-audit --desc
   
   # Apply updates
   npm update
   pip install --upgrade -r requirements.txt
   ```

---

**Security is an ongoing process. Regularly review and update security measures as threats evolve.**