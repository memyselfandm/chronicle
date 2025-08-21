# Chronicle Dashboard - Variant 4: Productivity Monitor

## Overview
This variant focuses on **productivity monitoring and unblocking agents efficiently** based on feedback from iteration 1. The design prioritizes helping developers manage multiple Claude Code instances by immediately surfacing blocked agents and providing dense, actionable information.

## Key Features

### 🚨 Agents Needing Input (Top Priority)
- **Prominent section** at the top of the dashboard
- **Time waiting indicators** showing how long agents have been blocked
- **Color-coded urgency** (pulsing animation for long waits)
- **One-click context** to understand what each agent needs

### 📊 Agent Status Board (Grid View)
- **Compact grid layout** that scales to 10-30 instances
- **Color-coded status indicators**:
  - 🟢 **Green**: Active agents working normally
  - 🟡 **Yellow**: Agents waiting for input
  - 🔴 **Red**: Agents with errors
  - ⚪ **Gray**: Idle agents
- **Current tool/task displayed** for each agent
- **Quick stats**: Completed tasks, active time

### 🔍 Advanced Filtering
- **Status filter**: Show only active, waiting, error, or idle agents
- **Event type filter**: Filter events by tool use, user input, completion, error
- **Blocked-only toggle**: Show only agents needing attention
- **Time range controls**: 5m, 15m, 1h, 4h views

### 📝 Dense Event Feed
- **High information density** following variant 1's successful approach
- **Tool names visible** in each event row
- **Agent association** clearly displayed
- **Compact time stamps** (relative: 2m, 15m, 1h)
- **Status indicators** (success, waiting, error)

### 📋 Pending Response Queue
- **Queue of agents** waiting for user responses
- **Context preview** for each pending item
- **Time waiting** for prioritization

### 🎛️ Productivity Controls
- **Pause/Resume** functionality for the live feed
- **One-click unblock** buttons for waiting agents
- **Agent context popups** with detailed status information

## Design Principles

### Dark Theme
- **Background**: `#0d1117` (GitHub Dark theme)
- **Cards/Panels**: `#161b22` with `#30363d` borders
- **Text**: `#f0f6fc` primary, `#8b949e` secondary, `#7d8590` tertiary

### Information Density
- **Minimal header** (thin, essential info only)
- **Compact event rows** (11px font, tight spacing)
- **Grid layout** for efficient space usage
- **Scrollable sections** with custom dark scrollbars

### Color Coding System
- **Green** (`#3fb950`): Active, successful, healthy
- **Yellow** (`#d29922`): Waiting, caution, needs attention
- **Red** (`#f85149`): Error, blocked, urgent
- **Blue** (`#58a6ff`): Agent names, links, info
- **Gray** (`#6e7681`): Idle, inactive, disabled

## Mock Data
The dashboard includes realistic mock data with:
- **8 agent instances** with varied statuses
- **3 blocked agents** requiring user input
- **50+ recent events** with different tools and outcomes
- **Pending response queue** with context
- **Live simulation** of new activity every 2 seconds

## Responsive Features
- **Mobile-friendly** layout adjustments
- **Flexible grid** that adapts to screen size
- **Collapsible filters** on small screens
- **Touch-friendly** interaction targets

## Technical Implementation
- **Pure JavaScript** (no frameworks for simplicity)
- **CSS Grid** for responsive layouts
- **CSS animations** for visual feedback
- **Local mock data** with realistic patterns
- **Event simulation** for testing

## Productivity Focus
Unlike iteration 1 variants that included pattern analysis or complex visualizations, this variant stays focused on:
1. **Identifying blocked agents** quickly
2. **Providing context** for unblocking decisions  
3. **Monitoring active work** across instances
4. **Dense information display** for efficiency
5. **Quick actions** to resolve blocks

This design directly addresses the feedback that the dashboard should help maintain productivity across multiple Claude Code instances rather than provide analytical insights.