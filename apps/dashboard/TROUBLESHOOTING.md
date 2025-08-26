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

### 5. Known Issues from S01-S05 Development

These are specific issues encountered during the dashboard redesign sprints (CHR-25.S01-S05).

#### Issue: Tool names showing as "null" or "Unknown Tool"

**Symptoms:**
- Event feed displays "Unknown Tool" for pre_tool_use and post_tool_use events
- Tool names appear as null in the event details
- Event type column shows "(null)" after event type

**Root Causes:**
- Tool name is stored in different metadata fields across events
- Some events have tool_name in event.tool_name, others in metadata.tool_name
- Database schema inconsistencies between old and new event formats

**Solutions:**

1. **Check the event data structure:**
   ```typescript
   // EventRow component tries multiple fallback paths:
   const toolName = event.tool_name || 
                    event.metadata?.tool_name || 
                    event.metadata?.tool_input?.tool_name || 
                    'Unknown Tool';
   ```

2. **Verify database data:**
   ```sql
   -- Check tool name locations in your events
   SELECT 
     event_type,
     tool_name,
     metadata->>'tool_name' as metadata_tool_name,
     metadata->'tool_input'->>'tool_name' as tool_input_name
   FROM chronicle_events 
   WHERE event_type IN ('pre_tool_use', 'post_tool_use')
   LIMIT 10;
   ```

3. **Fix data inconsistencies:**
   ```sql
   -- Update events where tool_name is null but exists in metadata
   UPDATE chronicle_events 
   SET tool_name = metadata->>'tool_name'
   WHERE tool_name IS NULL 
   AND metadata->>'tool_name' IS NOT NULL;
   ```

#### Issue: Sessions incorrectly marked as completed (CHR-87)

**Symptoms:**
- Sessions show as "completed" when they should be active
- Session status indicators showing wrong state
- Race conditions during session updates

**Root Causes:**
- Manual updateSessionEndTimes() bypassed database trigger validation
- Race condition between manual updates and database-managed end_time
- Multiple components trying to update session state simultaneously

**Solutions:**

1. **Remove manual session end time updates:**
   ```typescript
   // REMOVED: Manual session end time management
   // Sessions now rely on database-managed end_time only
   // See fix in CHR-87 commit df8e91b
   ```

2. **Check session status logic:**
   ```typescript
   // Sessions are active if end_time is null
   const isActive = session.end_time === null;
   ```

3. **Verify database triggers:**
   ```sql
   -- Ensure database triggers are managing session lifecycle
   SELECT trigger_name, event_manipulation, action_statement
   FROM information_schema.triggers
   WHERE event_object_table = 'chronicle_sessions';
   ```

#### Issue: Event feed not updating in real-time

**Symptoms:**
- Dashboard doesn't show new events automatically
- Connection status shows "disconnected"  
- Events only appear after page refresh

**Root Causes:**
- WebSocket connection failures to Supabase realtime
- Tables not added to realtime publication
- Cleanup issues with subscription handlers

**Solutions:**

1. **Check WebSocket connection in DevTools:**
   - Open Network tab
   - Look for WebSocket connection to Supabase
   - Check for connection errors or failures

2. **Verify realtime publication:**
   ```sql
   -- Check if tables are published for realtime
   SELECT schemaname, tablename FROM pg_publication_tables 
   WHERE pubname = 'supabase_realtime';
   
   -- Add tables if missing
   ALTER PUBLICATION supabase_realtime ADD TABLE chronicle_sessions;
   ALTER PUBLICATION supabase_realtime ADD TABLE chronicle_events;
   ```

3. **Check subscription cleanup:**
   ```typescript
   // Ensure proper cleanup in useEvents hook
   useEffect(() => {
     const subscription = supabase
       .channel('events')
       .on('postgres_changes', handler)
       .subscribe();
     
     return () => {
       subscription.unsubscribe(); // Critical for preventing leaks
     };
   }, []);
   ```

#### Issue: High memory usage with many events

**Symptoms:**
- Browser tab consuming excessive memory (>500MB)
- Dashboard becomes sluggish over time
- Performance degrades with large event counts

**Root Causes:**
- Large event arrays kept in memory
- Subscription handlers not properly cleaned up
- Virtual scrolling not implemented for large lists

**Solutions:**

1. **Limit displayed events:**
   ```bash
   # In .env.local - reduce event display limit
   NEXT_PUBLIC_MAX_EVENTS_DISPLAY=500
   ```

2. **Check for memory leaks:**
   ```typescript
   // Use Chrome DevTools Memory tab
   // Look for detached DOM nodes
   // Profile heap snapshots before/after operations
   ```

3. **Monitor performance:**
   ```typescript
   // Use the built-in performance monitor
   import { PerformanceMonitor } from '@/lib/performanceMonitor';
   
   // Check metrics in development
   console.log('Memory usage:', PerformanceMonitor.getMemoryMetrics());
   ```

#### Issue: Sidebar collapse state not persisting

**Symptoms:**
- Sidebar resets to expanded on page refresh
- User preferences not saved between sessions
- Layout state lost after navigation

**Root Causes:**
- Local storage not properly accessed in SSR
- Storage keys not consistent across components
- Race conditions during initial load

**Solutions:**

1. **Check storage implementation:**
   ```typescript
   // layoutPersistence.ts handles sidebar state
   import { saveSidebarCollapsed, getSidebarCollapsed } from '@/lib/layoutPersistence';
   
   // Save state on toggle
   const handleToggle = (collapsed: boolean) => {
     saveSidebarCollapsed(collapsed);
   };
   ```

2. **Debug storage issues:**
   ```typescript
   // Check if localStorage is available
   if (typeof window !== 'undefined' && window.localStorage) {
     console.log('Sidebar state:', localStorage.getItem('chronicle-sidebar-collapsed'));
   }
   ```

3. **Verify SSR compatibility:**
   ```typescript
   // Use useEffect to avoid SSR hydration issues
   useEffect(() => {
     const saved = getSidebarCollapsed();
     setSidebarCollapsed(saved);
   }, []);
   ```

#### Issue: Event feed data loading race condition (CHR-82)

**Symptoms:**
- Event feed shows empty when data exists
- "No events" message when events should be displayed
- Initial load shows loading state indefinitely

**Root Causes:**
- Length checks prevented empty arrays from being processed
- Components rejecting valid empty initial states
- Race condition between data fetching and component mounting

**Solutions:**

1. **Remove problematic length checks:**
   ```typescript
   // FIXED: Allow empty arrays to be processed
   // Components should handle empty states gracefully
   if (events !== undefined) { // Don't check length
     processEvents(events);
   }
   ```

2. **Check DashboardLayout data flow:**
   ```typescript
   // Ensure store updates even with 0 events initially
   // This allows progressive loading to work correctly
   ```

3. **Add debug logging:**
   ```typescript
   if (process.env.NODE_ENV === 'development') {
     console.log('Event feed data flow:', {
       eventsReceived: events?.length || 0,
       storeState: store.getState(),
       componentMounted: isMounted
     });
   }
   ```

### 6. Production Deployment Issues

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

## Advanced Debugging Techniques

### State Management Debugging

#### Zustand Store Inspection

1. **Install Redux DevTools Extension:**
   - Add to your browser for Zustand debugging
   - Provides state history and time-travel debugging

2. **Debug store state:**
   ```typescript
   // Add to any component for store debugging
   import { useDashboardStore } from '@/stores/dashboardStore';
   
   const Dashboard = () => {
     const store = useDashboardStore();
     
     // Debug current state
     useEffect(() => {
       console.log('Dashboard store state:', {
         events: store.events.length,
         sessions: store.sessions.length,
         filters: store.filters,
         ui: store.ui
       });
     });
   ```

3. **Monitor store updates:**
   ```typescript
   // Subscribe to specific store changes
   const unsubscribe = useDashboardStore.subscribe(
     (state) => state.events,
     (events) => console.log('Events updated:', events.length)
   );
   
   // Cleanup subscription
   useEffect(() => () => unsubscribe(), []);
   ```

#### Session State Debugging

1. **Check session lifecycle:**
   ```sql
   -- Monitor session state changes in real-time
   SELECT 
     session_id,
     start_time,
     end_time,
     CASE 
       WHEN end_time IS NULL THEN 'ACTIVE'
       ELSE 'COMPLETED'
     END as status,
     project_path,
     git_branch
   FROM chronicle_sessions 
   ORDER BY start_time DESC 
   LIMIT 10;
   ```

2. **Debug session filtering:**
   ```typescript
   // Check if sessions are being filtered incorrectly
   const debugSessionFilters = (sessions: Session[], filters: FilterState) => {
     console.log('Session filter debug:', {
       totalSessions: sessions.length,
       activeFilter: filters.sessionStatus,
       filteredCount: sessions.filter(s => 
         filters.sessionStatus === 'all' || 
         (filters.sessionStatus === 'active' && !s.end_time) ||
         (filters.sessionStatus === 'completed' && s.end_time)
       ).length
     });
   };
   ```

### Real-time Connection Debugging

#### WebSocket Connection Monitoring

1. **Check connection state:**
   ```typescript
   // Monitor Supabase realtime connection
   const channel = supabase.channel('debug');
   
   channel
     .on('presence', { event: 'sync' }, () => {
       console.log('Realtime sync');
     })
     .on('presence', { event: 'join' }, ({ key, newPresences }) => {
       console.log('Realtime join:', key);
     })
     .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
       console.log('Realtime leave:', key);
     })
     .subscribe();
   ```

2. **Debug subscription failures:**
   ```typescript
   // Check for subscription errors
   const subscription = supabase
     .channel('events-debug')
     .on('postgres_changes', { 
       event: '*', 
       schema: 'public', 
       table: 'chronicle_events' 
     }, payload => {
       console.log('Realtime event:', payload);
     })
     .on('system', {}, payload => {
       console.log('System message:', payload);
     })
     .subscribe((status, err) => {
       console.log('Subscription status:', status);
       if (err) console.error('Subscription error:', err);
     });
   ```

### Performance Debugging

#### Component Render Profiling

1. **Use React Profiler:**
   ```typescript
   import { Profiler } from 'react';
   
   const onRenderCallback = (id, phase, actualDuration) => {
     console.log('Render Profile:', {
       component: id,
       phase,
       duration: actualDuration
     });
   };
   
   <Profiler id="EventFeed" onRender={onRenderCallback}>
     <EventFeed events={events} />
   </Profiler>
   ```

2. **Memory usage monitoring:**
   ```typescript
   // Check memory usage periodically
   const monitorMemory = () => {
     if ('memory' in performance) {
       console.log('Memory:', {
         used: Math.round((performance as any).memory.usedJSHeapSize / 1048576) + 'MB',
         total: Math.round((performance as any).memory.totalJSHeapSize / 1048576) + 'MB',
         limit: Math.round((performance as any).memory.jsHeapSizeLimit / 1048576) + 'MB'
       });
     }
   };
   
   // Run every 10 seconds
   useEffect(() => {
     const interval = setInterval(monitorMemory, 10000);
     return () => clearInterval(interval);
   }, []);
   ```

3. **Database query performance:**
   ```typescript
   // Wrapper to time Supabase queries
   const timedQuery = async (queryFn: () => Promise<any>, queryName: string) => {
     const start = performance.now();
     try {
       const result = await queryFn();
       const duration = performance.now() - start;
       
       console.log(`Query "${queryName}" took ${duration.toFixed(2)}ms`);
       
       if (duration > 1000) {
         console.warn(`Slow query detected: ${queryName} (${duration.toFixed(2)}ms)`);
       }
       
       return result;
     } catch (error) {
       console.error(`Query "${queryName}" failed:`, error);
       throw error;
     }
   };
   
   // Usage
   const { data, error } = await timedQuery(
     () => supabase.from('chronicle_events').select('*').limit(100),
     'fetch-recent-events'
   );
   ```

### Error Boundary Debugging

#### Enhanced Error Reporting

1. **Add error context:**
   ```typescript
   // Custom error boundary with additional context
   export const DebuggingErrorBoundary: React.FC<{ children: ReactNode }> = ({ children }) => {
     const handleError = (error: Error, errorInfo: ErrorInfo) => {
       const errorReport = {
         error: error.message,
         stack: error.stack,
         componentStack: errorInfo.componentStack,
         userAgent: navigator.userAgent,
         url: window.location.href,
         timestamp: new Date().toISOString(),
         storeState: useDashboardStore.getState() // Capture current state
       };
       
       console.error('Enhanced Error Report:', errorReport);
       
       // Send to error tracking service
       // analytics.track('dashboard_error', errorReport);
     };
   ```

2. **Common error patterns:**
   ```typescript
   // Check for common error scenarios
   const validateEventData = (events: Event[]) => {
     events.forEach((event, index) => {
       if (!event.session_id) {
         console.warn(`Event ${index} missing session_id:`, event);
       }
       if (!event.timestamp) {
         console.warn(`Event ${index} missing timestamp:`, event);
       }
       if (event.event_type === 'pre_tool_use' && !event.tool_name && !event.metadata?.tool_name) {
         console.warn(`Event ${index} missing tool name:`, event);
       }
     });
   };
   ```

### Browser Extension Recommendations

#### Essential Development Extensions

1. **React Developer Tools:**
   - Inspect component state and props
   - Profile component render performance
   - Debug hooks and context

2. **Redux DevTools (works with Zustand):**
   - Time-travel debugging
   - Action history
   - State diff visualization

3. **Supabase DevTools (if available):**
   - Monitor realtime connections
   - Debug queries and subscriptions
   - Authentication state inspection

4. **Performance monitoring:**
   - Lighthouse for performance audits
   - Web Vitals extension for core metrics
   - Memory tab in Chrome DevTools

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

## Quick Error Reference

### Common Error Messages and Solutions

| Error Message | Likely Cause | Quick Fix |
|---------------|-------------|-----------|
| "null is not an object (evaluating 'event.tool_name')" | Event data malformed | Check EventRow component fallback logic |
| "Cannot read property 'length' of undefined" | Events array is undefined | Add null/undefined checks in components |
| "WebSocket connection failed" | Realtime subscription issue | Check Supabase realtime config and publication |
| "Row Level Security policy violation" | Missing RLS policies | Create or update database policies |
| "Invalid JWT token" | Wrong Supabase keys | Verify API keys in .env.local |
| "Module not found: '@/components/...'" | Path alias not working | Check tsconfig.json baseUrl and paths |
| "Hydration failed" | SSR/client mismatch | Use useEffect for client-only state |
| "Memory usage exceeded" | Memory leak | Check subscription cleanup and event limits |
| "Session marked as completed prematurely" | Race condition in session updates | Verify database triggers are handling end_time |

### Performance Warning Thresholds

- **Memory Usage**: >500MB indicates potential leak
- **Render Time**: >16ms causes frame drops  
- **Database Query**: >1000ms is considered slow
- **Bundle Size**: >2MB affects load time
- **Event Count**: >1000 events may cause performance issues

### Emergency Reset Commands

If the dashboard is completely broken:

```bash
# 1. Reset environment
cp .env.example .env.local
npm run validate:env

# 2. Clear all caches
rm -rf .next node_modules package-lock.json
npm install

# 3. Reset database tables (CAUTION: Destroys data)
# Only run this if you need to start fresh
npm run db:reset  # If this script exists

# 4. Clear browser storage
# Open DevTools > Application > Storage > Clear All
```

---

If you encounter issues not covered in this guide, check the browser console for specific error messages and run the diagnostic commands listed at the top of this document.