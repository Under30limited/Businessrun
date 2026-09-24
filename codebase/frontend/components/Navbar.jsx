import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import LivePriceDropdown, { MARKET_DATA, MobilePriceSection } from './LivePriceDropdown';

// ─────────────────────────────────────────────────────────────
// OurTechnologyDropdown — desktop nested mega-dropdown
// Three category groups, each expands on click to show items.
// A divider + "How It Works" sits below all groups.
// ─────────────────────────────────────────────────────────────
function OurTechnologyDropdown({
  onProfitCalc, onAccounting, onMoneyKit,
  onReceipt, onCAC,
  onAIAdvisor, onFoundersMight,
  onHowItWorks,
}) {
  const [open,        setOpen]        = useState(false);
  const [activeGroup, setActiveGroup] = useState(null);
  const ref = useRef(null);

  useEffect(() => {
    function handleOutside(e) {
      if (ref.current && !ref.current.contains(e.target)) {
        setOpen(false);
        setActiveGroup(null);
      }
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  function closeAll() { setOpen(false); setActiveGroup(null); }

  const GROUPS = [
    {
      id:    'financial',
      label: 'Financial Intelligence',
      icon:  '💰',
      items: [
        { label: 'Digital CFO',      sub: 'AI-powered accounting suite',    action: onAccounting },
        { label: 'Profit & Loss',    sub: 'Margin & tax calculator',        action: onProfitCalc },
        { label: 'Money-Ready Kit',  sub: 'Investor & bank-ready documents', action: onMoneyKit  },
      ],
    },
    {
      id:    'operations',
      label: 'Business Operations',
      icon:  '⚙️',
      items: [
        { label: 'Generate Receipt',       sub: 'Professional PDF receipts',  action: onReceipt },
        { label: 'Register Your Business', sub: 'CAC registration via WhatsApp', action: onCAC },
      ],
    },
    {
      id:    'growth',
      label: 'Growth & Strategy',
      icon:  '📈',
      items: [
        {
          label:     'TBR Strategic AI Advisor',
          sub:       'Your on-demand business strategist',
          action:    onAIAdvisor,
          highlight: true,
        },
        { label: "Founder's Might", sub: 'Business audit — know your rank', action: onFoundersMight },
      ],
    },
  ];

  return (
    <div className="relative" ref={ref}>
      {/* Trigger */}
      <button
        onClick={() => { setOpen(p => !p); if (open) setActiveGroup(null); }}
        className="flex items-center gap-1 hover:text-amber-500 transition focus:outline-none"
      >
        Our Technology
        <ChevronDown
          size={10}
          className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Panel */}
      {open && (
        <div className="absolute top-full left-0 mt-3 w-72 bg-zinc-950 border border-zinc-800 rounded-2xl shadow-2xl z-50 overflow-hidden">

          {GROUPS.map(group => (
            <div key={group.id} className="border-b border-zinc-900 last:border-0">

              {/* Group header */}
              <button
                onClick={() => setActiveGroup(activeGroup === group.id ? null : group.id)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-zinc-900 transition text-left group"
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-base leading-none">{group.icon}</span>
                  <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400 group-hover:text-amber-500 transition">
                    {group.label}
                  </span>
                </div>
                <ChevronRight
                  size={11}
                  className={`text-zinc-700 transition-transform duration-200 ${activeGroup === group.id ? 'rotate-90' : ''}`}
                />
              </button>

              {/* Expanded items */}
              {activeGroup === group.id && (
                <div className="bg-zinc-900/50 border-t border-zinc-900">
                  {group.items.map((item, i) => (
                    <button
                      key={i}
                      onClick={() => { item.action(); closeAll(); }}
                      className={`w-full text-left flex items-start gap-3 px-5 py-3 transition ${
                        item.highlight ? 'hover:bg-amber-500/10' : 'hover:bg-zinc-900'
                      }`}
                    >
                      {item.highlight && (
                        <span className="mt-1 w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse flex-shrink-0" />
                      )}
                      <div className={item.highlight ? '' : 'pl-4'}>
                        <p className={`text-xs font-black uppercase tracking-widest ${
                          item.highlight ? 'text-amber-500' : 'text-zinc-300'
                        }`}>
                          {item.label}
                          {item.highlight && (
                            <span className="ml-2 text-[8px] bg-amber-500 text-black px-1.5 py-0.5 rounded-full font-black">
                              AI
                            </span>
                          )}
                        </p>
                        <p className="text-[10px] text-zinc-600 mt-0.5">{item.sub}</p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}

          {/* Divider + How It Works */}
          <div className="border-t border-zinc-800">
            <button
              onClick={() => { onHowItWorks(); closeAll(); }}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-zinc-900 transition text-left"
            >
              <span className="text-base leading-none">🔬</span>
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                  How It Works
                </p>
                <p className="text-[10px] text-zinc-700 mt-0.5">Our AI & infrastructure explained</p>
              </div>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MobileOurTechnology — two-level accordion inside mobile menu
// ─────────────────────────────────────────────────────────────
function MobileOurTechnology({
  onClose,
  onProfitCalc, onAccounting, onMoneyKit,
  onReceipt, onCAC,
  onAIAdvisor, onFoundersMight,
  onHowItWorks,
}) {
  const [open,        setOpen]        = useState(false);
  const [activeGroup, setActiveGroup] = useState(null);

  function go(action) { onClose(); action(); }

  const GROUPS = [
    {
      id:    'financial',
      label: 'Financial Intelligence',
      icon:  '💰',
      items: [
        { label: 'Digital CFO',      action: onAccounting },
        { label: 'Profit & Loss',    action: onProfitCalc },
        { label: 'Money-Ready Kit',  action: onMoneyKit   },
      ],
    },
    {
      id:    'operations',
      label: 'Business Operations',
      icon:  '⚙️',
      items: [
        { label: 'Generate Receipt',       action: onReceipt },
        { label: 'Register Your Business', action: onCAC     },
      ],
    },
    {
      id:    'growth',
      label: 'Growth & Strategy',
      icon:  '📈',
      items: [
        { label: 'TBR Strategic AI Advisor', action: onAIAdvisor,    highlight: true },
        { label: "Founder's Might",      action: onFoundersMight                 },
      ],
    },
  ];

  return (
    <div className="border-t border-zinc-900 mt-1 pt-1">
      <button
        onClick={() => setOpen(p => !p)}
        className="w-full flex items-center justify-between px-4 py-3 rounded-xl text-xs font-black uppercase tracking-widest text-zinc-400 hover:bg-zinc-900 hover:text-amber-500 transition"
      >
        <div className="flex items-center gap-3">
          <i className="fas fa-microchip w-4 text-zinc-600"></i>
          <span>Our Technology</span>
        </div>
        <ChevronDown size={12} className={`transition-transform duration-200 ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="mx-2 mb-2 bg-zinc-900 rounded-xl overflow-hidden border border-zinc-800">
          {GROUPS.map(group => (
            <div key={group.id} className="border-b border-zinc-800 last:border-0">
              <button
                onClick={() => setActiveGroup(activeGroup === group.id ? null : group.id)}
                className="w-full flex items-center justify-between px-4 py-3 hover:bg-zinc-800/50 transition text-left"
              >
                <div className="flex items-center gap-2">
                  <span className="text-sm">{group.icon}</span>
                  <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">{group.label}</span>
                </div>
                <ChevronRight size={11} className={`text-zinc-600 transition-transform ${activeGroup === group.id ? 'rotate-90' : ''}`} />
              </button>

              {activeGroup === group.id && (
                <div className="pb-1">
                  {group.items.map((item, i) => (
                    <button
                      key={i}
                      onClick={() => go(item.action)}
                      className={`w-full text-left px-6 py-2.5 text-xs font-black uppercase tracking-widest transition ${
                        item.highlight
                          ? 'text-amber-500 hover:bg-amber-500/10'
                          : 'text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300'
                      }`}
                    >
                      {item.label}
                      {item.highlight && (
                        <span className="ml-2 text-[8px] bg-amber-500 text-black px-1.5 py-0.5 rounded-full">AI</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}

          {/* How It Works */}
          <div className="border-t border-zinc-800">
            <button
              onClick={() => go(onHowItWorks)}
              className="w-full text-left px-4 py-3 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300 transition"
            >
              <span>🔬</span> How It Works
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Navbar
// ─────────────────────────────────────────────────────────────
function Navbar({
  onLogoClick, onMagazineClick, onResourcesClick,
  onUnder30WomenClick, onTop30Click, onSubscribeClick, onGybClick,
  // Our Technology actions
  onProfitCalc, onAccounting, onMoneyKit,
  onReceipt, onCAC, onAIAdvisor, onFoundersMight, onHowItWorks,
}) {
  const [under30Open,     setUnder30Open]     = useState(false);
  const [mobileMenuOpen,  setMobileMenuOpen]  = useState(false);
  const [mobilePriceOpen, setMobilePriceOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setUnder30Open(false);
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


          {/* Our Technology — replaces Tools */}
          <OurTechnologyDropdown
            onProfitCalc={onProfitCalc}
            onAccounting={onAccounting}
            onMoneyKit={onMoneyKit}
            onReceipt={onReceipt}
            onCAC={onCAC}
            onAIAdvisor={onAIAdvisor}
            onFoundersMight={onFoundersMight}
            onHowItWorks={onHowItWorks}
          />

	  <button onClick={onMagazineClick} className="hover:text-amber-500 transition focus:outline-none">Magazine</button>

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

          {/* Live Price */}
          <LivePriceDropdown />
        </div>

        {/* Right — Launch Client Portal CTA */}
        <div className="flex items-center gap-3">
          <button
            onClick={onGybClick}
            className="hidden md:block bg-amber-500 text-black px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-widest hover:bg-amber-400 transition"
          >
            Launch Client Portal
          </button>
          <button
            onClick={() => setMobileMenuOpen(p => !p)}
            className="md:hidden flex flex-col justify-center items-center w-10 h-10 rounded-lg hover:bg-zinc-900 transition gap-1.5"
            aria-label="Toggle menu"
          >
            <span className={`block h-0.5 w-5 bg-zinc-400 transition-all duration-300 ${mobileMenuOpen ? 'rotate-45 translate-y-2' : ''}`}></span>
            <span className={`block h-0.5 w-5 bg-zinc-400 transition-all duration-300 ${mobileMenuOpen ? 'opacity-0' : ''}`}></span>
            <span className={`block h-0.5 w-5 bg-zinc-400 transition-all duration-300 ${mobileMenuOpen ? '-rotate-45 -translate-y-2' : ''}`}></span>
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="md:hidden bg-zinc-950 border-t border-zinc-900 px-4 py-4 space-y-1 shadow-2xl">


          {/* Our Technology mobile nested accordion */}
          <MobileOurTechnology
            onClose={() => setMobileMenuOpen(false)}
            onProfitCalc={onProfitCalc}
            onAccounting={onAccounting}
            onMoneyKit={onMoneyKit}
            onReceipt={onReceipt}
            onCAC={onCAC}
            onAIAdvisor={onAIAdvisor}
            onFoundersMight={onFoundersMight}
            onHowItWorks={onHowItWorks}
          />

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
            <button onClick={() => { setMobileMenuOpen(false); onTop30Click(); }} className="w-full text-left flex items-center gap-3 px-4 py-3 rounded-xl text-xs font-black uppercase tracking-widest text-zinc-400 hover:bg-zinc-900 hover:text-amber-500 transition">
              <span className="w-7 h-7 bg-zinc-800 text-zinc-600 rounded-lg flex items-center justify-center flex-shrink-0"><i className="fas fa-trophy text-xs"></i></span>
              Top 30 List
            </button>
          </div>

          {/* Live Price mobile accordion */}
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
            <button onClick={() => { setMobileMenuOpen(false); onGybClick(); }} className="w-full bg-amber-500 text-black py-3 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-amber-400 transition">
              Launch Client Portal
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}

export default Navbar;
