/**
 * components/PWAInstallPrompt.jsx
 *
 * Shows a branded install banner when the browser fires the
 * `beforeinstallprompt` event — Chrome on Android, Edge on desktop.
 *
 * For iOS/Safari (which does not fire beforeinstallprompt):
 * Shows a separate instruction banner explaining how to use
 * "Add to Home Screen" from the Safari share menu.
 *
 * The banner is dismissed permanently once the user either
 * installs or explicitly dismisses it (stored in localStorage
 * so it doesn't reappear on every visit).
 *
 * USAGE:
 *   // In App.jsx, render once at the top level:
 *   <PWAInstallPrompt />
 */

import React, { useState, useEffect } from 'react';
import { X, Download, Share } from 'lucide-react';

export default function PWAInstallPrompt() {
  const [installEvent, setInstallEvent] = useState(null);  // Chrome/Android
  const [showIOSBanner, setShowIOSBanner] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Don't show if already dismissed or already installed
    if (localStorage.getItem('pwa-install-dismissed')) return;
    if (window.matchMedia('(display-mode: standalone)').matches) return;

    // Detect iOS Safari
    const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const isSafari = /safari/i.test(navigator.userAgent) && !/chrome/i.test(navigator.userAgent);

    if (isIOS && isSafari) {
      // Show iOS instruction banner after a short delay
      const timer = setTimeout(() => setShowIOSBanner(true), 3000);
      return () => clearTimeout(timer);
    }

    // Chrome / Android / Edge — listen for native install prompt
    const handler = e => {
      e.preventDefault();          // prevent default mini-infobar
      setInstallEvent(e);          // save for later use
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  function dismiss() {
    localStorage.setItem('pwa-install-dismissed', '1');
    setInstallEvent(null);
    setShowIOSBanner(false);
    setDismissed(true);
  }

  async function handleInstall() {
    if (!installEvent) return;
    installEvent.prompt();
    const { outcome } = await installEvent.userChoice;
    if (outcome === 'accepted') {
      localStorage.setItem('pwa-install-dismissed', '1');
    }
    setInstallEvent(null);
  }

  if (dismissed) return null;

  // ── Chrome / Android install banner ──────────────────────────
  if (installEvent) {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-[9999] p-4 sm:p-6 sm:max-w-sm sm:left-auto sm:right-4 sm:bottom-4">
        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5 shadow-2xl shadow-black/60">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center justify-center">
                <span className="text-amber-500 font-black text-lg italic">B</span>
              </div>
              <div>
                <p className="text-white font-black text-sm">BusinessRun</p>
                <p className="text-zinc-600 text-[10px] uppercase tracking-widest font-black">Add to Home Screen</p>
              </div>
            </div>
            <button onClick={dismiss} className="text-zinc-600 hover:text-zinc-400 transition mt-0.5">
              <X size={16} />
            </button>
          </div>

          <p className="text-zinc-500 text-xs leading-relaxed mb-4">
            Install BusinessRun for instant access — no browser bar, works offline, feels like a native app.
          </p>

          <div className="flex gap-3">
            <button onClick={dismiss}
              className="flex-1 py-2.5 text-[10px] font-black uppercase tracking-widest text-zinc-600 hover:text-zinc-400 transition">
              Not Now
            </button>
            <button onClick={handleInstall}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-amber-500 text-black font-black text-[10px] uppercase tracking-widest rounded-xl hover:bg-amber-400 transition">
              <Download size={12} /> Install
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── iOS Safari instruction banner ─────────────────────────────
  if (showIOSBanner) {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-[9999] p-4">
        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-5 shadow-2xl shadow-black/60 max-w-sm mx-auto">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center justify-center">
                <span className="text-amber-500 font-black text-lg italic">B</span>
              </div>
              <div>
                <p className="text-white font-black text-sm">Install BusinessRun</p>
                <p className="text-zinc-600 text-[10px] uppercase tracking-widest font-black">iOS · Safari</p>
              </div>
            </div>
            <button onClick={dismiss} className="text-zinc-600 hover:text-zinc-400 transition">
              <X size={16} />
            </button>
          </div>

          <p className="text-zinc-500 text-xs leading-relaxed">
            Tap <Share size={11} className="inline mx-1 text-zinc-400" /> then
            <strong className="text-zinc-300"> "Add to Home Screen"</strong> to install BusinessRun as an app on your iPhone.
          </p>

          {/* iOS share arrow indicator */}
          <div className="flex justify-center mt-4">
            <div className="flex items-center gap-2 px-4 py-2 bg-zinc-900 border border-zinc-800 rounded-xl">
              <Share size={13} className="text-zinc-400" />
              <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                Share → Add to Home Screen
              </span>
            </div>
          </div>

          {/* Arrow pointing down toward the Safari toolbar */}
          <div className="flex justify-center mt-2">
            <span className="text-zinc-600 text-lg">↓</span>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
