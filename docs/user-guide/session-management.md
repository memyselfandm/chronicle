# Session Management

Chronicle provides comprehensive session tracking and management capabilities for Claude Code interactions. This guide covers session lifecycle, multi-session support, session analytics, and data management features.

## Understanding Sessions

### What is a Session?
A session in Chronicle represents a single Claude Code conversation thread, from initialization to termination. Each session has:

- **Unique Session ID**: 8-character identifier (e.g., `abc12345`)
- **Start Time**: Precise timestamp when the session was initiated
- **Duration**: Total time the session has been active
- **Event Count**: Number of events generated within the session
- **Status**: Current state (Active, Completed, Error, or Inactive)
- **Working Directory**: Project folder where Claude Code was launched
- **Tool Usage**: List of tools used during the session

### Session Lifecycle

#### 1. Session Initialization (`session_start` event)
- Triggered when Claude Code starts a new conversation
- Creates unique session ID and initial metadata
- Records working directory and environment context
- Establishes connection to Chronicle backend

#### 2. Active Phase
- **User Interactions**: `user_prompt_submit` events for each user input
- **Tool Executions**: `pre_tool_use` and `post_tool_use` event pairs
- **System Notifications**: `notification` events for system updates
- **Real-time Monitoring**: Live tracking of session activity

#### 3. Session Termination (`stop` event)
- Triggered when Claude Code session ends naturally
- Records final session statistics and cleanup status
- Calculates total duration and event counts
- Archives session data for historical analysis

#### 4. Error Handling
- **Unexpected Termination**: Sessions that end without proper `stop` event
- **Timeout Detection**: Sessions inactive for extended periods
- **Error Recovery**: Automatic detection and flagging of problematic sessions
- **Data Integrity**: Ensures session data remains consistent

## Multi-Session Support

Chronicle can monitor multiple Claude Code sessions simultaneously:

### Concurrent Session Tracking
- **Unlimited Sessions**: Monitor as many concurrent sessions as needed
- **Real-time Updates**: All active sessions update in real-time
- **Independent Filtering**: Filter and view each session independently
- **Resource Management**: Efficient handling of multiple session streams

### Session Switching
- **Quick Navigation**: Switch between active sessions instantly
- **Session Badges**: Visual indicators in the header show active sessions
- **Keyboard Shortcuts**: Use number keys (1-9) for quick session switching
- **Context Preservation**: Filter settings preserved per session

### Session List Management
The sidebar session list provides:
- **Active Sessions**: Currently running Claude Code sessions
- **Recent Sessions**: Recently completed sessions (last 24 hours)
- **Session Search**: Find sessions by ID, project, or time range
- **Bulk Operations**: Select multiple sessions for batch operations

## Session Status Indicators

Chronicle provides detailed visual feedback on session states:

### Status Types

#### Active Sessions (Green Indicator)
- **Real-time Activity**: Currently receiving new events
- **Healthy Connection**: Backend connection is stable
- **User Interaction**: Recent user prompts or tool usage
- **Expected Behavior**: Normal session operation

#### Completed Sessions (Gray Indicator)  
- **Natural Termination**: Session ended with proper `stop` event
- **Clean Shutdown**: All tools completed successfully
- **Archive Ready**: Session data is complete and archived
- **Historical Analysis**: Available for review and comparison

#### Error Sessions (Red Indicator)
- **Unexpected Termination**: Session ended without proper cleanup
- **Tool Failures**: Multiple tool execution errors occurred
- **Connection Issues**: Backend connectivity problems during session
- **Investigation Needed**: May require manual review

#### Inactive Sessions (Yellow Indicator)
- **Stalled Activity**: No recent events but session hasn't terminated
- **Connection Timeout**: Possible network or system issues
- **Awaiting Input**: May be waiting for user interaction
- **Monitor Closely**: Could indicate problems or normal waiting state

### Status Details
Hover over any session status indicator to see:
- **Last Activity**: Timestamp of most recent event
- **Event Rate**: Events per minute for this session
- **Tool Status**: Currently executing tools (if any)
- **Connection Quality**: Backend response times and reliability
- **Error Summary**: Brief description of any issues encountered

## Session Analytics and Metrics

Chronicle provides detailed analytics for each session:

### Performance Metrics

#### Duration Tracking
- **Total Duration**: Complete session time from start to finish
- **Active Time**: Time spent actively using tools and submitting prompts
- **Idle Time**: Periods with no user activity
- **Tool Execution Time**: Cumulative time spent executing tools

#### Event Statistics
- **Total Events**: Complete count of all events in session
- **Event Types Breakdown**: Distribution of event types
- **Event Rate**: Average events per minute
- **Peak Activity**: Periods of highest event generation

#### Tool Usage Analysis
- **Tools Used**: Complete list of tools invoked during session
- **Tool Frequency**: How often each tool was used
- **Success Rate**: Percentage of successful vs failed tool executions
- **Performance Data**: Average execution times per tool

### Success Rate Calculations
Chronicle calculates success rates based on:
- **Tool Executions**: Successful vs failed tool invocations
- **Session Completion**: Clean termination vs errors
- **User Satisfaction**: Inferred from session patterns and duration
- **Error Recovery**: How well issues were resolved during the session

### Comparative Analytics
Compare sessions across multiple dimensions:
- **Duration Comparison**: Which sessions took longer/shorter
- **Tool Usage Patterns**: Different approaches to similar problems
- **Error Rates**: Sessions with more/fewer issues
- **Productivity Metrics**: Events per hour, tools per session, etc.

## Session Data Export

Chronicle supports exporting session data in multiple formats:

### Export Options

#### Individual Session Export
- **JSON Format**: Complete session data with all events
- **CSV Format**: Tabular data suitable for spreadsheet analysis
- **Event Log**: Chronological list of events with timestamps
- **Summary Report**: High-level session statistics and metrics

#### Bulk Export Features
- **Multiple Sessions**: Select and export several sessions at once
- **Date Range Export**: Export all sessions within a specific time period
- **Filtered Export**: Export only sessions matching current filters
- **Project-based Export**: Export all sessions for a specific project

### Export Data Contents
Exported session data includes:
- **Session Metadata**: ID, start/end times, duration, status
- **Complete Event Log**: All events with full JSON payloads
- **Tool Usage Summary**: List of tools used and their performance
- **Error Log**: Any errors or issues encountered
- **Performance Metrics**: Detailed timing and success rate data

### Export Formats

#### JSON Export
```json
{
  "session_id": "abc12345",
  "start_time": "2024-01-15T10:30:00Z",
  "end_time": "2024-01-15T11:45:00Z",
  "duration_minutes": 75,
  "total_events": 42,
  "events": [...],
  "tools_used": [...],
  "metrics": {...}
}
```

#### CSV Export
- Headers: timestamp, event_type, session_id, tool_name, status, duration_ms
- Compatible with Excel, Google Sheets, and data analysis tools
- Easy filtering and pivot table creation
- Suitable for statistical analysis

## Session Import

Chronicle supports importing session data for analysis:

### Import Sources
- **Chronicle JSON**: Native Chronicle session export format
- **Event Logs**: Plain text event logs with timestamps
- **CSV Data**: Spreadsheet data with proper column mapping
- **Backup Files**: Previously exported Chronicle backup data

### Import Process
1. **File Selection**: Choose the file(s) to import
2. **Format Detection**: Chronicle automatically detects data format
3. **Validation**: Verifies data integrity and completeness  
4. **Mapping**: Maps imported data to Chronicle's internal format
5. **Integration**: Adds imported sessions to the dashboard

### Import Validation
Chronicle validates imported data for:
- **Data Integrity**: Ensures all required fields are present
- **Timestamp Accuracy**: Verifies chronological event ordering
- **Session Completeness**: Checks for missing start/end events
- **Format Compliance**: Ensures data matches Chronicle's schema

## Session Comparison Tools

Compare multiple sessions to analyze patterns and performance:

### Comparison Features

#### Side-by-Side Analysis
- **Event Timeline**: Compare event sequences across sessions
- **Tool Usage**: See different tool choices for similar tasks
- **Performance**: Compare durations and success rates
- **Patterns**: Identify common approaches and variations

#### Metrics Comparison
- **Duration**: Compare total and active time
- **Event Counts**: Compare activity levels
- **Tool Performance**: Compare tool execution times
- **Success Rates**: Compare error rates and completion status

#### Visual Comparisons
- **Timeline Charts**: Graphical representation of session timelines
- **Tool Usage Pie Charts**: Visual tool distribution comparison
- **Performance Graphs**: Bar charts showing key metrics
- **Event Type Distribution**: Compare event patterns

### Comparison Workflows
1. **Select Sessions**: Choose 2-5 sessions to compare
2. **Choose Metrics**: Select which aspects to compare
3. **Generate Report**: Chronicle creates comparison analysis
4. **Export Results**: Save comparison data for later reference

## Advanced Session Management

### Session Organization

#### Tagging and Categorization
- **Custom Tags**: Add descriptive tags to sessions
- **Project Association**: Link sessions to specific projects
- **Category Grouping**: Organize sessions by type or purpose
- **Search Enhancement**: Tags improve session search and filtering

#### Session Archiving
- **Automatic Archiving**: Old sessions automatically archived
- **Manual Archive**: Archive specific sessions on demand
- **Archive Search**: Search archived sessions separately
- **Storage Management**: Archived sessions use optimized storage

### Batch Operations
Perform actions on multiple sessions simultaneously:
- **Bulk Export**: Export multiple sessions at once
- **Batch Archive**: Archive selected sessions
- **Mass Tag**: Apply tags to multiple sessions
- **Delete Multiple**: Remove multiple sessions (with confirmation)

### Session Templates
Create templates for common session patterns:
- **Workflow Templates**: Standard sequences of tool usage
- **Project Templates**: Common patterns for specific project types
- **Analysis Templates**: Pre-configured analysis and export settings
- **Filter Templates**: Saved filter combinations for specific use cases

## Troubleshooting Session Issues

### Common Session Problems

#### Missing Sessions
- **Check Connection**: Verify Chronicle backend connectivity
- **Time Range**: Ensure time filters include expected sessions
- **Project Filters**: Check if project filtering is too restrictive
- **Backend Mode**: Confirm correct backend (SQLite vs Supabase) is active

#### Incomplete Sessions
- **Connection Interruption**: Network issues during session
- **Backend Errors**: Chronicle backend encountered issues
- **Manual Termination**: Session was forcefully terminated
- **Data Recovery**: Use session repair tools when available

#### Performance Issues
- **Too Many Sessions**: Limit active session monitoring
- **Large Sessions**: Archive or filter very large sessions
- **Memory Usage**: Browser memory issues with extensive session data
- **Backend Performance**: Chronicle backend resource constraints

### Diagnostic Tools
Chronicle provides built-in diagnostic capabilities:
- **Connection Testing**: Test backend connectivity
- **Session Validation**: Check session data integrity
- **Performance Monitoring**: Track session processing performance
- **Error Logging**: Detailed error logs for troubleshooting

### Recovery Procedures
When session issues occur:
1. **Identify Problem**: Use diagnostic tools to understand the issue
2. **Check Connectivity**: Verify backend connection is healthy
3. **Validate Data**: Run session validation tools
4. **Repair if Possible**: Use built-in repair functions
5. **Manual Intervention**: Contact support for complex issues

## Integration with Other Features

### Dashboard Integration
- **Real-time Display**: Active sessions appear in dashboard header
- **Session Switching**: Click session badges to switch focus
- **Filter Integration**: Session selection affects all dashboard filters
- **Performance Impact**: Session count affects dashboard performance

### Event Feed Integration
- **Session Filtering**: Event feed respects session selections
- **Session Context**: Events show session context and relationships
- **Session Navigation**: Click session IDs in events to switch sessions
- **Cross-session Analysis**: Compare events across multiple sessions

### Configuration Integration
- **Backend Settings**: Session management respects backend configuration
- **Storage Options**: Session data storage follows configuration settings
- **Performance Tuning**: Session management performance can be tuned
- **Security Settings**: Session access controlled by configuration

For more information on related features:
- [Dashboard Overview](./dashboard-overview.md) - Main dashboard functionality
- [Event Filtering](./filtering-events.md) - How to filter events by session
- [Configuration](./configuration.md) - Backend and storage configuration