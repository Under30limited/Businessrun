/**
 * RoadmapPage.jsx — User Dashboard
 *
 * Three views managed by `activeView`:
 *   'home'    → Business OS (roadmap insight, AI suite cards) — default
 *   'advisor' → AI Advisor chat
 *   'cfo'     → Digital CFO (accounting tools, persistent entries, AI insight)
 *
 * On load:
 *   1. Auth guard — redirect to home if no session
 *   2. Load all CFO entries from /api/cfo/entries (parallel, fast)
 *   3. If entries exist → call /api/cfo/insight → replace generic insight cards
 *   4. If no entries    → show generic onboarding insight as before
 */

import React, {
  useState, useEffect, useRef, useCallback,
} from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import InventoryDashboard from './InventoryDashboard';
import SalesDayBook        from './SalesDayBook';
import {
  Zap, TrendingUp, DollarSign, Bot, User,
  CheckCircle, ArrowRight, Menu, X,
  Loader2, Home, Sparkles, RefreshCcw,
  LogOut, MessageSquare, Calculator, Package, Receipt,
  Plus, Trash2, AlertCircle,
  BookOpen, TrendingDown,
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────
const TOOLS = ['General Ledger', 'Income Statement', 'Balance Sheet', 'Cash Flow'];

const TOOL_META = {
  'General Ledger':   { icon: <BookOpen size={18} />,    desc: 'Track every transaction across all accounts.' },
  'Income Statement': { icon: <TrendingUp size={18} />,  desc: 'Revenue vs expenses — see if you\'re profitable.' },
  'Balance Sheet':    { icon: <DollarSign size={18} />,  desc: 'Assets, liabilities and equity at a glance.' },
  'Cash Flow':        { icon: <TrendingDown size={18} />, desc: 'Monitor money coming in and going out.' },
};

const CATEGORIES = {
  'General Ledger':   ['Revenue', 'Expense', 'Asset', 'Liability', 'Equity', 'Other'],
  'Income Statement': ['Revenue', 'Cost of Goods Sold', 'Operating Expense', 'Tax', 'Other Income'],
  'Balance Sheet':    ['Current Asset', 'Fixed Asset', 'Current Liability', 'Long-term Liability', 'Equity'],
  'Cash Flow':        ['Operating', 'Investing', 'Financing', 'Opening Balance'],
};

const NAV_ITEMS = [
  { id: 'home',      label: 'Business OS',  icon: <Home size={16} /> },
  { id: 'advisor',   label: 'AI Advisor',   icon: <MessageSquare size={16} /> },
  { id: 'cfo',       label: 'Digital CFO',  icon: <Calculator size={16} /> },
  { id: 'inventory', label: 'Inventory',    icon: <Package size={16} /> },
  { id: 'sales',     label: 'Sales',        icon: <Receipt size={16} /> },
];

const FALLBACK_INSIGHT = {
  'Social Media': {
    prioritySignal: 'Turn followers into paying customers — build a DM-to-invoice funnel this week.',
    sectorFocus:    'Conversion Rate & Brand Trust',
    sectorDetail:   'Your primary risk is invisible — followers who never buy. Build a structured follow-up funnel from DM to invoice within 48 hours. Nigerian consumers buy from people they trust, not brands they scroll past.',
    weeklyAction:   'Set up a WhatsApp Business catalogue with pricing and pin your best offer today.',
    headacheAdvice: 'Social sellers often price emotionally. Run a proper cost-plus-margin calculation using the Digital CFO. Never quote a price without knowing your floor first.',
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
    sectorDetail:   'Most Nigerian e-commerce stores lose 60–70% of potential revenue at checkout. Your conversion rate matters more than your traffic.',
    weeklyAction:   'Audit your checkout flow on mobile. If it takes more than 3 taps to pay, fix it.',
    headacheAdvice: 'E-commerce cashflow is often destroyed by logistics costs eating into margin. Map your true delivery cost per order using the Digital CFO Cash Flow tool.',
  },
  'B2B/Referrals': {
    prioritySignal: 'Long payment cycles are killing your cashflow — set a 30-day maximum today.',
    sectorFocus:    'Pipeline Visibility & Invoice Cycle',
    sectorDetail:   'B2B businesses often show strong revenue on paper but suffer from chronic cash shortages. Net-60 and net-90 payment terms should not be your normal.',
    weeklyAction:   'Follow up on every outstanding invoice older than 14 days before end of week.',
    headacheAdvice: 'B2B credit access improves with clean, audited financials. Start logging entries in the Digital CFO — banks want to see 6 months of records.',
  },
};

const ADVISOR_DOWN_MSG = '__ADVISOR_DOWN__';
const inputClass = 'w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500 transition-colors';
const emptyEntry = () => ({ date: '', description: '', amount: '', category: '' });

// ─────────────────────────────────────────────────────────────────
// AI ADVISOR CHAT COMPONENT
// ─────────────────────────────────────────────────────────────────
function AdvisorChat({ initialPrompt, onPromptConsumed }) {
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'TBR Strategic AI active. Share your current business progress or expansion plans. How can I help you scale today?' },
  ]);
  const [input,     setInput]     = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const chatBoxRef     = useRef(null);
  const chatInteracted = useRef(false);

  useEffect(() => {
    if (chatInteracted.current && chatBoxRef.current) {
      chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  useEffect(() => {
    if (!initialPrompt) return;
    chatInteracted.current = true;
    sendMessage(initialPrompt);
    if (onPromptConsumed) onPromptConsumed();
  }, [initialPrompt]);

  function renderMessageContent(text) {
    return text.split(/(\*\*.*?\*\*)/g).map((part, i) =>
      part.startsWith('**') && part.endsWith('**')
        ? <strong key={i}>{part.slice(2, -2)}</strong>
        : part
    );
  }

  async function sendMessage(text) {
    const msg = text.trim();
    if (!msg || isLoading) return;
    setInput('');
    chatInteracted.current = true;
    const next = [...messages, { role: 'user', content: msg }];
    setMessages(next);
    setIsLoading(true);
    try {
      const history = next.slice(1).slice(0, -1).map(m => ({ role: m.role, content: m.content }));
      const res  = await fetch('/api/advisor', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: msg, history }),
      });
      let data;
      try { data = await res.json(); } catch { setMessages(p => [...p, { role: 'assistant', content: ADVISOR_DOWN_MSG }]); return; }
      if (data.advisorDown || !data.text?.trim()) { setMessages(p => [...p, { role: 'assistant', content: ADVISOR_DOWN_MSG }]); return; }
      setMessages(p => [...p, { role: 'assistant', content: data.text }]);
    } catch { setMessages(p => [...p, { role: 'assistant', content: ADVISOR_DOWN_MSG }]); }
    finally  { setIsLoading(false); }
  }

  return (
    <div className="flex flex-col h-full" style={{ minHeight: '70vh' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
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
        <button onClick={() => { chatInteracted.current = false; setMessages([{ role: 'assistant', content: 'Chat cleared. How can I assist?' }]); }}
          className="p-2.5 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-zinc-400 hover:text-white transition-all" title="Clear chat">
          <RefreshCcw size={15} />
        </button>
      </div>

      {/* Messages — flex-1 scrollable */}
      <div ref={chatBoxRef} className="flex-1 overflow-y-auto space-y-5 mb-4 pr-1">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`flex gap-3 max-w-[88%] ${m.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1 ${m.role === 'user' ? 'bg-amber-500 text-black' : 'bg-zinc-800 text-amber-500 border border-zinc-700'}`}>
                {m.role === 'user' ? <User size={13} /> : <Bot size={13} />}
              </div>
              {m.content === ADVISOR_DOWN_MSG ? (
                <div className="p-4 rounded-2xl text-[11px] leading-relaxed bg-zinc-900 border border-zinc-700 text-zinc-400 flex items-start gap-3">
                  <span className="text-lg">🛠️</span>
                  <div>
                    <p className="font-black text-zinc-300 uppercase tracking-widest text-[9px] mb-1">Advisor Unavailable</p>
                    <p>The advisory is currently down. Please try again shortly.</p>
                  </div>
                </div>
              ) : (
                <div className={`p-4 rounded-2xl text-[11px] leading-relaxed whitespace-pre-wrap ${m.role === 'user' ? 'bg-amber-500 text-black font-bold' : 'bg-zinc-900 border border-zinc-800 text-zinc-300'}`}>
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

      {/* Input — pinned at bottom */}
      <div className="mt-auto">
        <form onSubmit={e => { e.preventDefault(); sendMessage(input); }} className="relative">
          <textarea rows={1}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(input); } }}
            placeholder="Ask your AI Advisor anything..."
            className="w-full bg-zinc-900 border border-zinc-700 focus:border-amber-500 rounded-2xl px-5 py-4 pr-14 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none transition resize-none"
          />
          <button type="submit" disabled={isLoading || !input.trim()}
            className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 bg-amber-500 hover:bg-amber-400 disabled:opacity-30 rounded-xl flex items-center justify-center transition-all">
            <ArrowRight size={15} className="text-black" />
          </button>
        </form>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// DIGITAL CFO COMPONENT
// ─────────────────────────────────────────────────────────────────
function DigitalCFO({ uid, allEntries, setAllEntries }) {
  const [activeTool,  setActiveTool]  = useState('General Ledger');
  const [input,       setInput]       = useState(emptyEntry());
  const [report,      setReport]      = useState(null);
  const [isLoading,   setIsLoading]   = useState(false);
  const [isSaving,    setIsSaving]    = useState(false);
  const [error,       setError]       = useState('');
  const [inputError,  setInputError]  = useState('');
  const [advisorDown, setAdvisorDown] = useState(false);

  // Entries for the currently active tool
  const transactions = allEntries[activeTool] || [];

  function switchTool(tool) {
    setActiveTool(tool);
    setReport(null);
    setError('');
    setInputError('');
    setAdvisorDown(false);
    setInput(emptyEntry());
  }

  // Compute local totals for display
  const localTotals = transactions.reduce((acc, t) => {
    const isCredit = ['Revenue', 'Operating', 'Current Asset', 'Fixed Asset',
      'Asset', 'Other Income', 'Opening Balance', 'Investing', 'Financing'].includes(t.category);
    if (isCredit) acc.credits += t.amount;
    else          acc.debits  += t.amount;
    return acc;
  }, { credits: 0, debits: 0 });

  // Save entry to Firestore via API
  async function addEntry() {
    if (!input.date)                                    { setInputError('Date is required.');       return; }
    if (!input.description.trim())                      { setInputError('Description is required.'); return; }
    if (!input.amount || isNaN(+input.amount) || +input.amount === 0)
                                                        { setInputError('Enter a valid amount.');    return; }
    if (!input.category)                                { setInputError('Select a category.');       return; }
    setInputError('');
    setIsSaving(true);
    try {
      const res  = await fetch('/api/cfo/entries', {
        method:      'POST',
        credentials: 'include',
        headers:     { 'Content-Type': 'application/json' },
        body: JSON.stringify({ toolName: activeTool, ...input, amount: parseFloat(input.amount) }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) { setError(data.message || 'Could not save entry.'); return; }

      // Append the server-returned entry (has the id we need for deletion)
      setAllEntries(prev => ({
        ...prev,
        [activeTool]: [...(prev[activeTool] || []), data.entry],
      }));
      setInput(emptyEntry());
      setReport(null);
    } catch { setError('Network error. Please try again.'); }
    finally  { setIsSaving(false); }
  }

  // Delete entry from Firestore
  async function removeEntry(entryId) {
    try {
      const res = await fetch(
        `/api/cfo/entries/${entryId}?toolName=${encodeURIComponent(activeTool)}`,
        { method: 'DELETE', credentials: 'include' }
      );
      if (!res.ok) { setError('Could not delete entry.'); return; }
      setAllEntries(prev => ({
        ...prev,
        [activeTool]: (prev[activeTool] || []).filter(e => e.id !== entryId),
      }));
      setReport(null);
    } catch { setError('Network error. Please try again.'); }
  }

  // Generate AI report for current tool
  async function generateReport() {
    if (transactions.length === 0) { setError('Add at least one entry before generating a report.'); return; }
    setIsLoading(true); setError(''); setAdvisorDown(false); setReport(null);
    try {
      const res  = await fetch('/api/accounting', {
        method:      'POST',
        credentials: 'include',
        headers:     { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactions, activeTool }),
      });
      let data;
      try { data = await res.json(); } catch { setAdvisorDown(true); return; }
      if (data.advisorDown || !data.result) { setAdvisorDown(true); return; }
      setReport(data.result);
    } catch { setAdvisorDown(true); }
    finally  { setIsLoading(false); }
  }

  const categories = CATEGORIES[activeTool];

  return (
    <div className="space-y-8 pb-20">

      {/* Header */}
      <div className="border-b border-zinc-900 -mx-5 px-5 pb-8">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-black tracking-tighter italic uppercase mb-2">Digital CFO</h1>
            <p className="text-zinc-500 text-sm">Your AI-powered financial command centre. Entries are saved to your account.</p>
          </div>
          <span className="text-[9px] font-black uppercase tracking-widest text-amber-500 bg-amber-500/10 px-4 py-2 rounded-full border border-amber-500/20 self-start">
            AI Powered
          </span>
        </div>
      </div>

      {/* Tool Tabs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {TOOLS.map(tool => {
          const count = (allEntries[tool] || []).length;
          return (
            <button key={tool} onClick={() => switchTool(tool)}
              className={`p-4 rounded-2xl border text-left transition-all relative ${
                activeTool === tool
                  ? 'bg-amber-500/10 border-amber-500/40 text-amber-500'
                  : 'bg-zinc-950 border-zinc-800 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300'
              }`}>
              {count > 0 && (
                <span className="absolute top-3 right-3 w-5 h-5 bg-amber-500 text-black text-[9px] font-black rounded-full flex items-center justify-center">
                  {count > 99 ? '99+' : count}
                </span>
              )}
              <div className="mb-2">{TOOL_META[tool].icon}</div>
              <p className="text-[11px] font-black uppercase tracking-widest leading-tight mb-1">{tool}</p>
              <p className="text-[10px] leading-relaxed opacity-70">{TOOL_META[tool].desc}</p>
            </button>
          );
        })}
      </div>

      {/* Entry Form */}
      <div className="bg-zinc-950 border border-zinc-900 rounded-[2rem] overflow-hidden">
        <div className="border-b border-zinc-900 px-8 py-5 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-black italic uppercase">{activeTool}</h2>
            <p className="text-zinc-600 text-xs mt-0.5">
              {transactions.length} saved {transactions.length === 1 ? 'entry' : 'entries'} — changes sync to your account
            </p>
          </div>
          <div className="w-10 h-10 bg-amber-500/10 rounded-xl flex items-center justify-center text-amber-500 border border-amber-500/20">
            <Calculator size={18} />
          </div>
        </div>

        <div className="p-8 space-y-6">
          {/* Input fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">Date</label>
              <input type="date" value={input.date} onChange={e => setInput(p => ({ ...p, date: e.target.value }))} className={inputClass} />
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">Category</label>
              <select value={input.category} onChange={e => setInput(p => ({ ...p, category: e.target.value }))} className={inputClass + ' appearance-none cursor-pointer'}>
                <option value="">Select category...</option>
                {categories.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">Description</label>
              <input type="text" placeholder="e.g. Sales revenue from client" value={input.description} onChange={e => setInput(p => ({ ...p, description: e.target.value }))} className={inputClass} />
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">Amount (₦)</label>
              <input type="number" placeholder="e.g. 250000" value={input.amount} onChange={e => setInput(p => ({ ...p, amount: e.target.value }))} className={inputClass} />
            </div>
          </div>

          {inputError && (
            <div className="flex items-center gap-2 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl">
              <AlertCircle size={13} className="text-red-400 shrink-0" />
              <p className="text-red-400 text-xs">{inputError}</p>
            </div>
          )}

          <button onClick={addEntry} disabled={isSaving}
            className="flex items-center gap-2 px-6 py-3 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-200 hover:text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all">
            {isSaving ? <><Loader2 size={13} className="animate-spin" /> Saving...</> : <><Plus size={14} /> Add Entry</>}
          </button>

          {/* Entries table */}
          {transactions.length > 0 && (
            <div className="border border-zinc-800 rounded-2xl overflow-hidden">
              <div className="grid grid-cols-[1fr_1fr_auto_auto] bg-zinc-900 px-4 py-2 gap-4">
                {['Date', 'Description / Category', 'Amount', ''].map((h, i) => (
                  <p key={i} className="text-[9px] font-black uppercase tracking-widest text-zinc-600">{h}</p>
                ))}
              </div>
              <div className="divide-y divide-zinc-900">
                {transactions.map((t) => (
                  <div key={t.id} className="grid grid-cols-[1fr_1fr_auto_auto] items-center px-4 py-3 gap-4 hover:bg-zinc-900/30 transition">
                    <span className="text-xs text-zinc-500 font-mono">{t.date}</span>
                    <div>
                      <p className="text-xs text-zinc-200">{t.description}</p>
                      <p className="text-[10px] text-zinc-600 mt-0.5">{t.category}</p>
                    </div>
                    <span className="text-xs font-black font-mono text-white">₦{Number(t.amount).toLocaleString()}</span>
                    <button onClick={() => removeEntry(t.id)} className="text-zinc-700 hover:text-red-400 transition">
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-3 px-4 py-3 bg-zinc-900/60 border-t border-zinc-800">
                <div className="flex justify-between items-center px-3 py-2 bg-green-500/5 border border-green-500/20 rounded-xl">
                  <span className="text-[10px] font-black uppercase tracking-widest text-green-500/70">Credits</span>
                  <span className="text-sm font-black text-green-400">₦{localTotals.credits.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center px-3 py-2 bg-red-500/5 border border-red-500/20 rounded-xl">
                  <span className="text-[10px] font-black uppercase tracking-widest text-red-400/70">Debits</span>
                  <span className="text-sm font-black text-red-400">₦{localTotals.debits.toLocaleString()}</span>
                </div>
              </div>
            </div>
          )}

          {transactions.length > 0 && (
            <button onClick={generateReport} disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 py-4 bg-amber-500 text-black font-black text-xs uppercase tracking-widest rounded-xl hover:bg-amber-400 transition-all active:scale-95 disabled:opacity-50">
              {isLoading
                ? <><Loader2 size={16} className="animate-spin" /> Generating Report...</>
                : <><Calculator size={16} /> Generate AI Report</>}
            </button>
          )}

          {error && (
            <div className="flex items-center gap-2 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl">
              <AlertCircle size={13} className="text-red-400 shrink-0" />
              <p className="text-red-400 text-xs">{error}</p>
            </div>
          )}

          {advisorDown && (
            <div className="flex items-start gap-3 px-4 py-4 bg-zinc-900 border border-zinc-700 rounded-2xl">
              <span className="text-lg">🛠️</span>
              <div>
                <p className="font-black text-zinc-300 uppercase tracking-widest text-[9px] mb-1">Service Unavailable</p>
                <p className="text-zinc-400 text-xs leading-relaxed">The AI report engine is currently down. Your entries are saved — please try again shortly.</p>
              </div>
            </div>
          )}

          {/* Report */}
          {report && (
            <div className="space-y-4 border-t border-zinc-800 pt-8">
              <p className="text-[9px] font-black uppercase tracking-widest text-zinc-600">AI Report — {activeTool}</p>
              {report.totals && Object.keys(report.totals).length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {report.totals.revenue    !== undefined && <div className="bg-green-500/5 border border-green-500/20 rounded-xl px-4 py-3"><p className="text-[9px] font-black uppercase tracking-widest text-green-500/70 mb-1">Total Revenue</p><p className="text-lg font-black text-green-400">₦{Number(report.totals.revenue).toLocaleString()}</p></div>}
                  {report.totals.expenses   !== undefined && <div className="bg-red-500/5 border border-red-500/20 rounded-xl px-4 py-3"><p className="text-[9px] font-black uppercase tracking-widest text-red-400/70 mb-1">Total Expenses</p><p className="text-lg font-black text-red-400">₦{Number(report.totals.expenses).toLocaleString()}</p></div>}
                  {report.totals.netIncome  !== undefined && <div className="bg-amber-500 rounded-xl px-4 py-3"><p className="text-[9px] font-black uppercase tracking-widest text-black/60 mb-1">Net Income</p><p className="text-lg font-black text-black">₦{Number(report.totals.netIncome).toLocaleString()}</p></div>}
                  {report.totals.assets     !== undefined && <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl px-4 py-3"><p className="text-[9px] font-black uppercase tracking-widest text-blue-400/70 mb-1">Total Assets</p><p className="text-lg font-black text-blue-400">₦{Number(report.totals.assets).toLocaleString()}</p></div>}
                  {report.totals.liabilities !== undefined && <div className="bg-orange-500/5 border border-orange-500/20 rounded-xl px-4 py-3"><p className="text-[9px] font-black uppercase tracking-widest text-orange-400/70 mb-1">Total Liabilities</p><p className="text-lg font-black text-orange-400">₦{Number(report.totals.liabilities).toLocaleString()}</p></div>}
                </div>
              )}
              {report.audit   && <div className="px-5 py-4 bg-zinc-900 border border-zinc-800 rounded-2xl"><p className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-2">Audit Check</p><p className="text-sm text-zinc-300 leading-relaxed">{report.audit}</p></div>}
              {report.insight && <div className="px-5 py-4 bg-amber-500/5 border border-amber-500/20 rounded-2xl"><p className="text-[9px] font-black uppercase tracking-widest text-amber-500 mb-2">Strategic Insight</p><p className="text-sm text-zinc-300 leading-relaxed">{report.insight}</p></div>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// AI SUITE CARDS
// ─────────────────────────────────────────────────────────────────
const AI_SUITE = [
  {
    icon:   <DollarSign size={20} />,
    title:  'Digital CFO',
    desc:   'Real-time margin tracking, tax position, and runway analysis for your business.',
    tag:    'Open Digital CFO',
    view:   'cfo',
    prompt: null,
  },
  {
    icon:   <TrendingUp size={20} />,
    title:  'Price Engine',
    desc:   'AI-powered pricing recommendations calibrated to your sector and costs.',
    tag:    'Ask the AI Advisor',
    view:   'advisor',
    prompt: 'Act as my pricing strategist. Give me a framework for setting profitable prices in my sector that accounts for Nigerian market conditions and inflation.',
  },
  {
    icon:   <Bot size={20} />,
    title:  'Strategic AI Advisor',
    desc:   'Your on-demand business strategist — trained on Nigerian market conditions.',
    tag:    'Open Advisor',
    view:   'advisor',
    prompt: 'Hello, I am ready to scale my business. Where should I start?',
  },
];

// ─────────────────────────────────────────────────────────────────
// MAIN DASHBOARD
// ─────────────────────────────────────────────────────────────────
export default function RoadmapPage() {
  const location  = useLocation();
  const navigate  = useNavigate();
  const { user, isAuthenticated, isRestoring, logout } = useAuth();

  // ── Profile resolution ────────────────────────────────────────
  const routeState = location.state || {};
  const profile    = Object.keys(routeState).length > 0 ? routeState : (user || {});
  const { businessName = 'Your Business', fullName = '', stage = 'Launch', salesChannel = 'Social Media', revenue = '', headache = 'Tracking Cashflow' } = profile;

  // ── ALL STATE — must be before any conditional returns ──────────
  // React requires hooks to be called in the same order every render.
  // Putting useState after an early return violates this rule and
  // causes blank screens when the early return condition changes.
  const [activeView,     setActiveView]     = useState('home');
  const [menuOpen,       setMenuOpen]       = useState(false);
  const [loading,        setLoading]        = useState(true);
  const [loadMsg,        setLoadMsg]        = useState(`Analysing market signals for ${businessName}...`);
  const [genericInsight, setGenericInsight] = useState(null);
  const [cfoInsight,     setCfoInsight]     = useState(null);
  const [cfoRefreshing,  setCfoRefreshing]  = useState(false);
  const [allEntries,     setAllEntries]     = useState({
    'General Ledger': [], 'Income Statement': [], 'Balance Sheet': [], 'Cash Flow': [],
  });
  const [entriesLoaded,  setEntriesLoaded]  = useState(false);
  const [advisorPrompt,  setAdvisorPrompt]  = useState('');
  const [inventoryItems, setInventoryItems] = useState([]);
  const [sales,          setSales]          = useState([]);

  // ── Auth guard ────────────────────────────────────────────────
  const hasRouteState = Object.keys(routeState).length > 0;
  useEffect(() => {
    if (isRestoring) return;
    if (!hasRouteState && !isAuthenticated) navigate('/', { replace: true });
  }, [isRestoring, isAuthenticated, hasRouteState, navigate]);

  // ── Load generic roadmap insight ─────────────────────────────
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
      else { clearInterval(interval); fetchGenericInsight(); }
    }, 600);
    return () => clearInterval(interval);
  }, []);

  async function fetchGenericInsight() {
    try {
      const res  = await fetch('/api/roadmap-insight', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessName, stage, salesChannel, revenue, headache }),
      });
      const data = await res.json();
      setGenericInsight(data.insight || FALLBACK_INSIGHT[salesChannel] || FALLBACK_INSIGHT['Social Media']);
    } catch {
      setGenericInsight(FALLBACK_INSIGHT[salesChannel] || FALLBACK_INSIGHT['Social Media']);
    } finally {
      setLoading(false);
    }
  }

  // ── Load CFO entries on mount ─────────────────────────────────
  useEffect(() => {
    const uid = user?.uid || profile?.uid;
    if (!uid) { setEntriesLoaded(true); return; }

    async function loadEntries() {
      try {
        // Load CFO entries, inventory, and sales in parallel — one round trip
        const [cfoRes, invRes, salesRes] = await Promise.all([
          fetch('/api/cfo/entries',  { credentials: 'include' }),
          fetch('/api/inventory',    { credentials: 'include' }),
          fetch('/api/sales',        { credentials: 'include' }),
        ]);

        const [cfoData, invData, salesData] = await Promise.all([
          cfoRes.json(),
          invRes.json(),
          salesRes.json(),
        ]);

        if (cfoData.success && cfoData.entries) {
          setAllEntries(cfoData.entries);
          const total = Object.values(cfoData.entries).reduce((s, a) => s + a.length, 0);
          if (total > 0) fetchCFOInsight(cfoData.entries);
        }

        if (invData.success && invData.items) {
          setInventoryItems(invData.items);
        }

        if (salesData.success && salesData.sales) {
          setSales(salesData.sales);
        }
      } catch {
        // Silent fail — fall back to generic insight, empty inventory
      } finally {
        setEntriesLoaded(true);
      }
    }

    loadEntries();
  }, []);

  // ── Fetch CFO-informed insight ────────────────────────────────
  async function fetchCFOInsight(entries) {
    setCfoRefreshing(true);
    try {
      const res  = await fetch('/api/cfo/insight', {
        method:      'POST',
        credentials: 'include',
        headers:     { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profile: { businessName, stage, salesChannel, headache } }),
      });
      const data = await res.json();
      if (data.success && data.insight) setCfoInsight(data.insight);
    } catch {
      // Silent fail — generic insight stays visible
    } finally {
      setCfoRefreshing(false);
    }
  }

  // Active insight: CFO-informed when available, generic otherwise
  const activeInsight = cfoInsight
    || genericInsight
    || FALLBACK_INSIGHT[salesChannel]
    || FALLBACK_INSIGHT['Social Media'];

  const totalEntries = Object.values(allEntries).reduce((s, a) => s + a.length, 0);

  // ── Navigation helpers ────────────────────────────────────────
  function openAdvisorWithPrompt(prompt) {
    setAdvisorPrompt(prompt);
    setActiveView('advisor');
    setMenuOpen(false);
  }

  function openView(viewId) {
    setActiveView(viewId);
    setMenuOpen(false);
  }

  async function handleLogout() {
    setMenuOpen(false);
    await logout(navigate);
  }

  // ── Session restoring screen ─────────────────────────────────
  // Shown while /api/auth/me is in flight on page refresh.
  // Must come AFTER all hooks — conditional returns before hooks
  // cause React to panic (different hook count between renders).
  if (isRestoring) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center px-6 text-center">
        <div className="w-16 h-16 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center justify-center mb-8 animate-pulse">
          <Zap size={28} className="text-amber-500" />
        </div>
        <p className="text-zinc-500 text-xs font-black uppercase tracking-widest mb-3">
          BusinessRun OS
        </p>
        <p className="text-white text-lg font-black mb-6">Restoring your session...</p>
        <div className="flex gap-1.5">
          {[0, 1, 2].map(i => (
            <div key={i} className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-bounce"
              style={{ animationDelay: i * 0.15 + 's' }} />
          ))}
        </div>
      </div>
    );
  }

  // Redirect guard — no session and no route state means
  // unauthenticated direct URL visit — show nothing while
  // the useEffect above fires the navigate() to home
  if (!hasRouteState && !isAuthenticated) return null;

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
            <div key={i} className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black text-zinc-100 flex flex-col">

      {/* ── Dashboard Navigation ─────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-zinc-950/95 backdrop-blur-md border-b border-zinc-900">
        <div className="max-w-5xl mx-auto px-5 py-4 flex items-center justify-between">
          <button onClick={handleLogout} className="flex items-center gap-2 group" title="Exit to home">
            <span className="text-xs font-black uppercase tracking-widest text-amber-500 group-hover:text-amber-400 transition italic">BusinessRun</span>
            <LogOut size={11} className="text-zinc-600 group-hover:text-amber-400 transition" />
          </button>
          <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
            {NAV_ITEMS.find(n => n.id === activeView)?.label}
          </span>
          <button onClick={() => setMenuOpen(o => !o)}
            className="w-9 h-9 flex items-center justify-center bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 rounded-xl transition-all"
            aria-label="Toggle menu">
            {menuOpen ? <X size={16} className="text-white" /> : <Menu size={16} className="text-zinc-400" />}
          </button>
        </div>

        {/* Slide-down nav panel */}
        {menuOpen && (
          <div className="border-t border-zinc-900 bg-zinc-950">
            <div className="max-w-5xl mx-auto px-5 py-4 space-y-1">
              {NAV_ITEMS.map(item => (
                <button key={item.id} onClick={() => openView(item.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                    activeView === item.id
                      ? 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                      : 'text-zinc-400 hover:bg-zinc-900 hover:text-white'
                  }`}>
                  {item.icon}
                  {item.label}
                  {item.id === 'cfo' && totalEntries > 0 && (
                    <span className="ml-1 w-5 h-5 bg-amber-500 text-black text-[9px] font-black rounded-full flex items-center justify-center">
                      {totalEntries > 99 ? '99+' : totalEntries}
                    </span>
                  )}
                  {item.id === 'inventory' && inventoryItems.length > 0 && (
                    <span className="ml-1 w-5 h-5 bg-amber-500 text-black text-[9px] font-black rounded-full flex items-center justify-center">
                      {inventoryItems.length > 99 ? '99+' : inventoryItems.length}
                    </span>
                  )}
                  {item.id === 'sales' && sales.length > 0 && (
                    <span className="ml-1 w-5 h-5 bg-amber-500 text-black text-[9px] font-black rounded-full flex items-center justify-center">
                      {sales.length > 99 ? '99+' : sales.length}
                    </span>
                  )}
                  {activeView === item.id && <span className="ml-auto w-1.5 h-1.5 bg-amber-500 rounded-full" />}
                </button>
              ))}
              <div className="pt-2 border-t border-zinc-900 mt-2">
                <button onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-black uppercase tracking-widest text-zinc-600 hover:text-red-400 hover:bg-red-500/5 transition-all">
                  <LogOut size={16} /> Exit to Home
                </button>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* ── View: Business OS ─────────────────────────────────── */}
      {activeView === 'home' && (
        <div className="flex-1 pb-20">
          <div className="border-b border-zinc-900 bg-zinc-950">
            <div className="max-w-5xl mx-auto px-5 py-8">
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

          <div className="max-w-5xl mx-auto px-5 py-10 space-y-8">

            {/* CFO Refreshing indicator */}
            {cfoRefreshing && (
              <div className="flex items-center gap-3 px-5 py-3 bg-amber-500/5 border border-amber-500/20 rounded-2xl">
                <Loader2 size={14} className="text-amber-500 animate-spin shrink-0" />
                <p className="text-xs font-black uppercase tracking-widest text-amber-500">Refreshing insights from your financial data...</p>
              </div>
            )}

            {/* CFO data badge */}
            {cfoInsight && !cfoRefreshing && (
              <div className="flex items-center gap-2 px-4 py-2 bg-green-500/5 border border-green-500/20 rounded-xl w-fit">
                <CheckCircle size={12} className="text-green-400" />
                <span className="text-[10px] font-black uppercase tracking-widest text-green-400">
                  Insights updated from your {totalEntries} CFO {totalEntries === 1 ? 'entry' : 'entries'}
                </span>
              </div>
            )}

            {/* Priority Signal */}
            <div className="bg-amber-500 rounded-[2rem] px-8 py-7">
              <p className="text-[10px] font-black uppercase tracking-widest text-black/60 mb-2">
                {stage} Stage · Priority Signal {cfoInsight ? '· CFO Informed' : ''}
              </p>
              <p className="text-black font-black text-lg leading-snug">{activeInsight.prioritySignal}</p>
            </div>

            {/* Sector Intelligence */}
            <div className="bg-zinc-950 border border-zinc-800 rounded-[2rem] overflow-hidden">
              <div className="border-b border-zinc-900 px-8 py-5 flex items-center justify-between">
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-amber-500 mb-1">
                    {cfoInsight ? 'Financial Intelligence' : 'Sector Intelligence'}
                  </p>
                  <h2 className="text-white font-black text-lg">{salesChannel} · {activeInsight.sectorFocus}</h2>
                </div>
                <span className="text-2xl">{cfoInsight ? '📈' : '📊'}</span>
              </div>
              <div className="px-8 py-7 space-y-4">
                <p className="text-zinc-400 text-sm leading-relaxed">{activeInsight.sectorDetail}</p>
                <div className="flex items-start gap-3 bg-zinc-900 rounded-xl px-4 py-3">
                  <CheckCircle size={14} className="text-green-400 mt-0.5 shrink-0" />
                  <p className="text-sm text-zinc-300 leading-relaxed">
                    <strong className="text-white">Action this week:</strong> {activeInsight.weeklyAction}
                  </p>
                </div>
              </div>
            </div>

            {/* Headache Advice */}
            <div className="bg-zinc-950 border border-zinc-800 rounded-[2rem] overflow-hidden">
              <div className="border-b border-zinc-900 px-8 py-5">
                <p className="text-[9px] font-black uppercase tracking-widest text-amber-500 mb-1">Operational Fix</p>
                <h2 className="text-white font-black text-lg">
                  Your headache: <span className="text-zinc-400 font-normal">{headache}</span>
                </h2>
              </div>
              <div className="px-8 py-7 space-y-4">
                <p className="text-zinc-400 text-sm leading-relaxed">{activeInsight.headacheAdvice}</p>
                <button
                  onClick={() => openAdvisorWithPrompt(
                    `I run a ${stage} stage ${salesChannel} business. My biggest headache is "${headache}". Give me a 3-step action plan to fix this in the next 30 days.`
                  )}
                  className="flex items-center gap-2 px-6 py-3 bg-amber-500 text-black font-black text-xs uppercase tracking-widest rounded-xl hover:bg-amber-400 transition">
                  Ask AI Advisor <ArrowRight size={13} />
                </button>
              </div>
            </div>

            {/* AI Suite */}
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-zinc-600 mb-4">Your AI Suite</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {AI_SUITE.map((card, i) => (
                  <button key={i}
                    onClick={() => {
                      if (card.view === 'cfo') { openView('cfo'); }
                      else { openAdvisorWithPrompt(card.prompt); }
                    }}
                    className="bg-zinc-950 border border-zinc-800 hover:border-amber-500/40 rounded-2xl p-6 flex flex-col gap-3 transition-all text-left cursor-pointer group">
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

      {/* ── View: AI Advisor ──────────────────────────────────── */}
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

      {/* ── View: Digital CFO ─────────────────────────────────── */}
      {activeView === 'cfo' && (
        <div className="flex-1 max-w-5xl mx-auto w-full px-5 py-8">
          <DigitalCFO
            uid={user?.uid || profile?.uid}
            allEntries={allEntries}
            setAllEntries={(updater) => {
              setAllEntries(updater);
              setTimeout(() => {
                setAllEntries(current => {
                  const total = Object.values(current).reduce((s, a) => s + a.length, 0);
                  if (total > 0) fetchCFOInsight(current);
                  return current;
                });
              }, 500);
            }}
          />
        </div>
      )}

      {/* ── View: Inventory ───────────────────────────────────── */}
      {activeView === 'inventory' && (
        <div className="flex-1 max-w-5xl mx-auto w-full px-5 py-8">
          <InventoryDashboard
            items={inventoryItems}
            setItems={setInventoryItems}
          />
        </div>
      )}

      {/* ── View: Sales Day Book ──────────────────────────────── */}
      {activeView === 'sales' && (
        <div className="flex-1 max-w-5xl mx-auto w-full px-5 py-8">
          <SalesDayBook
            sales={sales}
            setSales={setSales}
            inventoryItems={inventoryItems}
            setInventoryItems={setInventoryItems}
          />
        </div>
      )}

    </div>
  );
}
