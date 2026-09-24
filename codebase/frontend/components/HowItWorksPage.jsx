import React from 'react';
import { ArrowLeft, ArrowRight } from 'lucide-react';

const HOW_IT_WORKS = [
  {
    number: '01',
    title:  'The Diagnostic',
    label:  'The Assessment',
    icon:   '🩺',
    body:   'Every journey on BusinessRun starts with our Business Pulse Diagnostic. By capturing your sector, revenue bracket, and operational "headache," our system creates a unique Financial Identity for your business.',
    tech:   'We use specialized data-tagging to categorize your business signals instantly.',
  },
  {
    number: '02',
    title:  'Strategic Matchmaking',
    label:  'The Work',
    icon:   '🔗',
    body:   'Once your profile is active, BusinessRun performs the "Work" of a Procurement Manager. We analyze our network of verified partners — from GIG Logistics to specialized Lenders — to find the ones that match your specific scale.',
    tech:   'Our matching algorithm prioritizes partners based on your real-time "Headache" and revenue capacity, ensuring you only see partners that can actually help you grow.',
  },
  {
    number: '03',
    title:  'The Virtual Expert',
    label:  'The Intelligence',
    icon:   '🧠',
    body:   'For complex business questions — from tax registration to market expansion — you have access to the TBR Virtual Expert. Unlike a basic search engine, this expert understands the Nigerian business landscape.',
    tech:   'Powered by Google\'s Vertex AI, our expert processes high-level business logic to provide executive-grade advice on demand.',
  },
  {
    number: '04',
    title:  'Digital Integrity',
    label:  'The Trust',
    icon:   '🔒',
    body:   'As you use our Daily Profit Manager (CFO), the system builds your "Trust Score." This score is what we use to negotiate lower interest rates and better logistics deals on your behalf.',
    tech:   'We utilize secure cloud infrastructure to ensure your data is encrypted, private, and used only to unlock growth opportunities for you.',
  },
];

const STEPS = [
  {
    step:   '1',
    title:  'Run the Pulse',
    desc:   'Click "Grow Your Business" and answer the 3-step diagnostic.',
  },
  {
    step:   '2',
    title:  'Activate Your Roadmap',
    desc:   'Review your Verified Connections and activation tasks.',
  },
  {
    step:   '3',
    title:  'Delegate & Scale',
    desc:   'Use the Virtual Expert for your daily business decisions and the Profit Manager to keep your books audit-ready.',
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
          <span className="text-[10px] font-black uppercase tracking-widest text-amber-500 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20">
            Our Technology
          </span>
          <h1 className="text-4xl md:text-5xl font-black tracking-tighter italic uppercase mt-4 mb-2">
            How It Works
          </h1>
          <p className="text-zinc-500 text-sm leading-relaxed max-w-xl">
            A transparent look at the four pillars powering the BusinessRun platform.
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-12 space-y-6">

        {/* ── Four pillars ─────────────────────────────────── */}
        {HOW_IT_WORKS.map((section, i) => (
          <div key={i} className="bg-zinc-950 border border-zinc-800 rounded-[2rem] overflow-hidden">

            {/* Header row */}
            <div className="border-b border-zinc-900 px-8 py-5 flex items-start gap-5">
              <div className="shrink-0 flex flex-col items-center gap-1">
                <span className="text-3xl leading-none">{section.icon}</span>
                <span className="text-[9px] font-black text-zinc-700 uppercase tracking-widest">{section.number}</span>
              </div>
              <div>
                <p className="text-[9px] font-black uppercase tracking-widest text-amber-500 mb-1">
                  {section.label}
                </p>
                <h2 className="text-white font-black text-xl">{section.title}</h2>
              </div>
            </div>

            {/* Body */}
            <div className="px-8 py-7 space-y-4">
              <p className="text-zinc-400 text-sm leading-relaxed">{section.body}</p>
              <div className="flex items-start gap-3 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3">
                <span className="text-amber-500 text-xs font-black uppercase tracking-widest shrink-0 mt-0.5">The Tech:</span>
                <p className="text-zinc-400 text-xs leading-relaxed">{section.tech}</p>
              </div>
            </div>
          </div>
        ))}

        {/* ── How to Guide ─────────────────────────────────── */}
        <div className="bg-amber-500 rounded-[2rem] px-8 py-10 mt-4">
          <p className="text-[10px] font-black uppercase tracking-widest text-black/60 mb-2">How to Guide</p>
          <h2 className="text-black font-black text-2xl italic uppercase mb-8">
            3 Steps to Success
          </h2>
          <div className="space-y-5">
            {STEPS.map((s, i) => (
              <div key={i} className="flex items-start gap-5">
                <div className="w-10 h-10 bg-black text-amber-500 rounded-xl flex items-center justify-center font-black text-sm shrink-0">
                  {s.step}
                </div>
                <div>
                  <p className="text-black font-black text-sm uppercase tracking-widest mb-0.5">{s.title}</p>
                  <p className="text-black/70 text-sm leading-relaxed">{s.desc}</p>
                </div>
              </div>
            ))}
          </div>

          <button
            onClick={onBack}
            className="mt-8 flex items-center gap-2 bg-black text-amber-500 px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-zinc-900 transition"
          >
            Get Started <ArrowRight size={13} />
          </button>
        </div>

      </div>
    </div>
  );
}
