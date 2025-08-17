# Chronicle Dashboard Security Guide

> **Comprehensive security configuration and best practices for Chronicle Dashboard**

## Overview

This guide covers security implementation, secret management, and best practices for securing Chronicle Dashboard in production environments.

## Table of Contents

1. [Security Architecture](#security-architecture)
2. [Environment Configuration Security](#environment-configuration-security)
3. [Secret Management](#secret-management)
4. [Content Security Policy (CSP)](#content-security-policy-csp)
5. [Security Headers](#security-headers)
6. [Input Validation & Sanitization](#input-validation--sanitization)
7. [Rate Limiting](#rate-limiting)
8. [Authentication & Authorization](#authentication--authorization)
9. [Data Protection](#data-protection)
10. [Security Monitoring](#security-monitoring)
11. [Incident Response](#incident-response)

## Security Architecture

Chronicle Dashboard implements a multi-layered security approach:

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
│         Chronicle Dashboard                 │
├─────────────────────────────────────────────┤
│           Supabase Security                 │
└─────────────────────────────────────────────┘
```

### Security Principles

1. **Defense in Depth**: Multiple security layers
2. **Least Privilege**: Minimal required permissions
3. **Fail Secure**: Secure defaults when errors occur
4. **Zero Trust**: Verify everything, trust nothing

## Environment Configuration Security

### 1. Environment Separation

Chronicle uses strict environment separation:

```bash
# Development - relaxed security for development speed
.env.development

# Staging - production-like security for testing
.env.staging  

# Production - maximum security
.env.production
```

### 2. Secure Environment Variables

**Production Environment Variables:**

```env
# Required - never commit these values
NEXT_PUBLIC_SUPABASE_URL=https://prod-xyz.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ0eXAi...  # JWT token
SUPABASE_SERVICE_ROLE_KEY=eyJ0eXAi...      # HIGHLY SENSITIVE

# Security settings - enable all in production
NEXT_PUBLIC_ENABLE_CSP=true
NEXT_PUBLIC_ENABLE_SECURITY_HEADERS=true
NEXT_PUBLIC_ENABLE_RATE_LIMITING=true

# Monitoring - for security incident detection
SENTRY_DSN=https://your-dsn@sentry.io/project
SENTRY_ENVIRONMENT=production
```

### 3. Environment Variable Validation

Chronicle automatically validates environment variables:

```typescript
// Automatic validation in src/lib/config.ts
const securityChecks = {
  validateEnvironmentConfig(): string[] {
    const issues: string[] = [];
    
    // Validate Supabase URL format
    if (!envValidation.isValidSupabaseURL(config.supabase.url)) {
      issues.push('Invalid Supabase URL format');
    }
    
    // Check production security settings
    if (configUtils.isProduction()) {
      if (!config.security.enableCSP) {
        issues.push('CSP should be enabled in production');
      }
    }
    
    return issues;
  }
};
```

## Secret Management

### 1. Secret Classification

Chronicle handles three types of secrets:

| Type | Exposure | Examples |
|------|----------|----------|
| **Public** | Client-safe | Supabase URL, Environment name |
| **Private** | Server-only | Service role keys, Sentry DSN |
| **Sensitive** | Encrypted storage | Database passwords, API keys |

### 2. Platform-Specific Secret Management

#### Vercel
```bash
# Add secrets via Vercel CLI
vercel env add NEXT_PUBLIC_SUPABASE_URL production
vercel env add SUPABASE_SERVICE_ROLE_KEY production
vercel env add SENTRY_DSN production

# Or via Vercel Dashboard:
# 1. Go to Project Settings
# 2. Navigate to Environment Variables
# 3. Add variables with appropriate scope
```

#### Netlify
```bash
# Add via Netlify CLI
netlify env:set NEXT_PUBLIC_SUPABASE_URL "your-value" --scope=production
netlify env:set SUPABASE_SERVICE_ROLE_KEY "your-secret" --scope=production

# Or via Netlify Dashboard:
# 1. Site Settings → Environment Variables
# 2. Add variables with production scope
```

#### AWS
```bash
# Store in AWS Secrets Manager
aws secretsmanager create-secret \
    --name "chronicle/supabase/service-role-key" \
    --description "Chronicle Supabase Service Role Key" \
    --secret-string "your-secret-key"

# Reference in ECS task definition
{
  "secrets": [
    {
      "name": "SUPABASE_SERVICE_ROLE_KEY",
      "valueFrom": "arn:aws:secretsmanager:region:account:secret:chronicle/supabase/service-role-key"
    }
  ]
}
```

#### Docker
```bash
# Use Docker secrets
echo "your-secret-key" | docker secret create supabase_service_role_key -

# Reference in docker-compose.yml
services:
  chronicle-dashboard:
    secrets:
      - supabase_service_role_key
    environment:
      - SUPABASE_SERVICE_ROLE_KEY_FILE=/run/secrets/supabase_service_role_key
```

### 3. Secret Rotation

Implement regular secret rotation:

```bash
# Supabase keys - rotate monthly
# 1. Generate new key in Supabase dashboard
# 2. Update environment variables
# 3. Test deployment
# 4. Revoke old key

# Sentry DSN - rotate quarterly
# 1. Create new project or regenerate DSN
# 2. Update environment variables
# 3. Verify error reporting
```

## Content Security Policy (CSP)

### 1. CSP Configuration

Chronicle automatically configures CSP based on environment:

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

### 2. CSP Violation Reporting

Configure CSP violation reporting:

```typescript
// Add to CSP header
'report-uri': ['https://your-domain.com/api/csp-report'],
'report-to': ['csp-endpoint'],
```

### 3. CSP Testing

Test CSP implementation:

```bash
# Check CSP header
curl -I https://your-domain.com | grep -i content-security-policy

# Test with browser dev tools
# 1. Open Network tab
# 2. Check for CSP violations in Console
# 3. Verify all resources load correctly
```

## Security Headers

### 1. Standard Security Headers

Chronicle automatically applies security headers in production:

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

### 2. Header Verification

Verify security headers:

```bash
# Check all security headers
curl -I https://your-domain.com

# Security header scanner
npm install -g security-headers-cli
security-headers https://your-domain.com
```

## Input Validation & Sanitization

### 1. Automatic Validation

Chronicle includes comprehensive input validation:

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

### 2. API Input Validation

All API endpoints validate inputs:

```typescript
// Example API route validation
export async function POST(request: Request) {
  const body = await request.json();
  
  // Validate and sanitize inputs
  const sanitizedBody = inputValidation.sanitizeObject(body);
  
  // Validate required fields
  if (!inputValidation.isValidUUID(sanitizedBody.session_id)) {
    return NextResponse.json(
      { error: 'Invalid session ID format' },
      { status: 400 }
    );
  }
  
  // Process safely validated data
  // ...
}
```

## Rate Limiting

### 1. Application-Level Rate Limiting

Chronicle implements intelligent rate limiting:

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

### 2. Infrastructure-Level Protection

Recommend additional protection:

```yaml
# Cloudflare rate limiting rules
rules:
  - description: "API protection"
    expression: "(http.request.uri.path matches \"/api/.*\")"
    action: "rate_limit"
    rate_limit:
      threshold: 100
      period: 60
      
  - description: "Export endpoint protection"  
    expression: "(http.request.uri.path eq \"/api/export\")"
    action: "rate_limit"
    rate_limit:
      threshold: 10
      period: 300
```

## Authentication & Authorization

### 1. Supabase Row Level Security (RLS)

Chronicle leverages Supabase RLS for data protection:

```sql
-- Events table policies
CREATE POLICY "Events are viewable by authenticated users" ON events
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Events can be inserted by service role" ON events
    FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- Sessions table policies  
CREATE POLICY "Sessions are viewable by authenticated users" ON sessions
    FOR SELECT USING (auth.role() = 'authenticated');
```

### 2. API Route Protection

Protect sensitive API routes:

```typescript
// Middleware for API protection
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Protect admin routes
  if (pathname.startsWith('/api/admin/')) {
    const serviceKey = request.headers.get('authorization');
    
    if (!serviceKey || !isValidServiceKey(serviceKey)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }
  }
  
  return NextResponse.next();
}
```

## Data Protection

### 1. Data Encryption

Chronicle ensures data is encrypted:

- **In Transit**: HTTPS/TLS for all communications
- **At Rest**: Supabase database encryption
- **Client Storage**: No sensitive data in localStorage/sessionStorage

### 2. Data Minimization

Only collect necessary data:

```typescript
// Example of data minimization
interface EventData {
  id: string;
  type: string;
  timestamp: string;
  session_id: string;
  // NO: user_email, ip_address, personal_data
}
```

### 3. Data Retention

Implement data retention policies:

```sql
-- Auto-delete old events (90 days)
CREATE OR REPLACE FUNCTION cleanup_old_events()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  DELETE FROM events 
  WHERE timestamp < NOW() - INTERVAL '90 days';
END;
$$;

-- Schedule cleanup
SELECT cron.schedule(
  'cleanup-old-events',
  '0 2 * * *',  -- Daily at 2 AM
  'SELECT cleanup_old_events();'
);
```

## Security Monitoring

### 1. Error Tracking

Configure Sentry for security monitoring:

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

### 2. Audit Logging

Implement comprehensive audit logging:

```typescript
// Audit log interface
interface AuditLog {
  timestamp: string;
  action: string;
  resource: string;
  user_id?: string;
  ip_address: string;
  user_agent: string;
  success: boolean;
  details?: Record<string, unknown>;
}

// Log security events
const auditLogger = {
  logSecurityEvent(event: Omit<AuditLog, 'timestamp'>) {
    const log: AuditLog = {
      ...event,
      timestamp: new Date().toISOString(),
    };
    
    // Send to logging service
    console.log('AUDIT:', JSON.stringify(log));
    
    // Alert on suspicious activity
    if (!event.success) {
      Sentry.captureMessage(`Security event: ${event.action}`, 'warning');
    }
  },
};
```

### 3. Real-time Monitoring

Monitor for security incidents:

```typescript
// Monitor for security patterns
const securityMonitor = {
  patterns: [
    /script.*src/i,           // Script injection attempts
    /javascript:/i,           // JavaScript protocol
    /eval\s*\(/i,            // Code evaluation
    /<iframe/i,              // Iframe injection
    /union.*select/i,        // SQL injection
  ],
  
  checkRequest(data: string): boolean {
    return this.patterns.some(pattern => pattern.test(data));
  },
};
```

## Incident Response

### 1. Security Incident Response Plan

1. **Detection**: Automated monitoring alerts
2. **Assessment**: Determine severity and scope
3. **Containment**: Isolate affected systems
4. **Eradication**: Remove threats
5. **Recovery**: Restore normal operations
6. **Lessons Learned**: Improve security posture

### 2. Emergency Procedures

```bash
# Emergency shutdown (if compromise detected)
vercel env rm NEXT_PUBLIC_SUPABASE_ANON_KEY --scope=production
vercel env rm SUPABASE_SERVICE_ROLE_KEY --scope=production

# Emergency deployment rollback
vercel rollback --url=your-domain.com

# Rotate all secrets immediately
# 1. Generate new Supabase keys
# 2. Update all environment variables
# 3. Revoke old keys
# 4. Monitor for continued attacks
```

### 3. Incident Communication

```typescript
// Security incident notification
const notifySecurityIncident = async (incident: SecurityIncident) => {
  // Alert via Sentry
  Sentry.captureException(new Error(`Security incident: ${incident.type}`));
  
  // Log to audit system
  auditLogger.logSecurityEvent({
    action: 'security_incident',
    resource: 'system',
    success: false,
    details: incident,
  });
  
  // Notify team (implementation depends on notification system)
  await notifyTeam(incident);
};
```

## Security Checklist

### Pre-Production Checklist

- [ ] All environment variables properly configured
- [ ] No secrets committed to version control
- [ ] CSP properly configured and tested
- [ ] Security headers enabled
- [ ] Rate limiting configured
- [ ] Input validation implemented
- [ ] HTTPS enforced
- [ ] Supabase RLS policies active
- [ ] Error tracking configured
- [ ] Security monitoring enabled

### Regular Security Reviews

- [ ] Review access logs (weekly)
- [ ] Check for security updates (weekly)
- [ ] Rotate secrets (monthly)
- [ ] Security scan (monthly)
- [ ] Penetration testing (quarterly)
- [ ] Security audit (annually)

## Security Best Practices

1. **Keep Dependencies Updated**: Regular security updates
2. **Minimal Permissions**: Least privilege principle
3. **Regular Monitoring**: Continuous security monitoring
4. **Incident Response**: Prepared response procedures
5. **Security Training**: Team security awareness
6. **Documentation**: Keep security docs updated

## Compliance Considerations

### GDPR Compliance

- Data minimization implemented
- User consent for analytics (if enabled)
- Data retention policies configured
- Right to deletion supported

### SOC 2 Compliance

- Access controls implemented
- Audit logging enabled
- Security monitoring active
- Incident response procedures documented

## Conclusion

Chronicle Dashboard implements comprehensive security measures to protect against common web application vulnerabilities. Regular monitoring, updates, and security reviews ensure ongoing protection against emerging threats.

For security questions or to report vulnerabilities, please follow responsible disclosure practices and contact the development team through appropriate channels.