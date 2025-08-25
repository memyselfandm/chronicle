# Changelog

All notable changes to the Chronicle Dashboard will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.5.0] - 2025-08-24

### Added
- Full component integration with real-time data flow
- Keyboard navigation support (j/k for events, 1/2/3 for filters, Cmd+B for sidebar)
- Session filtering through sidebar selection
- Real-time metrics in header (active/awaiting counts, event rate sparkline)
- Event feed with virtual scrolling for 1000+ events
- Session grouping by git repository or project folder
- Awaiting sessions highlighting and priority section
- Layout persistence in localStorage
- Tool name extraction from metadata JSON fields
- Multi-select support for session filtering

### Fixed
- CHR-88: Dashboard layout issues with floating event feed
- CHR-88: CSS Grid containment properly implemented
- CHR-88: Removed debug displays and development overlays
- CHR-62: Tool names showing as "null" in events
- CHR-62: Sessions with notifications not showing as awaiting
- CHR-62: Event details not displaying correct tool information

### Changed
- Event feed now displays as full-width section without borders
- Session column width doubled from 140px to 280px
- Header shows real-time metrics instead of static text
- Sidebar sessions organized by project with collapsible folders
- Event rows reduced to 22px height for maximum density

### Technical
- Implemented Zustand store for component communication
- Added metadata extraction logic for tool names
- Enhanced session awaiting detection algorithm
- Optimized React rendering with proper memoization
- Added keyboard event handlers throughout application

## [0.4.0] - 2025-08-23

### Added
- Component cleanup and consolidation (CHR-84)
- Standardized component naming conventions
- Proper TypeScript types throughout

### Fixed
- Removed duplicate components
- Fixed import paths
- Resolved TypeScript errors

## [0.3.0] - 2025-08-22

### Added
- Event feed with real-time updates
- Virtual scrolling for performance
- Event batching system
- Color-coded event types

## [0.2.0] - 2025-08-21

### Added
- Sidebar with session management
- Header with status indicators
- Basic layout structure
- Supabase integration

## [0.1.0] - 2025-08-20

### Added
- Initial project setup
- Next.js 14 configuration
- Tailwind CSS setup
- Basic component structure