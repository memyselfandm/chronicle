// Ultra-Minimal Dashboard - Focus on Essential Information Only
class MinimalDashboard {
    constructor() {
        this.blockedAgents = [
            {
                id: 'claude-001',
                name: 'project-analyzer',
                waitingFor: 'user decision on refactoring approach',
                blockedSince: new Date(Date.now() - 45 * 60000) // 45 minutes ago
            },
            {
                id: 'claude-003', 
                name: 'api-designer',
                waitingFor: 'confirmation to modify database schema',
                blockedSince: new Date(Date.now() - 12 * 60000) // 12 minutes ago
            }
        ];

        this.activeTools = [
            {
                name: 'file-search',
                instance: 'claude-002',
                startTime: new Date(Date.now() - 30000), // 30 seconds ago
                duration: '30s'
            },
            {
                name: 'code-analysis',
                instance: 'claude-004',
                startTime: new Date(Date.now() - 2 * 60000), // 2 minutes ago
                duration: '2m'
            }
        ];

        this.recentEvents = [
            {
                description: 'api tests completed successfully',
                instance: 'claude-002',
                time: new Date(Date.now() - 2 * 60000),
                type: 'success',
                autoHide: true
            },
            {
                description: 'database migration finished',
                instance: 'claude-005',
                time: new Date(Date.now() - 4 * 60000),
                type: 'success',
                autoHide: true
            },
            {
                description: 'code review suggestions generated',
                instance: 'claude-001',
                time: new Date(Date.now() - 7 * 60000),
                type: 'success',
                autoHide: false
            },
            {
                description: 'documentation updated',
                instance: 'claude-003',
                time: new Date(Date.now() - 12 * 60000),
                type: 'success',
                autoHide: false
            },
            {
                description: 'error in file processing',
                instance: 'claude-006',
                time: new Date(Date.now() - 15 * 60000),
                type: 'error',
                autoHide: false
            }
        ];

        this.connected = true;
        this.init();
    }

    init() {
        this.updateStatusIndicator();
        this.renderBlockedAgents();
        this.renderActiveTools();
        this.renderRecentEvents();
        
        // Update active tool durations every second
        setInterval(() => this.updateActiveDurations(), 1000);
        
        // Auto-hide successful events after 30 seconds
        setInterval(() => this.autoHideEvents(), 5000);
        
        // Simulate real-time updates
        this.startSimulation();
    }

    updateStatusIndicator() {
        const indicator = document.getElementById('statusIndicator');
        if (this.connected) {
            indicator.classList.remove('disconnected');
        } else {
            indicator.classList.add('disconnected');
        }
    }

    renderBlockedAgents() {
        const countElement = document.getElementById('blockedCount');
        const listElement = document.getElementById('blockedList');

        countElement.textContent = this.blockedAgents.length;

        if (this.blockedAgents.length === 0) {
            listElement.innerHTML = '<div class="empty-state good">All agents are active</div>';
            return;
        }

        listElement.innerHTML = this.blockedAgents.map(agent => `
            <div class="blocked-item" tabindex="0">
                <div class="instance-name">${agent.name}</div>
                <div class="waiting-for">${agent.waitingFor}</div>
                <div class="timestamp">blocked ${this.getRelativeTime(agent.blockedSince)}</div>
            </div>
        `).join('');
    }

    renderActiveTools() {
        const listElement = document.getElementById('toolsList');

        if (this.activeTools.length === 0) {
            listElement.innerHTML = '<div class="empty-state">No tools currently running</div>';
            return;
        }

        listElement.innerHTML = this.activeTools.map(tool => `
            <div class="tool-item" tabindex="0">
                <div>
                    <div class="tool-name">${tool.name}</div>
                    <div class="tool-instance">${tool.instance}</div>
                </div>
                <div class="tool-duration">${tool.duration}</div>
            </div>
        `).join('');
    }

    renderRecentEvents() {
        const listElement = document.getElementById('eventsList');
        
        // Filter out hidden events
        const visibleEvents = this.recentEvents.filter(event => !event.hidden);

        if (visibleEvents.length === 0) {
            listElement.innerHTML = '<div class="empty-state">No recent activity</div>';
            return;
        }

        listElement.innerHTML = visibleEvents.map(event => `
            <div class="event-item ${event.fading ? 'fading' : ''}" tabindex="0">
                <div class="event-description ${event.type === 'error' ? 'event-error' : 'event-success'}">
                    ${event.description}
                </div>
                <div class="event-time">${this.getRelativeTime(event.time)}</div>
            </div>
        `).join('');
    }

    updateActiveDurations() {
        this.activeTools.forEach(tool => {
            const elapsed = Math.floor((Date.now() - tool.startTime.getTime()) / 1000);
            if (elapsed < 60) {
                tool.duration = `${elapsed}s`;
            } else {
                const minutes = Math.floor(elapsed / 60);
                const seconds = elapsed % 60;
                tool.duration = seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
            }
        });

        this.renderActiveTools();
    }

    autoHideEvents() {
        const now = Date.now();
        let changed = false;

        this.recentEvents.forEach(event => {
            if (event.autoHide && !event.fading && !event.hidden) {
                const age = now - event.time.getTime();
                // Start fading at 25 seconds, hide at 30 seconds
                if (age > 25000 && age <= 30000) {
                    event.fading = true;
                    changed = true;
                } else if (age > 30000) {
                    event.hidden = true;
                    changed = true;
                }
            }
        });

        if (changed) {
            this.renderRecentEvents();
        }
    }

    getRelativeTime(date) {
        const now = Date.now();
        const diff = now - date.getTime();
        const minutes = Math.floor(diff / 60000);
        const seconds = Math.floor(diff / 1000);

        if (minutes === 0) {
            return `${seconds}s ago`;
        } else if (minutes === 1) {
            return '1m ago';
        } else if (minutes < 60) {
            return `${minutes}m ago`;
        } else {
            const hours = Math.floor(minutes / 60);
            return `${hours}h ago`;
        }
    }

    // Simulate realistic changes for demo
    startSimulation() {
        // Occasionally resolve blocked agents
        setTimeout(() => {
            if (this.blockedAgents.length > 0 && Math.random() > 0.5) {
                const resolved = this.blockedAgents.shift();
                this.addRecentEvent(`${resolved.name} resumed after user input`, 'success');
                this.renderBlockedAgents();
            }
        }, 15000);

        // Complete active tools
        setTimeout(() => {
            if (this.activeTools.length > 0) {
                const completed = this.activeTools.shift();
                this.addRecentEvent(`${completed.name} completed successfully`, 'success');
                this.renderActiveTools();
            }
        }, 20000);

        // Add new blocked agent
        setTimeout(() => {
            this.blockedAgents.push({
                id: 'claude-007',
                name: 'security-scanner',
                waitingFor: 'permission to access production logs',
                blockedSince: new Date()
            });
            this.renderBlockedAgents();
        }, 35000);

        // Add new active tool
        setTimeout(() => {
            this.activeTools.push({
                name: 'dependency-check',
                instance: 'claude-008',
                startTime: new Date(),
                duration: '1s'
            });
            this.renderActiveTools();
        }, 40000);
    }

    addRecentEvent(description, type = 'success') {
        // Remove oldest events to keep list manageable
        if (this.recentEvents.length > 8) {
            this.recentEvents.pop();
        }

        this.recentEvents.unshift({
            description,
            time: new Date(),
            type,
            autoHide: type === 'success'
        });

        this.renderRecentEvents();
    }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new MinimalDashboard();
});