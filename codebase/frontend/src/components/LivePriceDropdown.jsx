import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronRight, TrendingUp, TrendingDown, Minus, ArrowRight } from 'lucide-react';

// ── Market Data ───────────────────────────────────────────────────
// Shared by both the dropdown teaser and LivePricePage.
// Swap the mock setTimeout in LivePricePage for a real fetch() when ready.
export const MARKET_DATA = [
  {
    category: 'Food Staples',
    icon: '🌾',
    items: [
      { name: 'Local Rice (50kg)',     price: '₦54,500',  trend: 'up'   },
      { name: 'Beans (100kg Bag)',     price: '₦107,000', trend: 'down' },
      { name: 'Garri (Paint Bucket)',  price: '₦4,200',   trend: 'up'   },
      { name: 'Bread (Standard Loaf)', price: '₦1,650',   trend: 'up'   },
    ],
  },
  {
    category: 'Energy & Construction',
    icon: '⚡',
    items: [
      { name: 'Petrol (Lagos Avg)',    price: '₦1,390',  trend: 'up' },
      { name: 'Diesel (AGO)',          price: '₦1,260',  trend: 'up' },
      { name: 'Cooking Gas (12.5kg)', price: '₦14,600', trend: 'up' },
      { name: 'Cement (Dangote Bag)', price: '₦11,600', trend: 'up' },
    ],
  },
  {
    category: 'Currency & FX',
    icon: '💱',
    items: [
      { name: 'USD / Naira Parallel', price: '₦1,400', trend: 'up' },
      { name: 'GBP / Naira',         price: '₦1,790', trend: 'up' },
      { name: 'EUR / Naira',         price: '₦1,490', trend: 'up' },
    ],
  },
  {
    category: 'Crypto',
    icon: '₿',
    items: [
      { name: 'Bitcoin (BTC)',   price: '$71,500', trend: 'up'   },
      { name: 'USDT / Naira',   price: '₦1,395', trend: 'up'   },
      { name: 'Ethereum (ETH)', price: '$3,980',  trend: 'down' },
    ],
  },
];

// ── TrendIcon — shared utility ────────────────────────────────────
export function TrendIcon({ trend, size = 10 }) {
  if (trend === 'up')   return <TrendingUp   size={size} className="text-red-400"   />;
  if (trend === 'down') return <TrendingDown size={size} className="text-green-400" />;
  return                       <Minus        size={size} className="text-zinc-500"  />;
}

// ── MobilePriceSection — used inside the mobile navbar menu ───────
export function MobilePriceSection({ section }) {
  const [open, setOpen] = useState(false);
  const navigate        = useNavigate();

  return (
    <div className="border-b border-zinc-800 last:border-0">
      <button
        onClick={() => setOpen(p => !p)}
        className="flex items-center justify-between w-full px-4 py-3 hover:bg-zinc-800/50 transition text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm">{section.icon}</span>
          <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
            {section.category}
          </span>
        </div>
        {open
          ? <ChevronDown  size={11} className="text-zinc-600" />
          : <ChevronRight size={11} className="text-zinc-600" />
        }
      </button>

      {open && (
        <div className="pb-2">
          {/* One teaser item per category */}
          {section.items.slice(0, 1).map((item, i) => (
            <div key={i} className="flex items-center justify-between px-4 py-2">
              <span className="text-[11px] text-zinc-500">{item.name}</span>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-black font-mono text-zinc-200">{item.price}</span>
                <TrendIcon trend={item.trend} />
              </div>
            </div>
          ))}
          <button
            onClick={() => { navigate('/prices'); window.scrollTo(0, 0); }}
            className="flex items-center gap-1 px-4 py-1.5 text-[10px] text-amber-500 font-black uppercase tracking-widest hover:text-amber-400 transition"
          >
            See all prices <ArrowRight size={10} />
          </button>
        </div>
      )}
    </div>
  );
}

// ── LivePriceDropdown — desktop navbar ────────────────────────────
// Hover → shows one item per category as a teaser
// Click → navigates to the full /prices page
function LivePriceDropdown() {
  const navigate  = useNavigate();
  const [hover, setHover] = useState(false);
  const ref       = useRef(null);
  const hideTimer = useRef(null);

  function handleMouseEnter() {
    clearTimeout(hideTimer.current);
    setHover(true);
  }

  function handleMouseLeave() {
    // Small delay so moving mouse into the dropdown doesn't flicker
    hideTimer.current = setTimeout(() => setHover(false), 150);
  }

  useEffect(() => () => clearTimeout(hideTimer.current), []);

  function goToPage() { navigate('/prices'); window.scrollTo(0, 0); }

  return (
    <div
      ref={ref}
      className="relative"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Trigger button — click goes to full page */}
      <button
        onClick={goToPage}
        className="flex items-center gap-1.5 text-zinc-500 hover:text-amber-500 transition-colors font-black uppercase tracking-widest text-[11px] focus:outline-none"
      >
        Live Price
        <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
        <ChevronDown
          size={10}
          className={`transition-transform duration-200 ${hover ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Hover teaser — one item per category, no click needed */}
      {hover && (
        <div
          className="absolute right-0 mt-3 w-72 bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl z-50 overflow-hidden"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-900 bg-zinc-900/60">
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-amber-500">
                Market Snapshot
              </p>
              <p className="text-[8px] text-zinc-600 mt-0.5">
                {new Date().toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
            </div>
            <span className="text-[8px] bg-green-500/10 text-green-400 border border-green-500/20 px-2 py-1 rounded-full font-black uppercase tracking-widest flex items-center gap-1">
              <span className="w-1 h-1 bg-green-500 rounded-full animate-pulse inline-block" />
              Live
            </span>
          </div>

          {/* One item per category */}
          <div className="px-3 py-2 space-y-1">
            {MARKET_DATA.map((section, idx) => {
              const item = section.items[0];
              return (
                <div
                  key={idx}
                  className="flex items-center justify-between px-3 py-2.5 rounded-xl hover:bg-zinc-900/60 transition group"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base">{section.icon}</span>
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-widest text-zinc-600 group-hover:text-zinc-500 transition">
                        {section.category}
                      </p>
                      <p className="text-[11px] text-zinc-400">{item.name}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[12px] font-black font-mono text-white">{item.price}</span>
                    <TrendIcon trend={item.trend} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* CTA to full page */}
          <div className="px-4 pb-3 pt-1">
            <button
              onClick={goToPage}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-amber-500 text-black text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-amber-400 transition"
            >
              View Full Market Directory <ArrowRight size={11} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default LivePriceDropdown;
