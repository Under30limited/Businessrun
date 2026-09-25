/**
 * ReportsView.jsx
 *
 * AI-generated business reports — Sales and Inventory.
 *
 * Features:
 *   - Shows most recent saved report on open (persistent)
 *   - Date range picker + "Generate New Report" button at top
 *   - 5 generations per 24h limit — remaining count shown
 *   - List of all past reports, click to view any
 *   - Flowing prose rendered with section headers (## Header)
 *   - Delete individual reports
 *
 * Props:
 *   type        'sales' | 'inventory'
 *   language    current dashboard language
 *   profile     { businessName, stage, salesChannel, headache }
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  FileText, Loader2, X, Trash2, ChevronDown,
  ChevronLeft, Calendar, Sparkles, AlertCircle,
  Clock, RefreshCw, ChevronRight,
} from 'lucide-react';

const inputClass = 'bg-zinc-50 border border-zinc-200 rounded-xl px-3 py-2.5 text-sm text-zinc-900 focus:outline-none focus:border-amber-500 transition-colors';

// ── Prose renderer — ## Header becomes a styled section heading ──
function ReportBody({ content }) {
  if (!content) return null;
  const lines = content.split('\n');
  return (
    <div className="space-y-3">
      {lines.map((line, i) => {
        if (line.startsWith('## ')) {
          return (
            <h3 key={i} className="text-sm font-black uppercase tracking-widest text-zinc-900 pt-4 pb-1 border-b border-zinc-100">
              {line.replace('## ', '')}
            </h3>
          );
        }
        if (line.startsWith('# ')) {
          return (
            <h2 key={i} className="text-base font-black uppercase tracking-tight text-amber-600 pt-2">
              {line.replace('# ', '')}
            </h2>
          );
        }
        if (line.startsWith('- ') || line.startsWith('• ')) {
          return (
            <p key={i} className="text-sm text-zinc-700 leading-relaxed pl-4">
              {line}
            </p>
          );
        }
        if (line.trim() === '') return <div key={i} className="h-1" />;
        return (
          <p key={i} className="text-sm text-zinc-700 leading-relaxed">
            {line.split(/\*\*(.+?)\*\*/g).map((part, j) =>
              j % 2 === 1
                ? <strong key={j} className="font-black text-zinc-900">{part}</strong>
                : part
            )}
          </p>
        );
      })}
    </div>
  );
}

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-NG', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function ReportsView({ type, language, profile }) {
  const typeLabel = type === 'sales' ? 'Sales' : 'Inventory';
  const typeDesc  = type === 'sales'
    ? 'AI-generated analysis of your sales performance, revenue patterns, and growth opportunities.'
    : 'AI-generated analysis of your stock health, margins, dead stock, and reorder priorities.';

  const [reports,      setReports]      = useState([]);
  const [activeReport, setActiveReport] = useState(null); // report being viewed
  const [isLoading,    setIsLoading]    = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isDeleting,   setIsDeleting]   = useState(null);
  const [remaining,    setRemaining]    = useState(5);
  const [error,        setError]        = useState('');
  const [showForm,     setShowForm]     = useState(false);

  // Date range for new report
  const [fromDate, setFromDate] = useState('');
  const [toDate,   setToDate]   = useState(todayISO());

  // ── Load existing reports ───────────────────────────────────────
  const loadReports = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const res  = await fetch(`/api/reports/${type}`, { credentials: 'include' });
      const data = await res.json();
      if (data.success) {
        setReports(data.reports);
        // Auto-open the most recent report
        if (data.reports.length > 0 && !activeReport) {
          setActiveReport(data.reports[0]);
        }
      }
    } catch { setError('Failed to load reports.'); }
    finally { setIsLoading(false); }
  }, [type]); // eslint-disable-line

  useEffect(() => { loadReports(); }, [loadReports]);

  // ── Generate new report ─────────────────────────────────────────
  async function handleGenerate() {
    setIsGenerating(true);
    setError('');
    try {
      const res  = await fetch(`/api/reports/${type}/generate`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fromDate: fromDate || undefined, toDate: toDate || undefined, language }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message || 'Failed to generate report.'); return; }
      if (data.success && data.report) {
        setReports(prev => [data.report, ...prev]);
        setActiveReport(data.report);
        setRemaining(data.remaining ?? remaining - 1);
        setShowForm(false);
      }
    } catch { setError('Failed to generate report. Check your connection.'); }
    finally { setIsGenerating(false); }
  }

  // ── Delete report ───────────────────────────────────────────────
  async function handleDelete(report) {
    setIsDeleting(report.id);
    try {
      const res  = await fetch(`/api/reports/${report.id}`, { method: 'DELETE', credentials: 'include' });
      const data = await res.json();
      if (data.success) {
        const next = reports.filter(r => r.id !== report.id);
        setReports(next);
        if (activeReport?.id === report.id) {
          setActiveReport(next.length > 0 ? next[0] : null);
        }
      }
    } catch { setError('Failed to delete report.'); }
    finally { setIsDeleting(null); }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 size={24} className="animate-spin text-amber-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Header ───────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-black uppercase tracking-tighter text-zinc-900 flex items-center gap-2.5">
            <FileText size={20} className="text-amber-500" />
            {typeLabel} Report
          </h2>
          <p className="text-xs text-zinc-500 mt-1 max-w-lg">{typeDesc}</p>
        </div>
        <button
          onClick={() => { setShowForm(f => !f); setError(''); }}
          disabled={isGenerating}
          className="flex items-center gap-2 px-4 py-2.5 bg-amber-400 hover:bg-amber-500 text-black font-black text-xs uppercase tracking-widest rounded-xl transition disabled:opacity-50">
          <Sparkles size={13} />
          Generate New
          <ChevronDown size={12} className={`transition-transform ${showForm ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl">
          <AlertCircle size={14} className="text-red-500 shrink-0" />
          <p className="text-sm text-red-600 flex-1">{error}</p>
          <button onClick={() => setError('')}><X size={14} className="text-red-400" /></button>
        </div>
      )}

      {/* ── Generate form (expandable) ───────────────────────── */}
      {showForm && (
        <div className="bg-white border border-zinc-200 rounded-2xl p-5 space-y-4 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs font-black uppercase tracking-widest text-zinc-700 flex items-center gap-2">
              <Calendar size={13} className="text-amber-500" /> Select Period
            </p>
            <span className={`text-[10px] font-black px-2.5 py-1 rounded-lg ${remaining > 1 ? 'bg-zinc-100 text-zinc-500' : 'bg-red-50 text-red-500'}`}>
              {remaining} generation{remaining === 1 ? '' : 's'} remaining today
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-1.5">From</label>
              <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
                max={todayISO()} className={inputClass + ' w-full'} />
            </div>
            <div>
              <label className="block text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-1.5">To</label>
              <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
                max={todayISO()} className={inputClass + ' w-full'} />
            </div>
          </div>
          <p className="text-[10px] text-zinc-400">Leave "From" blank to include all records up to the "To" date.</p>
          <button
            onClick={handleGenerate}
            disabled={isGenerating || remaining <= 0}
            className="w-full py-3 font-black text-xs uppercase tracking-widest rounded-xl text-black bg-amber-400 hover:bg-amber-500 disabled:opacity-50 transition flex items-center justify-center gap-2">
            {isGenerating
              ? <><Loader2 size={13} className="animate-spin" /> Generating Report — this may take 15–30 seconds...</>
              : <><Sparkles size={13} /> Generate {typeLabel} Report</>
            }
          </button>
        </div>
      )}

      {/* ── Empty state ──────────────────────────────────────── */}
      {reports.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center mb-5">
            <FileText size={24} className="text-amber-400" />
          </div>
          <h3 className="text-sm font-black uppercase tracking-tighter mb-2 text-zinc-900">No Reports Yet</h3>
          <p className="text-zinc-500 text-xs max-w-xs leading-relaxed">
            Generate your first {typeLabel.toLowerCase()} report above. Select a date range and let the AI analyse your data.
          </p>
        </div>
      )}

      {/* ── Two-column layout: report list + active report ───── */}
      {reports.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-5 items-start">

          {/* Report list */}
          <div className="space-y-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 px-1">
              {reports.length} saved report{reports.length === 1 ? '' : 's'}
            </p>
            {reports.map(r => (
              <button key={r.id}
                onClick={() => setActiveReport(r)}
                className={`w-full text-left px-4 py-3.5 rounded-xl border transition group ${
                  activeReport?.id === r.id
                    ? 'bg-amber-50 border-amber-300 text-amber-700'
                    : 'bg-white border-zinc-200 hover:border-zinc-300 text-zinc-700'
                }`}>
                <p className="text-[11px] font-black uppercase tracking-wide leading-snug line-clamp-2 mb-1">
                  {r.title}
                </p>
                <div className="flex items-center justify-between">
                  <span className="text-[9px] text-zinc-400 flex items-center gap-1">
                    <Clock size={8} /> {fmtDate(r.createdAtISO)}
                  </span>
                  <button
                    onClick={e => { e.stopPropagation(); handleDelete(r); }}
                    disabled={isDeleting === r.id}
                    className="opacity-0 group-hover:opacity-100 transition text-zinc-400 hover:text-red-400 p-0.5">
                    {isDeleting === r.id
                      ? <Loader2 size={11} className="animate-spin" />
                      : <Trash2 size={11} />
                    }
                  </button>
                </div>
              </button>
            ))}
          </div>

          {/* Active report display */}
          {activeReport && (
            <div className="bg-white border border-zinc-200 rounded-2xl overflow-hidden shadow-sm">
              {/* Report header */}
              <div className="px-6 py-5 border-b border-zinc-100 bg-zinc-50">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-amber-500 mb-1 flex items-center gap-1.5">
                      <Sparkles size={9} /> AI Generated · {fmtDate(activeReport.createdAtISO)}
                    </p>
                    <h3 className="text-base font-black uppercase tracking-tight text-zinc-900 leading-tight">
                      {activeReport.title}
                    </h3>
                    {(activeReport.fromDate || activeReport.toDate) && (
                      <p className="text-[10px] text-zinc-500 mt-1 flex items-center gap-1">
                        <Calendar size={9} />
                        {activeReport.fromDate || 'All time'} → {activeReport.toDate || 'Today'}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => { setShowForm(true); setError(''); }}
                    className="flex items-center gap-1.5 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-zinc-500 border border-zinc-200 rounded-xl hover:bg-zinc-100 transition shrink-0">
                    <RefreshCw size={11} /> Regenerate
                  </button>
                </div>
              </div>

              {/* Report body */}
              <div className="px-6 py-6 max-h-[70vh] overflow-y-auto">
                <ReportBody content={activeReport.content} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
