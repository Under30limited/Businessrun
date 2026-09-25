import React from 'react';

function ResourceHub({ onResourceClick, onReceiptClick }) {
  return (
    <div id="resources" className="glass-card rounded-2xl md:rounded-3xl p-5 sm:p-6 shadow-sm">
      <h3 className="font-bold text-base sm:text-lg text-slate-800 mb-4">Startup Resources</h3>
      <div className="space-y-3">

        <button
          onClick={() => onResourceClick('Pitch Deck Template')}
          className="group w-full flex items-center p-3 hover:bg-slate-50 rounded-2xl transition border border-transparent hover:border-slate-100 text-left cursor-pointer"
        >
          <div className="w-10 h-10 bg-orange-50 text-orange-500 rounded-xl flex items-center justify-center mr-4 flex-shrink-0 group-hover:scale-110 transition">
            <i className="fas fa-file-invoice"></i>
          </div>
          <div className="min-w-0">
            <h4 className="text-sm font-bold text-slate-800">Pitch Deck Template</h4>
            <p className="text-xs text-slate-400">Free PDF Download</p>
          </div>
        </button>

        <a
          href="https://wa.me/2348159346026"
          target="_blank"
          rel="noopener noreferrer"
          className="group w-full flex items-center p-3 hover:bg-slate-50 rounded-2xl transition border border-transparent hover:border-slate-100 text-left cursor-pointer"
        >
          <div className="w-10 h-10 bg-purple-50 text-purple-500 rounded-xl flex items-center justify-center mr-4 flex-shrink-0 group-hover:scale-110 transition">
            <i className="fas fa-landmark"></i>
          </div>
          <div className="min-w-0">
            <h4 className="text-sm font-bold text-slate-800">CAC Registration Guide</h4>
            <p className="text-xs text-slate-400">Step-by-step 2024 updated</p>
          </div>
        </a>

        <button
          onClick={onReceiptClick}
          className="group w-full flex items-center p-3 hover:bg-slate-50 rounded-2xl transition border border-transparent hover:border-slate-100 text-left cursor-pointer"
        >
          <div className="w-10 h-10 bg-slate-100 text-slate-600 rounded-xl flex items-center justify-center mr-4 flex-shrink-0 group-hover:scale-110 transition">
            <i className="fas fa-receipt"></i>
          </div>
          <div className="min-w-0">
            <h4 className="text-sm font-bold text-slate-800">Generate Receipt</h4>
            <p className="text-xs text-slate-400">AI-powered · Free · PDF export</p>
          </div>
        </button>

      </div>
    </div>
  );
}

export default ResourceHub;
