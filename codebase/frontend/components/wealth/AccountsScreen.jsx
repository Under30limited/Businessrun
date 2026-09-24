import React, { useState, useEffect } from 'react';
import { Plus, Loader2, Trash2, Landmark, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { CURRENCIES, formatUnifiedAmount, getCurrencySymbol } from '../../utils/currency';

const ACCOUNT_TYPES = ['bank', 'fintech', 'domiciliary', 'investment', 'crypto'];

const EMPTY_FORM = { name: '', bankName: '', accountNumberMask: '', currency: 'NGN', balance: '', type: 'bank' };

export default function AccountsScreen() {
  const { user } = useAuth();
  const displayCurrency = user?.displayCurrency || 'NGN';

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
      const res = await fetch('/api/personal/accounts', { credentials: 'include' });
      const data = await res.json();
      if (data.success) setAccounts(data.accounts);
    } finally {
      setLoading(false);
    }
  }

  async function handleAdd(e) {
    e.preventDefault();
    setError('');
    if (!form.name.trim() || !form.balance) { setError('Name and starting balance are required.'); return; }
    setSubmitting(true);
    try {
      const res = await fetch('/api/personal/accounts', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, balance: Number(form.balance) }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) { setError(data.message || 'Could not add account.'); return; }
      setForm(EMPTY_FORM);
      setShowAdd(false);
      load();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this account? This does not delete any income or expenses already linked to it.')) return;
    await fetch(`/api/personal/accounts/${id}`, { method: 'DELETE', credentials: 'include' });
    load();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Accounts & Portfolio</p>
          <h2 className="text-2xl font-black text-zinc-900">Where Your Money Sits</h2>
        </div>
        <button onClick={() => setShowAdd(v => !v)}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-amber-500 text-black rounded-xl text-xs font-black uppercase tracking-widest hover:bg-amber-400 transition">
          {showAdd ? <X size={14} /> : <Plus size={14} />} {showAdd ? 'Cancel' : 'Add Account'}
        </button>
      </div>

      {showAdd && (
        <form onSubmit={handleAdd} className="bg-white border border-zinc-200 rounded-2xl p-5 mb-6 space-y-3">
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="grid grid-cols-2 gap-3">
            <input placeholder="Account name (e.g. GTBank Savings)" value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              className="col-span-2 bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-500" />
            <input placeholder="Bank / provider (optional)" value={form.bankName}
              onChange={e => setForm({ ...form, bankName: e.target.value })}
              className="bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-500" />
            <input placeholder="Last digits only (optional)" value={form.accountNumberMask}
              onChange={e => setForm({ ...form, accountNumberMask: e.target.value })}
              className="bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-500" />
            <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}
              className="bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-500">
              {ACCOUNT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
            <select value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })}
              className="bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-500">
              {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <input type="number" placeholder="Starting balance" value={form.balance}
              onChange={e => setForm({ ...form, balance: e.target.value })}
              className="col-span-2 bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-500" />
          </div>
          <button type="submit" disabled={submitting}
            className="w-full py-2.5 bg-zinc-900 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-zinc-800 transition disabled:opacity-50">
            {submitting ? <Loader2 size={14} className="inline animate-spin" /> : 'Save Account'}
          </button>
        </form>
      )}

      {loading ? (
        <p className="text-sm text-zinc-400 flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Loading...</p>
      ) : accounts.length === 0 ? (
        <EmptyState icon={Landmark} text="No accounts yet. Add your first bank, fintech, or domiciliary account." />
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {accounts.map(a => (
            <div key={a.accountId} className="bg-white border border-zinc-200 rounded-2xl p-4 flex items-start justify-between">
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400">{a.type}{a.bankName ? ` · ${a.bankName}` : ''}</p>
                <p className="font-bold text-zinc-900">{a.name}{a.accountNumberMask ? ` (••${a.accountNumberMask})` : ''}</p>
                <p className="text-lg font-black text-zinc-900 mt-1">
                  {formatUnifiedAmount(a.balance, a.currency, displayCurrency)}
                </p>
                {a.currency !== displayCurrency && (
                  <p className="text-[10px] font-bold text-zinc-400 mt-0.5">
                    {getCurrencySymbol(a.currency)}{a.balance.toLocaleString()} {a.currency} actual balance
                  </p>
                )}
              </div>
              <button onClick={() => handleDelete(a.accountId)} className="text-zinc-300 hover:text-red-500 transition">
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function EmptyState({ icon: Icon, text }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16 bg-white border border-dashed border-zinc-200 rounded-2xl">
      <Icon size={22} className="text-zinc-300 mb-3" />
      <p className="text-sm text-zinc-500 max-w-xs">{text}</p>
    </div>
  );
}
