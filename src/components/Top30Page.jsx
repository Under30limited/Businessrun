import React, { useState, useEffect } from 'react';
import { Award, Filter, X, MapPin, Calendar, Users, TrendingUp, ChevronRight, ArrowRight } from 'lucide-react';

// ─────────────────────────────────────────────────────────────────
// HONOREES DATA
// ─────────────────────────────────────────────────────────────────
// TO ADD A NEW HONOREE:
//   1. Add a new object to this array following the same shape
//   2. Drop their photo in public/top30/filename.jpg
//   3. Set img: '/top30/filename.jpg'
//   4. Push to GitHub — card + popup render automatically
//
// TO GENERATE STORY CONTENT:
//   Prompt any AI: "Write a founder story for [Name] of [Company].
//   Cover: how they started (origin), how they scaled (growth),
//   key achievement (milestone), and future vision (vision).
//   Keep each paragraph to 3-4 sentences."
// ─────────────────────────────────────────────────────────────────

const honorees = [
  {
    id: 1,
    name: 'Yanmo Omorogbe',
    company: 'Bamboo',
    category: 'Fintech',
    age: 31,
    position: 'Co-founder & COO',
    founded: '2019',
    location: 'Lagos, Nigeria',
    img: "/Yanmo-Omorogbe-Cofounder-Bamboo-Fintech-2026.jpg",
    bio: 'Opening global markets to everyday Africans and turning users into investors.',
    stats: [
      { label: 'Users', value: '1M+' },
      { label: 'Funding', value: '$15M+' },
      { label: 'Markets', value: 'US & NG' },
    ],
    story: {
      origin:
      'With a background in chemical engineering from Imperial College London, Yanmo built her career at the intersection of policy and finance. From advising within Nigeria’s public sector to working in private equity, she developed a systems-level understanding of how capital moves—and who gets left out.',
      growth:
      'In 2019, she co-founded Bamboo to solve a simple but powerful problem: Africans had limited access to global investment opportunities. Starting with a small, ambitious team, she helped build a platform that made buying US stocks as easy as using a mobile app, removing barriers that had existed for decades.',
      milestone:
      'Bamboo quickly scaled into one of Africa’s leading investment platforms, serving over a million users and raising more than $15 million in funding. The company became a gateway for a new generation of Nigerians to participate in global wealth creation.',
      vision:
      'Yanmo is focused on building long-term financial infrastructure for Africa—where investing is not a privilege but a norm. Her mission is to empower millions more to think beyond earning, and start building wealth that lasts across generations.',
    },
  },
  {
    id: 2,
    name: 'Kennedy Ekezie',
    company: 'Kippa',
    category: 'Fintech',
    age: 27,
    position: 'CEO & Co-founder',
    founded: '2021',
    location: 'Lagos, Nigeria',
    img: "/Kennedy-Ekezie-Ceo-Kippa-2026.jpg",
    bio: 'Building the financial backbone for Africa’s small businesses by turning informal trade into structured, trackable growth.',
    stats: [
      { label: 'Transactions', value: '$3B+' },
      { label: 'SMEs Served',  value: '500K+' },
      { label: 'Awards',       value: 'Global' },
    ],
    story: {
      origin:
      'Kennedy Ekezie’s path started early. Graduating from the University of Calabar at 19 with a degree in philosophy, he quickly moved beyond borders, earning a prestigious Yenching Scholarship to study economics at Peking University—where he began to understand how large-scale systems power modern economies.',
      growth:
      'At ByteDance, the parent company of TikTok, he helped shape the platform’s expansion into Africa. That experience exposed him to how digital platforms scale across millions of users—insight he would later apply to solving Africa’s SME problem.',
      milestone:
      'As CEO of Kippa, he is tackling one of Africa’s biggest hidden challenges: millions of small businesses operating without records. Under his leadership, Kippa has processed over $3 billion in transactions, helping merchants track sales, manage customers, and become financially visible.',
      vision:
      'Kennedy is building more than an app—he’s creating infrastructure that allows small businesses to access credit, scale operations, and participate fully in the formal economy. His long-term goal is to make African SMEs not just survive, but compete globally.',
    },
  },
  {
    id: 3,
    name: 'Divine Ikubor (Rema)',
    company: 'Mavin Records / Jonzing World',
    category: 'Music & Entertainment',
    age: 25,
    position: 'Music Artist',
    founded: '2019',
    location: 'Lagos, Nigeria',
    img: "/rema-divine-ikubor-music-artist-top30-businessrun-2026.jpg",
    bio: 'Exporting Afrobeats to the world by turning sound into a global cultural and commercial force.',
    stats: [
      { label: 'Streams',        value: '2B+'   },
      { label: 'Global Charts',  value: 'Top 10+' },
      { label: 'Awards',         value: 'Global' },
    ],
    story: {
      origin:
      'Rema’s journey began in Benin City, where he started recording and performing as a teenager after losing his father. What followed was a rapid rise fueled by raw talent and a distinct sound that blended Afrobeats with global influences, catching the attention of industry leaders early.',
      growth:
      'Signed to Jonzing World under Mavin Records at just 18, Rema quickly became one of Africa’s most recognizable voices. He introduced “Afrorave,” a genre that merges Afrobeats with Indian and Middle Eastern elements, giving his music a cross-cultural appeal that travels easily across continents.',
      milestone:
      'His global hit “Calm Down,” especially the remix with Selena Gomez, broke streaming records and spent over a year on international charts. The track became one of the most successful African songs ever, pushing Afrobeats deeper into mainstream global markets.',
      vision:
      'Rema is building more than a music career—he is shaping a global movement. With Afrorave, he is creating a new export category for African sound, positioning it not just as entertainment, but as a long-term cultural and economic force.',
    },
  },
  {
    id: 34,
    name: 'Sarah Kalu',
    company: 'Sara Foundation Africa',
    category: 'Social Impact & Technology',
    age: 26,
    position: 'Founder',
    founded: '2022',
    location: 'Lagos, Nigeria',
    img: "/Sarah-Kalu-Founder-Sara-Foundation-Africa-Top30-List-Businessrun-2026.jpg",
    bio: 'Building pathways for African youth and women to access opportunities in technology and entrepreneurship.',
    stats: [
      { label: 'Programs',     value: '2+'         },
      { label: 'Communities',  value: 'Pan-African' },
      { label: 'Focus',          value: 'Women & Tech' },
    ],
    story: {
      origin:
      'Sarah Kalu founded Sara Foundation Africa with a clear mission—to close the opportunity gap in technology and entrepreneurship for African youth, especially women. Seeing how access, not talent, was the real barrier, she set out to build a platform that connects ambition with opportunity.',
      growth:
      'Through initiatives like the Career Advancement Program (CAP) and Female Leadership Initiative Program (FLIP), the foundation has begun building tech communities across universities and nurturing the next generation of African founders and professionals.',
      milestone:
      'Recognized as a prominent leader in the Businessrun Top 30 for 2026, the organization has expanded its reach across multiple African institutions, creating structured programs that equip young people with practical, career-ready skills.',
      vision:
      'Sarah is focused on scaling a continent-wide ecosystem where African talent is not just trained, but empowered to lead. Her long-term goal is to create a pipeline of globally competitive founders and tech leaders emerging directly from Africa.',
    },
  },
  {
    id: 5,
    name: 'Oyinkansola Aderibigbe',
    company: 'Mavin Records / Celestial Entertainment',
    category: 'Music & Global Branding',
    age: 23,
    position: 'Music Artist',
    founded: '2021',
    location: 'Lagos, Nigeria / Global',
    img: "/ayra-starr-music-artist-top30-list-businessrun-2026.jpg",
    bio: 'The face of the "Celestial Economy," blending high-fashion aesthetics with a Gen Z attitude to redefine Afrobeats for a global audience.',
    stats: [
      { label: 'Streams',     value: '500M+' },
      { label: 'Endorsements', value: 'L’Oréal Paris' },
      { label: 'Recognition',  value: 'Grammy Nominee' },
    ],
    story: {
      origin:
      'Known professionally as Ayra Starr, Oyinkansola was designed for global interoperability from Day 1. Emerging from Mavin Records, she quickly transitioned from a viral talent into a multi-national brand asset with significant commercial value across beauty, fashion, and tech sectors.',
      growth:
      'In 2024, she became the first Nigerian female artist to have multiple solo songs cross 100 million streams on Spotify. Her sophomore album, "The Year I Turned 21," received critical acclaim for its technical production and brand-safe appeal, making her a top choice for blue-chip corporate partnerships.',
      milestone:
      'Her 2025 appointment as the first African face of L’Oréal Paris signaled a massive shift in global luxury markets. This, coupled with her Grammy nomination for Best African Music Performance, has cemented her status as an institutionalized global talent with a premium performance floor.',
      vision:
      'Ayra continues to serve as a foundational pillar for Afrobeats\' international licensing and publishing revenues. Her trajectory is focused on becoming a permanent fixture in the global pop landscape, bridging the gap between African creative talent and international luxury conglomerates.',
    },
  },
  {
    id: 6,
    name: 'Maryam Apaokagi',
    company: 'The Greenade Company / Chop Tao',
    category: 'Media Production & Entrepreneurship',
    age: 27,
    position: 'Co-Founder & CEO',
    founded: '2019',
    location: 'Lagos, Nigeria',
    img: "/taaoma-maryam-apaokagi-top30-list-businessrun-2026.jpg",
    bio: 'The architect of the "One-Woman Studio" model, blending professional cinematography with digital storytelling to build a multi-sector media empire.',
    stats: [
      { label: 'Ventures',     value: 'Media & Food' },
      { label: 'Role',         value: 'Cinematographer' },
      { label: 'Recognition',  value: 'Future Awards Winner' },
    ],
    story: {
      origin:
      'A graduate of Tourism and Hospitality Management, Maryam Apaokagi (Taaooma) revolutionized the digital space by proving that a deep understanding of cinematography and editing could turn a single creator into a high-revenue media house.',
      growth:
      'Alongside her husband, Abdulaziz Oladimeji, she co-founded The Greenade Company. This full-service production outfit has moved beyond viral skits to handle high-end music videos, commercials, and short films, bridging the gap between social media and institutional cinema.',
      milestone:
      'Beyond media, Maryam successfully executed a "Chop Tao" diversification, a finger-foods company that leverages her massive digital reach for direct-to-consumer sales. Her impact has been recognized by the Malala Fund for using comedy as a vehicle for gender activism.',
      vision:
      'Maryam is focused on scaling the "One-Woman Studio" philosophy into a sustainable ecosystem. Her goal is to continue blending African cultural tropes with professional-grade production, proving that creator-led brands can dominate both digital and physical markets.',
    },
  },
  {
    id: 7,
    name: 'Munachimso Emenike',
    company: 'Shopmunie',
    category: 'Fashion & E-commerce',
    age: 25,
    position: 'CEO & Founder',
    founded: '2020',
    location: 'Lagos, Nigeria',
    img: "/munachimso-emenike-ceo-shopmunie-top30-businesinessrun-2026.jpg",
    bio: 'A master of audience monetization and vertical integration, transforming digital influence into a benchmark for the modern African boutique economy.',
    stats: [
      { label: 'Followers',    value: '500K+' },
      { label: 'Model',        value: 'Demand-Driven' },
      { label: 'Impact',       value: 'Digital-First' },
    ],
    story: {
      origin:
      'Hailing from a lineage of fashion designers, Munachimso Emenike began her entrepreneurial journey with Shopmunie before entering university. She proved early on that in the digital age, market intuition and a deep connection with an audience can precede formal certification.',
      growth:
      'She successfully scaled her brand by utilizing Instagram and WhatsApp as primary storefronts. By controlling the entire pipeline from design to distribution, she effectively converted "Instagram likes" into high "inventory turnover," reaching a global customer base across multiple social platforms.',
      milestone:
      'Munachimso revolutionized her operations by moving to a high-precision, demand-based production model, which minimizes waste and maximizes exclusivity. Recognized as a "Game Changer" by institutional media, she has become a leading voice in the Beauty and Lifestyle sectors.',
      vision:
      'Her focus remains on building a vertically integrated fashion house that serves as a role model for young African women. She aims to continue lead the shift toward digital-first empires where African creativity is directly linked to global e-commerce infrastructure.',
    },
  },
  {
    id: 8,
    name: 'Michael Ovie Hunter (London)',
    company: 'Mavin Records / Sony Music Publishing',
    category: 'Music Production & Intellectual Property',
    age: 26,
    position: 'Music Producer & Recording Artist',
    founded: '2018',
    location: 'Lagos, Nigeria / Global',
    img: "/london-mavin-music-producer-top30list-businessrun-2026.jpg",
    bio: 'The architect of the "Global Afrobeats Sonic Identity," engineering the scalability of the Nigerian sound through record-breaking production and strategic global licensing.',
    stats: [
      { label: 'Streams',     value: '1B+' },
      { label: 'Recognition',  value: 'Grammy Nominee' },
      { label: 'Partnership',  value: 'Sony Music Publishing' },
    ],
    story: {
      origin:
      'A protégé of Don Jazzy and mentored at the Mavin Academy by BabyFresh, Michael Ovie Hunter (London) is a prime example of the ROI found in structured talent incubation within the Nigerian creative sector.',
      growth:
      'London became the engineer of Afrobeats\' global scalability by co-producing the 2022 phenomenon "Calm Down" for Rema. The track became the first African-led song to surpass 1 billion Spotify streams, effectively benchmarking the financial potential of Nigerian sound engineering.',
      milestone:
      'He earned a Grammy nomination for his work on Wizkid’s "Made in Lagos" and has built a diversified IP portfolio producing hits for Ayra Starr, Tiwa Savage, and Crayon. In 2024, he successfully transitioned into a recording artist with the hit "PinaColada" featuring 6lack.',
      vision:
      'By signing a major publishing deal with Sony Music Publishing France, London has signaled a shift from local beatmaking to becoming a global player in the music royalty and licensing economy, ensuring the long-term sustainability of the African sonic footprint.',
    },
  },
  {
    id: 39,
    name: 'Nyifamu Ogechi Manzo',
    company: 'Farmatrix Agro Allied and Technology',
    category: 'Agritech & Sustainability',
    age: 26,
    position: 'Founder & CEO',
    founded: '2019',
    location: 'Abuja, Nigeria',
    img: "/nyifamu-ogechi-manzo.jpg",
    bio: 'Leveraging technology to improve productivity and market access for smallholder farmers across Northern Nigeria and the Sahel.',
    stats: [
      { label: 'Farmers',      value: '10,000+' },
      { label: 'Focus',        value: 'Climate-Smart' },
      { label: 'Market Reach', value: 'Pan-Northern' },
    ],
    story: {
      origin:
      'Driven by her firsthand experience with rural farming communities in the North, Nyifamu Ogechi Manzo founded Farmatrix to solve the systemic challenges of market access and post-harvest loss that plague smallholder farmers.',
      growth:
      'The platform has evolved into a comprehensive digital ecosystem, connecting farmers directly to buyers and logistics services while providing essential training in climate-smart agricultural practices to ensure long-term sustainability.',
      milestone:
      'In 2026, she was recognized as one of the top female tech founders to watch, having successfully scaled operations to support thousands of farmers and significantly increasing household incomes in underserved regions.',
      vision:
      'Nyifamu is committed to industrializing the northern agricultural corridor through data-driven solutions. Her goal is to build a resilient food system where technology acts as the primary bridge between rural productivity and global demand.',
    },
  },
];

const categories = ['All', 'Finance', 'Tech', 'Art & Style', 'Social Impact', 'Retail'];

// ─────────────────────────────────────────────────────────────────
// StoryModal — full-screen popup for each honoree
// ─────────────────────────────────────────────────────────────────
function StoryModal({ person, onClose }) {
  // Lock body scroll while open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  // Close on Escape
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }}
      onClick={onClose}
    >
      <div
        className="bg-zinc-950 border border-zinc-800 w-full sm:rounded-[2rem] max-w-4xl max-h-[95vh] overflow-y-auto shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        {/* ── Modal header ─────────────────────────────────────── */}
        <div className="sticky top-0 z-10 bg-zinc-950/95 backdrop-blur-md border-b border-zinc-900 px-6 py-4 flex items-center justify-between">
          <span className="text-[9px] font-black uppercase tracking-widest text-amber-500 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20">
            {person.category}
          </span>
          <button
            onClick={onClose}
            className="w-8 h-8 bg-zinc-800 hover:bg-zinc-700 rounded-full flex items-center justify-center text-zinc-400 hover:text-white transition-all"
          >
            <X size={16} />
          </button>
        </div>

        {/* ── Hero block ───────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-0">

          {/* Photo */}
          <div className="relative aspect-[3/4] sm:aspect-auto sm:min-h-[420px] overflow-hidden">
            <img
              src={person.img}
              alt={person.name}
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/20 to-transparent" />
          </div>

          {/* Identity + stats */}
          <div className="p-8 flex flex-col justify-center bg-zinc-900">
            <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500 mb-2">
              {person.position}
            </p>
            <h2 className="text-3xl font-black uppercase tracking-tight text-white leading-tight mb-1">
              {person.name}
            </h2>
            <p className="text-amber-500 font-black text-sm uppercase tracking-widest mb-6">
              {person.company}
            </p>

            {/* Meta row */}
            <div className="flex flex-wrap gap-4 mb-8 text-xs text-zinc-500">
              <span className="flex items-center gap-1.5">
                <MapPin size={12} className="text-zinc-600" />
                {person.location}
              </span>
              <span className="flex items-center gap-1.5">
                <Calendar size={12} className="text-zinc-600" />
                Founded {person.founded}
              </span>
              <span className="flex items-center gap-1.5">
                <Users size={12} className="text-zinc-600" />
                Age {person.age}
              </span>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
              {person.stats.map(stat => (
                <div key={stat.label} className="bg-zinc-800 rounded-xl p-3 text-center border border-zinc-700">
                  <p className="text-lg font-black text-amber-400 leading-none mb-1">{stat.value}</p>
                  <p className="text-[9px] font-black uppercase tracking-widest text-zinc-500">{stat.label}</p>
                </div>
              ))}
            </div>

            {/* Bio */}
            <p className="text-zinc-400 text-sm leading-relaxed mt-6 italic">
              "{person.bio}"
            </p>
          </div>
        </div>

        {/* ── Story sections ───────────────────────────────────── */}
        <div className="px-6 sm:px-10 py-10 space-y-10">

          {[
            { label: 'The Beginning',   icon: <Calendar size={14} />,   text: person.story.origin    },
            { label: 'Building Up',     icon: <TrendingUp size={14} />, text: person.story.growth    },
            { label: 'The Milestone',   icon: <Award size={14} />,      text: person.story.milestone },
            { label: 'What\'s Next',    icon: <ArrowRight size={14} />, text: person.story.vision    },
          ].map(section => (
            <div key={section.label} className="border-l-2 border-zinc-800 pl-6 hover:border-amber-500 transition-colors duration-300">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-amber-500">{section.icon}</span>
                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-500">
                  {section.label}
                </p>
              </div>
              <p className="text-zinc-300 text-sm sm:text-base leading-relaxed">
                {section.text}
              </p>
            </div>
          ))}
        </div>

        {/* ── Modal footer ─────────────────────────────────────── */}
        <div className="border-t border-zinc-900 px-8 py-6 flex justify-end">
          <button
            onClick={onClose}
            className="bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// Top30Page
// ─────────────────────────────────────────────────────────────────
export default function Top30Page({ onBack }) {
  const [activeCategory, setActiveCategory] = useState('All');
  const [selectedPerson, setSelectedPerson] = useState(null);

  const filtered = honorees.filter(
    h => activeCategory === 'All' || h.category === activeCategory
  );

  return (
    <div className="min-h-screen bg-black font-sans text-zinc-100">

      {/* Story popup */}
      {selectedPerson && (
        <StoryModal
          person={selectedPerson}
          onClose={() => setSelectedPerson(null)}
        />
      )}

      {/* ── Breadcrumb ───────────────────────────────────────── */}
      <div className="bg-zinc-950 border-b border-zinc-900 px-4 sm:px-6 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs sm:text-sm min-w-0">
            <button onClick={onBack} className="text-zinc-500 hover:text-amber-500 transition font-bold shrink-0">
              BusinessRun
            </button>
            <span className="text-zinc-700">/</span>
            <span className="text-zinc-200 font-bold shrink-0">Top 30 Under 30</span>
          </div>
          <span className="text-xs text-zinc-500 font-medium shrink-0 ml-4">Class of 2025</span>
        </div>
      </div>

      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="relative bg-zinc-950 overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-20"
          style={{ backgroundImage: "url('https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?q=80&w=2070')" }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-zinc-900/60 via-zinc-900/40 to-zinc-900" />

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-20 sm:py-28 md:py-36 text-center">
          <div className="flex justify-center items-center gap-4 mb-6">
            <div className="h-px w-10 bg-zinc-700" />
            <span className="text-zinc-500 uppercase tracking-[0.35em] text-xs font-semibold">
              Special Issue · Annual Edition
            </span>
            <div className="h-px w-10 bg-zinc-700" />
          </div>

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

          <div className="mt-10 sm:mt-14 flex flex-wrap justify-center gap-8 sm:gap-16">
            {[
              { value: '$140M+', label: 'Capital Raised' },
              { value: '4,500+', label: 'Jobs Created'   },
              { value: '9',      label: 'Industries'     },
            ].map(stat => (
              <div key={stat.label} className="text-left border-l-2 border-zinc-700 pl-4">
                <div className="text-xl sm:text-2xl font-bold italic text-white">{stat.value}</div>
                <div className="text-[10px] uppercase tracking-widest text-zinc-500 mt-0.5">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Category filter ───────────────────────────────────── */}
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
                  ? 'text-amber-500 border-b-2 border-amber-500'
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* ── Honoree grid ─────────────────────────────────────── */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-16 md:py-20">
        {filtered.length === 0 ? (
          <div className="text-center py-24 text-zinc-500">
            <Award size={32} className="mx-auto mb-4 opacity-30" />
            <p className="text-sm font-medium">No honorees in this category yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-12 sm:gap-y-16">
            {filtered.map(person => (
              <div
                key={person.id}
                className="group cursor-pointer"
                onClick={() => setSelectedPerson(person)}
              >
                {/* Photo — NO rank number */}
                <div className="relative aspect-[3/4] overflow-hidden bg-zinc-800 rounded-xl">
                  <img
                    src={person.img}
                    alt={person.name}
                    className="w-full h-full object-cover grayscale group-hover:grayscale-0 transition-all duration-700 group-hover:scale-105"
                  />
                  {/* Tap hint overlay */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all duration-300 flex items-center justify-center">
                    <span className="opacity-0 group-hover:opacity-100 transition-all duration-300 bg-amber-500 text-black text-[9px] font-black uppercase tracking-widest px-4 py-2 rounded-full">
                      Read Story
                    </span>
                  </div>
                  {/* Category pill */}
                  <div className="absolute bottom-3 left-3">
                    <span className="bg-zinc-950/90 backdrop-blur-sm text-zinc-400 text-[10px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full">
                      {person.category}
                    </span>
                  </div>
                </div>

                {/* Info */}
                <div className="mt-5 pl-3 border-l-2 border-transparent group-hover:border-amber-500 transition-all duration-300">
                  <div className="flex justify-between items-start gap-2">
                    <div>
                      <h3 className="text-lg font-bold uppercase tracking-tight text-zinc-100 leading-tight">
                        {person.name},{' '}
                        <span className="font-normal text-zinc-500">{person.age}</span>
                      </h3>
                      <p className="text-xs font-bold uppercase tracking-widest text-zinc-500 mt-1">
                        {person.company}
                      </p>
                    </div>
                    <Award size={18} className="text-zinc-700 group-hover:text-amber-500 transition-colors flex-shrink-0 mt-1" />
                  </div>
                  <p className="text-zinc-500 text-sm mt-3 leading-relaxed line-clamp-2">
                    {person.bio}
                  </p>
                  <div className="mt-4 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-amber-500 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-1 group-hover:translate-y-0">
                    Read Profile <ChevronRight size={12} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Nomination CTA ───────────────────────────────────── */}
      <section className="bg-zinc-950 py-20 sm:py-24 mt-8">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 text-center">
          <div className="flex justify-center items-center gap-4 mb-6">
            <div className="h-px w-8 bg-zinc-700" />
            <span className="text-zinc-500 uppercase tracking-[0.3em] text-[10px] font-semibold">
              Class of 2026
            </span>
            <div className="h-px w-8 bg-zinc-700" />
          </div>
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-black italic uppercase tracking-tighter text-white mb-5">
            Know a Visionary?
          </h2>
          <p className="text-zinc-500 text-sm sm:text-base leading-relaxed mb-10 font-light">
            Nominations for the 2026 Class are now open. We are looking for
            the next generation of builders shaping Africa's future.
          </p>
          <button className="group relative px-10 py-4 bg-zinc-900 border border-zinc-800 text-zinc-100 font-bold uppercase text-xs tracking-[0.25em] overflow-hidden rounded-xl hover:border-amber-500 transition-colors duration-300">
            <span className="relative z-10 group-hover:text-black transition-colors duration-300">Nominate Now</span>
            <div className="absolute inset-0 bg-amber-500 rounded-xl transform translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
          </button>
        </div>
      </section>

    </div>
  );
}
