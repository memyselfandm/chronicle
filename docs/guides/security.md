# Chronicle Security Guide

> **Comprehensive security configuration and best practices for Chronicle observability system**

## Overview

Chronicle handles sensitive development data including code snippets, file paths, user prompts, and system information. This consolidated guide ensures secure deployment and operation across all Chronicle components (dashboard, hooks system, and infrastructure).

## Table of Contents

- [Security Architecture](#security-architecture)
- [Threat Model](#threat-model)
- [Data Classification](#data-classification)
- [Environment Security](#environment-security)
- [Database Security](#database-security)
- [Network Security](#network-security)
- [Application Security](#application-security)
- [Dashboard Security](#dashboard-security)
- [Hooks Security](#hooks-security)
- [Monitoring & Auditing](#monitoring--auditing)
- [Incident Response](#incident-response)
- [Compliance Considerations](#compliance-considerations)
- [Security Checklists](#security-checklists)

## Security Architecture

Chronicle implements a multi-layered security approach across all components:

```
┌─────────────────────────────────────────────┐
│                CDN/WAF                      │
├─────────────────────────────────────────────┤
│            Security Headers                 │
├─────────────────────────────────────────────┤
│              Rate Limiting                  │
├─────────────────────────────────────────────┤
│        Content Security Policy              │
├─────────────────────────────────────────────┤
│          Input Validation                   │
├─────────────────────────────────────────────┤
│    Chronicle Dashboard + Hooks System       │
├─────────────────────────────────────────────┤
│           Supabase Security                 │
└─────────────────────────────────────────────┘
```

### Security Principles

1. **Defense in Depth**: Multiple security layers
2. **Least Privilege**: Minimal required permissions
3. **Fail Secure**: Secure defaults when errors occur
4. **Zero Trust**: Verify everything, trust nothing
5. **Data Minimization**: Collect only necessary data
6. **Transparency**: Clear security documentation

## Threat Model

### Assets to Protect

1. **Source Code**: File contents, project structure
2. **User Data**: Prompts, commands, personal information
3. **System Information**: File paths, environment variables
4. **API Keys**: Supabase credentials, webhook tokens
5. **Session Data**: Agent behavior patterns, usage analytics
6. **Infrastructure**: Servers, databases, network resources

### Threat Actors

1. **External Attackers**: Unauthorized access to dashboard/database
2. **Insider Threats**: Malicious users with system access
3. **Data Breaches**: Accidental exposure of sensitive information
4. **Supply Chain**: Compromised dependencies or infrastructure
5. **State Actors**: Advanced persistent threats

### Attack Vectors

1. **API Exploitation**: Unauthorized database access
2. **Configuration Exposure**: Leaked environment variables
3. **Data Injection**: Malicious input through hooks
4. **Network Interception**: Man-in-the-middle attacks
5. **File System Access**: Unauthorized local data access
6. **XSS/CSRF**: Client-side attacks
7. **Dependency Vulnerabilities**: Compromised packages

## Data Classification

### Highly Sensitive
- **API Keys & Tokens**: Supabase service role keys, authentication tokens
- **User Credentials**: Authentication information
- **Source Code**: Proprietary or confidential code
- **Personal Data**: Emails, names, personal information

### Sensitive  
- **User Prompts**: May contain personal or confidential information
- **File Paths**: Can reveal system structure and usernames
- **System Commands**: May expose configuration details
- **Session Metadata**: User behavior patterns

### Internal Use
- **Performance Metrics**: Execution times, error rates
- **System Logs**: Non-sensitive operational data
- **Public Configuration**: Non-secret environment settings

## Environment Security

### Environment Variable Management

**❌ Never Commit These**:
```bash
# These should NEVER be in version control
SUPABASE_SERVICE_ROLE_KEY=eyJ0eXAiOiJKV1Q...
SUPABASE_ANON_KEY=eyJ0eXAiOiJKV1Q...
WEBHOOK_SECRET=secret-token-here
SMTP_PASSWORD=email-password
SENTRY_DSN=https://sentry-dsn...
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

4. **Cloud Platforms**:
   ```bash
   # Vercel
   vercel env add SUPABASE_SERVICE_ROLE_KEY production
   
   # Netlify
   netlify env:set SUPABASE_ANON_KEY "value" --scope=production
   
   # AWS Secrets Manager
   aws secretsmanager create-secret \
       --name "chronicle/supabase/service-role-key" \
       --secret-string "your-secret-key"
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

### Supabase Security Configuration

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
   -- Dashboard users can only see their own sessions
   CREATE POLICY "Users can only see their own sessions" ON sessions
   FOR SELECT USING (
     metadata->>'user_id' = auth.uid()::text
   );
   
   -- Service role has full access for hooks
   CREATE POLICY "Service role full access" ON sessions
   FOR ALL USING (
     auth.jwt() ->> 'role' = 'service_role'
   );
   
   -- Events are viewable by authenticated users
   CREATE POLICY "Events are viewable by authenticated users" ON events
       FOR SELECT USING (auth.role() = 'authenticated');

   CREATE POLICY "Events can be inserted by service role" ON events
       FOR INSERT WITH CHECK (auth.role() = 'service_role');
   ```

3. **API Key Rotation**:
   ```bash
   # Regularly rotate API keys (quarterly)
   # 1. Generate new keys in Supabase dashboard
   # 2. Update environment variables across all deployments
   # 3. Restart applications
   # 4. Revoke old keys
   # 5. Verify all systems are working
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

## Dashboard Security

### Content Security Policy (CSP)

```typescript
// Production CSP directives
const CSP_DIRECTIVES = {
  'default-src': ["'self'"],
  'script-src': [
    "'self'",
    'https://*.supabase.co',           // Supabase client
    'https://vercel.live',             // Vercel analytics (if used)
  ],
  'style-src': [
    "'self'",
    "'unsafe-inline'",                 // Required for Tailwind
    'https://fonts.googleapis.com',    // Google Fonts
  ],
  'img-src': [
    "'self'",
    'data:',                           // Base64 images
    'https://*.supabase.co',           // Supabase storage
  ],
  'connect-src': [
    "'self'",
    'https://*.supabase.co',           // API calls
    'wss://*.supabase.co',            // WebSocket connections
    'https://sentry.io',               // Error reporting
  ],
  'frame-ancestors': ["'none'"],       // Prevent iframe embedding
  'base-uri': ["'self'"],              // Restrict base tag
  'form-action': ["'self'"],           // Restrict form submissions
};
```

### Security Headers

```typescript
const SECURITY_HEADERS = {
  // Prevent clickjacking
  'X-Frame-Options': 'DENY',
  
  // Prevent MIME type sniffing
  'X-Content-Type-Options': 'nosniff',
  
  // XSS protection
  'X-XSS-Protection': '1; mode=block',
  
  // Referrer policy
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  
  // Feature policy
  'Permissions-Policy': 'accelerometer=(), camera=(), geolocation=()',
  
  // HTTPS enforcement (production only)
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',
};
```

### Rate Limiting

```typescript
// Rate limiting configuration
const RATE_LIMIT_CONFIG = {
  windowMs: 15 * 60 * 1000,    // 15 minutes
  maxRequests: 1000,           // requests per window
  
  // Different limits per endpoint
  endpoints: {
    '/api/events': { max: 100 },
    '/api/sessions': { max: 50 },
    '/api/export': { max: 5 },   // Lower limit for expensive operations
  },
  
  // IP-based limiting
  skipSuccessfulRequests: false,
  skipFailedRequests: false,
  
  // Error response
  message: 'Too many requests from this IP, please try again later.',
};
```

### Dashboard Input Validation

```typescript
// All inputs automatically validated
const inputValidation = {
  // String sanitization
  sanitizeString(input: string): string {
    return input
      .replace(/[<>]/g, '')           // Remove angle brackets
      .replace(/javascript:/gi, '')    // Remove javascript: protocol
      .replace(/on\w+=/gi, '')        // Remove event handlers
      .trim()
      .slice(0, 1000);               // Limit length
  },
  
  // UUID validation
  isValidUUID(uuid: string): boolean {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  },
  
  // URL validation
  isValidURL(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  },
};
```

## Hooks Security

### Hook Installation Security

```python
# Verify hook integrity before installation
def verify_hook_integrity(hook_file_path):
    """
    Verify hook file integrity and safety
    """
    # Check file permissions
    file_stat = os.stat(hook_file_path)
    if file_stat.st_mode & 0o002:  # World writable
        raise SecurityError("Hook file is world-writable")
    
    # Scan for dangerous patterns
    dangerous_patterns = [
        r'import\s+os\s*;.*system',
        r'subprocess\s*\..*shell\s*=\s*True',
        r'eval\s*\(',
        r'exec\s*\(',
    ]
    
    with open(hook_file_path, 'r') as f:
        content = f.read()
        for pattern in dangerous_patterns:
            if re.search(pattern, content, re.IGNORECASE):
                raise SecurityError(f"Dangerous pattern detected: {pattern}")
    
    return True
```

### Hook Runtime Security

```python
# Sandbox hook execution
import resource
import signal

def execute_hook_safely(hook_function, timeout=5, max_memory=100*1024*1024):
    """
    Execute hook with resource limits and timeout
    """
    def timeout_handler(signum, frame):
        raise TimeoutError("Hook execution timed out")
    
    # Set memory limit
    resource.setrlimit(resource.RLIMIT_AS, (max_memory, max_memory))
    
    # Set timeout
    signal.signal(signal.SIGALRM, timeout_handler)
    signal.alarm(timeout)
    
    try:
        result = hook_function()
        signal.alarm(0)  # Cancel timeout
        return result
    except Exception as e:
        signal.alarm(0)  # Cancel timeout
        raise e
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

### Security Monitoring

```typescript
// Security-specific Sentry configuration
Sentry.init({
  beforeSend(event) {
    // Track security events
    if (event.exception) {
      const error = event.exception.values?.[0];
      
      // Detect potential attacks
      if (error?.value?.includes('script') || 
          error?.value?.includes('injection')) {
        Sentry.addBreadcrumb({
          message: 'Potential security incident detected',
          level: 'warning',
          category: 'security',
        });
      }
    }
    
    return event;
  },
});
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
   - Third-party security notifications

2. **Assessment**:
   - Determine severity and scope
   - Identify affected systems and data
   - Document incident timeline

3. **Containment**:
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
   
   # 4. Emergency shutdown (if needed)
   vercel env rm SUPABASE_SERVICE_ROLE_KEY --scope=production
   pm2 stop all
   ```

4. **Eradication**:
   - Remove threats and vulnerabilities
   - Patch systems and update dependencies
   - Strengthen security controls

5. **Recovery**:
   ```bash
   # Clean and restore
   # - Update all passwords/keys
   # - Restore from clean backups if needed
   # - Gradually restore services
   # - Monitor for continued attacks
   ```

6. **Lessons Learned**:
   - Document incident details
   - Update security procedures
   - Improve monitoring and detection

### Emergency Procedures

```bash
# Complete system lockdown
sudo systemctl stop nginx
pm2 stop all
sudo ufw --force reset
sudo ufw default deny incoming
sudo ufw default deny outgoing
sudo ufw allow out 22  # Keep SSH for emergency access

# Evidence preservation
tar -czf incident-evidence-$(date +%Y%m%d-%H%M).tar.gz \
  /var/log/chronicle/ \
  /home/chronicle/chronicle/apps/*/logs/ \
  ~/.claude/logs/
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

## Compliance Considerations

### GDPR Compliance

- **Data minimization**: Only collect necessary data
- **User consent**: Clear consent for analytics (if enabled)
- **Data retention**: Automatic deletion of old data
- **Right to deletion**: Support for data removal requests
- **Data protection**: Encryption and access controls

### SOC 2 Compliance

- **Access controls**: Role-based access and authentication
- **Audit logging**: Comprehensive activity tracking
- **Security monitoring**: Continuous threat detection
- **Incident response**: Documented procedures and testing
- **Vendor management**: Third-party security assessment

### HIPAA Considerations

*Note: Chronicle is not designed for healthcare data. If handling PHI:*

- Enable additional encryption
- Implement stricter access controls
- Enhance audit logging
- Sign Business Associate Agreements
- Conduct regular risk assessments

## Security Checklists

### Pre-Deployment Security Checklist

- [ ] Environment variables secured (not in version control)
- [ ] File permissions configured (600 for secrets, 755 for executables)
- [ ] Data sanitization enabled
- [ ] Input validation implemented
- [ ] Dependencies audited and updated
- [ ] SSL/TLS configured with strong ciphers
- [ ] Firewall rules applied and tested
- [ ] CSP properly configured and tested
- [ ] Security headers enabled
- [ ] Rate limiting configured
- [ ] Error tracking configured (Sentry)

### Production Security Checklist

- [ ] Row Level Security enabled in Supabase
- [ ] API keys rotated and secured
- [ ] Security logging enabled and monitored
- [ ] Monitoring and alerting configured
- [ ] Backup strategy implemented and tested
- [ ] Incident response plan documented and tested
- [ ] Regular security reviews scheduled
- [ ] Team security training completed
- [ ] Penetration testing conducted

### Ongoing Security Checklist

- [ ] Monthly dependency updates
- [ ] Quarterly API key rotation
- [ ] Weekly log review
- [ ] Regular security scan results reviewed
- [ ] Annual penetration testing
- [ ] Security documentation kept current
- [ ] Team security awareness training
- [ ] Incident response plan testing

## Security Updates and Maintenance

### Staying Current

1. **Monitor Security Advisories**:
   - Supabase security updates
   - Node.js security releases
   - Python security patches
   - Dependency vulnerability alerts

2. **Update Schedule**:
   - Critical: Immediate (within 24 hours)
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
   
   # Run security tests
   npm run test:security
   python -m pytest tests/security/
   ```

## Conclusion

Security is an ongoing process that requires continuous attention and improvement. This guide provides a comprehensive foundation for securing Chronicle deployments, but security practices should be regularly reviewed and updated as threats evolve.

### Key Takeaways:

1. **Defense in Depth**: Implement multiple layers of security
2. **Regular Updates**: Keep all dependencies and systems current
3. **Monitoring**: Continuous security monitoring and logging
4. **Incident Preparedness**: Have documented response procedures
5. **Team Training**: Ensure all team members understand security practices

**For security questions, vulnerability reports, or incidents, follow your organization's security reporting procedures.**

---
*This document consolidates security guidance from multiple Chronicle components and should be reviewed regularly to ensure current best practices are followed.*