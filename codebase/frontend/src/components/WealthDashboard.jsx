/**
 * components/WealthDashboard.jsx
 *
 * Personal Wealth OS dashboard shell — layout deliberately mirrors
 * RoadmapPage.jsx's business dashboard exactly (fixed collapsible
 * left sidebar, mobile hamburger drawer, sticky top header with view
 * title + user pill, "Exit to Home" logout at the bottom) so someone
 * moving between a business and a personal space feels like they're
 * using the same product. No Team or Billing entries — Personal
 * Wealth OS is single-user and free for now (see the build
 * discussion).
 *
 * Tabs: Overview, Income, Expenses, Assets, Accounts, Debts & Loans,
 * Goals, Day Log, Net Worth, AI Advisor.
 *
 * All ten tabs are fully built and wired to their real backend
 * endpoints — this module is complete.
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import AccountsScreen from './wealth/AccountsScreen';
import IncomeScreen   from './wealth/IncomeScreen';
import ExpensesScreen from './wealth/ExpensesScreen';
import AssetsScreen   from './wealth/AssetsScreen';
import GoalsScreen    from './wealth/GoalsScreen';
import DebtsScreen    from './wealth/DebtsScreen';
import DayLogScreen   from './wealth/DayLogScreen';
import NetWorthScreen from './wealth/NetWorthScreen';
import AdvisorScreen  from './wealth/AdvisorScreen';
import {
  Zap, Wallet, TrendingUp, ShoppingBag, Building2, Landmark,
  HandCoins, Target, NotebookPen, Sparkles, LogOut, Loader2,
  ChevronLeft, Menu, Eye, EyeOff,
} from 'lucide-react';
import { CURRENCIES, CURRENCY_SYMBOLS, formatCurrency } from '../utils/currency';
import ContactTrigger from './ContactTrigger';

const TABS = [
  { id: 'overview',  label: 'Overview',      icon: <Wallet size={16} /> },
  { id: 'income',    label: 'Income',        icon: <TrendingUp size={16} /> },
  { id: 'expenses',  label: 'Expenses',      icon: <ShoppingBag size={16} /> },
  { id: 'assets',    label: 'Assets',        icon: <Building2 size={16} /> },
  { id: 'accounts',  label: 'Accounts',      icon: <Landmark size={16} /> },
  { id: 'debts',     label: 'Debts & Loans', icon: <HandCoins size={16} /> },
  { id: 'goals',     label: 'Goals',         icon: <Target size={16} /> },
  { id: 'daylog',    label: 'Day Log',       icon: <NotebookPen size={16} /> },
  { id: 'networth',  label: 'Net Worth',     icon: <TrendingUp size={16} /> },
  { id: 'advisor',   label: 'AI Advisor',    icon: <Sparkles size={16} /> },
];

export default function WealthDashboard() {
  const navigate = useNavigate();
  const { user, spaceType, isAuthenticated, isRestoring, logout, setDisplayCurrency } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');

  // Same collapsible-sidebar + mobile-drawer state as RoadmapPage.jsx,
  // with its own localStorage key so the two dashboards' collapsed
  // states don't fight each other for the same person.
  const [sidebarOpen, setSidebarOpen] = useState(
    () => localStorage.getItem('br_wealth_sidebar_open') !== 'false'
  );
  const [menuOpen, setMenuOpen] = useState(false);

  function toggleSidebar() {
    setSidebarOpen(o => {
      const next = !o;
      localStorage.setItem('br_wealth_sidebar_open', String(next));
      return next;
    });
  }

  function openTab(id) {
    setActiveTab(id);
    setMenuOpen(false);
  }

  async function handleLogout() {
    setMenuOpen(false);
    await logout(navigate);
  }

  // ── Auth guard ───────────────────────────────────────────────────
  // Same pattern as RoadmapPage.jsx — but ALSO redirects a business
  // session away from here (this dashboard is personal-only), since
  // a business token landing on /wealth would have no personalUid to
  // operate on at all.
  useEffect(() => {
    if (isRestoring) return;
    if (!isAuthenticated || spaceType !== 'personal') {
      navigate('/', { replace: true });
    }
  }, [isRestoring, isAuthenticated, spaceType, navigate]);

  if (isRestoring) {
    return (
      <div className="min-h-screen bg-orange-50 flex flex-col items-center justify-center px-6 text-center">
        <div className="w-16 h-16 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-center mb-8 animate-pulse">
          <Zap size={28} className="text-amber-500" />
        </div>
        <p className="text-zinc-500 text-xs font-black uppercase tracking-widest mb-3">Personal Wealth OS</p>
        <p className="text-zinc-900 text-lg font-black mb-6">Restoring your session...</p>
      </div>
    );
  }

  if (!isAuthenticated || spaceType !== 'personal') return null;

  const displayName = user?.nickname || user?.fullName || 'You';

  return (
    <div className="min-h-screen bg-orange-50">
      {/* ── LEFT SIDEBAR ─────────────────────────────────────── */}
      {/* Desktop: always rendered, width transitions open↔collapsed */}
      {/* Mobile: fixed slide-over drawer, toggled by hamburger      */}
      <aside className={`
        fixed top-0 left-0 h-full z-50 flex flex-col bg-white border-r border-zinc-200 shadow-lg
        transition-all duration-300 ease-in-out
        ${sidebarOpen ? 'w-60' : 'w-[72px]'}
        ${menuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>

        {/* Sidebar header — logo + collapse toggle */}
        <div className={`flex items-center border-b border-zinc-100 flex-shrink-0 ${sidebarOpen ? 'px-5 py-5 justify-between' : 'px-4 py-5 justify-center'}`}>
          {sidebarOpen && (
            <div>
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 bg-amber-500 rounded-lg flex items-center justify-center font-black text-black text-xs">B</div>
                <span className="text-sm font-black uppercase tracking-tighter italic text-zinc-900">BusinessRun</span>
              </div>
              <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mt-0.5 ml-9">
                Wealth OS
              </p>
            </div>
          )}
          {!sidebarOpen && (
            <div className="w-7 h-7 bg-amber-500 rounded-lg flex items-center justify-center font-black text-black text-xs">B</div>
          )}
          <button
            onClick={toggleSidebar}
            className="hidden lg:flex w-7 h-7 items-center justify-center rounded-lg hover:bg-zinc-100 transition text-zinc-400 hover:text-zinc-700 flex-shrink-0"
            title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
          >
            <ChevronLeft size={15} className={`transition-transform duration-300 ${sidebarOpen ? '' : 'rotate-180'}`} />
          </button>
        </div>

        {/* Nav items */}
        <nav className="flex-1 overflow-y-auto py-4 space-y-1 px-3">
          {TABS.map(tab => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => openTab(tab.id)}
                title={!sidebarOpen ? tab.label : undefined}
                className={`w-full flex items-center rounded-xl transition-all text-left
                  ${sidebarOpen ? 'gap-3 px-4 py-3' : 'justify-center px-0 py-3'}
                  ${isActive
                    ? 'bg-amber-500/10 text-amber-600 border border-amber-500/20'
                    : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900 border border-transparent'
                  }
                `}
              >
                <span className={`flex-shrink-0 ${isActive ? 'text-amber-500' : ''}`}>{tab.icon}</span>
                {sidebarOpen && (
                  <>
                    <span className="text-[11px] font-black uppercase tracking-widest flex-1">{tab.label}</span>
                    {isActive && <span className="w-1.5 h-1.5 bg-amber-500 rounded-full flex-shrink-0" />}
                  </>
                )}
              </button>
            );
          })}
        </nav>

        {/* Exit to Home at the bottom — same placement/styling as the business dashboard */}
        <div className="flex-shrink-0 border-t border-zinc-100 p-3">
          <button
            onClick={handleLogout}
            title={!sidebarOpen ? 'Exit' : undefined}
            className={`w-full flex items-center rounded-xl text-zinc-500 hover:text-red-500 hover:bg-red-50 transition border border-transparent
              ${sidebarOpen ? 'gap-3 px-4 py-3' : 'justify-center px-0 py-3'}
            `}
          >
            <LogOut size={16} className="flex-shrink-0" />
            {sidebarOpen && <span className="text-[11px] font-black uppercase tracking-widest">Exit to Home</span>}
          </button>
        </div>
      </aside>

      {/* Mobile drawer backdrop */}
      {menuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setMenuOpen(false)}
        />
      )}

      {/* ── MAIN CONTENT AREA — shifts right to account for sidebar ─ */}
      <div className={`flex flex-col min-h-screen transition-all duration-300 ease-in-out
        ${sidebarOpen ? 'lg:ml-60' : 'lg:ml-[72px]'}
      `}>

        {/* Top bar — mobile hamburger + current view title + user pill */}
        <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-zinc-200 shadow-sm flex items-center justify-between px-5 py-4 lg:px-8">
          <button
            onClick={() => setMenuOpen(o => !o)}
            className="lg:hidden w-9 h-9 flex items-center justify-center bg-zinc-100 hover:bg-zinc-200 border border-zinc-200 rounded-xl transition"
            aria-label="Open menu"
          >
            <Menu size={16} className="text-zinc-600" />
          </button>

          <div className="flex items-center gap-2">
            <span className="text-xs font-black uppercase tracking-widest text-zinc-900">
              {TABS.find(t => t.id === activeTab)?.label}
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Currency switcher — "at will" display currency change.
                Converts every total already on screen instantly via
                utils/currency.js; never rewrites what currency any
                individual record was actually entered in (see
                AuthContext.jsx's setDisplayCurrency and
                personalProfile.controller.js's header comment). */}
            <select
              value={user?.displayCurrency || 'NGN'}
              onChange={e => setDisplayCurrency(e.target.value)}
              title="Change display currency"
              aria-label="Change display currency"
              className="text-[11px] font-black uppercase tracking-widest bg-zinc-50 border border-zinc-200 rounded-lg pl-2 pr-1 py-1.5 text-zinc-700 hover:border-zinc-300 focus:outline-none focus:border-amber-500 cursor-pointer transition"
            >
              {CURRENCIES.map(code => (
                <option key={code} value={code}>{CURRENCY_SYMBOLS[code]} {code}</option>
              ))}
            </select>

            <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-50 border border-zinc-200 rounded-xl">
              <div className="w-6 h-6 bg-amber-500 rounded-full flex items-center justify-center text-black font-black text-[10px]">
                {displayName[0].toUpperCase()}
              </div>
              {sidebarOpen && (
                <div className="hidden lg:block">
                  <p className="text-[10px] font-black text-zinc-900 leading-none">{displayName}</p>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Active tab content */}
        <div className="flex-1 p-5 sm:p-8 overflow-y-auto">
          {activeTab === 'overview'  && <OverviewTab />}
          {activeTab === 'income'    && <IncomeScreen />}
          {activeTab === 'expenses'  && <ExpensesScreen />}
          {activeTab === 'assets'    && <AssetsScreen />}
          {activeTab === 'accounts'  && <AccountsScreen />}
          {activeTab === 'debts'     && <DebtsScreen />}
          {activeTab === 'goals'     && <GoalsScreen />}
          {activeTab === 'daylog'    && <DayLogScreen />}
          {activeTab === 'networth'  && <NetWorthScreen />}
          {activeTab === 'advisor'   && <AdvisorScreen />}
        </div>
      </div>

      <ContactTrigger source="personal" />
    </div>
  );
}

// ── Overview — real, wired to GET /api/personal/networth ────────────
function OverviewTab() {
  const { user } = useAuth();
  const displayCurrency = user?.displayCurrency || 'NGN';

  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');

  // ── Privacy toggle ──────────────────────────────────────────────
  // "Peek-proof" mode for glancing at this screen somewhere public
  // (open-plan office, on a bus, etc.) — masks every currency figure
  // on this tab with stars instead of hiding the whole screen.
  // Persisted under its own localStorage key (separate from the
  // sidebar-collapse and insight-language keys already used
  // elsewhere in this app) so the choice survives a refresh/tab
  // close. Defaults to visible — a dashboard that opens fully
  // starred-out with no explanation reads as broken, not private, so
  // the person has to choose to hide it at least once.
  const [showAmounts, setShowAmounts] = useState(() => {
    try {
      const stored = localStorage.getItem('br_wealth_amounts_visible');
      return stored === null ? true : stored === 'true';
    } catch {
      return true; // localStorage unavailable (e.g. private browsing) — fail open to visible, not broken
    }
  });

  function toggleShowAmounts() {
    setShowAmounts(prev => {
      const next = !prev;
      try { localStorage.setItem('br_wealth_amounts_visible', String(next)); } catch { /* best-effort persistence only */ }
      return next;
    });
  }

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        // Always asks for the space's CURRENT display currency — when
        // the header switcher changes it, this effect re-runs (see
        // the dependency array below) and fetches fresh server-
        // converted totals rather than re-converting stale ones
        // client-side, since Net Worth is a server-aggregated figure
        // (see personalNetWorth.controller.js).
        const res  = await fetch(`/api/personal/networth?currency=${encodeURIComponent(displayCurrency)}`, { credentials: 'include' });
        const json = await res.json();
        if (!cancelled) {
          if (json.success) setData(json);
          else setError('Could not load your net worth right now.');
        }
      } catch {
        if (!cancelled) setError('Network error loading your net worth.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [displayCurrency]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-zinc-400 text-sm">
        <Loader2 size={16} className="animate-spin" /> Loading your numbers...
      </div>
    );
  }

  if (error) {
    return <p className="text-sm text-red-600">{error}</p>;
  }

  // Fixed-width mask (not a length-matched one) — a length-matched
  // mask (e.g. stars per digit) would itself leak the rough
  // magnitude of the figure to anyone glancing over a shoulder,
  // which defeats the point of masking it at all.
  const fmt = (n) => showAmounts ? formatCurrency(n, data.currency || displayCurrency) : '••••••';

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Net Worth</p>
        <button
          type="button"
          onClick={toggleShowAmounts}
          title={showAmounts ? 'Hide amounts' : 'Show amounts'}
          aria-label={showAmounts ? 'Hide amounts' : 'Show amounts'}
          className="text-zinc-400 hover:text-zinc-700 transition p-1.5 -m-1.5 rounded-lg hover:bg-zinc-100"
        >
          {showAmounts ? <Eye size={16} /> : <EyeOff size={16} />}
        </button>
      </div>
      <h2 className="text-3xl sm:text-4xl font-black text-zinc-900 mb-8">{fmt(data.netWorth)}</h2>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <MetricCard label="Liquid Cash"   value={fmt(data.liquidCash)} />
        <MetricCard label="Asset Value"   value={fmt(data.totalAssetsValue)} />
        <MetricCard label="Owed To You"   value={fmt(data.owedToMe)} />
        <MetricCard label="You Owe"       value={fmt(data.owedByMe)} />
      </div>

      {data.unpricedAssetCount > 0 && (
        <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-6 inline-block">
          {data.unpricedAssetCount} market-tracked asset{data.unpricedAssetCount === 1 ? '' : 's'} not counted yet — price unavailable right now.
        </p>
      )}

      {data.emergencyRunwayMonths !== null && (
        <p className="text-sm text-zinc-500 mt-6">
          At your current essential spending, your liquid cash covers about{' '}
          <span className="font-black text-zinc-900">{data.emergencyRunwayMonths} month{data.emergencyRunwayMonths === 1 ? '' : 's'}</span>.
        </p>
      )}
    </div>
  );
}

function MetricCard({ label, value }) {
  return (
    <div className="bg-white border border-zinc-200 rounded-2xl p-4">
      <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400 mb-1">{label}</p>
      <p className="text-lg font-black text-zinc-900">{value}</p>
    </div>
  );
}
