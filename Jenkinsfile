/**
 * Jenkinsfile — BusinessRun CI/CD Pipeline (Lightweight)
 */

pipeline {
    agent any

    environment {
        DEPLOY_PATH = '/var/www/businessrun'
        BACKEND_PATH = '/var/www/businessrun/server'
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
        failure {
            sh 'pm2 logs businessrun-api --lines 30 --nostream || true'
        }
        always {
            cleanWs(notFailBuild: true)
        }
    }
}
