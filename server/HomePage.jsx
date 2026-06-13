import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowRight, Bot, User, Send, Sparkles, Loader2, Calculator,
  FileText, Briefcase, Layers, Clock, ArrowUpRight,
  ChevronRight, Trophy, RefreshCcw, Zap, ShoppingCart,
  TrendingUp, Package, AlertCircle, CheckCircle, RotateCcw,
} from 'lucide-react';

// ─────────────────────────────────────────────────────────────────
// DEFAULT DEMO STATE — all state resets to this on page refresh
// since everything is React state, no persistence
// ─────────────────────────────────────────────────────────────────
const DEFAULT_INVENTORY = [
  {
    id: '1',
    name: 'Pack of Designer Shoes',
    category: 'Apparel',
    cost: 12000,
    price: 19500,
    stock: 42,
    threshold: 10,
    image: 'https://images.unsplash.com/photo-1549298916-b41d501d3772?q=80&w=300&auto=format&fit=crop',
  },
  {
    id: '2',
    name: 'Box of Glow Cosmetics',
    category: 'Beauty',
    cost: 4500,
    price: 8500,
    stock: 8,
    threshold: 10,
    image: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?q=80&w=300&auto=format&fit=crop',
  },
  {
    id: '3',
    name: 'Carton of Indomie Noodles',
    category: 'Groceries',
    cost: 5500,
    price: 7200,
    stock: 15,
    threshold: 5,
    image: 'https://images.unsplash.com/photo-1569718212165-3a8278d5f624?q=80&w=300&auto=format&fit=crop',
  },
];

const DEFAULT_SALES = [
  { id: 'tx-101', name: 'Box of Glow Cosmetics',      quantity: 2, amount: 17000, time: '10 Mins Ago', payment: 'Paid'  },
  { id: 'tx-102', name: 'Pack of Designer Shoes',     quantity: 5, amount: 97500, time: '25 Mins Ago', payment: 'Paid'  },
  { id: 'tx-103', name: 'Carton of Indomie Noodles',  quantity: 1, amount:  7200, time: '1 Hour Ago',  payment: 'Credit' },
];

const DEFAULT_AI_MSG = 'TBR Strategic AI active. Record a sale below — I\'ll analyse your numbers and give you a real-time insight.';

// ─────────────────────────────────────────────────────────────────
// LiveDemo — the interactive sandbox panel
// ─────────────────────────────────────────────────────────────────
function LiveDemo() {
  const [inventory,       setInventory]       = useState(DEFAULT_INVENTORY);
  const [salesLog,        setSalesLog]        = useState(DEFAULT_SALES);
  const [selectedId,      setSelectedId]      = useState('1');
  const [qty,             setQty]             = useState(1);
  const [payment,         setPayment]         = useState('Paid');
  const [isRecording,     setIsRecording]     = useState(false);
  const [justRecorded,    setJustRecorded]    = useState(null);
  const [aiMsg,           setAiMsg]           = useState(DEFAULT_AI_MSG);
  const [aiLoading,       setAiLoading]       = useState(false);
  const [aiError,         setAiError]         = useState(false);
  const demoAiBoxRef = useRef(null);

  // Scroll AI box to bottom when message updates
  useEffect(() => {
    if (demoAiBoxRef.current) {
      demoAiBoxRef.current.scrollTop = demoAiBoxRef.current.scrollHeight;
    }
  }, [aiMsg, aiLoading]);

  const selectedItem = inventory.find(i => i.id === selectedId);
  const totalRevenue = salesLog.reduce((s, x) => s + x.amount, 0);
  const totalCost    = salesLog.reduce((s, x) => {
    const item = inventory.find(i => i.name === x.name);
    return s + (item ? item.cost * x.quantity : 0);
  }, 0);
  const grossProfit  = totalRevenue - totalCost;
  const margin       = totalRevenue > 0 ? ((grossProfit / totalRevenue) * 100).toFixed(1) : '0.0';

  async function handleRecordSale(e) {
    e.preventDefault();
    if (!selectedItem || isRecording) return;
    if (selectedItem.stock < qty) {
      setAiMsg(`⚠️ Insufficient stock. Only ${selectedItem.stock} unit${selectedItem.stock === 1 ? '' : 's'} of "${selectedItem.name}" remain.`);
      return;
    }

    setIsRecording(true);
    setAiError(false);

    // Step 1 — Update inventory stock immediately
    const newStock = selectedItem.stock - qty;
    setInventory(prev =>
      prev.map(i => i.id === selectedId ? { ...i, stock: newStock } : i)
    );

    // Step 2 — Add to sales log
    const newSale = {
      id:      `tx-${Date.now()}`,
      name:    selectedItem.name,
      quantity: qty,
      amount:  selectedItem.price * qty,
      time:    'Just Now',
      payment,
    };
    setSalesLog(prev => [newSale, ...prev]);
    setJustRecorded(newSale.id);
    setTimeout(() => setJustRecorded(null), 2500);

    // Step 3 — Fire real AI advisor call
    setAiLoading(true);
    setAiMsg('');

    const isLow       = newStock <= selectedItem.threshold;
    const isOutOfStock = newStock === 0;
    const profitOnSale = ((selectedItem.price - selectedItem.cost) / selectedItem.price * 100).toFixed(1);
    const newRevenue   = totalRevenue + selectedItem.price * qty;
    const newProfit    = grossProfit + (selectedItem.price - selectedItem.cost) * qty;
    const newMargin    = newRevenue > 0 ? ((newProfit / newRevenue) * 100).toFixed(1) : '0.0';

    const prompt = `You are the TBR Strategic AI Advisor for BusinessRun, a Nigerian SME platform. A demo sale was just recorded. Respond in 2-3 concise sentences (no headers, no bullet points) with a sharp business insight.

Sale recorded:
- Product: ${selectedItem.name} (${selectedItem.category})
- Quantity sold: ${qty} unit${qty > 1 ? 's' : ''}
- Revenue from this sale: ₦${(selectedItem.price * qty).toLocaleString()}
- Gross profit margin on this product: ${profitOnSale}%
- Remaining stock: ${newStock} unit${newStock === 1 ? '' : 's'}${isLow ? ` (BELOW THRESHOLD of ${selectedItem.threshold})` : ''}${isOutOfStock ? ' — OUT OF STOCK' : ''}
- Updated total dashboard revenue: ₦${newRevenue.toLocaleString()}
- Updated overall profit margin: ${newMargin}%
- Payment status: ${payment}

${isOutOfStock ? 'CRITICAL: This item is now out of stock.' : isLow ? `WARNING: Stock is critically low (${newStock} left, threshold is ${selectedItem.threshold}).` : ''}
${payment === 'Credit' ? 'NOTE: This was a credit sale — cash not yet received.' : ''}

Give one sharp, Nigeria-specific insight about what just happened and what the business owner should do next.`;

    try {
      const res  = await fetch('/api/advisor', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ message: prompt, history: [] }),
      });
      const data = await res.json();
      if (data.advisorDown || !data.text?.trim()) {
        setAiError(true);
        setAiMsg('AI advisor is currently unavailable. Your sale was recorded successfully.');
      } else {
        setAiMsg(data.text.trim());
      }
    } catch {
      setAiError(true);
      setAiMsg('AI advisor is currently unavailable. Your sale was recorded successfully.');
    } finally {
      setAiLoading(false);
      setIsRecording(false);
    }
  }

  function handleReset() {
    setInventory(DEFAULT_INVENTORY);
    setSalesLog(DEFAULT_SALES);
    setSelectedId('1');
    setQty(1);
    setPayment('Paid');
    setAiMsg(DEFAULT_AI_MSG);
    setAiError(false);
    setAiLoading(false);
    setIsRecording(false);
  }

  return (
    <div className="border border-zinc-800 bg-[#0c0c0e] rounded-3xl overflow-hidden shadow-2xl">

      {/* Window chrome bar */}
      <div className="bg-[#121215] border-b border-zinc-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex gap-2">
            <span className="w-3 h-3 bg-red-500/80 rounded-full" />
            <span className="w-3 h-3 bg-yellow-500/80 rounded-full" />
            <span className="w-3 h-3 bg-green-500/80 rounded-full" />
          </div>
          <span className="font-mono text-[10px] text-zinc-500 uppercase tracking-widest hidden sm:block">
            BusinessRun OS — Interactive Sandbox
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-amber-500 bg-amber-500/10 border border-amber-500/20 px-3 py-1 rounded-full">
            <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse" />
            Live Simulator
          </div>
          <button
            onClick={handleReset}
            title="Reset demo to defaults"
            className="p-1.5 text-zinc-600 hover:text-zinc-400 transition rounded-lg hover:bg-zinc-800"
          >
            <RotateCcw size={13} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-px bg-zinc-900">

        {/* ── LEFT: Sales Terminal ──────────────────────────── */}
        <div className="lg:col-span-4 bg-[#0a0a0c] p-6 space-y-5">
          <div>
            <div className="flex items-center gap-2 text-zinc-400 font-black text-xs uppercase tracking-widest mb-1">
              <ShoppingCart size={14} className="text-amber-500" />
              Instant Sales Terminal
            </div>
            <p className="text-[10px] text-zinc-600 leading-relaxed">
              Record a mock sale — watch inventory, revenue and the AI all update live.
            </p>
          </div>

          <form onSubmit={handleRecordSale} className="space-y-4">
            {/* Product selector */}
            <div>
              <label className="block text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-2">
                Select Item to Sell
              </label>
              <select
                value={selectedId}
                onChange={e => setSelectedId(e.target.value)}
                className="w-full bg-[#121215] border border-zinc-800 text-xs text-zinc-200 p-3 rounded-xl focus:border-amber-500 outline-none transition-all"
              >
                {inventory.map(item => (
                  <option key={item.id} value={item.id}>
                    {item.name} — ₦{item.price.toLocaleString()} · {item.stock} left
                  </option>
                ))}
              </select>
            </div>

            {/* Qty + Payment */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-2">
                  Quantity
                </label>
                <input
                  type="number"
                  min="1"
                  max={selectedItem?.stock || 99}
                  value={qty}
                  onChange={e => setQty(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full bg-[#121215] border border-zinc-800 text-xs text-zinc-200 p-3 rounded-xl focus:border-amber-500 outline-none transition-all"
                />
              </div>
              <div>
                <label className="block text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-2">
                  Settlement
                </label>
                <select
                  value={payment}
                  onChange={e => setPayment(e.target.value)}
                  className="w-full bg-[#121215] border border-zinc-800 text-xs text-zinc-200 p-3 rounded-xl focus:border-amber-500 outline-none transition-all"
                >
                  <option value="Paid">Fully Paid</option>
                  <option value="Credit">Credit / Debt</option>
                </select>
              </div>
            </div>

            {/* Line total preview */}
            {selectedItem && (
              <div className="flex items-center justify-between px-3 py-2.5 bg-[#121215] border border-zinc-800 rounded-xl">
                <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Sale Value</span>
                <span className="text-sm font-black text-amber-500">
                  ₦{(selectedItem.price * qty).toLocaleString()}
                </span>
              </div>
            )}

            <button
              type="submit"
              disabled={isRecording}
              className="w-full bg-amber-500 text-black py-3.5 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-amber-400 transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isRecording
                ? <><Loader2 size={13} className="animate-spin" /> Recording...</>
                : <><ShoppingCart size={13} /> Record Transaction</>}
            </button>
          </form>

          {/* Status row */}
          <div className="space-y-2 pt-2 border-t border-zinc-900">
            <p className="text-[9px] font-black uppercase tracking-widest text-zinc-600 mb-2">System Status</p>
            <div className="flex items-center justify-between bg-[#121215] border border-zinc-900 rounded-xl px-3 py-2">
              <span className="text-[10px] text-zinc-500">Simulated DB Sync</span>
              <span className="text-[9px] text-green-500 font-black bg-green-500/10 px-2 py-0.5 rounded-full flex items-center gap-1">
                <span className="w-1 h-1 bg-green-500 rounded-full" /> Active
              </span>
            </div>
            <div className="flex items-center justify-between bg-[#121215] border border-zinc-900 rounded-xl px-3 py-2">
              <span className="text-[10px] text-zinc-500">AI Advisor</span>
              <span className="text-[9px] text-amber-500 font-black bg-amber-500/10 px-2 py-0.5 rounded-full flex items-center gap-1">
                <span className="w-1 h-1 bg-amber-500 rounded-full animate-pulse" /> Live
              </span>
            </div>
          </div>
        </div>

        {/* ── RIGHT: Dashboard ──────────────────────────────── */}
        <div className="lg:col-span-8 bg-[#0c0c0e] p-6 space-y-6">

          {/* Financial metrics ticker */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-[#121215] border border-zinc-800 rounded-2xl p-4">
              <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-1">Total Revenue</p>
              <p className="text-xl font-black text-white">₦{totalRevenue.toLocaleString()}</p>
              <p className="text-[9px] text-green-400 font-black flex items-center gap-1 mt-1">
                <TrendingUp size={10} /> Live
              </p>
            </div>
            <div className="bg-[#121215] border border-zinc-800 rounded-2xl p-4">
              <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-1">Gross Profit</p>
              <p className="text-xl font-black text-amber-500">₦{grossProfit.toLocaleString()}</p>
              <p className="text-[9px] text-zinc-500 font-black mt-1">Auto-calculated</p>
            </div>
            <div className="bg-[#121215] border border-zinc-800 rounded-2xl p-4">
              <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-1">Profit Margin</p>
              <p className="text-xl font-black text-white">{margin}%</p>
              <p className="text-[9px] text-amber-400 font-black mt-1">Dynamic</p>
            </div>
          </div>

          {/* Inventory cards */}
          <div>
            <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-3 flex items-center justify-between">
              <span>Live Inventory</span>
              <span className="text-zinc-600">Updates on sale</span>
            </p>
            <div className="grid grid-cols-3 gap-3">
              {inventory.map(item => {
                const isLow = item.stock <= item.threshold;
                const stockPct = Math.min(100, Math.round((item.stock / (item.stock + 20)) * 100));
                return (
                  <div
                    key={item.id}
                    className={`bg-[#060608] rounded-2xl overflow-hidden border transition-all ${
                      isLow ? 'border-red-500/40' : 'border-zinc-800'
                    } ${selectedId === item.id ? 'ring-1 ring-amber-500/50' : ''}`}
                  >
                    {isLow && (
                      <div className="flex items-center gap-1 bg-red-500 px-2 py-0.5">
                        <AlertCircle size={8} className="text-white" />
                        <span className="text-[7px] font-black text-white uppercase tracking-widest">Low Stock</span>
                      </div>
                    )}
                    <div className="h-16 overflow-hidden">
                      <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                    </div>
                    <div className="p-2.5">
                      <p className="text-[9px] font-black text-white line-clamp-1 mb-1">{item.name}</p>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[9px] font-black text-amber-500">₦{item.price.toLocaleString()}</span>
                        <span className={`text-[9px] font-black ${isLow ? 'text-red-400' : 'text-zinc-400'}`}>
                          {item.stock} left
                        </span>
                      </div>
                      {/* Stock bar */}
                      <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${isLow ? 'bg-red-500' : 'bg-amber-500'}`}
                          style={{ width: `${stockPct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* AI Insight box */}
          <div className="bg-[#0a0a0c] border border-zinc-800 rounded-2xl overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-900">
              <div className="w-6 h-6 bg-amber-500/10 rounded-lg flex items-center justify-center">
                <Sparkles size={12} className="text-amber-500" />
              </div>
              <span className="text-[9px] font-black uppercase tracking-widest text-zinc-400">
                TBR AI Advisor — Real Response
              </span>
              <span className="ml-auto flex items-center gap-1 text-[9px] font-black text-green-500">
                <span className="w-1 h-1 bg-green-500 rounded-full animate-pulse" />
                Live API
              </span>
            </div>
            <div
              ref={demoAiBoxRef}
              className="px-4 py-4 min-h-[72px] max-h-[120px] overflow-y-auto"
            >
              {aiLoading ? (
                <div className="flex items-center gap-3">
                  <Loader2 size={13} className="text-amber-500 animate-spin shrink-0" />
                  <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                    Analysing your sale...
                  </span>
                </div>
              ) : (
                <p className={`text-[11px] leading-relaxed ${aiError ? 'text-zinc-500' : 'text-zinc-300'}`}>
                  {aiMsg}
                </p>
              )}
            </div>
          </div>

          {/* Sales log */}
          <div>
            <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-3">
              Recent Transactions
            </p>
            <div className="space-y-2 max-h-[180px] overflow-y-auto">
              {salesLog.map(sale => (
                <div
                  key={sale.id}
                  className={`flex items-center justify-between px-4 py-3 rounded-xl border transition-all ${
                    justRecorded === sale.id
                      ? 'bg-amber-500/10 border-amber-500/30'
                      : 'bg-[#060608] border-zinc-900'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {justRecorded === sale.id
                      ? <CheckCircle size={13} className="text-amber-500 shrink-0" />
                      : <Package size={13} className="text-zinc-600 shrink-0" />}
                    <div className="min-w-0">
                      <p className="text-[10px] font-black text-white truncate">{sale.name}</p>
                      <p className="text-[9px] text-zinc-600">{sale.quantity} unit{sale.quantity !== 1 ? 's' : ''} · {sale.time}</p>
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <p className="text-[10px] font-black text-amber-500">₦{sale.amount.toLocaleString()}</p>
                    <span className={`text-[8px] font-black px-1.5 py-0.5 rounded-full ${
                      sale.payment === 'Paid'
                        ? 'bg-green-500/10 text-green-400'
                        : 'bg-red-500/10 text-red-400'
                    }`}>
                      {sale.payment}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// MAIN HOMEPAGE
// ─────────────────────────────────────────────────────────────────
export default function HomePage({
  onMagazineClick, onMagazineStoryClick, onToolsClick, onUnder30Click,
  onTop30Click, onReceiptClick, onSubscribeClick, onResourceClick, onAccountingClick, onMogulAuditClick,
  onGybClick,
}) {
  const words = ['Build.', 'Scale.', 'Create Wealth.'];
  const [wordIndex, setWordIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setWordIndex(i => (i + 1) % words.length), 2500);
    return () => clearInterval(id);
  }, []);

  const stories = [
    {
      id: 19,
      desc: 'Wizkid. Burna. Davido. The collab the world wants and why it may never happen.',
      category: 'Exclusive',
      headline: 'The Big 3 Cold War: The $50M Collab the World Can\'t Have',
      excerpt: 'Wizkid, Burna Boy and Davido are the most powerful trio in African music history. Their refusal to collaborate is costing Afrobeats — and each other — more than anyone will admit.',
      author: 'Sola Afolabi',
      readTime: '10 min',
    },
    {
      id: 42,
      desc: 'How Leo DaSilva scaled a football watch party into a premium community and lifestyle ecosystem.',
      category: 'Sports Business',
      headline: 'The Match Day Legacy: Engineering a Premium Fan Experience',
      excerpt: 'From high-octane viewings to strategic brand partnerships with Budweiser, Leo DaSilva is proving that in Lagos, community standards and lifestyle pivots are the real keys to scaling sports entertainment.',
      author: 'Maxwell Olusegun Njarika',
      readTime: '6 min',
    },
  ];

  // ── AI Advisor (standalone section below the demo) ────────────
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'TBR Strategic AI active. Share your current business progress or expansion plans. How can I help you scale today?' }
  ]);
  const [input,     setInput]     = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const chatBoxRef     = useRef(null);
  const chatInteracted = useRef(false);

  useEffect(() => {
    if (chatInteracted.current && chatBoxRef.current) {
      chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  function scrollToTop()    { if (chatBoxRef.current) chatBoxRef.current.scrollTop = 0; }
  function scrollToBottom() { if (chatBoxRef.current) chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight; }

  const ADVISOR_DOWN_MSG = '__ADVISOR_DOWN__';

  const askAI = async (e) => {
    if (e) e.preventDefault();
    if (!input.trim() || isLoading) return;
    const userMessage = input.trim();
    setInput('');
    chatInteracted.current = true;
    const newMessages = [...messages, { role: 'user', content: userMessage }];
    setMessages(newMessages);
    setIsLoading(true);
    try {
      const history = newMessages.slice(1).slice(0, -1).map(m => ({ role: m.role, content: m.content }));
      const response = await fetch('/api/advisor', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ message: userMessage, history }),
      });
      let data;
      try { data = await response.json(); } catch {
        setMessages(prev => [...prev, { role: 'assistant', content: ADVISOR_DOWN_MSG }]); return;
      }
      if (data.advisorDown || !data.text?.trim()) {
        setMessages(prev => [...prev, { role: 'assistant', content: ADVISOR_DOWN_MSG }]); return;
      }
      setMessages(prev => [...prev, { role: 'assistant', content: data.text }]);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: ADVISOR_DOWN_MSG }]);
    } finally {
      setIsLoading(false);
    }
  };

  function renderMessageContent(text) {
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} className="font-black text-white">{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  }

  return (
    <div className="min-h-screen bg-black text-zinc-100 font-sans selection:bg-amber-500 selection:text-black">

      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="relative pt-20 pb-20 px-6 text-center overflow-hidden">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-5xl md:text-7xl font-black tracking-tighter mb-8">
            <span className="text-zinc-500">The OS for your business</span>
            <div className="h-[1.2em] relative flex justify-center items-center">
              {words.map((word, i) => (
                <span key={word} className={`absolute transition-all duration-700 ease-in-out bg-gradient-to-r from-amber-400 to-amber-600 bg-clip-text text-transparent ${i === wordIndex ? 'translate-y-0 opacity-100 pointer-events-auto' : 'translate-y-8 opacity-0 pointer-events-none'}`}>
                  {word}
                </span>
              ))}
            </div>
          </h1>
          <p className="text-zinc-400 text-lg mb-10 max-w-2xl mx-auto leading-relaxed">
            Take complete control of your enterprise. Track live sales, automate inventory records, manage accounting ledgers, and consult your dedicated AI business strategist — all from a single premium workspace.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <button
              onClick={() => document.getElementById('live-demo')?.scrollIntoView({ behavior: 'smooth' })}
              className="bg-amber-500 text-black px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-xs hover:shadow-[0_0_30px_rgba(245,158,11,0.4)] hover:bg-amber-400 transition-all active:scale-95 flex items-center gap-2"
            >
              <span>▶</span> Access Live Interactive Demo
            </button>
            <button
              onClick={onGybClick}
              className="bg-zinc-900 border border-zinc-800 text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-zinc-800 transition-all active:scale-95"
            >
              Get Started For Free
            </button>
          </div>
        </div>
      </section>

      {/* ── Live Interactive Demo ─────────────────────────────── */}
      <section id="live-demo" className="px-6 pb-4 max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-black tracking-tighter italic uppercase">
              Live Interactive Demo
            </h2>
            <p className="text-zinc-500 text-sm mt-1">
              Record a sale and watch everything update — inventory, revenue, profit margin, and a real AI insight.
              <span className="text-zinc-600"> Resets on page refresh.</span>
            </p>
          </div>
        </div>
        <LiveDemo />
      </section>

      {/* ── AI Advisor ───────────────────────────────────────────────────────── */}
      <section id="ai-advisor" className="px-6 pb-12 pt-8 max-w-7xl mx-auto">
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-[2.5rem] overflow-hidden grid grid-cols-1 lg:grid-cols-2 shadow-2xl">
          <div className="p-10 flex flex-col justify-center">
            <div className="flex items-center gap-3 mb-8">
              <div className="bg-amber-500/10 p-2 rounded-lg"><Sparkles className="text-amber-500" size={20} /></div>
              <div>
                <h2 className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                  Strategic AI Advisor <span className="flex h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                </h2>
                <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-tighter">TBR Intelligence Unit</p>
              </div>
            </div>
            <h2 className="text-4xl font-black mb-6 tracking-tight italic uppercase">Expertise On-Demand.</h2>
            <p className="text-zinc-400 mb-8 leading-relaxed">
              Built for African Founders. Tuned for registration legalities, go-to-market strategies, and fundraising nuances.
            </p>
            <button
              onClick={() => {
                chatInteracted.current = false;
                setMessages([{ role: 'assistant', content: 'Chat history cleared. How can I assist?' }]);
              }}
              className="w-fit p-3 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-zinc-400 hover:text-white transition-all"
              title="Clear chat"
            >
              <RefreshCcw size={18} />
            </button>
          </div>

          <div className="bg-black/40 p-6 flex flex-col h-[550px] border-l border-zinc-800/50">
            {messages.length > 3 && (
              <div className="flex justify-end gap-2 mb-3">
                <button onClick={scrollToTop} className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-zinc-600 hover:text-amber-500 transition-colors px-2 py-1 bg-zinc-900 rounded-lg border border-zinc-800">↑ Top</button>
                <button onClick={scrollToBottom} className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-zinc-600 hover:text-amber-500 transition-colors px-2 py-1 bg-zinc-900 rounded-lg border border-zinc-800">↓ Bottom</button>
              </div>
            )}
            <div ref={chatBoxRef} className="flex-1 overflow-y-auto space-y-6 mb-4 pr-2">
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`flex gap-3 max-w-[85%] ${m.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1 ${m.role === 'user' ? 'bg-amber-500 text-black font-black' : 'bg-zinc-800 text-amber-500 border border-zinc-700'}`}>
                      {m.role === 'user' ? <User size={14} /> : <Bot size={14} />}
                    </div>
                    {m.content === ADVISOR_DOWN_MSG ? (
                      <div className="p-4 rounded-2xl text-[11px] leading-relaxed bg-zinc-900 border border-zinc-700 text-zinc-400 flex items-start gap-3">
                        <span className="text-lg leading-none">🛠️</span>
                        <div>
                          <p className="font-black text-zinc-300 uppercase tracking-widest text-[9px] mb-1">Advisor Unavailable</p>
                          <p>The advisory is currently down. Please check back later.</p>
                        </div>
                      </div>
                    ) : (
                      <div className={`p-4 rounded-2xl text-[11px] leading-relaxed whitespace-pre-wrap ${m.role === 'user' ? 'bg-amber-500 text-black font-bold shadow-lg' : 'bg-zinc-900 border border-zinc-800 text-zinc-300'}`}>
                        {renderMessageContent(m.content)}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex gap-3 items-center bg-zinc-900/50 p-4 rounded-2xl w-fit">
                  <Loader2 size={14} className="text-amber-500 animate-spin" />
                  <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Processing...</span>
                </div>
              )}
            </div>
            <form onSubmit={askAI} className="relative">
              <textarea
                rows="1"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); askAI(null); } }}
                placeholder="Ask about expansion, legal docs..."
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-5 py-4 pr-14 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500 transition-all resize-none shadow-inner"
              />
              <button type="submit" disabled={isLoading || !input.trim()}
                className="absolute right-3 top-1/2 -translate-y-1/2 bg-amber-500 text-black p-2 rounded-lg hover:scale-105 active:scale-95 transition-all disabled:opacity-30">
                <Send size={16} />
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* ── Feature Grid ─────────────────────────────────────── */}
      <section id="workspace" className="px-6 py-12 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">

          <button onClick={onAccountingClick} className="group text-left bg-zinc-900/40 border border-zinc-800 p-8 rounded-[2rem] hover:border-amber-500/40 transition-all flex flex-col justify-between">
            <div>
              <div className="w-14 h-14 bg-amber-500/10 rounded-2xl flex items-center justify-center text-amber-500 mb-6 border border-amber-500/20 group-hover:bg-amber-500 group-hover:text-black transition-all">
                <Calculator size={28} />
              </div>
              <h3 className="text-2xl font-black mb-3 italic uppercase tracking-tight">Accounting Tools</h3>
              <p className="text-zinc-500 text-sm leading-relaxed mb-6">
                AI-powered ledgers, income statements, balance sheets and cash flow reports built for Nigerian SMEs.
              </p>
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2 text-amber-500 group-hover:gap-4 transition-all">
              Open Tools <ArrowRight size={14} />
            </span>
          </button>

          <button onClick={onReceiptClick} className="group text-left bg-zinc-900/40 border border-zinc-800 p-8 rounded-[2rem] hover:border-amber-500/40 transition-all">
            <div className="w-14 h-14 bg-zinc-800 rounded-2xl flex items-center justify-center text-white mb-6 group-hover:bg-zinc-700 transition-all">
              <FileText size={28} />
            </div>
            <h3 className="text-2xl font-black mb-3 italic uppercase">Receipts</h3>
            <p className="text-zinc-500 text-sm leading-relaxed mb-6">
              Generate professional, audit-ready receipts. Manage cash flow with branded documents.
            </p>
            <span className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2 text-white group-hover:gap-4 transition-all">
              Generate <ArrowRight size={14} />
            </span>
          </button>

          <button onClick={() => onResourceClick('Pitch Deck Template')} className="group text-left bg-zinc-900/40 border border-zinc-800 p-8 rounded-[2rem] hover:border-amber-500/40 transition-all flex flex-col justify-between">
            <div>
              <div className="w-14 h-14 bg-zinc-800 rounded-2xl flex items-center justify-center text-white mb-6 group-hover:bg-zinc-700 transition-all">
                <Briefcase size={28} />
              </div>
              <h3 className="text-2xl font-black mb-3 italic uppercase">The Money-Ready Kit</h3>
              <p className="text-zinc-500 text-sm leading-relaxed mb-6">
                Everything you need to show a bank or a partner that your business is serious. We've put together simple forms and plans to help you scale.
              </p>
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2 text-white group-hover:gap-4 transition-all">
              Access Pack <ArrowRight size={14} />
            </span>
          </button>

          <a href="https://wa.me/2347044450636" target="_blank" rel="noopener noreferrer"
            className="group bg-zinc-900/40 border border-zinc-800 p-8 rounded-[2rem] hover:border-amber-500/40 transition-all flex flex-col justify-between block">
            <div>
              <div className="w-14 h-14 bg-amber-500/10 rounded-2xl flex items-center justify-center text-amber-500 mb-6 border border-amber-500/20 group-hover:bg-amber-500 group-hover:text-black transition-all">
                <Layers size={28} />
              </div>
              <h3 className="text-2xl font-black mb-3 italic uppercase tracking-tight">Register your business</h3>
              <p className="text-zinc-500 text-sm leading-relaxed mb-6">
                Tell us your business name, and our agents will handle the rest. We make getting your official certificate simple, fast, and affordable for every business owner.
              </p>
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2 text-amber-500 group-hover:gap-4 transition-all">
              Start Registration <ArrowRight size={14} />
            </span>
          </a>

        </div>
      </section>



      {/* ── Magazine Headlines ───────────────────────────────── */}
      <section id="magazine" className="max-w-7xl mx-auto px-6 py-24 border-t border-zinc-900">
        <div className="flex items-center justify-between mb-16">
          <div className="flex items-center gap-4">
            <h2 className="text-3xl font-black tracking-tighter italic uppercase">Terminal Feed</h2>
            <div className="h-[2px] w-12 bg-amber-500/50" />
          </div>
          <button onClick={onMagazineClick} className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 hover:text-amber-500 flex items-center gap-2 group transition-all">
            Full Archive <ArrowUpRight size={14} className="group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {stories.map(story => (
            <button key={story.id} onClick={() => onMagazineStoryClick(story.id, story.desc)}
              className="group cursor-pointer text-left relative p-8 bg-zinc-950 border border-zinc-900 rounded-[2rem] hover:bg-zinc-900/40 hover:border-zinc-700 transition-all duration-500 w-full">
              <div className="flex items-center gap-3 mb-6">
                <span className="text-[9px] font-black uppercase tracking-widest text-amber-500 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20">{story.category}</span>
                <span className="text-[9px] text-zinc-600 font-black uppercase tracking-widest flex items-center gap-1"><Clock size={10} /> {story.readTime}</span>
              </div>
              <h3 className="text-2xl font-black leading-tight mb-4 group-hover:text-amber-500 transition-colors duration-300">{story.headline}</h3>
              <p className="text-zinc-500 text-sm leading-relaxed mb-8 max-w-lg">{story.excerpt}</p>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-md bg-zinc-800 flex items-center justify-center text-[7px] font-black text-zinc-500">TBR</div>
                  <span className="text-[10px] text-zinc-600 font-bold tracking-tight uppercase">{story.author}</span>
                </div>
                <div className="bg-zinc-800 p-2 rounded-full opacity-0 group-hover:opacity-100 transition-all group-hover:bg-amber-500 group-hover:text-black">
                  <ArrowRight size={16} />
                </div>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* ── Mogul Audit CTA ──────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-6 py-12">
        <div className="relative bg-black border border-zinc-800 rounded-[3rem] overflow-hidden">
          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-10 p-10 md:p-14">
            <div className="max-w-xl">
              <div className="flex items-center gap-2 mb-4">
                <span className="text-[9px] font-black uppercase tracking-[0.3em] text-amber-500 bg-amber-500/10 px-3 py-1.5 rounded-full border border-amber-500/20">Free Audit</span>
                <span className="text-[9px] font-black uppercase tracking-widest text-zinc-600">16 Questions · 4 Pillars</span>
              </div>
              <h2 className="text-4xl md:text-5xl font-black tracking-tighter italic uppercase text-white mb-4 leading-none">
                Are You Really<br />Running a Business<br />
                <span className="text-amber-500">— or Just Busy?</span>
              </h2>
              <p className="text-zinc-400 text-sm leading-relaxed mb-2">
                Most Nigerian founders are working hard but scoring low where it counts — registration, systems, margins, and growth moves. Take the Mogul Audit and find out exactly where you stand.
              </p>
              <p className="text-zinc-600 text-xs uppercase tracking-widest font-black">Get your rank: Nomad → Operator → Scaler → Mogul</p>
            </div>
            <div className="shrink-0 flex flex-col items-center gap-4">
              <div className="grid grid-cols-2 gap-3 mb-2">
                {['Foundation', 'Operations', 'Execution', 'Growth'].map((p, i) => (
                  <div key={p} className="w-24 h-24 rounded-2xl bg-zinc-900 border border-zinc-800 flex flex-col items-center justify-center">
                    <span className="text-xl mb-1">{['🏛️','⚙️','⚔️','📈'][i]}</span>
                    <span className="text-[9px] font-black uppercase tracking-widest text-zinc-600 text-center leading-tight">{p}</span>
                  </div>
                ))}
              </div>
              <button onClick={onMogulAuditClick}
                className="group relative w-full flex items-center justify-center gap-2 px-10 py-4 bg-amber-500 text-black font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-amber-400 transition-all active:scale-95 shadow-lg shadow-amber-500/20">
                <Zap size={15} /> Start the Audit
              </button>
              <p className="text-[10px] text-zinc-700 uppercase tracking-widest">Free · Takes 3 minutes · Get a shareable card</p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Under30 CTA ──────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-6 py-20">
        <div className="bg-gradient-to-r from-zinc-900 to-black border border-zinc-800 p-12 rounded-[3rem] flex flex-col md:flex-row items-center justify-between gap-10">
          <div>
            <div className="flex items-center gap-2 mb-2 text-amber-500">
              <Trophy size={16} />
              <span className="text-[10px] font-black uppercase tracking-widest">2026 Cohort</span>
            </div>
            <h2 className="text-4xl font-black mb-4 italic uppercase">BusinessRun 30</h2>
            <p className="text-zinc-500 max-w-md italic font-medium">The definitive list of founders building the future. Nominations closing soon.</p>
          </div>
          <button onClick={onTop30Click}
            className="whitespace-nowrap bg-white text-black px-10 py-5 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-amber-500 transition-all flex items-center gap-2 shadow-xl active:scale-95">
            Explore List <ChevronRight size={18} />
          </button>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────── */}
      <footer className="bg-zinc-950 border-t border-zinc-900 py-16 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6 mb-8">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center font-black text-black text-sm shadow-[0_0_20px_rgba(245,158,11,0.2)]">B</div>
              <span className="font-black tracking-tighter text-xl uppercase italic">BusinessRun</span>
            </div>
            <div className="flex flex-wrap justify-center gap-6 text-[10px] font-black uppercase tracking-widest text-zinc-500">
              <button onClick={onMagazineClick}  className="hover:text-amber-500 transition-colors">Magazine</button>
              <button onClick={onToolsClick}     className="hover:text-amber-500 transition-colors">Tools</button>
              <button onClick={onUnder30Click}   className="hover:text-amber-500 transition-colors">Under30</button>
              <button onClick={onSubscribeClick} className="hover:text-amber-500 transition-colors">Subscribe</button>
            </div>
          </div>
          <div className="border-t border-zinc-900 pt-6 text-center">
            <p className="text-zinc-700 text-[10px] uppercase tracking-widest font-bold">© 2026 BusinessRun Platform. All Rights Reserved.</p>
          </div>
        </div>
      </footer>

    </div>
  );
}
