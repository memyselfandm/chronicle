# 📊 Test Coverage Guide

This guide explains Chronicle's test coverage requirements, setup, and best practices for maintaining production-ready test coverage.

## 🎯 Coverage Requirements

Chronicle enforces strict coverage thresholds to ensure production reliability:

### Minimum Thresholds

| Component | Minimum Coverage | Target Coverage | Critical Paths |
|-----------|------------------|-----------------|----------------|
| 📊 **Dashboard** | 80% | 85% | 90%+ |
| 🪝 **Hooks** | 60% | 70% | 90%+ |
| 🔧 **Core Libraries** | 85% | 90% | 95%+ |
| 🔐 **Security Modules** | 90% | 95% | 100% |

### Component-Specific Requirements

#### Dashboard (Next.js/TypeScript)
- **Components**: 85% coverage minimum
- **Hooks**: 90% coverage minimum (business logic critical)
- **Utils/Lib**: 85% coverage minimum
- **Integration**: 70% coverage minimum

#### Hooks (Python)
- **Hook Modules**: 70% coverage minimum
- **Database Layer**: 80% coverage minimum
- **Security Layer**: 90% coverage minimum
- **Utils/Core**: 75% coverage minimum

## 🚀 Quick Start

### Prerequisites

```bash
# Install dependencies
npm install
cd apps/dashboard && npm install
cd ../hooks && uv sync
```

### Running Coverage Locally

```bash
# Run all tests with coverage
npm run test:coverage

# Individual components
npm run test:coverage:dashboard
npm run test:coverage:hooks

# Check thresholds
npm run coverage:check

# Generate reports
npm run coverage:report
npm run coverage:badges
```

### Dashboard Coverage

```bash
cd apps/dashboard

# Run with coverage
npm test -- --coverage --watchAll=false

# Watch mode with coverage
npm test -- --coverage --watch

# Specific threshold check
npm test -- --coverage --coverageThreshold='{"global":{"lines":80}}'
```

### Hooks Coverage

```bash
cd apps/hooks

# Run with coverage
uv run pytest --cov=src

# Generate all report formats
uv run pytest --cov=src --cov-report=html --cov-report=json --cov-report=lcov

# Fail on threshold
uv run pytest --cov=src --cov-fail-under=60
```

## 🔧 Configuration

### Dashboard (Jest)

Coverage is configured in `apps/dashboard/jest.config.js`:

```javascript
coverageThreshold: {
  global: {
    lines: 80,
    functions: 80,
    branches: 80,
    statements: 80,
  },
  'src/components/**/*.{ts,tsx}': {
    lines: 85,
    functions: 85,
  },
  'src/hooks/**/*.{ts,tsx}': {
    lines: 90,
    functions: 90,
  },
}
```

### Hooks (pytest-cov)

Coverage is configured in `apps/hooks/pyproject.toml`:

```toml
[tool.pytest.ini_options]
addopts = [
    "--cov=src",
    "--cov-report=term-missing",
    "--cov-report=html",
    "--cov-report=json",
    "--cov-fail-under=60",
]

[tool.coverage.run]
source = ["src"]
branch = true
omit = ["*/tests/*", "*/examples/*"]
```

## 📈 CI/CD Integration

### GitHub Actions

Coverage is automatically checked in `.github/workflows/ci.yml`:

1. **Dashboard Tests**: Jest with coverage enforcement
2. **Hooks Tests**: pytest-cov with threshold checking
3. **Coverage Analysis**: Combined reporting and trending
4. **PR Comments**: Automatic coverage reports on pull requests
5. **Threshold Gates**: PRs blocked if coverage below minimum

### Coverage Reports

Multiple report formats are generated:

- **HTML**: Human-readable coverage reports
- **JSON**: Machine-readable data for tooling
- **LCOV**: Codecov integration
- **Terminal**: Immediate feedback during development

### Badge Generation

Coverage badges are automatically updated:

- `badges/dashboard-coverage.svg`
- `badges/hooks-coverage.svg`
- `badges/overall-coverage.svg`
- `badges/coverage-status.svg`

## 📊 Monitoring & Trends

### Coverage Tracking

The system tracks coverage trends over time:

```bash
# View trends
npm run coverage:trend

# Check recent analysis
cat coverage-trends-report.md
```

### Key Metrics

- **Trend Analysis**: Improving/declining/stable
- **Historical Data**: Last 100 measurements
- **Recommendations**: Automated suggestions for improvement
- **Change Detection**: Alerts for significant changes

## 🛠️ Best Practices

### Writing Testable Code

1. **Small Functions**: Easier to test and achieve high coverage
2. **Pure Functions**: Predictable inputs/outputs
3. **Dependency Injection**: Mock external dependencies
4. **Error Handling**: Test both success and failure paths
5. **Edge Cases**: Test boundary conditions

### Coverage Strategies

#### Dashboard Components

```typescript
// ✅ Good: Testable component
export function UserCard({ user, onEdit }: Props) {
  if (!user) return <div>No user</div>;
  
  return (
    <div>
      <h2>{user.name}</h2>
      <button onClick={() => onEdit(user.id)}>Edit</button>
    </div>
  );
}

// Test both rendering and interactions
it('renders user name', () => {
  render(<UserCard user={mockUser} onEdit={jest.fn()} />);
  expect(screen.getByText('John Doe')).toBeInTheDocument();
});

it('calls onEdit when button clicked', () => {
  const onEdit = jest.fn();
  render(<UserCard user={mockUser} onEdit={onEdit} />);
  fireEvent.click(screen.getByText('Edit'));
  expect(onEdit).toHaveBeenCalledWith(mockUser.id);
});
```

#### Hooks Testing

```python
# ✅ Good: Testable hook function
def process_tool_event(event_data: dict) -> ProcessedEvent:
    """Process tool use event with validation and sanitization."""
    if not event_data:
        raise ValueError("Event data is required")
    
    # Sanitize input
    sanitized = sanitize_event_data(event_data)
    
    # Process
    result = ProcessedEvent(
        tool_name=sanitized['tool_name'],
        duration=calculate_duration(sanitized),
        status='success'
    )
    
    return result

# Test multiple scenarios
def test_process_tool_event_success():
    event = {"tool_name": "grep", "start_time": 1000, "end_time": 1500}
    result = process_tool_event(event)
    assert result.tool_name == "grep"
    assert result.duration == 500

def test_process_tool_event_invalid_input():
    with pytest.raises(ValueError, match="Event data is required"):
        process_tool_event({})
```

### Achieving High Coverage

1. **Test Happy Path**: Normal execution flow
2. **Test Error Cases**: Exception handling and validation
3. **Test Edge Cases**: Boundary conditions and unusual inputs
4. **Test Integrations**: Component interactions
5. **Mock Dependencies**: External services and APIs

### Mocking Strategies

#### Dashboard

```typescript
// Mock Supabase client
jest.mock('../lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(() => Promise.resolve({ data: mockData }))
    }))
  }
}));
```

#### Hooks

```python
# Mock database operations
@pytest.fixture
def mock_db():
    with patch('src.database.DatabaseManager') as mock:
        mock.return_value.save_event.return_value = True
        yield mock

def test_save_hook_event(mock_db):
    result = save_hook_event(test_event)
    assert result is True
    mock_db.return_value.save_event.assert_called_once()
```

## 🚨 Troubleshooting

### Common Issues

#### Low Coverage

```bash
# Identify uncovered lines
npm run test:coverage:dashboard
# Check apps/dashboard/coverage/lcov-report/index.html

cd apps/hooks
uv run pytest --cov=src --cov-report=html
# Check apps/hooks/htmlcov/index.html
```

#### Threshold Failures

```bash
# See exactly what's missing
npm run coverage:check

# Review recommendations
cat coverage-trends-report.md
```

#### CI Failures

1. **Check Logs**: Review GitHub Actions output
2. **Run Locally**: Reproduce the issue locally
3. **Check Thresholds**: Ensure local tests meet requirements
4. **Review Changes**: What code was added without tests?

### Performance Issues

If tests are slow:

1. **Parallel Execution**: Jest runs tests in parallel by default
2. **Test Isolation**: Avoid shared state between tests
3. **Mock Heavy Operations**: Database calls, API requests
4. **Selective Testing**: Use `--testPathPattern` for focused runs

## 📋 Coverage Checklist

Before submitting a PR:

- [ ] All new code has corresponding tests
- [ ] Coverage thresholds met for changed files
- [ ] Edge cases and error paths tested
- [ ] Integration tests cover component interactions
- [ ] No skipped or pending tests
- [ ] Coverage report generated successfully
- [ ] CI passes all coverage checks

## 🔗 Related Resources

- [Testing Guide](./testing.md)
- [CI/CD Documentation](../reference/ci-cd.md)
- [Performance Guidelines](./performance.md)
- [Security Testing](./security.md)
- [Jest Documentation](https://jestjs.io/docs/configuration#coverage)
- [pytest-cov Documentation](https://pytest-cov.readthedocs.io/)

---

*This guide is automatically updated when coverage configurations change.*