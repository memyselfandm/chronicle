import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConnectionStatus, useConnectionStatus } from '@/components/ConnectionStatus';
import type { ConnectionState } from '@/components/ConnectionStatus';

// Test component to test the hook
const TestHookComponent = () => {
  const { status, lastUpdate, updateStatus, recordUpdate, retry } = useConnectionStatus();
  
  return (
    <div>
      <div data-testid="hook-status">{status}</div>
      <div data-testid="hook-last-update">{lastUpdate?.toISOString() || 'null'}</div>
      <button onClick={() => updateStatus('connected')} data-testid="update-connected">Update Connected</button>
      <button onClick={() => updateStatus('error')} data-testid="update-error">Update Error</button>
      <button onClick={recordUpdate} data-testid="record-update">Record Update</button>
      <button onClick={retry} data-testid="retry">Retry</button>
    </div>
  );
};

describe('ConnectionStatus Component', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-01-15T14:30:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders with connected status', () => {
    render(<ConnectionStatus status="connected" />);
    
    expect(screen.getByTestId('connection-status')).toBeInTheDocument();
    expect(screen.getByTestId('status-indicator')).toHaveClass('bg-accent-green');
    expect(screen.getByTestId('status-text')).toHaveTextContent('Connected');
  });

  it('renders with connecting status and shows animation', () => {
    render(<ConnectionStatus status="connecting" />);
    
    const indicator = screen.getByTestId('status-indicator');
    expect(indicator).toHaveClass('bg-accent-yellow');
    expect(indicator).toHaveClass('animate-pulse');
    expect(screen.getByTestId('status-text')).toHaveTextContent('Connecting');
  });

  it('renders with disconnected status', () => {
    render(<ConnectionStatus status="disconnected" />);
    
    expect(screen.getByTestId('status-indicator')).toHaveClass('bg-text-muted');
    expect(screen.getByTestId('status-text')).toHaveTextContent('Disconnected');
  });

  it('renders with error status and shows retry button', () => {
    const onRetry = jest.fn();
    render(<ConnectionStatus status="error" onRetry={onRetry} />);
    
    expect(screen.getByTestId('status-indicator')).toHaveClass('bg-accent-red');
    expect(screen.getByTestId('status-text')).toHaveTextContent('Error');
    
    const retryButton = screen.getByTestId('retry-button');
    expect(retryButton).toBeInTheDocument();
    
    fireEvent.click(retryButton);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('does not show text when showText is false', () => {
    render(<ConnectionStatus status="connected" showText={false} />);
    
    expect(screen.getByTestId('status-indicator')).toBeInTheDocument();
    expect(screen.queryByTestId('status-text')).not.toBeInTheDocument();
  });

  it('displays last update time when provided', () => {
    const lastUpdate = new Date('2024-01-15T14:29:30.000Z');
    render(<ConnectionStatus status="connected" lastUpdate={lastUpdate} />);
    
    const lastUpdateElement = screen.getByTestId('last-update');
    expect(lastUpdateElement).toBeInTheDocument();
    expect(lastUpdateElement).toHaveTextContent('30s ago');
  });

  it('formats last update time correctly for different intervals', () => {
    const { rerender } = render(
      <ConnectionStatus 
        status="connected" 
        lastUpdate={new Date('2024-01-15T14:29:30.000Z')} 
      />
    );
    
    // 30 seconds ago
    expect(screen.getByTestId('last-update')).toHaveTextContent('30s ago');
    
    // 2 minutes ago
    rerender(
      <ConnectionStatus 
        status="connected" 
        lastUpdate={new Date('2024-01-15T14:28:00.000Z')} 
      />
    );
    expect(screen.getByTestId('last-update')).toHaveTextContent('2m ago');
    
    // 2 hours ago
    rerender(
      <ConnectionStatus 
        status="connected" 
        lastUpdate={new Date('2024-01-15T12:30:00.000Z')} 
      />
    );
    expect(screen.getByTestId('last-update')).toHaveTextContent('12:30:00');
  });

  it('handles string timestamp for last update', () => {
    render(
      <ConnectionStatus 
        status="connected" 
        lastUpdate="2024-01-15T14:29:30.000Z" 
      />
    );
    
    expect(screen.getByTestId('last-update')).toHaveTextContent('30s ago');
  });

  it('shows details tooltip when status text is clicked', async () => {
    const user = userEvent.setup({ delay: null });
    const lastUpdate = new Date('2024-01-15T14:29:30.000Z');
    
    render(<ConnectionStatus status="connected" lastUpdate={lastUpdate} />);
    
    const statusText = screen.getByTestId('status-text');
    await user.click(statusText);
    
    const details = screen.getByTestId('status-details');
    expect(details).toBeInTheDocument();
    expect(details).toHaveTextContent('Connected');
    expect(details).toHaveTextContent('Receiving real-time updates');
    expect(details).toHaveTextContent('30s ago');
    expect(details).toHaveTextContent('Real-time active');
  });

  it('shows details tooltip when status text is activated with keyboard', async () => {
    const user = userEvent.setup({ delay: null });
    
    render(<ConnectionStatus status="connected" />);
    
    const statusText = screen.getByTestId('status-text');
    statusText.focus();
    await user.keyboard('{Enter}');
    
    expect(screen.getByTestId('status-details')).toBeInTheDocument();
    
    // Test space key as well
    await user.click(screen.getByTestId('close-details'));
    await user.keyboard(' ');
    
    expect(screen.getByTestId('status-details')).toBeInTheDocument();
  });

  it('closes details when close button is clicked', async () => {
    const user = userEvent.setup({ delay: null });
    
    render(<ConnectionStatus status="connected" />);
    
    // Open details
    await user.click(screen.getByTestId('status-text'));
    expect(screen.getByTestId('status-details')).toBeInTheDocument();
    
    // Close details
    await user.click(screen.getByTestId('close-details'));
    expect(screen.queryByTestId('status-details')).not.toBeInTheDocument();
  });

  it('closes details when backdrop is clicked', async () => {
    const user = userEvent.setup({ delay: null });
    
    render(<ConnectionStatus status="connected" />);
    
    // Open details
    await user.click(screen.getByTestId('status-text'));
    expect(screen.getByTestId('status-details')).toBeInTheDocument();
    
    // Click backdrop
    await user.click(screen.getByTestId('details-backdrop'));
    expect(screen.queryByTestId('status-details')).not.toBeInTheDocument();
  });

  it('shows correct descriptions for different statuses', async () => {
    const user = userEvent.setup({ delay: null });
    const { rerender } = render(<ConnectionStatus status="connected" />);
    
    // Connected status
    await user.click(screen.getByTestId('status-text'));
    expect(screen.getByText('Receiving real-time updates')).toBeInTheDocument();
    expect(screen.getByText('Real-time active')).toBeInTheDocument();
    
    // Close and test disconnected
    await user.click(screen.getByTestId('close-details'));
    rerender(<ConnectionStatus status="disconnected" />);
    await user.click(screen.getByTestId('status-text'));
    expect(screen.getByText('Connection lost - attempting to reconnect')).toBeInTheDocument();
    expect(screen.getByText('Real-time inactive')).toBeInTheDocument();
    
    // Close and test error
    await user.click(screen.getByTestId('close-details'));
    rerender(<ConnectionStatus status="error" />);
    await user.click(screen.getByTestId('status-text'));
    expect(screen.getByText('Connection error occurred')).toBeInTheDocument();
  });

  it('handles null last update gracefully', () => {
    render(<ConnectionStatus status="connected" lastUpdate={null} />);
    
    expect(screen.queryByTestId('last-update')).not.toBeInTheDocument();
  });

  it('handles invalid timestamp gracefully', () => {
    render(<ConnectionStatus status="connected" lastUpdate="invalid-date" />);
    
    const lastUpdate = screen.getByTestId('last-update');
    expect(lastUpdate).toHaveTextContent('Invalid date');
  });

  it('applies custom className', () => {
    render(<ConnectionStatus status="connected" className="custom-class" />);
    
    expect(screen.getByTestId('connection-status')).toHaveClass('custom-class');
  });

  it('shows absolute time in tooltip title', () => {
    const lastUpdate = new Date('2024-01-15T14:29:30.000Z');
    render(<ConnectionStatus status="connected" lastUpdate={lastUpdate} />);
    
    const lastUpdateElement = screen.getByTestId('last-update');
    expect(lastUpdateElement).toHaveAttribute('title', 'Jan 15, 2024 at 14:29:30');
  });

  it('shows no updates message when lastUpdate is null in details', async () => {
    const user = userEvent.setup({ delay: null });
    
    render(<ConnectionStatus status="connected" lastUpdate={null} />);
    
    await user.click(screen.getByTestId('status-text'));
    expect(screen.getByText('No updates received')).toBeInTheDocument();
  });
});

describe('useConnectionStatus Hook', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2024-01-15T14:30:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('initializes with disconnected status by default', () => {
    render(<TestHookComponent />);
    
    expect(screen.getByTestId('hook-status')).toHaveTextContent('disconnected');
    expect(screen.getByTestId('hook-last-update')).toHaveTextContent('null');
  });

  it('initializes with provided initial status', () => {
    const TestComponentWithInitial = () => {
      const { status } = useConnectionStatus('connected');
      return <div data-testid="hook-status">{status}</div>;
    };
    
    render(<TestComponentWithInitial />);
    expect(screen.getByTestId('hook-status')).toHaveTextContent('connected');
  });

  it('updates status correctly', () => {
    render(<TestHookComponent />);
    
    expect(screen.getByTestId('hook-status')).toHaveTextContent('disconnected');
    
    fireEvent.click(screen.getByTestId('update-connected'));
    expect(screen.getByTestId('hook-status')).toHaveTextContent('connected');
  });

  it('updates lastUpdate when status changes to connected', () => {
    render(<TestHookComponent />);
    
    expect(screen.getByTestId('hook-last-update')).toHaveTextContent('null');
    
    fireEvent.click(screen.getByTestId('update-connected'));
    expect(screen.getByTestId('hook-last-update')).toHaveTextContent('2024-01-15T14:30:00.000Z');
  });

  it('does not update lastUpdate for non-connected status changes', () => {
    render(<TestHookComponent />);
    
    fireEvent.click(screen.getByTestId('update-error'));
    expect(screen.getByTestId('hook-status')).toHaveTextContent('error');
    expect(screen.getByTestId('hook-last-update')).toHaveTextContent('null');
  });

  it('records update timestamp independently', () => {
    render(<TestHookComponent />);
    
    expect(screen.getByTestId('hook-last-update')).toHaveTextContent('null');
    
    fireEvent.click(screen.getByTestId('record-update'));
    expect(screen.getByTestId('hook-last-update')).toHaveTextContent('2024-01-15T14:30:00.000Z');
  });

  it('sets status to connecting when retry is called', () => {
    render(<TestHookComponent />);
    
    // First set to error
    fireEvent.click(screen.getByTestId('update-error'));
    expect(screen.getByTestId('hook-status')).toHaveTextContent('error');
    
    // Then retry
    fireEvent.click(screen.getByTestId('retry'));
    expect(screen.getByTestId('hook-status')).toHaveTextContent('connecting');
  });

  it('handles multiple status updates correctly', () => {
    render(<TestHookComponent />);
    
    // Start with disconnected
    expect(screen.getByTestId('hook-status')).toHaveTextContent('disconnected');
    
    // Update to connected (should set lastUpdate)
    fireEvent.click(screen.getByTestId('update-connected'));
    expect(screen.getByTestId('hook-status')).toHaveTextContent('connected');
    expect(screen.getByTestId('hook-last-update')).toHaveTextContent('2024-01-15T14:30:00.000Z');
    
    // Advance time and record another update
    act(() => {
      jest.advanceTimersByTime(30000); // 30 seconds
    });
    
    fireEvent.click(screen.getByTestId('record-update'));
    expect(screen.getByTestId('hook-last-update')).toHaveTextContent('2024-01-15T14:30:30.000Z');
    
    // Update to error (should not change lastUpdate)
    const previousLastUpdate = screen.getByTestId('hook-last-update').textContent;
    fireEvent.click(screen.getByTestId('update-error'));
    expect(screen.getByTestId('hook-status')).toHaveTextContent('error');
    expect(screen.getByTestId('hook-last-update')).toHaveTextContent(previousLastUpdate!);
  });
});