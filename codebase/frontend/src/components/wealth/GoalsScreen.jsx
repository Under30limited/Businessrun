import React, { useState, useEffect } from 'react';
import { Plus, Loader2, Trash2, Target, X, PlusCircle } from 'lucide-react';
import { EmptyState } from './AccountsScreen';
import { useAuth } from '../../context/AuthContext';
import { CURRENCIES, formatUnifiedAmount } from '../../utils/currency';

const GOAL_CATEGORIES = ['Emergency Reserve', 'Travel & Lifestyle', 'Asset / Real Estate', 'Debt Elimination'];

const EMPTY_FORM = { name: '', category: GOAL_CATEGORIES[0], targetAmount: '', currency: 'NGN', targetDate: '' };

export default function GoalsScreen() {
  const { user } = useAuth();
  const displayCurrency = user?.displayCurrency || 'NGN';

  const [goals, setGoals]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [showAdd, setShowAdd]   = useState(false);
  const [form, setForm]         = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]       = useState('');
  const [contributeId, setContributeId] = useState(null);
  const [contributeAmount, setContributeAmount] = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/personal/goals', { credentials: 'include' });
      const data = await res.json();
      if (data.success) setGoals(data.goals);
    } finally {
      setLoading(false);
    }
  }

  async function handleAdd(e) {
    e.preventDefault();
    setError('');
    if (!form.name.trim() || !form.targetAmount || !form.targetDate) { setError('Name, target amount, and target date are required.'); return; }
    setSubmitting(true);
    try {
      const res = await fetch('/api/personal/goals', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, targetAmount: Number(form.targetAmount) }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) { setError(data.message || 'Could not add goal.'); return; }
      setForm(EMPTY_FORM);
      setShowAdd(false);
      load();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleContribute(id) {
    if (!contributeAmount) return;
    await fetch(`/api/personal/goals/${id}/contribute`, {
      method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: Number(contributeAmount) }),
    });
    setContributeId(null);
    setContributeAmount('');
    load();
  }

  async function handleDelete(id) {
    if (!confirm('Delete this goal?')) return;
    await fetch(`/api/personal/goals/${id}`, { method: 'DELETE', credentials: 'include' });
    load();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Goals</p>
          <h2 className="text-2xl font-black text-zinc-900">What You're Saving For</h2>
        </div>
        <button onClick={() => setShowAdd(v => !v)}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-amber-500 text-black rounded-xl text-xs font-black uppercase tracking-widest hover:bg-amber-400 transition">
          {showAdd ? <X size={14} /> : <Plus size={14} />} {showAdd ? 'Cancel' : 'Add Goal'}
        </button>
      </div>

      {showAdd && (
        <form onSubmit={handleAdd} className="bg-white border border-zinc-200 rounded-2xl p-5 mb-6 space-y-3">
          {error && <p className="text-xs text-red-600">{error}</p>}
          <input placeholder="Goal name (e.g. Emergency Fund)" value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })}
            className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-500" />
          <div className="grid grid-cols-2 gap-3">
            <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
              className="col-span-2 bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-500">
              {GOAL_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <input type="number" placeholder="Target amount" value={form.targetAmount}
              onChange={e => setForm({ ...form, targetAmount: e.target.value })}
              className="bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-500" />
            <select value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })}
              className="bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-500">
              {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <input type="date" value={form.targetDate}
              onChange={e => setForm({ ...form, targetDate: e.target.value })}
              className="col-span-2 bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-500" />
          </div>
          <button type="submit" disabled={submitting}
            className="w-full py-2.5 bg-zinc-900 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-zinc-800 transition disabled:opacity-50">
            {submitting ? <Loader2 size={14} className="inline animate-spin" /> : 'Save Goal'}
          </button>
        </form>
      )}

      {loading ? (
        <p className="text-sm text-zinc-400 flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Loading...</p>
      ) : goals.length === 0 ? (
        <EmptyState icon={Target} text="No goals yet. Set a savings target — an emergency fund, a trip, a down payment." />
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {goals.map(g => {
            const pct = Math.min(100, Math.round((g.savedAmount / g.targetAmount) * 100));
            return (
              <div key={g.goalId} className="bg-white border border-zinc-200 rounded-2xl p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400">{g.category} · by {g.targetDate}</p>
                    <p className="font-bold text-zinc-900">{g.name}</p>
                  </div>
                  <button onClick={() => handleDelete(g.goalId)} className="text-zinc-300 hover:text-red-500 transition">
                    <Trash2 size={15} />
                  </button>
                </div>
                <div className="w-full h-2 bg-zinc-100 rounded-full mt-3 overflow-hidden">
                  <div className="h-full bg-amber-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
                </div>
                <p className="text-xs text-zinc-500 mt-1.5">
                  {formatUnifiedAmount(g.savedAmount, g.currency, displayCurrency)} of {formatUnifiedAmount(g.targetAmount, g.currency, displayCurrency)} ({pct}%)
                </p>

                {contributeId === g.goalId ? (
                  <div className="flex gap-2 mt-3">
                    <input type="number" autoFocus placeholder="Amount" value={contributeAmount}
                      onChange={e => setContributeAmount(e.target.value)}
                      className="flex-1 bg-zinc-50 border border-zinc-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-amber-500" />
                    <button onClick={() => handleContribute(g.goalId)} className="px-3 py-1.5 bg-zinc-900 text-white rounded-lg text-xs font-bold">Add</button>
                    <button onClick={() => setContributeId(null)} className="px-2 text-zinc-400"><X size={14} /></button>
                  </div>
                ) : (
                  <button onClick={() => setContributeId(g.goalId)}
                    className="flex items-center gap-1 text-xs font-bold text-amber-600 mt-3 hover:text-amber-700">
                    <PlusCircle size={13} /> Add contribution
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
