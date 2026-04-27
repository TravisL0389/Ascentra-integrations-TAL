import { useMemo, useState } from 'react';
import {
  Bot,
  ChevronLeft,
  ChevronRight,
  Database,
  Gauge,
  LayoutGrid,
  Mail,
  Play,
  Search,
  Settings2,
  Shield,
  Sparkles,
  Workflow,
} from 'lucide-react';
import AutomationAtomBuilder from './AutomationAtomBuilder.jsx';

const railGroups = [
  {
    label: 'Build',
    items: [
      { id: 'canvas', name: 'Canvas', detail: 'Drag modules and connect paths', icon: LayoutGrid },
      { id: 'flows', name: 'Flows', detail: 'Scenario layouts and branches', icon: Workflow },
      { id: 'launch', name: 'Launch', detail: 'Run checks before publish', icon: Play },
    ],
  },
  {
    label: 'Atoms',
    items: [
      { id: 'pulse', name: 'Pulse', detail: 'Automation & workflows', icon: Sparkles },
      { id: 'echo', name: 'Echo', detail: 'Email and follow-up delivery', icon: Mail },
      { id: 'nexus', name: 'Nexus', detail: 'Data syncs and integrations', icon: Database },
    ],
  },
  {
    label: 'Control',
    items: [
      { id: 'insights', name: 'Insights', detail: 'Health, logs, and throughput', icon: Gauge },
      { id: 'admin', name: 'Admin', detail: 'Permissions and review gates', icon: Shield },
      { id: 'settings', name: 'Settings', detail: 'Workspace preferences', icon: Settings2 },
    ],
  },
];

const surface = 'rgba(9, 13, 24, 0.92)';
const surfaceStrong = 'rgba(13, 18, 31, 0.96)';
const border = 'rgba(164, 174, 201, 0.16)';
const textPrimary = '#f5f7fb';
const textSecondary = 'rgba(230, 236, 248, 0.72)';
const accent = '#3dd8b2';
const accentSoft = 'rgba(61, 216, 178, 0.18)';

export default function AtomBuilderPage({ selectedPlan = 'pro' }) {
  const [railOpen, setRailOpen] = useState(true);
  const [activeTool, setActiveTool] = useState('canvas');

  const activeItem = useMemo(
    () =>
      railGroups
        .flatMap((group) => group.items)
        .find((item) => item.id === activeTool) ?? railGroups[0].items[0],
    [activeTool],
  );

  return (
    <section
      data-atom-builder-screen="true"
      style={{
        minHeight: '100vh',
        background:
          'radial-gradient(circle at top left, rgba(34, 199, 173, 0.08), transparent 24%), radial-gradient(circle at top right, rgba(108, 72, 255, 0.12), transparent 26%), #060913',
        color: textPrimary,
      }}
    >
      <style>{`
        [data-atom-builder-screen="true"] .builder-layout {
          grid-template-columns: minmax(0, 1fr) 332px !important;
          gap: 18px !important;
        }
        [data-atom-builder-screen="true"] .builder-layout > :first-child {
          display: none !important;
        }
        [data-atom-builder-screen="true"] .builder-layout > :nth-child(2) {
          min-width: 0;
        }
        [data-atom-builder-screen="true"] .builder-layout > :nth-child(2) > div:first-child {
          height: calc(100vh - 238px) !important;
          min-height: 760px !important;
        }
        [data-atom-builder-screen="true"] .builder-layout > :nth-child(3) {
          max-height: calc(100vh - 160px);
          overflow: auto;
          padding-right: 4px;
          scrollbar-width: thin;
        }
        @media (max-width: 1180px) {
          [data-atom-builder-screen="true"] .builder-layout {
            grid-template-columns: 1fr !important;
          }
          [data-atom-builder-screen="true"] .builder-layout > :nth-child(3) {
            max-height: none;
            overflow: visible;
          }
          [data-atom-builder-screen="true"] .builder-layout > :nth-child(2) > div:first-child {
            height: 68vh !important;
            min-height: 640px !important;
          }
        }
      `}</style>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: railOpen ? '300px minmax(0, 1fr)' : '84px minmax(0, 1fr)',
          minHeight: '100vh',
          transition: 'grid-template-columns 180ms ease',
        }}
      >
        <aside
          style={{
            borderRight: `1px solid ${border}`,
            background: railOpen
              ? 'linear-gradient(180deg, rgba(9, 13, 24, 0.98), rgba(7, 11, 20, 0.98))'
              : 'linear-gradient(180deg, rgba(9, 13, 24, 0.94), rgba(7, 11, 20, 0.94))',
            padding: railOpen ? '22px 18px' : '22px 12px',
            display: 'flex',
            flexDirection: 'column',
            gap: 18,
            position: 'sticky',
            top: 0,
            height: '100vh',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: railOpen ? 'space-between' : 'center',
              gap: 12,
            }}
          >
            {railOpen ? (
              <div>
                <div style={{ fontSize: 12, letterSpacing: '0.28em', textTransform: 'uppercase', color: textSecondary }}>
                  Atom Builder
                </div>
                <div style={{ marginTop: 6, fontSize: 22, fontWeight: 700 }}>Workspace</div>
              </div>
            ) : null}
            <button
              type="button"
              onClick={() => setRailOpen((current) => !current)}
              style={{
                width: 42,
                height: 42,
                borderRadius: 14,
                border: `1px solid ${border}`,
                background: surfaceStrong,
                color: textPrimary,
                display: 'grid',
                placeItems: 'center',
                cursor: 'pointer',
                boxShadow: '0 18px 32px rgba(0, 0, 0, 0.22)',
              }}
              aria-label={railOpen ? 'Collapse builder toolbar' : 'Expand builder toolbar'}
            >
              {railOpen ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
            </button>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: railOpen ? '12px 14px' : '12px 0',
              borderRadius: 16,
              border: `1px solid ${border}`,
              background: surface,
              justifyContent: railOpen ? 'flex-start' : 'center',
            }}
          >
            <Search size={16} color={textSecondary} />
            {railOpen ? <span style={{ color: textSecondary, fontSize: 14 }}>Search tools and atoms</span> : null}
          </div>

          <div
            style={{
              display: 'grid',
              gap: 12,
              overflowY: 'auto',
              paddingRight: railOpen ? 4 : 0,
              scrollbarWidth: 'thin',
            }}
          >
            {railGroups.map((group) => (
              <div
                key={group.label}
                style={{
                  display: 'grid',
                  gap: 8,
                }}
              >
                {railOpen ? (
                  <div style={{ padding: '6px 10px 0', fontSize: 11, letterSpacing: '0.26em', textTransform: 'uppercase', color: textSecondary }}>
                    {group.label}
                  </div>
                ) : null}
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = item.id === activeTool;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setActiveTool(item.id)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        width: '100%',
                        padding: railOpen ? '14px 14px' : '14px 0',
                        justifyContent: railOpen ? 'flex-start' : 'center',
                        borderRadius: 18,
                        border: `1px solid ${active ? 'rgba(61, 216, 178, 0.34)' : border}`,
                        background: active ? accentSoft : surface,
                        color: textPrimary,
                        cursor: 'pointer',
                        textAlign: 'left',
                        boxShadow: active ? '0 16px 28px rgba(22, 32, 58, 0.3)' : 'none',
                      }}
                      title={item.name}
                    >
                      <span
                        style={{
                          width: 42,
                          height: 42,
                          borderRadius: 14,
                          display: 'grid',
                          placeItems: 'center',
                          background: active ? 'rgba(61, 216, 178, 0.18)' : 'rgba(255, 255, 255, 0.04)',
                          color: active ? accent : textPrimary,
                          flexShrink: 0,
                        }}
                      >
                        <Icon size={18} />
                      </span>
                      {railOpen ? (
                        <span style={{ display: 'grid', gap: 4 }}>
                          <span style={{ fontSize: 15, fontWeight: 600 }}>{item.name}</span>
                          <span style={{ fontSize: 13, color: textSecondary }}>{item.detail}</span>
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>

          <div
            style={{
              marginTop: 'auto',
              padding: railOpen ? 18 : 12,
              borderRadius: 20,
              border: `1px solid ${border}`,
              background: 'linear-gradient(180deg, rgba(13, 19, 32, 0.96), rgba(10, 15, 26, 0.96))',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: railOpen ? 'flex-start' : 'center' }}>
              <span
                style={{
                  width: 42,
                  height: 42,
                  borderRadius: 14,
                  display: 'grid',
                  placeItems: 'center',
                  background: 'rgba(61, 216, 178, 0.14)',
                  color: accent,
                }}
              >
                <Bot size={18} />
              </span>
              {railOpen ? (
                <span style={{ display: 'grid', gap: 4 }}>
                  <span style={{ fontSize: 15, fontWeight: 600 }}>{activeItem.name}</span>
                  <span style={{ fontSize: 13, color: textSecondary }}>{activeItem.detail}</span>
                </span>
              ) : null}
            </div>
          </div>
        </aside>

        <main
          style={{
            minWidth: 0,
            display: 'grid',
            gridTemplateRows: 'auto minmax(0, 1fr)',
          }}
        >
          <div
            style={{
              padding: '18px 24px 0',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 18,
                padding: '16px 18px',
                borderRadius: 22,
                border: `1px solid ${border}`,
                background: 'linear-gradient(180deg, rgba(10, 14, 24, 0.94), rgba(8, 12, 22, 0.94))',
                boxShadow: '0 22px 36px rgba(0, 0, 0, 0.2)',
              }}
            >
              <div style={{ display: 'grid', gap: 6 }}>
                <div style={{ fontSize: 12, letterSpacing: '0.28em', textTransform: 'uppercase', color: textSecondary }}>
                  Dedicated Builder View
                </div>
                <div style={{ fontSize: 22, fontWeight: 700 }}>Atom Builder takes the stage</div>
              </div>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 14px',
                  borderRadius: 16,
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: `1px solid ${border}`,
                  color: textSecondary,
                  fontSize: 14,
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 999,
                    background: accent,
                    boxShadow: '0 0 0 6px rgba(61, 216, 178, 0.12)',
                  }}
                />
                Pro workspace active
              </div>
            </div>
          </div>

          <div style={{ minWidth: 0, minHeight: 0 }}>
            <AutomationAtomBuilder
              embedded
              fullScreen
              contextLabel="Atom Builder"
              initialPlan={selectedPlan}
            />
          </div>
        </main>
      </div>
    </section>
  );
}
