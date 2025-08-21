// Chronicle Dashboard - Iteration 2 Variant 5
// Interactive functionality for the dashboard

class ChronicleV5Dashboard {
    constructor() {
        this.isPaused = false;
        this.filters = {
            event: 'all',
            session: 'all',
            time: '1h'
        };
        this.updateInterval = null;
        this.eventQueue = [];
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.startClock();
        this.startEventSimulation();
        this.applyFilters();
    }

    setupEventListeners() {
        // Filter controls
        document.getElementById('event-filter').addEventListener('change', (e) => {
            this.filters.event = e.target.value;
            this.applyFilters();
        });

        document.getElementById('session-filter').addEventListener('change', (e) => {
            this.filters.session = e.target.value;
            this.applyFilters();
        });

        document.getElementById('time-filter').addEventListener('change', (e) => {
            this.filters.time = e.target.value;
            this.applyFilters();
        });

        // Pause button
        document.getElementById('pause-btn').addEventListener('click', () => {
            this.togglePause();
        });

        // Tool timeline interactions
        document.querySelectorAll('.tool-activity').forEach(tool => {
            tool.addEventListener('mouseenter', (e) => {
                this.showToolTooltip(e);
            });
            
            tool.addEventListener('mouseleave', () => {
                this.hideToolTooltip();
            });
        });

        // Session card interactions
        document.querySelectorAll('.session-card').forEach(card => {
            card.addEventListener('click', (e) => {
                this.focusSession(e.target.closest('.session-card').dataset.session);
            });
        });
    }

    startClock() {
        const updateClock = () => {
            const now = new Date();
            const timeString = now.toLocaleTimeString('en-US', { 
                hour12: false,
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });
            document.getElementById('current-time').textContent = timeString;
        };

        updateClock();
        setInterval(updateClock, 1000);
    }

    startEventSimulation() {
        if (!this.isPaused) {
            // Simulate new events every 3-8 seconds
            const delay = Math.random() * 5000 + 3000;
            setTimeout(() => {
                this.addNewEvent();
                this.startEventSimulation();
            }, delay);
        } else {
            // Check again in 1 second if paused
            setTimeout(() => {
                this.startEventSimulation();
            }, 1000);
        }
    }

    addNewEvent() {
        if (this.isPaused) return;

        const eventTypes = [
            { type: 'tool_use', icon: '📖', tool: 'Read', detail: '/src/components/NewComponent.tsx' },
            { type: 'tool_use', icon: '📝', tool: 'Edit', detail: 'Update import statements' },
            { type: 'tool_use', icon: '🔍', tool: 'Grep', detail: 'Search for "useState" pattern' },
            { type: 'tool_use', icon: '⚡', tool: 'Bash', detail: 'npm run build' },
            { type: 'tool_response', icon: '✅', tool: 'Read', detail: '156 lines, React component' },
            { type: 'user_input', icon: '👤', tool: 'User', detail: '"Please optimize this function"' },
            { type: 'agent_response', icon: '🤖', tool: 'Claude', detail: 'I\'ll optimize using memoization' }
        ];

        const sessions = ['S1', 'S2', 'S3', 'S4', 'S5', 'S7', 'S12'];
        const subAgents = ['main', 'testing', 'docs', 'refactor'];
        
        const randomEvent = eventTypes[Math.floor(Math.random() * eventTypes.length)];
        const randomSession = sessions[Math.floor(Math.random() * sessions.length)];
        const randomSubAgent = subAgents[Math.floor(Math.random() * subAgents.length)];
        
        const now = new Date();
        const timeString = now.toLocaleTimeString('en-US', { 
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });

        const eventRow = this.createEventRow(
            timeString,
            randomEvent.icon,
            randomEvent.tool,
            randomEvent.detail,
            randomSession,
            randomSubAgent,
            randomEvent.type
        );

        // Add to top of event list
        const eventList = document.getElementById('event-list');
        eventList.insertBefore(eventRow, eventList.firstChild);

        // Update tool timeline
        this.updateToolTimeline(randomEvent.tool.toLowerCase(), randomSession.replace('S', ''));

        // Update waiting times
        this.updateWaitingTimes();

        // Remove old events (keep last 50)
        const allEvents = eventList.querySelectorAll('.event-row:not(.event-group .event-row)');
        if (allEvents.length > 50) {
            for (let i = 50; i < allEvents.length; i++) {
                allEvents[i].remove();
            }
        }
    }

    createEventRow(time, icon, tool, detail, session, subAgent, eventType) {
        const row = document.createElement('div');
        row.className = 'event-row completed';
        row.setAttribute('data-event-type', eventType);
        
        row.innerHTML = `
            <span class="event-time">${time}</span>
            <span class="event-icon">${icon}</span>
            <span class="tool-name">${tool}</span>
            <span class="event-detail">${detail}</span>
            <span class="session-tag">${session}</span>
            <span class="sub-agent">${subAgent}</span>
        `;

        // Add fade-in animation
        row.style.opacity = '0';
        row.style.transform = 'translateY(-10px)';
        
        setTimeout(() => {
            row.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
            row.style.opacity = '1';
            row.style.transform = 'translateY(0)';
        }, 10);

        return row;
    }

    updateToolTimeline(tool, sessionId) {
        const timeline = document.querySelector('.timeline-track');
        const toolIcons = {
            'read': '📖',
            'edit': '📝',
            'grep': '🔍',
            'bash': '⚡',
            'write': '💾',
            'ls': '📁',
            'user': '👤',
            'claude': '🤖'
        };

        // Remove existing active states
        document.querySelectorAll('.tool-activity.active').forEach(el => {
            el.classList.remove('active');
        });

        // Create new tool activity marker
        const toolElement = document.createElement('div');
        toolElement.className = 'tool-activity active';
        toolElement.dataset.session = sessionId;
        toolElement.dataset.tool = tool;
        toolElement.textContent = toolIcons[tool] || '🔧';
        
        // Position at the far right (current time)
        toolElement.style.left = '95%';
        
        timeline.appendChild(toolElement);

        // Animate existing markers to the left
        const existingMarkers = timeline.querySelectorAll('.tool-activity:not(.active)');
        existingMarkers.forEach(marker => {
            const currentLeft = parseFloat(marker.style.left);
            marker.style.left = Math.max(0, currentLeft - 5) + '%';
        });

        // Remove markers that are too far left
        existingMarkers.forEach(marker => {
            if (parseFloat(marker.style.left) < 2) {
                marker.remove();
            }
        });
    }

    updateWaitingTimes() {
        document.querySelectorAll('.waiting-time').forEach(timeEl => {
            const current = timeEl.textContent;
            const [minutes, seconds] = current.split('m ')[0] === current ? 
                [0, parseInt(current.replace('s', ''))] : 
                [parseInt(current.split('m')[0]), parseInt(current.split('m ')[1].replace('s', ''))];
            
            const newSeconds = seconds + 1;
            if (newSeconds >= 60) {
                timeEl.textContent = `${minutes + 1}m 0s`;
            } else {
                timeEl.textContent = minutes > 0 ? `${minutes}m ${newSeconds}s` : `${newSeconds}s`;
            }
        });
    }

    togglePause() {
        this.isPaused = !this.isPaused;
        const pauseBtn = document.getElementById('pause-btn');
        
        if (this.isPaused) {
            pauseBtn.textContent = '▶️ Resume';
            pauseBtn.classList.add('active');
        } else {
            pauseBtn.textContent = '⏸️ Pause';
            pauseBtn.classList.remove('active');
        }
    }

    applyFilters() {
        const eventRows = document.querySelectorAll('#event-list .event-row');
        const eventGroups = document.querySelectorAll('.event-group');
        
        eventRows.forEach(row => {
            if (row.closest('.event-group')) return; // Skip grouped events for now
            
            let shouldShow = true;
            
            // Event type filter
            if (this.filters.event !== 'all') {
                const eventType = row.getAttribute('data-event-type');
                if (eventType !== this.filters.event) {
                    shouldShow = false;
                }
            }
            
            // Session filter
            if (this.filters.session !== 'all') {
                if (this.filters.session === 'awaiting' && !row.classList.contains('awaiting')) {
                    shouldShow = false;
                } else if (this.filters.session === 'active' && !row.classList.contains('active')) {
                    shouldShow = false;
                } else if (this.filters.session === 'completed' && !row.classList.contains('completed')) {
                    shouldShow = false;
                }
            }
            
            row.style.display = shouldShow ? 'flex' : 'none';
        });

        // Handle event groups
        eventGroups.forEach(group => {
            const groupRows = group.querySelectorAll('.event-row');
            let hasVisibleRows = false;
            
            groupRows.forEach(row => {
                let shouldShow = true;
                
                if (this.filters.event !== 'all') {
                    const eventType = row.getAttribute('data-event-type');
                    if (eventType !== this.filters.event) {
                        shouldShow = false;
                    }
                }
                
                row.style.display = shouldShow ? 'flex' : 'none';
                if (shouldShow) hasVisibleRows = true;
            });
            
            group.style.display = hasVisibleRows ? 'block' : 'none';
        });

        this.updateEventCounts();
    }

    updateEventCounts() {
        const visibleEvents = document.querySelectorAll('#event-list .event-row:not([style*="display: none"])').length;
        const awaitingInputs = document.querySelectorAll('.session-card.awaiting').length;
        
        // Update header counts
        document.querySelector('.active-sessions').textContent = `${awaitingInputs} awaiting input`;
    }

    showToolTooltip(event) {
        const tool = event.target;
        const session = tool.dataset.session;
        const toolType = tool.dataset.tool;
        
        // Create tooltip element
        const tooltip = document.createElement('div');
        tooltip.id = 'tool-tooltip';
        tooltip.style.cssText = `
            position: absolute;
            background: var(--secondary-bg);
            border: 1px solid var(--border-color);
            padding: 4px 8px;
            border-radius: 3px;
            font-size: 10px;
            z-index: 1000;
            pointer-events: none;
            white-space: nowrap;
            color: var(--text-primary);
        `;
        tooltip.textContent = `Session ${session}: ${toolType}`;
        
        document.body.appendChild(tooltip);
        
        const rect = tool.getBoundingClientRect();
        tooltip.style.left = rect.left + 'px';
        tooltip.style.top = (rect.top - 25) + 'px';
    }

    hideToolTooltip() {
        const tooltip = document.getElementById('tool-tooltip');
        if (tooltip) {
            tooltip.remove();
        }
    }

    focusSession(sessionId) {
        // Highlight all events from this session
        document.querySelectorAll('.event-row').forEach(row => {
            const sessionTag = row.querySelector('.session-tag');
            if (sessionTag && sessionTag.textContent === sessionId.replace('session-', 'S')) {
                row.style.backgroundColor = 'rgba(88, 166, 255, 0.1)';
                setTimeout(() => {
                    row.style.backgroundColor = '';
                }, 2000);
            }
        });

        // Focus on the session in timeline
        document.querySelectorAll('.tool-activity').forEach(tool => {
            if (tool.dataset.session === sessionId.replace('session-', '')) {
                tool.style.transform = 'translateX(-50%) scale(1.3)';
                setTimeout(() => {
                    tool.style.transform = 'translateX(-50%) scale(1)';
                }, 1000);
            }
        });
    }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new ChronicleV5Dashboard();
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    // Space bar to toggle pause
    if (e.code === 'Space' && e.target === document.body) {
        e.preventDefault();
        document.getElementById('pause-btn').click();
    }
    
    // Number keys to filter by event type
    const eventTypeMap = {
        '1': 'all',
        '2': 'tool_use',
        '3': 'user_input',
        '4': 'agent_response',
        '5': 'error'
    };
    
    if (eventTypeMap[e.key]) {
        document.getElementById('event-filter').value = eventTypeMap[e.key];
        document.getElementById('event-filter').dispatchEvent(new Event('change'));
    }
});

// Export for potential module use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ChronicleV5Dashboard;
}