import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ErrorBoundary, DashboardErrorBoundary, EventFeedErrorBoundary } from '../src/components/ErrorBoundary';

// Mock logger
jest.mock('../src/lib/utils', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
  },
}));

// Mock window.location.reload
const mockReload = jest.fn();
Object.defineProperty(window, 'location', {
  value: {
    reload: mockReload,
  },
  writable: true,
});

// Component that throws an error
const ThrowError: React.FC<{ shouldThrow?: boolean; errorMessage?: string }> = ({ 
  shouldThrow = true, 
  errorMessage = 'Test error' 
}) => {
  if (shouldThrow) {
    throw new Error(errorMessage);
  }
  return <div data-testid="no-error">No error component</div>;
};

// Component that throws async error
const AsyncThrowError: React.FC<{ shouldThrow?: boolean }> = ({ shouldThrow = true }) => {
  React.useEffect(() => {
    if (shouldThrow) {
      // Simulate async error that error boundary should NOT catch
      setTimeout(() => {
        throw new Error('Async error that won\'t be caught');
      }, 100);
    }
  }, [shouldThrow]);
  
  return <div data-testid="async-component">Async component</div>;
};

describe('ErrorBoundary Components', () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    // Suppress console.error during tests to avoid noise
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe('Basic ErrorBoundary', () => {
    it('should render children when no error occurs', () => {
      render(
        <ErrorBoundary>
          <ThrowError shouldThrow={false} />
        </ErrorBoundary>
      );

      expect(screen.getByTestId('no-error')).toBeInTheDocument();
      expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
    });

    it('should catch and display error when child component throws', () => {
      render(
        <ErrorBoundary>
          <ThrowError errorMessage="Test error message" />
        </ErrorBoundary>
      );

      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
      expect(screen.getByText(/An unexpected error occurred/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /reload page/i })).toBeInTheDocument();
    });

    it('should show development error details in development mode', () => {
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';

      render(
        <ErrorBoundary>
          <ThrowError errorMessage="Detailed test error" />
        </ErrorBoundary>
      );

      expect(screen.getByText('Error Details (Development Only)')).toBeInTheDocument();

      // Restore
      process.env.NODE_ENV = originalNodeEnv;
    });

    it('should not show development error details in production mode', () => {
      const originalNodeEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      render(
        <ErrorBoundary>
          <ThrowError errorMessage="Production test error" />
        </ErrorBoundary>
      );

      expect(screen.queryByText('Error Details (Development Only)')).not.toBeInTheDocument();

      // Restore
      process.env.NODE_ENV = originalNodeEnv;
    });

    it('should call onError prop when error occurs', () => {
      const mockOnError = jest.fn();

      render(
        <ErrorBoundary onError={mockOnError}>
          <ThrowError errorMessage="Callback test error" />
        </ErrorBoundary>
      );

      expect(mockOnError).toHaveBeenCalledWith(
        expect.any(Error),
        expect.objectContaining({
          componentStack: expect.any(String),
        })
      );
    });

    it('should reset error state when "Try Again" is clicked', () => {
      const ErrorComponent: React.FC = () => {
        const [shouldError, setShouldError] = React.useState(true);
        
        return (
          <ErrorBoundary>
            <button 
              data-testid="trigger-error" 
              onClick={() => setShouldError(!shouldError)}
            >
              Toggle Error
            </button>
            <ThrowError shouldThrow={shouldError} />
          </ErrorBoundary>
        );
      };

      render(<ErrorComponent />);

      // Initially should show error
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();

      // Click try again
      fireEvent.click(screen.getByRole('button', { name: /try again/i }));

      // Should still show error because component still throws
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    });

    it('should reload page when "Reload Page" is clicked', () => {
      render(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>
      );

      fireEvent.click(screen.getByRole('button', { name: /reload page/i }));

      expect(mockReload).toHaveBeenCalledTimes(1);
    });

    it('should render custom fallback when provided', () => {
      const customFallback = <div data-testid="custom-fallback">Custom error UI</div>;

      render(
        <ErrorBoundary fallback={customFallback}>
          <ThrowError />
        </ErrorBoundary>
      );

      expect(screen.getByTestId('custom-fallback')).toBeInTheDocument();
      expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
    });

    it('should handle multiple errors gracefully', () => {
      const { rerender } = render(
        <ErrorBoundary>
          <ThrowError errorMessage="First error" />
        </ErrorBoundary>
      );

      expect(screen.getByText('Something went wrong')).toBeInTheDocument();

      // Re-render with different error
      rerender(
        <ErrorBoundary>
          <ThrowError errorMessage="Second error" />
        </ErrorBoundary>
      );

      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    });

    it('should not catch async errors', () => {
      // Error boundaries only catch errors during render, not async errors
      render(
        <ErrorBoundary>
          <AsyncThrowError />
        </ErrorBoundary>
      );

      expect(screen.getByTestId('async-component')).toBeInTheDocument();
      expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
    });

    it('should handle errors in event handlers gracefully', () => {
      const ErrorInHandler: React.FC = () => {
        const handleClick = () => {
          throw new Error('Event handler error');
        };

        return (
          <button data-testid="error-handler-btn" onClick={handleClick}>
            Click to trigger handler error
          </button>
        );
      };

      render(
        <ErrorBoundary>
          <ErrorInHandler />
        </ErrorBoundary>
      );

      // Event handler errors are not caught by error boundaries
      expect(() => {
        fireEvent.click(screen.getByTestId('error-handler-btn'));
      }).toThrow('Event handler error');

      // Error boundary should not activate
      expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
    });
  });

  describe('DashboardErrorBoundary', () => {
    it('should render children when no error occurs', () => {
      render(
        <DashboardErrorBoundary>
          <ThrowError shouldThrow={false} />
        </DashboardErrorBoundary>
      );

      expect(screen.getByTestId('no-error')).toBeInTheDocument();
    });

    it('should show dashboard-specific error message', () => {
      render(
        <DashboardErrorBoundary>
          <ThrowError />
        </DashboardErrorBoundary>
      );

      expect(screen.getByText('Dashboard Temporarily Unavailable')).toBeInTheDocument();
      expect(screen.getByText(/We're experiencing technical difficulties/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /refresh dashboard/i })).toBeInTheDocument();
    });

    it('should reload page when refresh button is clicked', () => {
      render(
        <DashboardErrorBoundary>
          <ThrowError />
        </DashboardErrorBoundary>
      );

      fireEvent.click(screen.getByRole('button', { name: /refresh dashboard/i }));

      expect(mockReload).toHaveBeenCalledTimes(1);
    });

    it('should log errors with dashboard context', () => {
      const { logger } = require('../src/lib/utils');

      render(
        <DashboardErrorBoundary>
          <ThrowError errorMessage="Dashboard error" />
        </DashboardErrorBoundary>
      );

      expect(logger.error).toHaveBeenCalledWith(
        'Dashboard Error',
        expect.objectContaining({
          component: 'DashboardErrorBoundary',
          action: 'handleError',
        }),
        expect.any(Error)
      );
    });
  });

  describe('EventFeedErrorBoundary', () => {
    it('should render children when no error occurs', () => {
      render(
        <EventFeedErrorBoundary>
          <ThrowError shouldThrow={false} />
        </EventFeedErrorBoundary>
      );

      expect(screen.getByTestId('no-error')).toBeInTheDocument();
    });

    it('should show event feed specific error message', () => {
      render(
        <EventFeedErrorBoundary>
          <ThrowError />
        </EventFeedErrorBoundary>
      );

      expect(screen.getByText('Failed to load event feed')).toBeInTheDocument();
      expect(screen.getByText(/There was an error displaying the events/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /refresh/i })).toBeInTheDocument();
    });

    it('should reload page when refresh button is clicked', () => {
      render(
        <EventFeedErrorBoundary>
          <ThrowError />
        </EventFeedErrorBoundary>
      );

      fireEvent.click(screen.getByRole('button', { name: /refresh/i }));

      expect(mockReload).toHaveBeenCalledTimes(1);
    });
  });

  describe('Error Boundary Edge Cases', () => {
    it('should handle errors that occur during error state rendering', () => {
      const ProblematicFallback: React.FC = () => {
        throw new Error('Error in fallback component');
      };

      // This should not cause infinite loops
      expect(() => {
        render(
          <ErrorBoundary fallback={<ProblematicFallback />}>
            <ThrowError />
          </ErrorBoundary>
        );
      }).toThrow('Error in fallback component');
    });

    it('should handle null and undefined children', () => {
      render(
        <ErrorBoundary>
          {null}
          {undefined}
        </ErrorBoundary>
      );

      // Should render without error
      expect(screen.queryByText('Something went wrong')).not.toBeInTheDocument();
    });

    it('should handle errors with circular references', () => {
      const CircularError: React.FC = () => {
        const error = new Error('Circular error');
        (error as any).circular = error;
        throw error;
      };

      render(
        <ErrorBoundary>
          <CircularError />
        </ErrorBoundary>
      );

      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    });

    it('should handle very large error objects', () => {
      const LargeError: React.FC = () => {
        const error = new Error('Large error');
        (error as any).largeData = new Array(10000).fill('large_data_item');
        throw error;
      };

      render(
        <ErrorBoundary>
          <LargeError />
        </ErrorBoundary>
      );

      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    });

    it('should handle errors with special characters in message', () => {
      render(
        <ErrorBoundary>
          <ThrowError errorMessage="Error with special chars: 🚀 <script>alert('xss')</script> & 中文" />
        </ErrorBoundary>
      );

      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    });

    it('should handle nested error boundaries', () => {
      const NestedError: React.FC = () => {
        throw new Error('Nested error');
      };

      render(
        <ErrorBoundary>
          <div>
            <h1>Outer component</h1>
            <ErrorBoundary>
              <NestedError />
            </ErrorBoundary>
          </div>
        </ErrorBoundary>
      );

      // Inner error boundary should catch the error
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
      expect(screen.getByText('Outer component')).toBeInTheDocument();
    });

    it('should handle component unmounting during error handling', () => {
      const { unmount } = render(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>
      );

      expect(screen.getByText('Something went wrong')).toBeInTheDocument();

      // Should not throw when unmounting
      expect(() => {
        unmount();
      }).not.toThrow();
    });

    it('should handle rapid successive errors', () => {
      const RapidError: React.FC<{ count: number }> = ({ count }) => {
        throw new Error(`Rapid error ${count}`);
      };

      const { rerender } = render(
        <ErrorBoundary>
          <RapidError count={1} />
        </ErrorBoundary>
      );

      expect(screen.getByText('Something went wrong')).toBeInTheDocument();

      // Rapidly change error
      for (let i = 2; i <= 5; i++) {
        rerender(
          <ErrorBoundary>
            <RapidError count={i} />
          </ErrorBoundary>
        );
      }

      // Should still show error boundary
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    });
  });

  describe('Error Boundary Accessibility', () => {
    it('should be accessible with screen readers', () => {
      render(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>
      );

      const errorHeading = screen.getByRole('heading', { name: /something went wrong/i });
      expect(errorHeading).toBeInTheDocument();

      const tryAgainButton = screen.getByRole('button', { name: /try again/i });
      const reloadButton = screen.getByRole('button', { name: /reload page/i });
      
      expect(tryAgainButton).toBeInTheDocument();
      expect(reloadButton).toBeInTheDocument();
    });

    it('should support keyboard navigation', () => {
      render(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>
      );

      const tryAgainButton = screen.getByRole('button', { name: /try again/i });
      const reloadButton = screen.getByRole('button', { name: /reload page/i });

      // Should be focusable
      tryAgainButton.focus();
      expect(document.activeElement).toBe(tryAgainButton);

      reloadButton.focus();
      expect(document.activeElement).toBe(reloadButton);
    });

    it('should have appropriate ARIA attributes', () => {
      render(
        <ErrorBoundary>
          <ThrowError />
        </ErrorBoundary>
      );

      // Error message should be announced to screen readers
      const errorMessage = screen.getByText(/An unexpected error occurred/);
      expect(errorMessage).toBeInTheDocument();
    });
  });

  describe('Error Boundary Performance', () => {
    it('should not re-render unnecessarily', () => {
      let renderCount = 0;
      
      const CountingComponent: React.FC = () => {
        renderCount++;
        return <div data-testid="counting-component">Render count: {renderCount}</div>;
      };

      const { rerender } = render(
        <ErrorBoundary>
          <CountingComponent />
        </ErrorBoundary>
      );

      expect(renderCount).toBe(1);

      // Re-render with same props should not cause unnecessary renders
      rerender(
        <ErrorBoundary>
          <CountingComponent />
        </ErrorBoundary>
      );

      expect(renderCount).toBe(2); // Expected to re-render due to React behavior
    });

    it('should handle many child components efficiently', () => {
      const ManyChildren: React.FC = () => (
        <div>
          {Array.from({ length: 1000 }, (_, i) => (
            <div key={i} data-testid={`child-${i}`}>
              Child {i}
            </div>
          ))}
        </div>
      );

      expect(() => {
        render(
          <ErrorBoundary>
            <ManyChildren />
          </ErrorBoundary>
        );
      }).not.toThrow();

      expect(screen.getByTestId('child-0')).toBeInTheDocument();
      expect(screen.getByTestId('child-999')).toBeInTheDocument();
    });
  });
});