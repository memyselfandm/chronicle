# Chronicle - Observability for Claude Code

> **Real-time observability system for Claude Code agent activities with comprehensive event tracking and visualization**

## 📊 Build Status & Coverage

![Overall Coverage](./badges/overall-coverage.svg)
![Coverage Status](./badges/coverage-status.svg)
![Dashboard Coverage](./badges/dashboard-coverage.svg)
![Hooks Coverage](./badges/hooks-coverage.svg)

| Component | Coverage | Threshold | Status |
|-----------|----------|-----------|--------|
| 📊 Dashboard | 80%+ | 80% | ✅ Production Ready |
| 🪝 Hooks | 60%+ | 60% | ✅ Production Ready |
| 🔧 Core Libraries | 85%+ | 85% | ✅ Production Ready |
| 🔐 Security Modules | 90%+ | 90% | ✅ Production Ready |

## 🚀 Quick Start (< 5 minutes)

### Zero-Configuration Installation (Recommended)
```bash
# Clone and install with one command
git clone <repository-url> && cd chronicle
python install.py

# That's it! Chronicle is now monitoring Claude Code
# 📁 Installed to: ~/.claude/hooks/chronicle/
# 🌐 Dashboard: http://localhost:3000
# 🗄️ Database: Local SQLite (no external setup required)
```

### Installation Options
```bash
python install.py --help         # Show all options
python install.py --skip-deps    # Skip dependency installation
python install.py --no-start     # Don't start server after installation
python install.py --force        # Overwrite existing installation
```

### Advanced Setup (Supabase Backend)
For distributed teams or cloud deployments:
```bash
# 1. Dashboard with Supabase
cd apps/dashboard && npm install && cp .env.example .env.local
# Configure .env.local with Supabase credentials
npm run dev  # Starts on http://localhost:3000

# 2. Hooks with Supabase  
cd apps/hooks && pip install -r requirements.txt && cp .env.template .env
# Configure .env with Supabase credentials
python scripts/install.py  # Installs Claude Code hooks
```

**Health Check**:
```bash
./scripts/health-check.sh  # Validate installation
```

## 📚 Documentation

### Installation & Setup
- **[INSTALLATION.md](./INSTALLATION.md)** - Complete installation guide
- **[CONFIGURATION.md](./CONFIGURATION.md)** - Environment configuration
- **[SUPABASE_SETUP.md](./SUPABASE_SETUP.md)** - Database setup guide

### Development & Testing
- **[docs/guides/coverage.md](./docs/guides/coverage.md)** - Test coverage guide & requirements
- **[docs/reference/ci-cd.md](./docs/reference/ci-cd.md)** - CI/CD pipeline reference

### Deployment & Production
- **[docs/guides/deployment.md](./docs/guides/deployment.md)** - Production deployment guide
- **[docs/guides/security.md](./docs/guides/security.md)** - Security best practices

### Troubleshooting & Support
- **[TROUBLESHOOTING.md](./TROUBLESHOOTING.md)** - Common issues & solutions

## ✅ MVP Complete: Production Ready

### Core Components
- **Dashboard**: Next.js 15 with real-time Chronicle UI (`apps/dashboard/`)
- **Hooks System**: Python-based event capture (`apps/hooks/`)
- **Database**: Local SQLite (default) or Supabase PostgreSQL (optional)
- **Zero-Config Installation**: One-command setup with no external dependencies
- **Documentation**: Comprehensive guides for deployment

### Features Built
- **Self-Contained Mode**: Fully functional with local SQLite, no cloud required
- **Real-time Event Streaming**: Live dashboard updates (local or Supabase)
- **Complete Hook Coverage**: All Claude Code hooks implemented
- **Automatic Hook Registration**: Direct integration with Claude settings.json
- **Data Security**: Sanitization, PII filtering, secure configuration
- **Production Deployment**: Full deployment automation and monitoring
- **Comprehensive Testing**: 42+ tests across all components

## 🛠 System Requirements

- **Node.js**: 18.0.0+ (20.0.0+ recommended)
- **Python**: 3.8.0+ (3.11+ recommended)
- **Claude Code**: Latest version
- **Supabase**: Free tier sufficient for MVP

## 🚀 Performance Specifications

Chronicle is optimized for production use with validated performance metrics:

- **Event Processing**: 100+ events/second sustained throughput
- **Memory Usage**: <100MB baseline (tested peak: 51.2MB)
- **Query Performance**: <100ms response times with database indexes
- **Database**: SQLite with optimized indexes for session_id, timestamp, event_type
- **Memory Management**: Automatic cleanup at 80% capacity to prevent unbounded growth

## 🏗 Architecture

```
chronicle/
├── apps/
│   ├── dashboard/          # Next.js real-time dashboard
│   └── hooks/             # Python hook system
├── scripts/               # Installation & health check scripts
└── docs/                 # Comprehensive documentation
    ├── INSTALLATION.md
    ├── CONFIGURATION.md
    ├── docs/
    │   └── guides/
    │       ├── deployment.md       # Consolidated deployment guide
    │       └── security.md         # Consolidated security guide
    ├── SUPABASE_SETUP.md
    └── TROUBLESHOOTING.md
```

## 📊 Tech Stack

- **Frontend**: Next.js 15, TypeScript, Tailwind CSS v4, Recharts
- **Backend**: Python 3.8+, AsyncPG, Pydantic, aiofiles
- **Database**: Supabase (PostgreSQL) with real-time subscriptions
- **Deployment**: Docker, Vercel, Railway, self-hosted options
- **Testing**: Jest (frontend), pytest (backend)
- **Security**: Data sanitization, PII filtering, environment isolation

## 🔧 Development

```bash
# Run tests with coverage
npm run test:coverage                # All components
npm run test:coverage:dashboard      # Dashboard only  
npm run test:coverage:hooks          # Hooks only

# Coverage validation
npm run coverage:check               # Validate thresholds
npm run coverage:report              # Generate HTML reports
npm run coverage:badges              # Update badges

# Start development servers
cd apps/dashboard && npm run dev     # http://localhost:3000
cd apps/hooks && python install.py --validate-only

# Health check
./scripts/health-check.sh
```

## 🚢 Production Deployment

**Option 1: Automated Script**
```bash
./scripts/install.sh --production
```

**Option 2: Docker**
```bash
docker-compose up -d
```

**Option 3: Cloud Platforms**
- **Vercel**: Dashboard deployment
- **Railway/Render**: Full-stack deployment
- **Self-hosted**: Complete deployment guide

See [docs/guides/deployment.md](./docs/guides/deployment.md) for detailed instructions.

## 🔒 Security Features

- **Data Sanitization**: Automatic removal of sensitive information
- **PII Filtering**: Configurable privacy protection
- **Secure Configuration**: Environment-based secrets management
- **Row Level Security**: Optional Supabase RLS configuration
- **Audit Logging**: Comprehensive security event tracking

See [docs/guides/security.md](./docs/guides/security.md) for security best practices.

## 📈 Monitoring & Observability

The Chronicle dashboard provides:
- **Real-time Event Stream**: Live agent activity visualization
- **Tool Usage Analytics**: Performance metrics and patterns
- **Session Management**: Multi-session tracking and comparison
- **Error Monitoring**: Comprehensive error tracking and alerting
- **Performance Insights**: Execution time analysis

## 🆘 Getting Help

1. **Quick Issues**: Check [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)
2. **Installation Problems**: Review [INSTALLATION.md](./INSTALLATION.md)
3. **Configuration Issues**: See [CONFIGURATION.md](./CONFIGURATION.md)
4. **Health Check**: Run `./scripts/health-check.sh`
5. **Security Questions**: Consult [docs/guides/security.md](./docs/guides/security.md)

## 📄 License

[License information here]

## 🙏 Credits

Inspired by IndieDevDan's observability concepts and built for the Claude Code community.

---

**Chronicle provides comprehensive observability for Claude Code with production-ready deployment in under 30 minutes.**