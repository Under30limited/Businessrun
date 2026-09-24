/**
 * services/email.service.js
 *
 * Email delivery via Resend (https://resend.com).
 *
 * WHY RESEND:
 *   - 3,000 free emails/month, 100/day — enough for a growing product
 *   - Clean REST API — one fetch() call, no SDK required
 *   - Emails sent from your own domain land in inbox, not spam
 *   - Takes ~15 minutes to set up (domain verification + API key)
 *
 * ENVIRONMENT VARIABLES REQUIRED:
 *   RESEND_API_KEY             — from Resend dashboard → API Keys
 *   EMAIL_FROM                 — verified sender e.g. noreply@thebusinessrun.com
 *   CONTACT_NOTIFICATION_EMAIL — your team's inbox for contact-form
 *                                submissions (see sendContactSubmissionEmail)
 *
 * USAGE:
 *   const { sendOTPEmail, sendInviteEmail, sendContactSubmissionEmail } = require('../services/email.service');
 *   await sendOTPEmail({ to: 'user@example.com', code: '483921', name: 'Ada' });
 *   await sendInviteEmail({ to: 'member@example.com', ownerBusinessName: 'Ada Foods', inviteUrl, featureLabels: ['Sales', 'Inventory'] });
 *   await sendContactSubmissionEmail({ submissionId, source: 'business', category: 'bug', message, name, email, context });
 */

'use strict';

const RESEND_API_URL = 'https://api.resend.com/emails';

// ── Guard — fail loudly if config is missing ──────────────────────
function getConfig() {
  const apiKey  = process.env.RESEND_API_KEY;
  const from    = process.env.EMAIL_FROM || 'noreply@thebusinessrun.com';

  if (!apiKey) {
    throw new Error('[Email] RESEND_API_KEY is not set in .env');
  }

  return { apiKey, from };
}

// ── OTP email template ─────────────────────────────────────────────
function buildOTPEmail({ to, code, name }) {
  const firstName = (name || 'there').split(' ')[0];

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background:#0A0A0A;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0A0A0A;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="520" cellpadding="0" cellspacing="0" style="background:#111111;border:1px solid #222222;border-radius:16px;overflow:hidden;">

          <!-- Header -->
          <tr>
            <td style="padding:32px 40px 24px;border-bottom:1px solid #1A1A1A;">
              <p style="margin:0;font-size:13px;font-weight:900;letter-spacing:0.15em;text-transform:uppercase;color:#C5A028;">
                BUSINESSRUN
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:36px 40px;">
              <p style="margin:0 0 8px;font-size:22px;font-weight:900;color:#FFFFFF;letter-spacing:-0.03em;">
                Password Reset Code
              </p>
              <p style="margin:0 0 28px;font-size:14px;color:#71717A;line-height:1.6;">
                Hi ${firstName}, use the code below to reset your BusinessRun password.
                This code expires in <strong style="color:#A1A1AA;">15 minutes</strong>.
              </p>

              <!-- OTP Code -->
              <div style="background:#0A0A0A;border:1px solid #222222;border-radius:12px;padding:28px;text-align:center;margin-bottom:28px;">
                <p style="margin:0 0 8px;font-size:11px;font-weight:900;letter-spacing:0.15em;text-transform:uppercase;color:#52525B;">
                  Your Reset Code
                </p>
                <p style="margin:0;font-size:40px;font-weight:900;letter-spacing:0.2em;color:#C5A028;font-variant-numeric:tabular-nums;">
                  ${code}
                </p>
              </div>

              <p style="margin:0 0 8px;font-size:12px;color:#52525B;line-height:1.6;">
                If you didn't request this, you can safely ignore this email.
                Your password will not change.
              </p>
              <p style="margin:0;font-size:12px;color:#52525B;line-height:1.6;">
                For security: never share this code with anyone.
                BusinessRun will never ask for it.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 40px;border-top:1px solid #1A1A1A;">
              <p style="margin:0;font-size:11px;color:#3F3F46;">
                © ${new Date().getFullYear()} BusinessRun · thebusinessrun.com
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text =
    'BusinessRun Password Reset\n\n' +
    'Hi ' + firstName + ',\n\n' +
    'Your password reset code is: ' + code + '\n\n' +
    'This code expires in 15 minutes.\n\n' +
    'If you did not request this, please ignore this email.\n\n' +
    '© ' + new Date().getFullYear() + ' BusinessRun';

  return { to, subject: 'Your BusinessRun Reset Code: ' + code, html, text };
}

// ── sendOTPEmail ───────────────────────────────────────────────────
/**
 * Sends the OTP reset code to the user's email via Resend.
 *
 * @param {Object} opts
 * @param {string} opts.to    Recipient email
 * @param {string} opts.code  6-digit OTP code
 * @param {string} opts.name  User's full name (for personalisation)
 * @returns {Promise<void>}
 * @throws {Error} if Resend API returns an error
 */
async function sendOTPEmail({ to, code, name }) {
  const { apiKey, from } = getConfig();
  const email = buildOTPEmail({ to, code, name });

  let res;
  try {
    res = await fetch(RESEND_API_URL, {
      method:  'POST',
      headers: {
        'Authorization': 'Bearer ' + apiKey,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        from,
        to:      [to],
        subject: email.subject,
        html:    email.html,
        text:    email.text,
      }),
    });
  } catch (networkErr) {
    // fetch() itself threw — DNS failure, timeout, no internet
    throw new Error('[Email] Network error reaching Resend: ' + networkErr.message);
  }

  if (!res.ok) {
    let body = {};
    try { body = await res.json(); } catch { /* ignore parse failure */ }
    // Log full details server-side for debugging
    console.error('[Email] Resend API error:', {
      status:  res.status,
      message: body.message,
      name:    body.name,
      from,
      to,
    });
    throw new Error(
      '[Email] Resend rejected the request (' + res.status + '): ' +
      (body.message || 'Unknown error')
    );
  }
}

// ── Invite email template ──────────────────────────────────────────
function buildInviteEmail({ to, ownerBusinessName, inviteUrl, featureLabels }) {
  const businessName = ownerBusinessName || 'a business';
  const featureList   = (featureLabels || []).length
    ? featureLabels.join(', ')
    : 'selected features';

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background:#0A0A0A;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0A0A0A;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="520" cellpadding="0" cellspacing="0" style="background:#111111;border:1px solid #222222;border-radius:16px;overflow:hidden;">

          <!-- Header -->
          <tr>
            <td style="padding:32px 40px 24px;border-bottom:1px solid #1A1A1A;">
              <p style="margin:0;font-size:13px;font-weight:900;letter-spacing:0.15em;text-transform:uppercase;color:#C5A028;">
                BUSINESSRUN
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:36px 40px;">
              <p style="margin:0 0 8px;font-size:22px;font-weight:900;color:#FFFFFF;letter-spacing:-0.03em;">
                You've been invited to ${businessName}
              </p>
              <p style="margin:0 0 28px;font-size:14px;color:#71717A;line-height:1.6;">
                You've been given access to: <strong style="color:#A1A1AA;">${featureList}</strong>.
                Set your password to get started.
              </p>

              <!-- CTA -->
              <div style="text-align:center;margin-bottom:28px;">
                <a href="${inviteUrl}" style="display:inline-block;background:#C5A028;color:#0A0A0A;font-weight:900;font-size:14px;text-decoration:none;padding:16px 32px;border-radius:10px;">
                  Set Your Password
                </a>
              </div>

              <p style="margin:0 0 8px;font-size:12px;color:#52525B;line-height:1.6;">
                This invite link expires in 7 days.
              </p>
              <p style="margin:0;font-size:12px;color:#52525B;line-height:1.6;">
                If you weren't expecting this, you can safely ignore this email.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 40px;border-top:1px solid #1A1A1A;">
              <p style="margin:0;font-size:11px;color:#3F3F46;">
                © ${new Date().getFullYear()} BusinessRun · thebusinessrun.com
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text =
    `You've been invited to ${businessName} on BusinessRun\n\n` +
    `You've been given access to: ${featureList}.\n\n` +
    `Set your password here: ${inviteUrl}\n\n` +
    `This link expires in 7 days.\n\n` +
    `If you weren't expecting this, you can safely ignore this email.\n\n` +
    `© ${new Date().getFullYear()} BusinessRun`;

  return { to, subject: `You've been invited to ${businessName} on BusinessRun`, html, text };
}

// ── sendInviteEmail ─────────────────────────────────────────────────
/**
 * Sends a team-invite email with a link to set a password and join
 * the owner's business.
 *
 * @param {Object} opts
 * @param {string} opts.to                 Recipient email
 * @param {string} opts.ownerBusinessName  The inviting owner's business name
 * @param {string} opts.inviteUrl          Full link to the accept-invite page
 * @param {string[]} [opts.featureLabels]  Human-readable feature names granted
 * @returns {Promise<void>}
 * @throws {Error} if Resend API returns an error
 */
async function sendInviteEmail({ to, ownerBusinessName, inviteUrl, featureLabels }) {
  const { apiKey, from } = getConfig();
  const email = buildInviteEmail({ to, ownerBusinessName, inviteUrl, featureLabels });

  let res;
  try {
    res = await fetch(RESEND_API_URL, {
      method:  'POST',
      headers: {
        'Authorization': 'Bearer ' + apiKey,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        from,
        to:      [to],
        subject: email.subject,
        html:    email.html,
        text:    email.text,
      }),
    });
  } catch (networkErr) {
    throw new Error('[Email] Network error reaching Resend: ' + networkErr.message);
  }

  if (!res.ok) {
    let body = {};
    try { body = await res.json(); } catch { /* ignore parse failure */ }
    console.error('[Email] Resend API error:', {
      status:  res.status,
      message: body.message,
      name:    body.name,
      from,
      to,
    });
    throw new Error(
      '[Email] Resend rejected the request (' + res.status + '): ' +
      (body.message || 'Unknown error')
    );
  }
}

// ── Contact submission email template ──────────────────────────────
// Goes to YOUR team's inbox (not the submitter) — one email per
// submission, with everything a triager needs at a glance: which
// surface it came from, its category, the message, and — when the
// submitter was logged in — exactly who they are (see
// contact.controller.js for how that context is assembled).
const CATEGORY_LABELS = {
  complaint:  'Complaint',
  suggestion: 'Suggestion',
  bug:        'Bug Report',
  other:      'Other',
};

const SOURCE_LABELS = {
  home:     'Home Page (Public)',
  business: 'Business OS',
  personal: 'Personal Wealth OS',
};

function buildContactSubmissionEmail({ submissionId, source, category, message, name, email, context }) {
  const categoryLabel = CATEGORY_LABELS[category] || category;
  const sourceLabel   = SOURCE_LABELS[source] || source;

  // context is null for an anonymous home-page submission — only
  // rendered when the submitter was logged in (see
  // contact.controller.js's buildContext).
  const contextRows = context
    ? Object.entries(context)
        .filter(([, v]) => v !== null && v !== undefined && v !== '')
        .map(([k, v]) => `
              <tr>
                <td style="padding:4px 12px 4px 0;font-size:12px;color:#52525B;white-space:nowrap;">${k}</td>
                <td style="padding:4px 0;font-size:12px;color:#A1A1AA;">${v}</td>
              </tr>`).join('')
    : '';

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background:#0A0A0A;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0A0A0A;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#111111;border:1px solid #222222;border-radius:16px;overflow:hidden;">

          <!-- Header -->
          <tr>
            <td style="padding:32px 40px 24px;border-bottom:1px solid #1A1A1A;">
              <p style="margin:0;font-size:13px;font-weight:900;letter-spacing:0.15em;text-transform:uppercase;color:#C5A028;">
                BUSINESSRUN
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:36px 40px;">
              <p style="margin:0 0 4px;font-size:22px;font-weight:900;color:#FFFFFF;letter-spacing:-0.03em;">
                New ${categoryLabel}
              </p>
              <p style="margin:0 0 24px;font-size:13px;color:#71717A;">
                via ${sourceLabel} · ${new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
              </p>

              <!-- From -->
              <div style="background:#0A0A0A;border:1px solid #222222;border-radius:12px;padding:16px 20px;margin-bottom:20px;">
                <p style="margin:0 0 2px;font-size:11px;font-weight:900;letter-spacing:0.1em;text-transform:uppercase;color:#52525B;">From</p>
                <p style="margin:0;font-size:14px;color:#FFFFFF;font-weight:700;">${name}</p>
                <p style="margin:0;font-size:13px;color:#A1A1AA;">${email}</p>
              </div>

              <!-- Message -->
              <div style="background:#0A0A0A;border:1px solid #222222;border-radius:12px;padding:16px 20px;margin-bottom:${contextRows ? '20px' : '8px'};">
                <p style="margin:0 0 8px;font-size:11px;font-weight:900;letter-spacing:0.1em;text-transform:uppercase;color:#52525B;">Message</p>
                <p style="margin:0;font-size:14px;color:#E4E4E7;line-height:1.6;white-space:pre-wrap;">${message}</p>
              </div>

              ${contextRows ? `
              <!-- Account context (only present when logged in) -->
              <div style="background:#0A0A0A;border:1px solid #222222;border-radius:12px;padding:16px 20px;">
                <p style="margin:0 0 8px;font-size:11px;font-weight:900;letter-spacing:0.1em;text-transform:uppercase;color:#52525B;">Account Context</p>
                <table cellpadding="0" cellspacing="0">${contextRows}</table>
              </div>` : ''}

              <p style="margin:20px 0 0;font-size:11px;color:#3F3F46;">
                Submission ID: ${submissionId} · Reply directly to this email to respond to ${name.split(' ')[0]}.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text =
    `New ${categoryLabel} — via ${sourceLabel}\n\n` +
    `From: ${name} <${email}>\n\n` +
    `Message:\n${message}\n\n` +
    (context ? `Context:\n${Object.entries(context).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join('\n')}\n\n` : '') +
    `Submission ID: ${submissionId}\n` +
    `Reply directly to this email to respond to ${name.split(' ')[0]}.`;

  return {
    subject: `[${categoryLabel}] ${sourceLabel} — ${name}`,
    html,
    text,
  };
}

// ── sendContactSubmissionEmail ──────────────────────────────────────
/**
 * Notifies your team's inbox of a new contact-form submission —
 * fire-and-forget from the caller's perspective (see
 * contact.controller.js: the DB write is the source of truth: this
 * email failing should never fail the submission itself).
 *
 * @param {Object} opts
 * @param {string} opts.submissionId
 * @param {string} opts.source     'home' | 'business' | 'personal'
 * @param {string} opts.category   'complaint' | 'suggestion' | 'bug' | 'other'
 * @param {string} opts.message
 * @param {string} opts.name
 * @param {string} opts.email      Submitter's email (used as Reply-To)
 * @param {Object|null} [opts.context]  Logged-in account context, or null if anonymous
 * @returns {Promise<void>}
 * @throws {Error} if Resend API returns an error, or CONTACT_NOTIFICATION_EMAIL isn't set
 */
async function sendContactSubmissionEmail({ submissionId, source, category, message, name, email, context }) {
  const { apiKey, from } = getConfig();
  const notifyTo = process.env.CONTACT_NOTIFICATION_EMAIL;
  if (!notifyTo) {
    throw new Error('[Email] CONTACT_NOTIFICATION_EMAIL is not set in .env');
  }

  const built = buildContactSubmissionEmail({ submissionId, source, category, message, name, email, context });

  let res;
  try {
    res = await fetch(RESEND_API_URL, {
      method:   'POST',
      headers: {
        'Authorization': 'Bearer ' + apiKey,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        from,
        to:       [notifyTo],
        reply_to: email, // lets your team just hit "Reply" to respond directly to the submitter — no in-app messaging needed
        subject:  built.subject,
        html:     built.html,
        text:     built.text,
      }),
    });
  } catch (networkErr) {
    throw new Error('[Email] Network error reaching Resend: ' + networkErr.message);
  }

  if (!res.ok) {
    let body = {};
    try { body = await res.json(); } catch { /* ignore parse failure */ }
    console.error('[Email] Resend API error:', {
      status:  res.status,
      message: body.message,
      name:    body.name,
      from,
      to: notifyTo,
    });
    throw new Error(
      '[Email] Resend rejected the request (' + res.status + '): ' +
      (body.message || 'Unknown error')
    );
  }
}

module.exports = { sendOTPEmail, sendInviteEmail, sendContactSubmissionEmail };
