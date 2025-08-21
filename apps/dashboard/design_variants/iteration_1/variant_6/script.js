// Chronicle Dashboard - Anomaly Detection Script
class AnomalyDashboard {
    constructor() {
        this.eventTypes = [
            'user_prompt_submit',
            'pre_tool_use',
            'post_tool_use',
            'session_start',
            'session_stop',
            'notification',
            'error',
            'warning'
        ];
        
        this.patterns = {
            normal: { rate: 240, variance: 20 },
            spike: { rate: 400, variance: 50 },
            quiet: { rate: 120, variance: 15 },
            error_burst: { rate: 300, variance: 100, errorRate: 0.3 }
        };
        
        this.currentPattern = 'normal';
        this.events = [];
        this.heatmapData = [];
        this.anomalies = [];
        
        this.init();
    }
    
    init() {
        this.initHeatmap();
        this.startEventGeneration();
        this.startUIUpdates();
        this.simulatePatternChanges();
    }
    
    initHeatmap() {
        const canvas = document.getElementById('eventHeatmap');
        this.heatmapCtx = canvas.getContext('2d');
        
        // Initialize heatmap data (24 hours x 60 minutes)
        this.heatmapData = Array(24).fill().map(() => 
            Array(60).fill().map(() => Math.random() * 100)
        );
        
        this.drawHeatmap();
    }
    
    drawHeatmap() {
        const canvas = document.getElementById('eventHeatmap');
        const ctx = this.heatmapCtx;
        const cellWidth = canvas.width / 60; // 60 minutes
        const cellHeight = canvas.height / 24; // 24 hours
        
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        for (let hour = 0; hour < 24; hour++) {
            for (let minute = 0; minute < 60; minute++) {
                const value = this.heatmapData[hour][minute];
                const intensity = Math.min(value / 100, 1);
                
                // Color based on intensity and anomaly detection
                let color;
                if (value > 80) {
                    // Anomaly - purple/pink gradient
                    color = `rgba(139, 92, 246, ${intensity})`;
                    if (value > 90) {
                        color = `rgba(236, 72, 153, ${intensity})`;
                    }
                } else if (value > 60) {
                    // High activity - orange
                    color = `rgba(245, 158, 11, ${intensity})`;
                } else if (value > 30) {
                    // Normal activity - green
                    color = `rgba(34, 197, 94, ${intensity})`;
                } else {
                    // Low activity - dark
                    color = `rgba(75, 85, 99, ${intensity})`;
                }
                
                ctx.fillStyle = color;
                ctx.fillRect(
                    minute * cellWidth,
                    hour * cellHeight,
                    cellWidth - 1,
                    cellHeight - 1
                );
            }
        }
        
        // Add current time indicator
        const now = new Date();
        const currentMinute = now.getMinutes();
        const currentHour = now.getHours();
        
        ctx.strokeStyle = '#6366f1';
        ctx.lineWidth = 2;
        ctx.strokeRect(
            currentMinute * cellWidth,
            currentHour * cellHeight,
            cellWidth,
            cellHeight
        );
    }
    
    generateEvent() {
        const pattern = this.patterns[this.currentPattern];
        const shouldGenerate = Math.random() < (pattern.rate / 3600); // Convert to per-second probability
        
        if (!shouldGenerate) return null;
        
        let eventType;
        let isAnomaly = false;
        
        // Determine event type based on current pattern
        if (this.currentPattern === 'error_burst' && Math.random() < pattern.errorRate) {
            eventType = Math.random() < 0.7 ? 'error' : 'warning';
            isAnomaly = true;
        } else {
            eventType = this.eventTypes[Math.floor(Math.random() * (this.eventTypes.length - 2))];
        }
        
        // Detect other anomalies
        if (!isAnomaly) {
            // Long gaps (unusual quiet periods)
            if (this.events.length > 0) {
                const lastEvent = this.events[this.events.length - 1];
                const timeSinceLastEvent = Date.now() - lastEvent.timestamp;
                if (timeSinceLastEvent > 30000) { // 30 seconds
                    isAnomaly = true;
                }
            }
            
            // Rapid succession of same event type
            const recentSameType = this.events
                .slice(-5)
                .filter(e => e.type === eventType && Date.now() - e.timestamp < 5000);
            if (recentSameType.length >= 3) {
                isAnomaly = true;
            }
        }
        
        const event = {
            id: Date.now() + Math.random(),
            type: eventType,
            timestamp: Date.now(),
            isAnomaly,
            data: this.generateEventData(eventType),
            latency: this.generateLatency(isAnomaly)
        };
        
        return event;
    }
    
    generateEventData(type) {
        const dataTemplates = {
            user_prompt_submit: () => ({
                prompt_length: Math.floor(Math.random() * 500) + 50,
                session_id: `sess_${Math.floor(Math.random() * 1000)}`
            }),
            pre_tool_use: () => ({
                tool: ['bash', 'grep', 'read', 'edit'][Math.floor(Math.random() * 4)],
                args_count: Math.floor(Math.random() * 5) + 1
            }),
            post_tool_use: () => ({
                tool: ['bash', 'grep', 'read', 'edit'][Math.floor(Math.random() * 4)],
                success: Math.random() > 0.1,
                duration: Math.floor(Math.random() * 5000) + 100
            }),
            error: () => ({
                error_code: ['TIMEOUT', 'INVALID_ARGS', 'PERMISSION_DENIED'][Math.floor(Math.random() * 3)],
                severity: 'high'
            }),
            warning: () => ({
                warning_type: ['PERFORMANCE', 'DEPRECATED', 'RATE_LIMIT'][Math.floor(Math.random() * 3)],
                severity: 'medium'
            })
        };
        
        return dataTemplates[type] ? dataTemplates[type]() : {};
    }
    
    generateLatency(isAnomaly) {
        const baseLatency = 200;
        const variance = isAnomaly ? 600 : 100;
        return Math.max(50, baseLatency + (Math.random() - 0.5) * variance);
    }
    
    startEventGeneration() {
        setInterval(() => {
            const event = this.generateEvent();
            if (event) {
                this.events.push(event);
                
                // Keep only last 100 events
                if (this.events.length > 100) {
                    this.events = this.events.slice(-100);
                }
                
                // Update heatmap
                this.updateHeatmapData(event);
                
                // Track anomalies
                if (event.isAnomaly) {
                    this.anomalies.push(event);
                    if (this.anomalies.length > 20) {
                        this.anomalies = this.anomalies.slice(-20);
                    }
                }
            }
        }, 100); // Check every 100ms
    }
    
    updateHeatmapData(event) {
        const now = new Date();
        const hour = now.getHours();
        const minute = now.getMinutes();
        
        // Increase intensity at current time
        this.heatmapData[hour][minute] = Math.min(
            this.heatmapData[hour][minute] + (event.isAnomaly ? 10 : 2),
            100
        );
        
        // Decay old data
        if (Math.random() < 0.01) { // 1% chance each update
            for (let h = 0; h < 24; h++) {
                for (let m = 0; m < 60; m++) {
                    this.heatmapData[h][m] = Math.max(0, this.heatmapData[h][m] * 0.99);
                }
            }
        }
    }
    
    simulatePatternChanges() {
        setInterval(() => {
            const patterns = Object.keys(this.patterns);
            const weights = {
                'normal': 0.7,
                'spike': 0.1,
                'quiet': 0.15,
                'error_burst': 0.05
            };
            
            const random = Math.random();
            let cumulative = 0;
            
            for (const pattern of patterns) {
                cumulative += weights[pattern];
                if (random <= cumulative) {
                    this.currentPattern = pattern;
                    break;
                }
            }
            
            console.log(`Pattern changed to: ${this.currentPattern}`);
        }, 30000); // Change pattern every 30 seconds
    }
    
    startUIUpdates() {
        // Update timestamp
        setInterval(() => {
            const now = new Date();
            document.getElementById('timestamp').textContent = 
                now.toLocaleTimeString('en-US', { hour12: false });
        }, 1000);
        
        // Update dashboard data
        setInterval(() => {
            this.updateSessionCounts();
            this.updateAnomalyStatus();
            this.updateEventFeed();
            this.updatePatternMetrics();
            this.drawHeatmap();
        }, 2000);
    }
    
    updateSessionCounts() {
        // Simulate session data with anomalies
        const totalSessions = 120 + Math.floor(Math.random() * 20);
        const slowSessions = Math.floor(totalSessions * (0.05 + (this.currentPattern === 'spike' ? 0.1 : 0)));
        const stalledSessions = Math.floor(totalSessions * (0.01 + (this.currentPattern === 'error_burst' ? 0.05 : 0)));
        const normalSessions = totalSessions - slowSessions - stalledSessions;
        
        document.getElementById('sessionCount').textContent = totalSessions;
        document.getElementById('normalSessions').textContent = normalSessions;
        document.getElementById('slowSessions').textContent = slowSessions;
        document.getElementById('stalledSessions').textContent = stalledSessions;
        
        // Update pattern indicators
        document.getElementById('normalPattern').style.opacity = this.currentPattern === 'normal' ? '1' : '0.3';
        document.getElementById('warningPattern').style.opacity = 
            ['spike', 'quiet'].includes(this.currentPattern) ? '1' : '0.3';
        document.getElementById('criticalPattern').style.opacity = 
            this.currentPattern === 'error_burst' ? '1' : '0.3';
    }
    
    updateAnomalyStatus() {
        const statusElement = document.getElementById('anomalyStatus');
        const recentAnomalies = this.anomalies.filter(a => Date.now() - a.timestamp < 60000);
        
        if (recentAnomalies.length > 5) {
            statusElement.textContent = 'Pattern Analysis: Multiple Anomalies Detected';
            statusElement.style.color = 'var(--critical)';
        } else if (recentAnomalies.length > 2) {
            statusElement.textContent = 'Pattern Analysis: Anomalies Detected';
            statusElement.style.color = 'var(--warning)';
        } else if (this.currentPattern !== 'normal') {
            statusElement.textContent = `Pattern Analysis: ${this.currentPattern.replace('_', ' ').toUpperCase()} Pattern`;
            statusElement.style.color = 'var(--warning)';
        } else {
            statusElement.textContent = 'Pattern Analysis: Normal Flow';
            statusElement.style.color = 'var(--normal)';
        }
    }
    
    updateEventFeed() {
        const feedContainer = document.getElementById('eventFeed');
        const recentEvents = this.events.slice(-20).reverse();
        
        feedContainer.innerHTML = recentEvents.map(event => {
            const timeAgo = Math.floor((Date.now() - event.timestamp) / 1000);
            const eventClass = event.type === 'error' ? 'error' : 
                              event.isAnomaly ? 'anomaly' : 'normal';
            
            return `
                <div class="event-item ${eventClass}">
                    <span class="event-timestamp">${timeAgo}s</span>
                    <div class="event-content">
                        <span class="event-type">${event.type}</span>
                        ${this.formatEventData(event)}
                    </div>
                </div>
            `;
        }).join('');
    }
    
    formatEventData(event) {
        const data = event.data;
        switch(event.type) {
            case 'user_prompt_submit':
                return `Prompt length: ${data.prompt_length} chars`;
            case 'pre_tool_use':
            case 'post_tool_use':
                return `Tool: ${data.tool}${data.duration ? ` (${data.duration}ms)` : ''}`;
            case 'error':
                return `Error: ${data.error_code}`;
            case 'warning':
                return `Warning: ${data.warning_type}`;
            default:
                return 'Event processed';
        }
    }
    
    updatePatternMetrics() {
        const recentEvents = this.events.filter(e => Date.now() - e.timestamp < 60000);
        const currentRate = recentEvents.length;
        const baseline = this.patterns.normal.rate / 60; // Convert to per minute
        const deviation = ((currentRate - baseline) / baseline * 100).toFixed(0);
        
        document.querySelector('.metric-value').textContent = Math.floor(baseline);
        document.querySelectorAll('.metric-value')[1].textContent = currentRate;
        document.querySelectorAll('.metric-value')[2].textContent = `${deviation > 0 ? '+' : ''}${deviation}%`;
        
        // Update confidence based on pattern stability
        const confidence = Math.max(60, 100 - Math.abs(deviation / 2));
        document.querySelectorAll('.metric-value')[3].textContent = `${Math.floor(confidence)}%`;
    }
}

// Initialize dashboard when page loads
document.addEventListener('DOMContentLoaded', () => {
    window.dashboard = new AnomalyDashboard();
});

// Add some interactivity
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('alert-item')) {
        e.target.style.opacity = '0.5';
        setTimeout(() => {
            e.target.style.opacity = '1';
        }, 1000);
    }
});

// Keyboard shortcuts for demo purposes
document.addEventListener('keydown', (e) => {
    if (e.key === 'r' && e.ctrlKey) {
        e.preventDefault();
        location.reload();
    }
    
    if (e.key === 'p' && e.ctrlKey) {
        e.preventDefault();
        // Force pattern change
        const patterns = ['normal', 'spike', 'quiet', 'error_burst'];
        window.dashboard.currentPattern = patterns[Math.floor(Math.random() * patterns.length)];
        console.log(`Forced pattern change to: ${window.dashboard.currentPattern}`);
    }
});