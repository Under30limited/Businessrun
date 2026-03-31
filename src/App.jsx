import React, { useState } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom';

import Navbar            from './components/Navbar';
import HomePage          from './components/HomePage';
import ToolsPage         from './components/ToolsPage';
import Under30App        from './components/Under30App';
import Top30Page         from './components/Top30Page';
import ReceiptGenerator  from './components/ReceiptGenerator';
import MagazinePage      from './components/MagazinePage';
import LivePricePage     from './components/LivePricePage';
import SubscribeModal    from './components/SubscribeModal';
import AnnouncementPopup from './components/AnnouncementPopup';

function AppInner() {
  const navigate = useNavigate();
  const location = useLocation();

  const [subscribeOpen,  setSubscribeOpen]  = useState(false);
  const [activeResource, setActiveResource] = useState(null);

  function openSubscribe()      { setActiveResource(null); setSubscribeOpen(true); }
  function openResourceModal(r) { setActiveResource(r);    setSubscribeOpen(true); }
  function closeSubscribe()     { setSubscribeOpen(false); setActiveResource(null); }

  function goHome()    { navigate('/');        window.scrollTo(0, 0); }
  function goTools()   { navigate('/tools');   window.scrollTo(0, 0); }
  function goUnder30() { navigate('/under30'); window.scrollTo(0, 0); }
  function goTop30()   { navigate('/top30');   window.scrollTo(0, 0); }
  function goReceipt() { navigate('/receipt'); window.scrollTo(0, 0); }
  function goMagazine(){ navigate('/magazine');window.scrollTo(0, 0); }

  // Navigate to any article directly by id — works from anywhere in the app
  // and also handles direct URL access e.g. /magazine/article/1
  function goMagazineStory(id) { navigate(`/magazine/article/${id}`); window.scrollTo(0, 0); }

  return (
    <>
      <SubscribeModal
        isOpen={subscribeOpen}
        onClose={closeSubscribe}
        resource={activeResource}
      />

      {location.pathname === '/' && (
        <AnnouncementPopup onGoToApp={goUnder30} />
      )}

      <Navbar
        onLogoClick={goHome}
        onMagazineClick={goMagazine}
        onToolsClick={goTools}
        onResourcesClick={() => openResourceModal('Pitch Deck Template')}
        onUnder30WomenClick={goUnder30}
        onTop30Click={goTop30}
        onSubscribeClick={openSubscribe}
      />

      <div className="pt-16">
        <Routes>
          <Route
            path="/"
            element={
              <HomePage
                onMagazineClick={goMagazine}
                onMagazineStoryClick={goMagazineStory}
                onToolsClick={goTools}
                onUnder30Click={goUnder30}
                onTop30Click={goTop30}
                onReceiptClick={goReceipt}
                onSubscribeClick={openSubscribe}
                onResourceClick={openResourceModal}
              />
            }
          />
          <Route path="/tools"   element={<ToolsPage       onBack={goHome} />} />
          <Route path="/under30" element={<Under30App       onBack={goHome} />} />
          <Route path="/top30"   element={<Top30Page        onBack={goHome} />} />
          <Route path="/receipt" element={<ReceiptGenerator onBack={goHome} />} />
          <Route path="/prices"  element={<LivePricePage    onBack={goHome} />} />

          {/* Both /magazine and /magazine/article/:articleId use the same component.
              MagazinePage reads useParams() internally to know which article to open. */}
          <Route path="/magazine"                      element={<MagazinePage onBack={goHome} />} />
          <Route path="/magazine/article/:articleId"   element={<MagazinePage onBack={goHome} />} />

          {/* Catch-all */}
          <Route path="*" element={<RedirectHome />} />
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
    <BrowserRouter>
      <AppInner />
    </BrowserRouter>
  );
}

export default App;
