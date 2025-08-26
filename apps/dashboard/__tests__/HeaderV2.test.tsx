/**
 * HeaderV2 Component Tests
 * Tests for the new real-time dashboard header with metrics and connection status
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { jest } from '@jest/globals';
import { HeaderV2 } from '../src/components/layout/HeaderV2';

// Mock the sub-components to isolate testing
jest.mock('../src/components/layout/MetricsDisplay', () => ({
  MetricsDisplay: () => <div data-testid="metrics-display">Mocked Metrics</div>
}));

jest.mock('../src/components/layout/ConnectionDot', () => ({
  ConnectionDot: () => <div data-testid="connection-dot">Mocked Connection</div>
}));

describe('HeaderV2', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the header with correct structure', () => {
    render(<HeaderV2 />);
    
    // Check main header element
    const header = screen.getByTestId('header-v2');
    expect(header).toBeInTheDocument();
    expect(header.tagName).toBe('HEADER');
  });

  it('displays the Chronicle Dashboard title', () => {
    render(<HeaderV2 />);
    
    const title = screen.getByText('Chronicle Dashboard');
    expect(title).toBeInTheDocument();
    expect(title.tagName).toBe('H1');
  });

  it('includes the MetricsDisplay component', () => {
    render(<HeaderV2 />);
    
    const metricsDisplay = screen.getByTestId('metrics-display');
    expect(metricsDisplay).toBeInTheDocument();
  });

  it('includes the ConnectionDot component', () => {
    render(<HeaderV2 />);
    
    const connectionDot = screen.getByTestId('connection-dot');
    expect(connectionDot).toBeInTheDocument();
  });

  it('applies correct CSS classes for layout', () => {
    render(<HeaderV2 />);
    
    const header = screen.getByTestId('header-v2');
    
    // Check for essential layout classes
    expect(header).toHaveClass('bg-bg-secondary');
    expect(header).toHaveClass('border-b');
    expect(header).toHaveClass('border-border');
    expect(header).toHaveClass('h-10'); // 40px height requirement
    expect(header).toHaveClass('flex');
    expect(header).toHaveClass('items-center');
    expect(header).toHaveClass('justify-between');
    expect(header).toHaveClass('sticky');
    expect(header).toHaveClass('top-0');
  });

  it('accepts custom className', () => {
    const customClass = 'custom-header-class';
    render(<HeaderV2 className={customClass} />);
    
    const header = screen.getByTestId('header-v2');
    expect(header).toHaveClass(customClass);
  });

  it('has proper semantic structure for accessibility', () => {
    render(<HeaderV2 />);
    
    const header = screen.getByRole('banner');
    expect(header).toBeInTheDocument();
    
    const title = screen.getByRole('heading', { level: 1 });
    expect(title).toBeInTheDocument();
    expect(title).toHaveTextContent('Chronicle Dashboard');
  });

  it('maintains fixed height for maximum content space', () => {
    render(<HeaderV2 />);
    
    const header = screen.getByTestId('header-v2');
    // The h-10 class corresponds to 40px height (2.5rem)
    expect(header).toHaveClass('h-10');
  });

  it('has sticky positioning for scroll behavior', () => {
    render(<HeaderV2 />);
    
    const header = screen.getByTestId('header-v2');
    expect(header).toHaveClass('sticky');
    expect(header).toHaveClass('top-0');
    expect(header).toHaveClass('z-50'); // High z-index for layering
  });

  it('follows dark theme color scheme', () => {
    render(<HeaderV2 />);
    
    const header = screen.getByTestId('header-v2');
    expect(header).toHaveClass('bg-bg-secondary'); // Dark background
    expect(header).toHaveClass('border-border'); // Dark border
    
    const title = screen.getByText('Chronicle Dashboard');
    expect(title).toHaveClass('text-text-primary'); // Light text
  });

  it('uses minimal padding for height constraints', () => {
    render(<HeaderV2 />);
    
    const header = screen.getByTestId('header-v2');
    expect(header).toHaveClass('px-6'); // Horizontal padding
    expect(header).toHaveClass('py-0'); // No vertical padding for minimal height
  });
});