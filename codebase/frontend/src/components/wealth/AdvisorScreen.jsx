import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, RefreshCcw, Send, Loader2 } from 'lucide-react';

const GREETING = "I'm your Wealth Advisor. Ask me about your spending, your goals, your debts — anything logged so far.";

export default function AdvisorScreen() {
  const [messages, setMessages] = useState([{ role: 'assistant', content: GREETING }]);
  const [input, setInput]       = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [advisorDown, setAdvisorDown] = useState(false);
  const [hasPersistedHistory, setHasPersistedHistory] = useState(false);
  const chatBoxRef = useRef(null);
  const sentThisSessionRef = useRef(false);

  // Hydrate the persisted thread on mount — same reasoning as the
  // business Advisor: resume the real conversation instead of always
  // starting blank when this tab is reopened.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/personal/advisor/history', { credentials: 'include' });
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && Array.isArray(data.messages) && data.messages.length > 0) {
          setMessages(data.messages.map(m => ({ role: m.role, content: m.content })));
          setHasPersistedHistory(true);
        }
      } catch {
        // Non-fatal — keep the local greeting.
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (chatBoxRef.current) {
      chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight;
    }
  }, [messages]);

  async function sendMessage(e) {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    const isFirstMessageThisSession = !sentThisSessionRef.current;
    sentThisSessionRef.current = true;

    const next = [...messages, { role: 'user', content: trimmed }];
    setMessages(next);
    setInput('');
    setIsLoading(true);
    setAdvisorDown(false);

    try {
      const history = next
        .slice(hasPersistedHistory ? 0 : 1)
        .slice(0, -1)
        .slice(-20)
        .map(m => ({ role: m.role, content: m.content }));

      const res = await fetch('/api/personal/advisor', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed, history, refreshContext: isFirstMessageThisSession }),
      });
      const data = await res.json();

      if (data.advisorDown || !data.text?.trim()) {
        setAdvisorDown(true);
      } else {
        setMessages(p => [...p, { role: 'assistant', content: data.text }]);
      }
    } catch {
      setAdvisorDown(true);
    } finally {
      setIsLoading(false);
    }
  }

  async function clearChat() {
    sentThisSessionRef.current = false;
    setHasPersistedHistory(false);
    setMessages([{ role: 'assistant', content: 'Chat cleared. How can I help?' }]);
    try {
      await fetch('/api/personal/advisor/history', { method: 'DELETE', credentials: 'include' });
    } catch {
      // Non-fatal — worst case the old thread resurfaces on next reopen.
    }
  }

  return (
    <div className="flex flex-col h-full" style={{ minHeight: '70vh' }}>
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="bg-amber-500/10 p-2 rounded-xl">
            <Sparkles className="text-amber-500" size={18} />
          </div>
          <div>
            <p className="text-sm font-black uppercase tracking-widest text-zinc-900 flex items-center gap-2">
              Wealth Advisor
              <span className="flex h-2 w-2 rounded-full bg-green-500 animate-pulse" />
            </p>
            <p className="text-[10px] text-zinc-500 uppercase font-bold tracking-tighter">Personal Wealth OS</p>
          </div>
        </div>
        <button onClick={clearChat}
          className="p-2.5 bg-zinc-100 hover:bg-zinc-200 rounded-xl text-zinc-600 hover:text-zinc-900 transition-all" title="Clear chat">
          <RefreshCcw size={15} />
        </button>
      </div>

      <div ref={chatBoxRef} className="flex-1 overflow-y-auto space-y-3 mb-4 pr-1">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
              m.role === 'user' ? 'bg-zinc-900 text-white' : 'bg-white border border-zinc-200 text-zinc-800'
            }`}>
              {m.content}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white border border-zinc-200 rounded-2xl px-4 py-2.5 text-sm text-zinc-400 flex items-center gap-2">
              <Loader2 size={13} className="animate-spin" /> Thinking...
            </div>
          </div>
        )}
        {advisorDown && (
          <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 text-sm text-red-700">
            The advisor is currently down. Please try again shortly.
          </div>
        )}
      </div>

      <form onSubmit={sendMessage} className="flex items-center gap-2">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Ask about your spending, goals, or debts..."
          maxLength={2000}
          className="flex-1 bg-white border border-zinc-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-amber-500"
        />
        <button type="submit" disabled={isLoading || !input.trim()}
          className="p-3 bg-amber-500 text-black rounded-xl hover:bg-amber-400 transition disabled:opacity-50">
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}
