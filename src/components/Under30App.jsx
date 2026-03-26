import React, { useState } from 'react';
import { Users, BadgeCheck, FileCheck, BarChart3, ArrowRight } from 'lucide-react';

const SHEET_ENDPOINT = 'https://script.google.com/macros/s/AKfycbzfiyZDhIDI1eXuwOOrLHGbwgKorcHKUwe8NUujcWe2BskfxtqLvPkRTrt-2sO52Uld4g/exec';

// ─────────────────────────────────────────────────────────────
// LandingView
// ─────────────────────────────────────────────────────────────
function LandingView({ onApplyClick }) {
  return (
    <div className="max-w-4xl mx-auto text-center py-12 sm:py-16 md:py-20 px-4 sm:px-6">

      {/* Badge */}
      <div className="inline-flex items-center gap-2 bg-amber-500/10 text-amber-400 border border-amber-500/20 px-3 sm:px-4 py-2 rounded-full text-xs sm:text-sm font-bold mb-5 sm:mb-6">
        <Users size={14} />
        BusinessRun x Under 30 Women
      </div>

      {/* Headline */}
      <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-5 sm:mb-6 leading-tight">
        Empowering the Next Generation of{' '}
        <span className="text-amber-400">Female Founders.</span>
      </h1>

      {/* Sub-headline */}
      <p className="text-base sm:text-lg text-zinc-300 mb-4 max-w-2xl mx-auto leading-relaxed">
        Applications are now open for the{' '}
        <strong className="text-white">2026 Under30Women in Business Mentorship Cohort.</strong>
      </p>
      <p className="text-base sm:text-lg text-zinc-300 mb-8 sm:mb-10 max-w-2xl mx-auto leading-relaxed">
        We are vetting applicants who demonstrate exceptional resilience, innovative spirit and a drive to build scalable, self-reliant enterprises across Africa. Join a global network of founders leveraging the digital economy to create sustainable impact.
      </p>

      {/* CTA */}
      <button
        onClick={onApplyClick}
        className="bg-amber-500 text-black px-7 sm:px-8 py-3 sm:py-4 rounded-xl font-semibold hover:bg-amber-400 transition flex items-center gap-2 text-sm sm:text-base mx-auto"
      >
        Apply Now <ArrowRight size={16} />
      </button>

      {/* Deadline note */}
      <p className="text-xs text-zinc-500 mt-3">Applications close 22nd April 2026</p>

      {/* Feature cards */}
      <div className="mt-14 sm:mt-16 md:mt-20 grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
        {[
          {
            label: 'Mentorship',
            desc: '1-on-1 access to established industry leaders.',
            icon: <BadgeCheck className="text-zinc-500" size={24} />,
          },
          {
            label: 'Compliance',
            desc: 'Free CAC & Tax advisory through BusinessRun.',
            icon: <FileCheck className="text-zinc-500" size={24} />,
          },
          {
            label: 'Funding',
            desc: 'Access to the Under30 network of investors.',
            icon: <BarChart3 className="text-zinc-500" size={24} />,
          }
        ].map((item, i) => (
          <div
            key={i}
            className="p-5 sm:p-6 bg-zinc-900 rounded-2xl border border-zinc-800 text-left hover:border-zinc-700 transition"
          >
            <div className="mb-3">{item.icon}</div>
            <h3 className="font-semibold text-sm sm:text-base mb-1 text-zinc-200">{item.label}</h3>
            <p className="text-zinc-500 text-sm leading-relaxed">{item.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// ApplyView
// ─────────────────────────────────────────────────────────────
function ApplyView({ formData, setFormData, submitting, submitted, errorMsg, onSubmit, onBack }) {
  if (submitted) {
    return (
      <div className="max-w-2xl mx-auto py-10 sm:py-12 px-4 sm:px-6">
        <div className="bg-green-500/10 border border-green-500/20 p-6 sm:p-8 rounded-2xl text-center">
          <div className="w-14 h-14 sm:w-16 sm:h-16 bg-green-500 text-white rounded-full flex items-center justify-center mx-auto mb-4">
            <BadgeCheck size={26} />
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-zinc-100 mb-2">
            Application Received!
          </h2>
          <p className="text-zinc-400 text-sm sm:text-base mb-6">
            Your profile is now in the vetting queue. You will receive an
            update via email soon.
          </p>
          <button
            onClick={onBack}
            className="text-zinc-400 font-semibold underline text-sm hover:text-zinc-100 transition"
          >
            Return Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-8 sm:py-12 px-4 sm:px-6">
      <button
        onClick={onBack}
        className="text-zinc-500 mb-6 sm:mb-8 hover:text-zinc-200 flex items-center gap-1 text-sm transition"
      >
        ← Back to info
      </button>

      <form
        onSubmit={onSubmit}
        className="bg-zinc-950 p-5 sm:p-8 rounded-2xl border border-zinc-800"
      >
        <div className="mb-6">
          <h2 className="text-lg sm:text-xl font-bold text-zinc-100 mb-1">Mentorship Application</h2>
          <p className="text-zinc-500 text-xs sm:text-sm">
            Fill in your details. Your application goes directly to our review team.
          </p>
        </div>

        <div className="space-y-4">

          <div>
            <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1">Full Name</label>
            <input
              required type="text" value={formData.fullName}
              className="w-full p-3 bg-zinc-900 border border-zinc-800 rounded-lg focus:ring-2 focus:ring-amber-500/20 outline-none text-sm text-zinc-100 placeholder:text-zinc-600"
              placeholder="Jane Doe"
              onChange={e => setFormData(prev => ({ ...prev, fullName: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1">Email</label>
              <input
                required type="email" value={formData.email}
                className="w-full p-3 bg-zinc-900 border border-zinc-800 rounded-lg focus:ring-2 focus:ring-amber-500/20 outline-none text-sm text-zinc-100 placeholder:text-zinc-600"
                placeholder="jane@example.com"
                onChange={e => setFormData(prev => ({ ...prev, email: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1">Age</label>
              <input
                required type="number" min="18" max="30" value={formData.age}
                className="w-full p-3 bg-zinc-900 border border-zinc-800 rounded-lg focus:ring-2 focus:ring-amber-500/20 outline-none text-sm text-zinc-100 placeholder:text-zinc-600"
                placeholder="24"
                onChange={e => setFormData(prev => ({ ...prev, age: e.target.value }))}
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1">Business Name</label>
            <input
              required type="text" value={formData.businessName}
              className="w-full p-3 bg-zinc-900 border border-zinc-800 rounded-lg focus:ring-2 focus:ring-amber-500/20 outline-none text-sm text-zinc-100 placeholder:text-zinc-600"
              placeholder="Luxe Fabrics Ltd"
              onChange={e => setFormData(prev => ({ ...prev, businessName: e.target.value }))}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1">Industry</label>
            <select
              required value={formData.industry}
              className="w-full p-3 bg-zinc-900 border border-zinc-800 rounded-lg outline-none text-sm text-zinc-100 focus:ring-2 focus:ring-amber-500/20"
              onChange={e => setFormData(prev => ({ ...prev, industry: e.target.value }))}
            >
              <option value="">Select Industry</option>
              <option value="Technology">Technology</option>
              <option value="Fashion & Lifestyle">Fashion &amp; Lifestyle</option>
              <option value="Agriculture">Agriculture</option>
              <option value="Professional Services">Professional Services</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-400 uppercase tracking-wide mb-1">Business Description</label>
            <textarea
              required value={formData.description}
              className="w-full p-3 bg-zinc-900 border border-zinc-800 rounded-lg h-28 sm:h-32 outline-none resize-none text-sm text-zinc-100 placeholder:text-zinc-600 focus:ring-2 focus:ring-amber-500/20"
              placeholder="Tell us what your business does and your biggest challenge..."
              onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
            />
          </div>

          {errorMsg && (
            <p className="text-red-400 text-xs text-center bg-red-500/10 p-3 rounded-lg border border-red-500/20">
              {errorMsg}
            </p>
          )}

          <button
            type="submit" disabled={submitting}
            className="w-full py-3 sm:py-4 bg-amber-500 text-black rounded-xl font-semibold hover:bg-amber-400 transition disabled:opacity-50 flex items-center justify-center gap-2 text-sm sm:text-base"
          >
            {submitting ? (
              <>
                <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"></path>
                </svg>
                Submitting...
              </>
            ) : 'Submit Application'}
          </button>

        </div>
      </form>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────
export default function Under30App({ onBack }) {
  const [view, setView]             = useState('landing');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted]   = useState(false);
  const [errorMsg, setErrorMsg]     = useState('');
  const [formData, setFormData]     = useState({
    fullName: '', email: '', age: '', businessName: '', industry: '', description: '',
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setErrorMsg('');
    const payload = {
      submittedAt:  new Date().toLocaleString('en-NG', { timeZone: 'Africa/Lagos' }),
      fullName:     formData.fullName,
      email:        formData.email,
      age:          formData.age,
      businessName: formData.businessName,
      industry:     formData.industry,
      description:  formData.description,
      status:       'Pending',
    };
    try {
      await fetch(SHEET_ENDPOINT, {
        method: 'POST', mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      setSubmitted(true);
    } catch (err) {
      setErrorMsg('Network error. Please check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-black font-sans text-zinc-100 pb-20">

      {/* Sub-nav bar — neutral, not blue */}
      <div className="bg-zinc-950 border-b border-zinc-900 px-4 sm:px-6 py-3">
        <div className="max-w-6xl mx-auto flex items-center justify-between">

          {/* Breadcrumb */}
          <div className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm min-w-0">
            <button
              onClick={onBack}
              className="hover:text-zinc-400 transition font-medium text-zinc-500 shrink-0"
            >
              BusinessRun
            </button>
            <span className="text-zinc-700">/</span>
            <span className="text-zinc-200 font-semibold shrink-0">Under30</span>
            {view !== 'landing' && (
              <>
                <span className="text-zinc-700">/</span>
                <span className="capitalize text-zinc-400 truncate">{view}</span>
              </>
            )}
          </div>

          {/* Tabs */}
          <div className="flex gap-4 sm:gap-6 text-xs sm:text-sm font-medium shrink-0 ml-4">
            <button
              onClick={() => setView('landing')}
              className={view === 'landing'
                ? 'text-amber-400 font-bold border-b-2 border-amber-400 pb-0.5'
                : 'text-zinc-500 hover:text-zinc-200 transition'}
            >
              Home
            </button>
            <button
              onClick={() => setView('apply')}
              className={view === 'apply'
                ? 'text-amber-400 font-bold border-b-2 border-amber-400 pb-0.5'
                : 'text-zinc-500 hover:text-zinc-200 transition'}
            >
              Apply
            </button>
          </div>
        </div>
      </div>

      {view === 'landing' && <LandingView onApplyClick={() => setView('apply')} />}
      {view === 'apply'   && (
        <ApplyView
          formData={formData} setFormData={setFormData}
          submitting={submitting} submitted={submitted}
          errorMsg={errorMsg} onSubmit={handleSubmit}
          onBack={() => setView('landing')}
        />
      )}
    </div>
  );
}
