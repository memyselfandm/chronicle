// Mock data generation and chart functionality
class ChronicleMinimalistDashboard {
    constructor() {
        this.canvas = document.getElementById('eventChart');
        this.ctx = this.canvas.getContext('2d');
        this.eventFeed = document.getElementById('eventFeed');
        this.statusDot = document.getElementById('statusDot');
        this.statusText = document.getElementById('statusText');
        this.sessionsCounter = document.getElementById('sessionsCounter');
        
        this.events = [];
        this.consolidatedEvents = [];
        this.currentFilter = 'all';
        this.chartData = this.generateChartData();
        
        this.init();
    }

    init() {
        this.setupCanvas();
        this.generateMockData();
        this.consolidateEvents();
        this.renderChart();
        this.renderEventFeed();
        this.setupEventListeners();
        this.simulateRealTimeUpdates();
    }

    setupCanvas() {
        const rect = this.canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        
        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;
        
        this.ctx.scale(dpr, dpr);
        this.canvas.style.width = rect.width + 'px';
        this.canvas.style.height = rect.height + 'px';
    }

    generateChartData() {
        const data = [];
        const now = Date.now();
        const timeSlots = 60; // 10 minutes in 10-second intervals
        
        for (let i = timeSlots; i >= 0; i--) {
            const timestamp = now - (i * 10000); // 10 seconds ago
            data.push({
                timestamp,
                toolUse: Math.floor(Math.random() * 8),
                userInput: Math.floor(Math.random() * 3),
                systemEvent: Math.floor(Math.random() * 2)
            });
        }
        
        return data;
    }

    generateMockData() {
        const now = Date.now();
        const events = [];
        
        // Generate clusters of events to simulate realistic usage patterns
        const clusters = [
            { time: now - 45000, type: 'burst', count: 7 },
            { time: now - 180000, type: 'sequence', count: 4 },
            { time: now - 320000, type: 'single', count: 1 },
            { time: now - 450000, type: 'burst', count: 5 },
            { time: now - 600000, type: 'sequence', count: 3 }
        ];

        clusters.forEach(cluster => {
            if (cluster.type === 'burst') {
                // Rapid tool uses within 2-3 seconds
                for (let i = 0; i < cluster.count; i++) {
                    events.push({
                        id: `event_${events.length}`,
                        type: 'tool-use',
                        timestamp: cluster.time + (i * 400),
                        title: this.getRandomToolUse(),
                        details: `Tool execution ${i + 1}`,
                        duration: Math.random() * 1000 + 200
                    });
                }
            } else if (cluster.type === 'sequence') {
                // Sequential events over 10-15 seconds
                for (let i = 0; i < cluster.count; i++) {
                    const eventType = ['tool-use', 'user-input', 'system-event'][Math.floor(Math.random() * 3)];
                    events.push({
                        id: `event_${events.length}`,
                        type: eventType,
                        timestamp: cluster.time + (i * 3000),
                        title: this.getRandomEventTitle(eventType),
                        details: this.getRandomEventDetails(eventType),
                        duration: Math.random() * 2000 + 500
                    });
                }
            } else {
                // Single event
                const eventType = ['user-input', 'system-event'][Math.floor(Math.random() * 2)];
                events.push({
                    id: `event_${events.length}`,
                    type: eventType,
                    timestamp: cluster.time,
                    title: this.getRandomEventTitle(eventType),
                    details: this.getRandomEventDetails(eventType),
                    duration: Math.random() * 1500 + 300
                });
            }
        });

        this.events = events.sort((a, b) => b.timestamp - a.timestamp);
    }

    getRandomToolUse() {
        const tools = [
            'Read file analysis',
            'Execute bash command',
            'Search codebase',
            'Edit file content',
            'Run diagnostic',
            'Generate report',
            'Process data',
            'Validate input'
        ];
        return tools[Math.floor(Math.random() * tools.length)];
    }

    getRandomEventTitle(type) {
        const titles = {
            'tool-use': [
                'File system operation',
                'Code analysis',
                'Database query',
                'API request',
                'Validation check',
                'Performance test'
            ],
            'user-input': [
                'New chat message',
                'Command input',
                'File upload',
                'Configuration change',
                'Session request'
            ],
            'system-event': [
                'Connection established',
                'Session timeout',
                'Cache cleanup',
                'Background sync',
                'Health check'
            ]
        };
        
        const typeOptions = titles[type] || ['Unknown event'];
        return typeOptions[Math.floor(Math.random() * typeOptions.length)];
    }

    getRandomEventDetails(type) {
        const details = {
            'tool-use': [
                'Processing large dataset',
                'Analyzing code structure',
                'Executing complex query',
                'Validating user input',
                'Generating response'
            ],
            'user-input': [
                'User interaction detected',
                'New session initiated',
                'Input validation complete',
                'Request processed'
            ],
            'system-event': [
                'System maintenance task',
                'Automated cleanup',
                'Status update',
                'Performance monitoring'
            ]
        };
        
        const typeOptions = details[type] || ['System activity'];
        return typeOptions[Math.floor(Math.random() * typeOptions.length)];
    }

    consolidateEvents() {
        const consolidated = [];
        const events = [...this.events];
        let i = 0;

        while (i < events.length) {
            const currentEvent = events[i];
            
            // Look for rapid sequences (within 5 seconds)
            const rapidSequence = [currentEvent];
            let j = i + 1;
            
            while (j < events.length && 
                   events[j].type === currentEvent.type &&
                   (currentEvent.timestamp - events[j].timestamp) <= 5000) {
                rapidSequence.push(events[j]);
                j++;
            }

            if (rapidSequence.length > 1) {
                // Create consolidated event
                const consolidatedEvent = {
                    id: `consolidated_${consolidated.length}`,
                    type: currentEvent.type,
                    timestamp: currentEvent.timestamp,
                    title: `${rapidSequence.length} ${this.getEventTypeLabel(currentEvent.type)} in ${this.formatDuration(currentEvent.timestamp - rapidSequence[rapidSequence.length - 1].timestamp)}`,
                    details: `Rapid sequence detected`,
                    isConsolidated: true,
                    count: rapidSequence.length,
                    subEvents: rapidSequence,
                    expanded: false
                };
                
                consolidated.push(consolidatedEvent);
                i = j;
            } else {
                // Single event
                consolidated.push({
                    ...currentEvent,
                    isConsolidated: false,
                    expanded: false
                });
                i++;
            }
        }

        this.consolidatedEvents = consolidated;
    }

    getEventTypeLabel(type) {
        const labels = {
            'tool-use': 'tool uses',
            'user-input': 'user inputs',
            'system-event': 'system events'
        };
        return labels[type] || 'events';
    }

    formatDuration(ms) {
        if (ms < 1000) return `${Math.round(ms)}ms`;
        if (ms < 60000) return `${Math.round(ms / 1000)}s`;
        return `${Math.round(ms / 60000)}m`;
    }

    renderChart() {
        const width = this.canvas.clientWidth;
        const height = this.canvas.clientHeight;
        
        this.ctx.clearRect(0, 0, width, height);
        
        const padding = 20;
        const chartWidth = width - (padding * 2);
        const chartHeight = height - (padding * 2);
        
        // Draw grid lines (subtle)
        this.ctx.strokeStyle = '#1a1a1a';
        this.ctx.lineWidth = 1;
        
        for (let i = 0; i <= 5; i++) {
            const y = padding + (chartHeight / 5) * i;
            this.ctx.beginPath();
            this.ctx.moveTo(padding, y);
            this.ctx.lineTo(width - padding, y);
            this.ctx.stroke();
        }

        // Draw sparklines for each event type
        this.drawSparkline(this.chartData.map(d => d.toolUse), '#3b82f6', padding, chartWidth, chartHeight);
        this.drawSparkline(this.chartData.map(d => d.userInput), '#10b981', padding, chartWidth, chartHeight);
        this.drawSparkline(this.chartData.map(d => d.systemEvent), '#f59e0b', padding, chartWidth, chartHeight);
    }

    drawSparkline(data, color, padding, chartWidth, chartHeight) {
        const maxValue = Math.max(...data, 1);
        const stepX = chartWidth / (data.length - 1);
        
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = 2;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';
        
        this.ctx.beginPath();
        
        data.forEach((value, index) => {
            const x = padding + (stepX * index);
            const y = padding + chartHeight - ((value / maxValue) * chartHeight);
            
            if (index === 0) {
                this.ctx.moveTo(x, y);
            } else {
                this.ctx.lineTo(x, y);
            }
        });
        
        this.ctx.stroke();

        // Add subtle glow effect
        this.ctx.shadowColor = color;
        this.ctx.shadowBlur = 3;
        this.ctx.stroke();
        this.ctx.shadowBlur = 0;
    }

    renderEventFeed() {
        const filteredEvents = this.getFilteredEvents();
        
        this.eventFeed.innerHTML = '';
        
        filteredEvents.forEach(event => {
            const eventElement = this.createEventElement(event);
            this.eventFeed.appendChild(eventElement);
        });
    }

    getFilteredEvents() {
        if (this.currentFilter === 'all') {
            return this.consolidatedEvents;
        }
        return this.consolidatedEvents.filter(event => event.type === this.currentFilter);
    }

    createEventElement(event) {
        const eventDiv = document.createElement('div');
        eventDiv.className = `event-item ${event.isConsolidated ? 'consolidated' : ''}`;
        eventDiv.dataset.eventId = event.id;
        
        eventDiv.innerHTML = `
            <div class="event-main">
                <div class="event-type-indicator ${event.type}"></div>
                <div class="event-content">
                    <div class="event-title">${event.title}</div>
                    <div class="event-details">${event.details}</div>
                </div>
            </div>
            <div class="event-meta">
                ${event.isConsolidated ? `<span class="event-count">${event.count}</span>` : ''}
                <span class="event-time">${this.formatTimestamp(event.timestamp)}</span>
                ${event.isConsolidated ? '<span class="expand-indicator">▼</span>' : ''}
            </div>
        `;

        if (event.isConsolidated) {
            eventDiv.addEventListener('click', () => this.toggleEventExpansion(event.id));
        }

        return eventDiv;
    }

    toggleEventExpansion(eventId) {
        const event = this.consolidatedEvents.find(e => e.id === eventId);
        if (!event || !event.isConsolidated) return;

        event.expanded = !event.expanded;
        
        const eventElement = document.querySelector(`[data-event-id="${eventId}"]`);
        if (!eventElement) return;

        if (event.expanded) {
            eventElement.classList.add('expanded');
            this.addExpandedContent(eventElement, event);
        } else {
            eventElement.classList.remove('expanded');
            this.removeExpandedContent(eventElement);
        }
    }

    addExpandedContent(eventElement, event) {
        const existingContent = eventElement.querySelector('.event-expanded-content');
        if (existingContent) return;

        const expandedContent = document.createElement('div');
        expandedContent.className = 'event-expanded-content';
        
        const subEventsList = event.subEvents.map(subEvent => `
            <li class="sub-event">
                <span>${subEvent.title}</span>
                <span class="sub-event-time">${this.formatTimestamp(subEvent.timestamp)}</span>
            </li>
        `).join('');

        expandedContent.innerHTML = `
            <ul class="sub-events">
                ${subEventsList}
            </ul>
        `;

        eventElement.appendChild(expandedContent);
    }

    removeExpandedContent(eventElement) {
        const expandedContent = eventElement.querySelector('.event-expanded-content');
        if (expandedContent) {
            expandedContent.remove();
        }
    }

    formatTimestamp(timestamp) {
        const now = Date.now();
        const diff = now - timestamp;
        
        if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
        
        return new Date(timestamp).toLocaleDateString();
    }

    setupEventListeners() {
        // Filter buttons
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.currentFilter = e.target.dataset.filter;
                this.renderEventFeed();
            });
        });

        // Window resize
        window.addEventListener('resize', () => {
            this.setupCanvas();
            this.renderChart();
        });
    }

    simulateRealTimeUpdates() {
        setInterval(() => {
            // Update connection status randomly
            const isConnected = Math.random() > 0.1; // 90% chance of being connected
            this.updateConnectionStatus(isConnected);
            
            // Update sessions counter
            const sessionCount = Math.floor(Math.random() * 6);
            this.updateSessionsCounter(sessionCount);
            
            // Add new chart data point
            this.addNewChartDataPoint();
            
            // Occasionally add new events
            if (Math.random() > 0.7) {
                this.addNewEvent();
            }
        }, 5000);
    }

    updateConnectionStatus(connected) {
        if (connected) {
            this.statusDot.className = 'status-dot connected';
            this.statusText.textContent = 'Connected';
        } else {
            this.statusDot.className = 'status-dot disconnected';
            this.statusText.textContent = 'Disconnected';
        }
    }

    updateSessionsCounter(count) {
        if (count === 0) {
            this.sessionsCounter.textContent = 'No active sessions';
        } else if (count === 1) {
            this.sessionsCounter.textContent = '1 session awaiting input';
        } else {
            this.sessionsCounter.textContent = `${count} sessions awaiting input`;
        }
    }

    addNewChartDataPoint() {
        this.chartData.shift(); // Remove oldest point
        this.chartData.push({
            timestamp: Date.now(),
            toolUse: Math.floor(Math.random() * 8),
            userInput: Math.floor(Math.random() * 3),
            systemEvent: Math.floor(Math.random() * 2)
        });
        this.renderChart();
    }

    addNewEvent() {
        const eventTypes = ['tool-use', 'user-input', 'system-event'];
        const eventType = eventTypes[Math.floor(Math.random() * eventTypes.length)];
        
        const newEvent = {
            id: `event_${Date.now()}`,
            type: eventType,
            timestamp: Date.now(),
            title: this.getRandomEventTitle(eventType),
            details: this.getRandomEventDetails(eventType),
            isConsolidated: false,
            expanded: false
        };

        this.events.unshift(newEvent);
        this.consolidateEvents();
        this.renderEventFeed();
    }
}

// Initialize dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new ChronicleMinimalistDashboard();
});