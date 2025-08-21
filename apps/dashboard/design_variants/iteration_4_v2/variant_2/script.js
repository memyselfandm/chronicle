// Chronicle Dashboard - Enhanced Timeline Focus - Variant 2

class ChronicleTimeline {
    constructor() {
        this.sessions = new Map();
        this.events = [];
        this.currentZoom = 5; // minutes
        this.timelineStart = new Date(Date.now() - 30 * 60 * 1000); // 30 minutes ago
        this.isAutoScroll = true;
        this.selectedSessions = new Set();
        this.filters = {
            projects: new Set(['all']),
            statuses: new Set(['all']),
            eventTypes: new Set(['all'])
        };
        
        this.init();
        this.startSimulation();
    }

    init() {
        this.setupEventListeners();
        this.generateMockData();
        this.renderSidebar();
        this.renderTimeline();
        this.renderEventFeed();
        this.updateCurrentTimeLine();
        
        // Update current time line every second
        setInterval(() => this.updateCurrentTimeLine(), 1000);
        
        // Update metrics every 5 seconds
        setInterval(() => this.updateMetrics(), 5000);
    }

    setupEventListeners() {
        // Sidebar toggle
        document.getElementById('sidebarToggle').addEventListener('click', () => {
            document.getElementById('sidebar').classList.toggle('collapsed');
        });

        // Timeline collapse
        document.getElementById('timelineCollapse').addEventListener('click', () => {
            const timeline = document.getElementById('timelineSection');
            timeline.classList.toggle('collapsed');
            const icon = document.getElementById('timelineCollapse').querySelector('.material-icons');
            icon.textContent = timeline.classList.contains('collapsed') ? 'expand_more' : 'expand_less';
        });

        // Zoom controls
        document.querySelectorAll('.zoom-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.zoom-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.currentZoom = parseInt(e.target.dataset.zoom);
                this.renderTimeline();
            });
        });

        // Jump to now
        document.getElementById('jumpToNow').addEventListener('click', () => {
            this.timelineStart = new Date(Date.now() - this.currentZoom * 60 * 1000);
            this.renderTimeline();
        });

        // Auto scroll toggle
        document.getElementById('autoScrollBtn').addEventListener('click', (e) => {
            this.isAutoScroll = !this.isAutoScroll;
            e.target.classList.toggle('active', this.isAutoScroll);
        });

        // Filter controls
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const filterType = e.target.dataset.filter;
                const filterValue = e.target.dataset.value;
                this.updateFilterButton(filterType, filterValue, e.target);
            });
        });

        document.getElementById('eventTypeFilter').addEventListener('change', (e) => {
            this.updateFilter('eventTypes', e.target);
        });

        // Timeline scroll synchronization
        document.querySelector('.timeline-content').addEventListener('scroll', (e) => {
            const labels = document.querySelector('.timeline-labels');
            if (labels) {
                labels.scrollTop = e.target.scrollTop;
            }
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.target.tagName.toLowerCase() === 'input' || e.target.tagName.toLowerCase() === 'select') return;
            
            switch(e.key) {
                case 'j':
                    this.navigateEventFeed(1);
                    e.preventDefault();
                    break;
                case 'k':
                    this.navigateEventFeed(-1);
                    e.preventDefault();
                    break;
                case '1':
                case '2':
                case '3':
                case '4':
                case '5':
                    this.setZoom(parseInt(e.key));
                    e.preventDefault();
                    break;
                case 'n':
                    document.getElementById('jumpToNow').click();
                    e.preventDefault();
                    break;
                case 's':
                    document.getElementById('sidebarToggle').click();
                    e.preventDefault();
                    break;
            }
        });
    }

    generateMockData() {
        const projects = [
            { name: 'chronicle-dashboard', branch: 'main' },
            { name: 'chronicle-dashboard', branch: 'feature/timeline-v2' },
            { name: 'ai-agent-toolkit', branch: 'main' },
            { name: 'ai-agent-toolkit', branch: 'feature/task-agents' },
            { name: 'data-pipeline', branch: 'main' },
            { name: 'web-scraper', branch: 'feature/async-processing' }
        ];

        const tools = ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob', 'Task', 'WebFetch'];
        const eventTypes = [
            'session_start', 'user_prompt_submit', 'pre_tool_use', 
            'post_tool_use', 'notification', 'stop', 'subagent_stop', 
            'pre_compact', 'error'
        ];

        // Generate sessions
        projects.forEach((project, i) => {
            const sessionId = `session-${i + 1}`;
            const session = {
                id: sessionId,
                project: project.name,
                branch: project.branch,
                status: Math.random() > 0.8 ? 'awaiting' : (Math.random() > 0.3 ? 'active' : 'idle'),
                startTime: new Date(Date.now() - Math.random() * 60 * 60 * 1000),
                lastActivity: new Date(Date.now() - Math.random() * 10 * 60 * 1000),
                subAgents: []
            };

            // Add sub-agents occasionally
            if (Math.random() > 0.7) {
                session.subAgents.push({
                    id: `${sessionId}-sub-1`,
                    task: 'File analysis',
                    status: 'active',
                    parent: sessionId
                });
            }

            this.sessions.set(sessionId, session);
        });

        // Generate events
        const now = Date.now();
        for (let i = 0; i < 500; i++) {
            const sessionId = Array.from(this.sessions.keys())[Math.floor(Math.random() * this.sessions.size)];
            const session = this.sessions.get(sessionId);
            const eventType = eventTypes[Math.floor(Math.random() * eventTypes.length)];
            const timestamp = new Date(now - Math.random() * 60 * 60 * 1000);

            let tool = null;
            let details = '';
            
            if (eventType === 'pre_tool_use' || eventType === 'post_tool_use') {
                tool = tools[Math.floor(Math.random() * tools.length)];
                if (eventType === 'pre_tool_use') {
                    details = this.getToolDetails(tool, 'pre');
                } else {
                    details = this.getToolDetails(tool, 'post');
                }
            } else if (eventType === 'user_prompt_submit') {
                details = 'User submitted new request';
            } else if (eventType === 'notification') {
                details = 'Awaiting user input for file confirmation';
            } else if (eventType === 'error') {
                details = 'File not found: config.yaml';
            }

            const event = {
                id: `event-${i}`,
                sessionId,
                eventType,
                tool,
                timestamp,
                details,
                project: session.project,
                branch: session.branch,
                isSubAgent: Math.random() > 0.8 && session.subAgents.length > 0
            };

            this.events.push(event);
        }

        // Sort events by timestamp
        this.events.sort((a, b) => a.timestamp - b.timestamp);
    }

    getToolDetails(tool, phase) {
        const preDetails = {
            'Read': 'Reading src/components/Timeline.tsx',
            'Write': 'Creating new file: utils/timeHelpers.js',
            'Edit': 'Modifying function calculateTimeRange',
            'Bash': 'Running: npm run build',
            'Grep': 'Searching for "useState" in *.tsx files',
            'Glob': 'Finding all *.test.js files',
            'Task': 'Spawning sub-agent for code analysis',
            'WebFetch': 'Fetching documentation from API'
        };

        const postDetails = {
            'Read': 'Read 247 lines from Timeline.tsx',
            'Write': 'Created timeHelpers.js (1.2KB)',
            'Edit': 'Modified 3 lines in calculateTimeRange',
            'Bash': 'Build completed successfully (2.1s)',
            'Grep': 'Found 15 matches across 8 files',
            'Glob': 'Found 23 test files',
            'Task': 'Sub-agent analysis completed',
            'WebFetch': 'Fetched 5.7KB documentation'
        };

        return phase === 'pre' ? preDetails[tool] : postDetails[tool];
    }

    updateFilter(filterType, selectElement) {
        const value = selectElement.value;
        this.filters[filterType] = new Set([value]);
        this.renderSidebar();
        this.renderEventFeed();
    }

    updateFilterButton(filterType, filterValue, buttonElement) {
        // For now, just toggle the 'all' state - in a real app this would be more sophisticated
        this.filters[filterType] = new Set([filterValue]);
        
        // Update button state
        document.querySelectorAll(`[data-filter="${filterType}"]`).forEach(btn => {
            btn.classList.remove('active');
        });
        buttonElement.classList.add('active');
        
        this.renderSidebar();
        this.renderEventFeed();
    }

    renderSidebar() {
        const sessionList = document.getElementById('sessionList');
        sessionList.innerHTML = '';

        const filteredSessions = Array.from(this.sessions.values()).filter(session => {
            const projectMatch = this.filters.projects.has('all') || this.filters.projects.has(session.project);
            const statusMatch = this.filters.statuses.has('all') || this.filters.statuses.has(session.status);
            return projectMatch && statusMatch;
        });

        // Sort sessions: awaiting first, then by last activity
        filteredSessions.sort((a, b) => {
            if (a.status === 'awaiting' && b.status !== 'awaiting') return -1;
            if (b.status === 'awaiting' && a.status !== 'awaiting') return 1;
            return b.lastActivity - a.lastActivity;
        });

        filteredSessions.forEach(session => {
            const sessionElement = document.createElement('div');
            sessionElement.className = `session-item ${session.status}`;
            sessionElement.dataset.sessionId = session.id;

            const isSelected = this.selectedSessions.has(session.id);
            if (isSelected) {
                sessionElement.classList.add('selected');
            }

            sessionElement.innerHTML = `
                <div class="session-header">
                    <div class="session-status ${session.status}"></div>
                    <div class="session-title">${session.project}</div>
                </div>
                <div class="session-details">
                    <span class="session-branch">${session.branch}</span> • 
                    ${this.formatRelativeTime(session.lastActivity)}
                </div>
            `;

            sessionElement.addEventListener('click', (e) => {
                if (e.ctrlKey || e.metaKey) {
                    // Multi-select
                    if (this.selectedSessions.has(session.id)) {
                        this.selectedSessions.delete(session.id);
                        sessionElement.classList.remove('selected');
                    } else {
                        this.selectedSessions.add(session.id);
                        sessionElement.classList.add('selected');
                    }
                } else {
                    // Single select
                    document.querySelectorAll('.session-item.selected').forEach(el => {
                        el.classList.remove('selected');
                    });
                    this.selectedSessions.clear();
                    this.selectedSessions.add(session.id);
                    sessionElement.classList.add('selected');
                }
                this.renderTimeline();
                this.renderEventFeed();
            });

            sessionList.appendChild(sessionElement);

            // Add sub-agents
            session.subAgents.forEach(subAgent => {
                const subElement = document.createElement('div');
                subElement.className = `session-item sub-agent ${subAgent.status}`;
                subElement.innerHTML = `
                    <div class="session-header">
                        <div class="session-status ${subAgent.status}"></div>
                        <div class="session-title">${subAgent.task}</div>
                    </div>
                    <div class="session-details">Sub-agent</div>
                `;
                sessionList.appendChild(subElement);
            });
        });
    }

    renderTimeline() {
        const timelineGrid = document.getElementById('timelineGrid');
        const timelineLabels = document.querySelector('.timeline-labels');
        
        timelineGrid.innerHTML = '';
        timelineLabels.innerHTML = '';

        // Get filtered sessions
        const activeSessions = this.selectedSessions.size > 0 
            ? Array.from(this.sessions.values()).filter(s => this.selectedSessions.has(s.id))
            : Array.from(this.sessions.values());

        // Calculate time range and dimensions
        const timelineEnd = new Date(this.timelineStart.getTime() + this.currentZoom * 60 * 1000);
        const timelineWidth = Math.max(1200, this.currentZoom * 20); // Dynamic width based on zoom
        const pixelsPerMs = timelineWidth / (timelineEnd - this.timelineStart);
        
        // Set grid height based on number of sessions
        const totalSessions = activeSessions.reduce((count, session) => {
            return count + 1 + session.subAgents.length;
        }, 0);
        const gridHeight = Math.max(totalSessions * 32, 200);
        timelineGrid.style.height = `${gridHeight}px`;
        timelineGrid.style.width = `${timelineWidth}px`;

        // Create swimlanes
        activeSessions.forEach((session, index) => {
            // Session label
            const label = document.createElement('div');
            label.className = 'timeline-label';
            label.innerHTML = `
                <div class="session-status ${session.status}"></div>
                <span>${session.project}/${session.branch}</span>
            `;
            timelineLabels.appendChild(label);

            // Session swimlane
            const swimlane = document.createElement('div');
            swimlane.className = 'timeline-swimlane';
            swimlane.style.top = `${index * 32}px`;
            swimlane.style.width = `${timelineWidth}px`;
            swimlane.style.left = '0px';
            timelineGrid.appendChild(swimlane);

            // Add events for this session
            const sessionEvents = this.events.filter(event => 
                event.sessionId === session.id &&
                event.timestamp >= this.timelineStart &&
                event.timestamp <= timelineEnd &&
                (event.eventType === 'pre_tool_use' || event.eventType === 'notification')
            );

            // Group consecutive tool uses
            const groupedEvents = this.groupConsecutiveTools(sessionEvents);

            groupedEvents.forEach(eventGroup => {
                const x = (eventGroup.timestamp - this.timelineStart) * pixelsPerMs;
                const y = index * 32 + 6;

                const toolEvent = document.createElement('div');
                toolEvent.className = `tool-event ${this.getToolClass(eventGroup.tool || eventGroup.eventType)}`;
                
                if (eventGroup.count > 1) {
                    toolEvent.classList.add('compressed');
                    toolEvent.textContent = `×${eventGroup.count}`;
                    toolEvent.title = `${eventGroup.tool} (${eventGroup.count} times): ${eventGroup.details}`;
                } else {
                    toolEvent.innerHTML = `<span class="material-icons">${this.getToolIcon(eventGroup.tool || eventGroup.eventType)}</span>`;
                    toolEvent.title = `${eventGroup.tool || eventGroup.eventType}: ${eventGroup.details}`;
                }

                toolEvent.style.left = `${x}px`;
                toolEvent.style.top = `${y}px`;

                // Tooltip
                toolEvent.title = `${eventGroup.tool || eventGroup.eventType}: ${eventGroup.details}`;

                // Add connecting line for sub-agents
                if (eventGroup.isSubAgent) {
                    const connector = document.createElement('div');
                    connector.className = 'sub-agent-connector';
                    connector.style.left = `${x - 10}px`;
                    connector.style.top = `${y - 6}px`;
                    timelineGrid.appendChild(connector);
                    toolEvent.style.marginLeft = '20px';
                }

                timelineGrid.appendChild(toolEvent);
            });

            // Add sub-agent swimlanes
            session.subAgents.forEach((subAgent, subIndex) => {
                const currentIndex = activeSessions.slice(0, index + 1).reduce((total, s, i) => {
                    return total + 1 + (i < index ? s.subAgents.length : subIndex);
                }, 0);
                
                const subLabel = document.createElement('div');
                subLabel.className = 'timeline-label sub-agent';
                subLabel.innerHTML = `<span>${subAgent.task}</span>`;
                timelineLabels.appendChild(subLabel);

                const subSwimlane = document.createElement('div');
                subSwimlane.className = 'timeline-swimlane sub-agent';
                subSwimlane.style.top = `${currentIndex * 32}px`;
                subSwimlane.style.width = `${timelineWidth}px`;
                subSwimlane.style.left = '0px';
                timelineGrid.appendChild(subSwimlane);
            });
        });

        // Add time markers
        this.addTimeMarkers(timelineGrid, timelineWidth);
    }

    groupConsecutiveTools(events) {
        const grouped = [];
        let currentGroup = null;

        events.forEach(event => {
            if (currentGroup && 
                currentGroup.tool === event.tool && 
                event.timestamp - currentGroup.lastTimestamp < 5000) { // 5 seconds
                currentGroup.count++;
                currentGroup.lastTimestamp = event.timestamp;
            } else {
                if (currentGroup) {
                    grouped.push(currentGroup);
                }
                currentGroup = {
                    tool: event.tool,
                    eventType: event.eventType,
                    timestamp: event.timestamp,
                    lastTimestamp: event.timestamp,
                    details: event.details,
                    isSubAgent: event.isSubAgent,
                    count: 1
                };
            }
        });

        if (currentGroup) {
            grouped.push(currentGroup);
        }

        return grouped;
    }

    addTimeMarkers(container, width) {
        const timelineEnd = new Date(this.timelineStart.getTime() + this.currentZoom * 60 * 1000);
        const interval = this.currentZoom >= 30 ? 5 * 60 * 1000 : (this.currentZoom >= 10 ? 60 * 1000 : 30 * 1000);
        
        for (let time = this.timelineStart.getTime(); time <= timelineEnd.getTime(); time += interval) {
            const x = ((time - this.timelineStart) / (timelineEnd - this.timelineStart)) * width;
            
            const marker = document.createElement('div');
            marker.className = 'time-marker';
            marker.style.position = 'absolute';
            marker.style.left = `${x}px`;
            marker.style.top = '0';
            marker.style.height = '100%';
            marker.style.width = '1px';
            marker.style.background = 'rgba(255, 255, 255, 0.15)';
            marker.style.pointerEvents = 'none';
            marker.style.zIndex = '1';
            
            // Add time label
            const label = document.createElement('div');
            label.className = 'time-label';
            label.style.position = 'absolute';
            label.style.left = `${x + 3}px`;
            label.style.top = '4px';
            label.style.fontSize = '9px';
            label.style.color = 'var(--text-muted)';
            label.style.pointerEvents = 'none';
            label.style.background = 'rgba(15, 20, 25, 0.8)';
            label.style.padding = '1px 3px';
            label.style.borderRadius = '2px';
            label.style.fontFamily = 'var(--font-mono)';
            label.style.zIndex = '2';
            label.textContent = new Date(time).toLocaleTimeString('en-US', { 
                hour12: false, 
                minute: '2-digit',
                second: this.currentZoom < 10 ? '2-digit' : undefined
            });
            
            container.appendChild(marker);
            container.appendChild(label);
        }
    }

    renderEventFeed() {
        const eventRows = document.getElementById('eventRows');
        eventRows.innerHTML = '';

        // Filter events
        let filteredEvents = this.events.filter(event => {
            const typeMatch = this.filters.eventTypes.has('all') || this.filters.eventTypes.has(event.eventType);
            const sessionMatch = this.selectedSessions.size === 0 || this.selectedSessions.has(event.sessionId);
            return typeMatch && sessionMatch;
        });

        // Sort by timestamp (newest first for feed)
        filteredEvents.sort((a, b) => b.timestamp - a.timestamp);

        // Take latest 200 events for performance
        filteredEvents = filteredEvents.slice(0, 200);

        filteredEvents.forEach(event => {
            const row = document.createElement('div');
            row.className = `event-row ${event.eventType}`;
            
            const session = this.sessions.get(event.sessionId);
            
            row.innerHTML = `
                <div class="col-time event-time">${this.formatTime(event.timestamp)}</div>
                <div class="col-session event-session ${event.isSubAgent ? 'sub-agent' : ''}">
                    ${session.project}/${session.branch}
                </div>
                <div class="col-type event-type ${event.eventType}">
                    <span class="material-icons">${this.getEventIcon(event.eventType)}</span>
                    <span>${this.formatEventType(event.eventType)}</span>
                </div>
                <div class="col-tool event-tool" ${event.tool ? `data-tool="${event.tool}"` : ''}>${event.tool || '-'}</div>
                <div class="col-details event-details">${event.details}</div>
            `;

            eventRows.appendChild(row);
        });

        // Auto-scroll to bottom if enabled
        if (this.isAutoScroll) {
            setTimeout(() => {
                const feed = document.querySelector('.event-feed');
                feed.scrollTop = 0; // Scroll to top since we show newest first
            }, 100);
        }
    }

    updateCurrentTimeLine() {
        const currentTimeLine = document.getElementById('currentTimeLine');
        const timelineEnd = new Date(this.timelineStart.getTime() + this.currentZoom * 60 * 1000);
        const now = new Date();
        
        if (now >= this.timelineStart && now <= timelineEnd) {
            const timelineWidth = Math.max(1200, this.currentZoom * 20);
            const progress = (now - this.timelineStart) / (timelineEnd - this.timelineStart);
            currentTimeLine.style.left = `${progress * timelineWidth}px`;
            currentTimeLine.style.display = 'block';
        } else {
            currentTimeLine.style.display = 'none';
        }
    }

    updateMetrics() {
        const activeSessions = Array.from(this.sessions.values()).filter(s => s.status === 'active').length;
        const awaitingSessions = Array.from(this.sessions.values()).filter(s => s.status === 'awaiting').length;
        
        // Calculate events per minute from recent events
        const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
        const recentEvents = this.events.filter(e => e.timestamp >= oneMinuteAgo).length;
        
        document.getElementById('activeSessions').textContent = activeSessions;
        document.getElementById('awaitingSessions').textContent = awaitingSessions;
        document.getElementById('eventsPerMin').textContent = recentEvents;
    }

    startSimulation() {
        // Add new events periodically
        setInterval(() => {
            if (Math.random() > 0.3) { // 70% chance to add event
                this.addRandomEvent();
                this.renderEventFeed();
            }
        }, 2000);

        // Update session statuses occasionally
        setInterval(() => {
            this.updateSessionStatuses();
            this.renderSidebar();
        }, 10000);
    }

    addRandomEvent() {
        const sessionIds = Array.from(this.sessions.keys());
        const sessionId = sessionIds[Math.floor(Math.random() * sessionIds.length)];
        const session = this.sessions.get(sessionId);
        
        const tools = ['Read', 'Write', 'Edit', 'Bash', 'Grep'];
        const tool = tools[Math.floor(Math.random() * tools.length)];
        
        const event = {
            id: `event-${Date.now()}`,
            sessionId,
            eventType: Math.random() > 0.5 ? 'pre_tool_use' : 'post_tool_use',
            tool,
            timestamp: new Date(),
            details: this.getToolDetails(tool, Math.random() > 0.5 ? 'pre' : 'post'),
            project: session.project,
            branch: session.branch,
            isSubAgent: Math.random() > 0.8
        };

        this.events.push(event);
        session.lastActivity = new Date();
    }

    updateSessionStatuses() {
        this.sessions.forEach(session => {
            if (Math.random() > 0.9) { // 10% chance to change status
                const statuses = ['active', 'awaiting', 'idle'];
                session.status = statuses[Math.floor(Math.random() * statuses.length)];
            }
        });
    }

    // Utility methods
    getToolClass(tool) {
        const toolMap = {
            'Read': 'read',
            'Write': 'write', 
            'Edit': 'write',
            'Bash': 'bash',
            'Task': 'task',
            'notification': 'notification'
        };
        return toolMap[tool] || 'default';
    }

    getToolIcon(tool) {
        const iconMap = {
            'Read': 'description',
            'Write': 'edit',
            'Edit': 'edit',
            'Bash': 'terminal',
            'Grep': 'search',
            'Glob': 'folder_open',
            'Task': 'account_tree',
            'WebFetch': 'cloud_download',
            'notification': 'notifications'
        };
        return iconMap[tool] || 'settings';
    }

    getEventIcon(eventType) {
        const iconMap = {
            'session_start': 'play_arrow',
            'user_prompt_submit': 'person',
            'pre_tool_use': 'play_circle_outline',
            'post_tool_use': 'check_circle_outline',
            'notification': 'notifications',
            'stop': 'stop',
            'subagent_stop': 'stop_circle',
            'pre_compact': 'compress',
            'error': 'error'
        };
        return iconMap[eventType] || 'circle';
    }

    formatEventType(eventType) {
        return eventType.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    }

    formatTime(timestamp) {
        return timestamp.toLocaleTimeString('en-US', { 
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    }

    formatRelativeTime(timestamp) {
        const now = new Date();
        const diff = now - timestamp;
        const minutes = Math.floor(diff / (1000 * 60));
        
        if (minutes < 1) return 'now';
        if (minutes < 60) return `${minutes}m ago`;
        
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h ago`;
        
        const days = Math.floor(hours / 24);
        return `${days}d ago`;
    }

    navigateEventFeed(direction) {
        // Simple implementation - could be enhanced with actual selection
        const feed = document.querySelector('.event-feed');
        feed.scrollTop += direction * 100;
    }

    setZoom(level) {
        const zoomLevels = [1, 5, 10, 30, 60];
        if (level >= 1 && level <= 5) {
            this.currentZoom = zoomLevels[level - 1];
            
            // Update active zoom button
            document.querySelectorAll('.zoom-btn').forEach(btn => {
                btn.classList.remove('active');
                if (parseInt(btn.dataset.zoom) === this.currentZoom) {
                    btn.classList.add('active');
                }
            });
            
            this.renderTimeline();
        }
    }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new ChronicleTimeline();
});