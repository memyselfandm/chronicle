// Chronicle Dashboard - Reference Implementation JavaScript

class ChronicleDashboard {
    constructor() {
        this.state = {
            sessions: new Map(),
            events: [],
            filters: {
                eventTypes: new Set(),
                sessions: new Set(),
                searchTerm: ''
            },
            selectedSession: 'sess_001',
            selectedEventIndex: 0,
            isPaused: false,
            sidebarCollapsed: false,
            timelineCollapsed: false,
            timelineZoom: 1,
            currentTime: Date.now()
        };

        this.eventQueue = [];
        this.eventSimulation = null;
        this.uiUpdateInterval = null;

        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setupKeyboardShortcuts();
        this.generateInitialData();
        this.startRealTimeSimulation();
        this.startUIUpdates();
        this.updateTimeline();
        this.updateEventFeed();
    }

    setupEventListeners() {
        // Sidebar toggle
        document.getElementById('sidebarToggle').addEventListener('click', () => {
            this.toggleSidebar();
        });

        // Timeline toggle
        document.getElementById('timelineToggle').addEventListener('click', () => {
            this.toggleTimeline();
        });

        // Timeline controls
        document.getElementById('jumpToNow').addEventListener('click', () => {
            this.jumpToNow();
        });

        document.getElementById('zoomIn').addEventListener('click', () => {
            this.adjustZoom(1.5);
        });

        document.getElementById('zoomOut').addEventListener('click', () => {
            this.adjustZoom(0.67);
        });

        // Feed controls
        document.getElementById('pauseFeed').addEventListener('click', () => {
            this.togglePause();
        });

        document.getElementById('clearFilters').addEventListener('click', () => {
            this.clearAllFilters();
        });

        // Search
        document.getElementById('sessionSearch').addEventListener('input', (e) => {
            this.state.filters.searchTerm = e.target.value.toLowerCase();
            this.updateSidebar();
        });

        // Filter select handlers
        document.getElementById('eventTypeSelect').addEventListener('change', (e) => {
            this.updateEventTypeFilter(e.target);
        });

        document.getElementById('sessionSelect').addEventListener('change', (e) => {
            this.updateSessionFilter(e.target);
        });

        // Session selection
        document.addEventListener('click', (e) => {
            if (e.target.closest('.session-item')) {
                const sessionItem = e.target.closest('.session-item');
                const sessionId = sessionItem.dataset.sessionId;
                this.selectSession(sessionId);
            }
        });

        // Project group expansion
        document.addEventListener('click', (e) => {
            if (e.target.closest('.group-header.expandable')) {
                const header = e.target.closest('.group-header');
                this.toggleProjectGroup(header);
            }
        });

        // Event row selection
        document.addEventListener('click', (e) => {
            if (e.target.closest('.feed-row')) {
                const row = e.target.closest('.feed-row');
                const index = parseInt(row.dataset.eventIndex);
                this.selectEvent(index);
            }
        });
    }

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Don't trigger shortcuts when typing in inputs
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') {
                return;
            }

            switch (e.key.toLowerCase()) {
                case 'j':
                    e.preventDefault();
                    this.navigateEvents(1);
                    break;
                case 'k':
                    e.preventDefault();
                    this.navigateEvents(-1);
                    break;
                case ' ':
                    e.preventDefault();
                    this.jumpToNow();
                    break;
                case 'p':
                    e.preventDefault();
                    this.togglePause();
                    break;
                case '?':
                    e.preventDefault();
                    this.toggleShortcutsHelp();
                    break;
                case 'escape':
                    this.hideShortcutsHelp();
                    break;
            }

            // Ctrl/Cmd shortcuts
            if (e.ctrlKey || e.metaKey) {
                switch (e.key.toLowerCase()) {
                    case 'b':
                        e.preventDefault();
                        this.toggleSidebar();
                        break;
                    case 't':
                        e.preventDefault();
                        this.toggleTimeline();
                        break;
                    case 'x':
                        e.preventDefault();
                        this.clearAllFilters();
                        break;
                }
            }

            // Number keys for event type filters
            if (e.key >= '1' && e.key <= '9') {
                e.preventDefault();
                this.toggleEventTypeFilter(parseInt(e.key) - 1);
            }
        });
    }

    // Data Generation and Management
    generateInitialData() {
        // Generate sessions
        const projects = [
            { path: '/Users/dev/chronicle', branch: 'main' },
            { path: '/Users/dev/chronicle-dashboard', branch: 'main' },
            { path: '/Users/dev/chronicle-dashboard', branch: 'feature/timeline' },
            { path: '/Users/dev/chronicle-dashboard', branch: 'feature/filters' },
            { path: '/Users/dev/web-services', branch: 'main' },
            { path: '/Users/dev/web-services', branch: 'hotfix/security' },
            { path: '/Users/dev/api-gateway', branch: 'feature/auth' },
            { path: '/Users/dev/data-pipeline', branch: 'main' },
            { path: '/Users/dev/data-pipeline', branch: 'feature/streaming' },
            { path: '/Users/dev/data-pipeline', branch: 'develop' },
            { path: '/Users/dev/mobile-app', branch: 'develop' }
        ];

        const sessionStates = ['active', 'awaiting', 'idle'];
        const baseTime = Date.now() - (30 * 60 * 1000); // 30 minutes ago

        projects.forEach((project, index) => {
            const sessionId = `sess_${String(index + 1).padStart(3, '0')}`;
            const state = index < 3 ? 'awaiting' : (index < 8 ? 'active' : 'idle');
            
            this.state.sessions.set(sessionId, {
                id: sessionId,
                projectPath: project.path,
                gitBranch: project.branch,
                state: state,
                lastActivity: baseTime + (index * 2 * 60 * 1000),
                eventCount: 0,
                subAgents: []
            });
        });

        // Add sub-agents for some sessions
        this.state.sessions.get('sess_002').subAgents.push({
            id: 'sub_002_1',
            taskName: 'CSS optimization',
            state: 'active',
            parentId: 'sess_002'
        });

        // Generate initial events
        this.generateHistoricalEvents(baseTime, 150);
        
        // Update UI
        this.updateSessionFilters();
    }

    generateHistoricalEvents(startTime, count) {
        const eventTypes = [
            'session_start', 'user_prompt_submit', 'pre_tool_use', 'post_tool_use',
            'notification', 'stop', 'subagent_stop', 'pre_compact', 'error'
        ];
        
        const tools = [
            'Read', 'Write', 'Edit', 'MultiEdit', 'Bash', 'Glob', 'Grep', 'LS',
            'WebFetch', 'WebSearch', 'Task', 'TodoRead', 'TodoWrite'
        ];

        const sessions = Array.from(this.state.sessions.keys());
        let currentTime = startTime;

        for (let i = 0; i < count; i++) {
            const sessionId = sessions[Math.floor(Math.random() * sessions.length)];
            const session = this.state.sessions.get(sessionId);
            
            // Create realistic event patterns
            let eventType, toolName, details;
            
            if (Math.random() < 0.1) {
                eventType = 'user_prompt_submit';
                details = this.generatePromptDetails();
            } else if (Math.random() < 0.4) {
                eventType = Math.random() < 0.5 ? 'pre_tool_use' : 'post_tool_use';
                toolName = tools[Math.floor(Math.random() * tools.length)];
                details = this.generateToolDetails(toolName, eventType);
            } else if (Math.random() < 0.05) {
                eventType = 'notification';
                details = this.generateNotificationDetails();
                session.state = 'awaiting';
            } else if (Math.random() < 0.02) {
                eventType = 'error';
                details = this.generateErrorDetails();
            } else {
                eventType = eventTypes[Math.floor(Math.random() * eventTypes.length)];
                details = this.generateGenericDetails(eventType);
            }

            const event = {
                id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                sessionId: sessionId,
                eventType: eventType,
                timestamp: currentTime,
                toolName: toolName || null,
                details: details,
                durationMs: eventType === 'post_tool_use' ? Math.floor(Math.random() * 2000) + 50 : null
            };

            this.state.events.push(event);
            session.eventCount++;
            session.lastActivity = currentTime;

            currentTime += Math.floor(Math.random() * 15000) + 2000; // 2-17 seconds between events
        }

        // Sort events by timestamp
        this.state.events.sort((a, b) => a.timestamp - b.timestamp);
    }

    generatePromptDetails() {
        const prompts = [
            'Implement user authentication system',
            'Fix responsive design issues on mobile',
            'Add database migrations for user table',
            'Optimize API response times',
            'Create unit tests for payment module',
            'Update documentation for new features'
        ];
        return prompts[Math.floor(Math.random() * prompts.length)];
    }

    generateToolDetails(toolName, eventType) {
        const toolDetails = {
            'Read': eventType === 'pre_tool_use' ? 'Reading config.json' : 'File content loaded (2.3KB)',
            'Write': eventType === 'pre_tool_use' ? 'Creating new component' : 'File written successfully',
            'Edit': eventType === 'pre_tool_use' ? 'Updating existing code' : 'Changes applied to 3 files',
            'Bash': eventType === 'pre_tool_use' ? 'Running npm test' : 'Tests completed (47 passed)',
            'Glob': eventType === 'pre_tool_use' ? 'Finding *.js files' : 'Found 23 matching files',
            'Grep': eventType === 'pre_tool_use' ? 'Searching for function' : '8 matches found',
            'Task': eventType === 'pre_tool_use' ? 'Launching sub-agent' : 'Sub-task completed'
        };
        return toolDetails[toolName] || `${toolName} ${eventType === 'pre_tool_use' ? 'starting' : 'completed'}`;
    }

    generateNotificationDetails() {
        const notifications = [
            'File permissions needed for write operation',
            'Confirm database schema changes',
            'Approve deployment to production',
            'Review code changes before commit'
        ];
        return notifications[Math.floor(Math.random() * notifications.length)];
    }

    generateErrorDetails() {
        const errors = [
            'Network timeout connecting to API',
            'File not found: package.json',
            'Permission denied: cannot write to directory',
            'Syntax error in configuration file'
        ];
        return errors[Math.floor(Math.random() * errors.length)];
    }

    generateGenericDetails(eventType) {
        const details = {
            'session_start': 'New Claude Code session initiated',
            'stop': 'Task completed successfully',
            'subagent_stop': 'Sub-agent task finished',
            'pre_compact': 'Context size threshold reached'
        };
        return details[eventType] || `${eventType} event occurred`;
    }

    // Real-time simulation
    startRealTimeSimulation() {
        if (this.eventSimulation) {
            clearInterval(this.eventSimulation);
        }

        this.eventSimulation = setInterval(() => {
            if (!this.state.isPaused) {
                this.generateRealtimeEvent();
                this.updateStats();
            }
        }, Math.random() * 3000 + 1000); // 1-4 seconds
    }

    generateRealtimeEvent() {
        const sessions = Array.from(this.state.sessions.entries()).filter(([_, session]) => 
            session.state === 'active' || Math.random() < 0.1
        );

        if (sessions.length === 0) return;

        const [sessionId, session] = sessions[Math.floor(Math.random() * sessions.length)];
        const tools = ['Read', 'Edit', 'Bash', 'Glob', 'Grep'];
        
        let eventType, toolName, details;
        
        // Create realistic event flows
        if (Math.random() < 0.3) {
            eventType = Math.random() < 0.5 ? 'pre_tool_use' : 'post_tool_use';
            toolName = tools[Math.floor(Math.random() * tools.length)];
            details = this.generateToolDetails(toolName, eventType);
        } else if (Math.random() < 0.05) {
            eventType = 'notification';
            details = this.generateNotificationDetails();
            session.state = 'awaiting';
        } else {
            eventType = 'user_prompt_submit';
            details = this.generatePromptDetails();
            session.state = 'active';
        }

        const event = {
            id: `event_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            sessionId: sessionId,
            eventType: eventType,
            timestamp: Date.now(),
            toolName: toolName || null,
            details: details,
            durationMs: eventType === 'post_tool_use' ? Math.floor(Math.random() * 1500) + 50 : null
        };

        this.state.events.push(event);
        session.eventCount++;
        session.lastActivity = event.timestamp;

        // Keep only recent events (last 1000)
        if (this.state.events.length > 1000) {
            this.state.events = this.state.events.slice(-800);
        }

        // Update UI if not paused
        if (!this.state.isPaused) {
            this.addEventToFeed(event);
            this.updateTimelineEvent(event);
        }
    }

    startUIUpdates() {
        if (this.uiUpdateInterval) {
            clearInterval(this.uiUpdateInterval);
        }

        this.uiUpdateInterval = setInterval(() => {
            this.updateStats();
            this.updateConnectionStatus();
            this.updateTimeMarkers();
        }, 5000); // Update every 5 seconds
    }

    // UI Update Methods
    updateStats() {
        const activeSessions = Array.from(this.state.sessions.values())
            .filter(s => s.state === 'active').length;
        const awaitingSessions = Array.from(this.state.sessions.values())
            .filter(s => s.state === 'awaiting').length;
        
        // Calculate events per minute from recent events
        const oneMinuteAgo = Date.now() - 60000;
        const recentEvents = this.state.events.filter(e => e.timestamp > oneMinuteAgo).length;

        document.getElementById('activeCount').textContent = activeSessions;
        document.getElementById('awaitingCount').textContent = awaitingSessions;
        document.getElementById('eventsPerMin').textContent = recentEvents;
    }

    updateConnectionStatus() {
        const indicator = document.getElementById('connectionStatus');
        // Simulate occasional connection issues
        if (Math.random() < 0.02) {
            indicator.className = 'status-indicator disconnected';
        } else {
            indicator.className = 'status-indicator connected';
        }
    }

    updateSidebar() {
        const container = document.getElementById('projectGroups');
        const searchTerm = this.state.filters.searchTerm;
        
        // Group sessions by project
        const projects = new Map();
        const awaitingSessions = [];

        for (const [sessionId, session] of this.state.sessions) {
            if (searchTerm && !this.sessionMatchesSearch(session, searchTerm)) {
                continue;
            }

            if (session.state === 'awaiting') {
                awaitingSessions.push({ sessionId, session });
            } else {
                const projectName = this.getProjectName(session.projectPath);
                if (!projects.has(projectName)) {
                    projects.set(projectName, []);
                }
                projects.get(projectName).push({ sessionId, session });
            }
        }

        let html = '';

        // Awaiting Input Group (always on top)
        if (awaitingSessions.length > 0) {
            html += `
                <div class="project-group awaiting-group">
                    <div class="group-header">
                        <i class="material-icons">pending</i>
                        <span class="group-title">Awaiting Input</span>
                        <span class="session-count">${awaitingSessions.length}</span>
                    </div>
                    <div class="session-list">
            `;
            
            awaitingSessions.forEach(({ sessionId, session }) => {
                const isSelected = sessionId === this.state.selectedSession;
                html += this.renderSessionItem(sessionId, session, isSelected);
            });
            
            html += `</div></div>`;
        }

        // Regular project groups
        for (const [projectName, sessions] of projects) {
            const isExpanded = true; // Could be state-based
            html += `
                <div class="project-group">
                    <div class="group-header expandable" data-expanded="${isExpanded}">
                        <i class="material-icons expand-icon">${isExpanded ? 'keyboard_arrow_down' : 'keyboard_arrow_right'}</i>
                        <i class="material-icons">folder</i>
                        <span class="group-title">${projectName}</span>
                        <span class="session-count">${sessions.length}</span>
                    </div>
                    <div class="session-list ${isExpanded ? '' : 'collapsed'}">
            `;
            
            sessions.forEach(({ sessionId, session }) => {
                const isSelected = sessionId === this.state.selectedSession;
                html += this.renderSessionItem(sessionId, session, isSelected);
                
                // Render sub-agents
                session.subAgents.forEach(subAgent => {
                    html += this.renderSubAgentItem(subAgent);
                });
            });
            
            html += `</div></div>`;
        }

        container.innerHTML = html;
    }

    renderSessionItem(sessionId, session, isSelected) {
        const projectName = this.getProjectName(session.projectPath);
        const displayName = session.gitBranch || 'main';
        const lastActivityText = this.getLastActivityText(session.lastActivity);
        
        return `
            <div class="session-item ${session.state} ${isSelected ? 'selected' : ''}" 
                 data-session-id="${sessionId}" 
                 data-project="${session.projectPath}">
                <div class="session-status"></div>
                <div class="session-info">
                    <div class="session-name">${session.state === 'awaiting' ? `${projectName}/${displayName}` : displayName}</div>
                    <div class="session-detail">${lastActivityText}</div>
                </div>
            </div>
        `;
    }

    renderSubAgentItem(subAgent) {
        return `
            <div class="subagent-item" data-session-id="${subAgent.id}">
                <div class="session-status"></div>
                <div class="session-info">
                    <div class="session-name">${subAgent.taskName}</div>
                    <div class="session-detail">Sub-agent task</div>
                </div>
            </div>
        `;
    }

    updateTimeline() {
        this.updateTimeMarkers();
        this.updateSwimlanes();
    }

    updateTimeMarkers() {
        const container = document.getElementById('timeMarkers');
        const now = Date.now();
        const timeRange = 10 * 60 * 1000; // 10 minutes
        const pixelsPerMinute = 100 * this.state.timelineZoom;
        const markerInterval = 30000; // 30 seconds

        let html = '';
        for (let time = now - timeRange; time <= now; time += markerInterval) {
            const position = ((time - (now - timeRange)) / timeRange) * (timeRange / 60000) * pixelsPerMinute;
            const isNow = time === now;
            const isMajor = (time % 120000) === 0; // Every 2 minutes
            
            html += `
                <div class="time-marker ${isMajor ? 'major' : ''}" style="left: ${position}px">
                    ${isNow ? 'now' : this.formatTimeMarker(time)}
                </div>
            `;
        }
        
        container.innerHTML = html;
    }

    updateSwimlanes() {
        const container = document.getElementById('swimlanes');
        const filteredSessions = this.getFilteredSessions();
        
        let html = '';
        filteredSessions.forEach(([sessionId, session]) => {
            html += this.renderSwimlane(sessionId, session);
        });
        
        container.innerHTML = html;
    }

    renderSwimlane(sessionId, session) {
        const projectName = this.getProjectName(session.projectPath);
        const displayName = `${projectName}/${session.gitBranch}`;
        
        return `
            <div class="swimlane" data-session-id="${sessionId}">
                <div class="swimlane-label">${displayName}</div>
                <div class="swimlane-events" id="swimlane-${sessionId}">
                    ${this.renderTimelineEvents(sessionId)}
                </div>
            </div>
        `;
    }

    renderTimelineEvents(sessionId) {
        const now = Date.now();
        const timeRange = 10 * 60 * 1000; // 10 minutes
        const pixelsPerMinute = 100 * this.state.timelineZoom;
        
        const sessionEvents = this.state.events.filter(event => 
            event.sessionId === sessionId && 
            event.timestamp >= (now - timeRange)
        );

        let html = '';
        sessionEvents.forEach(event => {
            const position = ((event.timestamp - (now - timeRange)) / timeRange) * (timeRange / 60000) * pixelsPerMinute;
            const icon = this.getEventIcon(event.eventType);
            
            html += `
                <div class="timeline-event event-${event.eventType}" 
                     style="left: ${position}px"
                     title="${event.eventType}: ${event.details}"
                     data-event-id="${event.id}">
                    <i class="material-icons">${icon}</i>
                </div>
            `;
        });
        
        return html;
    }

    updateEventFeed() {
        const container = document.getElementById('feedBody');
        const filteredEvents = this.getFilteredEvents();
        const recentEvents = filteredEvents.slice(-100); // Show last 100 events
        
        let html = '';
        recentEvents.reverse().forEach((event, index) => {
            html += this.renderEventRow(event, recentEvents.length - 1 - index);
        });
        
        container.innerHTML = html;
        
        // Auto-scroll to bottom if not manually scrolled
        if (container.scrollHeight - container.scrollTop < container.clientHeight + 100) {
            container.scrollTop = container.scrollHeight;
        }
    }

    addEventToFeed(event) {
        const container = document.getElementById('feedBody');
        const row = document.createElement('div');
        row.innerHTML = this.renderEventRow(event, this.state.events.length - 1);
        row.firstElementChild.classList.add('new-event');
        
        container.insertBefore(row.firstElementChild, container.firstElementChild);
        
        // Remove old events if too many
        if (container.children.length > 100) {
            container.removeChild(container.lastElementChild);
        }
        
        // Auto-scroll if at bottom
        if (container.scrollTop < 50) {
            container.scrollTop = 0;
        }
    }

    renderEventRow(event, index) {
        const session = this.state.sessions.get(event.sessionId);
        const displayName = session ? `${this.getProjectName(session.projectPath)}/${session.gitBranch}` : event.sessionId;
        const time = this.formatEventTime(event.timestamp);
        const icon = this.getEventIcon(event.eventType);
        const isSelected = index === this.state.selectedEventIndex;
        
        return `
            <div class="feed-row type-${event.eventType} ${isSelected ? 'selected' : ''}" 
                 data-event-index="${index}"
                 data-event-id="${event.id}">
                <div class="col-time">${time}</div>
                <div class="col-session">${displayName}</div>
                <div class="col-type">
                    <div class="event-icon">
                        <i class="material-icons">${icon}</i>
                    </div>
                    ${event.eventType.replace(/_/g, ' ')}
                </div>
                <div class="col-tool">${event.toolName || ''}</div>
                <div class="col-details">${event.details}</div>
            </div>
        `;
    }

    updateTimelineEvent(event) {
        const swimlaneContainer = document.getElementById(`swimlane-${event.sessionId}`);
        if (!swimlaneContainer) return;
        
        const now = Date.now();
        const timeRange = 10 * 60 * 1000; // 10 minutes
        const pixelsPerMinute = 100 * this.state.timelineZoom;
        const position = ((event.timestamp - (now - timeRange)) / timeRange) * (timeRange / 60000) * pixelsPerMinute;
        
        if (position >= 0) { // Only show if within visible range
            const eventElement = document.createElement('div');
            eventElement.className = `timeline-event event-${event.eventType}`;
            eventElement.style.left = `${position}px`;
            eventElement.title = `${event.eventType}: ${event.details}`;
            eventElement.dataset.eventId = event.id;
            eventElement.innerHTML = `<i class="material-icons">${this.getEventIcon(event.eventType)}</i>`;
            
            swimlaneContainer.appendChild(eventElement);
        }
    }

    // Filter and Selection Methods
    getFilteredSessions() {
        const filtered = Array.from(this.state.sessions.entries()).filter(([sessionId, session]) => {
            if (this.state.filters.sessions.size > 0 && !this.state.filters.sessions.has(sessionId)) {
                return false;
            }
            if (this.state.filters.searchTerm && !this.sessionMatchesSearch(session, this.state.filters.searchTerm)) {
                return false;
            }
            return true;
        });
        
        // Sort: awaiting first, then by last activity
        return filtered.sort(([aId, a], [bId, b]) => {
            if (a.state === 'awaiting' && b.state !== 'awaiting') return -1;
            if (b.state === 'awaiting' && a.state !== 'awaiting') return 1;
            return b.lastActivity - a.lastActivity;
        });
    }

    getFilteredEvents() {
        return this.state.events.filter(event => {
            if (this.state.filters.eventTypes.size > 0 && !this.state.filters.eventTypes.has(event.eventType)) {
                return false;
            }
            if (this.state.filters.sessions.size > 0 && !this.state.filters.sessions.has(event.sessionId)) {
                return false;
            }
            return true;
        });
    }

    sessionMatchesSearch(session, searchTerm) {
        const searchable = [
            this.getProjectName(session.projectPath),
            session.gitBranch,
            session.projectPath
        ].join(' ').toLowerCase();
        
        return searchable.includes(searchTerm);
    }

    selectSession(sessionId) {
        this.state.selectedSession = sessionId;
        this.updateSidebar();
        
        // Filter events to this session
        this.state.filters.sessions.clear();
        this.state.filters.sessions.add(sessionId);
        this.updateSessionFilters();
        this.updateEventFeed();
        this.updateTimeline();
    }

    selectEvent(index) {
        this.state.selectedEventIndex = index;
        this.updateEventFeed();
    }

    navigateEvents(direction) {
        const filteredEvents = this.getFilteredEvents();
        const newIndex = Math.max(0, Math.min(filteredEvents.length - 1, this.state.selectedEventIndex + direction));
        this.selectEvent(newIndex);
    }

    // Control Methods
    toggleSidebar() {
        this.state.sidebarCollapsed = !this.state.sidebarCollapsed;
        const sidebar = document.getElementById('sidebar');
        sidebar.classList.toggle('collapsed', this.state.sidebarCollapsed);
    }

    toggleTimeline() {
        this.state.timelineCollapsed = !this.state.timelineCollapsed;
        const timeline = document.getElementById('timelineSection');
        const toggleBtn = document.getElementById('timelineToggle');
        
        timeline.classList.toggle('collapsed', this.state.timelineCollapsed);
        // Caret icon rotation is handled by CSS
    }

    togglePause() {
        this.state.isPaused = !this.state.isPaused;
        const btn = document.getElementById('pauseFeed');
        btn.classList.toggle('paused', this.state.isPaused);
        btn.querySelector('.material-icons').textContent = 
            this.state.isPaused ? 'play_arrow' : 'pause';
    }

    toggleProjectGroup(header) {
        const isExpanded = header.dataset.expanded === 'true';
        const newExpanded = !isExpanded;
        
        header.dataset.expanded = newExpanded;
        header.querySelector('.expand-icon').textContent = 
            newExpanded ? 'keyboard_arrow_down' : 'keyboard_arrow_right';
        
        const sessionList = header.nextElementSibling;
        sessionList.classList.toggle('collapsed', !newExpanded);
    }

    jumpToNow() {
        const feedBody = document.getElementById('feedBody');
        feedBody.scrollTop = 0; // Events are newest first
        
        this.state.currentTime = Date.now();
        this.updateTimeMarkers();
    }

    adjustZoom(factor) {
        this.state.timelineZoom = Math.max(0.5, Math.min(3, this.state.timelineZoom * factor));
        this.updateTimeline();
    }

    clearAllFilters() {
        this.state.filters.eventTypes.clear();
        this.state.filters.sessions.clear();
        this.state.filters.searchTerm = '';
        
        document.getElementById('sessionSearch').value = '';
        
        // Clear select element selections
        const eventTypeSelect = document.getElementById('eventTypeSelect');
        const sessionSelect = document.getElementById('sessionSelect');
        
        if (eventTypeSelect) {
            Array.from(eventTypeSelect.options).forEach(option => {
                option.selected = false;
            });
        }
        if (sessionSelect) {
            Array.from(sessionSelect.options).forEach(option => {
                option.selected = false;
            });
        }
        
        this.updateEventFeed();
        this.updateTimeline();
        this.updateSidebar();
    }

    // Filter methods for select elements
    updateEventTypeFilter(selectElement) {
        this.state.filters.eventTypes.clear();
        Array.from(selectElement.selectedOptions).forEach(option => {
            this.state.filters.eventTypes.add(option.value);
        });
        
        this.updateEventFeed();
        this.updateTimeline();
    }

    updateSessionFilter(selectElement) {
        this.state.filters.sessions.clear();
        Array.from(selectElement.selectedOptions).forEach(option => {
            this.state.filters.sessions.add(option.value);
        });
        
        this.updateEventFeed();
        this.updateTimeline();
    }

    toggleEventTypeFilter(index) {
        const selectElement = document.getElementById('eventTypeSelect');
        const options = selectElement.options;
        if (options[index]) {
            options[index].selected = !options[index].selected;
            this.updateEventTypeFilter(selectElement);
        }
    }

    updateSessionFilters() {
        const selectElement = document.getElementById('sessionSelect');
        selectElement.innerHTML = '';
        
        for (const [sessionId, session] of this.state.sessions) {
            const projectName = this.getProjectName(session.projectPath);
            const displayName = `${projectName}/${session.gitBranch}`;
            
            const option = document.createElement('option');
            option.value = sessionId;
            option.textContent = displayName;
            
            selectElement.appendChild(option);
        }
    }

    toggleShortcutsHelp() {
        const help = document.getElementById('shortcutsHelp');
        help.classList.toggle('visible');
    }

    hideShortcutsHelp() {
        const help = document.getElementById('shortcutsHelp');
        help.classList.remove('visible');
    }

    // Utility Methods
    getProjectName(path) {
        return path.split('/').pop() || 'unknown';
    }

    getLastActivityText(timestamp) {
        const now = Date.now();
        const diff = now - timestamp;
        const minutes = Math.floor(diff / 60000);
        const hours = Math.floor(minutes / 60);
        
        if (minutes < 1) return 'Just now';
        if (minutes < 60) return `${minutes}min ago`;
        if (hours < 24) return `${hours}h ago`;
        return `${Math.floor(hours / 24)}d ago`;
    }

    formatEventTime(timestamp) {
        return new Date(timestamp).toLocaleTimeString('en-US', {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    }

    formatTimeMarker(timestamp) {
        return new Date(timestamp).toLocaleTimeString('en-US', {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    getEventIcon(eventType) {
        const icons = {
            'session_start': 'play_circle',
            'user_prompt_submit': 'chat',
            'pre_tool_use': 'build_circle',
            'post_tool_use': 'check_circle',
            'notification': 'notifications',
            'stop': 'stop_circle',
            'subagent_stop': 'radio_button_checked',
            'pre_compact': 'compress',
            'error': 'error'
        };
        return icons[eventType] || 'circle';
    }
}

// Initialize dashboard when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.dashboard = new ChronicleDashboard();
});

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ChronicleDashboard;
}