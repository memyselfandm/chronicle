# Event Filtering and Search

Chronicle provides powerful filtering and search capabilities to help you focus on specific events and patterns. This guide covers all filtering options and search functionality.

## Filter Sidebar Overview

The left sidebar contains all filtering controls and options:

### Sidebar Layout
- **Collapsible Design**: Toggle between full (220px) and icon-only (48px) modes
- **Persistent State**: Filter settings are preserved across sessions
- **Responsive**: Automatically adapts to smaller screen sizes
- **Quick Access**: Most commonly used filters are prominently displayed

### Filter Categories
1. **Event Type Filters** - Filter by specific Chronicle event types
2. **Session Filters** - Focus on specific sessions or session states
3. **Project Filters** - Filter events by project or working directory
4. **Preset Filters** - Quick access to common filter combinations
5. **Advanced Filters** - Time-based and custom query filtering

## Event Type Filtering

Chronicle captures several types of events that can be filtered independently:

### Available Event Types

#### Core Session Events
- **`session_start`**: New Claude Code session initialization
  - Shows when a new session begins
  - Includes session metadata and initial configuration
  - Useful for tracking session lifecycle

- **`user_prompt_submit`**: User input and prompt submission
  - Captures all user interactions and questions
  - Includes prompt content and context
  - Essential for understanding user workflow

- **`stop`**: Session termination and cleanup
  - Final event when a session ends
  - Includes termination reason and cleanup status
  - Important for debugging session issues

#### Tool Execution Events  
- **`pre_tool_use`**: Before tool execution begins
  - Shows tool preparation and parameter validation
  - Includes tool name, parameters, and execution context
  - Useful for debugging tool setup issues

- **`post_tool_use`**: After tool execution completes
  - Contains tool results, timing, and success status
  - Shows output data and any errors encountered
  - Critical for performance monitoring and error tracking

#### System Events
- **`notification`**: System notifications and status updates
  - Infrastructure events and system messages
  - Health check results and connectivity updates
  - Useful for monitoring system stability

### Event Type Filter Controls

#### Show All Option
- **Default State**: "Show All" is selected by default
- **Behavior**: When enabled, all event types are displayed
- **Override**: Selecting specific event types automatically disables "Show All"
- **Reset**: Click "Show All" to clear individual selections

#### Individual Event Type Selection
- **Checkboxes**: Each event type has an independent checkbox
- **Multiple Selection**: Select multiple event types simultaneously
- **Visual Feedback**: Selected types are highlighted with badges
- **Count Display**: Shows number of events for each type

#### Event Type Badges
- **Color Coding**: Each event type has a distinct color
  - `session_start`: Blue badge
  - `user_prompt_submit`: Green badge
  - `pre_tool_use`: Orange badge
  - `post_tool_use`: Purple badge
  - `stop`: Red badge
  - `notification`: Gray badge
- **Interactive**: Click badges to toggle filter state
- **Count Indicators**: Display number of visible events

## Session-Based Filtering

Filter events by session to focus on specific user interactions:

### Active Session List
- **Real-time Updates**: Shows currently active sessions
- **Session Metadata**: Displays session ID, start time, and status
- **Quick Selection**: Click any session to filter events
- **Multi-select**: Hold Ctrl/Cmd to select multiple sessions

### Session Status Indicators
- **Active Sessions**: Green indicator for currently running sessions
- **Completed Sessions**: Gray indicator for finished sessions
- **Error Sessions**: Red indicator for sessions with errors
- **Inactive Sessions**: Yellow indicator for stalled or paused sessions

### Session Details
Each session in the list shows:
- **Session ID**: Unique identifier (first 8 characters displayed)
- **Start Time**: When the session was initiated
- **Duration**: How long the session has been active
- **Event Count**: Number of events in this session
- **Status Badge**: Visual indicator of session health

## Project-Based Filtering

Filter events by project or working directory:

### Project Detection
- **Automatic Discovery**: Chronicle detects project folders from session data
- **Working Directory**: Groups events by the directory where Claude Code was launched
- **Repository Detection**: Shows Git repository information when available
- **Project Names**: Displays folder names or repository names as project identifiers

### Project Filter Options
- **Project List**: Shows all detected projects in collapsible sections
- **Event Counts**: Displays number of events per project
- **Quick Toggle**: Click project names to toggle filtering
- **Multi-project**: Select multiple projects simultaneously

### Project Folder Display
Projects are organized hierarchically:
- **Parent Directory**: Shows the parent folder path
- **Project Name**: Highlighted project or repository name
- **Recent Activity**: Indicator for recently active projects
- **Nested Structure**: Sub-projects and folders are properly nested

## Preset Filters

Quick access to commonly used filter combinations:

### Built-in Presets
- **"All Events"**: Shows all event types (default state)
- **"Tool Usage Only"**: Shows only `pre_tool_use` and `post_tool_use` events
- **"Session Lifecycle"**: Shows `session_start` and `stop` events
- **"User Interactions"**: Shows `user_prompt_submit` events only
- **"System Events"**: Shows `notification` and system-level events
- **"Error Events"**: Shows failed tool executions and error conditions

### Custom Preset Creation
- **Save Current Filters**: Save your current filter combination as a preset
- **Named Presets**: Give descriptive names to your custom presets
- **Quick Access**: Saved presets appear in the preset filter section
- **Sharing**: Export preset configurations to share with team members

### Preset Management
- **Edit Presets**: Modify existing preset configurations
- **Delete Presets**: Remove presets you no longer need
- **Import/Export**: Share presets across different Chronicle installations
- **Default Presets**: Reset to original built-in preset configurations

## Advanced Search and Filtering

### Text Search Capabilities
- **Global Search**: Search across all event data and content
- **Event Content**: Search within event parameters and results
- **Session Data**: Search session metadata and context
- **Tool Parameters**: Search tool names, parameters, and outputs

### Search Input Features
- **Real-time Results**: Search results update as you type
- **Keyboard Shortcuts**: `Ctrl/Cmd + F` to focus search input
- **Clear Search**: `Esc` key or click X to clear search terms
- **Search History**: Recently used search terms are suggested

### Search Syntax
- **Simple Text**: Basic text matching (case-insensitive)
- **Quoted Phrases**: Use quotes for exact phrase matching
- **Wildcard Support**: Use `*` for partial matching
- **Regex Support**: Advanced users can use regular expressions

### Time-Based Filtering

#### Time Range Selection
- **Last Hour**: Show events from the past 60 minutes
- **Last 4 Hours**: Show events from the past 4 hours (default)
- **Last 24 Hours**: Show events from the past day
- **Last Week**: Show events from the past 7 days
- **Custom Range**: Select specific start and end times

#### Time Filter Controls
- **Date Picker**: Visual calendar for selecting date ranges
- **Time Input**: Precise hour and minute selection
- **Relative Times**: Quick buttons for "Last X hours/days"
- **Real-time Update**: Time filters update automatically as new events arrive

## Filter Combination Logic

### Multiple Filter Behavior
- **AND Logic**: Multiple filters are combined with AND logic
- **Inclusive Selection**: Within categories (like event types), selection is inclusive (OR logic)
- **Hierarchical**: Session and project filters override global settings
- **Real-time**: Filter combinations are applied immediately

### Filter Priority
1. **Session Filters**: Highest priority - override other filters
2. **Event Type Filters**: Second priority - limit event types shown
3. **Project Filters**: Third priority - limit to specific projects
4. **Time Filters**: Applied to all other filter results
5. **Text Search**: Applied as final filter on visible events

### Filter Persistence
- **Browser Storage**: Filter settings are saved locally
- **Session Persistence**: Filters persist across browser sessions
- **URL State**: Filter state can be encoded in URLs for sharing
- **Reset Option**: Clear all filters button to return to defaults

## Performance Considerations

### Efficient Filtering
- **Client-side Processing**: Most filtering is done in the browser for speed
- **Incremental Updates**: Only new events are processed as they arrive
- **Index-based**: Event indexing provides fast search and filter operations
- **Memory Management**: Old events are automatically cleaned up

### Large Dataset Handling
- **Virtualization**: Only visible events are rendered in the DOM
- **Lazy Loading**: Event details are loaded on-demand
- **Batch Processing**: Multiple events are processed in batches
- **Performance Monitoring**: Filter performance is monitored and optimized

### Optimization Tips
- **Specific Filters**: Use more specific filters for better performance
- **Time Limits**: Limit time ranges for faster filtering
- **Session Focus**: Filter by session when working with specific workflows
- **Clear Unused**: Clear filters when not needed to improve performance

## Filter Status and Feedback

### Visual Indicators
- **Active Filter Badges**: Show which filters are currently applied
- **Result Counts**: Display number of events matching filters
- **Loading States**: Show when filters are being applied
- **Empty States**: Clear messaging when no events match filters

### Filter Summary
- **Applied Filters Summary**: Shows all active filters at a glance
- **Quick Remove**: Click X on any filter badge to remove it
- **Filter Effects**: Shows how many events each filter affects
- **Performance Impact**: Indicates if filters are affecting performance

## Keyboard Shortcuts for Filtering

### Filter Navigation
- **`Ctrl/Cmd + F`**: Focus the search input
- **`Ctrl/Cmd + Shift + F`**: Open advanced filter panel
- **`Alt + 1-6`**: Quick select event type filters
- **`Esc`**: Clear current search or close filter panels

### Filter Management
- **`Ctrl/Cmd + Shift + C`**: Clear all filters
- **`Ctrl/Cmd + Shift + S`**: Save current filters as preset
- **`Ctrl/Cmd + Shift + P`**: Open preset filter menu
- **`F5`**: Refresh filters and reload data

## Troubleshooting Filtering Issues

### Common Problems

#### No Events Showing
- **Check Filters**: Ensure filters aren't too restrictive
- **Time Range**: Verify time range includes expected events
- **Session Status**: Make sure you're monitoring active sessions
- **Connection**: Verify Chronicle backend connection is healthy

#### Slow Filter Performance
- **Reduce Scope**: Narrow time range or session selection
- **Clear Search**: Remove complex search terms temporarily
- **Browser Resources**: Close other browser tabs to free memory
- **Data Volume**: Consider archiving old session data

#### Filter Not Working
- **Refresh Browser**: Hard refresh to clear cached filter states
- **Reset Filters**: Use "Clear All" to reset filter state
- **Check Console**: Browser console may show filter-related errors
- **Backend Issues**: Verify Chronicle backend is responding properly

### Getting Help
- **Documentation**: Refer to this guide for detailed filter explanations
- **Examples**: See the [Dashboard Overview](./dashboard-overview.md) for usage examples
- **Configuration**: Check [Configuration Guide](./configuration.md) for backend setup
- **Session Management**: See [Session Management](./session-management.md) for session-related filtering