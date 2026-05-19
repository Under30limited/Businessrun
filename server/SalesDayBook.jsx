/**
 * SalesDayBook.jsx
 *
 * Updates in this version:
 *   - Buyer contact (phone/email/social handle)
 *   - Point of sale channel selector
 *   - Payment status (Paid / Credit)
 *   - Delivery details (optional)
 *   - History row: shows POS, payment status badge, seller name
 *   - Receipt: buyer contact, payment status stamp, all items listed
 */

import React, { useState, useMemo } from 'react';
import {
  ShoppingBag, TrendingUp, Package, Loader2,
  AlertCircle, CheckCircle, ChevronDown, Calendar,
  ArrowRight, Receipt, Plus, X, Download, User,
  Phone, MapPin, Truck, Edit2,
} from 'lucide-react';

const inputClass  = 'w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500 transition-colors';
const selectClass = inputClass + ' appearance-none cursor-pointer pr-10';

const POS_OPTIONS     = ['Walk-in', 'Online', 'Website', 'WhatsApp', 'Instagram', 'Twitter', 'Other'];
const PAYMENT_OPTIONS = ['Paid', 'Credit'];

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
// RECEIPT CANVAS
// ─────────────────────────────────────────────────────────────────
function SaleReceipt({ sale, businessName }) {
  const lines      = (sale.items && sale.items.length > 0)
    ? sale.items
    : [{ itemName: sale.itemName, quantity: sale.quantity, salePrice: sale.salePrice, totalAmount: sale.totalAmount }];
  const grandTotal = sale.totalAmount || 0;
  const fmt        = n => '₦' + Number(n || 0).toLocaleString('en-NG', { minimumFractionDigits: 2 });
  const isPaid     = (sale.paymentStatus || 'Paid') === 'Paid';
  // Receipt always shows the account business name — not the custom seller.
  // The custom seller name is for the history table (who made the sale),
  // not the receipt (which brand/business issued the invoice).
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
            <div style={{
              width: 40, height: 40, background: '#ffffff', borderRadius: 8,
              marginBottom: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ color: '#18181b', fontWeight: 900, fontSize: 15, fontStyle: 'italic' }}>B</span>
            </div>
            <h2 style={{ color: '#fff', fontWeight: 900, fontSize: 22, margin: 0, letterSpacing: '-0.03em' }}>
              {receiptBusiness}
            </h2>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ color: 'rgba(255,255,255,0.08)', fontSize: 52, fontWeight: 900, margin: '0 0 4px', letterSpacing: '-0.04em', textTransform: 'uppercase', lineHeight: 1 }}>Invoice</p>
            <p style={{ color: '#fff', fontWeight: 700, fontSize: 16, margin: 0 }}>{receiptId(sale.id)}</p>
            <p style={{ color: '#a1a1aa', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', margin: '4px 0 0' }}>
              {receiptDateFmt(sale.saleDate || sale.saleDateISO)}
            </p>

            {/* Payment status stamp — bold, unmissable */}
            <div style={{
              display: 'inline-block',
              marginTop: 12,
              padding: '6px 14px',
              borderRadius: 8,
              border: `2px solid ${isPaid ? '#22c55e' : '#ef4444'}`,
              background: isPaid ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
            }}>
              <span style={{
                color:         isPaid ? '#22c55e' : '#ef4444',
                fontWeight:    900,
                fontSize:      11,
                textTransform: 'uppercase',
                letterSpacing: '0.2em',
              }}>
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
            {sale.buyerContact && (
              <p style={{ color: '#71717a', fontSize: 12, margin: 0 }}>{sale.buyerContact}</p>
            )}
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{ fontSize: 9, fontWeight: 900, color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.2em', display: 'block', marginBottom: 6 }}>Sold By</span>
            <p style={{ fontWeight: 700, fontSize: 13, margin: '0 0 4px' }}>{receiptBusiness}</p>
            {sale.pointOfSale && (
              <p style={{ color: '#71717a', fontSize: 12, margin: 0 }}>via {sale.pointOfSale}</p>
            )}
          </div>
        </div>
      </div>

      {/* Delivery details — only shown if present */}
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
                <th key={h} style={{
                  paddingBottom: 10, fontSize: 10, fontWeight: 900,
                  textTransform: 'uppercase', letterSpacing: '0.15em', color: '#18181b',
                  textAlign: i === 0 ? 'left' : 'right',
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {lines.map((line, idx) => (
              <tr key={idx} style={{ borderBottom: '1px solid #f4f4f5' }}>
                <td style={{ padding: '14px 0', fontSize: 13, fontWeight: 600 }}>{line.itemName}</td>
                <td style={{ padding: '14px 0', fontSize: 13, color: '#71717a', textAlign: 'right' }}>{line.quantity}</td>
                <td style={{ padding: '14px 0', fontSize: 13, color: '#71717a', textAlign: 'right' }}>{fmt(line.salePrice)}</td>
                <td style={{ padding: '14px 0', fontSize: 13, fontWeight: 700, textAlign: 'right' }}>
                  {fmt(line.totalAmount || ((line.salePrice || 0) * (line.quantity || 0)))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Totals */}
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
                <p style={{ color: '#dc2626', fontSize: 11, fontWeight: 700, margin: 0 }}>
                  ⚠ This invoice is on credit. Payment is outstanding.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Signature — separate section below totals, full width */}
      <div style={{ padding: '32px 48px 48px', background: '#ffffff', borderTop: '2px solid #e4e4e7' }}>
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <div style={{ textAlign: 'right', minWidth: 220 }}>
            {/* Signature space */}
            <div style={{
              borderBottom: '2px solid #18181b',
              width: '100%',
              marginBottom: 12,
              height: 48,
            }} />
            {/* Business name — who issued the invoice */}
            <p style={{ fontSize: 13, fontWeight: 800, margin: 0, color: '#18181b' }}>
              {receiptBusiness}
            </p>
            <p style={{ fontSize: 9, fontWeight: 900, color: '#a1a1aa', textTransform: 'uppercase', letterSpacing: '0.2em', margin: '4px 0 0' }}>
              Authorized Signatory
            </p>
            {/* Seller name — who logged the sale, only shown if different from business name */}
            {sale.businessName && sale.businessName !== receiptBusiness && (
              <p style={{ fontSize: 10, fontWeight: 700, color: '#71717a', margin: '8px 0 0', borderTop: '1px solid #e4e4e7', paddingTop: 8 }}>
                Sold by: {sale.businessName}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// PAYMENT STATUS BADGE — used in history table
// ─────────────────────────────────────────────────────────────────
function PaymentBadge({ status }) {
  const isPaid = (status || 'Paid') === 'Paid';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest ${
      isPaid
        ? 'bg-green-500/10 text-green-400 border border-green-500/20'
        : 'bg-red-500/10 text-red-400 border border-red-500/20'
    }`}>
      {isPaid ? '✓ Paid' : '⚠ Credit'}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────
export default function SalesDayBook({
  sales, setSales, inventoryItems, setInventoryItems, businessName,
}) {
  const [cart,           setCart]           = useState([emptyLine()]);
  const [buyerName,      setBuyerName]      = useState('');
  const [buyerContact,   setBuyerContact]   = useState('');
  const [customSeller,   setCustomSeller]   = useState(false);  // false = use account name
  const [sellerName,     setSellerName]     = useState('');     // custom override
  const [pointOfSale,    setPointOfSale]    = useState('Walk-in');
  const [paymentStatus,  setPaymentStatus]  = useState('Paid');
  const [deliveryDetails, setDeliveryDetails] = useState('');
  const [isLogging,      setIsLogging]      = useState(false);
  const [formError,      setFormError]      = useState('');
  const [formSuccess,    setFormSuccess]    = useState('');
  const [filterFrom,     setFilterFrom]     = useState('');
  const [filterTo,       setFilterTo]       = useState('');
  const [receiptSale,    setReceiptSale]    = useState(null);

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

  const availableItems = inventoryItems.filter(i => i.quantity > 0);
  // Effective seller name — account name unless user has entered a custom one
  const effectiveSellerName = customSeller && sellerName.trim()
    ? sellerName.trim()
    : (businessName || 'Your Business');

  const grandTotal = cart.reduce((sum, line) => {
    const p = parseFloat(line.salePrice), q = parseInt(line.quantity, 10);
    return sum + (isNaN(p) || isNaN(q) ? 0 : p * q);
  }, 0);

  // ── Cart helpers ──────────────────────────────────────────────
  function addLine()           { setCart(p => [...p, emptyLine()]); }
  function removeLine(key)     { setCart(p => p.length === 1 ? [emptyLine()] : p.filter(l => l._key !== key)); }
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
      setFormSuccess(`Sale logged! ₦${grandTotal.toLocaleString()} · ${paymentStatus} · via ${pointOfSale}`);
      setCart([emptyLine()]); setBuyerName(''); setBuyerContact('');
      setCustomSeller(false); setSellerName('');
      setPointOfSale('Walk-in'); setPaymentStatus('Paid'); setDeliveryDetails('');
    } catch { setFormError("We couldn't reach the server. Please check your connection and try again."); }
    finally  { setIsLogging(false); }
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

        {/* ── Header + Stats ────────────────────────────────────── */}
        <div className="border-b border-zinc-900 -mx-5 px-5 pb-8">
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
              <div key={label} className={`rounded-2xl px-5 py-4 flex items-center gap-3 ${amber ? 'bg-amber-500' : 'bg-zinc-950 border border-zinc-800'}`}>
                {icon}
                <div>
                  <p className={`text-[9px] font-black uppercase tracking-widest ${amber ? 'text-black/60' : 'text-zinc-600'}`}>{label}</p>
                  <p className={`text-xl font-black ${amber ? 'text-black' : 'text-white'}`}>{val}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Log Sale Form ─────────────────────────────────────── */}
        <div className="bg-zinc-950 border border-zinc-900 rounded-[2rem] overflow-hidden">
          <div className="border-b border-zinc-900 px-8 py-5 flex items-center justify-between">
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

            {/* ── Section 1: Sale metadata ────────────────────── */}
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-600 mb-3">Sale Details</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

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

                {/* Payment status */}
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">Payment Status *</label>
                  <div className="grid grid-cols-2 gap-3">
                    {PAYMENT_OPTIONS.map(opt => (
                      <button key={opt} type="button"
                        onClick={() => setPaymentStatus(opt)}
                        className={`py-3 rounded-xl text-xs font-black uppercase tracking-widest border transition-all ${
                          paymentStatus === opt
                            ? opt === 'Paid'
                              ? 'bg-green-500/10 border-green-500/40 text-green-400'
                              : 'bg-red-500/10 border-red-500/40 text-red-400'
                            : 'bg-zinc-900 border-zinc-800 text-zinc-600 hover:border-zinc-700'
                        }`}>
                        {opt === 'Paid' ? '✓ Paid' : '⚠ Credit'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* ── Section 2: Buyer details ─────────────────────── */}
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest text-zinc-600 mb-3">Buyer Details</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

                {/* Seller — account name or custom override */}
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
                    <div className="flex items-center gap-3 px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-xl">
                      <User size={13} className="text-zinc-600 shrink-0" />
                      <span className="text-sm text-zinc-300 font-black truncate">{businessName || 'Your Business'}</span>
                      <span className="text-[9px] text-zinc-600 ml-auto shrink-0">Auto</span>
                    </div>
                  ) : (
                    <input type="text"
                      placeholder={businessName || 'Enter seller name'}
                      value={sellerName}
                      onChange={e => setSellerName(e.target.value)}
                      className={inputClass}
                      autoFocus />
                  )}
                </div>

                {/* Buyer name */}
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">
                    Buyer Name <span className="text-zinc-700 normal-case font-normal">optional</span>
                  </label>
                  <input type="text" placeholder="e.g. Aisha Mohammed"
                    value={buyerName} onChange={e => setBuyerName(e.target.value)} className={inputClass} />
                </div>

                {/* Buyer contact */}
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">
                    Buyer Contact <span className="text-zinc-700 normal-case font-normal">optional</span>
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

            {/* ── Section 3: Delivery (optional) ──────────────── */}
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2 flex items-center gap-2">
                <Truck size={12} />
                Delivery Details <span className="text-zinc-700 normal-case font-normal">optional</span>
              </label>
              <div className="relative">
                <MapPin size={13} className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600 pointer-events-none" />
                <input type="text" placeholder="Delivery address or notes — leave blank if collection"
                  value={deliveryDetails} onChange={e => setDeliveryDetails(e.target.value)}
                  className={inputClass + ' pl-10'} />
              </div>
            </div>

            {/* ── Section 4: Cart ──────────────────────────────── */}
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
                  <div key={line._key} className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-4 space-y-3">
                    {cart.length > 1 && (
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-black uppercase tracking-widest text-zinc-600">Item {idx + 1}</span>
                        <button type="button" onClick={() => removeLine(line._key)} className="text-zinc-700 hover:text-red-400 transition">
                          <X size={13} />
                        </button>
                      </div>
                    )}
                    <div className="relative">
                      <select value={line.inventoryItemId} onChange={e => selectProduct(line._key, e.target.value)}
                        className={selectClass} disabled={availableItems.length === 0}>
                        <option value="">Select product to sell...</option>
                        {availableItems.map(item => (
                          <option key={item.id} value={item.id}>
                            {item.name} — {item.quantity} in stock · ₦{Number(item.unit_price).toLocaleString()}
                          </option>
                        ))}
                      </select>
                      <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-600 pointer-events-none" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[9px] font-black uppercase tracking-widest text-zinc-600 mb-1.5">Qty</label>
                        <input type="number" min="1" placeholder="e.g. 3" value={line.quantity}
                          onChange={e => updateLine(line._key, 'quantity', e.target.value)}
                          className={inputClass} disabled={!line.inventoryItemId} />
                      </div>
                      <div>
                        <label className="block text-[9px] font-black uppercase tracking-widest text-zinc-600 mb-1.5">
                          Sale Price (₦) <span className="text-zinc-700 font-normal normal-case">editable</span>
                        </label>
                        <input type="number" min="0" placeholder="e.g. 25000" value={line.salePrice}
                          onChange={e => updateLine(line._key, 'salePrice', e.target.value)}
                          className={inputClass} disabled={!line.inventoryItemId} />
                      </div>
                    </div>
                    {line.inventoryItemId && line.salePrice !== '' && line.quantity !== '' && (
                      <div className="flex items-center justify-between px-3 py-2 bg-zinc-900 rounded-xl">
                        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-600">
                          Line total
                          {parseFloat(line.salePrice) < line.unitPrice && <span className="text-red-400 ml-2">· Below listed</span>}
                          {parseFloat(line.salePrice) > line.unitPrice && <span className="text-green-400 ml-2">· Above listed</span>}
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
                  <div className="flex items-center gap-2 mt-1">
                    <PaymentBadge status={paymentStatus} />
                    <span className="text-[10px] text-zinc-600">via {pointOfSale}</span>
                  </div>
                </div>
                <span className="text-2xl font-black text-amber-500">₦{grandTotal.toLocaleString()}</span>
              </div>
            )}

            {formError && (
              <div className="flex items-center gap-2 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                <AlertCircle size={13} className="text-red-400 shrink-0" /><p className="text-red-400 text-xs">{formError}</p>
              </div>
            )}
            {formSuccess && (
              <div className="flex items-center gap-2 px-4 py-3 bg-green-500/10 border border-green-500/20 rounded-xl">
                <CheckCircle size={13} className="text-green-400 shrink-0" /><p className="text-green-400 text-xs">{formSuccess}</p>
              </div>
            )}

            <button type="submit" disabled={isLogging || availableItems.length === 0}
              className="w-full flex items-center justify-center gap-2 py-4 bg-amber-500 text-black font-black text-xs uppercase tracking-widest rounded-xl hover:bg-amber-400 transition-all disabled:opacity-40">
              {isLogging ? <><Loader2 size={15} className="animate-spin" /> Recording Sale...</> : <><ArrowRight size={15} /> Log Sale & Deduct Stock</>}
            </button>
          </form>
        </div>

        {/* ── Sales History ─────────────────────────────────────── */}
        <div className="bg-zinc-950 border border-zinc-900 rounded-[2rem] overflow-hidden">
          <div className="border-b border-zinc-900 px-8 py-5 flex items-center justify-between flex-wrap gap-4">
            <div>
              <h2 className="text-lg font-black italic uppercase">Sales History</h2>
              <p className="text-zinc-600 text-xs mt-0.5">
                {filteredSales.length} record{filteredSales.length === 1 ? '' : 's'}{(filterFrom || filterTo) ? ' in range' : ' total'}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Calendar size={13} className="text-zinc-600" />
              <input type="date" value={filterFrom} onChange={e => setFilterFrom(e.target.value)}
                className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-amber-500 transition" />
              <span className="text-zinc-700 text-xs font-black">→</span>
              <input type="date" value={filterTo} onChange={e => setFilterTo(e.target.value)}
                className="bg-zinc-900 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-300 focus:outline-none focus:border-amber-500 transition" />
              {(filterFrom || filterTo) && (
                <button onClick={() => { setFilterFrom(''); setFilterTo(''); }}
                  className="text-[10px] font-black uppercase tracking-widest text-zinc-600 hover:text-amber-500 transition px-3 py-2 bg-zinc-900 rounded-xl border border-zinc-800">Clear</button>
              )}
            </div>
          </div>

          {filteredSales.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center px-8">
              <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-5">
                <Receipt size={24} className="text-zinc-700" />
              </div>
              <h3 className="text-base font-black uppercase tracking-tighter mb-2">No Sales Yet</h3>
              <p className="text-zinc-600 text-sm max-w-xs leading-relaxed">
                {(filterFrom || filterTo) ? 'No sales in this date range.' : 'Log your first sale above.'}
              </p>
            </div>
          )}

          {filteredSales.length > 0 && (
            <div>
              {/* Table header */}
              <div className="hidden lg:grid grid-cols-[1.5fr_1fr_1fr_0.8fr_0.8fr_0.8fr_0.8fr_auto] gap-3 px-8 py-3 bg-zinc-900/60 border-b border-zinc-900">
                {['Product(s)', 'Buyer', 'Seller', 'Date', 'Channel', 'Status', 'Total', ''].map(h => (
                  <p key={h} className="text-[9px] font-black uppercase tracking-widest text-zinc-600">{h}</p>
                ))}
              </div>

              <div className="divide-y divide-zinc-900/60">
                {filteredSales.map(sale => {
                  const saleLines = (sale.items && sale.items.length > 0)
                    ? sale.items
                    : [{ itemName: sale.itemName, quantity: sale.quantity }];
                  const itemLabel = saleLines.length === 1 ? saleLines[0].itemName : `${saleLines.length} products`;
                  const totalQty  = saleLines.reduce((s, l) => s + (l.quantity || 0), 0);

                  return (
                    <div key={sale.id}
                      className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr_1fr_0.8fr_0.8fr_0.8fr_0.8fr_auto] gap-2 lg:gap-3 px-8 py-5 hover:bg-zinc-900/20 transition items-start lg:items-center">

                      {/* Product(s) */}
                      <div>
                        <p className="text-sm font-black text-white">{itemLabel}</p>
                        {saleLines.length > 1 && (
                          <p className="text-[10px] text-zinc-600 mt-0.5 leading-relaxed">{saleLines.map(l => l.itemName).join(', ')}</p>
                        )}
                        <p className="text-[10px] text-zinc-600 mt-0.5">{totalQty} unit{totalQty > 1 ? 's' : ''}</p>
                      </div>

                      {/* Buyer */}
                      <div>
                        <p className="text-xs text-zinc-300 font-black">{sale.buyerName || '—'}</p>
                        {sale.buyerContact && <p className="text-[10px] text-zinc-600 mt-0.5">{sale.buyerContact}</p>}
                        <p className="text-[10px] text-zinc-600 lg:hidden mt-0.5">{formatDate(sale.saleDate || sale.saleDateISO)}</p>
                      </div>

                      {/* Seller */}
                      <p className="text-xs text-zinc-400">{sale.businessName || '—'}</p>

                      {/* Date */}
                      <p className="hidden lg:block text-xs text-zinc-500 font-mono">
                        {formatDate(sale.saleDate || sale.saleDateISO)}
                      </p>

                      {/* Channel (point of sale) */}
                      <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                        {sale.pointOfSale || 'Walk-in'}
                        {sale.deliveryDetails && <span className="block text-zinc-700 normal-case font-normal mt-0.5">{sale.deliveryDetails}</span>}
                      </p>

                      {/* Payment status badge */}
                      <div><PaymentBadge status={sale.paymentStatus} /></div>

                      {/* Total */}
                      <p className="text-sm font-black text-amber-500">₦{Number(sale.totalAmount).toLocaleString()}</p>

                      {/* Download */}
                      <button onClick={() => downloadReceipt(sale)}
                        className="flex items-center gap-1.5 px-3 py-2 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 hover:border-zinc-700 rounded-xl text-[10px] font-black uppercase tracking-widest text-zinc-500 hover:text-white transition print:hidden">
                        <Download size={11} /><span className="hidden lg:inline">Receipt</span>
                      </button>
                    </div>
                  );
                })}
              </div>

              {(filterFrom || filterTo) && filteredSales.length > 0 && (
                <div className="px-8 py-4 border-t border-zinc-900 bg-zinc-900/40 flex flex-wrap gap-6">
                  <div><p className="text-[9px] font-black uppercase tracking-widest text-zinc-600 mb-1">Range Revenue</p><p className="text-lg font-black text-amber-500">₦{filteredSales.reduce((s, x) => s + x.totalAmount, 0).toLocaleString()}</p></div>
                  <div><p className="text-[9px] font-black uppercase tracking-widest text-zinc-600 mb-1">Range Units</p><p className="text-lg font-black text-white">{filteredSales.reduce((s, x) => s + (x.quantity || 0), 0)}</p></div>
                  <div><p className="text-[9px] font-black uppercase tracking-widest text-zinc-600 mb-1">Transactions</p><p className="text-lg font-black text-white">{filteredSales.length}</p></div>
                  <div><p className="text-[9px] font-black uppercase tracking-widest text-zinc-600 mb-1">Credit Outstanding</p><p className="text-lg font-black text-red-400">{filteredSales.filter(s => s.paymentStatus === 'Credit').length}</p></div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
