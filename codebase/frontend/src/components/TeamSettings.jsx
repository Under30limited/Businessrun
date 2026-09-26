/**
 * TeamSettings.jsx
 *
 * Owner-only dashboard view for managing team access.
 * Reached from the sidebar footer button in RoadmapPage.jsx
 * (between Language and Exit to Home) — never shown to team members.
 *
 * Maps to the backend team feature:
 *   GET    /api/team              → list members
 *   POST   /api/team/invite       → invite a new member
 *   PATCH  /api/team/:memberId    → update permissions or status
 *   DELETE /api/team/:memberId    → permanently remove a member
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Users, UserPlus, Loader2, AlertCircle, X, Mail,
  ShieldCheck, ShieldOff, Trash2, Check, Clock, RotateCcw,
} from 'lucide-react';

const BRAND = '#C5A028';
const inputClass = 'w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-amber-500 transition-colors';

// Must match FEATURE_KEYS / FEATURE_LABELS in controllers/team.controller.js
const FEATURES = [
  { key: 'inventory', label: 'Inventory' },
  { key: 'sales',     label: 'Sales Day Book' },
  { key: 'daylog',    label: 'Day Log' },
  { key: 'reports',   label: 'Reports' },
  { key: 'cfo',       label: 'Digital CFO' },
  { key: 'advisor',   label: 'BR AI Advisor' },
];

function fmt(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' });
}

function StatusBadge({ status }) {
  const map = {
    active:  { label: 'Active',  cls: 'bg-green-500/10 text-green-600 border-green-500/20' },
    pending: { label: 'Pending', cls: 'bg-amber-500/10 text-amber-600 border-amber-500/20' },
    revoked: { label: 'Revoked', cls: 'bg-red-500/10 text-red-500 border-red-500/20' },
  };
  const s = map[status] || map.pending;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest border ${s.cls}`}>
      {s.label}
    </span>
  );
}

// ── Invite modal ─────────────────────────────────────────────────
function InviteModal({ onClose, onInvited }) {
  const [email,       setEmail]       = useState('');
  const [permissions, setPermissions] = useState([]);
  const [submitting,  setSubmitting]  = useState(false);
  const [error,       setError]       = useState('');

  function togglePermission(key) {
    setPermissions(prev => prev.includes(key) ? prev.filter(p => p !== key) : [...prev, key]);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!email.trim()) { setError('Email is required.'); return; }
    if (permissions.length === 0) { setError('Grant access to at least one feature.'); return; }

    setSubmitting(true);
    try {
      const res  = await fetch('/api/team/invite', {
        method:      'POST',
        credentials: 'include',
        headers:     { 'Content-Type': 'application/json' },
        body:        JSON.stringify({ email: email.trim().toLowerCase(), permissions }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.message || 'Could not send the invite. Please try again.');
        setSubmitting(false);
        return;
      }

      onInvited();
    } catch {
      setError('Network error. Please check your connection and try again.');
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-zinc-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white border border-zinc-200 rounded-2xl w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">

        <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-100">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: BRAND + '15' }}>
              <UserPlus size={15} style={{ color: BRAND }} />
            </div>
            <h2 className="text-base font-black uppercase tracking-tight">Invite Team Member</h2>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700 transition"><X size={18} /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">
              Email address
            </label>
            <div className="relative">
              <Mail size={15} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="teammate@example.com"
                className={`${inputClass} pl-11`}
                autoFocus
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">
              Grant access to
            </label>
            <div className="space-y-2">
              {FEATURES.map(f => (
                <label
                  key={f.key}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition
                    ${permissions.includes(f.key)
                      ? 'bg-amber-500/10 border-amber-500/30'
                      : 'bg-zinc-50 border-zinc-200 hover:border-zinc-300'
                    }`}
                >
                  <input
                    type="checkbox"
                    checked={permissions.includes(f.key)}
                    onChange={() => togglePermission(f.key)}
                    className="sr-only"
                  />
                  <span className={`w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0
                    ${permissions.includes(f.key) ? 'border-amber-500' : 'border-zinc-300'}`}
                    style={permissions.includes(f.key) ? { background: BRAND } : {}}
                  >
                    {permissions.includes(f.key) && <Check size={12} className="text-black" />}
                  </span>
                  <span className="text-sm font-semibold text-zinc-800">{f.label}</span>
                </label>
              ))}
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600">
              <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-black font-black text-xs uppercase tracking-widest py-3.5 rounded-xl transition"
          >
            {submitting ? <Loader2 size={15} className="animate-spin" /> : <UserPlus size={15} />}
            {submitting ? 'Sending Invite…' : 'Send Invite'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Edit-permissions modal ────────────────────────────────────────
function EditPermissionsModal({ member, onClose, onSaved }) {
  const [permissions, setPermissions] = useState(member.permissions || []);
  const [submitting,  setSubmitting]  = useState(false);
  const [error,       setError]       = useState('');

  function togglePermission(key) {
    setPermissions(prev => prev.includes(key) ? prev.filter(p => p !== key) : [...prev, key]);
  }

  async function handleSave() {
    setError('');
    if (permissions.length === 0) { setError('At least one feature must stay granted — revoke instead to remove all access.'); return; }

    setSubmitting(true);
    try {
      const res  = await fetch(`/api/team/${member.uid}`, {
        method:      'PATCH',
        credentials: 'include',
        headers:     { 'Content-Type': 'application/json' },
        body:        JSON.stringify({ permissions }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.message || 'Could not save changes.');
        setSubmitting(false);
        return;
      }
      onSaved();
    } catch {
      setError('Network error. Please try again.');
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-zinc-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white border border-zinc-200 rounded-2xl w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-100">
          <div>
            <h2 className="text-base font-black uppercase tracking-tight">Edit Access</h2>
            <p className="text-xs text-zinc-500 mt-0.5">{member.email}</p>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700 transition"><X size={18} /></button>
        </div>

        <div className="p-6 space-y-5">
          <div className="space-y-2">
            {FEATURES.map(f => (
              <label
                key={f.key}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl border cursor-pointer transition
                  ${permissions.includes(f.key)
                    ? 'bg-amber-500/10 border-amber-500/30'
                    : 'bg-zinc-50 border-zinc-200 hover:border-zinc-300'
                  }`}
              >
                <input
                  type="checkbox"
                  checked={permissions.includes(f.key)}
                  onChange={() => togglePermission(f.key)}
                  className="sr-only"
                />
                <span className={`w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0
                  ${permissions.includes(f.key) ? 'border-amber-500' : 'border-zinc-300'}`}
                  style={permissions.includes(f.key) ? { background: BRAND } : {}}
                >
                  {permissions.includes(f.key) && <Check size={12} className="text-black" />}
                </span>
                <span className="text-sm font-semibold text-zinc-800">{f.label}</span>
              </label>
            ))}
          </div>

          {error && (
            <div className="flex items-start gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-600">
              <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <button
            onClick={handleSave}
            disabled={submitting}
            className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-60 text-black font-black text-xs uppercase tracking-widest py-3.5 rounded-xl transition"
          >
            {submitting ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
            {submitting ? 'Saving…' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────
export default function TeamSettings() {
  const [members,       setMembers]       = useState([]);
  const [loading,        setLoading]        = useState(true);
  const [loadError,     setLoadError]     = useState('');
  const [showInvite,    setShowInvite]    = useState(false);
  const [editingMember, setEditingMember] = useState(null);
  const [actionUid,     setActionUid]     = useState(null); // uid currently mid-revoke/reactivate/delete

  const loadMembers = useCallback(async () => {
    setLoadError('');
    try {
      const res  = await fetch('/api/team', { credentials: 'include' });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setLoadError(data.message || 'Could not load team members.');
        return;
      }
      setMembers(data.members || []);
    } catch {
      setLoadError('Network error loading team members.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadMembers(); }, [loadMembers]);

  async function handleStatusToggle(member) {
    const nextStatus = member.status === 'revoked' ? 'active' : 'revoked';
    setActionUid(member.uid);
    try {
      const res  = await fetch(`/api/team/${member.uid}`, {
        method:      'PATCH',
        credentials: 'include',
        headers:     { 'Content-Type': 'application/json' },
        body:        JSON.stringify({ status: nextStatus }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setMembers(prev => prev.map(m => m.uid === member.uid ? { ...m, status: nextStatus } : m));
      }
    } finally {
      setActionUid(null);
    }
  }

  async function handleDelete(member) {
    if (!window.confirm(`Remove ${member.email} from your team? This can't be undone.`)) return;
    setActionUid(member.uid);
    try {
      const res  = await fetch(`/api/team/${member.uid}`, { method: 'DELETE', credentials: 'include' });
      const data = await res.json();
      if (res.ok && data.success) {
        setMembers(prev => prev.filter(m => m.uid !== member.uid));
      }
    } finally {
      setActionUid(null);
    }
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-black uppercase tracking-tight text-zinc-900 flex items-center gap-2">
            <Users size={20} style={{ color: BRAND }} />
            Team Access
          </h1>
          <p className="text-sm text-zinc-500 mt-1">
            Invite people to help run your business, and control exactly which parts of your dashboard they can see.
          </p>
        </div>
        <button
          onClick={() => setShowInvite(true)}
          className="flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-black font-black text-xs uppercase tracking-widest px-4 py-3 rounded-xl transition flex-shrink-0"
        >
          <UserPlus size={15} />
          Invite Member
        </button>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16 text-zinc-400">
          <Loader2 size={22} className="animate-spin" />
        </div>
      )}

      {!loading && loadError && (
        <div className="flex items-start gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-600">
          <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
          <span>{loadError}</span>
        </div>
      )}

      {!loading && !loadError && members.length === 0 && (
        <div className="flex flex-col items-center text-center py-16 border border-dashed border-zinc-200 rounded-2xl">
          <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-3" style={{ background: BRAND + '15' }}>
            <Users size={20} style={{ color: BRAND }} />
          </div>
          <p className="text-sm font-bold text-zinc-700">No team members yet</p>
          <p className="text-xs text-zinc-400 mt-1 max-w-xs">
            Invite someone to help with sales, inventory, or day-to-day bookkeeping — you decide exactly what they can access.
          </p>
        </div>
      )}

      {!loading && !loadError && members.length > 0 && (
        <div className="space-y-3">
          {members.map(member => (
            <div key={member.uid} className="bg-white border border-zinc-200 rounded-2xl p-5">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-black text-zinc-900 truncate">{member.email}</p>
                    <StatusBadge status={member.status} />
                  </div>
                  <p className="text-[11px] text-zinc-400 mt-1 flex items-center gap-1">
                    <Clock size={11} />
                    Invited {fmt(member.invitedAt)}
                    {member.acceptedAt && ` · Joined ${fmt(member.acceptedAt)}`}
                  </p>
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {(member.permissions || []).map(p => (
                      <span key={p} className="px-2 py-0.5 bg-zinc-100 text-zinc-600 text-[10px] font-bold uppercase tracking-wide rounded-md">
                        {FEATURES.find(f => f.key === p)?.label || p}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-1.5 flex-shrink-0">
                  <button
                    onClick={() => setEditingMember(member)}
                    disabled={member.status === 'revoked'}
                    title="Edit access"
                    className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 transition disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <ShieldCheck size={15} />
                  </button>
                  {member.status !== 'pending' && (
                    <button
                      onClick={() => handleStatusToggle(member)}
                      disabled={actionUid === member.uid}
                      title={member.status === 'revoked' ? 'Restore access' : 'Revoke access'}
                      className={`w-8 h-8 flex items-center justify-center rounded-lg transition disabled:opacity-40
                        ${member.status === 'revoked'
                          ? 'text-green-500 hover:bg-green-50'
                          : 'text-amber-500 hover:bg-amber-50'
                        }`}
                    >
                      {actionUid === member.uid
                        ? <Loader2 size={15} className="animate-spin" />
                        : member.status === 'revoked' ? <RotateCcw size={15} /> : <ShieldOff size={15} />
                      }
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(member)}
                    disabled={actionUid === member.uid}
                    title="Remove member"
                    className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-400 hover:text-red-500 hover:bg-red-50 transition disabled:opacity-40"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showInvite && (
        <InviteModal
          onClose={() => setShowInvite(false)}
          onInvited={() => { setShowInvite(false); loadMembers(); }}
        />
      )}

      {editingMember && (
        <EditPermissionsModal
          member={editingMember}
          onClose={() => setEditingMember(null)}
          onSaved={() => { setEditingMember(null); loadMembers(); }}
        />
      )}
    </div>
  );
}
