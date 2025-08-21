// Chronicle Dashboard - Classic Sidebar Monitor JavaScript

class ChronicleMonitor {
    constructor() {
        this.sessions = new Map();
        this.events = [];
        this.filteredEvents = [];
        this.activeFilters = new Set(['all']);
        this.selectedSessions = new Set();
        this.isPaused = false;
        this.eventUpdateInterval = null;
        
        this.init();
    }

    init() {
        this.generateMockData();
        this.setupEventListeners();
        this.startEventStream();
        this.renderSidebar();
        this.renderTimeline();
        this.renderEventFeed();
        this.updateHeaderStats();
    }

    generateMockData() {
        // Generate realistic session data based on Chronicle data model
        const projects = [
            { name: 'chronicle-dashboard', branch: 'feature/timeline-v3', path: '/Users/dev/chronicle-dashboard' },
            { name: 'ai-workspace', branch: 'main', path: '/Users/dev/ai-workspace' },
            { name: 'design-sprints', branch: 'iteration-3', path: '/Users/dev/design-sprints' },
            { name: 'claude-code-ext', branch: 'development', path: '/Users/dev/claude-code-ext' },
            { name: 'data-pipeline', branch: 'hotfix/async-fix', path: '/Users/dev/data-pipeline' },
            { name: 'auth-service', branch: 'feature/oauth2', path: '/Users/dev/auth-service' },
            { name: 'mobile-app', branch: 'main', path: '/Users/dev/mobile-app' },
            { name: 'api-gateway', branch: 'staging', path: '/Users/dev/api-gateway' }
        ];

        const statuses = ['active', 'awaiting', 'idle'];
        const tools = ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Task', 'Glob', 'LS', 'WebFetch'];
        
        // Create sessions
        for (let i = 0; i < 16; i++) {
            const project = projects[i % projects.length];
            const status = i < 3 ? 'awaiting' : i < 12 ? 'active' : 'idle';
            
            const session = {
                id: `session_${i + 1}`,
                claude_session_id: `claude_${Date.now()}_${i}`,
                project_path: project.path,
                project_name: project.name,
                git_branch: project.branch,
                status: status,
                start_time: new Date(Date.now() - Math.random() * 3600000).toISOString(),
                last_activity: new Date(Date.now() - Math.random() * 300000).toISOString(),
                sub_agents: this.generateSubAgents(i),
                tool_sequence: this.generateToolSequence(tools, status),
                awaiting_message: status === 'awaiting' ? this.generateAwaitingMessage() : null
            };
            
            this.sessions.set(session.id, session);
        }

        // Generate events for the last 15 minutes
        this.generateRecentEvents();
    }

    generateSubAgents(sessionIndex) {
        if (sessionIndex % 3 !== 0) return [];
        
        const subAgentCount = Math.floor(Math.random() * 3) + 1;
        const subAgents = [];
        
        for (let i = 0; i < subAgentCount; i++) {
            subAgents.push({
                id: `sub_${sessionIndex}_${i}`,
                task: ['File analysis', 'Code generation', 'Testing', 'Documentation'][i % 4],
                status: ['active', 'completed', 'waiting'][Math.floor(Math.random() * 3)]
            });
        }
        
        return subAgents;
    }

    generateToolSequence(tools, status) {
        if (status === 'idle') return [];
        
        const sequenceLength = Math.floor(Math.random() * 15) + 5;
        const sequence = [];
        
        for (let i = 0; i < sequenceLength; i++) {
            const tool = tools[Math.floor(Math.random() * tools.length)];
            const isActive = status === 'active' && i === sequenceLength - 1;
            
            sequence.push({
                tool: tool,
                timestamp: new Date(Date.now() - (sequenceLength - i) * 30000).toISOString(),
                active: isActive,
                compressed: Math.random() > 0.7 ? Math.floor(Math.random() * 5) + 2 : null
            });
        }
        
        return sequence;
    }

    generateAwaitingMessage() {
        const messages = [
            'Permission needed to modify system files',
            'Confirm deletion of 15 files?',
            'Select target deployment environment',
            'API key required for external service',
            'Review changes before commit'
        ];
        return messages[Math.floor(Math.random() * messages.length)];
    }

    generateRecentEvents() {
        const eventTypes = [
            'session_start', 'user_prompt_submit', 'pre_tool_use', 'post_tool_use',
            'notification', 'stop', 'subagent_stop', 'pre_compact', 'error'
        ];
        
        const tools = ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Task', 'Glob', 'LS'];
        const sessionsArray = Array.from(this.sessions.values());
        
        // Generate 150 events over the last 15 minutes
        for (let i = 0; i < 150; i++) {
            const session = sessionsArray[Math.floor(Math.random() * sessionsArray.length)];
            const eventType = eventTypes[Math.floor(Math.random() * eventTypes.length)];
            const timestamp = new Date(Date.now() - Math.random() * 900000); // Last 15 minutes
            
            let event = {
                id: `event_${i + 1}`,
                session_id: session.id,
                event_type: eventType,
                timestamp: timestamp.toISOString(),
                session_name: session.project_name,
                metadata: {}
            };

            // Add tool-specific data
            if (eventType === 'pre_tool_use' || eventType === 'post_tool_use') {
                const tool = tools[Math.floor(Math.random() * tools.length)];
                event.tool_name = tool;
                
                if (eventType === 'post_tool_use') {
                    event.duration_ms = Math.floor(Math.random() * 2000) + 100;
                    event.status = Math.random() > 0.1 ? 'success' : 'error';
                } else {
                    event.status = 'running';
                }
            } else if (eventType === 'notification') {
                event.status = 'awaiting';
                event.metadata.message = this.generateAwaitingMessage();
            } else if (eventType === 'error') {
                event.status = 'error';
                event.metadata.error_message = 'Command execution failed';
            } else {
                event.status = 'success';
            }

            // Mark sub-agent events
            if (session.sub_agents.length > 0 && Math.random() > 0.7) {
                event.is_subagent = true;
                event.subagent_id = session.sub_agents[0].id;
            }

            this.events.push(event);
        }

        // Sort events by timestamp (newest first)
        this.events.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        // Apply initial filtering
        this.applyEventFilters();
    }

    setupEventListeners() {
        // Header controls
        document.getElementById('pause-btn').addEventListener('click', () => this.togglePause());
        document.getElementById('refresh-btn').addEventListener('click', () => this.refresh());

        // Sidebar controls
        document.getElementById('collapse-all').addEventListener('click', () => this.collapseAllSessions());
        document.getElementById('filter-btn').addEventListener('click', () => this.showFilterDialog());

        // Section headers
        document.querySelectorAll('.section-header').forEach(header => {
            header.addEventListener('click', (e) => this.toggleSection(e.target.closest('.sessions-section')));
        });

        // Timeline controls
        document.getElementById('timeline-collapse').addEventListener('click', () => this.toggleTimeline());
        document.getElementById('timeline-range').addEventListener('change', (e) => this.updateTimelineRange(e.target.value));

        // Filter chips
        document.querySelectorAll('.filter-chip').forEach(chip => {
            chip.addEventListener('click', (e) => this.toggleEventFilter(e.target.dataset.filter));
        });

        document.getElementById('clear-filters').addEventListener('click', () => this.clearFilters());
    }

    startEventStream() {
        if (this.eventUpdateInterval) return;
        
        this.eventUpdateInterval = setInterval(() => {
            if (!this.isPaused) {
                this.generateNewEvents();
                this.updateSessions();
                this.renderTimeline();
                this.renderEventFeed();
                this.updateHeaderStats();
            }
        }, 2000);
    }

    generateNewEvents() {
        const activeSessions = Array.from(this.sessions.values()).filter(s => s.status === 'active');
        const eventTypes = ['pre_tool_use', 'post_tool_use', 'notification'];
        const tools = ['Read', 'Write', 'Edit', 'Bash', 'Grep'];

        // Generate 1-3 new events
        const newEventCount = Math.floor(Math.random() * 3) + 1;
        
        for (let i = 0; i < newEventCount; i++) {
            if (activeSessions.length === 0) break;
            
            const session = activeSessions[Math.floor(Math.random() * activeSessions.length)];
            const eventType = eventTypes[Math.floor(Math.random() * eventTypes.length)];
            
            const event = {
                id: `event_${Date.now()}_${i}`,
                session_id: session.id,
                event_type: eventType,
                timestamp: new Date().toISOString(),
                session_name: session.project_name,
                metadata: {}
            };

            if (eventType.includes('tool_use')) {
                event.tool_name = tools[Math.floor(Math.random() * tools.length)];
                event.status = eventType === 'post_tool_use' ? 'success' : 'running';
                if (eventType === 'post_tool_use') {
                    event.duration_ms = Math.floor(Math.random() * 1500) + 200;
                }
            } else if (eventType === 'notification') {
                event.status = 'awaiting';
                // Occasionally make a session awaiting input
                if (Math.random() > 0.8) {
                    session.status = 'awaiting';
                    session.awaiting_message = this.generateAwaitingMessage();
                }
            }

            this.events.unshift(event);
        }

        // Keep only last 200 events for performance
        if (this.events.length > 200) {
            this.events = this.events.slice(0, 200);
        }

        this.applyEventFilters();
    }

    updateSessions() {
        // Randomly update session states
        this.sessions.forEach(session => {
            if (Math.random() > 0.95) {
                if (session.status === 'awaiting' && Math.random() > 0.5) {
                    session.status = 'active';
                    session.awaiting_message = null;
                } else if (session.status === 'active' && Math.random() > 0.9) {
                    session.status = Math.random() > 0.5 ? 'idle' : 'awaiting';
                    if (session.status === 'awaiting') {
                        session.awaiting_message = this.generateAwaitingMessage();
                    }
                }
            }
            
            // Update last activity for active sessions
            if (session.status === 'active') {
                session.last_activity = new Date().toISOString();
            }
        });
    }

    renderSidebar() {
        this.renderSessionList('awaiting-session-list', 'awaiting');
        this.renderSessionList('active-session-list', 'active');
        this.renderSessionList('idle-session-list', 'idle');
        this.updateSectionCounts();
    }

    renderSessionList(containerId, status) {
        const container = document.getElementById(containerId);
        const sessions = Array.from(this.sessions.values()).filter(s => s.status === status);
        
        // Sort awaiting sessions by urgency, others by recent activity
        if (status === 'awaiting') {
            sessions.sort((a, b) => new Date(b.last_activity) - new Date(a.last_activity));
        } else {
            sessions.sort((a, b) => new Date(b.start_time) - new Date(a.start_time));
        }

        container.innerHTML = sessions.map(session => this.createSessionHTML(session)).join('');
        
        // Add click handlers
        container.querySelectorAll('.session-item').forEach(item => {
            item.addEventListener('click', () => this.toggleSessionSelection(item.dataset.sessionId));
        });
    }

    createSessionHTML(session) {
        const statusIcon = this.getStatusIcon(session.status);
        const isSelected = this.selectedSessions.has(session.id);
        
        let subAgentsHTML = '';
        if (session.sub_agents.length > 0) {
            subAgentsHTML = `
                <div class="sub-agents">
                    ${session.sub_agents.map(sub => `
                        <div class="sub-agent-item ${sub.status}">
                            <span class="material-icons" style="font-size: 8px;">subdirectory_arrow_right</span>
                            ${sub.task}
                        </div>
                    `).join('')}
                </div>
            `;
        }

        return `
            <div class="session-item ${session.status} ${isSelected ? 'selected' : ''}" 
                 data-session-id="${session.id}">
                <div class="session-header">
                    <span class="session-project">${session.project_name}</span>
                    <div class="session-status">
                        <span class="material-icons status-icon">${statusIcon}</span>
                    </div>
                </div>
                <div class="session-details">
                    <div class="session-branch">
                        <span class="material-icons">call_split</span>
                        ${session.git_branch}
                    </div>
                    ${session.awaiting_message ? `<div style="color: #fbbf24; font-weight: 500;">${session.awaiting_message}</div>` : ''}
                </div>
                ${subAgentsHTML}
            </div>
        `;
    }

    getStatusIcon(status) {
        switch (status) {
            case 'active': return 'play_circle';
            case 'awaiting': return 'notification_important';
            case 'idle': return 'pause_circle';
            default: return 'help';
        }
    }

    updateSectionCounts() {
        const counts = {
            awaiting: Array.from(this.sessions.values()).filter(s => s.status === 'awaiting').length,
            active: Array.from(this.sessions.values()).filter(s => s.status === 'active').length,
            idle: Array.from(this.sessions.values()).filter(s => s.status === 'idle').length
        };

        document.querySelector('#awaiting-sessions .section-header span:last-child').textContent = `Awaiting Input (${counts.awaiting})`;
        document.querySelector('#active-sessions-section .section-header span:last-child').textContent = `Active (${counts.active})`;
        document.querySelector('#idle-sessions-section .section-header span:last-child').textContent = `Idle (${counts.idle})`;
    }

    renderTimeline() {
        const container = document.getElementById('timeline-container');
        const sessions = Array.from(this.sessions.values())
            .filter(s => s.status !== 'idle')
            .sort((a, b) => a.project_name.localeCompare(b.project_name));

        container.innerHTML = sessions.map(session => this.createTimelineHTML(session)).join('');
    }

    createTimelineHTML(session) {
        const toolSequenceHTML = session.tool_sequence.map(tool => {
            const icon = this.getToolIcon(tool.tool);
            const compression = tool.compressed ? `<span class="tool-compression">×${tool.compressed}</span>` : '';
            return `<div class="tool-icon ${tool.tool.toLowerCase()} ${tool.active ? 'active' : ''}" title="${tool.tool}">${icon}${compression}</div>`;
        }).join('');

        let subSwimlanesHTML = '';
        if (session.sub_agents.length > 0) {
            subSwimlanesHTML = session.sub_agents.map(sub => `
                <div class="timeline-swimlane sub-swimlane">
                    <div class="swimlane-label">↳ ${sub.task}</div>
                    <div class="swimlane-track">
                        <div class="tool-sequence">
                            ${this.generateSubAgentTools(sub.status)}
                        </div>
                    </div>
                </div>
            `).join('');
        }

        return `
            <div class="timeline-swimlane" data-session-id="${session.id}">
                <div class="swimlane-label">${session.project_name}</div>
                <div class="swimlane-track">
                    <div class="tool-sequence">${toolSequenceHTML}</div>
                </div>
            </div>
            ${subSwimlanesHTML}
        `;
    }

    generateSubAgentTools(status) {
        if (status === 'completed') return '<div class="tool-icon task">✓</div>';
        if (status === 'waiting') return '<div class="tool-icon notification">!</div>';
        
        // Active sub-agent with some tools
        const tools = ['R', 'E', 'W'];
        return tools.map(tool => `<div class="tool-icon ${tool === 'W' ? 'active' : ''}">${tool}</div>`).join('');
    }

    getToolIcon(toolName) {
        const icons = {
            'Read': 'R',
            'Write': 'W',
            'Edit': 'E',
            'Bash': 'B',
            'Grep': 'G',
            'Task': 'T',
            'Glob': 'F',
            'LS': 'L',
            'WebFetch': 'W'
        };
        return icons[toolName] || toolName.charAt(0);
    }

    renderEventFeed() {
        const tbody = document.getElementById('event-feed-body');
        const events = this.getFilteredEvents();
        
        tbody.innerHTML = events.slice(0, 50).map(event => this.createEventRowHTML(event)).join('');
    }

    createEventRowHTML(event) {
        const time = new Date(event.timestamp).toLocaleTimeString('en-US', { 
            hour12: false, 
            hour: '2-digit', 
            minute: '2-digit',
            second: '2-digit'
        });
        
        const sessionPill = `<span class="session-pill">${event.session_name}</span>`;
        const duration = event.duration_ms ? `${event.duration_ms}ms` : '';
        const statusBadge = `<span class="status-badge ${event.status}">${event.status}</span>`;
        
        const rowClass = [
            'event-row',
            event.status,
            event.is_subagent ? 'subagent' : ''
        ].filter(Boolean).join(' ');

        return `
            <tr class="${rowClass}">
                <td class="col-time">${time}</td>
                <td class="col-session">${sessionPill}</td>
                <td class="col-event">
                    <span class="event-type ${event.event_type}">${event.event_type}</span>
                </td>
                <td class="col-tool">
                    ${event.tool_name ? `<span class="tool-name">${event.tool_name}</span>` : ''}
                </td>
                <td class="col-status">${statusBadge}</td>
                <td class="col-duration">${duration}</td>
            </tr>
        `;
    }

    getFilteredEvents() {
        let events = this.events;
        
        // Filter by selected sessions
        if (this.selectedSessions.size > 0) {
            events = events.filter(event => this.selectedSessions.has(event.session_id));
        }
        
        // Filter by event types
        if (!this.activeFilters.has('all')) {
            events = events.filter(event => {
                if (this.activeFilters.has('tools') && event.tool_name) return true;
                if (this.activeFilters.has('notifications') && event.event_type === 'notification') return true;
                if (this.activeFilters.has('errors') && event.status === 'error') return true;
                return false;
            });
        }
        
        return events;
    }

    applyEventFilters() {
        this.filteredEvents = this.getFilteredEvents();
    }

    updateHeaderStats() {
        const sessions = Array.from(this.sessions.values());
        const activeSessions = sessions.filter(s => s.status === 'active').length;
        const awaitingSessions = sessions.filter(s => s.status === 'awaiting').length;
        
        // Calculate events per minute from recent events
        const recentEvents = this.events.filter(e => 
            new Date() - new Date(e.timestamp) < 60000
        );
        
        document.getElementById('active-sessions').textContent = activeSessions;
        document.getElementById('awaiting-input').textContent = awaitingSessions;
        document.getElementById('events-per-min').textContent = recentEvents.length;
    }

    // Event handlers
    togglePause() {
        this.isPaused = !this.isPaused;
        const btn = document.getElementById('pause-btn');
        const icon = btn.querySelector('.material-icons');
        icon.textContent = this.isPaused ? 'play_arrow' : 'pause';
    }

    refresh() {
        this.generateMockData();
        this.renderSidebar();
        this.renderTimeline();
        this.renderEventFeed();
        this.updateHeaderStats();
    }

    toggleSessionSelection(sessionId) {
        if (this.selectedSessions.has(sessionId)) {
            this.selectedSessions.delete(sessionId);
        } else {
            this.selectedSessions.add(sessionId);
        }
        
        this.applyEventFilters();
        this.renderSidebar();
        this.renderEventFeed();
    }

    toggleSection(section) {
        const list = section.querySelector('.session-list');
        list.classList.toggle('collapsed');
        
        const icon = section.querySelector('.section-header .material-icons');
        icon.textContent = list.classList.contains('collapsed') ? 'expand_more' : 'expand_less';
    }

    toggleEventFilter(filter) {
        if (filter === 'all') {
            this.activeFilters.clear();
            this.activeFilters.add('all');
        } else {
            this.activeFilters.delete('all');
            if (this.activeFilters.has(filter)) {
                this.activeFilters.delete(filter);
            } else {
                this.activeFilters.add(filter);
            }
            
            if (this.activeFilters.size === 0) {
                this.activeFilters.add('all');
            }
        }
        
        this.updateFilterChips();
        this.applyEventFilters();
        this.renderEventFeed();
    }

    updateFilterChips() {
        document.querySelectorAll('.filter-chip').forEach(chip => {
            const filter = chip.dataset.filter;
            chip.classList.toggle('active', this.activeFilters.has(filter));
        });
    }

    clearFilters() {
        this.selectedSessions.clear();
        this.activeFilters.clear();
        this.activeFilters.add('all');
        
        this.updateFilterChips();
        this.renderSidebar();
        this.renderEventFeed();
    }

    collapseAllSessions() {
        document.querySelectorAll('.session-list').forEach(list => {
            list.classList.add('collapsed');
        });
    }

    toggleTimeline() {
        const container = document.getElementById('timeline-container');
        const btn = document.getElementById('timeline-collapse');
        const icon = btn.querySelector('.material-icons');
        
        container.style.display = container.style.display === 'none' ? 'block' : 'none';
        icon.textContent = container.style.display === 'none' ? 'expand_more' : 'expand_less';
    }

    updateTimelineRange(range) {
        // In a real implementation, this would filter the timeline data
        console.log(`Timeline range updated to: ${range}`);
    }

    showFilterDialog() {
        // In a real implementation, this would show a filter dialog
        alert('Filter dialog would open here');
    }
}

// Initialize the dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new ChronicleMonitor();
});