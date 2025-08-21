// Chronicle Dashboard - Scalability Refined (Variant 4)
// Enterprise-level optimizations for 30+ instances

class ChronicleScalabilityDashboard {
    constructor() {
        this.sessions = new Map();
        this.events = [];
        this.filteredSessions = [];
        this.selectedSessions = new Set();
        this.compactMode = false;
        this.autoScroll = true;
        this.bulkMode = false;
        this.collapsedGroups = new Set();
        this.currentPage = 1;
        this.eventsPerPage = 50;
        this.eventCache = new Map();
        this.virtualScrollOffset = 0;
        this.virtualScrollItemHeight = 32;
        
        // Performance tracking
        this.performanceMetrics = {
            eventRate: 0,
            latency: 0,
            memoryUsage: 0,
            queueDepth: 0,
            cachedEvents: 0
        };
        
        // Web Workers for data processing
        this.initializeWorkers();
        
        // IndexedDB for event caching
        this.initializeDatabase();
        
        // Initialize dashboard
        this.initializeEventListeners();
        this.initializeMockData();
        this.startRealTimeUpdates();
        this.initializeVirtualScrolling();
        this.drawEventSparkline();
    }

    initializeWorkers() {
        // Event processing worker (simulated)
        this.eventProcessor = {
            postMessage: (data) => {
                // Simulate worker processing
                setTimeout(() => {
                    this.handleWorkerMessage({ data: { type: 'processed', events: data.events } });
                }, 10);
            }
        };
    }

    initializeDatabase() {
        // Simulate IndexedDB operations
        this.eventCache = new Map();
        console.log('Event cache initialized');
    }

    initializeEventListeners() {
        // Sidebar controls
        document.getElementById('compact-toggle').addEventListener('click', () => {
            this.toggleCompactMode();
        });

        document.getElementById('bulk-actions').addEventListener('click', () => {
            this.toggleBulkMenu();
        });

        document.getElementById('session-search').addEventListener('input', 
            this.debounce((e) => this.searchSessions(e.target.value), 300)
        );

        // Bulk actions
        document.querySelectorAll('.bulk-action').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.handleBulkAction(e.target.closest('.bulk-action').dataset.action);
            });
        });

        // Sidebar toggle
        document.getElementById('sidebar-toggle').addEventListener('click', () => {
            this.toggleSidebar();
        });

        // Timeline controls
        document.getElementById('zoom-out').addEventListener('click', () => {
            this.zoomTimeline(-1);
        });

        document.getElementById('zoom-in').addEventListener('click', () => {
            this.zoomTimeline(1);
        });

        document.getElementById('jump-to-now').addEventListener('click', () => {
            this.jumpToNow();
        });

        document.getElementById('collapse-timeline').addEventListener('click', () => {
            this.toggleTimelineCollapse();
        });

        // Feed controls
        document.getElementById('auto-scroll-toggle').addEventListener('click', () => {
            this.toggleAutoScroll();
        });

        document.getElementById('clear-cache').addEventListener('click', () => {
            this.clearCache();
        });

        document.getElementById('load-more').addEventListener('click', () => {
            this.loadMoreEvents();
        });

        // Pagination
        document.getElementById('first-page').addEventListener('click', () => {
            this.goToPage(1);
        });

        document.getElementById('prev-page').addEventListener('click', () => {
            this.goToPage(this.currentPage - 1);
        });

        document.getElementById('next-page').addEventListener('click', () => {
            this.goToPage(this.currentPage + 1);
        });

        document.getElementById('last-page').addEventListener('click', () => {
            this.goToPage(this.getTotalPages());
        });

        // Filters
        document.getElementById('status-filter').addEventListener('change', () => {
            this.applyFilters();
        });

        document.getElementById('project-filter').addEventListener('change', () => {
            this.applyFilters();
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            this.handleKeyboard(e);
        });

        // Virtual scrolling
        document.getElementById('virtual-scroll-content').addEventListener('scroll', () => {
            this.handleVirtualScroll();
        });
    }

    initializeMockData() {
        // Generate mock sessions (30+ for scalability testing)
        const projects = [
            { name: 'chronicle', path: '/Users/dev/chronicle', sessions: 8 },
            { name: 'dashboard', path: '/Users/dev/dashboard', sessions: 5 },
            { name: 'api', path: '/Users/dev/api', sessions: 4 },
            { name: 'docs', path: '/Users/dev/docs', sessions: 6 },
            { name: 'tests', path: '/Users/dev/tests', sessions: 3 },
            { name: 'deploy', path: '/Users/dev/deploy', sessions: 2 },
            { name: 'monitoring', path: '/Users/dev/monitoring', sessions: 4 },
            { name: 'config', path: '/Users/dev/config', sessions: 2 }
        ];

        let sessionId = 1;
        projects.forEach(project => {
            for (let i = 0; i < project.sessions; i++) {
                const session = {
                    id: `session-${sessionId++}`,
                    projectPath: project.path,
                    projectName: project.name,
                    branch: ['main', 'develop', 'feature/ui-update', 'fix/performance'][Math.floor(Math.random() * 4)],
                    status: this.getRandomStatus(),
                    lastActivity: new Date(Date.now() - Math.random() * 3600000), // Last hour
                    eventCount: Math.floor(Math.random() * 500) + 50
                };
                this.sessions.set(session.id, session);
            }
        });

        // Generate mock events (1000+ for pagination testing)
        const tools = ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Task', 'WebFetch'];
        const eventTypes = ['user_prompt_submit', 'pre_tool_use', 'post_tool_use', 'notification', 'stop', 'error'];
        
        for (let i = 0; i < 1247; i++) {
            const sessionIds = Array.from(this.sessions.keys());
            const randomSession = sessionIds[Math.floor(Math.random() * sessionIds.length)];
            
            this.events.push({
                id: `event-${i + 1}`,
                sessionId: randomSession,
                timestamp: new Date(Date.now() - Math.random() * 86400000), // Last 24 hours
                type: eventTypes[Math.floor(Math.random() * eventTypes.length)],
                tool: Math.random() > 0.3 ? tools[Math.floor(Math.random() * tools.length)] : null,
                details: this.generateEventDetails(),
                duration: Math.random() > 0.5 ? Math.floor(Math.random() * 2000) + 50 : null
            });
        }

        // Sort events by timestamp (newest first)
        this.events.sort((a, b) => b.timestamp - a.timestamp);
        
        this.filteredSessions = Array.from(this.sessions.values());
        this.updateUI();
    }

    getRandomStatus() {
        const statuses = ['active', 'awaiting', 'idle'];
        const weights = [0.4, 0.15, 0.45]; // 40% active, 15% awaiting, 45% idle
        const random = Math.random();
        let sum = 0;
        
        for (let i = 0; i < weights.length; i++) {
            sum += weights[i];
            if (random < sum) return statuses[i];
        }
        return 'idle';
    }

    generateEventDetails() {
        const details = [
            'Reading configuration file',
            'Executing shell command',
            'Processing user input',
            'Updating database records',
            'Fetching API data',
            'Compiling TypeScript',
            'Running unit tests',
            'Deploying to staging',
            'Analyzing code patterns',
            'Optimizing performance'
        ];
        return details[Math.floor(Math.random() * details.length)];
    }

    initializeVirtualScrolling() {
        const container = document.getElementById('virtual-scroll-content');
        const totalHeight = this.filteredSessions.length * this.virtualScrollItemHeight;
        
        // Create virtual scroll space
        const spacer = document.createElement('div');
        spacer.style.height = `${totalHeight}px`;
        spacer.style.position = 'relative';
        
        container.innerHTML = '';
        container.appendChild(spacer);
        
        this.renderVisibleSessions();
    }

    handleVirtualScroll() {
        requestAnimationFrame(() => {
            this.renderVisibleSessions();
        });
    }

    renderVisibleSessions() {
        const container = document.getElementById('virtual-scroll-content');
        const scrollTop = container.scrollTop;
        const containerHeight = container.clientHeight;
        
        const startIndex = Math.floor(scrollTop / this.virtualScrollItemHeight);
        const endIndex = Math.min(
            startIndex + Math.ceil(containerHeight / this.virtualScrollItemHeight) + 2,
            this.filteredSessions.length
        );
        
        // Group sessions by project
        const sessionsByProject = new Map();
        this.filteredSessions.slice(startIndex, endIndex).forEach(session => {
            if (!sessionsByProject.has(session.projectName)) {
                sessionsByProject.set(session.projectName, []);
            }
            sessionsByProject.get(session.projectName).push(session);
        });
        
        let html = '';
        sessionsByProject.forEach((sessions, project) => {
            const awaitingCount = sessions.filter(s => s.status === 'awaiting').length;
            const totalSessions = this.filteredSessions.filter(s => s.projectName === project).length;
            
            const isCollapsed = this.collapsedGroups.has(project);
            html += `
                <div class="session-group virtual-container" style="position: absolute; top: ${startIndex * this.virtualScrollItemHeight}px;">
                    <div class="session-group-header ${isCollapsed ? 'collapsed' : ''}" data-project="${project}">
                        <span class="material-icons">${isCollapsed ? 'chevron_right' : 'expand_more'}</span>
                        <span>${project}</span>
                        <span class="session-count ${awaitingCount > 0 ? 'has-awaiting' : ''}">${totalSessions}</span>
                    </div>
                    <div class="session-list ${isCollapsed ? 'collapsed' : ''}">
            `;
            
            sessions.forEach(session => {
                const isSelected = this.selectedSessions.has(session.id);
                const compactClass = this.compactMode ? 'compact' : '';
                const bulkModeClass = this.bulkMode ? 'bulk-mode' : '';
                
                html += `
                    <div class="session-item ${session.status} ${isSelected ? 'selected' : ''} ${compactClass} ${bulkModeClass} virtual-item" 
                         data-session-id="${session.id}">
                        <div class="session-status ${session.status}"></div>
                        <div class="session-info">
                            <div class="session-name">${session.projectName}/${session.branch}</div>
                            ${!this.compactMode ? `<div class="session-branch">${session.branch}</div>` : ''}
                        </div>
                        <div class="session-meta">
                            <div class="session-time">${this.formatTime(session.lastActivity)}</div>
                            <div class="session-events">${session.eventCount}</div>
                        </div>
                    </div>
                `;
            });
            
            html += `
                    </div>
                </div>
            `;
        });
        
        const spacer = container.firstElementChild;
        if (spacer) {
            spacer.innerHTML = html;
        }
        
        // Add click handlers for newly rendered elements
        this.addSessionClickHandlers();
        this.addGroupClickHandlers();
    }

    addSessionClickHandlers() {
        document.querySelectorAll('.session-item').forEach(item => {
            item.addEventListener('click', (e) => {
                const sessionId = e.currentTarget.dataset.sessionId;
                if (e.ctrlKey || e.metaKey || this.bulkMode) {
                    this.toggleSessionSelection(sessionId);
                } else {
                    this.selectSession(sessionId);
                }
            });
        });
    }
    
    addGroupClickHandlers() {
        document.querySelectorAll('.session-group-header').forEach(header => {
            header.addEventListener('click', (e) => {
                const project = e.currentTarget.dataset.project;
                this.toggleGroupCollapse(project);
            });
        });
    }
    
    toggleGroupCollapse(project) {
        if (this.collapsedGroups.has(project)) {
            this.collapsedGroups.delete(project);
        } else {
            this.collapsedGroups.add(project);
        }
        this.renderVisibleSessions();
    }

    toggleCompactMode() {
        this.compactMode = !this.compactMode;
        const sidebar = document.getElementById('sidebar');
        const toggle = document.getElementById('compact-toggle');
        
        if (this.compactMode) {
            sidebar.classList.add('compact');
            toggle.classList.add('active');
            this.virtualScrollItemHeight = 28;
        } else {
            sidebar.classList.remove('compact');
            toggle.classList.remove('active');
            this.virtualScrollItemHeight = 32;
        }
        
        this.initializeVirtualScrolling();
    }

    toggleBulkMenu() {
        this.bulkMode = !this.bulkMode;
        const menu = document.getElementById('bulk-menu');
        const button = document.getElementById('bulk-actions');
        const sidebar = document.getElementById('sidebar');
        
        if (this.bulkMode) {
            menu.classList.add('visible');
            button.classList.add('active');
            sidebar.classList.add('bulk-mode');
            // Update button with selection count
            button.setAttribute('data-selected-count', this.selectedSessions.size);
        } else {
            menu.classList.remove('visible');
            button.classList.remove('active');
            sidebar.classList.remove('bulk-mode');
            button.removeAttribute('data-selected-count');
        }
        
        this.renderVisibleSessions();
    }

    searchSessions(query) {
        if (!query.trim()) {
            this.filteredSessions = Array.from(this.sessions.values());
        } else {
            this.filteredSessions = Array.from(this.sessions.values()).filter(session => 
                session.projectName.toLowerCase().includes(query.toLowerCase()) ||
                session.branch.toLowerCase().includes(query.toLowerCase())
            );
        }
        this.initializeVirtualScrolling();
    }

    handleBulkAction(action) {
        switch (action) {
            case 'select-awaiting':
                this.selectedSessions.clear();
                this.filteredSessions
                    .filter(s => s.status === 'awaiting')
                    .forEach(s => this.selectedSessions.add(s.id));
                break;
            case 'select-project':
                // Select all sessions in the same project as the first selected
                if (this.selectedSessions.size > 0) {
                    const firstSelected = Array.from(this.selectedSessions)[0];
                    const session = this.sessions.get(firstSelected);
                    if (session) {
                        this.filteredSessions
                            .filter(s => s.projectName === session.projectName)
                            .forEach(s => this.selectedSessions.add(s.id));
                    }
                }
                break;
            case 'clear-selection':
                this.selectedSessions.clear();
                break;
        }
        this.renderVisibleSessions();
        
        // Update bulk actions button with new count
        const button = document.getElementById('bulk-actions');
        if (this.bulkMode) {
            button.setAttribute('data-selected-count', this.selectedSessions.size);
        }
        
        // Close bulk menu
        this.bulkMode = false;
        document.getElementById('bulk-menu').classList.remove('visible');
        button.classList.remove('active');
        document.getElementById('sidebar').classList.remove('bulk-mode');
    }

    selectSession(sessionId) {
        this.selectedSessions.clear();
        this.selectedSessions.add(sessionId);
        this.filterEventsBySession();
        this.renderVisibleSessions();
    }

    toggleSessionSelection(sessionId) {
        if (this.selectedSessions.has(sessionId)) {
            this.selectedSessions.delete(sessionId);
        } else {
            this.selectedSessions.add(sessionId);
        }
        this.filterEventsBySession();
        this.renderVisibleSessions();
    }

    filterEventsBySession() {
        if (this.selectedSessions.size === 0) {
            this.renderEventFeed(this.events);
        } else {
            const filteredEvents = this.events.filter(event => 
                this.selectedSessions.has(event.sessionId)
            );
            this.renderEventFeed(filteredEvents);
        }
    }

    toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        sidebar.classList.toggle('collapsed');
    }

    zoomTimeline(direction) {
        // Implement timeline zoom functionality
        console.log('Timeline zoom:', direction);
    }

    jumpToNow() {
        // Scroll timeline to current time
        console.log('Jumping to now');
    }

    toggleTimelineCollapse() {
        const timeline = document.getElementById('timeline-section');
        const button = document.getElementById('collapse-timeline');
        const icon = button.querySelector('.material-icons');
        
        timeline.classList.toggle('collapsed');
        icon.textContent = timeline.classList.contains('collapsed') ? 'expand_more' : 'expand_less';
    }

    toggleAutoScroll() {
        this.autoScroll = !this.autoScroll;
        const button = document.getElementById('auto-scroll-toggle');
        const icon = button.querySelector('.material-icons');
        
        button.classList.toggle('active', this.autoScroll);
        icon.textContent = this.autoScroll ? 'pause' : 'play_arrow';
        
        if (this.autoScroll) {
            this.scrollToBottom();
        }
    }

    clearCache() {
        this.eventCache.clear();
        this.performanceMetrics.cachedEvents = 0;
        this.updatePerformanceMonitor();
        console.log('Event cache cleared');
    }

    loadMoreEvents() {
        this.eventsPerPage += 25;
        this.renderEventFeed(this.events);
    }

    goToPage(page) {
        const totalPages = this.getTotalPages();
        if (page < 1 || page > totalPages) return;
        
        this.currentPage = page;
        this.renderEventFeed(this.events);
        this.updatePaginationInfo();
    }

    getTotalPages() {
        return Math.ceil(this.events.length / this.eventsPerPage);
    }

    renderEventFeed(events) {
        const startIndex = (this.currentPage - 1) * this.eventsPerPage;
        const endIndex = startIndex + this.eventsPerPage;
        const pageEvents = events.slice(startIndex, endIndex);
        
        const tbody = document.getElementById('event-table-body');
        tbody.innerHTML = '';
        
        // Use requestAnimationFrame for smooth rendering
        requestAnimationFrame(() => {
            const fragment = document.createDocumentFragment();
            
            pageEvents.forEach(event => {
                const row = this.createEventRow(event);
                fragment.appendChild(row);
            });
            
            tbody.appendChild(fragment);
            
            // Update pagination info
            this.updatePaginationInfo();
            
            // Auto-scroll if enabled
            if (this.autoScroll && this.currentPage === 1) {
                this.scrollToBottom();
            }
        });
    }

    createEventRow(event) {
        const row = document.createElement('tr');
        const session = this.sessions.get(event.sessionId);
        
        row.innerHTML = `
            <td class="col-time">${this.formatTime(event.timestamp)}</td>
            <td class="col-session">
                <div class="event-session">${session ? session.projectName : 'Unknown'}</div>
            </td>
            <td class="col-type">
                <div class="event-type-icon ${event.type}">
                    <span class="material-icons">${this.getEventIcon(event.type)}</span>
                </div>
            </td>
            <td class="col-tool">
                <span class="event-tool">${event.tool || '-'}</span>
            </td>
            <td class="col-details">
                <span class="event-details">${event.details}</span>
            </td>
            <td class="col-duration">
                <span class="event-duration">${event.duration ? `${event.duration}ms` : '-'}</span>
            </td>
        `;
        
        return row;
    }

    getEventIcon(type) {
        const icons = {
            'user_prompt_submit': 'person',
            'pre_tool_use': 'build',
            'post_tool_use': 'check_circle',
            'notification': 'notifications',
            'stop': 'stop',
            'error': 'error'
        };
        return icons[type] || 'help';
    }

    updatePaginationInfo() {
        const totalPages = this.getTotalPages();
        
        document.getElementById('page-info').textContent = `Page ${this.currentPage} of ${totalPages}`;
        document.getElementById('events-shown').textContent = 
            `Showing ${Math.min(this.eventsPerPage, this.events.length)} of ${this.events.length.toLocaleString()} events`;
        
        // Update button states
        document.getElementById('first-page').disabled = this.currentPage === 1;
        document.getElementById('prev-page').disabled = this.currentPage === 1;
        document.getElementById('next-page').disabled = this.currentPage === totalPages;
        document.getElementById('last-page').disabled = this.currentPage === totalPages;
    }

    scrollToBottom() {
        const container = document.getElementById('event-table-container');
        container.scrollTop = container.scrollHeight;
    }

    handleKeyboard(e) {
        // Keyboard shortcuts for power users
        if (e.target.tagName === 'INPUT') return;
        
        switch (e.key) {
            case 'j':
                e.preventDefault();
                this.goToPage(this.currentPage + 1);
                break;
            case 'k':
                e.preventDefault();
                this.goToPage(this.currentPage - 1);
                break;
            case '1':
                e.preventDefault();
                this.filterByStatus('awaiting');
                break;
            case '2':
                e.preventDefault();
                this.filterByStatus('active');
                break;
            case '3':
                e.preventDefault();
                this.filterByStatus('idle');
                break;
            case '/':
                e.preventDefault();
                document.getElementById('session-search').focus();
                break;
        }
    }

    filterByStatus(status) {
        const filter = document.getElementById('status-filter');
        Array.from(filter.options).forEach(option => {
            option.selected = option.value === status;
        });
        this.applyFilters();
    }

    applyFilters() {
        const statusFilter = Array.from(document.getElementById('status-filter').selectedOptions)
            .map(option => option.value);
        const projectFilter = Array.from(document.getElementById('project-filter').selectedOptions)
            .map(option => option.value);
        
        this.filteredSessions = Array.from(this.sessions.values()).filter(session => {
            const statusMatch = statusFilter.length === 0 || statusFilter.includes(session.status);
            const projectMatch = projectFilter.length === 0 || projectFilter.includes(session.projectName);
            return statusMatch && projectMatch;
        });
        
        this.initializeVirtualScrolling();
    }

    startRealTimeUpdates() {
        // Simulate real-time updates with performance optimizations
        setInterval(() => {
            this.simulateEventBatch();
            this.updatePerformanceMetrics();
            this.updateUI();
        }, 2000);
        
        // Update sparkline more frequently
        setInterval(() => {
            this.drawEventSparkline();
        }, 5000);
    }

    simulateEventBatch() {
        // Batch process new events for better performance
        const batchSize = Math.floor(Math.random() * 5) + 1;
        const newEvents = [];
        
        for (let i = 0; i < batchSize; i++) {
            const sessionIds = Array.from(this.sessions.keys());
            const randomSession = sessionIds[Math.floor(Math.random() * sessionIds.length)];
            
            newEvents.push({
                id: `event-${this.events.length + i + 1}`,
                sessionId: randomSession,
                timestamp: new Date(),
                type: ['pre_tool_use', 'post_tool_use', 'notification'][Math.floor(Math.random() * 3)],
                tool: ['Read', 'Edit', 'Bash'][Math.floor(Math.random() * 3)],
                details: this.generateEventDetails(),
                duration: Math.floor(Math.random() * 1000) + 50
            });
        }
        
        // Use worker for processing (simulated)
        this.eventProcessor.postMessage({ events: newEvents });
    }

    handleWorkerMessage(message) {
        if (message.data.type === 'processed') {
            this.events.unshift(...message.data.events);
            this.performanceMetrics.cachedEvents = this.events.length;
            
            // Update queue depth
            this.performanceMetrics.queueDepth = Math.max(0, this.performanceMetrics.queueDepth - message.data.events.length);
            
            // Re-render if on first page and auto-scroll enabled
            if (this.currentPage === 1 && this.autoScroll) {
                this.renderEventFeed(this.events);
            }
        }
    }

    updatePerformanceMetrics() {
        // Simulate performance metrics
        this.performanceMetrics.eventRate = Math.floor(Math.random() * 50) + 100;
        this.performanceMetrics.latency = Math.floor(Math.random() * 20) + 10;
        this.performanceMetrics.memoryUsage = Math.floor(Math.random() * 100) + 200;
        this.performanceMetrics.queueDepth = Math.floor(Math.random() * 20) + 30;
        
        // Update memory warning
        const memoryWarning = document.getElementById('memory-warning');
        if (this.performanceMetrics.memoryUsage > 400) {
            memoryWarning.style.display = 'flex';
        } else {
            memoryWarning.style.display = 'none';
        }
    }

    updateUI() {
        // Update header metrics
        const activeSessions = Array.from(this.sessions.values()).filter(s => s.status === 'active');
        const awaitingSessions = Array.from(this.sessions.values()).filter(s => s.status === 'awaiting');
        
        document.getElementById('active-count').textContent = activeSessions.length;
        document.getElementById('awaiting-count').textContent = awaitingSessions.length;
        document.getElementById('events-per-min').textContent = `${this.performanceMetrics.eventRate}/min`;
        document.getElementById('event-rate').textContent = `${this.performanceMetrics.eventRate}/min`;
        document.getElementById('latency').textContent = `${this.performanceMetrics.latency}ms`;
        
        // Update performance monitor
        this.updatePerformanceMonitor();
    }

    updatePerformanceMonitor() {
        document.getElementById('queue-depth').textContent = this.performanceMetrics.queueDepth;
        document.getElementById('memory-usage').textContent = `${this.performanceMetrics.memoryUsage}MB`;
        document.getElementById('cached-events').textContent = this.performanceMetrics.cachedEvents.toLocaleString();
    }

    drawEventSparkline() {
        const canvas = document.getElementById('event-sparkline');
        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;
        
        // Generate sparkline data (last 20 data points)
        if (!this.sparklineData) {
            this.sparklineData = Array(20).fill(0).map(() => Math.random() * 200 + 50);
        }
        
        // Add new data point
        this.sparklineData.push(this.performanceMetrics.eventRate);
        if (this.sparklineData.length > 20) {
            this.sparklineData.shift();
        }
        
        // Clear canvas
        ctx.clearRect(0, 0, width, height);
        
        // Draw sparkline
        ctx.strokeStyle = '#48bb78';
        ctx.lineWidth = 1;
        ctx.beginPath();
        
        const max = Math.max(...this.sparklineData);
        const min = Math.min(...this.sparklineData);
        const range = max - min || 1;
        
        this.sparklineData.forEach((value, index) => {
            const x = (index / (this.sparklineData.length - 1)) * width;
            const y = height - ((value - min) / range) * height;
            
            if (index === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });
        
        ctx.stroke();
    }

    formatTime(date) {
        return new Intl.DateTimeFormat('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        }).format(new Date(date));
    }

    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.dashboard = new ChronicleScalabilityDashboard();
    console.log('Chronicle Scalability Dashboard initialized');
});