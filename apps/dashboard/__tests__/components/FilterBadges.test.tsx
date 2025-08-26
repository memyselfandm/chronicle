/**
 * Tests for FilterBadges component
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FilterBadges, CompactFilterBadges, FilterSummary } from '../../src/components/eventfeed/FilterBadges';
import { useDashboardStore } from '../../src/stores/dashboardStore';

// Mock the store
jest.mock('../../src/stores/dashboardStore');
const mockUseDashboardStore = useDashboardStore as jest.MockedFunction<typeof useDashboardStore>;

const mockSessions = [
  {
    id: 'session-1',
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
  },
  {
    id: 'session-2',
    status: 'completed' as const,
    startTime: new Date('2024-01-01T09:00:00Z'),
    endTime: new Date('2024-01-01T09:30:00Z'),
    toolsUsed: 2,
    eventsCount: 5,
    lastActivity: new Date('2024-01-01T09:30:00Z'),
    metadata: {
      project_path: '/Users/test/dashboard',
      git_branch: 'feature-ui'
    }
  },
  {
    id: 'session-3',
    status: 'idle' as const,
    startTime: new Date('2024-01-01T08:00:00Z'),
    endTime: undefined,
    toolsUsed: 0,
    eventsCount: 1,
    lastActivity: new Date('2024-01-01T08:15:00Z'),
    metadata: {
      project_path: '/Users/test/api-docs',
      git_branch: 'main'
    }
  }
];

const mockStoreState = {
  sessions: mockSessions,
  getSelectedSessionsArray: jest.fn(() => []),
  toggleSessionSelection: jest.fn(),
  clearSelectedSessions: jest.fn(),
  getFilteredEventsBySelectedSessions: jest.fn(() => [])
};

describe('FilterBadges', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseDashboardStore.mockReturnValue(mockStoreState as any);
  });

  describe('Rendering', () => {
    it('should not render when no sessions are selected', () => {
      mockStoreState.getSelectedSessionsArray.mockReturnValue([]);
      
      const { container } = render(<FilterBadges />);
      expect(container.firstChild).toBeNull();
    });

    it('should render filter badges when sessions are selected', () => {
      mockStoreState.getSelectedSessionsArray.mockReturnValue(['session-1', 'session-2']);
      
      render(<FilterBadges />);
      
      expect(screen.getByText('Filtered by:')).toBeInTheDocument();
      expect(screen.getByText('chronicle / main')).toBeInTheDocument();
      expect(screen.getByText('dashboard / feature-ui')).toBeInTheDocument();
      expect(screen.getByText('Clear all')).toBeInTheDocument();
    });

    it('should limit visible badges based on maxVisible prop', () => {
      mockStoreState.getSelectedSessionsArray.mockReturnValue(['session-1', 'session-2', 'session-3']);
      
      render(<FilterBadges maxVisible={2} />);
      
      expect(screen.getByText('chronicle / main')).toBeInTheDocument();
      expect(screen.getByText('dashboard / feature-ui')).toBeInTheDocument();
      expect(screen.getByText('+1 more')).toBeInTheDocument();
      expect(screen.queryByText('api-docs / main')).not.toBeInTheDocument();
    });

    it('should show all badges when count is within maxVisible', () => {
      mockStoreState.getSelectedSessionsArray.mockReturnValue(['session-1', 'session-2']);
      
      render(<FilterBadges maxVisible={3} />);
      
      expect(screen.getByText('chronicle / main')).toBeInTheDocument();
      expect(screen.getByText('dashboard / feature-ui')).toBeInTheDocument();
      expect(screen.queryByText(/more/)).not.toBeInTheDocument();
    });

    it('should apply custom className', () => {
      mockStoreState.getSelectedSessionsArray.mockReturnValue(['session-1']);
      
      const { container } = render(<FilterBadges className="custom-filter-badges" />);
      expect(container.firstChild).toHaveClass('custom-filter-badges');
    });
  });

  describe('Interaction', () => {
    it('should remove individual badge when X is clicked', async () => {
      const user = userEvent.setup();
      mockStoreState.getSelectedSessionsArray.mockReturnValue(['session-1', 'session-2']);
      
      render(<FilterBadges />);
      
      const removeButtons = screen.getAllByText('×');
      await user.click(removeButtons[0]);
      
      expect(mockStoreState.toggleSessionSelection).toHaveBeenCalledWith('session-1', true);
    });

    it('should clear all selections when Clear all is clicked', async () => {
      const user = userEvent.setup();
      mockStoreState.getSelectedSessionsArray.mockReturnValue(['session-1', 'session-2']);
      
      render(<FilterBadges />);
      
      const clearButton = screen.getByText('Clear all');
      await user.click(clearButton);
      
      expect(mockStoreState.clearSelectedSessions).toHaveBeenCalled();
    });

    it('should handle expanding collapsed badges', async () => {
      const user = userEvent.setup();
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      mockStoreState.getSelectedSessionsArray.mockReturnValue(['session-1', 'session-2', 'session-3']);
      
      render(<FilterBadges maxVisible={2} />);
      
      const moreButton = screen.getByText('+1 more');
      await user.click(moreButton);
      
      expect(consoleSpy).toHaveBeenCalledWith('Expand collapsed filters');
      consoleSpy.mockRestore();
    });

    it('should prevent event propagation on remove button click', async () => {
      const user = userEvent.setup();
      const containerClick = jest.fn();
      mockStoreState.getSelectedSessionsArray.mockReturnValue(['session-1']);
      
      const { container } = render(
        <div onClick={containerClick}>
          <FilterBadges />
        </div>
      );
      
      const removeButton = screen.getByText('×');
      await user.click(removeButton);
      
      expect(containerClick).not.toHaveBeenCalled();
      expect(mockStoreState.toggleSessionSelection).toHaveBeenCalledWith('session-1', true);
    });
  });

  describe('Badge Content and Accessibility', () => {
    it('should show full session name in tooltip', () => {
      mockStoreState.getSelectedSessionsArray.mockReturnValue(['session-1']);
      
      render(<FilterBadges />);
      
      const badge = screen.getByText('chronicle / main');
      expect(badge).toHaveAttribute('title', 'chronicle / main');
    });

    it('should have proper aria-label for remove buttons', () => {
      mockStoreState.getSelectedSessionsArray.mockReturnValue(['session-1']);
      
      render(<FilterBadges />);
      
      const removeButton = screen.getByLabelText('Remove chronicle / main filter');
      expect(removeButton).toBeInTheDocument();
    });

    it('should have proper aria-label for clear all button', () => {
      mockStoreState.getSelectedSessionsArray.mockReturnValue(['session-1']);
      
      render(<FilterBadges />);
      
      const clearButton = screen.getByLabelText('Clear all session filters');
      expect(clearButton).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle missing session gracefully', () => {
      // Mock selected session that doesn't exist in sessions array
      mockStoreState.getSelectedSessionsArray.mockReturnValue(['non-existent-session']);
      
      render(<FilterBadges />);
      
      // Should call toggleSessionSelection to remove the invalid session
      expect(mockStoreState.toggleSessionSelection).toHaveBeenCalledWith('non-existent-session', true);
    });

    it('should handle sessions without metadata', () => {
      const sessionWithoutMetadata = {
        ...mockSessions[0],
        metadata: {}
      };
      
      mockUseDashboardStore.mockReturnValue({
        ...mockStoreState,
        sessions: [sessionWithoutMetadata],
        getSelectedSessionsArray: () => [sessionWithoutMetadata.id]
      } as any);
      
      render(<FilterBadges />);
      
      expect(screen.getByText('unknown / no git')).toBeInTheDocument();
    });
  });

  describe('Animation and Visual Effects', () => {
    it('should apply animation classes to badges', () => {
      mockStoreState.getSelectedSessionsArray.mockReturnValue(['session-1']);
      
      render(<FilterBadges />);
      
      const badge = screen.getByText('chronicle / main').closest('.animate-in');
      expect(badge).toHaveClass('animate-in', 'fade-in-0', 'slide-in-from-left-2');
    });

    it('should apply hover effects to badges', () => {
      mockStoreState.getSelectedSessionsArray.mockReturnValue(['session-1']);
      
      render(<FilterBadges />);
      
      const badge = screen.getByText('chronicle / main').closest('[class*="hover:bg-accent-blue/20"]');
      expect(badge).toHaveClass('hover:bg-accent-blue/20');
    });
  });
});

describe('CompactFilterBadges', () => {
  beforeEach(() => {
    mockUseDashboardStore.mockReturnValue(mockStoreState as any);
  });

  it('should not render when no sessions are selected', () => {
    mockStoreState.getSelectedSessionsArray.mockReturnValue([]);
    
    const { container } = render(<CompactFilterBadges />);
    expect(container.firstChild).toBeNull();
  });

  it('should show session count when sessions are selected', () => {
    mockStoreState.getSelectedSessionsArray.mockReturnValue(['session-1', 'session-2']);
    
    render(<CompactFilterBadges />);
    
    expect(screen.getByText('2 sessions filtered')).toBeInTheDocument();
    expect(screen.getByText('Clear')).toBeInTheDocument();
  });

  it('should show singular form for single session', () => {
    mockStoreState.getSelectedSessionsArray.mockReturnValue(['session-1']);
    
    render(<CompactFilterBadges />);
    
    expect(screen.getByText('1 session filtered')).toBeInTheDocument();
  });

  it('should clear selections when Clear is clicked', async () => {
    const user = userEvent.setup();
    mockStoreState.getSelectedSessionsArray.mockReturnValue(['session-1']);
    
    render(<CompactFilterBadges />);
    
    const clearButton = screen.getByText('Clear');
    await user.click(clearButton);
    
    expect(mockStoreState.clearSelectedSessions).toHaveBeenCalled();
  });
});

describe('FilterSummary', () => {
  beforeEach(() => {
    mockUseDashboardStore.mockReturnValue(mockStoreState as any);
  });

  it('should not render when no sessions are selected', () => {
    mockStoreState.getSelectedSessionsArray.mockReturnValue([]);
    
    const { container } = render(<FilterSummary />);
    expect(container.firstChild).toBeNull();
  });

  it('should show event and session count', () => {
    mockStoreState.getSelectedSessionsArray.mockReturnValue(['session-1', 'session-2']);
    mockStoreState.getFilteredEventsBySelectedSessions.mockReturnValue([
      { id: 'event-1' }, { id: 'event-2' }, { id: 'event-3' }
    ]);
    
    render(<FilterSummary />);
    
    expect(screen.getByText('Showing 3 events from 2 selected sessions')).toBeInTheDocument();
  });

  it('should use singular form correctly', () => {
    mockStoreState.getSelectedSessionsArray.mockReturnValue(['session-1']);
    mockStoreState.getFilteredEventsBySelectedSessions.mockReturnValue([{ id: 'event-1' }]);
    
    render(<FilterSummary />);
    
    expect(screen.getByText('Showing 1 events from 1 selected session')).toBeInTheDocument();
  });
});