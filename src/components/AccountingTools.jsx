import React, { useState } from 'react';
import { ArrowLeft, Loader2, Calculator, Plus, Trash2, AlertCircle, TrendingUp, TrendingDown, DollarSign, BookOpen } from 'lucide-react';

const TOOLS = ['General Ledger', 'Income Statement', 'Balance Sheet', 'Cash Flow'];

const TOOL_META = {
  'General Ledger':    { icon: <BookOpen size={18} />,    desc: 'Track every transaction across all accounts.' },
  'Income Statement':  { icon: <TrendingUp size={18} />,  desc: 'Revenue vs expenses — see if you\'re profitable.' },
  'Balance Sheet':     { icon: <DollarSign size={18} />,  desc: 'Assets, liabilities and equity at a glance.' },
  'Cash Flow':         { icon: <TrendingDown size={18} />, desc: 'Monitor money coming in and going out.' },
};

const CATEGORIES = {
  'General Ledger':   ['Revenue', 'Expense', 'Asset', 'Liability', 'Equity', 'Other'],
  'Income Statement': ['Revenue', 'Cost of Goods Sold', 'Operating Expense', 'Tax', 'Other Income'],
  'Balance Sheet':    ['Current Asset', 'Fixed Asset', 'Current Liability', 'Long-term Liability', 'Equity'],
  'Cash Flow':        ['Operating', 'Investing', 'Financing', 'Opening Balance'],
};

const empty = () => ({ date: '', description: '', amount: '', category: '' });

export default function AccountingTools({ onBack }) {
  const [activeTool, setActiveTool]   = useState('General Ledger');
  const [transactions, setTransactions] = useState([]);
  const [input, setInput]             = useState(empty());
  const [report, setReport]           = useState(null);
  const [isLoading, setIsLoading]     = useState(false);
  const [error, setError]             = useState('');
  const [advisorDown, setAdvisorDown] = useState(false);
  const [inputError, setInputError]   = useState('');

  // ── Switch tool — clear entries and report ───────────────────
  function switchTool(tool) {
    setActiveTool(tool);
    setTransactions([]);
    setReport(null);
    setError('');
    setAdvisorDown(false);
    setInput(empty());
  }

  // ── Validate and add a transaction entry ─────────────────────
  function addTransaction() {
    if (!input.date)                          { setInputError('Date is required.');         return; }
    if (!input.description.trim())            { setInputError('Description is required.');   return; }
    if (!input.amount || isNaN(+input.amount) || +input.amount === 0)
                                              { setInputError('Enter a valid amount.');       return; }
    if (!input.category)                      { setInputError('Select a category.');          return; }
    setInputError('');
    setTransactions(prev => [...prev, {
      date:        input.date,
      description: input.description.trim(),
      amount:      parseFloat(input.amount),
      category:    input.category,
    }]);
    setInput(empty());
    setReport(null);
  }

  function removeTransaction(i) {
    setTransactions(prev => prev.filter((_, idx) => idx !== i));
    setReport(null);
  }

  // ── Call Cloudflare function → Gemini ────────────────────────
  async function generateReport() {
    if (transactions.length === 0) {
      setError('Add at least one entry before generating a report.');
      return;
    }
    setIsLoading(true);
    setError('');
    setAdvisorDown(false);
    setReport(null);

    try {
      const response = await fetch('/functions/accounting', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transactions, activeTool }),
      });

      let data;
      try {
        data = await response.json();
      } catch {
        setAdvisorDown(true);
        return;
      }

      if (data.advisorDown || !data.result) {
        setAdvisorDown(true);
        return;
      }

      setReport(data.result);
    } catch {
      setAdvisorDown(true);
    } finally {
      setIsLoading(false);
    }
  }

  const inputClass  = 'w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500 transition-colors';
  const categories  = CATEGORIES[activeTool];

  // ── Compute simple local totals for display ──────────────────
  const localTotals = transactions.reduce((acc, t) => {
    const isIncome = ['Revenue', 'Operating', 'Current Asset', 'Fixed Asset', 'Asset', 'Other Income', 'Opening Balance', 'Investing', 'Financing'].includes(t.category);
    if (isIncome) acc.credits += t.amount;
    else          acc.debits  += t.amount;
    return acc;
  }, { credits: 0, debits: 0 });

  return (
    <div className="min-h-screen bg-black text-zinc-100">

      {/* ── Page Header ─────────────────────────────────────── */}
      <div className="border-b border-zinc-900 bg-zinc-950">
        <div className="max-w-5xl mx-auto px-6 py-8">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-zinc-500 hover:text-amber-500 transition mb-6 text-xs font-black uppercase tracking-widest group"
          >
            <ArrowLeft size={13} className="group-hover:-translate-x-1 transition-transform" />
            Back to Home
          </button>
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-4xl md:text-5xl font-black tracking-tighter italic uppercase mb-2">
                Accounting Tools
              </h1>
              <p className="text-zinc-500 text-sm leading-relaxed">
                AI-powered financial reports built for Nigerian SMEs.
              </p>
            </div>
            <span className="text-[9px] font-black uppercase tracking-widest text-amber-500 bg-amber-500/10 px-4 py-2 rounded-full border border-amber-500/20 self-start mt-1">
              AI Powered
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-10 space-y-8">

        {/* ── Tool Tabs ─────────────────────────────────────── */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {TOOLS.map(tool => (
            <button
              key={tool}
              onClick={() => switchTool(tool)}
              className={`p-4 rounded-2xl border text-left transition-all ${
                activeTool === tool
                  ? 'bg-amber-500/10 border-amber-500/40 text-amber-500'
                  : 'bg-zinc-950 border-zinc-800 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300'
              }`}
            >
              <div className="mb-2">{TOOL_META[tool].icon}</div>
              <p className="text-[11px] font-black uppercase tracking-widest leading-tight mb-1">{tool}</p>
              <p className="text-[10px] leading-relaxed opacity-70">{TOOL_META[tool].desc}</p>
            </button>
          ))}
        </div>

        {/* ── Entry Form ────────────────────────────────────── */}
        <div className="bg-zinc-950 border border-zinc-900 rounded-[2rem] overflow-hidden">
          <div className="border-b border-zinc-900 px-8 py-5 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-black italic uppercase">{activeTool}</h2>
              <p className="text-zinc-600 text-xs mt-0.5">Add entries then generate your AI report</p>
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
                <input
                  type="date"
                  value={input.date}
                  onChange={e => setInput(p => ({ ...p, date: e.target.value }))}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">Category</label>
                <select
                  value={input.category}
                  onChange={e => setInput(p => ({ ...p, category: e.target.value }))}
                  className={inputClass + ' appearance-none cursor-pointer'}
                >
                  <option value="">Select category...</option>
                  {categories.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">Description</label>
                <input
                  type="text"
                  placeholder="e.g. Sales revenue from client"
                  value={input.description}
                  onChange={e => setInput(p => ({ ...p, description: e.target.value }))}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">Amount (₦)</label>
                <input
                  type="number"
                  placeholder="e.g. 250000"
                  value={input.amount}
                  onChange={e => setInput(p => ({ ...p, amount: e.target.value }))}
                  className={inputClass}
                />
              </div>
            </div>

            {/* Input error */}
            {inputError && (
              <div className="flex items-center gap-2 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                <AlertCircle size={13} className="text-red-400 flex-shrink-0" />
                <p className="text-red-400 text-xs">{inputError}</p>
              </div>
            )}

            <button
              onClick={addTransaction}
              className="flex items-center gap-2 px-6 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all"
            >
              <Plus size={14} /> Add Entry
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
                  {transactions.map((t, i) => (
                    <div key={i} className="grid grid-cols-[1fr_1fr_auto_auto] items-center px-4 py-3 gap-4 hover:bg-zinc-900/30 transition">
                      <span className="text-xs text-zinc-500 font-mono">{t.date}</span>
                      <div>
                        <p className="text-xs text-zinc-200">{t.description}</p>
                        <p className="text-[10px] text-zinc-600 mt-0.5">{t.category}</p>
                      </div>
                      <span className="text-xs font-black font-mono text-white">₦{t.amount.toLocaleString()}</span>
                      <button
                        onClick={() => removeTransaction(i)}
                        className="text-zinc-700 hover:text-red-400 transition"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Running totals */}
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

            {/* Generate button */}
            {transactions.length > 0 && (
              <button
                onClick={generateReport}
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 py-4 bg-amber-500 text-black font-black text-xs uppercase tracking-widest rounded-xl hover:bg-amber-400 transition-all active:scale-95 disabled:opacity-50"
              >
                {isLoading
                  ? <><Loader2 size={16} className="animate-spin" /> Generating Report...</>
                  : <><Calculator size={16} /> Generate AI Report</>
                }
              </button>
            )}

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                <AlertCircle size={13} className="text-red-400 flex-shrink-0" />
                <p className="text-red-400 text-xs">{error}</p>
              </div>
            )}

            {/* Advisor down */}
            {advisorDown && (
              <div className="flex items-start gap-3 px-4 py-4 bg-zinc-900 border border-zinc-700 rounded-2xl">
                <span className="text-lg leading-none">🛠️</span>
                <div>
                  <p className="font-black text-zinc-300 uppercase tracking-widest text-[9px] mb-1">Service Unavailable</p>
                  <p className="text-zinc-400 text-xs leading-relaxed">
                    The AI report engine is currently down. Your entries are safe — please try again shortly.
                  </p>
                </div>
              </div>
            )}

            {/* ── Report ──────────────────────────────────────── */}
            {report && (
              <div className="space-y-4 border-t border-zinc-800 pt-8">
                <p className="text-[9px] font-black uppercase tracking-widest text-zinc-600">AI Report — {activeTool}</p>

                {/* Totals */}
                {report.totals && Object.keys(report.totals).length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {report.totals.revenue !== undefined && (
                      <div className="bg-green-500/5 border border-green-500/20 rounded-xl px-4 py-3">
                        <p className="text-[9px] font-black uppercase tracking-widest text-green-500/70 mb-1">Total Revenue</p>
                        <p className="text-lg font-black text-green-400">₦{Number(report.totals.revenue).toLocaleString()}</p>
                      </div>
                    )}
                    {report.totals.expenses !== undefined && (
                      <div className="bg-red-500/5 border border-red-500/20 rounded-xl px-4 py-3">
                        <p className="text-[9px] font-black uppercase tracking-widest text-red-400/70 mb-1">Total Expenses</p>
                        <p className="text-lg font-black text-red-400">₦{Number(report.totals.expenses).toLocaleString()}</p>
                      </div>
                    )}
                    {report.totals.netIncome !== undefined && (
                      <div className="bg-amber-500 rounded-xl px-4 py-3">
                        <p className="text-[9px] font-black uppercase tracking-widest text-black/60 mb-1">Net Income</p>
                        <p className="text-lg font-black text-black">₦{Number(report.totals.netIncome).toLocaleString()}</p>
                      </div>
                    )}
                    {report.totals.assets !== undefined && (
                      <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl px-4 py-3">
                        <p className="text-[9px] font-black uppercase tracking-widest text-blue-400/70 mb-1">Total Assets</p>
                        <p className="text-lg font-black text-blue-400">₦{Number(report.totals.assets).toLocaleString()}</p>
                      </div>
                    )}
                    {report.totals.liabilities !== undefined && (
                      <div className="bg-orange-500/5 border border-orange-500/20 rounded-xl px-4 py-3">
                        <p className="text-[9px] font-black uppercase tracking-widest text-orange-400/70 mb-1">Total Liabilities</p>
                        <p className="text-lg font-black text-orange-400">₦{Number(report.totals.liabilities).toLocaleString()}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Audit */}
                {report.audit && (
                  <div className="px-5 py-4 bg-zinc-900 border border-zinc-800 rounded-2xl">
                    <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-2">Audit Check</p>
                    <p className="text-sm text-zinc-300 leading-relaxed">{report.audit}</p>
                  </div>
                )}

                {/* Insight */}
                {report.insight && (
                  <div className="px-5 py-4 bg-amber-500/5 border border-amber-500/20 rounded-2xl">
                    <p className="text-[9px] font-black uppercase tracking-widest text-amber-500 mb-2">Strategic Insight</p>
                    <p className="text-sm text-zinc-300 leading-relaxed">{report.insight}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
