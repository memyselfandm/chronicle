# Chronicle Dashboard Code Style Guide

## Purpose
This guide documents coding patterns and conventions for the Chronicle Dashboard to ensure consistency, especially when multiple agents work in parallel on different features.

## 1. Type Management

### ✅ DO: Define Shared Types Once
```typescript
// src/types/connection.ts
export type ConnectionState = 'connected' | 'connecting' | 'disconnected' | 'error';
export interface ConnectionStatus {
  state: ConnectionState;
  lastUpdate: Date | null;
  // ... other properties
}
```

### ❌ DON'T: Duplicate Type Definitions
```typescript
// Bad: Same type defined in multiple files
// components/ConnectionStatus.tsx
export type ConnectionState = 'connected' | 'connecting' | 'disconnected' | 'error';

// hooks/useSupabaseConnection.ts  
export type ConnectionState = 'connected' | 'connecting' | 'disconnected' | 'error';
```

### Best Practice
- Place shared types in `/src/types/` directory
- Import from single source: `import { ConnectionState } from '@/types/connection';`
- Use TypeScript's type system to catch inconsistencies

## 2. React Patterns & Performance

### Stable Function References
```typescript
// ✅ GOOD: Stable function reference
const formatLastUpdate = useCallback((timestamp: Date | string | null) => {
  if (!timestamp) return 'Never';
  // ... formatting logic
}, []); // Empty deps if function doesn't use external values

// ❌ BAD: Function recreated every render
const formatLastUpdate = (timestamp: Date | string | null) => {
  if (!timestamp) return 'Never';
  // ... formatting logic
};
```

### useEffect Dependencies
```typescript
// ✅ GOOD: Use refs for values that shouldn't trigger re-renders
const filtersRef = useRef(filters);
filtersRef.current = filters;

useEffect(() => {
  const currentFilters = filtersRef.current;
  // Use currentFilters...
}, [/* stable dependencies only */]);

// ❌ BAD: Object dependencies cause infinite loops
useEffect(() => {
  // Using filters directly causes re-render on every change
  fetchData(filters);
}, [filters]); // filters object changes reference every render!
```

### Hydration-Safe Rendering
```typescript
// ✅ GOOD: Client-only time calculations
const [isMounted, setIsMounted] = useState(false);
const [timeDisplay, setTimeDisplay] = useState('--'); // Stable SSR value

useEffect(() => {
  setIsMounted(true);
}, []);

useEffect(() => {
  if (!isMounted) return;
  // Only calculate time on client
  setTimeDisplay(calculateRelativeTime(timestamp));
}, [isMounted, timestamp]);

// ❌ BAD: Different values on server vs client
const timeDisplay = calculateRelativeTime(new Date()); // Causes hydration mismatch!
```

## 3. State Management & Debouncing

### Connection State Patterns
```typescript
// ✅ GOOD: Debounced state transitions to prevent flickering
const updateConnectionState = useCallback((newState: ConnectionState) => {
  // Clear existing timeout
  if (debounceRef.current) clearTimeout(debounceRef.current);
  
  // Special handling for 'connecting' - only show after delay
  if (newState === 'connecting') {
    debounceRef.current = setTimeout(() => {
      setConnectionState('connecting');
    }, CONNECTING_DISPLAY_DELAY); // 500ms
    return;
  }
  
  // Immediate update for other states
  setConnectionState(newState);
}, []);

// ❌ BAD: Instant state changes cause flickering
const updateConnectionState = (newState: ConnectionState) => {
  setConnectionState(newState); // Causes rapid flickering!
};
```

## 4. Constants & Configuration

### ✅ DO: Use Named Constants
```typescript
// src/lib/constants.ts
export const CONNECTION_CONSTANTS = {
  DEBOUNCE_DELAY: 300,
  CONNECTING_DISPLAY_DELAY: 500,
  HEALTH_CHECK_INTERVAL: 30000,
  MAX_RECONNECT_ATTEMPTS: 5,
  RECONNECT_BACKOFF_BASE: 1000,
} as const;

// Usage
import { CONNECTION_CONSTANTS } from '@/lib/constants';
setTimeout(() => {}, CONNECTION_CONSTANTS.DEBOUNCE_DELAY);
```

### ❌ DON'T: Use Magic Numbers
```typescript
// Bad: What do these numbers mean?
setTimeout(() => updateState(), 300);
if (timeSinceLastEvent < 10000) return 'excellent';
```

## 5. Error Handling & Logging

### Consistent Console Usage
```typescript
// ✅ GOOD: Consistent logging patterns
const logPrefix = '[ConnectionStatus]';

// Recoverable issues / expected scenarios
console.warn(`${logPrefix} Health check failed, will retry:`, error.message);

// Actual errors / unexpected issues
console.error(`${logPrefix} Critical error:`, error);

// Debug info (only in development)
if (process.env.NODE_ENV === 'development') {
  console.log(`${logPrefix} State transition:`, oldState, '->', newState);
}

// ❌ BAD: Inconsistent logging
console.warn('Health check failed');  // Sometimes warn
console.error('Health check error');  // Sometimes error for same issue
```

## 6. Code Organization & Cleanup

### Consolidate Cleanup Logic
```typescript
// ✅ GOOD: Single cleanup function
const clearAllTimeouts = useCallback(() => {
  if (reconnectTimeoutRef.current) {
    clearTimeout(reconnectTimeoutRef.current);
    reconnectTimeoutRef.current = null;
  }
  if (debounceRef.current) {
    clearTimeout(debounceRef.current);
    debounceRef.current = null;
  }
  // ... clear other timeouts
}, []);

// Use in multiple places
useEffect(() => {
  return clearAllTimeouts; // Cleanup on unmount
}, [clearAllTimeouts]);

const retry = useCallback(() => {
  clearAllTimeouts(); // Clear before retry
  // ... retry logic
}, [clearAllTimeouts]);

// ❌ BAD: Duplicate cleanup code
useEffect(() => {
  return () => {
    if (timeout1) clearTimeout(timeout1);
    if (timeout2) clearTimeout(timeout2);
  };
}, []);

const retry = () => {
  if (timeout1) clearTimeout(timeout1);  // Same code repeated!
  if (timeout2) clearTimeout(timeout2);
};
```

### Remove Unused Variables
```typescript
// ✅ GOOD: Only destructure what you use
const { sessions, activeSessions } = useSessions();

// ❌ BAD: Destructuring unused variables
const { sessions, activeSessions, error: sessionsError } = useSessions();
// sessionsError is never used!
```

## 7. Parallel Agent Considerations

When multiple agents work on the same codebase:

### Communication Through Types
- Define interfaces in shared locations before implementation
- Use TypeScript to enforce contracts between components

### File Ownership
```typescript
// Add clear file headers when working in parallel
/**
 * @file ConnectionStatus Component
 * @agent Agent-1
 * @modifies ConnectionStatus display logic
 * @depends-on types/connection.ts
 */
```

### Integration Points
- Clearly define props interfaces before parallel work begins
- Use TypeScript strict mode to catch integration issues
- Document expected behavior in comments

### Testing Parallel Work
```typescript
// Create integration tests for components modified by different agents
describe('Parallel Agent Integration', () => {
  it('ConnectionStatus receives correct props from useEvents', () => {
    // Test that components work together
  });
});
```

## 8. Common Pitfalls to Avoid

### 1. Hydration Mismatches
- Never use `Date.now()` or `Math.random()` in initial render
- Use `suppressHydrationWarning` sparingly and document why
- Initialize with stable placeholder values

### 2. Infinite Re-render Loops
- Check useEffect dependencies carefully
- Use refs for values that shouldn't trigger effects
- Memoize objects and arrays used as dependencies

### 3. Connection State Flickering
- Always debounce rapid state changes
- Use delays before showing loading states
- Consider user perception of state changes

### 4. Type Safety
- Never use `any` type
- Define explicit interfaces for all props
- Use discriminated unions for state machines

## 9. Code Review Checklist

Before committing parallel agent work:

- [ ] No duplicate type definitions
- [ ] All functions in useEffect deps are stable (useCallback/useMemo)
- [ ] No magic numbers (use named constants)
- [ ] Consistent error handling patterns
- [ ] No unused variables or imports
- [ ] Cleanup logic is consolidated
- [ ] Integration points are properly typed
- [ ] Hydration-safe rendering for SSR
- [ ] State transitions are debounced appropriately
- [ ] Console logging follows consistent patterns

## 10. Performance Considerations

### Memoization Strategy
```typescript
// Memoize expensive calculations
const stats = useMemo(() => ({
  totalEvents: events.length,
  errorCount: events.filter(e => e.type === 'error').length,
}), [events]);

// Memoize component props to prevent re-renders
const connectionProps = useMemo(() => ({
  status: connectionStatus.state,
  lastUpdate: connectionStatus.lastUpdate,
  // ... other props
}), [connectionStatus]);
```

### Real-time Updates
- Batch state updates when possible
- Use debouncing for rapid changes
- Implement virtual scrolling for large lists
- Clean up subscriptions properly

## Summary

This style guide helps ensure consistency across the Chronicle Dashboard, especially when multiple agents work in parallel. Following these patterns will result in:

1. **Better Performance**: Stable references, proper memoization
2. **Fewer Bugs**: Type safety, consistent patterns
3. **Easier Maintenance**: Single source of truth, clear organization
4. **Smoother Collaboration**: Clear conventions for parallel work
5. **Better UX**: No flickering, smooth transitions, stable hydration

Remember: Code is read more often than it's written. Optimize for clarity and consistency.