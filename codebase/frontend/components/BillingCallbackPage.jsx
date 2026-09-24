/**
 * BillingCallbackPage.jsx
 *
 * Route: /billing/callback
 *
 * Paystack redirects the browser here after checkout (success,
 * cancellation, or failure) with a `reference` (or `trxref`) query
 * param. This page calls GET /api/payments/verify/:reference for an
 * immediate, definitive answer — rather than making the user guess
 * while the webhook processes asynchronously in the background (the
 * webhook still runs regardless and remains the source of truth for
 * renewals; this call is a redundant-but-safe, idempotent confirmation
 * that just gives faster feedback for THIS checkout).
 */

import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { CheckCircle2, XCircle, Loader2, ArrowRight } from 'lucide-react';

export default function BillingCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate         = useNavigate();
  const { refreshSubscription } = useAuth();

  const reference = searchParams.get('reference') || searchParams.get('trxref') || '';

  const [status,  setStatus]  = useState('checking'); // 'checking' | 'success' | 'failed' | 'unknown'
  const [message, setMessage] = useState('');
  const [planName, setPlanName] = useState('');
  const [sessionValid, setSessionValid] = useState(true);

  useEffect(() => {
    if (!reference) {
      setStatus('failed');
      setMessage('No payment reference found in the link. If you completed checkout, check your dashboard — it may have already gone through.');
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res  = await fetch(`/api/payments/verify/${encodeURIComponent(reference)}`, {
          credentials: 'include',
        });
        const data = await res.json();

        if (cancelled) return;

        if (!res.ok || !data.success) {
          setStatus('failed');
          setMessage(data.message || 'Could not confirm this payment. Please contact support if you were charged.');
          return;
        }

        // Neither this browser's payment-confirmation cookie nor a live
        // login session could be verified — the server won't disclose
        // status/plan details to an unproven caller (see controllers/
        // payments.controller.js). This is NOT "payment failed" — it
        // may well have succeeded; we just can't show it here. The
        // webhook applies the upgrade independently regardless.
        if (data.requiresLogin) {
          setStatus('unknown');
          return;
        }

        if (data.paymentStatus === 'success') {
          setStatus('success');
          setPlanName(data.planName || '');
          // sessionValid is false when the browser's cookie had already
          // expired during checkout (Paystack's card entry/OTP/3D Secure
          // can take a few minutes) — the upgrade is still fully applied
          // server-side (see controllers/payments.controller.js), but
          // this browser has nothing to refresh: refreshSubscription()
          // would just silently fail the same expired-session check.
          setSessionValid(data.sessionValid !== false);
          if (data.sessionValid !== false) {
            await refreshSubscription(); // so the dashboard reflects the new plan immediately
          }
        } else {
          setStatus('failed');
          setMessage('This payment was not completed. No charge was made — feel free to try again.');
        }
      } catch {
        if (!cancelled) {
          setStatus('failed');
          setMessage('Network error confirming this payment. Check your dashboard, or contact support if you were charged.');
        }
      }
    })();

    return () => { cancelled = true; };
  }, [reference, refreshSubscription]);

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white border border-zinc-200 rounded-2xl shadow-2xl p-8 text-center">
        {status === 'checking' && (
          <>
            <Loader2 size={32} className="animate-spin text-amber-500 mx-auto mb-4" />
            <h1 className="text-lg font-black uppercase tracking-tight text-zinc-900">Confirming Payment…</h1>
            <p className="text-sm text-zinc-500 mt-2">This only takes a moment.</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4 bg-green-500/10">
              <CheckCircle2 size={24} className="text-green-500" />
            </div>
            <h1 className="text-lg font-black uppercase tracking-tight text-zinc-900">Payment Successful</h1>
            <p className="text-sm text-zinc-500 mt-2">
              {planName ? `You're now on ${planName}.` : 'Your subscription is now active.'}
            </p>
            {!sessionValid && (
              <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-4">
                Your login session expired during checkout — this didn't affect your payment, it's fully applied.
                Please log back in to see it on your dashboard.
              </p>
            )}
            <button
              onClick={() => navigate(sessionValid ? '/your-roadmap' : '/', { replace: true })}
              className="mt-6 w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-black font-black text-xs uppercase tracking-widest py-3.5 rounded-xl transition"
            >
              {sessionValid ? 'Go to Dashboard' : 'Log In'}
              <ArrowRight size={15} />
            </button>
          </>
        )}

        {status === 'unknown' && (
          <>
            <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4 bg-amber-500/10">
              <Loader2 size={24} className="text-amber-500" />
            </div>
            <h1 className="text-lg font-black uppercase tracking-tight text-zinc-900">Log In to Confirm</h1>
            <p className="text-sm text-zinc-500 mt-2">
              We can't confirm this payment from here anymore — your login session ended during checkout.
              This does NOT mean the payment failed. Log back in and check your dashboard; if you were
              charged, it will already be reflected there.
            </p>
            <button
              onClick={() => navigate('/', { replace: true })}
              className="mt-6 w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-black font-black text-xs uppercase tracking-widest py-3.5 rounded-xl transition"
            >
              Log In
              <ArrowRight size={15} />
            </button>
          </>
        )}

        {status === 'failed' && (
          <>
            <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-4 bg-red-500/10">
              <XCircle size={24} className="text-red-500" />
            </div>
            <h1 className="text-lg font-black uppercase tracking-tight text-zinc-900">Payment Not Completed</h1>
            <p className="text-sm text-zinc-500 mt-2">{message}</p>
            <button
              onClick={() => navigate('/billing', { replace: true })}
              className="mt-6 w-full flex items-center justify-center gap-2 bg-zinc-900 hover:bg-zinc-800 text-white font-black text-xs uppercase tracking-widest py-3.5 rounded-xl transition"
            >
              Back to Billing
            </button>
          </>
        )}
      </div>
    </div>
  );
}
