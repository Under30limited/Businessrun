import React, { useState, useEffect } from 'react';
import { Loader2, Trash2, NotebookPen, Wallet, Bell, BellRing, CheckCircle2, X } from 'lucide-react';
import { EmptyState } from './AccountsScreen';
import { getCurrencySymbol } from '../../utils/currency';

const EXPENSE_CATEGORIES = [
  'Housing & Utilities', 'Food & Groceries', 'Transport & Logistics', 'Family Support & Black Tax',
  'Subscriptions & Tech', 'Health & Wellness', 'Entertainment & Lifestyle', 'Business Expense (Paid Personally)',
];

export default function DayLogScreen() {
  const [entries, setEntries]   = useState([]);
  const [loading, setLoading]   = useState(true);
  const [content, setContent]   = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]       = useState('');
  const [categoryPickerFor, setCategoryPickerFor] = useState(null);
  const [category, setCategory] = useState(EXPENSE_CATEGORIES[0]);

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/personal/daylog', { credentials: 'include' });
      const data = await res.json();
      if (data.success) setEntries(data.entries);
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!content.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/personal/daylog', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) { setError(data.message || 'Could not save entry.'); return; }
      setContent('');
      load();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleMoveToExpense(id) {
    await fetch(`/api/personal/daylog/${id}/move-to-expense`, {
      method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category }),
    });
    setCategoryPickerFor(null);
    load();
  }

  async function handleToggleReminder(id) {
    await fetch(`/api/personal/daylog/${id}/toggle-reminder`, { method: 'POST', credentials: 'include' });
    load();
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this journal entry?')) return;
    await fetch(`/api/personal/daylog/${id}`, { method: 'DELETE', credentials: 'include' });
    load();
  }

  return (
    <div>
      <div className="mb-6">
        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Day Log</p>
        <h2 className="text-2xl font-black text-zinc-900">Your Financial Journal</h2>
        <p className="text-sm text-zinc-500 mt-1">
          Write freely — the AI will try to spot a cash amount or a promise you mention, but never acts on it without you confirming.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="bg-white border border-zinc-200 rounded-2xl p-5 mb-6">
        {error && <p className="text-xs text-red-600 mb-2">{error}</p>}
        <textarea
          value={content}
          onChange={e => setContent(e.target.value)}
          placeholder="e.g. Spent ₦15,000 on groceries today. Also, Tunde promised to pay me back ₦20,000 by next Friday."
          rows={3}
          maxLength={4000}
          className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-amber-500 resize-none"
        />
        <div className="flex justify-end mt-3">
          <button type="submit" disabled={submitting || !content.trim()}
            className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 text-black rounded-xl text-xs font-black uppercase tracking-widest hover:bg-amber-400 transition disabled:opacity-50">
            {submitting ? <Loader2 size={14} className="animate-spin" /> : 'Log It'}
          </button>
        </div>
      </form>

      {loading ? (
        <p className="text-sm text-zinc-400 flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Loading...</p>
      ) : entries.length === 0 ? (
        <EmptyState icon={NotebookPen} text="No journal entries yet. Write your first one above." />
      ) : (
        <div className="space-y-3">
          {[...entries].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).map(entry => (
            <div key={entry.entryId} className="bg-white border border-zinc-200 rounded-2xl p-4">
              <div className="flex items-start justify-between">
                <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400">{entry.createdAt.slice(0, 10)}</p>
                <button onClick={() => handleDelete(entry.entryId)} className="text-zinc-300 hover:text-red-500 transition">
                  <Trash2 size={14} />
                </button>
              </div>
              <p className="text-sm text-zinc-800 mt-1 whitespace-pre-wrap">{entry.content}</p>

              {entry.parsedCash && (
                <div className="mt-3 flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                  <div className="flex items-center gap-2 text-xs text-amber-800">
                    <Wallet size={13} />
                    Detected: {getCurrencySymbol(entry.parsedCash.currency)}{entry.parsedCash.amount.toLocaleString()} — {entry.parsedCash.description}
                  </div>
                  {entry.parsedCash.movedToExpenses ? (
                    <span className="flex items-center gap-1 text-xs font-bold text-green-700"><CheckCircle2 size={13} /> Moved</span>
                  ) : categoryPickerFor === entry.entryId ? (
                    <div className="flex items-center gap-1">
                      <select value={category} onChange={e => setCategory(e.target.value)}
                        className="text-xs border border-amber-300 rounded-lg px-1.5 py-1 bg-white">
                        {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <button onClick={() => handleMoveToExpense(entry.entryId)} className="text-xs font-bold bg-amber-500 text-black px-2 py-1 rounded-lg">Confirm</button>
                      <button onClick={() => setCategoryPickerFor(null)} className="text-amber-700"><X size={13} /></button>
                    </div>
                  ) : (
                    <button onClick={() => setCategoryPickerFor(entry.entryId)} className="text-xs font-bold text-amber-700 hover:text-amber-900">
                      Move to Expenses
                    </button>
                  )}
                </div>
              )}

              {entry.parsedPromise && (
                <div className="mt-2 flex items-center justify-between bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2">
                  <div className="flex items-center gap-2 text-xs text-zinc-700">
                    {entry.parsedPromise.isReminderSet ? <BellRing size={13} className="text-amber-500" /> : <Bell size={13} />}
                    Promise: {entry.parsedPromise.personOrEntity}
                    {entry.parsedPromise.amount ? ` — ${getCurrencySymbol(entry.parsedPromise.currency)}${entry.parsedPromise.amount.toLocaleString()}` : ''}
                    {entry.parsedPromise.dueDate ? ` by ${entry.parsedPromise.dueDate}` : ''}
                  </div>
                  <button onClick={() => handleToggleReminder(entry.entryId)}
                    className={`text-xs font-bold ${entry.parsedPromise.isReminderSet ? 'text-amber-600' : 'text-zinc-500'}`}>
                    {entry.parsedPromise.isReminderSet ? 'Reminder set' : 'Set reminder'}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
