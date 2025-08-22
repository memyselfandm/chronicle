import React from 'react';
import { screen, waitFor, fireEvent } from '@testing-library/react';
import { renderWithProviders, checkAccessibility } from '../../../src/test-utils/renderHelpers';
import { createMockSessions } from '../../../src/test-utils/mockData';
import { AwaitingInputSection } from '../../../src/components/sidebar/AwaitingInputSection';

describe('AwaitingInputSection Component', () => {
  const mockSessions = createMockSessions(5).map(session => ({
    ...session,
    status: 'awaiting_input' as const,
  }));

  const defaultProps = {
    sessions: mockSessions,
    onSessionSelect: jest.fn(),
    selectedSessionId: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render awaiting input sessions correctly', () => {
      renderWithProviders(<AwaitingInputSection {...defaultProps} />);
      
      expect(screen.getByText('Awaiting Input')).toBeInTheDocument();
      expect(screen.getByText(`${mockSessions.length} sessions`)).toBeInTheDocument();
      
      mockSessions.forEach(session => {
        expect(screen.getByText(session.session_id)).toBeInTheDocument();
      });
    });

    it('should show empty state when no awaiting input sessions', () => {
      renderWithProviders(
        <AwaitingInputSection 
          {...defaultProps} 
          sessions={[]} 
        />
      );
      
      expect(screen.getByText('Awaiting Input')).toBeInTheDocument();
      expect(screen.getByText('No sessions awaiting input')).toBeInTheDocument();
    });

    it('should highlight selected session', () => {
      const selectedSession = mockSessions[0];
      renderWithProviders(
        <AwaitingInputSection 
          {...defaultProps} 
          selectedSessionId={selectedSession.id}
        />
      );
      
      const selectedElement = screen.getByTestId(`session-${selectedSession.id}`);
      expect(selectedElement).toHaveClass('selected');
    });
  });

  describe('Interactions', () => {
    it('should call onSessionSelect when session is clicked', async () => {
      const mockOnSessionSelect = jest.fn();
      renderWithProviders(
        <AwaitingInputSection 
          {...defaultProps} 
          onSessionSelect={mockOnSessionSelect}
        />
      );
      
      const firstSession = screen.getByTestId(`session-${mockSessions[0].id}`);
      fireEvent.click(firstSession);
      
      await waitFor(() => {
        expect(mockOnSessionSelect).toHaveBeenCalledWith(mockSessions[0].id);
      });
    });

    it('should handle keyboard navigation', async () => {
      const mockOnSessionSelect = jest.fn();
      renderWithProviders(
        <AwaitingInputSection 
          {...defaultProps} 
          onSessionSelect={mockOnSessionSelect}
        />
      );
      
      const firstSession = screen.getByTestId(`session-${mockSessions[0].id}`);
      firstSession.focus();
      
      fireEvent.keyDown(firstSession, { key: 'Enter' });
      
      await waitFor(() => {
        expect(mockOnSessionSelect).toHaveBeenCalledWith(mockSessions[0].id);
      });
    });
  });

  describe('Performance', () => {
    it('should render large number of sessions within performance budget', async () => {
      const largeSessions = createMockSessions(100).map(session => ({
        ...session,
        status: 'awaiting_input' as const,
      }));
      
      const start = performance.now();
      renderWithProviders(
        <AwaitingInputSection 
          {...defaultProps} 
          sessions={largeSessions}
        />
      );
      const end = performance.now();
      
      const renderTime = end - start;
      expect(renderTime).toBeLessThan(200); // 200ms budget
    });

    it('should handle rapid session updates efficiently', async () => {
      const { rerender } = renderWithProviders(<AwaitingInputSection {...defaultProps} />);
      
      const start = performance.now();
      
      // Simulate rapid updates
      for (let i = 0; i < 10; i++) {
        const updatedSessions = createMockSessions(5).map(session => ({
          ...session,
          status: 'awaiting_input' as const,
          updated_at: new Date(Date.now() + i * 1000).toISOString(),
        }));
        
        rerender(
          <AwaitingInputSection 
            {...defaultProps} 
            sessions={updatedSessions}
          />
        );
      }
      
      const end = performance.now();
      const updateTime = end - start;
      
      expect(updateTime).toBeLessThan(100); // 100ms for 10 updates
    });
  });

  describe('Accessibility', () => {
    it('should be accessible', () => {
      const { container } = renderWithProviders(<AwaitingInputSection {...defaultProps} />);
      const issues = checkAccessibility(container);
      expect(issues).toHaveLength(0);
    });

    it('should have proper ARIA attributes', () => {
      renderWithProviders(<AwaitingInputSection {...defaultProps} />);
      
      const section = screen.getByRole('region', { name: 'Awaiting Input Sessions' });
      expect(section).toBeInTheDocument();
      
      const sessionList = screen.getByRole('list');
      expect(sessionList).toBeInTheDocument();
      
      const sessionItems = screen.getAllByRole('listitem');
      expect(sessionItems).toHaveLength(mockSessions.length);
    });

    it('should support screen reader navigation', () => {
      renderWithProviders(<AwaitingInputSection {...defaultProps} />);
      
      mockSessions.forEach(session => {
        const sessionElement = screen.getByTestId(`session-${session.id}`);
        expect(sessionElement).toHaveAttribute('tabindex', '0');
        expect(sessionElement).toHaveAttribute('role', 'button');
      });
    });
  });

  describe('Edge Cases', () => {
    it('should handle sessions with missing data gracefully', () => {
      const sessionWithMissingData = {
        ...mockSessions[0],
        session_id: '',
        total_events: undefined,
      };
      
      renderWithProviders(
        <AwaitingInputSection 
          {...defaultProps} 
          sessions={[sessionWithMissingData]}
        />
      );
      
      expect(screen.getByText('Awaiting Input')).toBeInTheDocument();
      // Should not crash and should render some fallback
    });

    it('should handle extremely long session IDs', () => {
      const longSessionId = 'x'.repeat(200);
      const sessionWithLongId = {
        ...mockSessions[0],
        session_id: longSessionId,
      };
      
      renderWithProviders(
        <AwaitingInputSection 
          {...defaultProps} 
          sessions={[sessionWithLongId]}
        />
      );
      
      // Should truncate or handle long IDs appropriately
      expect(screen.getByTestId(`session-${sessionWithLongId.id}`)).toBeInTheDocument();
    });
  });

  describe('State Management', () => {
    it('should maintain selection state across updates', async () => {
      const { rerender } = renderWithProviders(
        <AwaitingInputSection 
          {...defaultProps} 
          selectedSessionId={mockSessions[0].id}
        />
      );
      
      // Update sessions but keep selection
      const updatedSessions = [...mockSessions, createMockSessions(1)[0]];
      rerender(
        <AwaitingInputSection 
          {...defaultProps} 
          sessions={updatedSessions}
          selectedSessionId={mockSessions[0].id}
        />
      );
      
      const selectedElement = screen.getByTestId(`session-${mockSessions[0].id}`);
      expect(selectedElement).toHaveClass('selected');
    });
  });
});