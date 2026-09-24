#!/bin/bash
#
# deploy.sh — Manual deployment script for BusinessRun
#
# Usage:
#   ./scripts/deploy.sh [frontend|backend|all]
#
# This script can be run manually or called by Jenkins.
# It handles building frontend, copying files, and restarting PM2.
#
# Prerequisites:
#   - Node.js 18+ installed
#   - PM2 installed globally
#   - Write access to /var/www/businessrun
#

set -e  # Exit on any error

# ── Configuration ──────────────────────────────────────────────────
DEPLOY_PATH="${DEPLOY_PATH:-/var/www/businessrun}"
BACKEND_PATH="${BACKEND_PATH:-/var/www/businessrun/server}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# ── Helper functions ───────────────────────────────────────────────
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# ── Deploy Frontend ────────────────────────────────────────────────
deploy_frontend() {
    log_info "Deploying frontend..."

    cd "$PROJECT_ROOT/frontend"

    # Install dependencies
    log_info "Installing frontend dependencies..."
    npm ci --prefer-offline 2>/dev/null || npm install

    # Build
    log_info "Building frontend for production..."
    npm run build

    # Backup current
    if [ -d "$DEPLOY_PATH/static" ]; then
        BACKUP_DIR="$DEPLOY_PATH/../backups/frontend-$(date +%Y%m%d-%H%M%S)"
        mkdir -p "$DEPLOY_PATH/../backups"
        cp -r "$DEPLOY_PATH/static" "$BACKUP_DIR" 2>/dev/null || true
        log_info "Backed up current frontend to $BACKUP_DIR"
    fi

    # Deploy
    log_info "Copying build files to $DEPLOY_PATH..."
    rm -rf "$DEPLOY_PATH/static" "$DEPLOY_PATH/index.html" "$DEPLOY_PATH/asset-manifest.json" 2>/dev/null || true
    cp -r build/* "$DEPLOY_PATH/"

    log_info "Frontend deployed successfully!"
}

# ── Deploy Backend ─────────────────────────────────────────────────
deploy_backend() {
    log_info "Deploying backend..."

    cd "$PROJECT_ROOT/backend"

    # Syntax check
    log_info "Checking JavaScript syntax..."
    for f in *.js config/*.js controllers/*.js middleware/*.js routes/*.js services/*.js utils/*.js; do
        if [ -f "$f" ]; then
            node --check "$f" || {
                log_error "Syntax error in $f"
                exit 1
            }
        fi
    done
    log_info "All syntax checks passed"

    # Backup current (excluding node_modules)
    if [ -d "$BACKEND_PATH" ]; then
        BACKUP_DIR="$DEPLOY_PATH/../backups/backend-$(date +%Y%m%d-%H%M%S)"
        mkdir -p "$BACKUP_DIR"
        cp -r "$BACKEND_PATH"/*.js "$BACKEND_PATH"/config "$BACKEND_PATH"/controllers \
              "$BACKEND_PATH"/middleware "$BACKEND_PATH"/routes "$BACKEND_PATH"/services \
              "$BACKEND_PATH"/utils "$BACKUP_DIR/" 2>/dev/null || true
        log_info "Backed up current backend to $BACKUP_DIR"
    fi

    # Deploy (preserve node_modules and .env)
    log_info "Syncing backend files to $BACKEND_PATH..."
    rsync -av --delete \
        --exclude 'node_modules' \
        --exclude '.env' \
        --exclude '*.log' \
        --exclude 'package-lock.json' \
        ./ "$BACKEND_PATH/"

    # Install dependencies
    log_info "Installing production dependencies..."
    cd "$BACKEND_PATH"
    npm install --production --prefer-offline 2>/dev/null || npm install --production

    # Restart PM2
    log_info "Restarting PM2..."
    if pm2 describe businessrun-api > /dev/null 2>&1; then
        pm2 reload businessrun-api --update-env
    else
        pm2 start ecosystem.config.js
    fi
    pm2 save

    log_info "Backend deployed successfully!"
}

# ── Health Check ───────────────────────────────────────────────────
health_check() {
    log_info "Running health check..."
    sleep 3

    HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5000/api/health 2>/dev/null || echo "000")

    if [ "$HTTP_STATUS" = "200" ]; then
        log_info "Health check passed! Server is running."
        return 0
    else
        log_warn "Health check returned status $HTTP_STATUS"
        log_warn "Check logs: pm2 logs businessrun"
        return 1
    fi
}

# ── Main ───────────────────────────────────────────────────────────
main() {
    local target="${1:-all}"

    log_info "Starting deployment (target: $target)..."
    log_info "Project root: $PROJECT_ROOT"
    log_info "Deploy path: $DEPLOY_PATH"

    case "$target" in
        frontend)
            deploy_frontend
            ;;
        backend)
            deploy_backend
            health_check || true
            ;;
        all)
            deploy_frontend
            deploy_backend
            health_check || true
            ;;
        *)
            log_error "Unknown target: $target"
            echo "Usage: $0 [frontend|backend|all]"
            exit 1
            ;;
    esac

    log_info "Deployment complete!"
}

# Run main function
main "$@"
