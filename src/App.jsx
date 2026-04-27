import React, { useState, useEffect } from 'react';
import { X, Check, ArrowRight, Sparkles, Code2, Workflow, MessageSquare,
         Brain, Network, BarChart3, ShieldCheck, BookMarked, Clock,
         Play, ChevronDown, Minus, ArrowLeft, CalendarDays, CreditCard,
         FileText, Mail, Rocket, Search, TerminalSquare, Users, Crown } from 'lucide-react';
import AutomationAtomBuilder from './AutomationAtomBuilder.jsx';
import AtomBuilderPage from './AtomBuilderPage.jsx';

// ─────────────────────────────────────────────────────────────────────────────
// DESIGN TOKENS
// ─────────────────────────────────────────────────────────────────────────────
const BG     = '#0b0d12';
const SURF   = 'rgba(255,255,255,0.04)';
const BORD   = 'rgba(255,255,255,0.08)';
const ACCENT = '#00C9A7';

function shadeColor(hex, pct) {
  const n = parseInt(hex.slice(1), 16), a = Math.round(2.55 * pct);
  const r = Math.max(0, Math.min(255, (n >> 16) + a));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 0xff) + a));
  const b = Math.max(0, Math.min(255, (n & 0xff) + a));
  return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}

// ─────────────────────────────────────────────────────────────────────────────
// AGENTS
// ─────────────────────────────────────────────────────────────────────────────
const AGENTS = [
  { id:'veyra',  name:'Veyra',  specialty:'Design & Visual Creation',        tagline:'Conjures pixel-perfect worlds from thought.',              color:'#d946a8', glow:'rgba(217,70,168,0.4)',   orbit:0, angleOffset:0,   Icon:Sparkles,
    capabilities:['Brand systems, logos & identity design','UI/UX mockups & interactive prototypes','Image generation & editorial illustration','Video storyboards & motion direction'],
    prompts:['Design a minimalist logo for a biotech startup.','Mock up a three-screen onboarding flow.','Generate five hero banner concepts for our spring launch.'] },
  { id:'forge',  name:'Forge',  specialty:'App Building & Development',       tagline:'Forges shipping code from the raw ore of an idea.',        color:'#e8720c', glow:'rgba(232,114,12,0.4)',  orbit:0, angleOffset:120, Icon:Code2,
    capabilities:['Full-stack web & mobile app scaffolding','API design, refactoring & code review','Database schema generation & migrations','CI/CD, testing & deployment automation'],
    prompts:['Scaffold a Next.js app with auth and Stripe billing.','Review my pull request for security issues.','Generate unit tests for this service layer.'] },
  { id:'pulse',  name:'Pulse',  specialty:'Automation & Workflows',           tagline:'The heartbeat that keeps your ops running themselves.',     color:'#0dab6f', glow:'rgba(13,171,111,0.4)',  orbit:0, angleOffset:240, Icon:Workflow,
    capabilities:['Multi-step workflow orchestration','Zapier, Make & n8n-style automations','Trigger-based notifications & routing','Batch processing & scheduled jobs'],
    prompts:['When a deal closes in HubSpot, spin up a Slack channel.','Build a weekly digest from our 5 analytics sources.','Route inbound support emails by sentiment.'] },
  { id:'echo',   name:'Echo',   specialty:'Communication & Content',          tagline:'Speaks in every voice, remembers every audience.',         color:'#0799b8', glow:'rgba(7,153,184,0.4)',   orbit:1, angleOffset:0,   Icon:MessageSquare,
    capabilities:['Long-form writing, blogs & newsletters','Social copy tuned per channel & tone','Email sequences & outbound campaigns','Translation & localization at scale'],
    prompts:['Write a 10-email nurture sequence for enterprise leads.','Rewrite this announcement for LinkedIn, X, and press.','Translate our help docs into six languages.'] },
  { id:'axiom',  name:'Axiom',  specialty:'Research & Decision Support',      tagline:'Turns oceans of evidence into a single clear verdict.',     color:'#7c4ddd', glow:'rgba(124,77,221,0.4)',  orbit:1, angleOffset:90,  Icon:Brain,
    capabilities:['Deep multi-source research synthesis','Competitive & market landscape analysis','Evidence-graded decision memos','Due diligence & fact verification'],
    prompts:['Compare the top 5 vector DBs for our use case.','Brief me on regulatory changes in EU AI Act.','Should we build vs. buy our billing system?'] },
  { id:'nexus',  name:'Nexus',  specialty:'Integrations & Data Connections',  tagline:'Weaves every tool you own into one living web.',            color:'#2563d4', glow:'rgba(37,99,212,0.4)',   orbit:1, angleOffset:180, Icon:Network,
    capabilities:['300+ SaaS connectors out of the box','Custom API & webhook wiring','Bi-directional data sync with conflict rules','Unified schema across fragmented systems'],
    prompts:['Sync Salesforce contacts to Notion in real time.','Wire our internal API into Zendesk tickets.','Build a single pane of glass across our tools.'] },
  { id:'lumen',  name:'Lumen',  specialty:'Analytics & Insights',             tagline:'Illuminates the signal hiding in your data.',              color:'#c49a08', glow:'rgba(196,154,8,0.4)',   orbit:1, angleOffset:270, Icon:BarChart3,
    capabilities:['Dashboards & real-time KPI tracking','Anomaly detection & trend forecasting','Cohort, funnel & retention analysis','Natural-language queries over your data'],
    prompts:['Why did signups dip last Thursday?','Build a revenue dashboard by product line.','Forecast Q4 churn based on current behavior.'] },
  { id:'cipher', name:'Cipher', specialty:'Security & Compliance',            tagline:'The quiet sentinel guarding every gate.',                  color:'#c42020', glow:'rgba(196,32,32,0.4)',    orbit:2, angleOffset:0,   Icon:ShieldCheck,
    capabilities:['SOC 2, HIPAA & GDPR audit prep','Secrets scanning & vulnerability review','Access policy & role design','Incident response playbooks'],
    prompts:['Audit our repo for exposed credentials.','Draft a GDPR data processing agreement.','Design least-privilege roles for our stack.'] },
  { id:'atlas',  name:'Atlas',  specialty:'Knowledge & Documentation',        tagline:"Shoulders your company's entire memory.",                  color:'#0d917a', glow:'rgba(13,145,122,0.4)',  orbit:2, angleOffset:120, Icon:BookMarked,
    capabilities:['Auto-generated technical documentation','Internal wiki & knowledge-base curation','Onboarding guides tailored per role','Searchable cross-doc Q&A assistant'],
    prompts:['Document this codebase for new engineers.','Write SOPs for our customer onboarding.','Summarize every meeting from last quarter.'] },
  { id:'kairos', name:'Kairos', specialty:'Scheduling & Time Orchestration',  tagline:'Bends the calendar to the right moment.',                  color:'#4f51c4', glow:'rgba(79,81,196,0.4)',   orbit:2, angleOffset:240, Icon:Clock,
    capabilities:['Smart meeting coordination across teams','Project timeline & sprint planning','Focus-block protection & deep work routing','Cross-timezone availability solving'],
    prompts:['Find 30 min this week that works for all 7 of us.','Rebuild our product roadmap with these new priorities.','Protect my Tuesdays for deep work.'] },
];

// Three atom-style elliptical orbits at 0°, +60°, -60° rotations
const ORBITS = [
  { radius:200, duration:18, tiltX:72, tiltZ:0,   ring:'rgba(226,232,240,0.18)', rGlow:'rgba(148,163,184,0.10)' },
  { radius:275, duration:26, tiltX:72, tiltZ:60,  ring:'rgba(196,181,253,0.18)', rGlow:'rgba(129,140,248,0.08)' },
  { radius:350, duration:35, tiltX:72, tiltZ:-60, ring:'rgba(148,163,184,0.18)', rGlow:'rgba(100,116,139,0.08)' },
];

// ─────────────────────────────────────────────────────────────────────────────
// CARTOON CHARACTERS (modals + grid cards only)
// ─────────────────────────────────────────────────────────────────────────────
const AgentCharacter = ({ agent, size = 180 }) => {
  const { id, color } = agent;
  const dark = shadeColor(color, -35), light = shadeColor(color, 22);
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" style={{ overflow:'visible' }}>
      <defs>
        <radialGradient id={`b-${id}`} cx="35%" cy="30%" r="75%">
          <stop offset="0%" stopColor={light}/><stop offset="60%" stopColor={color}/><stop offset="100%" stopColor={dark}/>
        </radialGradient>
        <radialGradient id={`sh-${id}`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.82)"/><stop offset="100%" stopColor="rgba(255,255,255,0)"/>
        </radialGradient>
      </defs>
      <ellipse cx="100" cy="182" rx="48" ry="5" fill="rgba(0,0,0,0.28)"/>
      <rect x="79" y="155" width="13" height="20" rx="6" fill={dark}/>
      <rect x="108" y="155" width="13" height="20" rx="6" fill={dark}/>
      <circle cx="100" cy="100" r="57" fill={`url(#b-${id})`}/>
      <ellipse cx="78" cy="78" rx="19" ry="13" fill={`url(#sh-${id})`} opacity="0.48"/>
      <rect x="33" y="106" width="15" height="9" rx="4" fill={dark} transform="rotate(-14 40 110)"/>
      <rect x="152" y="106" width="15" height="9" rx="4" fill={dark} transform="rotate(14 160 110)"/>
      <circle cx="34" cy="108" r="7" fill={light}/><circle cx="166" cy="108" r="7" fill={light}/>
      <ellipse cx="86" cy="92" rx="8" ry="10" fill="#fff"/><ellipse cx="114" cy="92" rx="8" ry="10" fill="#fff"/>
      <circle cx="87" cy="94" r="5" fill="#111"/><circle cx="115" cy="94" r="5" fill="#111"/>
      <circle cx="89" cy="91" r="1.5" fill="#fff"/><circle cx="117" cy="91" r="1.5" fill="#fff"/>
      <path d="M 88 113 Q 100 121 112 113" stroke="#111" strokeWidth="2.2" fill="none" strokeLinecap="round"/>
      {id==='veyra'  && <><rect x="138" y="32" width="5" height="29" rx="2" fill="#7B3F20" transform="rotate(22 140 47)"/><ellipse cx="151" cy="27" rx="7" ry="10" fill={color} transform="rotate(22 151 27)"/><circle cx="55" cy="50" r="4" fill="#FBBF24"/><circle cx="48" cy="64" r="3" fill="#06B6D4"/></>}
      {id==='forge'  && <><rect x="84" y="22" width="32" height="12" rx="3" fill="#64748B"/><rect x="97" y="34" width="6" height="18" fill="#7C3A1A"/></>}
      {id==='pulse'  && <><path d="M50 43 L42 58 L52 58 L44 75" stroke="#FBBF24" strokeWidth="2.8" fill="none" strokeLinejoin="round"/><path d="M158 46 L150 60 L158 60 L152 73" stroke="#FBBF24" strokeWidth="2.2" fill="none" strokeLinejoin="round"/></>}
      {id==='echo'   && <><ellipse cx="153" cy="44" rx="20" ry="14" fill="#fff"/><path d="M142 55 L136 67 L147 58 Z" fill="#fff"/><circle cx="146" cy="44" r="2.2" fill={color}/><circle cx="154" cy="44" r="2.2" fill={color}/><circle cx="162" cy="44" r="2.2" fill={color}/></>}
      {id==='axiom'  && <><circle cx="114" cy="92" r="15" stroke="#FBBF24" strokeWidth="2.2" fill="none"/><line x1="126" y1="104" x2="136" y2="116" stroke="#FBBF24" strokeWidth="2"/></>}
      {id==='nexus'  && <><line x1="100" y1="42" x2="72" y2="26" stroke={color} strokeWidth="1.4" opacity="0.8"/><line x1="100" y1="42" x2="128" y2="26" stroke={color} strokeWidth="1.4" opacity="0.8"/><line x1="100" y1="42" x2="100" y2="16" stroke={color} strokeWidth="1.4" opacity="0.8"/><circle cx="72" cy="26" r="4" fill="#93C5FD"/><circle cx="128" cy="26" r="4" fill="#93C5FD"/><circle cx="100" cy="16" r="4" fill="#93C5FD"/></>}
      {id==='lumen'  && <><path d="M100 28 Q88 28 88 40 Q88 50 94 54 L94 62 L106 62 L106 54 Q112 50 112 40 Q112 28 100 28Z" fill="#FDE68A"/><rect x="94" y="62" width="12" height="3" fill="#92400E"/><line x1="100" y1="16" x2="100" y2="22" stroke="#FBBF24" strokeWidth="2"/><line x1="78" y1="23" x2="82" y2="28" stroke="#FBBF24" strokeWidth="2"/><line x1="122" y1="23" x2="118" y2="28" stroke="#FBBF24" strokeWidth="2"/></>}
      {id==='cipher' && <><path d="M162 92 L178 92 L178 114 Q178 124 170 128 Q162 124 162 114 Z" fill={dark} stroke={color} strokeWidth="1.8"/><path d="M167 103 L170 110 L176 101" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round"/></>}
      {id==='atlas'  && <><rect x="80" y="14" width="40" height="9" rx="2" fill="#D97706"/><rect x="75" y="23" width="50" height="9" rx="2" fill="#059669"/><rect x="82" y="32" width="36" height="9" rx="2" fill="#7C3AED"/></>}
      {id==='kairos' && <><path d="M88 18 L112 18 L112 28 L100 40 L88 28 Z" fill="#FDE68A" stroke={color} strokeWidth="1.8"/><path d="M100 40 L112 52 L112 62 L88 62 L88 52 Z" fill="#C7D2FE" stroke={color} strokeWidth="1.8"/><circle cx="100" cy="46" r="1.8" fill={color}/><circle cx="100" cy="114" r="11" fill="none" stroke="#fff" strokeWidth="1.4" opacity="0.7"/><line x1="100" y1="114" x2="100" y2="107" stroke="#fff" strokeWidth="1.4"/><line x1="100" y1="114" x2="107" y2="114" stroke="#fff" strokeWidth="1.4"/></>}
    </svg>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// NUCLEUS  (atom core — proton/neutron cluster)
// ─────────────────────────────────────────────────────────────────────────────
const Nucleus = ({ hovered, setHovered }) => (
  <div onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
    style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)', width:128, height:128, zIndex:30 }}>
    <div style={{ position:'absolute', inset:-65, borderRadius:'50%', background:'radial-gradient(circle, rgba(0,201,167,0.15), rgba(139,92,246,0.1) 45%, transparent 70%)', filter:'blur(12px)', animation:'pulse-glow 3.5s ease-in-out infinite' }}/>
    <div style={{ position:'absolute', inset:-8, borderRadius:'50%', background:'conic-gradient(from 0deg, transparent, rgba(0,201,167,0.4), transparent, rgba(139,92,246,0.3), transparent)', filter:'blur(4px)', animation:'spin-slow 9s linear infinite', opacity:hovered?1:0.72, transition:'opacity 0.4s' }}/>
    <div style={{ position:'absolute', inset:-3, borderRadius:'50%', background:`conic-gradient(from 90deg, ${ACCENT}, #8B5CF6, #EC4899, #3B82F6, ${ACCENT})`, filter:'blur(1px)', animation:'spin-fast 5.5s linear infinite', opacity:0.82 }}/>
    <div style={{ position:'absolute', inset:0, borderRadius:'50%', background:'radial-gradient(circle at 35% 30%, #d4f8ef 0%, #00C9A7 22%, #2d4a8f 55%, #0f1a35 100%)', boxShadow:`0 0 ${hovered?55:36}px rgba(0,201,167,0.45), inset -9px -13px 26px rgba(0,0,0,0.5), inset 5px 7px 16px rgba(255,255,255,0.1)`, transition:'box-shadow 0.5s', overflow:'hidden' }}>
      <svg viewBox="0 0 100 100" style={{ position:'absolute', inset:0, width:'100%', height:'100%' }}>
        <defs>
          <radialGradient id="prot" cx="38%" cy="35%" r="60%"><stop offset="0%" stopColor="#fff"/><stop offset="45%" stopColor="#EF4444"/><stop offset="100%" stopColor="#7F1D1D"/></radialGradient>
          <radialGradient id="neut" cx="38%" cy="35%" r="60%"><stop offset="0%" stopColor="#fff"/><stop offset="45%" stopColor="#3B82F6"/><stop offset="100%" stopColor="#1E3A8A"/></radialGradient>
        </defs>
        <g opacity="0.5"><circle cx="30" cy="52" r="10" fill="url(#neut)"/><circle cx="70" cy="50" r="10" fill="url(#prot)"/></g>
        <g style={{ animation:'nucleon-jiggle 4s ease-in-out infinite' }}>
          <circle cx="40" cy="40" r="10" fill="url(#prot)"/>
          <circle cx="60" cy="38" r="10" fill="url(#neut)"/>
          <circle cx="38" cy="60" r="10" fill="url(#neut)"/>
          <circle cx="62" cy="62" r="10" fill="url(#prot)"/>
          <circle cx="50" cy="50" r="9"  fill="url(#prot)"/>
        </g>
        <circle cx="37" cy="37" r="1.7" fill="#fff" opacity="0.9"/>
        <circle cx="57" cy="35" r="1.3" fill="#fff" opacity="0.85"/>
      </svg>
    </div>
  </div>
);

// ─────────────────────────────────────────────────────────────────────────────
// AGENT ORB  (electron sphere on tilted elliptical orbit)
// ─────────────────────────────────────────────────────────────────────────────
const AgentOrb = ({ agent, onClick }) => {
  const o = ORBITS[agent.orbit];
  const [hover, setHover] = useState(false);
  const delay = -(agent.angleOffset / 360) * o.duration;
  const SIZE  = hover ? 50 : 42;

  return (
    // L1 — tilted plane
    <div style={{ position:'absolute', top:'50%', left:'50%', width:o.radius*2, height:o.radius*2, marginTop:-o.radius, marginLeft:-o.radius, transform:`rotateX(${o.tiltX}deg) rotateZ(${o.tiltZ}deg)`, transformStyle:'preserve-3d', pointerEvents:'none' }}>
      {/* L2 — spin */}
      <div style={{ position:'absolute', inset:0, animation:`orbit-spin ${o.duration}s linear infinite`, animationDelay:`${delay}s`, transformStyle:'preserve-3d' }}>
        {/* L3 — centered at orbit edge */}
        <div style={{ position:'absolute', top:'50%', left:'100%', transform:'translate(-50%,-50%)', transformStyle:'preserve-3d' }}>
          {/* L4 — counter-spin */}
          <div style={{ animation:`orbit-spin-rev ${o.duration}s linear infinite`, animationDelay:`${delay}s`, transformStyle:'preserve-3d' }}>
            {/* L5 — counter-tilt → orb faces viewer */}
            <div style={{ transform:`rotateZ(${-o.tiltZ}deg) rotateX(${-o.tiltX}deg)`, pointerEvents:'auto' }}>
              {/* Eraser disc — covers the orbit ring line behind the sphere */}
              <div style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)', width:SIZE+22, height:SIZE+22, borderRadius:'50%', background:BG, zIndex:1, transition:'width 0.3s, height 0.3s' }}/>
              {/* Sphere button */}
              <button onClick={() => onClick(agent)} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
                style={{ position:'relative', zIndex:2, display:'flex', alignItems:'center', justifyContent:'center', width:SIZE, height:SIZE, borderRadius:'50%', border:'none', cursor:'pointer',
                  background:`radial-gradient(circle at 30% 28%, ${shadeColor(agent.color,16)}, ${agent.color} 55%, ${shadeColor(agent.color,-48)})`,
                  boxShadow:`0 0 ${hover?28:12}px ${agent.glow}, inset -4px -5px 10px rgba(0,0,0,0.48), inset 3px 4px 8px rgba(255,255,255,0.15)`,
                  transition:'all 0.3s cubic-bezier(0.34,1.56,0.64,1)', outline:'none' }}
                aria-label={agent.name}>
                <div style={{ position:'absolute', top:'20%', left:'24%', width:'26%', height:'20%', borderRadius:'50%', background:'rgba(255,255,255,0.4)', filter:'blur(1.5px)' }}/>
              </button>
              {/* Tooltip */}
              <div style={{ position:'absolute', top:'100%', left:'50%', transform:`translate(-50%,${hover?12:4}px)`, marginTop:10, padding:'4px 10px', borderRadius:999, background:'rgba(7,13,22,0.95)', border:`1px solid ${agent.color}77`, color:'#fff', fontFamily:'Bricolage Grotesque, sans-serif', fontSize:11, fontWeight:700, whiteSpace:'nowrap', opacity:hover?1:0, pointerEvents:'none', transition:'all 0.25s ease', zIndex:3 }}>
                {agent.name}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// ORBITAL SYSTEM
// ─────────────────────────────────────────────────────────────────────────────
const OrbitalSystem = ({ onAgentClick }) => {
  const [cHov, setCHov] = useState(false);
  return (
    <div style={{ position:'relative', width:'100%', height:740, display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden', perspective:'1600px' }}>
      <div style={{ position:'absolute', inset:0, background:`linear-gradient(180deg, rgba(255,255,255,0.04), transparent 18%), linear-gradient(132deg, rgba(255,255,255,0.06) 0 15%, transparent 15% 72%, rgba(0,201,167,0.08) 72% 100%), linear-gradient(180deg, #151920, ${BG} 82%)` }}/>
      <div style={{ position:'absolute', inset:0, backgroundImage:'linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)', backgroundSize:'34px 34px', opacity:0.26 }}/>
      <div style={{ position:'absolute', inset:'8% 6%', borderRadius:34, border:'1px solid rgba(255,255,255,0.05)', background:'linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.008))', boxShadow:'inset 0 1px 0 rgba(255,255,255,0.04)' }}/>

      {/* 3-D scene */}
      <div style={{ position:'absolute', inset:0, transformStyle:'preserve-3d' }}>
        {/* Three tilted atom orbit rings */}
        {ORBITS.map((o, i) => (
          <div key={i} style={{ position:'absolute', top:'50%', left:'50%', width:o.radius*2, height:o.radius*2, marginTop:-o.radius, marginLeft:-o.radius, transform:`rotateX(${o.tiltX}deg) rotateZ(${o.tiltZ}deg)`, transformStyle:'preserve-3d', pointerEvents:'none' }}>
            {/* Glow echo */}
            <div style={{ position:'absolute', inset:-2, borderRadius:'50%', border:`2px solid ${o.rGlow}`, filter:'blur(5px)' }}/>
            {/* Crisp ring */}
            <div style={{ position:'absolute', inset:0, borderRadius:'50%', border:`1px solid ${o.ring}` }}/>
          </div>
        ))}
        <Nucleus hovered={cHov} setHovered={setCHov}/>
        {AGENTS.map(a => <AgentOrb key={a.id} agent={a} onClick={onAgentClick}/>)}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// AGENT MODAL
// ─────────────────────────────────────────────────────────────────────────────
const AgentModal = ({ agent, onClose, onActivate, onDocs }) => {
  useEffect(() => { document.body.style.overflow='hidden'; return () => { document.body.style.overflow=''; }; }, []);
  if (!agent) return null;
  const { Icon } = agent;
  return (
    <div onClick={onClose} style={{ position:'fixed', inset:0, zIndex:100, background:'rgba(4,8,16,0.84)', backdropFilter:'blur(18px)', display:'flex', alignItems:'center', justifyContent:'center', padding:24, animation:'fadeIn 0.26s ease' }}>
      <div onClick={e => e.stopPropagation()} style={{ position:'relative', width:'100%', maxWidth:1040, maxHeight:'90vh', overflow:'auto', borderRadius:22, background:'linear-gradient(140deg, rgba(11,17,30,0.98), rgba(5,9,20,0.98))', border:`1px solid ${agent.color}44`, boxShadow:`0 0 64px ${agent.glow}, 0 26px 52px rgba(0,0,0,0.6)`, animation:'modalIn 0.42s cubic-bezier(0.34,1.56,0.64,1)' }}>
        <div style={{ position:'absolute', inset:0, borderRadius:22, background:`radial-gradient(circle at 18% 0%, ${agent.color}16, transparent 50%)`, pointerEvents:'none' }}/>
        <button onClick={onClose} style={{ position:'absolute', top:16, right:16, zIndex:10, width:38, height:38, borderRadius:'50%', border:`1px solid ${BORD}`, background:SURF, color:'#fff', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', transition:'all 0.2s' }} onMouseEnter={e=>{e.currentTarget.style.background='rgba(255,255,255,0.08)';e.currentTarget.style.transform='rotate(90deg)'}} onMouseLeave={e=>{e.currentTarget.style.background=SURF;e.currentTarget.style.transform='rotate(0)'}}>
          <X size={15}/>
        </button>
        <div className="modal-inner" style={{ padding:'44px 48px 40px', display:'grid', gridTemplateColumns:'1fr 1.45fr', gap:40, alignItems:'center' }}>
          <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:16 }}>
            <div style={{ position:'relative', width:250, height:250, display:'flex', alignItems:'center', justifyContent:'center' }}>
              <div style={{ position:'absolute', inset:0, borderRadius:'50%', background:`radial-gradient(circle, ${agent.color}24, transparent 70%)`, animation:'pulse-glow 3s ease-in-out infinite' }}/>
              <div style={{ animation:'float 4s ease-in-out infinite' }}><AgentCharacter agent={agent} size={222}/></div>
            </div>
            <div style={{ padding:'4px 12px', borderRadius:999, background:`${agent.color}12`, border:`1px solid ${agent.color}40`, fontFamily:'JetBrains Mono, monospace', fontSize:10, letterSpacing:'0.24em', color:agent.color, textTransform:'uppercase' }}>Agent · Online</div>
          </div>
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:9, marginBottom:12 }}>
              <Icon size={17} color={agent.color}/>
              <span style={{ fontFamily:'JetBrains Mono, monospace', fontSize:10, letterSpacing:'0.28em', color:'rgba(255,255,255,0.42)', textTransform:'uppercase' }}>{agent.specialty}</span>
            </div>
            <h2 style={{ fontFamily:'Bricolage Grotesque, sans-serif', fontSize:62, fontWeight:800, lineHeight:0.93, margin:0, letterSpacing:'-0.04em', background:`linear-gradient(135deg, #fff, ${agent.color})`, WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>{agent.name}</h2>
            <p style={{ fontFamily:'Manrope, sans-serif', fontSize:16, lineHeight:1.55, color:'rgba(255,255,255,0.68)', margin:'13px 0 26px', maxWidth:480 }}>{agent.tagline}</p>
            <div style={{ marginBottom:24 }}>
              <div style={{ fontFamily:'JetBrains Mono, monospace', fontSize:10, letterSpacing:'0.24em', color:'rgba(255,255,255,0.34)', marginBottom:13, textTransform:'uppercase' }}>Capabilities</div>
              <div style={{ display:'grid', gap:7 }}>
                {agent.capabilities.map((c, i) => (
                  <div key={i} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 13px', borderRadius:9, background:SURF, border:`1px solid ${BORD}`, fontFamily:'Manrope, sans-serif', color:'rgba(255,255,255,0.85)', fontSize:13, animation:`slideInRight 0.35s ease ${i*0.07}s both` }}>
                    <div style={{ width:4, height:4, borderRadius:'50%', background:agent.color, boxShadow:`0 0 6px ${agent.color}`, flexShrink:0 }}/>{c}
                  </div>
                ))}
              </div>
            </div>
            <div style={{ marginBottom:26 }}>
              <div style={{ fontFamily:'JetBrains Mono, monospace', fontSize:10, letterSpacing:'0.24em', color:'rgba(255,255,255,0.34)', marginBottom:13, textTransform:'uppercase' }}>Try Saying</div>
              {agent.prompts.map((p, i) => (
                <div key={i} style={{ padding:'8px 13px', borderRadius:8, background:`${agent.color}07`, border:`1px solid ${agent.color}1e`, fontFamily:'Manrope, sans-serif', fontSize:13, color:'rgba(255,255,255,0.78)', fontStyle:'italic', marginBottom:6 }}>"{p}"</div>
              ))}
            </div>
            <div style={{ display:'flex', gap:9 }}>
              <button onClick={() => onActivate(agent)} style={{ padding:'12px 24px', borderRadius:10, border:'none', background:ACCENT, color:'#000', fontFamily:'Bricolage Grotesque, sans-serif', fontWeight:700, fontSize:13, cursor:'pointer', display:'flex', alignItems:'center', gap:7, boxShadow:`0 8px 26px rgba(0,201,167,0.32)`, transition:'transform 0.2s' }} onMouseEnter={e=>e.currentTarget.style.transform='translateY(-2px)'} onMouseLeave={e=>e.currentTarget.style.transform='translateY(0)'}>
                Activate {agent.name} <ArrowRight size={14}/>
              </button>
              <button onClick={() => onDocs(agent)} style={{ padding:'12px 24px', borderRadius:10, border:`1px solid ${BORD}`, background:SURF, color:'#fff', fontFamily:'Bricolage Grotesque, sans-serif', fontWeight:600, fontSize:13, cursor:'pointer' }}>View Docs</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// AGENT CARD
// ─────────────────────────────────────────────────────────────────────────────
const AgentCard = ({ agent, onClick, index }) => {
  const [hover, setHover] = useState(false);
  const { Icon } = agent;
  return (
    <div onClick={() => onClick(agent)} onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{ position:'relative', padding:24, borderRadius:16, background:SURF, border:`1px solid ${hover?agent.color+'50':BORD}`, cursor:'pointer', transition:'all 0.36s cubic-bezier(0.34,1.56,0.64,1)', transform:hover?'translateY(-6px)':'translateY(0)', boxShadow:hover?`0 16px 40px ${agent.glow}, 0 0 0 1px ${agent.color}30`:'0 3px 16px rgba(0,0,0,0.18)', overflow:'hidden', animation:`cardFadeIn 0.5s ease ${index*0.05}s both` }}>
      <div style={{ position:'absolute', top:-60, right:-60, width:160, height:160, borderRadius:'50%', background:`radial-gradient(circle, ${agent.color}1e, transparent 70%)`, transition:'transform 0.4s', transform:hover?'scale(1.35)':'scale(1)' }}/>
      <div style={{ position:'relative', zIndex:1 }}>
        <div style={{ width:96, height:96, marginBottom:16, transition:'transform 0.38s', transform:hover?'scale(1.06) rotate(-2deg)':'scale(1)' }}>
          <AgentCharacter agent={agent} size={96}/>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:6 }}>
          <Icon size={12} color={agent.color}/>
          <span style={{ fontFamily:'JetBrains Mono, monospace', fontSize:9, letterSpacing:'0.22em', color:'rgba(255,255,255,0.42)', textTransform:'uppercase' }}>{agent.specialty}</span>
        </div>
        <h3 style={{ fontFamily:'Syne, sans-serif', fontSize:26, fontWeight:700, margin:'3px 0 8px', color:'#fff', letterSpacing:'-0.02em' }}>{agent.name}</h3>
        <p style={{ fontFamily:'Manrope, sans-serif', fontSize:13, color:'rgba(255,255,255,0.52)', lineHeight:1.5, margin:'0 0 16px', minHeight:36 }}>{agent.tagline}</p>
        <div style={{ display:'flex', alignItems:'center', gap:6, color:agent.color, fontFamily:'Bricolage Grotesque, sans-serif', fontWeight:700, fontSize:12, transition:'gap 0.3s', ...(hover&&{gap:11}) }}>
          Open hub <ArrowRight size={12}/>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// PRICING  (RTF spec: Starter / Pro / Enterprise)
// ─────────────────────────────────────────────────────────────────────────────
const FEAT_LABELS = ['Agents active','Tasks / month','Workspaces','Team sharing','Priority queue','API access','SSO & audit logs','Custom agents','SLA guarantee','Atom Builder access'];
const PLANS = [
  { name:'Starter',    desc:'For individuals exploring AI agents.',     priceM:0,    priceA:0,    label:'Free',   cta:'Get started free',    featured:false,
    vals:['2 agents','50 / month','1',false,false,false,false,false,false,'Not included'] },
  { name:'Pro',        desc:'For ambitious teams doing real work.',      priceM:29,   priceA:23,   label:null,     cta:'Start 14-day trial',  featured:true,
    vals:['All 10 agents','Unlimited','5',true,true,true,false,false,false,'Included, up to 3 atoms'] },
  { name:'Enterprise', desc:'For organizations that move at scale.',     priceM:null, priceA:null, label:'Custom', cta:'Talk to sales',       featured:false,
    vals:['All 10 agents','Unlimited','Unlimited',true,true,true,true,true,true,'Advanced, up to 10 atoms'] },
];

const PricingSection = ({ onPlanSelect }) => {
  const [annual, setAnnual] = useState(false);
  const [hovered, setHovered] = useState(null);

  return (
    <section id="pricing" style={{ padding:'80px 40px', maxWidth:1160, margin:'0 auto', position:'relative' }}>
      <div style={{ position:'absolute', top:'10%', left:'50%', transform:'translateX(-50%)', width:600, height:600, borderRadius:'50%', background:`radial-gradient(circle, rgba(0,201,167,0.04), transparent 70%)`, pointerEvents:'none' }}/>
      <div style={{ textAlign:'center', marginBottom:48, position:'relative' }}>
        <div style={{ fontFamily:'JetBrains Mono, monospace', fontSize:11, letterSpacing:'0.3em', color:'rgba(255,255,255,0.4)', textTransform:'uppercase', marginBottom:14 }}>03 · Subscription</div>
        <h2 style={{ fontFamily:'Bricolage Grotesque, sans-serif', fontSize:60, fontWeight:800, margin:0, letterSpacing:'-0.04em', lineHeight:0.95, background:`linear-gradient(135deg, #fff 40%, #99f6e4 80%)`, WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>Choose your trajectory</h2>
        <p style={{ fontFamily:'Manrope, sans-serif', fontSize:15, color:'rgba(255,255,255,0.52)', maxWidth:480, margin:'14px auto 0', lineHeight:1.55 }}>Start free. Scale when the work does. Cancel any time.</p>
        {/* Toggle */}
        <div style={{ display:'inline-flex', alignItems:'center', gap:4, marginTop:26, padding:'5px', borderRadius:999, background:'rgba(255,255,255,0.04)', border:`1px solid ${BORD}` }}>
          {['Monthly','Annual'].map((label, idx) => {
            const active = (idx===1)===annual;
            return (
              <button key={label} onClick={() => setAnnual(idx===1)} style={{ padding:'7px 18px', borderRadius:999, border:'none', background:active?ACCENT:'transparent', color:active?'#000':'rgba(255,255,255,0.55)', fontFamily:'Bricolage Grotesque, sans-serif', fontWeight:700, fontSize:12, cursor:'pointer', transition:'all 0.22s', display:'flex', alignItems:'center', gap:6 }}>
                {label}{idx===1&&<span style={{ fontSize:9, opacity:0.85, fontWeight:600, background:active?'rgba(0,0,0,0.15)':'rgba(255,255,255,0.1)', padding:'1px 5px', borderRadius:999 }}>–20%</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Cards */}
      <div className="plan-grid" style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:16, marginBottom:52 }}>
        {PLANS.map((plan, pi) => {
          const h = hovered===pi;
          const price = annual&&plan.priceA!==null ? plan.priceA : plan.priceM;
          return (
            <div key={plan.name} onMouseEnter={()=>setHovered(pi)} onMouseLeave={()=>setHovered(null)}
              style={{ position:'relative', padding:'30px 26px', borderRadius:18, background:plan.featured?`linear-gradient(155deg, rgba(0,201,167,0.1), rgba(0,100,80,0.05) 55%, rgba(7,13,22,0.5))`:SURF, border:`1px solid ${plan.featured?ACCENT+'50':h?'rgba(255,255,255,0.14)':BORD}`, transition:'all 0.32s ease', transform:h?'translateY(-5px)':'translateY(0)', boxShadow:plan.featured?`0 16px 44px rgba(0,201,167,0.18)`:`0 3px 16px rgba(0,0,0,0.18)`, animation:`cardFadeIn 0.5s ease ${pi*0.1}s both` }}>
              {plan.featured&&<div style={{ position:'absolute', top:-11, left:'50%', transform:'translateX(-50%)', padding:'3px 13px', borderRadius:999, background:ACCENT, fontFamily:'JetBrains Mono, monospace', fontSize:9, letterSpacing:'0.22em', color:'#000', fontWeight:700, textTransform:'uppercase', boxShadow:`0 4px 14px rgba(0,201,167,0.38)` }}>Most Popular</div>}
              <h4 style={{ fontFamily:'Bricolage Grotesque, sans-serif', fontSize:20, fontWeight:800, margin:'0 0 5px', color:'#fff', letterSpacing:'-0.02em' }}>{plan.name}</h4>
              <p style={{ fontFamily:'Manrope, sans-serif', fontSize:12, color:'rgba(255,255,255,0.48)', margin:'0 0 20px' }}>{plan.desc}</p>
              {plan.label ? (
                <div style={{ fontFamily:'Bricolage Grotesque, sans-serif', fontSize:44, fontWeight:800, lineHeight:1, letterSpacing:'-0.04em', color:'#fff', marginBottom:5 }}>{plan.label}</div>
              ) : (
                <div style={{ display:'flex', alignItems:'baseline', gap:2, marginBottom:5 }}>
                  <span style={{ fontFamily:'Bricolage Grotesque, sans-serif', fontSize:16, color:'rgba(255,255,255,0.45)', fontWeight:600 }}>$</span>
                  <span style={{ fontFamily:'Bricolage Grotesque, sans-serif', fontSize:50, fontWeight:800, lineHeight:1, letterSpacing:'-0.045em', color:'#fff' }}>{price}</span>
                </div>
              )}
              <div style={{ fontFamily:'JetBrains Mono, monospace', fontSize:10, color:'rgba(255,255,255,0.35)', marginBottom:24, letterSpacing:'0.1em' }}>
                {plan.priceM===0?'forever':plan.priceM===null?'billed annually':`/ user / month${annual?' · annual':''}`}
              </div>
              <button onClick={() => onPlanSelect(plan)} style={{ width:'100%', padding:'11px 16px', borderRadius:10, border:plan.featured?'none':`1px solid ${BORD}`, background:plan.featured?ACCENT:SURF, color:plan.featured?'#000':'#fff', fontFamily:'Bricolage Grotesque, sans-serif', fontWeight:700, fontSize:13, cursor:'pointer', marginBottom:22, transition:'all 0.2s', boxShadow:plan.featured?`0 7px 22px rgba(0,201,167,0.32)`:'' }} onMouseEnter={e=>e.currentTarget.style.transform='translateY(-2px)'} onMouseLeave={e=>e.currentTarget.style.transform='translateY(0)'}>
                {plan.cta}
              </button>
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {plan.vals.map((v, fi) => {
                  const has = v!==false;
                  return (
                    <div key={fi} style={{ display:'flex', alignItems:'center', gap:9, fontFamily:'Manrope, sans-serif', fontSize:12, color:has?'rgba(255,255,255,0.8)':'rgba(255,255,255,0.25)' }}>
                      {has?<Check size={13} color={plan.featured?ACCENT:'rgba(255,255,255,0.5)'} style={{flexShrink:0}}/>:<Minus size={13} color="rgba(255,255,255,0.18)" style={{flexShrink:0}}/>}
                      <span>{typeof v==='string'?`${FEAT_LABELS[fi]}: ${v}`:FEAT_LABELS[fi]}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Comparison table */}
      <div style={{ borderRadius:16, border:`1px solid ${BORD}`, overflow:'hidden' }}>
        <div style={{ padding:'16px 22px', borderBottom:`1px solid ${BORD}`, background:'rgba(255,255,255,0.018)' }}>
          <span style={{ fontFamily:'Bricolage Grotesque, sans-serif', fontSize:14, fontWeight:700, color:'rgba(255,255,255,0.65)', letterSpacing:'-0.01em' }}>Full feature comparison</span>
        </div>
        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead>
            <tr style={{ borderBottom:`1px solid ${BORD}` }}>
              <th style={{ padding:'11px 22px', textAlign:'left', fontFamily:'JetBrains Mono, monospace', fontSize:9, letterSpacing:'0.2em', color:'rgba(255,255,255,0.35)', textTransform:'uppercase', fontWeight:500, width:'38%' }}>Feature</th>
              {PLANS.map(p=><th key={p.name} style={{ padding:'11px 18px', textAlign:'center', fontFamily:'Bricolage Grotesque, sans-serif', fontSize:13, fontWeight:700, color:p.featured?ACCENT:'rgba(255,255,255,0.7)', letterSpacing:'-0.01em' }}>{p.name}</th>)}
            </tr>
          </thead>
          <tbody>
            {FEAT_LABELS.map((feat, fi)=>(
              <tr key={fi} style={{ borderBottom:`1px solid rgba(255,255,255,0.035)`, background:fi%2===0?'transparent':'rgba(255,255,255,0.01)' }}>
                <td style={{ padding:'10px 22px', fontFamily:'Manrope, sans-serif', fontSize:13, color:'rgba(255,255,255,0.62)' }}>{feat}</td>
                {PLANS.map((p,pi)=>{
                  const v=p.vals[fi];
                  return (
                    <td key={pi} style={{ padding:'10px 18px', textAlign:'center' }}>
                      {v===true?<Check size={14} color={pi===1?ACCENT:'rgba(255,255,255,0.48)'} style={{margin:'0 auto',display:'block'}}/>:
                       v===false?<Minus size={13} color="rgba(255,255,255,0.16)" style={{margin:'0 auto',display:'block'}}/>:
                       <span style={{ fontFamily:'Manrope, sans-serif', fontSize:12, color:'rgba(255,255,255,0.72)', fontWeight:600 }}>{v}</span>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Trust row */}
      <div style={{ display:'flex', gap:32, justifyContent:'center', flexWrap:'wrap', marginTop:40 }}>
        {[{l:'SOC 2 Type II',s:'Audited annually'},{l:'GDPR + HIPAA',s:'Compliance-ready'},{l:'14-day trial',s:'No card required'},{l:'99.99% Uptime',s:'SLA on Enterprise'}].map((t,i)=>(
          <div key={i} style={{ textAlign:'center' }}>
            <div style={{ fontFamily:'Bricolage Grotesque, sans-serif', fontSize:13, fontWeight:700, color:'rgba(255,255,255,0.85)', letterSpacing:'-0.01em' }}>{t.l}</div>
            <div style={{ fontFamily:'JetBrains Mono, monospace', fontSize:9, color:'rgba(255,255,255,0.36)', marginTop:4, letterSpacing:'0.12em' }}>{t.s}</div>
          </div>
        ))}
      </div>
    </section>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// COMING SOON
// ─────────────────────────────────────────────────────────────────────────────
const COMING = [
  { title:'Atom Builder', desc:'Advertised on the main platform, unlocked with Pro, and expanded further on Enterprise.', eta:'Pro feature', action:'builder' },
  { title:'Langolf Data Fabric', desc:'Unified event-stream backbone connecting every tool in your stack.', eta:'Q2 2026' },
  { title:'Constellation Marketplace', desc:'Share, remix, and monetize agent templates built by the community.', eta:'Q3 2026' },
  { title:'Orbital Automations', desc:'Event-driven cascading automation chains across all 10 agents.', eta:'Q4 2026' },
];

const DOCS = [
  { icon:Rocket, title:'Quickstart', desc:'Create a workspace, choose the first agent, and ship the initial task run.', meta:'6 min' },
  { icon:Network, title:'Integrations', desc:'Connect CRMs, support desks, calendars, data stores, and custom APIs.', meta:'42 guides' },
  { icon:TerminalSquare, title:'Developer API', desc:'Use agent runs, webhooks, secrets, and workspace events in your own app.', meta:'REST + webhooks' },
  { icon:ShieldCheck, title:'Security', desc:'Review permissions, audit trails, compliance controls, and data retention.', meta:'SOC 2 ready' },
];

const WORKFLOW_STEPS = [
  'Connect workspace tools',
  'Choose an agent or orchestration',
  'Preview the first run',
  'Approve, schedule, or hand off',
];

const PageShell = ({ eyebrow, title, desc, children, onBack, accent = ACCENT, maxWidth = 1160 }) => (
  <main style={{ minHeight:'100vh', padding:'126px 40px 72px', position:'relative', overflow:'hidden' }}>
    <div style={{ position:'absolute', inset:0, background:`linear-gradient(180deg, rgba(255,255,255,0.04), transparent 22%), linear-gradient(126deg, rgba(255,255,255,0.05) 0 16%, transparent 16% 68%, ${accent}12 68% 100%), linear-gradient(180deg, #13161d, ${BG} 78%)` }}/>
    <div style={{ position:'absolute', inset:0, backgroundImage:'linear-gradient(rgba(255,255,255,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)', backgroundSize:'36px 36px', opacity:0.22 }}/>
    <div style={{ position:'relative', maxWidth, margin:'0 auto' }}>
      <button onClick={onBack} style={{ display:'inline-flex', alignItems:'center', gap:7, padding:'9px 14px', marginBottom:34, borderRadius:10, border:`1px solid ${BORD}`, background:SURF, color:'rgba(255,255,255,0.72)', fontFamily:'Bricolage Grotesque, sans-serif', fontWeight:700, fontSize:13, cursor:'pointer' }}>
        <ArrowLeft size={14}/> Back to platform
      </button>
      <div style={{ marginBottom:34 }}>
        <div style={{ fontFamily:'JetBrains Mono, monospace', fontSize:10, letterSpacing:'0.28em', color:accent, textTransform:'uppercase', marginBottom:14 }}>{eyebrow}</div>
        <h1 style={{ fontFamily:'Bricolage Grotesque, sans-serif', fontSize:66, fontWeight:800, lineHeight:0.94, letterSpacing:'-0.045em', margin:'0 0 18px', maxWidth:820, background:`linear-gradient(135deg, #fff 35%, ${accent} 95%)`, WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>{title}</h1>
        <p style={{ fontFamily:'Manrope, sans-serif', fontSize:16, color:'rgba(255,255,255,0.56)', lineHeight:1.6, margin:0, maxWidth:640 }}>{desc}</p>
      </div>
      {children}
    </div>
  </main>
);

const PrimaryButton = ({ children, onClick, icon:Icon = ArrowRight, subtle = false }) => (
  <button onClick={onClick} style={{ padding:'12px 20px', borderRadius:10, border:subtle?`1px solid ${BORD}`:'none', background:subtle?SURF:ACCENT, color:subtle?'#fff':'#000', fontFamily:'Bricolage Grotesque, sans-serif', fontWeight:700, fontSize:13, cursor:'pointer', display:'inline-flex', alignItems:'center', gap:8, boxShadow:subtle?'none':`0 8px 26px rgba(0,201,167,0.3)` }}>
    {children} <Icon size={14}/>
  </button>
);

const StartPage = ({ onBack, onOpenDocs, onSelectAgent }) => (
  <PageShell eyebrow="Workspace setup" title="Start your first Ascentra workspace." desc="Pick a plan, invite the team later, and launch with a guided first task instead of a blank canvas." onBack={onBack}>
    <div className="page-grid" style={{ display:'grid', gridTemplateColumns:'1.05fr 0.95fr', gap:18 }}>
      <div style={{ padding:28, borderRadius:18, border:`1px solid ${BORD}`, background:'rgba(255,255,255,0.04)' }}>
        <h2 style={{ fontFamily:'Bricolage Grotesque, sans-serif', fontSize:28, margin:'0 0 18px', color:'#fff' }}>Launch checklist</h2>
        <div style={{ display:'grid', gap:12 }}>
          {WORKFLOW_STEPS.map((step, i)=>(
            <div key={step} style={{ display:'flex', gap:12, alignItems:'center', padding:'13px 0', borderBottom:i<WORKFLOW_STEPS.length-1?`1px solid rgba(255,255,255,0.06)`:'none' }}>
              <span style={{ width:28, height:28, borderRadius:'50%', background:i===0?ACCENT:'rgba(255,255,255,0.08)', color:i===0?'#000':'rgba(255,255,255,0.6)', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'JetBrains Mono, monospace', fontSize:11, fontWeight:700 }}>{i+1}</span>
              <span style={{ fontFamily:'Manrope, sans-serif', color:'rgba(255,255,255,0.82)', fontSize:14 }}>{step}</span>
            </div>
          ))}
        </div>
        <div style={{ display:'flex', gap:10, flexWrap:'wrap', marginTop:24 }}>
          <PrimaryButton onClick={() => onSelectAgent(AGENTS[1])}>Open Forge first</PrimaryButton>
          <PrimaryButton onClick={onOpenDocs} subtle icon={FileText}>Read setup docs</PrimaryButton>
        </div>
      </div>
      <div style={{ padding:28, borderRadius:18, border:`1px solid rgba(0,201,167,0.25)`, background:'linear-gradient(150deg, rgba(0,201,167,0.11), rgba(255,255,255,0.035))' }}>
        <div style={{ fontFamily:'JetBrains Mono, monospace', fontSize:10, letterSpacing:'0.22em', color:'rgba(255,255,255,0.38)', textTransform:'uppercase', marginBottom:18 }}>Recommended starter stack</div>
        {['Forge for app buildout','Nexus for integrations','Pulse for repeatable workflows'].map((item, i)=>(
          <div key={item} style={{ display:'flex', alignItems:'center', gap:10, marginBottom:14, color:'rgba(255,255,255,0.8)', fontFamily:'Manrope, sans-serif', fontSize:14 }}>
            <Check size={15} color={ACCENT}/>{item}
          </div>
        ))}
        <div style={{ marginTop:30, paddingTop:22, borderTop:`1px solid ${BORD}` }}>
          <div style={{ fontFamily:'Bricolage Grotesque, sans-serif', fontSize:42, fontWeight:800, letterSpacing:'-0.04em' }}>$0</div>
          <div style={{ fontFamily:'Manrope, sans-serif', fontSize:13, color:'rgba(255,255,255,0.48)' }}>Starter workspace, 50 tasks per month</div>
        </div>
      </div>
    </div>
  </PageShell>
);

const AgentWorkspacePage = ({ agent, onBack, onDocs }) => {
  const { Icon } = agent;
  return (
    <PageShell eyebrow={`${agent.name} workspace`} title={`Activate ${agent.name}.`} desc={`${agent.specialty} flows, prompts, and run history are ready for the first production task.`} onBack={onBack} accent={agent.color}>
      <div className="page-grid" style={{ display:'grid', gridTemplateColumns:'0.9fr 1.1fr', gap:18 }}>
        <div style={{ padding:28, borderRadius:18, border:`1px solid ${agent.color}40`, background:`linear-gradient(160deg, ${agent.color}12, rgba(255,255,255,0.03))` }}>
          <Icon size={22} color={agent.color}/>
          <h2 style={{ fontFamily:'Bricolage Grotesque, sans-serif', fontSize:34, margin:'18px 0 10px', color:'#fff' }}>{agent.name}</h2>
          <p style={{ fontFamily:'Manrope, sans-serif', color:'rgba(255,255,255,0.58)', lineHeight:1.55, fontSize:14 }}>{agent.tagline}</p>
          <AgentCharacter agent={agent} size={180}/>
        </div>
        <div style={{ padding:28, borderRadius:18, border:`1px solid ${BORD}`, background:SURF }}>
          <h3 style={{ fontFamily:'Bricolage Grotesque, sans-serif', fontSize:24, margin:'0 0 18px', color:'#fff' }}>Ready prompts</h3>
          {agent.prompts.map((prompt, i)=>(
            <button key={prompt} style={{ width:'100%', textAlign:'left', padding:'14px 16px', marginBottom:10, borderRadius:10, border:`1px solid ${agent.color}24`, background:`${agent.color}08`, color:'rgba(255,255,255,0.82)', fontFamily:'Manrope, sans-serif', fontSize:13, cursor:'pointer' }}>
              {prompt}
            </button>
          ))}
          <div style={{ display:'flex', gap:10, flexWrap:'wrap', marginTop:18 }}>
            <PrimaryButton>Run selected prompt</PrimaryButton>
            <PrimaryButton onClick={onDocs} subtle icon={FileText}>Agent docs</PrimaryButton>
          </div>
        </div>
      </div>
    </PageShell>
  );
};

const DocsPage = ({ onBack, focusAgent, onSelectAgent }) => (
  <PageShell eyebrow="Documentation" title={focusAgent ? `${focusAgent.name} docs` : 'Build with the Ascentra agent layer.'} desc={focusAgent ? `Capabilities, example prompts, and operating notes for ${focusAgent.name}.` : 'Guides for workspaces, integrations, agent runs, automation handoffs, and security controls.'} onBack={onBack} accent={focusAgent?.color || ACCENT}>
    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(240px, 1fr))', gap:14 }}>
      {(focusAgent ? [
        { icon:focusAgent.Icon, title:'Capabilities', desc:focusAgent.capabilities.join(' · '), meta:focusAgent.specialty },
        { icon:MessageSquare, title:'Prompt patterns', desc:focusAgent.prompts.join(' · '), meta:'Examples' },
        { icon:Workflow, title:'Handoffs', desc:'Chain this agent into Pulse, Nexus, or Forge workflows after review.', meta:'Automation' },
      ] : DOCS).map((doc)=> {
        const Icon = doc.icon;
        return (
          <div key={doc.title} style={{ padding:24, borderRadius:16, border:`1px solid ${BORD}`, background:SURF }}>
            <Icon size={20} color={focusAgent?.color || ACCENT}/>
            <h3 style={{ fontFamily:'Bricolage Grotesque, sans-serif', fontSize:21, color:'#fff', margin:'18px 0 8px' }}>{doc.title}</h3>
            <p style={{ fontFamily:'Manrope, sans-serif', fontSize:13, lineHeight:1.55, color:'rgba(255,255,255,0.52)', margin:'0 0 16px' }}>{doc.desc}</p>
            <span style={{ fontFamily:'JetBrains Mono, monospace', fontSize:9, letterSpacing:'0.18em', color:'rgba(255,255,255,0.36)', textTransform:'uppercase' }}>{doc.meta}</span>
          </div>
        );
      })}
    </div>
    {!focusAgent && (
      <div style={{ marginTop:22, display:'flex', gap:10, flexWrap:'wrap' }}>
        {AGENTS.slice(0,4).map(a=><PrimaryButton key={a.id} onClick={() => onSelectAgent(a)} subtle icon={a.Icon}>{a.name} docs</PrimaryButton>)}
      </div>
    )}
  </PageShell>
);

const DemoPage = ({ onBack }) => (
  <PageShell eyebrow="Live walkthrough" title="Book a guided Ascentra demo." desc="See agent orchestration, integrations, and approval flows mapped around your current stack." onBack={onBack}>
    <div className="page-grid" style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:18 }}>
      {['Platform tour','Integration mapping','Security review','Pilot plan'].map((item, i)=>(
        <div key={item} style={{ padding:24, borderRadius:16, border:`1px solid ${BORD}`, background:SURF }}>
          <CalendarDays size={18} color={ACCENT}/>
          <h3 style={{ fontFamily:'Bricolage Grotesque, sans-serif', fontSize:24, color:'#fff', margin:'16px 0 8px' }}>{item}</h3>
          <p style={{ fontFamily:'Manrope, sans-serif', fontSize:13, color:'rgba(255,255,255,0.52)', margin:0 }}>30 minutes with a Langolf Enterprises platform specialist.</p>
        </div>
      ))}
    </div>
  </PageShell>
);

const PlanPage = ({ plan, onBack, onOpenBuilder }) => (
  <PageShell eyebrow="Plan selected" title={`${plan.name} checkout.`} desc={`${plan.desc} Review included capacity and confirm the workspace path before billing is connected.`} onBack={onBack}>
    <div style={{ maxWidth:760, padding:28, borderRadius:18, border:`1px solid ${plan.featured?ACCENT+'55':BORD}`, background:plan.featured?'linear-gradient(150deg, rgba(0,201,167,0.1), rgba(255,255,255,0.035))':SURF }}>
      <CreditCard size={20} color={ACCENT}/>
      <h2 style={{ fontFamily:'Bricolage Grotesque, sans-serif', fontSize:36, margin:'18px 0 8px', color:'#fff' }}>{plan.name}</h2>
      {plan.vals.map((v, i)=>v!==false && (
        <div key={i} style={{ display:'flex', gap:10, alignItems:'center', marginTop:10, fontFamily:'Manrope, sans-serif', color:'rgba(255,255,255,0.78)', fontSize:14 }}>
          <Check size={14} color={ACCENT}/>{typeof v==='string'?`${FEAT_LABELS[i]}: ${v}`:FEAT_LABELS[i]}
        </div>
      ))}
      <div style={{ display:'flex', gap:10, flexWrap:'wrap', marginTop:24 }}>
        <PrimaryButton>{plan.name==='Enterprise'?'Request procurement packet':'Continue setup'}</PrimaryButton>
        <PrimaryButton onClick={() => onOpenBuilder(plan.name)} subtle icon={Workflow}>Open admin QA lab</PrimaryButton>
      </div>
    </div>
  </PageShell>
);

const AdminAutomationPage = ({ onBack, initialPlanName = 'Pro' }) => (
  <PageShell eyebrow="Internal operations" title="Admin automation QA lab." desc="Validate the paid Atom Builder experience as an operator, confirm plan boundaries, and make sure each automation flow works before subscribers rely on it." onBack={onBack} accent={ACCENT} maxWidth={1480}>
    <div className="page-grid" style={{ display:'grid', gridTemplateColumns:'repeat(3, minmax(0, 1fr))', gap:14, marginBottom:20 }}>
      {[
        ['QA target', 'Pro builder access', Workflow],
        ['What to verify', 'Tests, saves, activations, run history', ShieldCheck],
        ['Subscription promise', 'Starter locked, Pro unlocked, Enterprise expanded', Crown],
      ].map(([title, desc, Icon]) => (
        <div key={title} style={{ padding:20, borderRadius:18, border:`1px solid ${BORD}`, background:SURF }}>
          <Icon size={18} color={ACCENT}/>
          <h3 style={{ fontFamily:'Bricolage Grotesque, sans-serif', fontSize:22, color:'#fff', margin:'14px 0 8px' }}>{title}</h3>
          <p style={{ fontFamily:'Manrope, sans-serif', fontSize:13, color:'rgba(255,255,255,0.56)', lineHeight:1.6, margin:0 }}>{desc}</p>
        </div>
      ))}
    </div>
    <AutomationAtomBuilder
      agents={AGENTS}
      plans={PLANS}
      initialPlanName={initialPlanName}
      accent={ACCENT}
      embedded
            adminMode
            fullScreen
      contextLabel="Admin QA"
      sectionId="admin-atom-builder"
    />
  </PageShell>
);

const ContactPage = ({ onBack }) => (
  <PageShell eyebrow="Contact" title="Talk with Langolf Enterprises." desc="Use this page for implementation questions, integration planning, partnership ideas, or platform support." onBack={onBack}>
    <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(250px, 1fr))', gap:14 }}>
      {[['Sales', 'Plan pilots, procurement, and custom agents.', Users], ['Support', 'Workspace access, billing, and agent run issues.', Mail], ['Solutions', 'Map existing systems into Ascentra workflows.', Search]].map(([title, desc, Icon])=>(
        <div key={title} style={{ padding:24, borderRadius:16, border:`1px solid ${BORD}`, background:SURF }}>
          <Icon size={19} color={ACCENT}/>
          <h3 style={{ fontFamily:'Bricolage Grotesque, sans-serif', fontSize:23, color:'#fff', margin:'16px 0 8px' }}>{title}</h3>
          <p style={{ fontFamily:'Manrope, sans-serif', fontSize:13, color:'rgba(255,255,255,0.52)', margin:0 }}>{desc}</p>
        </div>
      ))}
    </div>
  </PageShell>
);

const LegalPage = ({ type, onBack }) => {
  const map = {
    privacy:['Privacy', 'How Ascentra handles workspace data, retention, and customer-controlled deletion.'],
    terms:['Terms', 'Service terms for subscriptions, acceptable use, trials, and commercial use.'],
    security:['Security', 'Controls for encryption, access review, audit logs, incident response, and vendor risk.'],
  };
  const [title, desc] = map[type] || map.security;
  return (
    <PageShell eyebrow="Policy center" title={title} desc={desc} onBack={onBack}>
      <div style={{ padding:28, borderRadius:18, border:`1px solid ${BORD}`, background:SURF, maxWidth:840 }}>
        {['Workspace ownership stays with the customer.','Agent runs keep human approval points for production changes.','Audit exports and access controls are available for Pro and Enterprise tiers.'].map(item=>(
          <div key={item} style={{ display:'flex', gap:10, alignItems:'center', marginBottom:12, fontFamily:'Manrope, sans-serif', color:'rgba(255,255,255,0.76)', fontSize:14 }}><Check size={14} color={ACCENT}/>{item}</div>
        ))}
      </div>
    </PageShell>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// ROOT APP
// ─────────────────────────────────────────────────────────────────────────────
export default function AscentraPlatform() {
  const [agent, setAgent]     = useState(null);
  const [scrolled, setScrolled] = useState(false);
  const [page, setPage] = useState({ view:'home' });

  const pageAgent = AGENTS.find(a => a.id === page.agentId);
  const pagePlan = PLANS.find(p => p.name === page.planName);

  const goHome = () => {
    setAgent(null);
    setPage({ view:'home' });
    setTimeout(() => window.scrollTo({ top:0, behavior:'smooth' }), 0);
  };

  const jumpTo = (id) => {
    setAgent(null);
    if (page.view !== 'home') {
      setPage({ view:'home' });
      setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior:'smooth' }), 50);
      return;
    }
    document.getElementById(id)?.scrollIntoView({ behavior:'smooth' });
  };

  const openAgentPage = (nextAgent) => {
    setAgent(null);
    setPage({ view:'agent', agentId:nextAgent.id });
    window.scrollTo({ top:0, behavior:'smooth' });
  };

  const openDocsPage = (nextAgent = null) => {
    setAgent(null);
    setPage({ view:'docs', agentId:nextAgent?.id });
    window.scrollTo({ top:0, behavior:'smooth' });
  };

  const openPlanPage = (plan) => {
    setPage({ view:'plan', planName:plan.name });
    window.scrollTo({ top:0, behavior:'smooth' });
  };

  const openAtomBuilderPage = () => {
    setAgent(null);
    setPage({ view:'atom-builder' });
    window.scrollTo({ top:0, behavior:'smooth' });
  };

  const openAdminLab = (planName = 'Pro') => {
    setAgent(null);
    setPage({ view:'admin-builder', planName });
    window.scrollTo({ top:0, behavior:'smooth' });
  };

  const renderPage = () => {
    if (page.view === 'start') return <StartPage onBack={goHome} onOpenDocs={() => openDocsPage()} onSelectAgent={openAgentPage}/>;
    if (page.view === 'docs') return <DocsPage onBack={goHome} focusAgent={pageAgent} onSelectAgent={openDocsPage}/>;
    if (page.view === 'agent' && pageAgent) return <AgentWorkspacePage agent={pageAgent} onBack={goHome} onDocs={() => openDocsPage(pageAgent)}/>;
    if (page.view === 'atom-builder') {
      return (
        <AtomBuilderPage
          selectedPlan={page.planName || 'Pro'}
          agents={AGENTS}
          plans={PLANS}
        />
      );
    }
    if (page.view === 'admin-builder') return <AdminAutomationPage onBack={goHome} initialPlanName={page.planName || 'Pro'}/>;
    if (page.view === 'demo') return <DemoPage onBack={goHome}/>;
    if (page.view === 'sales') return <ContactPage onBack={goHome}/>;
    if (page.view === 'contact') return <ContactPage onBack={goHome}/>;
    if (page.view === 'legal') return <LegalPage type={page.type} onBack={goHome}/>;
    if (page.view === 'plan' && pagePlan) return <PlanPage plan={pagePlan} onBack={goHome} onOpenBuilder={openAdminLab}/>;
    return null;
  };

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 34);
    window.addEventListener('scroll', fn);
    return () => window.removeEventListener('scroll', fn);
  }, []);

  useEffect(() => {
    if (page.view !== 'home') window.scrollTo({ top:0, behavior:'smooth' });
  }, [page]);

  return (
    <div style={{ minHeight:'100vh', background:BG, color:'#fff', fontFamily:'Manrope, sans-serif', overflow:'hidden' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=Manrope:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,600;12..96,700;12..96,800&display=swap');

        @keyframes orbit-spin      { from{transform:rotateZ(0deg)}  to{transform:rotateZ(360deg)} }
        @keyframes orbit-spin-rev  { from{transform:rotateZ(0deg)}  to{transform:rotateZ(-360deg)} }
        @keyframes spin-slow       { from{transform:rotate(0deg)}   to{transform:rotate(360deg)} }
        @keyframes spin-fast       { from{transform:rotate(0deg)}   to{transform:rotate(360deg)} }
        @keyframes pulse-glow      { 0%,100%{opacity:.5;transform:scale(1)} 50%{opacity:.95;transform:scale(1.06)} }
        @keyframes float           { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }
        @keyframes fadeIn          { from{opacity:0} to{opacity:1} }
        @keyframes modalIn         { from{opacity:0;transform:scale(.93) translateY(16px)} to{opacity:1;transform:scale(1) translateY(0)} }
        @keyframes slideInRight    { from{opacity:0;transform:translateX(-9px)} to{opacity:1;transform:translateX(0)} }
        @keyframes cardFadeIn      { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:translateY(0)} }
        @keyframes nucleon-jiggle  { 0%,100%{transform:translate(0,0)} 33%{transform:translate(.5px,-.5px)} 66%{transform:translate(-.5px,.5px)} }

        @media(max-width:900px){
          header{padding-left:18px!important;padding-right:18px!important}
          nav{gap:12px!important;overflow-x:auto;max-width:58vw}
          .modal-inner{grid-template-columns:1fr!important}
          .agent-grid {grid-template-columns:1fr!important}
          .plan-grid  {grid-template-columns:1fr!important}
          .page-grid  {grid-template-columns:1fr!important}
          .builder-layout{grid-template-columns:1fr!important}
          .builder-actions{grid-template-columns:1fr!important}
          .hero-h1    {font-size:52px!important;letter-spacing:-0.03em!important}
          main h1     {font-size:46px!important}
        }
        html{scroll-behavior:smooth}
        body{overflow-x:hidden}
      `}</style>

      {/* ── HEADER ── */}
      <header style={{ position:'fixed', top:0, left:0, right:0, zIndex:50, padding:scrolled?'11px 40px':'19px 40px', background:scrolled?'rgba(12,14,19,0.84)':'rgba(12,14,19,0.44)', backdropFilter:'blur(18px)', borderBottom:scrolled?`1px solid ${BORD}`:'1px solid rgba(255,255,255,0.03)', transition:'all 0.28s ease', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ display:'flex', alignItems:'center', gap:11 }}>
          {/* Mini atom logo */}
          <div style={{ position:'relative', width:30, height:30, flexShrink:0 }}>
            <div style={{ position:'absolute', inset:0, border:`1.5px solid rgba(0,201,167,0.45)`, borderRadius:'50%', transform:'rotateX(68deg)', animation:'orbit-spin 7s linear infinite' }}/>
            <div style={{ position:'absolute', inset:0, border:`1.5px solid rgba(139,92,246,0.4)`, borderRadius:'50%', transform:'rotateX(68deg) rotateZ(60deg)', animation:'orbit-spin-rev 9s linear infinite' }}/>
            <div style={{ position:'absolute', top:'50%', left:'50%', transform:'translate(-50%,-50%)', width:8, height:8, borderRadius:'50%', background:`radial-gradient(circle, #d4f8ef, ${ACCENT})`, boxShadow:`0 0 7px ${ACCENT}` }}/>
          </div>
          <div>
            <div style={{ fontFamily:'Bricolage Grotesque, sans-serif', fontSize:16, fontWeight:800, letterSpacing:'-0.025em', lineHeight:1, color:'#fff' }}>Ascentra Integrations</div>
            <div style={{ fontFamily:'JetBrains Mono, monospace', fontSize:8, letterSpacing:'0.24em', color:'rgba(255,255,255,0.36)', marginTop:3, textTransform:'uppercase' }}>by Langolf Enterprises</div>
          </div>
        </div>
        <nav style={{ display:'flex', gap:22, alignItems:'center' }}>
          {[
            ['Agents', () => jumpTo('agents')],
            ['Atom Builder', openAtomBuilderPage],
            ['Services', () => jumpTo('services')],
            ['Pricing', () => jumpTo('pricing')],
            ['Docs', () => openDocsPage()],
          ].map(([l, action])=>(
            <button key={l} onClick={action} style={{ fontFamily:'Manrope, sans-serif', fontSize:13, color:'rgba(255,255,255,0.58)', background:'transparent', border:'none', padding:0, textDecoration:'none', fontWeight:500, transition:'color 0.18s', cursor:'pointer' }} onMouseEnter={e=>e.currentTarget.style.color='#fff'} onMouseLeave={e=>e.currentTarget.style.color='rgba(255,255,255,0.58)'}>{l}</button>
          ))}
          <button onClick={() => openAdminLab('Pro')} style={{ fontFamily:'Manrope, sans-serif', fontSize:13, color:'rgba(255,255,255,0.58)', background:'transparent', border:'none', padding:0, textDecoration:'none', fontWeight:500, transition:'color 0.18s', cursor:'pointer' }} onMouseEnter={e=>e.currentTarget.style.color='#fff'} onMouseLeave={e=>e.currentTarget.style.color='rgba(255,255,255,0.58)'}>
            Admin Lab
          </button>
          <button onClick={() => setPage({ view:'start' })} style={{ padding:'8px 16px', borderRadius:9, border:'none', background:ACCENT, color:'#000', fontFamily:'Bricolage Grotesque, sans-serif', fontWeight:700, fontSize:13, cursor:'pointer', transition:'all 0.18s', boxShadow:`0 4px 14px rgba(0,201,167,0.28)` }} onMouseEnter={e=>e.currentTarget.style.transform='translateY(-1px)'} onMouseLeave={e=>e.currentTarget.style.transform='translateY(0)'}>
            Start Free
          </button>
        </nav>
      </header>

      {page.view !== 'home' ? renderPage() : (
      <>
      {/* ── HERO ── */}
      <section style={{ position:'relative', paddingTop:96, paddingBottom:0 }}>
        <div style={{ position:'absolute', inset:0, background:'linear-gradient(180deg, rgba(255,255,255,0.02), transparent 30%)', pointerEvents:'none' }}/>
        <div style={{ maxWidth:1060, margin:'0 auto', padding:'0 40px', textAlign:'center' }}>
          <div style={{ display:'inline-flex', alignItems:'center', gap:7, padding:'4px 12px', borderRadius:999, background:'rgba(255,255,255,0.045)', border:`1px solid rgba(255,255,255,0.08)`, fontFamily:'JetBrains Mono, monospace', fontSize:10, letterSpacing:'0.25em', color:ACCENT, textTransform:'uppercase', marginBottom:22 }}>
            <span style={{ width:5, height:5, borderRadius:'50%', background:ACCENT, boxShadow:`0 0 7px ${ACCENT}` }}/>10 agents online
          </div>
          <h1 className="hero-h1" style={{ fontFamily:'Bricolage Grotesque, sans-serif', fontSize:84, fontWeight:800, lineHeight:0.94, letterSpacing:'-0.045em', margin:'0 0 20px', background:'linear-gradient(150deg, #fff 30%, #99f6e4 52%, #d8d4ff 78%, #fff 100%)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>
            A constellation of AI<br/>working as one.
          </h1>
          <p style={{ fontFamily:'Manrope, sans-serif', fontSize:17, color:'rgba(255,255,255,0.55)', maxWidth:580, margin:'0 auto 14px', lineHeight:1.55 }}>
            Ten specialized agents orbit the Ascentra core — designing, building,
            automating, researching, and connecting every corner of your business.
            Click any electron to explore it.
          </p>
        </div>
        <OrbitalSystem onAgentClick={setAgent}/>
        <div style={{ textAlign:'center', marginTop:-10, paddingBottom:36 }}>
          <ChevronDown size={17} color="rgba(255,255,255,0.32)" style={{ margin:'0 auto', animation:'float 2.5s ease-in-out infinite' }}/>
        </div>
      </section>

      {/* ── AGENT GRID ── */}
      <section id="agents" style={{ padding:'68px 40px', maxWidth:1360, margin:'0 auto' }}>
        <div style={{ textAlign:'center', marginBottom:48 }}>
          <div style={{ fontFamily:'JetBrains Mono, monospace', fontSize:10, letterSpacing:'0.3em', color:'rgba(255,255,255,0.38)', textTransform:'uppercase', marginBottom:13 }}>01 · The Roster</div>
          <h2 style={{ fontFamily:'Bricolage Grotesque, sans-serif', fontSize:60, fontWeight:800, margin:0, letterSpacing:'-0.04em', lineHeight:0.95, background:'linear-gradient(135deg, #fff, #C4B5FD)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>Meet the agents</h2>
          <p style={{ fontFamily:'Manrope, sans-serif', fontSize:15, color:'rgba(255,255,255,0.5)', maxWidth:480, margin:'14px auto 0', lineHeight:1.55 }}>Each agent is a specialist — focused, opinionated, ruthlessly good at one thing.</p>
        </div>
        <div className="agent-grid" style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(260px, 1fr))', gap:16 }}>
          {AGENTS.map((a, i) => <AgentCard key={a.id} agent={a} onClick={setAgent} index={i}/>)}
        </div>
      </section>

      {/* ── COMING SOON ── */}
      <section id="services" style={{ padding:'68px 40px', maxWidth:1360, margin:'0 auto' }}>
        <div style={{ textAlign:'center', marginBottom:44 }}>
          <div style={{ fontFamily:'JetBrains Mono, monospace', fontSize:10, letterSpacing:'0.3em', color:'rgba(255,255,255,0.38)', textTransform:'uppercase', marginBottom:13 }}>02 · The Horizon</div>
          <h2 style={{ fontFamily:'Bricolage Grotesque, sans-serif', fontSize:54, fontWeight:800, margin:0, letterSpacing:'-0.04em', lineHeight:0.95, color:'#fff' }}>Coming into orbit</h2>
          <p style={{ fontFamily:'Manrope, sans-serif', fontSize:15, color:'rgba(255,255,255,0.5)', maxWidth:460, margin:'14px auto 0', lineHeight:1.55 }}>Early access goes to Pro and Enterprise subscribers first.</p>
        </div>
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(250px, 1fr))', gap:16 }}>
          {COMING.map((s, i) => (
            <div key={i} style={{ padding:24, borderRadius:16, background:SURF, border:`1px dashed rgba(255,255,255,0.09)`, animation:`cardFadeIn 0.5s ease ${i*0.07}s both` }}>
              <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:16 }}>
                <div style={{ width:40, height:40, borderRadius:9, background:`rgba(0,201,167,0.07)`, border:`1px solid rgba(0,201,167,0.16)`, display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <div style={{ width:14, height:14, borderRadius:'50%', border:`2px solid ${ACCENT}`, animation:'orbit-spin 4s linear infinite' }}/>
                </div>
                <span style={{ fontFamily:'JetBrains Mono, monospace', fontSize:9, letterSpacing:'0.18em', color:'#FBBF24', background:'rgba(251,191,36,0.07)', border:'1px solid rgba(251,191,36,0.22)', padding:'3px 8px', borderRadius:999, textTransform:'uppercase' }}>{s.eta}</span>
              </div>
              <h3 style={{ fontFamily:'Bricolage Grotesque, sans-serif', fontSize:18, fontWeight:700, margin:'0 0 7px', color:'#fff', letterSpacing:'-0.02em' }}>{s.title}</h3>
              <p style={{ fontFamily:'Manrope, sans-serif', fontSize:13, color:'rgba(255,255,255,0.5)', lineHeight:1.55, margin:'0 0 14px' }}>{s.desc}</p>
              {s.action === 'builder' && (
                <button onClick={openAtomBuilderPage} style={{ padding:'10px 14px', borderRadius:10, border:'none', background:ACCENT, color:'#000', fontFamily:'Bricolage Grotesque, sans-serif', fontWeight:800, fontSize:12, cursor:'pointer', display:'inline-flex', alignItems:'center', gap:7 }}>
                  See Atom Builder <ArrowRight size={13}/>
                </button>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ── PRICING ── */}
      <PricingSection onPlanSelect={openPlanPage}/>

      {/* ── CTA ── */}
      <section style={{ position:'relative', padding:'68px 40px', textAlign:'center', overflow:'hidden' }}>
        <div style={{ position:'absolute', inset:0, background:'linear-gradient(126deg, rgba(255,255,255,0.04) 0 14%, transparent 14% 78%, rgba(0,201,167,0.08) 78% 100%)', pointerEvents:'none' }}/>
        <div style={{ position:'relative', maxWidth:580, margin:'0 auto' }}>
          <h2 style={{ fontFamily:'Bricolage Grotesque, sans-serif', fontSize:52, fontWeight:800, margin:'0 0 16px', letterSpacing:'-0.04em', lineHeight:0.95, background:`linear-gradient(135deg, #fff, #99f6e4)`, WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent' }}>
            Launch your first agent in 90 seconds.
          </h2>
          <p style={{ fontFamily:'Manrope, sans-serif', fontSize:15, color:'rgba(255,255,255,0.52)', margin:'0 0 30px', lineHeight:1.5 }}>No credit card. No install. Just open Ascentra and pick an electron.</p>
          <div style={{ display:'flex', gap:11, justifyContent:'center', flexWrap:'wrap' }}>
            <button onClick={() => jumpTo('pricing')} style={{ padding:'13px 26px', borderRadius:11, border:'none', background:ACCENT, color:'#000', fontFamily:'Bricolage Grotesque, sans-serif', fontWeight:700, fontSize:14, cursor:'pointer', boxShadow:`0 10px 32px rgba(0,201,167,0.32)`, display:'flex', alignItems:'center', gap:7, transition:'transform 0.2s' }} onMouseEnter={e=>e.currentTarget.style.transform='translateY(-2px)'} onMouseLeave={e=>e.currentTarget.style.transform='translateY(0)'}>
              <Play size={14}/> Unlock Atom Builder with Pro
            </button>
            <button onClick={() => openAdminLab('Pro')} style={{ padding:'13px 26px', borderRadius:11, border:`1px solid ${BORD}`, background:SURF, color:'#fff', fontFamily:'Bricolage Grotesque, sans-serif', fontWeight:600, fontSize:14, cursor:'pointer' }}>Open admin QA lab</button>
          </div>
        </div>
      </section>
      </>
      )}

      {/* ── FOOTER ── */}
      <footer style={{ padding:'28px 40px', borderTop:`1px solid ${BORD}`, background:'rgba(255,255,255,0.025)', display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:14 }}>
        <div style={{ display:'flex', alignItems:'center', gap:9 }}>
          <div style={{ width:20, height:20, borderRadius:'50%', background:`radial-gradient(circle, #d4f8ef, ${ACCENT})`, boxShadow:`0 0 7px rgba(0,201,167,0.36)` }}/>
          <div>
            <div style={{ fontFamily:'Bricolage Grotesque, sans-serif', fontWeight:800, fontSize:13, color:'#fff', letterSpacing:'-0.01em' }}>Ascentra Integrations</div>
            <div style={{ fontFamily:'JetBrains Mono, monospace', fontSize:8, color:'rgba(255,255,255,0.36)', letterSpacing:'0.2em', textTransform:'uppercase' }}>A Langolf Enterprises Product</div>
          </div>
        </div>
        <div style={{ display:'flex', gap:20, flexWrap:'wrap', fontFamily:'Manrope, sans-serif', fontSize:12, color:'rgba(255,255,255,0.4)' }}>
          <span>© 2026 Langolf Enterprises</span>
          <button onClick={() => setPage({ view:'legal', type:'privacy' })} style={{ color:'inherit', background:'transparent', border:'none', padding:0, cursor:'pointer', font:'inherit' }}>Privacy</button>
          <button onClick={() => setPage({ view:'legal', type:'terms' })} style={{ color:'inherit', background:'transparent', border:'none', padding:0, cursor:'pointer', font:'inherit' }}>Terms</button>
          <button onClick={() => setPage({ view:'legal', type:'security' })} style={{ color:'inherit', background:'transparent', border:'none', padding:0, cursor:'pointer', font:'inherit' }}>Security</button>
          <button onClick={() => setPage({ view:'contact' })} style={{ color:'inherit', background:'transparent', border:'none', padding:0, cursor:'pointer', font:'inherit' }}>Contact</button>
        </div>
      </footer>

      {agent && <AgentModal agent={agent} onClose={() => setAgent(null)} onActivate={openAgentPage} onDocs={openDocsPage}/>}
    </div>
  );
}
