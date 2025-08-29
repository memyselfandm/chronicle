# Contributing to Chronicle

## Welcome

Chronicle is an open-source observability system for Claude Code, and we welcome contributions from the community. This guide provides everything you need to know to contribute effectively to the project.

## Getting Started

### Prerequisites

- **Node.js**: 18.0.0+ (20.0.0+ recommended)
- **Python**: 3.8.0+ (3.11+ recommended)
- **Git**: Latest version
- **Claude Code**: Latest version for testing

### Development Environment Setup

1. **Fork and Clone**:
   ```bash
   git clone https://github.com/yourusername/chronicle.git
   cd chronicle
   git remote add upstream https://github.com/original/chronicle.git
   ```

2. **Install Dependencies**:
   ```bash
   # Dashboard dependencies
   cd apps/dashboard
   npm install
   cd ../..
   
   # Server dependencies
   cd apps/server
   pip install -r requirements.txt
   cd ../..
   
   # Hooks dependencies
   cd apps/hooks
   pip install -r requirements.txt
   cd ../..
   ```

3. **Setup Development Database**:
   ```bash
   # Create development database
   python apps/hooks/scripts/setup_schema.py
   ```

4. **Run Development Servers**:
   ```bash
   # Terminal 1: Server
   cd apps/server
   python main.py --debug
   
   # Terminal 2: Dashboard
   cd apps/dashboard  
   npm run dev
   
   # Terminal 3: Test hooks installation
   python apps/hooks/scripts/install.py --dev
   ```

## Development Workflow

### Branch Strategy

We follow a simplified Git workflow:

- **`main`** - Production-ready code
- **`develop`** - Integration branch for new features
- **`feature/CHR-XX-description`** - Feature branches
- **`fix/CHR-XX-description`** - Bug fix branches

### Creating a Feature

1. **Create Feature Branch**:
   ```bash
   git checkout -b feature/CHR-47-new-dashboard-widget
   git push -u origin feature/CHR-47-new-dashboard-widget
   ```

2. **Make Changes**:
   - Follow code style guidelines
   - Write tests for new functionality
   - Update documentation as needed

3. **Test Thoroughly**:
   ```bash
   # Run all tests
   npm run test:all
   
   # Check code coverage
   npm run coverage:check
   
   # Test installation
   python install.py --test
   ```

4. **Submit Pull Request**:
   - Use descriptive title: `[CHR-47] Add new dashboard widget`
   - Include detailed description
   - Reference related issues
   - Add screenshots for UI changes

## Code Style Guidelines

### Python Code Style

We follow PEP 8 with some Chronicle-specific conventions:

```python
# Good: Descriptive names and clear structure
class ChronicleEventProcessor:
    """Process Chronicle events with validation and sanitization."""
    
    def __init__(self, database: LocalDatabase):
        self.database = database
        self.sanitizer = DataSanitizer()
        
    def process_event(self, event_data: Dict[str, Any]) -> bool:
        """
        Process a single event with error handling.
        
        Args:
            event_data: Raw event data from hooks
            
        Returns:
            bool: True if processed successfully
        """
        try:
            # Validate event structure
            validated_event = self._validate_event(event_data)
            
            # Sanitize sensitive data
            clean_event = self.sanitizer.sanitize(validated_event)
            
            # Store in database
            return self.database.save_event(clean_event)
            
        except ValidationError as e:
            logger.warning(f"Event validation failed: {e}")
            return False
        except Exception as e:
            logger.error(f"Event processing failed: {e}")
            return False
```

**Python Conventions:**
- Use type hints for all function parameters and returns
- Include comprehensive docstrings for public functions
- Handle errors explicitly with try/except blocks
- Use descriptive variable names
- Keep functions under 50 lines when possible
- Use `black` for code formatting: `black apps/hooks/src/`

### TypeScript/React Code Style

We use modern React patterns with TypeScript:

```typescript
// Good: Functional component with proper typing
interface EventCardProps {
  event: ChronicleEvent;
  onSelect: (eventId: string) => void;
  isSelected: boolean;
}

export const EventCard: React.FC<EventCardProps> = ({
  event,
  onSelect,
  isSelected
}) => {
  const handleClick = useCallback(() => {
    onSelect(event.id);
  }, [event.id, onSelect]);
  
  const formattedTime = useMemo(() => {
    return formatTimestamp(event.timestamp);
  }, [event.timestamp]);
  
  return (
    <div 
      className={`event-card ${isSelected ? 'selected' : ''}`}
      onClick={handleClick}
      data-testid="event-card"
    >
      <div className="event-header">
        <span className="event-type">{event.event_type}</span>
        <time>{formattedTime}</time>
      </div>
      <div className="event-metadata">
        {event.tool_name && (
          <Badge variant="tool">{event.tool_name}</Badge>
        )}
      </div>
    </div>
  );
};
```

**TypeScript/React Conventions:**
- Use functional components with hooks
- Define proper TypeScript interfaces
- Use `useCallback` and `useMemo` for performance
- Include `data-testid` attributes for testing
- Use Tailwind classes for styling
- Format with Prettier: `npm run format`

### Testing Standards

#### Python Tests

Use pytest with comprehensive test coverage:

```python
# tests/test_event_processor.py
import pytest
from unittest.mock import Mock, patch
from apps.hooks.src.lib.event_processor import ChronicleEventProcessor

class TestChronicleEventProcessor:
    
    @pytest.fixture
    def mock_database(self):
        return Mock()
    
    @pytest.fixture  
    def processor(self, mock_database):
        return ChronicleEventProcessor(mock_database)
    
    def test_process_valid_event(self, processor):
        """Test processing a valid event succeeds."""
        event_data = {
            "session_id": "test-session",
            "event_type": "tool_use",
            "timestamp": "2024-01-01T12:00:00Z",
            "metadata": {"tool_name": "bash"}
        }
        
        processor.database.save_event.return_value = True
        
        result = processor.process_event(event_data)
        
        assert result is True
        processor.database.save_event.assert_called_once()
    
    def test_process_invalid_event_type(self, processor):
        """Test processing event with invalid type fails gracefully."""
        event_data = {
            "session_id": "test-session", 
            "event_type": "invalid_type",
            "timestamp": "2024-01-01T12:00:00Z"
        }
        
        result = processor.process_event(event_data)
        
        assert result is False
        processor.database.save_event.assert_not_called()
```

#### React/TypeScript Tests

Use Jest and React Testing Library:

```typescript
// __tests__/EventCard.test.tsx
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { EventCard } from '../EventCard';
import { ChronicleEvent } from '../types';

const mockEvent: ChronicleEvent = {
  id: 'test-event-1',
  session_id: 'test-session',
  event_type: 'tool_use',
  timestamp: '2024-01-01T12:00:00Z',
  metadata: { tool_name: 'bash' },
  tool_name: 'bash'
};

describe('EventCard', () => {
  const mockOnSelect = jest.fn();
  
  beforeEach(() => {
    mockOnSelect.mockClear();
  });
  
  it('renders event information correctly', () => {
    render(
      <EventCard 
        event={mockEvent}
        onSelect={mockOnSelect}
        isSelected={false}
      />
    );
    
    expect(screen.getByText('tool_use')).toBeInTheDocument();
    expect(screen.getByText('bash')).toBeInTheDocument();
    expect(screen.getByTestId('event-card')).toBeInTheDocument();
  });
  
  it('calls onSelect when clicked', () => {
    render(
      <EventCard 
        event={mockEvent}
        onSelect={mockOnSelect}
        isSelected={false}
      />
    );
    
    fireEvent.click(screen.getByTestId('event-card'));
    
    expect(mockOnSelect).toHaveBeenCalledWith('test-event-1');
  });
  
  it('applies selected styling when isSelected is true', () => {
    render(
      <EventCard 
        event={mockEvent}
        onSelect={mockOnSelect}
        isSelected={true}
      />
    );
    
    expect(screen.getByTestId('event-card')).toHaveClass('selected');
  });
});
```

### Test Requirements

All contributions must include tests:

- **Coverage Requirement**: 80%+ for dashboard, 60%+ for hooks
- **Unit Tests**: Test individual functions and components
- **Integration Tests**: Test component interactions
- **E2E Tests**: Test critical user flows
- **Performance Tests**: For performance-sensitive changes

Run tests before submitting:

```bash
# All tests
npm run test:all

# Specific component tests
npm run test:dashboard
npm run test:hooks
npm run test:server

# Coverage check
npm run coverage:check
```

## Documentation Guidelines

### Code Documentation

- **Functions**: Include docstrings with parameters, returns, and examples
- **Classes**: Document purpose, key methods, and usage patterns
- **Complex Logic**: Add inline comments explaining the "why"
- **API Changes**: Update API documentation
- **Breaking Changes**: Document migration path

### User Documentation

When adding features, update relevant documentation:

- **Admin Guides**: Server management, troubleshooting, etc.
- **Developer Guides**: API reference, architecture, contributing
- **Setup Guides**: Installation, configuration, deployment
- **Troubleshooting**: Common issues and solutions

### Documentation Format

Use clear Markdown with consistent structure:

```markdown
# Feature Name

## Overview
Brief description of what this feature does.

## Usage
Step-by-step instructions with code examples.

## Configuration
Available options and settings.

## Examples
Real-world usage examples.

## Troubleshooting
Common issues and solutions.
```

## Submitting Changes

### Pull Request Process

1. **Pre-submission Checklist**:
   - [ ] Tests pass locally
   - [ ] Code follows style guidelines
   - [ ] Documentation updated
   - [ ] Breaking changes documented
   - [ ] Performance impact considered

2. **Pull Request Template**:
   ```markdown
   ## Description
   Brief description of changes
   
   ## Type of Change
   - [ ] Bug fix (non-breaking change that fixes an issue)
   - [ ] New feature (non-breaking change that adds functionality)
   - [ ] Breaking change (fix or feature that breaks existing functionality)
   - [ ] Documentation update
   
   ## Testing
   - [ ] Unit tests pass
   - [ ] Integration tests pass
   - [ ] Manual testing completed
   
   ## Screenshots (if applicable)
   Add screenshots for UI changes
   
   ## Related Issues
   Closes #123
   ```

3. **Review Process**:
   - Automated tests must pass
   - Code review by maintainer
   - Documentation review if needed
   - Performance impact assessment

### Commit Message Guidelines

Use conventional commit format:

```
type(scope): description

body (optional)

footer (optional)
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (no functional changes)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

**Examples:**
```
feat(dashboard): add real-time event filtering

Add ability to filter events in real-time by event type and tool name.
Includes new FilterBar component and WebSocket message filtering.

Closes #47

fix(hooks): handle missing session_id in events

Previously crashed when session_id was None. Now defaults to
'unknown' and logs warning.

Fixes #123

docs(api): update WebSocket API documentation

Add missing event types and improve examples.
```

## Development Best Practices

### Performance Considerations

- **Database Queries**: Use indexed columns, limit results
- **WebSocket Messages**: Batch updates, implement filtering
- **React Components**: Use React.memo, optimize re-renders
- **Memory Usage**: Clean up subscriptions, limit cache size

### Security Practices

- **Input Validation**: Validate all user inputs
- **Data Sanitization**: Remove PII and sensitive data
- **SQL Injection**: Use parameterized queries
- **XSS Prevention**: Sanitize displayed content
- **CORS**: Configure appropriate origins

### Error Handling

- **Graceful Degradation**: Continue working when non-critical features fail
- **User-Friendly Messages**: Provide clear error descriptions
- **Logging**: Log errors with context for debugging
- **Recovery**: Implement automatic recovery where possible

## Troubleshooting Development Issues

### Common Setup Issues

**Dependencies won't install:**
```bash
# Clear caches
npm cache clean --force
pip cache purge

# Update package managers
npm install -g npm@latest
pip install --upgrade pip

# Use specific versions
nvm use 20
python -m venv dev-env
source dev-env/bin/activate
```

**Tests failing:**
```bash
# Update test dependencies
npm install --save-dev
pip install -r requirements-test.txt

# Clear test caches
npm run test:clear-cache
pytest --cache-clear
```

**Database issues:**
```bash
# Reset development database
rm apps/hooks/data/chronicle.db
python apps/hooks/scripts/setup_schema.py

# Check database permissions
ls -la apps/hooks/data/
```

### Getting Help

1. **Check Documentation**: Review existing docs first
2. **Search Issues**: Look for similar problems in GitHub issues
3. **Ask Questions**: Create issue with "question" label
4. **Join Discussions**: Participate in project discussions
5. **Contact Maintainers**: For complex architectural questions

## Contribution Areas

We welcome contributions in these areas:

### High Priority
- **Dashboard Components**: New visualizations and widgets
- **Performance Optimizations**: Database, WebSocket, React performance
- **Testing Coverage**: Unit tests, integration tests, E2E tests
- **Documentation**: User guides, API docs, troubleshooting

### Medium Priority
- **Hook System**: New hook types, better error handling
- **API Enhancements**: New endpoints, better filtering
- **Deployment**: Docker, cloud deployment options
- **Monitoring**: Metrics, alerting, health checks

### Low Priority
- **UI/UX Improvements**: Design enhancements, accessibility
- **Developer Tools**: CLI utilities, development scripts
- **Integrations**: External system integrations
- **Plugins**: Extensibility system

## Recognition

Contributors are recognized in:
- **README.md**: Contributors section
- **CHANGELOG.md**: Release notes
- **GitHub**: Contributor graphs and statistics
- **Documentation**: Author attribution

## Code of Conduct

Chronicle follows the [Contributor Covenant](https://www.contributor-covenant.org/):

- **Be Respectful**: Treat all contributors with respect
- **Be Inclusive**: Welcome newcomers and diverse perspectives  
- **Be Constructive**: Provide helpful feedback and suggestions
- **Be Patient**: Help others learn and grow
- **Be Professional**: Maintain professional conduct

## License

By contributing to Chronicle, you agree that your contributions will be licensed under the same license as the project.

## Questions?

- **General Questions**: Create an issue with "question" label
- **Development Help**: Check troubleshooting section above
- **Bug Reports**: Use bug report template
- **Feature Requests**: Use feature request template

Thank you for contributing to Chronicle! Your efforts help make Claude Code observability better for everyone.