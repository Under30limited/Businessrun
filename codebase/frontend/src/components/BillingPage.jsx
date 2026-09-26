/**
 * BillingPage.jsx
 *
 * Route: /billing
 *
 * Owner: pick a plan + currency, redirected to Paystack's hosted
 * checkout. Member: informational only — no payment action exists
 * for a member account (only the business owner manages billing).
 *
 * Pricing comes from GET /api/plans (public, no auth) — the frontend
 * never hardcodes prices, so a naira-rate refresh or a plan tweak in
 * config/plans.js shows up here without a frontend deploy.
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Check, Loader2, AlertCircle, ArrowLeft, Users, Package,
  MessageSquare, Sparkles, Globe, Crown,
} from 'lucide-react';

const FEATURE_LABELS = {
  inventory: 'Inventory',
  sales:     'Sales Day Book',
  daylog:    'Day Log',
  reports:   'Reports',
  cfo:       'Digital CFO',
  advisor:   'BR AI Advisor',
};

function formatLimit(value, unit = '') {
  if (value === null || value === undefined) return `Unlimited${unit ? ' ' + unit : ''}`;
  return `${value}${unit ? ' ' + unit : ''}`;
}

export default function BillingPage() {
  const { user, subscription } = useAuth();
  const navigate = useNavigate();

  const [plans,        setPlans]        = useState([]);
  const [promo,        setPromo]        = useState(null);
  const [loading,      setLoading]      = useState(true);
  const [loadError,    setLoadError]    = useState('');
  const [currency,     setCurrency]     = useState('NGN'); // sensible default for the target market
  const [interval,     setIntervalVal]  = useState('monthly');
  const [submittingId, setSubmittingId] = useState(null);
  const [actionError,  setActionError]  = useState('');

  const isOwner = user?.role !== 'member';

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res  = await fetch('/api/plans');
        const data = await res.json();
        if (!cancelled) {
          if (data.success) { setPlans(data.plans); setPromo(data.promo || null); }
          else setLoadError('Could not load plans right now.');
        }
      } catch {
        if (!cancelled) setLoadError('Network error loading plans.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  async function handleSubscribe(planId) {
    setActionError('');
    setSubmittingId(planId);
    try {
      const res  = await fetch('/api/payments/initialize', {
        method:      'POST',
        credentials: 'include',
        headers:     { 'Content-Type': 'application/json' },
        body:        JSON.stringify({ planId, currency, interval }),
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setActionError(data.message || 'Could not start checkout. Please try again.');
        setSubmittingId(null);
        return;
      }

      // Full redirect to Paystack's hosted checkout — not a fetch,
      // an actual page navigation, since this is where the user
      // enters card/bank details on Paystack's own domain.
      window.location.href = data.authorizationUrl;
    } catch {
      setActionError('Network error. Please try again.');
      setSubmittingId(null);
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <button
          onClick={() => navigate('/your-roadmap')}
          className="flex items-center gap-2 text-zinc-500 hover:text-zinc-800 transition text-sm font-bold mb-6"
        >
          <ArrowLeft size={16} />
          Back to Dashboard
        </button>

        <div className="mb-8">
          <h1 className="text-2xl font-black uppercase tracking-tight text-zinc-900">Billing & Plans</h1>
          {subscription && (
            <p className="text-sm text-zinc-500 mt-1">
              Current plan: <span className="font-bold text-zinc-800">{subscription.planName}</span>
              {subscription.billingInterval && (
                <span className="text-zinc-400"> ({subscription.billingInterval === 'annually' ? 'Yearly' : 'Monthly'})</span>
              )}
              {subscription.status === 'trialing' && subscription.daysRemaining !== null && (
                <> — trial ends in {subscription.daysRemaining} day{subscription.daysRemaining === 1 ? '' : 's'}</>
              )}
              {subscription.status === 'active' && subscription.daysRemaining !== null && (
                <> — renews in {subscription.daysRemaining} day{subscription.daysRemaining === 1 ? '' : 's'}</>
              )}
            </p>
          )}
        </div>

        {!isOwner && (
          <div className="flex items-start gap-3 px-5 py-4 bg-amber-50 border border-amber-200 rounded-2xl mb-8">
            <AlertCircle size={18} className="text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-zinc-800">Billing is managed by the business owner</p>
              <p className="text-xs text-zinc-500 mt-1">
                You can see the available plans below, but only the business owner can subscribe, renew, or change plans.
              </p>
            </div>
          </div>
        )}

        {isOwner && (
          <div className="flex flex-wrap items-center gap-2 mb-6">
            <span className="text-xs font-black uppercase tracking-widest text-zinc-500">Pay in:</span>
            {['NGN', 'USD'].map(c => (
              <button
                key={c}
                onClick={() => setCurrency(c)}
                className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition ${
                  currency === c ? 'bg-zinc-900 text-white' : 'bg-white text-zinc-500 border border-zinc-200 hover:border-zinc-300'
                }`}
              >
                {c === 'NGN' ? '₦ Naira' : '$ Dollars'}
              </button>
            ))}

            <span className="text-xs font-black uppercase tracking-widest text-zinc-500 ml-2">Billed:</span>
            {['monthly', 'annually'].map(i => (
              <button
                key={i}
                onClick={() => setIntervalVal(i)}
                className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition flex items-center gap-1.5 ${
                  interval === i ? 'bg-zinc-900 text-white' : 'bg-white text-zinc-500 border border-zinc-200 hover:border-zinc-300'
                }`}
              >
                {i === 'annually' ? 'Yearly' : 'Monthly'}
                {i === 'annually' && promo?.active && (
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-black ${
                    interval === i ? 'bg-amber-500 text-black' : 'bg-amber-100 text-amber-700'
                  }`}>
                    -{promo.discountPercent.annually}%
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        {actionError && (
          <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl mb-6">
            <AlertCircle size={14} className="text-red-500 flex-shrink-0" />
            <p className="text-red-600 text-xs">{actionError}</p>
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-20 text-zinc-400">
            <Loader2 size={24} className="animate-spin" />
          </div>
        )}

        {!loading && loadError && (
          <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl">
            <AlertCircle size={14} className="text-red-500 flex-shrink-0" />
            <p className="text-red-600 text-sm">{loadError}</p>
          </div>
        )}

        {!loading && !loadError && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {plans.map(plan => {
              // Zero has no billing interval at all — comparing
              // interval for it would make it look "not current" the
              // moment someone toggles to Yearly, even though a
              // free plan has nothing to switch. Paid tiers DO need
              // the interval compared, or the Yearly card for a
              // monthly subscriber's exact same tier would show as
              // "Current Plan" too and block the very switch this
              // toggle exists to offer.
              const isFree     = plan.id === 'zero';
              const isCurrent  = subscription?.planId === plan.id
                && (isFree || subscription?.billingInterval === interval);
              const price      = interval === 'annually'
                ? (currency === 'USD' ? plan.priceUSDAnnual : plan.priceNGNDisplayAnnual)
                : (currency === 'USD' ? plan.priceUSD        : plan.priceNGNDisplay);
              const originalPrice = interval === 'annually'
                ? (currency === 'USD' ? plan.priceUSDAnnualOriginal : plan.priceNGNDisplayAnnualOriginal)
                : (currency === 'USD' ? plan.priceUSDOriginal        : plan.priceNGNDisplayOriginal);
              const priceSuffix = interval === 'annually' ? '/yr' : '/mo';
              const priceLabel = isFree
                ? 'Free'
                : `${currency === 'USD' ? '$' : '₦'}${price.toLocaleString()}${priceSuffix}`;
              const originalPriceLabel = isFree
                ? null
                : `${currency === 'USD' ? '$' : '₦'}${originalPrice.toLocaleString()}${priceSuffix}`;
              // promo.active also gates this — a plan whose original
              // and current price happen to be equal (promo off, or a
              // rounding coincidence) shouldn't show a pointless
              // strikethrough of an identical number.
              const showDiscount = !isFree && promo?.active && originalPrice > price;
              const payable    = isFree || (
                interval === 'annually'
                  ? (currency === 'USD' ? plan.payable.annually.usd : plan.payable.annually.ngn)
                  : (currency === 'USD' ? plan.payable.monthly.usd  : plan.payable.monthly.ngn)
              );
              // Same tier they're already on, just a different billing
              // interval — a genuine "switch" (cancels the old Paystack
              // subscription server-side once this new one is confirmed,
              // see controllers/payments.controller.js), not a fresh
              // subscribe. Worth labeling distinctly so it's clear
              // clicking this won't double-charge them.
              const isIntervalSwitch = !isFree
                && subscription?.planId === plan.id
                && subscription?.billingInterval
                && subscription.billingInterval !== interval;
              const isFeatured = plan.id === 'plus3';

              return (
                <div
                  key={plan.id}
                  className={`relative bg-white rounded-2xl border p-5 flex flex-col ${
                    isFeatured ? 'border-amber-400 shadow-lg' : 'border-zinc-200'
                  }`}
                >
                  {isFeatured && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-amber-500 text-black text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-full">
                      <Crown size={10} /> Everything
                    </div>
                  )}

                  <p className="text-sm font-black uppercase tracking-tight text-zinc-900">{plan.name}</p>
                  <p className="text-[11px] text-zinc-400 mt-0.5 mb-4 h-8">{plan.tagline}</p>

                  {showDiscount ? (
                    <div className="mb-4">
                      <div className="flex items-baseline gap-2">
                        <p className="text-2xl font-black text-zinc-900">{priceLabel}</p>
                        <span className="bg-red-500 text-white text-[9px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded">
                          -{interval === 'annually' ? promo.discountPercent.annually : promo.discountPercent.monthly}%
                        </span>
                      </div>
                      <p className="text-xs text-zinc-400 line-through">{originalPriceLabel}</p>
                    </div>
                  ) : (
                    <p className="text-2xl font-black text-zinc-900 mb-4">{priceLabel}</p>
                  )}

                  <ul className="space-y-2 text-xs text-zinc-600 flex-1 mb-5">
                    <li className="flex items-center gap-2">
                      <Users size={12} className="text-zinc-400 flex-shrink-0" />
                      {formatLimit(plan.limits.teamMembers, 'user' + (plan.limits.teamMembers === 1 ? '' : 's'))}
                    </li>
                    <li className="flex items-center gap-2">
                      <Package size={12} className="text-zinc-400 flex-shrink-0" />
                      {formatLimit(plan.limits.inventoryItems, 'items')}
                    </li>
                    <li className="flex items-center gap-2">
                      <MessageSquare size={12} className="text-zinc-400 flex-shrink-0" />
                      {formatLimit(plan.limits.advisorQuestionsPerDay, 'AI Qs/day')}
                    </li>
                    <li className="flex items-center gap-2">
                      <Globe size={12} className="text-zinc-400 flex-shrink-0" />
                      {plan.limits.languages.length} language{plan.limits.languages.length === 1 ? '' : 's'}
                    </li>
                    {plan.features.filter(f => f !== 'sales' && f !== 'daylog' && f !== 'inventory').map(f => (
                      <li key={f} className="flex items-center gap-2">
                        <Check size={12} className="text-green-500 flex-shrink-0" />
                        {FEATURE_LABELS[f] || f}
                      </li>
                    ))}
                  </ul>

                  {isOwner && (
                    <button
                      onClick={() => handleSubscribe(plan.id)}
                      disabled={isCurrent || isFree || !payable || submittingId === plan.id}
                      className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition disabled:opacity-50 disabled:cursor-not-allowed ${
                        isFeatured
                          ? 'bg-amber-500 hover:bg-amber-400 text-black'
                          : 'bg-zinc-900 hover:bg-zinc-800 text-white'
                      }`}
                    >
                      {submittingId === plan.id ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : isCurrent ? (
                        <Sparkles size={14} />
                      ) : null}
                      {isCurrent ? 'Current Plan' : isFree ? 'Free Plan' : !payable ? 'Coming Soon' : isIntervalSwitch ? `Switch to ${interval === 'annually' ? 'Yearly' : 'Monthly'}` : 'Subscribe'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
