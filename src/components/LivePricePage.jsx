import React, { useState, useEffect } from 'react';
import { ArrowLeft, RefreshCw, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { MARKET_DATA } from './LivePriceDropdown';

function TrendBadge({ trend }) {
  if (trend === 'up')   return <span className="flex items-center gap-1 text-red-400 text-[10px] font-black"><TrendingUp size={11} /> Rising</span>;
  if (trend === 'down') return <span className="flex items-center gap-1 text-green-400 text-[10px] font-black"><TrendingDown size={11} /> Falling</span>;
  return                       <span className="flex items-center gap-1 text-zinc-500 text-[10px] font-black"><Minus size={11} /> Stable</span>;
}

export default function LivePricePage({ onBack }) {
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [refreshing,  setRefreshing]  = useState(false);
  const [activeTab,   setActiveTab]   = useState('all');

  const tabs = [
    { label: 'All',          value: 'all'          },
    { label: '🌾 Food',      value: 'Food Staples'          },
    { label: '⚡ Energy',    value: 'Energy & Construction'  },
    { label: '💱 FX',        value: 'Currency & FX'          },
    { label: '₿ Crypto',     value: 'Crypto'                 },
  ];

  const visibleData = activeTab === 'all'
    ? MARKET_DATA
    : MARKET_DATA.filter(s => s.category === activeTab);

  async function handleRefresh() {
    setRefreshing(true);
    // ── Swap for real API call when ready ──
    await new Promise(r => setTimeout(r, 800));
    setLastUpdated(new Date());
    setRefreshing(false);
  }

  // Auto-refresh every 5 minutes
  useEffect(() => {
    const id = setInterval(handleRefresh, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="min-h-screen bg-black text-zinc-100">

      {/* ── Page Header ───────────────────────────────────────── */}
      <div className="border-b border-zinc-900 bg-zinc-950">
        <div className="max-w-5xl mx-auto px-6 py-8">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-zinc-500 hover:text-amber-500 transition mb-6 text-xs font-black uppercase tracking-widest group"
          >
            <ArrowLeft size={13} className="group-hover:-translate-x-1 transition-transform" />
            Back to Home
          </button>

          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span className="text-[10px] font-black uppercase tracking-widest text-green-500">Live</span>
              </div>
              <h1 className="text-4xl md:text-5xl font-black tracking-tighter italic uppercase mb-2">
                Market Prices
              </h1>
              <p className="text-zinc-500 text-sm">
                Nigeria market directory — commodity, energy, currency & crypto
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <div className="text-right">
                <p className="text-[9px] font-black uppercase tracking-widest text-zinc-600">Last Updated</p>
                <p className="text-[11px] text-zinc-400 font-mono">
                  {lastUpdated.toLocaleTimeString('en-NG', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="w-9 h-9 bg-zinc-900 border border-zinc-800 rounded-xl flex items-center justify-center text-zinc-500 hover:text-amber-500 hover:border-amber-500/30 transition disabled:opacity-40"
              >
                <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
              </button>
            </div>
          </div>

          {/* ── Tabs ────────────────────────────────────────────── */}
          <div className="flex gap-2 mt-8 overflow-x-auto pb-1 scrollbar-hide">
            {tabs.map(tab => (
              <button
                key={tab.value}
                onClick={() => setActiveTab(tab.value)}
                className={`px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition ${
                  activeTab === tab.value
                    ? 'bg-amber-500 text-black'
                    : 'bg-zinc-900 text-zinc-500 hover:text-amber-500 border border-zinc-800'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Price Grid ────────────────────────────────────────── */}
      <div className="max-w-5xl mx-auto px-6 py-10 space-y-10">
        {visibleData.map((section, idx) => (
          <div key={idx}>

            {/* Section heading */}
            <div className="flex items-center gap-3 mb-4">
              <span className="text-2xl">{section.icon}</span>
              <h2 className="text-xs font-black uppercase tracking-widest text-zinc-500">
                {section.category}
              </h2>
              <div className="flex-1 h-px bg-zinc-900" />
            </div>

            {/* Items grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {section.items.map((item, i) => (
                <div
                  key={i}
                  className={`bg-zinc-950 border rounded-2xl px-5 py-4 flex items-center justify-between transition hover:border-zinc-700 ${
                    i === 0 ? 'border-amber-500/20 bg-amber-500/5' : 'border-zinc-900'
                  }`}
                >
                  <div>
                    {i === 0 && (
                      <span className="text-[8px] font-black uppercase tracking-widest text-amber-500 mb-1 block">
                        Top Pick
                      </span>
                    )}
                    <p className="text-[12px] text-zinc-300 font-medium">{item.name}</p>
                    <TrendBadge trend={item.trend} />
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-black font-mono text-white">{item.price}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* ── Footer disclaimer ─────────────────────────────────── */}
      <div className="max-w-5xl mx-auto px-6 pb-16">
        <p className="text-[10px] text-zinc-700 text-center uppercase tracking-widest border-t border-zinc-900 pt-6">
          Prices are indicative market averages. Always verify before making financial or business decisions.
          BusinessRun is not a financial advisor.
        </p>
      </div>

    </div>
  );
}
