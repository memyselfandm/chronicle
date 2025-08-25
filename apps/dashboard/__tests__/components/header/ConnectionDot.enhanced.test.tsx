/**
 * Enhanced comprehensive tests for ConnectionDot component
 * Tests: status changes, color coding, real-time enabled state, accessibility
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ConnectionDot } from '@/components/layout/ConnectionDot';
import { 
  renderWithProviders,
  checkAccessibility,
  measureRenderTime
} from '@/test-utils';

// Mock dependencies
jest.mock('@/stores/dashboardStore', () => ({
  useDashboardStore: jest.fn(),
}));

describe('ConnectionDot', () => {
  const mockUseDashboardStore = require('@/stores/dashboardStore').useDashboardStore;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('renders connection dot with default props', () => {
      mockUseDashboardStore.mockImplementation((selector) => {
        const mockState = {
          realtime: {
            connectionStatus: 'connected',
            isRealTimeEnabled: true,
          },
        };
        return selector(mockState);
      });

      render(<ConnectionDot />);

      expect(screen.getByTestId('connection-dot')).toBeInTheDocument();
      expect(screen.getByTestId('connection-status-dot')).toBeInTheDocument();
      expect(screen.getByTestId('connection-status-label')).toBeInTheDocument();
    });

    it('applies custom className correctly', () => {
      mockUseDashboardStore.mockImplementation((selector) => {
        const mockState = {
          realtime: {
            connectionStatus: 'connected',
            isRealTimeEnabled: true,
          },
        };
        return selector(mockState);
      });

      render(<ConnectionDot className="custom-class" />);

      const connectionDot = screen.getByTestId('connection-dot');
      expect(connectionDot).toHaveClass('custom-class');
    });

    it('hides label when showLabel is false', () => {
      mockUseDashboardStore.mockImplementation((selector) => {
        const mockState = {
          realtime: {
            connectionStatus: 'connected',
            isRealTimeEnabled: true,
          },
        };
        return selector(mockState);
      });

      render(<ConnectionDot showLabel={false} />);

      expect(screen.getByTestId('connection-status-dot')).toBeInTheDocument();
      expect(screen.queryByTestId('connection-status-label')).not.toBeInTheDocument();
    });

    it('shows label by default', () => {
      mockUseDashboardStore.mockImplementation((selector) => {
        const mockState = {
          realtime: {
            connectionStatus: 'connected',
            isRealTimeEnabled: true,
          },
        };
        return selector(mockState);
      });

      render(<ConnectionDot />);

      expect(screen.getByTestId('connection-status-label')).toBeInTheDocument();
    });
  });

  describe('Connection Status States', () => {
    const statusTestCases = [
      {
        status: 'connected',
        isEnabled: true,
        expectedColor: 'bg-status-active',
        expectedLabel: 'Connected',
        expectedDescription: 'Real-time connection active',
        shouldAnimate: false,
      },
      {
        status: 'connecting',
        isEnabled: true,
        expectedColor: 'bg-status-awaiting',
        expectedLabel: 'Connecting',
        expectedDescription: 'Establishing connection...',
        shouldAnimate: true,
      },
      {
        status: 'disconnected',
        isEnabled: true,
        expectedColor: 'bg-text-muted',
        expectedLabel: 'Disconnected',
        expectedDescription: 'Connection lost',
        shouldAnimate: false,
      },
      {
        status: 'error',
        isEnabled: true,
        expectedColor: 'bg-status-error',
        expectedLabel: 'Error',
        expectedDescription: 'Connection error',
        shouldAnimate: false,
      },
    ];

    statusTestCases.forEach(({ status, isEnabled, expectedColor, expectedLabel, expectedDescription, shouldAnimate }) => {
      it(`renders ${status} state correctly`, () => {
        mockUseDashboardStore.mockImplementation((selector) => {
          const mockState = {
            realtime: {
              connectionStatus: status,
              isRealTimeEnabled: isEnabled,
            },
          };
          return selector(mockState);
        });

        render(<ConnectionDot />);

        const statusDot = screen.getByTestId('connection-status-dot');
        const statusLabel = screen.getByTestId('connection-status-label');

        expect(statusDot).toHaveClass(expectedColor);
        expect(statusLabel).toHaveTextContent(expectedLabel);
        
        if (shouldAnimate) {
          expect(statusDot).toHaveClass('animate-pulse');
        } else {
          expect(statusDot).not.toHaveClass('animate-pulse');
        }

        // Check title attribute for description
        const connectionDot = screen.getByTestId('connection-dot');
        expect(connectionDot).toHaveAttribute('title', expectedDescription);
      });
    });

    it('handles unknown connection status gracefully', () => {
      mockUseDashboardStore.mockImplementation((selector) => {
        const mockState = {
          realtime: {
            connectionStatus: 'unknown-status',
            isRealTimeEnabled: true,
          },
        };
        return selector(mockState);
      });

      render(<ConnectionDot />);

      const statusDot = screen.getByTestId('connection-status-dot');
      const statusLabel = screen.getByTestId('connection-status-label');

      expect(statusDot).toHaveClass('bg-text-muted');
      expect(statusLabel).toHaveTextContent('Unknown');
    });
  });

  describe('Real-time Enabled State', () => {
    it('shows offline when real-time is disabled', () => {
      mockUseDashboardStore.mockImplementation((selector) => {
        const mockState = {
          realtime: {
            connectionStatus: 'connected',
            isRealTimeEnabled: false,
          },
        };
        return selector(mockState);
      });

      render(<ConnectionDot />);

      const statusDot = screen.getByTestId('connection-status-dot');
      const statusLabel = screen.getByTestId('connection-status-label');

      expect(statusDot).toHaveClass('bg-text-muted');
      expect(statusLabel).toHaveTextContent('Offline');

      const connectionDot = screen.getByTestId('connection-dot');
      expect(connectionDot).toHaveAttribute('title', 'Real-time disabled');
    });

    it('prioritizes real-time disabled over connection status', () => {
      mockUseDashboardStore.mockImplementation((selector) => {
        const mockState = {
          realtime: {
            connectionStatus: 'connected',
            isRealTimeEnabled: false,
          },
        };
        return selector(mockState);
      });

      render(<ConnectionDot />);

      // Should show offline even though status is connected
      const statusLabel = screen.getByTestId('connection-status-label');
      expect(statusLabel).toHaveTextContent('Offline');
      expect(statusLabel).not.toHaveTextContent('Connected');
    });

    it('respects connection status when real-time is enabled', () => {
      mockUseDashboardStore.mockImplementation((selector) => {
        const mockState = {
          realtime: {
            connectionStatus: 'connecting',
            isRealTimeEnabled: true,
          },
        };
        return selector(mockState);
      });

      render(<ConnectionDot />);

      const statusLabel = screen.getByTestId('connection-status-label');
      expect(statusLabel).toHaveTextContent('Connecting');
    });
  });

  describe('Visual Styling', () => {
    it('applies correct base classes', () => {
      mockUseDashboardStore.mockImplementation((selector) => {
        const mockState = {
          realtime: {
            connectionStatus: 'connected',
            isRealTimeEnabled: true,
          },
        };
        return selector(mockState);
      });

      render(<ConnectionDot />);

      const connectionDot = screen.getByTestId('connection-dot');
      const statusDot = screen.getByTestId('connection-status-dot');
      const statusLabel = screen.getByTestId('connection-status-label');

      expect(connectionDot).toHaveClass('flex', 'items-center', 'gap-2');
      expect(statusDot).toHaveClass('w-2', 'h-2', 'rounded-full', 'transition-all', 'duration-300');
      expect(statusLabel).toHaveClass('text-xs', 'text-text-secondary', 'font-medium');
    });

    it('shows pulse animation for connecting state', () => {
      mockUseDashboardStore.mockImplementation((selector) => {
        const mockState = {
          realtime: {
            connectionStatus: 'connecting',
            isRealTimeEnabled: true,
          },
        };
        return selector(mockState);
      });

      render(<ConnectionDot />);

      const statusDot = screen.getByTestId('connection-status-dot');
      expect(statusDot).toHaveClass('animate-pulse');
    });

    it('does not show pulse animation for non-connecting states', () => {
      const nonConnectingStates = ['connected', 'disconnected', 'error'];

      nonConnectingStates.forEach(status => {
        mockUseDashboardStore.mockImplementation((selector) => {
          const mockState = {
            realtime: {
              connectionStatus: status,
              isRealTimeEnabled: true,
            },
          };
          return selector(mockState);
        });

        const { container } = render(<ConnectionDot />);

        const statusDot = screen.getByTestId('connection-status-dot');
        expect(statusDot).not.toHaveClass('animate-pulse');

        container.remove();
      });
    });

    it('maintains consistent dot size across states', () => {
      const allStates = ['connected', 'connecting', 'disconnected', 'error'];

      allStates.forEach(status => {
        mockUseDashboardStore.mockImplementation((selector) => {
          const mockState = {
            realtime: {
              connectionStatus: status,
              isRealTimeEnabled: true,
            },
          };
          return selector(mockState);
        });

        const { container } = render(<ConnectionDot />);

        const statusDot = screen.getByTestId('connection-status-dot');
        expect(statusDot).toHaveClass('w-2', 'h-2');

        container.remove();
      });
    });
  });

  describe('Accessibility', () => {
    it('provides proper ARIA labels', () => {
      mockUseDashboardStore.mockImplementation((selector) => {
        const mockState = {
          realtime: {
            connectionStatus: 'connected',
            isRealTimeEnabled: true,
          },
        };
        return selector(mockState);
      });

      render(<ConnectionDot />);

      const statusDot = screen.getByTestId('connection-status-dot');
      expect(statusDot).toHaveAttribute('aria-label', 'Connection status: Connected');
    });

    it('provides descriptive titles for screen readers', () => {
      mockUseDashboardStore.mockImplementation((selector) => {
        const mockState = {
          realtime: {
            connectionStatus: 'error',
            isRealTimeEnabled: true,
          },
        };
        return selector(mockState);
      });

      render(<ConnectionDot />);

      const connectionDot = screen.getByTestId('connection-dot');
      expect(connectionDot).toHaveAttribute('title', 'Connection error');
    });

    it('passes accessibility validation', () => {
      mockUseDashboardStore.mockImplementation((selector) => {
        const mockState = {
          realtime: {
            connectionStatus: 'connected',
            isRealTimeEnabled: true,
          },
        };
        return selector(mockState);
      });

      const { container } = render(<ConnectionDot />);

      const accessibilityIssues = checkAccessibility(container);
      expect(accessibilityIssues.length).toBe(0);
    });

    it('updates ARIA labels when status changes', () => {
      mockUseDashboardStore.mockImplementation((selector) => {
        const mockState = {
          realtime: {
            connectionStatus: 'connected',
            isRealTimeEnabled: true,
          },
        };
        return selector(mockState);
      });

      const { rerender } = render(<ConnectionDot />);

      let statusDot = screen.getByTestId('connection-status-dot');
      expect(statusDot).toHaveAttribute('aria-label', 'Connection status: Connected');

      // Change status
      mockUseDashboardStore.mockImplementation((selector) => {
        const mockState = {
          realtime: {
            connectionStatus: 'disconnected',
            isRealTimeEnabled: true,
          },
        };
        return selector(mockState);
      });

      rerender(<ConnectionDot />);

      statusDot = screen.getByTestId('connection-status-dot');
      expect(statusDot).toHaveAttribute('aria-label', 'Connection status: Disconnected');
    });
  });

  describe('Edge Cases & Error Handling', () => {
    it('handles missing realtime object gracefully', () => {
      mockUseDashboardStore.mockImplementation((selector) => {
        const mockState = {
          realtime: null,
        };
        return selector(mockState);
      });

      expect(() => {
        render(<ConnectionDot />);
      }).not.toThrow();

      const statusLabel = screen.getByTestId('connection-status-label');
      expect(statusLabel).toHaveTextContent('Disconnected');
    });

    it('handles undefined connectionStatus gracefully', () => {
      mockUseDashboardStore.mockImplementation((selector) => {
        const mockState = {
          realtime: {
            connectionStatus: undefined,
            isRealTimeEnabled: true,
          },
        };
        return selector(mockState);
      });

      expect(() => {
        render(<ConnectionDot />);
      }).not.toThrow();

      const statusLabel = screen.getByTestId('connection-status-label');
      expect(statusLabel).toHaveTextContent('Unknown');
    });

    it('handles undefined isRealTimeEnabled gracefully', () => {
      mockUseDashboardStore.mockImplementation((selector) => {
        const mockState = {
          realtime: {
            connectionStatus: 'connected',
            isRealTimeEnabled: undefined,
          },
        };
        return selector(mockState);
      });

      expect(() => {
        render(<ConnectionDot />);
      }).not.toThrow();

      const statusLabel = screen.getByTestId('connection-status-label');
      expect(statusLabel).toHaveTextContent('Offline');
    });

    it('handles store selector errors gracefully', () => {
      mockUseDashboardStore.mockImplementation(() => {
        throw new Error('Store error');
      });

      expect(() => {
        render(<ConnectionDot />);
      }).toThrow('Store error');
    });

    it('handles partial realtime object', () => {
      mockUseDashboardStore.mockImplementation((selector) => {
        const mockState = {
          realtime: {
            // Missing both connectionStatus and isRealTimeEnabled
          },
        };
        return selector(mockState);
      });

      expect(() => {
        render(<ConnectionDot />);
      }).not.toThrow();

      const statusLabel = screen.getByTestId('connection-status-label');
      expect(statusLabel).toHaveTextContent('Offline');
    });
  });

  describe('Performance', () => {
    it('renders efficiently with minimal re-renders', async () => {
      mockUseDashboardStore.mockImplementation((selector) => {
        const mockState = {
          realtime: {
            connectionStatus: 'connected',
            isRealTimeEnabled: true,
          },
        };
        return selector(mockState);
      });

      const { renderTime } = await measureRenderTime(async () => {
        return render(<ConnectionDot />);
      });

      expect(renderTime).toBeLessThan(10); // Very fast render
    });

    it('handles rapid status changes efficiently', () => {
      const statuses = ['connected', 'disconnected', 'connecting', 'error'];

      mockUseDashboardStore.mockImplementation((selector) => {
        const mockState = {
          realtime: {
            connectionStatus: 'connected',
            isRealTimeEnabled: true,
          },
        };
        return selector(mockState);
      });

      const { rerender } = render(<ConnectionDot />);

      // Rapidly change states
      statuses.forEach(status => {
        mockUseDashboardStore.mockImplementation((selector) => {
          const mockState = {
            realtime: {
              connectionStatus: status,
              isRealTimeEnabled: true,
            },
          };
          return selector(mockState);
        });

        rerender(<ConnectionDot />);
        expect(screen.getByTestId('connection-dot')).toBeInTheDocument();
      });
    });
  });

  describe('Integration Tests', () => {
    it('works correctly with SWR provider', () => {
      mockUseDashboardStore.mockImplementation((selector) => {
        const mockState = {
          realtime: {
            connectionStatus: 'connected',
            isRealTimeEnabled: true,
          },
        };
        return selector(mockState);
      });

      renderWithProviders(
        <ConnectionDot />,
        {
          swrConfig: {
            provider: () => new Map(),
            dedupingInterval: 0,
          }
        }
      );

      expect(screen.getByTestId('connection-dot')).toBeInTheDocument();
      expect(screen.getByText('Connected')).toBeInTheDocument();
    });

    it('integrates correctly with dashboard store', () => {
      mockUseDashboardStore.mockImplementation((selector) => {
        const mockState = {
          realtime: {
            connectionStatus: 'connecting',
            isRealTimeEnabled: true,
          },
        };
        return selector(mockState);
      });

      render(<ConnectionDot />);

      expect(mockUseDashboardStore).toHaveBeenCalledTimes(2); // Two selectors
      expect(screen.getByText('Connecting')).toBeInTheDocument();
    });

    it('maintains state consistency across re-renders', () => {
      mockUseDashboardStore.mockImplementation((selector) => {
        const mockState = {
          realtime: {
            connectionStatus: 'connected',
            isRealTimeEnabled: true,
          },
        };
        return selector(mockState);
      });

      const { rerender } = render(<ConnectionDot />);

      expect(screen.getByText('Connected')).toBeInTheDocument();

      // Re-render with same state
      rerender(<ConnectionDot />);

      expect(screen.getByText('Connected')).toBeInTheDocument();
    });
  });

  describe('Visual States Testing', () => {
    it('shows correct color for each connection state', () => {
      const colorTestCases = [
        { status: 'connected', expectedColor: 'bg-status-active' },
        { status: 'connecting', expectedColor: 'bg-status-awaiting' },
        { status: 'disconnected', expectedColor: 'bg-text-muted' },
        { status: 'error', expectedColor: 'bg-status-error' },
      ];

      colorTestCases.forEach(({ status, expectedColor }) => {
        mockUseDashboardStore.mockImplementation((selector) => {
          const mockState = {
            realtime: {
              connectionStatus: status,
              isRealTimeEnabled: true,
            },
          };
          return selector(mockState);
        });

        const { container } = render(<ConnectionDot />);

        const statusDot = screen.getByTestId('connection-status-dot');
        expect(statusDot).toHaveClass(expectedColor);

        container.remove();
      });
    });

    it('maintains visual consistency with transition classes', () => {
      mockUseDashboardStore.mockImplementation((selector) => {
        const mockState = {
          realtime: {
            connectionStatus: 'connected',
            isRealTimeEnabled: true,
          },
        };
        return selector(mockState);
      });

      render(<ConnectionDot />);

      const statusDot = screen.getByTestId('connection-status-dot');
      expect(statusDot).toHaveClass('transition-all', 'duration-300');
    });
  });
});