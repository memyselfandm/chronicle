import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { SidebarContainer } from '@/components/sidebar/SidebarContainer';
import { useDashboardStore } from '@/stores/dashboardStore';

// Mock the dashboard store
jest.mock('@/stores/dashboardStore');
const mockUseDashboardStore = useDashboardStore as jest.MockedFunction<typeof useDashboardStore>;

// Mock all child components
jest.mock('@/components/sidebar/AwaitingInputSection', () => ({
  AwaitingInputSection: ({ sessions }: { sessions: any[] }) => (
    <div data-testid="awaiting-input-section">
      Awaiting: {sessions.length} sessions
    </div>
  ),
}));

jest.mock('@/components/sidebar/ProjectFolder', () => ({
  ProjectFolder: ({ projectName, totalCount }: { projectName: string; totalCount: number }) => (
    <div data-testid="project-folder">
      {projectName}: {totalCount} sessions
    </div>
  ),
}));

jest.mock('@/components/sidebar/PresetFilters', () => ({
  PresetFilters: () => <div data-testid="preset-filters">Filters</div>,
}));

jest.mock('@/components/sidebar/SidebarToggle', () => ({
  SidebarToggle: () => <button data-testid="sidebar-toggle">Toggle</button>,
}));

const mockStoreData = {
  ui: { sidebarCollapsed: false },
  setSidebarCollapsed: jest.fn(),
  sessions: [
    {
      id: 'session1',
      status: 'active' as const,
      startTime: new Date('2024-01-01T10:00:00Z'),
      endTime: undefined,
      toolsUsed: 5,
      eventsCount: 10,
      lastActivity: new Date('2024-01-01T10:30:00Z'),
    },
    {
      id: 'session2',
      status: 'idle' as const,
      startTime: new Date('2024-01-01T09:00:00Z'),
      endTime: undefined,
      toolsUsed: 2,
      eventsCount: 4,
      lastActivity: new Date('2024-01-01T09:15:00Z'),
    },
  ],
  events: [
    {
      id: 'event1',
      sessionId: 'session1',
      type: 'user_prompt_submit',
      timestamp: new Date('2024-01-01T10:00:00Z'),
      metadata: {},
      status: 'active' as const,
    },
    {
      id: 'event2',
      sessionId: 'session2',
      type: 'notification',
      timestamp: new Date('2024-01-01T09:15:00Z'),
      metadata: { requires_response: true },
      status: 'awaiting' as const,
    },
  ],
  getFilteredSessions: jest.fn(),
};

describe('SidebarContainer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockStoreData.getFilteredSessions.mockReturnValue(mockStoreData.sessions);
    mockUseDashboardStore.mockReturnValue(mockStoreData as any);
  });

  it('renders expanded sidebar correctly', () => {
    render(<SidebarContainer />);
    
    expect(screen.getByText('Sessions')).toBeInTheDocument();
    expect(screen.getByTestId('sidebar-toggle')).toBeInTheDocument();
    expect(screen.getByTestId('preset-filters')).toBeInTheDocument();
  });

  it('renders collapsed sidebar when sidebarCollapsed is true', () => {
    mockUseDashboardStore.mockReturnValue({
      ...mockStoreData,
      ui: { sidebarCollapsed: true },
    } as any);

    render(<SidebarContainer />);
    
    // Should only show the toggle button in collapsed mode
    expect(screen.getByTestId('sidebar-toggle')).toBeInTheDocument();
    expect(screen.queryByText('Sessions')).not.toBeInTheDocument();
  });

  it('shows awaiting input section when there are awaiting sessions', () => {
    render(<SidebarContainer />);
    
    // Should show awaiting section with 1 session (session2 has requires_response: true)
    expect(screen.getByTestId('awaiting-input-section')).toBeInTheDocument();
  });

  it('groups sessions by project correctly', () => {
    render(<SidebarContainer />);
    
    // Should show project folders
    const projectFolders = screen.getAllByTestId('project-folder');
    expect(projectFolders).toHaveLength(2); // One for each session as they're in different "projects"
  });

  it('responds to keyboard shortcut Cmd+B', () => {
    render(<SidebarContainer />);
    
    // Simulate Cmd+B keypress
    fireEvent.keyDown(document, { key: 'b', metaKey: true });
    
    expect(mockStoreData.setSidebarCollapsed).toHaveBeenCalledWith(true);
  });

  it('handles empty sessions gracefully', () => {
    mockStoreData.getFilteredSessions.mockReturnValue([]);
    
    render(<SidebarContainer />);
    
    expect(screen.getByText('No sessions found')).toBeInTheDocument();
  });
});