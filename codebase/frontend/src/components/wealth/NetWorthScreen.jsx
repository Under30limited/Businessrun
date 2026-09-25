import React, { useState, useEffect } from 'react';
import { Loader2, TrendingUp, TrendingDown } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { formatCurrency } from '../../utils/currency';

const ASSET_CATEGORIES = [
  'Electronics & Gadgets', 'Vehicles', 'Real Estate & Land',
  'Cash & Bank Vaults', 'FX & Domiciliary', 'Crypto & Equities',
];

/**
 * Sparkline
 * A dependency-free inline-SVG line chart — deliberately not using a
 * charting library, since this project's actual npm dependencies
 * weren't available to confirm one is installed. Renders real
 * snapshot data only; returns nothing (not a fake flat line) if there
 * isn't enough history yet.
 */
function Sparkline({ points }) {
  if (!points || points.length < 2) return null;

  const width = 100, height = 32;
  const values = points.map(p => p.netWorth);
  const min = Math.min(...values), max = Math.max(...values);
  const range = max - min || 1;

  const coords = points.map((p, i) => {
    const x = (i / (points.length - 1)) * width;
    const y = height - ((p.netWorth - min) / range) * height;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-10" preserveAspectRatio="none">
      <polyline points={coords} fill="none" stroke="#f59e0b" strokeWidth="2" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export default function NetWorthScreen() {
  const { user } = useAuth();
  const displayCurrency = user?.displayCurrency || 'NGN';

  const [totals, setTotals]     = useState(null);
  const [history, setHistory]   = useState(null);
  const [cashflow, setCashflow] = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        // Net worth + cash flow are server-aggregated (see
        // personalNetWorth.controller.js) so switching currency
        // re-fetches rather than re-converting client-side; history
        // stays a plain NGN fetch — snapshots are always stored in
        // NGN as the canonical trend currency regardless of display
        // currency (see that controller's header comment), and the
        // Sparkline below only uses relative shape, not absolute
        // values, so it needs no conversion either way.
        const [nwRes, histRes, cfRes] = await Promise.all([
          fetch(`/api/personal/networth?currency=${encodeURIComponent(displayCurrency)}`, { credentials: 'include' }),
          fetch('/api/personal/networth/history', { credentials: 'include' }),
          fetch(`/api/personal/networth/cashflow?currency=${encodeURIComponent(displayCurrency)}`, { credentials: 'include' }),
        ]);
        const nwData = await nwRes.json();
        const histData = await histRes.json();
        const cfData = await cfRes.json();
        if (!cancelled) {
          if (nwData.success) setTotals(nwData);
          if (histData.success) setHistory(histData);
          if (cfData.success) setCashflow(cfData);
          if (!nwData.success) setError('Could not load your net worth right now.');
        }
      } catch {
        if (!cancelled) setError('Network error loading your numbers.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [displayCurrency]);

  const fmt = (n) => formatCurrency(n, totals?.currency || displayCurrency);

  if (loading) {
    return <p className="text-sm text-zinc-400 flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Loading...</p>;
  }
  if (error) {
    return <p className="text-sm text-red-600">{error}</p>;
  }

  return (
    <div className="space-y-8">
      {/* Net Worth + Trend */}
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-1">Net Worth & Cash Flow</p>
        <div className="flex items-end justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-3xl sm:text-4xl font-black text-zinc-900">{fmt(totals.netWorth)}</h2>
            {history?.hasEnoughHistory && history.momChangePercent !== null && (
              <p className={`flex items-center gap-1 text-sm font-bold mt-1 ${history.momChangePercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {history.momChangePercent >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                {history.momChangePercent >= 0 ? '+' : ''}{history.momChangePercent}% over this period
              </p>
            )}
            {!history?.hasEnoughHistory && (
              <p className="text-xs text-zinc-400 mt-1">Trend will appear once there's more than one day of history.</p>
            )}
          </div>
          {history?.snapshots?.length > 1 && (
            <div className="w-40">
              <Sparkline points={history.snapshots} />
            </div>
          )}
        </div>

        {totals.unpricedAssetCount > 0 && (
          <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-4 inline-block">
            {totals.unpricedAssetCount} market-tracked asset{totals.unpricedAssetCount === 1 ? '' : 's'} not counted — price unavailable right now.
          </p>
        )}
      </div>

      {/* Breakdown */}
      <div className="grid sm:grid-cols-3 gap-4">
        <BreakdownCard label="Liquid Cash" value={fmt(totals.liquidCash)} />
        <BreakdownCard label="Owed To You" value={fmt(totals.owedToMe)} />
        <BreakdownCard label="You Owe" value={fmt(totals.owedByMe)} negative />
      </div>

      <div>
        <p className="text-xs font-black uppercase tracking-widest text-zinc-500 mb-3">Assets By Category</p>
        <div className="grid sm:grid-cols-2 gap-3">
          {ASSET_CATEGORIES.map(cat => (
            <div key={cat} className="bg-white border border-zinc-200 rounded-xl px-4 py-3 flex items-center justify-between">
              <span className="text-sm text-zinc-600">{cat}</span>
              <span className="text-sm font-black text-zinc-900">{fmt(totals.assetsByCategory?.[cat])}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Cash Flow */}
      {cashflow && (
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-zinc-500 mb-3">This Month's Cash Flow ({cashflow.month})</p>
          <div className="grid sm:grid-cols-2 gap-4 mb-4">
            <BreakdownCard label="Income" value={fmt(cashflow.totalIncome)} />
            <BreakdownCard label="Expenses" value={fmt(cashflow.totalExpenses)} negative />
          </div>

          {cashflow.savingsRatePercent !== null ? (
            <p className="text-sm text-zinc-600 mb-4">
              Savings rate this month: <span className={`font-black ${cashflow.savingsRatePercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {cashflow.savingsRatePercent}%
              </span>
            </p>
          ) : (
            <p className="text-xs text-zinc-400 mb-4">Log some income this month to see a savings rate.</p>
          )}

          <div className="grid sm:grid-cols-2 gap-4">
            <BreakdownCard label="Essential Spend" value={fmt(cashflow.essentialSpend)} />
            <BreakdownCard label="Discretionary Spend" value={fmt(cashflow.discretionarySpend)} />
          </div>

          {cashflow.activeEnvelopeCount > 0 && (
            <p className="text-sm text-zinc-600 mt-4">
              Envelope spending pool: <span className="font-black text-zinc-900">{fmt(cashflow.spendingPoolRemaining)}</span> remaining
              of {fmt(cashflow.spendingPoolAllocated)} across {cashflow.activeEnvelopeCount} envelope{cashflow.activeEnvelopeCount === 1 ? '' : 's'}.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function BreakdownCard({ label, value, negative }) {
  return (
    <div className="bg-white border border-zinc-200 rounded-2xl p-4">
      <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-1">{label}</p>
      <p className={`text-lg font-black ${negative ? 'text-red-600' : 'text-zinc-900'}`}>{value}</p>
    </div>
  );
}
