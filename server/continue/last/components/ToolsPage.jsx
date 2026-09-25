import React, { useState, useRef } from 'react';
import { ArrowLeft, Calculator } from 'lucide-react';

export default function ToolsPage({ onBack }) {
  const [revenue,  setRevenue]  = useState('');
  const [expenses, setExpenses] = useState('');
  const [results,  setResults]  = useState(null);
  const resultsRef = useRef(null);

  function calculateFinance() {
    const rev   = parseFloat(revenue)  || 0;
    const exp   = parseFloat(expenses) || 0;
    const gross = rev - exp;
    const tax   = gross > 0 ? gross * 0.075 : 0;
    const net   = gross - tax;
    setResults({ gross, tax, net });
    setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 80);
  }

  function reset() { setRevenue(''); setExpenses(''); setResults(null); }

  return (
    <div className="min-h-screen bg-black text-zinc-100">
      {/* Header */}
      <div className="border-b border-zinc-900 bg-zinc-950">
        <div className="max-w-3xl mx-auto px-6 py-8">
          <button onClick={onBack} className="flex items-center gap-2 text-zinc-500 hover:text-amber-500 transition-colors mb-6 text-xs font-black uppercase tracking-widest group">
            <ArrowLeft size={13} className="group-hover:-translate-x-1 transition-transform" /> Back to Home
          </button>
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <h1 className="text-4xl md:text-5xl font-black tracking-tighter italic uppercase mb-2">Tools</h1>
              <p className="text-zinc-500 text-sm leading-relaxed">Financial calculators and analysis tools for African founders.</p>
            </div>
            <span className="text-[9px] font-black uppercase tracking-widest text-amber-500 bg-amber-500/10 px-4 py-2 rounded-full border border-amber-500/20 self-start mt-1">Free</span>
          </div>
        </div>
      </div>

      {/* Calculator */}
      <div className="max-w-3xl mx-auto px-6 py-10">
        <div className="bg-zinc-950 border border-zinc-900 rounded-[2rem] overflow-hidden">
          {/* Panel header */}
          <div className="border-b border-zinc-900 px-8 py-6 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-black italic uppercase">Profit &amp; Tax Hub</h2>
              <p className="text-zinc-500 text-xs mt-1">Nigerian SME tax rate (7.5%) applied automatically</p>
            </div>
            <div className="w-12 h-12 bg-amber-500/10 rounded-xl flex items-center justify-center text-amber-500 border border-amber-500/20">
              <Calculator size={22} />
            </div>
          </div>

          {/* Body */}
          <div className="p-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-3">Monthly Revenue (&#8358;)</label>
                <input type="number" placeholder="e.g. 500,000" value={revenue} onChange={e => setRevenue(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-5 py-4 text-sm text-zinc-100 placeholder:text-zinc-700 focus:outline-none focus:border-amber-500 transition-colors" />
              </div>
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-3">Monthly Expenses (&#8358;)</label>
                <input type="number" placeholder="e.g. 200,000" value={expenses} onChange={e => setExpenses(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-5 py-4 text-sm text-zinc-100 placeholder:text-zinc-700 focus:outline-none focus:border-amber-500 transition-colors" />
              </div>
            </div>

            <div className="flex gap-3 mb-8">
              <button onClick={calculateFinance} className="flex-1 bg-amber-500 text-black font-black py-4 rounded-xl hover:bg-amber-400 transition-all active:scale-95 text-xs uppercase tracking-widest">Run Analysis</button>
              {results && <button onClick={reset} className="px-6 bg-zinc-800 text-zinc-400 font-black py-4 rounded-xl hover:bg-zinc-700 hover:text-white transition-all text-xs uppercase tracking-widest">Reset</button>}
            </div>

            {results && (
              <div ref={resultsRef} className="space-y-3 border-t border-zinc-800 pt-8">
                <p className="text-[9px] font-black uppercase tracking-widest text-zinc-600 mb-4">Analysis Results</p>

                <div className="flex justify-between items-center p-4 bg-green-500/5 border border-green-500/20 rounded-xl">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-green-500/70 mb-0.5">Gross Profit</p>
                    <p className="text-xs text-zinc-500">Revenue minus expenses</p>
                  </div>
                  <span className="font-black text-green-400 text-xl">&#8358;{results.gross.toLocaleString()}</span>
                </div>

                <div className="flex justify-between items-center p-4 bg-red-500/5 border border-red-500/20 rounded-xl">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-red-400/70 mb-0.5">Est. Tax (7.5%)</p>
                    <p className="text-xs text-zinc-500">Nigerian SME VAT rate</p>
                  </div>
                  <span className="font-black text-red-400 text-xl">&#8358;{results.tax.toLocaleString()}</span>
                </div>

                <div className="flex justify-between items-center p-5 bg-amber-500 rounded-xl">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-widest text-black/60 mb-0.5">Net Take Home</p>
                    <p className="text-xs text-black/60">After tax deduction</p>
                  </div>
                  <span className="font-black text-black text-2xl">&#8358;{results.net.toLocaleString()}</span>
                </div>

                {parseFloat(revenue) > 0 && (
                  <div className="mt-2 p-5 bg-zinc-900 border border-zinc-800 rounded-xl">
                    <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-4">Quick Insights</p>
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <p className="text-xl font-black text-amber-400">{((results.gross / parseFloat(revenue)) * 100).toFixed(1)}%</p>
                        <p className="text-[9px] text-zinc-600 uppercase font-bold mt-1">Gross Margin</p>
                      </div>
                      <div>
                        <p className="text-xl font-black text-amber-400">{((results.net / parseFloat(revenue)) * 100).toFixed(1)}%</p>
                        <p className="text-[9px] text-zinc-600 uppercase font-bold mt-1">Net Margin</p>
                      </div>
                      <div>
                        <p className="text-xl font-black text-amber-400">&#8358;{(results.net * 12).toLocaleString()}</p>
                        <p className="text-[9px] text-zinc-600 uppercase font-bold mt-1">Annual Net</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
