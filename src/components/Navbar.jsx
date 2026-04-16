import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import LivePriceDropdown, { MARKET_DATA, MobilePriceSection } from './LivePriceDropdown';

function Navbar({ onUnder30WomenClick, onTop30Click, onLogoClick, onSubscribeClick, onResourcesClick, onMagazineClick, onToolsClick, onAccountingClick }) {
  const [under30Open, setUnder30Open]         = useState(false);
  const [toolsOpen,   setToolsOpen]           = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen]   = useState(false);
  const [mobilePriceOpen, setMobilePriceOpen] = useState(false);
  const [mobileToolsOpen, setMobileToolsOpen] = useState(false);
  const dropdownRef = useRef(null);
  const toolsRef    = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setUnder30Open(false);
      if (toolsRef.current    && !toolsRef.current.contains(e.target))    setToolsOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    function handleResize() { if (window.innerWidth >= 768) setMobileMenuOpen(false); }
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  function handleUnder30WomenClick() { setUnder30Open(false); setMobileMenuOpen(false); onUnder30WomenClick(); }
  function handleLogoClick()         { setMobileMenuOpen(false); setUnder30Open(false); onLogoClick(); }
  function handleSubscribeClick()    { setMobileMenuOpen(false); onSubscribeClick(); }

  return (
    <nav className="fixed top-0 w-full z-50 bg-black/90 backdrop-blur-xl border-b border-zinc-900">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">

        {/* Logo */}
        <button onClick={handleLogoClick} className="flex items-center gap-2.5 focus:outline-none group" aria-label="Go to homepage">
          <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center text-black font-black text-sm group-hover:bg-amber-400 transition">B</div>
          <span className="text-xl font-black tracking-tighter italic uppercase text-white group-hover:text-amber-500 transition">BusinessRun</span>
        </button>

        {/* Desktop nav */}
        <div className="hidden md:flex items-center space-x-8 text-[11px] font-black uppercase tracking-widest text-zinc-500">
          {/* Tools dropdown */}
          <div className="relative" ref={toolsRef}>
            <button onClick={() => setToolsOpen(p => !p)} className="flex items-center gap-1 hover:text-amber-500 transition focus:outline-none">
              Our Technology
              <i className={`fas fa-chevron-down text-xs transition-transform duration-200 ${toolsOpen ? 'rotate-180' : ''}`}></i>
            </button>
            {toolsOpen && (
              <div className="absolute top-full left-0 mt-3 w-56 bg-zinc-950 rounded-2xl shadow-2xl border border-zinc-800 py-2 z-50">
                <button onClick={() => { setToolsOpen(false); onToolsClick(); }} className="w-full text-left flex items-center gap-3 px-4 py-3 text-xs text-zinc-400 font-bold uppercase tracking-widest hover:bg-zinc-900 hover:text-amber-500 transition">
                  <span className="w-7 h-7 bg-zinc-800 text-zinc-500 rounded-lg flex items-center justify-center flex-shrink-0"><i className="fas fa-calculator text-xs"></i></span>
                  Profit & Tax Hub
                </button>
                <button onClick={() => { setToolsOpen(false); onAccountingClick(); }} className="w-full text-left flex items-center gap-3 px-4 py-3 text-xs text-zinc-400 font-bold uppercase tracking-widest hover:bg-zinc-900 hover:text-amber-500 transition">
                  <span className="w-7 h-7 bg-zinc-800 text-zinc-500 rounded-lg flex items-center justify-center flex-shrink-0"><i className="fas fa-book text-xs"></i></span>
                  Accounting Tools
                </button>
              </div>
            )}
          </div>
	  <button onClick={onMagazineClick}  className="hover:text-amber-500 transition focus:outline-none">Magazine</button>
          <button onClick={onResourcesClick} className="hover:text-amber-500 transition focus:outline-none">Resources</button>

          {/* Under30 dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button onClick={() => setUnder30Open(p => !p)} className="flex items-center gap-1 hover:text-amber-500 transition focus:outline-none">
              Under30
              <i className={`fas fa-chevron-down text-xs transition-transform duration-200 ${under30Open ? 'rotate-180' : ''}`}></i>
            </button>
            {under30Open && (
              <div className="absolute top-full left-0 mt-3 w-56 bg-zinc-950 rounded-2xl shadow-2xl border border-zinc-800 py-2 z-50">
                <button onClick={handleUnder30WomenClick} className="w-full text-left flex items-center gap-3 px-4 py-3 text-xs text-zinc-400 font-bold uppercase tracking-widest hover:bg-zinc-900 hover:text-amber-500 transition">
                  <span className="w-7 h-7 bg-zinc-800 text-zinc-500 rounded-lg flex items-center justify-center flex-shrink-0"><i className="fas fa-rocket text-xs"></i></span>
                  Under30Women
                </button>
		<button onClick={() => { setUnder30Open(false); onTop30Click(); }} className="w-full text-left flex items-center gap-3 px-4 py-3 text-xs text-zinc-400 font-bold uppercase tracking-widest hover:bg-zinc-900 hover:text-amber-500 transition">
                  <span className="w-7 h-7 bg-zinc-800 text-zinc-500 rounded-lg flex items-center justify-center flex-shrink-0"><i className="fas fa-trophy text-xs"></i></span>
                  Top 30 List
                </button>
              </div>
            )}
          </div>

          {/* Live Price — desktop */}
          <LivePriceDropdown />
        </div>

        {/* Right */}
        <div className="flex items-center gap-3">
          <button onClick={handleSubscribeClick} className="hidden md:block bg-zinc-100 text-black px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-amber-500 transition">
            Grow Your Business
          </button>
          <button onClick={() => setMobileMenuOpen(p => !p)} className="md:hidden flex flex-col justify-center items-center w-10 h-10 rounded-lg hover:bg-zinc-900 transition gap-1.5" aria-label="Toggle menu">
            <span className={`block h-0.5 w-5 bg-zinc-400 transition-all duration-300 ${mobileMenuOpen ? 'rotate-45 translate-y-2' : ''}`}></span>
            <span className={`block h-0.5 w-5 bg-zinc-400 transition-all duration-300 ${mobileMenuOpen ? 'opacity-0' : ''}`}></span>
            <span className={`block h-0.5 w-5 bg-zinc-400 transition-all duration-300 ${mobileMenuOpen ? '-rotate-45 -translate-y-2' : ''}`}></span>
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-zinc-950 border-t border-zinc-900 px-4 py-4 space-y-1 shadow-2xl">
          {/* Tools mobile accordion */}
          <div className="pt-1 border-t border-zinc-900 mt-1">
            <button
              onClick={() => setMobileToolsOpen(p => !p)}
              className="w-full flex items-center justify-between px-4 py-3 rounded-xl text-xs font-black uppercase tracking-widest text-zinc-400 hover:bg-zinc-900 hover:text-amber-500 transition"
            >
              <div className="flex items-center gap-3">
                <i className="fas fa-calculator w-4 text-zinc-600"></i>
                <span>Our Technology</span>
              </div>
              <ChevronDown size={12} className={`transition-transform duration-200 ${mobileToolsOpen ? 'rotate-180' : ''}`} />
            </button>
            {mobileToolsOpen && (
              <div className="mx-2 mb-2 bg-zinc-900 rounded-xl overflow-hidden border border-zinc-800">
                <button onClick={() => { setMobileMenuOpen(false); setMobileToolsOpen(false); onToolsClick(); }} className="w-full flex items-center gap-3 px-4 py-3 text-xs font-black uppercase tracking-widest text-zinc-400 hover:bg-zinc-800 hover:text-amber-500 transition text-left border-b border-zinc-800">
                  <span className="w-6 h-6 bg-zinc-800 text-zinc-500 rounded-lg flex items-center justify-center flex-shrink-0"><i className="fas fa-calculator text-xs"></i></span>
                  Profit & Tax Hub
                </button>
                <button onClick={() => { setMobileMenuOpen(false); setMobileToolsOpen(false); onAccountingClick(); }} className="w-full flex items-center gap-3 px-4 py-3 text-xs font-black uppercase tracking-widest text-zinc-400 hover:bg-zinc-800 hover:text-amber-500 transition text-left">
                  <span className="w-6 h-6 bg-zinc-800 text-zinc-500 rounded-lg flex items-center justify-center flex-shrink-0"><i className="fas fa-book text-xs"></i></span>
                  Accounting Tools
                </button>
              </div>
            )}
          </div>
	  
	  <button onClick={() => { setMobileMenuOpen(false); onMagazineClick(); }} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-black uppercase tracking-widest text-zinc-400 hover:bg-zinc-900 hover:text-amber-500 transition text-left">
            <i className="fas fa-book-open w-4 text-zinc-600"></i> Magazine
          </button>
	 
          <button onClick={() => { setMobileMenuOpen(false); onResourcesClick(); }} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-black uppercase tracking-widest text-zinc-400 hover:bg-zinc-900 hover:text-amber-500 transition text-left">
            <i className="fas fa-book w-4 text-zinc-600"></i> Resources
          </button>

          {/* Under30 mobile */}
          <div className="pt-1 border-t border-zinc-900 mt-1">
            <p className="px-4 py-2 text-[9px] font-black text-zinc-700 uppercase tracking-widest">Under30</p>
            <button onClick={handleUnder30WomenClick} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-black uppercase tracking-widest text-zinc-400 hover:bg-zinc-900 hover:text-amber-500 transition">
              <span className="w-7 h-7 bg-zinc-800 text-zinc-600 rounded-lg flex items-center justify-center flex-shrink-0"><i className="fas fa-rocket text-xs"></i></span>
              Under30Women
            </button>
	    <button onClick={() => { setUnder30Open(false); onTop30Click(); }} className="w-full text-left flex items-center gap-3 px-4 py-3 text-xs text-zinc-400 font-bold uppercase tracking-widest hover:bg-zinc-900 hover:text-amber-500 transition">
                  <span className="w-7 h-7 bg-zinc-800 text-zinc-500 rounded-lg flex items-center justify-center flex-shrink-0"><i className="fas fa-trophy text-xs"></i></span>
                  Top 30 List
             </button>
          </div>

          {/* Live Price — mobile accordion */}
          <div className="pt-1 border-t border-zinc-900 mt-1">
            <button
              onClick={() => setMobilePriceOpen(p => !p)}
              className="w-full flex items-center justify-between px-4 py-3 rounded-xl text-xs font-black uppercase tracking-widest text-zinc-400 hover:bg-zinc-900 hover:text-amber-500 transition"
            >
              <div className="flex items-center gap-3">
                <span className="w-7 h-7 bg-zinc-800 text-zinc-600 rounded-lg flex items-center justify-center flex-shrink-0 text-sm">📊</span>
                <span>Live Price</span>
                <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
              </div>
              <ChevronDown size={12} className={`transition-transform duration-200 ${mobilePriceOpen ? 'rotate-180' : ''}`} />
            </button>

            {mobilePriceOpen && (
              <div className="mx-2 mb-2 bg-zinc-900 rounded-xl overflow-hidden border border-zinc-800">
                {MARKET_DATA.map((section, idx) => (
                  <MobilePriceSection key={idx} section={section} />
                ))}
              </div>
            )}
          </div>

          <div className="pt-2">
            <button onClick={handleSubscribeClick} className="w-full bg-zinc-100 text-black py-3 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-amber-500 transition">
              Grow Your Business
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}

export default Navbar;
