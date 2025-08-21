// Chronicle Dashboard - Timeline-First Monitor JavaScript

class TimelineFirstDashboard {
    constructor() {
        this.currentTime = new Date();
        this.timelineStart = new Date(this.currentTime.getTime() - 15 * 60 * 1000); // 15 minutes ago
        this.timelineEnd = new Date(this.currentTime.getTime() + 60 * 1000); // 1 minute ahead
        this.selectedTimeRange = null;
        this.zoomLevel = 15; // minutes
        this.isPaused = false;
        this.selectedSessions = new Set();
        
        // Mock data structures
        this.sessions = this.generateMockSessions();
        this.events = this.generateMockEvents();
        
        this.initializeEventListeners();
        this.startRealTimeUpdates();
        this.renderTimeline();
        this.renderEventFeed();
        this.updateHeaderStats();
    }

    generateMockSessions() {
        const projects = [
            { name: 'chronicle-dashboard', branch: 'timeline-feature', path: '/Users/dev/chronicle' },
            { name: 'api-service', branch: 'main', path: '/Users/dev/api-service' },
            { name: 'ml-pipeline', branch: 'feature/optimization', path: '/Users/dev/ml-pipeline' },
            { name: 'frontend-app', branch: 'develop', path: '/Users/dev/frontend' },
            { name: 'data-processor', branch: 'hotfix/memory-leak', path: '/Users/dev/processor' },
            { name: 'auth-service', branch: 'security-updates', path: '/Users/dev/auth' },
            { name: 'notification-system', branch: 'main', path: '/Users/dev/notifications' },
            { name: 'analytics-engine', branch: 'feature/realtime', path: '/Users/dev/analytics' }
        ];

        return projects.map((project, index) => ({
            id: `session_${index + 1}`,
            projectName: project.name,
            gitBranch: project.branch,
            projectPath: project.path,
            status: Math.random() > 0.3 ? 'active' : 'waiting',
            startTime: new Date(this.currentTime.getTime() - Math.random() * 60 * 60 * 1000),
            isAwaitingInput: Math.random() > 0.7,
            lastActivity: new Date(this.currentTime.getTime() - Math.random() * 10 * 60 * 1000)
        }));
    }

    generateMockEvents() {
        const events = [];
        const eventTypes = [
            'user_prompt_submit', 'pre_tool_use', 'post_tool_use', 
            'notification', 'stop', 'subagent_stop', 'error'
        ];
        const tools = [
            'Read', 'Edit', 'Write', 'Bash', 'Grep', 'Glob', 'Task', 
            'WebFetch', 'MultiEdit', 'LS', 'NotebookEdit'
        ];

        // Generate events for the timeline window
        for (let i = 0; i < 500; i++) {
            const sessionId = this.sessions[Math.floor(Math.random() * this.sessions.length)].id;
            const eventType = eventTypes[Math.floor(Math.random() * eventTypes.length)];
            const timestamp = new Date(
                this.timelineStart.getTime() + 
                Math.random() * (this.timelineEnd.getTime() - this.timelineStart.getTime())
            );

            const event = {
                id: `event_${i + 1}`,
                sessionId,
                eventType,
                timestamp,
                toolName: ['pre_tool_use', 'post_tool_use'].includes(eventType) 
                    ? tools[Math.floor(Math.random() * tools.length)] 
                    : null,
                duration: eventType === 'post_tool_use' ? Math.floor(Math.random() * 5000) + 100 : null,
                details: this.generateEventDetails(eventType),
                isSubAgent: Math.random() > 0.8
            };

            events.push(event);
        }

        return events.sort((a, b) => b.timestamp - a.timestamp);
    }

    generateEventDetails(eventType) {
        const details = {
            'user_prompt_submit': [
                'Create a new React component for user authentication',
                'Fix the database connection issue in production',
                'Optimize the image processing pipeline',
                'Add unit tests for the payment service',
                'Update the documentation for the API endpoints'
            ],
            'pre_tool_use': [
                'Reading configuration file',
                'Searching for function definitions',
                'Executing database migration',
                'Processing image uploads',
                'Compiling TypeScript files'
            ],
            'post_tool_use': [
                'Successfully updated 3 files',
                'Found 12 matching results',
                'Command completed successfully',
                'Generated 45 test files',
                'Deployed to staging environment'
            ],
            'notification': [
                'Awaiting confirmation to delete files',
                'Permission required to access secure directory',
                'User input needed for configuration choice',
                'Confirm deployment to production environment',
                'Review and approve code changes'
            ],
            'stop': [
                'Task completed successfully',
                'All requested changes applied',
                'Analysis finished with results',
                'Build process completed',
                'Tests passed successfully'
            ],
            'error': [
                'Permission denied accessing file',
                'Network timeout during API call',
                'Syntax error in configuration',
                'Database connection failed',
                'Memory limit exceeded'
            ]
        };

        const typeDetails = details[eventType] || ['Unknown event occurred'];
        return typeDetails[Math.floor(Math.random() * typeDetails.length)];
    }

    initializeEventListeners() {
        // Timeline interaction listeners
        const timelineContent = document.getElementById('timelineContent');
        let isSelecting = false;
        let selectionStart = null;

        timelineContent.addEventListener('mousedown', (e) => {
            if (e.target.closest('.timeline-swimlanes')) {
                isSelecting = true;
                selectionStart = { x: e.offsetX, y: e.offsetY };
                this.showSelectionBox(e.offsetX, e.offsetY, 0, 0);
            }
        });

        timelineContent.addEventListener('mousemove', (e) => {
            if (isSelecting && selectionStart) {
                const width = e.offsetX - selectionStart.x;
                const height = e.offsetY - selectionStart.y;
                this.showSelectionBox(selectionStart.x, selectionStart.y, width, height);
            }
        });

        timelineContent.addEventListener('mouseup', (e) => {
            if (isSelecting) {
                isSelecting = false;
                const width = e.offsetX - selectionStart.x;
                if (Math.abs(width) > 10) {
                    this.selectTimeRange(selectionStart.x, e.offsetX);
                }
                this.hideSelectionBox();
            }
        });

        // Control button listeners
        document.getElementById('pauseBtn').addEventListener('click', () => {
            this.togglePause();
        });

        document.getElementById('nowBtn').addEventListener('click', () => {
            this.jumpToNow();
        });

        document.getElementById('zoomIn').addEventListener('click', () => {
            this.zoomTimeline(0.5);
        });

        document.getElementById('zoomOut').addEventListener('click', () => {
            this.zoomTimeline(2);
        });

        // Filter listeners
        document.getElementById('eventTypeFilter').addEventListener('change', () => {
            this.renderEventFeed();
        });

        document.getElementById('sessionFilter').addEventListener('change', () => {
            this.renderEventFeed();
        });

        document.getElementById('clearFilters').addEventListener('click', () => {
            this.clearAllFilters();
        });

        // Notifications panel
        document.getElementById('closeNotifications').addEventListener('click', () => {
            document.getElementById('notificationsPanel').classList.remove('show');
        });

        // Show notifications when clicking awaiting input count
        document.getElementById('awaitingInputCount').addEventListener('click', () => {
            this.showNotificationsPanel();
        });
    }

    showSelectionBox(x, y, width, height) {
        const selectionBox = document.getElementById('selectionBox');
        const overlay = document.getElementById('selectionOverlay');
        
        selectionBox.style.left = `${Math.min(x, x + width)}px`;
        selectionBox.style.top = `${Math.min(y, y + height)}px`;
        selectionBox.style.width = `${Math.abs(width)}px`;
        selectionBox.style.height = `${Math.abs(height)}px`;
        selectionBox.classList.add('active');
    }

    hideSelectionBox() {
        document.getElementById('selectionBox').classList.remove('active');
    }

    selectTimeRange(startX, endX) {
        const timelineWidth = document.getElementById('timelineContent').offsetWidth - 200; // Account for labels
        const totalDuration = this.timelineEnd.getTime() - this.timelineStart.getTime();
        
        const startTime = new Date(
            this.timelineStart.getTime() + 
            ((Math.min(startX, endX) - 200) / timelineWidth) * totalDuration
        );
        const endTime = new Date(
            this.timelineStart.getTime() + 
            ((Math.max(startX, endX) - 200) / timelineWidth) * totalDuration
        );

        this.selectedTimeRange = { start: startTime, end: endTime };
        this.updateTimeRangeDisplay();
        this.renderEventFeed();
    }

    updateTimeRangeDisplay() {
        if (this.selectedTimeRange) {
            document.getElementById('timeRangeStart').textContent = 
                this.selectedTimeRange.start.toLocaleTimeString();
            document.getElementById('timeRangeEnd').textContent = 
                this.selectedTimeRange.end.toLocaleTimeString();
            document.getElementById('selectedRangeInfo').textContent = 
                `Showing events from ${this.selectedTimeRange.start.toLocaleTimeString()} to ${this.selectedTimeRange.end.toLocaleTimeString()}`;
        } else {
            document.getElementById('timeRangeStart').textContent = 
                this.timelineStart.toLocaleTimeString();
            document.getElementById('timeRangeEnd').textContent = 
                this.timelineEnd.toLocaleTimeString();
            document.getElementById('selectedRangeInfo').textContent = 
                'Showing events from selected timeline range';
        }
    }

    togglePause() {
        this.isPaused = !this.isPaused;
        const pauseBtn = document.getElementById('pauseBtn');
        const icon = pauseBtn.querySelector('.material-icons');
        
        if (this.isPaused) {
            icon.textContent = 'play_arrow';
            pauseBtn.title = 'Resume updates';
        } else {
            icon.textContent = 'pause';
            pauseBtn.title = 'Pause updates';
        }
    }

    jumpToNow() {
        this.currentTime = new Date();
        this.timelineStart = new Date(this.currentTime.getTime() - (this.zoomLevel * 60 * 1000));
        this.timelineEnd = new Date(this.currentTime.getTime() + 60 * 1000);
        this.selectedTimeRange = null;
        this.renderTimeline();
        this.renderEventFeed();
        this.updateTimeRangeDisplay();
    }

    zoomTimeline(factor) {
        const newZoomLevel = Math.max(1, Math.min(120, this.zoomLevel * factor));
        if (newZoomLevel !== this.zoomLevel) {
            this.zoomLevel = newZoomLevel;
            const center = new Date((this.timelineStart.getTime() + this.timelineEnd.getTime()) / 2);
            const halfRange = (this.zoomLevel * 60 * 1000) / 2;
            
            this.timelineStart = new Date(center.getTime() - halfRange);
            this.timelineEnd = new Date(center.getTime() + halfRange);
            
            this.renderTimeline();
            this.updateTimeRangeDisplay();
            
            // Update zoom level display
            const zoomText = this.zoomLevel < 60 ? `${this.zoomLevel}m` : `${this.zoomLevel / 60}h`;
            document.querySelector('.zoom-level').textContent = zoomText;
        }
    }

    renderTimeline() {
        this.renderTimeMarkers();
        this.renderSwimlanes();
    }

    renderTimeMarkers() {
        const timeMarkers = document.getElementById('timeMarkers');
        timeMarkers.innerHTML = '';

        const totalDuration = this.timelineEnd.getTime() - this.timelineStart.getTime();
        const markerInterval = Math.max(60000, totalDuration / 20); // At least 1 minute between markers

        for (let time = this.timelineStart.getTime(); time <= this.timelineEnd.getTime(); time += markerInterval) {
            const markerTime = new Date(time);
            const position = ((time - this.timelineStart.getTime()) / totalDuration) * 100;
            
            const marker = document.createElement('div');
            marker.className = 'time-marker';
            marker.style.left = `${200 + position * (100 - 200) / 100}px`; // Account for labels
            marker.innerHTML = `
                <div class="time-marker-line"></div>
                <div class="time-marker-text">${markerTime.toLocaleTimeString().slice(0, -3)}</div>
            `;
            
            timeMarkers.appendChild(marker);
        }
    }

    renderSwimlanes() {
        const swimlanes = document.getElementById('timelineSwimlanes');
        swimlanes.innerHTML = '';

        this.sessions.forEach(session => {
            const swimlane = this.createSwimlane(session);
            swimlanes.appendChild(swimlane);

            // Add sub-agent lanes if applicable
            if (Math.random() > 0.7) { // Some sessions have sub-agents
                const subAgentLane = this.createSubAgentSwimlane(session);
                swimlanes.appendChild(subAgentLane);
            }
        });
    }

    createSwimlane(session) {
        const swimlane = document.createElement('div');
        swimlane.className = `swimlane ${session.isAwaitingInput ? 'awaiting-input' : ''}`;
        swimlane.dataset.sessionId = session.id;
        
        const statusClass = session.status === 'active' ? 'active' : 
                          session.isAwaitingInput ? 'waiting' : 'idle';

        swimlane.innerHTML = `
            <div class="swimlane-label">
                <div class="project-name">${session.projectName}</div>
                <div class="session-info">
                    <span class="session-status ${statusClass}"></span>
                    <span>${session.gitBranch}</span>
                </div>
            </div>
            <div class="swimlane-timeline" id="timeline-${session.id}">
                ${this.renderTimelineActivities(session)}
            </div>
        `;

        // Add click listener for session selection
        swimlane.addEventListener('click', () => {
            this.toggleSessionSelection(session.id);
        });

        return swimlane;
    }

    createSubAgentSwimlane(parentSession) {
        const swimlane = document.createElement('div');
        swimlane.className = 'swimlane sub-agent';
        swimlane.dataset.sessionId = `${parentSession.id}_subagent`;
        
        swimlane.innerHTML = `
            <div class="swimlane-label">
                <div class="project-name">↳ Task Sub-agent</div>
                <div class="session-info">
                    <span class="session-status active"></span>
                    <span>Processing</span>
                </div>
            </div>
            <div class="swimlane-timeline">
                ${this.renderSubAgentActivities(parentSession)}
            </div>
        `;

        return swimlane;
    }

    renderTimelineActivities(session) {
        const sessionEvents = this.events.filter(e => e.sessionId === session.id);
        const totalDuration = this.timelineEnd.getTime() - this.timelineStart.getTime();
        const activities = [];

        sessionEvents.forEach(event => {
            if (event.timestamp >= this.timelineStart && event.timestamp <= this.timelineEnd) {
                const position = ((event.timestamp.getTime() - this.timelineStart.getTime()) / totalDuration) * 100;
                const width = event.duration ? Math.max(1, (event.duration / totalDuration) * 100) : 2;
                
                let activityClass = 'tool-use';
                let icon = this.getToolIcon(event.toolName || event.eventType);
                
                if (event.eventType === 'notification') {
                    activityClass = 'awaiting';
                    icon = '⚠';
                }

                activities.push(`
                    <div class="activity-indicator ${activityClass}" 
                         style="left: ${position}%; width: ${width}%"
                         title="${event.toolName || event.eventType}: ${event.details}"
                         data-event-id="${event.id}">
                        <span class="tool-icon">${icon}</span>
                    </div>
                `);
            }
        });

        return activities.join('');
    }

    renderSubAgentActivities(parentSession) {
        // Simplified sub-agent activity representation
        const activities = [];
        for (let i = 0; i < 5; i++) {
            const position = 10 + (i * 15);
            activities.push(`
                <div class="activity-indicator sub-agent" 
                     style="left: ${position}%; width: 3%"
                     title="Sub-agent tool execution">
                    <span class="tool-icon">⚡</span>
                </div>
            `);
        }
        return activities.join('');
    }

    getToolIcon(toolName) {
        const icons = {
            'Read': '📖',
            'Edit': '✏️',
            'Write': '📝',
            'Bash': '💻',
            'Grep': '🔍',
            'Glob': '🗂️',
            'Task': '⚡',
            'WebFetch': '🌐',
            'MultiEdit': '📄',
            'LS': '📁',
            'user_prompt_submit': '💬',
            'notification': '⚠️',
            'stop': '✅',
            'error': '❌'
        };
        return icons[toolName] || '🔧';
    }

    toggleSessionSelection(sessionId) {
        if (this.selectedSessions.has(sessionId)) {
            this.selectedSessions.delete(sessionId);
        } else {
            this.selectedSessions.add(sessionId);
        }
        
        // Update visual selection
        const swimlane = document.querySelector(`[data-session-id="${sessionId}"]`);
        if (swimlane) {
            swimlane.classList.toggle('selected', this.selectedSessions.has(sessionId));
        }
        
        this.renderEventFeed();
    }

    renderEventFeed() {
        const feedBody = document.getElementById('feedTableBody');
        const eventTypeFilter = document.getElementById('eventTypeFilter').value;
        const sessionFilter = document.getElementById('sessionFilter').value;
        
        let filteredEvents = this.events;

        // Apply time range filter
        if (this.selectedTimeRange) {
            filteredEvents = filteredEvents.filter(event => 
                event.timestamp >= this.selectedTimeRange.start && 
                event.timestamp <= this.selectedTimeRange.end
            );
        }

        // Apply session selection filter
        if (this.selectedSessions.size > 0) {
            filteredEvents = filteredEvents.filter(event => 
                this.selectedSessions.has(event.sessionId)
            );
        }

        // Apply dropdown filters
        if (eventTypeFilter) {
            filteredEvents = filteredEvents.filter(event => event.eventType === eventTypeFilter);
        }
        
        if (sessionFilter) {
            filteredEvents = filteredEvents.filter(event => event.sessionId === sessionFilter);
        }

        feedBody.innerHTML = '';

        filteredEvents.slice(0, 200).forEach(event => { // Limit to 200 events for performance
            const session = this.sessions.find(s => s.id === event.sessionId);
            const row = document.createElement('div');
            row.className = `event-row ${event.isSubAgent ? 'sub-agent' : ''}`;
            
            const timeString = event.timestamp.toLocaleTimeString();
            const durationString = event.duration ? `${event.duration}ms` : '';
            const projectName = session ? session.projectName : 'Unknown';
            
            row.innerHTML = `
                <div class="col-time">${timeString}</div>
                <div class="col-session">${projectName}</div>
                <div class="col-event">
                    <span class="event-type-badge ${event.eventType}">${event.eventType}</span>
                </div>
                <div class="col-tool">${event.toolName || ''}</div>
                <div class="col-details">${event.details}</div>
                <div class="col-duration">${durationString}</div>
            `;
            
            feedBody.appendChild(row);
        });
    }

    populateSessionFilter() {
        const sessionFilter = document.getElementById('sessionFilter');
        sessionFilter.innerHTML = '<option value="">All Sessions</option>';
        
        this.sessions.forEach(session => {
            const option = document.createElement('option');
            option.value = session.id;
            option.textContent = session.projectName;
            sessionFilter.appendChild(option);
        });
    }

    clearAllFilters() {
        document.getElementById('eventTypeFilter').value = '';
        document.getElementById('sessionFilter').value = '';
        this.selectedSessions.clear();
        this.selectedTimeRange = null;
        
        // Clear visual selections
        document.querySelectorAll('.swimlane.selected').forEach(lane => {
            lane.classList.remove('selected');
        });
        
        this.updateTimeRangeDisplay();
        this.renderEventFeed();
    }

    showNotificationsPanel() {
        const panel = document.getElementById('notificationsPanel');
        const list = document.getElementById('notificationsList');
        
        // Get sessions awaiting input
        const awaitingSessions = this.sessions.filter(s => s.isAwaitingInput);
        
        list.innerHTML = '';
        awaitingSessions.forEach(session => {
            const notificationEvents = this.events.filter(e => 
                e.sessionId === session.id && e.eventType === 'notification'
            );
            
            notificationEvents.slice(0, 3).forEach(event => {
                const item = document.createElement('div');
                item.className = 'notification-item';
                
                const timeAgo = this.getTimeAgo(event.timestamp);
                
                item.innerHTML = `
                    <div class="notification-project">${session.projectName}</div>
                    <div class="notification-message">${event.details}</div>
                    <div class="notification-time">${timeAgo} ago</div>
                `;
                
                item.addEventListener('click', () => {
                    this.selectedSessions.clear();
                    this.selectedSessions.add(session.id);
                    this.renderEventFeed();
                    panel.classList.remove('show');
                });
                
                list.appendChild(item);
            });
        });
        
        panel.classList.add('show');
    }

    getTimeAgo(timestamp) {
        const seconds = Math.floor((this.currentTime - timestamp) / 1000);
        
        if (seconds < 60) return `${seconds}s`;
        
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes}m`;
        
        const hours = Math.floor(minutes / 60);
        return `${hours}h`;
    }

    updateHeaderStats() {
        const activeCount = this.sessions.filter(s => s.status === 'active').length;
        const awaitingCount = this.sessions.filter(s => s.isAwaitingInput).length;
        const recentEvents = this.events.filter(e => 
            this.currentTime - e.timestamp < 60000 // Last minute
        ).length;
        
        document.getElementById('activeSessionsCount').textContent = activeCount;
        document.getElementById('awaitingInputCount').textContent = awaitingCount;
        document.getElementById('eventsPerMin').textContent = recentEvents;
    }

    startRealTimeUpdates() {
        setInterval(() => {
            if (!this.isPaused) {
                this.currentTime = new Date();
                
                // Simulate new events
                if (Math.random() > 0.7) {
                    this.generateNewEvent();
                }
                
                // Update timeline to follow current time
                const timeBehind = this.currentTime.getTime() - this.timelineEnd.getTime();
                if (timeBehind > 30000) { // 30 seconds behind
                    const shift = timeBehind + 60000; // Add 1 minute buffer
                    this.timelineStart = new Date(this.timelineStart.getTime() + shift);
                    this.timelineEnd = new Date(this.timelineEnd.getTime() + shift);
                    this.renderTimeline();
                }
                
                this.updateHeaderStats();
                this.renderEventFeed();
                this.updateTimeRangeDisplay();
            }
        }, 2000); // Update every 2 seconds
    }

    generateNewEvent() {
        const session = this.sessions[Math.floor(Math.random() * this.sessions.length)];
        const tools = ['Read', 'Edit', 'Grep', 'Bash', 'Write'];
        const eventTypes = ['pre_tool_use', 'post_tool_use', 'notification'];
        
        const newEvent = {
            id: `event_${Date.now()}`,
            sessionId: session.id,
            eventType: eventTypes[Math.floor(Math.random() * eventTypes.length)],
            timestamp: new Date(),
            toolName: tools[Math.floor(Math.random() * tools.length)],
            duration: Math.floor(Math.random() * 2000) + 100,
            details: 'Real-time generated event',
            isSubAgent: false
        };
        
        this.events.unshift(newEvent);
        
        // Keep only recent events for performance
        if (this.events.length > 1000) {
            this.events = this.events.slice(0, 1000);
        }
    }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const dashboard = new TimelineFirstDashboard();
    dashboard.populateSessionFilter();
});