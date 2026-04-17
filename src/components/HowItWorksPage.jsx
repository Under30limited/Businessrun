import React from 'react';
import { ArrowLeft, Zap, Shield, Database, Bot, TrendingUp, RefreshCw } from 'lucide-react';

const TECH_SECTIONS = [
  {
    icon:    <Bot size={22} />,
    title:   'The AI Layer',
    label:   'Powered by Gemini 2.0 Flash',
    body:    `Every intelligent feature on BusinessRun — from the Strategic AI Advisor to the Accounting Reports and the Roadmap Insights — runs on Google's Gemini 2.0 Flash model. We selected Gemini for its speed, its ability to reason about complex financial and business contexts, and its strong performance on Nigerian and African market knowledge.\n\nWe do not store your conversations. Every session is stateless — your questions go to the model and the responses come back directly to your screen. No conversation history is retained between sessions on our servers.`,
  },
  {
    icon:    <Shield size={22} />,
    title:   'Data Security',
    label:   'Your data stays yours',
    body:    `BusinessRun does not sell your data. When you complete the Grow Your Business onboarding, your business profile is stored in a secured Google Sheet that only the BusinessRun editorial team can access. We use session IDs — not cookies or tracking pixels — to link your journey through the onboarding flow.\n\nPasswords collected at the Save Profile stage are stored as plain text in the sheet and are used solely to identify returning users. We recommend using a unique password for this service.`,
  },
  {
    icon:    <Zap size={22} />,
    title:   'Cloudflare Edge Functions',
    label:   'Server-side API calls — your key never touches the browser',
    body:    `All calls to the Gemini API are made server-side via Cloudflare Pages Functions — small pieces of code that run on Cloudflare's global edge network, physically close to you. This means your API keys are never exposed in the browser, your requests are fast regardless of where you are in Nigeria or Africa, and the platform stays responsive even under load.\n\nThe functions handle the AI Advisor chat, the Accounting report generation, and the dynamic Roadmap insight generation — all in under 2 seconds on average.`,
  },
  {
    icon:    <Database size={22} />,
    title:   'Google Sheets as a Database',
    label:   'Simple, auditable, and zero infrastructure cost',
    body:    `BusinessRun uses Google Sheets as its primary data store via Google Apps Script Web Apps. This is a deliberate architectural choice: it keeps the infrastructure cost at zero, makes every record auditable by the editorial team without any database tooling, and allows us to export, filter, and act on data using tools that non-technical team members already know.\n\nEach product area — nominations, onboarding, subscriptions, resource requests — has its own dedicated sheet and Apps Script endpoint. Data is never co-mingled between them.`,
  },
  {
    icon:    <TrendingUp size={22} />,
    title:   'The Mogul Audit Engine',
    label:   '16 questions · 4 pillars · weighted scoring',
    body:    `The Founder's Might audit uses a weighted scoring model across four business pillars: Foundation, Operations, Execution, and Growth. Each question carries a specific weight reflecting its real-world importance to business survival and scale in the Nigerian market.\n\nScores are calculated entirely in the browser — no server call is made during the quiz. The resulting score and radar chart are rendered client-side using Recharts. The downloadable Rate Card is generated as a PNG using the html-to-image library, again entirely in the browser with no upload to any server.`,
  },
  {
    icon:    <RefreshCw size={22} />,
    title:   'Progressive Web Architecture',
    label:   'React · React Router · Tailwind CSS · Cloudflare Pages',
    body:    `BusinessRun is a single-page React application deployed on Cloudflare Pages. Navigation between pages updates the browser URL without a full page reload — giving you app-like speed with shareable, bookmarkable URLs.\n\nAll pages are accessible directly by URL: /magazine/article/1 opens the first article, /mogul-audit opens the business quiz, /your-roadmap opens your personalised dashboard. The Cloudflare _redirects file ensures that refreshing any URL brings you back to the correct page rather than a 404.`,
  },
];

export default function HowItWorksPage({ onBack }) {
  return (
    <div className="min-h-screen bg-black text-zinc-100">

      {/* ── Header ──────────────────────────────────────────── */}
      <div className="border-b border-zinc-900 bg-zinc-950">
        <div className="max-w-4xl mx-auto px-6 py-8">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-zinc-500 hover:text-amber-500 transition mb-6 text-xs font-black uppercase tracking-widest group"
          >
            <ArrowLeft size={13} className="group-hover:-translate-x-1 transition-transform" />
            Back to Home
          </button>
          <div className="flex items-center gap-2 mb-3">
            <span className="text-[10px] font-black uppercase tracking-widest text-amber-500 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20">
              Technical Deep Dive
            </span>
          </div>
          <h1 className="text-4xl md:text-5xl font-black tracking-tighter italic uppercase mb-2">
            How It Works
          </h1>
          <p className="text-zinc-500 text-sm leading-relaxed max-w-xl">
            BusinessRun is built on a lean, fast, and honest technology stack.
            Here is exactly what powers every feature — no buzzwords, no vague claims.
          </p>
        </div>
      </div>

      {/* ── Tech sections ────────────────────────────────────── */}
      <div className="max-w-4xl mx-auto px-6 py-12 space-y-6">
        {TECH_SECTIONS.map((section, i) => (
          <div
            key={i}
            className="bg-zinc-950 border border-zinc-800 rounded-[2rem] overflow-hidden"
          >
            {/* Section header */}
            <div className="border-b border-zinc-900 px-8 py-5 flex items-start gap-4">
              <div className="w-11 h-11 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center justify-center text-amber-500 shrink-0 mt-0.5">
                {section.icon}
              </div>
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-zinc-600 mb-1">
                  {section.label}
                </p>
                <h2 className="text-white font-black text-lg">{section.title}</h2>
              </div>
            </div>

            {/* Body */}
            <div className="px-8 py-7">
              {section.body.split('\n\n').map((para, j) => (
                <p key={j} className="text-zinc-400 text-sm leading-relaxed mb-4 last:mb-0">
                  {para}
                </p>
              ))}
            </div>
          </div>
        ))}

        {/* Footer note */}
        <div className="border border-zinc-800 rounded-2xl px-6 py-5 flex items-start gap-3">
          <Shield size={14} className="text-zinc-600 mt-0.5 shrink-0" />
          <p className="text-zinc-600 text-xs leading-relaxed">
            BusinessRun is built and maintained by a small editorial and engineering team in Nigeria.
            We are not a data company. We build tools that help African founders run better businesses.
            Questions about our infrastructure? Reach us at{' '}
            <a href="mailto:tech@thebusinessrun.com" className="text-amber-500 hover:text-amber-400 transition">
              tech@thebusinessrun.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
