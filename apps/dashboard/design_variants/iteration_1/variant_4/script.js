/**
 * Chronicle Dashboard Variant 4: High Contrast Design
 * Mock data generation and interactive chart functionality
 * Optimized for rapid scanning and anomaly detection
 */

// Event types with high-contrast colors for strong visual differentiation
const EVENT_TYPES = {
    TOOL_USE: {
        name: 'tool_use',
        label: 'Tool Usage',
        color: '#00d4ff',
        priority: ['low', 'medium', 'high']
    },
    USER_PROMPT: {
        name: 'user_prompt',
        label: 'User Prompts',
        color: '#ff6b35',
        priority: ['low', 'medium', 'high']
    },
    SESSION_START: {
        name: 'session_start',
        label: 'Session Starts',
        color: '#00ff41',
        priority: ['low', 'medium']
    },
    ERROR: {
        name: 'error',
        label: 'Errors',
        color: '#ff0844',
        priority: ['high']
    }
};

// Priority colors for visual scanning
const PRIORITY_COLORS = {
    low: '#00ff41',
    medium: '#ffdd00',
    high: '#ff0844'
};

// Global state for the dashboard
let dashboardState = {
    events: [],
    chartData: [],
    activeSessions: {
        total: 7,
        high: 3,
        medium: 2,
        low: 2
    },
    isConnected: true,
    lastUpdated: new Date()
};

/**
 * Generate realistic mock event data with patterns for anomaly detection
 */
function generateMockEventData() {
    const events = [];
    const eventTypes = Object.values(EVENT_TYPES);
    const now = new Date();
    
    // Generate events for the last 24 hours with realistic patterns
    for (let i = 0; i < 150; i++) {
        const timeOffset = Math.random() * 24 * 60 * 60 * 1000; // Random time in last 24h
        const timestamp = new Date(now.getTime() - timeOffset);
        const eventType = eventTypes[Math.floor(Math.random() * eventTypes.length)];
        const priority = eventType.priority[Math.floor(Math.random() * eventType.priority.length)];
        
        // Create anomaly patterns for visual detection
        let isAnomaly = false;
        if (Math.random() < 0.05) { // 5% chance of anomaly
            isAnomaly = true;
        }
        
        const event = {
            id: `evt_${Date.now()}_${i}`,
            type: eventType.name,
            title: generateEventTitle(eventType.name, isAnomaly),
            description: generateEventDescription(eventType.name, isAnomaly),
            timestamp: timestamp,
            priority: isAnomaly ? 'high' : priority,
            sessionId: `session_${Math.floor(Math.random() * 10) + 1}`,
            isAnomaly: isAnomaly
        };
        
        events.push(event);
    }
    
    // Sort by timestamp (newest first)
    return events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
}

/**
 * Generate contextual event titles
 */
function generateEventTitle(eventType, isAnomaly = false) {
    const titles = {
        tool_use: [
            'File System Access',
            'Database Query Execution',
            'API Request Processing',
            'Data Transformation',
            'Configuration Update',
            'Security Validation',
            'Performance Analysis',
            'Cache Operation'
        ],
        user_prompt: [
            'Code Review Request',
            'Feature Implementation Query',
            'Bug Report Submission',
            'Architecture Discussion',
            'Performance Optimization',
            'Security Assessment',
            'Documentation Update',
            'Testing Strategy'
        ],
        session_start: [
            'New Development Session',
            'Code Review Session',
            'Debugging Session',
            'Planning Meeting',
            'Architecture Review',
            'Performance Analysis',
            'Security Audit',
            'Feature Discussion'
        ],
        error: [
            'Authentication Failure',
            'Database Connection Error',
            'API Timeout',
            'Memory Allocation Error',
            'Permission Denied',
            'Configuration Invalid',
            'Network Unavailable',
            'Resource Exhausted'
        ]
    };
    
    const baseTitles = titles[eventType] || ['Unknown Event'];
    let title = baseTitles[Math.floor(Math.random() * baseTitles.length)];
    
    if (isAnomaly) {
        title = `⚠️ ANOMALY: ${title}`;
    }
    
    return title;
}

/**
 * Generate contextual event descriptions
 */
function generateEventDescription(eventType, isAnomaly = false) {
    const descriptions = {
        tool_use: [
            'Executed file operation with standard parameters',
            'Performed database query with optimized indexes',
            'Processed API request within normal latency',
            'Transformed data using established pipeline',
            'Updated configuration with validated values',
            'Completed security check successfully',
            'Analyzed performance metrics and trends',
            'Managed cache operations efficiently'
        ],
        user_prompt: [
            'Requested comprehensive code review for new feature',
            'Asked for implementation guidance on complex algorithm',
            'Reported potential bug in authentication module',
            'Discussed system architecture improvements',
            'Requested performance optimization recommendations',
            'Asked for security best practices review',
            'Requested documentation updates for new API',
            'Discussed testing strategy for critical path'
        ],
        session_start: [
            'Initiated new development session for feature work',
            'Started code review session with team members',
            'Began debugging session for critical issue',
            'Started planning meeting for next sprint',
            'Initiated architecture review discussion',
            'Began performance analysis of core systems',
            'Started security audit of authentication flow',
            'Initiated feature discussion with stakeholders'
        ],
        error: [
            'Authentication service returned 401 unauthorized',
            'Database connection pool exhausted timeout',
            'External API exceeded 30-second timeout limit',
            'Memory allocation failed for large dataset',
            'Insufficient permissions for file operation',
            'Configuration validation failed on startup',
            'Network connection unavailable to remote service',
            'System resources exhausted under load'
        ]
    };
    
    const baseDescriptions = descriptions[eventType] || ['No additional details available'];
    let description = baseDescriptions[Math.floor(Math.random() * baseDescriptions.length)];
    
    if (isAnomaly) {
        description = `UNUSUAL PATTERN DETECTED: ${description}. Requires immediate attention.`;
    }
    
    return description;
}

/**
 * Generate chart data for high-contrast visualization
 */
function generateChartData() {
    const chartData = [];
    const now = new Date();
    const eventTypes = Object.values(EVENT_TYPES);
    
    // Generate hourly data points for the last 24 hours
    for (let hour = 23; hour >= 0; hour--) {
        const timestamp = new Date(now.getTime() - (hour * 60 * 60 * 1000));
        const dataPoint = {
            time: timestamp,
            label: timestamp.getHours().toString().padStart(2, '0') + ':00'
        };
        
        // Add event counts for each type with realistic patterns
        eventTypes.forEach(eventType => {
            // Simulate different activity patterns throughout the day
            let baseCount = 0;
            const currentHour = timestamp.getHours();
            
            // Business hours have more activity
            if (currentHour >= 9 && currentHour <= 17) {
                baseCount = Math.floor(Math.random() * 8) + 2;
            } else {
                baseCount = Math.floor(Math.random() * 3);
            }
            
            // Add some anomalies
            if (Math.random() < 0.1) { // 10% chance of spike
                baseCount += Math.floor(Math.random() * 10) + 5;
            }
            
            dataPoint[eventType.name] = baseCount;
        });
        
        chartData.push(dataPoint);
    }
    
    return chartData.reverse(); // Chronological order
}

/**
 * Render the high-contrast bar chart
 */
function renderChart() {
    const canvas = document.getElementById('eventChart');
    const ctx = canvas.getContext('2d');
    const chartData = dashboardState.chartData;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Chart dimensions
    const padding = 40;
    const chartWidth = canvas.width - (padding * 2);
    const chartHeight = canvas.height - (padding * 2);
    const barWidth = chartWidth / chartData.length;
    
    // Find max value for scaling
    const maxValue = Math.max(...chartData.map(d => 
        Object.values(EVENT_TYPES).reduce((sum, type) => sum + (d[type.name] || 0), 0)
    ));
    
    // Set high-contrast styling
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.font = '12px Consolas, Monaco, monospace';
    
    // Draw axes
    ctx.beginPath();
    ctx.moveTo(padding, padding);
    ctx.lineTo(padding, canvas.height - padding);
    ctx.lineTo(canvas.width - padding, canvas.height - padding);
    ctx.stroke();
    
    // Draw bars for each time period
    chartData.forEach((dataPoint, index) => {
        const x = padding + (index * barWidth);
        let stackY = canvas.height - padding;
        
        // Draw stacked bars for each event type
        Object.values(EVENT_TYPES).forEach(eventType => {
            const value = dataPoint[eventType.name] || 0;
            const barHeight = (value / maxValue) * chartHeight;
            
            // Set event type color
            ctx.fillStyle = eventType.color;
            ctx.fillRect(x + 2, stackY - barHeight, barWidth - 4, barHeight);
            
            // Add high-contrast border
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1;
            ctx.strokeRect(x + 2, stackY - barHeight, barWidth - 4, barHeight);
            
            stackY -= barHeight;
        });
        
        // Draw time labels (every 4th hour for readability)
        if (index % 4 === 0) {
            ctx.fillStyle = '#cccccc';
            ctx.textAlign = 'center';
            ctx.fillText(dataPoint.label, x + (barWidth / 2), canvas.height - padding + 20);
        }
    });
    
    // Draw Y-axis labels
    ctx.fillStyle = '#cccccc';
    ctx.textAlign = 'right';
    for (let i = 0; i <= 5; i++) {
        const y = canvas.height - padding - (i * (chartHeight / 5));
        const value = Math.round((i * maxValue) / 5);
        ctx.fillText(value.toString(), padding - 10, y + 4);
    }
}

/**
 * Render the event feed with alternating backgrounds and strong visual hierarchy
 */
function renderEventFeed() {
    const feedContainer = document.getElementById('eventFeed');
    const filterValue = document.getElementById('eventTypeFilter').value;
    
    // Filter events based on selection
    let filteredEvents = dashboardState.events;
    if (filterValue !== 'all') {
        filteredEvents = dashboardState.events.filter(event => event.type === filterValue);
    }
    
    // Take only the first 20 events for performance
    filteredEvents = filteredEvents.slice(0, 20);
    
    // Clear existing content
    feedContainer.innerHTML = '';
    
    // Render each event with high contrast styling
    filteredEvents.forEach(event => {
        const eventElement = document.createElement('div');
        eventElement.className = 'event-item';
        
        // Add anomaly highlighting
        if (event.isAnomaly) {
            eventElement.style.borderLeft = '6px solid #ff0844';
            eventElement.style.background = 'linear-gradient(90deg, rgba(255, 8, 68, 0.1), transparent)';
        }
        
        eventElement.innerHTML = `
            <div class="event-type-badge ${event.type}">
                ${EVENT_TYPES[event.type.toUpperCase()]?.label || event.type}
            </div>
            <div class="event-content">
                <div class="event-title">${event.title}</div>
                <div class="event-description">${event.description}</div>
            </div>
            <div class="event-timestamp">
                ${formatTimestamp(event.timestamp)}
            </div>
            <div class="event-priority ${event.priority}"></div>
        `;
        
        feedContainer.appendChild(eventElement);
    });
}

/**
 * Format timestamp for display
 */
function formatTimestamp(timestamp) {
    const now = new Date();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / (1000 * 60));
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
}

/**
 * Update connection status with visual indicators
 */
function updateConnectionStatus() {
    const statusElement = document.getElementById('connectionStatus');
    const indicator = statusElement.querySelector('.status-indicator');
    const text = statusElement.querySelector('.status-text');
    
    if (dashboardState.isConnected) {
        statusElement.style.borderColor = '#00ff41';
        indicator.style.backgroundColor = '#00ff41';
        text.textContent = 'CONNECTED';
        text.style.color = '#00ff41';
    } else {
        statusElement.style.borderColor = '#ff0844';
        indicator.style.backgroundColor = '#ff0844';
        text.textContent = 'DISCONNECTED';
        text.style.color = '#ff0844';
    }
}

/**
 * Update active sessions counter
 */
function updateSessionsCounter() {
    document.getElementById('activeSessionsCount').textContent = dashboardState.activeSessions.total;
    
    // Update session breakdown
    const sessionItems = document.querySelectorAll('.status-item');
    sessionItems[0].querySelector('span:last-child').textContent = `High Priority: ${dashboardState.activeSessions.high}`;
    sessionItems[1].querySelector('span:last-child').textContent = `Medium Priority: ${dashboardState.activeSessions.medium}`;
    sessionItems[2].querySelector('span:last-child').textContent = `Low Priority: ${dashboardState.activeSessions.low}`;
}

/**
 * Update last updated timestamp
 */
function updateLastUpdated() {
    const lastUpdatedElement = document.getElementById('lastUpdated');
    lastUpdatedElement.textContent = dashboardState.lastUpdated.toLocaleString();
}

/**
 * Simulate real-time updates for demonstration
 */
function simulateRealTimeUpdates() {
    setInterval(() => {
        // Randomly add new events
        if (Math.random() < 0.3) { // 30% chance every 5 seconds
            const eventTypes = Object.values(EVENT_TYPES);
            const eventType = eventTypes[Math.floor(Math.random() * eventTypes.length)];
            const priority = eventType.priority[Math.floor(Math.random() * eventType.priority.length)];
            const isAnomaly = Math.random() < 0.1; // 10% chance of anomaly
            
            const newEvent = {
                id: `evt_${Date.now()}_new`,
                type: eventType.name,
                title: generateEventTitle(eventType.name, isAnomaly),
                description: generateEventDescription(eventType.name, isAnomaly),
                timestamp: new Date(),
                priority: isAnomaly ? 'high' : priority,
                sessionId: `session_${Math.floor(Math.random() * 10) + 1}`,
                isAnomaly: isAnomaly
            };
            
            // Add to beginning of events array
            dashboardState.events.unshift(newEvent);
            
            // Keep only the most recent 150 events
            if (dashboardState.events.length > 150) {
                dashboardState.events = dashboardState.events.slice(0, 150);
            }
            
            // Update displays
            renderEventFeed();
        }
        
        // Randomly update session counts
        if (Math.random() < 0.2) { // 20% chance every 5 seconds
            dashboardState.activeSessions.total = Math.floor(Math.random() * 15) + 3;
            dashboardState.activeSessions.high = Math.floor(Math.random() * 5) + 1;
            dashboardState.activeSessions.medium = Math.floor(Math.random() * 4) + 1;
            dashboardState.activeSessions.low = Math.max(0, dashboardState.activeSessions.total - dashboardState.activeSessions.high - dashboardState.activeSessions.medium);
            updateSessionsCounter();
        }
        
        // Update timestamp
        dashboardState.lastUpdated = new Date();
        updateLastUpdated();
        
        // Occasionally simulate connection issues
        if (Math.random() < 0.05) { // 5% chance every 5 seconds
            dashboardState.isConnected = !dashboardState.isConnected;
            updateConnectionStatus();
            
            // Reconnect after 3 seconds if disconnected
            if (!dashboardState.isConnected) {
                setTimeout(() => {
                    dashboardState.isConnected = true;
                    updateConnectionStatus();
                }, 3000);
            }
        }
    }, 5000); // Update every 5 seconds
}

/**
 * Set up event listeners for interactive elements
 */
function setupEventListeners() {
    // Event type filter
    document.getElementById('eventTypeFilter').addEventListener('change', renderEventFeed);
    
    // Graph controls
    document.querySelectorAll('.graph-controls .control-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            // Remove active class from all buttons
            document.querySelectorAll('.graph-controls .control-btn').forEach(b => b.classList.remove('active'));
            // Add active class to clicked button
            e.target.classList.add('active');
            
            // In a real implementation, this would change the time range
            // For this demo, we'll just regenerate the chart data
            dashboardState.chartData = generateChartData();
            renderChart();
        });
    });
    
    // Refresh button
    document.querySelector('.feed-controls .control-btn').addEventListener('click', () => {
        // Regenerate events and update display
        dashboardState.events = generateMockEventData();
        renderEventFeed();
    });
}

/**
 * Initialize the dashboard
 */
function initializeDashboard() {
    console.log('🚀 Initializing Chronicle Dashboard Variant 4: High Contrast Design');
    
    // Generate initial data
    dashboardState.events = generateMockEventData();
    dashboardState.chartData = generateChartData();
    
    // Render initial views
    renderChart();
    renderEventFeed();
    updateConnectionStatus();
    updateSessionsCounter();
    updateLastUpdated();
    
    // Set up interactivity
    setupEventListeners();
    
    // Start real-time simulation
    simulateRealTimeUpdates();
    
    console.log('✅ Dashboard initialized successfully');
    console.log(`📊 Loaded ${dashboardState.events.length} events`);
    console.log(`📈 Generated ${dashboardState.chartData.length} chart data points`);
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', initializeDashboard);

// Export for potential external use
window.ChronicleVariant4 = {
    dashboardState,
    generateMockEventData,
    renderChart,
    renderEventFeed
};