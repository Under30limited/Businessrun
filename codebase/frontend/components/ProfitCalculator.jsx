import React, { useState, useRef } from 'react';

function ProfitCalculator() {
  const [revenue, setRevenue]   = useState('');
  const [expenses, setExpenses] = useState('');
  const [results, setResults]   = useState(null);
  const resultsRef = useRef(null);

  function calculateFinance() {
    const rev   = parseFloat(revenue)  || 0;
    const exp   = parseFloat(expenses) || 0;
    const gross = rev - exp;
    const tax   = gross > 0 ? gross * 0.075 : 0;
    const net   = gross - tax;
    setResults({ gross, tax, net });

    if (window.innerWidth < 768) {
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    }
  }

  return (
    <div id="tools" className="glass-card rounded-2xl md:rounded-3xl p-5 sm:p-6 shadow-sm bg-white">
      <div className="flex items-center justify-between mb-5 md:mb-6">
        <h3 className="font-bold text-lg sm:text-xl text-slate-800">Profit &amp; Tax Hub</h3>
        <i className="fas fa-calculator text-slate-400 text-lg"></i>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
            Monthly Revenue (₦)
          </label>
          <input
            type="number"
            placeholder="e.g. 500000"
            value={revenue}
            onChange={e => setRevenue(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-slate-300 focus:outline-none transition"
          />
        </div>
        <div>
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
            Monthly Expenses (₦)
          </label>
          <input
            type="number"
            placeholder="e.g. 200000"
            value={expenses}
            onChange={e => setExpenses(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-slate-300 focus:outline-none transition"
          />
        </div>

        <button
          onClick={calculateFinance}
          className="w-full bg-slate-800 text-white font-semibold py-3 sm:py-4 rounded-xl hover:bg-slate-900 transition text-sm sm:text-base"
        >
          Run Analysis
        </button>

        {results && (
          <div ref={resultsRef} className="mt-4 pt-4 border-t border-slate-100 space-y-3">
            <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
              <span className="text-xs sm:text-sm font-semibold text-green-700">Gross Profit:</span>
              <span className="font-bold text-green-700 text-sm sm:text-base">₦{results.gross.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center p-3 bg-red-50 rounded-lg">
              <span className="text-xs sm:text-sm font-semibold text-red-700">Est. Tax (7.5%):</span>
              <span className="font-bold text-red-700 text-sm sm:text-base">₦{results.tax.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center p-3 sm:p-4 bg-slate-800 text-white rounded-xl">
              <span className="text-xs sm:text-sm font-semibold uppercase tracking-wide">Net Take Home:</span>
              <span className="text-lg sm:text-xl font-extrabold text-white">₦{results.net.toLocaleString()}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default ProfitCalculator;
