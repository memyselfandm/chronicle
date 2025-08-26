# End-to-End Testing Suite for Chronicle Dashboard

This directory contains comprehensive End-to-End (E2E) tests for the Chronicle Dashboard application, covering critical user flows, cross-browser compatibility, and error recovery scenarios.

## Test Structure

### 🎯 Critical User Flows (`critical-user-flows.e2e.test.tsx`)
Tests the primary user journeys and features:
- **Dashboard Load & Initial Render**: Performance and structure validation
- **Session Selection & Filtering**: Multi-session selection, filtering, clearing
- **Keyboard Navigation**: j/k event navigation, number key filters, Cmd+B sidebar toggle
- **Sidebar Collapse/Expand**: Manual and keyboard toggles, localStorage persistence
- **Real-time Event Updates**: Live event streaming, high-frequency updates
- **Error Scenarios**: Network failures, invalid data, recovery flows
- **Performance Under Load**: Large datasets, memory efficiency, responsiveness

### 🌐 Cross-Browser Compatibility (`cross-browser-compatibility.e2e.test.tsx`)
Tests dashboard functionality across different browsers and environments:
- **Chrome**: Full feature support, modern APIs (requestIdleCallback, observers)
- **Firefox**: Ctrl+B shortcuts, missing requestIdleCallback fallbacks
- **Safari**: Limited API support, Cmd+B shortcuts, webkit-specific behavior
- **Mobile**: Touch interactions, responsive design, gesture handling
- **Responsive Design**: Multiple viewport sizes, dynamic changes
- **Accessibility**: Reduced motion, color scheme, high contrast preferences
- **Feature Detection**: Fallbacks for missing APIs, disabled features

### 🚨 Error Scenarios & Recovery (`error-scenarios-recovery.e2e.test.tsx`)
Tests resilience and recovery from various error conditions:
- **Network Errors**: Disconnection, slow connections, intermittent failures
- **Invalid Data**: Corrupted sessions/events, malformed JSON, XSS prevention
- **Component Errors**: Error boundaries, rendering failures, recovery options
- **Data Consistency**: Partial updates, concurrent updates, state management
- **Performance**: Error recovery speed, memory efficiency, resource cleanup
- **User Experience**: Clear error messages, continued functionality during errors

## Running E2E Tests

### Prerequisites
```bash
# Install dependencies
npm install

# Ensure test infrastructure is set up
npm run test:setup
```

### Run All E2E Tests
```bash
# Run complete E2E suite
npm run test:e2e

# Run with coverage
npm run test:e2e:coverage

# Run in watch mode during development
npm run test:e2e:watch
```

### Run Specific Test Suites
```bash
# Critical user flows only
npm test -- e2e-tests/critical-user-flows.e2e.test.tsx

# Cross-browser compatibility only
npm test -- e2e-tests/cross-browser-compatibility.e2e.test.tsx

# Error scenarios only
npm test -- e2e-tests/error-scenarios-recovery.e2e.test.tsx
```

### Run Tests in Different Environments
```bash
# Simulate mobile environment
VIEWPORT=mobile npm run test:e2e

# Simulate slow network
NETWORK_DELAY=3000 npm run test:e2e

# Run with specific browser simulation
BROWSER=firefox npm run test:e2e
```

## Test Configuration

### Environment Variables
- `VIEWPORT`: Set viewport size (mobile, tablet, desktop)
- `BROWSER`: Simulate browser behavior (chrome, firefox, safari)
- `NETWORK_DELAY`: Add network latency (milliseconds)
- `MOCK_ERRORS`: Enable error scenario testing
- `PERFORMANCE_BUDGET`: Set performance thresholds

### Mock Data Configuration
E2E tests use consistent mock data for reliable testing:

```typescript
// Standard test sessions (5 sessions with different states)
const testSessions = createE2ETestSessions(5);
// Includes: active, awaiting, idle, completed sessions

// Standard test events (20 events across different types)
const testEvents = createE2ETestEvents(20);
// Includes: user_prompt_submit, pre_tool_use, post_tool_use, notification, error
```

## Performance Benchmarks

E2E tests validate performance against these benchmarks:

| Metric | Target | Test Coverage |
|--------|---------|---------------|
| Initial Dashboard Load | < 150ms | ✅ Critical Flows |
| Session Selection | < 50ms | ✅ Critical Flows |
| Keyboard Navigation | < 16ms (60fps) | ✅ Critical Flows |
| Error Recovery | < 300ms | ✅ Error Scenarios |
| Large Dataset Render | < 500ms | ✅ Cross-Browser |
| Memory Usage | < 100MB sustained | ✅ All Suites |

## Critical User Flows Tested

### 🎮 Keyboard Navigation
```
j/k         → Navigate events (vim-style)
1/2/3       → Quick filter toggles (all/active/awaiting)
Cmd+B       → Toggle sidebar
/           → Focus search
Escape      → Clear filters
Arrow keys  → Alternative navigation
```

### 📊 Session Management
- Single session selection
- Multi-session selection (Cmd+click)
- Session filtering by status
- Clear all selections
- Session persistence

### 🔄 Real-time Updates
- Live event streaming
- High-frequency event bursts
- FIFO event management (1000 event limit)
- Auto-scroll behavior
- Performance during updates

## Error Recovery Testing

### Network Scenarios
- **Complete Disconnection**: Graceful degradation, cached data access
- **Slow Network**: Loading indicators, timeout handling
- **Intermittent Issues**: Retry mechanisms, partial success
- **Partial Failures**: Mixed success/failure states

### Data Integrity
- **Invalid Sessions**: Filter out corrupted data
- **Malformed Events**: Sanitize and validate
- **XSS Prevention**: Escape dangerous content
- **Concurrent Updates**: Maintain consistency

### Component Resilience
- **Error Boundaries**: Catch rendering failures
- **Graceful Fallbacks**: Continue with limited functionality
- **Resource Cleanup**: Proper unmounting during errors
- **User Feedback**: Clear error messages and recovery options

## Browser Compatibility Matrix

| Feature | Chrome | Firefox | Safari | Mobile |
|---------|--------|---------|--------|--------|
| Keyboard Shortcuts | ✅ Cmd+B | ✅ Ctrl+B | ✅ Cmd+B | ⚠️ Limited |
| requestIdleCallback | ✅ Native | ❌ Polyfill | ❌ Polyfill | ❌ Polyfill |
| IntersectionObserver | ✅ Native | ✅ Native | ✅ Native | ✅ Native |
| ResizeObserver | ✅ Native | ✅ Native | ⚠️ Polyfill | ⚠️ Polyfill |
| Touch Events | ✅ Tested | ✅ Tested | ✅ Tested | ✅ Primary |
| Responsive Design | ✅ Full | ✅ Full | ✅ Full | ✅ Optimized |

## Troubleshooting

### Common Test Failures

**"Dashboard not rendering"**
- Check mock data setup in `beforeEach`
- Verify Supabase mocks are configured
- Ensure store is reset between tests

**"Keyboard shortcuts not working"**
- Verify `enableKeyboardShortcuts={true}` prop
- Check browser-specific key mappings (Cmd vs Ctrl)
- Ensure focus is on the dashboard element

**"Performance benchmark failures"**
- Run tests on consistent hardware
- Check for memory leaks in previous tests
- Verify performance monitor is measuring correctly

**"Network error simulation not working"**
- Ensure integration setup is called in `beforeEach`
- Verify error mocks are configured before rendering
- Check cleanup is called in `afterEach`

### Debug Mode
Run tests with debug information:
```bash
DEBUG=true npm run test:e2e
```

This enables:
- Console output from components
- Performance timing logs
- Network request mocking logs
- Store state changes

## Contributing

When adding new E2E tests:

1. **Follow the pattern**: Use existing test structure and utilities
2. **Mock consistently**: Use standard mock data and setup functions
3. **Test real flows**: Focus on actual user journeys, not implementation details
4. **Performance aware**: Include performance assertions for critical paths
5. **Error resilient**: Test both happy path and error scenarios
6. **Cross-browser**: Consider browser-specific behavior and APIs
7. **Clean up**: Properly reset state and mocks in `afterEach`

### Test Naming Convention
```typescript
describe('Feature Category', () => {
  it('should perform specific user action with expected result', () => {
    // Test implementation
  });
});
```

### Performance Testing Pattern
```typescript
performanceMonitor.startMeasurement();
// Perform action
const actionTime = performanceMonitor.endMeasurement();
expect(actionTime).toBeLessThan(BENCHMARK_TIME);
```

### Error Testing Pattern
```typescript
integrationSetup.mockSupabaseError('Specific error message');
// Render component
// Verify graceful handling
integrationSetup.clearError();
```

## CI/CD Integration

E2E tests are designed to run in continuous integration:

```yaml
# Example GitHub Actions configuration
- name: Run E2E Tests
  run: |
    npm run test:e2e:ci
    npm run test:e2e:coverage
    
- name: Upload Coverage
  uses: codecov/codecov-action@v1
  with:
    file: ./coverage/e2e/lcov.info
```

The CI configuration includes:
- Headless browser testing
- Performance monitoring
- Coverage reporting
- Cross-browser testing matrix
- Error scenario validation

## Resources

- [Testing Library Documentation](https://testing-library.com/)
- [Jest E2E Testing Guide](https://jestjs.io/docs/tutorial-react)
- [React Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
- [Chronicle Dashboard Architecture](../README.md)
- [Performance Monitoring](../src/test-utils/performanceHelpers.ts)