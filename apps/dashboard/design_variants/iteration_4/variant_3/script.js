/**
 * Chronicle Dashboard - Optimized Filtering Variant
 * Interactive features for enhanced filtering and monitoring
 */

class ChronicleFilterDashboard {
    constructor() {
        this.filters = {
            search: '',
            eventTypes: new Set(['user_prompt_submit', 'pre_tool_use', 'post_tool_use', 'notification', 'error', 'stop']),
            tools: new Set(['Read', 'Edit', 'Bash', 'Grep', 'Write', 'Task', 'Glob', 'WebFetch']),
            timeRange: '1h',
            sessionStates: new Set(['active', 'awaiting', 'idle']),
            logic: 'and'
        };
        
        this.sessions = new Map();
        this.events = [];
        this.selectedSession = 'sess-1';
        this.isAutoScrolling = true;
        this.isPaused = false;
        
        this.initializeEventListeners();
        this.loadMockData();
        this.startRealTimeUpdates();
        this.setupKeyboardShortcuts();
    }

    initializeEventListeners() {
        // Sidebar toggle
        document.getElementById('sidebarToggle').addEventListener('click', () => {
            this.toggleSidebar();
        });

        // Help toggle
        document.getElementById('helpToggle').addEventListener('click', () => {
            this.toggleHelp();
        });

        // Session search
        const sessionSearch = document.getElementById('sessionSearch');
        sessionSearch.addEventListener('input', (e) => {
            this.updateSearchFilter(e.target.value);
        });

        document.getElementById('searchClear').addEventListener('click', () => {
            sessionSearch.value = '';
            this.updateSearchFilter('');
        });

        // Filter presets
        document.getElementById('filterPresetsBtn').addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleFilterPresets();
        });

        // Clear all filters
        document.getElementById('clearAllFilters').addEventListener('click', () => {
            this.clearAllFilters();
        });

        // Event type dropdown
        this.setupEventTypeDropdown();

        // Tool filter grid
        this.setupToolFilterGrid();

        // Time range
        document.getElementById('timeRange').addEventListener('change', (e) => {
            this.updateTimeRangeFilter(e.target.value);
        });

        // Session state buttons
        this.setupSessionStateButtons();

        // Logic toggle
        this.setupLogicToggle();

        // Timeline controls
        this.setupTimelineControls();

        // Event feed controls
        this.setupEventFeedControls();

        // Session selection
        this.setupSessionSelection();

        // Close dropdowns when clicking outside
        document.addEventListener('click', (e) => {
            this.closeOpenDropdowns(e);
        });

        // Filter presets
        this.setupFilterPresets();
    }

    setupEventTypeDropdown() {
        const dropdown = document.getElementById('eventTypeDropdown');
        const header = dropdown.querySelector('.dropdown-header');
        const content = dropdown.querySelector('.dropdown-content');
        const selectAll = document.getElementById('selectAllEventTypes');

        header.addEventListener('click', (e) => {
            e.stopPropagation();
            // Close other dropdowns first
            this.closeOtherDropdowns(dropdown);
            
            const isOpen = header.classList.contains('open');
            header.classList.toggle('open', !isOpen);
            content.classList.toggle('open', !isOpen);
            dropdown.classList.toggle('open', !isOpen);
            
            // Update ARIA attributes
            header.setAttribute('aria-expanded', !isOpen);
        });
        
        // Add keyboard support for dropdown header
        header.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                header.click();
            }
        });

        selectAll.addEventListener('change', (e) => {
            const checkboxes = content.querySelectorAll('input[type="checkbox"]:not(#selectAllEventTypes)');
            checkboxes.forEach(cb => {
                cb.checked = e.target.checked;
            });
            this.updateEventTypeFilter();
        });

        content.querySelectorAll('input[type="checkbox"]:not(#selectAllEventTypes)').forEach(cb => {
            cb.addEventListener('change', () => {
                this.updateEventTypeFilter();
            });
        });
    }

    setupToolFilterGrid() {
        const toolGrid = document.getElementById('toolFilterGrid');
        toolGrid.addEventListener('click', (e) => {
            const toolItem = e.target.closest('.tool-item');
            if (toolItem) {
                const isCtrlClick = e.ctrlKey || e.metaKey;
                const tool = toolItem.dataset.tool;
                
                if (!isCtrlClick) {
                    // Single selection - clear others first
                    toolGrid.querySelectorAll('.tool-item').forEach(item => {
                        if (item !== toolItem) {
                            item.classList.remove('active');
                            item.setAttribute('aria-pressed', 'false');
                        }
                    });
                    this.filters.tools.clear();
                    
                    // Add the clicked tool
                    toolItem.classList.add('active');
                    toolItem.setAttribute('aria-pressed', 'true');
                    this.filters.tools.add(tool);
                } else {
                    // Multi-selection - toggle the clicked item
                    toolItem.classList.toggle('active');
                    if (toolItem.classList.contains('active')) {
                        this.filters.tools.add(tool);
                        toolItem.setAttribute('aria-pressed', 'true');
                    } else {
                        this.filters.tools.delete(tool);
                        toolItem.setAttribute('aria-pressed', 'false');
                    }
                }
                
                this.updateFilterBadges();
                this.applyFilters();
            }
        });
        
        // Add keyboard support for tool items
        toolGrid.querySelectorAll('.tool-item').forEach(item => {
            item.setAttribute('tabindex', '0');
            item.setAttribute('role', 'button');
            item.setAttribute('aria-pressed', 'true'); // Default active state
            item.setAttribute('aria-label', `Filter by ${item.dataset.tool} tool`);
            
            item.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    item.click();
                }
            });
        });
    }

    setupSessionStateButtons() {
        const stateButtons = document.querySelectorAll('.state-btn');
        stateButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const isCtrlClick = e.ctrlKey || e.metaKey;
                const state = btn.dataset.state;
                
                if (!isCtrlClick) {
                    // Single selection
                    stateButtons.forEach(b => b.classList.remove('active'));
                    this.filters.sessionStates.clear();
                }
                
                btn.classList.toggle('active');
                if (btn.classList.contains('active')) {
                    this.filters.sessionStates.add(state);
                } else {
                    this.filters.sessionStates.delete(state);
                }
                
                this.updateFilterBadges();
                this.applyFilters();
            });
        });
    }

    setupLogicToggle() {
        const logicButtons = document.querySelectorAll('.logic-btn');
        logicButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                logicButtons.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.filters.logic = btn.dataset.logic;
                this.applyFilters();
            });
        });
    }

    setupTimelineControls() {
        document.getElementById('timelineToggle').addEventListener('click', () => {
            this.toggleTimeline();
        });

        document.querySelectorAll('.zoom-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const direction = btn.dataset.zoom;
                this.handleTimelineZoom(direction);
            });
        });

        document.getElementById('jumpToNow').addEventListener('click', () => {
            this.jumpToNow();
        });
    }

    setupEventFeedControls() {
        document.getElementById('autoScroll').addEventListener('click', () => {
            this.toggleAutoScroll();
        });

        document.getElementById('pauseFeed').addEventListener('click', () => {
            this.togglePauseFeed();
        });
    }

    setupSessionSelection() {
        document.querySelectorAll('.session-item').forEach(item => {
            item.addEventListener('click', () => {
                // Remove previous selection
                document.querySelectorAll('.session-item').forEach(i => i.classList.remove('selected'));
                
                // Add selection to clicked item
                item.classList.add('selected');
                this.selectedSession = item.dataset.session;
                
                // Update timeline and event feed
                this.updateTimelineForSession();
                this.updateEventFeedForSession();
            });
        });
    }

    setupFilterPresets() {
        document.querySelectorAll('.preset-item').forEach(item => {
            item.addEventListener('click', () => {
                const preset = item.dataset.preset;
                this.applyFilterPreset(preset);
                this.toggleFilterPresets(); // Close dropdown
            });
        });
    }

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Check if we're in an input field
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') {
                return;
            }

            switch (e.key) {
                case '?':
                    e.preventDefault();
                    this.toggleHelp();
                    break;
                case '/':
                    e.preventDefault();
                    document.getElementById('sessionSearch').focus();
                    break;
                case 'Escape':
                    e.preventDefault();
                    this.clearSelection();
                    break;
                case ' ':
                    e.preventDefault();
                    this.jumpToNow();
                    break;
                case 'j':
                    e.preventDefault();
                    this.navigateEvents('down');
                    break;
                case 'k':
                    e.preventDefault();
                    this.navigateEvents('up');
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    this.navigateSessions('up');
                    break;
                case 'ArrowDown':
                    e.preventDefault();
                    this.navigateSessions('down');
                    break;
                case 'Enter':
                    e.preventDefault();
                    this.selectCurrentItem();
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
                }
            }

            // Alt combinations
            if (e.altKey) {
                switch (e.key) {
                    case 'c':
                        e.preventDefault();
                        this.clearAllFilters();
                        break;
                }
            }

            // Number keys for filter presets
            const num = parseInt(e.key);
            if (num >= 1 && num <= 9) {
                e.preventDefault();
                this.applyQuickFilter(num);
            }
        });
    }

    // Filter Management
    updateSearchFilter(value) {
        this.filters.search = value;
        this.updateFilterBadges();
        this.applyFilters();
    }

    updateEventTypeFilter() {
        const checkboxes = document.querySelectorAll('#eventTypeContent input[type="checkbox"]:not(#selectAllEventTypes)');
        this.filters.eventTypes.clear();
        
        checkboxes.forEach(cb => {
            if (cb.checked) {
                this.filters.eventTypes.add(cb.value);
            }
        });

        // Update select all state
        const selectAll = document.getElementById('selectAllEventTypes');
        const allChecked = Array.from(checkboxes).every(cb => cb.checked);
        const noneChecked = Array.from(checkboxes).every(cb => !cb.checked);
        
        selectAll.checked = allChecked;
        selectAll.indeterminate = !allChecked && !noneChecked;

        // Update dropdown text
        const selectedText = document.getElementById('eventTypeSelected');
        if (this.filters.eventTypes.size === 0) {
            selectedText.textContent = 'No types selected';
        } else if (this.filters.eventTypes.size === checkboxes.length) {
            selectedText.textContent = 'All Types';
        } else {
            selectedText.textContent = `${this.filters.eventTypes.size} types selected`;
        }

        this.updateFilterBadges();
        this.applyFilters();
    }

    updateTimeRangeFilter(value) {
        this.filters.timeRange = value;
        this.updateFilterBadges();
        this.applyFilters();
    }

    updateFilterBadges() {
        const badgesContainer = document.getElementById('filterBadges');
        badgesContainer.innerHTML = '';

        // Search badge
        if (this.filters.search) {
            this.addFilterBadge(badgesContainer, 'search', `Search: ${this.filters.search}`, 'search');
        }

        // Event types badge
        if (this.filters.eventTypes.size > 0 && this.filters.eventTypes.size < 6) {
            this.addFilterBadge(badgesContainer, 'eventTypes', `${this.filters.eventTypes.size} event types`, 'category');
        }

        // Tools badge
        if (this.filters.tools.size > 0 && this.filters.tools.size < 8) {
            this.addFilterBadge(badgesContainer, 'tools', `${this.filters.tools.size} tools`, 'build');
        }

        // Time range badge
        if (this.filters.timeRange !== '1h') {
            this.addFilterBadge(badgesContainer, 'timeRange', `Time: ${this.filters.timeRange}`, 'schedule');
        }

        // Session states badge
        if (this.filters.sessionStates.size > 0 && this.filters.sessionStates.size < 3) {
            this.addFilterBadge(badgesContainer, 'sessionStates', `${this.filters.sessionStates.size} states`, 'traffic');
        }

        // Logic badge
        if (this.filters.logic === 'or') {
            this.addFilterBadge(badgesContainer, 'logic', 'OR logic', 'hub');
        }
    }

    addFilterBadge(container, type, text, icon) {
        const badge = document.createElement('div');
        badge.className = 'filter-badge';
        badge.innerHTML = `
            <span class="material-icons">${icon}</span>
            ${text}
            <button class="filter-badge-remove" data-filter-type="${type}">
                <span class="material-icons">close</span>
            </button>
        `;

        badge.querySelector('.filter-badge-remove').addEventListener('click', (e) => {
            e.stopPropagation();
            this.removeFilter(type);
        });

        container.appendChild(badge);
    }

    removeFilter(type) {
        switch (type) {
            case 'search':
                document.getElementById('sessionSearch').value = '';
                this.filters.search = '';
                break;
            case 'eventTypes':
                this.filters.eventTypes = new Set(['user_prompt_submit', 'pre_tool_use', 'post_tool_use', 'notification', 'error', 'stop']);
                document.querySelectorAll('#eventTypeContent input[type="checkbox"]').forEach(cb => cb.checked = true);
                break;
            case 'tools':
                this.filters.tools = new Set(['Read', 'Edit', 'Bash', 'Grep', 'Write', 'Task', 'Glob', 'WebFetch']);
                document.querySelectorAll('.tool-item').forEach(item => item.classList.add('active'));
                break;
            case 'timeRange':
                this.filters.timeRange = '1h';
                document.getElementById('timeRange').value = '1h';
                break;
            case 'sessionStates':
                this.filters.sessionStates = new Set(['active', 'awaiting', 'idle']);
                document.querySelectorAll('.state-btn').forEach(btn => btn.classList.add('active'));
                break;
            case 'logic':
                this.filters.logic = 'and';
                document.querySelectorAll('.logic-btn').forEach(btn => btn.classList.remove('active'));
                document.querySelector('[data-logic="and"]').classList.add('active');
                break;
        }
        
        this.updateFilterBadges();
        this.applyFilters();
    }

    clearAllFilters() {
        // Reset all filters to default
        this.filters = {
            search: '',
            eventTypes: new Set(['user_prompt_submit', 'pre_tool_use', 'post_tool_use', 'notification', 'error', 'stop']),
            tools: new Set(['Read', 'Edit', 'Bash', 'Grep', 'Write', 'Task', 'Glob', 'WebFetch']),
            timeRange: '1h',
            sessionStates: new Set(['active', 'awaiting', 'idle']),
            logic: 'and'
        };

        // Reset UI elements
        document.getElementById('sessionSearch').value = '';
        document.querySelectorAll('#eventTypeContent input[type="checkbox"]').forEach(cb => cb.checked = true);
        document.querySelectorAll('.tool-item').forEach(item => item.classList.add('active'));
        document.getElementById('timeRange').value = '1h';
        document.querySelectorAll('.state-btn').forEach(btn => btn.classList.add('active'));
        document.querySelectorAll('.logic-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelector('[data-logic="and"]').classList.add('active');

        this.updateEventTypeFilter();
        this.updateFilterBadges();
        this.applyFilters();
    }

    applyFilterPreset(preset) {
        switch (preset) {
            case 'awaiting':
                this.clearAllFilters();
                this.filters.sessionStates = new Set(['awaiting']);
                document.querySelectorAll('.state-btn').forEach(btn => btn.classList.remove('active'));
                document.querySelector('[data-state="awaiting"]').classList.add('active');
                break;
            case 'errors':
                this.clearAllFilters();
                this.filters.eventTypes = new Set(['error']);
                document.querySelectorAll('#eventTypeContent input[type="checkbox"]').forEach(cb => {
                    cb.checked = cb.value === 'error';
                });
                this.updateEventTypeFilter();
                break;
            case 'active':
                this.clearAllFilters();
                this.filters.sessionStates = new Set(['active']);
                document.querySelectorAll('.state-btn').forEach(btn => btn.classList.remove('active'));
                document.querySelector('[data-state="active"]').classList.add('active');
                break;
            case 'high-activity':
                this.clearAllFilters();
                this.filters.timeRange = '15m';
                this.filters.tools = new Set(['Read', 'Edit', 'Write', 'Bash']);
                document.getElementById('timeRange').value = '15m';
                document.querySelectorAll('.tool-item').forEach(item => {
                    const tool = item.dataset.tool;
                    item.classList.toggle('active', this.filters.tools.has(tool));
                });
                break;
            case 'custom':
                // Show advanced filter options
                break;
        }
        
        this.updateFilterBadges();
        this.applyFilters();
    }

    applyQuickFilter(num) {
        const presets = ['awaiting', 'errors', 'active', 'high-activity'];
        if (num <= presets.length) {
            this.applyFilterPreset(presets[num - 1]);
        }
    }

    applyFilters() {
        // This would apply filters to the actual data
        // For now, just update the display
        this.updateSessionList();
        this.updateEventFeed();
        this.updateMetrics();
    }

    // UI Controls
    toggleSidebar() {
        const sidebar = document.getElementById('sidebar');
        sidebar.classList.toggle('collapsed');
        
        // Store preference
        localStorage.setItem('chronicleSidebarCollapsed', sidebar.classList.contains('collapsed'));
    }

    toggleTimeline() {
        const timeline = document.getElementById('timelineContainer');
        timeline.classList.toggle('collapsed');
        
        // Store preference
        localStorage.setItem('chronicleTimelineCollapsed', timeline.classList.contains('collapsed'));
    }

    toggleHelp() {
        const panel = document.getElementById('shortcutsPanel');
        panel.classList.toggle('visible');
    }

    toggleFilterPresets() {
        const dropdown = document.getElementById('filterPresetsDropdown');
        dropdown.classList.toggle('visible');
    }

    toggleAutoScroll() {
        this.isAutoScrolling = !this.isAutoScrolling;
        const btn = document.getElementById('autoScroll');
        btn.classList.toggle('active', this.isAutoScrolling);
    }

    togglePauseFeed() {
        this.isPaused = !this.isPaused;
        const btn = document.getElementById('pauseFeed');
        btn.classList.toggle('active', this.isPaused);
        
        if (this.isPaused) {
            btn.querySelector('.material-icons').textContent = 'play_arrow';
            btn.title = 'Resume live updates';
        } else {
            btn.querySelector('.material-icons').textContent = 'pause';
            btn.title = 'Pause live updates';
        }
    }

    closeOtherDropdowns(exceptDropdown) {
        // Close event type dropdown
        if (exceptDropdown?.id !== 'eventTypeDropdown') {
            const eventTypeDropdown = document.getElementById('eventTypeDropdown');
            eventTypeDropdown.querySelector('.dropdown-header').classList.remove('open');
            eventTypeDropdown.querySelector('.dropdown-content').classList.remove('open');
            eventTypeDropdown.classList.remove('open');
        }

        // Close filter presets dropdown
        if (!exceptDropdown?.classList?.contains('filter-presets-dropdown') && 
            exceptDropdown?.id !== 'filterPresetsDropdown') {
            document.getElementById('filterPresetsDropdown').classList.remove('visible');
        }
    }

    closeOpenDropdowns(e) {
        // Close event type dropdown
        if (!e.target.closest('#eventTypeDropdown')) {
            const eventTypeDropdown = document.getElementById('eventTypeDropdown');
            eventTypeDropdown.querySelector('.dropdown-header').classList.remove('open');
            eventTypeDropdown.querySelector('.dropdown-content').classList.remove('open');
            eventTypeDropdown.classList.remove('open');
        }

        // Close filter presets dropdown
        if (!e.target.closest('.filter-presets-btn, .filter-presets-dropdown')) {
            document.getElementById('filterPresetsDropdown').classList.remove('visible');
        }

        // Close help panel
        if (!e.target.closest('.help-toggle, .shortcuts-panel')) {
            document.getElementById('shortcutsPanel').classList.remove('visible');
        }
    }

    // Navigation
    navigateEvents(direction) {
        const rows = document.querySelectorAll('.event-row');
        let currentIndex = Array.from(rows).findIndex(row => row.classList.contains('focused'));
        
        if (currentIndex === -1) currentIndex = 0;
        
        rows[currentIndex].classList.remove('focused');
        
        if (direction === 'down' && currentIndex < rows.length - 1) {
            currentIndex++;
        } else if (direction === 'up' && currentIndex > 0) {
            currentIndex--;
        }
        
        rows[currentIndex].classList.add('focused');
        rows[currentIndex].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    navigateSessions(direction) {
        const sessions = document.querySelectorAll('.session-item');
        const currentSelected = document.querySelector('.session-item.selected');
        let currentIndex = Array.from(sessions).indexOf(currentSelected);
        
        if (currentIndex === -1) currentIndex = 0;
        
        if (direction === 'down' && currentIndex < sessions.length - 1) {
            currentIndex++;
        } else if (direction === 'up' && currentIndex > 0) {
            currentIndex--;
        }
        
        sessions.forEach(s => s.classList.remove('selected'));
        sessions[currentIndex].classList.add('selected');
        sessions[currentIndex].click();
    }

    clearSelection() {
        document.querySelectorAll('.event-row').forEach(row => row.classList.remove('focused'));
        document.getElementById('shortcutsPanel').classList.remove('visible');
        document.getElementById('filterPresetsDropdown').classList.remove('visible');
    }

    selectCurrentItem() {
        const focusedEvent = document.querySelector('.event-row.focused');
        if (focusedEvent) {
            // Handle event selection
            console.log('Selected event:', focusedEvent.dataset);
        }
    }

    jumpToNow() {
        const eventRows = document.getElementById('eventRows');
        eventRows.scrollTop = 0; // Scroll to top (most recent events)
        
        // Highlight current time in timeline
        document.querySelectorAll('.time-marker').forEach(marker => {
            marker.classList.remove('highlighted');
        });
        document.querySelector('.time-marker.current')?.classList.add('highlighted');
    }

    handleTimelineZoom(direction) {
        const zoomLevel = document.querySelector('.zoom-level');
        const levels = ['5m', '15m', '1h', '4h', '24h'];
        let currentIndex = levels.indexOf(zoomLevel.textContent);
        
        if (direction === 'in' && currentIndex > 0) {
            currentIndex--;
        } else if (direction === 'out' && currentIndex < levels.length - 1) {
            currentIndex++;
        }
        
        zoomLevel.textContent = levels[currentIndex];
        // Update timeline scale
        this.updateTimelineScale(levels[currentIndex]);
    }

    updateTimelineScale(scale) {
        // Update time markers based on scale
        const markers = document.querySelectorAll('.time-marker');
        // This would update the timeline visualization
        console.log('Updated timeline scale to:', scale);
    }

    // Data Management
    loadMockData() {
        // Load sessions
        this.sessions.set('sess-1', {
            id: 'sess-1',
            name: 'Dashboard UI Refactor',
            project: 'chronicle-dashboard',
            branch: 'main',
            status: 'awaiting',
            lastActivity: '14:23',
            lastEvent: 'notification'
        });

        this.sessions.set('sess-2', {
            id: 'sess-2',
            name: 'API Integration',
            project: 'chronicle-dashboard',
            branch: 'main',
            status: 'active',
            lastActivity: '14:28',
            lastEvent: 'Edit'
        });

        // Load initial filter state from localStorage
        const savedState = localStorage.getItem('chronicleFilters');
        if (savedState) {
            try {
                const parsed = JSON.parse(savedState);
                this.filters = { ...this.filters, ...parsed };
            } catch (e) {
                console.warn('Failed to parse saved filters');
            }
        }

        // Load UI state
        const sidebarCollapsed = localStorage.getItem('chronicleSidebarCollapsed') === 'true';
        const timelineCollapsed = localStorage.getItem('chronicleTimelineCollapsed') === 'true';
        
        if (sidebarCollapsed) {
            document.getElementById('sidebar').classList.add('collapsed');
        }
        if (timelineCollapsed) {
            document.getElementById('timelineContainer').classList.add('collapsed');
        }
    }

    startRealTimeUpdates() {
        // Simulate real-time updates
        setInterval(() => {
            if (!this.isPaused) {
                this.addMockEvent();
                this.updateMetrics();
            }
        }, 3000);

        // Update running durations
        setInterval(() => {
            this.updateRunningDurations();
        }, 1000);
    }

    addMockEvent() {
        const mockEvents = [
            { type: 'pre_tool_use', tool: 'Read', session: 'sess-2', details: 'Reading configuration file...' },
            { type: 'post_tool_use', tool: 'Edit', session: 'sess-1', details: 'Updated component styles', duration: '1.2s' },
            { type: 'user_prompt_submit', session: 'sess-3', details: 'Add error handling to API calls' },
        ];

        const randomEvent = mockEvents[Math.floor(Math.random() * mockEvents.length)];
        this.addEventToFeed(randomEvent);

        if (this.isAutoScrolling) {
            const eventRows = document.getElementById('eventRows');
            eventRows.scrollTop = 0;
        }
    }

    addEventToFeed(event) {
        const eventRows = document.getElementById('eventRows');
        const row = document.createElement('div');
        row.className = 'event-row';
        row.dataset.session = event.session;
        row.dataset.type = event.type;

        const now = new Date();
        const timeStr = now.toTimeString().slice(0, 8);

        row.innerHTML = `
            <div class="col-time">${timeStr}</div>
            <div class="col-session">
                <span class="session-indicator active"></span>
                ${this.getSessionName(event.session)}
            </div>
            <div class="col-type">
                <span class="material-icons type-icon ${event.type}">${this.getEventIcon(event.type)}</span>
                ${this.getEventTypeName(event.type)}
            </div>
            <div class="col-tool">
                ${event.tool ? `<span class="material-icons tool-icon">${this.getToolIcon(event.tool)}</span> ${event.tool}` : '-'}
            </div>
            <div class="col-details">${event.details}</div>
            <div class="col-duration">${event.duration || '-'}</div>
        `;

        eventRows.insertBefore(row, eventRows.firstChild);

        // Remove old events to keep list manageable
        const rows = eventRows.querySelectorAll('.event-row');
        if (rows.length > 100) {
            rows[rows.length - 1].remove();
        }
    }

    updateSessionList() {
        // Apply current filters to session list
        const sessionItems = document.querySelectorAll('.session-item');
        sessionItems.forEach(item => {
            const session = this.sessions.get(item.dataset.session);
            if (session) {
                const visible = this.sessionMatchesFilters(session);
                item.style.display = visible ? 'flex' : 'none';
            }
        });
    }

    updateEventFeed() {
        // Apply current filters to event feed
        const eventRows = document.querySelectorAll('.event-row');
        eventRows.forEach(row => {
            const visible = this.eventMatchesFilters(row);
            row.style.display = visible ? 'grid' : 'none';
        });
    }

    updateTimelineForSession() {
        // Update timeline to show selected session
        const swimlanes = document.querySelectorAll('.swimlane');
        swimlanes.forEach(lane => {
            const isSelected = lane.dataset.session === this.selectedSession;
            lane.style.opacity = isSelected ? '1' : '0.5';
        });
    }

    updateEventFeedForSession() {
        // Highlight events for selected session
        const eventRows = document.querySelectorAll('.event-row');
        eventRows.forEach(row => {
            const isSelected = row.dataset.session === this.selectedSession;
            row.classList.toggle('highlighted', isSelected);
        });
    }

    updateMetrics() {
        // Update header metrics
        const activeSessions = Array.from(this.sessions.values()).filter(s => s.status === 'active').length;
        const awaitingSessions = Array.from(this.sessions.values()).filter(s => s.status === 'awaiting').length;
        const eventRate = Math.floor(Math.random() * 20) + 40; // Mock event rate

        document.getElementById('activeCount').textContent = activeSessions;
        document.getElementById('awaitingCount').textContent = awaitingSessions;
        document.getElementById('eventRate').textContent = eventRate;
    }

    updateRunningDurations() {
        const runningElements = document.querySelectorAll('.duration-running');
        runningElements.forEach(el => {
            const current = parseFloat(el.textContent);
            el.textContent = (current + 1).toFixed(1) + 's';
        });
    }

    // Helper methods
    sessionMatchesFilters(session) {
        // Apply search filter
        if (this.filters.search) {
            const searchTerm = this.filters.search.toLowerCase();
            if (!session.name.toLowerCase().includes(searchTerm) &&
                !session.project.toLowerCase().includes(searchTerm) &&
                !session.branch.toLowerCase().includes(searchTerm)) {
                return false;
            }
        }

        // Apply session state filter
        if (!this.filters.sessionStates.has(session.status)) {
            return false;
        }

        return true;
    }

    eventMatchesFilters(eventRow) {
        const eventType = eventRow.dataset.type;
        const sessionId = eventRow.dataset.session;
        const session = this.sessions.get(sessionId);

        // Apply event type filter
        if (!this.filters.eventTypes.has(eventType)) {
            return false;
        }

        // Apply session filter (if session is filtered out, hide its events)
        if (session && !this.sessionMatchesFilters(session)) {
            return false;
        }

        return true;
    }

    getSessionName(sessionId) {
        const session = this.sessions.get(sessionId);
        return session ? session.name : sessionId;
    }

    getEventIcon(eventType) {
        const icons = {
            'user_prompt_submit': 'chat',
            'pre_tool_use': 'play_arrow',
            'post_tool_use': 'check_circle',
            'notification': 'notifications',
            'error': 'error',
            'stop': 'stop'
        };
        return icons[eventType] || 'help';
    }

    getEventTypeName(eventType) {
        const names = {
            'user_prompt_submit': 'User Prompt',
            'pre_tool_use': 'Tool Start',
            'post_tool_use': 'Tool Complete',
            'notification': 'Notification',
            'error': 'Error',
            'stop': 'Session Stop'
        };
        return names[eventType] || eventType;
    }

    getToolIcon(tool) {
        const icons = {
            'Read': 'description',
            'Edit': 'edit',
            'Write': 'create',
            'Bash': 'terminal',
            'Grep': 'search',
            'Task': 'assignment',
            'Glob': 'folder_open',
            'WebFetch': 'language'
        };
        return icons[tool] || 'build';
    }

    // Save state on page unload
    saveState() {
        localStorage.setItem('chronicleFilters', JSON.stringify(this.filters));
    }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const dashboard = new ChronicleFilterDashboard();
    
    // Save state before page unloads
    window.addEventListener('beforeunload', () => {
        dashboard.saveState();
    });
});

// Handle window resize
window.addEventListener('resize', () => {
    // Adjust layout for mobile
    if (window.innerWidth < 768) {
        document.getElementById('sidebar').classList.add('collapsed');
    }
});