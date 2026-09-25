import React, { useEffect } from 'react';
import { X, Building2, Wallet, ArrowRight } from 'lucide-react';

/**
 * SpaceChoiceModal
 * The very first click of "Sign Up" / "Log In" now lands here instead
 * of going straight into the business modal — Personal Wealth OS and
 * the business dashboard are separate products for now (see the build
 * discussion), so the person needs to say which one they want before
 * either wizard opens. Picking one closes this and opens the
 * corresponding modal — see App.jsx's openSpaceChooser/onChoose wiring.
 */
export default function SpaceChoiceModal({ isOpen, onClose, onChooseBusiness, onChoosePersonal }) {
  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <div
        className="bg-zinc-950 border border-zinc-800 w-full sm:rounded-[2rem] max-w-lg shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-zinc-900">
          <div>
            <p className="text-[9px] font-black uppercase tracking-widest text-amber-500">Welcome to BusinessRun</p>
            <h2 className="text-white font-black text-lg uppercase italic tracking-tight mt-0.5">What are you here for?</h2>
          </div>
          <button type="button" onClick={onClose}
            className="w-8 h-8 bg-zinc-800 hover:bg-zinc-700 rounded-full flex items-center justify-center text-zinc-400 hover:text-white transition-all">
            <X size={15} />
          </button>
        </div>

        <div className="px-6 py-6 space-y-3">
          <button
            onClick={onChoosePersonal}
            className="w-full flex items-center gap-4 px-6 py-5 bg-zinc-900 border border-zinc-800 rounded-2xl hover:border-amber-500/50 transition-all group text-left"
          >
            <div className="w-11 h-11 rounded-xl bg-amber-500/10 flex items-center justify-center flex-shrink-0">
              <Wallet size={20} className="text-amber-500" />
            </div>
            <div className="flex-1">
              <p className="font-black text-sm uppercase tracking-tight text-white">Personal Finance</p>
              <p className="text-xs text-zinc-500 mt-0.5">Track your own net worth, spending, assets, and goals</p>
            </div>
            <ArrowRight size={18} className="text-zinc-600 group-hover:text-amber-500 group-hover:translate-x-1 transition-all flex-shrink-0" />
          </button>

          <button
            onClick={onChooseBusiness}
            className="w-full flex items-center gap-4 px-6 py-5 bg-zinc-900 border border-zinc-800 rounded-2xl hover:border-amber-500/50 transition-all group text-left"
          >
            <div className="w-11 h-11 rounded-xl bg-amber-500/10 flex items-center justify-center flex-shrink-0">
              <Building2 size={20} className="text-amber-500" />
            </div>
            <div className="flex-1">
              <p className="font-black text-sm uppercase tracking-tight text-white">Business Finance Management</p>
              <p className="text-xs text-zinc-500 mt-0.5">Inventory, sales, team, and your business's Digital CFO</p>
            </div>
            <ArrowRight size={18} className="text-zinc-600 group-hover:text-amber-500 group-hover:translate-x-1 transition-all flex-shrink-0" />
          </button>

          <p className="text-[11px] text-zinc-600 text-center pt-2">
            These are separate spaces for now — you can have one, the other, or both.
          </p>
        </div>
      </div>
    </div>
  );
}
