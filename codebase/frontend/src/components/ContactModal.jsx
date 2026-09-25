import React, { useState, useEffect } from 'react';
import { X, Loader2, CheckCircle2, MessageSquare } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

/**
 * components/ContactModal.jsx
 *
 * The one shared "lay a complaint / drop a suggestion" form behind
 * all three entry points — the home page footer link, and the
 * floating message-icon trigger on both Business OS and Personal
 * Wealth OS (see ContactTrigger.jsx, which wraps this for the
 * dashboards). Posts to POST /api/contact.
 *
 * `source` is passed in purely for this component's own copy (e.g.
 * "We'll reply to you at ...") — it is NOT what determines where the
 * submission gets attributed server-side. When the person is logged
 * in, the backend derives source/name/email from the verified
 * session and ignores anything this form sends for those fields (see
 * contact.controller.js's header comment on why) — this component
 * mirrors that by not even letting a logged-in user edit their own
 * name/email here, just showing who they're submitting as.
 *
 * Deliberately dark-chrome (matching GrowYourBusinessModal /
 * PersonalWealthModal) on every surface, including the light-themed
 * dashboards — a modal is its own layer on top of the page, and one
 * consistent, recognizable look reads as more intentional than
 * chameleoning into each host page's theme.
 */

const CATEGORIES = [
  { value: 'complaint',  label: 'Complaint' },
  { value: 'suggestion', label: 'Suggestion' },
  { value: 'bug',        label: 'Something\u2019s Broken' },
  { value: 'other',      label: 'Other' },
];

const SOURCE_COPY = {
  home:     "Have a question, a complaint, or an idea? We're listening.",
  business: "Something not working right, or a feature you wish existed? Let us know.",
  personal: "Something not working right, or a feature you wish existed? Let us know.",
};

export default function ContactModal({ isOpen, onClose, source = 'home' }) {
  const { user, isAuthenticated } = useAuth();

  const [category, setCategory] = useState('complaint');
  const [message, setMessage]   = useState('');
  const [name, setName]         = useState('');
  const [email, setEmail]       = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]       = useState('');
  const [success, setSuccess]   = useState(false);

  // Reset to a clean slate every time the modal is opened fresh —
  // otherwise a second complaint later in the same session would
  // reopen showing the previous one's success state.
  useEffect(() => {
    if (isOpen) {
      setCategory('complaint');
      setMessage('');
      setError('');
      setSuccess(false);
      if (!isAuthenticated) { setName(''); setEmail(''); }
    }
  }, [isOpen, isAuthenticated]);

  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isOpen) return null;

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');

    if (!message.trim()) {
      setError('Please write a message before submitting.');
      return;
    }
    if (!isAuthenticated && (!name.trim() || !email.trim())) {
      setError('Please fill in your name and email.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/contact', {
        method:      'POST',
        credentials: 'include', // carries the session cookie when logged in — anonymous on the home page simply has none to send
        headers:     { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category,
          message: message.trim(),
          ...(isAuthenticated ? {} : { name: name.trim(), email: email.trim() }),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        setError(data.message || 'Could not send your message. Please try again.');
        return;
      }
      setSuccess(true);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  const inputClass = 'w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500 transition-colors';
  const labelClass = 'block text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2';

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <div
        className="bg-zinc-950 border border-zinc-800 w-full sm:rounded-[2rem] max-w-md max-h-[95vh] overflow-y-auto shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="sticky top-0 z-10 bg-zinc-950/95 backdrop-blur-md border-b border-zinc-900 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="bg-amber-500/10 p-1.5 rounded-lg">
              <MessageSquare size={15} className="text-amber-500" />
            </div>
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-amber-500">BusinessRun</p>
              <h2 className="text-white font-black text-base uppercase italic tracking-tight">Get In Touch</h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 bg-zinc-800 hover:bg-zinc-700 rounded-full flex items-center justify-center text-zinc-400 hover:text-white transition-all"
          >
            <X size={15} />
          </button>
        </div>

        <div className="p-6">
          {success ? (
            <div className="text-center py-6">
              <div className="w-14 h-14 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 size={26} className="text-emerald-500" />
              </div>
              <h3 className="text-white font-black text-lg mb-1.5">Message Sent</h3>
              <p className="text-zinc-500 text-sm mb-6">
                Thanks — we've got it. We'll get back to you at{' '}
                <span className="text-zinc-300">{isAuthenticated ? user?.email : email}</span>.
              </p>
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2.5 bg-amber-500 text-black rounded-xl text-xs font-black uppercase tracking-widest hover:bg-amber-400 transition"
              >
                Close
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <p className="text-zinc-500 text-sm leading-relaxed -mt-1">
                {SOURCE_COPY[source] || SOURCE_COPY.home}
              </p>

              {error && (
                <p className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">{error}</p>
              )}

              <div>
                <label className={labelClass}>What's this about?</label>
                <div className="grid grid-cols-2 gap-2">
                  {CATEGORIES.map(c => (
                    <button
                      key={c.value}
                      type="button"
                      onClick={() => setCategory(c.value)}
                      className={`px-3 py-2.5 rounded-xl text-xs font-bold border transition text-left ${
                        category === c.value
                          ? 'bg-amber-500 border-amber-500 text-black'
                          : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:border-zinc-700'
                      }`}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>

              {!isAuthenticated && (
                <>
                  <div>
                    <label className={labelClass}>Your Name</label>
                    <input value={name} onChange={e => setName(e.target.value)} placeholder="Ada Obi" className={inputClass} />
                  </div>
                  <div>
                    <label className={labelClass}>Your Email</label>
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="ada@example.com" className={inputClass} />
                  </div>
                </>
              )}

              {isAuthenticated && (
                <p className="text-[11px] text-zinc-600">
                  Submitting as <span className="text-zinc-400">{user?.fullName || user?.nickname}</span> ({user?.email})
                </p>
              )}

              <div>
                <label className={labelClass}>Message</label>
                <textarea
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  placeholder="Tell us what's going on..."
                  rows={5}
                  className={`${inputClass} resize-none`}
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 bg-amber-500 text-black rounded-xl text-xs font-black uppercase tracking-widest hover:bg-amber-400 transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {submitting ? <Loader2 size={14} className="animate-spin" /> : null}
                {submitting ? 'Sending...' : 'Send Message'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
