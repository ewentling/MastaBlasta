#!/bin/bash

################################################################################
# MastaBlasta Production Update Script
# 
# This script safely updates a running MastaBlasta installation while
# preserving all existing data including:
# - Database content
# - User uploads and media files
# - Configuration files (.env)
# - OAuth credentials
#
# Usage:
#   ./update.sh                 # Full update with all checks
#   ./update.sh --dry-run       # Preview changes without applying
#   ./update.sh --skip-backup   # Skip backup (not recommended)
#   ./update.sh --help          # Show help
#
# Author: MastaBlasta Team
# Version: 1.0.0
################################################################################

set -e  # Exit on error
set -u  # Exit on undefined variable

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKUP_DIR="${SCRIPT_DIR}/backups"
LOG_FILE="${SCRIPT_DIR}/update_$(date +%Y%m%d_%H%M%S).log"
DRY_RUN=false
SKIP_BACKUP=false
DEPLOYMENT_TYPE=""
BACKUP_PATH=""  # Set during create_backups(); used by rollback trap

# Automatic rollback on failure
_rollback_on_exit() {
    local exit_code=$?
    if [ $exit_code -ne 0 ]; then
        echo -e "\n\033[0;31m[ERROR]\033[0m Update failed (exit code $exit_code). Attempting automatic database restore..." | tee -a "$LOG_FILE"
        if [ -n "$BACKUP_PATH" ] && [ "$SKIP_BACKUP" != "true" ] && [ "$DRY_RUN" != "true" ]; then
            # Restore database backup if it exists
            DB_BACKUP_FILE="${BACKUP_PATH}/database_backup.sql"
            if [ -f "$DB_BACKUP_FILE" ]; then
                echo -e "\033[1;33m[WARNING]\033[0m Restoring database from: $DB_BACKUP_FILE" | tee -a "$LOG_FILE"
                if [ -f ".env" ]; then
                    source .env 2>/dev/null || true
                fi
                if [ -n "${DATABASE_URL:-}" ]; then
                    if [[ $DATABASE_URL =~ postgresql://([^:]+):([^@]+)@([^:/]+):?([0-9]+)?/(.+) ]]; then
                        DB_USER="${BASH_REMATCH[1]}"
                        DB_PASS="${BASH_REMATCH[2]}"
                        DB_HOST="${BASH_REMATCH[3]}"
                        DB_PORT="${BASH_REMATCH[4]:-5432}"
                        DB_NAME="${BASH_REMATCH[5]}"
                        if command -v pg_restore &> /dev/null; then
                            PGPASSWORD="$DB_PASS" pg_restore --clean --if-exists -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" "$DB_BACKUP_FILE" 2>&1 | tee -a "$LOG_FILE" \
                                && echo -e "\033[0;32m[SUCCESS]\033[0m Database restored successfully." | tee -a "$LOG_FILE" \
                                || echo -e "\033[0;31m[ERROR]\033[0m Automatic database restore failed. Restore manually with: pg_restore -d $DB_NAME $DB_BACKUP_FILE" | tee -a "$LOG_FILE"
                        fi
                    elif [[ $DATABASE_URL =~ postgresql://localhost/(.+) ]] || [[ $DATABASE_URL =~ postgresql:///(.+) ]]; then
                        DB_NAME="${BASH_REMATCH[1]}"
                        if command -v pg_restore &> /dev/null; then
                            pg_restore --clean --if-exists -d "$DB_NAME" "$DB_BACKUP_FILE" 2>&1 | tee -a "$LOG_FILE" \
                                && echo -e "\033[0;32m[SUCCESS]\033[0m Database restored successfully." | tee -a "$LOG_FILE" \
                                || echo -e "\033[0;31m[ERROR]\033[0m Automatic database restore failed. Restore manually with: pg_restore -d $DB_NAME $DB_BACKUP_FILE" | tee -a "$LOG_FILE"
                        fi
                    fi
                fi
            fi
            # Restore .env if it was backed up
            ENV_BACKUP="${BACKUP_PATH}/.env.backup"
            if [ -f "$ENV_BACKUP" ]; then
                cp "$ENV_BACKUP" .env
                echo -e "\033[0;32m[SUCCESS]\033[0m .env restored from backup." | tee -a "$LOG_FILE"
            fi
        fi
        echo -e "\033[0;31m[ERROR]\033[0m Update did not complete successfully. See log: $LOG_FILE" | tee -a "$LOG_FILE"
    fi
}
trap '_rollback_on_exit' EXIT

# Function to print colored messages
print_info() {
    echo -e "${BLUE}[INFO]${NC} $1" | tee -a "$LOG_FILE"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "$LOG_FILE"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$LOG_FILE"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"
}

print_section() {
    echo "" | tee -a "$LOG_FILE"
    echo -e "${BLUE}========================================${NC}" | tee -a "$LOG_FILE"
    echo -e "${BLUE}$1${NC}" | tee -a "$LOG_FILE"
    echo -e "${BLUE}========================================${NC}" | tee -a "$LOG_FILE"
}

# Function to show help
show_help() {
    cat << EOF
MastaBlasta Update Script - Safely deploy updates to production

USAGE:
    ./update.sh [OPTIONS]

OPTIONS:
    --dry-run           Preview changes without applying them
    --skip-backup       Skip backup creation (NOT RECOMMENDED)
    --help              Show this help message

EXAMPLES:
    # Standard update with all safety checks
    ./update.sh

    # Preview what will happen without making changes
    ./update.sh --dry-run

    # Quick update without backup (use only in development)
    ./update.sh --skip-backup

WHAT THIS SCRIPT DOES:
    1. Pre-update checks (disk space, dependencies, connectivity)
    2. Backup (database, media files, configuration)
    3. Code update (git pull)
    4. Dependencies (Python packages, npm packages)
    5. Database migrations (alembic upgrade head)
    6. Frontend build (npm run build)
    7. Service restart (graceful restart)
    8. Post-update validation (health checks)

SAFETY FEATURES:
    - All existing data is preserved
    - Automatic backups before any changes
    - Rollback instructions if something goes wrong
    - Health checks to verify successful deployment
    - Detailed logging of all operations

For more information, see UPDATE_GUIDE.md
EOF
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --dry-run)
            DRY_RUN=true
            print_warning "DRY RUN MODE - No changes will be made"
            shift
            ;;
        --skip-backup)
            SKIP_BACKUP=true
            print_warning "BACKUP SKIPPED - This is not recommended for production"
            shift
            ;;
        --help)
            show_help
            exit 0
            ;;
        *)
            print_error "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Detect deployment type
detect_deployment_type() {
    if [ -f "docker-compose.yml" ] && command -v docker-compose &> /dev/null; then
        DEPLOYMENT_TYPE="docker-compose"
    elif command -v docker &> /dev/null && docker ps | grep -q "mastablasta"; then
        DEPLOYMENT_TYPE="docker"
    else
        DEPLOYMENT_TYPE="direct"
    fi
    print_info "Detected deployment type: $DEPLOYMENT_TYPE"
}

################################################################################
# PHASE 1: PRE-UPDATE CHECKS
################################################################################

pre_update_checks() {
    print_section "PHASE 1: PRE-UPDATE CHECKS"
    
    # Check if we're in the right directory
    if [ ! -f "app.py" ] || [ ! -f "requirements.txt" ]; then
        print_error "This doesn't appear to be the MastaBlasta directory"
        exit 1
    fi
    print_success "Found MastaBlasta application files"
    
    # Check disk space (need at least 2GB free)
    AVAILABLE_SPACE=$(df -BG . | tail -1 | awk '{print $4}' | sed 's/G//')
    if [ "$AVAILABLE_SPACE" -lt 2 ]; then
        print_error "Insufficient disk space: ${AVAILABLE_SPACE}GB available (need 2GB minimum)"
        exit 1
    fi
    print_success "Sufficient disk space: ${AVAILABLE_SPACE}GB available"
    
    # Check if Python is available
    if ! command -v python3 &> /dev/null; then
        print_error "Python 3 is not installed"
        exit 1
    fi
    PYTHON_VERSION=$(python3 --version)
    print_success "Python found: $PYTHON_VERSION"
    
    # Check if Node/npm is available (for frontend build)
    if ! command -v npm &> /dev/null; then
        print_error "npm is not installed (needed for frontend build)"
        exit 1
    fi
    NPM_VERSION=$(npm --version)
    print_success "npm found: version $NPM_VERSION"
    
    # Check database connectivity (if DATABASE_URL is set)
    if [ -f ".env" ] && grep -q "DATABASE_URL" .env; then
        print_info "Checking database connectivity..."
        if python3 -c "from database import test_connection; test_connection()" 2>/dev/null; then
            print_success "Database connection successful"
        else
            print_warning "Could not verify database connection (this may be normal if not configured)"
        fi
    fi
    
    # Check if git is available
    if ! command -v git &> /dev/null; then
        print_error "git is not installed"
        exit 1
    fi
    print_success "git found: $(git --version)"
    
    print_success "All pre-update checks passed!"
}

################################################################################
# PHASE 2: BACKUP OPERATIONS
################################################################################

create_backups() {
    print_section "PHASE 2: BACKUP OPERATIONS"
    
    if [ "$SKIP_BACKUP" = true ]; then
        print_warning "Skipping backups as requested"
        return
    fi
    
    if [ "$DRY_RUN" = true ]; then
        print_info "[DRY RUN] Would create backups in: $BACKUP_DIR"
        return
    fi
    
    # Create backup directory with timestamp
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    BACKUP_PATH="${BACKUP_DIR}/${TIMESTAMP}"
    mkdir -p "$BACKUP_PATH"
    print_info "Creating backups in: $BACKUP_PATH"
    
    # Backup .env file
    if [ -f ".env" ]; then
        cp .env "${BACKUP_PATH}/.env.backup"
        print_success "Backed up .env file"
    else
        print_warning "No .env file found to backup"
    fi
    
    # Backup database
    if [ -f ".env" ] && grep -q "DATABASE_URL" .env; then
        print_info "Backing up database..."
        
        # Extract database connection details from .env
        source .env
        if [ -n "${DATABASE_URL:-}" ]; then
            # Use pg_dump if available
            if command -v pg_dump &> /dev/null; then
                DB_BACKUP_FILE="${BACKUP_PATH}/database_backup.sql"
                
                # Parse DATABASE_URL to extract components
                # Format: postgresql://user:password@host:port/database
                if [[ $DATABASE_URL =~ postgresql://([^:]+):([^@]+)@([^:/]+):?([0-9]+)?/(.+) ]]; then
                    DB_USER="${BASH_REMATCH[1]}"
                    DB_PASS="${BASH_REMATCH[2]}"
                    DB_HOST="${BASH_REMATCH[3]}"
                    DB_PORT="${BASH_REMATCH[4]:-5432}"
                    DB_NAME="${BASH_REMATCH[5]}"
                    
                    PGPASSWORD="$DB_PASS" pg_dump -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -F c -f "$DB_BACKUP_FILE" 2>&1 | tee -a "$LOG_FILE"
                    
                    if [ -f "$DB_BACKUP_FILE" ]; then
                        BACKUP_SIZE=$(du -h "$DB_BACKUP_FILE" | cut -f1)
                        print_success "Database backed up successfully (${BACKUP_SIZE})"
                    else
                        print_warning "Database backup may have failed"
                    fi
                elif [[ $DATABASE_URL =~ postgresql://localhost/(.+) ]] || [[ $DATABASE_URL =~ postgresql:///(.+) ]]; then
                    # Simple format without credentials
                    DB_NAME="${BASH_REMATCH[1]}"
                    DB_BACKUP_FILE="${BACKUP_PATH}/database_backup.sql"
                    pg_dump -d "$DB_NAME" -F c -f "$DB_BACKUP_FILE" 2>&1 | tee -a "$LOG_FILE"
                    
                    if [ -f "$DB_BACKUP_FILE" ]; then
                        BACKUP_SIZE=$(du -h "$DB_BACKUP_FILE" | cut -f1)
                        print_success "Database backed up successfully (${BACKUP_SIZE})"
                    fi
                else
                    print_warning "Could not parse DATABASE_URL format"
                fi
            else
                print_warning "pg_dump not available - skipping database backup"
            fi
        fi
    fi
    
    # Backup media files
    if [ -d "media" ]; then
        print_info "Backing up media files..."
        tar -czf "${BACKUP_PATH}/media_backup.tar.gz" media/ 2>&1 | tee -a "$LOG_FILE"
        if [ -f "${BACKUP_PATH}/media_backup.tar.gz" ]; then
            BACKUP_SIZE=$(du -h "${BACKUP_PATH}/media_backup.tar.gz" | cut -f1)
            print_success "Media files backed up successfully (${BACKUP_SIZE})"
        fi
    else
        print_warning "No media directory found to backup"
    fi
    
    # Create backup manifest
    cat > "${BACKUP_PATH}/MANIFEST.txt" << EOF
MastaBlasta Backup Manifest
Created: $(date)
Backup Location: ${BACKUP_PATH}

Contents:
$(ls -lh "${BACKUP_PATH}")

Git Status Before Update:
$(git status --short)
$(git log -1 --oneline)

To Restore:
1. Database: pg_restore -d mastablasta ${BACKUP_PATH}/database_backup.sql
2. Media: tar -xzf ${BACKUP_PATH}/media_backup.tar.gz
3. Config: cp ${BACKUP_PATH}/.env.backup .env
EOF
    
    print_success "Backup completed: $BACKUP_PATH"
    print_info "To restore from this backup, see: ${BACKUP_PATH}/MANIFEST.txt"
}

################################################################################
# PHASE 3: CODE UPDATE
################################################################################

update_code() {
    print_section "PHASE 3: CODE UPDATE"
    
    # Show current git status
    print_info "Current git status:"
    git status --short | tee -a "$LOG_FILE"
    
    # Show current branch and commit
    CURRENT_BRANCH=$(git branch --show-current)
    CURRENT_COMMIT=$(git log -1 --oneline)
    print_info "Current branch: $CURRENT_BRANCH"
    print_info "Current commit: $CURRENT_COMMIT"
    
    if [ "$DRY_RUN" = true ]; then
        print_info "[DRY RUN] Would fetch updates from git"
        print_info "[DRY RUN] Would show what changed"
        return
    fi
    
    # Fetch latest changes
    print_info "Fetching latest changes..."
    git fetch origin 2>&1 | tee -a "$LOG_FILE"
    
    # Check if there are updates available
    UPDATES_AVAILABLE=$(git rev-list HEAD..origin/$CURRENT_BRANCH --count)
    if [ "$UPDATES_AVAILABLE" -eq 0 ]; then
        print_info "No updates available - already at latest version"
        return
    fi
    
    print_info "Updates available: $UPDATES_AVAILABLE commits"
    
    # Show what will change
    print_info "Changes to be applied:"
    git log --oneline HEAD..origin/$CURRENT_BRANCH | tee -a "$LOG_FILE"
    
    # Pull changes
    print_info "Pulling latest code..."
    git pull origin "$CURRENT_BRANCH" 2>&1 | tee -a "$LOG_FILE"
    
    NEW_COMMIT=$(git log -1 --oneline)
    print_success "Code updated to: $NEW_COMMIT"
}

################################################################################
# PHASE 4: DEPENDENCY UPDATES
################################################################################

update_dependencies() {
    print_section "PHASE 4: DEPENDENCY UPDATES"
    
    if [ "$DRY_RUN" = true ]; then
        print_info "[DRY RUN] Would update Python dependencies from requirements.txt"
        print_info "[DRY RUN] Would update frontend dependencies in frontend/"
        return
    fi
    
    # Update Python dependencies
    print_info "Updating Python dependencies..."
    if [ -f "requirements.txt" ]; then
        pip3 install --upgrade -r requirements.txt 2>&1 | tee -a "$LOG_FILE"
        print_success "Python dependencies updated"
    fi
    
    # Update frontend dependencies
    if [ -d "frontend" ]; then
        print_info "Updating frontend dependencies..."
        cd frontend
        npm install 2>&1 | tee -a "$LOG_FILE"
        cd ..
        print_success "Frontend dependencies updated"
    fi
}

################################################################################
# PHASE 5: DATABASE MIGRATIONS
################################################################################

run_migrations() {
    print_section "PHASE 5: DATABASE MIGRATIONS"
    
    if [ "$DRY_RUN" = true ]; then
        print_info "[DRY RUN] Would run: alembic upgrade head"
        return
    fi
    
    # Check if alembic is configured
    if [ ! -f "alembic.ini" ]; then
        print_warning "No alembic.ini found - skipping migrations"
        return
    fi
    
    print_info "Running database migrations..."
    print_info "Note: This preserves all existing data"
    
    # Show current migration status
    print_info "Current migration status:"
    alembic current 2>&1 | tee -a "$LOG_FILE"
    
    # Run migrations
    alembic upgrade head 2>&1 | tee -a "$LOG_FILE"
    
    # Show new migration status
    print_info "New migration status:"
    alembic current 2>&1 | tee -a "$LOG_FILE"
    
    print_success "Database migrations completed"
}

################################################################################
# PHASE 6: FRONTEND BUILD
################################################################################

build_frontend() {
    print_section "PHASE 6: FRONTEND BUILD"
    
    if [ ! -d "frontend" ]; then
        print_warning "No frontend directory found - skipping build"
        return
    fi
    
    if [ "$DRY_RUN" = true ]; then
        print_info "[DRY RUN] Would run: npm run build in frontend/"
        return
    fi
    
    print_info "Building frontend..."
    cd frontend
    npm run build 2>&1 | tee -a "$LOG_FILE"
    cd ..
    
    # Verify build succeeded
    if [ -d "frontend/dist" ]; then
        BUILD_SIZE=$(du -sh frontend/dist | cut -f1)
        print_success "Frontend built successfully (${BUILD_SIZE})"
    else
        print_error "Frontend build failed - dist directory not found"
        exit 1
    fi
}

################################################################################
# PHASE 7: SERVICE RESTART
################################################################################

restart_services() {
    print_section "PHASE 7: SERVICE RESTART"
    
    if [ "$DRY_RUN" = true ]; then
        print_info "[DRY RUN] Would restart services using: $DEPLOYMENT_TYPE"
        return
    fi
    
    case "$DEPLOYMENT_TYPE" in
        docker-compose)
            print_info "Restarting services with docker-compose..."
            print_info "Stopping services..."
            docker-compose down 2>&1 | tee -a "$LOG_FILE"
            
            print_info "Building new image..."
            docker-compose build 2>&1 | tee -a "$LOG_FILE"
            
            print_info "Starting services..."
            docker-compose up -d 2>&1 | tee -a "$LOG_FILE"
            
            # Verify container is running
            sleep 5
            if docker-compose ps | grep -q "Up"; then
                print_success "Docker Compose services started successfully"
                CONTAINER_ID=$(docker-compose ps -q)
                print_info "Container ID: $CONTAINER_ID"
            else
                print_error "Docker Compose services failed to start"
                docker-compose logs --tail=50 2>&1 | tee -a "$LOG_FILE"
                exit 1
            fi
            ;;
        docker)
            print_info "Restarting Docker container..."
            CONTAINER_NAME=$(docker ps -a --filter "name=mastablasta" --format "{{.Names}}" | head -1)
            
            if [ -n "$CONTAINER_NAME" ]; then
                print_info "Stopping container: $CONTAINER_NAME"
                docker stop "$CONTAINER_NAME" 2>&1 | tee -a "$LOG_FILE"
                docker rm "$CONTAINER_NAME" 2>&1 | tee -a "$LOG_FILE"
                
                print_info "Building new image..."
                docker build -t mastablasta:latest . 2>&1 | tee -a "$LOG_FILE"
                
                print_info "Starting new container..."
                # Load environment variables from .env if it exists
                if [ -f ".env" ]; then
                    docker run -d \
                        --restart unless-stopped \
                        --name mastablasta-api \
                        --network host \
                        --env-file .env \
                        -v "$(pwd)/media:/app/media" \
                        mastablasta:latest 2>&1 | tee -a "$LOG_FILE"
                else
                    docker run -d \
                        --restart unless-stopped \
                        --name mastablasta-api \
                        -p 33766:33766 \
                        -v "$(pwd)/media:/app/media" \
                        mastablasta:latest 2>&1 | tee -a "$LOG_FILE"
                fi
                
                # Verify container is running
                sleep 5
                if docker ps | grep -q mastablasta-api; then
                    print_success "Docker container started successfully"
                    CONTAINER_ID=$(docker ps --filter "name=mastablasta-api" --format "{{.ID}}")
                    print_info "Container ID: $CONTAINER_ID"
                else
                    print_error "Docker container failed to start"
                    docker logs mastablasta-api 2>&1 | tee -a "$LOG_FILE"
                    exit 1
                fi
            else
                print_warning "No existing mastablasta container found"
                print_info "Starting new container..."
                docker build -t mastablasta:latest . 2>&1 | tee -a "$LOG_FILE"
                
                if [ -f ".env" ]; then
                    docker run -d \
                        --restart unless-stopped \
                        --name mastablasta-api \
                        --network host \
                        --env-file .env \
                        -v "$(pwd)/media:/app/media" \
                        mastablasta:latest 2>&1 | tee -a "$LOG_FILE"
                else
                    docker run -d \
                        --restart unless-stopped \
                        --name mastablasta-api \
                        -p 33766:33766 \
                        -v "$(pwd)/media:/app/media" \
                        mastablasta:latest 2>&1 | tee -a "$LOG_FILE"
                fi
                
                sleep 5
                if docker ps | grep -q mastablasta-api; then
                    print_success "Docker container started successfully"
                else
                    print_error "Docker container failed to start"
                    exit 1
                fi
            fi
            ;;
        direct)
            print_info "Direct deployment detected"
            
            # Try systemd first
            if systemctl is-active --quiet mastablasta 2>/dev/null; then
                print_info "Restarting via systemd..."
                sudo systemctl restart mastablasta 2>&1 | tee -a "$LOG_FILE"
                sleep 5
                if systemctl is-active --quiet mastablasta; then
                    print_success "Service restarted via systemd"
                else
                    print_error "Failed to restart via systemd"
                    sudo systemctl status mastablasta 2>&1 | tee -a "$LOG_FILE"
                    exit 1
                fi
            # Try supervisor
            elif command -v supervisorctl &> /dev/null && supervisorctl status mastablasta &> /dev/null; then
                print_info "Restarting via supervisor..."
                supervisorctl restart mastablasta 2>&1 | tee -a "$LOG_FILE"
                sleep 5
                if supervisorctl status mastablasta | grep -q RUNNING; then
                    print_success "Service restarted via supervisor"
                else
                    print_error "Failed to restart via supervisor"
                    supervisorctl status mastablasta 2>&1 | tee -a "$LOG_FILE"
                    exit 1
                fi
            # Manual restart
            else
                print_warning "No service manager detected"
                print_info "Attempting manual restart..."
                
                # Find and kill existing Python processes
                if pgrep -f "python.*app.py" > /dev/null; then
                    print_info "Stopping existing Python processes..."
                    pkill -f "python.*app.py" 2>&1 | tee -a "$LOG_FILE"
                    sleep 2
                fi
                
                # Start new process in background
                print_info "Starting new Python process..."
                nohup python3 app.py > app.log 2>&1 &
                APP_PID=$!
                print_info "Started with PID: $APP_PID"
                
                # Save PID for future reference
                echo $APP_PID > mastablasta.pid
                
                sleep 5
                if ps -p $APP_PID > /dev/null; then
                    print_success "Application started successfully (PID: $APP_PID)"
                else
                    print_error "Application failed to start"
                    tail -50 app.log 2>&1 | tee -a "$LOG_FILE"
                    exit 1
                fi
            fi
            ;;
    esac
    
    # Wait for services to fully initialize
    print_info "Waiting for application to initialize (15 seconds)..."
    sleep 15
}

################################################################################
# PHASE 8: POST-UPDATE VALIDATION
################################################################################

validate_deployment() {
    print_section "PHASE 8: POST-UPDATE VALIDATION"
    
    if [ "$DRY_RUN" = true ]; then
        print_info "[DRY RUN] Would run health checks"
        return
    fi
    
    VALIDATION_FAILED=false
    
    # 1. Verify process is running
    print_info "Verifying application process..."
    case "$DEPLOYMENT_TYPE" in
        docker-compose|docker)
            if docker ps | grep -q mastablasta; then
                CONTAINER_ID=$(docker ps --filter "name=mastablasta" --format "{{.ID}}" | head -1)
                print_success "Container is running: $CONTAINER_ID"
            else
                print_error "Container is not running!"
                VALIDATION_FAILED=true
            fi
            ;;
        direct)
            if [ -f "mastablasta.pid" ]; then
                PID=$(cat mastablasta.pid)
                if ps -p $PID > /dev/null 2>&1; then
                    print_success "Process is running: PID $PID"
                else
                    print_error "Process is not running (PID $PID not found)"
                    VALIDATION_FAILED=true
                fi
            elif systemctl is-active --quiet mastablasta 2>/dev/null; then
                print_success "Service is running (systemd)"
            elif command -v supervisorctl &> /dev/null && supervisorctl status mastablasta 2>/dev/null | grep -q RUNNING; then
                print_success "Service is running (supervisor)"
            elif pgrep -f "python.*app.py" > /dev/null; then
                PID=$(pgrep -f "python.*app.py" | head -1)
                print_success "Process is running: PID $PID"
            else
                print_error "No running process found!"
                VALIDATION_FAILED=true
            fi
            ;;
    esac
    
    # 2. Test database connection
    print_info "Testing database connection..."
    if python3 -c "from database import test_connection; test_connection()" 2>/dev/null; then
        print_success "Database connection: OK"
    else
        print_warning "Database connection: Could not verify (may not be configured)"
    fi
    
    # 3. Test API health endpoint with retries
    print_info "Testing API health endpoint (with retries)..."
    API_HEALTHY=false
    for attempt in {1..6}; do
        if curl -f -s http://localhost:33766/api/health > /dev/null 2>&1; then
            API_HEALTHY=true
            break
        else
            if [ $attempt -lt 6 ]; then
                print_info "Attempt $attempt/6 failed, retrying in 5 seconds..."
                sleep 5
            fi
        fi
    done
    
    if [ "$API_HEALTHY" = true ]; then
        print_success "API health check: OK ✓"
        
        # Get health endpoint response
        HEALTH_RESPONSE=$(curl -s http://localhost:33766/api/health 2>/dev/null || echo "{}")
        print_info "Health status: $HEALTH_RESPONSE"
    else
        print_error "API health check: FAILED ✗"
        print_error "Could not connect to http://localhost:33766/api/health after 6 attempts"
        VALIDATION_FAILED=true
    fi
    
    # 4. Test additional API endpoints
    if [ "$API_HEALTHY" = true ]; then
        print_info "Testing additional endpoints..."
        
        # Test root endpoint
        if curl -f -s http://localhost:33766/ > /dev/null 2>&1; then
            print_success "Root endpoint: OK"
        else
            print_warning "Root endpoint: Not accessible"
        fi
        
        # Test auth endpoints (should return 401 or 200)
        HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:33766/api/users/me 2>/dev/null || echo "000")
        if [ "$HTTP_CODE" = "401" ] || [ "$HTTP_CODE" = "200" ]; then
            print_success "Auth endpoints: OK (returned $HTTP_CODE)"
        else
            print_warning "Auth endpoints: Unexpected response ($HTTP_CODE)"
        fi
    fi
    
    # 5. Check if frontend is accessible
    print_info "Checking frontend availability..."
    if [ -d "frontend/dist" ] && [ -f "frontend/dist/index.html" ]; then
        DIST_SIZE=$(du -sh frontend/dist | cut -f1)
        print_success "Frontend build: OK (${DIST_SIZE})"
        
        # Test frontend is being served
        if curl -f -s http://localhost:33766/ -o /dev/null 2>&1; then
            print_success "Frontend accessible via HTTP"
        else
            print_warning "Frontend may not be accessible via HTTP"
        fi
    else
        print_error "Frontend build: Missing dist directory"
        VALIDATION_FAILED=true
    fi
    
    # 6. Check application logs for errors
    print_info "Checking application logs..."
    case "$DEPLOYMENT_TYPE" in
        docker-compose|docker)
            CONTAINER_NAME=$(docker ps --filter "name=mastablasta" --format "{{.Names}}" | head -1)
            if [ -n "$CONTAINER_NAME" ]; then
                ERROR_COUNT=$(docker logs "$CONTAINER_NAME" 2>&1 | grep -i "error" | grep -v "No error" | wc -l)
                if [ "$ERROR_COUNT" -gt 0 ]; then
                    print_warning "Found $ERROR_COUNT errors in container logs (review recommended)"
                    print_info "Last 10 errors:"
                    docker logs "$CONTAINER_NAME" 2>&1 | grep -i "error" | grep -v "No error" | tail -10
                else
                    print_success "No errors found in container logs"
                fi
            fi
            ;;
        direct)
            if [ -f "app.log" ]; then
                ERROR_COUNT=$(grep -i "error" app.log | grep -v "No error" | wc -l)
                if [ "$ERROR_COUNT" -gt 0 ]; then
                    print_warning "Found $ERROR_COUNT errors in app.log (review recommended)"
                else
                    print_success "No errors found in app.log"
                fi
            fi
            ;;
    esac
    
    # 7. Final validation summary
    echo "" | tee -a "$LOG_FILE"
    print_section "VALIDATION SUMMARY"
    
    if [ "$VALIDATION_FAILED" = true ]; then
        print_error "❌ VALIDATION FAILED - Application may not be working correctly"
        print_error "Please check the logs and fix any issues"
        echo ""
        print_info "Troubleshooting steps:"
        print_info "1. Check application logs:"
        case "$DEPLOYMENT_TYPE" in
            docker-compose|docker)
                print_info "   docker logs mastablasta-api --tail=100"
                ;;
            direct)
                print_info "   tail -100 app.log"
                print_info "   journalctl -u mastablasta -n 100"
                ;;
        esac
        print_info "2. Check if port 33766 is already in use:"
        print_info "   sudo lsof -i :33766"
        print_info "3. Check database connection in .env"
        print_info "4. Review update log: $LOG_FILE"
        echo ""
        exit 1
    else
        print_success "✅ ALL VALIDATIONS PASSED"
        echo ""
        print_success "╔══════════════════════════════════════════════════════════╗"
        print_success "║  🎉 APPLICATION IS RUNNING AND HEALTHY 🎉              ║"
        print_success "╚══════════════════════════════════════════════════════════╝"
        echo ""
        print_info "Application details:"
        print_info "  URL: http://localhost:33766"
        print_info "  Health: http://localhost:33766/api/health"
        print_info "  Deployment: $DEPLOYMENT_TYPE"
        
        case "$DEPLOYMENT_TYPE" in
            docker-compose|docker)
                CONTAINER_ID=$(docker ps --filter "name=mastablasta" --format "{{.ID}}" | head -1)
                print_info "  Container: $CONTAINER_ID"
                ;;
            direct)
                if [ -f "mastablasta.pid" ]; then
                    PID=$(cat mastablasta.pid)
                    print_info "  PID: $PID"
                fi
                ;;
        esac
        echo ""
    fi
}

################################################################################
# ROLLBACK INSTRUCTIONS
################################################################################

show_rollback_instructions() {
    if [ "$SKIP_BACKUP" = true ]; then
        return
    fi
    
    LATEST_BACKUP=$(ls -t "$BACKUP_DIR" 2>/dev/null | head -1)
    if [ -n "$LATEST_BACKUP" ]; then
        cat << EOF

${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}
${YELLOW}ROLLBACK INSTRUCTIONS${NC}
${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}

If something went wrong, you can rollback using the backup:
${BACKUP_DIR}/${LATEST_BACKUP}

To rollback:
1. Restore database:
   pg_restore -d mastablasta ${BACKUP_DIR}/${LATEST_BACKUP}/database_backup.sql

2. Restore media files:
   rm -rf media && tar -xzf ${BACKUP_DIR}/${LATEST_BACKUP}/media_backup.tar.gz

3. Restore configuration:
   cp ${BACKUP_DIR}/${LATEST_BACKUP}/.env.backup .env

4. Revert code:
   git reset --hard <previous-commit>

For detailed instructions, see:
${BACKUP_DIR}/${LATEST_BACKUP}/MANIFEST.txt

${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}
EOF
    fi
}

################################################################################
# MAIN EXECUTION
################################################################################

main() {
    print_section "MASTABLASTA UPDATE SCRIPT"
    print_info "Started at: $(date)"
    print_info "Log file: $LOG_FILE"
    
    if [ "$DRY_RUN" = true ]; then
        print_warning "DRY RUN MODE - No changes will be made"
    fi
    
    # Detect deployment type
    detect_deployment_type
    
    # Run all phases
    pre_update_checks
    create_backups
    update_code
    update_dependencies
    run_migrations
    build_frontend
    restart_services
    validate_deployment
    
    # Show completion message
    print_section "UPDATE COMPLETE"
    print_success "Update completed successfully at: $(date)"
    print_info "Log file saved to: $LOG_FILE"
    
    # Show rollback instructions
    show_rollback_instructions
    
    print_info ""
    print_info "Next steps:"
    print_info "1. Verify the application is working correctly"
    print_info "2. Check logs for any warnings or errors"
    print_info "3. Test critical functionality"
    print_info "4. Monitor application performance"
    print_info ""
    print_success "Happy deploying! 🚀"
}

# Run main function
main
