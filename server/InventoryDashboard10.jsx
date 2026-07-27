/**
 * InventoryDashboard.jsx
 *
 * Inventory management tab for the user dashboard.
 *
 * Features:
 *   - Items loaded silently on mount from /api/inventory
 *   - Add item modal with image upload (multipart/form-data)
 *   - Per-item ⋮ dropdown menu with three actions:
 *       • View        — read-only detail sheet (name, price, stock, category, image)
 *       • Edit        — edit name, category, price, quantity
 *       • Product History — timestamped sale log for that item (auto-populated from Sales Day Book)
 *   - Low stock warning at ≤ 5 units
 *   - Empty state with clear call to action
 *
 * Props:
 *   items        {Object[]}  — current items array (from parent state)
 *   setItems     {Function}  — parent state setter
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  Plus, Trash2, Loader2, AlertCircle,
  Package, ImageOff, X, MoreVertical,
  Eye, Edit3, Clock, Check,
  ShoppingBag, TrendingUp, ChevronRight, Search,
} from 'lucide-react';

const inputClass = 'w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-amber-500 transition-colors';
const BRAND     = '#C5A028';
const LOW_STOCK = 5;

const emptyForm = () => ({
  name:          '',
  category:      '',
  unit_price:    '',
  cost_price:    '',
  quantity:      '',
  serial_number: '',
  imageFile:     null,
  imagePreview:  null,
});

// ── Helpers ──────────────────────────────────────────────────────
function fmt(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-NG', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function PaymentBadge({ status }) {
  const isPaid = (status || 'Paid') === 'Paid';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest ${
      isPaid
        ? 'bg-green-500/10 text-green-600 border border-green-500/20'
        : 'bg-red-500/10 text-red-500 border border-red-500/20'
    }`}>
      {isPaid ? '✓ Paid' : '⚠ Credit'}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────
// VIEW MODAL — read-only item detail sheet
// ─────────────────────────────────────────────────────────────────
function ViewModal({ item, onClose, onEdit }) {
  const isLow = item.quantity <= LOW_STOCK;
  return (
    <div className="fixed inset-0 bg-zinc-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white border border-zinc-200 rounded-2xl w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-100">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: BRAND + '15' }}>
              <Eye size={15} style={{ color: BRAND }} />
            </div>
            <h2 className="text-base font-black uppercase tracking-tight">Item Details</h2>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700 transition"><X size={18} /></button>
        </div>

        {/* Image */}
        {item.image_url ? (
          <div className="w-full h-52 overflow-hidden bg-zinc-100">
            <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
          </div>
        ) : (
          <div className="w-full h-36 bg-zinc-50 flex flex-col items-center justify-center gap-2 border-b border-zinc-100">
            <ImageOff size={28} className="text-zinc-300" />
            <p className="text-zinc-400 text-[10px] font-black uppercase tracking-widest">No Image</p>
          </div>
        )}

        {/* Details */}
        <div className="px-6 py-6 space-y-5">
          {/* Name + Category */}
          <div>
            <h3 className="text-xl font-black tracking-tight text-zinc-900">{item.name}</h3>
            {item.category && (
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mt-1">{item.category}</p>
            )}
          </div>

          {/* Key stats */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-zinc-50 border border-zinc-100 rounded-xl px-4 py-4">
              <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-1">Selling Price</p>
              <p className="text-xl font-black text-zinc-900">₦{Number(item.unit_price).toLocaleString()}</p>
            </div>
            <div className={`rounded-xl px-4 py-4 border ${
              isLow ? 'bg-red-50 border-red-200' : 'bg-zinc-50 border-zinc-100'
            }`}>
              <p className={`text-[9px] font-black uppercase tracking-widest mb-1 ${isLow ? 'text-red-500' : 'text-zinc-500'}`}>
                Stock {isLow ? '· Low' : ''}
              </p>
              <p className={`text-xl font-black ${isLow ? 'text-red-500' : 'text-zinc-900'}`}>{item.quantity} units</p>
            </div>
          </div>

          {/* Cost price + profit margin — only shown when cost_price is set */}
          {item.cost_price > 0 && (
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-zinc-50 border border-zinc-100 rounded-xl px-4 py-4">
                <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-1">Cost Price</p>
                <p className="text-xl font-black text-zinc-900">₦{Number(item.cost_price).toLocaleString()}</p>
              </div>
              <div className="rounded-xl px-4 py-4 border bg-green-50 border-green-100">
                <p className="text-[9px] font-black uppercase tracking-widest text-green-600 mb-1">Profit / Unit</p>
                <p className="text-xl font-black text-green-600">
                  ₦{(item.unit_price - item.cost_price).toLocaleString()}
                  <span className="text-xs ml-1 font-bold">
                    ({item.unit_price > 0 ? Math.round(((item.unit_price - item.cost_price) / item.unit_price) * 100) : 0}%)
                  </span>
                </p>
              </div>
            </div>
          )}

          {/* Inventory value + date added */}
          <div className="flex items-center justify-between px-4 py-3 rounded-xl border"
            style={{ background: BRAND + '08', borderColor: BRAND + '30' }}>
            <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: BRAND }}>Total Inventory Value</p>
            <p className="text-lg font-black text-zinc-900">₦{(item.unit_price * item.quantity).toLocaleString()}</p>
          </div>
          {item.createdAtISO && (
            <div className="flex items-center justify-between px-4 py-2.5 bg-zinc-50 border border-zinc-100 rounded-xl">
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Date Added</p>
              <p className="text-xs font-black text-zinc-900">
                {new Date(item.createdAtISO).toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' })}
              </p>
            </div>
          )}
          {item.serial_number && (
            <div className="flex items-center justify-between px-4 py-2.5 bg-zinc-50 border border-zinc-100 rounded-xl">
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Serial Number</p>
              <p className="text-xs font-black text-zinc-900 font-mono">{item.serial_number}</p>
            </div>
          )}

          {/* Low stock warning */}
          {isLow && (
            <div className="flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl">
              <AlertCircle size={14} className="text-red-500 shrink-0" />
              <p className="text-xs text-red-600 font-bold">
                {item.quantity === 0 ? 'Out of stock — restock this item.' : `Only ${item.quantity} unit${item.quantity === 1 ? '' : 's'} left. Consider restocking.`}
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button onClick={onClose}
              className="flex-1 py-3 text-zinc-500 hover:text-zinc-800 font-black text-xs uppercase tracking-widest transition border border-zinc-200 rounded-xl hover:bg-zinc-50">
              Close
            </button>
            <button onClick={onEdit}
              className="flex-1 py-3 font-black text-xs uppercase tracking-widest rounded-xl text-white transition flex items-center justify-center gap-2"
              style={{ backgroundColor: BRAND }}>
              <Edit3 size={13} /> Edit Item
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// EDIT MODAL — edit name, category, price, quantity
// ─────────────────────────────────────────────────────────────────
function EditModal({ item, onClose, onSaved }) {
  const [form,    setForm]    = useState({
    name:          item.name          || '',
    category:      item.category      || '',
    unit_price:    String(item.unit_price  ?? ''),
    cost_price:    String(item.cost_price  ?? ''),
    quantity:      String(item.quantity    ?? ''),
    serial_number: item.serial_number  || '',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [error,    setError]    = useState('');

  async function handleSave() {
    if (!form.name.trim())                                               { setError('Name is required.'); return; }
    if (!form.unit_price || isNaN(+form.unit_price) || +form.unit_price < 0) { setError('Enter a valid selling price.'); return; }
    if (form.cost_price && (isNaN(+form.cost_price) || +form.cost_price < 0)) { setError('Enter a valid cost price.'); return; }
    if (!form.quantity   || isNaN(+form.quantity)   || +form.quantity   < 0) { setError('Enter a valid quantity.'); return; }

    setError('');
    setIsSaving(true);
    try {
      const updates = {
        name:          form.name.trim(),
        category:      form.category.trim(),
        unit_price:    parseFloat(form.unit_price),
        cost_price:    form.cost_price ? parseFloat(form.cost_price) : 0,
        quantity:      parseInt(form.quantity, 10),
        serial_number: form.serial_number.trim(),
      };
      const res = await fetch(`/api/inventory/${item.id}`, {
        method:      'PATCH',
        credentials: 'include',
        headers:     { 'Content-Type': 'application/json' },
        body:        JSON.stringify(updates),
      });
      if (!res.ok) { setError('Could not save changes. Please try again.'); return; }
      onSaved({ ...item, ...updates });
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-zinc-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white border border-zinc-200 rounded-2xl w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-100">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: BRAND + '15' }}>
              <Edit3 size={15} style={{ color: BRAND }} />
            </div>
            <div>
              <h2 className="text-base font-black uppercase tracking-tight">Edit Item</h2>
              <p className="text-[10px] text-zinc-500 mt-0.5">{item.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700 transition"><X size={18} /></button>
        </div>

        <div className="px-6 py-6 space-y-4">
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">Item Name *</label>
            <input type="text" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              className={inputClass} placeholder="e.g. Floral Dress" />
          </div>
          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">Category</label>
            <input type="text" value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
              className={inputClass} placeholder="e.g. Apparel, Electronics, Food" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">Selling Price (₦) *</label>
              <input type="number" min="0" value={form.unit_price} onChange={e => setForm(p => ({ ...p, unit_price: e.target.value }))}
                className={inputClass} placeholder="e.g. 25000" />
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">Cost Price (₦)</label>
              <input type="number" min="0" value={form.cost_price} onChange={e => setForm(p => ({ ...p, cost_price: e.target.value }))}
                className={inputClass} placeholder="e.g. 18000" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">Quantity *</label>
              <input type="number" min="0" value={form.quantity} onChange={e => setForm(p => ({ ...p, quantity: e.target.value }))}
                className={inputClass} placeholder="e.g. 50" />
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">
                Serial Number <span className="text-zinc-400 font-normal normal-case">optional</span>
              </label>
              <input type="text" value={form.serial_number} onChange={e => setForm(p => ({ ...p, serial_number: e.target.value }))}
                className={inputClass} placeholder="e.g. SN-2024-001" />
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl">
              <AlertCircle size={13} className="text-red-500 shrink-0" />
              <p className="text-red-600 text-xs">{error}</p>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button onClick={onClose}
              className="flex-1 py-3 text-zinc-500 hover:text-zinc-800 font-black text-xs uppercase tracking-widest transition border border-zinc-200 rounded-xl hover:bg-zinc-50">
              Cancel
            </button>
            <button onClick={handleSave} disabled={isSaving}
              className="flex-1 py-3 font-black text-xs uppercase tracking-widest rounded-xl text-white disabled:opacity-50 transition flex items-center justify-center gap-2"
              style={{ backgroundColor: BRAND }}>
              {isSaving ? <><Loader2 size={13} className="animate-spin" /> Saving...</> : <><Check size={13} /> Save Changes</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// PRODUCT HISTORY MODAL — sale log for this item
// ─────────────────────────────────────────────────────────────────
function HistoryModal({ item, onClose }) {
  const [history,   setHistory]   = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState('');

  useEffect(() => {
    async function load() {
      try {
        const res  = await fetch(`/api/inventory/${item.id}/history`, { credentials: 'include' });
        const data = await res.json();
        if (data.success) setHistory(data.history);
        else setError('Could not load history.');
      } catch {
        setError('Network error. Please try again.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [item.id]);

  const totalSold    = history.reduce((s, h) => s + (h.quantity  || 0), 0);
  const totalRevenue = history.reduce((s, h) => s + (h.lineTotal || 0), 0);

  return (
    <div className="fixed inset-0 bg-zinc-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white border border-zinc-200 rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: BRAND + '15' }}>
              <Clock size={15} style={{ color: BRAND }} />
            </div>
            <div>
              <h2 className="text-base font-black uppercase tracking-tight">Product History</h2>
              <p className="text-[10px] text-zinc-500 mt-0.5 truncate max-w-[200px]">{item.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700 transition"><X size={18} /></button>
        </div>

        {/* Summary bar — shown when history exists */}
        {!loading && !error && history.length > 0 && (
          <div className="grid grid-cols-3 gap-0 border-b border-zinc-100 shrink-0">
            <div className="px-5 py-4 border-r border-zinc-100 text-center">
              <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-1">Transactions</p>
              <p className="text-xl font-black text-zinc-900">{history.length}</p>
            </div>
            <div className="px-5 py-4 border-r border-zinc-100 text-center">
              <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-1">Units Sold</p>
              <p className="text-xl font-black text-zinc-900">{totalSold}</p>
            </div>
            <div className="px-5 py-4 text-center">
              <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-1">Revenue</p>
              <p className="text-xl font-black" style={{ color: BRAND }}>₦{totalRevenue.toLocaleString()}</p>
            </div>
          </div>
        )}

        {/* Body — scrollable */}
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center py-16 gap-3">
              <Loader2 size={18} className="animate-spin" style={{ color: BRAND }} />
              <p className="text-xs font-black uppercase tracking-widest text-zinc-500">Loading history...</p>
            </div>
          )}

          {!loading && error && (
            <div className="flex items-center gap-3 mx-6 my-6 px-4 py-3 bg-red-50 border border-red-200 rounded-xl">
              <AlertCircle size={14} className="text-red-500 shrink-0" />
              <p className="text-red-600 text-xs">{error}</p>
            </div>
          )}

          {!loading && !error && history.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center px-8">
              <div className="w-16 h-16 rounded-2xl bg-zinc-50 border border-zinc-200 flex items-center justify-center mb-5">
                <ShoppingBag size={24} className="text-zinc-300" />
              </div>
              <h3 className="text-sm font-black uppercase tracking-tighter mb-2 text-zinc-900">No Sales Yet</h3>
              <p className="text-zinc-500 text-xs max-w-xs leading-relaxed">
                This item hasn't been sold yet. Once you log a sale in the Sales Day Book, the history will appear here automatically.
              </p>
            </div>
          )}

          {!loading && !error && history.length > 0 && (
            <div className="divide-y divide-zinc-100">
              {history.map((entry, i) => (
                <div key={entry.saleId + i} className="px-6 py-4 hover:bg-zinc-50 transition">
                  <div className="flex items-start justify-between gap-4">
                    {/* Left — date + buyer */}
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-zinc-100 flex items-center justify-center shrink-0 mt-0.5">
                        <TrendingUp size={13} className="text-zinc-500" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-black text-zinc-900">
                          {entry.quantity} unit{entry.quantity !== 1 ? 's' : ''} sold
                          {entry.buyerName && <span className="text-zinc-500 font-normal"> · to {entry.buyerName}</span>}
                        </p>
                        {entry.buyerContact && (
                          <p className="text-[10px] text-zinc-400 mt-0.5">{entry.buyerContact}</p>
                        )}
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400">{entry.pointOfSale}</span>
                          <span className="text-zinc-300">·</span>
                          <PaymentBadge status={entry.paymentStatus} />
                        </div>
                        <p className="text-[10px] text-zinc-400 font-mono mt-1">{fmt(entry.saleDate)}</p>
                      </div>
                    </div>

                    {/* Right — amounts */}
                    <div className="text-right shrink-0">
                      <p className="text-sm font-black text-zinc-900">₦{Number(entry.lineTotal).toLocaleString()}</p>
                      <p className="text-[10px] text-zinc-500 mt-0.5">@ ₦{Number(entry.salePrice).toLocaleString()}/unit</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-zinc-100 shrink-0">
          <button onClick={onClose}
            className="w-full py-3 text-zinc-600 hover:text-zinc-900 font-black text-xs uppercase tracking-widest transition border border-zinc-200 rounded-xl hover:bg-zinc-50">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// ITEM DROPDOWN MENU
// ─────────────────────────────────────────────────────────────────
function ItemMenu({ item, onView, onEdit, onHistory, onDelete, isDeleting }) {
  const [open, setOpen] = useState(false);
  const ref             = useRef(null);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const menuItems = [
    { icon: <Eye size={13} />,    label: 'View Details',    desc: 'Name, price, stock & value',      action: onView,    },
    { icon: <Edit3 size={13} />,  label: 'Edit Item',       desc: 'Update name, price or quantity',  action: onEdit,    },
    { icon: <Clock size={13} />,  label: 'Product History', desc: 'See every sale of this item',     action: onHistory, },
    { icon: <Trash2 size={13} />, label: isDeleting ? 'Removing...' : 'Remove Item', desc: 'Permanently delete this item', action: onDelete, danger: true },
  ];

  return (
    <div ref={ref} className="relative">
      <button
        onClick={e => { e.stopPropagation(); setOpen(o => !o); }}
        className="w-8 h-8 flex items-center justify-center rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 hover:border-zinc-300 transition-all"
        title="Item options">
        {isDeleting
          ? <Loader2 size={13} className="animate-spin text-zinc-400" />
          : <MoreVertical size={14} className="text-zinc-500" />}
      </button>

      {open && (
        <div className="absolute right-0 bottom-full mb-2 z-30 w-56 bg-white border border-zinc-200 rounded-2xl shadow-2xl overflow-hidden">
          <div className="py-1.5">
            {menuItems.map(item => (
              <button key={item.label}
                disabled={isDeleting && item.danger}
                onClick={e => {
                  e.stopPropagation();
                  setOpen(false);
                  item.action();
                }}
                className={`w-full flex items-start gap-3 px-4 py-3 transition-all disabled:opacity-40 ${
                  item.danger
                    ? 'hover:bg-red-50'
                    : 'hover:bg-zinc-50'
                } ${item.danger && !isDeleting ? 'border-t border-zinc-100 mt-1' : ''}`}>
                <span className={`mt-0.5 shrink-0 ${item.danger ? 'text-red-400' : 'text-zinc-400'}`}>{item.icon}</span>
                <div className="text-left">
                  <p className={`text-xs font-black uppercase tracking-widest leading-tight ${item.danger ? 'text-red-500' : 'text-zinc-700'}`}>{item.label}</p>
                  <p className="text-[10px] text-zinc-400 font-normal normal-case mt-0.5 leading-snug">{item.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────
export default function InventoryDashboard({ items, setItems }) {
  // ── Add item modal state ──────────────────────────────────────
  const [showAddModal,  setShowAddModal]  = useState(false);
  const [form,          setForm]          = useState(emptyForm());
  const [isSaving,      setIsSaving]      = useState(false);
  const [formError,     setFormError]     = useState('');
  const [deleteId,      setDeleteId]      = useState(null);
  const [deleteError,   setDeleteError]   = useState('');
  const fileRef = useRef(null);

  // ── Per-item action modals ────────────────────────────────────
  const [viewItem,    setViewItem]    = useState(null); // item object | null
  const [editItem,    setEditItem]    = useState(null); // item object | null
  const [historyItem, setHistoryItem] = useState(null); // item object | null

  // ── Search ────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('');

  // ── Open / close add modal ────────────────────────────────────
  function openAddModal()  { setForm(emptyForm()); setFormError(''); setShowAddModal(true); }
  function closeAddModal() {
    if (form.imagePreview) URL.revokeObjectURL(form.imagePreview);
    setForm(emptyForm()); setFormError(''); setShowAddModal(false);
  }

  // ── Image selection ───────────────────────────────────────────
  function handleImageChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    const MAX_BYTES = 5 * 1024 * 1024;
    if (file.size > MAX_BYTES) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
      setFormError(`Image is too large (${sizeMB}MB). Maximum allowed size is 5MB.`);
      if (fileRef.current) fileRef.current.value = '';
      return;
    }
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.type)) {
      setFormError('Only JPEG, PNG or WebP images are accepted.');
      if (fileRef.current) fileRef.current.value = '';
      return;
    }
    if (form.imagePreview) URL.revokeObjectURL(form.imagePreview);
    setFormError('');
    setForm(p => ({ ...p, imageFile: file, imagePreview: URL.createObjectURL(file) }));
  }

  // ── Add item ──────────────────────────────────────────────────
  async function handleAddItem(e) {
    e.preventDefault();
    if (!form.name.trim())                                                    { setFormError('Item name is required.');   return; }
    if (!form.unit_price || isNaN(+form.unit_price) || +form.unit_price < 0) { setFormError('Enter a valid selling price.'); return; }
    if (form.cost_price  && (isNaN(+form.cost_price) || +form.cost_price < 0)) { setFormError('Enter a valid cost price.'); return; }
    if (!form.quantity   || isNaN(+form.quantity)   || +form.quantity   < 0) { setFormError('Enter a valid quantity.'); return; }

    setFormError(''); setIsSaving(true);
    try {
      const fd = new FormData();
      fd.append('name',          form.name.trim());
      fd.append('category',      form.category.trim());
      fd.append('unit_price',    form.unit_price);
      fd.append('cost_price',    form.cost_price || '0');
      fd.append('quantity',      form.quantity);
      fd.append('serial_number', form.serial_number.trim());
      if (form.imageFile) fd.append('image', form.imageFile);

      const res = await fetch('/api/inventory', { method: 'POST', credentials: 'include', body: fd });
      let data;
      try { data = await res.json(); } catch {
        setFormError("We couldn't complete your request right now. Please try again.");
        return;
      }
      if (res.status === 413) { setFormError(data.message || 'Image is too large. Maximum size is 5MB.'); return; }
      if (!res.ok || !data.success) { setFormError(data.message || "Something went wrong. Your item wasn't saved — please try again."); return; }
      setItems(prev => [data.item, ...prev]);
      closeAddModal();
    } catch {
      setFormError("We couldn't reach the server. Please check your connection and try again.");
    } finally { setIsSaving(false); }
  }

  // ── Delete item ───────────────────────────────────────────────
  async function handleDelete(item) {
    if (!window.confirm(`Remove "${item.name}" from inventory? This can't be undone.`)) return;

    setDeleteError('');
    setDeleteId(item.id);
    try {
      const params = item.image_ext ? `?image_ext=${item.image_ext}` : '';
      const res = await fetch(`/api/inventory/${item.id}${params}`, { method: 'DELETE', credentials: 'include' });
      if (!res.ok) {
        let message = 'Could not remove this item. Please try again.';
        try { const data = await res.json(); message = data.message || message; } catch { /* non-JSON error body */ }
        setDeleteError(message);
        return;
      }
      setItems(prev => prev.filter(i => i.id !== item.id));
    } catch {
      setDeleteError('Network error — please check your connection and try again.');
    } finally {
      setDeleteId(null);
    }
  }

  // ── Edit saved callback ───────────────────────────────────────
  function handleEditSaved(updatedItem) {
    setItems(prev => prev.map(i => i.id === updatedItem.id ? updatedItem : i));
    setEditItem(null);
  }

  // ── Stats ─────────────────────────────────────────────────────
  const totalValue  = items.reduce((s, i) => s + (i.unit_price * i.quantity), 0);
  const lowStockCnt = items.filter(i => i.quantity <= LOW_STOCK).length;

  // ── Filtered items (client-side search) ───────────────────────
  const q = searchQuery.trim().toLowerCase();
  const filteredItems = q
    ? items.filter(i =>
        i.name.toLowerCase().includes(q) ||
        (i.category || '').toLowerCase().includes(q)
      )
    : items;

  return (
    <div className="space-y-8 pb-20">

      {/* Header */}
      <div className="border-b border-zinc-200 -mx-5 px-5 pb-8">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-black tracking-tighter italic uppercase mb-2">
              Your Inventory <span style={{ color: BRAND }}>Build.</span>
            </h1>
            <p className="text-zinc-500 text-sm">Track stock, pricing and product assets. All changes saved to your account.</p>
          </div>
          <button onClick={openAddModal}
            className="flex items-center gap-2 px-6 py-3 font-black text-xs uppercase tracking-widest rounded-xl text-white hover:opacity-90 transition-all"
            style={{ backgroundColor: BRAND }}>
            <Plus size={14} /> Grow Inventory
          </button>
        </div>

        {/* Stats bar */}
        {items.length > 0 && (
          <div className="flex flex-wrap gap-4 mt-6">
            <div className="bg-white border border-zinc-200 rounded-xl px-5 py-3 flex items-center gap-3 shadow-sm">
              <Package size={14} className="text-zinc-500" />
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Total SKUs</p>
                <p className="text-lg font-black text-zinc-900">{items.length}</p>
              </div>
            </div>
            <div className="bg-white border border-zinc-200 rounded-xl px-5 py-3 flex items-center gap-3 shadow-sm">
              <span className="font-black text-sm" style={{ color: BRAND }}>₦</span>
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Inventory Value</p>
                <p className="text-lg font-black text-zinc-900">₦{totalValue.toLocaleString()}</p>
              </div>
            </div>
            {lowStockCnt > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-xl px-5 py-3 flex items-center gap-3">
                <AlertCircle size={14} className="text-red-500" />
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-red-500">Low Stock</p>
                  <p className="text-lg font-black text-red-500">{lowStockCnt} item{lowStockCnt > 1 ? 's' : ''}</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Search bar — only shown when there are items */}
      {items.length > 0 && (
        <div className="relative">
          <Search
            size={15}
            className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search by name or category…"
            className="w-full bg-white border border-zinc-200 rounded-xl pl-10 pr-10 py-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-amber-500 transition-colors shadow-sm"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700 transition"
            >
              <X size={14} />
            </button>
          )}
        </div>
      )}

      {/* Delete error — shown until the next successful action or dismissed */}
      {deleteError && (
        <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl">
          <AlertCircle size={13} className="text-red-500 shrink-0" />
          <p className="text-red-600 text-xs flex-1">{deleteError}</p>
          <button onClick={() => setDeleteError('')} className="text-red-400 hover:text-red-600 transition">
            <X size={13} />
          </button>
        </div>
      )}

      {/* Empty state */}
      {items.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-20 h-20 rounded-2xl bg-zinc-50 border border-zinc-200 flex items-center justify-center mb-6">
            <Package size={32} className="text-zinc-300" />
          </div>
          <h2 className="text-xl font-black uppercase tracking-tighter mb-2 text-zinc-900">No Inventory Yet</h2>
          <p className="text-zinc-500 text-sm max-w-xs mb-8 leading-relaxed">
            Add your first product to start tracking stock, pricing and visual assets.
          </p>
          <button onClick={openAddModal}
            className="flex items-center gap-2 px-8 py-4 font-black text-xs uppercase tracking-widest rounded-xl text-white"
            style={{ backgroundColor: BRAND }}>
            <Plus size={14} /> Add First Item
          </button>
        </div>
      )}

      {/* No search results state */}
      {items.length > 0 && filteredItems.length === 0 && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-16 h-16 rounded-2xl bg-zinc-50 border border-zinc-200 flex items-center justify-center mb-5">
            <Search size={24} className="text-zinc-300" />
          </div>
          <h3 className="text-sm font-black uppercase tracking-tighter mb-2 text-zinc-900">No Results</h3>
          <p className="text-zinc-500 text-xs max-w-xs leading-relaxed mb-4">
            No items match <span className="font-black text-zinc-700">"{searchQuery}"</span>. Try a different name or category.
          </p>
          <button
            onClick={() => setSearchQuery('')}
            className="text-xs font-black uppercase tracking-widest px-5 py-2.5 rounded-xl border border-zinc-200 text-zinc-600 hover:bg-zinc-50 transition"
          >
            Clear Search
          </button>
        </div>
      )}

      {/* Item grid */}
      {filteredItems.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {filteredItems.map(item => (
            <div key={item.id}
              className={`bg-white border rounded-2xl transition-all shadow-sm ${
                item.quantity <= LOW_STOCK ? 'border-red-300' : 'border-zinc-200 hover:border-zinc-300'
              }`}>

              {/* Product image */}
              {item.image_url ? (
                <div className="relative w-full h-44 rounded-t-2xl overflow-hidden">
                  <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                  {item.quantity <= LOW_STOCK && (
                    <div className="absolute top-2 left-2 bg-red-500 text-white text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-lg">
                      {item.quantity === 0 ? 'Out of Stock' : 'Low Stock'}
                    </div>
                  )}
                </div>
              ) : (
                <div className="w-full h-44 bg-zinc-50 rounded-t-2xl overflow-hidden flex flex-col items-center justify-center gap-2 relative">
                  <ImageOff size={24} className="text-zinc-300" />
                  <p className="text-zinc-400 text-[10px] font-black uppercase tracking-widest">No Image</p>
                  {item.quantity <= LOW_STOCK && (
                    <div className="absolute top-2 left-2 bg-red-500 text-white text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-lg">
                      {item.quantity === 0 ? 'Out of Stock' : 'Low Stock'}
                    </div>
                  )}
                </div>
              )}

              {/* Card body */}
              <div className="p-4 space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-black text-zinc-900 text-sm leading-tight truncate">{item.name}</h3>
                    {item.category && (
                      <p className="text-[10px] font-black uppercase tracking-widest text-zinc-400 mt-0.5">{item.category}</p>
                    )}
                  </div>
                  {/* ⋮ Dropdown menu */}
                  <ItemMenu
                    item={item}
                    isDeleting={deleteId === item.id}
                    onView={() => setViewItem(item)}
                    onEdit={() => setEditItem(item)}
                    onHistory={() => setHistoryItem(item)}
                    onDelete={() => handleDelete(item)}
                  />
                </div>

                {/* Price + Stock summary */}
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-lg font-black text-zinc-900">₦{Number(item.unit_price).toLocaleString()}</p>
                    {item.cost_price > 0 && (
                      <p className="text-[10px] text-green-600 font-bold mt-0.5">
                        Cost ₦{Number(item.cost_price).toLocaleString()} · {item.unit_price > 0 ? Math.round(((item.unit_price - item.cost_price) / item.unit_price) * 100) : 0}% margin
                      </p>
                    )}
                  </div>
                  <span className={`text-[10px] font-black px-2.5 py-1 rounded-lg border ${
                    item.quantity <= LOW_STOCK
                      ? 'border-red-200 text-red-500 bg-red-50'
                      : 'border-zinc-200 text-zinc-500 bg-zinc-50'
                  }`}>
                    {item.quantity} in stock
                  </span>
                </div>

                {/* Quick history link */}
                <button onClick={() => setHistoryItem(item)}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-zinc-50 hover:bg-zinc-100 border border-zinc-100 transition group">
                  <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400 group-hover:text-zinc-600 transition">Sale History</span>
                  <ChevronRight size={12} className="text-zinc-300 group-hover:text-zinc-500 transition" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Add Item Modal ─────────────────────────────────────── */}
      {showAddModal && (
        <div className="fixed inset-0 bg-zinc-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white border border-zinc-200 rounded-2xl w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-8 py-6 border-b border-zinc-100">
              <h2 className="text-xl font-black uppercase tracking-tighter text-zinc-900">Add New Item</h2>
              <button onClick={closeAddModal} className="text-zinc-400 hover:text-zinc-700 transition"><X size={18} /></button>
            </div>

            <form onSubmit={handleAddItem} className="px-8 py-6 space-y-4">
              {/* Image upload */}
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">
                  Product Image <span className="text-zinc-400 normal-case font-normal">(optional · max 5MB)</span>
                </p>
                {form.imagePreview ? (
                  <div className="relative w-full h-48 rounded-xl overflow-hidden mb-2">
                    <img src={form.imagePreview} alt="preview" className="w-full h-full object-cover" />
                    <button type="button"
                      onClick={() => { URL.revokeObjectURL(form.imagePreview); setForm(p => ({ ...p, imageFile: null, imagePreview: null })); if (fileRef.current) fileRef.current.value = ''; }}
                      className="absolute top-2 right-2 w-7 h-7 bg-zinc-900/70 rounded-full flex items-center justify-center text-white hover:bg-zinc-900 transition">
                      <X size={13} />
                    </button>
                  </div>
                ) : (
                  <div onClick={() => fileRef.current?.click()}
                    className="w-full h-32 border-2 border-dashed border-zinc-200 hover:border-amber-400 rounded-xl flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors">
                    <Plus size={20} className="text-zinc-400" />
                    <p className="text-zinc-400 text-xs">Click to upload image</p>
                  </div>
                )}
                <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleImageChange} className="hidden" />
              </div>

              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">Item Name *</label>
                <input type="text" placeholder="e.g. Floral Dress" value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className={inputClass} />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">Category</label>
                <input type="text" placeholder="e.g. Apparel, Electronics, Food" value={form.category}
                  onChange={e => setForm(p => ({ ...p, category: e.target.value }))} className={inputClass} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">Selling Price (₦) *</label>
                  <input type="number" placeholder="e.g. 25000" value={form.unit_price}
                    onChange={e => setForm(p => ({ ...p, unit_price: e.target.value }))} className={inputClass} />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">Cost Price (₦)</label>
                  <input type="number" placeholder="e.g. 18000" value={form.cost_price}
                    onChange={e => setForm(p => ({ ...p, cost_price: e.target.value }))} className={inputClass} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">Quantity *</label>
                  <input type="number" placeholder="e.g. 50" value={form.quantity}
                    onChange={e => setForm(p => ({ ...p, quantity: e.target.value }))} className={inputClass} />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">
                    Serial Number <span className="text-zinc-400 font-normal normal-case">optional</span>
                  </label>
                  <input type="text" placeholder="e.g. SN-2024-001" value={form.serial_number}
                    onChange={e => setForm(p => ({ ...p, serial_number: e.target.value }))} className={inputClass} />
                </div>
              </div>

              {formError && (
                <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl">
                  <AlertCircle size={13} className="text-red-500 shrink-0" />
                  <p className="text-red-600 text-xs">{formError}</p>
                </div>
              )}

              <div className="flex gap-4 pt-2">
                <button type="button" onClick={closeAddModal}
                  className="flex-1 py-3 text-zinc-500 hover:text-zinc-800 font-black text-xs uppercase tracking-widest transition border border-zinc-200 rounded-xl hover:bg-zinc-50">
                  Cancel
                </button>
                <button type="submit" disabled={isSaving}
                  className="flex-1 py-3 font-black text-xs uppercase tracking-widest rounded-xl text-white disabled:opacity-50 transition flex items-center justify-center gap-2"
                  style={{ backgroundColor: BRAND }}>
                  {isSaving ? <><Loader2 size={14} className="animate-spin" /> Saving...</> : 'Secure Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── View Modal ─────────────────────────────────────────── */}
      {viewItem && (
        <ViewModal
          item={viewItem}
          onClose={() => setViewItem(null)}
          onEdit={() => { setViewItem(null); setEditItem(viewItem); }}
        />
      )}

      {/* ── Edit Modal ─────────────────────────────────────────── */}
      {editItem && (
        <EditModal
          item={editItem}
          onClose={() => setEditItem(null)}
          onSaved={handleEditSaved}
        />
      )}

      {/* ── History Modal ───────────────────────────────────────── */}
      {historyItem && (
        <HistoryModal
          item={historyItem}
          onClose={() => setHistoryItem(null)}
        />
      )}
    </div>
  );
}
