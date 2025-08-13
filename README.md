# Chronicle - Observability for Claude Code

> **Real-time observability system for Claude Code agent activities with comprehensive event tracking and visualization**

## 🚀 Quick Start (< 30 minutes)

**Automated Installation**:
```bash
git clone <repository-url>
cd chronicle
./scripts/quick-start.sh
```

**Manual Installation**:
```bash
# 1. Dashboard
cd apps/dashboard && npm install && cp .env.example .env.local
# Configure .env.local with Supabase credentials
npm run dev  # Starts on http://localhost:3000

# 2. Hooks System  
cd apps/hooks && pip install -r requirements.txt && cp .env.template .env
# Configure .env with Supabase credentials
python install.py  # Installs Claude Code hooks
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

### Deployment & Production
- **[DEPLOYMENT.md](./DEPLOYMENT.md)** - Production deployment guide
- **[SECURITY.md](./SECURITY.md)** - Security best practices

### Troubleshooting & Support
- **[TROUBLESHOOTING.md](./TROUBLESHOOTING.md)** - Common issues & solutions

## ✅ MVP Complete: Production Ready

### Core Components
- **Dashboard**: Next.js 15 with real-time Chronicle UI (`apps/dashboard/`)
- **Hooks System**: Python-based event capture (`apps/hooks/`)
- **Database**: Supabase PostgreSQL with SQLite fallback
- **Documentation**: Comprehensive guides for deployment

### Features Built
- **Real-time Event Streaming**: Live dashboard updates via Supabase
- **Complete Hook Coverage**: All Claude Code hooks implemented
- **Data Security**: Sanitization, PII filtering, secure configuration
- **Production Deployment**: Full deployment automation and monitoring
- **Comprehensive Testing**: 42+ tests across all components

## 🛠 System Requirements

- **Node.js**: 18.0.0+ (20.0.0+ recommended)
- **Python**: 3.8.0+ (3.11+ recommended)
- **Claude Code**: Latest version
- **Supabase**: Free tier sufficient for MVP

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
    ├── DEPLOYMENT.md
    ├── SECURITY.md
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
# Run tests
cd apps/dashboard && npm test
cd apps/hooks && python -m pytest

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

See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed instructions.

## 🔒 Security Features

- **Data Sanitization**: Automatic removal of sensitive information
- **PII Filtering**: Configurable privacy protection
- **Secure Configuration**: Environment-based secrets management
- **Row Level Security**: Optional Supabase RLS configuration
- **Audit Logging**: Comprehensive security event tracking

See [SECURITY.md](./SECURITY.md) for security best practices.

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
5. **Security Questions**: Consult [SECURITY.md](./SECURITY.md)

## 📄 License

[License information here]

## 🙏 Credits

Inspired by IndieDevDan's observability concepts and built for the Claude Code community.

---

**Chronicle provides comprehensive observability for Claude Code with production-ready deployment in under 30 minutes.**