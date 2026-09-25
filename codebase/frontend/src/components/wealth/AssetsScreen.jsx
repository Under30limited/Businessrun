import React, { useState, useEffect } from 'react';
import { Plus, Loader2, Trash2, Building2, X } from 'lucide-react';
import { EmptyState } from './AccountsScreen';
import { useAuth } from '../../context/AuthContext';
import { CURRENCIES, formatUnifiedAmount, getCurrencySymbol } from '../../utils/currency';

const ASSET_CATEGORIES = [
  'Electronics & Gadgets', 'Vehicles', 'Real Estate & Land',
  'Cash & Bank Vaults', 'FX & Domiciliary', 'Crypto & Equities',
];
const MARKET_TRACKED_CATEGORIES = ['Crypto & Equities'];
const LIQUIDITY_LEVELS = ['instant', 'short_term', 'long_term'];

const EMPTY_FORM = {
  name: '', category: ASSET_CATEGORIES[0], estimatedValue: '', currency: 'NGN',
  liquidity: 'short_term', isMarketTracked: false, marketSymbol: '', marketAssetType: 'crypto', quantity: '1',
};

export default function AssetsScreen() {
  const { user } = useAuth();
  const displayCurrency = user?.displayCurrency || 'NGN';

  const [assets, setAssets]     = useState([]);
  const [loading, setLoading]   = useState(true);
  const [showAdd, setShowAdd]   = useState(false);
  const [form, setForm]         = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]       = useState('');

  useEffect(() => { load(); }, []);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch('/api/personal/assets', { credentials: 'include' });
      const data = await res.json();
      if (data.success) setAssets(data.assets);
    } finally {
      setLoading(false);
    }
  }

  const isMarketCategory = MARKET_TRACKED_CATEGORIES.includes(form.category);

  async function handleAdd(e) {
    e.preventDefault();
    setError('');
    if (!form.name.trim()) { setError('Name is required.'); return; }
    if (form.isMarketTracked && !form.marketSymbol.trim()) { setError('Enter a symbol for a market-tracked asset.'); return; }
    if (!form.isMarketTracked && !form.estimatedValue) { setError('Enter an estimated value.'); return; }

    setSubmitting(true);
    try {
      const res = await fetch('/api/personal/assets', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          estimatedValue: form.estimatedValue ? Number(form.estimatedValue) : undefined,
          quantity: Number(form.quantity) || 1,
          isMarketTracked: isMarketCategory && form.isMarketTracked,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) { setError(data.message || 'Could not add asset.'); return; }
      setForm(EMPTY_FORM);
      setShowAdd(false);
      load();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this asset?')) return;
    await fetch(`/api/personal/assets/${id}`, { method: 'DELETE', credentials: 'include' });
    load();
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Assets & Portfolio</p>
          <h2 className="text-2xl font-black text-zinc-900">What You Own</h2>
        </div>
        <button onClick={() => setShowAdd(v => !v)}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-amber-500 text-black rounded-xl text-xs font-black uppercase tracking-widest hover:bg-amber-400 transition">
          {showAdd ? <X size={14} /> : <Plus size={14} />} {showAdd ? 'Cancel' : 'Add Asset'}
        </button>
      </div>

      {showAdd && (
        <form onSubmit={handleAdd} className="bg-white border border-zinc-200 rounded-2xl p-5 mb-6 space-y-3">
          {error && <p className="text-xs text-red-600">{error}</p>}
          <input placeholder="Name (e.g. Toyota Camry 2019)" value={form.name}
            onChange={e => setForm({ ...form, name: e.target.value })}
            className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-500" />
          <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value, isMarketTracked: false })}
            className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-500">
            {ASSET_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>

          {isMarketCategory && (
            <label className="flex items-center gap-2 text-sm text-zinc-600">
              <input type="checkbox" checked={form.isMarketTracked}
                onChange={e => setForm({ ...form, isMarketTracked: e.target.checked })} />
              Track this with a live market price (crypto or stock) instead of entering a value manually
            </label>
          )}

          {isMarketCategory && form.isMarketTracked ? (
            <div className="grid grid-cols-2 gap-3">
              <select value={form.marketAssetType} onChange={e => setForm({ ...form, marketAssetType: e.target.value })}
                className="bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-500">
                <option value="crypto">Crypto</option>
                <option value="stock">Stock</option>
              </select>
              <input placeholder={form.marketAssetType === 'crypto' ? 'CoinGecko id (e.g. bitcoin)' : 'Ticker (e.g. AAPL)'}
                value={form.marketSymbol} onChange={e => setForm({ ...form, marketSymbol: e.target.value })}
                className="bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-500" />
              <input type="number" placeholder="Quantity held" value={form.quantity}
                onChange={e => setForm({ ...form, quantity: e.target.value })}
                className="col-span-2 bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-500" />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <input type="number" placeholder="Estimated value" value={form.estimatedValue}
                onChange={e => setForm({ ...form, estimatedValue: e.target.value })}
                className="bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-500" />
              <select value={form.currency} onChange={e => setForm({ ...form, currency: e.target.value })}
                className="bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-500">
                {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          )}

          <select value={form.liquidity} onChange={e => setForm({ ...form, liquidity: e.target.value })}
            className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-500">
            {LIQUIDITY_LEVELS.map(l => <option key={l} value={l}>{l.replace('_', ' ')}</option>)}
          </select>

          <button type="submit" disabled={submitting}
            className="w-full py-2.5 bg-zinc-900 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-zinc-800 transition disabled:opacity-50">
            {submitting ? <Loader2 size={14} className="inline animate-spin" /> : 'Save Asset'}
          </button>
        </form>
      )}

      {loading ? (
        <p className="text-sm text-zinc-400 flex items-center gap-2"><Loader2 size={14} className="animate-spin" /> Loading...</p>
      ) : assets.length === 0 ? (
        <EmptyState icon={Building2} text="No assets yet. Add a vehicle, property, gadget, or a crypto/stock holding." />
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {assets.map(a => (
            <div key={a.assetId} className="bg-white border border-zinc-200 rounded-2xl p-4 flex items-start justify-between">
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-zinc-400">{a.category}</p>
                <p className="font-bold text-zinc-900">{a.name}</p>
                {a.isMarketTracked ? (
                  a.priceUnavailable
                    ? <p className="text-sm text-amber-600 mt-1">Price unavailable right now</p>
                    : <p className="text-lg font-black text-zinc-900 mt-1">
                        {formatUnifiedAmount(Math.round(a.estimatedValue || 0), a.currency, displayCurrency)}
                        {a.priceStale && <span className="text-xs text-amber-600 ml-1">(last known)</span>}
                      </p>
                ) : (
                  <p className="text-lg font-black text-zinc-900 mt-1">
                    {formatUnifiedAmount(a.estimatedValue || 0, a.currency, displayCurrency)}
                  </p>
                )}
                {!a.priceUnavailable && a.currency !== displayCurrency && (
                  <p className="text-[10px] font-bold text-zinc-400 mt-0.5">
                    {getCurrencySymbol(a.currency)}{Math.round(a.estimatedValue || 0).toLocaleString()} {a.currency} in native currency
                  </p>
                )}
              </div>
              <button onClick={() => handleDelete(a.assetId)} className="text-zinc-300 hover:text-red-500 transition">
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
