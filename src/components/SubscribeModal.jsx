import React, { useState, useEffect } from 'react';

const SUBSCRIBE_ENDPOINT = 'PASTE_YOUR_SUBSCRIBE_APPS_SCRIPT_URL_HERE';

export default function SubscribeModal({ isOpen, onClose, resource = null }) {
  const [email, setEmail]           = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted]   = useState(false);
  const [error, setError]           = useState('');

  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') handleClose(); }
    if (isOpen) document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen]);

  function handleClose() {
    setEmail('');
    setSubmitted(false);
    setError('');
    onClose();
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await fetch(SUBSCRIBE_ENDPOINT, {
        method:  'POST',
        mode:    'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          subscribedAt: new Date().toLocaleString('en-NG', { timeZone: 'Africa/Lagos' }),
          source: 'businessrun-website',
        }),
      });
      setSubmitted(true);
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}
      onClick={handleClose}
    >
      <div
        className="bg-zinc-950 border border-zinc-800 rounded-2xl sm:rounded-3xl w-full max-w-md relative shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* Close */}
        <button onClick={handleClose} className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200 transition text-xl font-light z-10" aria-label="Close">×</button>

        <div className="p-6 sm:p-8">
          {submitted ? (
            <div className="text-center py-4">
              <div className="w-14 h-14 bg-amber-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <i className="fas fa-check text-black text-xl"></i>
              </div>
              <h3 className="text-xl font-black italic uppercase text-white mb-2">
                {resource ? 'On its way!' : 'Request Sent!'}
              </h3>
              <p className="text-zinc-400 text-sm mb-6">
                {resource
                  ? <>The <strong className="text-zinc-200">{resource}</strong> is being sent to your inbox right now.</>
                  : <>Your request has been sent and received. Welcome — a member of the <strong className="text-zinc-200">Capital Club</strong> team will be in touch shortly.</>}
              </p>
              <button onClick={handleClose} className="bg-amber-500 text-black px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-amber-400 transition">Done</button>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <div className="w-10 h-10 bg-zinc-800 border border-zinc-700 rounded-xl flex items-center justify-center mb-4">
                  <i className={`fas ${resource ? 'fa-file-arrow-down' : 'fa-crown'} text-amber-500 text-sm`}></i>
                </div>
                <h3 className="text-xl sm:text-2xl font-black italic uppercase text-white mb-1">
                  {resource ? 'Get Your Free Resource' : 'Join Capital Club'}
                </h3>
                <p className="text-zinc-400 text-sm">
                  {resource
                    ? <>Enter your email and we'll send the <strong className="text-zinc-200">{resource}</strong> directly to your inbox.</>
                    : <>Request access to the <strong className="text-zinc-200">Capital Club</strong> — an exclusive community of African founders getting priority tools, insights and network access.</>}
                </p>
              </div>
              <form onSubmit={handleSubmit} className="space-y-3">
                <input required type="email" placeholder="Enter your email address" value={email} onChange={e => setEmail(e.target.value)}
                  className="w-full px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-xl text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500 transition" />
                {error && <p className="text-red-400 text-xs text-center">{error}</p>}
                <button type="submit" disabled={submitting} className="w-full bg-amber-500 text-black py-3 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-amber-400 transition disabled:opacity-60 flex items-center justify-center gap-2">
                  {submitting
                    ? (<><svg className="animate-spin h-4 w-4 text-black" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path></svg>Sending...</>)
                    : resource ? 'Send to My Email' : 'Request Access'}
                </button>
                <p className="text-xs text-zinc-600 text-center">No spam, ever. Unsubscribe at any time.</p>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
