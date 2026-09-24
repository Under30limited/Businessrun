/**
 * ecosystem.config.js — PM2 Configuration for BusinessRun API
 *
 * Production deployment:
 *   pm2 start ecosystem.config.js --env production
 *
 * Development:
 *   pm2 start ecosystem.config.js
 *
 * Reload after code changes:
 *   pm2 reload businessrun-api --update-env
 */

require('dotenv').config({ path: '/var/www/businessrun/server/.env' });

module.exports = {
  apps: [{
    name: 'businessrun-api',
    script: '/var/www/businessrun/server/index.js',
    cwd: '/var/www/businessrun/server',

    // ── Process settings ─────────────────────────────────────────
    instances: 1,                    // Single instance (scale if needed)
    exec_mode: 'fork',               // Use 'cluster' for multi-core
    autorestart: true,               // Restart on crash
    watch: false,                    // Don't watch in production
    max_memory_restart: '500M',      // Restart if memory exceeds 500MB

    // ── Logging ──────────────────────────────────────────────────
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    error_file: '/var/www/businessrun/server/logs/error.log',
    out_file: '/var/www/businessrun/server/logs/out.log',
    merge_logs: true,

    // ── Development environment ──────────────────────────────────
    env: {
      NODE_ENV: 'development',
      PORT: process.env.PORT || 5000,
    },

    // ── Production environment ───────────────────────────────────
    env_production: {
      NODE_ENV: 'production',
      PORT: process.env.PORT || 5000,

      // ── AI Provider Selection ──────────────────────────────────
      GEMINI_PROVIDER: process.env.GEMINI_PROVIDER,
      GEMINI_API_KEY: process.env.GEMINI_API_KEY,
      GEMINI_MODEL: process.env.GEMINI_MODEL,

      // Vertex AI
      VERTEX_PROJECT_ID: process.env.VERTEX_PROJECT_ID,
      VERTEX_LOCATION: process.env.VERTEX_LOCATION,
      VERTEX_MODEL: process.env.VERTEX_MODEL,
      GOOGLE_APPLICATION_CREDENTIALS: process.env.GOOGLE_APPLICATION_CREDENTIALS,

      // AWS
      AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
      AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,
      AWS_REGION: process.env.AWS_REGION,
      AWS_S3_BUCKET: process.env.AWS_S3_BUCKET,
      BEDROCK_MODEL_ID: process.env.BEDROCK_MODEL_ID,

      // ── Email ───────────────────────────────────────────────────
      RESEND_API_KEY: process.env.RESEND_API_KEY,
      EMAIL_FROM: process.env.EMAIL_FROM,
      CONTACT_NOTIFICATION_EMAIL: process.env.CONTACT_NOTIFICATION_EMAIL,

      // ── Auth / App ──────────────────────────────────────────────
      JWT_SECRET: process.env.JWT_SECRET,
      FRONTEND_URL: process.env.FRONTEND_URL,
      APP_URL: process.env.APP_URL,
      COOKIE_DOMAIN: process.env.COOKIE_DOMAIN,

      // ── Payments ────────────────────────────────────────────────
      PAYSTACK_SECRET_KEY: process.env.PAYSTACK_SECRET_KEY,
    }
  }]
};
