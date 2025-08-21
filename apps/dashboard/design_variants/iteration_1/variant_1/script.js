// Chronicle Dashboard - Ultra Dense Monitoring Script

class DashboardController {
    constructor() {
        this.events = [];
        this.chartData = [];
        this.currentFilter = 'all';
        this.sessionCount = 3;
        this.isConnected = true;
        
        this.eventTypes = {
            user_prompt: { color: '#3b82f6', weight: 0.25 },
            tool_use: { color: '#10b981', weight: 0.45 },
            error: { color: '#ef4444', weight: 0.1 },
            notification: { color: '#f59e0b', weight: 0.2 }
        };
        
        this.tools = [
            'Read', 'Write', 'Bash', 'Grep', 'LS', 'Edit', 'Glob', 'WebFetch',
            'MultiEdit', 'TodoWrite', 'ExitPlanMode', 'NotebookEdit'
        ];
        
        this.init();
    }
    
    init() {
        this.generateInitialData();
        this.setupEventListeners();
        this.startRealTimeUpdates();
        this.updateChart();
        this.renderEventFeed();
        this.updateTimestamp();
    }
    
    generateInitialData() {
        const now = Date.now();
        const tenMinutesAgo = now - (10 * 60 * 1000);
        
        // Generate chart data for last 10 minutes (60 intervals of 10 seconds each)
        this.chartData = [];
        for (let i = 0; i < 60; i++) {
            const timestamp = tenMinutesAgo + (i * 10 * 1000);
            const interval = {
                timestamp,
                user_prompt: Math.floor(Math.random() * 8),
                tool_use: Math.floor(Math.random() * 15) + 5,
                error: Math.floor(Math.random() * 3),
                notification: Math.floor(Math.random() * 5)
            };
            this.chartData.push(interval);
        }
        
        // Generate recent events for the feed (last 500 events)
        this.events = [];
        for (let i = 0; i < 500; i++) {
            const eventTime = now - (i * 2000) - Math.random() * 5000; // Events every 2-7 seconds
            this.events.unshift(this.generateRandomEvent(eventTime, i));
        }
        
        // Sort events by timestamp (newest first)
        this.events.sort((a, b) => b.timestamp - a.timestamp);
    }
    
    generateRandomEvent(timestamp, id) {
        const types = Object.keys(this.eventTypes);
        const weights = types.map(type => this.eventTypes[type].weight);
        const eventType = this.weightedRandom(types, weights);
        
        const event = {
            id: `evt_${id}_${timestamp}`,
            timestamp,
            type: eventType,
            session: `s${Math.floor(Math.random() * 12) + 1}`,
            tool: eventType === 'tool_use' ? this.tools[Math.floor(Math.random() * this.tools.length)] : null,
            description: this.generateEventDescription(eventType)
        };
        
        return event;
    }
    
    generateEventDescription(eventType) {
        const descriptions = {
            user_prompt: [
                'User submitted code review request',
                'New project analysis started',
                'Debug assistance requested',
                'File modification inquiry',
                'API integration question',
                'Performance optimization query',
                'Database schema discussion',
                'Testing strategy consultation'
            ],
            tool_use: [
                'Reading configuration files',
                'Searching codebase patterns',
                'Executing system commands',
                'Modifying project files',
                'Analyzing log outputs',
                'Validating file structures',
                'Fetching external resources',
                'Processing batch operations'
            ],
            error: [
                'File access permission denied',
                'Network timeout occurred',
                'Invalid syntax detected',
                'Missing dependency error',
                'Database connection failed',
                'Memory allocation exceeded',
                'Concurrent modification conflict',
                'Authentication failure'
            ],
            notification: [
                'Session requires user input',
                'Long-running task completed',
                'Security scan finished',
                'Backup process initiated',
                'System maintenance scheduled',
                'Performance alert triggered',
                'Resource usage warning',
                'Update available notification'
            ]
        };
        
        const typeDescriptions = descriptions[eventType];
        return typeDescriptions[Math.floor(Math.random() * typeDescriptions.length)];
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
    
    setupEventListeners() {
        // Filter buttons
        document.querySelectorAll('.control-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.control-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.currentFilter = e.target.dataset.filter;
                this.renderEventFeed();
            });
        });
        
        // Simulate connection status changes
        setInterval(() => {
            if (Math.random() < 0.05) { // 5% chance every interval
                this.simulateConnectionChange();
            }
        }, 5000);
    }
    
    startRealTimeUpdates() {
        // Add new events every 1-3 seconds
        setInterval(() => {
            this.addNewEvent();
        }, 1000 + Math.random() * 2000);
        
        // Update chart every 10 seconds
        setInterval(() => {
            this.updateChartData();
        }, 10000);
        
        // Update timestamp every second
        setInterval(() => {
            this.updateTimestamp();
        }, 1000);
        
        // Update session count occasionally
        setInterval(() => {
            if (Math.random() < 0.3) {
                this.updateSessionCount();
            }
        }, 15000);
    }
    
    addNewEvent() {
        const newEvent = this.generateRandomEvent(Date.now(), Date.now());
        this.events.unshift(newEvent);
        
        // Keep only last 1000 events for performance
        if (this.events.length > 1000) {
            this.events = this.events.slice(0, 1000);
        }
        
        this.renderEventFeed();
        
        // Update session count if it's a notification
        if (newEvent.type === 'notification' && Math.random() < 0.4) {
            this.sessionCount = Math.max(1, this.sessionCount + (Math.random() < 0.5 ? 1 : -1));
            this.updateSessionsDisplay();
        }
    }
    
    updateChartData() {
        const now = Date.now();
        const newInterval = {
            timestamp: now,
            user_prompt: Math.floor(Math.random() * 8),
            tool_use: Math.floor(Math.random() * 15) + 5,
            error: Math.floor(Math.random() * 3),
            notification: Math.floor(Math.random() * 5)
        };
        
        this.chartData.push(newInterval);
        
        // Keep only last 60 intervals (10 minutes)
        if (this.chartData.length > 60) {
            this.chartData.shift();
        }
        
        this.updateChart();
    }
    
    updateChart() {
        const canvas = document.getElementById('eventChart');
        const ctx = canvas.getContext('2d');
        
        // Set canvas size
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * window.devicePixelRatio;
        canvas.height = rect.height * window.devicePixelRatio;
        ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
        
        const width = rect.width;
        const height = rect.height;
        
        // Clear canvas
        ctx.fillStyle = '#1a1f2e';
        ctx.fillRect(0, 0, width, height);
        
        if (this.chartData.length === 0) return;
        
        const barWidth = width / this.chartData.length;
        const maxTotal = Math.max(...this.chartData.map(d => 
            d.user_prompt + d.tool_use + d.error + d.notification
        ));
        
        // Draw bars
        this.chartData.forEach((data, index) => {
            const x = index * barWidth;
            let y = height;
            
            // Stack the event types
            const types = ['user_prompt', 'tool_use', 'error', 'notification'];
            types.forEach(type => {
                const value = data[type];
                const barHeight = (value / maxTotal) * height * 0.8;
                
                ctx.fillStyle = this.eventTypes[type].color;
                ctx.fillRect(x, y - barHeight, barWidth - 1, barHeight);
                
                y -= barHeight;
            });
        });
        
        // Draw time axis labels
        ctx.fillStyle = '#64748b';
        ctx.font = '8px Monaco';
        ctx.textAlign = 'center';
        
        for (let i = 0; i < this.chartData.length; i += 12) { // Every 2 minutes
            const x = i * barWidth + barWidth / 2;
            const time = new Date(this.chartData[i].timestamp);
            const timeStr = time.toTimeString().substr(3, 5); // MM:SS
            ctx.fillText(timeStr, x, height - 2);
        }
    }
    
    renderEventFeed() {
        const container = document.getElementById('eventFeed');
        const filteredEvents = this.currentFilter === 'all' 
            ? this.events 
            : this.events.filter(event => event.type === this.currentFilter);
        
        // Render only visible events for performance (virtual scrolling concept)
        const visibleEvents = filteredEvents.slice(0, 200);
        
        container.innerHTML = visibleEvents.map(event => {
            const time = new Date(event.timestamp);
            const timeStr = time.toTimeString().substr(0, 8);
            
            return `
                <div class="event-row ${event.type}" data-event-id="${event.id}">
                    <div class="event-timestamp">${timeStr}</div>
                    <div class="event-type ${event.type}">${event.type.replace('_', ' ')}</div>
                    <div class="event-tool">${event.tool || ''}</div>
                    <div class="event-description">${event.description}</div>
                    <div class="event-session">${event.session}</div>
                </div>
            `;
        }).join('');
        
        // Auto-scroll to maintain position unless user has manually scrolled
        if (container.scrollTop === 0 || container.scrollTop < 50) {
            container.scrollTop = 0;
        }
    }
    
    updateTimestamp() {
        const now = new Date();
        const timeStr = now.toTimeString().substr(0, 8);
        document.getElementById('currentTime').textContent = timeStr;
    }
    
    updateSessionsDisplay() {
        document.getElementById('activeSessions').textContent = this.sessionCount;
    }
    
    updateSessionCount() {
        const change = Math.random() < 0.6 ? 1 : -1;
        this.sessionCount = Math.max(0, Math.min(15, this.sessionCount + change));
        this.updateSessionsDisplay();
    }
    
    simulateConnectionChange() {
        const statusElement = document.getElementById('connectionStatus');
        const dot = statusElement.querySelector('.status-dot');
        const text = statusElement.querySelector('.status-text');
        
        if (this.isConnected) {
            // Simulate temporary disconnection
            dot.className = 'status-dot status-warning';
            text.textContent = 'RECONNECTING';
            text.style.color = '#f59e0b';
            
            setTimeout(() => {
                dot.className = 'status-dot status-connected';
                text.textContent = 'CONNECTED';
                text.style.color = '#10b981';
            }, 2000 + Math.random() * 3000);
        }
    }
}

// Initialize dashboard when page loads
document.addEventListener('DOMContentLoaded', () => {
    window.dashboard = new DashboardController();
});

// Handle window resize for chart
window.addEventListener('resize', () => {
    if (window.dashboard) {
        setTimeout(() => window.dashboard.updateChart(), 100);
    }
});