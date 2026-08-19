/**
 * AcceptInvitePage.jsx
 *
 * Public route: /accept-invite?identityUid=...&businessUid=...&token=...
 *
 * The link comes from the invite email (see services/email.service.js
 * sendInviteEmail on the backend).
 *
 * Two possible paths, both handled on this one page:
 *
 *   1. UNCLAIMED identity (first invite this person has ever accepted) —
 *      sets a password, which claims the identity, activates the
 *      membership, and logs them straight in.
 *
 *   2. ALREADY-CLAIMED identity (they have a real password from their
 *      own business, or a previously-accepted invite elsewhere) — the
 *      invite link alone isn't proof of ownership for an account that
 *      already has a password. The backend responds with
 *      `requiresLogin: true` instead of activating anything; this page
 *      then shows an embedded login form (email pre-filled from the
 *      response — safe, since it's the address the invite was sent
 *      to) and, once that login succeeds, automatically retries the
 *      SAME accept-invite call — no need to re-click the email link.
 */

import React, { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Lock, Loader2, AlertCircle, CheckCircle2, LogIn } from 'lucide-react';

const inputClass = 'w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-amber-500 transition-colors';
const BRAND = '#C5A028';

export default function AcceptInvitePage() {
  const [searchParams] = useSearchParams();
  const navigate         = useNavigate();
  const { login }         = useAuth();

  const identityUid = searchParams.get('identityUid') || '';
  const businessUid = searchParams.get('businessUid') || '';
  const token         = searchParams.get('token')       || '';

  const [password,        setPassword]        = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting,      setSubmitting]      = useState(false);
  const [error,           setError]           = useState('');

  // Set once the backend tells us this identity already has a password —
  // switches the page from "set a password" to "log in to continue".
  const [needsLogin,   setNeedsLogin]   = useState(false);
  const [loginEmail,   setLoginEmail]   = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  const linkLooksValid = Boolean(identityUid && businessUid && token);

  // Shared final step — call once accept-invite actually succeeds,
  // regardless of which path got us there. Takes the FULL response
  // body (not just .profile) so subscription/teamAccessBlocked are
  // in scope here — this used to reference an out-of-scope `data`
  // variable from the caller, which threw a ReferenceError on every
  // single successful accept-invite (caught below as a misleading
  // "Network error", even though the account was actually activated
  // correctly server-side).
  function finishWithProfile(responseBody) {
    login(responseBody.profile, { subscription: responseBody.subscription, teamAccessBlocked: responseBody.teamAccessBlocked });
    navigate('/your-roadmap', { replace: true });
  }

  // ── Path 1: unclaimed identity — set a password ────────────────
  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      const res  = await fetch('/api/team/accept-invite', {
        method:      'POST',
        credentials: 'include',
        headers:     { 'Content-Type': 'application/json' },
        body:        JSON.stringify({ identityUid, businessUid, token, password }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        if (data.requiresLogin) {
          // This identity already has a password — switch to the
          // login path instead of showing a dead-end error.
          setNeedsLogin(true);
          setLoginEmail(data.email || '');
          setError('');
          setSubmitting(false);
          return;
        }
        setError(data.message || 'This invite link is invalid or has expired.');
        setSubmitting(false);
        return;
      }

      finishWithProfile(data);
    } catch {
      setError('Network error. Please check your connection and try again.');
      setSubmitting(false);
    }
  }

  // ── Path 2: already-claimed identity — log in, then auto-resume ──
  async function handleLoginAndAccept(e) {
    e.preventDefault();
    setError('');

    if (!loginPassword) {
      setError('Please enter your password.');
      return;
    }

    setSubmitting(true);
    try {
      // Step 1: log in normally.
      const loginRes  = await fetch('/api/auth/login', {
        method:      'POST',
        credentials: 'include',
        headers:     { 'Content-Type': 'application/json' },
        body:        JSON.stringify({ email: loginEmail, password: loginPassword }),
      });
      const loginData = await loginRes.json();

      if (!loginRes.ok || !loginData.success) {
        setError('Invalid email or password. Please check and try again.');
        setSubmitting(false);
        return;
      }

      if (loginData.requiresBusinessSelection) {
        // Rare double-edge case: this identity also has more than one
        // OTHER active business already. Resolving that picker here
        // would duplicate a fair bit of UI — simplest correct thing
        // is to send them to the main login, where that picker
        // already exists, and let them come back to this link after.
        setError(
          'Your account has multiple businesses — please log in from the main login screen first, then reopen this invite link to accept it.'
        );
        setSubmitting(false);
        return;
      }

      // Step 2: now that the session cookie matches this identity,
      // retry the SAME accept-invite call — no password needed this
      // time, the backend recognises the logged-in identity directly.
      const acceptRes  = await fetch('/api/team/accept-invite', {
        method:      'POST',
        credentials: 'include',
        headers:     { 'Content-Type': 'application/json' },
        body:        JSON.stringify({ identityUid, businessUid, token }),
      });
      const acceptData = await acceptRes.json();

      if (!acceptRes.ok || !acceptData.success) {
        setError(acceptData.message || 'Could not accept this invite. Please try again.');
        setSubmitting(false);
        return;
      }

      finishWithProfile(acceptData);
    } catch {
      setError('Network error. Please check your connection and try again.');
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white border border-zinc-200 rounded-2xl shadow-2xl p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: BRAND + '15' }}>
            {needsLogin ? <LogIn size={17} style={{ color: BRAND }} /> : <Lock size={17} style={{ color: BRAND }} />}
          </div>
          <div>
            <h1 className="text-lg font-black uppercase tracking-tight text-zinc-900">
              {needsLogin ? 'Log In To Continue' : 'Set Your Password'}
            </h1>
            <p className="text-xs text-zinc-500">
              {needsLogin
                ? 'This email already has a BusinessRun account.'
                : "You've been invited to join a business on BusinessRun"}
            </p>
          </div>
        </div>

        {!linkLooksValid ? (
          <div className="flex items-start gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
            <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
            <span>This invite link is missing information. Please use the exact link from your invite email.</span>
          </div>
        ) : needsLogin ? (
          // ── Path 2 form: log in, then auto-resume the invite ────
          <form onSubmit={handleLoginAndAccept} className="space-y-4">
            <p className="text-zinc-500 text-sm leading-relaxed">
              Log in below and we'll finish accepting this invite automatically.
            </p>

            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">
                Email
              </label>
              <input
                type="email"
                value={loginEmail}
                onChange={e => setLoginEmail(e.target.value)}
                placeholder="you@yourbusiness.com"
                className={inputClass}
              />
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">
                Password
              </label>
              <input
                type="password"
                value={loginPassword}
                onChange={e => setLoginPassword(e.target.value)}
                placeholder="Your password"
                className={inputClass}
                autoFocus
              />
            </div>

            {error && (
              <div className="flex items-start gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600">
                <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-black font-black text-xs uppercase tracking-widest py-3.5 rounded-xl transition"
            >
              {submitting ? <Loader2 size={15} className="animate-spin" /> : <LogIn size={15} />}
              {submitting ? 'Logging In…' : 'Log In & Accept Invite'}
            </button>
          </form>
        ) : (
          // ── Path 1 form: unclaimed identity — set a password ────
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">
                New password
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                className={inputClass}
                autoFocus
              />
            </div>

            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">
                Confirm password
              </label>
              <input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Re-enter your password"
                className={inputClass}
              />
            </div>

            {error && (
              <div className="flex items-start gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600">
                <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-black font-black text-xs uppercase tracking-widest py-3.5 rounded-xl transition"
            >
              {submitting ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
              {submitting ? 'Activating…' : 'Activate My Account'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
