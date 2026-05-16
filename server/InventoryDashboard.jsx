/**
 * InventoryDashboard.jsx
 *
 * Inventory management tab for the user dashboard.
 *
 * Features:
 *   - Items loaded silently on mount from /api/inventory
 *   - Add item modal with image upload (multipart/form-data)
 *   - Inline quantity edit (PATCH)
 *   - Delete item + Storage image (DELETE)
 *   - Low stock warning at ≤ 5 units
 *   - Empty state with clear call to action
 *
 * Props:
 *   items        {Object[]}  — current items array (from parent state)
 *   setItems     {Function}  — parent state setter
 */

import React, { useState, useRef } from 'react';
import {
  Plus, Trash2, Loader2, AlertCircle,
  Package, ImageOff, Edit3, Check, X,
} from 'lucide-react';

const inputClass = 'w-full bg-black border border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-[#C5A028] transition-colors';
const BRAND = '#C5A028';

// ── Low stock threshold ───────────────────────────────────────────
const LOW_STOCK = 5;

// ── Empty form shape ──────────────────────────────────────────────
const emptyForm = () => ({
  name:       '',
  category:   '',
  unit_price: '',
  quantity:   '',
  imageFile:  null,   // File object from input
  imagePreview: null, // Object URL for preview
});

export default function InventoryDashboard({ items, setItems }) {
  const [showModal,  setShowModal]  = useState(false);
  const [form,       setForm]       = useState(emptyForm());
  const [isSaving,   setIsSaving]   = useState(false);
  const [formError,  setFormError]  = useState('');
  const [deleteId,   setDeleteId]   = useState(null); // id currently being deleted
  const [editId,     setEditId]     = useState(null); // id currently being inline-edited
  const [editQty,    setEditQty]    = useState('');
  const [editPrice,  setEditPrice]  = useState('');  // inline price edit
  const fileRef = useRef(null);

  // ── Open / close modal ────────────────────────────────────────
  function openModal()  { setForm(emptyForm()); setFormError(''); setShowModal(true); }
  function closeModal() {
    if (form.imagePreview) URL.revokeObjectURL(form.imagePreview);
    setForm(emptyForm());
    setFormError('');
    setShowModal(false);
  }

  // ── Image selection ───────────────────────────────────────────
  function handleImageChange(e) {
    const file = e.target.files[0];
    if (!file) return;

    // Check size client-side first — gives instant feedback without a network round trip.
    // The server enforces the same 5MB limit as a safety net.
    const MAX_BYTES = 5 * 1024 * 1024; // 5MB
    if (file.size > MAX_BYTES) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(1);
      setFormError('Image is too large (' + sizeMB + 'MB). Maximum allowed size is 5MB. Please compress or resize the image before uploading.');
      // Clear the file input so the user can select a different file
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
    if (!form.name.trim())                                          { setFormError('Item name is required.');       return; }
    if (!form.unit_price || isNaN(+form.unit_price) || +form.unit_price < 0)
                                                                    { setFormError('Enter a valid price.');          return; }
    if (!form.quantity   || isNaN(+form.quantity)   || +form.quantity < 0)
                                                                    { setFormError('Enter a valid quantity.');       return; }

    setFormError('');
    setIsSaving(true);

    try {
      // Build FormData — multipart so image travels with text fields
      const fd = new FormData();
      fd.append('name',       form.name.trim());
      fd.append('category',   form.category.trim());
      fd.append('unit_price', form.unit_price);
      fd.append('quantity',   form.quantity);
      if (form.imageFile) fd.append('image', form.imageFile);

      const res  = await fetch('/api/inventory', {
        method:      'POST',
        credentials: 'include',
        // Do NOT set Content-Type manually — browser sets it with the boundary
        body: fd,
      });

      // Parse the JSON response — if this throws, the server returned
      // something unexpected (e.g. an HTML error page from Nginx)
      let data;
      try {
        data = await res.json();
      } catch {
        setFormError("We couldn't complete your request right now. Please try again in a moment.");
        return;
      }

      // 413 means the image exceeded the server-side 5MB limit.
      // Show the server's message directly — it's already user-friendly.
      if (res.status === 413) {
        setFormError(data.message || 'Image is too large. Maximum size is 5MB.');
        return;
      }

      if (!res.ok || !data.success) {
        // All known errors (413, auth, validation) are handled above.
        // For anything else, show a pleasant fallback — never expose
        // raw server messages or technical details to the user.
        setFormError("Something went wrong on our end. Your item wasn't saved — please try again.");
        return;
      }

      // Prepend new item so it appears at the top
      setItems(prev => [data.item, ...prev]);
      closeModal();
    } catch {
      // fetch() itself threw — likely a network failure (offline, timeout, DNS).
      setFormError("We couldn't reach the server. Please check your connection and try again.");
    }
    finally  { setIsSaving(false); }
  }

  // ── Delete item ───────────────────────────────────────────────
  async function handleDelete(item) {
    setDeleteId(item.id);
    try {
      const params = item.image_ext ? `?image_ext=${item.image_ext}` : '';
      const res = await fetch('/api/inventory/' + item.id + params, {
        method:      'DELETE',
        credentials: 'include',
      });
      if (!res.ok) return;
      setItems(prev => prev.filter(i => i.id !== item.id));
    } catch { /* silent — item stays in list */ }
    finally { setDeleteId(null); }
  }

  // ── Inline quantity edit ──────────────────────────────────────
  function startEdit(item) {
    setEditId(item.id);
    setEditQty(String(item.quantity));
    setEditPrice(String(item.unit_price));
  }

  function cancelEdit() {
    setEditId(null);
    setEditQty('');
    setEditPrice('');
  }

  async function saveEdit(item) {
    const qty   = parseInt(editQty, 10);
    const price = parseFloat(editPrice);

    // Silently cancel if either value is invalid
    if (isNaN(qty)   || qty   < 0) { cancelEdit(); return; }
    if (isNaN(price) || price < 0) { cancelEdit(); return; }

    // Only send fields that actually changed
    const updates = {};
    if (qty   !== item.quantity)   updates.quantity   = qty;
    if (price !== item.unit_price) updates.unit_price = price;

    // Nothing changed — just close
    if (Object.keys(updates).length === 0) { cancelEdit(); return; }

    try {
      const res = await fetch('/api/inventory/' + item.id, {
        method:      'PATCH',
        credentials: 'include',
        headers:     { 'Content-Type': 'application/json' },
        body:        JSON.stringify(updates),
      });
      if (!res.ok) { cancelEdit(); return; }
      // Update local state with changed fields only
      setItems(prev => prev.map(i =>
        i.id === item.id ? { ...i, ...updates } : i
      ));
    } catch { /* silent */ }
    finally { cancelEdit(); }
  }

  // ── Stats bar ─────────────────────────────────────────────────
  const totalValue  = items.reduce((s, i) => s + (i.unit_price * i.quantity), 0);
  const lowStockCnt = items.filter(i => i.quantity <= LOW_STOCK).length;

  return (
    <div className="space-y-8 pb-20">

      {/* Header */}
      <div className="border-b border-zinc-900 -mx-5 px-5 pb-8">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl md:text-4xl font-black tracking-tighter italic uppercase mb-2">
              Your Inventory <span style={{ color: BRAND }}>Build.</span>
            </h1>
            <p className="text-zinc-500 text-sm">
              Track stock, pricing and product assets. All changes saved to your account.
            </p>
          </div>
          <button onClick={openModal}
            className="flex items-center gap-2 px-6 py-3 font-black text-xs uppercase tracking-widest rounded-xl text-black hover:opacity-90 transition-all"
            style={{ backgroundColor: BRAND }}>
            <Plus size={14} /> Grow Inventory
          </button>
        </div>

        {/* Stats bar — only shown when items exist */}
        {items.length > 0 && (
          <div className="flex flex-wrap gap-4 mt-6">
            <div className="bg-zinc-950 border border-zinc-800 rounded-xl px-5 py-3 flex items-center gap-3">
              <Package size={14} className="text-zinc-500" />
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-zinc-600">Total SKUs</p>
                <p className="text-lg font-black text-white">{items.length}</p>
              </div>
            </div>
            <div className="bg-zinc-950 border border-zinc-800 rounded-xl px-5 py-3 flex items-center gap-3">
              <span style={{ color: BRAND }} className="font-black text-sm">₦</span>
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-zinc-600">Inventory Value</p>
                <p className="text-lg font-black text-white">₦{totalValue.toLocaleString()}</p>
              </div>
            </div>
            {lowStockCnt > 0 && (
              <div className="bg-red-500/5 border border-red-500/20 rounded-xl px-5 py-3 flex items-center gap-3">
                <AlertCircle size={14} className="text-red-400" />
                <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-red-500/70">Low Stock</p>
                  <p className="text-lg font-black text-red-400">{lowStockCnt} item{lowStockCnt > 1 ? 's' : ''}</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Empty state */}
      {items.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-20 h-20 rounded-2xl bg-zinc-950 border border-zinc-800 flex items-center justify-center mb-6">
            <Package size={32} className="text-zinc-700" />
          </div>
          <h2 className="text-xl font-black uppercase tracking-tighter mb-2">No Inventory Yet</h2>
          <p className="text-zinc-600 text-sm max-w-xs mb-8 leading-relaxed">
            Add your first product to start tracking stock, pricing and visual assets.
          </p>
          <button onClick={openModal}
            className="flex items-center gap-2 px-8 py-4 font-black text-xs uppercase tracking-widest rounded-xl text-black"
            style={{ backgroundColor: BRAND }}>
            <Plus size={14} /> Add First Item
          </button>
        </div>
      )}

      {/* Item grid */}
      {items.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {items.map(item => (
            <div key={item.id}
              className={`bg-[#141414] border rounded-2xl overflow-hidden transition-all ${
                item.quantity <= LOW_STOCK ? 'border-red-500/40' : 'border-zinc-800 hover:border-zinc-700'
              }`}>

              {/* Product image */}
              {item.image_url ? (
                <div className="relative w-full h-44 overflow-hidden">
                  <img src={item.image_url} alt={item.name}
                    className="w-full h-full object-cover" />
                  {item.quantity <= LOW_STOCK && (
                    <div className="absolute top-2 left-2 bg-red-500 text-white text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-lg">
                      Low Stock
                    </div>
                  )}
                </div>
              ) : (
                <div className="w-full h-44 bg-zinc-900 flex flex-col items-center justify-center gap-2 relative">
                  <ImageOff size={24} className="text-zinc-700" />
                  <p className="text-zinc-700 text-[10px] font-black uppercase tracking-widest">No Image</p>
                  {item.quantity <= LOW_STOCK && (
                    <div className="absolute top-2 left-2 bg-red-500 text-white text-[9px] font-black uppercase tracking-widest px-2 py-1 rounded-lg">
                      Low Stock
                    </div>
                  )}
                </div>
              )}

              {/* Card body */}
              <div className="p-4 space-y-3">
                <div>
                  <h3 className="font-black text-white text-sm leading-tight">{item.name}</h3>
                  {item.category && (
                    <p className="text-[10px] font-black uppercase tracking-widest text-zinc-600 mt-0.5">
                      {item.category}
                    </p>
                  )}
                </div>

                {/* Price + Quantity — both inline editable */}
                {editId === item.id ? (
                  // Edit mode — two inputs side by side + save/cancel
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <p className="text-[9px] font-black uppercase tracking-widest text-zinc-600 mb-1">Price (₦)</p>
                        <input type="number" value={editPrice}
                          onChange={e => setEditPrice(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') saveEdit(item); if (e.key === 'Escape') cancelEdit(); }}
                          className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-1.5 text-xs text-white text-center focus:outline-none focus:border-[#C5A028]"
                          autoFocus />
                      </div>
                      <div className="flex-1">
                        <p className="text-[9px] font-black uppercase tracking-widest text-zinc-600 mb-1">Stock</p>
                        <input type="number" value={editQty}
                          onChange={e => setEditQty(e.target.value)}
                          onKeyDown={e => { if (e.key === 'Enter') saveEdit(item); if (e.key === 'Escape') cancelEdit(); }}
                          className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-2 py-1.5 text-xs text-white text-center focus:outline-none focus:border-[#C5A028]" />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => saveEdit(item)}
                        className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-green-500/10 border border-green-500/30 text-green-400 hover:bg-green-500/20 rounded-lg text-[10px] font-black transition">
                        <Check size={11} /> Save
                      </button>
                      <button onClick={cancelEdit}
                        className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-zinc-900 border border-zinc-800 text-zinc-500 hover:text-zinc-300 rounded-lg text-[10px] font-black transition">
                        <X size={11} /> Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  // Display mode — click either value to enter edit mode
                  <div className="flex items-center justify-between">
                    <button onClick={() => startEdit(item)}
                      className="text-lg font-black text-white hover:text-[#C5A028] transition flex items-center gap-1.5 group"
                      title="Click to edit price">
                      ₦{Number(item.unit_price).toLocaleString()}
                      <Edit3 size={10} className="text-zinc-700 group-hover:text-[#C5A028] transition" />
                    </button>
                    <button onClick={() => startEdit(item)}
                      className={`flex items-center gap-1.5 text-[10px] font-black px-2 py-1 rounded-lg border transition-all ${
                        item.quantity <= LOW_STOCK
                          ? 'border-red-500/50 text-red-400 hover:bg-red-500/10'
                          : 'border-zinc-700 text-zinc-400 hover:border-zinc-600 hover:text-white'
                      }`}
                      title="Click to edit stock">
                      <Edit3 size={10} />
                      {item.quantity} in stock
                    </button>
                  </div>
                )}

                {/* Delete */}
                <button onClick={() => handleDelete(item)} disabled={deleteId === item.id}
                  className="w-full flex items-center justify-center gap-1.5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest text-zinc-700 hover:text-red-400 hover:bg-red-500/5 border border-transparent hover:border-red-500/10 transition-all disabled:opacity-40">
                  {deleteId === item.id
                    ? <><Loader2 size={11} className="animate-spin" /> Removing...</>
                    : <><Trash2 size={11} /> Remove Item</>}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Item Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-[#111111] border border-zinc-800 rounded-2xl w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-8 py-6 border-b border-zinc-900">
              <h2 className="text-xl font-black uppercase tracking-tighter">Add New Asset</h2>
              <button onClick={closeModal} className="text-zinc-600 hover:text-white transition">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddItem} className="px-8 py-6 space-y-4">

              {/* Image upload */}
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">
                  Product Image <span className="text-zinc-700 normal-case font-normal">(optional · max 5MB)</span>
                </p>
                {form.imagePreview ? (
                  <div className="relative w-full h-48 rounded-xl overflow-hidden mb-2">
                    <img src={form.imagePreview} alt="preview" className="w-full h-full object-cover" />
                    <button type="button"
                      onClick={() => { URL.revokeObjectURL(form.imagePreview); setForm(p => ({ ...p, imageFile: null, imagePreview: null })); if (fileRef.current) fileRef.current.value = ''; }}
                      className="absolute top-2 right-2 w-7 h-7 bg-black/70 rounded-full flex items-center justify-center text-white hover:bg-black transition">
                      <X size={13} />
                    </button>
                  </div>
                ) : (
                  <div onClick={() => fileRef.current?.click()}
                    className="w-full h-32 border-2 border-dashed border-zinc-800 hover:border-[#C5A028] rounded-xl flex flex-col items-center justify-center gap-2 cursor-pointer transition-colors">
                    <Plus size={20} className="text-zinc-600" />
                    <p className="text-zinc-600 text-xs">Click to upload image</p>
                  </div>
                )}
                <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp"
                  onChange={handleImageChange} className="hidden" />
              </div>

              {/* Text fields */}
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
                  <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">Price (₦) *</label>
                  <input type="number" placeholder="e.g. 25000" value={form.unit_price}
                    onChange={e => setForm(p => ({ ...p, unit_price: e.target.value }))} className={inputClass} />
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">Quantity *</label>
                  <input type="number" placeholder="e.g. 50" value={form.quantity}
                    onChange={e => setForm(p => ({ ...p, quantity: e.target.value }))} className={inputClass} />
                </div>
              </div>

              {formError && (
                <div className="flex items-center gap-2 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl">
                  <AlertCircle size={13} className="text-red-400 shrink-0" />
                  <p className="text-red-400 text-xs">{formError}</p>
                </div>
              )}

              <div className="flex gap-4 pt-2">
                <button type="button" onClick={closeModal}
                  className="flex-1 py-3 text-zinc-500 hover:text-white font-black text-xs uppercase tracking-widest transition">
                  Cancel
                </button>
                <button type="submit" disabled={isSaving}
                  className="flex-1 py-3 font-black text-xs uppercase tracking-widest rounded-xl text-black disabled:opacity-50 transition flex items-center justify-center gap-2"
                  style={{ backgroundColor: BRAND }}>
                  {isSaving
                    ? <><Loader2 size={14} className="animate-spin" /> Saving...</>
                    : 'Secure Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
