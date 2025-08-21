// Chronicle Dashboard - Minimal Sidebar JavaScript
class ChronicleMinimalDashboard {
    constructor() {
        this.selectedSessions = new Set();
        this.currentKeyboardRow = 0;
        this.isPaused = false;
        this.eventUpdateInterval = null;
        this.simulatedEvents = [];
        this.eventCounter = 247;
        
        this.init();
        this.setupKeyboardNavigation();
        this.startEventSimulation();
        this.setupFloatingNotifications();
    }

    init() {
        this.setupSessionDots();
        this.setupFilters();
        this.setupTimelineControls();
        this.setupTooltips();
        this.updateEventFeed();
        
        console.log('Chronicle Minimal Dashboard initialized - hella hyphy monitoring mode active');
    }

    setupSessionDots() {
        const sessionDots = document.querySelectorAll('.session-dot');
        
        sessionDots.forEach(dot => {
            dot.addEventListener('click', (e) => {
                e.preventDefault();
                const sessionId = dot.dataset.sessionId;
                
                // Toggle selection
                if (this.selectedSessions.has(sessionId)) {
                    this.selectedSessions.delete(sessionId);
                    dot.classList.remove('selected');
                } else {
                    this.selectedSessions.add(sessionId);
                    dot.classList.add('selected');
                }
                
                this.updateEventFeed();
                
                // Update timeline lane highlighting
                this.updateTimelineLanes();
            });
            
            // Add hover effects for session info
            dot.addEventListener('mouseenter', (e) => {
                const tooltip = dot.dataset.tooltip;
                if (tooltip) {
                    this.showTooltip(e, tooltip);
                }
            });
            
            dot.addEventListener('mouseleave', () => {
                this.hideTooltip();
            });
        });
    }

    setupFilters() {
        const eventTypeFilter = document.getElementById('event-type-filter');
        const sessionFilter = document.getElementById('session-filter');
        
        eventTypeFilter.addEventListener('change', () => {
            this.updateEventFeed();
        });
        
        sessionFilter.addEventListener('change', () => {
            const selectedSession = sessionFilter.value;
            if (selectedSession) {
                // Auto-select the session dot
                this.selectedSessions.clear();
                this.selectedSessions.add(selectedSession);
                
                // Update UI
                document.querySelectorAll('.session-dot').forEach(dot => {
                    if (dot.dataset.sessionId === selectedSession) {
                        dot.classList.add('selected');
                    } else {
                        dot.classList.remove('selected');
                    }
                });
            }
            
            this.updateEventFeed();
            this.updateTimelineLanes();
        });
    }

    setupTimelineControls() {
        const pauseBtn = document.getElementById('pause-timeline');
        const zoomOutBtn = document.getElementById('zoom-out');
        const zoomInBtn = document.getElementById('zoom-in');
        
        pauseBtn.addEventListener('click', () => {
            this.isPaused = !this.isPaused;
            
            if (this.isPaused) {
                pauseBtn.innerHTML = '<span class="material-icons">play_arrow</span>';
                clearInterval(this.eventUpdateInterval);
            } else {
                pauseBtn.innerHTML = '<span class="material-icons">pause</span>';
                this.startEventSimulation();
            }
            
            console.log(`Timeline ${this.isPaused ? 'paused' : 'resumed'}`);
        });
        
        zoomOutBtn.addEventListener('click', () => {
            document.body.classList.add('high-density');
            console.log('Switched to high density mode for maximum monitoring');
        });
        
        zoomInBtn.addEventListener('click', () => {
            document.body.classList.remove('high-density');
            console.log('Switched to normal density mode');
        });
    }

    updateTimelineLanes() {
        const lanes = document.querySelectorAll('.timeline-lane');
        
        lanes.forEach(lane => {
            const sessionId = lane.dataset.session;
            
            if (this.selectedSessions.size === 0 || this.selectedSessions.has(sessionId)) {
                lane.style.opacity = '1';
                lane.style.transform = 'scale(1)';
            } else {
                lane.style.opacity = '0.3';
                lane.style.transform = 'scale(0.95)';
            }
        });
    }

    updateEventFeed() {
        const eventTypeFilter = document.getElementById('event-type-filter').value;
        const tbody = document.getElementById('event-feed-body');
        const rows = tbody.querySelectorAll('.event-row');
        
        let visibleCount = 0;
        
        rows.forEach(row => {
            const sessionPill = row.querySelector('.session-pill');
            const eventType = row.querySelector('.event-col').textContent.trim();
            
            let shouldShow = true;
            
            // Filter by event type
            if (eventTypeFilter && !eventType.includes(eventTypeFilter)) {
                shouldShow = false;
            }
            
            // Filter by selected sessions
            if (this.selectedSessions.size > 0) {
                const sessionId = this.getSessionIdFromPill(sessionPill);
                if (!this.selectedSessions.has(sessionId)) {
                    shouldShow = false;
                }
            }
            
            if (shouldShow) {
                row.style.display = '';
                visibleCount++;
            } else {
                row.style.display = 'none';
            }
        });
        
        // Update event counter
        document.querySelector('.event-count').textContent = `${visibleCount} events`;
    }

    getSessionIdFromPill(pill) {
        const sessionMap = {
            'S1': 'sess_001',
            'S2': 'sess_002',
            'S3': 'sess_003',
            'S4': 'sess_004',
            'S5': 'sess_005',
            'S6': 'sess_006'
        };
        return sessionMap[pill.textContent.trim()] || '';
    }

    setupKeyboardNavigation() {
        document.addEventListener('keydown', (e) => {
            const tbody = document.getElementById('event-feed-body');
            const visibleRows = Array.from(tbody.querySelectorAll('.event-row')).filter(row => 
                row.style.display !== 'none'
            );
            
            switch(e.key) {
                case 'j': // Move down
                case 'ArrowDown':
                    e.preventDefault();
                    this.currentKeyboardRow = Math.min(this.currentKeyboardRow + 1, visibleRows.length - 1);
                    this.updateKeyboardSelection(visibleRows);
                    break;
                    
                case 'k': // Move up  
                case 'ArrowUp':
                    e.preventDefault();
                    this.currentKeyboardRow = Math.max(this.currentKeyboardRow - 1, 0);
                    this.updateKeyboardSelection(visibleRows);
                    break;
                    
                case 'Enter':
                case ' ':
                    e.preventDefault();
                    if (visibleRows[this.currentKeyboardRow]) {
                        this.showEventDetails(visibleRows[this.currentKeyboardRow]);
                    }
                    break;
                    
                case 'Escape':
                    e.preventDefault();
                    this.clearKeyboardSelection();
                    break;
                    
                case '/':
                    e.preventDefault();
                    document.getElementById('event-type-filter').focus();
                    break;
                    
                case '?':
                    e.preventDefault();
                    this.showKeyboardHelp();
                    break;
            }
        });
    }

    updateKeyboardSelection(visibleRows) {
        // Clear previous selection
        document.querySelectorAll('.keyboard-selected').forEach(row => {
            row.classList.remove('keyboard-selected');
        });
        
        // Apply current selection
        if (visibleRows[this.currentKeyboardRow]) {
            visibleRows[this.currentKeyboardRow].classList.add('keyboard-selected');
            visibleRows[this.currentKeyboardRow].scrollIntoView({ 
                behavior: 'smooth', 
                block: 'center' 
            });
        }
    }

    clearKeyboardSelection() {
        document.querySelectorAll('.keyboard-selected').forEach(row => {
            row.classList.remove('keyboard-selected');
        });
        this.currentKeyboardRow = 0;
    }

    showEventDetails(row) {
        const eventType = row.querySelector('.event-col').textContent.trim();
        const tool = row.querySelector('.tool-col').textContent.trim();
        const time = row.querySelector('.time-col').textContent.trim();
        
        console.log(`Event Details:`, {
            type: eventType,
            tool: tool,
            time: time,
            session: row.querySelector('.session-pill').textContent
        });
        
        // Could expand to show modal or detailed view
        this.showFloatingNotification(`Viewing: ${eventType} ${tool ? `(${tool})` : ''} at ${time}`, 'info');
    }

    startEventSimulation() {
        if (this.eventUpdateInterval) {
            clearInterval(this.eventUpdateInterval);
        }
        
        this.eventUpdateInterval = setInterval(() => {
            if (!this.isPaused) {
                this.addSimulatedEvent();
                this.updateToolActivity();
            }
        }, 3000 + Math.random() * 4000); // Random interval 3-7 seconds
    }

    addSimulatedEvent() {
        const eventTypes = [
            { type: 'pre_tool_use', tool: 'Read', status: 'running' },
            { type: 'post_tool_use', tool: 'Read', status: 'success', duration: '89ms' },
            { type: 'pre_tool_use', tool: 'Edit', status: 'running' },
            { type: 'post_tool_use', tool: 'Edit', status: 'success', duration: '234ms' },
            { type: 'user_prompt_submit', tool: '-', status: 'info', duration: '-' },
            { type: 'notification', tool: '-', status: 'awaiting', duration: '-' }
        ];
        
        const sessions = ['S1', 'S2', 'S3', 'S4', 'S5', 'S6'];
        const randomEvent = eventTypes[Math.floor(Math.random() * eventTypes.length)];
        const randomSession = sessions[Math.floor(Math.random() * sessions.length)];
        
        const now = new Date();
        const timeString = now.toTimeString().slice(0, 8);
        
        const tbody = document.getElementById('event-feed-body');
        const newRow = document.createElement('tr');
        newRow.className = `event-row ${randomEvent.type.includes('notification') ? 'notification-event' : 'completed-event'} new-event`;
        
        newRow.innerHTML = `
            <td class="time-col">${timeString}</td>
            <td class="session-col">
                <span class="session-pill active">${randomSession}</span>
            </td>
            <td class="event-col">${randomEvent.type}</td>
            <td class="tool-col">${randomEvent.tool}</td>
            <td class="status-col">
                <span class="status-badge ${randomEvent.status}">${this.capitalizeFirst(randomEvent.status)}</span>
            </td>
            <td class="duration-col">${randomEvent.duration}</td>
        `;
        
        // Insert at top
        tbody.insertBefore(newRow, tbody.firstChild);
        
        // Remove animation class after animation completes
        setTimeout(() => {
            newRow.classList.remove('new-event');
        }, 300);
        
        // Limit rows to prevent memory issues
        const allRows = tbody.querySelectorAll('.event-row');
        if (allRows.length > 100) {
            allRows[allRows.length - 1].remove();
        }
        
        this.eventCounter++;
        this.updateEventFeed();
    }

    updateToolActivity() {
        // Animate timeline dots occasionally
        const toolDots = document.querySelectorAll('.tool-dot:not(.notification-pulse)');
        const randomDot = toolDots[Math.floor(Math.random() * toolDots.length)];
        
        if (randomDot && Math.random() < 0.3) {
            randomDot.style.transform = 'scale(1.5)';
            randomDot.style.opacity = '0.7';
            
            setTimeout(() => {
                randomDot.style.transform = 'scale(1)';
                randomDot.style.opacity = '1';
            }, 500);
        }
    }

    setupFloatingNotifications() {
        // Show initial notifications for sessions awaiting input
        setTimeout(() => {
            this.showFloatingNotification('Session S2: claude-dashboard needs input confirmation', 'awaiting');
        }, 2000);
        
        setTimeout(() => {
            this.showFloatingNotification('Session S6: bash command requires permission', 'permission');
        }, 4000);
    }

    showFloatingNotification(message, type = 'info') {
        const container = document.getElementById('floating-notifications');
        const toast = document.createElement('div');
        toast.className = `floating-toast ${type}`;
        toast.textContent = message;
        
        toast.addEventListener('click', () => {
            toast.style.animation = 'slideOutRight 0.3s ease-in';
            setTimeout(() => toast.remove(), 300);
        });
        
        container.appendChild(toast);
        
        // Auto-remove after 8 seconds
        setTimeout(() => {
            if (toast.parentNode) {
                toast.style.animation = 'slideOutRight 0.3s ease-in';
                setTimeout(() => toast.remove(), 300);
            }
        }, 8000);
    }

    showKeyboardHelp() {
        const helpText = `
Chronicle Dashboard Keyboard Shortcuts:
j/↓ - Move down
k/↑ - Move up  
Enter/Space - View event details
Escape - Clear selection
/ - Focus filter
? - Show this help
        `;
        console.log(helpText);
        this.showFloatingNotification('Check console for keyboard shortcuts', 'info');
    }

    setupTooltips() {
        const tooltip = document.getElementById('tooltip');
        
        // Session dot tooltips handled in setupSessionDots
        
        // Tool dot tooltips
        document.querySelectorAll('.tool-dot').forEach(dot => {
            dot.addEventListener('mouseenter', (e) => {
                const toolType = this.getToolTypeFromClass(dot.className);
                this.showTooltip(e, `Tool: ${toolType}`);
            });
            
            dot.addEventListener('mouseleave', () => {
                this.hideTooltip();
            });
        });
    }

    getToolTypeFromClass(className) {
        const toolMap = {
            'read-tool': 'Read File',
            'write-tool': 'Write File', 
            'edit-tool': 'Edit File',
            'bash-tool': 'Bash Command',
            'glob-tool': 'File Search',
            'grep-tool': 'Content Search',
            'web-search-tool': 'Web Search',
            'web-fetch-tool': 'Web Fetch',
            'task-tool': 'Sub-agent Task',
            'notification-pulse': 'Awaiting Input'
        };
        
        for (const [key, value] of Object.entries(toolMap)) {
            if (className.includes(key)) {
                return value;
            }
        }
        return 'Unknown Tool';
    }

    showTooltip(event, text) {
        const tooltip = document.getElementById('tooltip');
        tooltip.textContent = text;
        tooltip.style.left = event.pageX + 10 + 'px';
        tooltip.style.top = event.pageY + 10 + 'px';
        tooltip.classList.add('show');
    }

    hideTooltip() {
        const tooltip = document.getElementById('tooltip');
        tooltip.classList.remove('show');
    }

    capitalizeFirst(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }
}

// CSS animations for slide out
const style = document.createElement('style');
style.textContent = `
@keyframes slideOutRight {
    from {
        transform: translateX(0);
        opacity: 1;
    }
    to {
        transform: translateX(100%);
        opacity: 0;
    }
}
`;
document.head.appendChild(style);

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.chronicleDashboard = new ChronicleMinimalDashboard();
    
    console.log('🎯 Chronicle Dashboard loaded - monitoring mode activated');
    console.log('💡 Keyboard shortcuts: j/k for navigation, Enter for details, / for filter, ? for help');
    console.log('🔥 Sessions awaiting input shown with pulsing indicators');
});

// Handle window resize for responsiveness
window.addEventListener('resize', () => {
    if (window.chronicleDashboard) {
        window.chronicleDashboard.hideTooltip();
    }
});

// Export for potential external use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ChronicleMinimalDashboard;
}