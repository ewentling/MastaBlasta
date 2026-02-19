# MastaBlasta Update Guide

This guide explains how to safely update a running MastaBlasta installation while preserving all existing data.

## Table of Contents

1. [Quick Start](#quick-start)
2. [What Gets Updated](#what-gets-updated)
3. [What Gets Preserved](#what-gets-preserved)
4. [Update Script Usage](#update-script-usage)
5. [Update Process Details](#update-process-details)
6. [Troubleshooting](#troubleshooting)
7. [Rollback Procedures](#rollback-procedures)
8. [Manual Update Steps](#manual-update-steps)

---

## Quick Start

The easiest way to update your MastaBlasta installation:

```bash
# Navigate to your MastaBlasta directory
cd /path/to/MastaBlasta

# Run the update script
./update.sh
```

That's it! The script will:
- ✅ Create automatic backups
- ✅ Pull latest code
- ✅ Update dependencies
- ✅ Run database migrations
- ✅ Build frontend
- ✅ Restart services
- ✅ Verify everything works

---

## What Gets Updated

The update script will update:

### Code & Configuration
- ✅ Application source code (Python backend)
- ✅ Frontend code (React/TypeScript)
- ✅ Python dependencies (requirements.txt)
- ✅ Frontend dependencies (package.json)
- ✅ Database schema (via migrations)

### NOT Updated (Preserved)
- ❌ `.env` file (your configuration)
- ❌ Database data (users, posts, etc.)
- ❌ Media files (uploads)
- ❌ OAuth credentials
- ❌ Custom settings

---

## What Gets Preserved

**Everything important is preserved:**

### 1. Database Content
All your data remains intact:
- User accounts and profiles
- Posts and schedules
- Media metadata
- Analytics data
- OAuth connections
- Templates and settings

### 2. Uploaded Files
All user-uploaded content:
- Images
- Videos
- Documents
- Thumbnails

### 3. Configuration
Your environment configuration:
- `.env` file
- OAuth credentials
- API keys
- Database connection details

---

## Update Script Usage

### Basic Usage

```bash
# Standard update (recommended)
./update.sh

# Preview what will happen (no changes made)
./update.sh --dry-run

# Skip backup (NOT recommended for production)
./update.sh --skip-backup

# Show help
./update.sh --help
```

### Command Line Options

| Option | Description | Use Case |
|--------|-------------|----------|
| *(none)* | Full update with all safety checks | Production updates |
| `--dry-run` | Preview changes without applying | Testing before real update |
| `--skip-backup` | Skip backup creation | Development environments |
| `--help` | Show help message | Learning about the script |

---

## Update Process Details

The update script performs 8 phases:

### Phase 1: Pre-Update Checks ✓

**What it does:**
- Verifies you're in the correct directory
- Checks disk space (needs 2GB minimum)
- Verifies Python, npm, and git are installed
- Tests database connectivity
- Validates system dependencies

**Output example:**
```
[INFO] Found MastaBlasta application files
[SUCCESS] Sufficient disk space: 15GB available
[SUCCESS] Python found: Python 3.11.5
[SUCCESS] npm found: version 10.2.3
[SUCCESS] Database connection successful
```

**If this fails:**
- Install missing dependencies
- Free up disk space
- Check database configuration in `.env`

---

### Phase 2: Backup Operations 💾

**What it does:**
- Creates timestamped backup directory
- Backs up `.env` file
- Dumps database to SQL file
- Archives media files
- Creates backup manifest

**Backup location:**
```
backups/
└── 20260219_143022/
    ├── .env.backup
    ├── database_backup.sql
    ├── media_backup.tar.gz
    └── MANIFEST.txt
```

**Backup sizes:**
- Config: < 1KB
- Database: Varies (typically 10MB - 1GB)
- Media: Varies (depends on uploads)

**Skip this phase:**
```bash
./update.sh --skip-backup  # NOT recommended for production
```

---

### Phase 3: Code Update 📥

**What it does:**
- Shows current git status
- Fetches latest changes from repository
- Shows what changed (commit log)
- Pulls latest code
- Reports new version

**Output example:**
```
[INFO] Current branch: main
[INFO] Current commit: abc1234 Fix OAuth bug
[INFO] Updates available: 5 commits
[INFO] Changes to be applied:
  def5678 Add admin panel analytics
  ghi9012 Improve video clipping
  ...
[SUCCESS] Code updated to: def5678 Add admin panel analytics
```

**What's preserved:**
- Your `.env` file is NOT overwritten
- Local modifications are stashed (if any)

---

### Phase 4: Dependency Updates 📦

**What it does:**
- Updates Python packages from `requirements.txt`
- Updates frontend npm packages
- Installs any new dependencies

**This includes:**
- Python: Flask, SQLAlchemy, Alembic, etc.
- Frontend: React, TypeScript, Vite, etc.
- System: ffmpeg (if missing)

**Duration:** 2-5 minutes (depends on internet speed)

---

### Phase 5: Database Migrations 🗃️

**What it does:**
- Runs `alembic upgrade head`
- Applies schema changes
- Preserves ALL existing data
- Shows before/after migration status

**Example migrations:**
- Adding new columns
- Creating new tables
- Adding indexes
- Updating constraints

**Output example:**
```
[INFO] Current migration status:
  60eff4a28a0c (head)
[INFO] Running database migrations...
INFO [alembic.runtime.migration] Running upgrade -> 70abc123def4, add_new_feature
[SUCCESS] Database migrations completed
```

**Safety features:**
- ✅ Only applies new migrations
- ✅ Never deletes existing data
- ✅ Can be rolled back if needed
- ✅ Idempotent (safe to run multiple times)

---

### Phase 6: Frontend Build 🏗️

**What it does:**
- Runs `npm run build` in `frontend/`
- Compiles TypeScript to JavaScript
- Optimizes assets
- Creates production bundle

**Output location:**
```
frontend/dist/
├── index.html
├── assets/
│   ├── index-abc123.js
│   ├── index-def456.css
│   └── ...
```

**Build time:** 30-60 seconds

**Bundle size:** ~1.2MB (343KB gzipped)

---

### Phase 7: Service Restart 🔄

**What it does:**
- Detects deployment type (Docker, docker-compose, or direct)
- Gracefully stops services
- Rebuilds containers (if Docker)
- Starts services
- Waits for startup (30 seconds)

**Deployment types:**

#### Docker Compose (Recommended)
```bash
docker-compose down
docker-compose build
docker-compose up -d
```

#### Docker (Manual)
```bash
docker stop mastablasta-api
docker rm mastablasta-api
docker build -t mastablasta:latest .
docker run -d --restart unless-stopped ...
```

#### Direct (systemd/supervisor)
```bash
systemctl restart mastablasta
# or
supervisorctl restart mastablasta
```

**Downtime:** ~30-60 seconds

---

### Phase 8: Post-Update Validation ✅

**What it does:**
- Tests database connection
- Checks API health endpoint
- Verifies frontend build
- Scans logs for errors
- Reports validation status

**Health checks:**
```
[SUCCESS] Database connection: OK
[SUCCESS] API health check: OK
[SUCCESS] Frontend build: OK
[SUCCESS] No errors found in logs
```

**If validation fails:**
- Check the log file for details
- Verify services are running
- See [Troubleshooting](#troubleshooting)

---

## Troubleshooting

### Update Failed - How to Diagnose

1. **Check the log file:**
   ```bash
   cat update_20260219_143022.log
   ```

2. **Look for error messages:**
   ```bash
   grep -i error update_*.log
   ```

3. **Check service status:**
   ```bash
   # Docker
   docker ps
   docker logs mastablasta-api
   
   # systemd
   systemctl status mastablasta
   journalctl -u mastablasta -n 50
   ```

### Common Issues

#### 1. Database Connection Failed

**Symptom:**
```
[ERROR] Could not verify database connection
```

**Solution:**
```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Test connection manually
psql -d mastablasta -c "SELECT 1;"

# Verify DATABASE_URL in .env
cat .env | grep DATABASE_URL
```

#### 2. Disk Space Full

**Symptom:**
```
[ERROR] Insufficient disk space: 0GB available
```

**Solution:**
```bash
# Check disk usage
df -h

# Clean up old backups
rm -rf backups/2026* # Keep only recent backups

# Clean Docker images
docker system prune -a

# Clean npm cache
npm cache clean --force
```

#### 3. Git Pull Failed

**Symptom:**
```
error: Your local changes to the following files would be overwritten by merge
```

**Solution:**
```bash
# Stash local changes
git stash

# Run update again
./update.sh

# Restore local changes if needed
git stash pop
```

#### 4. Frontend Build Failed

**Symptom:**
```
[ERROR] Frontend build failed - dist directory not found
```

**Solution:**
```bash
# Check Node version (need 18+)
node --version

# Clear node_modules and rebuild
cd frontend
rm -rf node_modules package-lock.json
npm install
npm run build
cd ..
```

#### 5. Migration Failed

**Symptom:**
```
alembic.util.exc.CommandError: Target database is not up to date
```

**Solution:**
```bash
# Check migration status
alembic current

# Show migration history
alembic history

# Force to latest (CAREFUL!)
alembic stamp head

# Try again
alembic upgrade head
```

#### 6. Service Won't Start

**Symptom:**
```
[WARNING] API health check: Could not connect
```

**Solution:**
```bash
# Check what's using port 33766
sudo lsof -i :33766

# Check logs
docker logs mastablasta-api
# or
journalctl -u mastablasta -n 100

# Try manual start
python3 app.py
```

---

## Rollback Procedures

If something goes wrong, you can rollback using the automatic backup.

### Quick Rollback

```bash
# Find latest backup
ls -lt backups/

# Use the rollback script
./rollback.sh backups/20260219_143022
```

### Manual Rollback

If you need to manually rollback:

#### 1. Restore Database

```bash
# Find your backup
BACKUP_DIR=backups/20260219_143022

# Restore database
pg_restore -d mastablasta -c $BACKUP_DIR/database_backup.sql
```

#### 2. Restore Media Files

```bash
# Remove current media
rm -rf media

# Restore from backup
tar -xzf $BACKUP_DIR/media_backup.tar.gz
```

#### 3. Restore Configuration

```bash
# Restore .env
cp $BACKUP_DIR/.env.backup .env
```

#### 4. Revert Code

```bash
# Find previous commit (from MANIFEST.txt)
cat $BACKUP_DIR/MANIFEST.txt

# Revert to previous commit
git reset --hard abc1234  # Replace with actual commit
```

#### 5. Restart Services

```bash
# Docker Compose
docker-compose restart

# Docker
docker restart mastablasta-api

# systemd
systemctl restart mastablasta
```

---

## Manual Update Steps

If you prefer to update manually or the script doesn't work for your setup:

### 1. Create Backup

```bash
# Create backup directory
mkdir -p backups/manual_$(date +%Y%m%d)

# Backup database
pg_dump mastablasta > backups/manual_$(date +%Y%m%d)/database.sql

# Backup media
tar -czf backups/manual_$(date +%Y%m%d)/media.tar.gz media/

# Backup config
cp .env backups/manual_$(date +%Y%m%d)/.env.backup
```

### 2. Update Code

```bash
# Check current status
git status

# Stash any local changes
git stash

# Pull latest code
git pull origin main
```

### 3. Update Dependencies

```bash
# Python dependencies
pip3 install --upgrade -r requirements.txt

# Frontend dependencies
cd frontend
npm install
cd ..
```

### 4. Run Migrations

```bash
# Apply database migrations
alembic upgrade head
```

### 5. Build Frontend

```bash
cd frontend
npm run build
cd ..
```

### 6. Restart Application

```bash
# Docker Compose
docker-compose restart

# Docker
docker restart mastablasta-api

# systemd
sudo systemctl restart mastablasta

# Manual
pkill -f "python.*app.py"
python3 app.py &
```

### 7. Verify

```bash
# Check health endpoint
curl http://localhost:33766/api/health

# Check logs
tail -f /var/log/mastablasta/app.log
```

---

## Best Practices

### Before Updating

1. ✅ **Read the changelog** - Know what's changing
2. ✅ **Test in development** - Try the update on a dev server first
3. ✅ **Schedule maintenance** - Pick a low-traffic time
4. ✅ **Notify users** - Let them know about the maintenance window
5. ✅ **Check disk space** - Ensure you have 2GB+ free

### During Update

1. ✅ **Use the update script** - It handles everything safely
2. ✅ **Monitor the process** - Watch for errors
3. ✅ **Keep the backup** - Don't delete until verified
4. ✅ **Run in screen/tmux** - Prevent disconnection issues

### After Update

1. ✅ **Verify functionality** - Test critical features
2. ✅ **Check logs** - Look for errors or warnings
3. ✅ **Monitor performance** - Watch for issues
4. ✅ **Keep backups** - Retain for at least 7 days
5. ✅ **Document issues** - Report any problems

---

## Update Schedule

### Recommended Update Frequency

| Update Type | Frequency | Priority |
|-------------|-----------|----------|
| Security patches | Immediate | Critical |
| Bug fixes | Within 1 week | High |
| New features | Monthly | Medium |
| Dependencies | Quarterly | Low |

### Maintenance Windows

**Recommended times for updates:**
- 🌙 Late night (2-4 AM local time)
- 📅 Weekends (Saturday/Sunday morning)
- 🎄 Off-peak seasons
- 🔇 Low-traffic periods

**Typical downtime:** 1-2 minutes

---

## Support

### Getting Help

1. **Check this guide** - Most questions are answered here
2. **Review logs** - Check `update_*.log` files
3. **GitHub Issues** - [Report bugs](https://github.com/ewentling/MastaBlasta/issues)
4. **Documentation** - See [PRODUCTION_SETUP.md](PRODUCTION_SETUP.md)

### Reporting Issues

When reporting update problems, include:
- Log file (`update_*.log`)
- Error messages
- System information (OS, Python version, etc.)
- Deployment type (Docker, systemd, etc.)
- Steps to reproduce

---

## FAQ

### Q: Will my data be deleted?
**A:** No. The update preserves all data. Database content, uploads, and configuration remain intact.

### Q: How long does an update take?
**A:** Typically 5-10 minutes including backup, update, and restart.

### Q: Can I update without downtime?
**A:** For zero-downtime updates, you need a load balancer with multiple instances. See [PRODUCTION_SETUP.md](PRODUCTION_SETUP.md).

### Q: What if the update fails?
**A:** Use the automatic backup to rollback. See [Rollback Procedures](#rollback-procedures).

### Q: Do I need to stop the application first?
**A:** No. The update script handles stopping and starting services.

### Q: Can I skip the backup?
**A:** You can (`--skip-backup`), but it's strongly not recommended for production.

### Q: How do I test the update first?
**A:** Use `--dry-run` to preview changes without applying them.

### Q: What if I have custom modifications?
**A:** Git will stash your changes during update. You may need to reapply them manually.

### Q: How do I update just the frontend?
**A:** Run: `cd frontend && npm run build`

### Q: How do I update just the database?
**A:** Run: `alembic upgrade head`

---

## Changelog

### Version 1.0.0 (2026-02-19)
- Initial release of update script
- Automatic backup and restore
- Support for Docker and direct deployments
- Comprehensive validation and health checks
- Detailed logging and error reporting

---

## Additional Resources

- [Production Setup Guide](PRODUCTION_SETUP.md)
- [Database Migration Guide](DATABASE_MIGRATION_FIX.md)
- [Security Best Practices](SECURITY_AUDIT.md)
- [Deployment Checklist](DEPLOYMENT_CHECKLIST.md)

---

**Happy updating! 🚀**

If you encounter any issues not covered in this guide, please [open an issue](https://github.com/ewentling/MastaBlasta/issues).
