/**
 * Jenkinsfile — BusinessRun CI/CD Pipeline
 *
 * Triggers on push to main branch (via GitHub webhook).
 *
 * Pipeline stages:
 *   1. Checkout      — pull latest code from GitHub
 *   2. Install Deps  — npm install for both frontend and backend
 *   3. Build Frontend— npm run build (creates production build)
 *   4. Deploy        — copy files to /var/www/businessrun, restart PM2
 *
 * Prerequisites on Jenkins server:
 *   - Node.js installed (v18+ recommended)
 *   - PM2 installed globally: npm install -g pm2
 *   - Jenkins user has write access to /var/www/businessrun
 *   - GitHub webhook configured to trigger this pipeline
 *
 * Environment variables required in Jenkins:
 *   - DEPLOY_PATH: /var/www/businessrun (or set as default below)
 */

pipeline {
    agent any

    environment {
        /// Standard global path configuration
        PATH = "/usr/local/bin:/usr/bin:/bin:$PATH"

	// Deployment paths
        DEPLOY_PATH = '/var/www/businessrun'
        BACKEND_PATH = '/var/www/businessrun/server'

        // Node.js settings
        NODE_ENV = 'production'

        // Prevent npm from prompting for input
        CI = 'true'
    }

    options {
        // Keep only last 10 builds to save disk space
        buildDiscarder(logRotator(numToKeepStr: '10'))

        // Timeout after 15 minutes
        timeout(time: 15, unit: 'MINUTES')

        // Don't run concurrent builds
        disableConcurrentBuilds()
    }

    stages {
        stage('Checkout') {
            steps {
                echo '=== Pulling latest code from GitHub ==='
                checkout scm
            }
        }

        stage('Install Frontend Dependencies') {
            steps {
                echo '=== Installing frontend dependencies ==='
                dir('frontend') {
                    sh 'npm ci --prefer-offline || npm install'
                }
            }
        }

        stage('Build Frontend') {
            steps {
                echo '=== Building frontend for production ==='
                dir('frontend') {
                    sh 'npm run build'
                }
            }
        }

        stage('Install Backend Dependencies') {
            steps {
                echo '=== Installing backend dependencies ==='
                dir('backend') {
                    sh 'npm ci --prefer-offline || npm install --production'
                }
            }
        }

        stage('Syntax Check Backend') {
            steps {
                echo '=== Verifying backend JavaScript syntax ==='
                dir('backend') {
                    sh '''
                        for f in *.js config/*.js controllers/*.js middleware/*.js routes/*.js services/*.js utils/*.js; do
                            if [ -f "$f" ]; then
                                node --check "$f" || exit 1
                            fi
                        done
                        echo "All backend files passed syntax check"
                    '''
                }
            }
        }

        stage('Deploy Frontend') {
            steps {
                echo '=== Deploying frontend to production ==='
                sh '''
                    # Backup current frontend (keep last 2 backups)
                    if [ -d "${DEPLOY_PATH}/static" ]; then
                        BACKUP_DIR="${DEPLOY_PATH}/../backups/frontend-$(date +%Y%m%d-%H%M%S)"
                        mkdir -p "${DEPLOY_PATH}/../backups"
                        cp -r "${DEPLOY_PATH}/static" "$BACKUP_DIR" 2>/dev/null || true

                        # Keep only last 2 backups
                        ls -dt ${DEPLOY_PATH}/../backups/frontend-* 2>/dev/null | tail -n +3 | xargs rm -rf 2>/dev/null || true
                    fi

                    # Deploy new frontend build
                    rm -rf ${DEPLOY_PATH}/static ${DEPLOY_PATH}/index.html ${DEPLOY_PATH}/asset-manifest.json 2>/dev/null || true
                    cp -r frontend/build/* ${DEPLOY_PATH}/

                    echo "Frontend deployed successfully"
                '''
            }
        }

        stage('Deploy Backend') {
            steps {
                echo '=== Deploying backend to production ==='
                sh '''
                    # Backup current backend (keep last 2 backups)
                    if [ -d "${BACKEND_PATH}" ]; then
                        BACKUP_DIR="${DEPLOY_PATH}/../backups/backend-$(date +%Y%m%d-%H%M%S)"
                        mkdir -p "${DEPLOY_PATH}/../backups"

                        # Backup only code, not node_modules
                        mkdir -p "$BACKUP_DIR"
                        cp -r ${BACKEND_PATH}/*.js ${BACKEND_PATH}/config ${BACKEND_PATH}/controllers \
                              ${BACKEND_PATH}/middleware ${BACKEND_PATH}/routes ${BACKEND_PATH}/services \
                              ${BACKEND_PATH}/utils "$BACKUP_DIR/" 2>/dev/null || true

                        # Keep only last 2 backups
                        ls -dt ${DEPLOY_PATH}/../backups/backend-* 2>/dev/null | tail -n +3 | xargs rm -rf 2>/dev/null || true
                    fi

                    # Deploy new backend code (preserve node_modules and .env)
                    rsync -av --delete \
                        --exclude 'node_modules' \
                        --exclude '.env' \
                        --exclude '*.log' \
                        --exclude 'package-lock.json' \
                        backend/ ${BACKEND_PATH}/

                    echo "Backend deployed successfully"
                '''
            }
        }

        stage('Install Production Dependencies') {
            steps {
                echo '=== Installing/updating backend production dependencies ==='
                sh '''
                    cd ${BACKEND_PATH}
                    npm install --production --prefer-offline || npm install --production
                '''
            }
        }

        stage('Restart PM2') {
            steps {
                echo '=== Restarting PM2 processes ==='
                sh '''
                    cd ${BACKEND_PATH}

                    # Check if PM2 process exists
                    if pm2 describe businessrun-api > /dev/null 2>&1; then
                        pm2 reload businessrun-api --update-env
                    else
                        # Start if not running (uses ecosystem.config.js)
                        pm2 start ecosystem.config.js --env production
                    fi

                    # Save PM2 process list
                    pm2 save

                    # Show status
                    pm2 status
                '''
            }
        }

        stage('Health Check') {
            steps {
                echo '=== Verifying deployment ==='
                sh '''
                    # Wait for server to start
                    sleep 5

                    # Check health endpoint
                    HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:5000/api/health || echo "000")

                    if [ "$HTTP_STATUS" = "200" ]; then
                        echo "Health check passed! Server is running."
                    else
                        echo "WARNING: Health check returned status $HTTP_STATUS"
                        echo "Check PM2 logs: pm2 logs businessrun-api"
                        # Don't fail the build, just warn
                    fi
                '''
            }
        }
    }

    post {
        success {
            echo '=== Deployment completed successfully! ==='
        }
        failure {
            echo '=== Deployment failed! ==='
            sh '''
                echo "Checking PM2 logs for errors..."
                pm2 logs businessrun-api --lines 50 --nostream || true
            '''
        }
        always {
            // Clean up workspace to save disk space
            cleanWs(cleanWhenNotBuilt: false,
                    deleteDirs: true,
                    disableDeferredWipeout: true,
                    notFailBuild: true)
        }
    }
}
