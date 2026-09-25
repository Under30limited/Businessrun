import React, { useState, useEffect } from 'react';
import { Plus, Loader2, Trash2, HandCoins, X, CheckCircle2 } from 'lucide-react';
import { EmptyState } from './AccountsScreen';
import { useAuth } from '../../context/AuthContext';
import { CURRENCIES, formatUnifiedAmount } from '../../utils/currency';

const DEBT_TYPES = [
  { value: 'i_owe',       label: 'I owe someone' },
  { value: 'owed_to_me',  label: 'Someone owes me' },
];

const EMPTY_FORM = { type: 'i_owe', personOrEntity: '', phoneNumber: '', amount: '', currency: 'NGN', purpose: '', dueDate: '' };

export default function DebtsScreen() {
  const { user } = useAuth();
  const displayCurrency = user?.displayCurrency || 'NGN';

  const [debts, setDebts]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [showAdd, setShowAdd]   = useState(false);
  const [form, setForm]         = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]       = useState('');
  const [paymentId, setPaymentId] = useState(null);
  const [paymentAmount, setPaymentAmount] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/personal/debts', { credentials: 'include' });
      const data = await res.json();
      if (data.success) setDebts(data.debts);
    } finally {
      setLoading(false);
    }
  }

  async function handleAdd(e) {
    e.preventDefault();
    setError('');
    if (!form.personOrEntity.trim() || !form.amount || !form.dueDate) { setError('Name, amount, and due date are required.'); return; }
    setSubmitting(true);
    try {
      const res = await fetch('/api/personal/debts', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, amount: Number(form.amount) }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) { setError(data.message || 'Could not add debt record.'); return; }
      setForm(EMPTY_FORM);
      setShowAdd(false);
      load();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleSettle(id) {
    await fetch(`/api/personal/debts/${id}/settle`, { method: 'POST', credentials: 'include' });
    load();
  }

  async function handlePayment(id) {
    if (!paymentAmount) return;
    await fetch(`/api/personal/debts/${id}/payment`, {
      method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: Number(paymentAmount) }),
    });
    setPaymentId(null);
    setPaymentAmount('');
    load();
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this debt record?')) return;
    await fetch(`/api/personal/debts/${id}`, { method: 'DELETE', credentials: 'include' });
    load();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Debts & IOUs</p>
          <h2 className="text-2xl font-black text-zinc-900">Who Owes Who</h2>
        </div>
        <button onClick={() => setShowAdd(v => !v)}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-amber-500 text-black rounded-xl text-xs font-black uppercase tracking-widest hover:bg-amber-400 transition">
          {showAdd ? <X size={14} /> : <Plus size={14} />} {showAdd ? 'Cancel' : 'Add Debt'}
        </button>
      </div>

      {showAdd && (
        <form onSubmit={handleAdd} className="bg-white border border-zinc-200 rounded-2xl p-5 mb-6 space-y-3">
          {error && <p className="text-xs text-red-600">{error}</p>}
          <div className="grid grid-cols-2 gap-2">
            {DEBT_TYPES.map(t => (
              <button key={t.value} type="button" onClick={() => setForm({ ...form, type: t.value })}
                className={`px-4 py-2.5 rounded-xl text-sm font-bold border transition ${
                  form.type === t.value ? 'bg-amber-500/10 border-amber-500/40 text-amber-600' : 'bg-zinc-50 border-zinc-200 text-zinc-500'
                }`}>
                {t.label}
              </button>
            ))}
          </div>
          <input placeholder="Person or entity" value={form.personOrEntity}
            onChange={e => setForm({ ...form, personOrEntity: e.target.value })}
            className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-500" />
          <input placeholder="Phone number (optional)" value={form.phoneNumber}
            onChange={e => setForm({ ...form, phoneNumber: e.target.value })}
            className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-500" />
          <div className="grid grid-cols-2 gap-3">
            <input type="number" placeholder="Amount" value={form.amount}
              onChange={e => setForm({ ...form, amount: e.target.value })}
              className="bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-500" />
            <select value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })}
              className="bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-500">
              {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <input type="date" value={form.dueDate}
              onChange={e => setForm({ ...form, dueDate: e.target.value })}
              className="col-span-2 bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-500" />
          </div>
          <input placeholder="Purpose / notes (optional)" value={form.purpose}
            onChange={e => setForm({ ...form, purpose: e.target.value })}
            className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-500" />
          <button type="submit" disabled={submitting}
            className="w-full py-2.5 bg-zinc-900 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-zinc-800 transition disabled:opacity-50">
            {submitting ? <Loader2 size={14} className="inline animate-spin" /> : 'Save Debt Record'}
          </button>
        </form>
      )}

      {loading ? (
        <p className="text-sm text-zinc-400 flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Loading...</p>
      ) : debts.length === 0 ? (
        <EmptyState icon={HandCoins} text="No debts or IOUs logged yet — either direction." />
      ) : (
        <div className="space-y-3">
          {debts.map(d => {
            const remaining = Math.max(0, d.amount - (d.paidAmount || 0));
            return (
              <div key={d.debtId} className={`bg-white border rounded-2xl p-4 ${d.isSettled ? 'border-green-200 opacity-60' : 'border-zinc-200'}`}>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400">
                      {d.type === 'i_owe' ? 'You owe' : 'Owed to you'} · due {d.dueDate}
                    </p>
                    <p className="font-bold text-zinc-900">{d.personOrEntity}{d.purpose ? ` — ${d.purpose}` : ''}</p>
                    <p className="text-lg font-black text-zinc-900 mt-1">
                      {formatUnifiedAmount(remaining, d.currency, displayCurrency)} <span className="text-xs font-normal text-zinc-400">of {formatUnifiedAmount(d.amount, d.currency, displayCurrency)}</span>
                    </p>
                  </div>
                  <button onClick={() => handleDelete(d.debtId)} className="text-zinc-300 hover:text-red-500 transition">
                    <Trash2 size={15} />
                  </button>
                </div>

                {!d.isSettled && (
                  <div className="flex items-center gap-3 mt-3">
                    <button onClick={() => handleToggleSettle(d.debtId)}
                      className="flex items-center gap-1 text-xs font-bold text-green-600 hover:text-green-700">
                      <CheckCircle2 size={13} /> Mark fully settled
                    </button>
                    {paymentId === d.debtId ? (
                      <div className="flex gap-2">
                        <input type="number" autoFocus placeholder="Amount paid" value={paymentAmount}
                          onChange={e => setPaymentAmount(e.target.value)}
                          className="w-28 bg-zinc-50 border border-zinc-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:border-amber-500" />
                        <button onClick={() => handlePayment(d.debtId)} className="px-2 py-1 bg-zinc-900 text-white rounded-lg text-xs font-bold">Log</button>
                        <button onClick={() => setPaymentId(null)} className="text-zinc-400"><X size={13} /></button>
                      </div>
                    ) : (
                      <button onClick={() => setPaymentId(d.debtId)} className="text-xs font-bold text-zinc-500 hover:text-zinc-700">
                        Log partial payment
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
