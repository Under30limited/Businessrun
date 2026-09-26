import React, { useState, useEffect, useRef } from 'react';
import {
  X, ArrowRight, ArrowLeft, Loader2, AlertCircle,
  Eye, EyeOff, LogIn, UserPlus, Sparkles, ShieldCheck, KeyRound, CheckCircle, Shield,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { CURRENCIES, CURRENCY_SYMBOLS, CURRENCY_LABELS } from '../utils/currency';
import PrivacyPolicyModal from './PrivacyPolicyModal';

const ONBOARDING_ENDPOINT = '/api/personal/onboarding';

function genSessionId() {
  return 'pwos-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
}

const STEPS = [
  { label: 'The Basics'      },
  { label: 'Financial Profile' },
  { label: 'Wealth Match'    },
  { label: 'Secure & Launch' },
];

const INCOME_SOURCES = [
  { value: 'Salary / 9-to-5 Job',                  label: 'Salary / 9-to-5 Job' },
  { value: 'Business Owner / Founder',             label: 'Business Owner / Founder' },
  { value: 'Freelance / Creator',                  label: 'Freelance / Creator' },
  { value: 'Investments & Multiple Streams',       label: 'Investments & Multiple Streams' },
];

const ASSET_LOCATIONS = [
  { value: 'Local Naira Bank Accounts',      label: 'Local Naira Bank Accounts' },
  { value: 'USD / FX Domiciliary Accounts',  label: 'USD / FX Domiciliary Accounts' },
  { value: 'Real Estate & Fixed Assets',     label: 'Real Estate & Fixed Assets' },
  { value: 'Crypto & Foreign Stocks',        label: 'Crypto & Foreign Stocks' },
  { value: 'Mutual Funds / Treasury Bills',  label: 'Mutual Funds / Treasury Bills' },
];

const INCOME_BRACKETS = [
  { value: 'Under ₦200k',   label: 'Under ₦200k' },
  { value: '₦200k – ₦2M',  label: '₦200k – ₦2M' },
  { value: '₦2M – ₦10M',   label: '₦2M – ₦10M' },
  { value: 'Over ₦10M',     label: 'Over ₦10M' },
];

const FINANCIAL_HEADACHES = [
  { value: 'Tracking Daily Leakages & Spending',                   label: 'Tracking Daily Leakages & Spending' },
  { value: 'Separating Personal Money from Business Capital',      label: 'Separating Personal Money from Business Capital' },
  { value: 'Hedging Against Inflation & Devaluation (FX)',         label: 'Hedging Against Inflation & Devaluation (FX)' },
  { value: 'Building a Consistent Emergency / Investment Fund',    label: 'Building a Consistent Emergency / Investment Fund' },
  { value: 'No Savings',                                           label: 'No Savings' },
];

const GENDER_OPTIONS = ['Male', 'Female', 'Prefer not to say'];

export default function PersonalWealthModal({ isOpen, onClose }) {
  const navigate   = useNavigate();
  const { login }  = useAuth();
  const sessionRef = useRef(genSessionId());

  // 'auth' = initial choice, 'login' = existing user, 'signup' = 4-step wizard
  const [mode, setMode]       = useState('auth');
  const [step, setStep]       = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]     = useState('');

  // Step 1
  const [fullName, setFullName]     = useState('');
  const [nickname, setNickname]     = useState('');
  const [email, setEmail]           = useState('');
  const [country, setCountry]       = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [displayCurrency, setDisplayCurrencyField] = useState('NGN'); // matches backend's DEFAULT_DISPLAY_CURRENCY — changeable any time later from the dashboard

  // Step 2
  const [primaryIncomeSource, setPrimaryIncomeSource] = useState('');
  const [assetLocations, setAssetLocations]           = useState([]);
  const [monthlyIncomeBracket, setMonthlyIncomeBracket] = useState('');
  const [biggestFinancialHeadache, setBiggestFinancialHeadache] = useState('');

  // Step 3
  // State value unused (only setter used) — underscore prefix silences ESLint
  const [_wantsWealthOpportunities, setWantsWealthOpportunities] = useState(null);

  // Step 4
  const [gender, setGender]     = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword]       = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [agreedToPrivacy, setAgreedToPrivacy] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);

  // Login mode
  const [loginEmail, setLoginEmail]       = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Forgot-password (OTP reset) — reuses the same identity-level
  // endpoints the business modal uses (/api/auth/otp/*). These
  // operate on the shared br-users table, so they work correctly for
  // a personal-only identity with no code changes needed.
  const [resetEmail, setResetEmail]     = useState('');
  const [resetStep, setResetStep]       = useState('request'); // 'request'|'not_found'|'verify'|'newpass'|'done'
  const [resetLoading, setResetLoading] = useState(false);
  const [otpCode, setOtpCode]           = useState('');
  const [resetToken, setResetToken]     = useState('');
  const [newPassword, setNewPassword]   = useState('');
  const [confirmResetPassword, setConfirmResetPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') handleClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!isOpen) return null;

  function handleClose() {
    setMode('auth'); setStep(1); setError('');
    setAgreedToPrivacy(false); setShowPrivacyModal(false);
    resetOTPFlow();
    onClose();
  }

  function toggleAssetLocation(value) {
    setAssetLocations(prev =>
      prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]
    );
  }

  async function postStep(step, body) {
    const res = await fetch(ONBOARDING_ENDPOINT, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ step, sessionId: sessionRef.current, ...body }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.message || 'Something went wrong. Please try again.');
    }
    return data;
  }

  async function handleStep1Submit(e) {
    e.preventDefault();
    setError('');
    if (!fullName.trim() || !nickname.trim() || !email.trim() || !country.trim()) {
      setError('Please fill in every field (phone number is optional).');
      return;
    }
    setSubmitting(true);
    try {
      await postStep(1, { fullName, nickname, email, countryOfResidence: country, phoneNumber, displayCurrency });
      setStep(2);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleStep2Submit(e) {
    e.preventDefault();
    setError('');
    if (!primaryIncomeSource || assetLocations.length === 0 || !monthlyIncomeBracket || !biggestFinancialHeadache) {
      setError('Please answer all four questions.');
      return;
    }
    setSubmitting(true);
    try {
      await postStep(2, { primaryIncomeSource, assetLocations, monthlyIncomeBracket, biggestFinancialHeadache });
      setStep(3);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleStep3Submit(choice) {
    setError('');
    setSubmitting(true);
    try {
      await postStep(3, { wantsWealthOpportunities: choice });
      setWantsWealthOpportunities(choice);
      setStep(4);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleStep4Submit(e) {
    e.preventDefault();
    setError('');
    if (!gender) { setError('Please select a gender option.'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match.'); return; }
    if (!agreedToPrivacy) { setError('Please accept the Privacy Policy to continue.'); return; }

    setSubmitting(true);
    try {
      const data = await postStep(4, { email, password, gender, agreedToPrivacy: true });
      login(data.profile, { spaceType: 'personal' });
      handleClose();
      navigate('/wealth');
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleLoginSubmit(e) {
    e.preventDefault();
    setError('');
    if (!loginEmail.trim() || !loginPassword) {
      setError('Enter your email and password.');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: loginEmail, password: loginPassword }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.message || 'Invalid email or password.');
        return;
      }

      if (data.requiresSpaceSelection || data.requiresBusinessSelection) {
        // This identity has more than one space (e.g. a business AND
        // a personal space, or several businesses). Personal Wealth
        // OS and the business dashboard are separate products for now
        // (see the build discussion) — this modal doesn't build a full
        // picker UI; point them at the main login experience instead,
        // which already knows how to handle every picker shape.
        setError('This account has multiple spaces — please log in from the main Log In screen to choose one.');
        return;
      }

      if (data.spaceType !== 'personal') {
        setError('This account is a business account. Use "Business Finance Management" to log in instead.');
        return;
      }

      login(data.profile, { spaceType: 'personal' });
      handleClose();
      navigate('/wealth');
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  function resetOTPFlow() {
    setResetStep('request');
    setResetEmail('');
    setOtpCode('');
    setResetToken('');
    setNewPassword('');
    setConfirmResetPassword('');
    setError('');
  }

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
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailVal }),
      });
      const data = await res.json();
      if (res.status === 404 && data.notFound) { setResetStep('not_found'); return; }
      if (!res.ok) { setError(data.message || "Couldn't send code. Please try again."); return; }
      setResetStep('verify');
    } catch {
      setError('Something went wrong. Please try again in a moment.');
    } finally {
      setResetLoading(false);
    }
  }

  async function handleVerifyOTP() {
    if (!/^\d{6}$/.test(otpCode.trim())) {
      setError('Please enter the 6-digit code from your email.');
      return;
    }
    setError('');
    setResetLoading(true);
    try {
      const res  = await fetch('/api/auth/otp/verify', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resetEmail.trim().toLowerCase(), code: otpCode.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) { setError(data.message || 'Incorrect code. Please try again.'); return; }
      setResetToken(data.resetToken);
      setResetStep('newpass');
    } catch {
      setError('Something went wrong. Please try again in a moment.');
    } finally {
      setResetLoading(false);
    }
  }

  async function handleSetNewPassword() {
    if (newPassword.length < 6) { setError('Password must be at least 6 characters.'); return; }
    if (newPassword !== confirmResetPassword) { setError('Passwords do not match.'); return; }
    setError('');
    setResetLoading(true);
    try {
      const res  = await fetch('/api/auth/otp/reset', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: resetEmail.trim().toLowerCase(), resetToken, newPassword }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) { setError(data.message || "Couldn't update password. Please try again."); return; }
      setResetStep('done');
    } catch {
      setError('Something went wrong. Please try again in a moment.');
    } finally {
      setResetLoading(false);
    }
  }

  const inputClass = 'w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 pr-4 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500 transition-colors';

  function headerSub() {
    if (mode === 'auth')  return 'PERSONAL WEALTH OS';
    if (mode === 'login') return 'PERSONAL WEALTH OS · LOG IN';
    if (mode === 'reset') return 'PERSONAL WEALTH OS · RESET PASSWORD';
    return `PERSONAL WEALTH OS · STEP ${step} OF 4`;
  }
  function headerTitle() {
    if (mode === 'auth')  return 'Track Your Net Worth';
    if (mode === 'login') return 'Welcome Back';
    if (mode === 'reset') {
      if (resetStep === 'request')   return 'Reset Your Password';
      if (resetStep === 'not_found') return 'Email Not Registered';
      if (resetStep === 'verify')    return 'Enter Your Code';
      if (resetStep === 'newpass')   return 'Choose New Password';
      return 'Password Updated';
    }
    if (step === 1) return 'The Basics';
    if (step === 2) return 'Your Financial Profile';
    if (step === 3) return 'Wealth Discovery & Match';
    return 'Secure Your Wealth OS';
  }

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
        {/* Header */}
        <div className="sticky top-0 z-10 bg-zinc-950/95 backdrop-blur-md border-b border-zinc-900 px-6 py-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-amber-500">{headerSub()}</p>
              <h2 className="text-white font-black text-lg uppercase italic tracking-tight mt-0.5">{headerTitle()}</h2>
            </div>
            <button type="button" onClick={handleClose}
              className="w-8 h-8 bg-zinc-800 hover:bg-zinc-700 rounded-full flex items-center justify-center text-zinc-400 hover:text-white transition-all">
              <X size={15} />
            </button>
          </div>

          {mode === 'signup' && (
            <div className="flex gap-2">
              {STEPS.map((s, i) => (
                <div key={i} className="flex-1 flex flex-col gap-1.5">
                  <div className={`h-1 rounded-full transition-all duration-300 ${
                    i + 1 < step   ? 'bg-amber-500' :
                    i + 1 === step ? 'bg-amber-500/50' : 'bg-zinc-800'
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

          {error && (
            <div className="flex items-start gap-2 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-400 mb-5">
              <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* AUTH GATE */}
          {mode === 'auth' && (
            <div className="space-y-4">
              <p className="text-zinc-400 text-sm leading-relaxed mb-6">
                Track your net worth, spending, assets, debts, and goals — separate from your business, built to
                give you a real picture of your own money.
              </p>

              <button
                onClick={() => { setMode('signup'); setError(''); }}
                className="w-full flex items-center justify-between px-6 py-5 bg-amber-500 text-black rounded-2xl hover:bg-amber-400 transition-all group"
              >
                <div className="text-left">
                  <p className="font-black text-sm uppercase tracking-tight">Launch My Wealth OS</p>
                  <p className="text-xs opacity-70 mt-0.5">Takes about 2 minutes</p>
                </div>
                <UserPlus size={20} className="group-hover:translate-x-1 transition-transform" />
              </button>

              <button
                onClick={() => { setMode('login'); setError(''); }}
                className="w-full flex items-center justify-between px-6 py-5 bg-zinc-900 border border-zinc-800 text-zinc-300 rounded-2xl hover:border-zinc-700 hover:text-white transition-all group"
              >
                <div className="text-left">
                  <p className="font-black text-sm uppercase tracking-tight">Log In</p>
                  <p className="text-xs opacity-60 mt-0.5">Already tracking your wealth with us</p>
                </div>
                <LogIn size={20} className="group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          )}

          {/* LOGIN */}
          {mode === 'login' && (
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">Email</label>
                <input type="email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)}
                  placeholder="you@gmail.com" className={inputClass} autoFocus />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">Password</label>
                <div className="relative">
                  <input type={showLoginPassword ? 'text' : 'password'} value={loginPassword}
                    onChange={e => setLoginPassword(e.target.value)} placeholder="Your password"
                    className={inputClass + ' pr-11'} />
                  <button type="button" onClick={() => setShowLoginPassword(v => !v)} tabIndex={-1}
                    className="absolute right-0 top-0 h-full w-11 flex items-center justify-center text-zinc-500 hover:text-zinc-200">
                    {showLoginPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <button type="submit" disabled={submitting}
                className="w-full flex items-center justify-center gap-2 py-3.5 bg-amber-500 text-black font-black text-xs uppercase tracking-widest rounded-xl hover:bg-amber-400 transition active:scale-95 disabled:opacity-50">
                {submitting ? <Loader2 size={16} className="animate-spin" /> : <>Log In <ArrowRight size={15} /></>}
              </button>
              <button type="button" onClick={() => { setMode('reset'); resetOTPFlow(); }}
                className="w-full text-center text-xs text-amber-500 hover:text-amber-400 transition">
                Forgot password?
              </button>
              <button type="button" onClick={() => { setMode('auth'); setError(''); }}
                className="w-full text-center text-xs text-zinc-500 hover:text-zinc-300 transition">
                <ArrowLeft size={12} className="inline mr-1" /> Back
              </button>
            </form>
          )}

          {/* FORGOT PASSWORD (OTP reset) */}
          {mode === 'reset' && (
            <div className="space-y-4">
              {resetStep === 'request' && (
                <>
                  <p className="text-zinc-400 text-sm leading-relaxed">
                    Enter the email linked to your account. We'll send a 6-digit code instantly.
                  </p>
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">Email</label>
                    <input type="email" value={resetEmail} onChange={e => { setResetEmail(e.target.value); setError(''); }}
                      placeholder="you@gmail.com" className={inputClass} autoFocus />
                  </div>
                  <button onClick={handleRequestOTP} disabled={resetLoading}
                    className="w-full flex items-center justify-center gap-2 py-3.5 bg-amber-500 text-black font-black text-xs uppercase tracking-widest rounded-xl hover:bg-amber-400 transition active:scale-95 disabled:opacity-50">
                    {resetLoading ? <Loader2 size={16} className="animate-spin" /> : <><KeyRound size={14} /> Send Reset Code</>}
                  </button>
                  <button onClick={() => { setMode('login'); resetOTPFlow(); }}
                    className="w-full text-center text-xs text-zinc-500 hover:text-zinc-300 transition">
                    <ArrowLeft size={12} className="inline mr-1" /> Back to Log In
                  </button>
                </>
              )}

              {resetStep === 'not_found' && (
                <div className="flex flex-col items-center text-center py-4 space-y-5">
                  <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center">
                    <AlertCircle size={28} className="text-amber-500" />
                  </div>
                  <div>
                    <p className="text-white font-black text-base mb-2">Email Not Registered</p>
                    <p className="text-zinc-500 text-sm leading-relaxed">
                      We couldn't find a Personal Wealth OS account linked to{' '}
                      <span className="text-zinc-200">{resetEmail}</span>. Check the email, or launch a new Wealth OS.
                    </p>
                  </div>
                  <div className="flex flex-col gap-3 w-full">
                    <button onClick={() => { setMode('signup'); resetOTPFlow(); }}
                      className="w-full flex items-center justify-center gap-2 py-3.5 bg-amber-500 text-black font-black text-xs uppercase tracking-widest rounded-xl hover:bg-amber-400 transition">
                      <UserPlus size={14} /> Launch My Wealth OS
                    </button>
                    <button onClick={() => { setResetStep('request'); setError(''); }}
                      className="w-full text-center text-xs text-zinc-500 hover:text-zinc-300 transition">
                      Try a Different Email
                    </button>
                  </div>
                </div>
              )}

              {resetStep === 'verify' && (
                <>
                  <div className="px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-xl">
                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1">Code sent to</p>
                    <p className="text-sm text-zinc-200">{resetEmail}</p>
                  </div>
                  <p className="text-zinc-500 text-xs leading-relaxed">
                    Enter the 6-digit code from your email. It expires in 15 minutes.
                  </p>
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">6-Digit Code</label>
                    <input type="text" inputMode="numeric" maxLength={6} placeholder="e.g. 483921"
                      value={otpCode} onChange={e => { setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6)); setError(''); }}
                      className={inputClass + ' text-center text-2xl font-black tracking-[0.4em]'} autoFocus />
                  </div>
                  <button onClick={handleVerifyOTP} disabled={resetLoading || otpCode.length !== 6}
                    className="w-full flex items-center justify-center gap-2 py-3.5 bg-amber-500 text-black font-black text-xs uppercase tracking-widest rounded-xl hover:bg-amber-400 transition active:scale-95 disabled:opacity-50">
                    {resetLoading ? <Loader2 size={16} className="animate-spin" /> : <><CheckCircle size={14} /> Verify Code</>}
                  </button>
                  <button onClick={() => { setResetStep('request'); setOtpCode(''); setError(''); }}
                    className="w-full text-center text-xs text-zinc-500 hover:text-zinc-300 transition">
                    Resend Code
                  </button>
                </>
              )}

              {resetStep === 'newpass' && (
                <>
                  <p className="text-zinc-400 text-sm leading-relaxed">Choose a strong new password for your account.</p>
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">New Password</label>
                    <div className="relative">
                      <input type={showNewPassword ? 'text' : 'password'} value={newPassword}
                        onChange={e => { setNewPassword(e.target.value); setError(''); }}
                        placeholder="At least 6 characters" className={inputClass + ' pr-11'} autoFocus />
                      <button type="button" onClick={() => setShowNewPassword(v => !v)} tabIndex={-1}
                        className="absolute right-0 top-0 h-full w-11 flex items-center justify-center text-zinc-500 hover:text-zinc-200">
                        {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">Confirm Password</label>
                    <input type={showNewPassword ? 'text' : 'password'} value={confirmResetPassword}
                      onChange={e => { setConfirmResetPassword(e.target.value); setError(''); }}
                      placeholder="Re-enter your password" className={inputClass} />
                  </div>
                  <button onClick={handleSetNewPassword} disabled={resetLoading}
                    className="w-full flex items-center justify-center gap-2 py-3.5 bg-amber-500 text-black font-black text-xs uppercase tracking-widest rounded-xl hover:bg-amber-400 transition active:scale-95 disabled:opacity-50">
                    {resetLoading ? <Loader2 size={16} className="animate-spin" /> : <><KeyRound size={14} /> Set New Password</>}
                  </button>
                </>
              )}

              {resetStep === 'done' && (
                <div className="flex flex-col items-center text-center py-6 space-y-5">
                  <div className="w-16 h-16 rounded-2xl bg-green-500/10 border border-green-500/20 flex items-center justify-center">
                    <CheckCircle size={28} className="text-green-400" />
                  </div>
                  <div>
                    <p className="text-white font-black text-lg mb-2">Password Updated!</p>
                    <p className="text-zinc-500 text-sm leading-relaxed">
                      You can now log in with your new password.
                    </p>
                  </div>
                  <button onClick={() => { setMode('login'); resetOTPFlow(); setLoginEmail(resetEmail); }}
                    className="w-full flex items-center justify-center gap-2 py-3.5 bg-amber-500 text-black font-black text-xs uppercase tracking-widest rounded-xl hover:bg-amber-400 transition">
                    <LogIn size={14} /> Log In Now
                  </button>
                </div>
              )}
            </div>
          )}

          {/* STEP 1 — THE BASICS */}
          {mode === 'signup' && step === 1 && (
            <form onSubmit={handleStep1Submit} className="space-y-4">
              <p className="text-zinc-400 text-sm leading-relaxed mb-2">
                Let's start with who you are. This helps us personalise your Wealth OS & Net Worth Tracker.
              </p>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">Full Name</label>
                <input value={fullName} onChange={e => setFullName(e.target.value)} placeholder="Boluwatife Adesanya" className={inputClass} autoFocus />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">Preferred Nickname / Display Name</label>
                <input value={nickname} onChange={e => setNickname(e.target.value)} placeholder="Maxx" className={inputClass} />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">Primary Email</label>
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@gmail.com" className={inputClass} />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">Country of Residence</label>
                <input value={country} onChange={e => setCountry(e.target.value)} placeholder="Nigeria" className={inputClass} />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">
                  Preferred Currency <span className="text-zinc-600 normal-case">(you can change this any time later)</span>
                </label>
                <select
                  value={displayCurrency}
                  onChange={e => setDisplayCurrencyField(e.target.value)}
                  className={`${inputClass} appearance-none cursor-pointer`}
                >
                  {CURRENCIES.map(code => (
                    <option key={code} value={code}>
                      {code} — {CURRENCY_LABELS[code]} ({CURRENCY_SYMBOLS[code]})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">Phone Number <span className="text-zinc-600 normal-case">(optional)</span></label>
                <input value={phoneNumber} onChange={e => setPhoneNumber(e.target.value)} placeholder="+234..." className={inputClass} />
              </div>
              <button type="submit" disabled={submitting}
                className="w-full flex items-center justify-center gap-2 py-3.5 bg-amber-500 text-black font-black text-xs uppercase tracking-widest rounded-xl hover:bg-amber-400 transition active:scale-95 disabled:opacity-50">
                {submitting ? <Loader2 size={16} className="animate-spin" /> : <>Continue <ArrowRight size={15} /></>}
              </button>
            </form>
          )}

          {/* STEP 2 — FINANCIAL PROFILE */}
          {mode === 'signup' && step === 2 && (
            <form onSubmit={handleStep2Submit} className="space-y-6">
              <p className="text-zinc-400 text-sm leading-relaxed -mt-2 mb-2">
                Tell us about your money goals. This builds your personal financial identity.
              </p>

              <ChoiceGroup label="Primary Income Source?" options={INCOME_SOURCES}
                value={primaryIncomeSource} onChange={setPrimaryIncomeSource} />

              <ChoiceGroup label="Where do you hold your money / assets?" options={ASSET_LOCATIONS}
                multi value={assetLocations} onChange={toggleAssetLocation} />

              <ChoiceGroup label="Monthly Take-Home Income Bracket?" options={INCOME_BRACKETS}
                value={monthlyIncomeBracket} onChange={setMonthlyIncomeBracket} />

              <ChoiceGroup label="Biggest Financial Headache Today?" options={FINANCIAL_HEADACHES}
                value={biggestFinancialHeadache} onChange={setBiggestFinancialHeadache} />

              <div className="flex gap-3">
                <button type="button" onClick={() => setStep(1)}
                  className="px-5 py-3.5 bg-zinc-900 border border-zinc-800 text-zinc-400 rounded-xl hover:text-white transition">
                  <ArrowLeft size={16} />
                </button>
                <button type="submit" disabled={submitting}
                  className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-amber-500 text-black font-black text-xs uppercase tracking-widest rounded-xl hover:bg-amber-400 transition active:scale-95 disabled:opacity-50">
                  {submitting ? <Loader2 size={16} className="animate-spin" /> : <>Continue <ArrowRight size={15} /></>}
                </button>
              </div>
            </form>
          )}

          {/* STEP 3 — WEALTH DISCOVERY & MATCH */}
          {mode === 'signup' && step === 3 && (
            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-full text-xs text-zinc-300">
                <Sparkles size={12} className="text-amber-500" />
                {nickname || 'You'} · {primaryIncomeSource || '—'} · {monthlyIncomeBracket || '—'}
              </div>

              <p className="text-zinc-300 text-sm leading-relaxed">
                Would you like BusinessRun to use your financial profile to recommend vetted wealth opportunities —
                high-yield savings, FX hedging tools, verified real estate funds, or tax/estate planning — that fit
                your income bracket? <span className="text-zinc-500">No raw financial data is ever shared with third parties.</span>
              </p>

              <button onClick={() => handleStep3Submit(true)} disabled={submitting}
                className="w-full flex items-center justify-between px-6 py-5 bg-amber-500 text-black rounded-2xl hover:bg-amber-400 transition-all group disabled:opacity-50">
                <p className="font-black text-sm uppercase tracking-tight text-left">Yes, Help Me Grow My Wealth</p>
                <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </button>

              <button onClick={() => handleStep3Submit(false)} disabled={submitting}
                className="w-full flex items-center justify-between px-6 py-5 bg-zinc-900 border border-zinc-800 text-zinc-300 rounded-2xl hover:border-zinc-700 hover:text-white transition-all group disabled:opacity-50">
                <p className="font-black text-sm uppercase tracking-tight text-left">No, I'll Manage On My Own</p>
                <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </button>

              <button type="button" onClick={() => setStep(2)}
                className="w-full text-center text-xs text-zinc-500 hover:text-zinc-300 transition">
                <ArrowLeft size={12} className="inline mr-1" /> Back
              </button>
            </div>
          )}

          {/* STEP 4 — SECURITY & LAUNCH */}
          {mode === 'signup' && step === 4 && (
            <form onSubmit={handleStep4Submit} className="space-y-5">
              <div className="flex items-center gap-2 text-zinc-500 text-xs mb-1">
                <ShieldCheck size={14} className="text-amber-500" />
                One last step to secure your Wealth OS.
              </div>

              <ChoiceGroup label="Gender" options={GENDER_OPTIONS.map(g => ({ value: g, label: g }))}
                value={gender} onChange={setGender} />

              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">Create Password</label>
                <div className="relative">
                  <input type={showPassword ? 'text' : 'password'} value={password}
                    onChange={e => setPassword(e.target.value)} placeholder="At least 6 characters"
                    className={inputClass + ' pr-11'} />
                  <button type="button" onClick={() => setShowPassword(v => !v)} tabIndex={-1}
                    className="absolute right-0 top-0 h-full w-11 flex items-center justify-center text-zinc-500 hover:text-zinc-200">
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">Confirm Password</label>
                <div className="relative">
                  <input type={showConfirmPassword ? 'text' : 'password'} value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)} placeholder="Re-enter your password"
                    className={inputClass + ' pr-11'} />
                  <button type="button" onClick={() => setShowConfirmPassword(v => !v)} tabIndex={-1}
                    className="absolute right-0 top-0 h-full w-11 flex items-center justify-center text-zinc-500 hover:text-zinc-200">
                    {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {/* Privacy Policy Checkbox */}
              <div className="p-4 bg-zinc-800/50 border border-zinc-700 rounded-xl">
                <label className="flex items-start gap-3 cursor-pointer group">
                  <div className="relative mt-0.5">
                    <input
                      type="checkbox"
                      checked={agreedToPrivacy}
                      onChange={e => { setAgreedToPrivacy(e.target.checked); setError(''); }}
                      className="sr-only peer"
                    />
                    <div className="w-5 h-5 border-2 border-zinc-600 rounded-md peer-checked:bg-amber-500 peer-checked:border-amber-500 transition-all flex items-center justify-center">
                      {agreedToPrivacy && <CheckCircle size={14} className="text-black" />}
                    </div>
                  </div>
                  <span className="text-xs text-zinc-400 leading-relaxed">
                    I have read and agree to the{' '}
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); setShowPrivacyModal(true); }}
                      className="text-amber-500 hover:text-amber-400 underline underline-offset-2 font-medium"
                    >
                      Privacy Policy
                    </button>
                    {' '}governing how BusinessRun collects, processes, and protects my personal data in compliance with the Nigeria Data Protection Act (NDPA) 2023.
                  </span>
                </label>
              </div>

              <div className="flex gap-3">
                <button type="button" onClick={() => setStep(3)}
                  className="px-5 py-3.5 bg-zinc-900 border border-zinc-800 text-zinc-400 rounded-xl hover:text-white transition">
                  <ArrowLeft size={16} />
                </button>
                <button type="submit" disabled={submitting}
                  className="flex-1 flex items-center justify-center gap-2 py-3.5 bg-amber-500 text-black font-black text-xs uppercase tracking-widest rounded-xl hover:bg-amber-400 transition active:scale-95 disabled:opacity-50">
                  {submitting ? <Loader2 size={16} className="animate-spin" /> : <>Launch My Wealth Dashboard <ArrowRight size={15} /></>}
                </button>
              </div>
            </form>
          )}

        </div>
      </div>

      {/* Privacy Policy Modal */}
      <PrivacyPolicyModal
        isOpen={showPrivacyModal}
        onClose={() => setShowPrivacyModal(false)}
      />
    </div>
  );
}

/**
 * ChoiceGroup
 * Single- or multi-select button grid — shared by every choice-based
 * question across steps 2 and 4, so the interaction pattern (and its
 * selected/unselected styling) stays identical everywhere it appears.
 */
function ChoiceGroup({ label, options, value, onChange, multi = false }) {
  function isSelected(optValue) {
    return multi ? value.includes(optValue) : value === optValue;
  }
  return (
    <div>
      <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">{label}</label>
      <div className="grid grid-cols-1 gap-2">
        {options.map(opt => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`relative text-left px-4 py-3 rounded-xl border text-sm transition-all ${
              isSelected(opt.value)
                ? 'bg-amber-500/10 border-amber-500/40 text-amber-500'
                : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:border-zinc-700'
            }`}
          >
            {opt.label}
            {isSelected(opt.value) && (
              <span className="absolute top-2 right-2 w-4 h-4 bg-amber-500 rounded-full flex items-center justify-center text-black text-[8px] font-black">✓</span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
