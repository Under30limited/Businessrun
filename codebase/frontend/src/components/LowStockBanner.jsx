/**
 * LowStockBanner.jsx
 *
 * A dashboard-wide, more prominent low-stock alert — on top of (not
 * instead of) the existing inline per-item badge in
 * InventoryDashboard.jsx. Only shown on BusinessRun+3, the tier
 * specifically called out for this enhancement — +1/+2 still get the
 * inline badge when viewing the Inventory tab itself, just not this
 * banner.
 *
 * Fetches only a COUNT (GET /api/inventory/low-stock-count), never
 * the full item list — so having this mounted app-wide doesn't cost
 * a full inventory fetch on every page.
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { AlertTriangle, X } from 'lucide-react';

export default function LowStockBanner({ onViewInventory }) {
  const { user, subscription } = useAuth();
  const [count,     setCount]     = useState(0);
  const [dismissed, setDismissed] = useState(false);

  // A member also needs 'inventory' explicitly granted — same
  // boundary the tab itself uses. Without this check, the banner
  // would leak "you have N low-stock items" to a member who can't
  // even see the Inventory tab.
  const memberCanSeeInventory = user?.role !== 'member' || (user?.permissions || []).includes('inventory');
  const isPlus3 = subscription?.planId === 'plus3';

  useEffect(() => {
    if (!isPlus3 || !memberCanSeeInventory) return;

    let cancelled = false;
    (async () => {
      try {
        const res  = await fetch('/api/inventory/low-stock-count', { credentials: 'include' });
        const data = await res.json();
        if (!cancelled && data.success) setCount(data.count);
      } catch {
        // Silent — this is a nice-to-have banner, not critical path
      }
    })();
    return () => { cancelled = true; };
  }, [isPlus3, memberCanSeeInventory]);

  if (!isPlus3 || !memberCanSeeInventory || count === 0 || dismissed) return null;

  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 w-full max-w-md px-4">
      <div className="bg-red-50 border border-red-200 rounded-2xl shadow-xl p-4 flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-red-500/10 flex items-center justify-center flex-shrink-0">
          <AlertTriangle size={16} className="text-red-500" />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-black text-zinc-900">
            {count} item{count === 1 ? '' : 's'} running low on stock
          </p>
          <button
            onClick={onViewInventory}
            className="text-[11px] font-black uppercase tracking-widest text-red-600 hover:text-red-700 transition mt-0.5"
          >
            View Inventory →
          </button>
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
