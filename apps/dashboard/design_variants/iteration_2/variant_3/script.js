// Chronicle Dashboard - Variant 3: Horizontal Timeline
class ChronicleTimeline {
    constructor() {
        this.timeScale = '1m'; // Current time scale
        this.isPaused = false;
        this.autoScroll = true;
        this.events = [];
        this.promptCycles = new Map(); // Track active prompt cycles
        
        this.init();
        this.generateMockData();
        this.startLiveUpdates();
    }

    init() {
        this.setupEventListeners();
        this.renderTimeline();
        this.renderEventFeed();
    }

    setupEventListeners() {
        // Time scale buttons
        document.querySelectorAll('.scale-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelector('.scale-btn.active')?.classList.remove('active');
                e.target.classList.add('active');
                this.timeScale = e.target.dataset.scale;
                this.updateTimelineScale();
            });
        });

        // Pause button
        const pauseBtn = document.getElementById('pauseBtn');
        pauseBtn.addEventListener('click', () => {
            this.isPaused = !this.isPaused;
            pauseBtn.classList.toggle('paused', this.isPaused);
            
            // Update icon
            if (this.isPaused) {
                pauseBtn.innerHTML = `
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                        <polygon points="3,2 13,8 3,14" />
                    </svg>
                `;
            } else {
                pauseBtn.innerHTML = `
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                        <rect x="3" y="2" width="3" height="12" />
                        <rect x="10" y="2" width="3" height="12" />
                    </svg>
                `;
            }
        });

        // Auto-scroll toggle
        const autoScrollBtn = document.getElementById('autoScrollBtn');
        autoScrollBtn.addEventListener('click', () => {
            this.autoScroll = !this.autoScroll;
            autoScrollBtn.classList.toggle('active', this.autoScroll);
        });

        // Filters
        document.getElementById('eventFilter').addEventListener('change', () => {
            this.renderEventFeed();
        });

        document.getElementById('instanceFilter').addEventListener('change', () => {
            this.renderEventFeed();
            this.renderTimeline();
        });
    }

    generateMockData() {
        const instances = ['instance-1', 'instance-2', 'instance-3', 'instance-4', 'instance-5'];
        const tools = ['bash', 'read', 'write', 'grep', 'edit', 'glob'];
        const eventTypes = ['user_input', 'tool_use', 'agent_response', 'stop', 'error'];
        
        // Generate events for the last 5 minutes
        const now = Date.now();
        const events = [];
        
        for (let i = 0; i < 150; i++) {
            const timestamp = now - (Math.random() * 5 * 60 * 1000); // Last 5 minutes
            const instance = instances[Math.floor(Math.random() * instances.length)];
            const eventType = eventTypes[Math.floor(Math.random() * eventTypes.length)];
            
            let tool = null;
            if (eventType === 'tool_use') {
                tool = tools[Math.floor(Math.random() * tools.length)];
            }
            
            events.push({
                id: `event-${i}`,
                timestamp,
                instance,
                type: eventType,
                tool,
                description: this.generateEventDescription(eventType, tool),
                status: Math.random() > 0.1 ? 'success' : (Math.random() > 0.5 ? 'pending' : 'error'),
                cycleId: eventType === 'user_input' ? `cycle-${timestamp}` : null
            });
        }
        
        // Sort by timestamp (newest first for feed)
        this.events = events.sort((a, b) => b.timestamp - a.timestamp);
        
        // Generate prompt cycles
        this.generatePromptCycles();
    }

    generateEventDescription(type, tool) {
        const descriptions = {
            user_input: [
                'Create a new React component',
                'Debug the authentication flow',
                'Optimize database queries',
                'Fix styling issues',
                'Add error handling'
            ],
            tool_use: {
                bash: ['npm install', 'git status', 'yarn build', 'docker ps'],
                read: ['package.json', 'config.yaml', 'README.md', 'app.js'],
                write: ['components/Button.jsx', 'utils/auth.js', 'styles.css'],
                grep: ['Search for "useState"', 'Find API endpoints', 'Locate error logs'],
                edit: ['Update import statements', 'Fix typo in function', 'Add new prop'],
                glob: ['Find all .js files', 'Locate test files', 'Search components']
            },
            agent_response: [
                'Generated React component with TypeScript',
                'Identified authentication issue in middleware',
                'Proposed database optimization strategy',
                'Created CSS fixes for responsive design'
            ],
            stop: [
                'Awaiting user confirmation',
                'Waiting for file selection',
                'Requesting additional context',
                'Need clarification on requirements'
            ],
            error: [
                'File not found: package.json',
                'Permission denied accessing config',
                'Syntax error in generated code',
                'Network timeout during request'
            ]
        };
        
        if (type === 'tool_use' && tool) {
            const toolDescriptions = descriptions[type][tool] || ['Tool execution'];
            return toolDescriptions[Math.floor(Math.random() * toolDescriptions.length)];
        }
        
        const typeDescriptions = descriptions[type] || ['Unknown event'];
        return typeDescriptions[Math.floor(Math.random() * typeDescriptions.length)];
    }

    generatePromptCycles() {
        const instances = ['instance-1', 'instance-2', 'instance-3', 'instance-4', 'instance-5'];
        const tools = ['bash', 'read', 'write', 'grep', 'edit'];
        
        instances.forEach(instance => {
            const cycles = [];
            const now = Date.now();
            
            // Generate 3-5 cycles per instance
            for (let i = 0; i < Math.floor(Math.random() * 3) + 3; i++) {
                const startTime = now - (Math.random() * 5 * 60 * 1000);
                const duration = Math.random() * 120000 + 30000; // 30s to 2m
                const isComplete = Math.random() > 0.3; // 70% complete
                const hasError = Math.random() > 0.9; // 10% error
                const hasSubAgent = Math.random() > 0.8; // 20% sub-agent
                
                const cycleTools = [];
                const toolCount = Math.floor(Math.random() * 4) + 1;
                for (let j = 0; j < toolCount; j++) {
                    cycleTools.push(tools[Math.floor(Math.random() * tools.length)]);
                }
                
                cycles.push({
                    id: `cycle-${instance}-${i}`,
                    instance,
                    startTime,
                    duration: isComplete ? duration : null,
                    tools: cycleTools,
                    isComplete,
                    hasError,
                    hasSubAgent,
                    subAgentCount: hasSubAgent ? Math.floor(Math.random() * 3) + 1 : 0
                });
            }
            
            this.promptCycles.set(instance, cycles);
        });
    }

    renderTimeline() {
        const instanceFilter = document.getElementById('instanceFilter').value;
        
        document.querySelectorAll('.instance-track').forEach(track => {
            const instance = track.dataset.instance;
            
            // Hide/show based on filter
            if (instanceFilter !== 'all' && instanceFilter !== instance) {
                track.style.display = 'none';
                return;
            } else {
                track.style.display = 'flex';
            }
            
            const trackContent = track.querySelector('.track-content');
            const cycles = this.promptCycles.get(instance) || [];
            
            // Clear existing cycles
            trackContent.innerHTML = '';
            
            // Render cycles
            cycles.forEach(cycle => {
                const cycleElement = this.createCycleElement(cycle);
                trackContent.appendChild(cycleElement);
            });
        });
    }

    createCycleElement(cycle) {
        const cycleDiv = document.createElement('div');
        cycleDiv.className = 'prompt-cycle';
        
        if (cycle.hasError) {
            cycleDiv.classList.add('error');
        } else if (cycle.isComplete) {
            cycleDiv.classList.add('complete');
        } else {
            cycleDiv.classList.add('incomplete');
        }
        
        const content = document.createElement('div');
        content.className = 'cycle-content';
        
        // Start indicator
        const start = document.createElement('div');
        start.className = 'cycle-start';
        content.appendChild(start);
        
        // Tools
        const toolsContainer = document.createElement('div');
        toolsContainer.className = 'cycle-tools';
        
        cycle.tools.forEach((tool, index) => {
            if (index > 0) {
                const arrow = document.createElement('span');
                arrow.className = 'cycle-arrow';
                arrow.textContent = '→';
                toolsContainer.appendChild(arrow);
            }
            
            const toolIcon = document.createElement('div');
            toolIcon.className = `tool-icon ${tool}`;
            toolIcon.textContent = tool.charAt(0).toUpperCase();
            toolIcon.title = tool;
            toolsContainer.appendChild(toolIcon);
        });
        
        content.appendChild(toolsContainer);
        
        // End indicator
        const end = document.createElement('div');
        end.className = cycle.isComplete ? 'cycle-end' : 'cycle-end incomplete';
        content.appendChild(end);
        
        cycleDiv.appendChild(content);
        
        // Duration
        if (cycle.duration) {
            const duration = document.createElement('div');
            duration.className = 'cycle-duration';
            duration.textContent = this.formatDuration(cycle.duration);
            cycleDiv.appendChild(duration);
        }
        
        // Sub-agent indicator
        if (cycle.hasSubAgent) {
            const subAgent = document.createElement('div');
            subAgent.className = 'sub-agent-indicator';
            subAgent.textContent = cycle.subAgentCount;
            subAgent.title = `${cycle.subAgentCount} sub-agent(s)`;
            cycleDiv.appendChild(subAgent);
        }
        
        return cycleDiv;
    }

    renderEventFeed() {
        const eventFeed = document.getElementById('eventFeed');
        const eventFilter = document.getElementById('eventFilter').value;
        const instanceFilter = document.getElementById('instanceFilter').value;
        
        // Filter events
        const filteredEvents = this.events.filter(event => {
            if (eventFilter !== 'all' && event.type !== eventFilter) return false;
            if (instanceFilter !== 'all' && event.instance !== instanceFilter) return false;
            return true;
        });
        
        // Clear existing events
        eventFeed.innerHTML = '';
        
        // Render events (limit to last 100 for performance)
        filteredEvents.slice(0, 100).forEach(event => {
            const eventRow = this.createEventRow(event);
            eventFeed.appendChild(eventRow);
        });
        
        // Auto-scroll to top if enabled
        if (this.autoScroll && !this.isPaused) {
            eventFeed.scrollTop = 0;
        }
    }

    createEventRow(event) {
        const row = document.createElement('div');
        row.className = 'event-row';
        row.dataset.eventId = event.id;
        
        // Highlight recent events
        if (Date.now() - event.timestamp < 5000) {
            row.classList.add('highlight');
        }
        
        // Time
        const time = document.createElement('div');
        time.className = 'event-time';
        time.textContent = this.formatTime(event.timestamp);
        row.appendChild(time);
        
        // Instance
        const instance = document.createElement('div');
        instance.className = 'event-instance';
        instance.textContent = event.instance.replace('instance-', 'I');
        row.appendChild(instance);
        
        // Event type
        const type = document.createElement('div');
        type.className = `event-type ${event.type}`;
        type.textContent = event.type.replace('_', ' ');
        row.appendChild(type);
        
        // Tool (if applicable)
        const tool = document.createElement('div');
        tool.className = 'event-tool';
        tool.textContent = event.tool || '';
        row.appendChild(tool);
        
        // Description
        const description = document.createElement('div');
        description.className = 'event-description';
        description.textContent = event.description;
        description.title = event.description; // Full text on hover
        row.appendChild(description);
        
        // Status
        const status = document.createElement('div');
        status.className = `event-status status-${event.status}`;
        status.textContent = event.status;
        row.appendChild(status);
        
        return row;
    }

    updateTimelineScale() {
        // Update timeline labels based on scale
        const labels = document.querySelectorAll('.time-marker');
        const scales = {
            '1m': ['Now', '-10s', '-20s', '-30s', '-40s', '-50s'],
            '5m': ['Now', '-1m', '-2m', '-3m', '-4m', '-5m'],
            '10m': ['Now', '-2m', '-4m', '-6m', '-8m', '-10m'],
            '30m': ['Now', '-6m', '-12m', '-18m', '-24m', '-30m']
        };
        
        const scaleLabels = scales[this.timeScale] || scales['1m'];
        labels.forEach((label, index) => {
            if (scaleLabels[index]) {
                label.textContent = scaleLabels[index];
            }
        });
        
        // Re-render timeline with new scale
        this.renderTimeline();
    }

    startLiveUpdates() {
        // Simulate live updates every 2-5 seconds
        setInterval(() => {
            if (this.isPaused) return;
            
            this.addNewEvent();
            this.updateInstanceStatuses();
        }, Math.random() * 3000 + 2000);
        
        // Update timeline every 30 seconds
        setInterval(() => {
            if (this.isPaused) return;
            this.renderTimeline();
        }, 30000);
    }

    addNewEvent() {
        const instances = ['instance-1', 'instance-2', 'instance-3', 'instance-4', 'instance-5'];
        const tools = ['bash', 'read', 'write', 'grep', 'edit', 'glob'];
        const eventTypes = ['user_input', 'tool_use', 'agent_response', 'stop'];
        
        const instance = instances[Math.floor(Math.random() * instances.length)];
        const eventType = eventTypes[Math.floor(Math.random() * eventTypes.length)];
        let tool = null;
        
        if (eventType === 'tool_use') {
            tool = tools[Math.floor(Math.random() * tools.length)];
        }
        
        const newEvent = {
            id: `event-${Date.now()}-${Math.random()}`,
            timestamp: Date.now(),
            instance,
            type: eventType,
            tool,
            description: this.generateEventDescription(eventType, tool),
            status: Math.random() > 0.1 ? 'success' : 'pending',
            cycleId: eventType === 'user_input' ? `cycle-${Date.now()}` : null
        };
        
        // Add to beginning of events array
        this.events.unshift(newEvent);
        
        // Keep only last 200 events for performance
        if (this.events.length > 200) {
            this.events = this.events.slice(0, 200);
        }
        
        // Re-render event feed
        this.renderEventFeed();
    }

    updateInstanceStatuses() {
        // Randomly update instance statuses
        const waitingCount = Math.floor(Math.random() * 4) + 1;
        const activeCount = 8 - waitingCount;
        
        document.querySelector('.indicator.waiting').textContent = `${waitingCount} waiting`;
        document.querySelector('.indicator.active').textContent = `${activeCount} active`;
        
        // Update individual instance statuses
        document.querySelectorAll('.instance-status').forEach(status => {
            const isWaiting = Math.random() > 0.6;
            status.className = `instance-status ${isWaiting ? 'waiting' : 'active'}`;
            status.textContent = isWaiting ? '⏸' : '▶';
        });
    }

    formatTime(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleTimeString('en-US', {
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
    }

    formatDuration(duration) {
        const seconds = Math.floor(duration / 1000);
        if (seconds < 60) {
            return `${seconds}s`;
        }
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes}m ${remainingSeconds}s`;
    }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new ChronicleTimeline();
});