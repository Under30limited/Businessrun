/**
 * Jenkinsfile — BusinessRun CI/CD Pipeline
 *
 * Triggers: GitHub webhook on push to main branch
 * Deploys: Frontend to /var/www/businessrun/, Backend to /var/www/businessrun/server/
 * Backups: /var/www/businessrun/backups/ (keeps last 2 per component)
 *
 * ROLLBACK:
 *   # List available backups
 *   ls -lh /var/www/businessrun/backups/
 *
 *   # Restore backend
 *   cd /var/www/businessrun/server
 *   tar -xzf /var/www/businessrun/backups/backend-YYYYMMDD-HHMMSS.tar.gz
 *   pm2 reload businessrun-api
 *
 *   # Restore frontend
 *   cd /var/www/businessrun
 *   tar -xzf /var/www/businessrun/backups/frontend-YYYYMMDD-HHMMSS.tar.gz
 */

pipeline {
    agent any

    environment {
        DEPLOY_PATH = '/var/www/businessrun'
        BACKEND_PATH = '/var/www/businessrun/server'
        BACKUP_PATH = '/var/www/businessrun/backups'
    }

    options {
        buildDiscarder(logRotator(numToKeepStr: '5'))
        timeout(time: 10, unit: 'MINUTES')
        disableConcurrentBuilds()
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
                sh '''
                    echo "=========================================="
                    echo "Deploying commit: $(git rev-parse --short HEAD)"
                    echo "Branch: $(git rev-parse --abbrev-ref HEAD)"
                    echo "Message: $(git log -1 --pretty=%s)"
                    echo "=========================================="
                '''
            }
        }

        stage('Build Frontend') {
            steps {
                dir('codebase/frontend') {
                    sh 'npm ci --prefer-offline || npm install'
                    sh 'CI=false npm run build'
                }
            }
        }

        stage('Backup') {
            steps {
                sh '''
                    mkdir -p ${BACKUP_PATH} || true
                    TIMESTAMP=$(date +%Y%m%d-%H%M%S)

                    # Backup frontend (static folder only, ~small)
                    if [ -d "${DEPLOY_PATH}/static" ]; then
                        tar -czf "${BACKUP_PATH}/frontend-${TIMESTAMP}.tar.gz" \
                            -C ${DEPLOY_PATH} static index.html 2>/dev/null || true
                    fi

                    # Backup backend code (exclude node_modules/logs)
                    if [ -d "${BACKEND_PATH}" ]; then
                        tar -czf "${BACKUP_PATH}/backend-${TIMESTAMP}.tar.gz" \
                            --exclude='node_modules' --exclude='logs' --exclude='.env' \
                            -C ${BACKEND_PATH} . 2>/dev/null || true
                    fi

                    # Keep only last 2 backups per type
                    ls -t ${BACKUP_PATH}/frontend-*.tar.gz 2>/dev/null | tail -n +3 | xargs rm -f 2>/dev/null || true
                    ls -t ${BACKUP_PATH}/backend-*.tar.gz 2>/dev/null | tail -n +3 | xargs rm -f 2>/dev/null || true

                    echo "Backups created in ${BACKUP_PATH}"
                    ls -lh ${BACKUP_PATH}/*.tar.gz 2>/dev/null || echo "No backups yet"
                '''
            }
        }

        stage('Deploy Frontend') {
            steps {
                sh '''
                    rm -rf ${DEPLOY_PATH}/static ${DEPLOY_PATH}/index.html 2>/dev/null || true
                    cp -r codebase/frontend/build/* ${DEPLOY_PATH}/
                '''
            }
        }

        stage('Deploy Backend') {
            steps {
                sh '''
                    rsync -rlpD --delete --omit-dir-times \
                        --exclude 'node_modules' \
                        --exclude '.env' \
                        --exclude 'logs' \
                        --exclude 'test' \
                        --exclude 'backups' \
                        codebase/backend/ ${BACKEND_PATH}/ || [ $? -eq 23 ]
                '''
            }
        }

        stage('Install & Restart') {
            steps {
                sh '''
                    cd ${BACKEND_PATH}
                    npm install --production 2>/dev/null || npm install --omit=dev

                    if pm2 describe businessrun-api > /dev/null 2>&1; then
                        pm2 reload businessrun-api --update-env
                    else
                        pm2 start ecosystem.config.js --env production
                    fi
                    pm2 save
                '''
            }
        }

        stage('Health Check') {
            steps {
                sh '''
                    sleep 3
                    curl -sf http://localhost:5000/api/health && echo "Health OK" || echo "Health check failed (non-fatal)"
                '''
            }
        }
    }

    post {
        success {
            echo "✅ Deployment successful! Site is live at https://thebusinessrun.com"
        }
        failure {
            echo "❌ Deployment failed! Check logs below:"
            sh 'pm2 logs businessrun-api --lines 30 --nostream || true'
        }
        always {
            cleanWs(notFailBuild: true)
        }
    }
}
