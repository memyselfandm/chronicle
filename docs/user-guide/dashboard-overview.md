# Chronicle Dashboard Overview

Chronicle's dashboard provides a comprehensive real-time view of your Claude Code interactions, tool usage, and session analytics. This guide covers all dashboard features and components.

## Dashboard Layout

The Chronicle dashboard uses a responsive grid system that adapts to different screen sizes:

### Header Section
- **Height**: 40px fixed header
- **Location**: Top of the dashboard
- **Components**: 
  - Connection status indicator with real-time backend connectivity
  - Performance metrics display showing event throughput
  - Session badges for active session identification
  - Mode indicator (Local SQLite vs Supabase backend)

### Sidebar (Left Panel)
- **Expanded**: 220px width with full feature labels
- **Collapsed**: 48px width with icon-only navigation
- **Toggle**: Click the sidebar toggle button to expand/collapse
- **Persistence**: Layout state is automatically saved to localStorage

### Main Content Area (Event Feed)
- **Location**: Center panel, takes remaining horizontal space
- **Components**:
  - Event feed header with auto-scroll controls
  - Real-time event stream table
  - Event detail modals
  - Virtualized rendering for performance

## Real-time Event Stream

The event stream is the heart of Chronicle's monitoring capabilities:

### Event Display
- **Real-time Updates**: Events appear instantly as they occur
- **Event Types**: 
  - `session_start` - New Claude Code session begins
  - `user_prompt_submit` - User submits a prompt/question
  - `pre_tool_use` - Before a tool is executed
  - `post_tool_use` - After tool execution completes
  - `notification` - System notifications and updates
  - `stop` - Session termination events

### Event Card Information
Each event displays:
- **Timestamp**: Precise time when the event occurred
- **Event Type**: Color-coded badge indicating event category
- **Session ID**: Clickable identifier linking to session details  
- **Tool Information**: For tool events, shows tool name and parameters
- **Status Indicators**: Success/failure states with visual feedback
- **Expandable Details**: Click any event to view full JSON payload

### Auto-scroll Behavior
- **Auto-scroll Toggle**: Located in the event feed header
- **Smart Scrolling**: Automatically pauses when user manually scrolls up
- **Resume Options**: Click "Resume auto-scroll" or scroll to bottom
- **Performance**: Virtualized rendering handles thousands of events efficiently

## Tool Usage Analytics

Chronicle tracks comprehensive tool usage metrics:

### Real-time Metrics (Header Display)
- **Events/minute**: Current event throughput rate
- **Active Tools**: Number of tools currently executing
- **Session Count**: Total active sessions being monitored
- **Backend Status**: Connection health indicator

### Tool Performance Tracking
- **Execution Time**: Duration for each tool invocation
- **Success Rates**: Percentage of successful vs failed tool calls
- **Usage Patterns**: Most frequently used tools and patterns
- **Error Tracking**: Failed executions with error details

### Analytics Features
- **Tool Frequency**: View which tools are used most often
- **Performance Trends**: Track tool execution times over time  
- **Session Comparison**: Compare tool usage between different sessions
- **Export Capabilities**: Download analytics data for external analysis

## Connection Status Indicators

Chronicle provides detailed connection status information:

### Connection Dot (Header)
- **Green**: Healthy connection to backend
- **Yellow**: Connection issues or degraded performance
- **Red**: Disconnected or critical connection failure
- **Pulsing**: Attempting to reconnect

### Detailed Status Information
- **Backend Mode**: Shows whether using Local SQLite or Supabase
- **Response Times**: Real-time latency measurements
- **Reconnection**: Automatic retry logic with exponential backoff
- **Error Details**: Hover over status indicators for detailed information

### Troubleshooting Connection Issues
- **Local Backend**: Ensure Chronicle hooks are installed and running
- **Supabase Backend**: Check environment variables and API keys
- **Network Issues**: Status indicators will show connectivity problems
- **Automatic Recovery**: Dashboard will automatically reconnect when possible

## Performance Metrics

Chronicle provides detailed performance monitoring:

### Throughput Indicators
- **Real-time Rates**: Events processed per minute
- **Peak Performance**: Highest throughput achieved
- **Latency Metrics**: Time between event occurrence and display
- **Queue Status**: Number of events waiting to be processed

### Memory and Resource Usage
- **Event Buffer**: Number of events held in memory
- **Update Frequency**: How often the display refreshes
- **Virtualization**: Efficient rendering of large event lists
- **Cleanup**: Automatic cleanup of old events to prevent memory leaks

### Performance Optimization Features
- **Virtualized Lists**: Only render visible events for better performance
- **Event Batching**: Group multiple events for efficient updates
- **Smart Filtering**: Client-side filtering to reduce server load
- **Caching**: Intelligent caching of session and event data

## Keyboard Shortcuts

Chronicle supports keyboard navigation for power users:

### Global Shortcuts
- **`Ctrl/Cmd + /`**: Toggle keyboard shortcuts help
- **`Ctrl/Cmd + S`**: Toggle sidebar collapse/expand
- **`Ctrl/Cmd + F`**: Focus search/filter input
- **`Esc`**: Close any open modal or clear current selection

### Event Navigation
- **`j`**: Navigate to next event
- **`k`**: Navigate to previous event  
- **`Enter`**: Open selected event details
- **`Space`**: Toggle auto-scroll in event feed

### Session Management
- **`1-9`**: Quick switch between active sessions
- **`Ctrl/Cmd + N`**: Create new session filter
- **`Ctrl/Cmd + R`**: Refresh current view
- **`Ctrl/Cmd + E`**: Export current session data

## Responsive Design

Chronicle's dashboard adapts to different screen sizes:

### Desktop (1200px+)
- Full three-panel layout with expanded sidebar
- Maximum information density
- Multi-column event display options
- Advanced filtering panels

### Tablet (768px - 1199px)
- Collapsible sidebar defaults to icon-only mode
- Simplified event display
- Touch-friendly interface elements
- Optimized scroll behavior

### Mobile (< 768px)
- Single-column stacked layout
- Slide-out sidebar navigation
- Touch-optimized event cards
- Simplified metrics display

## Customization Options

### Layout Persistence
- **Automatic Saving**: Layout preferences saved to localStorage
- **Cross-session**: Settings persist between browser sessions
- **Per-user**: Settings are tied to browser/device combination
- **Reset Option**: Clear stored preferences to return to defaults

### Display Preferences  
- **Event Density**: Compact vs detailed event display modes
- **Color Themes**: Support for light/dark theme switching (coming soon)
- **Column Visibility**: Show/hide specific event data columns
- **Update Frequency**: Adjust real-time update intervals

### Filter Presets
- **Quick Filters**: Pre-configured common filter combinations
- **Custom Filters**: Save your own filter presets
- **Session-specific**: Filters can be tied to specific sessions
- **Export/Import**: Share filter configurations with team members

## Getting Started Tips

1. **First Launch**: The dashboard will automatically connect to your Chronicle backend
2. **Monitor Sessions**: Start a Claude Code session to see events flowing in
3. **Explore Events**: Click on any event to see detailed information
4. **Use Filters**: Try the sidebar filters to focus on specific event types
5. **Keyboard Navigation**: Press `Ctrl/Cmd + /` to see all available shortcuts
6. **Layout Customization**: Collapse the sidebar or adjust panel sizes as needed
7. **Performance**: For high-volume usage, consider adjusting the update frequency

## Common Use Cases

### Development Debugging
- Monitor tool execution failures and error patterns
- Track session lifecycle and termination issues
- Analyze performance bottlenecks in tool usage

### Usage Analytics
- Understand which tools are most commonly used
- Track session patterns and user behavior
- Monitor system performance and resource usage

### Team Collaboration
- Share session data and event logs with team members
- Compare different approaches to similar problems
- Document tool usage patterns for training purposes

### Quality Assurance
- Verify tool integrations are working correctly
- Monitor for unexpected errors or edge cases
- Track system stability and reliability metrics

For more detailed information on specific features, see:
- [Event Filtering Guide](./filtering-events.md)
- [Session Management](./session-management.md)  
- [Configuration Options](./configuration.md)