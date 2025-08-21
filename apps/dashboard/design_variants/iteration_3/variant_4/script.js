// Chronicle Dashboard - Top Navigation Monitor JavaScript

class ChronicleMonitor {
    constructor() {
        this.currentSession = 's1';
        this.autoScroll = true;
        this.isPaused = false;
        this.eventFilters = new Set(['all']);
        this.timeZoom = '30m';
        
        this.init();
        this.startSimulation();
    }

    init() {
        this.bindEventListeners();
        this.updateEventCounts();
        this.initializeTimeline();
    }

    bindEventListeners() {
        // Session tab switching
        document.querySelectorAll('.session-tab').forEach(tab => {
            tab.addEventListener('click', (e) => {
                if (e.target.classList.contains('close-tab')) {
                    e.stopPropagation();
                    this.closeSession(tab.dataset.session);
                } else {
                    this.switchToSession(tab.dataset.session);
                }
            });
        });

        // Awaiting input banner actions
        const awaitingSessions = document.querySelectorAll('.awaiting-session');
        awaitingSessions.forEach(btn => {
            btn.addEventListener('click', () => {
                this.jumpToSession(btn.dataset.session);
            });
        });

        // Dismiss banner
        const dismissBtn = document.getElementById('dismissBanner');
        if (dismissBtn) {
            dismissBtn.addEventListener('click', () => {
                this.dismissBanner();
            });
        }

        // Global filters
        const instanceSelect = document.getElementById('instanceSelect');
        instanceSelect.addEventListener('change', (e) => {
            this.filterByInstance(e.target.value);
        });

        const eventTypeFilter = document.getElementById('eventTypeFilter');
        eventTypeFilter.addEventListener('change', (e) => {
            this.filterByEventType(e.target.value);
        });

        // Control buttons
        const pauseBtn = document.getElementById('pauseBtn');
        pauseBtn.addEventListener('click', () => {
            this.togglePause();
        });

        const autoScrollBtn = document.getElementById('autoScrollBtn');
        autoScrollBtn.addEventListener('click', () => {
            this.toggleAutoScroll();
        });

        // Timeline zoom controls
        document.querySelectorAll('.zoom-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.setTimeZoom(btn.dataset.zoom);
            });
        });

        // Timeline activity items
        document.querySelectorAll('.activity-item').forEach(item => {
            item.addEventListener('click', (e) => {
                this.showActivityDetails(e.target.closest('.activity-item'));
            });
        });

        // Event row clicks
        document.addEventListener('click', (e) => {
            const eventRow = e.target.closest('.event-row');
            if (eventRow) {
                this.selectEvent(eventRow);
            }
        });
    }

    switchToSession(sessionId) {
        if (!sessionId || sessionId === 'undefined') return;
        
        // Update active tab
        document.querySelectorAll('.session-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        
        const targetTab = document.querySelector(`[data-session="${sessionId}"]`);
        if (targetTab) {
            targetTab.classList.add('active');
        }

        this.currentSession = sessionId;
        this.filterEventFeed();
        this.highlightSessionInTimeline(sessionId);
        
        console.log(`Switched to session: ${sessionId}`);
    }

    closeSession(sessionId) {
        const tab = document.querySelector(`[data-session="${sessionId}"]`);
        if (tab) {
            tab.style.opacity = '0.5';
            setTimeout(() => {
                tab.remove();
                // If closed session was active, switch to first available
                if (this.currentSession === sessionId) {
                    const firstTab = document.querySelector('.session-tab:not(.overflow-indicator)');
                    if (firstTab) {
                        this.switchToSession(firstTab.dataset.session);
                    }
                }
            }, 200);
        }
        
        console.log(`Closed session: ${sessionId}`);
    }

    jumpToSession(sessionId) {
        this.switchToSession(sessionId);
        
        // Scroll to session in timeline
        const swimlane = document.querySelector(`[data-session="${sessionId}"]`);
        if (swimlane) {
            swimlane.scrollIntoView({ behavior: 'smooth', block: 'center' });
            
            // Highlight briefly
            swimlane.style.boxShadow = '0 0 0 2px var(--status-waiting)';
            setTimeout(() => {
                swimlane.style.boxShadow = '';
            }, 2000);
        }
        
        console.log(`Jumped to session: ${sessionId}`);
    }

    dismissBanner() {
        const banner = document.getElementById('awaitingBanner');
        if (banner) {
            banner.style.transform = 'translateY(-100%)';
            banner.style.opacity = '0';
            setTimeout(() => {
                banner.style.display = 'none';
            }, 300);
        }
        
        // Simulate banner reappearing after some time
        setTimeout(() => {
            this.showBanner();
        }, 30000);
    }

    showBanner() {
        const banner = document.getElementById('awaitingBanner');
        if (banner) {
            banner.style.display = 'flex';
            banner.style.transform = 'translateY(0)';
            banner.style.opacity = '1';
        }
    }

    filterByInstance(instanceId) {
        console.log(`Filtering by instance: ${instanceId}`);
        
        // In a real implementation, this would filter the data
        // For now, just update the UI to show the filter is active
        const swimlanes = document.querySelectorAll('.swimlane');
        
        if (instanceId === 'all') {
            swimlanes.forEach(lane => {
                lane.style.display = 'flex';
            });
        } else {
            swimlanes.forEach(lane => {
                // Hide non-matching instances (simplified demo)
                const shouldShow = Math.random() > 0.3; // Random for demo
                lane.style.display = shouldShow ? 'flex' : 'none';
            });
        }
        
        this.updateEventCounts();
    }

    filterByEventType(eventType) {
        this.eventFilters.clear();
        this.eventFilters.add(eventType);
        
        this.filterEventFeed();
        console.log(`Filtering by event type: ${eventType}`);
    }

    filterEventFeed() {
        const eventRows = document.querySelectorAll('.event-row');
        let visibleCount = 0;
        
        eventRows.forEach(row => {
            const sessionMatch = this.currentSession === 'all' || 
                                row.dataset.session === this.currentSession;
            
            const eventTypeMatch = this.eventFilters.has('all') || 
                                  this.matchesEventFilter(row);
            
            if (sessionMatch && eventTypeMatch) {
                row.style.display = '';
                visibleCount++;
            } else {
                row.style.display = 'none';
            }
        });
        
        this.updateEventCount(visibleCount);
    }

    matchesEventFilter(row) {
        const eventType = row.querySelector('.event-type');
        if (!eventType) return false;
        
        const type = eventType.textContent.toLowerCase();
        
        for (const filter of this.eventFilters) {
            if (filter === 'all') return true;
            if (type.includes(filter.replace('_', ' '))) return true;
        }
        
        return false;
    }

    togglePause() {
        this.isPaused = !this.isPaused;
        const pauseBtn = document.getElementById('pauseBtn');
        const icon = pauseBtn.querySelector('.material-icons');
        
        if (this.isPaused) {
            icon.textContent = 'play_arrow';
            pauseBtn.style.background = 'var(--status-waiting)';
        } else {
            icon.textContent = 'pause';
            pauseBtn.style.background = '';
        }
        
        console.log(`Feed ${this.isPaused ? 'paused' : 'resumed'}`);
    }

    toggleAutoScroll() {
        this.autoScroll = !this.autoScroll;
        const autoScrollBtn = document.getElementById('autoScrollBtn');
        
        if (this.autoScroll) {
            autoScrollBtn.classList.add('active');
        } else {
            autoScrollBtn.classList.remove('active');
        }
        
        console.log(`Auto-scroll ${this.autoScroll ? 'enabled' : 'disabled'}`);
    }

    setTimeZoom(zoom) {
        document.querySelectorAll('.zoom-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        
        const activeBtn = document.querySelector(`[data-zoom="${zoom}"]`);
        if (activeBtn) {
            activeBtn.classList.add('active');
        }
        
        this.timeZoom = zoom;
        this.updateTimelineScale();
        
        console.log(`Timeline zoom set to: ${zoom}`);
    }

    updateTimelineScale() {
        // Adjust timeline scale based on zoom level
        const activityItems = document.querySelectorAll('.activity-item');
        const zoomMultipliers = {
            '5m': 4,
            '10m': 2,
            '30m': 1,
            '1h': 0.5
        };
        
        const multiplier = zoomMultipliers[this.timeZoom] || 1;
        
        activityItems.forEach(item => {
            const currentLeft = parseFloat(item.style.left || '0');
            // Adjust positioning based on zoom
            const newLeft = Math.min(currentLeft * multiplier, 90);
            item.style.left = `${newLeft}%`;
        });
    }

    highlightSessionInTimeline(sessionId) {
        document.querySelectorAll('.swimlane').forEach(lane => {
            if (lane.dataset.session === sessionId) {
                lane.style.background = 'rgba(88, 166, 255, 0.05)';
                lane.style.borderColor = 'var(--tool-read)';
            } else {
                lane.style.background = '';
                lane.style.borderColor = '';
            }
        });
    }

    showActivityDetails(activityItem) {
        const title = activityItem.getAttribute('title');
        const rect = activityItem.getBoundingClientRect();
        
        // Create or update tooltip
        let tooltip = document.getElementById('activityTooltip');
        if (!tooltip) {
            tooltip = document.createElement('div');
            tooltip.id = 'activityTooltip';
            tooltip.style.cssText = `
                position: fixed;
                background: var(--bg-tertiary);
                border: 1px solid var(--border-color);
                border-radius: 6px;
                padding: 8px 12px;
                font-size: 12px;
                color: var(--text-primary);
                z-index: 1000;
                pointer-events: none;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            `;
            document.body.appendChild(tooltip);
        }
        
        tooltip.textContent = title;
        tooltip.style.left = `${rect.left + rect.width / 2}px`;
        tooltip.style.top = `${rect.top - 40}px`;
        tooltip.style.transform = 'translateX(-50%)';
        tooltip.style.opacity = '1';
        
        // Hide after delay
        setTimeout(() => {
            if (tooltip) {
                tooltip.style.opacity = '0';
            }
        }, 3000);
    }

    selectEvent(eventRow) {
        // Remove previous selection
        document.querySelectorAll('.event-row').forEach(row => {
            row.classList.remove('selected');
        });
        
        // Add selection to clicked row
        eventRow.classList.add('selected');
        
        // Highlight related events (paired pre/post tool use)
        const sessionId = eventRow.dataset.session;
        const toolName = eventRow.querySelector('.tool-col').textContent.trim();
        
        if (toolName && toolName !== '-') {
            this.highlightRelatedEvents(sessionId, toolName);
        }
    }

    highlightRelatedEvents(sessionId, toolName) {
        const relatedRows = document.querySelectorAll(
            `.event-row[data-session="${sessionId}"]`
        );
        
        relatedRows.forEach(row => {
            const rowTool = row.querySelector('.tool-col').textContent.trim();
            if (rowTool === toolName) {
                row.classList.add('related');
            } else {
                row.classList.remove('related');
            }
        });
        
        // Remove highlighting after a delay
        setTimeout(() => {
            relatedRows.forEach(row => {
                row.classList.remove('related');
            });
        }, 5000);
    }

    updateEventCounts() {
        const visibleRows = document.querySelectorAll('.event-row:not([style*="display: none"])');
        this.updateEventCount(visibleRows.length);
    }

    updateEventCount(count) {
        const eventCountElement = document.querySelector('.event-count');
        if (eventCountElement) {
            eventCountElement.textContent = `Showing ${count} events`;
        }
    }

    initializeTimeline() {
        // Set initial activity item positions with slight randomization
        const activityItems = document.querySelectorAll('.activity-item');
        activityItems.forEach((item, index) => {
            const basePosition = 10 + (index * 15);
            const randomOffset = Math.random() * 10 - 5;
            const position = Math.max(5, Math.min(85, basePosition + randomOffset));
            item.style.left = `${position}%`;
        });
    }

    // Simulation methods for demo purposes
    startSimulation() {
        if (this.isPaused) return;
        
        // Simulate new events every 3-8 seconds
        const interval = 3000 + Math.random() * 5000;
        
        setTimeout(() => {
            this.addNewEvent();
            this.updateTimelineActivity();
            this.startSimulation();
        }, interval);
    }

    addNewEvent() {
        if (this.isPaused) return;
        
        const eventTableBody = document.getElementById('eventTableBody');
        const sessions = ['s1', 's2', 's3'];
        const tools = ['Read', 'Edit', 'Bash', 'Grep', 'Task'];
        const eventTypes = ['pre_tool_use', 'post_tool_use', 'notification'];
        
        const sessionId = sessions[Math.floor(Math.random() * sessions.length)];
        const tool = tools[Math.floor(Math.random() * tools.length)];
        const eventType = eventTypes[Math.floor(Math.random() * eventTypes.length)];
        
        const now = new Date();
        const timeStr = now.toTimeString().split(' ')[0];
        
        // Create new event row
        const newRow = document.createElement('tr');
        newRow.className = 'event-row current';
        newRow.dataset.session = sessionId;
        
        newRow.innerHTML = `
            <td class="time-col">${timeStr}</td>
            <td class="session-col">
                <span class="session-pill">${sessionId.toUpperCase()}</span>
                <span class="project-name">live-project</span>
            </td>
            <td class="type-col">
                <span class="event-type ${eventType.replace('_', '-')}">${eventType}</span>
            </td>
            <td class="tool-col">${tool}</td>
            <td class="details-col">Live activity simulation - ${tool} operation</td>
            <td class="status-col">
                <span class="status-indicator running">Running</span>
            </td>
        `;
        
        // Insert at top
        eventTableBody.insertBefore(newRow, eventTableBody.firstChild);
        
        // Remove current class from previous events
        setTimeout(() => {
            document.querySelectorAll('.event-row.current').forEach(row => {
                if (row !== newRow) {
                    row.classList.remove('current');
                }
            });
        }, 2000);
        
        // Auto-scroll to bottom if enabled
        if (this.autoScroll) {
            const eventFeed = document.querySelector('.event-feed');
            eventFeed.scrollTop = 0; // Scroll to top since we're inserting new events there
        }
        
        this.updateEventCounts();
    }

    updateTimelineActivity() {
        // Add new activity items to random swimlanes
        const swimlanes = document.querySelectorAll('.swimlane-track');
        const randomLane = swimlanes[Math.floor(Math.random() * swimlanes.length)];
        
        if (randomLane) {
            const tools = ['read', 'edit', 'bash', 'grep', 'task'];
            const randomTool = tools[Math.floor(Math.random() * tools.length)];
            
            const newActivity = document.createElement('div');
            newActivity.className = `activity-item ${randomTool} current`;
            newActivity.style.left = '90%';
            newActivity.title = `${randomTool}: Live activity`;
            
            const icon = document.createElement('span');
            icon.className = 'material-icons';
            icon.textContent = this.getToolIcon(randomTool);
            newActivity.appendChild(icon);
            
            randomLane.appendChild(newActivity);
            
            // Animate the activity moving left
            setTimeout(() => {
                newActivity.style.transition = 'left 5s ease-out';
                newActivity.style.left = `${Math.random() * 80}%`;
            }, 100);
            
            // Remove current status after animation
            setTimeout(() => {
                newActivity.classList.remove('current');
            }, 3000);
            
            // Clean up old activity items
            this.cleanupOldActivities(randomLane);
        }
    }

    getToolIcon(toolName) {
        const icons = {
            'read': 'description',
            'edit': 'edit',
            'bash': 'terminal',
            'grep': 'search',
            'task': 'psychology',
            'notification': 'notification_important'
        };
        return icons[toolName] || 'help';
    }

    cleanupOldActivities(lane) {
        const activities = lane.querySelectorAll('.activity-item');
        if (activities.length > 8) {
            // Remove oldest activities
            for (let i = 0; i < activities.length - 8; i++) {
                activities[i].remove();
            }
        }
    }
}

// Add CSS for selection and related event highlighting
const additionalStyles = `
    .event-row.selected {
        background: rgba(88, 166, 255, 0.15) !important;
        border-left: 3px solid var(--tool-read);
    }
    
    .event-row.related {
        background: rgba(88, 166, 255, 0.08) !important;
    }
    
    #activityTooltip {
        transition: opacity 0.2s ease;
    }
`;

// Inject additional styles
const styleSheet = document.createElement('style');
styleSheet.textContent = additionalStyles;
document.head.appendChild(styleSheet);

// Initialize the dashboard when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.chronicleMonitor = new ChronicleMonitor();
    console.log('Chronicle Dashboard - Top Navigation Monitor initialized');
});

// Handle window resize for responsive layout
window.addEventListener('resize', () => {
    // Ensure timeline elements are properly positioned
    if (window.chronicleMonitor) {
        window.chronicleMonitor.updateTimelineScale();
    }
});

// Keyboard shortcuts for power users
document.addEventListener('keydown', (e) => {
    if (!window.chronicleMonitor) return;
    
    // Numbers 1-6 for session switching
    if (e.key >= '1' && e.key <= '6') {
        const sessionIndex = parseInt(e.key) - 1;
        const sessionTabs = document.querySelectorAll('.session-tab:not(.overflow-indicator)');
        if (sessionTabs[sessionIndex]) {
            const sessionId = sessionTabs[sessionIndex].dataset.session;
            window.chronicleMonitor.switchToSession(sessionId);
        }
    }
    
    // Space bar to pause/resume
    if (e.code === 'Space' && e.target.tagName !== 'INPUT' && e.target.tagName !== 'SELECT') {
        e.preventDefault();
        window.chronicleMonitor.togglePause();
    }
    
    // A key to toggle auto-scroll
    if (e.key === 'a' && !e.ctrlKey && !e.metaKey) {
        window.chronicleMonitor.toggleAutoScroll();
    }
});