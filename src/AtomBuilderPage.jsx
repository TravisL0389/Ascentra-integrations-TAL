import { ArrowLeft, Crown, Shield, Workflow } from 'lucide-react';
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
  const safePlans = plans.length ? plans : fallbackPlans;
  const workspace = workspaceAccount?.snapshot?.workspace || null;
  const activePlan = safePlans.find((plan) => plan.name === selectedPlan) || safePlans.find((plan) => plan.name === 'Pro') || safePlans[0];
  const workspaceContext = workspace
    ? { organizationId: workspace.organizationId, userId: workspaceAccount?.user?.id || null }
    : null;

  return (
    <main className="atom-page atom-page--builder">
      <header className="atom-builder-page__header">
        <div className="atom-builder-page__identity">
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
