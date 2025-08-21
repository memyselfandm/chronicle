// Chronicle Dashboard - Ultimate Integration JavaScript

class ChronicleUltimateIntegration {
    constructor() {
        // Unified state management
        this.state = {
            // Layout state
            sidebarVisible: true,
            timelineVisible: true,
            compactMode: true, // Default to compact mode
            
            // Filter state (unified across all views)
            activeFilters: {
                search: '',
                eventTypes: new Set(['all']),
                tools: new Set(),
                sessionStates: new Set(['active', 'awaiting', 'idle']),
                timeRange: '1h',
                preset: null
            },
            
            // Selection state
            selectedSessions: new Set(),
            selectedEvent: null,
            
            // Data state
            sessions: new Map(),
            events: [],
            projects: new Map(),
            
            // Performance tracking
            performance: {
                eventRate: 142,
                latency: 24,
                memoryUsage: 247,
                queueDepth: 42
            }
        };

        // Initialize components
        this.initializeComponents();
        this.setupEventListeners();
        this.startDataSimulation();
        this.setupKeyboardShortcuts();
        this.setupResizableHandles();
    }

    initializeComponents() {
        // Get DOM elements
        this.elements = {
            // Layout
            sidebar: document.getElementById('unifiedSidebar'),
            timeline: document.getElementById('unifiedTimeline'),
            content: document.querySelector('.unified-content'),
            
            // Controls
            sidebarToggle: document.getElementById('sidebarToggle'),
            timelineCollapse: document.getElementById('timelineCollapse'),
            filterToggle: document.getElementById('filterToggle'),
            compactToggle: document.getElementById('compactToggle'),
            clearFilters: document.getElementById('clearFilters'),
            
            // Search and filters
            searchInput: document.getElementById('searchInput'),
            searchClear: document.getElementById('searchClear'),
            filterPanel: document.getElementById('filterPanel'),
            activeFilterBadges: document.getElementById('activeFilterBadges'),
            
            // Timeline
            timelineContainer: document.getElementById('timelineContainer'),
            timeMarkers: document.getElementById('timeMarkers'),
            timeRange: document.getElementById('timeRange'),
            jumpToNow: document.getElementById('jumpToNow'),
            
            // Event feed
            eventTableBody: document.getElementById('eventTableBody'),
            eventCount: document.getElementById('eventCount'),
            autoScroll: document.getElementById('autoScroll'),
            
            // Metrics
            activeCount: document.getElementById('activeCount'),
            awaitingCount: document.getElementById('awaitingCount'),
            eventRate: document.getElementById('eventRate'),
            eventSparkline: document.getElementById('eventSparkline'),
            latency: document.getElementById('latency'),
            
            // Help
            helpButton: document.getElementById('helpButton'),
            shortcutsOverlay: document.getElementById('shortcutsOverlay'),
            
            // Session list
            virtualSessions: document.getElementById('virtualSessions')
        };

        // Initialize sparkline canvas
        this.initializeSparkline();
        
        // Generate initial data
        this.generateInitialData();
        this.renderAllViews();
        
        // Apply initial compact mode
        this.applyCompactMode();
    }

    initializeSparkline() {
        const canvas = this.elements.eventSparkline;
        const ctx = canvas.getContext('2d');
        
        // Set up high DPI canvas
        const ratio = window.devicePixelRatio || 1;
        canvas.width = 40 * ratio;
        canvas.height = 16 * ratio;
        canvas.style.width = '40px';
        canvas.style.height = '16px';
        ctx.scale(ratio, ratio);
        
        this.sparklineCtx = ctx;
        this.sparklineData = new Array(20).fill(0).map(() => Math.random() * 100 + 50);
    }

    setupEventListeners() {
        // Layout controls
        this.elements.sidebarToggle?.addEventListener('click', () => this.toggleSidebar());
        this.elements.timelineCollapse?.addEventListener('click', () => this.toggleTimeline());
        this.elements.filterToggle?.addEventListener('click', () => this.toggleFilterPanel());
        this.elements.compactToggle?.addEventListener('click', () => this.toggleCompactMode());
        this.elements.clearFilters?.addEventListener('click', () => this.clearAllFilters());
        
        // Search
        this.elements.searchInput?.addEventListener('input', (e) => this.handleSearch(e.target.value));
        this.elements.searchClear?.addEventListener('click', () => this.clearSearch());
        
        // Timeline controls
        this.elements.timeRange?.addEventListener('change', (e) => this.handleTimeRangeChange(e.target.value));
        this.elements.jumpToNow?.addEventListener('click', () => this.jumpToNow());
        
        // Event feed controls
        this.elements.autoScroll?.addEventListener('click', () => this.toggleAutoScroll());
        
        // Help
        this.elements.helpButton?.addEventListener('click', () => this.toggleHelp());
        this.elements.shortcutsOverlay?.addEventListener('click', (e) => {
            if (e.target === this.elements.shortcutsOverlay) this.toggleHelp();
        });
        
        // Filter presets
        document.querySelectorAll('.preset-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const preset = e.currentTarget.dataset.preset;
                this.applyFilterPreset(preset);
            });
        });
        
        // Session selection
        this.elements.virtualSessions?.addEventListener('click', (e) => {
            const sessionItem = e.target.closest('.session-item');
            if (sessionItem) {
                this.handleSessionClick(sessionItem, e.ctrlKey || e.metaKey);
            }
        });

        // Event table scroll for auto-loading
        this.elements.eventTableBody?.addEventListener('scroll', () => {
            this.handleEventScroll();
        });
    }

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Don't interfere with input fields
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') {
                if (e.key === 'Escape') {
                    e.target.blur();
                    return;
                }
                return;
            }

            switch (e.key) {
                case 'j':
                    e.preventDefault();
                    this.navigateEvents('down');
                    break;
                case 'k':
                    e.preventDefault();
                    this.navigateEvents('up');
                    break;
                case ' ':
                    e.preventDefault();
                    this.jumpToNow();
                    break;
                case '/':
                    e.preventDefault();
                    this.focusSearch();
                    break;
                case '?':
                    e.preventDefault();
                    this.toggleHelp();
                    break;
                case 'Escape':
                    this.closeOverlays();
                    break;
                case '1':
                case '2':
                case '3':
                    e.preventDefault();
                    const presets = ['awaiting', 'active', 'errors'];
                    this.applyFilterPreset(presets[parseInt(e.key) - 1]);
                    break;
            }

            // Ctrl/Cmd combinations
            if (e.ctrlKey || e.metaKey) {
                switch (e.key) {
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
        });
    }

    setupResizableHandles() {
        const sidebarResize = document.getElementById('sidebarResize');
        const timelineResize = document.getElementById('timelineResize');
        
        // Initialize state with current sizes
        this.state.sidebarWidth = 280;
        this.state.timelineHeight = 280;
        
        if (sidebarResize) {
            this.makeResizable(sidebarResize, 'horizontal', (delta) => {
                const currentWidth = this.state.sidebarWidth || 280;
                const newWidth = Math.max(200, Math.min(500, currentWidth + delta));
                this.elements.sidebar.style.width = `${newWidth}px`;
                // Update CSS custom property for consistency
                document.documentElement.style.setProperty('--sidebar-width', `${newWidth}px`);
                this.state.sidebarWidth = newWidth;
            });
        }
        
        if (timelineResize) {
            this.makeResizable(timelineResize, 'vertical', (delta) => {
                const currentHeight = this.state.timelineHeight || 280;
                const newHeight = Math.max(150, Math.min(500, currentHeight + delta));
                this.elements.timeline.style.height = `${newHeight}px`;
                // Update CSS custom property for consistency
                document.documentElement.style.setProperty('--timeline-height', `${newHeight}px`);
                this.state.timelineHeight = newHeight;
            });
        }
    }

    makeResizable(handle, direction, onResize) {
        let isResizing = false;
        let startPosition = 0;
        let initialSize = 0;
        
        handle.addEventListener('mousedown', (e) => {
            e.preventDefault();
            isResizing = true;
            startPosition = direction === 'horizontal' ? e.clientX : e.clientY;
            initialSize = direction === 'horizontal' ? this.state.sidebarWidth : this.state.timelineHeight;
            
            // Set cursor and add class for visual feedback
            document.body.style.cursor = direction === 'horizontal' ? 'col-resize' : 'row-resize';
            document.body.style.userSelect = 'none';
            handle.classList.add('resizing');
        });
        
        document.addEventListener('mousemove', (e) => {
            if (!isResizing) return;
            
            e.preventDefault();
            const currentPosition = direction === 'horizontal' ? e.clientX : e.clientY;
            const delta = currentPosition - startPosition;
            
            // Call resize with the total delta from initial position
            onResize(delta);
        });
        
        document.addEventListener('mouseup', () => {
            if (isResizing) {
                isResizing = false;
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
                handle.classList.remove('resizing');
                
                // Store the final size for next resize operation
                if (direction === 'horizontal') {
                    this.state.sidebarWidth = parseInt(this.elements.sidebar.style.width) || this.state.sidebarWidth;
                } else {
                    this.state.timelineHeight = parseInt(this.elements.timeline.style.height) || this.state.timelineHeight;
                }
            }
        });
        
        // Handle mouse leave to ensure cleanup
        document.addEventListener('mouseleave', () => {
            if (isResizing) {
                isResizing = false;
                document.body.style.cursor = '';
                document.body.style.userSelect = '';
                handle.classList.remove('resizing');
            }
        });
    }

    // Data simulation
    generateInitialData() {
        // Generate sessions
        const projects = ['chronicle-dashboard', 'ai-toolkit', 'data-pipeline', 'web-services'];
        const branches = ['main', 'feature/auth', 'feature/ui', 'hotfix/security', 'develop'];
        const statuses = ['active', 'awaiting', 'idle'];
        
        for (let i = 1; i <= 16; i++) {
            const projectName = projects[Math.floor(Math.random() * projects.length)];
            const branch = branches[Math.floor(Math.random() * branches.length)];
            const status = i <= 3 ? 'awaiting' : (i <= 12 ? 'active' : 'idle');
            
            const session = {
                id: `sess-${i}`,
                project: projectName,
                branch: branch,
                status: status,
                title: this.generateSessionTitle(),
                lastActivity: new Date(Date.now() - Math.random() * 3600000), // Last hour
                currentTool: status === 'active' ? this.getRandomTool() : null
            };
            
            this.state.sessions.set(session.id, session);
            
            // Group by project
            if (!this.state.projects.has(projectName)) {
                this.state.projects.set(projectName, {
                    name: projectName,
                    sessions: [],
                    expanded: true
                });
            }
            this.state.projects.get(projectName).sessions.push(session);
        }
        
        // Generate initial events
        this.generateEvents(50);
    }

    generateSessionTitle() {
        const titles = [
            'Dashboard UI Refactor', 'API Integration', 'Database Migration', 'Authentication Flow',
            'Performance Optimization', 'Unit Tests', 'Documentation Update', 'Bug Fix: Memory Leak',
            'Feature: Dark Mode', 'Refactor: Components', 'Security Update', 'Data Validation'
        ];
        return titles[Math.floor(Math.random() * titles.length)];
    }

    getRandomTool() {
        const tools = ['Read', 'Edit', 'Write', 'Bash', 'Grep', 'Task', 'WebFetch', 'Glob'];
        return tools[Math.floor(Math.random() * tools.length)];
    }

    generateEvents(count) {
        const eventTypes = [
            'user_prompt_submit', 'pre_tool_use', 'post_tool_use', 
            'notification', 'stop', 'error'
        ];
        
        for (let i = 0; i < count; i++) {
            const sessions = Array.from(this.state.sessions.values());
            const session = sessions[Math.floor(Math.random() * sessions.length)];
            const eventType = eventTypes[Math.floor(Math.random() * eventTypes.length)];
            
            const event = {
                id: `evt-${Date.now()}-${i}`,
                timestamp: new Date(Date.now() - (count - i) * 30000), // Last 25 minutes
                sessionId: session.id,
                type: eventType,
                tool: eventType.includes('tool') ? this.getRandomTool() : null,
                details: this.generateEventDetails(eventType),
                duration: eventType === 'post_tool_use' ? Math.random() * 5 : null
            };
            
            this.state.events.push(event);
        }
        
        // Sort by timestamp
        this.state.events.sort((a, b) => b.timestamp - a.timestamp);
    }

    generateEventDetails(eventType) {
        const details = {
            'user_prompt_submit': [
                'Add dark mode toggle to settings',
                'Fix responsive layout issues',
                'Implement search functionality',
                'Optimize database queries'
            ],
            'pre_tool_use': [
                'Reading configuration file',
                'Analyzing code structure',
                'Checking file permissions',
                'Validating input parameters'
            ],
            'post_tool_use': [
                'Successfully updated styles.css',
                'Created new component file',
                'Executed migration script',
                'Generated API documentation'
            ],
            'notification': [
                'Confirm layout changes?',
                'Database migration approval needed',
                'Security policy update required',
                'Code review requested'
            ],
            'error': [
                'Permission denied: /etc/config',
                'Module not found: react-icons',
                'Syntax error in line 42',
                'Network timeout: api.example.com'
            ]
        };
        
        const eventDetails = details[eventType] || ['System event'];
        return eventDetails[Math.floor(Math.random() * eventDetails.length)];
    }

    startDataSimulation() {
        // Update metrics every 5 seconds
        setInterval(() => {
            this.updateMetrics();
            this.updateSparkline();
        }, 5000);
        
        // Add new events periodically
        setInterval(() => {
            this.generateEvents(1);
            this.renderEventFeed();
            this.updateCounts();
        }, 3000);
        
        // Update session statuses
        setInterval(() => {
            this.updateSessionStatuses();
        }, 10000);
    }

    updateMetrics() {
        // Simulate metric changes
        this.state.performance.eventRate = Math.floor(Math.random() * 50) + 120;
        this.state.performance.latency = Math.floor(Math.random() * 20) + 15;
        
        // Update display
        if (this.elements.eventRate) {
            this.elements.eventRate.textContent = this.state.performance.eventRate;
        }
        if (this.elements.latency) {
            this.elements.latency.textContent = `${this.state.performance.latency}ms`;
        }
    }

    updateSparkline() {
        // Add new data point
        this.sparklineData.push(this.state.performance.eventRate);
        if (this.sparklineData.length > 20) {
            this.sparklineData.shift();
        }
        
        // Render sparkline
        const ctx = this.sparklineCtx;
        const width = 40;
        const height = 16;
        
        ctx.clearRect(0, 0, width, height);
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 1;
        ctx.beginPath();
        
        this.sparklineData.forEach((value, index) => {
            const x = (index / (this.sparklineData.length - 1)) * width;
            const y = height - ((value - 100) / 100) * height;
            
            if (index === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });
        
        ctx.stroke();
    }

    updateSessionStatuses() {
        // Randomly update some session statuses
        const sessions = Array.from(this.state.sessions.values());
        sessions.forEach(session => {
            if (Math.random() < 0.1) { // 10% chance to change
                const statuses = ['active', 'idle'];
                if (session.status !== 'awaiting') {
                    session.status = statuses[Math.floor(Math.random() * statuses.length)];
                }
            }
        });
        
        this.renderSessionList();
        this.updateCounts();
    }

    // Filtering methods
    applyFilterPreset(preset) {
        this.state.activeFilters.preset = preset;
        
        // Clear previous filter badges
        document.querySelectorAll('.preset-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelector(`[data-preset="${preset}"]`)?.classList.add('active');
        
        switch (preset) {
            case 'awaiting':
                this.state.activeFilters.sessionStates = new Set(['awaiting']);
                break;
            case 'active':
                this.state.activeFilters.sessionStates = new Set(['active']);
                break;
            case 'errors':
                this.state.activeFilters.eventTypes = new Set(['error']);
                break;
        }
        
        this.updateFilterBadges();
        this.renderAllViews();
    }

    handleSearch(query) {
        this.state.activeFilters.search = query.toLowerCase();
        
        // Show/hide clear button
        if (this.elements.searchClear) {
            this.elements.searchClear.classList.toggle('visible', query.length > 0);
        }
        
        this.renderSessionList();
    }

    clearSearch() {
        this.state.activeFilters.search = '';
        if (this.elements.searchInput) {
            this.elements.searchInput.value = '';
        }
        if (this.elements.searchClear) {
            this.elements.searchClear.classList.remove('visible');
        }
        this.renderSessionList();
    }

    clearAllFilters() {
        this.state.activeFilters = {
            search: '',
            eventTypes: new Set(['all']),
            tools: new Set(),
            sessionStates: new Set(['active', 'awaiting', 'idle']),
            timeRange: '1h',
            preset: null
        };
        
        // Reset UI
        this.clearSearch();
        document.querySelectorAll('.preset-btn').forEach(btn => btn.classList.remove('active'));
        
        this.updateFilterBadges();
        this.renderAllViews();
    }

    updateFilterBadges() {
        const badges = this.elements.activeFilterBadges;
        if (!badges) return;
        
        badges.innerHTML = '';
        
        // Add filter badges based on active filters
        if (this.state.activeFilters.search) {
            this.addFilterBadge(badges, 'search', `Search: ${this.state.activeFilters.search}`);
        }
        
        if (this.state.activeFilters.preset) {
            this.addFilterBadge(badges, 'preset', `Preset: ${this.state.activeFilters.preset}`);
        }
        
        if (this.state.activeFilters.sessionStates.size < 3) {
            const states = Array.from(this.state.activeFilters.sessionStates).join(', ');
            this.addFilterBadge(badges, 'states', `States: ${states}`);
        }
    }

    addFilterBadge(container, type, text) {
        const badge = document.createElement('div');
        badge.className = 'filter-badge';
        badge.innerHTML = `
            <span>${text}</span>
            <button class="badge-remove" data-filter="${type}">
                <span class="material-icons">close</span>
            </button>
        `;
        
        badge.querySelector('.badge-remove').addEventListener('click', () => {
            this.removeFilter(type);
        });
        
        container.appendChild(badge);
    }

    removeFilter(type) {
        switch (type) {
            case 'search':
                this.clearSearch();
                break;
            case 'preset':
                this.state.activeFilters.preset = null;
                document.querySelectorAll('.preset-btn').forEach(btn => btn.classList.remove('active'));
                break;
            case 'states':
                this.state.activeFilters.sessionStates = new Set(['active', 'awaiting', 'idle']);
                break;
        }
        
        this.updateFilterBadges();
        this.renderAllViews();
    }

    // UI interaction methods
    toggleSidebar() {
        this.state.sidebarVisible = !this.state.sidebarVisible;
        this.elements.sidebar?.classList.toggle('collapsed', !this.state.sidebarVisible);
    }

    toggleTimeline() {
        this.state.timelineVisible = !this.state.timelineVisible;
        this.elements.timeline?.classList.toggle('collapsed', !this.state.timelineVisible);
    }

    toggleFilterPanel() {
        const panel = this.elements.filterPanel;
        if (panel) {
            panel.classList.toggle('expanded');
            this.elements.filterToggle?.classList.toggle('active');
        }
    }

    toggleCompactMode() {
        this.state.compactMode = !this.state.compactMode;
        this.elements.compactToggle?.classList.toggle('active', this.state.compactMode);
        this.applyCompactMode();
    }

    applyCompactMode() {
        document.querySelectorAll('.session-item').forEach(item => {
            item.classList.toggle('compact', this.state.compactMode);
        });
    }

    toggleAutoScroll() {
        this.state.autoScroll = !this.state.autoScroll;
        this.elements.autoScroll?.classList.toggle('active', this.state.autoScroll);
    }

    toggleHelp() {
        this.elements.shortcutsOverlay?.classList.toggle('visible');
    }

    closeOverlays() {
        this.elements.shortcutsOverlay?.classList.remove('visible');
        this.elements.filterPanel?.classList.remove('expanded');
        this.elements.filterToggle?.classList.remove('active');
    }

    focusSearch() {
        this.elements.searchInput?.focus();
    }

    jumpToNow() {
        // Scroll timeline to current time
        // Scroll event feed to top if auto-scroll is on
        if (this.state.autoScroll && this.elements.eventTableBody) {
            this.elements.eventTableBody.scrollTop = 0;
        }
    }

    // Navigation methods
    navigateEvents(direction) {
        const events = document.querySelectorAll('.event-row');
        const currentIndex = Array.from(events).findIndex(row => row.classList.contains('selected'));
        
        let newIndex;
        if (direction === 'down') {
            newIndex = currentIndex < events.length - 1 ? currentIndex + 1 : 0;
        } else {
            newIndex = currentIndex > 0 ? currentIndex - 1 : events.length - 1;
        }
        
        // Remove previous selection
        events.forEach(row => row.classList.remove('selected'));
        
        // Add new selection
        if (events[newIndex]) {
            events[newIndex].classList.add('selected');
            events[newIndex].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }

    handleSessionClick(sessionItem, multiSelect) {
        const sessionId = sessionItem.dataset.session;
        
        if (!multiSelect) {
            // Single select
            this.state.selectedSessions.clear();
            document.querySelectorAll('.session-item').forEach(item => {
                item.classList.remove('selected');
            });
        }
        
        if (this.state.selectedSessions.has(sessionId)) {
            this.state.selectedSessions.delete(sessionId);
            sessionItem.classList.remove('selected');
        } else {
            this.state.selectedSessions.add(sessionId);
            sessionItem.classList.add('selected');
        }
        
        this.renderEventFeed(); // Filter events by selected sessions
    }

    handleEventScroll() {
        const tbody = this.elements.eventTableBody;
        if (!tbody) return;
        
        // Check if near bottom for auto-loading
        const scrollPosition = tbody.scrollTop + tbody.clientHeight;
        const scrollHeight = tbody.scrollHeight;
        
        if (scrollPosition >= scrollHeight - 100) {
            // Load more events
            this.generateEvents(25);
            this.renderEventFeed();
        }
    }

    // Rendering methods
    renderAllViews() {
        this.renderSessionList();
        this.renderTimeline();
        this.renderEventFeed();
        this.updateCounts();
    }

    renderSessionList() {
        const container = this.elements.virtualSessions;
        if (!container) return;
        
        container.innerHTML = '';
        
        // Filter and group sessions
        const filteredProjects = this.filterProjects();
        
        filteredProjects.forEach(project => {
            const projectElement = this.createProjectElement(project);
            container.appendChild(projectElement);
        });
    }

    filterProjects() {
        const filtered = new Map();
        
        this.state.projects.forEach((project, name) => {
            const filteredSessions = project.sessions.filter(session => {
                // Apply search filter
                if (this.state.activeFilters.search) {
                    const searchLower = this.state.activeFilters.search;
                    if (!session.title.toLowerCase().includes(searchLower) &&
                        !session.project.toLowerCase().includes(searchLower) &&
                        !session.branch.toLowerCase().includes(searchLower)) {
                        return false;
                    }
                }
                
                // Apply status filter
                if (!this.state.activeFilters.sessionStates.has(session.status)) {
                    return false;
                }
                
                return true;
            });
            
            if (filteredSessions.length > 0) {
                filtered.set(name, {
                    ...project,
                    sessions: filteredSessions
                });
            }
        });
        
        return filtered;
    }

    createProjectElement(project) {
        const projectDiv = document.createElement('div');
        projectDiv.className = 'project-group';
        if (!project.expanded) projectDiv.classList.add('collapsed');
        
        const awaitingSessions = project.sessions.filter(s => s.status === 'awaiting');
        const activeSessions = project.sessions.filter(s => s.status === 'active');
        
        projectDiv.innerHTML = `
            <div class="group-header">
                <span class="material-icons expand-icon">${project.expanded ? 'keyboard_arrow_down' : 'keyboard_arrow_right'}</span>
                <span class="material-icons project-icon">folder</span>
                <span class="project-name">${project.name}</span>
                <span class="session-count">${project.sessions.length}</span>
            </div>
            <div class="group-sessions">
                ${project.sessions.map(session => this.createSessionElement(session)).join('')}
            </div>
        `;
        
        // Add click handler for project header
        const header = projectDiv.querySelector('.group-header');
        header.addEventListener('click', () => {
            project.expanded = !project.expanded;
            projectDiv.classList.toggle('collapsed');
            header.querySelector('.expand-icon').textContent = 
                project.expanded ? 'keyboard_arrow_down' : 'keyboard_arrow_right';
        });
        
        return projectDiv;
    }

    createSessionElement(session) {
        const isSelected = this.state.selectedSessions.has(session.id);
        const timeAgo = this.getTimeAgo(session.lastActivity);
        const activityIcon = this.getActivityIcon(session);
        
        return `
            <div class="session-item ${session.status} ${isSelected ? 'selected' : ''} ${this.state.compactMode ? 'compact' : ''}" 
                 data-session="${session.id}">
                <div class="session-status-indicator ${session.status}"></div>
                <div class="session-content">
                    <div class="session-title">${session.title}</div>
                    <div class="session-meta">
                        <span class="branch">${session.branch}</span>
                        <span class="last-activity">${timeAgo}</span>
                        <span class="activity-icon">${activityIcon}</span>
                    </div>
                </div>
            </div>
        `;
    }

    getTimeAgo(date) {
        const now = new Date();
        const diff = now - date;
        const minutes = Math.floor(diff / 60000);
        
        if (minutes < 1) return 'active';
        if (minutes < 60) return `${minutes}m ago`;
        
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h ago`;
        
        const days = Math.floor(hours / 24);
        return `${days}d ago`;
    }

    getActivityIcon(session) {
        if (session.status === 'awaiting') {
            return '<span class="material-icons pulse">notifications_active</span>';
        } else if (session.status === 'active' && session.currentTool) {
            const iconMap = {
                'Read': 'description',
                'Edit': 'edit',
                'Write': 'create',
                'Bash': 'terminal',
                'Grep': 'search',
                'Task': 'assignment',
                'WebFetch': 'language',
                'Glob': 'folder_open'
            };
            const icon = iconMap[session.currentTool] || 'play_circle';
            return `<span class="material-icons pulse">${icon}</span>`;
        }
        return '';
    }

    renderTimeline() {
        // Render swimlanes for selected sessions or all if none selected
        const sessions = this.state.selectedSessions.size > 0 
            ? Array.from(this.state.selectedSessions).map(id => this.state.sessions.get(id)).filter(Boolean)
            : Array.from(this.state.sessions.values()).slice(0, 8); // Limit for performance
        
        const container = this.elements.timelineContainer?.querySelector('.swimlanes-container');
        if (!container) return;
        
        container.innerHTML = sessions.map(session => this.createSwimlaneElement(session)).join('');
        
        // Update time markers
        this.updateTimeMarkers();
    }

    createSwimlaneElement(session) {
        const events = this.getSessionEvents(session.id);
        const markers = events.map(event => this.createEventMarker(event)).join('');
        
        return `
            <div class="swimlane" data-session="${session.id}">
                <div class="swimlane-label">
                    <span class="session-indicator ${session.status}"></span>
                    <span class="session-name">${session.title}</span>
                    <canvas class="session-sparkline" width="30" height="12"></canvas>
                </div>
                <div class="swimlane-track">
                    ${markers}
                </div>
            </div>
        `;
    }

    getSessionEvents(sessionId) {
        return this.state.events.filter(event => event.sessionId === sessionId).slice(0, 10);
    }

    createEventMarker(event) {
        const position = this.getEventPosition(event.timestamp);
        const icon = this.getEventIcon(event);
        const classes = ['event-marker', event.type];
        
        if (this.isCurrentEvent(event)) {
            classes.push('current', 'pulse');
        }
        
        return `
            <div class="${classes.join(' ')}" style="left: ${position}%" 
                 title="${event.details}" data-event="${event.id}">
                <span class="material-icons">${icon}</span>
            </div>
        `;
    }

    getEventPosition(timestamp) {
        // Calculate position based on time range
        const now = new Date();
        const timeRange = this.state.activeFilters.timeRange;
        const rangeMs = this.getTimeRangeMs(timeRange);
        const elapsed = now - timestamp;
        
        return Math.max(0, Math.min(100, 100 - (elapsed / rangeMs) * 100));
    }

    getTimeRangeMs(range) {
        const ranges = {
            '5m': 5 * 60 * 1000,
            '15m': 15 * 60 * 1000,
            '1h': 60 * 60 * 1000,
            '4h': 4 * 60 * 60 * 1000
        };
        return ranges[range] || ranges['1h'];
    }

    getEventIcon(event) {
        const iconMap = {
            'user_prompt_submit': 'chat',
            'pre_tool_use': 'play_arrow',
            'post_tool_use': 'check_circle',
            'notification': 'notifications_active',
            'error': 'error',
            'stop': 'stop'
        };
        return iconMap[event.type] || 'circle';
    }

    isCurrentEvent(event) {
        const now = new Date();
        return (now - event.timestamp) < 60000; // Within last minute
    }

    updateTimeMarkers() {
        const markers = this.elements.timeMarkers;
        if (!markers) return;
        
        const now = new Date();
        const range = this.getTimeRangeMs(this.state.activeFilters.timeRange);
        const intervals = 5; // Number of time markers
        
        markers.innerHTML = '';
        
        for (let i = 0; i <= intervals; i++) {
            const time = new Date(now - (range / intervals) * i);
            const marker = document.createElement('div');
            marker.className = 'time-marker';
            marker.style.left = `${(i / intervals) * 100}%`;
            marker.textContent = time.toLocaleTimeString('en-US', { 
                hour12: false, 
                hour: '2-digit', 
                minute: '2-digit' 
            });
            markers.appendChild(marker);
        }
    }

    renderEventFeed() {
        const tbody = this.elements.eventTableBody;
        if (!tbody) return;
        
        // Filter events
        const filteredEvents = this.filterEvents();
        
        // Render events (limit for performance)
        const eventsToRender = filteredEvents.slice(0, 100);
        
        tbody.innerHTML = eventsToRender.map(event => this.createEventRow(event)).join('');
        
        // Update event count
        if (this.elements.eventCount) {
            this.elements.eventCount.textContent = `(${filteredEvents.length} events)`;
        }
    }

    filterEvents() {
        return this.state.events.filter(event => {
            // Filter by selected sessions
            if (this.state.selectedSessions.size > 0 && 
                !this.state.selectedSessions.has(event.sessionId)) {
                return false;
            }
            
            // Filter by event types
            if (!this.state.activeFilters.eventTypes.has('all') &&
                !this.state.activeFilters.eventTypes.has(event.type)) {
                return false;
            }
            
            // Filter by time range
            const rangeMs = this.getTimeRangeMs(this.state.activeFilters.timeRange);
            const now = new Date();
            if (now - event.timestamp > rangeMs) {
                return false;
            }
            
            return true;
        });
    }

    createEventRow(event) {
        const session = this.state.sessions.get(event.sessionId);
        if (!session) return '';
        
        const isRunning = event.type === 'pre_tool_use' && !this.hasMatchingPostEvent(event);
        const classes = ['event-row'];
        
        if (isRunning) classes.push('running');
        if (event.type === 'notification') classes.push('current');
        
        const duration = event.duration ? `${event.duration.toFixed(1)}s` : 
                        isRunning ? '<span class="duration-running">running...</span>' : '-';
        
        return `
            <div class="${classes.join(' ')}" data-event="${event.id}" data-type="${event.type}">
                <div class="col-time">${event.timestamp.toLocaleTimeString('en-US', { hour12: false })}</div>
                <div class="col-session">
                    <span class="session-indicator ${session.status}"></span>
                    <span class="session-name">${session.title}</span>
                </div>
                <div class="col-type">
                    <span class="material-icons type-icon ${event.type}">${this.getEventIcon(event)}</span>
                    <span class="type-label">${this.getEventTypeLabel(event.type)}</span>
                </div>
                <div class="col-tool">
                    ${event.tool ? `<span class="material-icons">${this.getToolIcon(event.tool)}</span><span>${event.tool}</span>` : '-'}
                </div>
                <div class="col-details">${event.details}</div>
                <div class="col-duration">${duration}</div>
            </div>
        `;
    }

    hasMatchingPostEvent(preEvent) {
        return this.state.events.some(event => 
            event.sessionId === preEvent.sessionId &&
            event.type === 'post_tool_use' &&
            event.tool === preEvent.tool &&
            event.timestamp > preEvent.timestamp
        );
    }

    getEventTypeLabel(type) {
        const labels = {
            'user_prompt_submit': 'User Prompt',
            'pre_tool_use': 'Tool Start',
            'post_tool_use': 'Tool Complete',
            'notification': 'Notification',
            'error': 'Error',
            'stop': 'Session Stop'
        };
        return labels[type] || type;
    }

    getToolIcon(tool) {
        const iconMap = {
            'Read': 'description',
            'Edit': 'edit',
            'Write': 'create',
            'Bash': 'terminal',
            'Grep': 'search',
            'Task': 'assignment',
            'WebFetch': 'language',
            'Glob': 'folder_open'
        };
        return iconMap[tool] || 'build';
    }

    updateCounts() {
        const activeSessions = Array.from(this.state.sessions.values()).filter(s => s.status === 'active');
        const awaitingSessions = Array.from(this.state.sessions.values()).filter(s => s.status === 'awaiting');
        
        if (this.elements.activeCount) {
            this.elements.activeCount.textContent = activeSessions.length;
        }
        if (this.elements.awaitingCount) {
            this.elements.awaitingCount.textContent = awaitingSessions.length;
        }
    }

    handleTimeRangeChange(range) {
        this.state.activeFilters.timeRange = range;
        this.renderTimeline();
        this.renderEventFeed();
    }
}

// Initialize the dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.chronicleDashboard = new ChronicleUltimateIntegration();
});