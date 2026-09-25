import { useEffect, useState } from 'react';
import { ArrowLeft, Crown, Menu, Shield, Workflow, X } from 'lucide-react';
import AutomationAtomBuilder from './AutomationAtomBuilder.jsx';

const fallbackPlans = [
  { name: 'Starter', desc: 'Preview the builder experience with locked production controls.', vals: ['2 agents', '50 / month', '1', false, false, false, false, false, false, 'Preview only'] },
  { name: 'Pro', desc: 'Run compact live automations with up to three active atoms.', vals: ['All 10 agents', 'Unlimited', '5', true, true, true, false, false, false, 'Up to 3 atoms'] },
  { name: 'Enterprise', desc: 'Scale into branching workflows with advanced approvals and ten atoms.', vals: ['All 10 agents', 'Unlimited', 'Unlimited', true, true, true, true, true, true, 'Up to 10 atoms'] },
];

export default function AtomBuilderPage({
  selectedPlan = 'Pro',
  agents = [],
  plans = [],
  workspaceAccount = null,
  onBack = null,
  onSeePricing = null,
  onOpenAdminLab = null,
}) {
  const [navOpen, setNavOpen] = useState(false);
  const safePlans = plans.length ? plans : fallbackPlans;
  const workspace = workspaceAccount?.snapshot?.workspace || null;
  const activePlan = safePlans.find((plan) => plan.name === selectedPlan) || safePlans.find((plan) => plan.name === 'Pro') || safePlans[0];
  const workspaceContext = workspace
    ? { organizationId: workspace.organizationId, userId: workspaceAccount?.user?.id || null }
    : null;

  useEffect(() => {
    const closeOnEscape = (event) => { if (event.key === 'Escape') setNavOpen(false); };
    const closeOnOutside = (event) => {
      if (navOpen && !event.target.closest?.('.atom-builder-page__nav, .atom-builder-page__menu')) setNavOpen(false);
    };
    window.addEventListener('keydown', closeOnEscape);
    document.addEventListener('pointerdown', closeOnOutside);
    return () => {
      window.removeEventListener('keydown', closeOnEscape);
      document.removeEventListener('pointerdown', closeOnOutside);
    };
  }, [navOpen]);

  const navigate = (callback) => {
    setNavOpen(false);
    callback?.();
  };

  return (
    <main className="atom-page atom-page--builder">
      <header className="atom-builder-page__header">
        <div className="atom-builder-page__identity">
          <button type="button" className="atom-builder-page__menu" aria-label="Open navigation" aria-expanded={navOpen} onClick={() => setNavOpen((open) => !open)}><Menu size={19} /></button>
          {onBack && (
            <button type="button" className="atom-page__action" onClick={onBack} aria-label="Back to platform">
              <ArrowLeft size={16} /> Platform
            </button>
          )}
          <span className="atom-builder-page__mark"><Workflow size={17} /></span>
          <span>
            <small>Atom Builder</small>
            <strong>{workspace?.workspaceName || 'Ascentra workspace'}</strong>
          </span>
        </div>
        <nav className={`atom-builder-page__nav${navOpen ? ' open' : ''}`} aria-label="Workspace navigation">
          <button type="button" onClick={() => navigate(onBack)}>Dashboard</button>
          <button type="button" className="active" aria-current="page">Atom Builder</button>
          {onSeePricing && <button type="button" onClick={() => navigate(onSeePricing)}>Plans</button>}
          {onOpenAdminLab && <button type="button" onClick={() => navigate(onOpenAdminLab)}>Admin Lab</button>}
          <button type="button" className="atom-builder-page__navClose" aria-label="Close navigation" onClick={() => setNavOpen(false)}><X size={16} /></button>
        </nav>
        <div className="atom-builder-page__actions">
          <span className="atom-builder-page__plan">{activePlan?.name || 'Pro'}</span>
          {onSeePricing && (
            <button type="button" className="atom-page__action" onClick={onSeePricing}><Crown size={15} /> Plans</button>
          )}
          {onOpenAdminLab && (
            <button type="button" className="atom-page__action" onClick={onOpenAdminLab}><Shield size={15} /> Admin</button>
          )}
        </div>
      </header>
      <div className="atom-builder-page__frame">
        <AutomationAtomBuilder
          agents={agents}
          plans={safePlans}
          embedded
          sectionId="atom-builder-screen"
          contextLabel="Atom Workspace"
          initialPlanName={activePlan?.name || 'Pro'}
          workspaceContext={workspaceContext}
        />
      </div>
    </main>
  );
}
