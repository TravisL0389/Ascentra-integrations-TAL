import React from 'react';
import { Check, CreditCard, Workflow } from 'lucide-react';

const pageButtonStyle = {
  padding: '12px 20px',
  borderRadius: 10,
  border: 'none',
  background: '#00C9A7',
  color: '#000',
  fontFamily: 'Bricolage Grotesque, sans-serif',
  fontWeight: 700,
  fontSize: 13,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  boxShadow: '0 8px 26px rgba(0,201,167,0.3)',
};

const subtleButtonStyle = {
  ...pageButtonStyle,
  border: '1px solid rgba(255,255,255,0.08)',
  background: 'rgba(255,255,255,0.04)',
  color: '#fff',
  boxShadow: 'none',
};

export default function AtomBuilderPage({ PageShell, onBack, onSeePricing, onOpenAdminLab, accent = '#00C9A7', bord = 'rgba(255,255,255,0.08)', surf = 'rgba(255,255,255,0.04)' }) {
  return (
    <PageShell
      eyebrow="Atom Builder"
      title="A dedicated page for your paid automation workspace."
      desc="Atom Builder now lives on its own page instead of inside the home screen. It is positioned as a Pro feature, with Enterprise expanding the graph depth and controls."
      onBack={onBack}
      accent={accent}
      maxWidth={1360}
    >
      <div className="page-grid" style={{ display:'grid', gridTemplateColumns:'1.05fr 0.95fr', gap:18 }}>
        <div style={{ padding:30, borderRadius:24, border:`1px solid ${bord}`, background:'linear-gradient(150deg, rgba(0,201,167,0.08), rgba(255,255,255,0.03) 45%, rgba(6,10,18,0.92))' }}>
          <div style={{ fontFamily:'JetBrains Mono, monospace', fontSize:10, letterSpacing:'0.28em', color:accent, textTransform:'uppercase', marginBottom:16 }}>Feature page</div>
          <h2 style={{ fontFamily:'Bricolage Grotesque, sans-serif', fontSize:58, fontWeight:800, lineHeight:0.94, letterSpacing:'-0.04em', margin:'0 0 16px', color:'#fff' }}>
            Atom Builder is its own destination now.
          </h2>
          <p style={{ fontFamily:'Manrope, sans-serif', fontSize:16, color:'rgba(255,255,255,0.58)', lineHeight:1.6, maxWidth:620, margin:'0 0 24px' }}>
            This page gives Atom Builder a clearer product boundary. The home page can still advertise it, while this route explains the feature, the plan fit, and the internal QA path you use before rollout.
          </p>
          <div style={{ display:'grid', gap:12, marginBottom:24 }}>
            {[
              'Starter keeps Atom Builder locked so the subscription promise stays clean.',
              'Pro includes the builder with compact live paths up to 3 atoms.',
              'Enterprise expands the graph to 10 atoms with deeper approvals and branching.',
            ].map((item) => (
              <div key={item} style={{ display:'flex', alignItems:'center', gap:10, color:'rgba(255,255,255,0.82)', fontFamily:'Manrope, sans-serif', fontSize:14 }}>
                <Check size={14} color={accent} /> {item}
              </div>
            ))}
          </div>
          <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
            <button onClick={onSeePricing} style={pageButtonStyle}>
              See Pro pricing <CreditCard size={14}/>
            </button>
            <button onClick={onOpenAdminLab} style={subtleButtonStyle}>
              Open admin QA lab <Workflow size={14}/>
            </button>
          </div>
        </div>

        <div style={{ padding:30, borderRadius:24, border:`1px solid ${bord}`, background:surf }}>
          <div style={{ display:'grid', gap:14 }}>
            {[
              ['What users buy', 'A polished Atom Builder workspace inside the paid product, not a loose preview buried in Starter.'],
              ['What you verify', 'Node tests, backend saves, run history, path execution, and locked Starter behavior before launch.'],
              ['Why this page matters', 'Atom Builder has a dedicated destination in the app, so the feature feels intentional instead of being buried in the homepage flow.'],
            ].map(([title, desc]) => (
              <div key={title} style={{ padding:'16px 18px', borderRadius:18, border:`1px solid ${bord}`, background:'rgba(255,255,255,0.03)' }}>
                <div style={{ fontFamily:'Bricolage Grotesque, sans-serif', fontSize:20, fontWeight:700, color:'#fff', marginBottom:8 }}>{title}</div>
                <div style={{ fontFamily:'Manrope, sans-serif', fontSize:13, lineHeight:1.6, color:'rgba(255,255,255,0.56)' }}>{desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </PageShell>
  );
}
