# Chronicle Dashboard Troubleshooting Guide

This guide covers common issues and their solutions when working with the Chronicle Dashboard.

## Quick Diagnostic Commands

Before diving into specific issues, run these commands to get a health check:

```bash
# Validate environment
npm run validate:env

# Check configuration
npm run validate:config

# Run health check
npm run health:check

# Security audit
npm run security:check
```

## Common Issues

### 1. Environment and Configuration Issues

#### Issue: "Missing required environment variables"

**Symptoms:**
- Application fails to start
- Error: `Missing required environment variables: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY`

**Solutions:**

1. **Check your .env.local file exists:**
   ```bash
   ls -la .env.local
   ```

2. **Verify environment variables are set:**
   ```bash
   cat .env.local | grep SUPABASE
   ```

3. **Copy from example if missing:**
   ```bash
   cp .env.example .env.local
   ```

4. **Validate format:**
   ```bash
   npm run validate:env
   ```

**Root Causes:**
- Missing `.env.local` file
- Incorrect variable names (missing `NEXT_PUBLIC_` prefix)
- File permissions issues
- Invalid key formats

#### Issue: "Invalid Supabase URL format"

**Symptoms:**
- Environment validation fails
- Cannot connect to Supabase

**Solutions:**

1. **Check URL format:**
   ```bash
   # Correct format
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   
   # Common mistakes
   NEXT_PUBLIC_SUPABASE_URL=your-project.supabase.co  # Missing https://
   NEXT_PUBLIC_SUPABASE_URL=https://supabase.co      # Missing project ID
   ```

2. **Verify in Supabase dashboard:**
   - Go to Settings > API
   - Copy the "Project URL"

#### Issue: "Invalid JWT token" or "Key appears too short"

**Symptoms:**
- Environment validation fails with key format errors
- Authentication errors

**Solutions:**

1. **Check key format:**
   ```bash
   # Valid JWT should contain dots and be ~300+ characters
   echo $NEXT_PUBLIC_SUPABASE_ANON_KEY | wc -c
   ```

2. **Get correct keys from Supabase:**
   - Go to Settings > API
   - Copy "anon public" key for `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - Copy "service_role" key for `SUPABASE_SERVICE_ROLE_KEY` (optional)

3. **Common mistakes:**
   ```bash
   # Wrong - these are placeholders
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
   NEXT_PUBLIC_SUPABASE_ANON_KEY=example-key
   
   # Right - actual JWT token
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

### 2. Database and Supabase Issues

#### Issue: "Table 'chronicle_sessions' doesn't exist"

**Symptoms:**
- Database queries fail
- Error in browser console about missing tables

**Solutions:**

1. **Check if tables exist in Supabase:**
   ```sql
   -- Run in Supabase SQL Editor
   SELECT table_name FROM information_schema.tables 
   WHERE table_schema = 'public' 
   AND table_name IN ('chronicle_sessions', 'chronicle_events');
   ```

2. **Create missing tables:**
   See the [Database Setup](SETUP.md#database-setup) section in SETUP.md for complete SQL scripts.

3. **Verify table structure:**
   ```sql
   -- Check chronicle_sessions structure
   \d chronicle_sessions;
   
   -- Check chronicle_events structure  
   \d chronicle_events;
   ```

#### Issue: "Row Level Security policy violation"

**Symptoms:**
- Data queries return empty results
- 403 errors in network tab
- "new row violates row-level security policy"

**Solutions:**

1. **Check RLS policies:**
   ```sql
   -- List policies
   SELECT schemaname, tablename, policyname, cmd, qual 
   FROM pg_policies 
   WHERE tablename IN ('chronicle_sessions', 'chronicle_events');
   ```

2. **Create missing policies:**
   ```sql
   -- Basic read policy
   CREATE POLICY "Allow read access" ON chronicle_sessions 
   FOR SELECT USING (auth.role() = 'authenticated');
   
   CREATE POLICY "Allow read access" ON chronicle_events 
   FOR SELECT USING (auth.role() = 'authenticated');
   ```

3. **Temporarily disable RLS for testing:**
   ```sql
   -- CAUTION: Only for local development
   ALTER TABLE chronicle_sessions DISABLE ROW LEVEL SECURITY;
   ALTER TABLE chronicle_events DISABLE ROW LEVEL SECURITY;
   ```

#### Issue: "Real-time subscriptions not working"

**Symptoms:**
- Dashboard doesn't update automatically
- No live event feeds
- Connection status shows "disconnected"

**Solutions:**

1. **Check real-time publication:**
   ```sql
   -- Verify tables are in publication
   SELECT schemaname, tablename FROM pg_publication_tables 
   WHERE pubname = 'supabase_realtime';
   ```

2. **Add tables to publication:**
   ```sql
   ALTER PUBLICATION supabase_realtime ADD TABLE chronicle_sessions;
   ALTER PUBLICATION supabase_realtime ADD TABLE chronicle_events;
   ```

3. **Check browser network tab:**
   - Look for WebSocket connections
   - Verify no CORS errors

4. **Environment variable:**
   ```bash
   NEXT_PUBLIC_ENABLE_REALTIME=true
   ```

### 3. Development and Build Issues

#### Issue: "Module not found" errors

**Symptoms:**
- TypeScript compilation errors
- Import statements failing

**Solutions:**

1. **Clear node_modules and reinstall:**
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```

2. **Check TypeScript configuration:**
   ```bash
   npx tsc --noEmit
   ```

3. **Verify import paths:**
   ```typescript
   // Correct - using @ alias
   import { config } from '@/lib/config';
   
   // Incorrect - relative paths might break
   import { config } from '../../../lib/config';
   ```

#### Issue: "Next.js build failures"

**Symptoms:**
- `npm run build` fails
- TypeScript errors during build
- Memory issues

**Solutions:**

1. **Check for TypeScript errors:**
   ```bash
   npx tsc --noEmit
   ```

2. **Clear Next.js cache:**
   ```bash
   rm -rf .next
   npm run build
   ```

3. **Memory issues:**
   ```bash
   # Increase Node.js memory limit
   NODE_OPTIONS="--max-old-space-size=4096" npm run build
   ```

4. **Check environment variables:**
   ```bash
   npm run validate:env
   ```

#### Issue: "Tests failing"

**Symptoms:**
- Jest tests fail unexpectedly
- Mocking issues
- Timeout errors

**Solutions:**

1. **Run tests with verbose output:**
   ```bash
   npm run test -- --verbose
   ```

2. **Check test environment:**
   ```bash
   # Ensure jest setup file exists
   ls -la jest.setup.js
   ```

3. **Clear Jest cache:**
   ```bash
   npx jest --clearCache
   npm run test
   ```

4. **Run specific test file:**
   ```bash
   npm run test -- EventCard.test.tsx
   ```

### 4. Performance Issues

#### Issue: "Slow page loads"

**Symptoms:**
- Dashboard takes long to load
- Slow API responses
- High memory usage

**Solutions:**

1. **Check bundle size:**
   ```bash
   npm run build:analyze
   ```

2. **Profile with Chrome DevTools:**
   - Open DevTools (F12)
   - Go to Performance tab
   - Record page load

3. **Reduce event display limit:**
   ```bash
   # In .env.local
   NEXT_PUBLIC_MAX_EVENTS_DISPLAY=100
   ```

4. **Check network requests:**
   - Open Network tab in DevTools
   - Look for slow Supabase queries

#### Issue: "Memory leaks"

**Symptoms:**
- Browser tab uses excessive memory
- Dashboard becomes unresponsive over time

**Solutions:**

1. **Check for uncleaned subscriptions:**
   ```typescript
   // Ensure cleanup in useEffect
   useEffect(() => {
     const subscription = supabase
       .channel('events')
       .on('postgres_changes', handler)
       .subscribe();
     
     return () => {
       subscription.unsubscribe();
     };
   }, []);
   ```

2. **Profile memory usage:**
   - Chrome DevTools > Memory tab
   - Take heap snapshots
   - Look for detached DOM nodes

3. **Check component unmounting:**
   ```typescript
   // Add cleanup for timeouts/intervals
   useEffect(() => {
     const timer = setInterval(fetchData, 5000);
     return () => clearInterval(timer);
   }, []);
   ```

### 5. Production Deployment Issues

#### Issue: "Environment variables not available in production"

**Symptoms:**
- App works locally but fails in production
- Missing environment variables error

**Solutions:**

1. **Check deployment platform:**
   ```bash
   # Vercel
   vercel env ls
   
   # Netlify
   netlify env:list
   ```

2. **Ensure `NEXT_PUBLIC_` prefix:**
   ```bash
   # Client-side variables MUST have NEXT_PUBLIC_ prefix
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   ```

3. **Verify build-time vs runtime:**
   - Environment variables with `NEXT_PUBLIC_` are embedded at build time
   - Server-side variables are available at runtime

#### Issue: "CORS errors in production"

**Symptoms:**
- API calls blocked by CORS policy
- Network errors in browser console

**Solutions:**

1. **Configure Supabase CORS:**
   - Go to Authentication > Settings
   - Add your production domain to "Site URL"

2. **Check deployment domain:**
   ```bash
   # Ensure your domain is correctly configured
   # In Supabase: Settings > API > Configuration
   ```

## Debugging Tools and Techniques

### Browser DevTools

#### Console Debugging

1. **Enable debug mode:**
   ```bash
   NEXT_PUBLIC_DEBUG=true
   ```

2. **Check console logs:**
   - Open DevTools Console (F12)
   - Look for Chronicle debug messages
   - Filter by "Chronicle" to see app-specific logs

#### Network Analysis

1. **Monitor API calls:**
   - Network tab in DevTools
   - Filter by "supabase.co"
   - Check request/response details

2. **WebSocket connections:**
   - Look for WS connections to Supabase
   - Check connection status and messages

#### Performance Profiling

1. **Performance tab:**
   - Record page interactions
   - Identify slow operations
   - Check for memory leaks

2. **Lighthouse audit:**
   - Run performance audit
   - Check accessibility and best practices

### Application-Level Debugging

#### Component State Debugging

1. **React DevTools:**
   ```bash
   # Install React DevTools browser extension
   # Inspect component state and props
   ```

2. **Add debug logging:**
   ```typescript
   import { configUtils } from '@/lib/config';
   
   if (configUtils.isDebugEnabled()) {
     console.log('Component state:', state);
   }
   ```

#### Database Query Debugging

1. **Enable Supabase logging:**
   ```typescript
   // In development
   const supabase = createClient(url, key, {
     auth: { debug: true }
   });
   ```

2. **Log query performance:**
   ```typescript
   const start = performance.now();
   const { data, error } = await supabase
     .from('chronicle_events')
     .select('*');
   console.log(`Query took ${performance.now() - start}ms`);
   ```

## Testing Locally with Mock Data

### Using Mock Data

1. **Enable demo mode:**
   ```typescript
   // Access via /demo endpoint
   // Uses mockData.ts for testing
   ```

2. **Generate test events:**
   ```bash
   # Check src/lib/mockData.ts for sample data
   # Use demo dashboard for isolated testing
   ```

### Integration Testing

1. **Test database connection:**
   ```bash
   npm run health:check
   ```

2. **Test real-time features:**
   ```bash
   # Open multiple browser tabs
   # Insert data in Supabase dashboard
   # Verify live updates
   ```

## Environment-Specific Issues

### Development Environment

**Common Issues:**
- Hot reload not working
- Turbopack errors
- Type checking delays

**Solutions:**
```bash
# Restart dev server
npm run dev

# Clear Next.js cache
rm -rf .next

# Disable Turbopack if problematic
npm run dev -- --no-turbo
```

### Staging Environment

**Common Issues:**
- Environment variable mismatches
- Build optimization conflicts

**Solutions:**
```bash
# Use staging-specific build
npm run build:staging

# Validate staging config
NEXT_PUBLIC_ENVIRONMENT=staging npm run validate:env
```

### Production Environment

**Common Issues:**
- Security headers blocking features
- CSP violations
- Rate limiting

**Solutions:**
```bash
# Check security settings
NEXT_PUBLIC_ENABLE_CSP=false  # Temporarily for debugging
NEXT_PUBLIC_ENABLE_SECURITY_HEADERS=false

# Monitor error tracking
# Check Sentry dashboard if configured
```

## Getting Additional Help

### Log Analysis

1. **Browser Console Logs:**
   - Chronicle debug messages
   - React error boundaries
   - Network request failures

2. **Server-Side Logs:**
   - Next.js build logs
   - API route errors
   - Environment validation output

3. **Supabase Logs:**
   - Database query logs
   - Real-time connection logs
   - Authentication errors

### Health Check Script

Run the comprehensive health check:

```bash
npm run health:check
```

This script validates:
- Environment configuration
- Database connectivity
- Real-time subscriptions
- API accessibility

### Support Resources

- **Configuration Validation**: `npm run validate:config`
- **Security Audit**: `npm run security:check`
- **Performance Tests**: Check `/test/performance/`
- **Setup Guide**: See `SETUP.md`
- **Code Style Guide**: See `CODESTYLE.md`

---

If you encounter issues not covered in this guide, check the browser console for specific error messages and run the diagnostic commands listed at the top of this document.