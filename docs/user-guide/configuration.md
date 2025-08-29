# Configuration Guide

Chronicle offers flexible configuration options to adapt to different environments and use cases. This guide covers environment variables, backend mode selection, dashboard customization, and performance tuning options.

## Environment Variables

Chronicle uses environment variables for configuration across both the dashboard and hooks components:

### Core Configuration Variables

#### Backend Mode Selection
```bash
# Choose between local SQLite or Supabase backend
CHRONICLE_BACKEND_MODE=local          # Options: local, supabase
CHRONICLE_DATABASE_PATH=./data/chronicle.db  # SQLite database path (local mode only)
```

#### Dashboard Configuration
```bash
# Dashboard application settings
NEXT_PUBLIC_APP_TITLE="Chronicle Dashboard"
NEXT_PUBLIC_ENVIRONMENT=development   # Options: development, staging, production
NEXT_PUBLIC_LOG_LEVEL=info           # Options: error, warn, info, debug
NEXT_PUBLIC_THEME=light              # Options: light, dark (future feature)
```

#### Server Configuration (Local Mode)
```bash
# Chronicle server settings for local SQLite backend
CHRONICLE_SERVER_HOST=localhost
CHRONICLE_SERVER_PORT=8001
CHRONICLE_SERVER_URL=http://localhost:8001
```

#### Supabase Configuration (Cloud Mode)
```bash
# Supabase backend settings
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here  # Optional, for admin operations
```

### Performance and Monitoring Variables

#### Update Frequencies
```bash
# Real-time update intervals (milliseconds)
NEXT_PUBLIC_EVENTS_POLL_INTERVAL=1000        # Event polling frequency
NEXT_PUBLIC_SESSIONS_POLL_INTERVAL=5000      # Session data refresh rate
NEXT_PUBLIC_METRICS_UPDATE_INTERVAL=2000     # Performance metrics update rate
```

#### Connection and Retry Settings
```bash
# Backend connection configuration
NEXT_PUBLIC_CONNECTION_TIMEOUT=10000         # Connection timeout (ms)
NEXT_PUBLIC_RETRY_ATTEMPTS=3                 # Number of retry attempts
NEXT_PUBLIC_RETRY_DELAY=1000                 # Delay between retries (ms)
NEXT_PUBLIC_MAX_RECONNECT_ATTEMPTS=5         # Maximum reconnection attempts
```

#### Data Management Settings
```bash
# Event and session data handling
NEXT_PUBLIC_MAX_EVENTS_IN_MEMORY=1000        # Maximum events to keep in memory
NEXT_PUBLIC_EVENT_CLEANUP_INTERVAL=300000    # Cleanup old events (5 minutes)
NEXT_PUBLIC_SESSION_TIMEOUT=3600000          # Session timeout (1 hour)
```

### Security and Privacy Variables

#### Data Protection Settings
```bash
# Security configuration
NEXT_PUBLIC_ENABLE_ANALYTICS=false           # Disable analytics collection
NEXT_PUBLIC_SECURE_COOKIES=true              # Use secure cookies (production)
NEXT_PUBLIC_CSRF_PROTECTION=true             # Enable CSRF protection
```

#### Debugging and Development
```bash
# Development and debugging options
NEXT_PUBLIC_DEBUG_MODE=false                 # Enable debug logging
NEXT_PUBLIC_ENABLE_PERFORMANCE_MONITORING=true  # Performance monitoring
NEXT_PUBLIC_MOCK_DATA_MODE=false             # Use mock data instead of backend
```

## Backend Mode Configuration

Chronicle supports two backend modes with different configuration requirements:

### Local SQLite Backend Mode

#### Overview
- **Storage**: Local SQLite database file
- **Performance**: High performance, no network latency
- **Setup**: Minimal configuration required
- **Use Case**: Single-user development environments
- **Data Privacy**: Complete local data control

#### Configuration Steps

1. **Set Backend Mode**
```bash
echo "CHRONICLE_BACKEND_MODE=local" >> .env.local
```

2. **Configure Database Path**
```bash
echo "CHRONICLE_DATABASE_PATH=./data/chronicle.db" >> .env.local
```

3. **Set Server Connection (if using Chronicle server)**
```bash
echo "CHRONICLE_SERVER_URL=http://localhost:8001" >> .env.local
```

4. **Start Chronicle Server** (if needed)
```bash
cd apps/server
python run_server.py
```

#### Local Mode Benefits
- **No External Dependencies**: Works completely offline
- **Fast Performance**: Direct database access
- **Simple Setup**: Minimal configuration required
- **Data Control**: All data stays on your machine
- **Development Friendly**: Easy debugging and inspection

#### Local Mode Limitations
- **Single User**: Cannot share data across users
- **No Real-time Collaboration**: Limited to single machine
- **Manual Backup**: Need to backup SQLite file manually
- **Scalability**: Limited to single machine resources

### Supabase Backend Mode

#### Overview
- **Storage**: Cloud-hosted PostgreSQL database
- **Performance**: Network-dependent but highly scalable
- **Setup**: Requires Supabase project setup
- **Use Case**: Team environments and production deployments
- **Features**: Real-time updates, collaboration, backup

#### Configuration Steps

1. **Create Supabase Project**
   - Visit [supabase.com](https://supabase.com)
   - Create new project
   - Note the project URL and API keys

2. **Set Backend Mode**
```bash
echo "CHRONICLE_BACKEND_MODE=supabase" >> .env.local
```

3. **Configure Supabase Connection**
```bash
echo "SUPABASE_URL=https://your-project.supabase.co" >> .env.local
echo "SUPABASE_ANON_KEY=your_anon_key_here" >> .env.local
```

4. **Optional: Service Role Key**
```bash
echo "SUPABASE_SERVICE_ROLE_KEY=your_service_role_key" >> .env.local
```

5. **Setup Database Schema**
```bash
cd apps/hooks
python scripts/setup_schema.py
```

#### Supabase Mode Benefits
- **Real-time Updates**: Live collaboration across multiple users
- **Scalability**: Handle multiple concurrent users and high event volumes
- **Backup and Recovery**: Automatic backups and point-in-time recovery
- **Team Sharing**: Multiple users can access same Chronicle instance
- **Production Ready**: Suitable for production deployments

#### Supabase Mode Limitations
- **Network Dependency**: Requires internet connection
- **External Service**: Dependent on Supabase availability
- **Configuration Complexity**: More setup steps required
- **Cost**: May incur costs based on usage (free tier available)

## Dashboard Customization

### Layout Configuration

#### Responsive Breakpoints
```bash
# Customize responsive design breakpoints
NEXT_PUBLIC_MOBILE_BREAKPOINT=768
NEXT_PUBLIC_TABLET_BREAKPOINT=1024
NEXT_PUBLIC_DESKTOP_BREAKPOINT=1280
```

#### Panel Sizing
```bash
# Default panel sizes
NEXT_PUBLIC_SIDEBAR_WIDTH_EXPANDED=220
NEXT_PUBLIC_SIDEBAR_WIDTH_COLLAPSED=48
NEXT_PUBLIC_HEADER_HEIGHT=40
NEXT_PUBLIC_FOOTER_HEIGHT=0
```

#### Grid System Configuration
```bash
# CSS Grid layout configuration
NEXT_PUBLIC_GRID_COLUMNS=12
NEXT_PUBLIC_GRID_GAP=16
NEXT_PUBLIC_CONTENT_MAX_WIDTH=1920
```

### UI Customization Options

#### Color Scheme and Theming
```bash
# Theme configuration (future enhancement)
NEXT_PUBLIC_THEME=light                      # light, dark, auto
NEXT_PUBLIC_PRIMARY_COLOR=#0066cc
NEXT_PUBLIC_SECONDARY_COLOR=#6b7280
NEXT_PUBLIC_ACCENT_COLOR=#10b981
NEXT_PUBLIC_ERROR_COLOR=#ef4444
```

#### Event Display Options
```bash
# Event card display configuration
NEXT_PUBLIC_EVENT_CARD_COMPACT_MODE=false    # Compact vs detailed event cards
NEXT_PUBLIC_SHOW_EVENT_TIMESTAMPS=true       # Show/hide timestamps
NEXT_PUBLIC_SHOW_SESSION_IDS=true            # Show/hide session identifiers
NEXT_PUBLIC_EVENT_AUTO_EXPAND=false          # Auto-expand event details
```

#### Dashboard Features Toggle
```bash
# Enable/disable dashboard features
NEXT_PUBLIC_SHOW_PERFORMANCE_METRICS=true    # Performance metrics display
NEXT_PUBLIC_SHOW_CONNECTION_STATUS=true      # Connection status indicators
NEXT_PUBLIC_ENABLE_KEYBOARD_SHORTCUTS=true   # Keyboard navigation
NEXT_PUBLIC_ENABLE_AUTO_SCROLL=true          # Auto-scroll in event feed
```

### Persistence Settings

#### Local Storage Configuration
```bash
# Browser storage settings
NEXT_PUBLIC_ENABLE_LAYOUT_PERSISTENCE=true   # Save layout preferences
NEXT_PUBLIC_ENABLE_FILTER_PERSISTENCE=true   # Save filter settings
NEXT_PUBLIC_STORAGE_KEY_PREFIX=chronicle_     # LocalStorage key prefix
```

#### Session Storage Options
```bash
# Session-specific storage
NEXT_PUBLIC_PERSIST_SESSION_FILTERS=true     # Remember session-specific filters
NEXT_PUBLIC_PERSIST_SIDEBAR_STATE=true       # Remember sidebar collapsed state
NEXT_PUBLIC_PERSIST_TIME_RANGE=false         # Remember time range selections
```

## Performance Tuning Options

### Memory Management

#### Event Buffer Configuration
```bash
# Control memory usage for event handling
NEXT_PUBLIC_MAX_EVENTS_IN_MEMORY=1000        # Maximum events to keep loaded
NEXT_PUBLIC_EVENT_BUFFER_SIZE=500            # Number of events to batch process
NEXT_PUBLIC_CLEANUP_INTERVAL=300000          # Memory cleanup interval (ms)
```

#### Virtualization Settings
```bash
# Virtual scrolling performance
NEXT_PUBLIC_VIRTUAL_LIST_ITEM_HEIGHT=60      # Height of virtual list items
NEXT_PUBLIC_VIRTUAL_LIST_OVERSCAN=10         # Number of extra items to render
NEXT_PUBLIC_ENABLE_VIRTUALIZATION=true       # Enable virtual scrolling
```

### Network Optimization

#### Connection Pooling
```bash
# Network connection optimization
NEXT_PUBLIC_MAX_CONCURRENT_REQUESTS=5        # Maximum concurrent API requests
NEXT_PUBLIC_REQUEST_TIMEOUT=10000            # Request timeout (ms)
NEXT_PUBLIC_ENABLE_REQUEST_BATCHING=true     # Batch multiple requests
```

#### Caching Configuration
```bash
# Client-side caching settings
NEXT_PUBLIC_CACHE_SESSION_DATA=true          # Cache session data locally
NEXT_PUBLIC_CACHE_DURATION=300000            # Cache duration (5 minutes)
NEXT_PUBLIC_ENABLE_STALE_WHILE_REVALIDATE=true  # SWR caching strategy
```

### Real-time Update Optimization

#### Polling Configuration
```bash
# Optimize real-time update frequencies
NEXT_PUBLIC_EVENTS_POLL_INTERVAL=1000        # Event polling (1 second)
NEXT_PUBLIC_SESSIONS_POLL_INTERVAL=5000      # Session polling (5 seconds)
NEXT_PUBLIC_ADAPTIVE_POLLING=true            # Adjust polling based on activity
```

#### WebSocket Configuration (Future Feature)
```bash
# WebSocket real-time updates (planned feature)
NEXT_PUBLIC_ENABLE_WEBSOCKETS=false          # Use WebSocket for real-time updates
NEXT_PUBLIC_WEBSOCKET_URL=ws://localhost:8001/ws
NEXT_PUBLIC_WEBSOCKET_RECONNECT_ATTEMPTS=5
```

## Environment-Specific Configurations

### Development Environment

#### Development-Specific Settings
```bash
# Development environment configuration
NODE_ENV=development
NEXT_PUBLIC_ENVIRONMENT=development
NEXT_PUBLIC_LOG_LEVEL=debug
NEXT_PUBLIC_DEBUG_MODE=true
NEXT_PUBLIC_MOCK_DATA_MODE=false
NEXT_PUBLIC_ENABLE_PERFORMANCE_MONITORING=true
```

#### Hot Reload and Development Features
```bash
# Development productivity features
NEXT_PUBLIC_HOT_RELOAD_EVENTS=true           # Hot reload event components
NEXT_PUBLIC_SHOW_DEBUG_INFO=true             # Show debug information
NEXT_PUBLIC_ENABLE_REACT_STRICT_MODE=true    # React strict mode
```

### Production Environment

#### Production Optimizations
```bash
# Production environment configuration
NODE_ENV=production
NEXT_PUBLIC_ENVIRONMENT=production
NEXT_PUBLIC_LOG_LEVEL=warn
NEXT_PUBLIC_DEBUG_MODE=false
NEXT_PUBLIC_SECURE_COOKIES=true
NEXT_PUBLIC_CSRF_PROTECTION=true
```

#### Performance and Security
```bash
# Production performance settings
NEXT_PUBLIC_ENABLE_COMPRESSION=true          # Enable response compression
NEXT_PUBLIC_ENABLE_CDN=true                  # Use CDN for static assets
NEXT_PUBLIC_STRICT_SSL=true                  # Enforce HTTPS
NEXT_PUBLIC_SECURITY_HEADERS=true            # Add security headers
```

### Staging Environment

#### Staging-Specific Settings
```bash
# Staging environment configuration
NODE_ENV=production
NEXT_PUBLIC_ENVIRONMENT=staging
NEXT_PUBLIC_LOG_LEVEL=info
NEXT_PUBLIC_DEBUG_MODE=false
NEXT_PUBLIC_ENABLE_ANALYTICS=false
```

## Configuration File Management

### Environment File Structure

#### Primary Configuration Files
```
.env.local              # Local development overrides (git-ignored)
.env.development        # Development environment defaults
.env.staging           # Staging environment settings
.env.production        # Production environment settings
```

#### Template Files
```
.env.local.template    # Template for local configuration
chronicle.env.template # Chronicle hooks configuration template
```

### Configuration Validation

#### Startup Validation
Chronicle validates configuration at startup:
- **Required Variables**: Ensures critical variables are set
- **Format Validation**: Validates variable formats and types
- **Connection Testing**: Tests backend connectivity
- **Security Checks**: Warns about insecure configuration

#### Runtime Validation
```bash
# Validate configuration
npm run validate:config

# Test backend connection
npm run test:connection

# Check environment health
npm run health:check
```

### Configuration Loading Order

Chronicle loads configuration in the following order (later values override earlier):

1. **Default Values**: Built-in application defaults
2. **Environment Files**: `.env.development`, `.env.staging`, `.env.production`
3. **Local Overrides**: `.env.local` (highest priority)
4. **System Environment**: System environment variables
5. **Runtime Configuration**: Dynamic configuration changes

## Troubleshooting Configuration Issues

### Common Configuration Problems

#### Backend Connection Issues
- **Incorrect Mode**: Verify `CHRONICLE_BACKEND_MODE` is set correctly
- **Missing Variables**: Check required variables for chosen backend mode
- **Network Issues**: Test connectivity to Supabase or local server
- **Authentication**: Verify API keys and credentials

#### Performance Issues
- **Memory Usage**: Adjust `MAX_EVENTS_IN_MEMORY` if experiencing memory issues
- **Update Frequency**: Reduce polling intervals if performance is poor
- **Network Latency**: Increase timeout values for slow connections
- **Browser Resources**: Disable features if browser becomes unresponsive

#### Display Issues
- **Layout Problems**: Check responsive breakpoint configuration
- **Missing Features**: Verify feature flags are enabled correctly
- **Theme Issues**: Ensure theme configuration is valid
- **Persistence Problems**: Clear browser storage if settings aren't saving

### Diagnostic Commands

#### Configuration Debugging
```bash
# Check current configuration
npm run config:show

# Validate environment variables
npm run config:validate

# Test backend connectivity
npm run backend:test

# Check system health
npm run health:full
```

#### Log Analysis
```bash
# Enable debug logging
NEXT_PUBLIC_LOG_LEVEL=debug npm run dev

# Check browser console for errors
# Look for configuration warnings in startup logs
# Monitor network requests in browser dev tools
```

### Getting Help

#### Configuration Support Resources
- **Documentation**: This configuration guide
- **Templates**: Use provided `.env.template` files
- **Examples**: Check `docs/setup/` for setup examples
- **Community**: See project README for support channels

#### Self-Service Troubleshooting
1. **Check Templates**: Compare your configuration with template files
2. **Validate Environment**: Run configuration validation commands
3. **Test Connectivity**: Use built-in connection testing tools
4. **Review Logs**: Check application and browser logs for errors
5. **Reset Configuration**: Try default settings to isolate issues

For more information on related topics:
- [Installation Guide](../setup/installation.md) - Initial setup and installation
- [Dashboard Overview](./dashboard-overview.md) - Dashboard features and usage
- [Session Management](./session-management.md) - Session configuration options