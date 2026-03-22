import React, { useState, useEffect } from 'react';

export default function AnnouncementPopup({ onGoToApp }) {
  const [visible,   setVisible]   = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), 10000);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (visible && !dismissed) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [visible, dismissed]);

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') dismiss(); }
    if (visible && !dismissed) document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [visible, dismissed]);

  function dismiss() { setDismissed(true); document.body.style.overflow = ''; }
  function handleGoToApp() { dismiss(); onGoToApp(); }

  if (!visible || dismissed) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }} onClick={dismiss}>
      <div className="bg-zinc-950 border border-zinc-800 rounded-2xl sm:rounded-3xl w-full max-w-md relative shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="bg-zinc-900 border-b border-zinc-800 px-6 py-4 sm:py-5">
          <div className="flex items-center justify-between">
            <span className="text-amber-500 text-[10px] font-black uppercase tracking-widest">Now Open</span>
            <button onClick={dismiss} className="w-7 h-7 flex items-center justify-center rounded-full bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-white transition text-lg font-light leading-none" aria-label="Close">×</button>
          </div>
          <h2 className="text-white font-black text-lg sm:text-xl mt-2 leading-snug italic uppercase">
            Under30Women in Business<br />Mentorship 2026
          </h2>
        </div>
        {/* Body */}
        <div className="px-6 py-5 sm:py-6">
          <p className="text-zinc-400 text-sm sm:text-base leading-relaxed mb-5">
            Applications are now open for the <strong className="text-zinc-200">2026 Under30Women in Business Mentorship Cohort</strong>. We are looking for exceptional female founders across Africa ready to build scalable, self-reliant enterprises.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <button onClick={handleGoToApp} className="flex-1 bg-amber-500 text-black py-3 px-4 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-amber-400 transition flex items-center justify-center gap-2">
              Apply Now <i className="fas fa-arrow-right text-xs"></i>
            </button>
            <button onClick={dismiss} className="flex-1 bg-zinc-800 text-zinc-400 py-3 px-4 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-zinc-700 hover:text-zinc-200 transition">
              Maybe Later
            </button>
          </div>
          <p className="text-xs text-zinc-600 text-center mt-4">Applications close 22nd April 2026</p>
        </div>
      </div>
    </div>
  );
}
