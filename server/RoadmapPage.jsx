/**
 * RoadmapPage.jsx — User Dashboard
 *
 * Layout:
 *   - Dashboard-own top navigation (no global Navbar)
 *   - Left: BusinessRun logo → taps to home + logout
 *   - Right: hamburger menu → slides out panel with nav items
 *   - Two views managed by `activeView` state:
 *       'home'    → Business OS (original roadmap content, default)
 *       'advisor' → AI Advisor chat (mirrored from HomePage)
 *   - "Ask AI Advisor" button in Headache section sets activeView to 'advisor'
 *     and pre-fills a prompt — no page navigation, stays in dashboard
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Zap, TrendingUp, DollarSign, Bot, User,
  CheckCircle, ArrowRight, Menu, X,
  Loader2, Home, Sparkles, RefreshCcw,
  LogOut, MessageSquare,
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────
// FALLBACK INSIGHTS
// ─────────────────────────────────────────────────────────────────
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

// ─────────────────────────────────────────────────────────────────
// AI SUITE CARDS
// ─────────────────────────────────────────────────────────────────
const AI_SUITE = [
  {
    icon:   <DollarSign size={20} />,
    title:  'Digital CFO',
    desc:   'Real-time margin tracking, tax position, and runway analysis for your business.',
    tag:    'Ask the AI Advisor',
    prompt: 'Act as my Digital CFO. Based on my business stage and revenue bracket, give me a 3-point financial health checklist I can complete this week.',
  },
  {
    icon:   <TrendingUp size={20} />,
    title:  'Price Engine',
    desc:   'AI-powered pricing recommendations calibrated to your sector and costs.',
    tag:    'Ask the AI Advisor',
    prompt: 'Act as my pricing strategist. Give me a framework for setting profitable prices in my sector that accounts for Nigerian market conditions and inflation.',
  },
  {
    icon:   <Bot size={20} />,
    title:  'Strategic AI Advisor',
    desc:   'Your on-demand business strategist — trained on Nigerian market conditions.',
    tag:    'Open Advisor',
    prompt: 'Hello, I am ready to scale my business. Where should I start?',
  },
];

// ─────────────────────────────────────────────────────────────────
// DASHBOARD NAV ITEMS
// ─────────────────────────────────────────────────────────────────
const NAV_ITEMS = [
  { id: 'home',    label: 'Business OS',  icon: <Home size={16} /> },
  { id: 'advisor', label: 'AI Advisor',   icon: <MessageSquare size={16} /> },
];

// ─────────────────────────────────────────────────────────────────
// ADVISOR CHAT — reusable component within the dashboard
// ─────────────────────────────────────────────────────────────────
const ADVISOR_DOWN_MSG = '__ADVISOR_DOWN__';

function AdvisorChat({ initialPrompt, onPromptConsumed }) {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'TBR Strategic AI active. Share your current business progress or expansion plans. How can I help you scale today?' },
  ]);
  const [input,     setInput]     = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const chatBoxRef     = useRef(null);
  const chatInteracted = useRef(false);
  const textareaRef    = useRef(null);

  // Auto-scroll chat box (not the page) when messages change
  useEffect(() => {
    if (chatInteracted.current && chatBoxRef.current) {
      chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  // If a pre-filled prompt arrives (from "Ask AI Advisor" button), send it
  useEffect(() => {
    if (!initialPrompt) return;
    chatInteracted.current = true;
    sendMessage(initialPrompt);
    if (onPromptConsumed) onPromptConsumed();
  }, [initialPrompt]);

  function scrollToTop()    { if (chatBoxRef.current) chatBoxRef.current.scrollTop = 0; }
  function scrollToBottom() { if (chatBoxRef.current) chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight; }

  async function sendMessage(text) {
    const userMessage = text.trim();
    if (!userMessage || isLoading) return;

    setInput('');
    chatInteracted.current = true;

    const newMessages = [...messages, { role: 'user', content: userMessage }];
    setMessages(newMessages);
    setIsLoading(true);

    try {
      const history = newMessages
        .slice(1)
        .slice(0, -1)
        .map(m => ({ role: m.role, content: m.content }));

      const response = await fetch('/api/advisor', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ message: userMessage, history }),
      });

      let data;
      try { data = await response.json(); }
      catch {
        setMessages(prev => [...prev, { role: 'assistant', content: ADVISOR_DOWN_MSG }]);
        return;
      }

      if (data.advisorDown || !data.text || !data.text.trim()) {
        setMessages(prev => [...prev, { role: 'assistant', content: ADVISOR_DOWN_MSG }]);
        return;
      }

      setMessages(prev => [...prev, { role: 'assistant', content: data.text }]);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: ADVISOR_DOWN_MSG }]);
    } finally {
      setIsLoading(false);
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    sendMessage(input);
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  }

  function renderMessageContent(text) {
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) =>
      part.startsWith('**') && part.endsWith('**')
        ? <strong key={i}>{part.slice(2, -2)}</strong>
        : part
    );
  }

  return (
    <div className="flex flex-col h-full">

      {/* Chat header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="bg-amber-500/10 p-2 rounded-xl">
            <Sparkles className="text-amber-500" size={18} />
          </div>
          <div>
            <p className="text-sm font-black uppercase tracking-widest text-white flex items-center gap-2">
              Strategic AI Advisor
              <span className="flex h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            </p>
            <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-tighter">TBR Intelligence Unit</p>
          </div>
        </div>
        <button
          onClick={() => {
            chatInteracted.current = false;
            setMessages([{ role: 'assistant', content: 'Chat history cleared. How can I assist?' }]);
          }}
          className="p-2.5 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-zinc-400 hover:text-white transition-all"
          title="Clear chat"
        >
          <RefreshCcw size={15} />
        </button>
      </div>

      {/* Scroll controls */}
      {messages.length > 3 && (
        <div className="flex justify-end gap-2 mb-3">
          <button onClick={scrollToTop}
            className="text-[9px] font-black uppercase tracking-widest text-zinc-600 hover:text-amber-500 transition px-2 py-1 bg-zinc-900 rounded-lg border border-zinc-800">
            ↑ Top
          </button>
          <button onClick={scrollToBottom}
            className="text-[9px] font-black uppercase tracking-widest text-zinc-600 hover:text-amber-500 transition px-2 py-1 bg-zinc-900 rounded-lg border border-zinc-800">
            ↓ Bottom
          </button>
        </div>
      )}

      {/* Messages */}
      <div ref={chatBoxRef} className="flex-1 overflow-y-auto space-y-5 mb-4 pr-1">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`flex gap-3 max-w-[88%] ${m.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1 ${
                m.role === 'user'
                  ? 'bg-amber-500 text-black'
                  : 'bg-zinc-800 text-amber-500 border border-zinc-700'
              }`}>
                {m.role === 'user' ? <User size={13} /> : <Bot size={13} />}
              </div>

              {m.content === ADVISOR_DOWN_MSG ? (
                <div className="p-4 rounded-2xl text-[11px] leading-relaxed bg-zinc-900 border border-zinc-700 text-zinc-400 flex items-start gap-3">
                  <span className="text-lg leading-none">🛠️</span>
                  <div>
                    <p className="font-black text-zinc-300 uppercase tracking-widest text-[9px] mb-1">Advisor Unavailable</p>
                    <p>The advisory is currently down. Please check back later — we're working on it.</p>
                  </div>
                </div>
              ) : (
                <div className={`p-4 rounded-2xl text-[11px] leading-relaxed whitespace-pre-wrap ${
                  m.role === 'user'
                    ? 'bg-amber-500 text-black font-bold'
                    : 'bg-zinc-900 border border-zinc-800 text-zinc-300'
                }`}>
                  {renderMessageContent(m.content)}
                </div>
              )}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex gap-3 items-center bg-zinc-900/50 p-4 rounded-2xl w-fit">
            <Loader2 size={14} className="text-amber-500 animate-spin" />
            <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Processing...</span>
          </div>
        )}
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="relative">
        <textarea
          ref={textareaRef}
          rows={1}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask your AI Advisor anything..."
          className="w-full bg-zinc-900 border border-zinc-700 focus:border-amber-500 rounded-2xl px-5 py-4 pr-14 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none transition resize-none"
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 bg-amber-500 hover:bg-amber-400 disabled:opacity-30 rounded-xl flex items-center justify-center transition-all"
        >
          <ArrowRight size={15} className="text-black" />
        </button>
      </form>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// ROADMAP PAGE — main dashboard
// ─────────────────────────────────────────────────────────────────
export default function RoadmapPage() {
  const location  = useLocation();
  const navigate  = useNavigate();
  const { user, isAuthenticated, isRestoring, logout } = useAuth();

  // ── Profile resolution ────────────────────────────────────────
  const routeState = location.state || {};
  const profile    = Object.keys(routeState).length > 0 ? routeState : (user || {});

  const {
    businessName = 'Your Business',
    fullName     = '',
    stage        = 'Launch',
    salesChannel = 'Social Media',
    revenue      = '',
    headache     = 'Tracking Cashflow',
  } = profile;

  // ── Auth guard ────────────────────────────────────────────────
  const hasRouteState = Object.keys(routeState).length > 0;

  useEffect(() => {
    if (isRestoring) return;
    if (!hasRouteState && !isAuthenticated) {
      navigate('/', { replace: true });
    }
  }, [isRestoring, isAuthenticated, hasRouteState, navigate]);

  if (isRestoring) return null;
  if (!hasRouteState && !isAuthenticated) return null;

  // ── Dashboard state ───────────────────────────────────────────
  const [activeView,    setActiveView]    = useState('home');
  const [menuOpen,      setMenuOpen]      = useState(false);
  const [loading,       setLoading]       = useState(true);
  const [loadMsg,       setLoadMsg]       = useState(`Analysing market signals for ${businessName}...`);
  const [insight,       setInsight]       = useState(null);

  // Pre-filled prompt to pass into AdvisorChat when navigating from a card
  const [advisorPrompt, setAdvisorPrompt] = useState('');

  // ── Loading animation + insight fetch ────────────────────────
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
      else { clearInterval(interval); fetchInsight(); }
    }, 600);
    return () => clearInterval(interval);
  }, []);

  async function fetchInsight() {
    try {
      const res  = await fetch('/roadmap-insight', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ businessName, stage, salesChannel, revenue, headache }),
      });
      const data = await res.json();
      setInsight(data.insight || FALLBACK[salesChannel] || FALLBACK['Social Media']);
    } catch {
      setInsight(FALLBACK[salesChannel] || FALLBACK['Social Media']);
    } finally {
      setLoading(false);
    }
  }

  // ── Open advisor with a pre-filled prompt ─────────────────────
  function openAdvisorWithPrompt(prompt) {
    setAdvisorPrompt(prompt);
    setActiveView('advisor');
    setMenuOpen(false);
  }

  // ── Handle logout ─────────────────────────────────────────────
  async function handleLogout() {
    setMenuOpen(false);
    await logout(navigate);
  }

  // ── Loading screen ────────────────────────────────────────────
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
    <div className="min-h-screen bg-black text-zinc-100 flex flex-col">

      {/* ── Dashboard Navigation ─────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-zinc-950/95 backdrop-blur-md border-b border-zinc-900">
        <div className="max-w-5xl mx-auto px-5 py-4 flex items-center justify-between">

          {/* Left — BusinessRun wordmark → goes home + logs out */}
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 group"
            title="Exit to home"
          >
            <span className="text-xs font-black uppercase tracking-widest text-amber-500 group-hover:text-amber-400 transition italic">
              BusinessRun
            </span>
            <LogOut size={11} className="text-zinc-600 group-hover:text-amber-400 transition" />
          </button>

          {/* Center — active view label */}
          <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
            {NAV_ITEMS.find(n => n.id === activeView)?.label}
          </span>

          {/* Right — hamburger */}
          <button
            onClick={() => setMenuOpen(o => !o)}
            className="w-9 h-9 flex items-center justify-center bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-xl transition-all"
            aria-label="Open menu"
          >
            {menuOpen ? <X size={16} className="text-white" /> : <Menu size={16} className="text-zinc-400" />}
          </button>
        </div>

        {/* Slide-down nav panel */}
        {menuOpen && (
          <div className="border-t border-zinc-900 bg-zinc-950">
            <div className="max-w-5xl mx-auto px-5 py-4 space-y-1">

              {NAV_ITEMS.map(item => (
                <button
                  key={item.id}
                  onClick={() => { setActiveView(item.id); setMenuOpen(false); }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                    activeView === item.id
                      ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                      : 'text-zinc-400 hover:bg-zinc-900 hover:text-white'
                  }`}
                >
                  {item.icon}
                  {item.label}
                  {activeView === item.id && (
                    <span className="ml-auto w-1.5 h-1.5 bg-amber-500 rounded-full" />
                  )}
                </button>
              ))}

              <div className="pt-2 border-t border-zinc-900 mt-2">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-black uppercase tracking-widest text-zinc-600 hover:text-red-400 hover:bg-red-500/5 transition-all"
                >
                  <LogOut size={16} />
                  Exit to Home
                </button>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* ── View: Business OS (Home) ─────────────────────────────── */}
      {activeView === 'home' && (
        <div className="flex-1 pb-20">

          {/* Dashboard header */}
          <div className="border-b border-zinc-900 bg-zinc-950">
            <div className="max-w-5xl mx-auto px-5 py-8">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span className="text-[10px] font-black uppercase tracking-widest text-green-500">
                  Business OS Initialised
                </span>
              </div>
              <h1 className="text-3xl md:text-4xl font-black tracking-tighter italic uppercase text-white mb-2">
                Welcome, {businessName}!
              </h1>
              <p className="text-zinc-500 text-sm">
                Your personalised Business OS is ready.{fullName && ` Built for ${fullName}.`}
              </p>
            </div>
          </div>

          <div className="max-w-5xl mx-auto px-5 py-10 space-y-8">

            {/* Priority Signal */}
            <div className="bg-amber-500 rounded-[2rem] px-8 py-7">
              <p className="text-[10px] font-black uppercase tracking-widest text-black/60 mb-2">
                {stage} Stage · Priority Signal
              </p>
              <p className="text-black font-black text-lg leading-snug">
                {currentInsight.prioritySignal}
              </p>
            </div>

            {/* Sector Intelligence */}
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

            {/* Headache Advice — Ask AI Advisor stays in dashboard */}
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
                  onClick={() => openAdvisorWithPrompt(
                    `I run a ${stage} stage ${salesChannel} business. My biggest headache is "${headache}". Give me a 3-step action plan to fix this in the next 30 days.`
                  )}
                  className="flex items-center gap-2 px-6 py-3 bg-amber-500 text-black font-black text-xs uppercase tracking-widest rounded-xl hover:bg-amber-400 transition"
                >
                  Ask AI Advisor <ArrowRight size={13} />
                </button>
              </div>
            </div>

            {/* AI Suite */}
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-zinc-600 mb-4">Your AI Suite</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {AI_SUITE.map((card, i) => (
                  <button
                    key={i}
                    onClick={() => openAdvisorWithPrompt(card.prompt)}
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
          </div>
        </div>
      )}

      {/* ── View: AI Advisor ─────────────────────────────────────── */}
      {activeView === 'advisor' && (
        <div className="flex-1 flex flex-col max-w-5xl mx-auto w-full px-5 py-8" style={{ minHeight: 0 }}>
          <div className="flex-1 bg-zinc-950 border border-zinc-800 rounded-[2rem] p-6 sm:p-8 flex flex-col" style={{ minHeight: '600px' }}>
            <AdvisorChat
              initialPrompt={advisorPrompt}
              onPromptConsumed={() => setAdvisorPrompt('')}
            />
          </div>
        </div>
      )}

    </div>
  );
}
