/**
 * Chronicle Dashboard - Variant 5: Best of Breed Synthesis
 * Combines the best elements from Variants 1-4 into the ultimate dashboard
 */

class ChronicleUltimateDashboard {
    constructor() {
        // Core state (from V1)
        this.sessions = new Map();
        this.events = [];
        this.selectedSessions = new Set();
        this.eventTypeIcons = {
            session_start: 'play_arrow',
            user_prompt_submit: 'chat',
            pre_tool_use: 'build',
            post_tool_use: 'check_circle',
            notification: 'notification_important',
            stop: 'stop',
            subagent_stop: 'stop_circle',
            pre_compact: 'compress',
            error: 'error'
        };

        // Enhanced filtering state (from V3)
        this.filters = {
            search: '',
            eventTypes: new Set(['session_start', 'user_prompt_submit', 'pre_tool_use', 'post_tool_use', 'notification', 'stop', 'subagent_stop', 'pre_compact', 'error']),
            sessions: new Set(),
            presets: {
                awaiting: { eventTypes: new Set(['notification']), sessions: new Set() },
                errors: { eventTypes: new Set(['error']), sessions: new Set() },
                active: { eventTypes: new Set(['user_prompt_submit', 'pre_tool_use', 'post_tool_use']), sessions: new Set() },
                'high-activity': { eventTypes: new Set(['pre_tool_use', 'post_tool_use']), sessions: new Set() }
            }
        };

        // Performance monitoring (from V4)
        this.performance = {
            eventRate: 0,
            latency: 24,
            memoryUsage: 0,
            eventTimes: [],
            sparklineData: []
        };

        // Enhanced timeline state (from V2)
        this.timeline = {
            zoomLevel: '5m',
            currentTime: Date.now(),
            height: 280,
            collapsed: false
        };

        // Virtual scrolling (from V4)
        this.virtualScroll = {
            enabled: false,
            itemHeight: 44,
            visibleItems: 15,
            scrollTop: 0,
            totalHeight: 0
        };

        // UI state
        this.ui = {
            sidebarCollapsed: false,
            compactMode: false,
            autoScroll: true,
            paused: false,
            shortcutsVisible: false
        };

        this.init();
    }

    init() {
        this.setupEventListeners();
        this.generateInitialData();
        this.startRealTimeUpdates();
        this.startPerformanceMonitoring();
        this.updateFilterButtonText();
        this.render();
    }

    setupEventListeners() {
        // Sidebar toggle (from V1)
        document.getElementById('sidebarToggle').addEventListener('click', () => {
            this.toggleSidebar();
        });

        // Search functionality (from V3)
        const searchInput = document.getElementById('sessionSearch');
        searchInput.addEventListener('input', (e) => {
            this.filters.search = e.target.value;
            this.updateSearchClear();
            this.renderSessions();
        });

        searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                e.target.value = '';
                this.filters.search = '';
                this.updateSearchClear();
                this.renderSessions();
            }
        });

        document.getElementById('searchClear').addEventListener('click', () => {
            searchInput.value = '';
            this.filters.search = '';
            this.updateSearchClear();
            this.renderSessions();
        });

        // Filter presets (from V3)
        document.getElementById('filterPresetsBtn').addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleFilterPresets();
        });

        document.querySelectorAll('.preset-option').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const preset = e.target.dataset.preset;
                this.applyFilterPreset(preset);
                this.hideFilterPresets();
            });
        });

        // Compact mode toggle (from V4)
        document.getElementById('compactToggle').addEventListener('click', () => {
            this.toggleCompactMode();
        });

        // Bulk actions (from V4)
        document.getElementById('bulkActions').addEventListener('click', () => {
            this.showBulkActionsMenu();
        });

        // Timeline controls (from V2)
        document.querySelectorAll('.zoom-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.setTimelineZoom(e.target.dataset.zoom);
            });
        });

        document.getElementById('jumpToNow').addEventListener('click', () => {
            this.jumpToNow();
        });

        document.getElementById('timelineToggle').addEventListener('click', () => {
            this.toggleTimeline();
        });

        // Event type filter (from V3)
        document.getElementById('eventTypeFilterBtn').addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleEventTypeFilter();
        });

        document.querySelectorAll('.filter-option input[type="checkbox"]').forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                this.updateEventTypeFilter(e.target.id, e.target.checked);
            });
        });

        // Auto-scroll and pause controls
        document.getElementById('autoScrollToggle').addEventListener('click', () => {
            this.toggleAutoScroll();
        });

        document.getElementById('pauseToggle').addEventListener('click', () => {
            this.togglePause();
        });

        // Clear all filters (from V3)
        document.getElementById('clearAllFilters').addEventListener('click', () => {
            this.clearAllFilters();
        });

        // Keyboard shortcuts (from V3)
        document.getElementById('helpToggle').addEventListener('click', () => {
            this.toggleShortcuts();
        });

        // Global keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            this.handleKeyboardShortcuts(e);
        });

        // Click outside handlers
        document.addEventListener('click', (e) => {
            this.handleClickOutside(e);
        });

        // Virtual scrolling (from V4)
        document.getElementById('virtualScrollContainer').addEventListener('scroll', () => {
            this.handleVirtualScroll();
        });
    }

    // Enhanced timeline functionality (from V2)
    setTimelineZoom(level) {
        this.timeline.zoomLevel = level;
        document.querySelectorAll('.zoom-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.zoom === level);
        });
        this.renderTimeline();
    }

    jumpToNow() {
        this.timeline.currentTime = Date.now();
        this.renderTimeline();
        if (this.ui.autoScroll) {
            this.scrollToBottom();
        }
    }

    toggleTimeline() {
        this.timeline.collapsed = !this.timeline.collapsed;
        const section = document.getElementById('timelineSection');
        section.classList.toggle('collapsed', this.timeline.collapsed);
        
        const icon = document.querySelector('#timelineToggle .material-icons');
        icon.textContent = this.timeline.collapsed ? 'expand_more' : 'expand_less';
    }

    // Advanced filtering (from V3)
    toggleFilterPresets() {
        const dropdown = document.getElementById('filterPresetsDropdown');
        dropdown.classList.toggle('visible');
    }

    hideFilterPresets() {
        document.getElementById('filterPresetsDropdown').classList.remove('visible');
    }

    applyFilterPreset(presetName) {
        if (presetName === 'clear') {
            this.clearAllFilters();
            return;
        }

        const preset = this.filters.presets[presetName];
        if (!preset) return;

        // Apply preset filters
        this.filters.eventTypes = new Set(preset.eventTypes);
        this.filters.sessions = new Set(preset.sessions);

        // Update UI
        this.updateEventTypeCheckboxes();
        this.renderFilterBadges();
        this.renderEvents();
        this.renderSessions();
    }

    updateEventTypeFilter(eventType, checked) {
        if (checked) {
            this.filters.eventTypes.add(eventType);
        } else {
            this.filters.eventTypes.delete(eventType);
        }
        this.updateFilterButtonText();
        this.renderFilterBadges();
        this.renderEvents();
    }

    updateEventTypeCheckboxes() {
        document.querySelectorAll('.filter-option input[type="checkbox"]').forEach(checkbox => {
            checkbox.checked = this.filters.eventTypes.has(checkbox.id);
        });
        this.updateFilterButtonText();
    }

    toggleEventTypeFilter() {
        const dropdown = document.getElementById('eventTypeDropdown');
        dropdown.classList.toggle('visible');
    }

    clearAllFilters() {
        this.filters.search = '';
        this.filters.eventTypes = new Set(['session_start', 'user_prompt_submit', 'pre_tool_use', 'post_tool_use', 'notification', 'stop', 'subagent_stop', 'pre_compact', 'error']);
        this.filters.sessions = new Set();
        
        document.getElementById('sessionSearch').value = '';
        this.updateEventTypeCheckboxes();
        this.updateSearchClear();
        this.updateFilterButtonText();
        this.renderFilterBadges();
        this.renderEvents();
        this.renderSessions();
    }

    renderFilterBadges() {
        const container = document.getElementById('filterBadges');
        const clearBtn = document.getElementById('clearAllFilters');
        
        let badges = [];
        
        // Search badge
        if (this.filters.search) {
            badges.push(`Search: "${this.filters.search}"`);
        }
        
        // Event type badges
        const allEventTypes = new Set(['session_start', 'user_prompt_submit', 'pre_tool_use', 'post_tool_use', 'notification', 'stop', 'subagent_stop', 'pre_compact', 'error']);
        if (this.filters.eventTypes.size < allEventTypes.size) {
            badges.push(`Event Types: ${this.filters.eventTypes.size}/${allEventTypes.size}`);
        }
        
        // Session badges
        if (this.filters.sessions.size > 0) {
            badges.push(`Sessions: ${this.filters.sessions.size}`);
        }
        
        container.innerHTML = badges.map((badge, index) => 
            `<div class="filter-badge">
                ${badge}
                <button class="remove-badge" onclick="window.dashboard.removeBadge('${badge.split(':')[0].toLowerCase().replace(' ', '')}')">
                    <span class="material-icons" style="font-size: 12px;">close</span>
                </button>
            </div>`
        ).join('');
        
        clearBtn.style.display = badges.length > 0 ? 'flex' : 'none';
    }

    removeBadge(type) {
        switch(type) {
            case 'search':
                this.filters.search = '';
                document.getElementById('sessionSearch').value = '';
                this.updateSearchClear();
                break;
            case 'eventtypes':
                this.filters.eventTypes = new Set(['session_start', 'user_prompt_submit', 'pre_tool_use', 'post_tool_use', 'notification', 'stop', 'subagent_stop', 'pre_compact', 'error']);
                this.updateEventTypeCheckboxes();
                break;
            case 'sessions':
                this.filters.sessions = new Set();
                break;
        }
        this.renderFilterBadges();
        this.renderEvents();
        this.renderSessions();
    }

    // Virtual scrolling and scalability features (from V4)
    toggleCompactMode() {
        this.ui.compactMode = !this.ui.compactMode;
        const button = document.getElementById('compactToggle');
        button.classList.toggle('active', this.ui.compactMode);
        
        // Update icon and title to show what compact mode does
        const icon = button.querySelector('.material-icons');
        const title = this.ui.compactMode ? 'Exit Compact Mode (reduces padding and spacing)' : 'Enter Compact Mode (reduces padding and spacing)';
        button.title = title;
        icon.textContent = this.ui.compactMode ? 'view_comfortable' : 'view_list';
        
        this.virtualScroll.itemHeight = this.ui.compactMode ? 36 : 44;
        this.renderSessions();
    }

    showBulkActionsMenu() {
        // Implement bulk actions menu
        const awaitingSessions = Array.from(this.sessions.values()).filter(s => s.status === 'awaiting');
        console.log(`Bulk actions: ${awaitingSessions.length} awaiting sessions`);
    }

    handleVirtualScroll() {
        if (!this.virtualScroll.enabled) return;
        
        const container = document.getElementById('virtualScrollContainer');
        this.virtualScroll.scrollTop = container.scrollTop;
        this.renderSessions();
    }

    enableVirtualScrolling() {
        this.virtualScroll.enabled = this.sessions.size > 20;
        if (this.virtualScroll.enabled) {
            this.virtualScroll.totalHeight = this.sessions.size * this.virtualScroll.itemHeight;
        }
    }

    // Performance monitoring (from V4)
    startPerformanceMonitoring() {
        setInterval(() => {
            this.updatePerformanceMetrics();
            this.renderSparkline();
            this.checkMemoryUsage();
        }, 1000);
    }

    updatePerformanceMetrics() {
        const now = Date.now();
        
        // Calculate event rate
        this.performance.eventTimes = this.performance.eventTimes.filter(time => now - time < 60000);
        this.performance.eventRate = this.performance.eventTimes.length;
        
        // Update sparkline data
        if (this.performance.sparklineData.length >= 60) {
            this.performance.sparklineData.shift();
        }
        this.performance.sparklineData.push(this.performance.eventRate);
        
        // Update UI
        document.getElementById('eventRate').textContent = `${this.performance.eventRate}/min`;
        document.getElementById('latency').textContent = `${this.performance.latency}ms`;
    }

    renderSparkline() {
        const canvas = document.getElementById('eventSparkline');
        const ctx = canvas.getContext('2d');
        const data = this.performance.sparklineData;
        
        if (data.length < 2) return;
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 1;
        
        const max = Math.max(...data, 1);
        const step = canvas.width / (data.length - 1);
        
        ctx.beginPath();
        data.forEach((value, index) => {
            const x = index * step;
            const y = canvas.height - (value / max) * canvas.height;
            if (index === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });
        ctx.stroke();
    }

    checkMemoryUsage() {
        if ('memory' in performance) {
            const memoryMB = performance.memory.usedJSHeapSize / 1024 / 1024;
            this.performance.memoryUsage = memoryMB;
            
            const warning = document.getElementById('memoryWarning');
            if (memoryMB > 400) {
                warning.style.display = 'flex';
            } else {
                warning.style.display = 'none';
            }
        }
    }

    // Core functionality (from V1)
    generateInitialData() {
        const projects = [
            { name: 'ai-workspace/claude-tools', branch: 'main' },
            { name: 'enterprise/dashboard', branch: 'feature/monitoring' },
            { name: 'research/experiments', branch: 'dev' },
            { name: 'api/chronicle-service', branch: 'main' },
            { name: 'frontend/react-app', branch: 'develop' }
        ];

        // Generate 15-25 sessions
        const sessionCount = 15 + Math.floor(Math.random() * 10);
        for (let i = 0; i < sessionCount; i++) {
            const project = projects[Math.floor(Math.random() * projects.length)];
            const sessionId = `session_${Date.now()}_${i}`;
            const startTime = Date.now() - Math.random() * 3600000;
            
            const statuses = ['active', 'awaiting', 'idle'];
            const weights = [0.4, 0.2, 0.4]; // 40% active, 20% awaiting, 40% idle
            const status = this.weightedRandom(statuses, weights);
            
            this.sessions.set(sessionId, {
                id: sessionId,
                project: project.name,
                branch: project.branch,
                status: status,
                startTime: startTime,
                lastActivity: startTime + Math.random() * 1800000,
                currentTool: status === 'active' ? this.getRandomTool() : null,
                eventCount: Math.floor(Math.random() * 50) + 10
            });
        }

        // Generate initial events
        this.generateRecentEvents();
    }

    generateRecentEvents() {
        const eventTypes = Object.keys(this.eventTypeIcons);
        const sessions = Array.from(this.sessions.keys());
        
        // Generate 50-100 recent events
        const eventCount = 50 + Math.floor(Math.random() * 50);
        for (let i = 0; i < eventCount; i++) {
            const sessionId = sessions[Math.floor(Math.random() * sessions.length)];
            const eventType = eventTypes[Math.floor(Math.random() * eventTypes.length)];
            const timestamp = Date.now() - Math.random() * 1800000; // Last 30 minutes
            
            this.events.push({
                id: `event_${timestamp}_${i}`,
                sessionId: sessionId,
                type: eventType,
                timestamp: timestamp,
                details: this.generateEventDetails(eventType, sessionId),
                tool: eventType.includes('tool') ? this.getRandomTool() : null
            });
        }
        
        this.events.sort((a, b) => b.timestamp - a.timestamp);
    }

    startRealTimeUpdates() {
        setInterval(() => {
            if (!this.ui.paused) {
                this.generateNewEvent();
                this.updateSessionActivity();
                this.render();
            }
        }, 2000 + Math.random() * 3000); // 2-5 second intervals
    }

    generateNewEvent() {
        const sessions = Array.from(this.sessions.keys());
        const eventTypes = Object.keys(this.eventTypeIcons);
        
        const sessionId = sessions[Math.floor(Math.random() * sessions.length)];
        const eventType = eventTypes[Math.floor(Math.random() * eventTypes.length)];
        const timestamp = Date.now();
        
        const event = {
            id: `event_${timestamp}_${Math.random()}`,
            sessionId: sessionId,
            type: eventType,
            timestamp: timestamp,
            details: this.generateEventDetails(eventType, sessionId),
            tool: eventType.includes('tool') ? this.getRandomTool() : null
        };
        
        this.events.unshift(event);
        this.performance.eventTimes.push(timestamp);
        
        // Update session status based on event
        const session = this.sessions.get(sessionId);
        if (session) {
            session.lastActivity = timestamp;
            if (eventType === 'notification') {
                session.status = 'awaiting';
            } else if (eventType.includes('tool')) {
                session.status = 'active';
                session.currentTool = event.tool;
            }
        }
        
        // Limit events to prevent memory issues
        if (this.events.length > 1000) {
            this.events = this.events.slice(0, 500);
        }
    }

    updateSessionActivity() {
        // Update session statuses occasionally
        const sessions = Array.from(this.sessions.values());
        sessions.forEach(session => {
            if (Math.random() < 0.1) { // 10% chance per update
                const statuses = ['active', 'awaiting', 'idle'];
                const weights = [0.3, 0.2, 0.5];
                session.status = this.weightedRandom(statuses, weights);
                session.lastActivity = Date.now();
            }
        });
    }

    generateEventDetails(eventType, sessionId) {
        const session = this.sessions.get(sessionId);
        const details = {
            session_start: `Started new session for ${session?.project || 'unknown'}`,
            user_prompt_submit: 'User submitted a new request',
            pre_tool_use: `About to execute tool`,
            post_tool_use: `Tool execution completed`,
            notification: 'Awaiting user input',
            stop: 'Session completed successfully',
            subagent_stop: 'Sub-agent task completed',
            pre_compact: 'Preparing context compaction',
            error: 'Execution error occurred'
        };
        
        return details[eventType] || 'Unknown event';
    }

    getRandomTool() {
        const tools = ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'WebSearch', 'Task'];
        return tools[Math.floor(Math.random() * tools.length)];
    }

    weightedRandom(items, weights) {
        const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
        let random = Math.random() * totalWeight;
        
        for (let i = 0; i < items.length; i++) {
            random -= weights[i];
            if (random <= 0) {
                return items[i];
            }
        }
        
        return items[items.length - 1];
    }

    // UI Controls
    toggleSidebar() {
        this.ui.sidebarCollapsed = !this.ui.sidebarCollapsed;
        document.getElementById('sidebar').classList.toggle('collapsed', this.ui.sidebarCollapsed);
    }

    toggleAutoScroll() {
        this.ui.autoScroll = !this.ui.autoScroll;
        document.getElementById('autoScrollToggle').classList.toggle('active', this.ui.autoScroll);
    }

    togglePause() {
        this.ui.paused = !this.ui.paused;
        const button = document.getElementById('pauseToggle');
        button.classList.toggle('active', this.ui.paused);
        button.querySelector('.material-icons').textContent = this.ui.paused ? 'play_arrow' : 'pause';
    }

    toggleShortcuts() {
        this.ui.shortcutsVisible = !this.ui.shortcutsVisible;
        document.getElementById('shortcutsPanel').classList.toggle('visible', this.ui.shortcutsVisible);
    }

    updateSearchClear() {
        const clearBtn = document.getElementById('searchClear');
        clearBtn.style.display = this.filters.search ? 'block' : 'none';
    }

    // Keyboard shortcuts (from V3)
    handleKeyboardShortcuts(e) {
        // Ignore if typing in input
        if (e.target.tagName === 'INPUT') {
            if (e.key === '/') {
                e.preventDefault();
                document.getElementById('sessionSearch').focus();
            }
            return;
        }

        switch(e.key) {
            case '?':
                e.preventDefault();
                this.toggleShortcuts();
                break;
            case 'Escape':
                this.ui.shortcutsVisible = false;
                document.getElementById('shortcutsPanel').classList.remove('visible');
                break;
            case '/':
                e.preventDefault();
                document.getElementById('sessionSearch').focus();
                break;
            case ' ':
                e.preventDefault();
                this.jumpToNow();
                break;
            case '1':
            case '2':
            case '3':
            case '4':
            case '5':
                if (!e.ctrlKey && !e.altKey) {
                    e.preventDefault();
                    const presets = ['awaiting', 'errors', 'active', 'high-activity', 'clear'];
                    const preset = presets[parseInt(e.key) - 1];
                    if (preset) {
                        this.applyFilterPreset(preset);
                    }
                }
                break;
        }

        if (e.ctrlKey || e.metaKey) {
            switch(e.key) {
                case 'b':
                    e.preventDefault();
                    this.toggleSidebar();
                    break;
                case 't':
                    e.preventDefault();
                    this.toggleTimeline();
                    break;
            }
        }

        if (e.altKey) {
            switch(e.key) {
                case 'c':
                    e.preventDefault();
                    this.clearAllFilters();
                    break;
            }
        }
    }

    handleClickOutside(e) {
        // Close dropdowns when clicking outside
        if (!e.target.closest('.filter-presets-btn, .filter-presets-dropdown')) {
            this.hideFilterPresets();
        }
        
        if (!e.target.closest('.filter-dropdown-btn, .filter-dropdown')) {
            document.getElementById('eventTypeDropdown').classList.remove('visible');
        }
    }

    scrollToBottom() {
        const feed = document.getElementById('eventFeed');
        feed.scrollTop = feed.scrollHeight;
    }

    // Rendering methods
    render() {
        this.enableVirtualScrolling();
        this.renderSessions();
        this.renderEvents();
        this.renderTimeline();
        this.updateMetrics();
    }

    renderSessions() {
        const container = document.getElementById('sessionsList');
        let sessions = Array.from(this.sessions.values());
        
        // Apply search filter
        if (this.filters.search) {
            sessions = sessions.filter(session => 
                session.project.toLowerCase().includes(this.filters.search.toLowerCase()) ||
                session.branch.toLowerCase().includes(this.filters.search.toLowerCase())
            );
        }
        
        // Group sessions by project
        const projectGroups = this.groupSessionsByProject(sessions);
        
        // Virtual scrolling for large lists
        if (this.virtualScroll.enabled) {
            this.renderVirtualProjectGroups(container, projectGroups);
        } else {
            this.renderAllProjectGroups(container, projectGroups);
        }
    }

    groupSessionsByProject(sessions) {
        // First, separate awaiting sessions to bubble to top
        const awaitingSessions = sessions.filter(s => s.status === 'awaiting');
        const otherSessions = sessions.filter(s => s.status !== 'awaiting');
        
        const groups = new Map();
        
        // Group awaiting sessions first
        awaitingSessions.forEach(session => {
            const projectName = session.project;
            if (!groups.has(projectName)) {
                groups.set(projectName, []);
            }
            groups.get(projectName).push(session);
        });
        
        // Then group other sessions
        otherSessions.forEach(session => {
            const projectName = session.project;
            if (!groups.has(projectName)) {
                groups.set(projectName, []);
            }
            groups.get(projectName).push(session);
        });
        
        // Sort sessions within each project: awaiting first, then active, then by last activity
        groups.forEach(projectSessions => {
            projectSessions.sort((a, b) => {
                if (a.status === 'awaiting' && b.status !== 'awaiting') return -1;
                if (b.status === 'awaiting' && a.status !== 'awaiting') return 1;
                if (a.status === 'active' && b.status === 'idle') return -1;
                if (b.status === 'active' && a.status === 'idle') return 1;
                return b.lastActivity - a.lastActivity;
            });
        });
        
        // Convert to array and sort projects: awaiting projects first, then active, then by latest activity
        const projectArray = Array.from(groups.entries()).map(([projectName, projectSessions]) => ({
            name: projectName,
            sessions: projectSessions,
            hasAwaiting: projectSessions.some(s => s.status === 'awaiting'),
            hasActive: projectSessions.some(s => s.status === 'active'),
            awaitingCount: projectSessions.filter(s => s.status === 'awaiting').length,
            latestActivity: Math.max(...projectSessions.map(s => s.lastActivity))
        }));
        
        // Sort projects: awaiting first (with most awaiting at top), then active, then by latest activity
        projectArray.sort((a, b) => {
            if (a.hasAwaiting && !b.hasAwaiting) return -1;
            if (b.hasAwaiting && !a.hasAwaiting) return 1;
            if (a.hasAwaiting && b.hasAwaiting) {
                return b.awaitingCount - a.awaitingCount; // More awaiting sessions first
            }
            if (a.hasActive && !b.hasActive) return -1;
            if (b.hasActive && !a.hasActive) return 1;
            return b.latestActivity - a.latestActivity;
        });
        
        return projectArray;
    }

    renderAllProjectGroups(container, projectGroups) {
        container.innerHTML = projectGroups.map(project => this.createProjectGroup(project)).join('');
    }

    renderVirtualProjectGroups(container, projectGroups) {
        // For virtual scrolling, flatten the groups for now
        const allSessions = projectGroups.flatMap(project => project.sessions);
        const visibleStart = Math.floor(this.virtualScroll.scrollTop / this.virtualScroll.itemHeight);
        const visibleEnd = Math.min(visibleStart + this.virtualScroll.visibleItems + 5, allSessions.length);
        
        container.style.height = `${allSessions.length * this.virtualScroll.itemHeight}px`;
        container.style.paddingTop = `${visibleStart * this.virtualScroll.itemHeight}px`;
        
        const visibleSessions = allSessions.slice(visibleStart, visibleEnd);
        container.innerHTML = visibleSessions.map(session => this.createSessionCard(session)).join('');
    }

    createProjectGroup(project) {
        const compactClass = this.ui.compactMode ? 'compact' : '';
        const statusIndicator = project.hasAwaiting ? 'awaiting' : (project.hasActive ? 'active' : 'idle');
        const statusIcon = project.hasAwaiting ? 'pending' : (project.hasActive ? 'play_arrow' : 'pause');
        
        // Show awaiting count in parentheses if any exist
        const countText = project.awaitingCount > 0 ? 
            `${project.sessions.length} (${project.awaitingCount} awaiting)` : 
            project.sessions.length.toString();
        
        return `
            <div class="project-group ${compactClass}">
                <div class="project-header ${statusIndicator}">
                    <span class="material-icons project-icon">${statusIcon}</span>
                    <span class="project-name">${project.name.split('/').pop()}</span>
                    <span class="session-count">${countText}</span>
                </div>
                <div class="project-sessions">
                    ${project.sessions.map(session => this.createSessionCard(session, true)).join('')}
                </div>
            </div>
        `;
    }

    createSessionCard(session, isNested = false) {
        const duration = this.formatDuration(Date.now() - session.startTime);
        const compactClass = this.ui.compactMode ? 'compact' : '';
        const nestedClass = isNested ? 'nested' : '';
        
        return `
            <div class="session-card ${session.status} ${compactClass} ${nestedClass}" data-session="${session.id}">
                <div class="session-header">
                    <div class="session-name">${isNested ? session.branch : session.project.split('/').pop()}</div>
                    <div class="session-status ${session.status}">${session.status}</div>
                </div>
                <div class="session-details">
                    ${isNested ? 
                        `<div class="session-branch">${session.branch}</div>` : 
                        `<div class="session-project">${session.project} (${session.branch})</div>`
                    }
                    <div class="session-duration">
                        <span class="material-icons" style="font-size: 12px;">schedule</span>
                        ${duration}
                    </div>
                </div>
            </div>
        `;
    }

    renderEvents() {
        const container = document.getElementById('eventFeedContent');
        let filteredEvents = this.events;
        
        // Apply filters
        filteredEvents = filteredEvents.filter(event => {
            if (!this.filters.eventTypes.has(event.type)) return false;
            if (this.filters.sessions.size > 0 && !this.filters.sessions.has(event.sessionId)) return false;
            return true;
        });
        
        // Limit to recent events for performance
        const recentEvents = filteredEvents.slice(0, 200);
        
        container.innerHTML = recentEvents.map(event => this.createEventRow(event)).join('');
        
        if (this.ui.autoScroll && !this.ui.paused) {
            setTimeout(() => this.scrollToBottom(), 100);
        }
    }

    createEventRow(event) {
        const session = this.sessions.get(event.sessionId);
        const time = new Date(event.timestamp).toLocaleTimeString([], { 
            hour12: false, 
            hour: '2-digit', 
            minute: '2-digit', 
            second: '2-digit' 
        });
        
        const icon = this.eventTypeIcons[event.type] || 'help';
        const sessionName = session ? session.project.split('/').pop() : 'unknown';
        
        return `
            <div class="event-row ${event.type}" data-event="${event.id}">
                <div class="event-time">${time}</div>
                <div class="event-icon">
                    <span class="material-icons">${icon}</span>
                </div>
                <div class="event-type">${event.type}</div>
                <div class="event-session">${sessionName}</div>
                <div class="event-details">${event.details}</div>
            </div>
        `;
    }

    renderTimeline() {
        if (this.timeline.collapsed) return;
        
        const container = document.getElementById('timelineSwimlanes');
        const labelsContainer = document.getElementById('timelineLabels');
        
        // Generate actual swimlane activities based on active sessions
        const activeSessions = Array.from(this.sessions.values())
            .filter(s => s.status === 'active' || s.status === 'awaiting')
            .slice(0, 8); // Show top 8 active sessions
            
        // Render session labels
        labelsContainer.innerHTML = activeSessions.map(session => 
            `<div class="timeline-label" style="height: 28px; padding: 6px 8px; border-bottom: 1px solid var(--bg-tertiary); font-size: 11px; color: var(--text-secondary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                ${session.project.split('/').pop()}
            </div>`
        ).join('');
        
        // Render swimlanes with activities
        container.innerHTML = activeSessions.map((session, index) => {
            const recentEvents = this.events
                .filter(e => e.sessionId === session.id)
                .slice(0, 10); // Last 10 events per session
                
            const activities = recentEvents.map(event => {
                const timePercent = Math.max(0, Math.min(100, 20 + Math.random() * 60)); // Simplified positioning
                const statusColor = event.type === 'error' ? 'var(--status-error)' : 
                                  event.type === 'notification' ? 'var(--status-awaiting)' :
                                  event.type.includes('tool') ? 'var(--status-info)' : 'var(--status-active)';
                                  
                return `<div class="timeline-activity" style="
                    position: absolute;
                    left: ${timePercent}%;
                    top: 4px;
                    width: 8px;
                    height: 20px;
                    background: ${statusColor};
                    border-radius: 2px;
                    opacity: 0.8;
                    cursor: pointer;
                    title: '${event.type} - ${event.details}';
                "></div>`;
            }).join('');
            
            return `<div class="timeline-row" style="
                position: relative;
                height: 28px;
                border-bottom: 1px solid var(--bg-tertiary);
                background: ${index % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent'};
            ">
                ${activities}
            </div>`;
        }).join('');
        
        // Update current time indicator
        const indicator = document.getElementById('currentTimeIndicator');
        if (indicator) {
            indicator.style.left = '85%'; // Position near end to show "current time"
        }
    }

    updateMetrics() {
        const activeCount = Array.from(this.sessions.values()).filter(s => s.status === 'active').length;
        const awaitingCount = Array.from(this.sessions.values()).filter(s => s.status === 'awaiting').length;
        
        document.getElementById('activeCount').textContent = activeCount;
        document.getElementById('awaitingCount').textContent = awaitingCount;
        document.getElementById('eventsPerMin').textContent = `${this.performance.eventRate}/min`;
    }

    updateFilterButtonText() {
        const totalEventTypes = 9; // Total number of event types
        const selectedCount = this.filters.eventTypes.size;
        const buttonTextElement = document.getElementById('eventTypeButtonText');
        
        if (selectedCount === totalEventTypes) {
            buttonTextElement.textContent = 'Event Types';
        } else {
            buttonTextElement.textContent = `Event Types (${selectedCount}/${totalEventTypes})`;
        }
    }

    formatDuration(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        
        if (hours > 0) {
            return `${hours}h ${minutes % 60}m`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        } else {
            return `${seconds}s`;
        }
    }
}

// Initialize the ultimate dashboard
const dashboard = new ChronicleUltimateDashboard();

// Make it available globally for debugging
window.dashboard = dashboard;