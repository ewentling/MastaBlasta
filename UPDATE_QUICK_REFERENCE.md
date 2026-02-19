# MastaBlasta Update Script - Quick Reference

## One-Command Update

```bash
./update.sh
```

That's it! This single command will:
- ✅ Create backups automatically
- ✅ Pull latest code from git
- ✅ Update all dependencies
- ✅ Run database migrations
- ✅ Build frontend
- ✅ Restart application
- ✅ Verify it's running and healthy

**Expected duration:** 5-10 minutes  
**Downtime:** ~1-2 minutes during restart

---

## Common Usage

### Standard Production Update
```bash
cd /path/to/MastaBlasta
./update.sh
```

### Preview Changes First
```bash
./update.sh --dry-run
```

### Quick Development Update (No Backup)
```bash
./update.sh --skip-backup
```

### Show Help
```bash
./update.sh --help
```

---

## What It Does (8 Phases)

| Phase | Action | Duration |
|-------|--------|----------|
| 1️⃣ Pre-checks | Verify system requirements | 10s |
| 2️⃣ Backup | Create safety backups | 1-2min |
| 3️⃣ Code | Pull latest from git | 30s |
| 4️⃣ Dependencies | Update Python & npm packages | 2-3min |
| 5️⃣ Migrations | Update database schema | 10s |
| 6️⃣ Frontend | Build React app | 1min |
| 7️⃣ Restart | **Restart application** | 1min |
| 8️⃣ Validation | **Confirm it's running** | 30s |

---

## Service Restart (Phase 7)

The script automatically detects your deployment type and restarts appropriately:

### Docker Compose
```bash
docker-compose down
docker-compose build
docker-compose up -d
✅ Verified container is running
```

### Docker
```bash
docker stop mastablasta-api
docker build -t mastablasta:latest .
docker run -d --restart unless-stopped ...
✅ Verified container is running
```

### systemd
```bash
systemctl restart mastablasta
✅ Verified service is active
```

### supervisor
```bash
supervisorctl restart mastablasta
✅ Verified service is running
```

### Manual
```bash
pkill -f "python.*app.py"
nohup python3 app.py &
✅ Verified process is running (PID saved)
```

---

## Health Confirmation (Phase 8)

After restart, the script confirms the application is healthy:

### 1. Process Check ✓
- Docker: Verifies container is up
- systemd: Checks service is active  
- Manual: Verifies PID is running

### 2. Database Test ✓
```python
python3 -c "from database import test_connection; test_connection()"
```

### 3. API Health Check ✓
- Tests: http://localhost:33766/api/health
- **6 retries** over 30 seconds
- Ensures app is serving requests

### 4. Endpoint Tests ✓
- Root: http://localhost:33766/
- Auth: http://localhost:33766/api/users/me
- Validates proper HTTP responses

### 5. Frontend Check ✓
- Verifies dist/ directory exists
- Checks index.html is present
- Tests HTTP accessibility

### 6. Log Scan ✓
- Searches for recent errors
- Shows error count
- Displays problematic lines

### 7. Final Verdict ✓
```
✅ ALL VALIDATIONS PASSED

╔══════════════════════════════════════════════════════════╗
║  🎉 APPLICATION IS RUNNING AND HEALTHY 🎉              ║
╚══════════════════════════════════════════════════════════╝

Application details:
  URL: http://localhost:33766
  Health: http://localhost:33766/api/health
  Deployment: docker-compose
  Container: abc123def456
```

---

## Success Indicators

### ✅ Successful Update
```bash
[SUCCESS] All pre-update checks passed!
[SUCCESS] Backup completed: backups/20260219_143022
[SUCCESS] Code updated to: abc1234 Fix bug
[SUCCESS] Python dependencies updated
[SUCCESS] Database migrations completed
[SUCCESS] Frontend built successfully (1.2MB)
[SUCCESS] Docker container started successfully
[SUCCESS] API health check: OK ✓
✅ ALL VALIDATIONS PASSED
🎉 APPLICATION IS RUNNING AND HEALTHY 🎉
```

**Exit code:** 0  
**Safe to use in automation**

### ❌ Failed Update
```bash
[ERROR] Container is not running!
[ERROR] API health check: FAILED ✗
[ERROR] Could not connect after 6 attempts
❌ VALIDATION FAILED
Please check the logs
```

**Exit code:** 1  
**Script stops, no partial updates**

---

## Troubleshooting

### Application Not Running After Update

**Check logs:**
```bash
# Docker
docker logs mastablasta-api

# systemd
journalctl -u mastablasta -n 100

# Manual
tail -100 app.log
```

**Check if port is in use:**
```bash
sudo lsof -i :33766
```

**Verify database connection:**
```bash
cat .env | grep DATABASE_URL
psql -d mastablasta -c "SELECT 1;"
```

### Rollback if Needed

```bash
# Find backup
ls -lt backups/

# Restore (see backup manifest)
cat backups/20260219_143022/MANIFEST.txt
```

---

## File Locations

### Generated Files
```
backups/                    # Automatic backups
├── 20260219_143022/       # Timestamped backup
│   ├── .env.backup        # Configuration
│   ├── database_backup.sql # Database dump
│   ├── media_backup.tar.gz # Media files
│   └── MANIFEST.txt       # Restore instructions
update_20260219_143022.log # Update log
mastablasta.pid            # Process ID (manual mode)
```

### Important Files (Preserved)
```
.env                       # ✅ Never overwritten
media/                     # ✅ Never deleted
database (PostgreSQL)      # ✅ Only schema updated
```

---

## Best Practices

### Before Update
```bash
# 1. Test in dry-run mode
./update.sh --dry-run

# 2. Check git status
git status
git log -5

# 3. Verify backups directory has space
df -h
```

### After Update
```bash
# 1. Verify health
curl http://localhost:33766/api/health

# 2. Test login
curl -X POST http://localhost:33766/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@mastablasta.com","password":"your-password"}'

# 3. Check recent logs
docker logs mastablasta-api --tail=50
```

### Maintenance
```bash
# Keep only last 7 backups
find backups/ -maxdepth 1 -type d -mtime +7 -exec rm -rf {} \;

# Clean old logs
find . -name "update_*.log" -mtime +30 -delete
```

---

## Integration with CI/CD

### GitHub Actions Example
```yaml
- name: Deploy update
  run: |
    cd /path/to/MastaBlasta
    ./update.sh
  # Script returns exit code 1 on failure
  # This will fail the CI/CD pipeline
```

### Cron Job Example
```bash
# Daily update at 3 AM
0 3 * * * cd /home/user/MastaBlasta && ./update.sh >> /var/log/mastablasta-update.log 2>&1
```

### Monitoring Example
```bash
#!/bin/bash
cd /path/to/MastaBlasta
./update.sh

if [ $? -eq 0 ]; then
    echo "Update successful" | mail -s "MastaBlasta Updated" admin@example.com
else
    echo "Update failed! Check logs" | mail -s "MastaBlasta Update FAILED" admin@example.com
    exit 1
fi
```

---

## Quick Checklist

**Pre-update:**
- [ ] Server has 2GB+ free disk space
- [ ] Database is accessible
- [ ] `.env` file is configured
- [ ] Tested with `--dry-run`

**Post-update:**
- [ ] Script shows "ALL VALIDATIONS PASSED"
- [ ] Can access http://localhost:33766
- [ ] Can login to application
- [ ] No errors in logs

---

## Summary

**To update MastaBlasta:**
```bash
./update.sh
```

**The script will:**
1. ✅ Backup everything
2. ✅ Update code and dependencies
3. ✅ Migrate database safely
4. ✅ Build frontend
5. ✅ **Restart application properly**
6. ✅ **Confirm it's running and healthy**
7. ✅ Show clear success/failure status

**Result:** Zero-effort production deployments with full safety! 🚀

For detailed documentation, see: [UPDATE_GUIDE.md](UPDATE_GUIDE.md)
