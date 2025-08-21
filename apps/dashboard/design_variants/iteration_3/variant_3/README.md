# Chronicle Dashboard - Minimal Sidebar Variant

**Design Philosophy**: "Minimal Sidebar + Feed" - Maximum information density for pure monitoring focus

## Overview

This variant implements a ultra-minimal sidebar approach optimized for monitoring multiple Claude Code instances with maximum screen real estate dedicated to the event feed. The design prioritizes actionable information (sessions awaiting input) while maintaining complete visibility into agent activity patterns.

## Key Design Elements

### 1. Ultra-Thin Sidebar (64px)
- **Session dots**: Visual-only indicators with color-coded status
- **Hover tooltips**: Project name and git branch information
- **Click-to-filter**: Multi-select session filtering
- **Input badges**: Numerical indicators for awaiting input count
- **No text labels**: Pure visual density for scanning 10-30 instances

### 2. Compressed Timeline Strip (100px)
- **Sparkline visualization**: Tool activity patterns without text noise
- **Lane-per-session**: Visual swimming lanes for each instance
- **Tool density heat map**: Condensed representation of tool sequences
- **Real-time activity flow**: Streaming visual indicators
- **Minimal controls**: Pause, zoom in/out for density adjustment

### 3. Maximum Event Feed (80% screen)
- **Ultra-dense rows**: 20px height for maximum event scanning
- **Priority-based ordering**: Notifications first, then active, then completed
- **Visual indentation**: Sub-agent events clearly grouped
- **Color-coded rows**: Semantic status indication
- **Keyboard navigation**: j/k for vim-style browsing

### 4. Floating Notifications
- **Toast-style alerts**: Non-blocking awaiting input notifications
- **Auto-dismiss**: Click to acknowledge and remove
- **Type-based styling**: Different colors for input vs permission requests
- **Persistent visibility**: Maintains event feed focus

## Implementation Details

### Session Status Indicators
```css
/* Active sessions: Green border + pulsing indicator */
.session-dot.active { border-color: #238636; }

/* Awaiting input: Yellow border + pulse animation */  
.session-dot.waiting { 
    border-color: #d29922; 
    animation: pulse 2s infinite; 
}

/* Inactive: Gray and dimmed */
.session-dot.inactive { 
    opacity: 0.5; 
    border-color: #656d76; 
}
```

### Tool Activity Visualization
- **Color-coded dots**: Each tool type has distinct color
- **Sequence compression**: "R→E→B×3" for Read→Edit→Bash×3 patterns  
- **Sub-agent indicators**: "+2 sub" shows nested agent count
- **Real-time updates**: Activity flows left-to-right as sparklines

### Event Feed Optimization
- **Row height**: 20px for maximum density
- **Virtualized scrolling**: Handles thousands of events efficiently
- **Column optimization**: Fixed widths prevent layout bouncing
- **Smart filtering**: Session + event type + status combinations

## Chronicle Data Model Integration

### Event Type Handling
```javascript
// Maps to 9 Chronicle event types
const eventTypes = [
    'session_start',      // New instance startup
    'user_prompt_submit', // User request submission  
    'pre_tool_use',      // Tool execution start
    'post_tool_use',     // Tool execution completion
    'notification',      // User input required (PRIORITY)
    'stop',             // Main agent completion
    'subagent_stop',    // Sub-agent task completion
    'pre_compact',      // Context compaction
    'error'             // Execution errors
];
```

### Session Management
- **Project-based naming**: Shows folder/repo instead of session UUIDs
- **Git branch display**: Current working branch in tooltips
- **Status derivation**: Active/waiting/inactive based on latest events
- **Multi-instance scaling**: Handles 30+ concurrent sessions

### Real-time Updates
- **Event streaming**: Live updates via simulated WebSocket connection
- **Priority ordering**: Notifications bubble to top automatically  
- **Visual feedback**: New events slide in with animation
- **Performance optimization**: Row virtualization prevents DOM bloat

## User Interactions

### Keyboard Navigation (Vim-style)
- **j/k**: Move up/down through visible events
- **Enter/Space**: View detailed event information
- **/** : Focus filter dropdown for quick searching
- **?** : Show keyboard shortcut help
- **Escape**: Clear current selection

### Mouse Interactions
- **Session dots**: Click to filter, hover for project info
- **Timeline lanes**: Visual feedback shows filtered sessions  
- **Event rows**: Hover highlighting, click for details
- **Notifications**: Click floating toasts to dismiss

### Filtering System
- **Multi-select sessions**: Click multiple dots to filter
- **Event type dropdown**: Filter by specific event categories
- **Combined filtering**: Session + event type combinations
- **Persistent state**: Maintains user filter preferences

## Density Modes

### Normal Mode
- 20px row height
- Full tool sequences visible
- Standard timeline lane spacing

### High Density Mode (Zoom Out)
- 16px row height  
- Compressed tool indicators
- Reduced timeline spacing
- Maximum events per screen for power users

## Performance Considerations

### Event Handling
- **Row virtualization**: Only renders visible events
- **Lazy loading**: Loads events on-demand as user scrolls
- **Memory management**: Automatically truncates old events
- **Update batching**: Groups rapid-fire events for smooth UI

### Real-time Optimization  
- **Throttled updates**: Prevents UI blocking on high event volumes
- **Smart re-rendering**: Only updates changed elements
- **Animation optimization**: CSS transforms for smooth visual feedback

## Monitoring Focus

### Actionable Information Priority
1. **Sessions awaiting input**: Immediate visual prominence
2. **Active tool execution**: Current state visibility  
3. **Recent completions**: Context for current activity
4. **Historical patterns**: Reference data for troubleshooting

### Visual Hierarchy
- **Red/Yellow indicators**: Require user attention
- **Green indicators**: Normal operation
- **Blue indicators**: Informational context
- **Gray indicators**: Inactive/historical

## Browser Compatibility

- **Modern browsers**: Chrome 90+, Firefox 88+, Safari 14+
- **CSS Grid/Flexbox**: Full layout support required
- **Material Icons**: Google Fonts dependency
- **ES6+ JavaScript**: Modern JavaScript features used throughout

## File Structure
```
variant_3/
├── index.html          # Main dashboard markup
├── styles.css          # Complete styling system  
├── script.js           # Interactive behavior
└── README.md          # This documentation
```

## Usage Scenarios

### Primary Use Case
- **Developer workstation**: Monitor 10-30 Claude Code instances
- **Productivity focus**: Quickly identify blocked sessions
- **Event scanning**: Rapid visual inspection of agent activity
- **Keyboard-driven**: Power user workflow optimization

### Secondary Applications  
- **Team monitoring**: Shared screen for development team awareness
- **Debugging**: Pattern recognition for agent behavior analysis
- **Performance monitoring**: Tool usage and execution time tracking

This minimal sidebar variant achieves maximum monitoring efficiency by dedicating the vast majority of screen space to dense, scannable event information while providing essential session management through visual-only sidebar controls.