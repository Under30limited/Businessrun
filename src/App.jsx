import React, { useState } from 'react';
import Navbar            from './components/Navbar';
import HomePage          from './components/HomePage';
import ToolsPage         from './components/ToolsPage';
import Under30App        from './components/Under30App';
import Top30Page         from './components/Top30Page';
import ReceiptGenerator  from './components/ReceiptGenerator';
import MagazinePage      from './components/MagazinePage';
import SubscribeModal    from './components/SubscribeModal';
import AnnouncementPopup from './components/AnnouncementPopup';

function App() {
  const [activePage, setActivePage] = useState('home');
  const [openStoryId, setOpenStoryId] = useState(null);
  const [subscribeOpen, setSubscribeOpen] = useState(false);
  const [activeResource, setActiveResource] = useState(null);

  function openSubscribe()      { setActiveResource(null); setSubscribeOpen(true); }
  function openResourceModal(r) { setActiveResource(r);    setSubscribeOpen(true); }
  function closeSubscribe()     { setSubscribeOpen(false); setActiveResource(null); }

  function goHome()             { setActivePage('home');    setOpenStoryId(null); window.scrollTo(0, 0); }
  function goTools()            { setActivePage('tools');   window.scrollTo(0, 0); }
  function goUnder30()          { setActivePage('under30'); window.scrollTo(0, 0); }
  function goTop30()            { setActivePage('top30');   window.scrollTo(0, 0); }
  function goReceipt()          { setActivePage('receipt'); window.scrollTo(0, 0); }
  function goMagazine()         { setOpenStoryId(null); setActivePage('magazine'); window.scrollTo(0, 0); }
  function goMagazineStory(id)  { setOpenStoryId(id);   setActivePage('magazine'); window.scrollTo(0, 0); }

  return (
    <>
      <SubscribeModal
        isOpen={subscribeOpen}
        onClose={closeSubscribe}
        resource={activeResource}
      />

      {activePage === 'home' && (
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

      {activePage === 'home' && (
        <div className="pt-16">
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
        </div>
      )}

      {activePage === 'tools' && (
        <div className="pt-16">
          <ToolsPage onBack={goHome} />
        </div>
      )}

      {activePage === 'under30' && (
        <div className="pt-16">
          <Under30App onBack={goHome} />
        </div>
      )}

      {activePage === 'top30' && (
        <div className="pt-16">
          <Top30Page onBack={goHome} />
        </div>
      )}

      {activePage === 'receipt' && (
        <div className="pt-16">
          <ReceiptGenerator onBack={goHome} />
        </div>
      )}

      {activePage === 'magazine' && (
        <div className="pt-16">
          <MagazinePage onBack={goHome} openStoryId={openStoryId} />
        </div>
      )}
    </>
  );
}

export default App;
