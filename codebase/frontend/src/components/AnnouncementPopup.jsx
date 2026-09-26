/**
 * AnnouncementPopup.jsx
 *
 * Appears after 10 seconds on the homepage and magazine page.
 * Promotes the BusinessRun dashboard (GYB flow) to visitors
 * who may not realise the platform offers more than content.
 *
 * Props:
 *   onSignUp  {Function}  — opens GYB modal in signup mode
 *   onLogin   {Function}  — opens GYB modal in login mode
 *
 * Dismissal:
 *   Stored in sessionStorage — shows once per session, not
 *   on every page navigation, but reappears on a fresh visit.
 *   This keeps it visible to first-time users without annoying
 *   returning users within the same session.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  X, Zap, TrendingUp,
  DollarSign, BarChart3, LogIn, UserPlus,
} from 'lucide-react';

const SESSION_KEY = 'br_announcement_dismissed';

const FEATURE_PILLS = [
  { icon: <BarChart3 size={11} />, label: 'Sales Day Book' },
  { icon: <TrendingUp size={11} />, label: 'Inventory OS' },
  { icon: <DollarSign size={11} />, label: 'Digital CFO' },
  { icon: <Zap size={11} />,        label: 'AI Brain' },
];

export default function AnnouncementPopup({ onSignUp, onLogin }) {
  const [visible,   setVisible]   = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [animateIn, setAnimateIn] = useState(false);

  // Check session — don't show if already dismissed this session
  useEffect(() => {
    if (sessionStorage.getItem(SESSION_KEY)) return;

    const timer = setTimeout(() => {
      setVisible(true);
      // Small delay after mount so CSS transition plays cleanly
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setAnimateIn(true));
      });
    }, 10000); // 10 seconds

    return () => clearTimeout(timer);
  }, []);

  // Lock body scroll while visible
  useEffect(() => {
    if (visible && !dismissed) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [visible, dismissed]);

  // Escape key dismissal
  const dismiss = useCallback(() => {
    setAnimateIn(false);
    setTimeout(() => {
      setDismissed(true);
      document.body.style.overflow = '';
      sessionStorage.setItem(SESSION_KEY, '1');
    }, 250); // wait for exit animation
  }, []);

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') dismiss(); }
    if (visible && !dismissed) document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [visible, dismissed, dismiss]);

  function handleSignUp() { dismiss(); setTimeout(onSignUp, 260); }
  function handleLogin()  { dismiss(); setTimeout(onLogin,  260); }

  if (!visible || dismissed) return null;

  return (
    <div
      onClick={dismiss}
      style={{
        position: 'fixed', inset: 0, zIndex: 9998,
        backgroundColor: 'rgba(0,0,0,0.80)',
        backdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px',
        transition: 'opacity 0.25s ease',
        opacity: animateIn ? 1 : 0,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          transition: 'transform 0.3s cubic-bezier(0.34,1.56,0.64,1), opacity 0.25s ease',
          transform: animateIn ? 'scale(1) translateY(0)' : 'scale(0.92) translateY(24px)',
          opacity: animateIn ? 1 : 0,
          width: '100%', maxWidth: '480px',
        }}
        className="bg-zinc-950 border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl"
      >

        {/* ── Amber accent bar ──────────────────────────────── */}
        <div className="h-1 w-full bg-amber-500" />

        {/* ── Header ────────────────────────────────────────── */}
        <div className="px-7 pt-6 pb-5 border-b border-zinc-900">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              {/* Animated Zap icon */}
              <div className="w-10 h-10 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center justify-center shrink-0">
                <Zap size={18} className="text-amber-500" />
              </div>
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-amber-500 mb-0.5">
                  BusinessRun Brain
                </p>
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-600">
                  Now Available
                </p>
              </div>
            </div>
            <button
              onClick={dismiss}
              className="w-7 h-7 flex items-center justify-center rounded-full bg-zinc-900 text-zinc-500 hover:bg-zinc-800 hover:text-white transition shrink-0 mt-0.5"
              aria-label="Close"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* ── Body ──────────────────────────────────────────── */}
        <div className="px-7 py-6 space-y-5">

          {/* Main headline */}
          <div>
            <h2 className="text-white font-black text-xl sm:text-2xl leading-tight italic uppercase tracking-tighter mb-3">
              Stop Tracking the Past.<br />
              <span className="text-amber-500">Prescribe Your Future.</span>
            </h2>
            <p className="text-zinc-400 text-sm leading-relaxed">
              Don't just track what happened yesterday — let the{' '}
              <strong className="text-zinc-200">BusinessRun Brain</strong> prescribe
              exactly what to do tomorrow. Unlock the{' '}
              <strong className="text-zinc-200">Grow Your Business dashboard</strong>{' '}
              to seamlessly connect your Sales, Inventory, and CFO modules today.
            </p>
          </div>

          {/* Feature pills */}
          <div className="flex flex-wrap gap-2">
            {FEATURE_PILLS.map(({ icon, label }) => (
              <span key={label}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-900 border border-zinc-800 rounded-full text-[10px] font-black uppercase tracking-widest text-zinc-400">
                <span className="text-amber-500">{icon}</span>
                {label}
              </span>
            ))}
          </div>

          {/* Insight teaser card */}
          <div className="bg-amber-500/5 border border-amber-500/15 rounded-2xl px-5 py-4">
            <p className="text-[9px] font-black uppercase tracking-widest text-amber-500/70 mb-2">
              SEE THE BRAIN IN ACTION
            </p>
            <p className="text-zinc-300 text-xs leading-relaxed">
              "Your top seller is at <strong className="text-white">3 units remaining</strong> — reorder before the weekend.
              Cash position covers it. Your last 5 sales show{' '}
              <strong className="text-white">₦18,000 in credit outstanding</strong>. Follow up today."
            </p>
          </div>

          {/* CTA buttons */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <button
              onClick={handleSignUp}
              className="flex items-center justify-center gap-2 py-3.5 bg-amber-500 text-black font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-amber-400 transition active:scale-95"
            >
              <UserPlus size={12} /> Get Started
            </button>
            <button
              onClick={handleLogin}
              className="flex items-center justify-center gap-2 py-3.5 bg-zinc-900 border border-zinc-700 text-zinc-300 font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-zinc-800 hover:text-white transition active:scale-95"
            >
              <LogIn size={12} /> Log In
            </button>
          </div>

          {/* Dismiss */}
          <button
            onClick={dismiss}
            className="w-full text-center text-[10px] font-black uppercase tracking-widest text-zinc-700 hover:text-zinc-500 transition pt-1"
          >
            Continue Reading →
          </button>
        </div>
      </div>
    </div>
  );
}
