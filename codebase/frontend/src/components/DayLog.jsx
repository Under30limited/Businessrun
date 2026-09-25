/**
 * DayLog.jsx
 *
 * The founder's persistent daily business journal — "Day Log" tab.
 *
 * Features:
 *   - Compose panel: write a dated entry with an optional headline and body
 *   - Simple formatting toolbar: Bold (**text**), Bullet (• item), and clear
 *   - Chronological list of all past entries, newest first
 *   - Cursor-based pagination — loads 10 at a time, "Load more" at bottom
 *   - Per-entry actions: View full entry, Edit, Delete
 *   - Onboarding empty state that explains the feature clearly
 *
 * Props:
 *   None — fetches its own data directly from /api/daylog
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  BookOpen, Plus, ChevronDown, Loader2, Trash2,
  Edit3, X, Check, Calendar, FileText,
  Bold, List, Eye, ChevronLeft, AlertCircle,
  Clock, Save,
} from 'lucide-react';

const inputClass   = 'w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-amber-500 transition-colors';
const textareaClass = 'w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-amber-500 transition-colors resize-none leading-relaxed';
const PAGE_SIZE = 10;

// ── Tiny markdown-ish renderer: **bold** and lines starting with • ──
function renderBody(text) {
  if (!text) return null;
  return text.split('\n').map((line, i) => {
    const isBullet = line.trimStart().startsWith('•') || line.trimStart().startsWith('-');
    // Bold: **text**
    const parts = line.split(/\*\*(.+?)\*\*/g);
    const rendered = parts.map((part, j) =>
      j % 2 === 1 ? <strong key={j} className="font-black text-zinc-900">{part}</strong> : part
    );
    return (
      <span key={i} className={`block ${isBullet ? 'pl-3' : ''} ${i > 0 ? 'mt-1' : ''}`}>
        {rendered}
      </span>
    );
  });
}

// ── Date helpers ────────────────────────────────────────────────
function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function fmtEntryDate(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${d} ${months[parseInt(m, 10) - 1]} ${y}`;
}
function daysSinceEntry(iso) {
  if (!iso) return null;
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return `${diff} days ago`;
}

// ── View Modal ──────────────────────────────────────────────────
function ViewModal({ entry, onClose, onEdit }) {
  return (
    <div className="fixed inset-0 bg-zinc-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white border border-zinc-200 rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-100 shrink-0">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-amber-500 mb-1">
              {fmtEntryDate(entry.entryDate)} · {daysSinceEntry(entry.entryDate)}
            </p>
            <h2 className="text-base font-black uppercase tracking-tight text-zinc-900 leading-tight">
              {entry.title || 'Day Log Entry'}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => onEdit(entry)}
              className="p-2 rounded-xl border border-zinc-200 text-zinc-500 hover:text-amber-500 hover:border-amber-300 transition">
              <Edit3 size={15} />
            </button>
            <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700 transition">
              <X size={18} />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-6">
          <div className="text-sm text-zinc-700 leading-relaxed">
            {renderBody(entry.body)}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Compose / Edit Panel ────────────────────────────────────────
function ComposePanel({ initial, onSave, onCancel, isSaving }) {
  const isEdit = !!initial;
  const [entryDate, setEntryDate] = useState(initial?.entryDate || todayISO());
  const [title,     setTitle]     = useState(initial?.title     || '');
  const [body,      setBody]      = useState(initial?.body      || '');
  const [error,     setError]     = useState('');
  const textRef = useRef(null);

  function insertFormat(prefix, suffix = '') {
    const el  = textRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end   = el.selectionEnd;
    const sel   = body.slice(start, end) || 'text';
    const next  = body.slice(0, start) + prefix + sel + suffix + body.slice(end);
    setBody(next);
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + prefix.length, start + prefix.length + sel.length);
    }, 0);
  }

  function insertBullet() {
    const el    = textRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const before = body.slice(0, start);
    const after  = body.slice(start);
    const needsNewline = before.length > 0 && !before.endsWith('\n');
    const insert = (needsNewline ? '\n' : '') + '• ';
    const next   = before + insert + after;
    setBody(next);
    const pos = start + insert.length;
    setTimeout(() => { el.focus(); el.setSelectionRange(pos, pos); }, 0);
  }

  function handleSubmit() {
    if (!entryDate) { setError('Please select a date.'); return; }
    if (!body.trim()) { setError('Write something before saving.'); return; }
    setError('');
    onSave({ entryDate, title: title.trim(), body: body.trim() });
  }

  const charCount = body.length;
  const charMax   = 5000;

  return (
    <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-100 bg-zinc-50">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-xl bg-amber-500/10 flex items-center justify-center">
            {isEdit ? <Edit3 size={13} className="text-amber-500" /> : <Plus size={13} className="text-amber-500" />}
          </div>
          <p className="text-xs font-black uppercase tracking-widest text-zinc-900">
            {isEdit ? 'Edit Entry' : "Today's Log"}
          </p>
        </div>
        {isEdit && (
          <button onClick={onCancel} className="text-zinc-400 hover:text-zinc-700 transition">
            <X size={16} />
          </button>
        )}
      </div>

      <div className="p-5 space-y-4">
        {/* Date + Title row */}
        <div className="grid grid-cols-[140px_1fr] gap-3">
          <div>
            <label className="block text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-1.5">Date</label>
            <input type="date" value={entryDate}
              onChange={e => setEntryDate(e.target.value)}
              max={todayISO()}
              className={inputClass + ' text-zinc-900'} />
          </div>
          <div>
            <label className="block text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-1.5">
              Headline <span className="text-zinc-400 font-normal normal-case">optional</span>
            </label>
            <input type="text" value={title} maxLength={120}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Best Monday of Q2 — sold out of Ankara sets"
              className={inputClass} />
          </div>
        </div>

        {/* Formatting toolbar */}
        <div>
          <div className="flex items-center gap-1 mb-2">
            <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mr-2">Entry</span>
            <button type="button" onClick={() => insertFormat('**', '**')} title="Bold"
              className="p-1.5 rounded-lg border border-zinc-200 text-zinc-500 hover:text-amber-500 hover:border-amber-300 transition text-xs font-black">
              <Bold size={11} />
            </button>
            <button type="button" onClick={insertBullet} title="Bullet point"
              className="p-1.5 rounded-lg border border-zinc-200 text-zinc-500 hover:text-amber-500 hover:border-amber-300 transition">
              <List size={11} />
            </button>
            <span className={`ml-auto text-[9px] font-bold ${charCount > charMax * 0.9 ? 'text-red-400' : 'text-zinc-400'}`}>
              {charCount}/{charMax}
            </span>
          </div>
          <textarea ref={textRef} value={body}
            onChange={e => { if (e.target.value.length <= charMax) setBody(e.target.value); }}
            rows={8}
            placeholder={
              "Write what happened today — sales highlights, challenges, decisions, observations...\n\n" +
              "Use the B button to bold key points, or the list button to add bullet points."
            }
            className={textareaClass} />
        </div>

        {error && (
          <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-xl">
            <AlertCircle size={13} className="text-red-500 shrink-0" />
            <p className="text-xs text-red-600">{error}</p>
          </div>
        )}

        <div className="flex gap-3 pt-1">
          {isEdit && (
            <button onClick={onCancel} disabled={isSaving}
              className="flex-1 py-3 text-zinc-500 font-black text-xs uppercase tracking-widest border border-zinc-200 rounded-xl hover:bg-zinc-50 transition disabled:opacity-40">
              Cancel
            </button>
          )}
          <button onClick={handleSubmit} disabled={isSaving || !body.trim()}
            className="flex-1 py-3 font-black text-xs uppercase tracking-widest rounded-xl text-black bg-amber-400 hover:bg-amber-500 disabled:opacity-50 transition flex items-center justify-center gap-2">
            {isSaving
              ? <><Loader2 size={13} className="animate-spin" /> Saving...</>
              : <><Save size={13} /> {isEdit ? 'Save Changes' : 'Log Entry'}</>
            }
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────
export default function DayLog() {
  const [entries,     setEntries]     = useState([]);
  const [hasMore,     setHasMore]     = useState(false);
  const [lastId,      setLastId]      = useState(null);
  const [isLoading,   setIsLoading]   = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isSaving,    setIsSaving]    = useState(false);
  const [isDeleting,  setIsDeleting]  = useState(null); // entry id being deleted
  const [error,       setError]       = useState('');

  // View / Edit modals
  const [viewEntry,   setViewEntry]   = useState(null);
  const [editEntry,   setEditEntry]   = useState(null);
  const [deleteEntry, setDeleteEntry] = useState(null); // entry to confirm delete

  // Compose visibility — hidden when editing an existing entry
  const [showCompose, setShowCompose] = useState(true);

  // ── Initial load ──────────────────────────────────────────────
  const loadEntries = useCallback(async (cursorId = null, append = false) => {
    if (append) setIsLoadingMore(true); else setIsLoading(true);
    try {
      const params = new URLSearchParams({ limit: PAGE_SIZE });
      if (cursorId) params.set('cursor', cursorId);
      const res  = await fetch(`/api/daylog?${params}`, { credentials: 'include' });
      const data = await res.json();
      if (data.success) {
        setEntries(prev => append ? [...prev, ...data.entries] : data.entries);
        setHasMore(data.hasMore);
        setLastId(data.lastId);
      }
    } catch { setError('Failed to load log entries.'); }
    finally { setIsLoading(false); setIsLoadingMore(false); }
  }, []);

  useEffect(() => { loadEntries(); }, [loadEntries]);

  // ── Create ────────────────────────────────────────────────────
  async function handleCreate(fields) {
    setIsSaving(true);
    try {
      const res  = await fetch('/api/daylog', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
      });
      const data = await res.json();
      if (data.success && data.entry) {
        setEntries(prev => [data.entry, ...prev]);
      }
    } catch { setError('Failed to save entry. Try again.'); }
    finally { setIsSaving(false); }
  }

  // ── Edit ──────────────────────────────────────────────────────
  async function handleEdit(fields) {
    if (!editEntry) return;
    setIsSaving(true);
    try {
      const res  = await fetch(`/api/daylog/${editEntry.id}`, {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fields),
      });
      const data = await res.json();
      if (data.success) {
        setEntries(prev => prev.map(e =>
          e.id === editEntry.id ? { ...e, ...fields } : e
        ));
        setEditEntry(null);
        setShowCompose(true);
      }
    } catch { setError('Failed to update entry.'); }
    finally { setIsSaving(false); }
  }

  // ── Delete ────────────────────────────────────────────────────
  async function handleDelete(entry) {
    setIsDeleting(entry.id);
    try {
      const res  = await fetch(`/api/daylog/${entry.id}`, {
        method: 'DELETE', credentials: 'include',
      });
      const data = await res.json();
      if (data.success) {
        setEntries(prev => prev.filter(e => e.id !== entry.id));
        setDeleteEntry(null);
        if (viewEntry?.id === entry.id) setViewEntry(null);
      }
    } catch { setError('Failed to delete entry.'); }
    finally { setIsDeleting(null); }
  }

  function startEdit(entry) {
    setViewEntry(null);
    setEditEntry(entry);
    setShowCompose(false);
  }

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* ── Page Header ──────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-black uppercase tracking-tighter text-zinc-900 flex items-center gap-2.5">
            <BookOpen size={20} className="text-amber-500" />
            Day Log
          </h2>
          <p className="text-xs text-zinc-500 mt-1 max-w-md">
            Your private business journal. Record what happened each day — sales wins, stock issues, decisions, anything worth remembering. The AI Advisor reads these to give you sharper, more personal insights.
          </p>
        </div>
        {!showCompose && !editEntry && (
          <button onClick={() => setShowCompose(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-amber-400 hover:bg-amber-500 text-black font-black text-xs uppercase tracking-widest rounded-xl transition">
            <Plus size={13} /> New Entry
          </button>
        )}
      </div>

      {error && (
        <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl">
          <AlertCircle size={14} className="text-red-500 shrink-0" />
          <p className="text-sm text-red-600">{error}</p>
          <button onClick={() => setError('')} className="ml-auto text-red-400 hover:text-red-600"><X size={14} /></button>
        </div>
      )}

      {/* ── Compose panel (new entry) ─────────────────────── */}
      {showCompose && !editEntry && (
        <ComposePanel
          onSave={handleCreate}
          onCancel={() => setShowCompose(false)}
          isSaving={isSaving}
        />
      )}

      {/* ── Edit panel ───────────────────────────────────── */}
      {editEntry && (
        <ComposePanel
          initial={editEntry}
          onSave={handleEdit}
          onCancel={() => { setEditEntry(null); setShowCompose(true); }}
          isSaving={isSaving}
        />
      )}

      {/* ── Entries list ─────────────────────────────────── */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="animate-spin text-amber-400" />
        </div>
      ) : entries.length === 0 ? (
        /* Empty state */
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center mb-5">
            <BookOpen size={24} className="text-amber-400" />
          </div>
          <h3 className="text-sm font-black uppercase tracking-tighter mb-2 text-zinc-900">No Entries Yet</h3>
          <p className="text-zinc-500 text-xs max-w-xs leading-relaxed mb-1">
            Use the Day Log to record what happens in your business each day.
          </p>
          <p className="text-zinc-400 text-xs max-w-xs leading-relaxed">
            Sales wins, restocking decisions, customer feedback, challenges — anything worth tracking. Your AI Advisor uses these entries to give you more personal, specific insights.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Entry count */}
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
            {entries.length} {entries.length === 1 ? 'entry' : 'entries'} logged{hasMore ? ' — scroll for more' : ''}
          </p>

          {entries.map(entry => {
            const preview = entry.body?.replace(/\*\*/g, '').slice(0, 160);
            const isLong  = (entry.body?.length || 0) > 160;

            return (
              <div key={entry.id}
                className="bg-white border border-zinc-200 rounded-2xl p-5 hover:border-zinc-300 transition group">
                <div className="flex items-start justify-between gap-3">
                  {/* Left — date + title + preview */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <span className="text-[10px] font-black uppercase tracking-widest text-amber-500 flex items-center gap-1">
                        <Calendar size={9} /> {fmtEntryDate(entry.entryDate)}
                      </span>
                      <span className="text-[9px] text-zinc-400 flex items-center gap-1">
                        <Clock size={8} /> {daysSinceEntry(entry.entryDate)}
                      </span>
                    </div>
                    {entry.title && (
                      <p className="text-sm font-black text-zinc-900 mb-1 leading-snug">{entry.title}</p>
                    )}
                    <p className="text-xs text-zinc-600 leading-relaxed">
                      {preview}{isLong ? '…' : ''}
                    </p>
                  </div>

                  {/* Right — actions */}
                  <div className="flex items-center gap-1.5 shrink-0 opacity-0 group-hover:opacity-100 transition">
                    <button onClick={() => setViewEntry(entry)}
                      title="View full entry"
                      className="p-2 rounded-xl border border-zinc-200 text-zinc-500 hover:text-amber-500 hover:border-amber-300 transition">
                      <Eye size={13} />
                    </button>
                    <button onClick={() => startEdit(entry)}
                      title="Edit entry"
                      className="p-2 rounded-xl border border-zinc-200 text-zinc-500 hover:text-amber-500 hover:border-amber-300 transition">
                      <Edit3 size={13} />
                    </button>
                    <button onClick={() => setDeleteEntry(entry)}
                      title="Delete entry"
                      className="p-2 rounded-xl border border-zinc-200 text-zinc-500 hover:text-red-400 hover:border-red-200 transition">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Load more */}
          {hasMore && (
            <button
              onClick={() => loadEntries(lastId, true)}
              disabled={isLoadingMore}
              className="w-full py-3.5 border border-zinc-200 rounded-2xl text-xs font-black uppercase tracking-widest text-zinc-500 hover:bg-zinc-50 hover:text-zinc-700 transition flex items-center justify-center gap-2 disabled:opacity-50">
              {isLoadingMore
                ? <><Loader2 size={13} className="animate-spin" /> Loading...</>
                : <><ChevronDown size={13} /> Load More Entries</>
              }
            </button>
          )}
        </div>
      )}

      {/* ── View Modal ───────────────────────────────────── */}
      {viewEntry && (
        <ViewModal
          entry={viewEntry}
          onClose={() => setViewEntry(null)}
          onEdit={startEdit}
        />
      )}

      {/* ── Delete Confirm Modal ─────────────────────────── */}
      {deleteEntry && (
        <div className="fixed inset-0 bg-zinc-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-zinc-200 rounded-2xl w-full max-w-sm shadow-2xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-red-50 border border-red-200 flex items-center justify-center shrink-0">
                <Trash2 size={15} className="text-red-500" />
              </div>
              <div>
                <p className="text-sm font-black uppercase tracking-tight text-red-600">Delete Entry</p>
                <p className="text-xs text-zinc-500 mt-0.5">{fmtEntryDate(deleteEntry.entryDate)}{deleteEntry.title ? ` — ${deleteEntry.title}` : ''}</p>
              </div>
            </div>
            <p className="text-xs text-zinc-600">This entry will be permanently deleted and cannot be recovered.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteEntry(null)} disabled={!!isDeleting}
                className="flex-1 py-3 text-zinc-500 font-black text-xs uppercase tracking-widest border border-zinc-200 rounded-xl hover:bg-zinc-50 transition disabled:opacity-40">
                Cancel
              </button>
              <button onClick={() => handleDelete(deleteEntry)} disabled={!!isDeleting}
                className="flex-1 py-3 font-black text-xs uppercase tracking-widest rounded-xl text-white bg-red-500 hover:bg-red-600 disabled:opacity-50 transition flex items-center justify-center gap-2">
                {isDeleting === deleteEntry.id
                  ? <><Loader2 size={13} className="animate-spin" /> Deleting...</>
                  : <><Trash2 size={13} /> Delete</>
                }
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
