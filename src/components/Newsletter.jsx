import React from 'react';

function Newsletter({ onSubscribeClick }) {
  return (
    <div className="bg-slate-900 rounded-2xl md:rounded-3xl p-6 sm:p-8 text-white relative overflow-hidden">
      <div className="relative z-10">
        <h3 className="text-lg sm:text-xl font-bold mb-2">Get the Intel.</h3>
        <p className="text-slate-400 text-sm mb-6">
          Join 5,000+ founders receiving weekly business insights.
        </p>
        {/* Input removed — "Join the Run" opens the subscribe modal */}
        <button
          onClick={onSubscribeClick}
          className="w-full bg-white/10 border border-white/20 text-white py-3 rounded-xl font-semibold text-sm hover:bg-white/20 transition flex items-center justify-center gap-2"
        >
          <i className="fas fa-envelope text-xs"></i>
          Join the Run
        </button>
      </div>
      <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-white/5 rounded-full blur-2xl"></div>
    </div>
  );
}

export default Newsletter;
