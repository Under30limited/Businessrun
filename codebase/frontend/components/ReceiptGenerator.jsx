import React, { useState, useRef } from 'react';
import {
  FileText, Plus, Trash2, Download,
  Printer, Building2, User, Settings2, Image, X
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────
const CURRENCY_SYMBOLS = { NGN: '₦', USD: '$', GBP: '£', EUR: '€' };

function fmt(amount, currency) {
  const sym = CURRENCY_SYMBOLS[currency] || currency + ' ';
  return sym + Number(amount).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function newInvoiceNumber() {
  return 'INV-' + Math.floor(1000 + Math.random() * 9000);
}

// ─────────────────────────────────────────────────────────────
// ReceiptGenerator
// ─────────────────────────────────────────────────────────────
export default function ReceiptGenerator({ onBack }) {
  const printRef  = useRef();
  const logoInput = useRef();

  // ── Logo state ──────────────────────────────────────────────
  const [logo,        setLogo]        = useState(null);      // base64 data URL
  const [logoPosition, setLogoPosition] = useState('left');  // 'left' | 'center' | 'right'
  const [logoSize,     setLogoSize]     = useState(80);      // px height — 40 to 160

  const [data, setData] = useState({
    invoiceNumber: newInvoiceNumber(),
    date:          new Date().toISOString().split('T')[0],
    sender: {
      name:    'Your Business Name',
      address: '123 Business Way, Lagos',
      email:   'hello@yourbiz.com',
      phone:   '+234 800 000 0000',
    },
    client: {
      name:  'Client Name',
      email: 'client@example.com',
    },
    items:     [{ description: 'Consultation Fee', quantity: 1, rate: 15000 }],
    taxRate:   7.5,
    currency:  'NGN',
    notes:     'Thank you for your business!',
    signatory: '',
  });

  // ── Derived totals ──────────────────────────────────────────
  const subtotal = data.items.reduce((s, i) => s + i.quantity * i.rate, 0);
  const tax      = subtotal * (data.taxRate / 100);
  const total    = subtotal + tax;

  // ── Item helpers ────────────────────────────────────────────
  function updateItem(idx, field, val) {
    const items = [...data.items];
    items[idx]  = { ...items[idx], [field]: field === 'description' ? val : parseFloat(val) || 0 };
    setData(d => ({ ...d, items }));
  }

  function addItem() {
    setData(d => ({ ...d, items: [...d.items, { description: 'New Item', quantity: 1, rate: 0 }] }));
  }

  function removeItem(idx) {
    if (data.items.length === 1) return;
    setData(d => ({ ...d, items: d.items.filter((_, i) => i !== idx) }));
  }

  // ── Logo upload ─────────────────────────────────────────────
  function handleLogoUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => setLogo(ev.target.result);
    reader.readAsDataURL(file);
    // Reset input so same file can be re-uploaded if needed
    e.target.value = '';
  }

  function removeLogo() {
    setLogo(null);
  }

  // ── Logo alignment class on the receipt canvas ──────────────
  const logoAlignClass = {
    left:   'justify-start',
    center: 'justify-center',
    right:  'justify-end',
  }[logoPosition];

  // ── Print / PDF ─────────────────────────────────────────────
  function handlePrint() {
    window.print();
  }

  // ─────────────────────────────────────────────────────────────
  return (
    <>
      {/* Print-only styles */}
      <style>{`
        @page { margin: 0; size: A4; }
        @media print {
          body * { visibility: hidden !important; }
          #receipt-canvas, #receipt-canvas * { visibility: visible !important; }
          #receipt-canvas {
            position: fixed !important;
            top: 0; left: 0;
            width: 100% !important;
            height: auto !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            border: none !important;
          }
          html {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
        }
      `}</style>

      <div className="min-h-screen bg-black font-sans text-zinc-100 pb-20">

        {/* ── Breadcrumb sub-bar ─────────────────────────────── */}
        <div className="bg-zinc-950 border-b border-zinc-900 px-4 sm:px-6 py-3">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs sm:text-sm min-w-0">
              <button onClick={onBack} className="text-zinc-500 hover:text-amber-500 transition font-black shrink-0">
                BusinessRun
              </button>
              <span className="text-zinc-700">/</span>
              <span className="text-zinc-200 font-black shrink-0">Receipt Generator</span>
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0 ml-4">
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrint}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-black text-zinc-400 hover:bg-zinc-800 rounded-lg transition"
                >
                  <Printer size={14} /> Print
                </button>
                <button
                  onClick={handlePrint}
                  className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 text-black text-xs font-black rounded-lg hover:bg-amber-400 transition"
                >
                  <Download size={14} /> Download PDF
                </button>
              </div>
              <p className="text-[10px] text-zinc-600 print:hidden">
                Tip: In the print dialog, set <strong>Headers &amp; Footers → Off</strong>
              </p>
            </div>
          </div>
        </div>

        {/* ── Main grid ──────────────────────────────────────── */}
        <div className="max-w-7xl mx-auto grid grid-cols-1 xl:grid-cols-12 gap-6 lg:gap-8 p-4 sm:p-6 lg:p-8">

          {/* ── Left: Editor ───────────────────────────────── */}
          <div className="xl:col-span-4 space-y-4">

            {/* ── Logo Upload ── */}
            <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5">
              <h4 className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.18em] mb-4 flex items-center gap-2">
                <Image size={11} /> Business Logo
                <span className="text-zinc-700 font-medium normal-case tracking-normal text-[9px]">— optional</span>
              </h4>

              {/* Upload area */}
              {!logo ? (
                <button
                  onClick={() => logoInput.current.click()}
                  className="w-full border-2 border-dashed border-zinc-800 hover:border-amber-500/50 rounded-xl py-6 flex flex-col items-center justify-center gap-2 transition-all group"
                >
                  <div className="w-10 h-10 bg-zinc-900 rounded-xl flex items-center justify-center group-hover:bg-amber-500/10 transition">
                    <Image size={18} className="text-zinc-600 group-hover:text-amber-500 transition" />
                  </div>
                  <p className="text-xs text-zinc-600 group-hover:text-zinc-400 transition">
                    Click to upload logo
                  </p>
                  <p className="text-[10px] text-zinc-700">PNG, JPG or SVG — max 2MB</p>
                </button>
              ) : (
                <div className="relative">
                  <div className="w-full bg-zinc-900 rounded-xl p-4 flex items-center justify-center min-h-[80px]">
                    <img
                      src={logo}
                      alt="Business logo preview"
                      style={{ height: `${Math.min(logoSize, 64)}px`, maxWidth: "100%", objectFit: "contain" }}
                    />
                  </div>
                  <button
                    onClick={removeLogo}
                    className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 hover:bg-red-400 rounded-full flex items-center justify-center transition"
                    title="Remove logo"
                  >
                    <X size={12} className="text-white" />
                  </button>
                  <button
                    onClick={() => logoInput.current.click()}
                    className="mt-2 w-full text-[10px] font-black text-zinc-600 hover:text-amber-500 uppercase tracking-widest transition text-center"
                  >
                    Change Logo
                  </button>
                </div>
              )}
              <input
                ref={logoInput}
                type="file"
                accept="image/png,image/jpeg,image/svg+xml,image/webp"
                className="hidden"
                onChange={handleLogoUpload}
              />

              {/* Logo position selector — only show when logo is uploaded */}
              {logo && (
                <div className="mt-4">
                  <label className="text-[9px] font-black uppercase tracking-widest text-zinc-600 block mb-2">
                    Logo Position
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { value: 'left',   label: 'Left'   },
                      { value: 'center', label: 'Centre' },
                      { value: 'right',  label: 'Right'  },
                    ].map(pos => (
                      <button
                        key={pos.value}
                        onClick={() => setLogoPosition(pos.value)}
                        className={`py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                          logoPosition === pos.value
                            ? 'bg-amber-500 text-black'
                            : 'bg-zinc-900 text-zinc-500 hover:text-zinc-300 border border-zinc-800'
                        }`}
                      >
                        {pos.label}
                      </button>
                    ))}
                  </div>

                  {/* Size slider */}
                  <div className="mt-4">
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-[9px] font-black uppercase tracking-widest text-zinc-600">
                        Logo Size
                      </label>
                      <span className="text-[9px] font-black text-amber-500">{logoSize}px</span>
                    </div>
                    <input
                      type="range"
                      min="30"
                      max="160"
                      step="5"
                      value={logoSize}
                      onChange={e => setLogoSize(Number(e.target.value))}
                      className="w-full h-1.5 bg-zinc-800 rounded-full appearance-none cursor-pointer accent-amber-500"
                    />
                    <div className="flex justify-between mt-1">
                      <span className="text-[9px] text-zinc-700">Small</span>
                      <span className="text-[9px] text-zinc-700">Large</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Business Details */}
            <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5">
              <h4 className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.18em] mb-4 flex items-center gap-2">
                <Building2 size={11} /> Your Business
              </h4>
              <div className="space-y-3">
                {[
                  { placeholder: 'Business Name', key: 'name',    bold: true  },
                  { placeholder: 'Address',        key: 'address', bold: false },
                  { placeholder: 'Email',          key: 'email',   bold: false },
                  { placeholder: 'Phone',          key: 'phone',   bold: false },
                ].map(f => (
                  <input
                    key={f.key}
                    placeholder={f.placeholder}
                    value={data.sender[f.key]}
                    onChange={e => setData(d => ({ ...d, sender: { ...d.sender, [f.key]: e.target.value } }))}
                    className={`w-full border-b border-zinc-800 py-1.5 outline-none focus:border-amber-500 transition text-sm bg-transparent text-zinc-100 ${f.bold ? 'font-bold text-zinc-200' : 'text-zinc-500'}`}
                  />
                ))}
              </div>
            </div>

            {/* Client Info */}
            <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5">
              <h4 className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.18em] mb-4 flex items-center gap-2">
                <User size={11} /> Client
              </h4>
              <div className="space-y-3">
                <input
                  placeholder="Client Name"
                  value={data.client.name}
                  onChange={e => setData(d => ({ ...d, client: { ...d.client, name: e.target.value } }))}
                  className="w-full border-b border-zinc-800 py-1.5 outline-none focus:border-amber-500 transition text-sm font-bold text-zinc-100 bg-transparent"
                />
                <input
                  placeholder="Client Email"
                  value={data.client.email}
                  onChange={e => setData(d => ({ ...d, client: { ...d.client, email: e.target.value } }))}
                  className="w-full border-b border-zinc-900 py-1.5 outline-none focus:border-zinc-600 transition text-sm text-zinc-500 bg-transparent"
                />
              </div>
            </div>

            {/* Line Items */}
            <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5">
              <div className="flex justify-between items-center mb-4">
                <h4 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.18em]">Items & Pricing</h4>
                <button onClick={addItem} className="w-7 h-7 flex items-center justify-center rounded-lg bg-zinc-800 hover:bg-zinc-700 transition text-zinc-400">
                  <Plus size={14} />
                </button>
              </div>
              <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                {data.items.map((item, idx) => (
                  <div key={idx} className="bg-zinc-900 rounded-xl p-3 relative group">
                    {data.items.length > 1 && (
                      <button
                        onClick={() => removeItem(idx)}
                        className="absolute -right-1.5 -top-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition"
                      >
                        <Trash2 size={10} />
                      </button>
                    )}
                    <input
                      value={item.description}
                      onChange={e => updateItem(idx, 'description', e.target.value)}
                      className="w-full text-xs font-bold bg-transparent outline-none mb-2 text-zinc-200 border-b border-zinc-800 pb-1"
                    />
                    <div className="grid grid-cols-2 gap-3 mt-2">
                      <div>
                        <label className="text-[8px] uppercase text-zinc-500 font-bold block mb-0.5">Qty</label>
                        <input type="number" min="0" value={item.quantity}
                          onChange={e => updateItem(idx, 'quantity', e.target.value)}
                          className="w-full text-xs bg-transparent outline-none border-b border-zinc-800 pb-0.5 text-zinc-300"
                        />
                      </div>
                      <div>
                        <label className="text-[8px] uppercase text-zinc-500 font-bold block mb-0.5">Unit Price</label>
                        <input type="number" min="0" value={item.rate}
                          onChange={e => updateItem(idx, 'rate', e.target.value)}
                          className="w-full text-xs bg-transparent outline-none border-b border-zinc-800 pb-0.5 text-zinc-300"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Settings */}
            <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5">
              <h4 className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.18em] mb-4 flex items-center gap-2">
                <Settings2 size={11} /> Settings
              </h4>
              <div className="grid grid-cols-2 gap-4 mb-3">
                <div>
                  <label className="text-[8px] uppercase text-zinc-500 font-bold block mb-1">Currency</label>
                  <select
                    value={data.currency}
                    onChange={e => setData(d => ({ ...d, currency: e.target.value }))}
                    className="w-full text-xs font-bold border-b border-zinc-800 py-1 outline-none bg-transparent text-zinc-300"
                  >
                    <option value="NGN">NGN (₦)</option>
                    <option value="USD">USD ($)</option>
                    <option value="GBP">GBP (£)</option>
                    <option value="EUR">EUR (€)</option>
                  </select>
                </div>
                <div>
                  <label className="text-[8px] uppercase text-zinc-500 font-bold block mb-1">VAT %</label>
                  <input
                    type="number" min="0" max="100"
                    value={data.taxRate}
                    onChange={e => setData(d => ({ ...d, taxRate: parseFloat(e.target.value) || 0 }))}
                    className="w-full text-xs font-bold border-b border-zinc-800 py-1 outline-none bg-transparent text-zinc-300"
                  />
                </div>
              </div>
              <div>
                <label className="text-[8px] uppercase text-zinc-500 font-bold block mb-1">Invoice Date</label>
                <input
                  type="date"
                  value={data.date}
                  onChange={e => setData(d => ({ ...d, date: e.target.value }))}
                  className="w-full text-xs border-b border-zinc-800 py-1 outline-none bg-transparent text-zinc-300"
                />
              </div>
              <div className="mt-3">
                <label className="text-[8px] uppercase text-zinc-500 font-bold block mb-1">Notes</label>
                <textarea
                  value={data.notes}
                  onChange={e => setData(d => ({ ...d, notes: e.target.value }))}
                  rows={2}
                  className="w-full text-xs border border-zinc-900 rounded-lg p-2 outline-none focus:border-zinc-700 resize-none bg-zinc-900 text-zinc-400"
                />
              </div>
              <div className="mt-3">
                <label className="text-[8px] uppercase text-zinc-500 font-bold block mb-1">Authorized Signatory Name</label>
                <input
                  placeholder="e.g. Amaka Obi — CEO"
                  value={data.signatory}
                  onChange={e => setData(d => ({ ...d, signatory: e.target.value }))}
                  className="w-full text-xs border-b border-zinc-800 py-1.5 outline-none focus:border-zinc-600 transition bg-transparent text-zinc-300"
                />
              </div>
            </div>

          </div>

          {/* ── Right: Live Receipt Canvas ──────────────────── */}
          <div className="xl:col-span-8">
            <div
              id="receipt-canvas"
              ref={printRef}
              className="bg-white rounded-2xl shadow-2xl border border-zinc-200 overflow-hidden"
            >
              {/* Header — dark block with white text */}
              <div className="bg-zinc-900 px-8 sm:px-12 py-10 sm:py-12">

                {/* Logo row — only renders when logo is uploaded */}
                {logo && (
                  <div className={`flex ${logoAlignClass} mb-6`}>
                    <img
                      src={logo}
                      alt="Business logo"
                      style={{ height: `${logoSize}px`, maxWidth: "320px", objectFit: "contain" }}
                    />
                  </div>
                )}

                <div className="flex flex-col sm:flex-row justify-between items-start gap-6">
                  <div>
                    {/* Show B placeholder only when no logo is uploaded */}
                    {!logo && (
                      <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center mb-5">
                        <span className="text-zinc-900 font-black text-sm">B</span>
                      </div>
                    )}
                    <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white">
                      {data.sender.name || 'Your Business Name'}
                    </h2>
                    <p className="text-zinc-400 text-xs mt-1.5 leading-relaxed max-w-xs">
                      {data.sender.address}
                    </p>
                    {data.sender.email && (
                      <p className="text-zinc-400 text-xs mt-0.5">{data.sender.email}</p>
                    )}
                    {data.sender.phone && (
                      <p className="text-zinc-400 text-xs mt-0.5">{data.sender.phone}</p>
                    )}
                  </div>
                  <div className="text-left sm:text-right shrink-0">
                    <p className="text-4xl sm:text-5xl font-black tracking-tighter text-white/10 mb-3 select-none uppercase">
                      Invoice
                    </p>
                    <p className="text-white font-bold text-base">{data.invoiceNumber}</p>
                    <p className="text-zinc-400 text-xs uppercase tracking-widest mt-1">{data.date}</p>
                  </div>
                </div>
              </div>

              {/* Client bar */}
              <div className="px-8 sm:px-12 py-5 bg-zinc-100 border-b border-zinc-200 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <div>
                  <span className="text-[9px] font-black text-zinc-400 uppercase tracking-[0.2em] block mb-1">Bill To</span>
                  <p className="font-bold text-zinc-900 text-base">{data.client.name || 'Client Name'}</p>
                </div>
                {data.client.email && (
                  <div className="text-left sm:text-right">
                    <span className="text-[9px] font-black text-zinc-400 uppercase tracking-[0.2em] block mb-1">Email</span>
                    <p className="text-sm text-zinc-700">{data.client.email}</p>
                  </div>
                )}
              </div>

              {/* Items table */}
              <div className="px-8 sm:px-12 py-8 bg-white">
                <table className="w-full">
                  <thead>
                    <tr className="border-b-2 border-zinc-900">
                      <th className="pb-3 text-left text-[10px] font-black uppercase tracking-[0.15em] text-zinc-900">Description</th>
                      <th className="pb-3 text-center text-[10px] font-black uppercase tracking-[0.15em] text-zinc-900 w-16">Qty</th>
                      <th className="pb-3 text-right text-[10px] font-black uppercase tracking-[0.15em] text-zinc-900 w-32">Unit Price</th>
                      <th className="pb-3 text-right text-[10px] font-black uppercase tracking-[0.15em] text-zinc-900 w-32">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {data.items.map((item, idx) => (
                      <tr key={idx}>
                        <td className="py-4 text-sm font-semibold text-zinc-900">{item.description}</td>
                        <td className="py-4 text-sm text-center text-zinc-600">{item.quantity}</td>
                        <td className="py-4 text-sm text-right text-zinc-600">{fmt(item.rate, data.currency)}</td>
                        <td className="py-4 text-sm font-bold text-right text-zinc-900">{fmt(item.quantity * item.rate, data.currency)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Totals + signature + notes */}
              <div className="px-8 sm:px-12 py-8 bg-zinc-50 border-t border-zinc-200">
                <div className="flex flex-col md:flex-row justify-end items-start gap-8">
                  <div className="w-full md:w-72 space-y-2.5">
                    <div className="flex justify-between text-sm">
                      <span className="text-zinc-500 font-semibold">Subtotal</span>
                      <span className="font-semibold text-zinc-900">{fmt(subtotal, data.currency)}</span>
                    </div>
                    <div className="flex justify-between text-sm pb-3 border-b border-zinc-200">
                      <span className="text-zinc-500 font-semibold">VAT ({data.taxRate}%)</span>
                      <span className="font-semibold text-zinc-900">{fmt(tax, data.currency)}</span>
                    </div>
                    <div className="flex justify-between items-center pt-1">
                      <span className="text-xs font-black uppercase tracking-widest text-zinc-900">Amount Due</span>
                      <span className="text-3xl sm:text-4xl font-black text-zinc-900 tracking-tighter">
                        {fmt(total, data.currency)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Signature + notes */}
                <div className="mt-10 pt-8 border-t border-zinc-200 flex flex-col sm:flex-row justify-between items-end gap-8">
                  <div className="max-w-xs">
                    <p className="text-[9px] font-black text-zinc-400 uppercase tracking-[0.2em] mb-1">Notes</p>
                    <p className="text-xs text-zinc-500 leading-relaxed italic">{data.notes}</p>
                  </div>
                  <div className="shrink-0 text-right min-w-[180px]">
                    <div className="border-b-2 border-zinc-900 w-48 mb-2 ml-auto" style={{ minHeight: '40px' }} />
                    <p className="text-xs font-bold text-zinc-900">
                      {data.signatory || data.sender.name || 'Authorized Signatory'}
                    </p>
                    <p className="text-[9px] font-black text-zinc-400 uppercase tracking-[0.18em] mt-0.5">
                      Authorized Signature
                    </p>
                  </div>
                </div>

                <div className="mt-8 pt-4 border-t border-zinc-200" />
              </div>

            </div>
          </div>

        </div>
      </div>
    </>
  );
}
