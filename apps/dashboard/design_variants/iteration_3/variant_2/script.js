// Chronicle Dashboard - Enhanced Timeline JavaScript
class ChronicleTimeline {
    constructor() {
        this.selectedSessions = new Set(['s3']);
        this.currentView = 'timeline';
        this.isLive = true;
        this.expandedProjects = new Set(['chronicle']);
        this.timeZoom = '2m'; // 30s, 2m, 5m
        this.filters = {
            tool: '',
            status: ''
        };
        
        this.init();
        this.startSimulation();
    }

    init() {
        this.bindEventListeners();
        this.updateSelectedSessions();
        this.toggleView(this.currentView);
    }

    bindEventListeners() {
        // Sidebar interactions
        this.bindSidebarEvents();
        
        // Timeline controls
        this.bindTimelineControls();
        
        // Header controls
        this.bindHeaderControls();
        
        // Timeline interactions
        this.bindTimelineEvents();
    }

    bindSidebarEvents() {
        // Session selection
        document.addEventListener('click', (e) => {
            const sessionItem = e.target.closest('.session-item, .sub-agent-item');
            if (sessionItem) {
                const sessionId = sessionItem.dataset.session;
                if (sessionId) {
                    this.toggleSessionSelection(sessionId);
                }
            }
        });

        // Project expand/collapse
        document.addEventListener('click', (e) => {
            const sectionHeader = e.target.closest('.section-header[data-project]');
            if (sectionHeader) {
                const projectId = sectionHeader.dataset.project;
                this.toggleProjectExpansion(projectId);
            }
        });

        // Expand/collapse all
        document.getElementById('expandAllBtn')?.addEventListener('click', () => {
            this.expandAllProjects();
        });

        document.getElementById('collapseAllBtn')?.addEventListener('click', () => {
            this.collapseAllProjects();
        });
    }

    bindTimelineControls() {
        // View toggle
        document.querySelectorAll('.toggle-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const view = btn.dataset.view;
                if (view) {
                    this.toggleView(view);
                }
            });
        });

        // Filters
        document.getElementById('toolFilter')?.addEventListener('change', (e) => {
            this.filters.tool = e.target.value;
            this.applyFilters();
        });

        document.getElementById('statusFilter')?.addEventListener('change', (e) => {
            this.filters.status = e.target.value;
            this.applyFilters();
        });

        // Zoom controls
        document.querySelectorAll('.zoom-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const zoom = btn.dataset.zoom;
                if (zoom) {
                    this.setTimeZoom(zoom);
                }
            });
        });
    }

    bindHeaderControls() {
        // Pause/play
        document.getElementById('pauseBtn')?.addEventListener('click', () => {
            this.toggleLive();
        });

        // Settings
        document.getElementById('settingsBtn')?.addEventListener('click', () => {
            this.openSettings();
        });
    }

    bindTimelineEvents() {
        // Swimlane selection
        document.addEventListener('click', (e) => {
            const swimlane = e.target.closest('.swimlane');
            if (swimlane && !e.target.closest('.tool-event, .tool-cluster, .notification-marker')) {
                const sessionId = swimlane.dataset.session;
                if (sessionId) {
                    this.selectSwimlane(sessionId);
                }
            }
        });

        // Tool event interactions
        document.addEventListener('click', (e) => {
            const toolEvent = e.target.closest('.tool-event');
            if (toolEvent) {
                this.showToolDetails(toolEvent);
            }

            const toolCluster = e.target.closest('.tool-cluster');
            if (toolCluster) {
                this.expandToolCluster(toolCluster);
            }

            const notificationMarker = e.target.closest('.notification-marker');
            if (notificationMarker) {
                this.showNotificationDetails(notificationMarker);
            }
        });
    }

    toggleSessionSelection(sessionId) {
        const sessionElement = document.querySelector(`[data-session="${sessionId}"]`);
        
        if (this.selectedSessions.has(sessionId)) {
            this.selectedSessions.delete(sessionId);
            sessionElement?.classList.remove('selected');
        } else {
            // For timeline view, allow multiple selections
            // For events view, single selection
            if (this.currentView === 'events') {
                this.selectedSessions.clear();
                document.querySelectorAll('.session-item.selected, .sub-agent-item.selected')
                    .forEach(el => el.classList.remove('selected'));
            }
            
            this.selectedSessions.add(sessionId);
            sessionElement?.classList.add('selected');
        }

        this.updateSelectedSessions();
        this.updateEventFeed();
    }

    toggleProjectExpansion(projectId) {
        const sectionHeader = document.querySelector(`[data-project="${projectId}"]`);
        const expandIcon = sectionHeader?.querySelector('.expand-icon');
        const sessionList = sectionHeader?.nextElementSibling;

        if (this.expandedProjects.has(projectId)) {
            this.expandedProjects.delete(projectId);
            sectionHeader?.classList.add('collapsed');
            expandIcon?.style.setProperty('transform', 'rotate(-90deg)');
            if (sessionList) sessionList.style.display = 'none';
        } else {
            this.expandedProjects.add(projectId);
            sectionHeader?.classList.remove('collapsed');
            expandIcon?.style.setProperty('transform', 'rotate(0deg)');
            if (sessionList) sessionList.style.display = 'block';
        }
    }

    expandAllProjects() {
        document.querySelectorAll('[data-project]').forEach(header => {
            const projectId = header.dataset.project;
            if (projectId && !this.expandedProjects.has(projectId)) {
                this.toggleProjectExpansion(projectId);
            }
        });
    }

    collapseAllProjects() {
        document.querySelectorAll('[data-project]').forEach(header => {
            const projectId = header.dataset.project;
            if (projectId && this.expandedProjects.has(projectId)) {
                this.toggleProjectExpansion(projectId);
            }
        });
    }

    toggleView(view) {
        this.currentView = view;
        
        // Update toggle buttons
        document.querySelectorAll('.toggle-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.view === view);
        });

        // Show/hide views
        const timelineView = document.getElementById('timelineView');
        const eventsView = document.getElementById('eventsView');

        if (view === 'timeline') {
            timelineView?.classList.remove('hidden');
            eventsView?.classList.add('hidden');
        } else {
            timelineView?.classList.add('hidden');
            eventsView?.classList.remove('hidden');
            this.updateEventFeed();
        }
    }

    setTimeZoom(zoom) {
        this.timeZoom = zoom;
        
        // Update zoom buttons
        document.querySelectorAll('.zoom-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.zoom === zoom);
        });

        // Update timeline scale
        this.updateTimelineScale();
    }

    updateTimelineScale() {
        const ruler = document.querySelector('.timeline-time-ruler');
        if (!ruler) return;

        const now = new Date();
        const markers = [];
        
        let interval, count;
        switch (this.timeZoom) {
            case '30s':
                interval = 5000; // 5 second intervals
                count = 6;
                break;
            case '2m':
                interval = 20000; // 20 second intervals  
                count = 6;
                break;
            case '5m':
                interval = 50000; // 50 second intervals
                count = 6;
                break;
            default:
                interval = 20000;
                count = 6;
        }

        for (let i = 0; i < count; i++) {
            const time = new Date(now.getTime() - (count - 1 - i) * interval);
            markers.push(this.formatTimeMarker(time));
        }

        ruler.innerHTML = markers.map(time => 
            `<div class="time-marker">${time}</div>`
        ).join('');
    }

    formatTimeMarker(date) {
        return date.toTimeString().substr(0, 8);
    }

    applyFilters() {
        // Filter timeline events
        document.querySelectorAll('.tool-event').forEach(event => {
            const tool = event.dataset.tool;
            const shouldShow = (!this.filters.tool || tool === this.filters.tool);
            event.style.display = shouldShow ? 'flex' : 'none';
        });

        // Filter swimlanes by status
        document.querySelectorAll('.swimlane').forEach(lane => {
            const isAwaiting = lane.classList.contains('awaiting');
            const isActive = lane.classList.contains('active') || 
                           (!lane.classList.contains('awaiting') && !lane.classList.contains('completed'));
            
            let shouldShow = true;
            if (this.filters.status === 'awaiting' && !isAwaiting) shouldShow = false;
            if (this.filters.status === 'active' && !isActive) shouldShow = false;
            if (this.filters.status === 'completed' && (isAwaiting || isActive)) shouldShow = false;
            
            lane.style.display = shouldShow ? 'block' : 'none';
        });

        this.updateEventFeed();
    }

    updateSelectedSessions() {
        // Update swimlane selection in timeline
        document.querySelectorAll('.swimlane').forEach(lane => {
            const sessionId = lane.dataset.session;
            lane.classList.toggle('selected', 
                sessionId && this.selectedSessions.has(sessionId));
        });
    }

    selectSwimlane(sessionId) {
        // Add to selection and update sidebar
        if (!this.selectedSessions.has(sessionId)) {
            this.toggleSessionSelection(sessionId);
        }
    }

    updateEventFeed() {
        if (this.currentView !== 'events') return;

        const feedInfo = document.querySelector('.feed-info');
        const selectedCount = this.selectedSessions.size;
        
        if (selectedCount === 0) {
            feedInfo.innerHTML = '<span>No sessions selected</span>';
        } else if (selectedCount === 1) {
            const sessionId = Array.from(this.selectedSessions)[0];
            const sessionName = this.getSessionName(sessionId);
            feedInfo.innerHTML = `<span>Showing events for: <strong>${sessionName}</strong></span><span class="feed-count">247 events</span>`;
        } else {
            feedInfo.innerHTML = `<span>Showing events for: <strong>${selectedCount} sessions</strong></span><span class="feed-count">1,432 events</span>`;
        }

        // Simulate filtered events
        this.generateEventRows();
    }

    getSessionName(sessionId) {
        const sessionElement = document.querySelector(`[data-session="${sessionId}"] .session-name`);
        return sessionElement?.textContent || sessionId;
    }

    generateEventRows() {
        // This would normally fetch real data
        // For demo, we'll simulate some events
        const eventList = document.querySelector('.event-list');
        if (!eventList) return;

        const events = this.generateSimulatedEvents();
        eventList.innerHTML = events.map(event => this.createEventRow(event)).join('');
    }

    generateSimulatedEvents() {
        const tools = ['Read', 'Edit', 'Write', 'Bash', 'Task', 'Grep', 'Glob'];
        const events = [];
        const now = new Date();

        for (let i = 0; i < 20; i++) {
            const time = new Date(now.getTime() - i * 15000);
            const tool = tools[Math.floor(Math.random() * tools.length)];
            const isSubEvent = Math.random() < 0.3;
            
            events.push({
                time: time,
                session: isSubEvent ? '└─ File Analysis' : 'ch-design-sprints',
                type: Math.random() < 0.5 ? 'pre_tool_use' : 'post_tool_use',
                tool: tool,
                details: this.generateEventDetails(tool),
                status: this.generateEventStatus(),
                isSubEvent: isSubEvent,
                isCurrent: i === 0
            });
        }

        return events;
    }

    generateEventDetails(tool) {
        const details = {
            'Read': ['package.json (2.1KB, 45 lines)', 'script.js for analysis', 'README.md'],
            'Edit': ['styles.css (+47 lines, -12 lines)', 'index.html structure update', 'script.js refactoring'],
            'Write': ['config.json with settings', 'new component file', 'test data file'],
            'Bash': ['npm install dependencies', 'git status check', 'docker build image'],
            'Task': ['Launching sub-agent: File Analysis', 'Starting code review task', 'Begin test automation'],
            'Grep': ['Searching for "function" in *.js files', 'Finding TODO comments', 'Locating import statements'],
            'Glob': ['**/*.js pattern matching', 'src/**/*.tsx files', 'test/**/*.spec.js']
        };
        
        const options = details[tool] || ['Generic operation'];
        return options[Math.floor(Math.random() * options.length)];
    }

    generateEventStatus() {
        const statuses = ['active', 'success', 'success', 'success']; // Bias toward success
        return statuses[Math.floor(Math.random() * statuses.length)];
    }

    createEventRow(event) {
        const timeStr = event.time.toTimeString().substr(0, 8);
        const iconMap = {
            'Read': 'description',
            'Edit': 'edit', 
            'Write': 'create',
            'Bash': 'terminal',
            'Task': 'task_alt',
            'Grep': 'search',
            'Glob': 'search'
        };
        
        const statusIconMap = {
            'active': 'hourglass_empty',
            'success': 'check_circle',
            'error': 'error'
        };

        return `
            <div class="event-row ${event.isCurrent ? 'current' : ''} ${event.isSubEvent ? 'sub-event' : ''}">
                <div class="event-time">${timeStr}</div>
                <div class="event-session">${event.session}</div>
                <div class="event-type">${event.type}</div>
                <div class="event-tool">
                    <span class="material-icons">${iconMap[event.tool] || 'settings'}</span>
                    ${event.tool}
                </div>
                <div class="event-details">${event.details}</div>
                <div class="event-status ${event.status}">
                    <span class="material-icons">${statusIconMap[event.status]}</span>
                </div>
            </div>
        `;
    }

    toggleLive() {
        this.isLive = !this.isLive;
        const pauseBtn = document.getElementById('pauseBtn');
        const icon = pauseBtn?.querySelector('.material-icons');
        
        if (icon) {
            icon.textContent = this.isLive ? 'pause' : 'play_arrow';
        }
        
        pauseBtn?.setAttribute('title', this.isLive ? 'Pause live feed' : 'Resume live feed');
        
        // Update status indicator
        const statusIndicator = document.querySelector('.status-indicator');
        if (statusIndicator) {
            statusIndicator.style.color = this.isLive ? '#3fb950' : '#d29922';
            statusIndicator.querySelector('span:last-child').textContent = this.isLive ? 'Live' : 'Paused';
        }
    }

    openSettings() {
        // Placeholder for settings modal
        console.log('Settings modal would open here');
    }

    showToolDetails(toolEvent) {
        const tool = toolEvent.dataset.tool;
        const title = toolEvent.getAttribute('title');
        
        // Create a simple tooltip/modal for tool details
        this.showTooltip(toolEvent, `
            <strong>${tool}</strong><br>
            ${title}<br>
            <small>Click for more details</small>
        `);
    }

    expandToolCluster(toolCluster) {
        const title = toolCluster.getAttribute('title');
        const count = toolCluster.querySelector('.cluster-count')?.textContent;
        
        this.showTooltip(toolCluster, `
            <strong>Tool Cluster</strong><br>
            ${title}<br>
            <small>${count} operations - Click to expand</small>
        `);
    }

    showNotificationDetails(notificationMarker) {
        const title = notificationMarker.getAttribute('title');
        
        this.showTooltip(notificationMarker, `
            <strong>User Input Required</strong><br>
            ${title}<br>
            <small>Session is waiting for response</small>
        `);
    }

    showTooltip(element, content) {
        // Remove existing tooltips
        document.querySelectorAll('.timeline-tooltip').forEach(t => t.remove());
        
        const tooltip = document.createElement('div');
        tooltip.className = 'timeline-tooltip';
        tooltip.innerHTML = content;
        tooltip.style.cssText = `
            position: absolute;
            background: #21262d;
            border: 1px solid #30363d;
            border-radius: 6px;
            padding: 8px 12px;
            font-size: 12px;
            color: #e6edf3;
            z-index: 1000;
            max-width: 200px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        `;
        
        document.body.appendChild(tooltip);
        
        // Position tooltip
        const rect = element.getBoundingClientRect();
        tooltip.style.left = `${rect.left + rect.width / 2 - tooltip.offsetWidth / 2}px`;
        tooltip.style.top = `${rect.top - tooltip.offsetHeight - 8}px`;
        
        // Auto-remove after 3 seconds
        setTimeout(() => tooltip.remove(), 3000);
    }

    startSimulation() {
        // Simulate live updates
        setInterval(() => {
            if (!this.isLive) return;
            
            this.updateTimelineScale();
            this.simulateNewEvents();
            this.updateMetrics();
        }, 5000);

        // Animate active tool events
        setInterval(() => {
            this.animateActiveEvents();
        }, 2000);
    }

    simulateNewEvents() {
        // Randomly update tool positions to simulate new events
        const activeEvents = document.querySelectorAll('.tool-event.active');
        activeEvents.forEach(event => {
            const currentLeft = parseFloat(event.style.left) || 0;
            const newLeft = Math.min(95, currentLeft + Math.random() * 5);
            event.style.left = `${newLeft}%`;
        });

        // Occasionally add new events
        if (Math.random() < 0.3) {
            this.addNewTimelineEvent();
        }
    }

    addNewTimelineEvent() {
        const swimlanes = document.querySelectorAll('.swimlane-track');
        const randomLane = swimlanes[Math.floor(Math.random() * swimlanes.length)];
        
        if (randomLane) {
            const tools = ['Read', 'Edit', 'Write', 'Bash'];
            const randomTool = tools[Math.floor(Math.random() * tools.length)];
            const iconMap = {
                'Read': 'description',
                'Edit': 'edit',
                'Write': 'create', 
                'Bash': 'terminal'
            };
            
            const newEvent = document.createElement('div');
            newEvent.className = 'tool-event active';
            newEvent.dataset.tool = randomTool;
            newEvent.style.left = '5%';
            newEvent.title = `${randomTool}: New operation`;
            newEvent.innerHTML = `<span class="material-icons">${iconMap[randomTool]}</span>`;
            
            randomLane.appendChild(newEvent);
            
            // Remove old events to prevent overcrowding
            const events = randomLane.querySelectorAll('.tool-event');
            if (events.length > 8) {
                events[0].remove();
            }
        }
    }

    animateActiveEvents() {
        const activeEvents = document.querySelectorAll('.tool-event.active');
        activeEvents.forEach(event => {
            // Add a subtle pulse animation
            event.style.transform = 'translateY(-50%) scale(1.1)';
            setTimeout(() => {
                event.style.transform = 'translateY(-50%) scale(1)';
            }, 200);
        });
    }

    updateMetrics() {
        // Simulate changing metrics
        const awaitingMetric = document.querySelector('.metric-value.awaiting');
        const eventsMetric = document.querySelectorAll('.metric-value')[2];
        
        if (awaitingMetric) {
            const current = parseInt(awaitingMetric.textContent);
            const change = Math.random() < 0.1 ? (Math.random() < 0.5 ? -1 : 1) : 0;
            awaitingMetric.textContent = Math.max(0, current + change);
        }
        
        if (eventsMetric) {
            const base = 142;
            const variation = Math.floor(Math.random() * 40 - 20);
            eventsMetric.textContent = Math.max(0, base + variation);
        }
    }
}

// Initialize the dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.chronicleTimeline = new ChronicleTimeline();
});