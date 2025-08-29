# Chronicle API Reference

## Overview

Chronicle provides a comprehensive REST API and WebSocket interface for accessing event data, session information, and real-time updates. The API is built with FastAPI and provides OpenAPI documentation, request validation, and high-performance endpoints.

## Base URL and Authentication

- **Base URL**: `http://localhost:8510/api`
- **Authentication**: None required for local installation
- **Content-Type**: `application/json`
- **Documentation**: `http://localhost:8510/api/docs` (Interactive Swagger UI)

## API Endpoints

### Events API

#### Create Event
```http
POST /api/events
```

Creates a new event in Chronicle.

**Request Body:**
```json
{
  "session_id": "123e4567-e89b-12d3-a456-426614174000",
  "event_type": "tool_use", 
  "timestamp": "2024-01-01T12:00:00Z",
  "metadata": {
    "tool_name": "bash",
    "command": "ls -la",
    "success": true
  },
  "tool_name": "bash",
  "duration_ms": 250
}
```

**Response (201 Created):**
```json
{
  "data": {
    "id": "456e7890-e89b-12d3-a456-426614174001",
    "session_id": "123e4567-e89b-12d3-a456-426614174000",
    "event_type": "tool_use",
    "timestamp": "2024-01-01T12:00:00Z",
    "metadata": {
      "tool_name": "bash",
      "command": "ls -la", 
      "success": true
    },
    "tool_name": "bash",
    "duration_ms": 250,
    "created_at": "2024-01-01T12:00:00.123Z"
  },
  "timestamp": "2024-01-01T12:00:00.123Z"
}
```

**Valid Event Types:**
- `session_start` - Session initialization
- `user_prompt_submit` - User input submission
- `pre_tool_use` - Before tool execution
- `post_tool_use` - After tool execution
- `tool_use` - General tool usage
- `notification` - System notifications
- `stop` - Session termination
- `subagent_stop` - Sub-agent termination
- `error` - Error events

#### List Events
```http
GET /api/events
```

Retrieves events with filtering and pagination.

**Query Parameters:**
- `session_id` (string, optional) - Filter by session ID
- `event_type` (string, optional) - Filter by event type
- `tool_name` (string, optional) - Filter by tool name
- `limit` (integer, optional) - Number of results (1-1000, default: 50)
- `offset` (integer, optional) - Number of results to skip (default: 0)
- `order_by` (string, optional) - Sort order (default: "timestamp:desc")

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": "456e7890-e89b-12d3-a456-426614174001",
      "session_id": "123e4567-e89b-12d3-a456-426614174000",
      "event_type": "tool_use",
      "timestamp": "2024-01-01T12:00:00Z",
      "metadata": {
        "tool_name": "bash"
      },
      "tool_name": "bash",
      "duration_ms": 250,
      "created_at": "2024-01-01T12:00:00.123Z"
    }
  ],
  "total": 100,
  "limit": 50,
  "offset": 0,
  "has_more": true,
  "timestamp": "2024-01-01T12:00:00.123Z"
}
```

**Example Requests:**
```bash
# Get all events
curl "http://localhost:8510/api/events"

# Filter by session
curl "http://localhost:8510/api/events?session_id=abc123&limit=10"

# Filter by event type
curl "http://localhost:8510/api/events?event_type=tool_use&order_by=timestamp:asc"

# Multiple filters with pagination
curl "http://localhost:8510/api/events?tool_name=bash&limit=25&offset=50"
```

#### Delete Event (Admin)
```http
DELETE /api/events/{event_id}
```

Deletes a specific event (admin only).

**Path Parameters:**
- `event_id` (string, required) - Event ID to delete

**Query Parameters:**
- `admin_key` (string, required) - Admin authorization key

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Event 456e7890-e89b-12d3-a456-426614174001 deleted successfully",
  "timestamp": "2024-01-01T12:00:00.123Z"
}
```

### Sessions API

#### List Sessions
```http
GET /api/sessions
```

Retrieves Chronicle sessions with event counts.

**Query Parameters:**
- `limit` (integer, optional) - Number of results (1-1000, default: 50)
- `offset` (integer, optional) - Number of results to skip (default: 0)
- `project_path` (string, optional) - Filter by project path
- `active_only` (boolean, optional) - Return only active sessions (default: false)

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "claude_session_id": "claude-session-123",
      "project_path": "/Users/m/project",
      "git_branch": "main",
      "start_time": "2024-01-01T12:00:00Z",
      "end_time": null,
      "metadata": {
        "source": "cli"
      },
      "event_count": 42,
      "created_at": "2024-01-01T12:00:00Z",
      "updated_at": "2024-01-01T12:30:00Z"
    }
  ],
  "total": 25,
  "limit": 50,
  "offset": 0,
  "has_more": false,
  "timestamp": "2024-01-01T12:00:00.123Z"
}
```

**Example Requests:**
```bash
# Get all sessions
curl "http://localhost:8510/api/sessions"

# Get active sessions only
curl "http://localhost:8510/api/sessions?active_only=true"

# Filter by project path
curl "http://localhost:8510/api/sessions?project_path=/Users/m/project"
```

### Metrics API

#### Dashboard Metrics
```http
GET /api/metrics
```

Returns comprehensive dashboard metrics and statistics.

**Query Parameters:**
- `days` (integer, optional) - Number of days for metrics calculation (1-90, default: 7)

**Response (200 OK):**
```json
{
  "total_sessions": 150,
  "active_sessions": 3,
  "total_events": 2500,
  "events_today": 45,
  "top_event_types": [
    {
      "event_type": "tool_use",
      "count": 850
    },
    {
      "event_type": "user_prompt_submit", 
      "count": 420
    }
  ],
  "session_duration_avg_minutes": 45.5,
  "most_active_projects": [
    {
      "project_path": "/Users/m/project1",
      "session_count": 15,
      "event_count": 342
    }
  ],
  "recent_activity": [
    {
      "project_path": "/Users/m/project1",
      "git_branch": "main",
      "event_type": "tool_use",
      "timestamp": "2024-01-01T11:45:00Z",
      "tool_name": "bash"
    }
  ],
  "timestamp": "2024-01-01T12:00:00Z"
}
```

### Health API

#### API Health Check
```http
GET /api/health
```

Returns API and database health status.

**Response (200 OK):**
```json
{
  "status": "healthy",
  "api_version": "1.0.0",
  "database": {
    "status": "healthy",
    "stats": {
      "session_count": 150,
      "event_count": 2500,
      "db_size_mb": 15.2
    }
  },
  "endpoints_available": [
    "GET /api/events",
    "POST /api/events",
    "GET /api/sessions", 
    "GET /api/metrics",
    "DELETE /api/events/{id}"
  ],
  "timestamp": "2024-01-01T12:00:00Z"
}
```

## WebSocket API

### Connection
```
ws://localhost:8510/ws
```

Establishes a WebSocket connection for real-time event streaming.

#### Connection Process
1. Connect to WebSocket endpoint
2. Send subscription message with filters
3. Receive real-time event updates
4. Handle heartbeat/ping-pong messages

#### Client Messages

**Subscribe to Events:**
```json
{
  "type": "subscribe",
  "filters": {
    "session_ids": ["session-123"],
    "event_types": ["tool_use", "user_prompt_submit"],
    "project_paths": ["/Users/m/project"]
  }
}
```

**Pong Response:**
```json
{
  "type": "pong",
  "timestamp": "2024-01-01T12:00:00Z"
}
```

#### Server Messages

**Event Update:**
```json
{
  "type": "event",
  "data": {
    "id": "456e7890-e89b-12d3-a456-426614174001",
    "session_id": "123e4567-e89b-12d3-a456-426614174000",
    "event_type": "tool_use",
    "timestamp": "2024-01-01T12:00:00Z",
    "metadata": {
      "tool_name": "bash"
    }
  }
}
```

**Ping Request:**
```json
{
  "type": "ping",
  "timestamp": "2024-01-01T12:00:00Z"
}
```

**Connection Status:**
```json
{
  "type": "connection_status",
  "status": "connected",
  "client_id": "client-123",
  "timestamp": "2024-01-01T12:00:00Z"
}
```

#### WebSocket Example (JavaScript)

```javascript
// Connect to WebSocket
const ws = new WebSocket('ws://localhost:8510/ws');

// Handle connection open
ws.onopen = function() {
    console.log('Connected to Chronicle WebSocket');
    
    // Subscribe to events
    ws.send(JSON.stringify({
        type: 'subscribe',
        filters: {
            session_ids: ['current-session'],
            event_types: ['tool_use', 'user_prompt_submit']
        }
    }));
};

// Handle incoming messages
ws.onmessage = function(event) {
    const message = JSON.parse(event.data);
    
    switch(message.type) {
        case 'event':
            console.log('New event:', message.data);
            // Update UI with new event
            break;
            
        case 'ping':
            // Respond to server ping
            ws.send(JSON.stringify({
                type: 'pong',
                timestamp: new Date().toISOString()
            }));
            break;
            
        case 'connection_status':
            console.log('Connection status:', message.status);
            break;
    }
};

// Handle errors
ws.onerror = function(error) {
    console.error('WebSocket error:', error);
};

// Handle connection close
ws.onclose = function() {
    console.log('WebSocket connection closed');
    // Implement reconnection logic
};
```

## Server-Sent Events (SSE)

### Stream Events
```http
GET /api/events/stream
```

Alternative to WebSocket for real-time events using Server-Sent Events.

**Response Headers:**
```
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
Access-Control-Allow-Origin: *
```

**Event Stream Format:**
```
data: {"type":"event","data":{"id":"456","event_type":"tool_use"}}

data: {"type":"heartbeat","timestamp":"2024-01-01T12:00:00Z"}

data: {"type":"connection_status","status":"connected"}
```

#### SSE Example (JavaScript)

```javascript
// Create EventSource connection
const eventSource = new EventSource('http://localhost:8510/api/events/stream');

// Handle incoming events
eventSource.onmessage = function(event) {
    const data = JSON.parse(event.data);
    
    switch(data.type) {
        case 'event':
            console.log('New event:', data.data);
            break;
            
        case 'heartbeat':
            console.log('Server heartbeat:', data.timestamp);
            break;
    }
};

// Handle errors
eventSource.onerror = function(error) {
    console.error('SSE error:', error);
};

// Close connection
// eventSource.close();
```

## Error Handling

### Error Response Format

All API errors return a consistent format:

```json
{
  "error": "Database operation failed",
  "operation": "create_event", 
  "message": "SQLite database is locked",
  "timestamp": "2024-01-01T12:00:00Z",
  "status_code": 500
}
```

### HTTP Status Codes

- **200 OK** - Request successful
- **201 Created** - Resource created successfully
- **400 Bad Request** - Invalid request parameters
- **401 Unauthorized** - Authentication required
- **404 Not Found** - Resource not found
- **422 Unprocessable Entity** - Validation error
- **500 Internal Server Error** - Server error
- **503 Service Unavailable** - Database unavailable

### Common Error Scenarios

#### Validation Error (422)
```json
{
  "detail": [
    {
      "loc": ["body", "event_type"],
      "msg": "ensure this value is one of: session_start, tool_use, ...",
      "type": "value_error.const"
    }
  ]
}
```

#### Database Connection Error (503)
```json
{
  "error": "Database not available",
  "message": "Database connection failed",
  "timestamp": "2024-01-01T12:00:00Z"
}
```

## Rate Limiting

Chronicle implements rate limiting to prevent abuse:

- **API Requests**: 1000 requests per minute per IP
- **WebSocket Events**: 100 events per second per connection
- **Event Creation**: 500 events per minute per session

Rate limit headers are included in responses:
```
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1640995200
```

## Performance Considerations

### Response Times
- **Event Creation**: < 10ms average
- **Event Queries**: < 100ms with proper indexing  
- **Session Queries**: < 50ms average
- **Metrics Calculation**: < 200ms for 7-day period

### Optimization Tips

1. **Use Filters**: Always filter queries to reduce data transfer
2. **Pagination**: Use appropriate limit/offset for large datasets
3. **WebSocket**: Prefer WebSocket over polling for real-time updates
4. **Batch Operations**: Group multiple events when possible
5. **Indexes**: Database is pre-optimized with proper indexes

### Example Optimized Queries

```bash
# Efficient: Use filters and pagination
curl "http://localhost:8510/api/events?session_id=abc123&limit=50"

# Inefficient: Large unfiltered queries
curl "http://localhost:8510/api/events?limit=1000"

# Efficient: Specific event types
curl "http://localhost:8510/api/events?event_type=tool_use"
```

## SDK and Client Libraries

### Python Client Example

```python
import requests
import json

class ChronicleClient:
    def __init__(self, base_url="http://localhost:8510/api"):
        self.base_url = base_url
    
    def create_event(self, event_data):
        response = requests.post(
            f"{self.base_url}/events",
            json=event_data,
            headers={"Content-Type": "application/json"}
        )
        return response.json()
    
    def get_events(self, filters=None):
        params = filters or {}
        response = requests.get(
            f"{self.base_url}/events",
            params=params
        )
        return response.json()
    
    def get_metrics(self, days=7):
        response = requests.get(
            f"{self.base_url}/metrics",
            params={"days": days}
        )
        return response.json()

# Usage
client = ChronicleClient()

# Create event
event = client.create_event({
    "session_id": "session-123",
    "event_type": "tool_use",
    "timestamp": "2024-01-01T12:00:00Z",
    "metadata": {"tool_name": "bash"}
})

# Get filtered events
events = client.get_events({
    "session_id": "session-123",
    "limit": 10
})
```

### TypeScript Client Example

```typescript
interface ChronicleEvent {
  id?: string;
  session_id: string;
  event_type: string;
  timestamp: string;
  metadata: Record<string, any>;
  tool_name?: string;
  duration_ms?: number;
}

class ChronicleClient {
  constructor(private baseUrl = 'http://localhost:8510/api') {}
  
  async createEvent(event: ChronicleEvent): Promise<any> {
    const response = await fetch(`${this.baseUrl}/events`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(event)
    });
    
    return response.json();
  }
  
  async getEvents(filters?: Record<string, any>): Promise<any> {
    const params = new URLSearchParams(filters);
    const response = await fetch(`${this.baseUrl}/events?${params}`);
    return response.json();
  }
  
  async getMetrics(days = 7): Promise<any> {
    const response = await fetch(`${this.baseUrl}/metrics?days=${days}`);
    return response.json();
  }
}

// Usage
const client = new ChronicleClient();

const event = await client.createEvent({
  session_id: 'session-123',
  event_type: 'tool_use',
  timestamp: new Date().toISOString(),
  metadata: { tool_name: 'bash' }
});
```

## Testing the API

### Manual Testing with curl

```bash
# Health check
curl http://localhost:8510/api/health

# Create test event
curl -X POST http://localhost:8510/api/events \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": "test-session",
    "event_type": "tool_use",
    "timestamp": "2024-01-01T12:00:00Z",
    "metadata": {"tool_name": "curl", "test": true}
  }'

# List recent events
curl "http://localhost:8510/api/events?limit=5"

# Get dashboard metrics
curl http://localhost:8510/api/metrics
```

### Automated Testing

Chronicle includes comprehensive API tests in `apps/server/test_api_endpoints.py`. Run tests with:

```bash
cd apps/server
python -m pytest test_api_endpoints.py -v
```

## Support and Documentation

- **Interactive API Docs**: http://localhost:8510/api/docs
- **OpenAPI Schema**: http://localhost:8510/api/openapi.json
- **Health Status**: http://localhost:8510/health
- **Server Info**: http://localhost:8510/api/info

For additional help, see:
- [Architecture Guide](architecture.md)
- [Troubleshooting Guide](../admin-guide/troubleshooting.md)
- [Server Management](../admin-guide/server-management.md)