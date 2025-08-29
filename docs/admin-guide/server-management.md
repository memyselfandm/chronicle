# Chronicle Server Management Guide

## Overview

Chronicle provides a self-contained FastAPI server that manages real-time event streaming between the Claude Code hooks and the dashboard. The server operates on localhost:8510 and supports both SQLite (default) and Supabase backends.

## Server Architecture

- **Host**: 127.0.0.1 (localhost)
- **Port**: 8510
- **Protocol**: HTTP/WebSocket
- **Backend**: FastAPI with uvicorn
- **Database**: SQLite (default) or PostgreSQL via Supabase

## Starting the Server

### Automatic Startup (Recommended)

The Chronicle installer includes automatic server management:

```bash
# Install and auto-start server
python install.py

# Server automatically starts on localhost:8510
# Dashboard available at http://localhost:3000
```

### Manual Server Startup

If you need to manually start the server:

```bash
# From the project root
cd apps/server
python main.py

# With custom options
python main.py --host 127.0.0.1 --port 8510 --debug

# Or using the run script
python run_server.py
```

### Server Startup Options

```bash
python main.py --help

Options:
  --host TEXT     Host to bind to (default: 127.0.0.1)
  --port INTEGER  Port to bind to (default: 8510)
  --debug         Enable debug mode with hot reload
```

## Stopping the Server

### Graceful Shutdown

The server supports graceful shutdown via signal handling:

```bash
# Send SIGTERM or SIGINT
Ctrl+C  # In terminal
kill -TERM <pid>
kill -INT <pid>
```

### Shutdown Process

When stopping, the server performs these cleanup steps:

1. Stop event broadcaster monitoring
2. Close all WebSocket connections
3. Close database connections
4. Release system resources

## Health Monitoring

### Health Check Endpoint

Monitor server health with the built-in endpoint:

```bash
curl http://localhost:8510/health

# Response:
{
  "status": "healthy",
  "version": "1.0.0",
  "timestamp": "2024-12-03T10:30:00Z",
  "components": {
    "database": {
      "status": "healthy",
      "path": "/path/to/chronicle.db"
    },
    "event_broadcaster": {
      "status": "healthy",
      "running": true
    },
    "websocket": {
      "status": "healthy", 
      "active_connections": 2
    }
  }
}
```

### Server Information

Get detailed server information:

```bash
curl http://localhost:8510/api/info

# Returns comprehensive server details including:
# - Version and configuration
# - Available endpoints
# - Database statistics
# - WebSocket connection stats
# - Event broadcaster metrics
```

### Performance Statistics

Monitor real-time performance metrics:

```bash
curl http://localhost:8510/api/stats

# Returns:
# - Server uptime and version
# - Database performance metrics
# - WebSocket connection statistics
# - Event processing statistics
```

## Process Management

### Finding the Server Process

```bash
# Find Chronicle server process
ps aux | grep "main.py"
lsof -i :8510
netstat -an | grep 8510
```

### Process Monitoring

```bash
# Monitor resource usage
top -p <pid>
htop -p <pid>

# Monitor connections
netstat -an | grep 8510
ss -tuln | grep 8510
```

### Automatic Process Management

For production environments, consider using a process manager:

#### Using systemd (Linux)

Create `/etc/systemd/system/chronicle.service`:

```ini
[Unit]
Description=Chronicle Server
After=network.target

[Service]
Type=simple
User=chronicle
WorkingDirectory=/path/to/chronicle/apps/server
ExecStart=/usr/bin/python3 main.py
Restart=always
RestartSec=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=chronicle

[Install]
WantedBy=multi-user.target
```

Then:
```bash
sudo systemctl enable chronicle
sudo systemctl start chronicle
sudo systemctl status chronicle
```

#### Using supervisord

Add to supervisord.conf:

```ini
[program:chronicle]
command=/usr/bin/python3 main.py
directory=/path/to/chronicle/apps/server
autostart=true
autorestart=true
redirect_stderr=true
stdout_logfile=/var/log/chronicle.log
```

## Log Management

### Server Logs

Chronicle uses structured logging with configurable levels:

```python
# Log levels: DEBUG, INFO, WARNING, ERROR, CRITICAL
# Default: INFO

# Enable debug logging
python main.py --debug
```

### Log Output

Server logs include:

- Request/response logging with timing
- WebSocket connection events
- Database operations
- Error handling and stack traces
- Performance metrics

### Log Format

```
2024-12-03 10:30:00 - chronicle.server - INFO - 📥 GET /health
2024-12-03 10:30:00 - chronicle.server - INFO - 📤 200 GET /health - 2.45ms
```

### Log Rotation

For production, implement log rotation:

```bash
# Using logrotate
cat > /etc/logrotate.d/chronicle << EOF
/var/log/chronicle.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    create 644 chronicle chronicle
}
EOF
```

## Security Considerations

### Network Security

- Server binds to localhost only (127.0.0.1) by default
- CORS configured for dashboard origin (localhost:3000)
- Trusted host middleware prevents host header attacks

### Process Security

```bash
# Run as dedicated user (recommended)
useradd -r -s /bin/false chronicle
chown -R chronicle:chronicle /path/to/chronicle

# Limit process capabilities
# Consider using systemd security features:
# NoNewPrivileges=yes
# PrivateTmp=yes
# ProtectSystem=strict
```

### File Permissions

```bash
# Secure database directory
chmod 700 /path/to/chronicle/data
chmod 600 /path/to/chronicle/data/chronicle.db

# Secure configuration files
chmod 600 .env*
```

## Troubleshooting

### Common Issues

**Server won't start:**
```bash
# Check if port is in use
lsof -i :8510

# Check database connectivity
python -c "from database import create_local_database; db = create_local_database(); print(db.test_connection())"
```

**High CPU usage:**
```bash
# Check for runaway processes
top -p <pid>

# Monitor database queries
# Enable query logging in SQLite
```

**Memory issues:**
```bash
# Monitor memory usage
ps -o pid,rss,vsz,comm -p <pid>

# Check for memory leaks
# Review WebSocket connections
curl http://localhost:8510/api/stats
```

### Performance Issues

**Slow response times:**
1. Check database performance (see performance-tuning.md)
2. Monitor active WebSocket connections
3. Review event processing backlog
4. Check disk I/O (especially for SQLite)

**Connection issues:**
1. Verify CORS configuration
2. Check firewall settings
3. Validate network connectivity
4. Review WebSocket connection limits

## Monitoring and Alerting

### Basic Monitoring Script

```bash
#!/bin/bash
# chronicle-monitor.sh

HEALTH_URL="http://localhost:8510/health"
LOG_FILE="/var/log/chronicle-monitor.log"

response=$(curl -s -w "%{http_code}" "$HEALTH_URL")
http_code="${response: -3}"

if [ "$http_code" != "200" ]; then
    echo "$(date): Chronicle server unhealthy - HTTP $http_code" >> "$LOG_FILE"
    # Add alerting logic here
else
    echo "$(date): Chronicle server healthy" >> "$LOG_FILE"
fi
```

### Integration with Monitoring Systems

Chronicle health endpoints can integrate with:

- **Prometheus**: Scrape /api/stats endpoint
- **Grafana**: Visualize metrics dashboards  
- **Datadog**: Custom health check integration
- **New Relic**: APM monitoring
- **Uptime monitors**: Ping /health endpoint

## Backup and Recovery

See [backup-restore.md](backup-restore.md) for comprehensive backup procedures.

## Performance Tuning

See [performance-tuning.md](performance-tuning.md) for optimization guidelines.

## Advanced Configuration

### Environment Variables

```bash
# Server configuration
CHRONICLE_HOST=127.0.0.1
CHRONICLE_PORT=8510
CHRONICLE_DEBUG=false

# Database configuration
CHRONICLE_DATABASE_PATH=/custom/path/chronicle.db

# Logging configuration
CHRONICLE_LOG_LEVEL=INFO
CHRONICLE_LOG_FILE=/var/log/chronicle.log
```

### Custom Server Configuration

For advanced use cases, you can customize the server configuration by modifying the server constants in `main.py`:

```python
# Server configuration
SERVER_HOST = "127.0.0.1"
SERVER_PORT = 8510
DASHBOARD_ORIGIN = "http://localhost:3000"
API_VERSION = "1.0.0"
```

## Support and Resources

- **Health Check Script**: `./scripts/health-check.sh`
- **Server Documentation**: Available at http://localhost:8510/api/docs
- **API Reference**: See [../developer-guide/api-reference.md](../developer-guide/api-reference.md)
- **Troubleshooting Guide**: See [troubleshooting.md](troubleshooting.md)