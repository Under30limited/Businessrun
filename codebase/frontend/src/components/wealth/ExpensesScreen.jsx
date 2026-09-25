import React, { useState, useEffect } from 'react';
import { Plus, Loader2, Trash2, ShoppingBag, X, RefreshCcw } from 'lucide-react';
import { EmptyState } from './AccountsScreen';
import { useAuth } from '../../context/AuthContext';
import { CURRENCIES, formatUnifiedAmount, getCurrencySymbol } from '../../utils/currency';

const EXPENSE_CATEGORIES = [
  'Housing & Utilities', 'Food & Groceries', 'Transport & Logistics', 'Family Support & Black Tax',
  'Subscriptions & Tech', 'Health & Wellness', 'Entertainment & Lifestyle', 'Business Expense (Paid Personally)',
];

const EMPTY_FORM = {
  title: '', category: EXPENSE_CATEGORIES[0], amount: '', currency: 'NGN',
  accountId: '', envelopeStreamId: '', isBusinessReimbursement: false,
  date: new Date().toISOString().slice(0, 10),
};

export default function ExpensesScreen() {
  const { user } = useAuth();
  const displayCurrency = user?.displayCurrency || 'NGN';

  const [expenses, setExpenses] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [envelopes, setEnvelopes] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [showAdd, setShowAdd]   = useState(false);
  const [form, setForm]         = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]       = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const [expRes, accRes, incRes] = await Promise.all([
        fetch('/api/personal/expenses', { credentials: 'include' }),
        fetch('/api/personal/accounts', { credentials: 'include' }),
        fetch('/api/personal/income', { credentials: 'include' }),
      ]);
      const expData = await expRes.json();
      const accData = await accRes.json();
      const incData = await incRes.json();
      if (expData.success) setExpenses(expData.expenses);
      if (accData.success) setAccounts(accData.accounts);
      if (incData.success) setEnvelopes(incData.income.filter(i => i.isEnvelope));
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
      const account  = accounts.find(a => a.accountId === form.accountId);
      const envelope = envelopes.find(i => i.incomeId === form.envelopeStreamId);
      const res = await fetch('/api/personal/expenses', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form, amount: Number(form.amount),
          accountId: form.accountId || undefined, accountName: account?.name || '',
          envelopeStreamId: form.envelopeStreamId || undefined, envelopeTitle: envelope?.title || '',
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) { setError(data.message || 'Could not add expense.'); return; }
      setForm(EMPTY_FORM);
      setShowAdd(false);
      load();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this expense? Any linked account/envelope balance will be restored.')) return;
    await fetch(`/api/personal/expenses/${id}`, { method: 'DELETE', credentials: 'include' });
    load();
  }

  async function handleToggleReimbursement(id) {
    await fetch(`/api/personal/expenses/${id}/reimbursement`, { method: 'POST', credentials: 'include' });
    load();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Expenses</p>
          <h2 className="text-2xl font-black text-zinc-900">Where It's Going</h2>
        </div>
        <button onClick={() => setShowAdd(v => !v)}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-amber-500 text-black rounded-xl text-xs font-black uppercase tracking-widest hover:bg-amber-400 transition">
          {showAdd ? <X size={14} /> : <Plus size={14} />} {showAdd ? 'Cancel' : 'Add Expense'}
        </button>
      </div>

      {showAdd && (
        <form onSubmit={handleAdd} className="bg-white border border-zinc-200 rounded-2xl p-5 mb-6 space-y-3">
          {error && <p className="text-xs text-red-600">{error}</p>}
          <input placeholder="Title (e.g. Grocery run)" value={form.title}
            onChange={e => setForm({ ...form, title: e.target.value })}
            className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-500" />
          <div className="grid grid-cols-2 gap-3">
            <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
              className="col-span-2 bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-500">
              {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
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
            {envelopes.length > 0 && (
              <select value={form.envelopeStreamId} onChange={e => setForm({ ...form, envelopeStreamId: e.target.value })}
                className="col-span-2 bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-500">
                <option value="">No envelope</option>
                {envelopes.map(env => (
                  <option key={env.incomeId} value={env.incomeId}>
                    {env.title} ({Math.max(0, env.amount - (env.amountSpent || 0)).toLocaleString()} left)
                  </option>
                ))}
              </select>
            )}
            <input type="date" value={form.date}
              onChange={e => setForm({ ...form, date: e.target.value })}
              className="col-span-2 bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-500" />
          </div>
          <label className="flex items-center gap-2 text-sm text-zinc-600">
            <input type="checkbox" checked={form.isBusinessReimbursement}
              onChange={e => setForm({ ...form, isBusinessReimbursement: e.target.checked })} />
            This was really a business expense I paid personally — track for reimbursement
          </label>
          <button type="submit" disabled={submitting}
            className="w-full py-2.5 bg-zinc-900 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-zinc-800 transition disabled:opacity-50">
            {submitting ? <Loader2 size={14} className="inline animate-spin" /> : 'Save Expense'}
          </button>
        </form>
      )}

      {loading ? (
        <p className="text-sm text-zinc-400 flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Loading...</p>
      ) : expenses.length === 0 ? (
        <EmptyState icon={ShoppingBag} text="No expenses logged yet. Add your first one to start seeing where your money goes." />
      ) : (
        <div className="space-y-3">
          {[...expenses].sort((a, b) => new Date(b.date) - new Date(a.date)).map(e => (
            <div key={e.expenseId} className="bg-white border border-zinc-200 rounded-2xl p-4 flex items-start justify-between">
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400">{e.category} · {e.date}</p>
                <p className="font-bold text-zinc-900">{e.title}</p>
                <p className="text-lg font-black text-zinc-900 mt-1">
                  {formatUnifiedAmount(e.amount, e.currency, displayCurrency)}
                </p>
                {e.currency !== displayCurrency && (
                  <p className="text-[10px] font-bold text-zinc-400 mt-0.5">
                    {getCurrencySymbol(e.currency)}{e.amount.toLocaleString()} {e.currency} actual amount
                  </p>
                )}
                {e.isBusinessReimbursement && (
                  <button onClick={() => handleToggleReimbursement(e.expenseId)}
                    className={`flex items-center gap-1 text-xs mt-1 px-2 py-0.5 rounded-full ${
                      e.reimbursementStatus === 'reimbursed' ? 'bg-green-50 text-green-700' : 'bg-amber-50 text-amber-700'
                    }`}>
                    <RefreshCcw size={10} /> {e.reimbursementStatus === 'reimbursed' ? 'Reimbursed' : 'Pending reimbursement'}
                  </button>
                )}
              </div>
              <button onClick={() => handleDelete(e.expenseId)} className="text-zinc-300 hover:text-red-500 transition">
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
