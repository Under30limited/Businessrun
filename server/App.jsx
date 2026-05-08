import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';

import Navbar            from './components/Navbar';
import HomePage          from './components/HomePage';
import ProfitTaxPage     from './components/ToolsPage';
import AccountingTools   from './components/AccountingTools';
import Under30App        from './components/Under30App';
import Top30Page         from './components/Top30Page';
import FoundersMight     from './components/FoundersMight';
import ReceiptGenerator  from './components/ReceiptGenerator';
import MagazinePage      from './components/MagazinePage';
import LivePricePage     from './components/LivePricePage';
import SubscribeModal    from './components/SubscribeModal';
//import AnnouncementPopup from './components/AnnouncementPopup';
import GrowYourBusinessModal from './components/GrowYourBusinessModal';
import RoadmapPage       from './components/RoadmapPage';
import HowItWorksPage    from './components/HowItWorksPage';

// ── Page title map ────────────────────────────────────────────────
const BASE_TITLE = 'BusinessRun | The Pulse of African Enterprise';

const ROUTE_TITLES = {
  '/':                  BASE_TITLE,
  '/tools':             'Profit & Tax Hub | BusinessRun',
  '/tools/accounting':  'Accounting Tools | BusinessRun',
  '/under30':           'Under30Women | BusinessRun',
  '/top30':             'Top 30 | BusinessRun',
  '/mogul-audit':       'Mogul Audit | BusinessRun',
  '/receipt':           'Receipt Generator | BusinessRun',
  '/magazine':          'Magazine | BusinessRun',
  '/prices':            'Market Prices | BusinessRun',
  '/your-roadmap':      'Your Business Roadmap | BusinessRun',
  '/how-it-works':      'How It Works | BusinessRun',
};

function usePageTitle() {
  const location = useLocation();
  useEffect(() => {
    const path = location.pathname;
    if (path.startsWith('/magazine/article/')) {
      document.title = 'Article | BusinessRun Magazine';
      return;
    }
    document.title = ROUTE_TITLES[path] ?? BASE_TITLE;
  }, [location.pathname]);
}

function AppInner() {
  const navigate = useNavigate();
  const location = useLocation();

  usePageTitle();

  // True when the user is on their private dashboard — Navbar and pt-16 are suppressed
  const isDashboard = location.pathname === '/your-roadmap';

  const [subscribeOpen,  setSubscribeOpen]  = useState(false);
  const [activeResource, setActiveResource] = useState(null);
  const [gybOpen,        setGybOpen]        = useState(false);

  function openSubscribe()       { setActiveResource(null); setSubscribeOpen(true); }
  function openResourceModal(r)  { setActiveResource(r);    setSubscribeOpen(true); }
  function closeSubscribe()      { setSubscribeOpen(false);  setActiveResource(null); }

  // ── Navigation functions ─────────────────────────────────────
  function goHome()         { navigate('/');              window.scrollTo(0, 0); }
  function goUnder30()      { navigate('/under30');       window.scrollTo(0, 0); }
  function goTop30()        { navigate('/top30');         window.scrollTo(0, 0); }
  function goMogulAudit()   { navigate('/mogul-audit');   window.scrollTo(0, 0); }
  function goMagazine()     { navigate('/magazine');      window.scrollTo(0, 0); }
  function goHowItWorks()   { navigate('/how-it-works');  window.scrollTo(0, 0); }

  // Convert article desc to URL slug
  function slugify(desc) {
    return desc.toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-');
  }
  function goMagazineStory(id, desc) {
    const slug = desc ? slugify(desc) : String(id);
    navigate(`/magazine/article/${slug}`);
    window.scrollTo(0, 0);
  }

  // Our Technology actions
  function goProfitCalc()  { navigate('/tools');             window.scrollTo(0, 0); }
  function goAccounting()  { navigate('/tools/accounting');  window.scrollTo(0, 0); }
  function goReceipt()     { navigate('/receipt');           window.scrollTo(0, 0); }
  function goMoneyKit()    { openResourceModal('Money-Ready Kit'); }
  function goCAC()         { window.open('https://wa.me/2347044450636', '_blank'); }

  // Strategic AI Advisor — navigate home then smooth-scroll to #ai-advisor
  function goAIAdvisor() {
    if (location.pathname === '/') {
      document.getElementById('ai-advisor')?.scrollIntoView({ behavior: 'smooth' });
    } else {
      navigate('/');
      setTimeout(() => {
        document.getElementById('ai-advisor')?.scrollIntoView({ behavior: 'smooth' });
      }, 400);
    }
  }
	//pop up we remove
 //{location.pathname === '/' && (
   //     <AnnouncementPopup onGoToApp={goUnder30} />
     // )}


  return (
    <>
      <SubscribeModal
        isOpen={subscribeOpen}
        onClose={closeSubscribe}
        resource={activeResource}
      />

      <GrowYourBusinessModal
        isOpen={gybOpen}
        onClose={() => setGybOpen(false)}
      />


      {/* Navbar is suppressed on the dashboard — it has its own navigation */}
      {!isDashboard && (
        <Navbar
          onLogoClick={goHome}
          onMagazineClick={goMagazine}
          onResourcesClick={() => openResourceModal('Pitch Deck Template')}
          onUnder30WomenClick={goUnder30}
          onTop30Click={goTop30}
          onSubscribeClick={openSubscribe}
          onGybClick={() => setGybOpen(true)}
          onProfitCalc={goProfitCalc}
          onAccounting={goAccounting}
          onMoneyKit={goMoneyKit}
          onReceipt={goReceipt}
          onCAC={goCAC}
          onAIAdvisor={goAIAdvisor}
          onFoundersMight={goMogulAudit}
          onHowItWorks={goHowItWorks}
        />
      )}

      {/* pt-16 offsets the sticky Navbar height — not needed on the dashboard */}
      <div className={isDashboard ? '' : 'pt-16'}>
        <Routes>
          <Route
            path="/"
            element={
              <HomePage
                onMagazineClick={goMagazine}
                onMagazineStoryClick={goMagazineStory}
                onToolsClick={goProfitCalc}
                onAccountingClick={goAccounting}
                onUnder30Click={goUnder30}
                onTop30Click={goTop30}
                onMogulAuditClick={goMogulAudit}
                onReceiptClick={goReceipt}
                onSubscribeClick={openSubscribe}
                onResourceClick={openResourceModal}
              />
            }
          />
          <Route path="/tools"                     element={<ProfitTaxPage   onBack={goHome} />} />
          <Route path="/tools/accounting"          element={<AccountingTools onBack={goHome} />} />
          <Route path="/under30"                   element={<Under30App      onBack={goHome} />} />
          <Route path="/top30"                     element={<Top30Page       onBack={goHome} />} />
          <Route path="/mogul-audit"               element={<FoundersMight   onBack={goHome} />} />
          <Route path="/receipt"                   element={<ReceiptGenerator onBack={goHome} />} />
          <Route path="/prices"                    element={<LivePricePage   onBack={goHome} />} />
          <Route path="/your-roadmap"              element={<RoadmapPage />} />
          <Route path="/how-it-works"              element={<HowItWorksPage  onBack={goHome} />} />
          <Route path="/magazine"                  element={<MagazinePage    onBack={goHome} />} />
          <Route path="/magazine/article/:articleSlug" element={<MagazinePage  onBack={goHome} />} />
          <Route path="*"                          element={<RedirectHome />} />
        </Routes>
      </div>
    </>
  );
}

function RedirectHome() {
  const navigate = useNavigate();
  React.useEffect(() => { navigate('/', { replace: true }); }, [navigate]);
  return null;
}

function App() {
  return (
    // AuthProvider wraps BrowserRouter so useAuth() is available
    // everywhere in the tree, including inside Router components.
    <AuthProvider>
      <BrowserRouter>
        <AppInner />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
