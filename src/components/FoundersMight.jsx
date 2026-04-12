import React, { useState, useMemo } from 'react';
import { ArrowLeft, ChevronRight } from 'lucide-react';
import MogulRateCard from './MogulRateCard';

// ─────────────────────────────────────────────────────────────
// Quiz Data
// ─────────────────────────────────────────────────────────────
const QUESTIONS = [
  // Foundation
  { id: 'cac',       pillar: 'Foundation', text: 'Is your business CAC registered?',                                                                                                           options: [{ text: 'Yes', weight: 20 }, { text: 'In Progress', weight: 10 }, { text: 'No', weight: 0 }] },
  { id: 'bank',      pillar: 'Foundation', text: 'Do you have a dedicated business bank account?',                                                                                             options: [{ text: 'Dedicated', weight: 20 }, { text: 'Personal', weight: 0 }] },
  { id: 'tax',       pillar: 'Foundation', text: 'Are your tax papers (TIN) ready for a royal audit?',                                                                                        options: [{ text: 'Yes', weight: 15 }, { text: 'No', weight: 0 }] },
  { id: 'runway',    pillar: 'Foundation', text: 'If the market goes silent for 3 months, do you have enough grain in the storehouse to survive?',                                            options: [{ text: 'Yes', weight: 25 }, { text: 'No', weight: 0 }] },

  // Operations
  { id: 'staff',      pillar: 'Operations', text: 'How many warriors (staff) follow your lead?',                                                                                              options: [{ text: '0–2', weight: 5 }, { text: '3–10', weight: 10 }, { text: '10+', weight: 15 }] },
  { id: 'delegation', pillar: 'Operations', text: 'Are you fighting every battle, or do you have captains you trust with tasks?',                                                             options: [{ text: 'Delegated', weight: 20 }, { text: 'I do everything', weight: 0 }] },
  { id: 'feedback',   pillar: 'Operations', text: 'When a customer complains, do you have a system to capture the issue and fix it?',                                                        options: [{ text: 'Systemised', weight: 15 }, { text: 'Informal', weight: 5 }, { text: 'No', weight: 0 }] },
  { id: 'response',   pillar: 'Operations', text: 'How long does it take for a customer to get a response?',                                                                                  options: [{ text: 'Under 1 hr', weight: 20 }, { text: 'Under 24 hrs', weight: 10 }, { text: 'Days', weight: 0 }] },

  // Execution
  { id: 'target',    pillar: 'Execution', text: 'What is your daily sales target hit rate?',                                                                                                   options: [{ text: '90%+', weight: 25 }, { text: '50%+', weight: 10 }, { text: 'Below 50%', weight: 0 }] },
  { id: 'ledger',    pillar: 'Execution', text: 'How often do you record your figures in the business ledger (balance sheet, cash flows etc.)?',                                              options: [{ text: 'Real-time', weight: 20 }, { text: 'Daily', weight: 10 }, { text: 'Weekly', weight: 0 }] },
  { id: 'retention', pillar: 'Execution', text: 'How many of your customers are returning vs new?',                                                                                           options: [{ text: 'High Retention', weight: 20 }, { text: 'Mostly New', weight: 5 }] },
  { id: 'margin',    pillar: 'Execution', text: 'After expenses and liabilities, do you know exactly how much profit is yours to keep?',                                                     options: [{ text: 'Yes', weight: 20 }, { text: "I'm guessing", weight: 0 }] },

  // Growth
  { id: 'fx',          pillar: 'Growth', text: 'Do you check FX rates (dollar/naira) before pricing?',                                                                                       options: [{ text: 'Daily', weight: 25 }, { text: 'Rarely', weight: 5 }, { text: 'Never', weight: 0 }] },
  { id: 'innovation',  pillar: 'Growth', text: 'Have you added a new product or service to your business in the last 6 months?',                                                             options: [{ text: 'Yes', weight: 20 }, { text: 'No', weight: 0 }] },
  { id: 'competitor',  pillar: 'Growth', text: 'Do you know who your competitors are and what they charge?',                                                                                  options: [{ text: 'Yes', weight: 15 }, { text: 'No', weight: 0 }] },
  { id: 'reinvestment',pillar: 'Growth', text: 'Do you reinvest profits back into the business or spend on lifestyle?',                                                                       options: [{ text: 'Reinvesting', weight: 20 }, { text: 'Lifestyle', weight: 0 }] },
];

const PILLARS = ['Foundation', 'Operations', 'Execution', 'Growth'];

// Max possible score per pillar for accurate radar domain
const PILLAR_MAX = {
  Foundation: 80,  // 20+20+15+25
  Operations: 70,  // 15+20+15+20
  Execution:  85,  // 25+20+20+20
  Growth:     80,  // 25+20+15+20
};

const PILLAR_ICONS = {
  Foundation: '🏛️',
  Operations: '⚙️',
  Execution:  '⚔️',
  Growth:     '📈',
};

// ─────────────────────────────────────────────────────────────
// FoundersMight
// ─────────────────────────────────────────────────────────────
export default function FoundersMight({ onBack }) {
  const [answers, setAnswers]             = useState({});
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selected, setSelected]           = useState(null); // highlight chosen answer briefly

  const scores = useMemo(() => {
    const s = { Foundation: 0, Operations: 0, Execution: 0, Growth: 0 };
    for (const id in answers) {
      const q = QUESTIONS.find(q => q.id === id);
      if (q) s[q.pillar] += answers[id];
    }
    return s;
  }, [answers]);

  const totalScore = useMemo(() =>
    Object.values(scores).reduce((a, b) => a + b, 0)
  , [scores]);

  const rank = useMemo(() => {
    if (totalScore <= 60)  return { title: 'Nomad',    color: 'text-zinc-400'   };
    if (totalScore <= 120) return { title: 'Operator', color: 'text-amber-600'  };
    if (totalScore <= 200) return { title: 'Scaler',   color: 'text-amber-400'  };
    return                        { title: 'Mogul',    color: 'text-amber-500'  };
  }, [totalScore]);

  const radarData = PILLARS.map(pillar => ({
    pillar,
    score: scores[pillar],
    max:   PILLAR_MAX[pillar],
    // Normalise to 0-100 for consistent radar display
    normalised: Math.round((scores[pillar] / PILLAR_MAX[pillar]) * 100),
  }));

  const isComplete = currentQuestion >= QUESTIONS.length;

  const currentPillar     = !isComplete ? QUESTIONS[currentQuestion].pillar : null;
  const pillarQuestions   = !isComplete ? QUESTIONS.filter(q => q.pillar === currentPillar) : [];
  const pillarIndex       = PILLARS.indexOf(currentPillar);
  const questionInPillar  = !isComplete ? pillarQuestions.findIndex(q => q.id === QUESTIONS[currentQuestion].id) + 1 : 0;
  const progress          = Math.round((currentQuestion / QUESTIONS.length) * 100);

  function handleAnswer(weight) {
    setSelected(weight);
    setTimeout(() => {
      setAnswers(prev => ({ ...prev, [QUESTIONS[currentQuestion].id]: weight }));
      setSelected(null);
      if (currentQuestion < QUESTIONS.length - 1) setCurrentQuestion(p => p + 1);
      else setCurrentQuestion(QUESTIONS.length);
    }, 220);
  }

  function restart() {
    setAnswers({});
    setCurrentQuestion(0);
    setSelected(null);
  }

  return (
    <div className="min-h-screen bg-black text-zinc-100">

      {/* ── Header ──────────────────────────────────────────── */}
      <div className="border-b border-zinc-900 bg-zinc-950">
        <div className="max-w-3xl mx-auto px-6 py-8">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-zinc-500 hover:text-amber-500 transition mb-6 text-xs font-black uppercase tracking-widest group"
          >
            <ArrowLeft size={13} className="group-hover:-translate-x-1 transition-transform" />
            Back to Home
          </button>
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-amber-500 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20">
                  Mogul Audit
                </span>
              </div>
              <h1 className="text-4xl md:text-5xl font-black tracking-tighter italic uppercase mb-2">
                Founder's Might
              </h1>
              <p className="text-zinc-500 text-sm leading-relaxed">
                16 questions. 4 pillars. One honest score.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-10">

        {!isComplete ? (
          <>
            {/* ── Progress bar ───────────────────────────────── */}
            <div className="mb-8">
              <div className="flex justify-between items-center mb-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-zinc-600">
                  {PILLAR_ICONS[currentPillar]} {currentPillar} — Question {questionInPillar} of {pillarQuestions.length}
                </span>
                <span className="text-[10px] font-black text-amber-500">{currentQuestion + 1} / {QUESTIONS.length}</span>
              </div>
              <div className="h-1 bg-zinc-900 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-500 rounded-full transition-all duration-500"
                  style={{ width: `${progress}%` }}
                />
              </div>

              {/* Pillar dots */}
              <div className="flex gap-2 mt-3">
                {PILLARS.map((p, i) => (
                  <div
                    key={p}
                    className={`flex-1 h-1 rounded-full transition-all duration-300 ${
                      i < pillarIndex       ? 'bg-amber-500' :
                      i === pillarIndex     ? 'bg-amber-500/40' :
                                             'bg-zinc-800'
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* ── Question card ───────────────────────────────── */}
            <div className="bg-zinc-950 border border-zinc-800 rounded-[2rem] overflow-hidden">
              <div className="px-8 pt-10 pb-6">
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-600 mb-4">
                  Quest {pillarIndex + 1} / 4
                </p>
                <h2 className="text-xl md:text-2xl font-black leading-snug text-zinc-100">
                  {QUESTIONS[currentQuestion].text}
                </h2>
              </div>

              <div className="px-8 pb-8 space-y-3">
                {QUESTIONS[currentQuestion].options.map((opt, i) => (
                  <button
                    key={i}
                    onClick={() => handleAnswer(opt.weight)}
                    className={`w-full text-left px-6 py-4 rounded-2xl border font-bold text-sm flex justify-between items-center transition-all duration-150 ${
                      selected === opt.weight
                        ? 'bg-amber-500 border-amber-500 text-black scale-[0.98]'
                        : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:border-amber-500/40 hover:bg-zinc-800 hover:text-white'
                    }`}
                  >
                    {opt.text}
                    <ChevronRight size={16} className="shrink-0 ml-2 opacity-50" />
                  </button>
                ))}
              </div>
            </div>
          </>
        ) : (
          // ── Results ──────────────────────────────────────────
          <MogulRateCard
            scores={scores}
            totalScore={totalScore}
            rank={rank}
            radarData={radarData}
            onRestart={restart}
          />
        )}
      </div>
    </div>
  );
}
