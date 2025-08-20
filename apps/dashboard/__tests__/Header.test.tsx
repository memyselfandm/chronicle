import { render, screen } from '@testing-library/react';
import { Header } from '@/components/layout/Header';

describe('Header Component', () => {
  it('renders Chronicle title and subtitle', () => {
    render(<Header />);
    
    expect(screen.getByText('Chronicle')).toBeInTheDocument();
    expect(screen.getByText('Multi-Agent Observability')).toBeInTheDocument();
  });

  it('displays connection status indicator', () => {
    render(<Header />);
    
    // Should start with "Connecting" status
    expect(screen.getByText('Connecting')).toBeInTheDocument();
  });

  it('shows event counter', () => {
    render(<Header />);
    
    expect(screen.getByText('Events:')).toBeInTheDocument();
    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('renders settings navigation', () => {
    render(<Header />);
    
    expect(screen.getByText('Settings')).toBeInTheDocument();
  });

  it('has proper accessibility attributes', () => {
    render(<Header />);
    
    const statusIndicator = screen.getByLabelText(/Connection status:/);
    expect(statusIndicator).toBeInTheDocument();
  });
});