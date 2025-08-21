// Chronicle Dashboard - Data Rich Variant 3 JavaScript

// Event type configurations with colors and labels
const EVENT_TYPES = {
    session_start: { label: 'Session Start', color: '#10b981' },
    pre_tool_use: { label: 'Pre Tool', color: '#3b82f6' },
    post_tool_use: { label: 'Post Tool', color: '#06b6d4' },
    user_prompt_submit: { label: 'User Prompt', color: '#8b5cf6' },
    stop: { label: 'Stop', color: '#6b7280' },
    subagent_stop: { label: 'Subagent Stop', color: '#4b5563' },
    pre_compact: { label: 'Pre Compact', color: '#f59e0b' },
    notification: { label: 'Notification', color: '#f97316' },
    error: { label: 'Error', color: '#ef4444' }
};

// Tool names from Claude Code ecosystem
const TOOL_NAMES = [
    'Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep', 'LS', 
    'MultiEdit', 'NotebookRead', 'NotebookEdit', 'WebFetch', 
    'WebSearch', 'TodoRead', 'TodoWrite', 'ExitPlanMode'
];

// Project names for sessions
const PROJECT_NAMES = [
    'chronicle-dashboard', 'ai-workspace', 'claude-dev', 'observability-suite',
    'data-pipeline', 'user-analytics', 'real-time-monitor', 'performance-tracker'
];

// Event summaries for different types
const EVENT_SUMMARIES = {
    session_start: [
        'Session started for chronicle-dashboard',
        'New development session initiated',
        'Project session began',
        'Development environment ready',
        'Claude Code session active'
    ],
    pre_tool_use: [
        'Preparing to read configuration file',
        'About to edit component source',
        'Ready to run shell command',
        'Starting codebase search',
        'Preparing file operation'
    ],
    post_tool_use: [
        'File read operation completed',
        'Component edit finished successfully',
        'Shell command executed',
        'Search operation completed',
        'File write operation finished'
    ],
    user_prompt_submit: [
        'User submitted new request',
        'Prompt received from user',
        'New instruction provided',
        'User input processed',
        'Request submitted for processing'
    ],
    stop: [
        'Main agent execution completed',
        'Request processing finished',
        'Task execution stopped',
        'Agent reached completion',
        'Response generation finished'
    ],
    subagent_stop: [
        'Subagent task completed',
        'Background process finished',
        'Subtask execution stopped',
        'Worker agent completed',
        'Parallel task finished'
    ],
    pre_compact: [
        'Preparing context compaction',
        'Ready to compact conversation',
        'Context optimization starting',
        'Memory management initiated',
        'Conversation summarization ready'
    ],
    notification: [
        'Permission required for tool execution',
        'Waiting for user input',
        'Action confirmation needed',
        'User attention required',
        'Interactive prompt displayed'
    ],
    error: [
        'Failed to read file',
        'Command execution failed',
        'Network request timeout',
        'Validation error',
        'Permission denied'
    ]
};

// Session colors for consistent identification
const SESSION_COLORS = [
    '#3b82f6', '#10b981', '#f59e0b', '#ef4444', 
    '#8b5cf6', '#06b6d4', '#f97316', '#ec4899'
];

// Global state
let eventChart;
let mockEvents = [];
let mockSessions = [];
let isPaused = false;
let activeFilters = new Set();
let eventUpdateInterval;
let sessionColorMap = new Map();

// Utility functions
function getRandomItem(array) {
    return array[Math.floor(Math.random() * array.length)];
}

function generateSessionId() {
    return 'sess-' + Math.random().toString(36).substr(2, 8);
}

function generateEventId() {
    return 'evt-' + Math.random().toString(36).substr(2, 12);
}

function getSessionColor(sessionId) {
    if (!sessionColorMap.has(sessionId)) {
        const colorIndex = sessionColorMap.size % SESSION_COLORS.length;
        sessionColorMap.set(sessionId, SESSION_COLORS[colorIndex]);
    }
    return sessionColorMap.get(sessionId);
}

function formatTimestamp(date) {
    return date.toLocaleTimeString('en-US', {
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
}

function formatDuration(ms) {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
}

function truncateSessionId(sessionId) {
    return sessionId.length > 12 ? sessionId.substring(0, 12) + '...' : sessionId;
}

function formatParameters(event) {
    if (!event.details) return '';
    
    let params = '';
    switch (event.type) {
        case 'pre_tool_use':
        case 'post_tool_use':
            if (event.details.tool_input) {
                const input = event.details.tool_input;
                if (input.file_path) {
                    const fileName = input.file_path.split('/').pop();
                    params = `file: ${fileName}`;
                } else if (input.parameters) {
                    params = `params: ${JSON.stringify(input.parameters).substring(0, 30)}...`;
                }
            }
            break;
        case 'user_prompt_submit':
            if (event.details.prompt) {
                params = `"${event.details.prompt.substring(0, 40)}${event.details.prompt.length > 40 ? '...' : ''}"`;
            }
            break;
        case 'error':
            if (event.details.error_code) {
                params = `${event.details.error_code}: ${event.details.error_message}`;
            }
            break;
        case 'pre_compact':
            if (event.details.context_size) {
                params = `${Math.floor(event.details.context_size / 1000)}k tokens`;
            }
            break;
        default:
            if (event.details && typeof event.details === 'object') {
                const keys = Object.keys(event.details).slice(0, 2);
                params = keys.map(key => `${key}: ${event.details[key]}`).join(', ');
                if (params.length > 50) params = params.substring(0, 50) + '...';
            }
    }
    
    return params;
}

// Mock data generation
function generateMockSession() {
    const sessionId = generateSessionId();
    return {
        id: sessionId,
        status: getRandomItem(['active', 'idle', 'completed']),
        startedAt: new Date(Date.now() - Math.random() * 86400000),
        projectName: getRandomItem(PROJECT_NAMES),
        color: getSessionColor(sessionId)
    };
}

function generateMockEvent(sessionId) {
    const eventType = getRandomItem(Object.keys(EVENT_TYPES));
    const session = sessionId || getRandomItem(mockSessions).id;
    
    const baseEvent = {
        id: generateEventId(),
        timestamp: new Date(Date.now() - Math.random() * 300000), // Within last 5 minutes
        type: eventType,
        session_id: session,
        summary: getRandomItem(EVENT_SUMMARIES[eventType]),
        success: eventType !== 'error' && Math.random() > 0.1
    };

    // Add type-specific details
    switch (eventType) {
        case 'session_start':
            baseEvent.details = {
                source: getRandomItem(['startup', 'resume', 'clear']),
                project_path: `/Users/dev/${getRandomItem(PROJECT_NAMES)}`,
                git_branch: getRandomItem(['main', 'dev', 'feature/new-dashboard', 'bugfix/event-types']),
                platform: 'darwin'
            };
            break;
        case 'pre_tool_use':
            baseEvent.tool_name = getRandomItem(TOOL_NAMES);
            baseEvent.details = {
                tool_name: baseEvent.tool_name,
                tool_input: {
                    file_path: `/src/${getRandomItem(['components', 'lib', 'hooks'])}/${getRandomItem(['Example', 'Utils', 'Helper'])}.${getRandomItem(['tsx', 'ts', 'js'])}`,
                    parameters: { content: 'example content' }
                },
                cwd: `/Users/dev/${getRandomItem(PROJECT_NAMES)}`
            };
            break;
        case 'post_tool_use':
            baseEvent.tool_name = getRandomItem(TOOL_NAMES);
            baseEvent.duration_ms = Math.floor(Math.random() * 2000) + 50;
            baseEvent.details = {
                tool_name: baseEvent.tool_name,
                tool_input: {
                    file_path: `/src/${getRandomItem(['components', 'lib', 'hooks'])}/${getRandomItem(['Example', 'Utils', 'Helper'])}.${getRandomItem(['tsx', 'ts', 'js'])}`,
                },
                tool_response: {
                    success: baseEvent.success,
                    result: baseEvent.success ? 'Operation completed successfully' : 'Operation failed'
                },
                duration_ms: baseEvent.duration_ms
            };
            break;
        case 'user_prompt_submit':
            baseEvent.details = {
                prompt: getRandomItem([
                    'Update the dashboard to show real-time events',
                    'Fix the event filtering bug',
                    'Add dark mode to the interface',
                    'Implement session analytics',
                    'Create a performance monitoring dashboard'
                ]),
                cwd: `/Users/dev/${getRandomItem(PROJECT_NAMES)}`
            };
            break;
        case 'error':
            baseEvent.success = false;
            baseEvent.details = {
                error_code: getRandomItem(['ENOENT', 'EACCES', 'TIMEOUT', 'VALIDATION_ERROR']),
                error_message: getRandomItem(['File not found', 'Permission denied', 'Request timeout', 'Invalid input']),
                context: { tool_name: getRandomItem(TOOL_NAMES) }
            };
            break;
        case 'pre_compact':
            baseEvent.details = {
                trigger: getRandomItem(['manual', 'auto']),
                context_size: Math.floor(Math.random() * 50000) + 10000
            };
            break;
        case 'notification':
            baseEvent.details = {
                message: getRandomItem([
                    'Claude needs your permission to use Bash',
                    'Claude is waiting for your input',
                    'Tool execution requires confirmation'
                ]),
                notification_type: getRandomItem(['permission_request', 'idle_warning', 'confirmation'])
            };
            break;
    }

    return baseEvent;
}

// UI Update functions
function updateConnectionStatus() {
    const latencyElement = document.querySelector('.latency');
    const latency = Math.floor(Math.random() * 20) + 8; // 8-28ms
    latencyElement.textContent = `${latency}ms`;
}

function updateSystemMetrics() {
    const eventsPerMin = document.getElementById('eventsPerMin');
    const avgDuration = document.getElementById('avgDuration');
    const totalEvents = document.getElementById('totalEvents');
    const uptime = document.getElementById('uptime');
    
    // Calculate events per minute from recent events
    const now = new Date();
    const oneMinuteAgo = new Date(now.getTime() - 60000);
    const recentEvents = mockEvents.filter(event => event.timestamp > oneMinuteAgo);
    eventsPerMin.textContent = recentEvents.length;
    
    // Calculate average duration from tool events
    const toolEvents = mockEvents.filter(event => event.duration_ms);
    const avgDur = toolEvents.length > 0 
        ? Math.floor(toolEvents.reduce((sum, event) => sum + event.duration_ms, 0) / toolEvents.length)
        : 0;
    avgDuration.textContent = `${avgDur}ms`;
    
    // Update total events
    totalEvents.textContent = mockEvents.length.toLocaleString();
    
    // Update uptime (mock calculation)
    const uptimeMinutes = Math.floor((Date.now() - (Date.now() - 2.5 * 3600000)) / 60000);
    const hours = Math.floor(uptimeMinutes / 60);
    const minutes = uptimeMinutes % 60;
    uptime.textContent = `${hours}h ${minutes}m`;
}

function updateActiveSessionsPreview() {
    const activeSessions = mockSessions.filter(session => session.status === 'active');
    const sessionCountBadge = document.getElementById('sessionCountBadge');
    const activeSessionsCount = document.getElementById('activeSessionsCount');
    const sessionsPreview = document.getElementById('sessionsPreview');
    
    sessionCountBadge.textContent = activeSessions.length;
    activeSessionsCount.textContent = activeSessions.length;
    
    sessionsPreview.innerHTML = activeSessions.map(session => `
        <div class="session-preview-card" style="--session-color: ${session.color}">
            <div class="session-header">
                <div class="session-id">${session.id}</div>
                <div class="session-status ${session.status}">${session.status}</div>
            </div>
            <div class="session-details">
                <div>${session.projectName || 'Unknown Project'}</div>
                <div>${formatTimestamp(session.startedAt)}</div>
            </div>
        </div>
    `).join('');
}

function updateEventChart() {
    if (!eventChart) return;
    
    // Prepare data for the last 15 minutes in 1-minute intervals
    const now = new Date();
    const intervals = [];
    const eventCounts = {};
    
    // Initialize intervals and event counts
    for (let i = 14; i >= 0; i--) {
        const time = new Date(now.getTime() - i * 60000);
        const label = formatTimestamp(time);
        intervals.push(label);
        eventCounts[label] = {};
        Object.keys(EVENT_TYPES).forEach(type => {
            eventCounts[label][type] = 0;
        });
    }
    
    // Count events in each interval
    mockEvents.forEach(event => {
        const eventTime = event.timestamp;
        const intervalStart = new Date(Math.floor(eventTime.getTime() / 60000) * 60000);
        const label = formatTimestamp(intervalStart);
        
        if (eventCounts[label]) {
            eventCounts[label][event.type]++;
        }
    });
    
    // Prepare chart datasets
    const datasets = Object.keys(EVENT_TYPES).map(type => ({
        label: EVENT_TYPES[type].label,
        data: intervals.map(interval => eventCounts[interval][type]),
        backgroundColor: EVENT_TYPES[type].color + '80',
        borderColor: EVENT_TYPES[type].color,
        borderWidth: 1,
        fill: false
    }));
    
    eventChart.data.labels = intervals;
    eventChart.data.datasets = datasets;
    eventChart.update('none');
    
    // Update chart legend
    updateChartLegend();
}

function updateChartLegend() {
    const chartLegend = document.getElementById('chartLegend');
    chartLegend.innerHTML = Object.keys(EVENT_TYPES).map(type => `
        <div class="legend-item">
            <div class="legend-color" style="background-color: ${EVENT_TYPES[type].color}"></div>
            <span>${EVENT_TYPES[type].label}</span>
        </div>
    `).join('');
}

function updateEventFeed() {
    const eventFeed = document.getElementById('eventFeed');
    
    // Filter events based on active filters
    let filteredEvents = mockEvents;
    if (activeFilters.size > 0) {
        filteredEvents = mockEvents.filter(event => activeFilters.has(event.type));
    }
    
    // Sort by timestamp (most recent first) and take latest 50
    const recentEvents = filteredEvents
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
        .slice(0, 50);
    
    eventFeed.innerHTML = recentEvents.map(event => {
        const parameters = formatParameters(event);
        return `
            <div class="event-card" data-type="${event.type}">
                <div class="event-timestamp">${formatTimestamp(event.timestamp)}</div>
                <div class="event-type-badge">${EVENT_TYPES[event.type].label}</div>
                <div class="event-main-info">
                    ${event.tool_name ? `<div class="event-tool-name">${event.tool_name}</div>` : ''}
                    <div class="event-summary">${event.summary}</div>
                    ${parameters ? `<div class="event-parameters">${parameters}</div>` : ''}
                </div>
                ${event.duration_ms ? `<div class="event-duration">${formatDuration(event.duration_ms)}</div>` : ''}
                <div class="event-session-id">${truncateSessionId(event.session_id)}</div>
            </div>
        `;
    }).join('');
}

function createEventTypeFilters() {
    const eventTypeFilters = document.getElementById('eventTypeFilters');
    eventTypeFilters.innerHTML = Object.keys(EVENT_TYPES).map(type => `
        <button class="event-type-filter" data-type="${type}">
            ${EVENT_TYPES[type].label}
        </button>
    `).join('');
    
    // Add filter click handlers
    eventTypeFilters.addEventListener('click', (e) => {
        if (e.target.classList.contains('event-type-filter')) {
            const eventType = e.target.dataset.type;
            
            if (activeFilters.has(eventType)) {
                activeFilters.delete(eventType);
                e.target.classList.remove('active');
            } else {
                activeFilters.add(eventType);
                e.target.classList.add('active');
            }
            
            updateEventFeed();
        }
    });
}

function initializeChart() {
    const ctx = document.getElementById('eventChart').getContext('2d');
    
    eventChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: [],
            datasets: []
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    backgroundColor: 'rgba(26, 31, 46, 0.95)',
                    titleColor: '#e5e7eb',
                    bodyColor: '#d1d5db',
                    borderColor: '#374151',
                    borderWidth: 1,
                    callbacks: {
                        title: function(context) {
                            return `Time: ${context[0].label}`;
                        },
                        label: function(context) {
                            const count = context.raw;
                            const type = context.dataset.label;
                            return `${type}: ${count} events`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    display: true,
                    grid: {
                        color: 'rgba(75, 85, 99, 0.3)'
                    },
                    ticks: {
                        color: '#9ca3af',
                        maxTicksLimit: 8
                    }
                },
                y: {
                    display: true,
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(75, 85, 99, 0.3)'
                    },
                    ticks: {
                        color: '#9ca3af',
                        stepSize: 1
                    }
                }
            },
            elements: {
                point: {
                    radius: 3,
                    hoverRadius: 5
                },
                line: {
                    tension: 0.2
                }
            },
            interaction: {
                mode: 'nearest',
                axis: 'x',
                intersect: false
            }
        }
    });
}

function addNewEvent() {
    if (isPaused) return;
    
    const newEvent = generateMockEvent();
    mockEvents.unshift(newEvent);
    
    // Keep only recent events (last 1000)
    if (mockEvents.length > 1000) {
        mockEvents = mockEvents.slice(0, 1000);
    }
    
    updateEventFeed();
    updateEventChart();
    updateSystemMetrics();
}

function simulateRealtimeEvents() {
    // Add a new event every 2-5 seconds
    const nextEventDelay = Math.random() * 3000 + 2000;
    setTimeout(() => {
        addNewEvent();
        simulateRealtimeEvents();
    }, nextEventDelay);
}

// Event handlers
function setupEventHandlers() {
    // Pause/Resume button
    const pauseBtn = document.getElementById('pauseBtn');
    pauseBtn.addEventListener('click', () => {
        isPaused = !isPaused;
        pauseBtn.innerHTML = isPaused ? '▶️ Resume' : '⏸️ Pause';
        pauseBtn.style.background = isPaused ? '#10b981' : '#f59e0b';
    });
    
    // Clear button
    const clearBtn = document.getElementById('clearBtn');
    clearBtn.addEventListener('click', () => {
        mockEvents = [];
        updateEventFeed();
        updateEventChart();
        updateSystemMetrics();
    });
    
    // Time range buttons
    const timeRangeBtns = document.querySelectorAll('.time-range-btn');
    timeRangeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            timeRangeBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            // In a real implementation, this would change the chart time range
            updateEventChart();
        });
    });
}

// Initialize the dashboard
function initialize() {
    // Generate initial mock data
    mockSessions = Array.from({length: 5}, () => generateMockSession());
    mockEvents = Array.from({length: 100}, () => generateMockEvent());
    
    // Sort events by timestamp
    mockEvents.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    
    // Initialize UI components
    initializeChart();
    createEventTypeFilters();
    setupEventHandlers();
    
    // Initial UI updates
    updateActiveSessionsPreview();
    updateEventChart();
    updateEventFeed();
    updateSystemMetrics();
    
    // Start real-time updates
    simulateRealtimeEvents();
    
    // Update connection status every few seconds
    setInterval(updateConnectionStatus, 3000);
    
    // Update system metrics every 10 seconds
    setInterval(updateSystemMetrics, 10000);
}

// Start the dashboard when DOM is loaded
document.addEventListener('DOMContentLoaded', initialize);