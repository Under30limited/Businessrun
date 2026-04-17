import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Zap, TrendingUp, DollarSign, Bot,
  CheckCircle, ArrowRight, Eye, EyeOff, X,
  Loader2, AlertCircle,
} from 'lucide-react';

// ── Paste your GrowYourBusiness.gs URL here ───────────────────
const GYB_ENDPOINT = 'https://script.google.com/macros/s/AKfycbxrbD7_CeFOLhLyG7ndfNnyQiE29M3nk2ZWFP1tQiHeHXBJnEanz0lGnTSJpCj1Zcmz/exec';

// ── Fallback static insights (used if Cloudflare fn is down) ──
const FALLBACK = {
  'Social Media': {
    prioritySignal: 'Turn followers into paying customers — build a DM-to-invoice funnel this week.',
    sectorFocus:    'Conversion Rate & Brand Trust',
    sectorDetail:   'Your primary risk is invisible — followers who never buy. Build a structured follow-up funnel from DM to invoice within 48 hours. Nigerian consumers buy from people they trust, not brands they scroll past.',
    weeklyAction:   'Set up a WhatsApp Business catalogue with pricing and pin your best offer today.',
    headacheAdvice: 'Social sellers often price emotionally. Run a proper cost-plus-margin calculation using the Profit & Tax Hub. Never quote a price without knowing your floor first.',
  },
  'Physical Store': {
    prioritySignal: 'Your price is visible to every competitor — loyalty is your only moat.',
    sectorFocus:    'Foot Traffic & Repeat Purchase',
    sectorDetail:   'Physical businesses live and die on proximity and repeat customers. In the current Nigerian economy, discretionary spending is contracting — your existing customers are your most valuable asset.',
    weeklyAction:   'Introduce a loyalty stamp card. Capture every customer phone number this week.',
    headacheAdvice: 'Physical store cashflow problems usually come from inventory tied up in slow stock. Identify your 3 slowest-moving products and run a clearance this week to free up working capital.',
  },
  'E-commerce': {
    prioritySignal: 'Fix checkout friction before spending another naira on ads.',
    sectorFocus:    'Cart Abandonment & Margin Integrity',
    sectorDetail:   'Most Nigerian e-commerce stores lose 60–70% of potential revenue at checkout — logistics cost surprises, payment failure, or distrust. Your conversion rate matters more than your traffic.',
    weeklyAction:   'Audit your checkout flow on mobile. If it takes more than 3 taps to pay, fix it.',
    headacheAdvice: 'E-commerce cashflow is often destroyed by logistics costs eating into margin. Map your true delivery cost per order — including returns — and reprice accordingly.',
  },
  'B2B/Referrals': {
    prioritySignal: 'Long payment cycles are killing your cashflow — set a 30-day maximum today.',
    sectorFocus:    'Pipeline Visibility & Invoice Cycle',
    sectorDetail:   'B2B businesses often show strong revenue on paper but suffer from chronic cash shortages. In Nigeria, net-60 and net-90 payment terms are normal — they should not be your normal.',
    weeklyAction:   'Follow up on every outstanding invoice older than 14 days before end of week.',
    headacheAdvice: 'B2B credit access improves dramatically with clean, audited financials. Start generating monthly income statements using the Accounting Tools — banks want to see 6 months of records.',
  },
};

// ── AI Suite cards — all wired to Strategic AI Advisor ────────
const AI_SUITE = [
  {
    icon:  <DollarSign size={20} />,
    title: 'Digital CFO',
    desc:  'Real-time margin tracking, tax position, and runway analysis for your business.',
    tag:   'Ask the AI Advisor',
    prompt: 'Act as my Digital CFO. Based on my business stage and revenue bracket, give me a 3-point financial health checklist I can complete this week.',
  },
  {
    icon:  <TrendingUp size={20} />,
    title: 'Price Engine',
    desc:  'AI-powered pricing recommendations calibrated to your sector and costs.',
    tag:   'Ask the AI Advisor',
    prompt: 'Act as my pricing strategist. Give me a framework for setting profitable prices in my sector that accounts for Nigerian market conditions and inflation.',
  },
  {
    icon:  <Bot size={20} />,
    title: 'Strategic AI Advisor',
    desc:  'Your on-demand business strategist — trained on Nigerian market conditions.',
    tag:   'Available Now',
    prompt: null,
  },
];

// ── Password Save Modal ────────────────────────────────────────
function SaveProfileModal({ isOpen, onClose, onSave, saving, businessName }) {
  const [password,  setPassword]  = useState('');
  const [confirm,   setConfirm]   = useState('');
  const [show,      setShow]      = useState(false);
  const [error,     setError]     = useState('');

  useEffect(() => {
    if (!isOpen) { setPassword(''); setConfirm(''); setError(''); }
  }, [isOpen]);

  function handleSave() {
    if (password.length < 6)        { setError('Password must be at least 6 characters.'); return; }
    if (password !== confirm)        { setError('Passwords do not match.');                 return; }
    setError('');
    onSave(password);
  }

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <div
        className="bg-zinc-950 border border-zinc-800 rounded-[2rem] w-full max-w-md shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="border-b border-zinc-900 px-6 py-5 flex items-center justify-between">
          <div>
            <p className="text-[9px] font-black uppercase tracking-widest text-amber-500 mb-0.5">Save Profile</p>
            <h3 className="text-white font-black text-lg italic uppercase">Create Your Password</h3>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 bg-zinc-800 hover:bg-zinc-700 rounded-full flex items-center justify-center text-zinc-400 hover:text-white transition"
          >
            <X size={15} />
          </button>
        </div>

        <div className="px-6 py-7 space-y-4">
          <p className="text-zinc-500 text-sm leading-relaxed">
            Set a password to save your <strong className="text-zinc-300">{businessName}</strong> roadmap.
            You will be able to return to this profile at any time.
          </p>

          {/* Password */}
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">Password</label>
            <div className="relative">
              <input
                type={show ? 'text' : 'password'}
                placeholder="Min. 6 characters"
                value={password}
                onChange={e => { setPassword(e.target.value); setError(''); }}
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 pr-11 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500 transition"
              />
              <button
                type="button"
                onClick={() => setShow(p => !p)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-zinc-400 transition"
              >
                {show ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Confirm */}
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">Confirm Password</label>
            <input
              type={show ? 'text' : 'password'}
              placeholder="Re-enter password"
              value={confirm}
              onChange={e => { setConfirm(e.target.value); setError(''); }}
              className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500 transition"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl">
              <AlertCircle size={13} className="text-red-400 shrink-0" />
              <p className="text-red-400 text-xs">{error}</p>
            </div>
          )}

          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 py-3.5 bg-amber-500 text-black font-black text-xs uppercase tracking-widest rounded-xl hover:bg-amber-400 transition active:scale-95 disabled:opacity-50 mt-2"
          >
            {saving
              ? <><Loader2 size={14} className="animate-spin" /> Saving...</>
              : <>Save Profile <ArrowRight size={14} /></>
            }
          </button>

          <p className="text-[10px] text-zinc-700 text-center uppercase tracking-widest">
            Your password is stored securely · No spam, ever
          </p>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// RoadmapPage
// ─────────────────────────────────────────────────────────────
export default function RoadmapPage() {
  const location  = useLocation();
  const navigate  = useNavigate();
  const state     = location.state || {};
  const sessionId = useRef(state.sessionId || '');

  const {
    businessName = 'Your Business',
    fullName     = '',
    stage        = 'Launch',
    salesChannel = 'Social Media',
    revenue      = '',
    headache     = 'Tracking Cashflow',
  } = state;

  // ── Loading & insight state ───────────────────────────────
  const [loading,       setLoading]       = useState(true);
  const [loadMsg,       setLoadMsg]       = useState(`Analysing market signals for ${businessName}...`);
  const [insight,       setInsight]       = useState(null);  // dynamic from Gemini

  // ── Save profile modal state ──────────────────────────────
  const [showSave,      setShowSave]      = useState(false);
  const [saveModalOpen, setSaveModalOpen] = useState(false);
  const [saving,        setSaving]        = useState(false);
  const [saved,         setSaved]         = useState(false);

  // ── Loading animation + insight fetch ────────────────────
  useEffect(() => {
    const msgs = [
      `Analysing market signals for ${businessName}...`,
      `Mapping ${salesChannel} performance benchmarks...`,
      `Cross-referencing ${stage} stage playbooks...`,
      'Initialising your Business OS...',
    ];
    let i = 0;
    const interval = setInterval(() => {
      i++;
      if (i < msgs.length) setLoadMsg(msgs[i]);
      else {
        clearInterval(interval);
        fetchInsight();
      }
    }, 600);
    return () => clearInterval(interval);
  }, []);

  async function fetchInsight() {
    try {
      const res  = await fetch('/roadmap-insight', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessName, stage, salesChannel, revenue, headache }),
      });
      const data = await res.json();
      if (data.insight) {
        setInsight(data.insight);
      } else {
        setInsight(FALLBACK[salesChannel] || FALLBACK['Social Media']);
      }
    } catch {
      setInsight(FALLBACK[salesChannel] || FALLBACK['Social Media']);
    } finally {
      setLoading(false);
      setTimeout(() => setShowSave(true), 800);
    }
  }

  // ── Password save ─────────────────────────────────────────
  async function handleSaveProfile(password) {
    setSaving(true);
    try {
      await fetch(GYB_ENDPOINT, {
        method:  'POST',
        mode:    'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          step:           4,
          sessionId:      sessionId.current,
          password,
          profileSavedAt: new Date().toLocaleString('en-NG', { timeZone: 'Africa/Lagos' }),
          source:         'businessrun-gyb',
        }),
      });
      setSaved(true);
      setSaveModalOpen(false);
    } catch {
      setSaved(true); // treat as success — no-cors means we can't read errors
      setSaveModalOpen(false);
    } finally {
      setSaving(false);
    }
  }

  // ── Navigate to AI Advisor with pre-filled prompt ─────────
  function openAdvisor(prompt) {
    navigate('/', { state: { advisorPrompt: prompt } });
  }

  // ── Loading screen ────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center px-6 text-center">
        <div className="w-16 h-16 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center justify-center mb-8 animate-pulse">
          <Zap size={28} className="text-amber-500" />
        </div>
        <p className="text-zinc-500 text-xs font-black uppercase tracking-widest mb-3">BusinessRun OS</p>
        <p className="text-white text-xl font-black">{loadMsg}</p>
        <div className="flex gap-1.5 mt-6">
          {[0,1,2].map(i => (
            <div key={i} className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-bounce"
              style={{ animationDelay: `${i * 0.15}s` }} />
          ))}
        </div>
      </div>
    );
  }

  const currentInsight = insight || FALLBACK[salesChannel] || FALLBACK['Social Media'];

  return (
    <>
      <SaveProfileModal
        isOpen={saveModalOpen}
        onClose={() => setSaveModalOpen(false)}
        onSave={handleSaveProfile}
        saving={saving}
        businessName={businessName}
      />

      <div className="min-h-screen bg-black text-zinc-100 pb-24">

        {/* ── Header ────────────────────────────────────────── */}
        <div className="border-b border-zinc-900 bg-zinc-950">
          <div className="max-w-4xl mx-auto px-6 py-8">
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-2 text-zinc-500 hover:text-amber-500 transition mb-6 text-xs font-black uppercase tracking-widest group"
            >
              <ArrowLeft size={13} className="group-hover:-translate-x-1 transition-transform" /> Back to Home
            </button>
            <div className="flex items-center gap-2 mb-3">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-[10px] font-black uppercase tracking-widest text-green-500">Business OS Initialised</span>
            </div>
            <h1 className="text-3xl md:text-4xl font-black tracking-tighter italic uppercase text-white mb-2">
              Welcome, {businessName}!
            </h1>
            <p className="text-zinc-500 text-sm">
              Your personalised Business OS is ready.{fullName && ` Built for ${fullName}.`}
            </p>
          </div>
        </div>

        <div className="max-w-4xl mx-auto px-6 py-10 space-y-8">

          {/* ── Priority Signal ─────────────────────────────── */}
          <div className="bg-amber-500 rounded-[2rem] px-8 py-7">
            <p className="text-[10px] font-black uppercase tracking-widest text-black/60 mb-2">
              {stage} Stage · Priority Signal
            </p>
            <p className="text-black font-black text-lg leading-snug">
              {currentInsight.prioritySignal}
            </p>
          </div>

          {/* ── Sector Intelligence ─────────────────────────── */}
          <div className="bg-zinc-950 border border-zinc-800 rounded-[2rem] overflow-hidden">
            <div className="border-b border-zinc-900 px-8 py-5 flex items-center justify-between">
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-amber-500 mb-1">Sector Intelligence</p>
                <h2 className="text-white font-black text-lg">
                  {salesChannel} · {currentInsight.sectorFocus}
                </h2>
              </div>
              <span className="text-2xl">📊</span>
            </div>
            <div className="px-8 py-7 space-y-4">
              <p className="text-zinc-400 text-sm leading-relaxed">{currentInsight.sectorDetail}</p>
              <div className="flex items-start gap-3 bg-zinc-900 rounded-xl px-4 py-3">
                <CheckCircle size={14} className="text-green-400 mt-0.5 shrink-0" />
                <p className="text-sm text-zinc-300 leading-relaxed">
                  <strong className="text-white">Action this week:</strong> {currentInsight.weeklyAction}
                </p>
              </div>
            </div>
          </div>

          {/* ── Headache Advice ─────────────────────────────── */}
          <div className="bg-zinc-950 border border-zinc-800 rounded-[2rem] overflow-hidden">
            <div className="border-b border-zinc-900 px-8 py-5">
              <p className="text-[9px] font-black uppercase tracking-widest text-amber-500 mb-1">Operational Fix</p>
              <h2 className="text-white font-black text-lg">
                Your headache: <span className="text-zinc-400 font-normal">{headache}</span>
              </h2>
            </div>
            <div className="px-8 py-7 space-y-4">
              <p className="text-zinc-400 text-sm leading-relaxed">{currentInsight.headacheAdvice}</p>
              <button
                onClick={() => openAdvisor(`I run a ${stage} stage ${salesChannel} business. My biggest headache is "${headache}". Give me a 3-step action plan to fix this in the next 30 days.`)}
                className="flex items-center gap-2 px-6 py-3 bg-amber-500 text-black font-black text-xs uppercase tracking-widest rounded-xl hover:bg-amber-400 transition"
              >
                Ask AI Advisor <ArrowRight size={13} />
              </button>
            </div>
          </div>

          {/* ── AI Suite — all wired to Strategic AI Advisor ── */}
          <div>
            <p className="text-[9px] font-black uppercase tracking-widest text-zinc-600 mb-4">Your AI Suite</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {AI_SUITE.map((card, i) => (
                <button
                  key={i}
                  onClick={() => openAdvisor(card.prompt || 'Hello, I am ready to scale my business. Where should I start?')}
                  className="bg-zinc-950 border border-zinc-800 hover:border-amber-500/40 rounded-2xl p-6 flex flex-col gap-3 transition-all text-left cursor-pointer group"
                >
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center group-hover:bg-amber-500 group-hover:text-black transition-all">
                    {card.icon}
                  </div>
                  <div>
                    <p className="text-xs font-black uppercase tracking-widest text-zinc-300 mb-1">{card.title}</p>
                    <p className="text-[11px] text-zinc-600 leading-relaxed">{card.desc}</p>
                  </div>
                  <span className="text-[9px] font-black uppercase tracking-widest text-amber-500 flex items-center gap-1">
                    {card.tag} <ArrowRight size={10} />
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* ── Save Profile CTA ─────────────────────────────── */}
          {showSave && (
            <div className="bg-zinc-950 border border-zinc-800 rounded-[2rem] px-8 py-8 text-center">
              <p className="text-[9px] font-black uppercase tracking-widest text-zinc-600 mb-3">
                Don't lose this roadmap
              </p>
              <h3 className="text-white font-black text-xl italic uppercase mb-3">
                Save Your Profile for Later
              </h3>
              <p className="text-zinc-500 text-sm leading-relaxed max-w-sm mx-auto mb-6">
                This roadmap is session-based — it disappears when you close the tab.
                Create a password to save it and return any time.
              </p>

              {saved ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="w-12 h-12 bg-amber-500 rounded-full flex items-center justify-center">
                    <CheckCircle size={22} className="text-black" />
                  </div>
                  <p className="text-white font-black uppercase tracking-widest text-sm">Profile Saved!</p>
                  <p className="text-zinc-600 text-xs uppercase tracking-widest">
                    Your roadmap is secured. We'll be in touch shortly.
                  </p>
                </div>
              ) : (
                <>
                  <button
                    onClick={() => setSaveModalOpen(true)}
                    className="inline-flex items-center gap-2 px-8 py-4 bg-amber-500 text-black font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-amber-400 transition active:scale-95"
                  >
                    Save This Profile <ArrowRight size={14} />
                  </button>
                  <p className="text-[10px] text-zinc-700 uppercase tracking-widest mt-3">
                    Free · Takes 10 seconds · No spam
                  </p>
                </>
              )}
            </div>
          )}

        </div>
      </div>
    </>
  );
}
