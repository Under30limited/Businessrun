# CI/CD Setup Guide — BusinessRun

This document explains how to configure Jenkins to automatically deploy
BusinessRun when code is pushed to GitHub.

## Architecture

```
GitHub (push to main)
        │
        ▼ (webhook)
   Jenkins Server
        │
        ├── Pull latest code
        ├── npm install (frontend)
        ├── npm run build (frontend)
        ├── Copy build/ to /var/www/businessrun/
        ├── Sync backend/ to /var/www/businessrun/server/
        ├── npm install --production (backend)
        └── pm2 reload businessrun-api
```

## Server Paths

| Component | Path |
|-----------|------|
| Frontend (build) | `/var/www/businessrun/` |
| Backend | `/var/www/businessrun/server/` |
| Backups | `/var/www/backups/` |

---

## Step 1: Jenkins Configuration

### 1.1 Install Required Plugins

In Jenkins → Manage Jenkins → Plugins, install:
- **Git Plugin** (usually pre-installed)
- **GitHub Integration Plugin**
- **Pipeline** (usually pre-installed)
- **NodeJS Plugin** (optional but recommended)

### 1.2 Configure NodeJS (if using NodeJS Plugin)

1. Go to: Manage Jenkins → Tools
2. Add NodeJS installation:
   - Name: `NodeJS-18`
   - Version: 18.x (or your preferred version)
   - Check "Install automatically"

### 1.3 Create Jenkins Pipeline Job

1. **New Item** → Enter name: `businessrun-deploy` → Select **Pipeline**

2. **General Settings:**
   - Check "GitHub project"
   - Project url: `https://github.com/YOUR_USERNAME/YOUR_REPO/`

3. **Build Triggers:**
   - Check "GitHub hook trigger for GITScm polling"

4. **Pipeline:**
   - Definition: **Pipeline script from SCM**
   - SCM: **Git**
   - Repository URL: `https://github.com/YOUR_USERNAME/YOUR_REPO.git`
   - Credentials: Add your GitHub credentials (or use SSH key)
   - Branch: `*/main`
   - Script Path: `Jenkinsfile`

5. **Save**

### 1.4 Set Up Credentials

1. Go to: Manage Jenkins → Credentials → System → Global credentials
2. Add credentials:
   - **Option A: Username + Token (recommended)**
     - Kind: Username with password
     - Username: your GitHub username
     - Password: GitHub Personal Access Token (with `repo` scope)
     - ID: `github-credentials`

   - **Option B: SSH Key**
     - Kind: SSH Username with private key
     - Username: git
     - Private Key: paste your SSH private key

---

## Step 2: GitHub Webhook

### 2.1 Create Webhook

1. Go to your GitHub repo → Settings → Webhooks → Add webhook

2. Configure:
   - **Payload URL:** `http://YOUR_JENKINS_URL/github-webhook/`
   - **Content type:** `application/json`
   - **Secret:** (optional but recommended — set a secret string)
   - **Which events:** "Just the push event"
   - **Active:** checked

3. Click "Add webhook"

### 2.2 Verify Webhook

After adding, GitHub will send a ping. Check:
- Green checkmark = success
- If it fails, check:
  - Is Jenkins accessible from the internet?
  - Is the URL correct?
  - Any firewall blocking port 8080 (or your Jenkins port)?

---

## Step 3: Server Permissions

Jenkins needs permission to write to deploy paths and run PM2.

### 3.1 Add Jenkins User to Required Groups

```bash
# Add jenkins user to www-data group (for /var/www access)
sudo usermod -aG www-data jenkins

# Ensure /var/www/businessrun is writable
sudo chown -R www-data:www-data /var/www/businessrun
sudo chmod -R 775 /var/www/businessrun

# Create backups directory
sudo mkdir -p /var/www/backups
sudo chown www-data:www-data /var/www/backups
```

### 3.2 PM2 Access for Jenkins

Option A: Run PM2 as jenkins user
```bash
# Switch to jenkins user
sudo su - jenkins

# Start your app (first time only)
cd /var/www/businessrun/server
pm2 start ecosystem.config.js
pm2 save
pm2 startup
# Follow the instructions printed by pm2 startup
```

Option B: Allow jenkins to run pm2 via sudo (if PM2 runs as root)
```bash
# Add to /etc/sudoers.d/jenkins
jenkins ALL=(ALL) NOPASSWD: /usr/bin/pm2
```

---

## Step 4: Environment Variables

### 4.1 Backend .env File

Ensure `/var/www/businessrun/server/.env` exists with all required variables:

```bash
NODE_ENV=production
PORT=5000
JWT_SECRET=your-secret-here
AWS_ACCESS_KEY_ID=xxx
AWS_SECRET_ACCESS_KEY=xxx
AWS_REGION=us-east-1
AWS_S3_BUCKET=your-bucket
PAYSTACK_SECRET_KEY=xxx
GEMINI_API_KEY=xxx
RESEND_API_KEY=xxx
CONTACT_NOTIFICATION_EMAIL=team@example.com
APP_URL=https://thebusinessrun.com
COOKIE_DOMAIN=.thebusinessrun.com
```

**Note:** The `.env` file is excluded from deployment (never committed to git).
You must create it manually on the server once.

---

## Step 5: Testing the Pipeline

### 5.1 Manual Trigger

1. Go to Jenkins → businessrun-deploy
2. Click "Build Now"
3. Watch the Console Output for any errors

### 5.2 Push Trigger

1. Make a small change to the repo
2. Commit and push to main
3. Watch Jenkins automatically trigger

### 5.3 Common Issues

| Issue | Solution |
|-------|----------|
| "Permission denied" on /var/www | Check step 3.1 permissions |
| "pm2: command not found" | Install pm2 globally: `npm install -g pm2` |
| Webhook not triggering | Check GitHub webhook delivery logs |
| npm install fails | Clear npm cache: `npm cache clean --force` |
| Build takes too long | Consider using `npm ci` instead of `npm install` |

---

## Step 6: Manual Deployment (Fallback)

If Jenkins is unavailable, you can deploy manually:

```bash
# SSH into your server
ssh user@your-server

# Navigate to project
cd /path/to/businessrun/codebase

# Pull latest changes
git pull origin main

# Run deployment script
./scripts/deploy.sh all

# Or deploy only frontend/backend
./scripts/deploy.sh frontend
./scripts/deploy.sh backend
```

---

## Pipeline Stages

The Jenkinsfile runs these stages:

1. **Checkout** — Pull code from GitHub
2. **Install Frontend Dependencies** — `npm ci` in frontend/
3. **Build Frontend** — `npm run build` creates production bundle
4. **Install Backend Dependencies** — `npm ci --production` in backend/
5. **Syntax Check Backend** — `node --check` on all .js files
6. **Deploy Frontend** — Copy build/ to /var/www/businessrun/
7. **Deploy Backend** — Rsync backend/ to /var/www/businessrun/server/
8. **Install Production Dependencies** — npm install in deploy path
9. **Restart PM2** — Reload the application
10. **Health Check** — Verify /api/health returns 200

---

## Rollback

Backups are kept in `/var/www/backups/`. To rollback:

```bash
# List available backups
ls -la /var/www/backups/

# Rollback frontend
cp -r /var/www/backups/frontend-YYYYMMDD-HHMMSS/* /var/www/businessrun/

# Rollback backend
cp -r /var/www/backups/backend-YYYYMMDD-HHMMSS/* /var/www/businessrun/server/

# Restart PM2
pm2 reload businessrun-api
```

---

## Security Notes

1. **Never commit `.env` to git** — it contains secrets
2. **Use GitHub Secrets** for sensitive Jenkins credentials
3. **Restrict Jenkins access** — use authentication, firewall rules
4. **Enable HTTPS** on Jenkins if exposed to internet
5. **Rotate credentials** periodically (JWT_SECRET, API keys)
