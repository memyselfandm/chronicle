// Grid Layout Monitor - Interactive Dashboard
class GridLayoutMonitor {
    constructor() {
        this.selectedSessions = new Set();
        this.isPaused = false;
        this.autoScroll = true;
        this.eventBuffer = [];
        this.sessions = new Map();
        this.timelineZoom = 1;
        this.maxEvents = 1000;
        
        this.init();
    }

    init() {
        this.generateMockSessions();
        this.renderSessionGrid();
        this.renderTimeline();
        this.startEventSimulation();
        this.bindEvents();
    }

    generateMockSessions() {
        const projects = [
            { name: 'chronicle-dashboard', branch: 'main', path: '/Users/dev/chronicle-dashboard' },
            { name: 'ai-workspace', branch: 'feature/grid-layout', path: '/Users/dev/ai-workspace' },
            { name: 'web-scraper', branch: 'main', path: '/Users/dev/web-scraper' },
            { name: 'api-gateway', branch: 'develop', path: '/Users/dev/api-gateway' },
            { name: 'ml-pipeline', branch: 'feature/optimization', path: '/Users/dev/ml-pipeline' },
            { name: 'user-service', branch: 'main', path: '/Users/dev/user-service' },
            { name: 'notification-system', branch: 'feature/websockets', path: '/Users/dev/notifications' },
            { name: 'data-processor', branch: 'main', path: '/Users/dev/data-processor' },
            { name: 'frontend-app', branch: 'feature/dark-theme', path: '/Users/dev/frontend-app' },
            { name: 'analytics-service', branch: 'develop', path: '/Users/dev/analytics' },
            { name: 'auth-service', branch: 'main', path: '/Users/dev/auth-service' },
            { name: 'file-manager', branch: 'feature/upload', path: '/Users/dev/file-manager' }
        ];

        const tools = ['Read', 'Edit', 'Bash', 'Task', 'Grep', 'Write', 'WebFetch', 'LS'];
        const statuses = ['active', 'waiting', 'completed', 'error'];

        for (let i = 0; i < 12; i++) {
            const project = projects[i];
            const sessionId = `session_${i + 1}`;
            const status = i < 2 ? 'waiting' : (i < 9 ? 'active' : 'completed');
            const currentTool = status === 'active' ? tools[Math.floor(Math.random() * tools.length)] : null;
            const timeInState = Math.floor(Math.random() * 300) + 10; // 10-310 seconds
            
            this.sessions.set(sessionId, {
                id: sessionId,
                projectName: project.name,
                projectPath: project.path,
                gitBranch: project.branch,
                status: status,
                currentTool: currentTool,
                timeInState: timeInState,
                lastActivity: new Date(Date.now() - timeInState * 1000),
                events: []
            });
        }
    }

    renderSessionGrid() {
        const grid = document.getElementById('sessionGrid');
        grid.innerHTML = '';

        this.sessions.forEach((session) => {
            const card = document.createElement('div');
            card.className = `session-card ${session.status === 'waiting' ? 'awaiting' : ''}`;
            card.dataset.sessionId = session.id;

            const timeInStateText = this.formatDuration(session.timeInState);
            const statusIndicatorClass = session.status === 'waiting' ? 'waiting' : 
                                        session.status === 'active' ? 'active' : 
                                        session.status === 'error' ? 'error' : 'completed';

            card.innerHTML = `
                <div class="session-header">
                    <div>
                        <div class="session-project">${session.projectName}</div>
                        <div class="session-branch">📄 ${session.gitBranch}</div>
                    </div>
                    <div class="session-id">${session.id.replace('session_', 'S')}</div>
                </div>
                <div class="session-status">
                    <div class="status-indicator ${statusIndicatorClass}"></div>
                    ${session.currentTool ? `<div class="session-tool">${session.currentTool}</div>` : 
                      `<div class="session-tool">${session.status}</div>`}
                    <div class="session-time">${timeInStateText}</div>
                </div>
            `;

            card.addEventListener('click', (e) => this.handleSessionClick(e, session.id));
            grid.appendChild(card);
        });

        this.updateSelectionInfo();
    }

    renderTimeline() {
        const timeline = document.getElementById('timeline');
        timeline.innerHTML = '';

        const selectedSessionsArray = this.selectedSessions.size > 0 ? 
            Array.from(this.selectedSessions) : 
            Array.from(this.sessions.keys()).slice(0, 4);

        selectedSessionsArray.forEach((sessionId, index) => {
            const session = this.sessions.get(sessionId);
            if (!session) return;

            const swimlane = document.createElement('div');
            swimlane.className = 'timeline-swimlane';
            swimlane.innerHTML = `
                <div class="swimlane-label">${session.projectName}</div>
            `;

            // Add some mock activity indicators
            for (let i = 0; i < 5; i++) {
                const activity = document.createElement('div');
                activity.className = `timeline-activity ${this.getRandomToolClass()}`;
                activity.style.left = `${100 + (i * 60)}px`;
                activity.style.width = `${20 + Math.random() * 40}px`;
                swimlane.appendChild(activity);
            }

            // Add waiting indicator if session is waiting
            if (session.status === 'waiting') {
                const waiting = document.createElement('div');
                waiting.className = 'timeline-activity waiting';
                waiting.style.left = '400px';
                waiting.style.width = '30px';
                swimlane.appendChild(waiting);
            }

            timeline.appendChild(swimlane);
        });
    }

    getRandomToolClass() {
        const classes = ['tool-read', 'tool-edit', 'tool-bash', 'tool-task'];
        return classes[Math.floor(Math.random() * classes.length)];
    }

    startEventSimulation() {
        this.generateInitialEvents();
        
        // Continue generating events
        setInterval(() => {
            if (!this.isPaused) {
                this.generateNewEvent();
                this.updateMetrics();
                this.updateSessionStates();
            }
        }, 1000 + Math.random() * 2000); // Random interval 1-3 seconds
    }

    generateInitialEvents() {
        const eventTypes = [
            'user_prompt_submit', 'pre_tool_use', 'post_tool_use', 
            'notification', 'stop', 'subagent_stop', 'error'
        ];
        const tools = ['Read', 'Edit', 'Bash', 'Task', 'Grep', 'Write', 'WebFetch', 'LS'];

        // Generate 50 historical events
        for (let i = 0; i < 50; i++) {
            const sessionId = Array.from(this.sessions.keys())[Math.floor(Math.random() * this.sessions.size)];
            const session = this.sessions.get(sessionId);
            const eventType = eventTypes[Math.floor(Math.random() * eventTypes.length)];
            const tool = Math.random() > 0.5 ? tools[Math.floor(Math.random() * tools.length)] : null;
            
            const event = {
                id: `event_${Date.now()}_${i}`,
                sessionId: sessionId,
                eventType: eventType,
                toolName: tool,
                timestamp: new Date(Date.now() - (50 - i) * 10000), // Spread over last 8 minutes
                details: this.generateEventDetails(eventType, tool),
                duration: eventType === 'post_tool_use' ? Math.floor(Math.random() * 5000) + 100 : null,
                isSubagent: Math.random() > 0.8
            };

            this.eventBuffer.push(event);
            session.events.push(event);
        }

        this.renderEventFeed();
    }

    generateNewEvent() {
        const activeSessions = Array.from(this.sessions.values()).filter(s => s.status === 'active');
        if (activeSessions.length === 0) return;

        const session = activeSessions[Math.floor(Math.random() * activeSessions.length)];
        const eventTypes = ['pre_tool_use', 'post_tool_use', 'notification'];
        const tools = ['Read', 'Edit', 'Bash', 'Task', 'Grep', 'Write'];

        const event = {
            id: `event_${Date.now()}_${Math.random()}`,
            sessionId: session.id,
            eventType: eventTypes[Math.floor(Math.random() * eventTypes.length)],
            toolName: tools[Math.floor(Math.random() * tools.length)],
            timestamp: new Date(),
            details: this.generateEventDetails(eventTypes[0], tools[0]),
            duration: Math.random() > 0.5 ? Math.floor(Math.random() * 3000) + 50 : null,
            isSubagent: Math.random() > 0.9
        };

        this.eventBuffer.push(event);
        session.events.push(event);

        // Keep buffer size manageable
        if (this.eventBuffer.length > this.maxEvents) {
            this.eventBuffer.shift();
        }

        this.renderEventFeed();
        
        // Update session's current tool
        if (event.eventType === 'pre_tool_use') {
            session.currentTool = event.toolName;
            session.timeInState = 0;
        }
    }

    generateEventDetails(eventType, toolName) {
        const details = {
            'user_prompt_submit': [
                'Help me debug this issue',
                'Add a new feature to the dashboard',
                'Review the code changes',
                'Optimize the database queries'
            ],
            'pre_tool_use': [
                `Reading file: ${toolName === 'Read' ? 'config.json' : 'script.py'}`,
                `Editing: ${toolName === 'Edit' ? 'components/Dashboard.tsx' : 'main.go'}`,
                `Running: ${toolName === 'Bash' ? 'npm install' : 'git status'}`,
                `Searching for: ${toolName === 'Grep' ? 'function handleClick' : 'class DataProcessor'}`
            ],
            'post_tool_use': [
                'File read successfully (1,234 lines)',
                'Changes saved to disk',
                'Command completed with exit code 0',
                'Found 5 matches in 3 files'
            ],
            'notification': [
                'User input required for confirmation',
                'Waiting for authentication approval',
                'Permission needed to modify files',
                'Clarification requested on implementation'
            ],
            'stop': [
                'Task completed successfully',
                'Session ended by user',
                'All objectives achieved',
                'Process finished normally'
            ],
            'error': [
                'File not found: missing.txt',
                'Permission denied: /etc/config',
                'Network timeout occurred',
                'Parse error in JSON file'
            ]
        };

        const typeDetails = details[eventType] || ['Unknown event details'];
        return typeDetails[Math.floor(Math.random() * typeDetails.length)];
    }

    renderEventFeed() {
        const eventRows = document.getElementById('eventRows');
        const filteredEvents = this.getFilteredEvents();
        
        eventRows.innerHTML = '';
        
        const recentEvents = filteredEvents.slice(-100); // Show last 100 events
        
        recentEvents.forEach((event, index) => {
            const row = document.createElement('div');
            row.className = `event-row ${event.isSubagent ? 'subagent' : ''}`;
            row.dataset.type = event.eventType;

            const session = this.sessions.get(event.sessionId);
            const sessionDisplay = session ? session.projectName.slice(0, 12) : event.sessionId;

            row.innerHTML = `
                <div class="col-time">${this.formatTime(event.timestamp)}</div>
                <div class="col-session">${sessionDisplay}</div>
                <div class="col-event">${this.formatEventType(event.eventType)}</div>
                <div class="col-tool">${event.toolName || '-'}</div>
                <div class="col-details">${event.details}</div>
                <div class="col-duration">${event.duration ? this.formatDuration(event.duration / 1000) : '-'}</div>
            `;

            eventRows.appendChild(row);
        });

        // Auto-scroll to bottom if enabled
        if (this.autoScroll) {
            eventRows.scrollTop = eventRows.scrollHeight;
        }
    }

    getFilteredEvents() {
        let filtered = this.eventBuffer;

        // Filter by selected sessions
        if (this.selectedSessions.size > 0) {
            filtered = filtered.filter(event => this.selectedSessions.has(event.sessionId));
        }

        // Filter by event type
        const eventTypeFilter = document.getElementById('eventTypeFilter').value;
        if (eventTypeFilter) {
            filtered = filtered.filter(event => event.eventType === eventTypeFilter);
        }

        // Filter by tool
        const toolFilter = document.getElementById('toolFilter').value;
        if (toolFilter) {
            filtered = filtered.filter(event => event.toolName === toolFilter);
        }

        return filtered;
    }

    handleSessionClick(e, sessionId) {
        const isCtrlOrCmd = e.ctrlKey || e.metaKey;
        
        if (!isCtrlOrCmd) {
            this.selectedSessions.clear();
            document.querySelectorAll('.session-card').forEach(card => 
                card.classList.remove('selected'));
        }

        const card = e.currentTarget;
        if (this.selectedSessions.has(sessionId)) {
            this.selectedSessions.delete(sessionId);
            card.classList.remove('selected');
        } else {
            this.selectedSessions.add(sessionId);
            card.classList.add('selected');
        }

        this.updateSelectionInfo();
        this.renderEventFeed();
        this.renderTimeline();
    }

    updateSelectionInfo() {
        const info = document.getElementById('selectionInfo');
        const total = this.sessions.size;
        const selected = this.selectedSessions.size;
        info.textContent = `${selected} of ${total} selected`;
    }

    updateMetrics() {
        // Update active sessions count
        const activeSessions = Array.from(this.sessions.values()).filter(s => s.status === 'active').length;
        document.getElementById('activeSessionsCount').textContent = activeSessions;

        // Update awaiting input count
        const awaitingSessions = Array.from(this.sessions.values()).filter(s => s.status === 'waiting').length;
        document.getElementById('awaitingInputCount').textContent = awaitingSessions;

        // Calculate events per minute (rough estimate)
        const recentEvents = this.eventBuffer.filter(e => 
            Date.now() - e.timestamp.getTime() < 60000).length;
        document.getElementById('eventsPerMin').textContent = recentEvents;
    }

    updateSessionStates() {
        // Randomly change some session states to simulate activity
        if (Math.random() > 0.9) { // 10% chance each update
            const sessionIds = Array.from(this.sessions.keys());
            const randomSession = this.sessions.get(sessionIds[Math.floor(Math.random() * sessionIds.length)]);
            
            if (randomSession.status === 'active' && Math.random() > 0.7) {
                randomSession.status = 'waiting';
                randomSession.currentTool = null;
            } else if (randomSession.status === 'waiting' && Math.random() > 0.8) {
                randomSession.status = 'active';
                randomSession.currentTool = ['Read', 'Edit', 'Bash'][Math.floor(Math.random() * 3)];
            }
            
            this.renderSessionGrid();
        }

        // Update time in state for all sessions
        this.sessions.forEach(session => {
            session.timeInState += 1;
        });
    }

    bindEvents() {
        // Select All button
        document.getElementById('selectAll').addEventListener('click', () => {
            this.selectedSessions.clear();
            this.sessions.forEach((_, sessionId) => this.selectedSessions.add(sessionId));
            document.querySelectorAll('.session-card').forEach(card => 
                card.classList.add('selected'));
            this.updateSelectionInfo();
            this.renderEventFeed();
            this.renderTimeline();
        });

        // Clear Selection button
        document.getElementById('clearSelection').addEventListener('click', () => {
            this.selectedSessions.clear();
            document.querySelectorAll('.session-card').forEach(card => 
                card.classList.remove('selected'));
            this.updateSelectionInfo();
            this.renderEventFeed();
            this.renderTimeline();
        });

        // Timeline controls
        document.getElementById('timelinePause').addEventListener('click', () => {
            this.isPaused = !this.isPaused;
            const button = document.getElementById('timelinePause');
            button.querySelector('.material-icons').textContent = this.isPaused ? 'play_arrow' : 'pause';
            button.classList.toggle('active', this.isPaused);
        });

        // Feed controls
        document.getElementById('feedPause').addEventListener('click', () => {
            this.isPaused = !this.isPaused;
            const button = document.getElementById('feedPause');
            button.querySelector('.material-icons').textContent = this.isPaused ? 'play_arrow' : 'pause';
            button.classList.toggle('active', this.isPaused);
        });

        document.getElementById('autoScroll').addEventListener('click', () => {
            this.autoScroll = !this.autoScroll;
            const button = document.getElementById('autoScroll');
            button.classList.toggle('active', this.autoScroll);
        });

        // Filters
        document.getElementById('eventTypeFilter').addEventListener('change', () => {
            this.renderEventFeed();
        });

        document.getElementById('toolFilter').addEventListener('change', () => {
            this.renderEventFeed();
        });

        // Timeline zoom
        document.getElementById('timelineZoomOut').addEventListener('click', () => {
            this.timelineZoom = Math.max(0.5, this.timelineZoom - 0.25);
            this.renderTimeline();
        });

        document.getElementById('timelineZoomIn').addEventListener('click', () => {
            this.timelineZoom = Math.min(2, this.timelineZoom + 0.25);
            this.renderTimeline();
        });
    }

    formatTime(timestamp) {
        return timestamp.toLocaleTimeString('en-US', { 
            hour12: false, 
            hour: '2-digit', 
            minute: '2-digit', 
            second: '2-digit' 
        });
    }

    formatEventType(eventType) {
        const types = {
            'user_prompt_submit': 'User Prompt',
            'pre_tool_use': 'Tool Start',
            'post_tool_use': 'Tool End',
            'notification': 'Notification',
            'stop': 'Stop',
            'subagent_stop': 'Sub-agent Stop',
            'error': 'Error'
        };
        return types[eventType] || eventType;
    }

    formatDuration(seconds) {
        if (seconds < 60) return `${seconds}s`;
        if (seconds < 3600) return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
        return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
    }
}

// Initialize the dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new GridLayoutMonitor();
});