# PRD: Database Middleware Server for Chronicle

## Executive Summary

This PRD defines the implementation of a database middleware server that will decouple database operations from Chronicle's Claude Code hooks. The server will be built using Python FastAPI and will handle all database interactions, allowing hooks to be lightweight and fault-tolerant while providing a centralized, scalable data layer.

## Problem Statement

Current limitations:
- **Heavy hooks**: Database logic embedded in hooks increases execution time and complexity
- **Tight coupling**: Hooks are tightly coupled to specific database implementations (Supabase/SQLite)
- **Limited flexibility**: Users cannot easily switch database backends
- **Error propagation**: Database failures can cause hook failures, disrupting Claude Code operations
- **Poor observability**: Database operations are difficult to monitor and debug separately from hooks
- **No batching**: Each hook makes individual database calls without optimization

## Solution Overview

Implement a Python FastAPI middleware server that:
1. Receives event data from lightweight hooks via HTTP
2. Handles all database operations with automatic failover
3. Provides configurable database backend support
4. Implements batching and performance optimizations
5. Offers comprehensive logging and monitoring
6. Enables graceful degradation when unavailable

## Architecture

### Three-Tier Architecture

1. **Hooks Layer** (Lightweight UV Scripts)
   - Fire on Claude Code events
   - Send event payloads to middleware server
   - Gracefully handle server unavailability
   - No direct database dependencies

2. **Middleware Server** (Python FastAPI)
   - Receives and processes hook events
   - Manages database connections and pooling
   - Implements retry logic and failover
   - Provides REST API for dashboard
   - Handles batch operations

3. **Dashboard** (Next.js Frontend)
   - Connects to Supabase for real-time updates
   - Falls back to polling middleware API if needed
   - Displays events and session data

### Technology Stack Decision

**Python FastAPI** chosen over Node.js for the following reasons:
- **Consistency**: Aligns with existing Python hook codebase
- **Code reuse**: Can leverage existing database models and logic
- **Async support**: Built on asyncio, matching current implementation
- **Performance**: FastAPI offers excellent performance with automatic async handling
- **Documentation**: Auto-generated OpenAPI/Swagger documentation
- **Type safety**: Pydantic models provide runtime validation
- **Ecosystem**: Rich Python ecosystem for database operations (SQLAlchemy, asyncpg, etc.)

## Features

### Feature 1: Core Server Infrastructure

**Description:** Implement the base FastAPI server with health checks, configuration, and logging.

**Requirements:**
- FastAPI application with proper project structure
- Configuration management via environment variables and config files
- Structured logging with different log levels
- Health and readiness endpoints
- Graceful shutdown handling
- CORS configuration for dashboard access
- Rate limiting and request throttling

**API Endpoints:**
- `GET /health` - Basic health check
- `GET /ready` - Readiness check (database connectivity)
- `GET /metrics` - Prometheus-compatible metrics
- `GET /config` - Current configuration (sanitized)

### Feature 2: Event Ingestion API

**Description:** REST API endpoints for receiving events from hooks.

**Requirements:**
- Async event processing with immediate acknowledgment
- Request validation using Pydantic models
- Queue-based processing for reliability
- Duplicate event detection
- Event schema versioning support
- Compression support (gzip/brotli)

**API Endpoints:**
- `POST /events` - Bulk event submission
- `POST /events/{event_type}` - Single event submission
- `POST /sessions/start` - Session initialization
- `POST /sessions/{session_id}/end` - Session termination

**Request Format:**
```json
{
  "event_id": "uuid",
  "session_id": "uuid",
  "event_type": "string",
  "timestamp": "iso8601",
  "payload": {},
  "metadata": {
    "hook_version": "string",
    "retry_count": 0
  }
}
```

### Feature 3: Database Abstraction Layer

**Description:** Pluggable database backend with automatic failover.

**Requirements:**
- Abstract database interface with multiple implementations
- Primary: Supabase (PostgreSQL)
- Fallback: Local SQLite
- Future: Redis, MongoDB, plain PostgreSQL
- Connection pooling and management
- Automatic schema migration
- Transaction support with rollback

**Supported Operations:**
- Insert events with conflict resolution
- Batch inserts with partial failure handling
- Query events with filtering and pagination
- Update session metadata
- Delete old events (retention policy)

### Feature 4: Intelligent Batching System

**Description:** Optimize database writes through intelligent batching.

**Requirements:**
- Time-based batching (e.g., flush every 100ms)
- Size-based batching (e.g., flush at 100 events)
- Priority-based flushing for critical events
- Batch compression for network efficiency
- Partial batch success handling
- Metrics for batch performance

**Configuration:**
```yaml
batching:
  enabled: true
  max_batch_size: 100
  max_wait_time_ms: 100
  compression: gzip
  priority_events:
    - session_start
    - error
```

### Feature 5: Retry and Failover Logic

**Description:** Robust error handling with automatic failover.

**Requirements:**
- Exponential backoff for retries
- Circuit breaker pattern for failing services
- Automatic failover to SQLite on Supabase failure
- Dead letter queue for failed events
- Automatic recovery and sync when primary comes back
- Alert notifications for failover events

**Failover Strategy:**
1. Try Supabase (3 attempts with exponential backoff)
2. If fails, write to local SQLite
3. Queue for later sync
4. Background job to sync SQLite → Supabase
5. Alert on repeated failures

### Feature 6: Query and Analytics API

**Description:** REST API for dashboard and analytics queries.

**Requirements:**
- RESTful query endpoints
- GraphQL support (future)
- Filtering, sorting, and pagination
- Aggregation queries
- Time-series data support
- Response caching

**API Endpoints:**
- `GET /sessions` - List sessions with filters
- `GET /sessions/{id}` - Get session details
- `GET /sessions/{id}/events` - Get session events
- `GET /events` - Query events with filters
- `GET /stats` - Aggregated statistics
- `GET /analytics/usage` - Usage analytics

### Feature 7: Real-time Event Streaming

**Description:** WebSocket/SSE support for real-time updates.

**Requirements:**
- WebSocket endpoint for live event streaming
- Server-Sent Events (SSE) as fallback
- Event filtering and subscriptions
- Connection management and heartbeat
- Backpressure handling
- Authentication and authorization

**Endpoints:**
- `WS /ws/events` - WebSocket connection
- `GET /sse/events` - SSE stream

### Feature 8: Monitoring and Observability

**Description:** Comprehensive monitoring and debugging capabilities.

**Requirements:**
- Structured JSON logging
- Log aggregation support (ELK, Datadog)
- Prometheus metrics export
- OpenTelemetry tracing
- Performance profiling endpoints
- Debug mode with verbose logging

**Metrics:**
- Request count and latency
- Database operation timing
- Batch sizes and efficiency
- Error rates by type
- Queue depths
- Connection pool statistics

### Feature 9: Security and Authentication

**Description:** Secure the middleware server and its APIs.

**Requirements:**
- API key authentication for hooks
- JWT authentication for dashboard
- Rate limiting per client
- IP allowlisting (optional)
- TLS/SSL support
- Input sanitization and validation
- SQL injection prevention
- Secrets management integration

### Feature 10: Configuration Management

**Description:** Flexible configuration system.

**Requirements:**
- Environment variable support
- Configuration file (YAML/JSON)
- Runtime configuration updates
- Feature flags
- Multi-environment support
- Configuration validation

**Configuration Structure:**
```yaml
server:
  host: 0.0.0.0
  port: 8000
  workers: 4
  
database:
  primary:
    type: supabase
    url: ${SUPABASE_URL}
    key: ${SUPABASE_KEY}
  fallback:
    type: sqlite
    path: ./data/chronicle.db
    
logging:
  level: info
  format: json
  
batching:
  enabled: true
  max_size: 100
  max_wait_ms: 100
```

### Feature 11: Deployment and Packaging

**Description:** Easy deployment options for various environments.

**Requirements:**
- Docker container with multi-stage build
- Docker Compose for local development
- Kubernetes manifests and Helm chart
- Systemd service configuration
- Cloud deployment guides (AWS, GCP, Azure)
- One-click deployment scripts

**Deployment Options:**
1. **Local**: Direct Python or Docker
2. **Cloud**: Managed containers (ECS, Cloud Run, AKS)
3. **Self-hosted**: VPS with systemd
4. **Serverless**: AWS Lambda (with limitations)

### Feature 12: Migration and Compatibility

**Description:** Smooth migration from current architecture.

**Requirements:**
- Data migration scripts from existing databases
- Backward compatibility with current hooks (initially)
- Gradual migration path
- Rollback capability
- A/B testing support
- Performance comparison tools

## Hook Modifications

### Simplified Hook Structure

**Before:** Complex database logic in each hook
**After:** Simple HTTP POST with retry

```python
# Simplified hook example
async def send_event(event_data):
    try:
        async with httpx.AsyncClient(timeout=0.1) as client:
            await client.post(
                f"{MIDDLEWARE_URL}/events",
                json=event_data,
                headers={"X-API-Key": API_KEY}
            )
    except Exception:
        # Silently fail to not disrupt Claude Code
        pass
```

## Performance Requirements

- **Latency**: < 10ms for event acknowledgment
- **Throughput**: 10,000 events/second minimum
- **Availability**: 99.9% uptime
- **Hook overhead**: < 5ms added to hook execution
- **Memory**: < 500MB under normal load
- **CPU**: < 2 cores under normal load

## Testing Strategy

1. **Unit tests**: All components with >80% coverage
2. **Integration tests**: Database failover scenarios
3. **Load tests**: Verify performance requirements
4. **Chaos testing**: Network failures, database outages
5. **End-to-end tests**: Full flow from hook to dashboard

## Rollout Plan

### Phase 1: MVP
- Core server infrastructure
- Event ingestion API
- Basic database abstraction (Supabase + SQLite)
- Simple batching

### Phase 2: Reliability
- Retry and failover logic
- Monitoring and observability
- Security basics
- Docker packaging

### Phase 3: Performance
- Intelligent batching optimization
- Query API with caching
- Real-time streaming
- Load testing and optimization

### Phase 4: Production
- Full security implementation
- Deployment automation
- Migration tools
- Documentation and guides

## Success Metrics

- **Hook execution time**: Reduced by 50%
- **Database failure impact**: Zero hook failures due to DB issues
- **Event loss**: < 0.01% under normal conditions
- **User adoption**: 80% of users migrate to new architecture
- **Support tickets**: 50% reduction in database-related issues

## Future Enhancements

1. **Multi-region support**: Geographic distribution
2. **Event replay**: Historical event replay capability
3. **Custom processors**: User-defined event processing
4. **Webhook integrations**: Send events to external services
5. **Data export**: Scheduled exports to S3/GCS
6. **Machine learning**: Anomaly detection and insights
7. **GraphQL API**: More flexible querying
8. **Plugin system**: Extensible architecture

## Dependencies and Risks

### Dependencies
- FastAPI and its ecosystem
- Existing database schemas
- Dashboard API requirements
- User migration willingness

### Risks
- **Performance overhead**: Mitigated by async processing and batching
- **Additional complexity**: Mitigated by good documentation and automation
- **Migration challenges**: Mitigated by backward compatibility
- **Server availability**: Mitigated by graceful degradation in hooks

## Conclusion

The database middleware server will transform Chronicle's architecture into a more scalable, reliable, and maintainable system. By decoupling database operations from hooks, we enable better performance, easier debugging, and greater flexibility for users while maintaining backward compatibility and ensuring a smooth migration path.