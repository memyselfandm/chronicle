/**
 * ConnectionDot Component Tests
 * Tests for simple connection status indicator in header
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { jest } from '@jest/globals';
import { ConnectionDot } from '../src/components/layout/ConnectionDot';

// Mock the dashboard store with a simpler approach
const mockConnectionStatus = jest.fn();
const mockIsRealTimeEnabled = jest.fn();

jest.mock('../src/stores/dashboardStore', () => ({
  useDashboardStore: jest.fn((selector) => {
    // Simulate the actual selector behavior
    const mockState = {
      realtime: {
        connectionStatus: mockConnectionStatus(),
        isRealTimeEnabled: mockIsRealTimeEnabled()
      }
    };
    return selector(mockState);
  })
}));

describe('ConnectionDot', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const setupStore = (connectionStatus: string, isRealTimeEnabled: boolean = true) => {
    mockConnectionStatus.mockReturnValue(connectionStatus);
    mockIsRealTimeEnabled.mockReturnValue(isRealTimeEnabled);
  };

  it('renders the connection dot component', () => {
    setupStore('connected');
    render(<ConnectionDot />);
    
    const connectionDot = screen.getByTestId('connection-dot');
    expect(connectionDot).toBeInTheDocument();
  });

  it('shows connected status correctly', () => {
    setupStore('connected');
    render(<ConnectionDot />);
    
    const dot = screen.getByTestId('connection-status-dot');
    const label = screen.getByTestId('connection-status-label');
    
    expect(dot).toHaveClass('bg-status-active');
    expect(label).toHaveTextContent('Connected');
    expect(dot).toHaveAttribute('aria-label', 'Connection status: Connected');
  });

  it('shows connecting status with pulse animation', () => {
    setupStore('connecting');
    render(<ConnectionDot />);
    
    const dot = screen.getByTestId('connection-status-dot');
    const label = screen.getByTestId('connection-status-label');
    
    expect(dot).toHaveClass('bg-status-awaiting');
    expect(dot).toHaveClass('animate-pulse');
    expect(label).toHaveTextContent('Connecting');
  });

  it('shows disconnected status', () => {
    setupStore('disconnected');
    render(<ConnectionDot />);
    
    const dot = screen.getByTestId('connection-status-dot');
    const label = screen.getByTestId('connection-status-label');
    
    expect(dot).toHaveClass('bg-text-muted');
    expect(label).toHaveTextContent('Disconnected');
  });

  it('shows error status', () => {
    setupStore('error');
    render(<ConnectionDot />);
    
    const dot = screen.getByTestId('connection-status-dot');
    const label = screen.getByTestId('connection-status-label');
    
    expect(dot).toHaveClass('bg-status-error');
    expect(label).toHaveTextContent('Error');
  });

  it('shows offline when real-time is disabled', () => {
    setupStore('connected', false);
    render(<ConnectionDot />);
    
    const dot = screen.getByTestId('connection-status-dot');
    const label = screen.getByTestId('connection-status-label');
    
    expect(dot).toHaveClass('bg-text-muted');
    expect(label).toHaveTextContent('Offline');
  });

  it('handles unknown status', () => {
    setupStore('unknown');
    render(<ConnectionDot />);
    
    const dot = screen.getByTestId('connection-status-dot');
    const label = screen.getByTestId('connection-status-label');
    
    expect(dot).toHaveClass('bg-text-muted');
    expect(label).toHaveTextContent('Unknown');
  });

  it('can hide label when requested', () => {
    setupStore('connected');
    render(<ConnectionDot showLabel={false} />);
    
    const dot = screen.getByTestId('connection-status-dot');
    const label = screen.queryByTestId('connection-status-label');
    
    expect(dot).toBeInTheDocument();
    expect(label).not.toBeInTheDocument();
  });

  it('shows label by default', () => {
    setupStore('connected');
    render(<ConnectionDot />);
    
    const label = screen.getByTestId('connection-status-label');
    expect(label).toBeInTheDocument();
  });

  it('applies custom className', () => {
    setupStore('connected');
    const customClass = 'custom-connection-class';
    render(<ConnectionDot className={customClass} />);
    
    const connectionDot = screen.getByTestId('connection-dot');
    expect(connectionDot).toHaveClass(customClass);
  });

  it('provides appropriate tooltips', () => {
    const testCases = [
      { status: 'connected', enabled: true, expectedTooltip: 'Real-time connection active' },
      { status: 'connecting', enabled: true, expectedTooltip: 'Establishing connection...' },
      { status: 'disconnected', enabled: true, expectedTooltip: 'Connection lost' },
      { status: 'error', enabled: true, expectedTooltip: 'Connection error' },
      { status: 'connected', enabled: false, expectedTooltip: 'Real-time disabled' }
    ];

    testCases.forEach(({ status, enabled, expectedTooltip }) => {
      setupStore(status, enabled);
      const { unmount } = render(<ConnectionDot />);
      
      const connectionDot = screen.getByTestId('connection-dot');
      expect(connectionDot).toHaveAttribute('title', expectedTooltip);
      
      unmount();
    });
  });

  it('has proper accessibility attributes', () => {
    setupStore('connected');
    render(<ConnectionDot />);
    
    const dot = screen.getByTestId('connection-status-dot');
    expect(dot).toHaveAttribute('aria-label', 'Connection status: Connected');
  });

  it('applies transition animation', () => {
    setupStore('connected');
    render(<ConnectionDot />);
    
    const dot = screen.getByTestId('connection-status-dot');
    expect(dot).toHaveClass('transition-all');
    expect(dot).toHaveClass('duration-300');
  });

  it('only pulses during connecting state', () => {
    const states = ['connected', 'disconnected', 'error'];
    
    states.forEach(status => {
      setupStore(status);
      const { unmount } = render(<ConnectionDot />);
      
      const dot = screen.getByTestId('connection-status-dot');
      expect(dot).not.toHaveClass('animate-pulse');
      
      unmount();
    });
  });

  it('uses appropriate text styling for label', () => {
    setupStore('connected');
    render(<ConnectionDot />);
    
    const label = screen.getByTestId('connection-status-label');
    expect(label).toHaveClass('text-xs');
    expect(label).toHaveClass('text-text-secondary');
    expect(label).toHaveClass('font-medium');
  });
});