#!/usr/bin/env node

/**
 * Chronicle Dashboard Health Check Script
 * Verifies deployment health and service connectivity
 */

const http = require('http');
const https = require('https');
const { URL } = require('url');

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

function makeRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const client = urlObj.protocol === 'https:' ? https : http;
    
    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: options.headers || {},
      timeout: options.timeout || 10000,
      ...options
    };
    
    const req = client.request(requestOptions, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data: data,
          responseTime: Date.now() - startTime
        });
      });
    });
    
    const startTime = Date.now();
    
    req.on('error', (error) => {
      reject({
        error: error.message,
        code: error.code,
        responseTime: Date.now() - startTime
      });
    });
    
    req.on('timeout', () => {
      req.destroy();
      reject({
        error: 'Request timeout',
        code: 'TIMEOUT',
        responseTime: Date.now() - startTime
      });
    });
    
    if (options.body) {
      req.write(options.body);
    }
    
    req.end();
  });
}

async function checkSupabaseConnection() {
  log('info', 'Checking Supabase connection...');
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseKey) {
    log('warn', 'Supabase configuration not found, skipping connection test');
    return { success: false, reason: 'Not configured' };
  }
  
  try {
    const response = await makeRequest(`${supabaseUrl}/rest/v1/`, {
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'User-Agent': 'Chronicle-Health-Check/1.0'
      },
      timeout: 15000
    });
    
    if (response.statusCode === 200) {
      log('success', `Supabase connection successful (${response.responseTime}ms)`);
      return { success: true, responseTime: response.responseTime };
    } else {
      log('error', `Supabase connection failed: HTTP ${response.statusCode}`);
      return { success: false, reason: `HTTP ${response.statusCode}`, responseTime: response.responseTime };
    }
  } catch (error) {
    log('error', `Supabase connection failed: ${error.error || error.message}`);
    return { success: false, reason: error.error || error.message, responseTime: error.responseTime };
  }
}

async function checkSupabaseHealth() {
  log('info', 'Checking Supabase service health...');
  
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  
  if (!supabaseUrl) {
    return { success: false, reason: 'Not configured' };
  }
  
  try {
    // Check if we can reach the Supabase status endpoint
    const statusUrl = supabaseUrl.replace(/^https:\/\/[^.]+/, 'https://status');
    
    const response = await makeRequest(`${supabaseUrl}/rest/v1/`, {
      method: 'HEAD',
      timeout: 10000
    });
    
    if (response.statusCode < 500) {
      log('success', `Supabase service health check passed (${response.responseTime}ms)`);
      return { success: true, responseTime: response.responseTime };
    } else {
      log('warn', `Supabase service may be experiencing issues: HTTP ${response.statusCode}`);
      return { success: false, reason: `HTTP ${response.statusCode}`, responseTime: response.responseTime };
    }
  } catch (error) {
    log('warn', `Supabase health check failed: ${error.error || error.message}`);
    return { success: false, reason: error.error || error.message, responseTime: error.responseTime };
  }
}

async function checkSentryConnection() {
  log('info', 'Checking Sentry connection...');
  
  const sentryDsn = process.env.SENTRY_DSN;
  
  if (!sentryDsn) {
    log('info', 'Sentry DSN not configured, skipping connection test');
    return { success: false, reason: 'Not configured' };
  }
  
  try {
    // Parse Sentry DSN to extract the endpoint
    const dsnUrl = new URL(sentryDsn);
    const projectId = dsnUrl.pathname.slice(1); // Remove leading slash
    const sentryHost = dsnUrl.host;
    
    // Test Sentry store endpoint
    const storeUrl = `https://${sentryHost}/api/${projectId}/store/`;
    
    const testPayload = JSON.stringify({
      message: 'Chronicle Health Check',
      level: 'info',
      platform: 'node',
      timestamp: new Date().toISOString(),
      tags: {
        component: 'health-check'
      }
    });
    
    const response = await makeRequest(storeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Sentry-Auth': `Sentry sentry_version=7, sentry_client=chronicle-health-check/1.0, sentry_key=${dsnUrl.username}`,
        'User-Agent': 'Chronicle-Health-Check/1.0'
      },
      body: testPayload,
      timeout: 15000
    });
    
    if (response.statusCode === 200 || response.statusCode === 202) {
      log('success', `Sentry connection successful (${response.responseTime}ms)`);
      return { success: true, responseTime: response.responseTime };
    } else {
      log('warn', `Sentry connection test returned: HTTP ${response.statusCode}`);
      return { success: false, reason: `HTTP ${response.statusCode}`, responseTime: response.responseTime };
    }
  } catch (error) {
    log('warn', `Sentry connection test failed: ${error.error || error.message}`);
    return { success: false, reason: error.error || error.message, responseTime: error.responseTime };
  }
}

async function checkApplicationHealth() {
  log('info', 'Checking application health...');
  
  // Check if this is running in a deployed environment
  const appUrl = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` :
                 process.env.NETLIFY_URL ? process.env.NETLIFY_URL :
                 process.env.APP_URL || 'http://localhost:3000';
  
  try {
    // Try to check the application health endpoint
    const response = await makeRequest(`${appUrl}/api/health`, {
      headers: {
        'User-Agent': 'Chronicle-Health-Check/1.0'
      },
      timeout: 10000
    });
    
    if (response.statusCode === 200) {
      try {
        const data = JSON.parse(response.data);
        log('success', `Application health check passed (${response.responseTime}ms)`);
        log('info', `App version: ${data.version || 'unknown'}, Environment: ${data.environment || 'unknown'}`);
        return { success: true, responseTime: response.responseTime, data };
      } catch (parseError) {
        log('warn', 'Health endpoint returned non-JSON response');
        return { success: true, responseTime: response.responseTime };
      }
    } else {
      log('warn', `Application health check returned: HTTP ${response.statusCode}`);
      return { success: false, reason: `HTTP ${response.statusCode}`, responseTime: response.responseTime };
    }
  } catch (error) {
    log('info', `Application health check skipped: ${error.error || error.message}`);
    return { success: false, reason: 'Not available', responseTime: error.responseTime };
  }
}

async function checkDependencies() {
  log('info', 'Checking dependency status...');
  
  const dependencies = [];
  
  // Check Node.js version
  const nodeVersion = process.version;
  const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);
  
  if (majorVersion >= 18) {
    dependencies.push({ name: 'Node.js', version: nodeVersion, status: 'ok' });
  } else {
    dependencies.push({ name: 'Node.js', version: nodeVersion, status: 'warning', issue: 'Version < 18' });
  }
  
  // Check required environment variables
  const requiredEnvVars = [
    'NEXT_PUBLIC_ENVIRONMENT',
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY'
  ];
  
  let envStatus = 'ok';
  let missingVars = [];
  
  for (const envVar of requiredEnvVars) {
    if (!process.env[envVar]) {
      missingVars.push(envVar);
      envStatus = 'error';
    }
  }
  
  dependencies.push({
    name: 'Environment Variables',
    status: envStatus,
    issue: missingVars.length > 0 ? `Missing: ${missingVars.join(', ')}` : null
  });
  
  // Log dependency status
  for (const dep of dependencies) {
    const statusColor = dep.status === 'ok' ? 'success' : dep.status === 'warning' ? 'warn' : 'error';
    const version = dep.version ? ` (${dep.version})` : '';
    const issue = dep.issue ? ` - ${dep.issue}` : '';
    
    log(statusColor, `${dep.name}${version}: ${dep.status.toUpperCase()}${issue}`);
  }
  
  return dependencies;
}

async function main() {
  log('info', 'Starting Chronicle Dashboard health check...');
  
  const startTime = Date.now();
  const results = {
    timestamp: new Date().toISOString(),
    environment: process.env.NEXT_PUBLIC_ENVIRONMENT || 'unknown',
    checks: {}
  };
  
  try {
    // Check dependencies
    log('info', '=== Dependency Check ===');
    const dependencies = await checkDependencies();
    results.checks.dependencies = dependencies;
    
    // Check Supabase connection
    log('info', '=== Supabase Connection Check ===');
    const supabaseConnection = await checkSupabaseConnection();
    results.checks.supabaseConnection = supabaseConnection;
    
    // Check Supabase health
    const supabaseHealth = await checkSupabaseHealth();
    results.checks.supabaseHealth = supabaseHealth;
    
    // Check Sentry connection
    log('info', '=== Sentry Connection Check ===');
    const sentryConnection = await checkSentryConnection();
    results.checks.sentryConnection = sentryConnection;
    
    // Check application health
    log('info', '=== Application Health Check ===');
    const appHealth = await checkApplicationHealth();
    results.checks.applicationHealth = appHealth;
    
  } catch (error) {
    log('error', `Health check failed: ${error.message}`);
    results.error = error.message;
  }
  
  const totalTime = Date.now() - startTime;
  results.totalTime = totalTime;
  
  // Summary
  log('info', '=== Health Check Summary ===');
  
  const criticalChecks = ['supabaseConnection'];
  const warningChecks = ['sentryConnection', 'applicationHealth'];
  
  let hasErrors = false;
  let hasWarnings = false;
  
  for (const [checkName, result] of Object.entries(results.checks)) {
    if (result && typeof result === 'object' && 'success' in result) {
      if (!result.success) {
        if (criticalChecks.includes(checkName)) {
          log('error', `CRITICAL: ${checkName} failed - ${result.reason}`);
          hasErrors = true;
        } else if (warningChecks.includes(checkName)) {
          log('warn', `WARNING: ${checkName} failed - ${result.reason}`);
          hasWarnings = true;
        }
      } else {
        log('success', `${checkName} passed`);
      }
    }
  }
  
  // Check dependency issues
  if (results.checks.dependencies) {
    const failedDeps = results.checks.dependencies.filter(dep => dep.status === 'error');
    const warningDeps = results.checks.dependencies.filter(dep => dep.status === 'warning');
    
    if (failedDeps.length > 0) {
      hasErrors = true;
    }
    if (warningDeps.length > 0) {
      hasWarnings = true;
    }
  }
  
  // Final status
  console.log('\n' + colors.bold + '=== FINAL RESULTS ===' + colors.reset);
  console.log(`Total time: ${totalTime}ms`);
  console.log(`Environment: ${colors.blue}${results.environment}${colors.reset}`);
  
  if (hasErrors) {
    log('error', 'Health check FAILED - Critical issues detected');
    console.log('\n' + colors.red + colors.bold + 'DEPLOYMENT NOT RECOMMENDED' + colors.reset);
    process.exit(1);
  } else if (hasWarnings) {
    log('warn', 'Health check PASSED with warnings');
    console.log('\n' + colors.yellow + colors.bold + 'DEPLOYMENT OK - Monitor warnings' + colors.reset);
    process.exit(0);
  } else {
    log('success', 'Health check PASSED - All systems operational');
    console.log('\n' + colors.green + colors.bold + 'DEPLOYMENT READY' + colors.reset);
    process.exit(0);
  }
}

if (require.main === module) {
  main().catch(error => {
    log('error', `Health check script failed: ${error.message}`);
    process.exit(1);
  });
}