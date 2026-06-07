/**
 * SalesDayBook.jsx
 *
 * Sales Day Book tab for the user dashboard.
 *
 * Features:
 *   - Log a sale with multi-item cart, buyer details, payment method
 *   - Per-sale ⋮ dropdown menu:
 *       • View         — full read-only sale detail sheet
 *       • Edit         — edit buyer, seller, channel, payment status/method, delivery
 *       • View Payment — shows how payment was made (method + status)
 *       • Sale Return  — deletes the record and restores inventory stock
 *       • Receipt      — downloads/prints the receipt
 *   - Date range filter
 *   - Stats bar (today's revenue, sales count, units, all-time revenue)
 */

import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  ShoppingBag, TrendingUp, Package, Loader2,
  AlertCircle, CheckCircle, ChevronDown, Calendar,
  ArrowRight, Receipt, Plus, X, Download, User,
  Phone, MapPin, Truck, Edit2, MoreVertical,
  Eye, Edit3, CreditCard, RotateCcw, Check, Search,
} from 'lucide-react';

const inputClass  = 'w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-amber-500 transition-colors';
const selectClass = inputClass + ' appearance-none cursor-pointer pr-10';
const BRAND       = '#C5A028';

const POS_OPTIONS     = ['Walk-in', 'Online', 'Website', 'WhatsApp', 'Instagram', 'Twitter', 'Other'];
const PAYMENT_OPTIONS = ['Paid', 'Credit'];
const PAYMENT_METHODS = ['Cash', 'Bank Transfer', 'POS', 'Cheque', 'Crypto', 'Other'];

// ── Helpers ───────────────────────────────────────────────────────
function todayISO() { return new Date().toISOString().slice(0, 10); }
function isToday(iso) { return iso ? iso.slice(0, 10) === todayISO() : false; }
function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-NG', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}
function receiptDateFmt(iso) {
  return (iso ? new Date(iso) : new Date()).toLocaleDateString('en-NG', {
    day: '2-digit', month: 'long', year: 'numeric',
  });
}
function receiptId(id) { return 'INV-' + String(id || Date.now()).slice(-8).toUpperCase(); }
const emptyLine = () => ({
  _key: Date.now() + Math.random(),
  inventoryItemId: '', itemName: '', unitPrice: 0, salePrice: '', quantity: '',
});

// ─────────────────────────────────────────────────────────────────
// PRODUCT SEARCH COMBOBOX
// Replaces the native <select> for product selection in the cart.
// As the user types, inventory items matching the query appear.
// ─────────────────────────────────────────────────────────────────
function ProductPicker({ lineKey, selectedId, availableItems, onSelect, disabled }) {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    if (!query.trim()) return availableItems;
    const q = query.toLowerCase();
    return availableItems.filter(item =>
      item.name.toLowerCase().includes(q) ||
      (item.category || '').toLowerCase().includes(q)
    );
  }, [query, availableItems]);

  return (
    <div className={`space-y-2 ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      {/* Search input — filters the select below */}
      <div className="relative">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Type to search products..."
          className="w-full bg-zinc-50 border border-zinc-200 rounded-xl pl-9 pr-4 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-amber-500 transition-colors"
        />
        {query && (
          <button type="button" onClick={() => setQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 transition">
            <X size={12} />
          </button>
        )}
      </div>

      {/* Native select — always visible, filtered by search */}
      <div className="relative">
        <select
          value={selectedId}
          onChange={e => onSelect(lineKey, e.target.value)}
          className={selectClass}
          disabled={availableItems.length === 0}>
          <option value="">
            {filtered.length === 0 ? 'No products match your search' : 'Select product to sell...'}
          </option>
          {filtered.map(item => (
            <option key={item.id} value={item.id}>
              {item.name} — {item.quantity} in stock · ₦{Number(item.unit_price).toLocaleString()}
            </option>
          ))}
        </select>
        <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-600 pointer-events-none" />
      </div>

      {/* Match count hint when searching */}
      {query.trim() && (
        <p className="text-[10px] text-zinc-400 px-1">
          {filtered.length === 0
            ? 'No products match — clear search to see all'
            : `${filtered.length} product${filtered.length === 1 ? '' : 's'} match "${query}"`}
        </p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// RECEIPT CANVAS
// ─────────────────────────────────────────────────────────────────
function SaleReceipt({ sale, businessName }) {
  const lines      = (sale.items && sale.items.length > 0)
    ? sale.items
    : [{ itemName: sale.itemName, quantity: sale.quantity, salePrice: sale.salePrice, totalAmount: sale.totalAmount }];
  const grandTotal = sale.totalAmount || 0;
  const fmt        = n => '₦' + Number(n || 0).toLocaleString('en-NG', { minimumFractionDigits: 2 });
  const isPaid     = (sale.paymentStatus || 'Paid') === 'Paid';
  const receiptBusiness = businessName || 'Your Business';

  return (
    <div id="sale-receipt-canvas" style={{
      background: '#ffffff', width: '210mm',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      color: '#18181b', borderRadius: '16px', border: '1px solid #e4e4e7', overflow: 'hidden',
    }}>
      {/* Dark header */}
      <div style={{ background: '#18181b', padding: '40px 48px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ width: 40, height: 40, background: '#ffffff', borderRadius: 8, marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: '#18181b', fontWeight: 900, fontSize: 15, fontStyle: 'italic' }}>B</span>
            </div>
            <h2 style={{ color: '#fff', fontWeight: 900, fontSize: 22, margin: 0, letterSpacing: '-0.03em' }}>{receiptBusiness}</h2>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ color: 'rgba(255,255,255,0.08)', fontSize: 52, fontWeight: 900, margin: '0 0 4px', letterSpacing: '-0.04em', textTransform: 'uppercase', lineHeight: 1 }}>Invoice</p>
            <p style={{ color: '#fff', fontWeight: 700, fontSize: 16, margin: 0 }}>{receiptId(sale.id)}</p>
            <p style={{ color: '#a1a1aa', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', margin: '4px 0 0' }}>
              {receiptDateFmt(sale.saleDate || sale.saleDateISO)}
            </p>
            <div style={{ display: 'inline-block', marginTop: 12, padding: '6px 14px', borderRadius: 8, border: `2px solid ${isPaid ? '#22c55e' : '#ef4444'}`, background: isPaid ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)' }}>
              <span style={{ color: isPaid ? '#22c55e' : '#ef4444', fontWeight: 900, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.2em' }}>
                {isPaid ? '✓ PAID' : '⚠ CREDIT'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Bill to / Sold by bar */}
      <div style={{ background: '#f4f4f5', padding: '20px 48px', borderBottom: '1px solid #e4e4e7' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 32, flexWrap: 'wrap' }}>
          <div style={{ flex: 1 }}>
            <span style={{ fontSize: 9, fontWeight: 900, color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.2em', display: 'block', marginBottom: 6 }}>Bill To</span>
            <p style={{ fontWeight: 800, fontSize: 15, margin: '0 0 4px' }}>{sale.buyerName || 'Customer'}</p>
            {sale.buyerContact && <p style={{ color: '#71717a', fontSize: 12, margin: 0 }}>{sale.buyerContact}</p>}
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: 9, fontWeight: 900, color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.2em', display: 'block', marginBottom: 6 }}>Sold By</span>
            <p style={{ fontWeight: 700, fontSize: 13, margin: '0 0 4px' }}>{receiptBusiness}</p>
            {sale.pointOfSale && <p style={{ color: '#71717a', fontSize: 12, margin: 0 }}>via {sale.pointOfSale}</p>}
            {sale.paymentMethod && <p style={{ color: '#71717a', fontSize: 12, margin: '2px 0 0' }}>Payment: {sale.paymentMethod}</p>}
          </div>
        </div>
      </div>

      {sale.deliveryDetails && (
        <div style={{ padding: '12px 48px', background: '#fffbeb', borderBottom: '1px solid #fde68a' }}>
          <span style={{ fontSize: 9, fontWeight: 900, color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.15em' }}>
            Delivery: {sale.deliveryDetails}
          </span>
        </div>
      )}

      {/* Items table */}
      <div style={{ padding: '32px 48px', background: '#fff' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid #18181b' }}>
              {['Description', 'Qty', 'Unit Price', 'Total'].map((h, i) => (
                <th key={h} style={{ paddingBottom: 10, fontSize: 10, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.15em', color: '#18181b', textAlign: i === 0 ? 'left' : 'right' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lines.map((line, idx) => (
              <tr key={idx} style={{ borderBottom: '1px solid #f4f4f5' }}>
                <td style={{ padding: '14px 0', fontSize: 13, fontWeight: 600 }}>{line.itemName}</td>
                <td style={{ padding: '14px 0', fontSize: 13, color: '#71717a', textAlign: 'right' }}>{line.quantity}</td>
                <td style={{ padding: '14px 0', fontSize: 13, color: '#71717a', textAlign: 'right' }}>{fmt(line.salePrice)}</td>
                <td style={{ padding: '14px 0', fontSize: 13, fontWeight: 700, textAlign: 'right' }}>{fmt(line.totalAmount || ((line.salePrice || 0) * (line.quantity || 0)))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Totals */}
      <div style={{ padding: '24px 48px 32px', background: '#fafafa', borderTop: '1px solid #e4e4e7' }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ width: 280 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ color: '#71717a', fontSize: 13, fontWeight: 600 }}>Subtotal</span>
              <span style={{ fontWeight: 600, fontSize: 13 }}>{fmt(grandTotal)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: 12, borderBottom: '1px solid #e4e4e7', marginBottom: 12 }}>
              <span style={{ color: '#71717a', fontSize: 13, fontWeight: 600 }}>VAT (0%)</span>
              <span style={{ fontWeight: 600, fontSize: 13 }}>₦0.00</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 11, fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.15em' }}>Amount Due</span>
              <span style={{ fontSize: 32, fontWeight: 900, letterSpacing: '-0.04em' }}>{fmt(grandTotal)}</span>
            </div>
            {!isPaid && (
              <div style={{ marginTop: 12, padding: '8px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8 }}>
                <p style={{ color: '#dc2626', fontSize: 11, fontWeight: 700, margin: 0 }}>⚠ This invoice is on credit. Payment is outstanding.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Signature */}
      <div style={{ padding: '32px 48px 48px', background: '#ffffff', borderTop: '2px solid #e4e4e7' }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ textAlign: 'right', minWidth: 220 }}>
            <div style={{ borderBottom: '2px solid #18181b', width: '100%', marginBottom: 12, height: 48 }} />
            <p style={{ fontSize: 13, fontWeight: 800, margin: 0, color: '#18181b' }}>{receiptBusiness}</p>
            <p style={{ fontSize: 9, fontWeight: 900, color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.2em', margin: '4px 0 0' }}>Authorized Signatory</p>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// PAYMENT STATUS BADGE
// ─────────────────────────────────────────────────────────────────
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
// VIEW MODAL — full read-only sale detail
// ─────────────────────────────────────────────────────────────────
function ViewModal({ sale, onClose, onEdit }) {
  const lines = (sale.items && sale.items.length > 0)
    ? sale.items
    : [{ itemName: sale.itemName, quantity: sale.quantity, salePrice: sale.salePrice, totalAmount: sale.totalAmount }];

  return (
    <div className="fixed inset-0 bg-zinc-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white border border-zinc-200 rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: BRAND + '15' }}>
              <Eye size={15} style={{ color: BRAND }} />
            </div>
            <div>
              <h2 className="text-base font-black uppercase tracking-tight">Sale Details</h2>
              <p className="text-[10px] text-zinc-500 mt-0.5 font-mono">INV-{String(sale.id || '').slice(-8).toUpperCase()}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700 transition"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Parties */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-zinc-50 border border-zinc-100 rounded-xl px-4 py-4">
              <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-2">Seller</p>
              <p className="text-sm font-black text-zinc-900">{sale.businessName || '—'}</p>
            </div>
            <div className="bg-zinc-50 border border-zinc-100 rounded-xl px-4 py-4">
              <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-2">Buyer</p>
              <p className="text-sm font-black text-zinc-900">{sale.buyerName || '—'}</p>
              {sale.buyerContact && <p className="text-[10px] text-zinc-500 mt-0.5">{sale.buyerContact}</p>}
            </div>
          </div>

          {/* Meta */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-zinc-50 border border-zinc-100 rounded-xl px-3 py-3 text-center">
              <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-1">Channel</p>
              <p className="text-xs font-black text-zinc-900">{sale.pointOfSale || 'Walk-in'}</p>
            </div>
            <div className="bg-zinc-50 border border-zinc-100 rounded-xl px-3 py-3 text-center">
              <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-1">Status</p>
              <PaymentBadge status={sale.paymentStatus} />
            </div>
            <div className="bg-zinc-50 border border-zinc-100 rounded-xl px-3 py-3 text-center">
              <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-1">Method</p>
              <p className="text-xs font-black text-zinc-900">{sale.paymentMethod || 'Cash'}</p>
            </div>
          </div>

          {/* Date + Delivery */}
          <div className="space-y-2">
            <div className="flex items-center justify-between py-2 border-b border-zinc-100">
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Date</p>
              <p className="text-xs text-zinc-900 font-mono">{formatDate(sale.saleDate || sale.saleDateISO)}</p>
            </div>
            {sale.deliveryDetails && (
              <div className="flex items-start justify-between py-2 border-b border-zinc-100 gap-4">
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 shrink-0">Delivery</p>
                <p className="text-xs text-zinc-900 text-right">{sale.deliveryDetails}</p>
              </div>
            )}
          </div>

          {/* Items */}
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-3">Items Purchased</p>
            <div className="space-y-2">
              {lines.map((line, i) => (
                <div key={i} className="flex items-center justify-between px-4 py-3 bg-zinc-50 border border-zinc-100 rounded-xl">
                  <div>
                    <p className="text-sm font-black text-zinc-900">{line.itemName}</p>
                    <p className="text-[10px] text-zinc-500 mt-0.5">{line.quantity} unit{line.quantity !== 1 ? 's' : ''} × ₦{Number(line.salePrice).toLocaleString()}</p>
                  </div>
                  <p className="text-sm font-black text-zinc-900">₦{Number(line.totalAmount || ((line.salePrice || 0) * (line.quantity || 0))).toLocaleString()}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Grand total */}
          <div className="flex items-center justify-between px-4 py-4 rounded-xl border" style={{ background: BRAND + '08', borderColor: BRAND + '30' }}>
            <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: BRAND }}>Grand Total</p>
            <p className="text-2xl font-black text-zinc-900">₦{Number(sale.totalAmount).toLocaleString()}</p>
          </div>
        </div>

        <div className="px-6 py-4 border-t border-zinc-100 shrink-0 flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 text-zinc-500 font-black text-xs uppercase tracking-widest border border-zinc-200 rounded-xl hover:bg-zinc-50 transition">Close</button>
          <button onClick={onEdit} className="flex-1 py-3 font-black text-xs uppercase tracking-widest rounded-xl text-white flex items-center justify-center gap-2 transition" style={{ backgroundColor: BRAND }}>
            <Edit3 size={12} /> Edit Sale
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// EDIT MODAL — edit sale metadata (not items)
// ─────────────────────────────────────────────────────────────────
function EditModal({ sale, onClose, onSaved }) {
  const initItems = (
    (sale.items && sale.items.length > 0)
      ? sale.items
      : [{ itemName: sale.itemName, quantity: sale.quantity, salePrice: sale.salePrice, totalAmount: sale.totalAmount }]
  ).map((l, i) => ({ ...l, _key: i }));

  const [form, setForm] = useState({
    buyerName:       sale.buyerName       || '',
    buyerContact:    sale.buyerContact    || '',
    businessName:    sale.businessName    || '',
    pointOfSale:     sale.pointOfSale     || 'Walk-in',
    paymentStatus:   sale.paymentStatus   || 'Paid',
    paymentMethod:   sale.paymentMethod   || 'Cash',
    deliveryDetails: sale.deliveryDetails || '',
  });
  const [editItems, setEditItems] = useState(initItems);
  const [isSaving,  setIsSaving]  = useState(false);
  const [error,     setError]     = useState('');

  function updateEditItem(key, field, val) {
    setEditItems(prev => prev.map(l => l._key === key ? { ...l, [field]: val } : l));
  }

  const editGrandTotal = editItems.reduce((s, l) => {
    const p = parseFloat(l.salePrice), q = parseInt(l.quantity, 10);
    return s + (isNaN(p) || isNaN(q) ? 0 : p * q);
  }, 0);

  async function handleSave() {
    // Validate edited items
    for (let i = 0; i < editItems.length; i++) {
      const l = editItems[i], label = editItems.length > 1 ? `Item ${i + 1}: ` : '';
      if (!l.quantity || isNaN(+l.quantity) || +l.quantity <= 0) { setError(label + 'Quantity must be a positive number.'); return; }
      if (l.salePrice === '' || isNaN(+l.salePrice) || +l.salePrice < 0) { setError(label + 'Sale price must be a valid number.'); return; }
    }

    const updatedItems = editItems.map(l => ({
      ...l,
      quantity:    parseInt(l.quantity, 10),
      salePrice:   parseFloat(l.salePrice),
      totalAmount: parseFloat((parseFloat(l.salePrice) * parseInt(l.quantity, 10)).toFixed(2)),
    }));
    const newTotal = parseFloat(updatedItems.reduce((s, l) => s + l.totalAmount, 0).toFixed(2));

    setError(''); setIsSaving(true);
    try {
      const payload = { ...form, items: updatedItems, totalAmount: newTotal };
      const res = await fetch(`/api/sales/${sale.id}`, {
        method: 'PATCH', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) { setError('Could not save changes. Please try again.'); return; }
      onSaved({ ...sale, ...payload });
    } catch { setError('Network error. Please try again.'); }
    finally   { setIsSaving(false); }
  }

  return (
    <div className="fixed inset-0 bg-zinc-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white border border-zinc-200 rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: BRAND + '15' }}>
              <Edit3 size={15} style={{ color: BRAND }} />
            </div>
            <div>
              <h2 className="text-base font-black uppercase tracking-tight">Edit Sale</h2>
              <p className="text-[10px] text-zinc-500 mt-0.5">INV-{String(sale.id || '').slice(-8).toUpperCase()}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700 transition"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {/* Editable items */}
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-3">Items — Edit Qty &amp; Price</p>
            <div className="space-y-2">
              {editItems.map((line, i) => (
                <div key={line._key} className="bg-zinc-50 border border-zinc-100 rounded-xl p-4">
                  {/* Item name — read only */}
                  <p className="text-xs font-black text-zinc-900 mb-3">{line.itemName}</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-1.5">Quantity</label>
                      <input type="number" min="1" value={line.quantity}
                        onChange={e => updateEditItem(line._key, 'quantity', e.target.value)}
                        className={inputClass} />
                    </div>
                    <div>
                      <label className="block text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-1.5">Sale Price (₦)</label>
                      <input type="number" min="0" value={line.salePrice}
                        onChange={e => updateEditItem(line._key, 'salePrice', e.target.value)}
                        className={inputClass} />
                    </div>
                  </div>
                  {line.quantity && line.salePrice !== '' && !isNaN(+line.quantity) && !isNaN(+line.salePrice) && (
                    <div className="flex items-center justify-between mt-2 px-3 py-1.5 bg-zinc-100 rounded-lg">
                      <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Line total</span>
                      <span className="text-xs font-black text-amber-600">₦{((parseFloat(line.salePrice) || 0) * (parseInt(line.quantity, 10) || 0)).toLocaleString()}</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
            {editGrandTotal > 0 && (
              <div className="flex items-center justify-between mt-3 px-4 py-3 rounded-xl border" style={{ background: BRAND + '08', borderColor: BRAND + '30' }}>
                <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: BRAND }}>New Grand Total</p>
                <p className="text-lg font-black text-zinc-900">₦{editGrandTotal.toLocaleString()}</p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">Buyer Name</label>
              <input type="text" value={form.buyerName} onChange={e => setForm(p => ({ ...p, buyerName: e.target.value }))} className={inputClass} placeholder="e.g. Aisha Mohammed" />
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">Buyer Contact</label>
              <input type="text" value={form.buyerContact} onChange={e => setForm(p => ({ ...p, buyerContact: e.target.value }))} className={inputClass} placeholder="Phone / email" />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">Seller / Business Name</label>
            <input type="text" value={form.businessName} onChange={e => setForm(p => ({ ...p, businessName: e.target.value }))} className={inputClass} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">Point of Sale</label>
              <div className="relative">
                <select value={form.pointOfSale} onChange={e => setForm(p => ({ ...p, pointOfSale: e.target.value }))} className={selectClass}>
                  {POS_OPTIONS.map(o => <option key={o}>{o}</option>)}
                </select>
                <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">Payment Method</label>
              <div className="relative">
                <select value={form.paymentMethod} onChange={e => setForm(p => ({ ...p, paymentMethod: e.target.value }))} className={selectClass}>
                  {PAYMENT_METHODS.map(o => <option key={o}>{o}</option>)}
                </select>
                <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">Payment Status</label>
            <div className="grid grid-cols-2 gap-3">
              {PAYMENT_OPTIONS.map(opt => (
                <button key={opt} type="button" onClick={() => setForm(p => ({ ...p, paymentStatus: opt }))}
                  className={`py-3 rounded-xl text-xs font-black uppercase tracking-widest border transition-all ${
                    form.paymentStatus === opt
                      ? opt === 'Paid' ? 'bg-green-500/10 border-green-500/40 text-green-600' : 'bg-red-500/10 border-red-500/40 text-red-500'
                      : 'bg-zinc-100 border-zinc-200 text-zinc-600 hover:border-zinc-300'
                  }`}>
                  {opt === 'Paid' ? '✓ Paid' : '⚠ Credit'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">Delivery Details</label>
            <input type="text" value={form.deliveryDetails} onChange={e => setForm(p => ({ ...p, deliveryDetails: e.target.value }))} className={inputClass} placeholder="Address or notes — leave blank if collection" />
          </div>

          {error && (
            <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl">
              <AlertCircle size={13} className="text-red-500 shrink-0" />
              <p className="text-red-600 text-xs">{error}</p>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-zinc-100 shrink-0 flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 text-zinc-500 font-black text-xs uppercase tracking-widest border border-zinc-200 rounded-xl hover:bg-zinc-50 transition">Cancel</button>
          <button onClick={handleSave} disabled={isSaving} className="flex-1 py-3 font-black text-xs uppercase tracking-widest rounded-xl text-white disabled:opacity-50 transition flex items-center justify-center gap-2" style={{ backgroundColor: BRAND }}>
            {isSaving ? <><Loader2 size={13} className="animate-spin" /> Saving...</> : <><Check size={13} /> Save Changes</>}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// VIEW PAYMENT MODAL
// ─────────────────────────────────────────────────────────────────
function ViewPaymentModal({ sale, onClose }) {
  const isPaid = (sale.paymentStatus || 'Paid') === 'Paid';
  const method = sale.paymentMethod || 'Cash';

  const methodIcons = {
    'Cash': '💵', 'Bank Transfer': '🏦', 'POS': '💳',
    'Cheque': '📄', 'Crypto': '₿', 'Other': '💰',
  };

  return (
    <div className="fixed inset-0 bg-zinc-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white border border-zinc-200 rounded-2xl w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-100">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: BRAND + '15' }}>
              <CreditCard size={15} style={{ color: BRAND }} />
            </div>
            <h2 className="text-base font-black uppercase tracking-tight">Payment Info</h2>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700 transition"><X size={18} /></button>
        </div>

        <div className="px-6 py-6 space-y-4">
          {/* Big payment method display */}
          <div className="flex flex-col items-center justify-center py-8 bg-zinc-50 border border-zinc-100 rounded-2xl gap-3">
            <span className="text-5xl">{methodIcons[method] || '💰'}</span>
            <p className="text-xl font-black text-zinc-900">{method}</p>
            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Payment Method</p>
          </div>

          {/* Status + Amount */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-zinc-50 border border-zinc-100 rounded-xl px-4 py-4 text-center">
              <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-2">Status</p>
              <PaymentBadge status={sale.paymentStatus} />
            </div>
            <div className="bg-zinc-50 border border-zinc-100 rounded-xl px-4 py-4 text-center">
              <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-1">Amount</p>
              <p className="text-lg font-black text-zinc-900">₦{Number(sale.totalAmount).toLocaleString()}</p>
            </div>
          </div>

          {/* Credit warning */}
          {!isPaid && (
            <div className="flex items-start gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl">
              <AlertCircle size={14} className="text-red-500 shrink-0 mt-0.5" />
              <p className="text-xs text-red-600">This sale is on credit. ₦{Number(sale.totalAmount).toLocaleString()} is outstanding from {sale.buyerName || 'this customer'}.</p>
            </div>
          )}

          {isPaid && (
            <div className="flex items-start gap-3 px-4 py-3 bg-green-50 border border-green-200 rounded-xl">
              <Check size={14} className="text-green-600 shrink-0 mt-0.5" />
              <p className="text-xs text-green-700">Payment confirmed. ₦{Number(sale.totalAmount).toLocaleString()} received via {method}.</p>
            </div>
          )}

          <button onClick={onClose} className="w-full py-3 text-zinc-600 font-black text-xs uppercase tracking-widest border border-zinc-200 rounded-xl hover:bg-zinc-50 transition">Close</button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// SALE RETURN CONFIRM MODAL
// ─────────────────────────────────────────────────────────────────
function SaleReturnModal({ sale, onClose, onConfirm, isDeleting }) {
  const lines = (sale.items && sale.items.length > 0)
    ? sale.items
    : [{ itemName: sale.itemName, quantity: sale.quantity }];

  return (
    <div className="fixed inset-0 bg-zinc-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white border border-zinc-200 rounded-2xl w-full max-w-sm shadow-2xl">
        <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-100">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-red-50 border border-red-200 flex items-center justify-center">
              <RotateCcw size={15} className="text-red-500" />
            </div>
            <h2 className="text-base font-black uppercase tracking-tight text-red-600">Sale Return</h2>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-700 transition"><X size={18} /></button>
        </div>

        <div className="px-6 py-6 space-y-4">
          <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-4">
            <p className="text-xs text-red-700 font-bold mb-3">This will permanently delete this sale record and restore the following stock:</p>
            <div className="space-y-1.5">
              {lines.map((line, i) => (
                <div key={i} className="flex items-center justify-between">
                  <p className="text-xs text-red-900 font-black">{line.itemName}</p>
                  <p className="text-xs text-red-700">+{line.quantity} unit{line.quantity !== 1 ? 's' : ''} restored</p>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between px-4 py-3 bg-zinc-50 border border-zinc-100 rounded-xl">
            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Sale Total</p>
            <p className="text-sm font-black text-zinc-900">₦{Number(sale.totalAmount).toLocaleString()}</p>
          </div>

          <p className="text-[10px] text-zinc-500 text-center">This action cannot be undone.</p>

          <div className="flex gap-3">
            <button onClick={onClose} disabled={isDeleting} className="flex-1 py-3 text-zinc-500 font-black text-xs uppercase tracking-widest border border-zinc-200 rounded-xl hover:bg-zinc-50 transition disabled:opacity-40">
              Cancel
            </button>
            <button onClick={onConfirm} disabled={isDeleting}
              className="flex-1 py-3 font-black text-xs uppercase tracking-widest rounded-xl text-white bg-red-500 hover:bg-red-600 disabled:opacity-50 transition flex items-center justify-center gap-2">
              {isDeleting ? <><Loader2 size={13} className="animate-spin" /> Returning...</> : <><RotateCcw size={13} /> Confirm Return</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// SALE ROW DROPDOWN MENU
// ─────────────────────────────────────────────────────────────────
function SaleMenu({ sale, onView, onEdit, onViewPayment, onSaleReturn, onReceipt }) {
  const [open, setOpen] = useState(false);
  const ref             = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    if (open) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const menuItems = [
    { icon: <Eye size={13} />,        label: 'View',         desc: 'Full sale details & items',     action: onView        },
    { icon: <Edit3 size={13} />,      label: 'Edit',         desc: 'Update buyer, channel or status', action: onEdit      },
    { icon: <CreditCard size={13} />, label: 'View Payment', desc: 'How this sale was paid',         action: onViewPayment },
    { icon: <RotateCcw size={13} />,  label: 'Sale Return',  desc: 'Delete & restore stock',         action: onSaleReturn, danger: true },
    { icon: <Download size={13} />,   label: 'Receipt',      desc: 'Download printable receipt',     action: onReceipt    },
  ];

  return (
    <div ref={ref} className="relative">
      <button
        onClick={e => { e.stopPropagation(); setOpen(o => !o); }}
        className="w-8 h-8 flex items-center justify-center rounded-xl border border-zinc-200 bg-white hover:bg-zinc-50 hover:border-zinc-300 transition-all print:hidden"
        title="Sale options">
        <MoreVertical size={14} className="text-zinc-500" />
      </button>

      {open && (
        <div className="absolute right-0 top-10 z-20 w-56 bg-white border border-zinc-200 rounded-2xl shadow-xl overflow-hidden">
          <div className="py-1.5">
            {menuItems.map((item, i) => (
              <button key={item.label}
                onClick={e => { e.stopPropagation(); setOpen(false); item.action(); }}
                className={`w-full flex items-start gap-3 px-4 py-3 transition-all ${
                  item.danger ? 'hover:bg-red-50 border-t border-zinc-100 mt-1' : 'hover:bg-zinc-50'
                }`}>
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
export default function SalesDayBook({
  sales, setSales, inventoryItems, setInventoryItems, businessName,
}) {
  // ── Form state ────────────────────────────────────────────────
  const [cart,            setCart]            = useState([emptyLine()]);
  const [buyerName,       setBuyerName]       = useState('');
  const [buyerContact,    setBuyerContact]    = useState('');
  const [customSeller,    setCustomSeller]    = useState(false);
  const [sellerName,      setSellerName]      = useState('');
  const [pointOfSale,     setPointOfSale]     = useState('Walk-in');
  const [paymentStatus,   setPaymentStatus]   = useState('Paid');
  const [paymentMethod,   setPaymentMethod]   = useState('Cash');
  const [deliveryDetails, setDeliveryDetails] = useState('');
  const [isLogging,       setIsLogging]       = useState(false);
  const [formError,       setFormError]       = useState('');
  const [formSuccess,     setFormSuccess]     = useState('');

  // ── Filter state ──────────────────────────────────────────────
  const [filterFrom, setFilterFrom] = useState('');
  const [filterTo,   setFilterTo]   = useState('');

  // ── Modals ─────────────────────────────────────────────────────
  const [viewSale,        setViewSale]        = useState(null);
  const [editSale,        setEditSale]        = useState(null);
  const [paymentSale,     setPaymentSale]     = useState(null);
  const [returnSale,      setReturnSale]      = useState(null);
  const [receiptSale,     setReceiptSale]     = useState(null);
  const [isDeleting,      setIsDeleting]      = useState(false);

  // ── Stats ─────────────────────────────────────────────────────
  const todaysSales  = sales.filter(s => isToday(s.saleDate || s.saleDateISO));
  const todayRevenue = todaysSales.reduce((s, x) => s + (x.totalAmount || 0), 0);
  const todayUnits   = todaysSales.reduce((s, x) => s + (x.quantity    || 0), 0);
  const totalRevenue = sales.reduce((s, x) => s + (x.totalAmount || 0), 0);

  const filteredSales = useMemo(() => sales.filter(sale => {
    const date = (sale.saleDate || sale.saleDateISO || '').slice(0, 10);
    if (filterFrom && date < filterFrom) return false;
    if (filterTo   && date > filterTo)   return false;
    return true;
  }), [sales, filterFrom, filterTo]);

  const availableItems      = inventoryItems.filter(i => i.quantity > 0);
  const effectiveSellerName = customSeller && sellerName.trim()
    ? sellerName.trim()
    : (businessName || 'Your Business');

  const grandTotal = cart.reduce((sum, line) => {
    const p = parseFloat(line.salePrice), q = parseInt(line.quantity, 10);
    return sum + (isNaN(p) || isNaN(q) ? 0 : p * q);
  }, 0);

  // ── Cart helpers ──────────────────────────────────────────────
  function addLine()                 { setCart(p => [...p, emptyLine()]); }
  function removeLine(key)           { setCart(p => p.length === 1 ? [emptyLine()] : p.filter(l => l._key !== key)); }
  function updateLine(key, field, val) { setFormError(''); setCart(p => p.map(l => l._key === key ? { ...l, [field]: val } : l)); }

  function selectProduct(key, itemId) {
    if (!itemId) { setCart(p => p.map(l => l._key === key ? { ...l, inventoryItemId: '', itemName: '', unitPrice: 0, salePrice: '' } : l)); return; }
    const item = inventoryItems.find(i => i.id === itemId);
    if (!item) return;
    setCart(p => p.map(l => l._key === key ? { ...l, inventoryItemId: item.id, itemName: item.name, unitPrice: item.unit_price, salePrice: String(item.unit_price) } : l));
    setFormError('');
  }

  // ── Log sale ──────────────────────────────────────────────────
  async function handleLogSale(e) {
    e.preventDefault();
    for (let i = 0; i < cart.length; i++) {
      const line = cart[i], label = cart.length > 1 ? `Row ${i + 1}: ` : '';
      if (!line.inventoryItemId)                                          { setFormError(label + 'Please select a product.');   return; }
      if (!line.quantity || isNaN(+line.quantity) || +line.quantity <= 0) { setFormError(label + 'Enter a valid quantity.');    return; }
      if (line.salePrice === '' || isNaN(+line.salePrice))                { setFormError(label + 'Enter a valid sale price.');  return; }
      const inv = inventoryItems.find(i => i.id === line.inventoryItemId);
      if (inv && inv.quantity < +line.quantity) {
        setFormError(`${label}Only ${inv.quantity} unit${inv.quantity === 1 ? '' : 's'} of "${line.itemName}" in stock.`);
        return;
      }
    }

    setFormError(''); setFormSuccess(''); setIsLogging(true);
    try {
      const res = await fetch('/api/sales', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          buyerName:      buyerName.trim(),
          buyerContact:   buyerContact.trim(),
          businessName:   effectiveSellerName,
          pointOfSale,
          paymentStatus,
          paymentMethod,
          deliveryDetails: deliveryDetails.trim(),
          items: cart.map(line => ({
            inventoryItemId: line.inventoryItemId,
            itemName:        line.itemName,
            unitPrice:       parseFloat(line.unitPrice),
            salePrice:       parseFloat(line.salePrice),
            quantity:        parseInt(line.quantity, 10),
          })),
        }),
      });

      let data;
      try { data = await res.json(); }
      catch { setFormError("We couldn't complete this sale right now. Please try again."); return; }

      if (!res.ok || !data.success) { setFormError(data.message || "Something went wrong. The sale wasn't recorded."); return; }

      setSales(prev => [data.sale, ...prev]);
      if (data.stockUpdates) {
        setInventoryItems(prev => prev.map(item => {
          const u = data.stockUpdates.find(x => x.id === item.id);
          return u ? { ...item, quantity: u.newQuantity } : item;
        }));
      }
      setFormSuccess(`Sale logged! ₦${grandTotal.toLocaleString()} · ${paymentStatus} · ${paymentMethod} · via ${pointOfSale}`);
      setCart([emptyLine()]); setBuyerName(''); setBuyerContact('');
      setCustomSeller(false); setSellerName('');
      setPointOfSale('Walk-in'); setPaymentStatus('Paid'); setPaymentMethod('Cash'); setDeliveryDetails('');
    } catch { setFormError("We couldn't reach the server. Please check your connection and try again."); }
    finally  { setIsLogging(false); }
  }

  // ── Edit saved ────────────────────────────────────────────────
  function handleEditSaved(updatedSale) {
    setSales(prev => prev.map(s => s.id === updatedSale.id ? updatedSale : s));
    setEditSale(null);
  }

  // ── Sale Return (delete) ──────────────────────────────────────
  async function handleSaleReturn() {
    if (!returnSale) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/sales/${returnSale.id}`, { method: 'DELETE', credentials: 'include' });
      if (!res.ok) return;
      const data = await res.json();
      setSales(prev => prev.filter(s => s.id !== returnSale.id));
      if (data.stockUpdates) {
        setInventoryItems(prev => prev.map(item => {
          const u = data.stockUpdates.find(x => x.id === item.id);
          return u ? { ...item, quantity: u.newQuantity } : item;
        }));
      }
      setReturnSale(null);
    } catch { /* silent */ }
    finally { setIsDeleting(false); }
  }

  // ── Receipt download ──────────────────────────────────────────
  function downloadReceipt(sale) {
    setReceiptSale(sale);
    setTimeout(() => { window.print(); setTimeout(() => setReceiptSale(null), 1000); }, 150);
  }

  return (
    <>
      <style>{`
        @page { margin: 0; size: A4; }
        @media print {
          body * { visibility: hidden !important; }
          #sale-receipt-canvas, #sale-receipt-canvas * { visibility: visible !important; }
          #sale-receipt-canvas {
            position: fixed !important; top: 0; left: 0;
            width: 100% !important; height: auto !important;
            box-shadow: none !important; border-radius: 0 !important; border: none !important;
          }
          html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      `}</style>

      {receiptSale && (
        <div style={{ position: 'fixed', top: -9999, left: -9999, zIndex: -1 }}>
          <SaleReceipt sale={receiptSale} businessName={businessName} />
        </div>
      )}

      <div className="space-y-8 pb-20">

        {/* ── Header + Stats ─────────────────────────────────── */}
        <div className="border-b border-zinc-200 -mx-5 px-5 pb-8">
          <div className="flex items-start justify-between flex-wrap gap-4 mb-6">
            <div>
              <h1 className="text-3xl md:text-4xl font-black tracking-tighter italic uppercase mb-2">Sales Day Book</h1>
              <p className="text-zinc-500 text-sm">Log every sale, track daily revenue, and auto-update your inventory.</p>
            </div>
            <span className="text-[9px] font-black uppercase tracking-widest text-amber-500 bg-amber-500/10 px-4 py-2 rounded-full border border-amber-500/20 self-start">Live Ledger</span>
          </div>
          <div className="flex flex-wrap gap-4">
            {[
              { icon: <TrendingUp size={16} className="text-black" />, label: "Today's Revenue", val: `₦${todayRevenue.toLocaleString()}`, amber: true },
              { icon: <ShoppingBag size={16} className="text-zinc-500" />, label: "Today's Sales", val: todaysSales.length },
              { icon: <Package size={16} className="text-zinc-500" />, label: 'Units Sold Today', val: todayUnits },
              { icon: <Receipt size={16} className="text-zinc-500" />, label: 'All-Time Revenue', val: `₦${totalRevenue.toLocaleString()}` },
            ].map(({ icon, label, val, amber }) => (
              <div key={label} className={`rounded-2xl px-5 py-4 flex items-center gap-3 ${amber ? 'bg-amber-500' : 'bg-white border border-zinc-200'}`}>
                {icon}
                <div>
                  <p className={`text-[9px] font-black uppercase tracking-widest ${amber ? 'text-black/60' : 'text-zinc-600'}`}>{label}</p>
                  <p className={`text-xl font-black ${amber ? 'text-black' : 'text-zinc-900'}`}>{val}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Log Sale Form ──────────────────────────────────── */}
        <div className="bg-white border border-zinc-200 rounded-[2rem] shadow-sm overflow-hidden">
          <div className="border-b border-zinc-100 px-8 py-5 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-black italic uppercase">Log a Sale</h2>
              <p className="text-zinc-600 text-xs mt-0.5">
                {availableItems.length === 0
                  ? 'No items in stock — add stock in the Inventory tab first.'
                  : `${availableItems.length} product${availableItems.length === 1 ? '' : 's'} available`}
              </p>
            </div>
            <div className="w-10 h-10 bg-amber-500/10 rounded-xl flex items-center justify-center text-amber-500 border border-amber-500/20">
              <ShoppingBag size={18} />
            </div>
          </div>

          <form onSubmit={handleLogSale} className="p-8 space-y-6">

            {/* Section 1: Sale metadata */}
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-600 mb-3">Sale Details</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

                {/* Point of sale */}
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">Point of Sale *</label>
                  <div className="relative">
                    <select value={pointOfSale} onChange={e => setPointOfSale(e.target.value)} className={selectClass}>
                      {POS_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                    <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-600 pointer-events-none" />
                  </div>
                </div>

                {/* Payment Method */}
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">Payment Method *</label>
                  <div className="relative">
                    <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} className={selectClass}>
                      {PAYMENT_METHODS.map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                    <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-600 pointer-events-none" />
                  </div>
                </div>

                {/* Payment status */}
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">Payment Status *</label>
                  <div className="grid grid-cols-2 gap-3">
                    {PAYMENT_OPTIONS.map(opt => (
                      <button key={opt} type="button"
                        onClick={() => setPaymentStatus(opt)}
                        className={`py-3 rounded-xl text-xs font-black uppercase tracking-widest border transition-all ${
                          paymentStatus === opt
                            ? opt === 'Paid' ? 'bg-green-500/10 border-green-500/40 text-green-600' : 'bg-red-500/10 border-red-500/40 text-red-500'
                            : 'bg-zinc-100 border-zinc-200 text-zinc-600 hover:border-zinc-300'
                        }`}>
                        {opt === 'Paid' ? '✓ Paid' : '⚠ Credit'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Section 2: Buyer details */}
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-600 mb-3">Buyer Details</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Seller */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Seller</label>
                    <button type="button"
                      onClick={() => { setCustomSeller(p => !p); setSellerName(''); }}
                      className="flex items-center gap-1 text-[9px] font-black uppercase tracking-widest text-zinc-600 hover:text-amber-500 transition">
                      <Edit2 size={10} />
                      {customSeller ? 'Use Account Name' : 'Custom Name'}
                    </button>
                  </div>
                  {!customSeller ? (
                    <div className="flex items-center gap-3 px-4 py-3 bg-zinc-100 border border-zinc-200 rounded-xl">
                      <User size={13} className="text-zinc-600 shrink-0" />
                      <span className="text-sm text-zinc-700 font-black truncate">{businessName || 'Your Business'}</span>
                      <span className="text-[9px] text-zinc-600 ml-auto shrink-0">Auto</span>
                    </div>
                  ) : (
                    <input type="text" placeholder={businessName || 'Enter seller name'} value={sellerName}
                      onChange={e => setSellerName(e.target.value)} className={inputClass} autoFocus />
                  )}
                </div>

                {/* Buyer name */}
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">
                    Buyer Name <span className="text-zinc-500 normal-case font-normal">optional</span>
                  </label>
                  <input type="text" placeholder="e.g. Aisha Mohammed"
                    value={buyerName} onChange={e => setBuyerName(e.target.value)} className={inputClass} />
                </div>

                {/* Buyer contact */}
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">
                    Buyer Contact <span className="text-zinc-500 normal-case font-normal">optional</span>
                  </label>
                  <div className="relative">
                    <Phone size={13} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600 pointer-events-none" />
                    <input type="text" placeholder="Phone / email / @handle"
                      value={buyerContact} onChange={e => setBuyerContact(e.target.value)}
                      className={inputClass + ' pl-10'} />
                  </div>
                </div>
              </div>
            </div>

            {/* Section 3: Delivery */}
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2 flex items-center gap-2">
                <Truck size={12} />
                Delivery Details <span className="text-zinc-500 normal-case font-normal">optional</span>
              </label>
              <div className="relative">
                <MapPin size={13} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600 pointer-events-none" />
                <input type="text" placeholder="Delivery address or notes — leave blank if collection"
                  value={deliveryDetails} onChange={e => setDeliveryDetails(e.target.value)}
                  className={inputClass + ' pl-10'} />
              </div>
            </div>

            {/* Section 4: Cart */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-600">Items in this Sale</p>
                <button type="button" onClick={addLine}
                  className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-amber-500 hover:text-amber-400 transition px-3 py-1.5 bg-amber-500/10 rounded-lg border border-amber-500/20">
                  <Plus size={11} /> Add Item
                </button>
              </div>
              <div className="space-y-3">
                {cart.map((line, idx) => (
                  <div key={line._key} className="bg-zinc-100/80 border border-zinc-200 rounded-2xl p-4 space-y-3">
                    {cart.length > 1 && (
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-black uppercase tracking-widest text-zinc-600">Item {idx + 1}</span>
                        <button type="button" onClick={() => removeLine(line._key)} className="text-zinc-500 hover:text-red-400 transition"><X size={13} /></button>
                      </div>
                    )}
                    <ProductPicker
                      lineKey={line._key}
                      selectedId={line.inventoryItemId}
                      availableItems={availableItems}
                      onSelect={selectProduct}
                      disabled={availableItems.length === 0}
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[9px] font-black uppercase tracking-widest text-zinc-600 mb-1.5">Qty</label>
                        <input type="number" min="1" placeholder="e.g. 3" value={line.quantity}
                          onChange={e => updateLine(line._key, 'quantity', e.target.value)}
                          className={inputClass} disabled={!line.inventoryItemId} />
                      </div>
                      <div>
                        <label className="block text-[9px] font-black uppercase tracking-widest text-zinc-600 mb-1.5">
                          Sale Price (₦) <span className="text-zinc-500 font-normal normal-case">editable</span>
                        </label>
                        <input type="number" min="0" placeholder="e.g. 25000" value={line.salePrice}
                          onChange={e => updateLine(line._key, 'salePrice', e.target.value)}
                          className={inputClass} disabled={!line.inventoryItemId} />
                      </div>
                    </div>
                    {line.inventoryItemId && line.salePrice !== '' && line.quantity !== '' && (
                      <div className="flex items-center justify-between px-3 py-2 bg-zinc-100 rounded-xl">
                        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-600">
                          Line total
                          {parseFloat(line.salePrice) < line.unitPrice && <span className="text-red-400 ml-2">· Below listed</span>}
                          {parseFloat(line.salePrice) > line.unitPrice && <span className="text-green-500 ml-2">· Above listed</span>}
                        </span>
                        <span className="text-sm font-black text-amber-500">
                          ₦{((parseFloat(line.salePrice) || 0) * (parseInt(line.quantity, 10) || 0)).toLocaleString()}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Grand total */}
            {grandTotal > 0 && (
              <div className="flex items-center justify-between px-5 py-4 bg-amber-500/5 border border-amber-500/20 rounded-xl">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-amber-500/70">
                    Grand Total · {cart.length} item{cart.length === 1 ? '' : 's'}
                  </span>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <PaymentBadge status={paymentStatus} />
                    <span className="text-[10px] text-zinc-600">{paymentMethod}</span>
                    <span className="text-zinc-400">·</span>
                    <span className="text-[10px] text-zinc-600">via {pointOfSale}</span>
                  </div>
                </div>
                <span className="text-2xl font-black text-amber-500">₦{grandTotal.toLocaleString()}</span>
              </div>
            )}

            {formError && (
              <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl">
                <AlertCircle size={13} className="text-red-500 shrink-0" /><p className="text-red-600 text-xs">{formError}</p>
              </div>
            )}
            {formSuccess && (
              <div className="flex items-center gap-2 px-4 py-3 bg-green-50 border border-green-200 rounded-xl">
                <CheckCircle size={13} className="text-green-500 shrink-0" /><p className="text-green-700 text-xs">{formSuccess}</p>
              </div>
            )}

            <button type="submit" disabled={isLogging || availableItems.length === 0}
              className="w-full flex items-center justify-center gap-2 py-4 bg-amber-500 text-black font-black text-xs uppercase tracking-widest rounded-xl hover:bg-amber-400 transition-all disabled:opacity-40">
              {isLogging ? <><Loader2 size={15} className="animate-spin" /> Recording Sale...</> : <><ArrowRight size={15} /> Log Sale & Deduct Stock</>}
            </button>
          </form>
        </div>

        {/* ── Sales History ──────────────────────────────────── */}
        <div className="bg-white border border-zinc-200 rounded-[2rem] shadow-sm overflow-hidden">
          <div className="border-b border-zinc-100 px-8 py-5 flex items-center justify-between flex-wrap gap-4">
            <div>
              <h2 className="text-lg font-black italic uppercase">Sales History</h2>
              <p className="text-zinc-600 text-xs mt-0.5">
                {filteredSales.length} record{filteredSales.length === 1 ? '' : 's'}{(filterFrom || filterTo) ? ' in range' : ' total'}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Calendar size={13} className="text-zinc-600" />
              <input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)}
                className="bg-zinc-100 border border-zinc-200 rounded-xl px-3 py-2 text-xs text-zinc-700 focus:outline-none focus:border-amber-500 transition" />
              <span className="text-zinc-700 text-xs font-black">→</span>
              <input type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)}
                className="bg-zinc-100 border border-zinc-200 rounded-xl px-3 py-2 text-xs text-zinc-700 focus:outline-none focus:border-amber-500 transition" />
              {(filterFrom || filterTo) && (
                <button onClick={() => { setFilterFrom(''); setFilterTo(''); }}
                  className="text-[10px] font-black uppercase tracking-widest text-zinc-600 hover:text-amber-500 transition px-3 py-2 bg-zinc-100 rounded-xl border border-zinc-200">Clear</button>
              )}
            </div>
          </div>

          {filteredSales.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center px-8">
              <div className="w-16 h-16 rounded-2xl bg-zinc-100 border border-zinc-200 flex items-center justify-center mb-5">
                <Receipt size={24} className="text-zinc-500" />
              </div>
              <h3 className="text-base font-black uppercase tracking-tighter mb-2 text-zinc-900">No Sales Yet</h3>
              <p className="text-zinc-600 text-sm max-w-xs leading-relaxed">
                {(filterFrom || filterTo) ? 'No sales in this date range.' : 'Log your first sale above.'}
              </p>
            </div>
          )}

          {filteredSales.length > 0 && (
            <div>
              {/* Table header */}
              <div className="hidden lg:grid grid-cols-[1.5fr_1fr_1fr_0.8fr_0.8fr_0.8fr_0.8fr_auto] gap-3 px-8 py-3 bg-zinc-50 border-b border-zinc-100">
                {['Product(s)', 'Buyer', 'Seller', 'Date', 'Channel', 'Status', 'Total', ''].map(h => (
                  <p key={h} className="text-[9px] font-black uppercase tracking-widest text-zinc-600">{h}</p>
                ))}
              </div>

              <div className="divide-y divide-zinc-100">
                {filteredSales.map(sale => {
                  const saleLines = (sale.items && sale.items.length > 0)
                    ? sale.items
                    : [{ itemName: sale.itemName, quantity: sale.quantity }];
                  const itemLabel = saleLines.length === 1 ? saleLines[0].itemName : `${saleLines.length} products`;
                  const totalQty  = saleLines.reduce((s, l) => s + (l.quantity || 0), 0);

                  return (
                    <div key={sale.id}
                      className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr_1fr_0.8fr_0.8fr_0.8fr_0.8fr_auto] gap-2 lg:gap-3 px-8 py-5 hover:bg-zinc-50 transition items-start lg:items-center">

                      {/* Product(s) */}
                      <div>
                        <p className="text-sm font-black text-zinc-900">{itemLabel}</p>
                        {saleLines.length > 1 && (
                          <p className="text-[10px] text-zinc-500 mt-0.5 leading-relaxed">{saleLines.map(l => l.itemName).join(', ')}</p>
                        )}
                        <p className="text-[10px] text-zinc-500 mt-0.5">{totalQty} unit{totalQty > 1 ? 's' : ''}</p>
                      </div>

                      {/* Buyer */}
                      <div>
                        <p className="text-xs text-zinc-700 font-black">{sale.buyerName || '—'}</p>
                        {sale.buyerContact && <p className="text-[10px] text-zinc-500 mt-0.5">{sale.buyerContact}</p>}
                        <p className="text-[10px] text-zinc-500 lg:hidden mt-0.5">{formatDate(sale.saleDate || sale.saleDateISO)}</p>
                      </div>

                      {/* Seller */}
                      <p className="text-xs text-zinc-600">{sale.businessName || '—'}</p>

                      {/* Date */}
                      <p className="hidden lg:block text-xs text-zinc-500 font-mono">
                        {formatDate(sale.saleDate || sale.saleDateISO)}
                      </p>

                      {/* Channel */}
                      <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                        {sale.pointOfSale || 'Walk-in'}
                        {sale.deliveryDetails && <span className="block text-zinc-500 normal-case font-normal mt-0.5">{sale.deliveryDetails}</span>}
                      </p>

                      {/* Status */}
                      <div><PaymentBadge status={sale.paymentStatus} /></div>

                      {/* Total */}
                      <p className="text-sm font-black text-amber-500">₦{Number(sale.totalAmount).toLocaleString()}</p>

                      {/* ⋮ Dropdown */}
                      <SaleMenu
                        sale={sale}
                        onView={()        => setViewSale(sale)}
                        onEdit={()        => setEditSale(sale)}
                        onViewPayment={() => setPaymentSale(sale)}
                        onSaleReturn={()  => setReturnSale(sale)}
                        onReceipt={()     => downloadReceipt(sale)}
                      />
                    </div>
                  );
                })}
              </div>

              {(filterFrom || filterTo) && filteredSales.length > 0 && (
                <div className="px-8 py-4 border-t border-zinc-200 bg-zinc-50 flex flex-wrap gap-6">
                  <div><p className="text-[9px] font-black uppercase tracking-widest text-zinc-600 mb-1">Range Revenue</p><p className="text-lg font-black text-amber-500">₦{filteredSales.reduce((s, x) => s + x.totalAmount, 0).toLocaleString()}</p></div>
                  <div><p className="text-[9px] font-black uppercase tracking-widest text-zinc-600 mb-1">Range Units</p><p className="text-lg font-black text-zinc-900">{filteredSales.reduce((s, x) => s + (x.quantity || 0), 0)}</p></div>
                  <div><p className="text-[9px] font-black uppercase tracking-widest text-zinc-600 mb-1">Transactions</p><p className="text-lg font-black text-zinc-900">{filteredSales.length}</p></div>
                  <div><p className="text-[9px] font-black uppercase tracking-widest text-zinc-600 mb-1">Credit Outstanding</p><p className="text-lg font-black text-red-500">{filteredSales.filter(s => s.paymentStatus === 'Credit').length}</p></div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Modals ─────────────────────────────────────────────── */}
      {viewSale    && <ViewModal       sale={viewSale}    onClose={() => setViewSale(null)}    onEdit={() => { setViewSale(null); setEditSale(viewSale); }} />}
      {editSale    && <EditModal       sale={editSale}    onClose={() => setEditSale(null)}    onSaved={handleEditSaved} />}
      {paymentSale && <ViewPaymentModal sale={paymentSale} onClose={() => setPaymentSale(null)} />}
      {returnSale  && <SaleReturnModal  sale={returnSale}  onClose={() => setReturnSale(null)}  onConfirm={handleSaleReturn} isDeleting={isDeleting} />}
    </>
  );
}
