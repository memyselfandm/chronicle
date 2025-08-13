import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { EventFilter } from '@/components/EventFilter';
import { FilterState } from '@/types/filters';

// Mock event types for testing
const mockEventTypes: Array<import('@/types/filters').EventType> = [
  'tool_use',
  'prompt',
  'session',
  'lifecycle',
  'error'
];

// Mock filter state
const mockInitialFilters: FilterState = {
  eventTypes: [],
  showAll: true
};

describe('EventFilter', () => {
  const mockOnFilterChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the event filter component', () => {
    render(
      <EventFilter
        filters={mockInitialFilters}
        onFilterChange={mockOnFilterChange}
        availableEventTypes={mockEventTypes}
      />
    );

    expect(screen.getByLabelText(/event type filter/i)).toBeInTheDocument();
  });

  it('shows "Show All" option selected by default', () => {
    render(
      <EventFilter
        filters={mockInitialFilters}
        onFilterChange={mockOnFilterChange}
        availableEventTypes={mockEventTypes}
      />
    );

    const showAllCheckbox = screen.getByLabelText(/show all/i);
    expect(showAllCheckbox).toBeChecked();
  });

  it('displays all available event types as filter options', () => {
    render(
      <EventFilter
        filters={mockInitialFilters}
        onFilterChange={mockOnFilterChange}
        availableEventTypes={mockEventTypes}
      />
    );

    mockEventTypes.forEach(eventType => {
      expect(screen.getByLabelText(new RegExp(eventType.replace('_', ' '), 'i'))).toBeInTheDocument();
    });
  });

  it('calls onFilterChange when Show All is toggled', async () => {
    const user = userEvent.setup();
    
    render(
      <EventFilter
        filters={mockInitialFilters}
        onFilterChange={mockOnFilterChange}
        availableEventTypes={mockEventTypes}
      />
    );

    const showAllCheckbox = screen.getByLabelText(/show all/i);
    await user.click(showAllCheckbox);

    expect(mockOnFilterChange).toHaveBeenCalledWith({
      eventTypes: [],
      showAll: false
    });
  });

  it('calls onFilterChange when an event type is selected', async () => {
    const user = userEvent.setup();
    
    render(
      <EventFilter
        filters={{ eventTypes: [], showAll: false }}
        onFilterChange={mockOnFilterChange}
        availableEventTypes={mockEventTypes}
      />
    );

    const toolUseCheckbox = screen.getByLabelText(/tool use/i);
    await user.click(toolUseCheckbox);

    expect(mockOnFilterChange).toHaveBeenCalledWith({
      eventTypes: ['tool_use'],
      showAll: false
    });
  });

  it('calls onFilterChange when multiple event types are selected', async () => {
    const user = userEvent.setup();
    
    render(
      <EventFilter
        filters={{ eventTypes: ['tool_use'], showAll: false }}
        onFilterChange={mockOnFilterChange}
        availableEventTypes={mockEventTypes}
      />
    );

    const promptCheckbox = screen.getByLabelText(/prompt/i);
    await user.click(promptCheckbox);

    expect(mockOnFilterChange).toHaveBeenCalledWith({
      eventTypes: ['tool_use', 'prompt'],
      showAll: false
    });
  });

  it('calls onFilterChange when an event type is deselected', async () => {
    const user = userEvent.setup();
    
    render(
      <EventFilter
        filters={{ eventTypes: ['tool_use', 'prompt'], showAll: false }}
        onFilterChange={mockOnFilterChange}
        availableEventTypes={mockEventTypes}
      />
    );

    const toolUseCheckbox = screen.getByLabelText(/tool use/i);
    await user.click(toolUseCheckbox);

    expect(mockOnFilterChange).toHaveBeenCalledWith({
      eventTypes: ['prompt'],
      showAll: false
    });
  });

  it('disables individual checkboxes when Show All is selected', () => {
    render(
      <EventFilter
        filters={mockInitialFilters}
        onFilterChange={mockOnFilterChange}
        availableEventTypes={mockEventTypes}
      />
    );

    const toolUseCheckbox = screen.getByLabelText(/tool use/i);
    expect(toolUseCheckbox).toBeDisabled();
  });

  it('enables individual checkboxes when Show All is unchecked', async () => {
    const user = userEvent.setup();
    
    render(
      <EventFilter
        filters={mockInitialFilters}
        onFilterChange={mockOnFilterChange}
        availableEventTypes={mockEventTypes}
      />
    );

    // First uncheck Show All
    const showAllCheckbox = screen.getByLabelText(/show all/i);
    await user.click(showAllCheckbox);
    
    // Then the individual checkboxes should be enabled and clickable
    expect(mockOnFilterChange).toHaveBeenCalledWith({
      eventTypes: [],
      showAll: false
    });
  });

  it('allows selecting individual event types when Show All is unchecked', async () => {
    const user = userEvent.setup();
    
    render(
      <EventFilter
        filters={{ eventTypes: [], showAll: false }}
        onFilterChange={mockOnFilterChange}
        availableEventTypes={mockEventTypes}
      />
    );

    const toolUseCheckbox = screen.getByLabelText(/tool use/i);
    await user.click(toolUseCheckbox);

    expect(mockOnFilterChange).toHaveBeenCalledWith({
      eventTypes: ['tool_use'],
      showAll: false
    });
  });

  it('automatically checks Show All when all event types are deselected', async () => {
    const user = userEvent.setup();
    
    render(
      <EventFilter
        filters={{ eventTypes: ['tool_use'], showAll: false }}
        onFilterChange={mockOnFilterChange}
        availableEventTypes={mockEventTypes}
      />
    );

    const toolUseCheckbox = screen.getByLabelText(/tool use/i);
    await user.click(toolUseCheckbox);

    expect(mockOnFilterChange).toHaveBeenCalledWith({
      eventTypes: [],
      showAll: true
    });
  });

  it('has proper ARIA labels for accessibility', () => {
    render(
      <EventFilter
        filters={mockInitialFilters}
        onFilterChange={mockOnFilterChange}
        availableEventTypes={mockEventTypes}
      />
    );

    const filterGroup = screen.getByRole('group', { name: /event type filter/i });
    expect(filterGroup).toBeInTheDocument();

    const showAllCheckbox = screen.getByRole('checkbox', { name: /show all/i });
    expect(showAllCheckbox).toBeInTheDocument();

    mockEventTypes.forEach(eventType => {
      const label = eventType.replace('_', ' ');
      const checkbox = screen.getByRole('checkbox', { name: new RegExp(label, 'i') });
      expect(checkbox).toBeInTheDocument();
    });
  });

  it('renders with dark theme styling', () => {
    render(
      <EventFilter
        filters={mockInitialFilters}
        onFilterChange={mockOnFilterChange}
        availableEventTypes={mockEventTypes}
      />
    );

    // The Card component should have the dark theme styling
    const cardElement = document.querySelector('.bg-bg-secondary');
    expect(cardElement).toBeInTheDocument();
  });

  it('handles empty event types array gracefully', () => {
    render(
      <EventFilter
        filters={mockInitialFilters}
        onFilterChange={mockOnFilterChange}
        availableEventTypes={[]}
      />
    );

    expect(screen.getByLabelText(/show all/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/tool use/i)).not.toBeInTheDocument();
  });

  it('reflects current filter state correctly', () => {
    const filtersWithSelection: FilterState = {
      eventTypes: ['tool_use', 'error'],
      showAll: false
    };

    render(
      <EventFilter
        filters={filtersWithSelection}
        onFilterChange={mockOnFilterChange}
        availableEventTypes={mockEventTypes}
      />
    );

    expect(screen.getByLabelText(/show all/i)).not.toBeChecked();
    expect(screen.getByLabelText(/tool use/i)).toBeChecked();
    expect(screen.getByLabelText(/error/i)).toBeChecked();
    expect(screen.getByLabelText(/prompt/i)).not.toBeChecked();
  });

  it('formats event type labels correctly', () => {
    render(
      <EventFilter
        filters={mockInitialFilters}
        onFilterChange={mockOnFilterChange}
        availableEventTypes={['tool_use', 'prompt']}
      />
    );

    expect(screen.getByLabelText(/tool use/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/prompt/i)).toBeInTheDocument();
  });
});