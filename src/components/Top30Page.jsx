import React, { useState } from 'react';
import { Award, ChevronRight, Filter, Share2 } from 'lucide-react';

// ─────────────────────────────────────────────────────────────
// Data
// ─────────────────────────────────────────────────────────────
const categories = ['All', 'Finance', 'Tech', 'Art & Style', 'Social Impact', 'Retail'];

const honorees = [
  {
    id: 1,
    name: "Chidera Okoro",
    company: "NeoBank Africa",
    category: "Finance",
    age: 28,
    img: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?q=80&w=600&h=800&fit=crop",
    bio: "Redefining digital payments for the unbanked across West Africa.",
  },
  {
    id: 2,
    name: "Tobi Adeyemi",
    company: "GreenLogistics",
    category: "Tech",
    age: 26,
    img: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?q=80&w=600&h=800&fit=crop",
    bio: "Solving the last-mile delivery crisis with AI-optimized routing.",
  },
  {
    id: 3,
    name: "Aisha Bello",
    company: "Bello Couture",
    category: "Art & Style",
    age: 24,
    img: "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?q=80&w=600&h=800&fit=crop",
    bio: "Blending traditional Nigerian textiles with modern high-fashion silhouettes.",
  },
  {
    id: 4,
    name: "David Mensah",
    company: "FarmBase",
    category: "Social Impact",
    age: 29,
    img: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?q=80&w=600&h=800&fit=crop",
    bio: "Connecting smallholder farmers directly to global export markets.",
  },
  {
    id: 5,
    name: "Kemi Silva",
    company: "LuxeStay",
    category: "Retail",
    age: 27,
    img: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?q=80&w=600&h=800&fit=crop",
    bio: "The premier marketplace for luxury short-let apartments in Lagos.",
  },
  {
    id: 6,
    name: "Samuel Okafor",
    company: "Vantage AI",
    category: "Tech",
    age: 25,
    img: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?q=80&w=600&h=800&fit=crop",
    bio: "Democratizing enterprise-level analytics for SMEs.",
  },
  {
    id: 7,
    name: "Ngozi Eze",
    company: "HealthBridge",
    category: "Social Impact",
    age: 27,
    img: "https://images.unsplash.com/photo-1580489944761-15a19d654956?q=80&w=600&h=800&fit=crop",
    bio: "Bringing telemedicine to rural communities across the Niger Delta.",
  },
  {
    id: 8,
    name: "Emeka Nwosu",
    company: "TradeStack",
    category: "Finance",
    age: 29,
    img: "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?q=80&w=600&h=800&fit=crop",
    bio: "Building Africa's first retail stock trading platform with zero commission.",
  },
  {
    id: 9,
    name: "Fatima Suleiman",
    company: "CraftHouse",
    category: "Art & Style",
    age: 23,
    img: "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?q=80&w=600&h=800&fit=crop",
    bio: "A digital marketplace scaling artisan crafts from Kano to the world.",
  },
];

// ─────────────────────────────────────────────────────────────
// Top30Page
// ─────────────────────────────────────────────────────────────
export default function Top30Page({ onBack }) {
  const [activeCategory, setActiveCategory] = useState('All');

  const filtered = honorees.filter(
    h => activeCategory === 'All' || h.category === activeCategory
  );

  return (
    <div className="min-h-screen bg-black font-sans text-zinc-100">

      {/* ── Breadcrumb sub-bar ────────────────────────────── */}
      <div className="bg-zinc-950 border-b border-zinc-900 px-4 sm:px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs sm:text-sm min-w-0">
            <button
              onClick={onBack}
              className="text-zinc-500 hover:text-amber-500 transition font-bold shrink-0"
            >
              BusinessRun
            </button>
            <span className="text-zinc-700">/</span>
            <span className="text-zinc-200 font-bold shrink-0">Top 30 Under 30</span>
          </div>
          <span className="text-xs text-zinc-500 font-medium shrink-0 ml-4">Class of 2025</span>
        </div>
      </div>

      {/* ── Hero ─────────────────────────────────────────── */}
      <section className="relative bg-zinc-950 overflow-hidden">
        {/* Background image */}
        <div
          className="absolute inset-0 bg-cover bg-center opacity-20"
          style={{ backgroundImage: "url('https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=2070')" }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-slate-900/60 via-slate-900/40 to-slate-900" />

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-20 sm:py-28 md:py-36 text-center">

          {/* Eyebrow */}
          <div className="flex justify-center items-center gap-4 mb-6">
            <div className="h-px w-10 bg-zinc-9000" />
            <span className="text-zinc-500 uppercase tracking-[0.35em] text-xs font-semibold">
              Special Issue · Annual Edition
            </span>
            <div className="h-px w-10 bg-zinc-9000" />
          </div>

          {/* Headline */}
          <h1 className="text-6xl sm:text-7xl md:text-9xl font-black italic tracking-tighter text-white leading-none uppercase mb-3">
            30
          </h1>
          <p className="text-2xl sm:text-3xl md:text-5xl font-black uppercase tracking-[0.15em] text-white mb-6">
            Under 30
          </p>
          <p className="max-w-xl mx-auto text-zinc-500 text-base sm:text-lg font-light leading-relaxed">
            The definitive annual guide to the young innovators, trailblazers,
            and disruptors shaping the Nigerian economy.
          </p>

          {/* Stats */}
          <div className="mt-10 sm:mt-14 flex flex-wrap justify-center gap-8 sm:gap-16">
            {[
              { value: '$140M+', label: 'Capital Raised' },
              { value: '4,500+', label: 'Jobs Created' },
              { value: '9',      label: 'Industries'    },
            ].map(stat => (
              <div key={stat.label} className="text-left border-l-2 border-slate-600 pl-4">
                <div className="text-xl sm:text-2xl font-bold italic text-white">{stat.value}</div>
                <div className="text-[10px] uppercase tracking-widest text-zinc-500 mt-0.5">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Category filter bar ───────────────────────────── */}
      <div className="sticky top-16 z-40 bg-zinc-950 border-b border-zinc-900 overflow-x-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center gap-6 sm:gap-8 min-w-max">
          <div className="flex items-center gap-2 text-zinc-500">
            <Filter size={13} />
            <span className="text-[10px] font-bold uppercase tracking-widest">Industry:</span>
          </div>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`text-[11px] font-bold uppercase tracking-[0.18em] transition-all whitespace-nowrap pb-0.5 ${
                activeCategory === cat
                  ? 'text-zinc-100 border-b-2 border-slate-900'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* ── Honoree grid ─────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-16 md:py-20">

        {filtered.length === 0 ? (
          <div className="text-center py-24 text-zinc-500">
            <Award size={32} className="mx-auto mb-4 opacity-30" />
            <p className="text-sm font-medium">No honorees in this category yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-12 sm:gap-y-16">
            {filtered.map(person => (
              <div key={person.id} className="group cursor-pointer">

                {/* Photo */}
                <div className="relative aspect-[3/4] overflow-hidden bg-zinc-800 rounded-xl">
                  <img
                    src={person.img}
                    alt={person.name}
                    className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700 group-hover:scale-105"
                  />
                  {/* Share icon */}
                  <div className="absolute top-3 right-3 bg-zinc-950/80 backdrop-blur-sm p-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-sm">
                    <Share2 size={14} className="text-zinc-400" />
                  </div>
                  {/* Rank number */}
                  <div className="absolute top-5 left-5 text-5xl font-black text-white/20 group-hover:text-white/30 transition-colors leading-none select-none">
                    #{person.id}
                  </div>
                  {/* Category pill */}
                  <div className="absolute bottom-3 left-3">
                    <span className="bg-zinc-950/90 backdrop-blur-sm text-zinc-400 text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full">
                      {person.category}
                    </span>
                  </div>
                </div>

                {/* Info */}
                <div className="mt-5 pl-3 border-l-2 border-transparent group-hover:border-slate-300 transition-all duration-300">
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <h3 className="text-lg font-bold uppercase tracking-tight text-zinc-100 leading-tight">
                        {person.name}, <span className="font-normal text-zinc-500">{person.age}</span>
                      </h3>
                      <p className="text-xs font-bold uppercase tracking-widest text-zinc-500 mt-1">
                        {person.company}
                      </p>
                    </div>
                    <Award
                      size={18}
                      className="text-slate-200 group-hover:text-zinc-500 transition-colors flex-shrink-0 mt-1"
                    />
                  </div>
                  <p className="text-zinc-500 text-sm mt-3 leading-relaxed line-clamp-2">
                    {person.bio}
                  </p>
                  <div className="mt-4 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-zinc-500 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-1 group-hover:translate-y-0">
                    Read Profile <ChevronRight size={12} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Nomination CTA ────────────────────────────────── */}
      <section className="bg-zinc-950 py-20 sm:py-24 mt-8">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 text-center">
          <div className="flex justify-center items-center gap-4 mb-6">
            <div className="h-px w-8 bg-slate-600" />
            <span className="text-zinc-500 uppercase tracking-[0.3em] text-[10px] font-semibold">
              Class of 2026
            </span>
            <div className="h-px w-8 bg-slate-600" />
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-black italic uppercase tracking-tighter text-white mb-5">
            Know a Visionary?
          </h2>
          <p className="text-zinc-500 text-sm sm:text-base leading-relaxed mb-10 font-light">
            Nominations for the 2026 Class are now open. We are looking for
            the next generation of builders shaping Africa's future.
          </p>
          <button className="group relative px-10 py-4 bg-zinc-950 text-zinc-100 font-bold uppercase text-xs tracking-[0.25em] overflow-hidden rounded-xl hover:text-white transition-colors duration-300">
            <span className="relative z-10">Nominate Now</span>
            <div className="absolute inset-0 bg-slate-700 rounded-xl transform translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
          </button>
        </div>
      </section>

    </div>
  );
}
