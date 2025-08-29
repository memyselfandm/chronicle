# Chronicle Backup & Restore Guide

## Overview

Chronicle supports two database backends with different backup strategies:

- **SQLite** (default): File-based backups, simple and reliable
- **Supabase/PostgreSQL**: Cloud-based with built-in backup features

This guide covers backup procedures, restoration processes, and data migration strategies for both backends.

## SQLite Backup Procedures

Chronicle uses SQLite as the default database, stored as a single file that can be easily backed up.

### Default Database Location

```bash
# Standard installation location
~/.claude/hooks/chronicle/data/chronicle.db

# Project development location  
/path/to/chronicle/apps/hooks/data/chronicle.db
/path/to/chronicle/apps/server/data/chronicle.db
```

### Basic File Backup

#### Simple File Copy (Server Stopped)

```bash
# Stop Chronicle server first
pkill -f "main.py"

# Create backup with timestamp
cp ~/.claude/hooks/chronicle/data/chronicle.db \
   ~/.claude/hooks/chronicle/data/chronicle.db.backup.$(date +%Y%m%d_%H%M%S)

# Or compress the backup
gzip -c ~/.claude/hooks/chronicle/data/chronicle.db > \
   ~/chronicle-backup-$(date +%Y%m%d_%H%M%S).db.gz
```

#### SQLite Online Backup (Server Running)

```bash
# Using SQLite's backup command (safer for running database)
sqlite3 ~/.claude/hooks/chronicle/data/chronicle.db \
  ".backup ~/chronicle-backup-$(date +%Y%m%d_%H%M%S).db"

# Verify backup integrity
sqlite3 ~/chronicle-backup-*.db "PRAGMA integrity_check;"
```

### Automated Backup Scripts

#### Daily Backup Script

```bash
#!/bin/bash
# chronicle-backup.sh

DB_PATH="$HOME/.claude/hooks/chronicle/data/chronicle.db"
BACKUP_DIR="$HOME/chronicle-backups"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/chronicle-$DATE.db"

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Perform online backup
if [ -f "$DB_PATH" ]; then
    sqlite3 "$DB_PATH" ".backup $BACKUP_FILE"
    
    # Compress backup
    gzip "$BACKUP_FILE"
    
    # Verify backup
    if sqlite3 "$BACKUP_FILE.gz" "PRAGMA integrity_check;" | grep -q "ok"; then
        echo "$(date): Backup successful - $BACKUP_FILE.gz"
    else
        echo "$(date): Backup verification failed - $BACKUP_FILE.gz"
        exit 1
    fi
    
    # Keep only last 30 days of backups
    find "$BACKUP_DIR" -name "chronicle-*.db.gz" -mtime +30 -delete
    
else
    echo "$(date): Database file not found - $DB_PATH"
    exit 1
fi
```

#### Cron Job Setup

```bash
# Add to crontab (daily at 2 AM)
crontab -e

# Add line:
0 2 * * * /path/to/chronicle-backup.sh >> /var/log/chronicle-backup.log 2>&1
```

### Incremental Backups

For large databases, consider incremental backups:

```bash
#!/bin/bash
# chronicle-incremental-backup.sh

DB_PATH="$HOME/.claude/hooks/chronicle/data/chronicle.db"
BACKUP_DIR="$HOME/chronicle-backups"
BASE_BACKUP="$BACKUP_DIR/chronicle-base.db"
DATE=$(date +%Y%m%d_%H%M%S)

# Create base backup if it doesn't exist
if [ ! -f "$BASE_BACKUP" ]; then
    sqlite3 "$DB_PATH" ".backup $BASE_BACKUP"
    echo "$(date): Created base backup"
fi

# Create incremental backup using WAL mode
sqlite3 "$DB_PATH" << EOF
PRAGMA journal_mode=WAL;
.backup $BACKUP_DIR/chronicle-incremental-$DATE.db
EOF
```

## SQLite Restore Procedures

### Basic Restore

```bash
# Stop Chronicle server
pkill -f "main.py"

# Backup current database (precaution)
cp ~/.claude/hooks/chronicle/data/chronicle.db \
   ~/.claude/hooks/chronicle/data/chronicle.db.pre-restore

# Restore from backup
cp ~/chronicle-backup-20241203_143000.db \
   ~/.claude/hooks/chronicle/data/chronicle.db

# Verify restored database
sqlite3 ~/.claude/hooks/chronicle/data/chronicle.db "PRAGMA integrity_check;"

# Restart Chronicle server
python /path/to/chronicle/apps/server/main.py
```

### Selective Data Restore

```bash
# Export specific tables from backup
sqlite3 ~/chronicle-backup-20241203_143000.db << EOF
.headers on
.mode csv
.output sessions_export.csv
SELECT * FROM sessions WHERE created_at > '2024-12-01';
.output events_export.csv  
SELECT * FROM events WHERE timestamp > '2024-12-01';
.quit
EOF

# Import into current database
sqlite3 ~/.claude/hooks/chronicle/data/chronicle.db << EOF
.mode csv
.import sessions_export.csv sessions_temp
.import events_export.csv events_temp
-- Merge data as needed
EOF
```

## Supabase Backup Procedures

For Chronicle installations using Supabase as the backend database.

### Automatic Supabase Backups

Supabase provides automatic daily backups for all projects:

- **Free tier**: 7 days of backups
- **Pro tier**: 30 days of backups
- **Enterprise**: Custom retention policies

Access backups via:
1. Supabase Dashboard → Settings → Database → Backups
2. Download backups as SQL dumps
3. Restore to new or existing projects

### Manual Database Export

#### Using Supabase Dashboard

1. Navigate to Settings → Database → Backups
2. Click "Export" on desired backup
3. Download SQL dump file

#### Using pg_dump (CLI)

```bash
# Get connection details from Supabase Dashboard
pg_dump "postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres" \
  --schema=public \
  --data-only \
  --table=sessions \
  --table=events \
  --table=session_summaries \
  > chronicle-supabase-backup-$(date +%Y%m%d).sql

# Full database export
pg_dump "postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres" \
  --schema=public \
  > chronicle-supabase-full-$(date +%Y%m%d).sql
```

### Supabase Backup Script

```bash
#!/bin/bash
# chronicle-supabase-backup.sh

# Load Supabase connection details
source .env

BACKUP_DIR="$HOME/chronicle-supabase-backups"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/chronicle-supabase-$DATE.sql"

mkdir -p "$BACKUP_DIR"

# Export Chronicle tables
pg_dump "$SUPABASE_DATABASE_URL" \
  --schema=public \
  --data-only \
  --table=sessions \
  --table=events \
  --table=session_summaries \
  > "$BACKUP_FILE"

# Compress backup
gzip "$BACKUP_FILE"

# Keep last 14 days
find "$BACKUP_DIR" -name "chronicle-supabase-*.sql.gz" -mtime +14 -delete

echo "$(date): Supabase backup completed - $BACKUP_FILE.gz"
```

## Cross-Platform Migration

### SQLite to Supabase Migration

```bash
#!/bin/bash
# sqlite-to-supabase-migration.sh

SQLITE_DB="$HOME/.claude/hooks/chronicle/data/chronicle.db"
MIGRATION_DIR="./migration-temp"

mkdir -p "$MIGRATION_DIR"

# Export SQLite data
sqlite3 "$SQLITE_DB" << EOF
.headers on
.mode csv
.output $MIGRATION_DIR/sessions.csv
SELECT * FROM sessions;
.output $MIGRATION_DIR/events.csv  
SELECT * FROM events;
.output $MIGRATION_DIR/session_summaries.csv
SELECT * FROM session_summaries;
.quit
EOF

# Convert to PostgreSQL format and import
# Use the migration scripts provided in Chronicle
python apps/hooks/scripts/migrate_sqlite_to_supabase.py \
  --sqlite-db "$SQLITE_DB" \
  --supabase-url "$SUPABASE_URL" \
  --supabase-key "$SUPABASE_ANON_KEY"
```

### Supabase to SQLite Migration

```bash
#!/bin/bash
# supabase-to-sqlite-migration.sh

source .env
SQLITE_DB="./chronicle-migrated.db"

# Export from Supabase
pg_dump "$SUPABASE_DATABASE_URL" \
  --schema=public \
  --data-only \
  --table=sessions \
  --table=events \
  --table=session_summaries \
  > supabase-export.sql

# Convert to SQLite using provided migration script
python apps/hooks/scripts/migrate_supabase_to_sqlite.py \
  --sql-dump supabase-export.sql \
  --sqlite-output "$SQLITE_DB"
```

## Data Validation and Integrity

### Post-Restore Validation

```bash
#!/bin/bash
# validate-restore.sh

DB_PATH="$1"

# Check database integrity
echo "Checking database integrity..."
integrity_result=$(sqlite3 "$DB_PATH" "PRAGMA integrity_check;")
if [ "$integrity_result" != "ok" ]; then
    echo "❌ Database integrity check failed: $integrity_result"
    exit 1
fi

# Verify table structure
echo "Verifying table structure..."
tables=$(sqlite3 "$DB_PATH" ".tables")
required_tables="sessions events session_summaries"

for table in $required_tables; do
    if echo "$tables" | grep -q "$table"; then
        echo "✅ Table '$table' exists"
    else
        echo "❌ Table '$table' missing"
        exit 1
    fi
done

# Check record counts
echo "Checking record counts..."
session_count=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM sessions;")
event_count=$(sqlite3 "$DB_PATH" "SELECT COUNT(*) FROM events;")

echo "Sessions: $session_count"
echo "Events: $event_count"

echo "✅ Database validation completed successfully"
```

### Data Consistency Checks

```sql
-- Check for orphaned events (events without corresponding sessions)
SELECT COUNT(*) as orphaned_events
FROM events e
LEFT JOIN sessions s ON e.session_id = s.session_id
WHERE s.session_id IS NULL;

-- Check for sessions without events
SELECT COUNT(*) as empty_sessions  
FROM sessions s
LEFT JOIN events e ON s.session_id = e.session_id
WHERE e.session_id IS NULL;

-- Verify timestamp consistency
SELECT session_id, 
       MIN(timestamp) as first_event,
       MAX(timestamp) as last_event,
       created_at,
       ended_at
FROM events
GROUP BY session_id
HAVING first_event < created_at OR last_event > COALESCE(ended_at, datetime('now'));
```

## Disaster Recovery

### Emergency Restore Procedure

1. **Assess the situation**:
   ```bash
   # Check database file
   ls -la ~/.claude/hooks/chronicle/data/chronicle.db
   
   # Check database integrity
   sqlite3 ~/.claude/hooks/chronicle/data/chronicle.db "PRAGMA integrity_check;"
   ```

2. **Locate most recent backup**:
   ```bash
   ls -lt ~/chronicle-backups/chronicle-*.db.gz | head -5
   ```

3. **Stop all Chronicle services**:
   ```bash
   pkill -f "main.py"
   pkill -f "chronicle"
   ```

4. **Restore from backup**:
   ```bash
   # Backup corrupted database
   mv ~/.claude/hooks/chronicle/data/chronicle.db \
      ~/.claude/hooks/chronicle/data/chronicle.db.corrupted
   
   # Restore from backup
   gunzip -c ~/chronicle-backups/chronicle-20241203_143000.db.gz > \
      ~/.claude/hooks/chronicle/data/chronicle.db
   ```

5. **Validate restore**:
   ```bash
   ./validate-restore.sh ~/.claude/hooks/chronicle/data/chronicle.db
   ```

6. **Restart services**:
   ```bash
   python /path/to/chronicle/apps/server/main.py
   ```

## Best Practices

### Backup Strategy

1. **Multiple backup locations**: Local, network, cloud
2. **Regular testing**: Restore backups periodically to verify integrity
3. **Incremental backups**: For large datasets to reduce backup time
4. **Automated monitoring**: Alert on backup failures
5. **Documentation**: Keep restore procedures updated

### Security Considerations

```bash
# Secure backup files
chmod 600 chronicle-backup-*.db*
chown root:root chronicle-backup-*.db*

# Encrypt backups for external storage
gpg --symmetric --cipher-algo AES256 chronicle-backup-20241203.db
```

### Performance Considerations

- Backup during low-activity periods
- Use WAL mode for SQLite to reduce backup impact
- Consider backup compression for storage efficiency
- Monitor backup duration and alert on anomalies

## Monitoring and Alerting

### Backup Monitoring Script

```bash
#!/bin/bash
# monitor-backups.sh

BACKUP_DIR="$HOME/chronicle-backups"
MAX_AGE_HOURS=25  # Should have backup within 25 hours

latest_backup=$(ls -t "$BACKUP_DIR"/chronicle-*.db.gz 2>/dev/null | head -1)

if [ -z "$latest_backup" ]; then
    echo "❌ No backups found in $BACKUP_DIR"
    exit 1
fi

# Check backup age
backup_age=$(( $(date +%s) - $(stat -c %Y "$latest_backup") ))
backup_age_hours=$(( backup_age / 3600 ))

if [ $backup_age_hours -gt $MAX_AGE_HOURS ]; then
    echo "❌ Latest backup is $backup_age_hours hours old (max: $MAX_AGE_HOURS)"
    exit 1
else
    echo "✅ Latest backup is $backup_age_hours hours old"
fi
```

## Recovery Testing

Regularly test your backup and recovery procedures:

```bash
#!/bin/bash
# test-recovery.sh

echo "🧪 Testing Chronicle backup recovery..."

# Create test environment
TEST_DIR="/tmp/chronicle-recovery-test"
mkdir -p "$TEST_DIR"

# Find latest backup
latest_backup=$(ls -t ~/chronicle-backups/chronicle-*.db.gz | head -1)

# Restore to test location
gunzip -c "$latest_backup" > "$TEST_DIR/test-chronicle.db"

# Validate restored database
if ./validate-restore.sh "$TEST_DIR/test-chronicle.db"; then
    echo "✅ Recovery test successful"
    rm -rf "$TEST_DIR"
else
    echo "❌ Recovery test failed"
    exit 1
fi
```

Run recovery tests monthly or after any significant changes to the backup system.

## Support and Troubleshooting

For backup and restore issues:

1. Check [troubleshooting.md](troubleshooting.md) for common problems
2. Verify database file permissions and ownership
3. Ensure sufficient disk space for backups
4. Check backup script logs for errors
5. Test backup integrity before relying on them

Remember: A backup is only as good as your last successful restore test.