/**
 * Tests for SessionItem component
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SessionItem, CompactSessionItem, SessionItemSkeleton } from '../../src/components/sidebar/SessionItem';
import { useDashboardStore } from '../../src/stores/dashboardStore';

// Mock the store
jest.mock('../../src/stores/dashboardStore');
const mockUseDashboardStore = useDashboardStore as jest.MockedFunction<typeof useDashboardStore>;

const mockSession = {
  id: 'test-session-123',
  status: 'active' as const,
  startTime: new Date('2024-01-01T10:00:00Z'),
  endTime: undefined,
  toolsUsed: 5,
  eventsCount: 12,
  lastActivity: new Date('2024-01-01T11:00:00Z'),
  metadata: {
    project_path: '/Users/test/chronicle',
    git_branch: 'main'
  }
};

const mockStoreState = {
  isSessionSelected: jest.fn(),
  getSessionEvents: jest.fn(() => [
    { id: 'event-1', sessionId: 'test-session-123' },
    { id: 'event-2', sessionId: 'test-session-123' }
  ])
};

describe('SessionItem', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseDashboardStore.mockReturnValue(mockStoreState as any);
    mockStoreState.isSessionSelected.mockReturnValue(false);
  });

  describe('Rendering', () => {
    it('should render session information correctly', () => {
      render(<SessionItem session={mockSession} />);
      
      expect(screen.getByText('chronicle / main')).toBeInTheDocument();
      expect(screen.getByText('active')).toBeInTheDocument();
      expect(screen.getByText('ID: test-ses...')).toBeInTheDocument();
      expect(screen.getByText('2 events')).toBeInTheDocument();
      expect(screen.getByText('5 tools')).toBeInTheDocument();
    });

    it('should show selected state when session is selected', () => {
      mockStoreState.isSessionSelected.mockReturnValue(true);
      
      render(<SessionItem session={mockSession} />);
      
      const sessionCard = screen.getByRole('button');
      expect(sessionCard).toHaveAttribute('aria-pressed', 'true');
      expect(sessionCard).toHaveClass('ring-2', 'ring-accent-blue');
    });

    it('should render status icon and badge correctly', () => {
      render(<SessionItem session={mockSession} />);
      
      expect(screen.getByRole('img', { name: /status: active/i })).toBeInTheDocument();
      expect(screen.getByText('active')).toBeInTheDocument();
    });

    it('should show last activity time', () => {
      render(<SessionItem session={mockSession} />);
      
      const timeElement = screen.getByRole('time');
      expect(timeElement).toBeInTheDocument();
      expect(timeElement).toHaveAttribute('datetime', mockSession.lastActivity?.toISOString());
    });
  });

  describe('Interaction', () => {
    it('should call onClick with correct parameters on single click', async () => {
      const user = userEvent.setup();
      const handleClick = jest.fn();
      
      render(<SessionItem session={mockSession} onClick={handleClick} />);
      
      const sessionCard = screen.getByRole('button');
      await user.click(sessionCard);
      
      expect(handleClick).toHaveBeenCalledWith(mockSession, false);
    });

    it('should call onClick with multi-select on Ctrl+click', async () => {
      const user = userEvent.setup();
      const handleClick = jest.fn();
      
      render(<SessionItem session={mockSession} onClick={handleClick} />);
      
      const sessionCard = screen.getByRole('button');
      await user.click(sessionCard, { ctrlKey: true });
      
      expect(handleClick).toHaveBeenCalledWith(mockSession, true);
    });

    it('should call onClick with multi-select on Cmd+click', async () => {
      const user = userEvent.setup();
      const handleClick = jest.fn();
      
      render(<SessionItem session={mockSession} onClick={handleClick} />);
      
      const sessionCard = screen.getByRole('button');
      await user.click(sessionCard, { metaKey: true });
      
      expect(handleClick).toHaveBeenCalledWith(mockSession, true);
    });

    it('should handle double-click', async () => {
      const user = userEvent.setup();
      const handleDoubleClick = jest.fn();
      
      render(<SessionItem session={mockSession} onDoubleClick={handleDoubleClick} />);
      
      const sessionCard = screen.getByRole('button');
      await user.dblClick(sessionCard);
      
      expect(handleDoubleClick).toHaveBeenCalledWith(mockSession);
    });

    it('should handle Enter key press', async () => {
      const user = userEvent.setup();
      const handleClick = jest.fn();
      
      render(<SessionItem session={mockSession} onClick={handleClick} />);
      
      const sessionCard = screen.getByRole('button');
      sessionCard.focus();
      await user.keyboard('{Enter}');
      
      expect(handleClick).toHaveBeenCalledWith(mockSession, false);
    });

    it('should handle Ctrl+Enter for multi-select', async () => {
      const user = userEvent.setup();
      const handleClick = jest.fn();
      
      render(<SessionItem session={mockSession} onClick={handleClick} />);
      
      const sessionCard = screen.getByRole('button');
      sessionCard.focus();
      await user.keyboard('{Control>}{Enter}{/Control}');
      
      expect(handleClick).toHaveBeenCalledWith(mockSession, true);
    });

    it('should handle Space key for multi-select', async () => {
      const user = userEvent.setup();
      const handleClick = jest.fn();
      
      render(<SessionItem session={mockSession} onClick={handleClick} />);
      
      const sessionCard = screen.getByRole('button');
      sessionCard.focus();
      await user.keyboard(' ');
      
      expect(handleClick).toHaveBeenCalledWith(mockSession, true);
    });
  });

  describe('Props and Options', () => {
    it('should hide event count when showEventCount is false', () => {
      render(<SessionItem session={mockSession} showEventCount={false} />);
      
      expect(screen.queryByText(/events/)).not.toBeInTheDocument();
      expect(screen.getByText('5 tools')).toBeInTheDocument();
    });

    it('should hide last activity when showLastActivity is false', () => {
      render(<SessionItem session={mockSession} showLastActivity={false} />);
      
      expect(screen.queryByRole('time')).not.toBeInTheDocument();
    });

    it('should apply custom className', () => {
      render(<SessionItem session={mockSession} className="custom-class" />);
      
      const sessionCard = screen.getByRole('button');
      expect(sessionCard).toHaveClass('custom-class');
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA attributes', () => {
      render(<SessionItem session={mockSession} />);
      
      const sessionCard = screen.getByRole('button');
      expect(sessionCard).toHaveAttribute('aria-pressed', 'false');
      expect(sessionCard).toHaveAttribute('aria-label');
      expect(sessionCard).toHaveAttribute('tabindex', '0');
    });

    it('should update aria-label when selected', () => {
      mockStoreState.isSessionSelected.mockReturnValue(true);
      
      render(<SessionItem session={mockSession} />);
      
      const sessionCard = screen.getByRole('button');
      expect(sessionCard).toHaveAttribute('aria-label', expect.stringContaining('selected'));
    });
  });

  describe('Different Session States', () => {
    it('should render completed session correctly', () => {
      const completedSession = {
        ...mockSession,
        status: 'completed' as const,
        endTime: new Date('2024-01-01T11:30:00Z')
      };
      
      render(<SessionItem session={completedSession} />);
      
      expect(screen.getByText('completed')).toBeInTheDocument();
      expect(screen.getByText('⚪')).toBeInTheDocument();
    });

    it('should render error session correctly', () => {
      const errorSession = {
        ...mockSession,
        status: 'error' as const
      };
      
      render(<SessionItem session={errorSession} />);
      
      expect(screen.getByText('error')).toBeInTheDocument();
      expect(screen.getByText('🔴')).toBeInTheDocument();
    });

    it('should handle session without git branch', () => {
      const sessionWithoutBranch = {
        ...mockSession,
        metadata: {
          project_path: '/Users/test/chronicle'
        }
      };
      
      render(<SessionItem session={sessionWithoutBranch} />);
      
      expect(screen.getByText('chronicle / no git')).toBeInTheDocument();
    });
  });
});

describe('CompactSessionItem', () => {
  beforeEach(() => {
    mockUseDashboardStore.mockReturnValue(mockStoreState as any);
    mockStoreState.isSessionSelected.mockReturnValue(false);
  });

  it('should render compact version correctly', () => {
    render(<CompactSessionItem session={mockSession} />);
    
    expect(screen.getByText('chronicle / main')).toBeInTheDocument();
    expect(screen.getByText('🟢')).toBeInTheDocument();
    
    // Should not show detailed information
    expect(screen.queryByText(/events/)).not.toBeInTheDocument();
    expect(screen.queryByText(/tools/)).not.toBeInTheDocument();
  });

  it('should handle click events', async () => {
    const user = userEvent.setup();
    const handleClick = jest.fn();
    
    render(<CompactSessionItem session={mockSession} onClick={handleClick} />);
    
    const sessionDiv = screen.getByRole('button');
    await user.click(sessionDiv);
    
    expect(handleClick).toHaveBeenCalledWith(mockSession, false);
  });
});

describe('SessionItemSkeleton', () => {
  it('should render loading skeleton', () => {
    render(<SessionItemSkeleton />);
    
    // Check for skeleton elements
    const skeletonCard = screen.getByTestId ? 
      screen.queryByTestId('session-skeleton') : 
      document.querySelector('.animate-pulse');
    
    expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('should apply custom className to skeleton', () => {
    const { container } = render(<SessionItemSkeleton className="custom-skeleton" />);
    
    expect(container.firstChild).toHaveClass('custom-skeleton');
  });
});