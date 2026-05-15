import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

// ─────────────────────────────────────────────────────────────
// Data
// ─────────────────────────────────────────────────────────────
const CATEGORIES = [
  { label: 'All Editions', value: 'all' },
  { label: 'Business',     value: 'business' },
  { label: 'Technology',   value: 'tech' },
  { label: 'Sport',        value: 'sport' },
  { label: 'Entertainment',value: 'entertainment' },
  { label: 'Lifestyle',    value: 'lifestyle' },
];

const MAGAZINES = [
  {
    id: 42, 
    priority: true,
    sortOrder: 6,
    category: 'tech',
    title: 'The Match Day Legacy',
    issue: 'Issue #65',
    label: 'Issue #65: Sports Entertainment',
    desc: 'How Leo DaSilva scaled a football watch party into a premium community and lifestyle ecosystem.',
    coverBg: 'bg-zinc-900',
    img: `${process.env.PUBLIC_URL}/image0.jpeg`,
    imgClass: 'w-full h-full object-cover object-center',
    CoverContent: () => (
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
    ),
    article: {
      title: 'Leo DaSilva on Scaling a 7-Edition Match Day Legacy and the Future of Nigerian Football Fan Culture',
      subtitle: 'What started as a 90-minute game viewing has evolved into a masterclass in community building and brand scalability in the heart of Lagos.',
      author: 'Maxwell Olusegun Njarika',
      role: 'Lifestyle & Sports Correspondent',
      readTime: '6 min read',
      pullQuote: 'My community has strict rules and we don’t condone people who break them. This quality translates to the cult following my watch party has.',
      body: [
        'In the heart of Lagos, football is more than a sport—it is a collective heartbeat. But for Leo DaSilva, it’s also a masterclass in community building and brand scalability. As he prepares for the 7th Edition of his famed Watch Party at The Condo Event Center, it is clear he has turned matchday into a premium business ecosystem.',

        '## The Lifestyle Pivot\n\nOne of the most striking elements of the 7th edition is the integration of an After Party. This wasn\'t just a random addition; it was a strategic move sparked by a partnership with Budweiser. Leo explains that transitioning from a sports viewing event to a full-scale entertainment experience keeps the audience engaged long after the final whistle, turning a game into a recurring staple of Lagos sports culture.',

        '## The "Standard" as a Currency\n\nIn a city filled with viewing centers, Leo has carved out a premium niche. The secret lies in uncompromising standards. By enforcing a "culture of respect" and strict community rules, he has created a safe space where people of all classes feel comfortable. For Leo, the business isn’t just about the screen; it’s about the environment and the quality that translates into a cult following.',

        '## Built on Experience\n\nWhile many see the Watch Party as a recent triumph, Leo’s roots in event management go deep. While at university in the UK, he owned one of the largest nightlife and booking companies, hosting events since he was 17. The Watch Party wasn\'t a gamble; it was a calculated execution based on years of knowing how to grow projects from the ground up.',

        '## Future Playbook: Club Ownership?\n\nWith a community this loyal, the next logical step in the "Business of Football" is ownership. While Leo has been thinking about it, he views the prospect with a Product Manager’s pragmatism. He notes that owning a club requires immense structure and stability, viewing it perhaps as a future retirement plan rather than an immediate move.',

        '## BusinessRun Insight: Community as an Asset\n\nLeo DaSilva has demonstrated that in the modern economy, a loyal community is the most valuable currency. Whether Arsenal brings home a trophy or not, the reliability of the "Standard" ensures the brand stands. He has successfully won the game of sports entertainment in Lagos by treating fandom as a high-value, scalable product.',
      ],
    },
  },

  {
    id: 2,
    sortOrder: 10,
    category: 'entertainment',
    title: 'The Streaming Wars',
    issue: 'Issue #47',
    label: 'Issue #47: Entertainment',
    desc: 'Inside the future of cinema and streaming.',
    coverBg: 'bg-purple-900',
    img: `${process.env.PUBLIC_URL}/cover_2_streaming_wars.jpg`,
    imgClass: 'w-full h-full object-cover object-top',
    CoverContent: () => (
      <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
    ),
    article: {
      title: 'Who Controls the Screen?',
      subtitle: 'As streaming giants battle for global subscribers, African creators are rewriting the rules',
      author: 'Ngozi Adeyemi',
      role: 'Entertainment Editor',
      readTime: '8 min read',
      pullQuote: 'The streaming wars are no longer just about Hollywood. Every continent is now a battlefield, and Africa is fighting back with stories no outsider could have told.',
      body: [
        'When Netflix launched its first African original series, it seemed like a watershed moment — the world\'s largest streaming platform finally acknowledging that stories from the continent could compete globally. But the relationship between streaming giants and African filmmakers has grown more complicated, and more instructive, with every passing year.',
        'Nigeria\'s cinema sector recorded between ₦15.6 billion and ₦20 billion in box office revenue in 2025, with Nollywood titles now accounting for nearly half of all theatrical takings — a remarkable reversal from just a decade ago when Hollywood dominated the multiplex. Funke Akindele\'s A Tribe Called Judah became the first Nollywood film to cross the billion-naira mark, and the industry has been scaling ever since.',
        'Yet the streaming picture is more nuanced. Netflix, once aggressively acquiring Nigerian content, has scaled back significantly. From roughly 19 Nollywood titles in the first half of 2023, the number dropped to 10 in the first half of 2024, and to just 5 in the first half of 2025. Amazon Prime has similarly pulled back, declining to greenlight new African originals. The international streaming dream, it turns out, is more fragile than the hype suggested.',
        'Filmmakers have responded with pragmatism. YouTube — once dismissed as the low-budget option — has emerged as a genuine revenue engine. Nollywood-focused YouTube channels are estimated to have generated between $10 million and $15 million per month in 2024, according to industry analysts. Omoni Oboli\'s Love in Every Word accumulated over 20 million views in three months alone, demonstrating that African audiences will show up in enormous numbers for content that speaks to their lives.',
        'The deeper question is not which platform wins, but what model best serves African storytelling. Streaming offers prestige and global reach; YouTube offers freedom and direct audience connection; cinema offers cultural event status that no screen at home can replicate. Increasingly, the smartest producers are treating all three not as competitors but as different stages in a single content lifecycle.',
        'As artificial intelligence begins reshaping post-production, editing and even scriptwriting across global film industries, African filmmakers who embrace these tools without losing their cultural specificity may find themselves with an extraordinary competitive advantage. The stories are already there. The question is who controls the pipeline through which they flow to the world.',
      ],
    },
  },
  // ── Business ──────────────────────────────────────────────
  {
    id: 8,
    sortOrder: 14,
    category: 'business',
    title: 'The Founder Playbook',
    issue: 'Issue #50',
    label: 'Issue #50: Founder Playbook',
    desc: 'How Africa\'s boldest founders built from zero.',
    coverBg: 'bg-slate-900',
    img: `${process.env.PUBLIC_URL}/cover_8_founder_playbook.jpg`,
    imgClass: 'w-full h-full object-cover opacity-30',
    CoverContent: () => (
      <div className="absolute inset-0 flex flex-col justify-center items-center text-center p-8 text-white">
        <div className="border border-white/20 p-6 w-full">
          <p className="text-[9px] tracking-[0.3em] uppercase text-white/50 mb-3">BusinessRun Exclusive</p>
          <h3 style={{ fontFamily: 'Playfair Display, serif' }} className="text-3xl italic leading-snug">The Founder<br/>Playbook</h3>
          <div className="w-8 h-px bg-orange-500 mx-auto mt-4" />
        </div>
      </div>
    ),
    article: {
      title: 'Build Different',
      subtitle: 'The founders who are redefining African entrepreneurship share what they wish they had known at the start',
      author: 'Obiageli Nwosu',
      role: 'Entrepreneurship Editor',
      readTime: '9 min read',
      pullQuote: 'The playbook for building a company in Lagos is not the playbook for Silicon Valley, and it should not be. The founders who succeed here have learned to stop importing frameworks and start writing their own.',
      body: [
        'Africa\'s startup ecosystem has matured significantly over the past decade. Fintech continues to attract the lion\'s share of venture capital on the continent, accounting for more than 40 percent of all startup funding in 2024. The names that anchor the ecosystem — Flutterwave, Paystack, Moniepoint, Opay — have moved from regional success stories to global financial infrastructure. But the founders who built them will tell you that their path looked nothing like the stories they were originally told about how startups work.',
        'The first lesson most African founders learn is about resilience. Not the inspirational kind referenced in keynote speeches, but the operational kind — solving for power cuts during product demos, navigating the gap between promised government infrastructure and daily reality, managing team morale through currency devaluations that erode purchasing power faster than you can adjust payroll. These are problems that no accelerator programme in San Francisco will prepare you for.',
        'Chioma Ifeanyi-Eze, founder of a rapidly growing logistics platform in Lagos, describes her first year of building as "a daily education in what I didn\'t know." She had returned from studying abroad with frameworks and models, none of which survived first contact with the Nigerian market. "The data I had in my pitch deck was real. The customer I assumed existed was not quite the customer I found. The unit economics I projected worked — just not on the timeline I expected." She rebuilt, adjusted, and scaled. Her company now processes thousands of deliveries daily.',
        'The founders who navigate this environment successfully share certain qualities. They are pathologically comfortable with ambiguity. They build trust-based relationships with customers and partners before systems exist to formalise those relationships. They are intensely local in their understanding of culture, language and behaviour even when their product ambitions are continental.',
        'Access to capital remains the most persistent structural challenge. While Nigeria is home to over 250 fintech companies and broader startup activity spans multiple sectors, the financing gap between early traction and Series A is a graveyard where genuinely promising businesses go to die. Founders who crack this gap — often through creative bootstrapping, diaspora networks and non-traditional investors — tend to build companies with fundamentally stronger unit economics as a result.',
        'The African founder playbook, if such a thing exists, is less a set of tactics and more a disposition: build with humility about what you don\'t know, move faster than the market\'s instability, stay closer to your customer than any competitor can manage, and treat resilience not as a virtue but as a core operational capability. The founders doing this are not just building companies. They are building the category.',
      ],
    },
  },

  // ── Technology ────────────────────────────────────────────

  // ── Sport ─────────────────────────────────────────────────

  {
    id: 17,
    priority: true,
    sortOrder: 1,
    category: 'sport',
    title: 'Anthony Joshua 2026',
    issue: 'Issue #59',
    label: 'Issue #59: Boxing Business',
    desc: 'The high-stakes economics of a global boxing comeback.',
    coverBg: 'bg-slate-900',
    img: `${process.env.PUBLIC_URL}/2026-anthony.jpg`,
    imgClass: 'w-full h-full object-cover object-top',
    CoverContent: () => (
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
    ),
    article: {
      title: 'Anthony Joshua 2026: The High-Stakes Business of a Global Boxing Comeback',
      subtitle: 'Beyond the ring: the billion-dollar economics and brand resilience behind Anthony Joshua\'s anticipated mid-2026 return to heavyweight boxing',
      author: 'Jide Adeyemi',
      role: 'Sports Business Correspondent',
      readTime: '10 min read',
      pullQuote: 'Joshua\'s net worth stood at £232 million on the 2025 Sunday Times Rich List — ahead of both Harry Kane and Tyson Fury. He earned that not just by winning fights, but by understanding that boxing is a business, and he is the product.',
      body: [
        'On December 19, 2025, Anthony Joshua walked into Kaseya Center in Miami and knocked out Jake Paul in the sixth round of a fully sanctioned heavyweight bout streamed live on Netflix. The fight was billed as Judgment Day and generated a reported total purse of $184 million. Ten days later, Joshua was riding in a Lexus SUV on the Lagos-Ibadan Expressway in Nigeria when the vehicle collided with a stationary truck. Two of his closest friends and teammates — strength and conditioning coach Sina Ghami and trainer Latif "Latz" Ayodele — were killed. The story of Anthony Joshua\'s 2026 comeback cannot be understood without both of those events sitting side by side.',

        '## Heavyweight Boxing Economics\n\nThe economic architecture of elite heavyweight boxing has been fundamentally restructured by streaming. When Joshua fought Wladimir Klitschko at Wembley in 2017 — one of the greatest nights in British boxing history — his total earnings were estimated at £15 to £20 million, driven by pay-per-view revenue from Sky Box Office. By 2025, that model was obsolete. Netflix\'s decision to stream the Paul fight to its 260 million global subscribers without charging a penny of additional pay-per-view changed the financial maths entirely. The platform averaged 33 million global viewers for the Joshua-Paul bout — a figure that would have ranked as the fifteenth most-watched television broadcast in the United States in 2024. For boxing, that reach is extraordinary. For Netflix, it was a subscriber acquisition and retention engine worth multiples of any fighter purse.\n\nThe reported $184 million total purse — roughly $92 million per fighter — represented one of the largest combined payouts in boxing history. Even taking the conservative estimate from journalist Ariel Helwani, who suggested actual figures were closer to $40 to $50 million per fighter, Joshua\'s single-night payday from the Paul fight dwarfed what any heavyweight could have earned from a traditional PPV event a decade ago. The business of heavyweight boxing economics in 2026 is no longer governed by how many people will pay £25 to watch a fight at home. It is governed by how many new subscribers a streaming platform believes a fight will attract — and keep.',

        '## Athlete Brand Endorsements 2026\n\nJoshua\'s commercial portfolio is among the most carefully constructed in British sport. His endorsement partners include Under Armour, Hugo Boss, Beats by Dre, Lucozade, Jaguar Land Rover and Audemars Piguet — a selection that spans mass market appeal and genuine luxury positioning. Forbes estimated his annual endorsement earnings at approximately $8 million, while other analysts place the figure closer to £10 to £15 million annually when the full commercial picture is included. His Sunday Times Rich List net worth of £232 million in 2025 — placing him ahead of Harry Kane and Tyson Fury — reflects a career of financial intelligence as much as ring performance.\n\nThe critical question for athlete brand endorsements in 2026 is what happens to Joshua\'s commercial standing during a period of personal crisis and competitive uncertainty. The Lagos car crash of December 29, 2025, which killed teammates Sina Ghami and Latif Ayodele, put every commercial obligation on hold while Joshua grieved, recovered physically and processed a trauma that no corporate schedule can fully accommodate. His public tribute in January 2026 — "The mission must go on. I understand my duty" — was simultaneously a deeply personal statement and, whether intended or not, a signal to commercial partners that he remained committed, present and purposeful.\n\nThe brands that align with Joshua in 2026 are not simply buying access to his audience. They are investing in a narrative of resilience — a quality that, for sports endorsement purposes, is arguably more valuable than victory. Joshua has now survived defeats to Ruiz, two losses to Usyk, a fifth-round KO by Daniel Dubois, and a near-fatal accident that killed two people he loved. He keeps returning. For a brand selling energy, performance or aspiration, that story is worth considerably more than a clean record.',

        '## Anthony Joshua vs Jake Paul Revenue\n\nThe Paul fight illuminated something important about how boxing generates money in the streaming era. The Anthony Joshua vs Jake Paul revenue picture was not primarily about what fans paid to watch — it was about what Netflix gained by having them watch at all. The platform\'s investment in live boxing events, including its earlier Paul-Tyson fight which drew 108 million global viewers and generated an estimated $2.27 billion in new subscriber value, established a template: pay extraordinary fighter purses, generate extraordinary global attention, convert that attention into subscriber growth that compounds across the entire content library.\n\nFor Joshua specifically, the fight served multiple commercial purposes. It restored his global mainstream visibility after the Dubois loss had raised genuine questions about his future in top-level boxing. It demonstrated that the pay structure of legacy boxing and the promotional machinery of influencer boxing could co-exist productively. And it re-established Nigeria — where Joshua has deep cultural roots and where his visit immediately post-fight ended so catastrophically — as a meaningful market for his brand and his sport. The Nigerian media coverage of the fight, the crash and his recovery has been extensive and emotionally invested in a way that no marketing campaign could manufacture.',

        '## Sports Media Rights Nigeria\n\nFor the Nigerian market, the Joshua story in 2025 and 2026 carries layers that go beyond boxing. He has Nigerian heritage through his father, carries a Yoruba name, and has described Nigeria as home in multiple interviews. His presence in Lagos in December 2025 — on holiday, visiting family after a major career win — ended with him receiving treatment at a Nigerian hospital while the country mourned two of his teammates. President Bola Tinubu personally called Joshua to convey condolences. The Nigerian sports media rights conversation around his comeback is therefore not simply about broadcast access to a boxing match. It is about a national figure returning to the ring after a tragedy that happened on Nigerian soil.\n\nSports media rights in Nigeria have been evolving. DAZN, which has a historic partnership with Joshua estimated at around £100 million over five years, provides streaming access across markets including Nigeria. As smartphone penetration and mobile data affordability continue improving, the audience for premium live sport on streaming platforms in Nigeria is growing at a meaningful rate. The Joshua-Fury fight, should it eventually happen, would be among the most commercially significant sporting events ever targeted at the Nigerian market — a matchup between a boxer of Nigerian descent and one of the sport\'s last genuine global icons, promoted under Saudi Arabia\'s Riyadh Season banner with the production scale that implies.',

        'As of early March 2026, Eddie Hearn has confirmed that Joshua is targeting a return to the ring in July, with the Fury fight now pushed to late 2026 at the earliest and more likely 2027. "The mission must go on," Joshua said. He meant it as a tribute. But for the business of boxing — and for the brands, platforms and markets built around his career — it reads as something else: a commercial guarantee from one of sport\'s most resilient assets, that the story is not over, and that the next chapter will be worth watching.',
      ],
    },
  },

  // ── Entertainment ─────────────────────────────────────────
  {
    id: 13,
    sortOrder: 5,
    category: 'entertainment',
    title: 'Afrobeats Goes Global',
    issue: 'Issue #55',
    label: 'Issue #55: Sound of Africa',
    desc: 'The genre that conquered the world\'s playlists.',
    coverBg: 'bg-pink-900',
    img: `${process.env.PUBLIC_URL}/2026-tyla.jpg`,
    imgClass: 'w-full h-full object-cover object-top',
    CoverContent: () => (
      <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
    ),
    article: {
      title: 'The Sound That Swallowed the World',
      subtitle: 'Afrobeats did not go global by chasing Western approval. It went global by refusing to compromise, until the world had no choice but to follow',
      author: 'Sola Afolabi',
      role: 'Music Editor',
      readTime: '9 min read',
      pullQuote: 'Burna Boy holds the record for the most number-one appearances on the UK Afrobeats chart. Tyla won back-to-back Grammy Awards for Best African Music Performance. Rema and Wizkid lead Spotify\'s most-streamed artists. The world\'s playlist is Nigerian.',
      body: [
        'In 2020, the Official Charts Company in the UK launched a dedicated Afrobeats chart — a formal acknowledgement that the genre had generated enough commercial weight to warrant its own measurement. The move was symbolic more than practical; Afrobeats had been reshaping British popular culture for years before the chart existed. By 2025, it was reshaping global culture, and the chart had become one of the most watched in the music industry.',
        'The genre\'s global ascent was built on a paradox: its success came not from diluting its African identity but from intensifying it. The artists who have defined Afrobeats\' global moment — Burna Boy, Wizkid, Davido, Tems, Rema, Ayra Starr — did not smooth out the rhythmic complexity, the Yoruba and Pidgin lyrics, the cultural references that make the music specific. They doubled down on those elements, and the world came to them.',
        'Burna Boy holds the record for the most number-one appearances on the UK Afrobeats Chart — eleven, spanning songs that range from introspective confessionals to euphoric dance anthems. His 2023 tour sold out London\'s 80,000-capacity stadium, a benchmark of global reach that few artists of any genre have achieved. Wizkid\'s "Essence", featuring Tems, became one of the most streamed songs in the world in 2021 and remains in rotation globally years later. Rema\'s "Calm Down" transcended the genre entirely, appearing on mainstream pop charts across sixty countries.',
        'The data from Spotify tells the story unambiguously. In 2025, Burna Boy, Rema, Wizkid and Asake led the platform\'s most-streamed Afrobeats artists globally. Ayra Starr was the sole female artist in the top five — a position she earned through releases that combined Afrobeats authenticity with pop accessibility, including "Santa" which charted internationally through a collaboration with Puerto Rican artist Rauw Alejandro.',
        'Perhaps most significantly, South Africa\'s Tyla won the Grammy Award for Best African Music Performance in both 2024 and 2026, becoming a global superstar in the process. Her 2026 win with "Push 2 Start" — beating Burna Boy, Davido and Wizkid in the same category — illustrated how the genre has expanded to encompass Amapiano and other Southern African sounds, creating a richer, more diverse Pan-African music ecosystem.',
        'Billboard launched the US Afrobeats Songs chart in 2022, and the Recording Academy created the Best African Music Performance Grammy category shortly after — both institutional recognitions of a genre that had earned its place at the top table of global music. From Lagos to London to Los Angeles, the sound of Africa is the sound of now.',
      ],
    },
  },
  {
    id: 14,
    sortOrder: 8,
    category: 'entertainment',
    title: 'Nollywood 3.0',
    issue: 'Issue #56',
    label: 'Issue #56: Nollywood Reimagined',
    desc: 'How streaming is transforming African cinema.',
    coverBg: 'bg-red-950',
    img: `${process.env.PUBLIC_URL}/2026-funke.png`,
    imgClass: 'w-full h-full object-cover object-top',
    CoverContent: () => (
      <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
    ),
    article: {
      title: 'The Billion-Naira Screen',
      subtitle: 'Nollywood is the second largest film industry in the world — and it is only just getting started',
      author: 'Chinyere Okwu',
      role: 'Film Critic',
      readTime: '8 min read',
      pullQuote: 'In the first half of 2024, Nollywood films outsold Hollywood at the Nigerian box office for the first time in history. A Tribe Called Judah crossed one billion naira. This is what a film industry that has arrived looks like.',
      body: [
        'Nollywood is the second largest film industry in the world by volume, after Bollywood. It produces hundreds of films annually. It employs millions of Nigerians directly and indirectly. And in 2024, it achieved something its practitioners had long believed possible and its sceptics had long dismissed: Nollywood films captured 50.05 percent of Nigerian box office revenue in the first half of the year, outselling Hollywood on home soil for the first time.',
        'The milestone was built on a foundation of improving quality, bigger production budgets and an increasingly sophisticated relationship between Nigerian filmmakers and their audience. Funke Akindele\'s A Tribe Called Judah — a crime drama about siblings drawn into Lagos\'s criminal underworld — became the first Nollywood film to cross the billion-naira mark at the box office, setting a new benchmark for what local films could achieve commercially. Nigeria\'s total box office revenue surged by 60 percent in 2024, reaching ₦11.5 billion.',
        'The streaming dimension is more complicated. Netflix, which once seemed poised to become Nollywood\'s most powerful international distribution partner, has significantly scaled back its Nigerian investments. From approximately 19 Nollywood titles in the first half of 2023, Netflix released just 5 in the first half of 2025. Amazon Prime has similarly retreated, declining to greenlight new African originals. The streaming giants, it turned out, were building market presence rather than making a long-term commitment.',
        'The industry\'s response has been instructive. Rather than contracting, Nollywood has diversified its revenue model. YouTube has emerged as a genuine financial engine — industry analysts estimate Nollywood-focused YouTube channels generated between $10 and $15 million monthly in 2024. Omoni Oboli\'s Love in Every Word accumulated over 20 million YouTube views in three months, demonstrating that African audiences will engage deeply with content that speaks to their experience, regardless of platform.',
        'Regional streamers — Showmax, iROKOtv, and newer entrants like Kava and Circuit — are filling some of the gap left by international platforms, with different commercial models and closer relationships with Nigerian filmmakers. The expansion of cinema infrastructure is also a significant tailwind: West Africa\'s cinema locations are projected to rise by 19 percent, reaching 127 cinemas, creating more exhibition capacity for Nollywood\'s growing output.',
        'The era of Nollywood 3.0 is defined not by any single platform or distribution model but by a maturing industry that has learned to operate across multiple channels simultaneously, manage its international ambitions with realistic eyes, and remain deeply connected to the audience that has loved it since the beginning. The billion-naira screen is not an anomaly. It is the new normal.',
      ],
    },
  },

  // ── Lifestyle ─────────────────────────────────────────────
  {
    id: 16,
    sortOrder: 6,
    category: 'lifestyle',
    title: 'Wealth & Wellness',
    issue: 'Issue #58',
    label: 'Issue #58: Wealth & Wellness',
    desc: 'Why Africa\'s new rich are investing in themselves.',
    coverBg: 'bg-teal-900',
    img: `${process.env.PUBLIC_URL}/2026-wealth.jpg`,
    imgClass: 'w-full h-full object-cover object-top',
    CoverContent: () => (
      <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
    ),
    article: {
      title: 'The New Wealth Equation',
      subtitle: 'Africa\'s rising professional class is discovering that the real luxury is not what you own — it\'s how you live',
      author: 'Dr. Yewande Adeyemi',
      role: 'Health & Wealth Correspondent',
      readTime: '7 min read',
      pullQuote: 'The generation that watched their parents sacrifice everything for a salary is building something different: businesses and lifestyles designed around longevity, not just ambition. They are not less driven. They are more intentional.',
      body: [
        'Something is shifting in how Africa\'s rising professional class thinks about wealth, and the shift is more significant than a lifestyle trend. It is a generational recalibration — a response to the burnout, the chronic stress and the quietly broken relationships that the previous generation\'s model of success produced in such quantity.',
        'The executives and entrepreneurs building African business today are increasingly asking questions their predecessors rarely did: What is the point of accumulating wealth that you are too exhausted to enjoy? What does financial success mean if it costs you your health, your relationships, or your sense of self? These are not soft questions. In economies as demanding as Nigeria\'s, Kenya\'s or Ghana\'s, they are survival questions.',
        'The wellness industry in Africa is responding to this demand. Fitness culture has transformed in Lagos, Nairobi and Johannesburg — gyms that were once associated with vanity are now positioned as mental health infrastructure. Corporate wellness programmes are proliferating as employers in competitive talent markets discover that healthy employees are more productive and more loyal. The mindfulness and meditation movement, once viewed with scepticism in much of Africa, is gaining genuine traction among professionals who have found that traditional stress management strategies — burying yourself in work, socialising until exhaustion — were not, in fact, strategies at all.',
        'The financial dimension of this shift is equally interesting. Nigeria\'s Gen Z professionals, as one analysis observed, are redefining stability as flexibility rather than security. Multiple income streams, digital skills, cooperative savings (ajo and esusu in their modern fintech forms), and real asset investment are replacing the single-employer loyalty of the previous generation. The goal is not just to earn more but to build a financial architecture that provides genuine freedom — the ability to make decisions about your time and energy rather than being perpetually trapped by obligations.',
        'Wealth without wellness, this generation is learning, is not actually wealth. It is a different kind of poverty — one where you have the resources to address every problem except the one that matters most, which is the quality of the life you are living.',
        'The luxury that Africa\'s new professional class is most interested in is the luxury that money has always been best at buying but that most people realise only too late: time. Time for relationships, for rest, for creative work, for the kind of reflection that turns a career into a life. Building wealth on the continent in 2026 is increasingly inseparable from building the conditions for that wealth to be worth having.',
      ],
    },
  },

  // ── Lifestyle: Asake ──────────────────────────────────────
  {
    id: 18,
    priority: true,
    sortOrder: 2,
    category: 'lifestyle',
    title: 'Asake\'s ₦441M Gift',
    issue: 'Issue #60',
    label: 'Issue #60: Creative Wealth',
    desc: 'The economics behind Asake buying his parents two luxury SUVs.',
    coverBg: 'bg-zinc-900',
    img: `${process.env.PUBLIC_URL}/2026-asake.jpg`,
    imgClass: 'w-full h-full object-cover object-top',
    CoverContent: () => (
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
    ),
    article: {
      title: 'Asake\'s ₦441 Million Week: The Business Behind the Viral Gratitude',
      subtitle: 'While the headlines celebrated the gesture, the real story is about the rapid capital accumulation of Africa\'s modern creative class — and what it signals about the new Afrobeats economy',
      author: 'Temi Lawson',
      role: 'Lifestyle & Culture Editor',
      readTime: '8 min read',
      pullQuote: 'In less than four years, Ahmed Ololade has gone from a Theatre Arts graduate doing campus shows to an artist with 2.5 billion streams, a California property, an independent label, and the ability to deploy nearly half a billion naira in a single week. That is not a celebrity story. That is a business story.',
      body: [
        'The headlines wrote themselves: one of Nigeria\'s biggest Afrobeats stars gifting his parents two high-end SUVs within days of each other. Within a single week, Asake reportedly purchased a 2025 Toyota Land Cruiser Prado valued at around ₦130 million for his father, Fatai Odunsi, and a Mercedes-Benz G-Wagon G63 worth roughly ₦311 million for his mother — a combined outlay of approximately ₦441 million in personal assets. On the surface, it is a viral celebrity moment. Beneath the glamour lies a much more instructive signal about where Afrobeats money is now, and how fast it moves.',

        '## The Financialization of Afrobeats\n\nThe Afrobeats economy has undergone a structural transformation in the past five years. What was once a regional music movement is now a multi-billion-dollar global cultural export generating revenue across streaming, touring, brand partnerships, publishing rights, licensing deals, and merchandise. Artists like Asake are no longer simply musicians — they are entertainment entrepreneurs operating global content brands.\n\nAsake\'s trajectory illustrates the speed at which this new economy rewards the right talent at the right moment. Born Ahmed Ololade on January 13, 1995, in Lagos, he studied Theatre and Dramatic Arts at Obafemi Awolowo University in Ile-Ife — a foundation that trained his instincts for performance and storytelling before the music industry ever noticed him. Olamide signed him to YBNL Nation in February 2022. What followed was one of the most compressed ascents in modern African music: seven number-one singles in the first year alone, a debut album that broke records on Apple Music and debuted at number 66 on the Billboard 200, a sold-out run at London\'s O2 Academy Brixton — in five minutes. By 2023, he had headlined Barclays Center in New York, becoming the first African artist to do so, and sold out the O2 Arena in London, arriving by helicopter.',

        '## Asset Allocation: The Economics of Gratitude\n\nFrom a purely financial perspective, luxury SUVs are depreciating assets. A G-Wagon G63 does not appreciate in value the way real estate or equity does. Asake already owns a luxury home in Lekki, Lagos, a reported property in California purchased in 2025, and a personal vehicle fleet that includes a Mercedes-Benz GLE Coupe, Range Rover Velar, and Porsche. He is not naive about asset allocation.\n\nBut in the cultural and brand economy of Nigeria — where success is public, family loyalty is sacred, and the narrative of "remembering where you came from" carries genuine commercial weight — luxury gifts to parents represent a different class of investment entirely. They represent emotional equity. In many African success narratives, taking care of family is part of the brand story. It signals stability, loyalty, and gratitude: values that resonate deeply with fans and, crucially, with the corporate partners who want to attach their names to those values. By gifting high-profile vehicles to his parents and doing so publicly, Asake reinforces the identity that has underpinned his commercial appeal from the beginning — the artist who never forgot the streets, the son who provides. That storytelling translates directly into fan loyalty, and fan loyalty translates directly into streaming numbers, ticket sales, and brand endorsement leverage.',

        '## Conflict Resolution as Brand Strategy\n\nAnother layer of the story adds a subtle but commercially significant dimension. In recent months, public attention had briefly focused on reported tensions between Asake and his father, Fatai Odunsi — a narrative that, left unaddressed, could complicate the warm, grateful persona central to his public identity.\n\nThe gift of the Land Cruiser Prado to his father signals something beyond generosity. It signals reconciliation. In the modern celebrity playbook, managing personal narratives publicly is increasingly inseparable from managing brand value. Artists today operate as brands, and brand stability matters to sponsors and corporate partners. Globacom, which has historically partnered with major Afrobeats artists, and the wave of telecoms, beverage and fintech companies seeking credible Afrobeats endorsements in 2025 and 2026, are buying more than reach — they are buying a story. Resolving a family dispute publicly not only restores personal relationships; it protects and potentially strengthens the artist\'s commercial value in the marketplace.',

        '## The New Economics of African Stardom\n\nThe financial picture behind this single week of gift-giving is instructive. Asake has accumulated over 2.5 billion total streams across platforms, with Spotify alone generating an estimated $4 to $6.8 million net after label and distribution splits. His net worth as of 2025 is estimated between ₦9 billion and ₦16 billion — roughly $6 to $10.5 million dollars. In February 2025, he launched Giran Republic, his independent label, departing YBNL Nation after three transformative years. That same year, he announced a collaborative EP with Wizkid titled Real, Vol. 1, which debuted at number one on TurnTable\'s Album Chart upon its January 2026 release. Independence means he now keeps a substantially larger share of every naira his music generates — a decision that will compound significantly over the next decade.\n\nA decade ago, stories like this would have been framed purely as celebrity lifestyle news. Today, they reflect something larger: the financial transformation of African entertainment at speed. Afrobeats is no longer just a genre. It is a global economic engine powering tours across four continents, streaming revenues in the billions, international partnerships with luxury and consumer brands, and a generation of Nigerian artists who have compressed decades of wealth accumulation into a handful of years. The biggest hits in the modern Afrobeats economy are not just songs. They are wealth-building stories — and Asake\'s is only just beginning.',
      ],
    },
  },
  {
    id: 40, // Assigning next sequential ID
    priority: true,
    sortOrder: 5,
    category: 'lifestyle',
    title: 'Fashion, Reprogrammed',
    issue: 'Issue #64',
    label: 'Issue #64: Techwear Movement',
    desc: 'How Cyberjunior is building Africa’s first true techwear movement through engineered design.',
    coverBg: 'bg-zinc-950',
    img: `${process.env.PUBLIC_URL}/image0.png`,
    imgClass: 'w-full h-full object-cover object-center',
    CoverContent: () => (
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
    ),
    article: {
      title: 'Fashion, Reprogrammed: How Cyberjunior is Building Africa’s First True Techwear Movement',
      subtitle: 'In Lagos, a new generation of brands is pushing beyond expression into function, identity, and engineered design.',
      author: 'BusinessRun Editorial',
      role: 'Fashion & Technology Desk',
      readTime: '7 min read',
      pullQuote: 'Cyberjunior is not just participating in African fashion — it is trying to redefine what African fashion looks like in a global, tech-driven era.',
      body: [
        'In Lagos, fashion has always been expressive. But a new generation of brands is pushing beyond expression into function, identity, and engineered design. Cyberjunior is one of the clearest signals of that shift — a company positioning itself not just as a streetwear label, but as Africa’s answer to the global techwear movement.',

        '## Beyond Streetwear: The Rise of Functional Fashion\n\nCyberjunior operates in a space that sits between fashion, technology, and utility. Its design philosophy is rooted in what the global market calls techwear — garments engineered for performance, adaptability, and urban living. According to its platform, the brand focuses on tech-infused fabrics with durability and thermal regulation, tactical functionality through modular pockets and adjustable elements, and a distinct African-inspired design language. This is not accidental. It is a deliberate attempt to move African fashion from aesthetic storytelling toward engineered product design.',

        '## The Lagos Advantage: Culture Meets Velocity\n\nCyberjunior is built out of Lagos — and that matters. Lagos is fast, chaotic, creative, and youth-driven. In that environment, fashion is not passive; it is survival, identity, and status combined. Cyberjunior taps into this by designing clothing for movement, performance, and visibility. Its pieces — from tactical sets to cargo wear and reflective hoodies — are built for a generation that lives both online (digital identity) and on the streets (physical presence).',

        '## From Clothing to Mindset\n\nWhat separates Cyberjunior from traditional fashion brands is its positioning. It does not sell clothes; it sells a mindset. At fashion showcases and runway appearances, the brand frames itself as “Bold. Forward. Unapologetically Cyber.” This language is intentional. It aligns the brand with digital culture, cyberpunk aesthetics, and a future-facing identity. In other words, Cyberjunior is trying to redefine what African fashion looks like in a global, tech-driven era.',

        '## The Product Strategy: Utility as a Premium\n\nGlobally, techwear has been dominated by brands in Japan, Europe, and the U.S. Cyberjunior is attempting to localize that category for Africa. Its collections are priced to sit in an accessible premium tier, making functional fashion available to a wider demographic. This is important because in emerging markets, the brands that win are not always the most expensive — they are the ones that balance identity, function, and accessibility.',

        '## Scaling Beyond Nigeria\n\nCyberjunior is already signaling international ambition. Its presence and positioning extend across Nigeria, the UK, and the UAE. This multi-market identity suggests a larger strategy: build in Lagos, scale globally. This mirrors the playbook used by Afrobeats, African fintech, and other creative exports. The business of identity is at the core of this shift; young consumers are no longer just buying products; they are buying identity systems.',

        '## BusinessRun Insight: The Future of Export\n\nCyberjunior represents a new category of African business: brands that don’t just adapt global trends — they reinterpret them through an African lens and export them back to the world. The opportunity is massive. Africa has the youngest population globally, street culture is accelerating, and digital identity is becoming currency. The question is not whether African fashion will globalize—it already is. The question is: which brands will own the narrative? Cyberjunior is positioning itself to be one of them.',
      ],
    },
  },

  // ── Entertainment: Big 3 Cold War ─────────────────────────
  {
    id: 19,
    sortOrder: 4,
    category: 'entertainment',
    title: 'The Big 3 Cold War',
    issue: 'Issue #61',
    label: 'Issue #61: The Rivalry',
    desc: 'Wizkid. Burna. Davido. The collab the world wants — and why it may never happen.',
    coverBg: 'bg-slate-900',
    img: `${process.env.PUBLIC_URL}/2026-wizkid.jpg`,
    imgClass: 'w-full h-full object-cover object-top',
    CoverContent: () => (
      <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
    ),
    article: {
      title: 'The Big 3 Cold War: Billions at Stake, One Collab the World Can\'t Have',
      subtitle: 'Wizkid, Burna Boy and Davido are the most commercially powerful trio in African music history. Their refusal to collaborate is costing Afrobeats — and each other — more than anyone will admit',
      author: 'Sola Afolabi',
      role: 'Music Editor',
      readTime: '10 min read',
      pullQuote: 'Davido\'s manager Asa Asika said it plainly: "Latin music is popular because Bad Bunny and J Balvin collaborated. That is the mistake this generation of Nigerian superstars is making." He was talking about the Big 3. Nobody moved.',
      body: [
        'Picture the three most powerful artists in African music history in the same building. Same city, same night, same industry. Now picture them not speaking. Not collaborating. Barely acknowledging. That is the reality of the Afrobeats Big 3 in 2025 and 2026 — a cold war conducted through subliminal verses, cryptic social media posts, fan proxy battles and an almost theatrical performance of mutual indifference that has become one of the most discussed, most analysed and most commercially consequential dynamics in global music.',

        '## The Beef Timeline: How It Got Here\n\nThe rivalry between Wizkid and Davido is the oldest — a decade-long competition that began as friendly creative friction and hardened into something more complex as their respective fan bases, Wizkid FC and the 30BG, turned every perceived slight into a warzone. They have never made a song together. They have exchanged Twitter jabs. In 2025, Wizkid posted cryptic messages on Snapchat — "Oloshi," "Dead, tired and burnt out souls" — widely read as directed at his longtime rival.\n\nBurna Boy\'s position in the triangle fractured more recently. He and Wizkid had been allies — collaborators on "B D\'or" and "Ginger." But in August 2025, after a Gunna album featured both artists, their fan bases went to war. Burna allegedly took to a secondary Instagram account with pointed comments. Then at a live performance, he reportedly rejected the Big 3 label entirely: "Big 2, and then me." Wizkid allegedly fired back with "Weirdo." A working alliance was over.',

        '## The Commercial Cost of the Cold War\n\nThe financial stakes are staggering. Davido\'s manager Asa Asika articulated the opportunity cost on the Afropolitan Podcast: Latin music\'s global dominance was built on collaboration. Bad Bunny and J Balvin toured together, featured each other, co-signed each other\'s moments. The cumulative effect lifted the entire genre. Asika warned that Afrobeats\' biggest stars are making the opposite mistake — and the numbers back him up.\n\nConsider what a Big 3 collaboration would generate. Each artist individually commands eight-figure annual earnings. A joint single would likely break every African streaming record in existence on day one. A joint tour would shatter box office marks across four continents. Industry insiders estimate north of $50 million in combined tour revenue — easily. It is not happening. Davido has said "it\'s not impossible," but added that "the people around us" are the real obstacle. Burna is busy declaring himself beyond the group entirely. Wizkid\'s silence is the loudest statement of all.',

        '## What Each Artist Stands to Lose — and Gain\n\nThe cold war is not symmetrical. Burna Boy, fresh off his "Big 2" declaration and stadium-level touring with No Sign of Weakness, is positioning himself as the outlier who has transcended the competition. His commercial platform backs the posture — but the declaration also risks isolating him from a Pan-African cultural moment he helped build.\n\nDavido has been the most conciliatory. His 5ive album in April 2025 showed he is still creating at the highest level, and his manager\'s public frustration with the standoff suggests real appetite for change. Wizkid\'s January 2026 Real Vol. 1 EP with Asake debuted at number one on TurnTable — proof his engine is running. But public reconciliation with either rival would require a scale of ego management none of the three have yet demonstrated.\n\nMeanwhile, a new generation — Asake, Rema, Omah Lay — is watching and conspicuously doing the opposite. Asake and Wizkid\'s collaboration is the template: cross-generational linking that generates heat without requiring anyone to lose. The original Big 3 could learn from their successors.',

        '## The Only People Losing Are the Fans\n\nThe Latin music comparison haunts every honest conversation about this. Bad Bunny and J Balvin did not become less individually successful by collaborating. They became more, and they lifted the entire genre with them. Afrobeats is the most globally ascendant genre in the world right now. The artists at its summit are sitting on the most commercially powerful collaboration in music history — and none of them will make the call.\n\nMaybe one day they will. Iyanya believes it will happen. Asika clearly thinks it should. Even Davido won\'t fully close the door. But in 2026, the Big 3 Cold War continues. The streaming numbers are extraordinary. The tours sell out. The individual brands are worth hundreds of millions. And the song that could change everything — the one that 100 million people would stream in the first 24 hours — remains unmade. The only people truly losing are the fans holding their breath, and the genre that could be even bigger than it already is.',
      ],
    },
  },

  // ── Business: Nigeria Unicorn Factory ────────────────────

  // ── Tech: Peller Livestream Economy ───────────────────────
  {
    id: 21,
    priority: true,
    sortOrder: 3,
    category: 'tech',
    title: 'The Livestream Economy',
    issue: 'Issue #63',
    label: 'Issue #63: Creator Economy',
    desc: 'How Peller is turning viral fame into a real-world business across 19 Nigerian states.',
    coverBg: 'bg-violet-950',
    img: `${process.env.PUBLIC_URL}/2026-peller.jpg`,
    imgClass: 'w-full h-full object-cover object-top',
    CoverContent: () => (
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
    ),
    article: {
      title: 'The Livestream Economy: How Peller Is Turning Viral Fame Into a Real-World Business',
      subtitle: 'A 21-year-old with a smartphone is touring 19 Nigerian states — not with an album, but with a livestream. What looks chaotic on screen is actually a sophisticated monetisation machine',
      author: 'Kelechi Eze',
      role: 'Technology & Culture Editor',
      readTime: '9 min read',
      pullQuote: 'For decades, nationwide tours belonged to music superstars with global labels and arena promoters. In 2026, a 21-year-old with a smartphone and millions of online viewers is doing it differently — and the business logic is more sophisticated than it looks.',
      body: [
        'For decades, a nationwide tour in Nigeria belonged almost exclusively to music superstars — artists like Wizkid or Burna Boy, armed with albums, global label backing and major promoters. Concert tours required infrastructure that took years to build. In 2026, a 21-year-old digital native named Peller is rewriting that assumption. He is currently touring 19 Nigerian states — not with an album or an arena show, but with something far more modern: a smartphone, a livestream, and millions of online viewers who follow him everywhere. What Peller is building is not just entertainment. It is a real-time monetisation engine powered by Nigeria\'s fast-growing creator economy.',

        '## The Rise of the Direct-to-Consumer Creator\n\nUnlike traditional celebrities, Peller\'s rise did not come through television, record labels, or film studios. It came through direct audience engagement — the kind that accumulates one viewer, one comment, one shared clip at a time, until the numbers become impossible to ignore. Livestreaming allows creators to bypass traditional media gatekeepers entirely, connecting instantly with audiences who can donate, subscribe, and engage in real time.\n\nThe business model this creates is structurally different from anything the entertainment industry has produced before. The formula is deceptively simple: Audience → Engagement → Monetisation. For Peller, the livestream tour transforms digital attention into physical community events, where fans gather in cities like Benin, Abuja and Port Harcourt to participate in the broadcast in person. The audience is simultaneously the product, the distribution channel, and the marketing department. No label required. No promoter required. No album required.',

        '## Platform Wars: The Kick Strategy\n\nA central piece of the business architecture behind the tour is Peller\'s exclusive relationship with Kick, the livestreaming platform aggressively expanding to compete with TikTok Live and Twitch. By securing an ambassador partnership with Kick — alongside its parent company Stake — Peller has effectively turned his audience into a strategic commercial asset that a global tech platform is willing to pay for.\n\nFrom a business standpoint, this move is elegant. He is essentially licensing his audience to a global platform hungry to break into Nigeria\'s digital entertainment market — one of the fastest-growing creator ecosystems on the continent. The tour amplifies this by providing something streaming partnerships alone cannot buy: real-world visibility, street-level legitimacy, and the kind of organic cultural moment that money cannot manufacture. Every city Peller enters becomes a content event. Every crowd that gathers becomes proof of reach. The platform gets distribution data and brand presence. Peller gets a guaranteed income floor regardless of what the algorithm does on any given day.',

        '## The IShowSpeed Effect: IRL Streaming Goes Nigerian\n\nPeller\'s tour reflects a global trend that has been building for several years — IRL streaming, short for In Real Life. Creators no longer broadcast only from controlled environments. They take their audiences into the unpredictable world and let the chaos become the content.\n\nThe global pioneer of this format is IShowSpeed, whose chaotic public streams have drawn tens of millions of viewers worldwide and demonstrated that the street itself can be a studio. Earlier in 2025, a viral moment involving Peller and Speed captured significant online attention — the kind of crossover that typically fades within days as the algorithm moves on. Peller responded differently. Rather than riding the moment, he used it as architecture. He built his own version of the IRL infrastructure, adapted for Nigerian streets, Nigerian culture, and Nigerian internet conditions. By taking livestream culture directly into Lagos, Benin, Abuja and Port Harcourt, he is proving that local creators can command the same intensity of audience engagement as global influencers — on their own terms, in their own language, with their own crowd.',

        '## Institutional Backing: When Finance Meets the Feed\n\nPerhaps the most strategically significant element of the tour is the involvement of Moremonee Microfinance Bank as a sponsor. Banks and corporate institutions have historically been slow to recognise digital creators as legitimate marketing channels. That calculation is changing rapidly, and Moremonee\'s partnership with Peller signals a broader shift: financial institutions are beginning to understand that a creator with genuine audience trust — particularly among the 18-to-30 demographic that banks most need to acquire — is worth more than a billboard on a Lagos highway.\n\nBy attaching to Peller\'s tour, the bank is not just buying logo placement. It is buying cultural association with a moment, an energy, and an audience that traditional advertising cannot reach with anything approaching the same authenticity. For Peller, the sponsorship validates the commercial model and helps underwrite the operational costs of a genuinely complex production.',

        '## The Hidden Business: Logistics at Scale\n\nBehind the apparent chaos of the livestreams lies an operation of considerable complexity. A 19-state tour in Nigeria involves production teams, security personnel, transport and accommodation across different cities, portable broadcasting equipment, and — critically — reliable high-speed internet connections in locations that are not always cooperative. Unlike a traditional concert with a controlled venue and a predictable technical rider, IRL streaming happens in crowded streets, public squares, and spontaneous gatherings where nothing can be fully planned and everything must be handled in real time.\n\nMaintaining a 24/7 digital broadcast under those conditions requires a level of operational coordination that resembles a mobile media company on wheels more than an entertainment event. The invisible infrastructure behind what viewers see on their screens — the people managing connectivity, crowd safety, platform stability and logistics simultaneously — is the real business. And building it at 21, across 19 states, is the proof of concept that no pitch deck could have provided.',

        '## Nigeria\'s Creator Economy Enters a New Phase\n\nFor years, Nigeria\'s entertainment exports were dominated by music and film — two industries with established infrastructure, identifiable gatekeepers and well-worn paths to commercial success. The creator economy is different. It has no gatekeepers by design. It rewards consistency, authenticity and audience intelligence over industry access. And it is now attracting the kind of institutional and corporate attention that signals it is graduating from cultural novelty to serious business sector.\n\nPeller\'s 19-state tour may look like a viral adventure on screen. From a business perspective, it is something more precise: a live demonstration that Nigerian creators can build scalable media businesses from scratch, anchor brand partnerships, command platform investment, and generate the kind of real-world cultural energy that no advertising budget can replicate. If the livestream economy continues on its current trajectory — and Nigeria\'s 122 million internet users suggest it will — tours like this may soon be as common as music concerts. Because in the digital age, attention is the asset, the audience is the infrastructure, and the creator who understands both is running a business whether they call it that or not.',
      ],
    },
  },
  //--------------------------------
  {
    id: 43,
    priority: true,
    sortOrder: 7,
    category: 'tech',
    title: 'The Evolution of a Media Powerhouse',
    issue: 'Issue #66',
    label: 'Issue #66: Media & Production',
    desc: 'How Elvina Ibru transitioned from global stages to building the infrastructure of Nigerian broadcasting.',
    coverBg: 'bg-rose-950',
    img: `${process.env.PUBLIC_URL}/2026-elvina.jpeg`,
    imgClass: 'w-full h-full object-cover object-top',
    CoverContent: () => (
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
  ),
    article: {
      title: 'Elvina Ibru: The Evolution of a Media Powerhouse from Screen to Boardroom',
      subtitle: 'From the hallowed halls of the BBC to bringing the Idols franchise to West Africa, Elvina’s journey is a masterclass in adaptation, resilience, and the mastery of the business behind the show.',
      author: 'Maxwell Njarika',
      role: 'Technology & Culture Correspondent',
      readTime: '8 min read',
      pullQuote: 'At school, I was taught about my ART and perfecting my CRAFT. In short, I was tutored in SHOW, but not BUSINESS.',
      body: [
      'In the landscape of Nigerian entertainment, few names carry the multi-generational weight and versatile brilliance of Elvina Baby Ibru. To many, she is the unforgettable face of The Bling Lagosians or the commanding voice of Mellow Magic on Classic FM. But to define her simply as an "actress" is to miss the structural impact she has had on the Nigerian media industry for over three decades.',

      'From the hallowed halls of the BBC to the high-stakes world of international franchises like Idols West Africa, Elvina’s journey is a masterclass in adaptation, resilience, and the "begrudging" mastery of the business behind the show.',

      '## The Foundation: Art vs. Industry',

      'Born in Lagos on May 22, 1972, Elvina’s technical foundation is global. A graduate of the London Academy of Performing Arts with a BA in International Relations from Webster University, London, her early years were spent on prestigious UK stages. As a teenager, she was selected out of thousands to join the National Youth Music Theatre, sharing the spotlight with future Hollywood icons like Jude Law and Jonny Lee Miller.',

      'However, Elvina is the first to admit that a world-class education in "Art" is not the same as an education in "Industry."',

      '"It [school] did not prepare me at all," Elvina reflects candidly. "At school, I was taught about my ART and perfecting my CRAFT. In short, I was tutored in SHOW, but not BUSINESS."',

      'Upon returning to Nigeria, she faced a "rude awakening." The global training was there, but the local infrastructure required a different kind of intelligence. "I remember discussing an idea with someone and the person telling me I should give him a proposal. I asked myself, ‘What on earth is a proposal?’"',

      '## The Pivot: From Voice to Vision',

      'Her return to Nigeria saw her anchor the breakfast show on Minaj Broadcast International (MBI)—a channel she describes as being run with the same professional rigor as the BBC—and dominate the live band circuit. With a "big singing voice" and a peak album recording in progress, tragedy struck in Benin.',

      '"I woke up the next morning with no voice! I could not even speak loud enough to communicate, let alone sing or act," she shares.',

      'Faced with the potential end of her performing career, Elvina didn\'t exit the stage; she built the theater. In 1999, she founded 2wice As Nice, a production company designed to keep her in the industry "behind the camera." This move into production birthed impactful mini-documentaries and films like Cajoling and Black Harvest, focusing on her personal advocacy areas of anti-human trafficking and support for survivors of sexual violence.',

      '## Bringing \'Idols\' to the West',

      'One of the most significant yet under-discussed milestones in Nigerian media history is Elvina’s role in bringing the IDOLS franchise to the region as Idols West Africa in 2007. For Elvina, the project was a confirmation of her long-held belief: Nigerian talent is peerless.',

      '"Nigerian talent can stand next to any international artiste and beat them hands down," she asserts. But the business lesson was equally clear: "It does not matter whether the format is European or American. The FORMAT itself is the important part."',

      '## The Addictive Rush of the Stage',

      'While she has starred in modern screen hits like Slum Kings, Riona, and Wives on Strike, her heart remains tethered to the discipline of the stage. Her recent work, including writing the play Nyso And The Egg for the 2025 Lagos International Theatre Festival, highlights her commitment to the rigors of live performance.',

      '"Theatre can give me an almost addictive rush that movies can never give," says the writer-director. "You have to be extremely disciplined... If you don\'t work as ONE in the theatre, then your project simply won\'t work."',

      '## Legacy: No Balance Required',

      'When asked how she balances her fierce public persona with her personal life as a single mother and advocate, Elvina’s answer is as authentic as her performances:',

      '"I don\'t have to balance my public persona with anything... The same Elvina you see out and about is the same one that you don\'t see when she is at home. I am who I am at all times."'
      ],
    },
  },

  {
    id: 44,
    priority: true,
    sortOrder: 8,
    category: 'fashion',
    title: 'Stitching an Empire',
    issue: 'Issue #67',
    label: 'Issue #67: Under30Women in Business',
    desc: 'How Basirat transformed a maternal gift into a couture institution and a mission for industrialization.',
    coverBg: 'bg-amber-900',
    img: `${process.env.PUBLIC_URL}/2026-basirat.jpeg`,
    imgClass: 'w-full h-full object-cover object-center',
    CoverContent: () => (
    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
  ),
    article: {
      title: 'STITCHING AN EMPIRE: How Basirat’s Maternal Gift Evolved Into a Couture Legacy',
      subtitle: 'From a mother’s workshop to the first feature of the 2026 Under30Women in Business cohort, Basirat is redefining African fashion through industrial systems.',
      author: 'BusinessRun Editorial',
      role: 'Enterprise & Growth Desk',
      readTime: '5 min read',
      pullQuote: 'Seeing clients confidently wear my designs made me understand that I was not just sewing clothes; I was building an identity and creating value.',
      body: [
      'In the bustling world of African fashion, many "sew clothes," but few build institutions. Basirat, the visionary behind her eponymous couture brand and the first-ever feature of the 2026 Under30Women in Business cohort, is firmly in the latter category. For Basirat, the journey is not just a career path—it is a mission of industrialization.',

      '## The Inheritance of Grit\n\nEvery legacy has a starting point. For Basirat, it was a gift she didn’t initially realize the value of—fashion design skills learned from her mother. The transition from hobbyist to professional happened at the intersection of trust and commerce. When clients began trusting her with their most significant milestones, Basirat realized she was working with identity, not just fabric.',

      '## Overcoming the "Street" Hurdles\n\nLike many in the Under30 cohort, Basirat’s early days were defined by high talent but low visibility. With limited tools, she had to build her own spotlight. Through a masterclass in consistency and strategic use of social media, she proved that while physical resources might be limited, a determined mind is infinite.',

      '## The Systems of the "Suite"\n\nWhat separates a "tailor" from a "CEO" is the implementation of systems. Basirat has embraced this shift with surgical precision, overhauling her workflow to move from survival-based operations to executive management. By organizing orders, prioritizing client communication, and scheduling production, she is scaling without compromising her signature excellence.',

      '## The Five-Year Mandate: A Global Export House\n\nBasirat’s vision is no longer local; she speaks with the clarity of a global industrialist. She envisions a recognized couture house representing African creativity on the world stage. Her advice to those starting small is simple: "Where you start does not define how far you can go. Every successful brand once started from a small space."',

      '## BusinessRun Insight: The Bravery of Structure\n\nBasirat represents the "Power 10" pioneers—founders who understand that grit is the fuel, but structure is the engine. As the first of her cohort to step forward, she is positioning herself not just as a designer, but as a leader of the next generation of African enterprise, moving fashion from the workshop to the global market.'
      ],
    },
  },
];

// ─────────────────────────────────────────────────────────────
// Magazine Card
// ─────────────────────────────────────────────────────────────
function MagazineCard({ mag, onOpen }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      className="cursor-pointer"
      style={{ transition: 'transform 0.5s cubic-bezier(0.23,1,0.32,1)', transform: hovered ? 'translateY(-12px)' : 'translateY(0)', perspective: '1000px' }}
      onClick={() => onOpen(mag)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div
        className={`relative aspect-[3/4] rounded-lg overflow-hidden mb-4 ${mag.coverBg}`}
        style={{
          transition: 'transform 0.6s cubic-bezier(0.23,1,0.32,1), box-shadow 0.6s ease',
          transform: hovered ? 'rotateY(-15deg)' : 'rotateY(0deg)',
          boxShadow: hovered ? '20px 20px 40px -15px rgba(0,0,0,0.4)' : '0 10px 30px -10px rgba(0,0,0,0.3)',
          transformStyle: 'preserve-3d',
        }}
      >
        <img src={mag.img} alt={mag.title} className={mag.imgClass} />
        {/* Glossy overlay */}
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'linear-gradient(135deg,rgba(255,255,255,0.3) 0%,rgba(255,255,255,0) 50%)' }} />
        <mag.CoverContent />
      </div>
      <h4 className="font-bold text-slate-800">{mag.label}</h4>
      <p className="text-sm text-slate-500 mt-0.5">{mag.desc}</p>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Magazine Reader
// ─────────────────────────────────────────────────────────────
function MagazineReader({ mag, onClose }) {
  const [isDark, setIsDark]       = useState(false);
  const [fontSize, setFontSize]   = useState(20);
  const [progress, setProgress]   = useState(0);
  const [toast, setToast]         = useState('');
  const [toastVisible, setToastVisible] = useState(false);
  const bodyRef = useRef();

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  // Escape key to close
  useEffect(() => {
    const fn = e => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', fn);
    return () => document.removeEventListener('keydown', fn);
  }, [onClose]);

  function handleScroll() {
    const el = bodyRef.current;
    if (!el) return;
    const pct = (el.scrollTop / (el.scrollHeight - el.clientHeight)) * 100;
    setProgress(Math.min(100, Math.round(pct)));
  }

  function zoom(delta) {
    setFontSize(prev => {
      const next = Math.min(32, Math.max(14, prev + delta / 5));
      showToast(`Font size: ${Math.round((next / 20) * 100)}%`);
      return next;
    });
  }

  function showToast(msg) {
    setToast(msg);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 2500);
  }

  return (
    <div className="fixed inset-0 z-[200] bg-slate-900 flex flex-col overflow-hidden">

      {/* Top nav */}
      <nav className="w-full bg-slate-900/95 backdrop-blur-md px-4 py-4 flex justify-between items-center text-white border-b border-white/10 shrink-0">
        <div className="flex items-center gap-4 min-w-0">
          <button
            onClick={onClose}
            className="hover:bg-white/10 p-2 rounded-full transition-colors shrink-0"
          >
            <i className="fas fa-times text-xl"></i>
          </button>
          <div className="min-w-0">
            <h2 className="font-bold leading-none truncate">{mag.title}</h2>
            <span className="text-xs text-white/60">{mag.issue}</span>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="hidden md:flex items-center gap-4 text-xs font-semibold">
            <button className="hover:text-orange-500 transition" onClick={() => zoom(-10)}>A-</button>
            <div className="w-32 h-1 bg-white/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-orange-500 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <button className="hover:text-orange-500 transition" onClick={() => zoom(10)}>A+</button>
          </div>
          <button
            className="hover:text-orange-500 transition w-8 h-8 flex items-center justify-center"
            onClick={() => setIsDark(d => !d)}
          >
            <i className={`fas ${isDark ? 'fa-sun' : 'fa-moon'}`}></i>
          </button>
        </div>
      </nav>

      {/* Article body */}
      <div
        ref={bodyRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-6 md:p-12 lg:p-24 transition-colors duration-300"
        style={{ backgroundColor: isDark ? '#0f172a' : '#ffffff', color: isDark ? '#cbd5e1' : '#334155' }}
      >
        <article className="max-w-3xl mx-auto">
          <header className="mb-12">
            <span className="text-orange-600 font-black uppercase text-xs tracking-widest">{mag.label}</span>
            <h1
              className="text-4xl md:text-6xl mt-4 leading-tight"
              style={{ fontFamily: 'Playfair Display, serif', color: isDark ? '#f8fafc' : '#0f172a' }}
            >
              {mag.article ? mag.article.title : mag.title}
            </h1>
            {mag.article?.subtitle && (
              <p className="text-lg mt-4 leading-relaxed" style={{ color: isDark ? '#94a3b8' : '#64748b' }}>
                {mag.article.subtitle}
              </p>
            )}
            <div className="flex items-center gap-4 mt-8 border-y border-slate-100 py-4">
              <div className="w-10 h-10 rounded-full bg-slate-200 shrink-0" />
              <div className="text-sm">
                <p className="font-bold" style={{ color: isDark ? '#f8fafc' : '#0f172a' }}>
                  By {mag.article?.author || 'BusinessRun Editorial'}
                </p>
                <p className="text-zinc-500">{mag.article?.role || 'Staff Writer'} · {mag.article?.readTime || '5 min read'}</p>
              </div>
            </div>
          </header>

          <div className="leading-relaxed space-y-8" style={{ fontSize: `${fontSize}px` }}>
            {mag.article?.body ? (() => {
              // Flatten body: split any paragraph containing \n\n into sub-blocks,
              // then detect ## headings and render them as styled H2 elements.
              const blocks = [];
              mag.article.body.forEach((paragraph, srcIdx) => {
                const parts = paragraph.split('\n\n');
                parts.forEach((part, partIdx) => {
                  blocks.push({ text: part.trim(), srcIdx, partIdx, globalIdx: blocks.length });
                });
              });

              let pullQuoteInserted = false;
              const midPoint = Math.floor(blocks.length / 2);

              return blocks.map((block, i) => {
                const isHeading = block.text.startsWith('## ');
                const isFirst = i === 0 && !isHeading;
                const showPullQuote = !pullQuoteInserted && i === midPoint && mag.article.pullQuote;
                if (showPullQuote) pullQuoteInserted = true;

                if (isHeading) {
                  const headingText = block.text.replace(/^## /, '');
                  return (
                    <React.Fragment key={i}>
                      <h2
                        className="text-2xl font-bold mt-12 mb-2 pb-3 border-b border-slate-200"
                        style={{ fontFamily: 'Playfair Display, serif', color: isDark ? '#f8fafc' : '#0f172a' }}
                      >
                        {headingText}
                      </h2>
                    </React.Fragment>
                  );
                }

                return (
                  <React.Fragment key={i}>
                    {isFirst ? (
                      <p>
                        <span
                          className="float-left font-bold text-orange-600 mr-3 leading-none"
                          style={{ fontSize: `${fontSize * 3.2}px`, lineHeight: 1 }}
                        >{block.text.charAt(0)}</span>
                        {block.text.slice(1)}
                      </p>
                    ) : (
                      <p>{block.text}</p>
                    )}
                    {showPullQuote && (
                      <blockquote
                        className="border-l-4 border-orange-500 pl-6 my-12 italic font-light"
                        style={{ fontSize: `${fontSize * 1.2}px`, color: isDark ? '#f8fafc' : '#0f172a' }}
                      >
                        "{mag.article.pullQuote}"
                      </blockquote>
                    )}
                  </React.Fragment>
                );
              });
            })() : (
              <>
                <p>
                  <span
                    className="float-left font-bold text-orange-600 mr-3 leading-none"
                    style={{ fontSize: `${fontSize * 3.2}px`, lineHeight: 1 }}
                  >W</span>
                  hether it's the roar of the stadium or the silent tension of a movie premiere,
                  the pulse of our society is found in its shared experiences. This month, we've
                  expanded our reach to cover the intersections of athletic excellence and artistic brilliance.
                </p>
                <blockquote
                  className="border-l-4 border-orange-500 pl-6 my-12 italic font-light"
                  style={{ fontSize: `${fontSize * 1.2}px`, color: isDark ? '#f8fafc' : '#0f172a' }}
                >
                  "Entertainment isn't just about escape; it's about connection."
                </blockquote>
                <p>
                  Our mission remains the same: to bring you depth in a world of surfaces.
                </p>
              </>
            )}
          </div>
        </article>
      </div>

      {/* Bottom nav */}
      <footer className="bg-slate-900 p-4 border-t border-white/10 flex justify-center gap-8 text-white/80 shrink-0">
        <button className="hover:text-orange-500 transition flex items-center gap-2 text-sm">
          <i className="fas fa-chevron-left"></i>
          <span className="hidden md:inline">Previous Issue</span>
        </button>
        <div className="h-6 w-px bg-white/10" />
        <button className="hover:text-orange-500 transition flex items-center gap-2 text-sm">
          <span className="hidden md:inline">Next Issue</span>
          <i className="fas fa-chevron-right"></i>
        </button>
      </footer>

      {/* Toast */}
      <div
        className="fixed bottom-6 right-6 bg-slate-900 text-white px-6 py-3 rounded-xl shadow-2xl text-sm pointer-events-none z-[300] transition-all duration-300"
        style={{ opacity: toastVisible ? 1 : 0, transform: toastVisible ? 'translateY(0)' : 'translateY(24px)' }}
      >
        {toast}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// MagazinePage
// ─────────────────────────────────────────────────────────────
// Converts a desc string to a URL-safe slug
function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9 -]/g, '').trim().replace(/\s+/g, '-');
}

export default function MagazinePage({ onBack }) {
  const navigate  = useNavigate();
  const { articleSlug } = useParams();

  const [activeCategory, setActiveCategory] = useState('all');

  // Derive open article from URL slug — no local state needed
  const openMag = articleSlug
    ? MAGAZINES.find(m => slugify(m.desc) === articleSlug) ?? null
    : null;

  // Update browser tab title when article opens or closes
  useEffect(() => {
    if (openMag) {
      document.title = `${openMag.article?.title ?? openMag.title} | BusinessRun`;
    } else {
      document.title = 'Magazine | BusinessRun';
    }
    return () => { document.title = 'BusinessRun | The Pulse of African Enterprise'; };
  }, [openMag]);

  // Open an article — push slug-based URL
  function handleOpenMag(mag) {
    const slug = slugify(mag.desc);
    navigate(`/magazine/article/${slug}`);
    window.scrollTo(0, 0);
  }

  // Close article — back to magazine list
  function handleCloseMag() {
    navigate('/magazine');
    window.scrollTo(0, 0);
  }

  // Google Fonts
  useEffect(() => {
    const link = document.createElement('link');
    link.rel  = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,700;1,700&family=Oswald:wght@700&display=swap';
    document.head.appendChild(link);
    return () => document.head.removeChild(link);
  }, []);

  const filtered = MAGAZINES
    .filter(m => activeCategory === 'all' || m.category === activeCategory)
    .sort((a, b) => (a.sortOrder || 99) - (b.sortOrder || 99));

  return (
    <>
      {openMag && (
        <MagazineReader mag={openMag} onClose={handleCloseMag} />
      )}

      <div className="min-h-screen pb-24" style={{ backgroundColor: '#fcfcfc', fontFamily: 'Inter, sans-serif' }}>

        {/* Breadcrumb */}
        <div className="bg-zinc-950 border-b border-zinc-900 px-4 sm:px-6 py-3">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs sm:text-sm">
              <button onClick={onBack} className="text-zinc-500 hover:text-amber-500 transition font-black">
                BusinessRun
              </button>
              <span className="text-zinc-700">/</span>
              <span className="text-zinc-200 font-black">Magazine</span>
            </div>
            <span className="text-xs text-zinc-500 font-medium hidden sm:block">The Newsroom Archive</span>
          </div>
        </div>

        {/* Header */}
        <header className="pt-16 pb-12 px-6 max-w-7xl mx-auto text-center">
          <span className="text-orange-600 font-semibold tracking-widest uppercase text-sm mb-4 block">
            Our Latest Editions
          </span>
          <h1
            className="text-5xl md:text-7xl text-slate-900 mb-6"
            style={{ fontFamily: 'Playfair Display, serif' }}
          >
            The Newsroom <em>Archive</em>
          </h1>

          {/* Category filters */}
          <div className="flex flex-wrap justify-center gap-3 mt-10">
            {CATEGORIES.map(cat => (
              <button
                key={cat.value}
                onClick={() => setActiveCategory(cat.value)}
                className={`px-5 py-2 rounded-full border-2 font-medium text-sm transition-all ${
                  activeCategory === cat.value
                    ? 'border-slate-900 bg-slate-900 text-white'
                    : 'border-slate-200 text-slate-600 hover:border-orange-500 hover:text-orange-600'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </header>

        {/* Magazine grid */}
        <main className="max-w-7xl mx-auto px-6">
          {filtered.length === 0 ? (
            <div className="text-center py-24 text-zinc-500">
              <i className="fas fa-book-open text-4xl mb-4 block opacity-20"></i>
              <p className="text-sm">No editions in this category yet.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-12">
              {filtered.map(mag => (
                <MagazineCard key={mag.id} mag={mag} onOpen={handleOpenMag} />
              ))}
            </div>
          )}
        </main>

      </div>
    </>
  );
}
