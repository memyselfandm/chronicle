#!/usr/bin/env node

/**
 * Chronicle Dashboard Environment Validation Script
 * Validates environment configuration before deployment
 */

const fs = require('fs');
const path = require('path');

// ANSI color codes for output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  bold: '\x1b[1m',
};

function log(level, message, ...args) {
  const timestamp = new Date().toISOString();
  const levelColors = {
    info: colors.blue,
    warn: colors.yellow,
    error: colors.red,
    success: colors.green,
  };
  
  const color = levelColors[level] || colors.reset;
  console.log(`${color}[${timestamp}] ${level.toUpperCase()}: ${message}${colors.reset}`, ...args);
}

function validateURL(url, name) {
  try {
    const parsed = new URL(url);
    
    if (name.includes('SUPABASE')) {
      if (!parsed.hostname.endsWith('.supabase.co') && parsed.hostname !== 'localhost') {
        return `${name}: Invalid Supabase URL format (should end with .supabase.co)`;
      }
      if (parsed.protocol !== 'https:' && parsed.hostname !== 'localhost') {
        return `${name}: Supabase URL should use HTTPS in production`;
      }
    }
    
    return null;
  } catch (error) {
    return `${name}: Invalid URL format - ${error.message}`;
  }
}

function validateSupabaseKey(key, name) {
  if (typeof key !== 'string') {
    return `${name}: Must be a string`;
  }
  
  if (key.length < 100) {
    return `${name}: Key appears too short (should be JWT token)`;
  }
  
  if (!key.includes('.')) {
    return `${name}: Invalid format (should be JWT token with dots)`;
  }
  
  if (key.includes(' ')) {
    return `${name}: Key contains spaces (invalid JWT format)`;
  }
  
  // Check for placeholder values
  const placeholders = ['your-', 'example-', 'test-', 'placeholder'];
  if (placeholders.some(placeholder => key.toLowerCase().includes(placeholder))) {
    return `${name}: Appears to be a placeholder value`;
  }
  
  return null;
}

function validateSentryDSN(dsn, name) {
  if (!dsn) return null; // Optional
  
  try {
    const parsed = new URL(dsn);
    if (!parsed.hostname.includes('sentry.io')) {
      return `${name}: Invalid Sentry DSN (should contain sentry.io)`;
    }
    return null;
  } catch (error) {
    return `${name}: Invalid Sentry DSN format - ${error.message}`;
  }
}

function validateEnvironment(env) {
  const issues = [];
  
  // Required variables
  const required = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY'
  ];
  
  for (const key of required) {
    if (!env[key]) {
      issues.push(`Missing required environment variable: ${key}`);
    }
  }
  
  // URL validation
  if (env.NEXT_PUBLIC_SUPABASE_URL) {
    const urlError = validateURL(env.NEXT_PUBLIC_SUPABASE_URL, 'NEXT_PUBLIC_SUPABASE_URL');
    if (urlError) issues.push(urlError);
  }
  
  // Key validation
  if (env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    const keyError = validateSupabaseKey(env.NEXT_PUBLIC_SUPABASE_ANON_KEY, 'NEXT_PUBLIC_SUPABASE_ANON_KEY');
    if (keyError) issues.push(keyError);
  }
  
  if (env.SUPABASE_SERVICE_ROLE_KEY) {
    const keyError = validateSupabaseKey(env.SUPABASE_SERVICE_ROLE_KEY, 'SUPABASE_SERVICE_ROLE_KEY');
    if (keyError) issues.push(keyError);
  }
  
  // Sentry validation
  if (env.SENTRY_DSN) {
    const sentryError = validateSentryDSN(env.SENTRY_DSN, 'SENTRY_DSN');
    if (sentryError) issues.push(sentryError);
  }
  
  // Environment-specific validation
  const environment = env.NEXT_PUBLIC_ENVIRONMENT || 'development';
  
  if (environment === 'production') {
    // Production-specific checks
    if (env.NEXT_PUBLIC_DEBUG === 'true') {
      issues.push('NEXT_PUBLIC_DEBUG should be false in production');
    }
    
    if (env.NEXT_PUBLIC_SHOW_DEV_TOOLS === 'true') {
      issues.push('NEXT_PUBLIC_SHOW_DEV_TOOLS should be false in production');
    }
    
    if (env.NEXT_PUBLIC_ENABLE_CSP !== 'true') {
      issues.push('NEXT_PUBLIC_ENABLE_CSP should be true in production');
    }
    
    if (env.NEXT_PUBLIC_ENABLE_SECURITY_HEADERS !== 'true') {
      issues.push('NEXT_PUBLIC_ENABLE_SECURITY_HEADERS should be true in production');
    }
    
    if (!env.SENTRY_DSN) {
      issues.push('SENTRY_DSN should be configured in production for error tracking');
    }
  }
  
  return issues;
}

function loadEnvironmentFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  
  const content = fs.readFileSync(filePath, 'utf8');
  const env = {};
  
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      if (key && valueParts.length > 0) {
        env[key.trim()] = valueParts.join('=').trim();
      }
    }
  }
  
  return env;
}

function main() {
  log('info', 'Starting Chronicle Dashboard environment validation...');
  
  let hasErrors = false;
  const currentDir = process.cwd();
  
  // Check for environment files
  const environmentFiles = [
    '.env.local',
    '.env.development', 
    '.env.staging',
    '.env.production'
  ];
  
  log('info', 'Checking for environment files...');
  
  const foundFiles = [];
  for (const file of environmentFiles) {
    const filePath = path.join(currentDir, file);
    if (fs.existsSync(filePath)) {
      foundFiles.push(file);
      log('success', `Found: ${file}`);
    }
  }
  
  if (foundFiles.length === 0) {
    log('warn', 'No environment files found. Using process.env only.');
  }
  
  // Validate current environment (process.env + .env.local)
  log('info', 'Validating current environment configuration...');
  
  // Load .env.local if it exists
  const envLocalPath = path.join(currentDir, '.env.local');
  const localEnv = loadEnvironmentFile(envLocalPath) || {};
  
  // Merge with process.env (process.env takes precedence)
  const currentEnv = { ...localEnv, ...process.env };
  
  const currentIssues = validateEnvironment(currentEnv);
  
  if (currentIssues.length > 0) {
    log('error', 'Current environment validation failed:');
    for (const issue of currentIssues) {
      log('error', `  - ${issue}`);
    }
    hasErrors = true;
  } else {
    log('success', 'Current environment validation passed');
  }
  
  // Validate environment-specific files
  for (const file of foundFiles) {
    if (file === '.env.local') continue; // Already validated above
    
    log('info', `Validating ${file}...`);
    
    const filePath = path.join(currentDir, file);
    const fileEnv = loadEnvironmentFile(filePath);
    
    if (fileEnv) {
      const issues = validateEnvironment(fileEnv);
      
      if (issues.length > 0) {
        log('error', `${file} validation failed:`);
        for (const issue of issues) {
          log('error', `  - ${issue}`);
        }
        hasErrors = true;
      } else {
        log('success', `${file} validation passed`);
      }
    }
  }
  
  // Security checks
  log('info', 'Running security checks...');
  
  // Check for committed secrets
  const gitignorePath = path.join(currentDir, '.gitignore');
  if (fs.existsSync(gitignorePath)) {
    const gitignore = fs.readFileSync(gitignorePath, 'utf8');
    const protectedFiles = ['.env.local', '.env.production', '.env.staging'];
    
    for (const file of protectedFiles) {
      if (!gitignore.includes(file)) {
        log('warn', `${file} is not in .gitignore - this could lead to secret exposure`);
      }
    }
  } else {
    log('warn', '.gitignore not found - environment files could be committed');
  }
  
  // Check for example/template files with real values
  const templateFiles = ['.env.example', '.env.template'];
  for (const file of templateFiles) {
    const filePath = path.join(currentDir, file);
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf8');
      
      // Check for potential real secrets in template files
      if (content.includes('supabase.co') && !content.includes('your-project')) {
        log('warn', `${file} may contain real Supabase URLs - should use placeholder values`);
      }
      
      if (content.match(/eyJ[A-Za-z0-9]/)) {
        log('warn', `${file} may contain real JWT tokens - should use placeholder values`);
      }
    }
  }
  
  // Final results
  log('info', 'Environment validation complete');
  
  if (hasErrors) {
    log('error', 'Environment validation failed! Please fix the issues above before deployment.');
    process.exit(1);
  } else {
    log('success', 'All environment validations passed!');
    
    // Print summary
    const env = currentEnv.NEXT_PUBLIC_ENVIRONMENT || 'development';
    const supabaseConfigured = !!currentEnv.NEXT_PUBLIC_SUPABASE_URL;
    const sentryConfigured = !!currentEnv.SENTRY_DSN;
    
    console.log('\n' + colors.bold + 'Environment Summary:' + colors.reset);
    console.log(`  Environment: ${colors.blue}${env}${colors.reset}`);
    console.log(`  Supabase: ${supabaseConfigured ? colors.green + 'Configured' : colors.yellow + 'Not configured'}${colors.reset}`);
    console.log(`  Sentry: ${sentryConfigured ? colors.green + 'Configured' : colors.yellow + 'Not configured'}${colors.reset}`);
    
    process.exit(0);
  }
}

if (require.main === module) {
  main();
}