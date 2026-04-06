import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowRight, Bot, User, Send, Sparkles, Loader2,
  FileText, Briefcase, Layers, Clock, ArrowUpRight,
  ChevronRight, Trophy, RefreshCcw
} from 'lucide-react';

export default function HomePage({
  onMagazineClick, onMagazineStoryClick, onToolsClick, onUnder30Click,
  onTop30Click, onReceiptClick, onSubscribeClick, onResourceClick,
}) {
  const words = ['Build.', 'Scale.', 'Create Wealth.'];
  const [wordIndex, setWordIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setWordIndex(i => (i + 1) % words.length), 2500);
    return () => clearInterval(id);
  }, []);

  // Terminal Feed stories — each id maps to a specific magazine issue
  // id 19 = The Big 3 Cold War | id 20 = Nigeria's Unicorn Factory
  const stories = [
    {
      id: 19,
      category: 'Exclusive',
      headline: 'The Big 3 Cold War: The $50M Collab the World Can\'t Have',
      excerpt: 'Wizkid, Burna Boy and Davido are the most powerful trio in African music history. Their refusal to collaborate is costing Afrobeats — and each other — more than anyone will admit.',
      author: 'Sola Afolabi',
      readTime: '10 min',
    },
    {
      id: 20,
      category: 'Startups',
      headline: 'Nigeria\'s Unicorn Factory: Inside Africa\'s Biggest Tech Bet',
      excerpt: 'Moniepoint, Chowdeck, Flutterwave — with 205 deals and $343M raised in a single year, Lagos is minting billion-dollar companies faster than anywhere else on the continent.',
      author: 'Taiwo Bankole',
      readTime: '8 min',
    },
  ];

  // ── AI Advisor ────────────────────────────────────────────
  // Calls the Cloudflare Pages Function at functions/advisor.js
  // The Gemini API key lives in Cloudflare dashboard environment
  // variables — never in this file, never on GitHub.
  //
  // To set the key: Cloudflare Dashboard → Pages → your project
  //   → Settings → Environment variables → Add variable
  //      Key:   GEMINI_API_KEY
  //      Value: AIza...  (from aistudio.google.com → Get API Key)
  // ─────────────────────────────────────────────────────────

  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'TBR Strategic AI active. Share your current business progress or expansion plans. How can I help you scale today?' }
  ]);
  const [input, setInput]         = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const chatEndRef     = useRef(null);
  const chatTopRef     = useRef(null);
  const chatBoxRef     = useRef(null);
  const chatInteracted = useRef(false);

  // Scroll the chat BOX only — never the page
  useEffect(() => {
    if (chatInteracted.current && chatBoxRef.current) {
      chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  function scrollToTop()    { if (chatBoxRef.current) chatBoxRef.current.scrollTop = 0; }
  function scrollToBottom() { if (chatBoxRef.current) chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight; }

  const ADVISOR_DOWN_MSG = '__ADVISOR_DOWN__';

  const askAI = async (e) => {
    if (e) e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    chatInteracted.current = true;

    const newMessages = [...messages, { role: 'user', content: userMessage }];
    setMessages(newMessages);
    setIsLoading(true);

    try {
      const history = newMessages
        .slice(1)     // skip opening greeting
        .slice(0, -1) // skip the message we just added
        .map(m => ({ role: m.role, content: m.content }));

      const response = await fetch('/advisor', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage, history }),
      });

      // The function always returns JSON — but guard against edge cases
      let data;
      try {
        data = await response.json();
      } catch {
        // Response wasn't JSON at all (e.g. Cloudflare 5xx HTML page)
        setMessages(prev => [...prev, { role: 'assistant', content: ADVISOR_DOWN_MSG }]);
        return;
      }

      // advisorDown flag or missing text → friendly down message
      if (data.advisorDown || !data.text || !data.text.trim()) {
        setMessages(prev => [...prev, { role: 'assistant', content: ADVISOR_DOWN_MSG }]);
        return;
      }

      setMessages(prev => [...prev, { role: 'assistant', content: data.text }]);

    } catch {
      // Network failure (offline, DNS, etc.)
      setMessages(prev => [...prev, { role: 'assistant', content: ADVISOR_DOWN_MSG }]);
    } finally {
      setIsLoading(false);
    }
  };


  // Renders plain text with **bold** markdown → <strong> spans
  function renderMessageContent(text) {
    const parts = text.split(/(\*\*.*?\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} className="font-black text-white">{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  }

  return (
    <div className="min-h-screen bg-black text-zinc-100 font-sans selection:bg-amber-500 selection:text-black">

      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="relative pt-20 pb-20 px-6 text-center overflow-hidden">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-5xl md:text-7xl font-black tracking-tighter mb-8">
            <span className="text-zinc-500">The OS for your business</span>
            <div className="h-[1.2em] relative flex justify-center items-center">
              {words.map((word, i) => (
                <span key={word} className={`absolute transition-all duration-700 ease-in-out bg-gradient-to-r from-amber-400 to-amber-600 bg-clip-text text-transparent ${i === wordIndex ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0'}`}>
                  {word}
                </span>
              ))}
            </div>
          </h1>
          <p className="text-zinc-400 text-lg mb-10 max-w-2xl mx-auto leading-relaxed">
            Grow your business with tools designed for modern business owners. From registration to exit strategy, everything you need is here.
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            {/* Explore Tools → smooth scroll to AI advisor section */}
            <button
              onClick={() => document.getElementById('ai-advisor')?.scrollIntoView({ behavior: 'smooth' })}
              className="bg-amber-500 text-black px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-xs hover:shadow-[0_0_30px_rgba(245,158,11,0.4)] hover:bg-amber-400 transition-all active:scale-95"
            >
              Explore Tools
            </button>
            {/* Read Magazine → magazine page */}
            <button
              onClick={onMagazineClick}
              className="bg-zinc-900 border border-zinc-800 text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-zinc-800 transition-all active:scale-95"
            >
              Read Magazine
            </button>
          </div>
        </div>
      </section>

      {/* ── Feature Grid ─────────────────────────────────────── */}
      <section className="px-6 py-12 max-w-7xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">

          {/* Register Your Business → WhatsApp */}
          <a
            href="https://wa.me/2348159346026"
            target="_blank"
            rel="noopener noreferrer"
            className="group bg-zinc-900/40 border border-zinc-800 p-8 rounded-[2rem] hover:border-amber-500/40 transition-all flex flex-col justify-between block"
          >
            <div>
              <div className="w-14 h-14 bg-amber-500/10 rounded-2xl flex items-center justify-center text-amber-500 mb-6 border border-amber-500/20 group-hover:bg-amber-500 group-hover:text-black transition-all">
                <Layers size={28} />
              </div>
              <h3 className="text-2xl font-black mb-3 italic uppercase tracking-tight">Register your business</h3>
              <p className="text-zinc-500 text-sm leading-relaxed mb-6">
                Tell us your business name, and our agents will handle the rest. We make getting your official certificate simple, fast, and affordable for every business owner.
              </p>
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2 text-amber-500 group-hover:gap-4 transition-all">
              Start Registration <ArrowRight size={14} />
            </span>
          </a>

          {/* Receipts → ReceiptGenerator page */}
          <button
            onClick={onReceiptClick}
            className="group text-left bg-zinc-900/40 border border-zinc-800 p-8 rounded-[2rem] hover:border-amber-500/40 transition-all"
          >
            <div className="w-14 h-14 bg-zinc-800 rounded-2xl flex items-center justify-center text-white mb-6 group-hover:bg-zinc-700 transition-all">
              <FileText size={28} />
            </div>
            <h3 className="text-2xl font-black mb-3 italic uppercase">Receipts</h3>
            <p className="text-zinc-500 text-sm leading-relaxed mb-6">
              Generate professional, audit-ready receipts. Manage cash flow with branded documents.
            </p>
            <span className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2 text-white group-hover:gap-4 transition-all">
              Generate <ArrowRight size={14} />
            </span>
          </button>

          {/* Money-Ready Kit → SubscribeModal */}
          <button
            onClick={() => onResourceClick('Pitch Deck Template')}
            className="group text-left bg-zinc-900/40 border border-zinc-800 p-8 rounded-[2rem] hover:border-amber-500/40 transition-all flex flex-col justify-between"
          >
            <div>
              <div className="w-14 h-14 bg-zinc-800 rounded-2xl flex items-center justify-center text-white mb-6 group-hover:bg-zinc-700 transition-all">
                <Briefcase size={28} />
              </div>
              <h3 className="text-2xl font-black mb-3 italic uppercase">The Money-Ready Kit</h3>
              <p className="text-zinc-500 text-sm leading-relaxed mb-6">
                Everything you need to show a bank or a partner that your business is serious. We've put together simple forms and plans to help you scale.
              </p>
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest flex items-center gap-2 text-white group-hover:gap-4 transition-all">
              Access Pack <ArrowRight size={14} />
            </span>
          </button>
        </div>

      </section>

      {/* ── AI Advisor ───────────────────────────────────────────────────────── */}
      <section className="px-6 pb-12 max-w-7xl mx-auto">
        {/* ── AI Advisor ─────────────────────────────────────── */}
        <div id="ai-advisor" className="bg-zinc-900/60 border border-zinc-800 rounded-[2.5rem] overflow-hidden grid grid-cols-1 lg:grid-cols-2 shadow-2xl">
          <div className="p-10 flex flex-col justify-center">
            <div className="flex items-center gap-3 mb-8">
              <div className="bg-amber-500/10 p-2 rounded-lg"><Sparkles className="text-amber-500" size={20} /></div>
              <div>
                <h2 className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                  Strategic AI Advisor <span className="flex h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                </h2>
                <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-tighter">TBR Intelligence Unit</p>
              </div>
            </div>
            <h2 className="text-4xl font-black mb-6 tracking-tight italic uppercase">Expertise On-Demand.</h2>
            <p className="text-zinc-400 mb-8 leading-relaxed">
              Built for African Founders. Tuned for registration legalities, go-to-market strategies, and fundraising nuances.
            </p>
            <button
              onClick={() => {
                chatInteracted.current = false;
                setMessages([{ role: 'assistant', content: 'Chat history cleared. How can I assist?' }]);
              }}
              className="w-fit p-3 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-zinc-400 hover:text-white transition-all"
              title="Clear chat"
            >
              <RefreshCcw size={18} />
            </button>
          </div>

          <div className="bg-black/40 p-6 flex flex-col h-[550px] border-l border-zinc-800/50">

            {/* Scroll controls — only show when there are multiple messages */}
            {messages.length > 3 && (
              <div className="flex justify-end gap-2 mb-3">
                <button
                  onClick={scrollToTop}
                  className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-zinc-600 hover:text-amber-500 transition-colors px-2 py-1 bg-zinc-900 rounded-lg border border-zinc-800"
                  title="Scroll to top"
                >
                  ↑ Top
                </button>
                <button
                  onClick={scrollToBottom}
                  className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-zinc-600 hover:text-amber-500 transition-colors px-2 py-1 bg-zinc-900 rounded-lg border border-zinc-800"
                  title="Scroll to bottom"
                >
                  ↓ Bottom
                </button>
              </div>
            )}

            <div ref={chatBoxRef} className="flex-1 overflow-y-auto space-y-6 mb-4 pr-2">
              {/* Top anchor for scroll-to-top */}
              <div ref={chatTopRef} />

              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`flex gap-3 max-w-[85%] ${m.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1 ${m.role === 'user' ? 'bg-amber-500 text-black font-black' : 'bg-zinc-800 text-amber-500 border border-zinc-700'}`}>
                      {m.role === 'user' ? <User size={14} /> : <Bot size={14} />}
                    </div>

                    {/* Advisor-down: friendly UI card */}
                    {m.content === ADVISOR_DOWN_MSG ? (
                      <div className="p-4 rounded-2xl text-[11px] leading-relaxed bg-zinc-900 border border-zinc-700 text-zinc-400 flex items-start gap-3">
                        <span className="text-lg leading-none">🛠️</span>
                        <div>
                          <p className="font-black text-zinc-300 uppercase tracking-widest text-[9px] mb-1">Advisor Unavailable</p>
                          <p>The advisory is currently down. Please check back later — we're working on it.</p>
                        </div>
                      </div>
                    ) : (
                      <div className={`p-4 rounded-2xl text-[11px] leading-relaxed whitespace-pre-wrap ${m.role === 'user' ? 'bg-amber-500 text-black font-bold shadow-lg' : 'bg-zinc-900 border border-zinc-800 text-zinc-300'}`}>
                        {renderMessageContent(m.content)}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              {isLoading && (
                <div className="flex gap-3 items-center bg-zinc-900/50 p-4 rounded-2xl w-fit">
                  <Loader2 size={14} className="text-amber-500 animate-spin" />
                  <span className="text-[9px] font-black uppercase tracking-widest text-zinc-500">Processing...</span>
                </div>
              )}

              {/* Bottom anchor for scroll-to-bottom */}
              <div ref={chatEndRef} />
            </div>

            <form onSubmit={askAI} className="relative">
              <textarea
                rows="1"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault(); // stop textarea newline AND any page scroll
                    askAI(null);        // pass null — no event to prevent inside askAI
                  }
                }}
                placeholder="Ask about expansion, legal docs..."
                className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-5 py-4 pr-14 text-xs text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-amber-500 transition-all resize-none shadow-inner"
              />
              <button
                type="submit"
                disabled={isLoading || !input.trim()}
                className="absolute right-3 top-1/2 -translate-y-1/2 bg-amber-500 text-black p-2 rounded-lg hover:scale-105 active:scale-95 transition-all disabled:opacity-30"
              >
                <Send size={16} />
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* ── Magazine Headlines ───────────────────────────────── */}
      <section id="magazine" className="max-w-7xl mx-auto px-6 py-24 border-t border-zinc-900">
        <div className="flex items-center justify-between mb-16">
          <div className="flex items-center gap-4">
            <h2 className="text-3xl font-black tracking-tighter italic uppercase">Terminal Feed</h2>
            <div className="h-[2px] w-12 bg-amber-500/50" />
          </div>
          <button
            onClick={onMagazineClick}
            className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 hover:text-amber-500 flex items-center gap-2 group transition-all"
          >
            Full Archive <ArrowUpRight size={14} className="group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition-transform" />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {stories.map(story => (
            <button
              key={story.id}
              onClick={() => onMagazineStoryClick(story.id)}
              className="group cursor-pointer text-left relative p-8 bg-zinc-950 border border-zinc-900 rounded-[2rem] hover:bg-zinc-900/40 hover:border-zinc-700 transition-all duration-500 w-full"
            >
              <div className="flex items-center gap-3 mb-6">
                <span className="text-[9px] font-black uppercase tracking-widest text-amber-500 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20">
                  {story.category}
                </span>
                <span className="text-[9px] text-zinc-600 font-black uppercase tracking-widest flex items-center gap-1">
                  <Clock size={10} /> {story.readTime}
                </span>
              </div>
              <h3 className="text-2xl font-black leading-tight mb-4 group-hover:text-amber-500 transition-colors duration-300">
                {story.headline}
              </h3>
              <p className="text-zinc-500 text-sm leading-relaxed mb-8 max-w-lg">
                {story.excerpt}
              </p>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-md bg-zinc-800 flex items-center justify-center text-[7px] font-black text-zinc-500">TBR</div>
                  <span className="text-[10px] text-zinc-600 font-bold tracking-tight uppercase">{story.author}</span>
                </div>
                <div className="bg-zinc-800 p-2 rounded-full opacity-0 group-hover:opacity-100 transition-all group-hover:bg-amber-500 group-hover:text-black">
                  <ArrowRight size={16} />
                </div>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* ── Under30 CTA ──────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-6 py-20">
        <div className="bg-gradient-to-r from-zinc-900 to-black border border-zinc-800 p-12 rounded-[3rem] flex flex-col md:flex-row items-center justify-between gap-10">
          <div>
            <div className="flex items-center gap-2 mb-2 text-amber-500">
              <Trophy size={16} />
              <span className="text-[10px] font-black uppercase tracking-widest">2026 Cohort</span>
            </div>
            <h2 className="text-4xl font-black mb-4 italic uppercase">BusinessRun 30</h2>
            <p className="text-zinc-500 max-w-md italic font-medium">
              The definitive list of founders building the future. Nominations closing soon.
            </p>
          </div>
          <button
            onClick={onTop30Click}
            className="whitespace-nowrap bg-white text-black px-10 py-5 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-amber-500 transition-all flex items-center gap-2 shadow-xl active:scale-95"
          >
            Explore List <ChevronRight size={18} />
          </button>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────── */}
      <footer className="bg-zinc-950 border-t border-zinc-900 py-16 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-6 mb-8">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-amber-500 rounded-lg flex items-center justify-center font-black text-black text-sm shadow-[0_0_20px_rgba(245,158,11,0.2)]">B</div>
              <span className="font-black tracking-tighter text-xl uppercase italic">BusinessRun</span>
            </div>
            <div className="flex flex-wrap justify-center gap-6 text-[10px] font-black uppercase tracking-widest text-zinc-500">
              <button onClick={onMagazineClick} className="hover:text-amber-500 transition-colors">Magazine</button>
              <button onClick={onToolsClick}    className="hover:text-amber-500 transition-colors">Tools</button>
              <button onClick={onUnder30Click}  className="hover:text-amber-500 transition-colors">Under30</button>
              <button onClick={onSubscribeClick} className="hover:text-amber-500 transition-colors">Subscribe</button>
            </div>
          </div>
          <div className="border-t border-zinc-900 pt-6 text-center">
            <p className="text-zinc-700 text-[10px] uppercase tracking-widest font-bold">
              © 2026 BusinessRun Platform. All Rights Reserved.
            </p>
          </div>
        </div>
      </footer>

    </div>
  );
}
