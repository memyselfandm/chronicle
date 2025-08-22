/**
 * ResponsiveGrid Component Tests
 * 
 * Tests:
 * - Responsive breakpoint detection
 * - Grid layout calculations
 * - Mobile overlay functionality
 * - CSS Grid template generation
 * - Viewport resize handling
 * - Accessibility features
 */

import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { ResponsiveGrid, useBreakpoint, useIsMobile, useIsTabletOrSmaller } from '@/components/ResponsiveGrid';

// Mock window.innerWidth
const mockInnerWidth = (width: number) => {
  Object.defineProperty(window, 'innerWidth', {
    writable: true,
    configurable: true,
    value: width,
  });
};

// Mock window resize events
const triggerResize = () => {
  window.dispatchEvent(new Event('resize'));
};

describe('ResponsiveGrid', () => {
  beforeEach(() => {
    // Reset to desktop width
    mockInnerWidth(1200);
    jest.clearAllMocks();
  });

  describe('Component Rendering', () => {
    it('renders with basic props', () => {
      render(
        <ResponsiveGrid sidebarCollapsed={false}>
          <div data-testid="child">Child Content</div>
        </ResponsiveGrid>
      );

      expect(screen.getByTestId('responsive-grid')).toBeInTheDocument();
      expect(screen.getByTestId('child')).toBeInTheDocument();
    });

    it('applies custom className', () => {
      render(
        <ResponsiveGrid sidebarCollapsed={false} className="custom-class">
          <div>Content</div>
        </ResponsiveGrid>
      );

      const grid = screen.getByTestId('responsive-grid');
      expect(grid).toHaveClass('custom-class');
    });

    it('sets correct data attributes', () => {
      render(
        <ResponsiveGrid sidebarCollapsed={true}>
          <div>Content</div>
        </ResponsiveGrid>
      );

      const grid = screen.getByTestId('responsive-grid');
      expect(grid).toHaveAttribute('data-breakpoint', 'desktop');
      expect(grid).toHaveAttribute('data-sidebar-collapsed', 'true');
    });
  });

  describe('Breakpoint Detection', () => {
    it('detects desktop breakpoint (>1024px)', async () => {
      mockInnerWidth(1200);
      
      render(
        <ResponsiveGrid sidebarCollapsed={false}>
          <div>Content</div>
        </ResponsiveGrid>
      );

      await waitFor(() => {
        const grid = screen.getByTestId('responsive-grid');
        expect(grid).toHaveAttribute('data-breakpoint', 'desktop');
      });
    });

    it('detects tablet breakpoint (768-1024px)', async () => {
      mockInnerWidth(800);
      
      render(
        <ResponsiveGrid sidebarCollapsed={false}>
          <div>Content</div>
        </ResponsiveGrid>
      );

      act(() => {
        triggerResize();
      });

      await waitFor(() => {
        const grid = screen.getByTestId('responsive-grid');
        expect(grid).toHaveAttribute('data-breakpoint', 'tablet');
      });
    });

    it('detects mobile breakpoint (<768px)', async () => {
      mockInnerWidth(600);
      
      render(
        <ResponsiveGrid sidebarCollapsed={false}>
          <div>Content</div>
        </ResponsiveGrid>
      );

      act(() => {
        triggerResize();
      });

      await waitFor(() => {
        const grid = screen.getByTestId('responsive-grid');
        expect(grid).toHaveAttribute('data-breakpoint', 'mobile');
      });
    });

    it('updates breakpoint on window resize', async () => {
      const { rerender } = render(
        <ResponsiveGrid sidebarCollapsed={false}>
          <div>Content</div>
        </ResponsiveGrid>
      );

      // Start at desktop
      let grid = screen.getByTestId('responsive-grid');
      expect(grid).toHaveAttribute('data-breakpoint', 'desktop');

      // Resize to mobile
      mockInnerWidth(600);
      act(() => {
        triggerResize();
      });

      await waitFor(() => {
        grid = screen.getByTestId('responsive-grid');
        expect(grid).toHaveAttribute('data-breakpoint', 'mobile');
      });

      // Resize back to desktop
      mockInnerWidth(1200);
      act(() => {
        triggerResize();
      });

      await waitFor(() => {
        grid = screen.getByTestId('responsive-grid');
        expect(grid).toHaveAttribute('data-breakpoint', 'desktop');
      });
    });
  });

  describe('Mobile Overlay', () => {
    beforeEach(() => {
      mockInnerWidth(600); // Mobile width
    });

    it('shows overlay when sidebar is open on mobile', async () => {
      render(
        <ResponsiveGrid sidebarCollapsed={false}>
          <div>Content</div>
        </ResponsiveGrid>
      );

      act(() => {
        triggerResize();
      });

      await waitFor(() => {
        expect(screen.getByTestId('mobile-overlay')).toBeInTheDocument();
      });
    });

    it('hides overlay when sidebar is collapsed on mobile', async () => {
      render(
        <ResponsiveGrid sidebarCollapsed={true}>
          <div>Content</div>
        </ResponsiveGrid>
      );

      act(() => {
        triggerResize();
      });

      await waitFor(() => {
        expect(screen.queryByTestId('mobile-overlay')).not.toBeInTheDocument();
      });
    });

    it('dispatches sidebar-toggle event when overlay is clicked', async () => {
      const eventSpy = jest.spyOn(window, 'dispatchEvent');
      
      render(
        <ResponsiveGrid sidebarCollapsed={false}>
          <div>Content</div>
        </ResponsiveGrid>
      );

      act(() => {
        triggerResize();
      });

      await waitFor(() => {
        const overlay = screen.getByTestId('mobile-overlay');
        fireEvent.click(overlay);
      });

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'sidebar-toggle'
        })
      );
    });

    it('does not show overlay on non-mobile breakpoints', async () => {
      mockInnerWidth(1000); // Tablet width
      
      render(
        <ResponsiveGrid sidebarCollapsed={false}>
          <div>Content</div>
        </ResponsiveGrid>
      );

      act(() => {
        triggerResize();
      });

      await waitFor(() => {
        expect(screen.queryByTestId('mobile-overlay')).not.toBeInTheDocument();
      });
    });
  });

  describe('Loading State', () => {
    it('applies pointer-events-none when loading', () => {
      render(
        <ResponsiveGrid sidebarCollapsed={false} loading={true}>
          <div>Content</div>
        </ResponsiveGrid>
      );

      const grid = screen.getByTestId('responsive-grid');
      expect(grid).toHaveClass('pointer-events-none');
    });

    it('does not apply loading styles when not loading', () => {
      render(
        <ResponsiveGrid sidebarCollapsed={false} loading={false}>
          <div>Content</div>
        </ResponsiveGrid>
      );

      const grid = screen.getByTestId('responsive-grid');
      expect(grid).not.toHaveClass('pointer-events-none');
    });
  });

  describe('Development Mode', () => {
    const originalEnv = process.env.NODE_ENV;

    beforeEach(() => {
      process.env.NODE_ENV = 'development';
    });

    afterEach(() => {
      process.env.NODE_ENV = originalEnv;
    });

    it('shows debug info in development mode', () => {
      render(
        <ResponsiveGrid sidebarCollapsed={false}>
          <div>Content</div>
        </ResponsiveGrid>
      );

      expect(screen.getByText(/Breakpoint:/)).toBeInTheDocument();
      expect(screen.getByText(/Sidebar:/)).toBeInTheDocument();
      expect(screen.getByText(/Width:/)).toBeInTheDocument();
    });

    it('shows correct debug values', () => {
      render(
        <ResponsiveGrid sidebarCollapsed={true}>
          <div>Content</div>
        </ResponsiveGrid>
      );

      expect(screen.getByText('Breakpoint: desktop')).toBeInTheDocument();
      expect(screen.getByText('Sidebar: collapsed')).toBeInTheDocument();
      expect(screen.getByText('Width: 48px')).toBeInTheDocument();
    });
  });

  describe('SSR Hydration', () => {
    it('handles mounting state correctly', () => {
      const { container } = render(
        <ResponsiveGrid sidebarCollapsed={false}>
          <div>Content</div>
        </ResponsiveGrid>
      );

      // Should render the responsive grid
      expect(screen.getByTestId('responsive-grid')).toBeInTheDocument();
    });
  });

  describe('Event Cleanup', () => {
    it('removes resize event listener on unmount', () => {
      const removeEventListenerSpy = jest.spyOn(window, 'removeEventListener');
      
      const { unmount } = render(
        <ResponsiveGrid sidebarCollapsed={false}>
          <div>Content</div>
        </ResponsiveGrid>
      );

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith('resize', expect.any(Function));
    });
  });
});

describe('useBreakpoint Hook', () => {
  beforeEach(() => {
    mockInnerWidth(1200);
    jest.clearAllMocks();
  });

  it('returns correct initial breakpoint', () => {
    let breakpoint: string;
    
    const TestComponent = () => {
      breakpoint = useBreakpoint();
      return <div data-testid="test">{breakpoint}</div>;
    };

    render(<TestComponent />);
    expect(screen.getByTestId('test')).toHaveTextContent('desktop');
  });

  it('updates breakpoint on resize', async () => {
    let breakpoint: string;
    
    const TestComponent = () => {
      breakpoint = useBreakpoint();
      return <div data-testid="test">{breakpoint}</div>;
    };

    render(<TestComponent />);
    expect(screen.getByTestId('test')).toHaveTextContent('desktop');

    // Resize to mobile
    mockInnerWidth(600);
    act(() => {
      triggerResize();
    });

    await waitFor(() => {
      expect(screen.getByTestId('test')).toHaveTextContent('mobile');
    });
  });
});

describe('useIsMobile Hook', () => {
  beforeEach(() => {
    mockInnerWidth(1200);
  });

  it('returns false for desktop width', () => {
    const TestComponent = () => {
      const isMobile = useIsMobile();
      return <div data-testid="test">{isMobile.toString()}</div>;
    };

    render(<TestComponent />);
    expect(screen.getByTestId('test')).toHaveTextContent('false');
  });

  it('returns true for mobile width', async () => {
    mockInnerWidth(600);
    
    const TestComponent = () => {
      const isMobile = useIsMobile();
      return <div data-testid="test">{isMobile.toString()}</div>;
    };

    render(<TestComponent />);

    act(() => {
      triggerResize();
    });

    await waitFor(() => {
      expect(screen.getByTestId('test')).toHaveTextContent('true');
    });
  });
});

describe('useIsTabletOrSmaller Hook', () => {
  beforeEach(() => {
    mockInnerWidth(1200);
  });

  it('returns false for desktop width', () => {
    const TestComponent = () => {
      const isTabletOrSmaller = useIsTabletOrSmaller();
      return <div data-testid="test">{isTabletOrSmaller.toString()}</div>;
    };

    render(<TestComponent />);
    expect(screen.getByTestId('test')).toHaveTextContent('false');
  });

  it('returns true for tablet width', async () => {
    mockInnerWidth(800);
    
    const TestComponent = () => {
      const isTabletOrSmaller = useIsTabletOrSmaller();
      return <div data-testid="test">{isTabletOrSmaller.toString()}</div>;
    };

    render(<TestComponent />);

    act(() => {
      triggerResize();
    });

    await waitFor(() => {
      expect(screen.getByTestId('test')).toHaveTextContent('true');
    });
  });

  it('returns true for mobile width', async () => {
    mockInnerWidth(600);
    
    const TestComponent = () => {
      const isTabletOrSmaller = useIsTabletOrSmaller();
      return <div data-testid="test">{isTabletOrSmaller.toString()}</div>;
    };

    render(<TestComponent />);

    act(() => {
      triggerResize();
    });

    await waitFor(() => {
      expect(screen.getByTestId('test')).toHaveTextContent('true');
    });
  });
});