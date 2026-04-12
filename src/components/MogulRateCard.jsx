import React, { useRef } from 'react';
import {
  Radar, RadarChart, PolarGrid, PolarAngleAxis,
  PolarRadiusAxis, ResponsiveContainer,
} from 'recharts';
import { Download, RefreshCcw, Zap, Award, TrendingUp } from 'lucide-react';
import { toPng } from 'html-to-image';

const PILLAR_MAX = {
  Foundation: 80,
  Operations: 70,
  Execution:  85,
  Growth:     80,
};

const RANK_META = {
  Nomad:    { bg: 'bg-zinc-800',             border: 'border-zinc-700',    text: 'text-zinc-300',   desc: 'Your empire is just getting started. The foundations are shaky — fix the basics before the market tests you.' },
  Operator: { bg: 'bg-amber-950/40',         border: 'border-amber-800/50',text: 'text-amber-600',  desc: 'You\'re in the arena. Systems are forming, but inconsistencies are costing you — tighten your operations.' },
  Scaler:   { bg: 'bg-amber-500/10',         border: 'border-amber-500/30',text: 'text-amber-400',  desc: 'A serious force. You have the structure — now push harder on growth and stop leaving profit on the table.' },
  Mogul:    { bg: 'bg-amber-500/20',         border: 'border-amber-500/50',text: 'text-amber-400',  desc: 'Rare. Your business is built like a castle — registered, systematised, scaling. Protect the fortress.' },
};

const PILLAR_ICONS = {
  Foundation: '🏛️',
  Operations: '⚙️',
  Execution:  '⚔️',
  Growth:     '📈',
};

export default function MogulRateCard({ scores, totalScore, rank, radarData, onRestart }) {
  const cardRef = useRef(null);

  const lowestPillar = Object.entries(scores).reduce((a, b) => a[1] < b[1] ? a : b)[0];
  const highestPillar = Object.entries(scores).reduce((a, b) => a[1] > b[1] ? a : b)[0];

  const meta = RANK_META[rank.title] || RANK_META.Nomad;

  async function downloadCard() {
    if (!cardRef.current) return;
    try {
      const dataUrl = await toPng(cardRef.current, {
        backgroundColor: '#09090b',
        pixelRatio: 2,
      });
      const link      = document.createElement('a');
      link.download   = `mogul-rate-${rank.title.toLowerCase()}-${totalScore}.png`;
      link.href       = dataUrl;
      link.click();
    } catch (err) {
      console.error('Download failed:', err);
    }
  }

  return (
    <div className="space-y-6">

      {/* ── Downloadable card ─────────────────────────────── */}
      <div
        ref={cardRef}
        className="bg-zinc-950 border border-zinc-800 rounded-[2rem] overflow-hidden p-8"
      >
        {/* Card header */}
        <div className="text-center mb-8">
          <p className="text-[9px] font-black uppercase tracking-[0.3em] text-zinc-600 mb-3">
            BusinessRun · Mogul Audit
          </p>
          <h2 className="text-3xl font-black uppercase tracking-tight text-white mb-1">
            Rate Card
          </h2>
          <p className="text-zinc-600 text-xs">Founder's Might Assessment</p>
        </div>

        {/* Rank badge */}
        <div className={`${meta.bg} border ${meta.border} rounded-2xl px-6 py-5 text-center mb-6`}>
          <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500 mb-1">Your Rank</p>
          <p className={`text-5xl font-black uppercase tracking-tighter ${meta.text}`}>
            {rank.title}
          </p>
          <p className="text-zinc-500 text-xs mt-2 leading-relaxed max-w-xs mx-auto">
            {meta.desc}
          </p>
        </div>

        {/* Total score */}
        <div className="flex items-center justify-center gap-4 mb-8">
          <div className="text-center">
            <p className="text-6xl font-black text-white tracking-tighter">{totalScore}</p>
            <p className="text-[9px] font-black uppercase tracking-widest text-zinc-600 mt-1">
              Might Score
            </p>
          </div>
        </div>

        {/* Radar chart */}
        <div className="h-64 mb-8">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={radarData} margin={{ top: 10, right: 30, bottom: 10, left: 30 }}>
              <PolarGrid stroke="#27272a" />
              <PolarAngleAxis
                dataKey="pillar"
                tick={{ fill: '#71717a', fontSize: 11, fontWeight: 700 }}
              />
              <PolarRadiusAxis
                angle={30}
                domain={[0, 100]}
                tick={false}
                axisLine={false}
              />
              <Radar
                name="Score"
                dataKey="normalised"
                stroke="#f59e0b"
                fill="#f59e0b"
                fillOpacity={0.25}
                strokeWidth={2}
              />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        {/* Pillar breakdown */}
        <div className="space-y-3 mb-6">
          <p className="text-[9px] font-black uppercase tracking-widest text-zinc-600 mb-3">
            Pillar Breakdown
          </p>
          {Object.entries(scores).map(([pillar, score]) => {
            const max  = PILLAR_MAX[pillar];
            const pct  = Math.round((score / max) * 100);
            const isLow  = pillar === lowestPillar;
            const isHigh = pillar === highestPillar;
            return (
              <div key={pillar}>
                <div className="flex justify-between items-center mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{PILLAR_ICONS[pillar]}</span>
                    <span className="text-xs font-black uppercase tracking-widest text-zinc-400">
                      {pillar}
                    </span>
                    {isHigh && (
                      <span className="text-[8px] font-black text-green-400 bg-green-400/10 px-2 py-0.5 rounded-full uppercase tracking-widest">
                        Strength
                      </span>
                    )}
                    {isLow && (
                      <span className="text-[8px] font-black text-red-400 bg-red-400/10 px-2 py-0.5 rounded-full uppercase tracking-widest">
                        Focus Here
                      </span>
                    )}
                  </div>
                  <span className="text-xs font-black font-mono text-zinc-300">
                    {score}<span className="text-zinc-700">/{max}</span>
                  </span>
                </div>
                <div className="h-2 bg-zinc-900 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${
                      isLow  ? 'bg-red-500/70'   :
                      isHigh ? 'bg-green-500/70'  :
                               'bg-amber-500'
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Strategic insight */}
        <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl px-5 py-4">
          <div className="flex items-start gap-3">
            <Zap size={14} className="text-amber-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-[9px] font-black uppercase tracking-widest text-amber-500 mb-1">
                Strategic Insight
              </p>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Your strongest pillar is <strong className="text-zinc-200">{highestPillar}</strong> — defend it.
                Your biggest opportunity is <strong className="text-zinc-200">{lowestPillar}</strong> — every point
                you gain there compounds across the entire business.
              </p>
            </div>
          </div>
        </div>

        {/* Card footer */}
        <div className="mt-6 pt-4 border-t border-zinc-900 flex items-center justify-between">
          <span className="text-[9px] font-black uppercase tracking-widest text-zinc-700">
            thebusinessrun.com
          </span>
          <span className="text-[9px] font-black uppercase tracking-widest text-zinc-700">
            {new Date().toLocaleDateString('en-NG', { month: 'short', year: 'numeric' })}
          </span>
        </div>
      </div>

      {/* ── Action buttons ──────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <button
          onClick={downloadCard}
          className="flex-1 flex items-center justify-center gap-2 py-4 bg-amber-500 text-black font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-amber-400 transition-all active:scale-95"
        >
          <Download size={16} /> Download Rate Card
        </button>
        <button
          onClick={onRestart}
          className="flex items-center justify-center gap-2 px-6 py-4 bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700 font-black text-xs uppercase tracking-widest rounded-2xl transition-all"
        >
          <RefreshCcw size={14} /> Retake
        </button>
      </div>

      <p className="text-[10px] text-zinc-700 text-center uppercase tracking-widest">
        Download saves as a shareable PNG image
      </p>
    </div>
  );
}
