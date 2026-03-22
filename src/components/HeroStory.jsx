import React, { useState } from 'react';

function HeroStory() {
  const [expanded, setExpanded] = useState(false);

  return (
    <div id="stories" className="glass-card rounded-2xl md:rounded-3xl overflow-hidden shadow-sm">

      {/* Hero image */}
      <div className="relative w-full">
        <img
          src="/herostory.jpg"
          alt="What Keeps Success Running?"
          className="w-full h-auto object-cover"
        />
      </div>

      {/* Article body */}
      <div className="p-5 sm:p-6 md:p-8 article-content">

        {/* Meta */}
        <div className="flex flex-wrap items-center gap-3 mb-5 text-xs sm:text-sm text-slate-400 font-medium">
          <span className="flex items-center gap-1.5"><i className="far fa-calendar"></i> March 1, 2026</span>
          <span className="flex items-center gap-1.5"><i className="far fa-clock"></i> 5 min read</span>
          <span className="flex items-center gap-1.5"><i className="far fa-user"></i> BusinessRun Editorial</span>
        </div>

        {/* Headline */}
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 leading-tight mb-4">
          What Keeps Success Running?
        </h1>

        {/* Pull quote */}
        <p className="text-base sm:text-lg text-slate-500 font-medium italic border-l-4 border-slate-300 pl-4 sm:pl-6 mb-6">
          "The world is still asleep. This is the moment of truth. In the industry, we call it the 4:00 AM Audit."
        </p>

        <p>
          No customers are knocking, no staff are asking questions, and the phone hasn't started its daily vibration dance.
          Whether you're opening a storefront, checking a job site, or sitting down at a laptop, this is the moment of truth.
          It's not about your bank balance or your inventory. It's a gut-check on the only engine that actually matters: <strong>You.</strong>
        </p>

        {/* Expandable section */}
        <div className={`overflow-hidden transition-all duration-500 ${expanded ? 'max-h-[9999px]' : 'max-h-0'}`}>

          <h2 className="text-lg sm:text-xl font-bold text-slate-800 mt-6 mb-3">The Trap of "Busy-ness"</h2>
          <p>
            Most business owners fall into the same trap. We think that if we are moving, we are winning. We mistake the
            "hustle" for "harvest." We spend our days putting out fires, reacting to problems, and running until our
            lungs burn — only to wake up the next day and realize the finish line hasn't moved an inch.
          </p>
          <p className="mt-3">
            If you only prioritize the speed of the sprint, you will eventually stall. Success isn't just about how fast
            you run; it's about how well you maintain the machine.
          </p>

          <h2 className="text-lg sm:text-xl font-bold text-slate-800 mt-6 mb-3">The 3-Point Maintenance Check</h2>
          <p>
            To keep your business running for the long haul, you need to step back and run a diagnostic on three specific
            areas. You don't need a spreadsheet for this — just total honesty.
          </p>

          <div className="bg-slate-50 p-4 sm:p-6 rounded-xl my-5 border border-slate-100">
            <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2 text-sm sm:text-base">
              <span className="w-6 h-6 bg-slate-800 text-white rounded-full flex items-center justify-center text-xs font-black flex-shrink-0">1</span>
              The Energy Check: Is the Tank Leaking?
            </h3>
            <p className="text-slate-600 text-sm leading-relaxed">
              You can't pour from an empty cup. If you are leading your team while exhausted, irritable, and foggy,
              you aren't leading — you're just surviving.
            </p>
            <ul className="mt-3 space-y-2 text-sm text-slate-600">
              <li className="flex items-start gap-2">
                <i className="fas fa-circle-question mt-1 text-slate-400 flex-shrink-0 text-xs"></i>
                <span><strong>The Question:</strong> Am I making decisions out of clarity, or out of desperation?</span>
              </li>
              <li className="flex items-start gap-2">
                <i className="fas fa-wrench mt-1 text-slate-400 flex-shrink-0 text-xs"></i>
                <span><strong>The Fix:</strong> If you're at 10% capacity, your priority today isn't "more work." It's recovery. A rested owner makes fewer expensive mistakes.</span>
              </li>
            </ul>
          </div>

          <div className="bg-slate-50 p-4 sm:p-6 rounded-xl my-5 border border-slate-100">
            <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2 text-sm sm:text-base">
              <span className="w-6 h-6 bg-slate-800 text-white rounded-full flex items-center justify-center text-xs font-black flex-shrink-0">2</span>
              The Focus Check: What is the "Drag"?
            </h3>
            <p className="text-slate-600 text-sm leading-relaxed">
              In every business, "drag" is the stuff that takes up time but adds zero value — the repetitive manual tasks,
              the "difficult" clients who cost more than they pay, or the old habits you're clinging to because "that's how
              we've always done it."
            </p>
            <ul className="mt-3 space-y-2 text-sm text-slate-600">
              <li className="flex items-start gap-2">
                <i className="fas fa-circle-question mt-1 text-slate-400 flex-shrink-0 text-xs"></i>
                <span><strong>The Question:</strong> If I could only do one thing today to grow this business, what would it be?</span>
              </li>
              <li className="flex items-start gap-2">
                <i className="fas fa-wrench mt-1 text-slate-400 flex-shrink-0 text-xs"></i>
                <span><strong>The Fix:</strong> Identify the drag and cut it. If it doesn't move the needle, it shouldn't be on your plate.</span>
              </li>
            </ul>
          </div>

          <div className="bg-slate-50 p-4 sm:p-6 rounded-xl my-5 border border-slate-100">
            <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2 text-sm sm:text-base">
              <span className="w-6 h-6 bg-slate-800 text-white rounded-full flex items-center justify-center text-xs font-black flex-shrink-0">3</span>
              The Fuel Check: What's Feeding Your Mind?
            </h3>
            <p className="text-slate-600 text-sm leading-relaxed">
              Running a business is mentally draining. If you aren't putting new ideas, new skills, or even just fresh
              inspiration into your brain, your output will eventually become stale.
            </p>
            <ul className="mt-3 space-y-2 text-sm text-slate-600">
              <li className="flex items-start gap-2">
                <i className="fas fa-circle-question mt-1 text-slate-400 flex-shrink-0 text-xs"></i>
                <span><strong>The Question:</strong> When was the last time I learned something that made me excited about my industry again?</span>
              </li>
              <li className="flex items-start gap-2">
                <i className="fas fa-wrench mt-1 text-slate-400 flex-shrink-0 text-xs"></i>
                <span><strong>The Fix:</strong> Spend 15 minutes today "refueling." Read a trade journal, talk to a mentor, or listen to a podcast. Stay curious, or stay stagnant.</span>
              </li>
            </ul>
          </div>

          <h2 className="text-lg sm:text-xl font-bold text-slate-800 mt-6 mb-3">The Bottom Line</h2>
          <p>Success doesn't run on caffeine and "grind." It runs on <strong>stamina.</strong></p>
          <p className="mt-3">
            The next time you feel like you're spinning your wheels, stop. Take five minutes. Run the audit.
            Check your energy, find the drag, and refuel your mind.
          </p>
          <p className="mt-3">
            The race is long, and at <strong>BusinessRun</strong>, we want to make sure you're the one who crosses
            the finish line — not the one who broke down halfway there.
          </p>

        </div>

        {/* Read more / Read less toggle */}
        <button
          onClick={() => setExpanded(prev => !prev)}
          className="mt-5 flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-800 transition"
        >
          <span>{expanded ? 'Read less' : 'Continue reading'}</span>
          <i className={`fas fa-chevron-down text-xs transition-transform duration-300 ${expanded ? 'rotate-180' : ''}`}></i>
        </button>

      </div>
    </div>
  );
}

export default HeroStory;
