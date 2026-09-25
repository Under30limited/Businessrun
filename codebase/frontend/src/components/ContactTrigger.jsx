import React, { useState } from 'react';
import { MessageSquare } from 'lucide-react';
import ContactModal from './ContactModal';

/**
 * components/ContactTrigger.jsx
 *
 * Bottom-right floating message icon for a dashboard — per the brief:
 * NOT a nav/sidebar entry, a standalone floating button with a
 * hover tooltip reading "Lay a Complaint". Owns its own open/close
 * state so dropping <ContactTrigger source="business" /> or
 * <ContactTrigger source="personal" /> into a dashboard is a single
 * line — no state wiring needed in RoadmapPage.jsx or
 * WealthDashboard.jsx beyond that one line.
 *
 * Fixed position, high z-index so it floats above dashboard content
 * but below the modal itself (which uses z-[200] — see
 * ContactModal.jsx) — bottom-right rather than bottom-left so it
 * doesn't collide with any bottom-left browser/OS chrome (e.g. some
 * mobile browsers' own UI) and stays clear of the sidebar's own
 * corner on the left.
 */
export default function ContactTrigger({ source }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div className="fixed bottom-5 right-5 z-[150] group">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Lay a complaint or drop a suggestion"
          className="w-12 h-12 bg-zinc-900 hover:bg-amber-500 rounded-full shadow-lg flex items-center justify-center text-white hover:text-black transition-all active:scale-95"
        >
          <MessageSquare size={19} />
        </button>

        {/* Hover tooltip — pointer-events-none so it never blocks the
            click itself, opacity/translate transition so it reads as
            a tooltip rather than an ever-present label. Anchored to
            the right edge (not left) so it opens toward the middle
            of the screen instead of off the right edge of the
            viewport, now that the button itself sits in the
            bottom-right corner. */}
        <div className="absolute bottom-full right-0 mb-2 pointer-events-none opacity-0 group-hover:opacity-100 translate-y-1 group-hover:translate-y-0 transition-all duration-150">
          <div className="bg-zinc-900 text-white text-[11px] font-bold px-3 py-2 rounded-lg shadow-xl whitespace-nowrap">
            Lay a Complaint
          </div>
        </div>
      </div>

      <ContactModal isOpen={open} onClose={() => setOpen(false)} source={source} />
    </>
  );
}
