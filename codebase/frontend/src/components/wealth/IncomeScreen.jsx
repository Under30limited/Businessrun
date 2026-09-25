import React, { useState, useEffect } from 'react';
import { Plus, Loader2, Trash2, TrendingUp, X } from 'lucide-react';
import { EmptyState } from './AccountsScreen';
import { useAuth } from '../../context/AuthContext';
import { CURRENCIES, formatUnifiedAmount, getCurrencySymbol } from '../../utils/currency';

const INCOME_TYPES = [
  'Salary / Founder Drawing', 'Consulting / Retainer', 'Business Dividend / Profit Share',
  'Asset Yield / Rental Income', 'One-Off Deal / Project Fee', 'Investment Return', 'Gift / Transfer Inflow',
];
const FREQUENCIES = ['Monthly Recurring', 'Weekly', 'One-Time Windfall'];

const EMPTY_FORM = {
  title: '', type: INCOME_TYPES[0], amount: '', currency: 'NGN', frequency: FREQUENCIES[0],
  accountId: '', isEnvelope: false, dateReceived: new Date().toISOString().slice(0, 10),
};

export default function IncomeScreen() {
  const { user } = useAuth();
  const displayCurrency = user?.displayCurrency || 'NGN';

  const [streams, setStreams]   = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [showAdd, setShowAdd]   = useState(false);
  const [form, setForm]         = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]       = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const [incomeRes, accountsRes] = await Promise.all([
        fetch('/api/personal/income', { credentials: 'include' }),
        fetch('/api/personal/accounts', { credentials: 'include' }),
      ]);
      const incomeData = await incomeRes.json();
      const accountsData = await accountsRes.json();
      if (incomeData.success) setStreams(incomeData.income);
      if (accountsData.success) setAccounts(accountsData.accounts);
    } finally {
      setLoading(false);
    }
  }

  async function handleAdd(e) {
    e.preventDefault();
    setError('');
    if (!form.title.trim() || !form.amount) { setError('Title and amount are required.'); return; }
    setSubmitting(true);
    try {
      const account = accounts.find(a => a.accountId === form.accountId);
      const res = await fetch('/api/personal/income', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, amount: Number(form.amount), accountName: account?.name || '' }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) { setError(data.message || 'Could not add income.'); return; }
      setForm(EMPTY_FORM);
      setShowAdd(false);
      load();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this income entry? Any linked account balance will be reversed.')) return;
    await fetch(`/api/personal/income/${id}`, { method: 'DELETE', credentials: 'include' });
    load();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Income</p>
          <h2 className="text-2xl font-black text-zinc-900">Money Coming In</h2>
        </div>
        <button onClick={() => setShowAdd(v => !v)}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-amber-500 text-black rounded-xl text-xs font-black uppercase tracking-widest hover:bg-amber-400 transition">
          {showAdd ? <X size={14} /> : <Plus size={14} />} {showAdd ? 'Cancel' : 'Add Income'}
        </button>
      </div>

      {showAdd && (
        <form onSubmit={handleAdd} className="bg-white border border-zinc-200 rounded-2xl p-5 mb-6 space-y-3">
          {error && <p className="text-xs text-red-600">{error}</p>}
          <input placeholder="Title (e.g. October Salary)" value={form.title}
            onChange={e => setForm({ ...form, title: e.target.value })}
            className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-500" />
          <div className="grid grid-cols-2 gap-3">
            <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}
              className="bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-500">
              {INCOME_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <select value={form.frequency} onChange={e => setForm({ ...form, frequency: e.target.value })}
              className="bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-500">
              {FREQUENCIES.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
            <input type="number" placeholder="Amount" value={form.amount}
              onChange={e => setForm({ ...form, amount: e.target.value })}
              className="bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-500" />
            <select value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })}
              className="bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-500">
              {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={form.accountId} onChange={e => setForm({ ...form, accountId: e.target.value })}
              className="col-span-2 bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-500">
              <option value="">No linked account</option>
              {accounts.map(a => <option key={a.accountId} value={a.accountId}>{a.name}</option>)}
            </select>
            <input type="date" value={form.dateReceived}
              onChange={e => setForm({ ...form, dateReceived: e.target.value })}
              className="col-span-2 bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-500" />
          </div>
          <label className="flex items-center gap-2 text-sm text-zinc-600">
            <input type="checkbox" checked={form.isEnvelope} onChange={e => setForm({ ...form, isEnvelope: e.target.checked })} />
            Treat this as a spending envelope (linked expenses will draw down from it)
          </label>
          <button type="submit" disabled={submitting}
            className="w-full py-2.5 bg-zinc-900 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-zinc-800 transition disabled:opacity-50">
            {submitting ? <Loader2 size={14} className="inline animate-spin" /> : 'Save Income'}
          </button>
        </form>
      )}

      {loading ? (
        <p className="text-sm text-zinc-400 flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Loading...</p>
      ) : streams.length === 0 ? (
        <EmptyState icon={TrendingUp} text="No income logged yet. Add your salary, a project fee, or any money coming in." />
      ) : (
        <div className="space-y-3">
          {streams.map(s => (
            <div key={s.incomeId} className="bg-white border border-zinc-200 rounded-2xl p-4 flex items-start justify-between">
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400">{s.type} · {s.frequency} · {s.dateReceived}</p>
                <p className="font-bold text-zinc-900">{s.title}</p>
                <p className="text-lg font-black text-zinc-900 mt-1">
                  {formatUnifiedAmount(s.amount, s.currency, displayCurrency)}
                </p>
                {s.currency !== displayCurrency && (
                  <p className="text-[10px] font-bold text-zinc-400 mt-0.5">
                    {getCurrencySymbol(s.currency)}{s.amount.toLocaleString()} {s.currency} actual amount
                  </p>
                )}
                {s.isEnvelope && (
                  <p className="text-xs text-amber-600 mt-1">
                    Envelope: {formatUnifiedAmount(Math.max(0, s.amount - (s.amountSpent || 0)), s.currency, displayCurrency)} remaining
                  </p>
                )}
              </div>
              <button onClick={() => handleDelete(s.incomeId)} className="text-zinc-300 hover:text-red-500 transition">
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
