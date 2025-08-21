// Chronicle Dashboard - Timeline Variant JavaScript

class TimelineDashboard {
  constructor() {
    this.eventChart = null;
    this.mockData = this.generateMockData();
    this.currentTimeRange = '5m';
    this.selectedEvent = null;
    
    this.init();
  }

  init() {
    this.updateCurrentTime();
    this.setupEventListeners();
    this.renderSessions();
    this.initChart();
    this.renderTimeline();
    this.startRealTimeUpdates();
  }

  generateMockData() {
    const now = new Date();
    const events = [];
    const sessions = [];
    
    // Generate events for the last 6 hours
    const eventTypes = [
      { type: 'tool-execution', label: 'Tool Execution', color: '#00d4ff', frequency: 0.3 },
      { type: 'user-interaction', label: 'User Interaction', color: '#00ff88', frequency: 0.4 },
      { type: 'system-event', label: 'System Event', color: '#bb44ff', frequency: 0.2 },
      { type: 'notification', label: 'Notification', color: '#ff6600', frequency: 0.1 }
    ];

    const tools = ['Read', 'Write', 'Bash', 'Grep', 'Edit', 'WebSearch', 'LS'];
    const descriptions = {
      'tool-execution': [
        'File system operation completed',
        'Database query executed',
        'API request processed',
        'Code analysis finished',
        'Search operation completed'
      ],
      'user-interaction': [
        'User submitted prompt',
        'Session started',
        'Filter applied',
        'View switched',
        'Export requested'
      ],
      'system-event': [
        'Connection established',
        'Health check passed',
        'Cache updated',
        'Backup completed',
        'Security scan finished'
      ],
      'notification': [
        'Alert triggered',
        'Threshold exceeded',
        'Update available',
        'Warning issued',
        'Status changed'
      ]
    };

    // Create event clusters to show temporal patterns
    const clusterCenters = [
      now.getTime() - 5 * 60 * 1000,   // 5 minutes ago
      now.getTime() - 15 * 60 * 1000,  // 15 minutes ago
      now.getTime() - 45 * 60 * 1000,  // 45 minutes ago
      now.getTime() - 90 * 60 * 1000,  // 1.5 hours ago
      now.getTime() - 180 * 60 * 1000, // 3 hours ago
    ];

    let eventId = 1;
    clusterCenters.forEach((centerTime, clusterIndex) => {
      const clusterSize = Math.floor(Math.random() * 20) + 10;
      
      for (let i = 0; i < clusterSize; i++) {
        const eventType = eventTypes[Math.floor(Math.random() * eventTypes.length)];
        const timestamp = new Date(centerTime + (Math.random() - 0.5) * 10 * 60 * 1000); // ±5 minutes
        
        const event = {
          id: eventId++,
          type: eventType.type,
          label: eventType.label,
          timestamp: timestamp,
          tool: eventType.type === 'tool-execution' ? tools[Math.floor(Math.random() * tools.length)] : null,
          description: descriptions[eventType.type][Math.floor(Math.random() * descriptions[eventType.type].length)],
          sessionId: `session-${Math.floor(Math.random() * 5) + 1}`,
          duration: eventType.type === 'tool-execution' ? Math.floor(Math.random() * 5000) + 500 : null,
          status: Math.random() > 0.1 ? 'success' : 'error',
          metadata: {
            user: `user-${Math.floor(Math.random() * 3) + 1}`,
            clientVersion: '1.2.3',
            environment: 'production'
          }
        };
        
        events.push(event);
      }
    });

    // Generate active sessions
    for (let i = 1; i <= 5; i++) {
      const lastActivity = new Date(now.getTime() - Math.random() * 30 * 60 * 1000);
      const status = Math.random() > 0.3 ? 'active' : 'waiting';
      
      sessions.push({
        id: `session-${i}`,
        status: status,
        lastActivity: lastActivity,
        eventCount: Math.floor(Math.random() * 50) + 10,
        userId: `user-${Math.floor(Math.random() * 3) + 1}`,
        startTime: new Date(lastActivity.getTime() - Math.random() * 120 * 60 * 1000),
        currentTool: status === 'active' ? tools[Math.floor(Math.random() * tools.length)] : null
      });
    }

    // Sort events by timestamp
    events.sort((a, b) => b.timestamp - a.timestamp);

    return { events, sessions, eventTypes };
  }

  updateCurrentTime() {
    const timeElement = document.getElementById('current-time');
    const now = new Date();
    timeElement.textContent = now.toLocaleTimeString();
    
    // Update stats
    document.getElementById('events-count').textContent = this.mockData.events.length.toLocaleString();
    
    const recentEvents = this.mockData.events.filter(
      e => now - e.timestamp < 60 * 1000
    ).length;
    document.getElementById('rate-indicator').textContent = `+${recentEvents}/min`;
  }

  setupEventListeners() {
    // Timeline range buttons
    document.querySelectorAll('.timeline-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.timeline-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        this.currentTimeRange = e.target.dataset.range;
        this.renderTimeline();
      });
    });

    // Modal close
    document.getElementById('modal-close').addEventListener('click', () => {
      this.closeModal();
    });

    document.getElementById('modal-overlay').addEventListener('click', (e) => {
      if (e.target === e.currentTarget) {
        this.closeModal();
      }
    });

    // Escape key to close modal
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeModal();
      }
    });
  }

  renderSessions() {
    const sessionsGrid = document.getElementById('sessions-grid');
    const sessions = this.mockData.sessions;
    
    sessionsGrid.innerHTML = sessions.map(session => {
      const timeSinceActivity = this.formatTimeSince(session.lastActivity);
      
      return `
        <div class="session-card" onclick="dashboard.showSessionDetails('${session.id}')">
          <div class="session-header">
            <div class="session-id">${session.id}</div>
            <div class="session-status ${session.status}">${session.status}</div>
          </div>
          <div class="session-details">
            <div class="session-time">Last activity: ${timeSinceActivity} ago</div>
            <div class="session-activity">
              ${session.eventCount} events • ${session.currentTool || 'Idle'}
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  initChart() {
    const ctx = document.getElementById('eventChart').getContext('2d');
    
    // Prepare data for the last 2 hours in 5-minute intervals
    const now = new Date();
    const intervals = [];
    const dataByType = {};
    
    // Initialize data structure
    this.mockData.eventTypes.forEach(type => {
      dataByType[type.type] = [];
    });
    
    // Create 5-minute intervals for the last 2 hours
    for (let i = 23; i >= 0; i--) {
      const intervalStart = new Date(now.getTime() - i * 5 * 60 * 1000);
      const intervalEnd = new Date(intervalStart.getTime() + 5 * 60 * 1000);
      
      intervals.push(intervalStart);
      
      // Count events in this interval by type
      this.mockData.eventTypes.forEach(type => {
        const count = this.mockData.events.filter(event => 
          event.type === type.type && 
          event.timestamp >= intervalStart && 
          event.timestamp < intervalEnd
        ).length;
        
        dataByType[type.type].push(count);
      });
    }

    const datasets = this.mockData.eventTypes.map((type, index) => ({
      label: type.label,
      data: dataByType[type.type],
      backgroundColor: type.color + '40',
      borderColor: type.color,
      borderWidth: 2,
      fill: true,
      tension: 0.4
    }));

    this.eventChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: intervals,
        datasets: datasets
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
            backgroundColor: '#1e1e1e',
            titleColor: '#ffffff',
            bodyColor: '#cccccc',
            borderColor: '#333333',
            borderWidth: 1
          }
        },
        scales: {
          x: {
            type: 'time',
            time: {
              displayFormats: {
                minute: 'HH:mm'
              }
            },
            grid: {
              color: '#333333'
            },
            ticks: {
              color: '#888888'
            }
          },
          y: {
            beginAtZero: true,
            grid: {
              color: '#333333'
            },
            ticks: {
              color: '#888888'
            }
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

  renderTimeline() {
    const timelineTrack = document.getElementById('timeline-track');
    const eventTimeline = document.getElementById('event-timeline');
    
    // Calculate time range
    const now = new Date();
    let startTime, duration;
    
    switch (this.currentTimeRange) {
      case '5m':
        duration = 5 * 60 * 1000;
        break;
      case '15m':
        duration = 15 * 60 * 1000;
        break;
      case '1h':
        duration = 60 * 60 * 1000;
        break;
      case '6h':
        duration = 6 * 60 * 60 * 1000;
        break;
      default:
        duration = 5 * 60 * 1000;
    }
    
    startTime = new Date(now.getTime() - duration);
    
    // Filter events in range
    const eventsInRange = this.mockData.events.filter(event => 
      event.timestamp >= startTime && event.timestamp <= now
    );

    // Create time markers every 30 seconds for 5m view, adjust for other ranges
    const markerInterval = this.currentTimeRange === '5m' ? 30 * 1000 : 
                          this.currentTimeRange === '15m' ? 2 * 60 * 1000 :
                          this.currentTimeRange === '1h' ? 10 * 60 * 1000 :
                          60 * 60 * 1000;
    
    const timelineWidth = 2000; // Fixed width for horizontal scrolling
    
    // Render time markers
    timelineTrack.innerHTML = '';
    timelineTrack.style.width = `${timelineWidth}px`;
    
    for (let time = startTime.getTime(); time <= now.getTime(); time += markerInterval) {
      const markerTime = new Date(time);
      const position = ((time - startTime.getTime()) / duration) * timelineWidth;
      
      const marker = document.createElement('div');
      marker.className = 'time-marker';
      marker.style.left = `${position}px`;
      marker.dataset.time = markerTime.toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit',
        second: this.currentTimeRange === '5m' ? '2-digit' : undefined
      });
      
      timelineTrack.appendChild(marker);
    }

    // Render events
    eventTimeline.innerHTML = '';
    eventTimeline.style.width = `${timelineWidth}px`;
    
    // Group events by time proximity to avoid overlap
    const eventLanes = this.organizeEventsInLanes(eventsInRange, startTime, duration, timelineWidth);
    
    eventLanes.forEach((lane, laneIndex) => {
      lane.forEach(event => {
        const eventCard = this.createEventCard(event, laneIndex);
        eventTimeline.appendChild(eventCard);
      });
    });
  }

  organizeEventsInLanes(events, startTime, duration, timelineWidth) {
    const lanes = [];
    const laneHeight = 80;
    const cardWidth = 200;
    const cardMargin = 10;
    
    events.forEach(event => {
      const position = ((event.timestamp.getTime() - startTime.getTime()) / duration) * timelineWidth;
      
      // Find a lane where this event fits
      let assignedLane = -1;
      for (let i = 0; i < lanes.length; i++) {
        const lane = lanes[i];
        const hasConflict = lane.some(otherEvent => {
          const otherPosition = ((otherEvent.timestamp.getTime() - startTime.getTime()) / duration) * timelineWidth;
          return Math.abs(position - otherPosition) < cardWidth + cardMargin;
        });
        
        if (!hasConflict) {
          assignedLane = i;
          break;
        }
      }
      
      // Create new lane if needed
      if (assignedLane === -1) {
        assignedLane = lanes.length;
        lanes.push([]);
      }
      
      // Add event to lane with position info
      event._position = position;
      event._lane = assignedLane;
      lanes[assignedLane].push(event);
    });
    
    return lanes;
  }

  createEventCard(event, laneIndex) {
    const card = document.createElement('div');
    card.className = `event-card ${event.type}`;
    card.style.left = `${event._position}px`;
    card.style.top = `${laneIndex * 90 + 10}px`;
    
    const timeStr = event.timestamp.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit',
      second: '2-digit'
    });
    
    card.innerHTML = `
      <div class="event-header">
        <div class="event-type">${event.label}</div>
        <div class="event-time">${timeStr}</div>
      </div>
      <div class="event-description">
        ${event.tool ? `${event.tool}: ` : ''}${event.description}
      </div>
    `;
    
    card.addEventListener('click', () => {
      this.showEventDetails(event);
    });
    
    return card;
  }

  showEventDetails(event) {
    this.selectedEvent = event;
    const modal = document.getElementById('modal-overlay');
    const title = document.getElementById('modal-title');
    const body = document.getElementById('modal-body');
    
    title.textContent = `${event.label} - ${event.id}`;
    
    body.innerHTML = `
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
        <div>
          <h4 style="color: #00d4ff; margin-bottom: 10px;">Event Details</h4>
          <p><strong>Type:</strong> ${event.label}</p>
          <p><strong>Timestamp:</strong> ${event.timestamp.toLocaleString()}</p>
          <p><strong>Session:</strong> ${event.sessionId}</p>
          <p><strong>Status:</strong> ${event.status}</p>
          ${event.tool ? `<p><strong>Tool:</strong> ${event.tool}</p>` : ''}
          ${event.duration ? `<p><strong>Duration:</strong> ${event.duration}ms</p>` : ''}
          <p><strong>Description:</strong> ${event.description}</p>
        </div>
        <div>
          <h4 style="color: #00d4ff; margin-bottom: 10px;">Metadata</h4>
          <pre style="background: #0a0a0a; padding: 10px; border-radius: 4px; font-size: 0.9rem; color: #cccccc; overflow-x: auto;">${JSON.stringify(event.metadata, null, 2)}</pre>
        </div>
      </div>
    `;
    
    modal.style.display = 'flex';
  }

  showSessionDetails(sessionId) {
    const session = this.mockData.sessions.find(s => s.id === sessionId);
    if (!session) return;
    
    const modal = document.getElementById('modal-overlay');
    const title = document.getElementById('modal-title');
    const body = document.getElementById('modal-body');
    
    title.textContent = `Session Details - ${sessionId}`;
    
    const sessionEvents = this.mockData.events.filter(e => e.sessionId === sessionId);
    const timeSinceStart = this.formatTimeSince(session.startTime);
    const timeSinceActivity = this.formatTimeSince(session.lastActivity);
    
    body.innerHTML = `
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
        <div>
          <h4 style="color: #00d4ff; margin-bottom: 10px;">Session Info</h4>
          <p><strong>Status:</strong> ${session.status}</p>
          <p><strong>User:</strong> ${session.userId}</p>
          <p><strong>Started:</strong> ${timeSinceStart} ago</p>
          <p><strong>Last Activity:</strong> ${timeSinceActivity} ago</p>
          <p><strong>Total Events:</strong> ${session.eventCount}</p>
          ${session.currentTool ? `<p><strong>Current Tool:</strong> ${session.currentTool}</p>` : ''}
        </div>
        <div>
          <h4 style="color: #00d4ff; margin-bottom: 10px;">Recent Events</h4>
          <div style="max-height: 200px; overflow-y: auto;">
            ${sessionEvents.slice(0, 10).map(event => `
              <div style="padding: 8px; border-left: 3px solid ${this.getEventColor(event.type)}; margin-bottom: 8px; background: #1a1a1a; border-radius: 4px;">
                <div style="font-weight: 600; font-size: 0.9rem;">${event.label}</div>
                <div style="color: #888; font-size: 0.8rem;">${event.timestamp.toLocaleTimeString()}</div>
                <div style="font-size: 0.8rem; margin-top: 4px;">${event.description}</div>
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    `;
    
    modal.style.display = 'flex';
  }

  getEventColor(eventType) {
    const typeMap = {
      'tool-execution': '#00d4ff',
      'user-interaction': '#00ff88',
      'system-event': '#bb44ff',
      'notification': '#ff6600'
    };
    return typeMap[eventType] || '#888888';
  }

  closeModal() {
    document.getElementById('modal-overlay').style.display = 'none';
    this.selectedEvent = null;
  }

  formatTimeSince(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    
    if (diffSecs < 60) {
      return `${diffSecs}s`;
    } else if (diffMins < 60) {
      return `${diffMins}m`;
    } else {
      return `${diffHours}h ${diffMins % 60}m`;
    }
  }

  startRealTimeUpdates() {
    // Update current time every second
    setInterval(() => {
      this.updateCurrentTime();
    }, 1000);
    
    // Simulate new events every 10-30 seconds
    setInterval(() => {
      this.simulateNewEvent();
    }, Math.random() * 20000 + 10000);
    
    // Update timeline every 30 seconds
    setInterval(() => {
      this.renderTimeline();
    }, 30000);
    
    // Update chart every minute
    setInterval(() => {
      this.updateChart();
    }, 60000);
  }

  simulateNewEvent() {
    const now = new Date();
    const eventTypes = this.mockData.eventTypes;
    const eventType = eventTypes[Math.floor(Math.random() * eventTypes.length)];
    
    const newEvent = {
      id: Date.now(),
      type: eventType.type,
      label: eventType.label,
      timestamp: now,
      description: 'Real-time event simulation',
      sessionId: `session-${Math.floor(Math.random() * 5) + 1}`,
      status: 'success',
      metadata: {
        user: `user-${Math.floor(Math.random() * 3) + 1}`,
        clientVersion: '1.2.3',
        environment: 'production'
      }
    };
    
    // Add to beginning of events array
    this.mockData.events.unshift(newEvent);
    
    // Keep only last 1000 events to prevent memory issues
    if (this.mockData.events.length > 1000) {
      this.mockData.events = this.mockData.events.slice(0, 1000);
    }
    
    // Update displays if viewing current time range
    if (this.currentTimeRange === '5m') {
      this.renderTimeline();
    }
  }

  updateChart() {
    // Rebuild chart data with latest events
    const ctx = document.getElementById('eventChart').getContext('2d');
    this.eventChart.destroy();
    this.initChart();
  }
}

// Initialize dashboard when page loads
let dashboard;
document.addEventListener('DOMContentLoaded', () => {
  dashboard = new TimelineDashboard();
});

// Expose dashboard globally for HTML onclick handlers
window.dashboard = dashboard;