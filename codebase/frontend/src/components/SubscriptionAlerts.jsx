/**
 * SubscriptionAlerts.jsx
 *
 * Two separate overlays, both driven by AuthContext's `subscription`
 * and `teamAccessBlocked` (set by every session-establishing endpoint
 * — see AuthContext.jsx and auth.controller.js's getSubscriptionSummary).
 *
 *   <RenewalAlert />           — dismissible, appears when the trial/
 *                                 billing period is ending soon.
 *                                 Different content for owner (real
 *                                 payment CTA) vs member (informational
 *                                 "ask your owner" only).
 *
 *   <TeamAccessBlockedOverlay /> — NOT dismissible. Covers the whole
 *                                 screen. Only ever shown to a team
 *                                 member whose business's current plan
 *                                 doesn't support team members at all
 *                                 (BusinessRun Zero = 1 user). The
 *                                 owner is never blocked by this.
 *
 * Both read directly from useAuth() — no props needed, drop either
 * one in near the top of RoadmapPage's render tree.
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { AlertTriangle, X, CreditCard, LogOut, Clock } from 'lucide-react';

const BRAND = '#C5A028';

// ── RenewalAlert ─────────────────────────────────────────────────
export function RenewalAlert() {
  const { user, subscription } = useAuth();
  const navigate = useNavigate();
  const [dismissed, setDismissed] = useState(false);

  // Re-arm the dismissal if the underlying period actually changes
  // (e.g. they renewed, or logged into a different business) — a
  // stale dismissal shouldn't hide a NEW alert forever.
  useEffect(() => { setDismissed(false); }, [subscription?.currentPeriodEnd, subscription?.trialEndsAt]);

  if (!subscription || !subscription.isApproachingEnd || dismissed) return null;

  const isOwner = user?.role !== 'member';
  const days    = subscription.daysRemaining;
  const noun    = subscription.status === 'trialing' ? 'free trial' : 'plan';

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] w-full max-w-md px-4">
      <div className="bg-white border border-amber-300 rounded-2xl shadow-2xl p-4 flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: BRAND + '15' }}>
          <Clock size={16} style={{ color: BRAND }} />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-black text-zinc-900">
            {days === 0 ? `Your ${noun} ends today` : `Your ${noun} ends in ${days} day${days === 1 ? '' : 's'}`}
          </p>

          {isOwner ? (
            <>
              <p className="text-xs text-zinc-500 mt-1">
                Renew now to keep full access to {subscription.planName}'s features without interruption.
              </p>
              <button
                onClick={() => navigate('/billing')}
                className="mt-3 flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-black font-black text-[11px] uppercase tracking-widest px-3.5 py-2 rounded-lg transition"
              >
                <CreditCard size={13} />
                Renew Now
              </button>
            </>
          ) : (
            <p className="text-xs text-zinc-500 mt-1">
              Please let your business owner know so they can renew — your access continues once they do.
            </p>
          )}
        </div>

        <button
          onClick={() => setDismissed(true)}
          className="text-zinc-400 hover:text-zinc-700 transition flex-shrink-0"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}

// ── TeamAccessBlockedOverlay ─────────────────────────────────────
export function TeamAccessBlockedOverlay() {
  const { teamAccessBlocked, logout } = useAuth();
  const navigate = useNavigate();

  if (!teamAccessBlocked) return null;

  return (
    <div className="fixed inset-0 bg-zinc-950/95 backdrop-blur-sm flex items-center justify-center p-4 z-[100]">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-8 text-center">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4 bg-amber-500/10">
          <AlertTriangle size={22} className="text-amber-500" />
        </div>

        <h1 className="text-lg font-black uppercase tracking-tight text-zinc-900 mb-2">
          Team Access Paused
        </h1>

        <p className="text-sm text-zinc-500 leading-relaxed mb-6">
          This business's current plan doesn't include team member access right now.
          Your account is still here — you just need the business owner to renew or
          upgrade their subscription before you can get back in.
        </p>

        <div className="flex items-start gap-2 px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl text-left mb-6">
          <span className="text-[11px] text-zinc-500 leading-relaxed">
            Let the business owner know their subscription needs renewing so your access can be restored.
          </span>
        </div>

        <button
          onClick={() => logout(navigate)}
          className="w-full flex items-center justify-center gap-2 bg-zinc-900 hover:bg-zinc-800 text-white font-black text-xs uppercase tracking-widest py-3.5 rounded-xl transition"
        >
          <LogOut size={15} />
          Exit
        </button>
      </div>
    </div>
  );
}
