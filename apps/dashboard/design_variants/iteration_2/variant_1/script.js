// Chronicle Dashboard - Iteration 2 Variant 1 JavaScript

class ChronicleConfig {
    static MOCK_SESSIONS = [
        'session-web-2a3f', 'session-api-7k1m', 'session-data-9x4p',
        'session-ml-5q8r', 'session-ui-1x7n', 'session-db-3m9k',
        'session-test-8j2p', 'session-deploy-4r6t', 'session-debug-7h3m',
        'session-crawler-2k9f', 'session-analyzer-6p1w', 'session-processor-9d4x'
    ];

    static MOCK_TOOLS = [
        'EditFile', 'WebSearch', 'ExecuteCode', 'DatabaseQuery', 'ReadFile',
        'WriteFile', 'GitCommit', 'RunTests', 'DeployApp', 'AnalyzeCode',
        'CreateComponent', 'UpdateSchema', 'ProcessData', 'SendNotification',
        'ValidateInput', 'CacheData', 'LogEvent', 'MonitorHealth'
    ];

    static SUB_AGENTS = [
        { id: 'web-crawler', name: 'WC', icon: 'fa-spider', status: 'active' },
        { id: 'code-analyzer', name: 'CA', icon: 'fa-microscope', status: 'active' },
        { id: 'data-processor', name: 'DP', icon: 'fa-stream', status: 'idle' },
        { id: 'file-manager', name: 'FM', icon: 'fa-folder', status: 'error' },
        { id: 'test-runner', name: 'TR', icon: 'fa-vial', status: 'active' },
        { id: 'deploy-agent', name: 'DA', icon: 'fa-rocket', status: 'idle' }
    ];

    static EVENT_TYPES = [
        'tool_use', 'user_prompt', 'agent_response', 'error', 'notification'
    ];
}

class ChronicleEventGenerator {
    constructor() {
        this.eventId = 1000;
        this.lastEventTime = Date.now();
    }

    generateEvent() {
        const eventType = this.getRandomEventType();
        const session = this.getRandomSession();
        const tool = eventType === 'tool_use' ? this.getRandomTool() : null;
        
        this.lastEventTime += Math.random() * 5000 + 500; // 0.5-5.5 seconds between events
        
        return {
            id: this.eventId++,
            type: eventType,
            session: session,
            tool: tool,
            timestamp: this.lastEventTime,
            description: this.generateDescription(eventType, tool),
            status: this.getRandomStatus(eventType),
            subAgent: Math.random() > 0.7 ? this.getRandomSubAgent() : null
        };
    }

    generateToolUseGroup() {
        const session = this.getRandomSession();
        const tool = this.getRandomTool();
        const baseTime = this.lastEventTime;
        
        // Pre-tool use event
        const preEvent = {
            id: this.eventId++,
            type: 'tool_use',
            session: session,
            tool: tool,
            timestamp: baseTime,
            description: `Starting ${tool} operation`,
            status: 'pending',
            subAgent: Math.random() > 0.5 ? this.getRandomSubAgent() : null,
            isGrouped: true,
            groupType: 'start'
        };

        // Post-tool use event
        this.lastEventTime = baseTime + Math.random() * 3000 + 1000; // 1-4 seconds later
        const postEvent = {
            id: this.eventId++,
            type: 'tool_use',
            session: session,
            tool: tool,
            timestamp: this.lastEventTime,
            description: `${tool} completed successfully`,
            status: Math.random() > 0.1 ? 'success' : 'error',
            subAgent: preEvent.subAgent,
            isGrouped: true,
            groupType: 'end'
        };

        return [preEvent, postEvent];
    }

    getRandomEventType() {
        const weights = {
            'tool_use': 0.4,
            'user_prompt': 0.15,
            'agent_response': 0.25,
            'error': 0.1,
            'notification': 0.1
        };
        
        const random = Math.random();
        let cumulative = 0;
        
        for (const [type, weight] of Object.entries(weights)) {
            cumulative += weight;
            if (random <= cumulative) return type;
        }
        
        return 'tool_use';
    }

    getRandomSession() {
        return ChronicleConfig.MOCK_SESSIONS[
            Math.floor(Math.random() * ChronicleConfig.MOCK_SESSIONS.length)
        ];
    }

    getRandomTool() {
        return ChronicleConfig.MOCK_TOOLS[
            Math.floor(Math.random() * ChronicleConfig.MOCK_TOOLS.length)
        ];
    }

    getRandomSubAgent() {
        return ChronicleConfig.SUB_AGENTS[
            Math.floor(Math.random() * ChronicleConfig.SUB_AGENTS.length)
        ].id;
    }

    getRandomStatus(eventType) {
        if (eventType === 'error') return 'error';
        if (eventType === 'notification') return 'info';
        
        const statuses = ['success', 'pending', 'error'];
        const weights = [0.7, 0.2, 0.1];
        
        const random = Math.random();
        let cumulative = 0;
        
        for (let i = 0; i < statuses.length; i++) {
            cumulative += weights[i];
            if (random <= cumulative) return statuses[i];
        }
        
        return 'success';
    }

    generateDescription(eventType, tool) {
        const descriptions = {
            'tool_use': tool ? [
                `Executing ${tool} with parameters`,
                `${tool} processing request`,
                `Running ${tool} operation`,
                `${tool} task initiated`
            ] : ['Tool operation started'],
            'user_prompt': [
                'User input received',
                'New prompt submitted',
                'User interaction detected',
                'Command input processed'
            ],
            'agent_response': [
                'Response generated',
                'Output ready for user',
                'Processing complete',
                'Result delivered'
            ],
            'error': [
                'Operation failed',
                'Timeout occurred',
                'Validation error',
                'Connection lost'
            ],
            'notification': [
                'System alert triggered',
                'Status update available',
                'Background task completed',
                'Resource threshold reached'
            ]
        };

        const options = descriptions[eventType] || ['Event occurred'];
        return options[Math.floor(Math.random() * options.length)];
    }
}

class ChronicleEventFeed {
    constructor() {
        this.events = [];
        this.filteredEvents = [];
        this.isPaused = false;
        this.generator = new ChronicleEventGenerator();
        this.eventList = document.getElementById('event-list');
        this.pauseBtn = document.getElementById('pause-btn');
        this.typeFilter = document.getElementById('event-type-filter');
        this.sessionFilter = document.getElementById('session-filter');
        
        this.initializeEvents();
        this.bindEventListeners();
        this.startEventGeneration();
        this.updateDisplay();
    }

    initializeEvents() {
        // Generate initial batch of events with some grouped tool use
        for (let i = 0; i < 50; i++) {
            if (Math.random() > 0.6) {
                // Generate grouped tool use events
                const groupedEvents = this.generator.generateToolUseGroup();
                this.events.push(...groupedEvents);
            } else {
                // Generate single event
                this.events.push(this.generator.generateEvent());
            }
        }

        // Sort by timestamp
        this.events.sort((a, b) => b.timestamp - a.timestamp);
        this.filteredEvents = [...this.events];
    }

    bindEventListeners() {
        this.pauseBtn.addEventListener('click', () => this.togglePause());
        this.typeFilter.addEventListener('change', () => this.applyFilters());
        this.sessionFilter.addEventListener('change', () => this.applyFilters());

        // Time filter buttons
        document.querySelectorAll('.time-filter').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.time-filter').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.applyTimeFilter(e.target.dataset.time);
            });
        });
    }

    togglePause() {
        this.isPaused = !this.isPaused;
        this.pauseBtn.classList.toggle('paused', this.isPaused);
        this.pauseBtn.innerHTML = this.isPaused ? 
            '<i class="fas fa-play"></i>' : 
            '<i class="fas fa-pause"></i>';
    }

    applyFilters() {
        const typeFilter = this.typeFilter.value;
        const sessionFilter = this.sessionFilter.value;

        this.filteredEvents = this.events.filter(event => {
            const typeMatch = typeFilter === 'all' || event.type === typeFilter;
            const sessionMatch = sessionFilter === 'all' || event.session === sessionFilter;
            return typeMatch && sessionMatch;
        });

        this.updateDisplay();
    }

    applyTimeFilter(timeRange) {
        const now = Date.now();
        const timeRanges = {
            '1h': 60 * 60 * 1000,
            '6h': 6 * 60 * 60 * 1000,
            '24h': 24 * 60 * 60 * 1000
        };

        const cutoff = now - timeRanges[timeRange];
        this.filteredEvents = this.events.filter(event => event.timestamp >= cutoff);
        this.updateDisplay();
    }

    startEventGeneration() {
        setInterval(() => {
            if (!this.isPaused) {
                // Occasionally generate grouped events
                if (Math.random() > 0.7) {
                    const groupedEvents = this.generator.generateToolUseGroup();
                    this.events.unshift(...groupedEvents);
                } else {
                    const newEvent = this.generator.generateEvent();
                    this.events.unshift(newEvent);
                }

                // Keep only last 1000 events
                if (this.events.length > 1000) {
                    this.events = this.events.slice(0, 1000);
                }

                this.applyFilters();
                this.updateMetrics();
            }
        }, Math.random() * 3000 + 2000); // 2-5 seconds between new events
    }

    updateDisplay() {
        this.eventList.innerHTML = '';
        
        this.filteredEvents.slice(0, 200).forEach(event => {
            const eventRow = this.createEventRow(event);
            this.eventList.appendChild(eventRow);
        });
    }

    createEventRow(event) {
        const row = document.createElement('div');
        row.className = 'event-row';
        row.dataset.type = event.type;
        
        if (event.isGrouped) {
            row.classList.add('grouped');
        }

        const time = new Date(event.timestamp).toLocaleTimeString('en-US', { 
            hour12: false, 
            hour: '2-digit', 
            minute: '2-digit', 
            second: '2-digit' 
        });

        row.innerHTML = `
            ${event.isGrouped ? `<div class="group-indicator ${event.groupType}"></div>` : '<div style="width: 8px;"></div>'}
            <div class="event-time">${time}</div>
            <div class="event-session">${event.session.split('-').pop()}</div>
            <div class="event-type">${event.type.replace('_', ' ')}</div>
            <div class="event-tool">${event.tool || '-'}</div>
            <div class="event-description">${event.description}</div>
            <div class="event-status status-${event.status}">${event.status}</div>
        `;

        return row;
    }

    updateMetrics() {
        const activeSessions = new Set(this.events.slice(0, 100).map(e => e.session)).size;
        const awaitingInput = Math.floor(Math.random() * 5) + 1;
        const totalEvents = this.events.length;

        document.getElementById('active-sessions').textContent = activeSessions;
        document.getElementById('awaiting-input').textContent = awaitingInput;
        document.getElementById('total-events').textContent = totalEvents;
    }
}

class ChronicleToolVisualization {
    constructor() {
        this.updateToolPatterns();
        this.updatePromptCycles();
        this.updateSubAgentStatus();
        
        // Update visualizations periodically
        setInterval(() => {
            this.updateToolPatterns();
            this.updatePromptCycles();
            this.updateSubAgentStatus();
        }, 10000);
    }

    updateToolPatterns() {
        const toolBlocks = document.querySelectorAll('.tool-block');
        toolBlocks.forEach(block => {
            // Simulate changing tool usage patterns
            const newWidth = Math.random() * 30 + 10; // 10-40%
            block.style.width = `${newWidth}%`;
        });
    }

    updatePromptCycles() {
        const cycleBlocks = document.querySelectorAll('.cycle-block');
        const cycleData = [
            { complete: Math.floor(Math.random() * 20) + 15 },
            { pending: Math.floor(Math.random() * 10) + 3 },
            { failed: Math.floor(Math.random() * 8) + 1 }
        ];

        cycleBlocks.forEach((block, index) => {
            const data = Object.values(cycleData[index])[0];
            const countSpan = block.querySelector('.cycle-count');
            if (countSpan) {
                countSpan.textContent = data;
            }
        });
    }

    updateSubAgentStatus() {
        const agentIndicators = document.querySelectorAll('.agent-indicator');
        agentIndicators.forEach(indicator => {
            const currentStatus = indicator.classList.contains('active') ? 'active' :
                               indicator.classList.contains('idle') ? 'idle' : 'error';
            
            // Occasionally change status
            if (Math.random() > 0.8) {
                const statuses = ['active', 'idle', 'error'];
                const newStatus = statuses[Math.floor(Math.random() * statuses.length)];
                
                indicator.classList.remove('active', 'idle', 'error');
                indicator.classList.add(newStatus);
            }
        });
    }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new ChronicleEventFeed();
    new ChronicleToolVisualization();
    
    console.log('Chronicle Dashboard - Iteration 2 Variant 1 Initialized');
    console.log('Features: Dense event rows, intelligent lifecycle grouping, horizontal tool visualization');
});