// Chronicle Dashboard - Variant 4: Productivity Monitor Script
// Hyphy mock data and interactive functionality

class ProductivityDashboard {
    constructor() {
        this.isPaused = false;
        this.agents = [];
        this.events = [];
        this.blockedAgents = [];
        this.pendingQueue = [];
        
        this.init();
        this.generateMockData();
        this.startUpdateCycle();
        this.setupEventListeners();
    }

    init() {
        this.elements = {
            pauseBtn: document.getElementById('pauseBtn'),
            lastUpdated: document.getElementById('lastUpdated'),
            blockedList: document.getElementById('blockedList'),
            agentGrid: document.getElementById('agentGrid'),
            eventList: document.getElementById('eventList'),
            queueList: document.getElementById('queueList'),
            statusFilter: document.getElementById('statusFilter'),
            eventFilter: document.getElementById('eventFilter'),
            blockedOnly: document.getElementById('blockedOnly'),
            timeRange: document.getElementById('timeRange')
        };
    }

    generateMockData() {
        // Generate 8 mock agents with various statuses
        this.agents = [
            {
                id: 'claude-001',
                name: 'Claude-001',
                status: 'waiting',
                currentTask: 'Waiting for user input on database schema design',
                currentTool: 'User Input Required',
                lastActivity: new Date(Date.now() - 2 * 60 * 1000),
                completedTasks: 15,
                activeTime: '2h 45m',
                waitingTime: '2m 15s'
            },
            {
                id: 'claude-002',
                name: 'Claude-002',
                status: 'active',
                currentTask: 'Implementing React component with TypeScript',
                currentTool: 'Edit',
                lastActivity: new Date(Date.now() - 30 * 1000),
                completedTasks: 23,
                activeTime: '3h 12m',
                waitingTime: null
            },
            {
                id: 'claude-003',
                name: 'Claude-003',
                status: 'waiting',
                currentTask: 'Blocked on code review feedback for API endpoints',
                currentTool: 'User Input Required',
                lastActivity: new Date(Date.now() - 8 * 60 * 1000),
                completedTasks: 8,
                activeTime: '1h 33m',
                waitingTime: '8m 42s'
            },
            {
                id: 'claude-004',
                name: 'Claude-004',
                status: 'active',
                currentTask: 'Running test suite and fixing failing unit tests',
                currentTool: 'Bash',
                lastActivity: new Date(Date.now() - 10 * 1000),
                completedTasks: 31,
                activeTime: '4h 18m',
                waitingTime: null
            },
            {
                id: 'claude-005',
                name: 'Claude-005',
                status: 'error',
                currentTask: 'Error: Docker container failed to start',
                currentTool: 'Bash',
                lastActivity: new Date(Date.now() - 5 * 60 * 1000),
                completedTasks: 12,
                activeTime: '2h 01m',
                waitingTime: null
            },
            {
                id: 'claude-006',
                name: 'Claude-006',
                status: 'active',
                currentTask: 'Refactoring authentication middleware',
                currentTool: 'MultiEdit',
                lastActivity: new Date(Date.now() - 45 * 1000),
                completedTasks: 19,
                activeTime: '2h 56m',
                waitingTime: null
            },
            {
                id: 'claude-007',
                name: 'Claude-007',
                status: 'waiting',
                currentTask: 'Needs approval for database migration strategy',
                currentTool: 'User Input Required',
                lastActivity: new Date(Date.now() - 12 * 60 * 1000),
                completedTasks: 7,
                activeTime: '1h 22m',
                waitingTime: '12m 18s'
            },
            {
                id: 'claude-008',
                name: 'Claude-008',
                status: 'idle',
                currentTask: 'Session completed - awaiting new task',
                currentTool: null,
                lastActivity: new Date(Date.now() - 20 * 60 * 1000),
                completedTasks: 42,
                activeTime: '0m',
                waitingTime: null
            }
        ];

        // Generate blocked agents (subset of agents with waiting status)
        this.blockedAgents = this.agents.filter(agent => agent.status === 'waiting');

        // Generate pending queue
        this.pendingQueue = [
            {
                agentId: 'claude-001',
                context: 'Database schema design approval needed',
                waitingTime: '2m 15s'
            },
            {
                agentId: 'claude-003',
                context: 'API endpoint code review feedback required',
                waitingTime: '8m 42s'
            },
            {
                agentId: 'claude-007',
                context: 'Database migration strategy confirmation',
                waitingTime: '12m 18s'
            }
        ];

        // Generate mock events
        this.generateMockEvents();
    }

    generateMockEvents() {
        const tools = ['Edit', 'Bash', 'Read', 'Write', 'MultiEdit', 'Grep', 'User Input'];
        const eventTypes = ['tool_use', 'completion', 'user_input', 'error'];
        const descriptions = [
            'Modified authentication.js with new validation logic',
            'Executed npm test command successfully',
            'Read configuration file for environment setup',
            'Created new React component UserProfile.tsx',
            'Updated multiple files in authentication module',
            'Searched for error patterns in log files',
            'Waiting for user confirmation on API changes',
            'Completed database migration script',
            'Error: Module not found in import statement',
            'Successfully deployed to staging environment'
        ];

        this.events = [];
        for (let i = 0; i < 50; i++) {
            const agent = this.agents[Math.floor(Math.random() * this.agents.length)];
            const tool = tools[Math.floor(Math.random() * tools.length)];
            const eventType = eventTypes[Math.floor(Math.random() * eventTypes.length)];
            const description = descriptions[Math.floor(Math.random() * descriptions.length)];
            
            this.events.push({
                id: `event-${i}`,
                timestamp: new Date(Date.now() - Math.random() * 15 * 60 * 1000),
                agentId: agent.id,
                agentName: agent.name,
                tool: tool,
                type: eventType,
                description: description,
                status: eventType === 'error' ? 'error' : 
                        eventType === 'user_input' ? 'waiting' : 'success'
            });
        }

        // Sort events by timestamp (newest first)
        this.events.sort((a, b) => b.timestamp - a.timestamp);
    }

    setupEventListeners() {
        this.elements.pauseBtn.addEventListener('click', () => {
            this.togglePause();
        });

        this.elements.statusFilter.addEventListener('change', () => {
            this.applyFilters();
        });

        this.elements.eventFilter.addEventListener('change', () => {
            this.applyFilters();
        });

        this.elements.blockedOnly.addEventListener('change', () => {
            this.applyFilters();
        });

        this.elements.timeRange.addEventListener('change', () => {
            this.applyFilters();
        });
    }

    togglePause() {
        this.isPaused = !this.isPaused;
        this.elements.pauseBtn.textContent = this.isPaused ? '▶️ Resume' : '⏸️ Pause';
        this.elements.pauseBtn.classList.toggle('paused', this.isPaused);
    }

    applyFilters() {
        // Filter agents
        let filteredAgents = [...this.agents];
        
        if (this.elements.statusFilter.value) {
            filteredAgents = filteredAgents.filter(agent => 
                agent.status === this.elements.statusFilter.value
            );
        }

        if (this.elements.blockedOnly.checked) {
            filteredAgents = filteredAgents.filter(agent => 
                agent.status === 'waiting'
            );
        }

        this.renderAgentGrid(filteredAgents);

        // Filter events
        let filteredEvents = [...this.events];
        
        if (this.elements.eventFilter.value) {
            filteredEvents = filteredEvents.filter(event => 
                event.type === this.elements.eventFilter.value
            );
        }

        // Time range filter
        const timeRange = this.elements.timeRange.value;
        const cutoffTime = new Date();
        switch (timeRange) {
            case '5m':
                cutoffTime.setMinutes(cutoffTime.getMinutes() - 5);
                break;
            case '15m':
                cutoffTime.setMinutes(cutoffTime.getMinutes() - 15);
                break;
            case '1h':
                cutoffTime.setHours(cutoffTime.getHours() - 1);
                break;
            case '4h':
                cutoffTime.setHours(cutoffTime.getHours() - 4);
                break;
        }

        filteredEvents = filteredEvents.filter(event => 
            event.timestamp >= cutoffTime
        );

        this.renderEventList(filteredEvents);
    }

    renderBlockedAgents() {
        if (this.blockedAgents.length === 0) {
            this.elements.blockedList.innerHTML = `
                <div style="text-align: center; color: #7d8590; padding: 20px; font-size: 12px;">
                    No agents currently blocked - all systems flowing! 🎯
                </div>
            `;
            return;
        }

        const html = this.blockedAgents.map(agent => `
            <div class="blocked-item ${agent.waitingTime && agent.waitingTime.includes('m') ? 'urgent' : ''}" 
                 onclick="dashboard.showAgentContext('${agent.id}')">
                <div class="blocked-info">
                    <div class="blocked-agent">${agent.name}</div>
                    <div class="blocked-task">${agent.currentTask}</div>
                </div>
                <div class="waiting-time">${agent.waitingTime || 'Just now'}</div>
            </div>
        `).join('');

        this.elements.blockedList.innerHTML = html;
    }

    renderAgentGrid(agents = this.agents) {
        const html = agents.map(agent => `
            <div class="agent-card status-${agent.status}" onclick="dashboard.showAgentContext('${agent.id}')">
                <div class="agent-header">
                    <div class="agent-name">${agent.name}</div>
                    <div class="status-indicator">${agent.status}</div>
                </div>
                <div class="current-task">${agent.currentTask}</div>
                <div class="agent-stats">
                    <span>Tool: ${agent.currentTool || 'None'}</span>
                    <span>Tasks: ${agent.completedTasks}</span>
                    <span>Active: ${agent.activeTime}</span>
                </div>
                ${agent.status === 'waiting' ? `
                    <button class="context-btn" onclick="event.stopPropagation(); dashboard.unblockAgent('${agent.id}')">
                        Unblock
                    </button>
                ` : ''}
            </div>
        `).join('');

        this.elements.agentGrid.innerHTML = html;
    }

    renderEventList(events = this.events) {
        const html = events.slice(0, 100).map(event => {
            const timeStr = this.formatTime(event.timestamp);
            const icon = this.getEventIcon(event.type);
            
            return `
                <div class="event-item">
                    <span class="event-icon">${icon}</span>
                    <span class="event-time">${timeStr}</span>
                    <span class="event-agent">${event.agentName}</span>
                    <span class="event-tool">${event.tool}</span>
                    <span class="event-description">${event.description}</span>
                    <span class="event-status ${event.status}">${event.status}</span>
                </div>
            `;
        }).join('');

        this.elements.eventList.innerHTML = html;
    }

    renderPendingQueue() {
        if (this.pendingQueue.length === 0) {
            this.elements.queueList.innerHTML = `
                <div style="text-align: center; color: #7d8590; padding: 20px; font-size: 12px;">
                    No pending responses - queue is clear! ✅
                </div>
            `;
            return;
        }

        const html = this.pendingQueue.map(item => {
            const agent = this.agents.find(a => a.id === item.agentId);
            return `
                <div class="queue-item">
                    <span class="queue-agent">${agent ? agent.name : item.agentId}</span>
                    <span class="queue-context">${item.context}</span>
                    <span class="queue-time">${item.waitingTime}</span>
                </div>
            `;
        }).join('');

        this.elements.queueList.innerHTML = html;
    }

    getEventIcon(type) {
        const icons = {
            'tool_use': '🔧',
            'completion': '✅',
            'user_input': '⏳',
            'error': '❌'
        };
        return icons[type] || '📝';
    }

    formatTime(date) {
        const now = new Date();
        const diff = Math.floor((now - date) / 1000);
        
        if (diff < 60) return `${diff}s`;
        if (diff < 3600) return `${Math.floor(diff / 60)}m`;
        return `${Math.floor(diff / 3600)}h`;
    }

    showAgentContext(agentId) {
        const agent = this.agents.find(a => a.id === agentId);
        if (agent) {
            alert(`Agent Context: ${agent.name}\n\nStatus: ${agent.status}\nCurrent Task: ${agent.currentTask}\nCurrent Tool: ${agent.currentTool}\nLast Activity: ${this.formatTime(agent.lastActivity)} ago\nCompleted Tasks: ${agent.completedTasks}`);
        }
    }

    unblockAgent(agentId) {
        const agent = this.agents.find(a => a.id === agentId);
        if (agent && agent.status === 'waiting') {
            agent.status = 'active';
            agent.currentTask = 'Resumed work after user input';
            agent.currentTool = 'Edit';
            agent.waitingTime = null;
            
            // Remove from blocked list
            this.blockedAgents = this.blockedAgents.filter(a => a.id !== agentId);
            
            // Remove from pending queue
            this.pendingQueue = this.pendingQueue.filter(item => item.agentId !== agentId);
            
            this.render();
        }
    }

    simulateNewActivity() {
        if (this.isPaused) return;

        // Occasionally update agent statuses
        if (Math.random() < 0.1) {
            const agent = this.agents[Math.floor(Math.random() * this.agents.length)];
            if (agent.status === 'active') {
                agent.lastActivity = new Date();
            }
        }

        // Occasionally add new events
        if (Math.random() < 0.3) {
            const agent = this.agents[Math.floor(Math.random() * this.agents.length)];
            const tools = ['Edit', 'Bash', 'Read', 'Write', 'MultiEdit', 'Grep'];
            const tool = tools[Math.floor(Math.random() * tools.length)];
            
            const newEvent = {
                id: `event-${Date.now()}`,
                timestamp: new Date(),
                agentId: agent.id,
                agentName: agent.name,
                tool: tool,
                type: 'tool_use',
                description: `Using ${tool} for current task`,
                status: 'success'
            };

            this.events.unshift(newEvent);
            this.events = this.events.slice(0, 100); // Keep only latest 100 events
        }
    }

    render() {
        this.renderBlockedAgents();
        this.renderAgentGrid();
        this.renderEventList();
        this.renderPendingQueue();
        this.elements.lastUpdated.textContent = new Date().toLocaleTimeString();
    }

    startUpdateCycle() {
        setInterval(() => {
            this.simulateNewActivity();
            this.render();
        }, 2000); // Update every 2 seconds

        // Initial render
        this.render();
    }
}

// Initialize dashboard when page loads
let dashboard;
document.addEventListener('DOMContentLoaded', () => {
    dashboard = new ProductivityDashboard();
});