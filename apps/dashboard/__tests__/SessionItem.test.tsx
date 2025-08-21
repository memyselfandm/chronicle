import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { SessionItem } from '@/components/sidebar/SessionItem';
import { useDashboardStore } from '@/stores/dashboardStore';

// Mock the dashboard store
jest.mock('@/stores/dashboardStore');
const mockUseDashboardStore = useDashboardStore as jest.MockedFunction<typeof useDashboardStore>;

const mockSession = {
  id: 'session123',
  status: 'active' as const,
  startTime: new Date('2024-01-01T10:00:00Z'),
  endTime: undefined,
  toolsUsed: 5,
  eventsCount: 10,
  lastActivity: new Date('2024-01-01T10:30:00Z'),
};

const mockStoreData = {
  ui: { selectedSession: null },
  setSelectedSession: jest.fn(),
  events: [
    {
      id: 'event1',
      sessionId: 'session123',
      type: 'user_prompt_submit',
      timestamp: new Date('2024-01-01T10:00:00Z'),
      metadata: {},
      status: 'active' as const,
    },
    {
      id: 'event2',
      sessionId: 'session123',
      type: 'pre_tool_use',
      timestamp: new Date('2024-01-01T10:15:00Z'),
      metadata: { tool_name: 'Read' },
      status: 'active' as const,
    },
  ],
  getSessionEvents: jest.fn(),
  isSessionSelected: jest.fn(),
};

describe('SessionItem', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStoreData.getSessionEvents.mockReturnValue(mockStoreData.events);
    mockStoreData.isSessionSelected.mockReturnValue(false);
    mockUseDashboardStore.mockReturnValue(mockStoreData as any);
  });

  it('renders session item correctly', () => {
    render(<SessionItem session={mockSession} isAwaiting={false} />);
    
    expect(screen.getByText('Session session12')).toBeInTheDocument();
    expect(screen.getByText('2 events')).toBeInTheDocument();
  });

  it('renders awaiting session with yellow indicator', () => {
    render(<SessionItem session={mockSession} isAwaiting={true} compact={true} />);
    
    // Should have yellow dot indicator for awaiting status
    const container = screen.getByText('Session session12').closest('div');
    expect(container).toHaveClass('bg-yellow-400');
  });

  it('shows selected state correctly', () => {
    const selectedMockData = {
      ...mockStoreData,
      ui: { selectedSession: 'session123' },
      isSessionSelected: jest.fn().mockReturnValue(true)
    };
    mockUseDashboardStore.mockReturnValue(selectedMockData as any);

    render(<SessionItem session={mockSession} isAwaiting={false} />);
    
    const container = screen.getByText('Session session12').closest('div');
    expect(container).toHaveClass('bg-blue-600/20');
  });

  it('handles click to select session', () => {
    render(<SessionItem session={mockSession} isAwaiting={false} />);
    
    fireEvent.click(screen.getByText('Session session12'));
    
    expect(mockStoreData.setSelectedSession).toHaveBeenCalledWith('session123');
  });

  it('renders compact mode correctly', () => {
    render(<SessionItem session={mockSession} isAwaiting={false} compact={true} />);
    
    // In compact mode, should not show the events count
    expect(screen.queryByText('2 events')).not.toBeInTheDocument();
  });

  it('displays correct status colors', () => {
    // Test active status (green)
    const { rerender } = render(<SessionItem session={mockSession} isAwaiting={false} />);
    expect(screen.getByText('Session session12').parentElement?.querySelector('.bg-green-400')).toBeInTheDocument();

    // Test awaiting status (yellow)
    rerender(<SessionItem session={mockSession} isAwaiting={true} />);
    expect(screen.getByText('Session session12').parentElement?.querySelector('.bg-yellow-400')).toBeInTheDocument();

    // Test completed status (gray)
    const completedSession = { ...mockSession, status: 'completed' as const };
    rerender(<SessionItem session={completedSession} isAwaiting={false} />);
    expect(screen.getByText('Session session12').parentElement?.querySelector('.bg-gray-400')).toBeInTheDocument();
  });

  it('shows correct activity icons based on last event', () => {
    render(<SessionItem session={mockSession} isAwaiting={false} />);
    
    // Should show tool icon for pre_tool_use event
    const iconContainer = screen.getByText('Session session12').parentElement?.querySelector('svg');
    expect(iconContainer).toBeInTheDocument();
  });

  it('formats relative time correctly', () => {
    // Mock Date.now to be 1 hour after lastActivity
    const mockNow = new Date('2024-01-01T11:30:00Z');
    jest.spyOn(Date, 'now').mockReturnValue(mockNow.getTime());

    render(<SessionItem session={mockSession} isAwaiting={false} />);
    
    expect(screen.getByText('1h')).toBeInTheDocument();

    jest.restoreAllMocks();
  });
});