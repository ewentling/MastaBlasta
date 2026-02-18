# Database Migration Guide: Fix Admin Login Issue

## Issue Description
After updating to the latest codebase, users may be unable to login with the default admin credentials (`admin@mastablasta.com` / `ChangeMe123!`) due to a missing database column.

## Root Cause
The `password_must_change` column was added to the `User` model but was not included in the initial database migration. This causes the default admin account creation to fail or behave incorrectly when the column is referenced but doesn't exist in the database schema.

## Solution
A new database migration has been added to include the `password_must_change` column in the `users` table.

## How to Apply the Fix

### Option 1: Using Alembic (Recommended for Production)

1. **Backup your database first** (important!):
   ```bash
   # For PostgreSQL
   pg_dump mastablasta > backup_$(date +%Y%m%d_%H%M%S).sql
   ```

2. **Run the migration**:
   ```bash
   cd /path/to/MastaBlasta
   alembic upgrade head
   ```

3. **Verify the migration**:
   ```bash
   # Check that the column exists
   psql mastablasta -c "\d users" | grep password_must_change
   ```

4. **Restart the application**:
   ```bash
   # If using Docker
   docker-compose restart
   
   # If running directly
   # Stop the application and restart it
   python app.py
   ```

### Option 2: Manual SQL (If Alembic is not available)

If you cannot use Alembic, you can manually apply the SQL:

```sql
-- Add the column
ALTER TABLE users ADD COLUMN password_must_change BOOLEAN;

-- Set default values for existing rows
UPDATE users SET password_must_change = FALSE WHERE password_must_change IS NULL;

-- Make the column non-nullable
ALTER TABLE users ALTER COLUMN password_must_change SET NOT NULL;
ALTER TABLE users ALTER COLUMN password_must_change SET DEFAULT FALSE;
```

## Verification

After applying the migration, verify that the default admin account works:

1. **Check if admin account exists**:
   ```sql
   SELECT email, is_active, password_must_change FROM users WHERE email = 'admin@mastablasta.com';
   ```

2. **If admin doesn't exist, restart the app** - it will be created automatically on startup.

3. **Test login**:
   - Email: `admin@mastablasta.com`
   - Password: `ChangeMe123!`
   
   You should be prompted to change the password on first login.

## Troubleshooting

### Issue: Migration fails with "column already exists"
This means the column was added manually or by another process. You can mark the migration as applied:
```bash
alembic stamp b1c2d3e4f5g6
```

### Issue: Admin account still doesn't work
1. Check application logs for errors during startup
2. Verify the database connection is working
3. Try manually resetting the admin password:
   ```sql
   -- Generate a new bcrypt hash for "ChangeMe123!" and update
   -- Use Python to generate: python3 -c "from auth import hash_password; print(hash_password('ChangeMe123!'))"
   ```

### Issue: "Database not enabled" error
Make sure the `DATABASE_URL` environment variable is set:
```bash
export DATABASE_URL="postgresql://localhost/mastablasta"
# Or for production with credentials:
export DATABASE_URL="postgresql://username:password@host:5432/mastablasta"
```

## Related Files
- Migration: `alembic/versions/b1c2d3e4f5g6_add_password_must_change_column.py`
- User Model: `models.py` (User class, line 51)
- Admin Creation: `auth.py` (create_default_admin function, lines 235-279)
- App Initialization: `app.py` (lines 127-134)
