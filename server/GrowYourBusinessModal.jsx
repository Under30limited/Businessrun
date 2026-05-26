import React, { useState, useEffect, useRef } from 'react';
import {
  X, ArrowRight, ArrowLeft, Loader2, AlertCircle,
  Zap, Users, TrendingUp, Eye, EyeOff, LogIn, UserPlus,
  KeyRound, CheckCircle,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
// Password reset handled via OTP — no Firebase client SDK needed

// ── API endpoint (Express → Firestore) ───────────────────────
const GYB_ENDPOINT = '/api/gyb';

// ── Session ID helper ─────────────────────────────────────────
function genSessionId() {
  return 'gyb-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
}

// ── Step metadata (shown in progress bar — auth gate is step 0) ──
const STEPS = [
  { label: 'The Basics'     },
  { label: 'Business Pulse' },
  { label: 'Trust & Match'  },
  { label: 'Secure Account' },
];

const STAGES = [
  { value: 'Ideation',    label: 'Ideation',     sub: '0 months'    },
  { value: 'Launch',      label: 'Launch Phase', sub: '1–12 months' },
  { value: 'Scaling',     label: 'Scaling',      sub: '1–3 years'   },
  { value: 'Established', label: 'Established',  sub: '3+ years'    },
];

const CHANNELS = [
  { value: 'Social Media',   label: 'Social Media',   sub: 'WhatsApp / Instagram'   },
  { value: 'Physical Store', label: 'Physical Store', sub: 'Walk-in Store or Office' },
  { value: 'E-commerce',     label: 'E-commerce',     sub: 'Online Website / Shop'   },
  { value: 'B2B',            label: 'B2B Sales',      sub: 'Business to Business'    },
  { value: 'Referrals',      label: 'Referrals',      sub: 'Word of Mouth / Network' },
];

const REVENUE = [
  { value: 'Under ₦500k',  label: 'Under ₦500k' },
  { value: '₦500k – ₦2M', label: '₦500k – ₦2M' },
  { value: '₦2M – ₦10M',  label: '₦2M – ₦10M'  },
  { value: 'Over ₦10M',    label: 'Over ₦10M'   },
];

const HEADACHES = [
  { value: 'Pricing for Profit',     label: 'Pricing for Profit'     },
  { value: 'Tracking Cashflow',      label: 'Tracking Cashflow'      },
  { value: 'Accessing Credit/Loans', label: 'Accessing Credit/Loans' },
  { value: 'Managing Staff/Payroll', label: 'Managing Staff/Payroll' },
];

// ─────────────────────────────────────────────────────────────
// GrowYourBusinessModal
// ─────────────────────────────────────────────────────────────
export default function GrowYourBusinessModal({ isOpen, onClose }) {
  const navigate   = useNavigate();
  const { login }  = useAuth();   // persist profile to global auth state + sessionStorage
  const sessionRef = useRef(genSessionId());
  const startedAt  = useRef(new Date().toLocaleString('en-NG', { timeZone: 'Africa/Lagos' }));

  // ── Gate mode: 'auth' | 'login' | 'signup' ───────────────
  // 'auth'   = the initial choice screen (Login or Sign Up)
  // 'login'  = existing user login form
  // 'signup' = new user → 4-step onboarding
  const [mode, setMode]         = useState('auth');
  const [step, setStep]         = useState(1);   // 1-4 for signup flow
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]       = useState('');

  // ── Login fields ──────────────────────────────────────────
  const [loginEmail,    setLoginEmail]    = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  // ── OTP reset state ─────────────────────────────────────────
  const [resetEmail,    setResetEmail]    = useState('');
  const [resetStep,     setResetStep]     = useState('request'); // 'request'|'verify'|'newpass'|'done'
  const [resetLoading,  setResetLoading]  = useState(false);
  const [otpCode,       setOtpCode]       = useState('');
  const [resetToken,    setResetToken]    = useState('');
  const [newPassword,   setNewPassword]   = useState('');
  const [confirmPass,   setConfirmPass]   = useState('');
  const [showNewPass,   setShowNewPass]   = useState(false);
  const [showLoginPw,   setShowLoginPw]   = useState(false);

  // ── Step 1 fields ─────────────────────────────────────────
  const [fullName,     setFullName]     = useState('');
  const [businessName, setBusinessName] = useState('');
  const [email,        setEmail]        = useState('');

  // ── Step 2 fields ─────────────────────────────────────────
  const [stage,        setStage]        = useState('');
  const [salesChannels, setSalesChannels] = useState([]); // multi-select array
  const [revenue,      setRevenue]      = useState('');
  const [headache,     setHeadache]     = useState('');

  // ── Step 3 fields ─────────────────────────────────────────
  const [matchmaking,  setMatchmaking]  = useState('');

  // ── Step 4 — password ─────────────────────────────────────
  const [password,     setPassword]     = useState('');
  const [confirm,      setConfirm]      = useState('');
  const [showPw,       setShowPw]       = useState(false);

  // ── Scroll lock ───────────────────────────────────────────
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  // ── Escape key ────────────────────────────────────────────
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') handleClose(); }
    if (isOpen) document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen]);

  // ── Full reset on close ───────────────────────────────────
  function handleClose() {
    setMode('auth'); setStep(1); setError('');
    setLoginEmail(''); setLoginPassword('');
    setFullName(''); setBusinessName(''); setEmail('');
    setStage(''); setSalesChannels([]); setRevenue(''); setHeadache('');
    setMatchmaking(''); setPassword(''); setConfirm('');
    sessionRef.current = genSessionId();
    onClose();
  }

  // ── Save step to backend ──────────────────────────────────
  async function saveStep(payload) {
    try {
      await fetch(GYB_ENDPOINT, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      });
    } catch {
      // Silent — don't block user if save fails
    }
  }

  // ─────────────────────────────────────────────────────────
  // LOGIN handler
  // ─────────────────────────────────────────────────────────
  async function handleLogin() {
    if (!loginEmail.trim() || !/\S+@\S+\.\S+/.test(loginEmail)) {
      setError('Please enter a valid email.'); return;
    }
    if (!loginPassword) { setError('Please enter your password.'); return; }
    setError(''); setSubmitting(true);
    try {
      const res  = await fetch('/api/auth/login', {
        method:      'POST',
        credentials: 'include',   // receive the JWT cookie the server sets
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email: loginEmail, password: loginPassword }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.message || 'Invalid email or password.'); return;
      }
      // Persist the profile to global auth state + sessionStorage,
      // then navigate. The profile is now available on refresh too.
      login(data.profile);
      handleClose();
      navigate('/your-roadmap', { state: { ...data.profile } });
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  // ── OTP Step 1: Request code ────────────────────────────────
  async function handleRequestOTP() {
    const emailVal = resetEmail.trim().toLowerCase();
    if (!emailVal || !/[^@]+@[^@]+\.[^@]+/.test(emailVal)) {
      setError('Please enter a valid email address.');
      return;
    }
    setError('');
    setResetLoading(true);
    try {
      const res  = await fetch('/api/auth/otp/request', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email: emailVal }),
      });
      const data = await res.json();

      // Email not registered — show message with signup link
      if (res.status === 404 && data.notFound) {
        setResetStep('not_found');
        return;
      }

      if (!res.ok) { setError(data.message || "Couldn't send code. Please try again."); return; }
      setResetStep('verify');
    } catch {
      setError("We couldn't reach the server. Please check your connection.");
    } finally {
      setResetLoading(false);
    }
  }

  // ── OTP Step 2: Verify code ──────────────────────────────────
  async function handleVerifyOTP() {
    if (!/^\d{6}$/.test(otpCode.trim())) {
      setError('Please enter the 6-digit code from your email.');
      return;
    }
    setError('');
    setResetLoading(true);
    try {
      const res  = await fetch('/api/auth/otp/verify', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email: resetEmail.trim().toLowerCase(), code: otpCode.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) { setError(data.message || 'Incorrect code. Please try again.'); return; }
      setResetToken(data.resetToken);
      setResetStep('newpass');
    } catch {
      setError("We couldn't reach the server. Please check your connection.");
    } finally {
      setResetLoading(false);
    }
  }

  // ── OTP Step 3: Set new password ─────────────────────────────
  async function handleSetPassword() {
    if (newPassword.length < 6)          { setError('Password must be at least 6 characters.');  return; }
    if (newPassword !== confirmPass)      { setError('Passwords do not match.');                   return; }
    setError('');
    setResetLoading(true);
    try {
      const res  = await fetch('/api/auth/otp/reset', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          email:       resetEmail.trim().toLowerCase(),
          resetToken,
          newPassword,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) { setError(data.message || "Couldn't update password. Please try again."); return; }
      setResetStep('done');
    } catch {
      setError("We couldn't reach the server. Please check your connection.");
    } finally {
      setResetLoading(false);
    }
  }

  // ── Reset the entire OTP flow ────────────────────────────────
  function resetOTPFlow() {
    setResetStep('request');
    setResetEmail('');
    setOtpCode('');
    setResetToken('');
    setNewPassword('');
    setConfirmPass('');
    setShowNewPass(false);
    setError('');
  }

  // ─────────────────────────────────────────────────────────
  // SIGNUP — Step handlers
  // ─────────────────────────────────────────────────────────
  async function handleStep1Next() {
    if (!fullName.trim())     { setError('Please enter your full name.');     return; }
    if (!businessName.trim()) { setError('Please enter your business name.');  return; }
    if (!email.trim() || !/\S+@\S+\.\S+/.test(email)) {
      setError('Please enter a valid work email.'); return;
    }

    setError('');
    setSubmitting(true);

    // ── Email existence check ──────────────────────────────────
    // Check server-side whether the email is already in Firestore.
    // We check the `completed` flag to decide what to do:
    //
    //   completed === true  → fully registered → block, prompt to log in
    //   completed === false → started but never finished → allow silently
    //                         (user is resuming their incomplete signup)
    //   not found           → allow, fresh signup
    //
    // On any network failure we allow progression rather than blocking —
    // the backend catches duplicates at Step 4 as a safety net.
    try {
      const checkRes  = await fetch('/api/auth/check-email', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const checkData = await checkRes.json();

      if (checkData.exists && checkData.completed) {
        // Fully registered — block and prompt to log in
        setError('__EMAIL_EXISTS__');
        setSubmitting(false);
        return;
      }
      // exists but completed === false → incomplete reg → fall through silently
      // not found at all              → fall through silently
    } catch {
      // Network error — allow progression silently
    }

    await saveStep({
      step: 1, sessionId: sessionRef.current,
      fullName, businessName, email,
      startedAt: startedAt.current, source: 'businessrun-gyb',
    });
    setSubmitting(false);
    setStep(2);
  }

  async function handleStep2Next() {
    if (!stage)        { setError('Please select your business stage.');  return; }
    if (salesChannels.length === 0) { setError('Please select at least one sales channel.'); return; }
    if (!revenue)      { setError('Please select a revenue bracket.');    return; }
    if (!headache)     { setError('Please select your biggest headache.'); return; }
    setError(''); setSubmitting(true);
    await saveStep({
      step: 2, sessionId: sessionRef.current,
      stage, salesChannel: salesChannels.join(', '), revenue, headache,
    });
    setSubmitting(false);
    setStep(3);
  }

  async function handleStep3Submit(choice) {
    setMatchmaking(choice);
    setSubmitting(true);
    await saveStep({
      step: 3, sessionId: sessionRef.current,
      matchmaking: choice,
      completedAt: new Date().toLocaleString('en-NG', { timeZone: 'Africa/Lagos' }),
    });
    setSubmitting(false);
    setStep(4); // → password step
  }

  async function handleStep4Submit() {
    if (password.length < 6)  { setError('Password must be at least 6 characters.'); return; }
    if (password !== confirm)  { setError('Passwords do not match.');                  return; }
    setError('');
    setSubmitting(true);
    try {
      // Password is sent as plain text over HTTPS — the server hashes it with bcrypt.
      // Previous approach (hashing in the browser) was a security anti-pattern:
      // the hash itself became the secret, making it replayable if intercepted.
      const res = await fetch(GYB_ENDPOINT, {
        method:      'POST',
        credentials: 'include',   // receive the JWT cookie the server sets
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          step:           4,
          sessionId:      sessionRef.current,
          email,
          password,          // plain text — hashed server-side by bcrypt
          fullName,
          businessName,
          stage,
          salesChannel,
          revenue,
          headache,
          matchmaking,
          profileSavedAt: new Date().toLocaleString('en-NG', { timeZone: 'Africa/Lagos' }),
          source:         'businessrun-gyb',
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.message || 'Could not create your account. Please try again.');
        return;
      }
      // The server set an HTTP-only JWT cookie in the same response.
      // Use the profile the server returned (authoritative) to hydrate
      // AuthContext React state — no localStorage/sessionStorage used.
      login(data.profile || {
        businessName, fullName, stage,
        salesChannel, revenue, headache, matchmaking, email,
      });
    } catch (err) {
      setError('Network error. Please check your connection and try again.');
      return;
    } finally {
      setSubmitting(false);
    }
    // Navigate only after confirmed server success
    handleClose();
    navigate('/your-roadmap', {
      state: { businessName, fullName, stage, salesChannel: salesChannels.join(', '), revenue, headache, matchmaking },
    });
  }

  if (!isOpen) return null;

  const inputClass = 'w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500 transition-colors';
  const labelClass = 'block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2';

  // ── Header title logic ────────────────────────────────────
  const headerTitle = () => {
    if (mode === 'auth')  return 'Grow Your Business';
    if (mode === 'login') return 'Welcome Back';
    if (mode === 'reset') return 'Reset Password';
    return STEPS[step - 1]?.label ?? 'Almost There';
  };

  const headerSub = () => {
    if (mode === 'auth')  return 'BusinessRun · Get Started';
    if (mode === 'login') return 'BusinessRun · Login';
    if (mode === 'reset') return 'BusinessRun · Reset Password';
    return `BusinessRun · Step ${step} of 4`;
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }}
      onClick={handleClose}
    >
      <div
        className="bg-zinc-950 border border-zinc-800 w-full sm:rounded-[2rem] max-w-lg max-h-[95vh] overflow-y-auto shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* ── Modal header ─────────────────────────────────── */}
        <div className="sticky top-0 z-10 bg-zinc-950/95 backdrop-blur-md border-b border-zinc-900 px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-amber-500">
                {headerSub()}
              </p>
              <h2 className="text-white font-black text-lg uppercase italic tracking-tight mt-0.5">
                {headerTitle()}
              </h2>
            </div>
            <button
              onClick={handleClose}
              className="w-8 h-8 bg-zinc-800 hover:bg-zinc-700 rounded-full flex items-center justify-center text-zinc-400 hover:text-white transition-all"
            >
              <X size={15} />
            </button>
          </div>

          {/* Step progress bar — only shown in signup flow */}
          {mode === 'signup' && (
            <div className="flex gap-2">
              {STEPS.map((s, i) => (
                <div key={i} className="flex-1 flex flex-col gap-1.5">
                  <div className={`h-1 rounded-full transition-all duration-300 ${
                    i + 1 < step   ? 'bg-amber-500' :
                    i + 1 === step ? 'bg-amber-500/50' :
                                     'bg-zinc-800'
                  }`} />
                  <span className={`text-[8px] font-black uppercase tracking-widest hidden sm:block ${
                    i + 1 === step ? 'text-amber-500' : 'text-zinc-700'
                  }`}>{s.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="px-6 sm:px-8 py-8">

          {/* ══ AUTH GATE — Login or Sign Up choice ════════════ */}
          {mode === 'auth' && (
            <div className="space-y-4">
              <p className="text-zinc-400 text-sm leading-relaxed mb-6">
                Build your personalised Business OS — powered by AI, built for Nigerian founders.
              </p>

              {/* Sign up — primary */}
              <button
                onClick={() => { setMode('signup'); setError(''); }}
                className="w-full flex items-center justify-between px-6 py-5 bg-amber-500 text-black rounded-2xl hover:bg-amber-400 transition-all group"
              >
                <div className="text-left">
                  <p className="text-xs font-black uppercase tracking-widest">New here? Sign Up</p>
                  <p className="text-[10px] text-black/60 mt-0.5">Create your Business OS in 3 minutes</p>
                </div>
                <UserPlus size={20} className="shrink-0 group-hover:scale-110 transition-transform" />
              </button>

              {/* Login — secondary */}
              <button
                onClick={() => { setMode('login'); setError(''); }}
                className="w-full flex items-center justify-between px-6 py-5 bg-zinc-900 border border-zinc-800 text-zinc-300 rounded-2xl hover:border-zinc-700 hover:text-white transition-all group"
              >
                <div className="text-left">
                  <p className="text-xs font-black uppercase tracking-widest">Already have an account? Log In</p>
                  <p className="text-[10px] text-zinc-600 mt-0.5">Return to your saved roadmap</p>
                </div>
                <LogIn size={18} className="shrink-0 text-zinc-600 group-hover:text-zinc-300 transition" />
              </button>

              <p className="text-[10px] text-zinc-700 text-center uppercase tracking-widest pt-2">
                Free · Secure · No spam
              </p>
            </div>
          )}

          {/* ══ LOGIN ══════════════════════════════════════════ */}
          {mode === 'login' && (
            <div className="space-y-5">
              <p className="text-zinc-500 text-sm leading-relaxed mb-2">
                Enter your email and password to access your Business Roadmap.
              </p>

              <div>
                <label className={labelClass}>Work Email *</label>
                <input
                  type="email"
                  placeholder="you@yourbusiness.com"
                  value={loginEmail}
                  onChange={e => { setLoginEmail(e.target.value); setError(''); }}
                  className={inputClass}
                />
              </div>

              <div>
                <label className={labelClass}>Password *</label>
                <div className="relative">
                  <input
                    type={showLoginPw ? 'text' : 'password'}
                    placeholder="Your password"
                    value={loginPassword}
                    onChange={e => { setLoginPassword(e.target.value); setError(''); }}
                    className={inputClass + ' pr-11'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPw(p => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400 transition"
                  >
                    {showLoginPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Forgot password link */}
              <div className="text-right -mt-2">
                <button
                  type="button"
                  onClick={() => {
                    resetOTPFlow();
                    setResetEmail(loginEmail); // pre-fill with whatever they typed
                    setMode('reset');
                  }}
                  className="text-[10px] font-black uppercase tracking-widest text-zinc-600 hover:text-amber-500 transition"
                >
                  Forgot password?
                </button>
              </div>

              <button
                onClick={handleLogin}
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2 py-3.5 bg-amber-500 text-black font-black text-xs uppercase tracking-widest rounded-xl hover:bg-amber-400 transition active:scale-95 disabled:opacity-50"
              >
                {submitting
                  ? <><Loader2 size={14} className="animate-spin" /> Signing in...</>
                  : <><LogIn size={14} /> Log In</>
                }
              </button>

              <button
                onClick={() => { setMode('auth'); setError(''); }}
                className="w-full text-center text-[10px] font-black text-zinc-600 hover:text-zinc-400 uppercase tracking-widest transition pt-1"
              >
                ← Back
              </button>
            </div>
          )}

          {/* ── Reset password mode (OTP flow) ──────────────── */}
          {mode === 'reset' && (
            <div className="space-y-5">

              {/* Progress indicator — hidden on not_found and done */}
              {resetStep !== 'done' && resetStep !== 'not_found' && (
                <div className="flex items-center gap-2 mb-2">
                  {['request','verify','newpass'].map((s, i) => (
                    <div key={s} className="flex items-center gap-2">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black transition-all ${
                        resetStep === s ? 'bg-amber-500 text-black' :
                        ['request','verify','newpass'].indexOf(resetStep) > i ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
                        'bg-zinc-900 text-zinc-600 border border-zinc-800'
                      }`}>{i + 1}</div>
                      {i < 2 && <div className={`h-px w-6 transition-all ${['request','verify','newpass'].indexOf(resetStep) > i ? 'bg-amber-500/40' : 'bg-zinc-800'}`} />}
                    </div>
                  ))}
                  <span className="text-[10px] font-black uppercase tracking-widest text-zinc-600 ml-1">
                    {resetStep === 'request' ? 'Enter Email' : resetStep === 'verify' ? 'Enter Code' : 'New Password'}
                  </span>
                </div>
              )}

              {/* Step 1 — Email */}
              {resetStep === 'request' && (
                <>
                  <p className="text-zinc-500 text-sm leading-relaxed">
                    Enter the email linked to your account. We'll send a 6-digit code instantly.
                  </p>
                  <div>
                    <label className={labelClass}>Email Address *</label>
                    <input type="email" placeholder="you@yourbusiness.com"
                      value={resetEmail}
                      onChange={e => { setResetEmail(e.target.value); setError(''); }}
                      className={inputClass} autoFocus />
                  </div>
                  <button onClick={handleRequestOTP} disabled={resetLoading}
                    className="w-full flex items-center justify-center gap-2 py-3.5 bg-amber-500 text-black font-black text-xs uppercase tracking-widest rounded-xl hover:bg-amber-400 transition active:scale-95 disabled:opacity-50">
                    {resetLoading
                      ? <><Loader2 size={14} className="animate-spin" /> Sending Code...</>
                      : <><KeyRound size={14} /> Send Reset Code</>}
                  </button>
                  <button onClick={() => { setMode('login'); resetOTPFlow(); }}
                    className="w-full text-center text-[10px] font-black text-zinc-600 hover:text-zinc-400 uppercase tracking-widest transition pt-1">
                    ← Back to Login
                  </button>
                </>
              )}

              {/* Not found — email not registered */}
              {resetStep === 'not_found' && (
                <div className="flex flex-col items-center text-center py-4 space-y-5">
                  <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center">
                    <AlertCircle size={28} className="text-amber-500" />
                  </div>
                  <div>
                    <p className="text-white font-black text-base mb-2">Email Not Registered</p>
                    <p className="text-zinc-500 text-sm leading-relaxed">
                      We couldn't find an account linked to{' '}
                      <span className="text-zinc-200">{resetEmail}</span>.
                      Check the email or create a new account.
                    </p>
                  </div>
                  <div className="flex flex-col gap-3 w-full">
                    <button
                      onClick={() => {
                        setMode('auth');
                        resetOTPFlow();
                      }}
                      className="w-full flex items-center justify-center gap-2 py-3.5 bg-amber-500 text-black font-black text-xs uppercase tracking-widest rounded-xl hover:bg-amber-400 transition"
                    >
                      <UserPlus size={14} /> Create an Account
                    </button>
                    <button
                      onClick={() => { setResetStep('request'); setError(''); }}
                      className="w-full text-center text-[10px] font-black text-zinc-600 hover:text-zinc-400 uppercase tracking-widest transition py-2"
                    >
                      ← Try a Different Email
                    </button>
                  </div>
                </div>
              )}

              {/* Step 2 — OTP code */}
              {resetStep === 'verify' && (
                <>
                  <div className="px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-xl">
                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1">Code sent to</p>
                    <p className="text-sm text-zinc-200">{resetEmail}</p>
                  </div>
                  <p className="text-zinc-500 text-xs leading-relaxed">
                    Enter the 6-digit code from your email. It expires in 15 minutes. Check your spam folder if it doesn't arrive.
                  </p>
                  <div>
                    <label className={labelClass}>6-Digit Code *</label>
                    <input type="text" inputMode="numeric" maxLength={6}
                      placeholder="e.g. 483921"
                      value={otpCode}
                      onChange={e => { setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setError(''); }}
                      className={inputClass + ' text-center text-2xl font-black tracking-[0.4em]'}
                      autoFocus />
                  </div>
                  <button onClick={handleVerifyOTP} disabled={resetLoading || otpCode.length !== 6}
                    className="w-full flex items-center justify-center gap-2 py-3.5 bg-amber-500 text-black font-black text-xs uppercase tracking-widest rounded-xl hover:bg-amber-400 transition active:scale-95 disabled:opacity-50">
                    {resetLoading
                      ? <><Loader2 size={14} className="animate-spin" /> Verifying...</>
                      : <><CheckCircle size={14} /> Verify Code</>}
                  </button>
                  <button onClick={() => { setResetStep('request'); setOtpCode(''); setError(''); }}
                    className="w-full text-center text-[10px] font-black text-zinc-600 hover:text-zinc-400 uppercase tracking-widest transition pt-1">
                    ← Resend Code
                  </button>
                </>
              )}

              {/* Step 3 — New password */}
              {resetStep === 'newpass' && (
                <>
                  <p className="text-zinc-500 text-sm leading-relaxed">
                    Choose a strong new password for your account.
                  </p>
                  <div>
                    <label className={labelClass}>New Password *</label>
                    <div className="relative">
                      <input type={showNewPass ? 'text' : 'password'}
                        placeholder="Min. 6 characters"
                        value={newPassword}
                        onChange={e => { setNewPassword(e.target.value); setError(''); }}
                        className={inputClass + ' pr-12'} autoFocus />
                      <button type="button" onClick={() => setShowNewPass(p => !p)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition">
                        {showNewPass ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className={labelClass}>Confirm Password *</label>
                    <input type={showNewPass ? 'text' : 'password'}
                      placeholder="Repeat your password"
                      value={confirmPass}
                      onChange={e => { setConfirmPass(e.target.value); setError(''); }}
                      className={inputClass} />
                  </div>
                  <button onClick={handleSetPassword} disabled={resetLoading}
                    className="w-full flex items-center justify-center gap-2 py-3.5 bg-amber-500 text-black font-black text-xs uppercase tracking-widest rounded-xl hover:bg-amber-400 transition active:scale-95 disabled:opacity-50">
                    {resetLoading
                      ? <><Loader2 size={14} className="animate-spin" /> Updating...</>
                      : <><KeyRound size={14} /> Set New Password</>}
                  </button>
                </>
              )}

              {/* Step 4 — Done */}
              {resetStep === 'done' && (
                <div className="flex flex-col items-center text-center py-6 space-y-5">
                  <div className="w-16 h-16 rounded-2xl bg-green-500/10 border border-green-500/20 flex items-center justify-center">
                    <CheckCircle size={28} className="text-green-400" />
                  </div>
                  <div>
                    <p className="text-white font-black text-lg mb-2">Password Updated!</p>
                    <p className="text-zinc-500 text-sm leading-relaxed">
                      Your password has been changed successfully. You can now log in with your new password.
                    </p>
                  </div>
                  <button onClick={() => { setMode('login'); resetOTPFlow(); }}
                    className="flex items-center gap-2 px-8 py-3.5 bg-amber-500 text-black font-black text-xs uppercase tracking-widest rounded-xl hover:bg-amber-400 transition">
                    <LogIn size={13} /> Log In Now
                  </button>
                </div>
              )}

            </div>
          )}

          {/* ══ SIGNUP — Step 1: The Basics ════════════════════ */}
          {mode === 'signup' && step === 1 && (
            <div className="space-y-5">
              <p className="text-zinc-500 text-sm leading-relaxed mb-2">
                Let's start with who you are. This helps us personalise your Business OS.
              </p>

              <div>
                <label className={labelClass}>Full Name *</label>
                <input type="text" placeholder="e.g. Adaeze Okonkwo"
                  value={fullName} onChange={e => { setFullName(e.target.value); setError(''); }}
                  className={inputClass} />
              </div>

              <div>
                <label className={labelClass}>Business Name *</label>
                <input type="text" placeholder="e.g. Maxx Media Hub"
                  value={businessName} onChange={e => { setBusinessName(e.target.value); setError(''); }}
                  className={inputClass} />
              </div>

              <div>
                <label className={labelClass}>Work Email *</label>
                <input type="email" placeholder="you@yourbusiness.com"
                  value={email} onChange={e => { setEmail(e.target.value); setError(''); }}
                  className={inputClass} />
              </div>
            </div>
          )}

          {/* ══ SIGNUP — Step 2: Business Pulse ════════════════ */}
          {mode === 'signup' && step === 2 && (
            <div className="space-y-6">
              <p className="text-zinc-500 text-sm leading-relaxed">
                Tell us about <strong className="text-zinc-300">{businessName}</strong>. This builds your financial identity.
              </p>

              <div>
                <label className={labelClass}>How long has this business been running? *</label>
                <div className="grid grid-cols-2 gap-2">
                  {STAGES.map(s => (
                    <button key={s.value} onClick={() => { setStage(s.value); setError(''); }}
                      className={`p-3 rounded-xl border text-left transition-all ${
                        stage === s.value
                          ? 'bg-amber-500/10 border-amber-500/40 text-amber-500'
                          : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
                      }`}>
                      <p className="text-xs font-black">{s.label}</p>
                      <p className="text-[10px] opacity-60 mt-0.5">{s.sub}</p>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className={labelClass}>
                  Sales channels? * <span className="text-zinc-700 normal-case font-normal">select all that apply</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {CHANNELS.map(c => {
                    const selected = salesChannels.includes(c.value);
                    return (
                      <button key={c.value}
                        onClick={() => {
                          setError('');
                          setSalesChannels(prev =>
                            selected
                              ? prev.filter(v => v !== c.value)
                              : [...prev, c.value]
                          );
                        }}
                        className={`p-3 rounded-xl border text-left transition-all relative ${
                          selected
                            ? 'bg-amber-500/10 border-amber-500/40 text-amber-500'
                            : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
                        }`}>
                        {selected && (
                          <span className="absolute top-2 right-2 w-4 h-4 bg-amber-500 rounded-full flex items-center justify-center text-black text-[8px] font-black">✓</span>
                        )}
                        <p className="text-xs font-black">{c.label}</p>
                        <p className="text-[10px] opacity-60 mt-0.5">{c.sub}</p>
                      </button>
                    );
                  })}
                </div>
                {salesChannels.length > 0 && (
                  <p className="text-[10px] font-black uppercase tracking-widest text-amber-500/70 mt-2">
                    {salesChannels.length} selected: {salesChannels.join(', ')}
                  </p>
                )}
              </div>

              <div>
                <label className={labelClass}>Current monthly revenue bracket? *</label>
                <div className="grid grid-cols-2 gap-2">
                  {REVENUE.map(r => (
                    <button key={r.value} onClick={() => { setRevenue(r.value); setError(''); }}
                      className={`py-3 px-4 rounded-xl border text-xs font-black transition-all ${
                        revenue === r.value
                          ? 'bg-amber-500/10 border-amber-500/40 text-amber-500'
                          : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
                      }`}>
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className={labelClass}>Biggest operational headache today? *</label>
                <div className="grid grid-cols-1 gap-2">
                  {HEADACHES.map(h => (
                    <button key={h.value} onClick={() => { setHeadache(h.value); setError(''); }}
                      className={`py-3 px-4 rounded-xl border text-xs font-black text-left transition-all ${
                        headache === h.value
                          ? 'bg-amber-500/10 border-amber-500/40 text-amber-500'
                          : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700 hover:text-zinc-200'
                      }`}>
                      {h.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ══ SIGNUP — Step 3: Trust & Matchmaking ═══════════ */}
          {mode === 'signup' && step === 3 && (
            <div className="space-y-6">
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl px-5 py-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1">Setting up</p>
                <p className="text-white font-black">{businessName}</p>
                <p className="text-zinc-500 text-xs">{stage} · {salesChannels.join(', ')} · {revenue}</p>
              </div>

              <div>
                <p className="text-white font-black text-base mb-2">Strategic Matchmaking</p>
                <p className="text-zinc-400 text-sm leading-relaxed mb-5">
                  Would you like BusinessRun to use your business profile to suggest verified partners
                  — Fintechs, Logistics providers, or Lenders — that fit your specific growth stage?
                  <strong className="text-zinc-200"> No raw data is ever shared with third parties.</strong>
                </p>

                <div className="space-y-3">
                  <button
                    onClick={() => handleStep3Submit('Yes, help me scale')}
                    disabled={submitting}
                    className="w-full flex items-center justify-between px-5 py-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl hover:bg-amber-500/20 transition-all group disabled:opacity-50"
                  >
                    <div className="text-left">
                      <p className="text-xs font-black text-amber-500 uppercase tracking-widest">Yes, help me scale</p>
                      <p className="text-[10px] text-zinc-500 mt-0.5">Opt in to verified partner suggestions</p>
                    </div>
                    {submitting
                      ? <Loader2 size={16} className="text-amber-500 animate-spin" />
                      : <ArrowRight size={16} className="text-amber-500 group-hover:translate-x-1 transition-transform" />
                    }
                  </button>

                  <button
                    onClick={() => handleStep3Submit("No, I'll manage on my own")}
                    disabled={submitting}
                    className="w-full flex items-center justify-between px-5 py-4 bg-zinc-900 border border-zinc-800 rounded-2xl hover:border-zinc-700 transition-all group disabled:opacity-50"
                  >
                    <div className="text-left">
                      <p className="text-xs font-black text-zinc-400 uppercase tracking-widest">No, I'll manage on my own</p>
                      <p className="text-[10px] text-zinc-600 mt-0.5">Skip partner suggestions</p>
                    </div>
                    <ArrowRight size={16} className="text-zinc-600 group-hover:translate-x-1 transition-transform" />
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ══ SIGNUP — Step 4: Create Password ═══════════════ */}
          {mode === 'signup' && step === 4 && (
            <div className="space-y-5">
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl px-5 py-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1">Almost done</p>
                <p className="text-white font-black">{businessName}</p>
                <p className="text-zinc-500 text-xs">{email}</p>
              </div>

              <p className="text-zinc-400 text-sm leading-relaxed">
                Set a password so you can return to your Business Roadmap any time. This secures your profile.
              </p>

              <div>
                <label className={labelClass}>Password *</label>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'}
                    placeholder="Min. 6 characters"
                    value={password}
                    onChange={e => { setPassword(e.target.value); setError(''); }}
                    className={inputClass + ' pr-11'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(p => !p)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400 transition"
                  >
                    {showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div>
                <label className={labelClass}>Confirm Password *</label>
                <input
                  type={showPw ? 'text' : 'password'}
                  placeholder="Re-enter password"
                  value={confirm}
                  onChange={e => { setConfirm(e.target.value); setError(''); }}
                  className={inputClass}
                />
              </div>

              <p className="text-[10px] text-zinc-600 uppercase tracking-widest">
                Your password is stored securely · No spam, ever
              </p>
            </div>
          )}

          {/* ── Error ────────────────────────────────────────── */}
          {error && error !== '__EMAIL_EXISTS__' && (
            <div className="flex items-center gap-2 mt-5 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl">
              <AlertCircle size={13} className="text-red-400 shrink-0" />
              <p className="text-red-400 text-xs">{error}</p>
            </div>
          )}

          {/* ── Email already registered — special prompt ─────── */}
          {error === '__EMAIL_EXISTS__' && (
            <div className="mt-5 px-4 py-4 bg-amber-500/5 border border-amber-500/20 rounded-xl space-y-2">
              <div className="flex items-center gap-2">
                <AlertCircle size={13} className="text-amber-500 shrink-0" />
                <p className="text-amber-500 text-xs font-black uppercase tracking-widest">Email Already Registered</p>
              </div>
              <p className="text-zinc-400 text-xs leading-relaxed">
                <span className="text-zinc-200">{email}</span> is already linked to a BusinessRun account.
              </p>
              <button
                onClick={() => {
                  setLoginEmail(email);
                  setMode('login');
                  setError('');
                }}
                className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-amber-500 hover:text-amber-400 transition mt-1"
              >
                <LogIn size={11} /> Log in to your account instead →
              </button>
            </div>
          )}

          {/* ── Navigation buttons ───────────────────────────── */}
          {mode === 'signup' && step < 3 && (
            <div className="flex gap-3 mt-8">
              {step > 1 && (
                <button
                  onClick={() => { setStep(s => s - 1); setError(''); }}
                  className="flex items-center gap-2 px-5 py-3 bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700 rounded-xl text-xs font-black uppercase tracking-widest transition"
                >
                  <ArrowLeft size={13} /> Back
                </button>
              )}
              <button
                onClick={step === 1 ? handleStep1Next : handleStep2Next}
                disabled={submitting}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-amber-500 text-black font-black text-xs uppercase tracking-widest rounded-xl hover:bg-amber-400 transition active:scale-95 disabled:opacity-50"
              >
                {submitting
                  ? <><Loader2 size={14} className="animate-spin" /> Saving...</>
                  : <>Next <ArrowRight size={14} /></>
                }
              </button>
            </div>
          )}

          {/* Step 4 — submit button */}
          {mode === 'signup' && step === 4 && (
            <div className="flex gap-3 mt-8">
              <button
                onClick={() => { setStep(3); setError(''); }}
                className="flex items-center gap-2 px-5 py-3 bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700 rounded-xl text-xs font-black uppercase tracking-widest transition"
              >
                <ArrowLeft size={13} /> Back
              </button>
              <button
                onClick={handleStep4Submit}
                disabled={submitting}
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-amber-500 text-black font-black text-xs uppercase tracking-widest rounded-xl hover:bg-amber-400 transition active:scale-95 disabled:opacity-50"
              >
                {submitting
                  ? <><Loader2 size={14} className="animate-spin" /> Securing...</>
                  : <>Go to My Roadmap <ArrowRight size={14} /></>
                }
              </button>
            </div>
          )}

          {mode === 'signup' && (
            <p className="text-[10px] text-zinc-700 text-center mt-4 uppercase tracking-widest">
              {step < 4 ? `Step ${step} of 4 · Your data is secure` : 'Almost there · Last step'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
