// Chronicle Dashboard - Multi-Instance Sub-Agent Monitor
// Advanced JavaScript for handling 10-30 Claude Code instances with sub-agent visualization

class ChronicleMultiInstanceDashboard {
    constructor() {
        this.isPaused = false;
        this.instances = new Map();
        this.events = [];
        this.filters = {
            instance: 'all',
            eventType: 'all',
            timeRange: '4h'
        };
        
        this.init();
        this.generateMockData();
        this.startEventStream();
    }

    init() {
        this.bindEventListeners();
        this.setupInstanceGroups();
        this.updateUI();
    }

    bindEventListeners() {
        // Pause button
        document.getElementById('pauseBtn').addEventListener('click', () => {
            this.togglePause();
        });

        // Filter dropdowns
        document.getElementById('instanceFilter').addEventListener('change', (e) => {
            this.filters.instance = e.target.value;
            this.filterAndRenderEvents();
        });

        document.getElementById('eventTypeFilter').addEventListener('change', (e) => {
            this.filters.eventType = e.target.value;
            this.filterAndRenderEvents();
        });

        // Time filter buttons
        document.querySelectorAll('.time-filter').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.time-filter').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.filters.timeRange = e.target.dataset.time;
                this.filterAndRenderEvents();
            });
        });

        // Blocked alert
        document.querySelector('.view-blocked-btn').addEventListener('click', () => {
            this.showBlockedSessions();
        });
    }

    generateMockData() {
        // Generate 12 Claude Code instances with varying states
        const instanceConfigs = [
            { id: 'instance-1', name: 'Main', status: 'active', task: 'File analysis', subAgents: 2 },
            { id: 'instance-2', name: 'Analysis', status: 'blocked', task: 'Code review', subAgents: 1 },
            { id: 'instance-3', name: 'Testing', status: 'active', task: 'Test suite', subAgents: 3 },
            { id: 'instance-4', name: 'Deploy', status: 'active', task: 'CI/CD pipeline', subAgents: 1 },
            { id: 'instance-5', name: 'Research', status: 'blocked', task: 'Documentation', subAgents: 2 },
            { id: 'instance-6', name: 'Debug', status: 'active', task: 'Error tracking', subAgents: 1 },
            { id: 'instance-7', name: 'Optimize', status: 'active', task: 'Performance', subAgents: 2 },
            { id: 'instance-8', name: 'Security', status: 'active', task: 'Audit scan', subAgents: 1 },
            { id: 'instance-9', name: 'Migrate', status: 'active', task: 'Data migration', subAgents: 2 },
            { id: 'instance-10', name: 'Monitor', status: 'active', task: 'Health check', subAgents: 1 },
            { id: 'instance-11', name: 'Backup', status: 'blocked', task: 'Data backup', subAgents: 1 },
            { id: 'instance-12', name: 'Scale', status: 'active', task: 'Auto-scaling', subAgents: 2 }
        ];

        instanceConfigs.forEach(config => {
            const instance = this.createInstance(config);
            this.instances.set(config.id, instance);
        });

        // Generate mock events with sub-agent hierarchy
        this.generateMockEvents();
    }

    createInstance(config) {
        const subAgents = [];
        
        // Generate sub-agents for this instance
        for (let i = 0; i < config.subAgents; i++) {
            const subAgent = {
                id: `${config.id}-sub-${i + 1}`,
                name: `Sub-Agent ${i + 1}`,
                level: Math.floor(Math.random() * 3), // 0-2 nesting levels
                status: Math.random() > 0.7 ? 'waiting' : 'running',
                currentTool: this.getRandomTool(),
                parentId: config.id
            };
            subAgents.push(subAgent);
        }

        return {
            ...config,
            subAgents,
            collapsed: false,
            lastActivity: new Date(),
            eventCount: Math.floor(Math.random() * 50) + 10
        };
    }

    generateMockEvents() {
        const tools = ['Read', 'Write', 'Bash', 'Grep', 'Task', 'Edit', 'MultiEdit'];
        const descriptions = [
            'Processing file analysis request',
            'Executing shell command',
            'Searching codebase for patterns', 
            'Creating new component file',
            'Running test suite',
            'Updating configuration',
            'Deploying to staging',
            'Analyzing performance metrics',
            'Checking security vulnerabilities',
            'Backing up database',
            'Monitoring system health',
            'Scaling infrastructure'
        ];

        // Generate 1247 events across all instances
        for (let i = 0; i < 1247; i++) {
            const instanceIds = Array.from(this.instances.keys());
            const instanceId = instanceIds[Math.floor(Math.random() * instanceIds.length)];
            const instance = this.instances.get(instanceId);
            
            // Determine if this is a sub-agent event (30% chance)
            const isSubAgent = Math.random() < 0.3 && instance.subAgents.length > 0;
            let subAgentLevel = 0;
            let parentAgent = null;
            
            if (isSubAgent) {
                const subAgent = instance.subAgents[Math.floor(Math.random() * instance.subAgents.length)];
                subAgentLevel = subAgent.level + 1;
                parentAgent = subAgent.id;
            }

            const event = {
                id: `event-${i}`,
                timestamp: new Date(Date.now() - Math.random() * 4 * 60 * 60 * 1000), // Last 4 hours
                instanceId,
                instanceName: instance.name,
                tool: tools[Math.floor(Math.random() * tools.length)],
                description: descriptions[Math.floor(Math.random() * descriptions.length)],
                status: Math.random() > 0.1 ? 'success' : (Math.random() > 0.5 ? 'error' : 'waiting'),
                isSubAgent,
                subAgentLevel,
                parentAgent,
                type: isSubAgent ? 'agent' : 'tool'
            };

            this.events.push(event);
        }

        // Sort events by timestamp (newest first)
        this.events.sort((a, b) => b.timestamp - a.timestamp);
    }

    getRandomTool() {
        const tools = ['Read', 'Write', 'Bash', 'Grep', 'Task', 'Edit'];
        return tools[Math.floor(Math.random() * tools.length)];
    }

    setupInstanceGroups() {
        const container = document.getElementById('instanceGroups');
        container.innerHTML = '';

        this.instances.forEach((instance, instanceId) => {
            const groupElement = this.createInstanceGroupElement(instance);
            container.appendChild(groupElement);
        });
    }

    createInstanceGroupElement(instance) {
        const group = document.createElement('div');
        group.className = 'instance-group';
        group.setAttribute('data-instance-id', instance.id);

        const header = document.createElement('div');
        header.className = `instance-header ${instance.collapsed ? 'collapsed' : ''}`;
        
        header.innerHTML = `
            <div class="instance-info">
                <div class="instance-status ${instance.status}"></div>
                <div>
                    <div class="instance-name">${instance.name}</div>
                    <div class="instance-meta">${instance.task} • ${instance.eventCount} events</div>
                </div>
            </div>
            <div class="collapse-icon ${instance.collapsed ? 'collapsed' : ''}">▼</div>
        `;

        header.addEventListener('click', () => {
            instance.collapsed = !instance.collapsed;
            this.toggleInstanceGroup(instance.id);
        });

        group.appendChild(header);

        // Sub-agents container
        if (!instance.collapsed && instance.subAgents.length > 0) {
            const subAgentsContainer = document.createElement('div');
            subAgentsContainer.className = 'sub-agents';

            instance.subAgents.forEach(subAgent => {
                const subAgentElement = document.createElement('div');
                subAgentElement.className = `sub-agent level-${subAgent.level}`;
                
                subAgentElement.innerHTML = `
                    <div class="sub-agent-status ${subAgent.status}"></div>
                    <div class="sub-agent-name">${subAgent.name}</div>
                    <div class="sub-agent-tool">${subAgent.currentTool}</div>
                `;

                subAgentsContainer.appendChild(subAgentElement);
            });

            group.appendChild(subAgentsContainer);
        }

        return group;
    }

    toggleInstanceGroup(instanceId) {
        const instance = this.instances.get(instanceId);
        const groupElement = document.querySelector(`[data-instance-id="${instanceId}"]`);
        const header = groupElement.querySelector('.instance-header');
        const collapseIcon = header.querySelector('.collapse-icon');
        
        header.classList.toggle('collapsed');
        collapseIcon.classList.toggle('collapsed');

        // Remove existing sub-agents container
        const existingSubAgents = groupElement.querySelector('.sub-agents');
        if (existingSubAgents) {
            existingSubAgents.remove();
        }

        // Add sub-agents if not collapsed
        if (!instance.collapsed && instance.subAgents.length > 0) {
            const subAgentsContainer = document.createElement('div');
            subAgentsContainer.className = 'sub-agents';

            instance.subAgents.forEach(subAgent => {
                const subAgentElement = document.createElement('div');
                subAgentElement.className = `sub-agent level-${subAgent.level}`;
                
                subAgentElement.innerHTML = `
                    <div class="sub-agent-status ${subAgent.status}"></div>
                    <div class="sub-agent-name">${subAgent.name}</div>
                    <div class="sub-agent-tool">${subAgent.currentTool}</div>
                `;

                subAgentsContainer.appendChild(subAgentElement);
            });

            groupElement.appendChild(subAgentsContainer);
        }
    }

    filterAndRenderEvents() {
        let filteredEvents = [...this.events];

        // Filter by instance
        if (this.filters.instance !== 'all') {
            if (this.filters.instance === 'blocked') {
                const blockedInstances = Array.from(this.instances.values())
                    .filter(instance => instance.status === 'blocked')
                    .map(instance => instance.id);
                filteredEvents = filteredEvents.filter(event => 
                    blockedInstances.includes(event.instanceId)
                );
            } else if (this.filters.instance === 'active') {
                const activeInstances = Array.from(this.instances.values())
                    .filter(instance => instance.status === 'active')
                    .map(instance => instance.id);
                filteredEvents = filteredEvents.filter(event => 
                    activeInstances.includes(event.instanceId)
                );
            } else {
                filteredEvents = filteredEvents.filter(event => 
                    event.instanceId === this.filters.instance
                );
            }
        }

        // Filter by event type
        if (this.filters.eventType !== 'all') {
            filteredEvents = filteredEvents.filter(event => 
                event.type === this.filters.eventType || 
                (this.filters.eventType === 'tool' && !event.isSubAgent)
            );
        }

        // Filter by time range
        const timeRangeHours = {
            '1h': 1,
            '4h': 4,
            '24h': 24
        };
        
        const cutoffTime = new Date(Date.now() - timeRangeHours[this.filters.timeRange] * 60 * 60 * 1000);
        filteredEvents = filteredEvents.filter(event => event.timestamp > cutoffTime);

        this.renderEvents(filteredEvents);
    }

    renderEvents(events) {
        const container = document.getElementById('eventList');
        container.innerHTML = '';

        events.slice(0, 200).forEach(event => { // Limit to 200 for performance
            const eventElement = this.createEventElement(event);
            container.appendChild(eventElement);
        });

        // Update event count
        document.querySelector('.event-count').textContent = `${events.length} events`;
    }

    createEventElement(event) {
        const element = document.createElement('div');
        const classes = ['event-item'];
        
        if (event.isSubAgent) {
            classes.push('sub-agent');
            if (event.subAgentLevel > 1) {
                classes.push(`level-${event.subAgentLevel}`);
            }
        }
        
        element.className = classes.join(' ');

        const timeStr = event.timestamp.toLocaleTimeString('en-US', { 
            hour12: false, 
            hour: '2-digit', 
            minute: '2-digit' 
        });

        element.innerHTML = `
            <div class="event-time">${timeStr}</div>
            <div class="event-instance">${event.instanceName}</div>
            <div class="event-tool ${event.tool.toLowerCase()}">${event.tool}</div>
            <div class="event-description">${event.description}</div>
            <div class="event-status ${event.status}"></div>
        `;

        return element;
    }

    togglePause() {
        this.isPaused = !this.isPaused;
        const btn = document.getElementById('pauseBtn');
        
        if (this.isPaused) {
            btn.classList.add('paused');
            btn.innerHTML = '<span class="pause-icon">▶️</span> Resume';
        } else {
            btn.classList.remove('paused');
            btn.innerHTML = '<span class="pause-icon">⏸️</span> Pause';
        }
    }

    updateUI() {
        // Update instance stats
        const activeCount = Array.from(this.instances.values()).filter(i => i.status === 'active').length;
        const blockedCount = Array.from(this.instances.values()).filter(i => i.status === 'blocked').length;
        
        document.getElementById('activeInstances').textContent = activeCount;
        document.getElementById('blockedInstances').textContent = blockedCount;

        // Show/hide blocked alert
        const blockedAlert = document.getElementById('blockedAlert');
        if (blockedCount > 0) {
            blockedAlert.classList.add('visible');
            document.querySelector('.blocked-text').textContent = 
                `${blockedCount} session${blockedCount > 1 ? 's' : ''} awaiting user input`;
        } else {
            blockedAlert.classList.remove('visible');
        }

        // Update instance filter dropdown
        const instanceFilter = document.getElementById('instanceFilter');
        instanceFilter.innerHTML = `
            <option value="all">All Instances (${this.instances.size})</option>
            ${Array.from(this.instances.values()).map(instance => 
                `<option value="${instance.id}">${instance.name} (${instance.name})</option>`
            ).join('')}
            <option value="blocked">Blocked Only (${blockedCount})</option>
            <option value="active">Active Only (${activeCount})</option>
        `;
    }

    showBlockedSessions() {
        // Filter to show only blocked sessions
        document.getElementById('instanceFilter').value = 'blocked';
        this.filters.instance = 'blocked';
        this.filterAndRenderEvents();
        
        // Hide the alert
        document.getElementById('blockedAlert').classList.remove('visible');
    }

    startEventStream() {
        // Simulate real-time events
        setInterval(() => {
            if (!this.isPaused) {
                this.simulateNewEvent();
                this.updateInstanceActivity();
            }
        }, 2000);

        // Initial render
        this.filterAndRenderEvents();
    }

    simulateNewEvent() {
        const instanceIds = Array.from(this.instances.keys());
        const instanceId = instanceIds[Math.floor(Math.random() * instanceIds.length)];
        const instance = this.instances.get(instanceId);
        
        const isSubAgent = Math.random() < 0.3 && instance.subAgents.length > 0;
        let subAgentLevel = 0;
        
        if (isSubAgent) {
            const subAgent = instance.subAgents[Math.floor(Math.random() * instance.subAgents.length)];
            subAgentLevel = subAgent.level + 1;
        }

        const newEvent = {
            id: `event-${Date.now()}`,
            timestamp: new Date(),
            instanceId,
            instanceName: instance.name,
            tool: this.getRandomTool(),
            description: 'Real-time event simulation',
            status: Math.random() > 0.1 ? 'success' : 'waiting',
            isSubAgent,
            subAgentLevel,
            type: isSubAgent ? 'agent' : 'tool'
        };

        this.events.unshift(newEvent);
        
        // Keep only last 2000 events for performance
        if (this.events.length > 2000) {
            this.events = this.events.slice(0, 2000);
        }

        this.filterAndRenderEvents();
    }

    updateInstanceActivity() {
        // Randomly update instance statuses
        if (Math.random() < 0.1) { // 10% chance per interval
            const instances = Array.from(this.instances.values());
            const randomInstance = instances[Math.floor(Math.random() * instances.length)];
            
            // Toggle between active and blocked occasionally
            if (randomInstance.status === 'blocked' && Math.random() < 0.3) {
                randomInstance.status = 'active';
            } else if (randomInstance.status === 'active' && Math.random() < 0.05) {
                randomInstance.status = 'blocked';
            }
            
            this.setupInstanceGroups();
            this.updateUI();
        }
    }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.dashboard = new ChronicleMultiInstanceDashboard();
});