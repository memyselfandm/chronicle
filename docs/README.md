# Chronicle Documentation Structure

Welcome to the Chronicle documentation source files. This directory contains all the documentation for Chronicle, organized for use with MkDocs to generate a beautiful, searchable documentation website.

## Documentation Site Structure

The Chronicle documentation is organized into logical sections that guide users from installation through advanced usage and development:

### 📁 Directory Structure

```
docs/
├── index.md                    # Main landing page
├── mkdocs.yml                  # MkDocs configuration (in project root)
├── stylesheets/
│   └── extra.css              # Custom Chronicle styling
├── javascripts/
│   └── mathjax.js             # MathJax configuration
│
├── getting-started/           # New user guides
│   ├── installation.md       # Complete installation instructions
│   ├── quick-start.md        # 5-minute setup guide
│   └── first-session.md      # Dashboard tour and first use
│
├── user-guide/               # Daily usage documentation
│   ├── dashboard-overview.md # Interface and features guide
│   ├── session-management.md # Working with coding sessions
│   ├── filtering-events.md   # Finding specific activities
│   └── configuration.md      # Customizing Chronicle behavior
│
├── tutorials/                # Step-by-step guides
│   ├── local-setup.md        # Detailed local installation
│   ├── team-deployment.md    # Multi-user setups
│   ├── advanced-configuration.md # Power user features
│   └── migration-from-supabase.md # Database migration options
│
├── admin-guide/              # System administration
│   ├── server-management.md  # Running and monitoring Chronicle
│   ├── performance-tuning.md # Optimization strategies
│   ├── backup-restore.md     # Data protection procedures
│   └── troubleshooting.md    # Common issues and solutions
│
├── developer-guide/          # Technical implementation
│   ├── architecture.md       # System design and components
│   ├── api-reference.md      # REST API documentation
│   ├── plugin-development.md # Creating custom hooks
│   └── contributing.md       # Development workflow
│
├── reference/                # Complete technical docs
│   ├── configuration.md      # All configuration options
│   ├── api.md               # Endpoint details and examples
│   ├── database.md          # SQLite table structures
│   ├── hooks.md             # Event capture architecture
│   ├── environment-variables.md # Configuration settings
│   ├── ci-cd.md             # Continuous integration
│   └── installation-structure.md # File organization
│
├── guides/                   # Additional guides
│   ├── deployment.md        # Production deployment
│   ├── security.md          # Security best practices
│   ├── performance.md       # Performance optimization
│   ├── troubleshooting.md   # Issue resolution
│   └── coverage.md          # Test coverage information
│
└── setup/                    # Setup-specific guides
    ├── installation.md       # Installation procedures
    ├── environment.md        # Environment configuration
    ├── quick-start.md        # Quick setup guide
    └── supabase.md          # Supabase backend setup
```

## Building the Documentation Site

### Prerequisites

Install MkDocs with the Material theme:

```bash
pip install mkdocs mkdocs-material pymdown-extensions mkdocs-minify-plugin
```

### Local Development

Build and serve the documentation locally:

```bash
# Serve with live reloading (recommended for development)
mkdocs serve

# Build static site (for production)
mkdocs build

# Deploy to GitHub Pages (if configured)
mkdocs gh-deploy
```

Access the local site at: http://127.0.0.1:8000

### Site Configuration

The documentation site is configured via `mkdocs.yml` (in project root) with:

- **Material Design theme** with dark/light mode toggle
- **Advanced search** with highlighting and suggestions
- **Code syntax highlighting** for all supported languages
- **Navigation tabs and sections** for easy browsing
- **Responsive design** for desktop and mobile
- **Custom Chronicle branding** and color scheme

## Content Guidelines

### Writing Style

- **Clear and concise**: Use simple language and short sentences
- **User-focused**: Write from the user's perspective
- **Action-oriented**: Use imperative mood for instructions
- **Consistent terminology**: Maintain consistent naming and concepts

### Documentation Standards

#### File Naming
- Use lowercase with hyphens: `server-management.md`
- Be descriptive but concise: `filtering-events.md`
- Group related content in subdirectories

#### Content Structure
```markdown
# Page Title (H1)

Brief introduction paragraph explaining the page purpose.

## Major Section (H2)

Content with subsections as needed.

### Subsection (H3)

Detailed content.

#### Sub-subsection (H4)

Use sparingly for complex topics.
```

#### Code Examples
- Always specify language for syntax highlighting: `bash`, `python`, `json`
- Include complete, runnable examples when possible
- Add comments to explain complex code
- Test all code examples for correctness

#### Cross-References
- Use relative links within docs: `[Installation](../getting-started/installation.md)`
- Always verify links are working
- Update navigation in `mkdocs.yml` when adding new pages

### Content Types

#### Installation Guides
- Step-by-step numbered instructions
- Prerequisites clearly listed
- Verification steps included
- Troubleshooting section

#### API Documentation
- Complete endpoint listings
- Request/response examples
- Error handling documentation
- SDK/client library examples

#### Tutorials
- Hands-on, practical guides
- Clear learning objectives
- Progressive difficulty
- Working examples throughout

#### Reference Documentation
- Comprehensive parameter lists
- Technical specifications
- Configuration options
- Schema definitions

## Site Features

### Navigation
- **Tabbed navigation** for major sections
- **Expandable sidebar** with hierarchical organization
- **Breadcrumb navigation** showing current location
- **Table of contents** for long pages
- **Search functionality** across all content

### Visual Features
- **Syntax highlighting** for code blocks
- **Copy buttons** for code examples
- **Responsive grid layouts** for feature cards
- **Material Design icons** for visual cues
- **Dark/light mode** toggle for user preference

### Interactive Elements
- **Collapsible sections** for detailed information
- **Tabbed content** for alternative instructions
- **Admonitions** for notes, warnings, and tips
- **Progress indicators** for multi-step processes

## Maintenance

### Regular Tasks
- **Review links**: Verify all internal and external links work
- **Update examples**: Ensure code examples match current version
- **Check screenshots**: Update interface screenshots when UI changes
- **Validate structure**: Ensure navigation matches directory structure

### Content Updates
- Update version numbers in installation guides
- Refresh API documentation when endpoints change
- Add new features to appropriate documentation sections
- Archive outdated content appropriately

### Site Optimization
- Monitor site build performance
- Optimize images and assets
- Review search indexing effectiveness
- Test mobile responsiveness

## Contributing to Documentation

### Documentation Workflow
1. Create or edit markdown files in appropriate directories
2. Test locally with `mkdocs serve`
3. Verify all links and code examples work
4. Update navigation in `mkdocs.yml` if adding new pages
5. Submit documentation changes with code changes

### Quality Checklist
- [ ] Content follows writing style guidelines
- [ ] All code examples are tested and working
- [ ] Cross-references are accurate and working
- [ ] Navigation is updated appropriately
- [ ] Mobile responsiveness is maintained
- [ ] Search functionality includes new content

## Deployment

The documentation site can be deployed to:

- **GitHub Pages**: Using `mkdocs gh-deploy`
- **Netlify**: By connecting to the repository
- **Vercel**: With automatic deployment on commits
- **Self-hosted**: Using the output from `mkdocs build`

See the [deployment guide](guides/deployment.md) for detailed instructions.

---

This documentation structure provides comprehensive coverage of Chronicle while maintaining excellent user experience and professional presentation. The MkDocs configuration ensures the site is modern, searchable, and accessible across all devices.