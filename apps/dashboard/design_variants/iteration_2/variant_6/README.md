# Chronicle Dashboard - Ultra-Minimal Focus Variant

## Design Philosophy

**Core Principle**: If it doesn't help unblock agents, remove it.

This variant eliminates all non-essential elements identified in iteration 1 feedback, focusing exclusively on productivity and actionable information for developers managing multiple Claude Code instances.

## Key Design Decisions

### Extreme Minimalism
- **Single column layout**: Reduces cognitive load and decision paralysis
- **Maximum negative space**: 3rem gaps between sections for mental breathing room
- **Typography-focused**: Clean sans-serif with careful size hierarchy
- **No charts/graphs**: Feedback showed these provided no actionable value

### Essential Elements Only

#### 1. Agents Needing Input
- **Large count display** (2rem font, amber color) for immediate attention
- **Compact blocked list** with instance name, reason, and time blocked
- **Left amber border** for instant visual scanning
- **Auto-updates** when agents are unblocked

#### 2. Currently Running Tools
- **Real-time duration tracking** updates every second
- **Tool name + instance** pairing for multi-instance clarity
- **Green accent color** indicates healthy activity
- **Empty state** when no tools running

#### 3. Recent Completions
- **Auto-hiding success events** fade after 25s, hide after 30s
- **Persistent error events** remain until addressed
- **Relative timestamps** (30s ago, 2m ago) for quick scanning
- **Color coding**: green for success, red for errors

### Visual Design

#### Lighter Dark Theme
- **Background**: `#1a1d23` (lighter than previous iterations)
- **Primary text**: `#e5e7eb` for better readability
- **Secondary text**: `#9ca3af` for hierarchy
- **Subtle borders**: `#2d3748` for section separation

#### Connection Status
- **Minimal 8px dot** in header (green/red)
- **No text labels** - status obvious from color
- **Smooth transitions** for status changes

#### Interaction Design
- **Hover states** with subtle background shifts
- **Focus indicators** for keyboard navigation
- **Reduced motion** support for accessibility
- **Slide-in animations** (0.2s) for new items

## Information Hierarchy

1. **Blocked Agents** - Most critical, requires immediate action
2. **Active Tools** - Shows current system activity
3. **Recent Events** - Historical context, auto-managed

## Performance Features

### Intelligent Event Management
- **Auto-hiding** successful events prevents information overload
- **Event grouping** (future): Rapid tool sequences become single line
- **Memory efficient**: Maximum 8 recent events displayed
- **Real-time updates** without overwhelming interface

### Accessibility
- **Semantic HTML** structure for screen readers
- **Keyboard navigation** support throughout
- **High contrast** ratios maintained despite minimal design
- **Reduced motion** preference respected

## Target Scenarios

### Primary Use Case
Developer monitoring 3-10 Claude Code instances needs to:
- Quickly identify which agents are blocked and why
- See what's currently processing
- Verify recent operations completed successfully

### Anti-Patterns Avoided
- **Pattern analysis dashboards** - Not needed for productivity
- **Complex visualizations** - Distract from actionable items
- **Information density** - Quality over quantity
- **Always-on notifications** - Auto-hide reduces noise

## Mock Data Strategy

### Realistic Scenarios
- **Agent blocking**: Decision points, confirmations, error resolution
- **Tool variety**: File operations, API calls, code analysis
- **Time ranges**: Recent activity spans minutes to hours
- **Error persistence**: Problems stay visible until resolved

### Demo Behavior
- **15s**: Random blocked agent resolution
- **20s**: Active tool completion
- **35s**: New agent becomes blocked
- **40s**: New tool starts running

## Success Metrics

This design succeeds if developers can:
1. **Identify blocked agents** in under 2 seconds
2. **Understand blocking reason** without additional context
3. **Monitor tool progress** without interrupting focus
4. **Catch errors** before they cascade to other instances

## Technical Implementation

- **Vanilla JavaScript** for maximum compatibility
- **CSS Custom Properties** for easy theming
- **No dependencies** keeps bundle minimal
- **Mobile responsive** for remote monitoring
- **60fps animations** with hardware acceleration

This ultra-minimal approach directly addresses iteration 1 feedback by removing all non-productive elements while maintaining the essential information density needed for effective multi-instance management.