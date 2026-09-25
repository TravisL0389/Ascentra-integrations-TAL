import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowRight,
  BookMarked,
  Bot,
  Boxes,
  Check,
  CircleDot,
  CopyPlus,
  Crown,
  CreditCard,
  Database,
  Eye,
  Filter,
  FolderOpen,
  GitBranch,
  History,
  Lock,
  Mail,
  MessageSquare,
  Play,
  Plus,
  RefreshCw,
  Redo2,
  Rocket,
  Search,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Timer,
  Trash2,
  Undo2,
  Webhook,
  Workflow,
  Link2,
  CalendarClock,
  Clock,
  Wifi,
  KeyRound,
  X,
} from 'lucide-react';
import { hasSupabaseConfig } from './lib/supabaseClient.js';
import RunConsole from './atom-builder/RunConsole.jsx';
import { getConfigFields, getNodeDefinition, getPorts } from './atom-builder/definitions.js';
import { snapPoint } from './atom-builder/canvas.js';
import { simulateWorkflow } from './atom-builder/simulation.js';
import { loadDraft, saveDraft } from './atom-builder/persistence.js';
import {
  ATOM_CATEGORIES,
  CORE_ATOMS,
  buildAgentAtoms,
  buildPaletteGroups,
  findAtomDefinition,
  getDefaultAtomConfig,
  resolveBuilderKind,
  visualForNode,
} from './atom-builder/registry.js';
import { buildConnection, reachableUpstreamNodes, validateWorkflow } from './atom-builder/graph.js';
import {
  deleteAutomationFlow,
  getAutomationBackendStatus,
  getExecutionDetail,
  listAutomationFlows,
  listAutomationRuns,
  listAutomationRunSteps,
  listNativeExecutions,
  loadAutomationFlow,
  runAutomationNode,
  runAutomationPath,
  runExecutionNative,
  saveAutomationFlow,
  saveWorkflowVersion,
  TERMINAL_EXECUTION_STATUSES,
  cancelExecution,
  retryExecution,
  listConnectionsAndCredentials,
  createConnection,
  deleteConnection,
  createCredential,
  deleteCredential,
  listApprovals,
  decideApproval,
  listSchedules,
  upsertSchedule,
  deleteSchedule,
  listWebhooks,
  createWebhook,
  toggleWebhook,
  deleteWebhook,
  listVariables,
  upsertVariable,
  deleteVariable,
} from './lib/automationBackend.js';

const BUILDER_BG = '#0c111b';
const BUILDER_SURF = 'rgba(9,14,24,0.76)';
const BUILDER_BORD = 'rgba(255,255,255,0.08)';
const BUILDER_ACCENT = '#a855f7';

const PLAN_RULES = {
  Starter: { atoms: 0, label: 'Locked on Starter', editable: false, note: 'Atom Builder is a Pro subscription feature and stays locked on Starter.' },
  Pro: { atoms: 3, label: '3 atoms', editable: true, note: 'Pro unlocks Atom Builder with up to 3 live atoms per automation.' },
  Enterprise: { atoms: 10, label: '10 atoms', editable: true, note: 'Enterprise unlocks up to 10 live atoms with advanced branching and approvals.' },
};

const INTEGRATIONS = CORE_ATOMS.filter((atom) => ['action', 'integration'].includes(atom.category));
const LOGIC_BLOCKS = CORE_ATOMS.filter((atom) => ['logic', 'data'].includes(atom.category));

const DEMO_METRICS = [
  { label: 'Execution engine', value: 'Native' },
  { label: 'Review gates', value: 'Approvals' },
  { label: 'Triggers', value: 'Manual + Webhook' },
];

const PALETTE_TABS = [{ id: 'all', label: 'All' }, ...ATOM_CATEGORIES];

const MAKE_WEBHOOK_PRESETS = {
  atlas: { scenarioName: 'Atlas - Planning Generator', webhookUrl: '' },
  axiom: { scenarioName: 'Axiom - Research Generator', webhookUrl: '' },
  cipher: { scenarioName: 'Cipher - Security Generator', webhookUrl: '' },
  echo: { scenarioName: 'Echo - Content Generator', webhookUrl: '' },
  forge: { scenarioName: 'Forge - Build Generator', webhookUrl: '' },
  kairos: { scenarioName: 'Kairos - Timing Generator', webhookUrl: '' },
  lumen: { scenarioName: 'Lumen - Insights Generator', webhookUrl: '' },
  nexus: { scenarioName: 'Nexus - Integration Generator', webhookUrl: '' },
  pulse: { scenarioName: 'Pulse - Automation Generator', webhookUrl: '' },
  veyra: { scenarioName: 'Veyra - Design Generator', webhookUrl: '' },
  trigger: { scenarioName: 'TAL manual / webhook trigger', webhookUrl: '' },
  integration: { scenarioName: 'External connector', webhookUrl: '' },
  make: { scenarioName: 'Make.com scenario', webhookUrl: '' },
};

const AGENT_PAYLOAD_SCHEMAS = {
  atlas: {
    label: 'Atlas planning payload',
    objective: 'Frame roadmap and planning requests for Atlas.',
    inputs: [
      { key: 'planningBrief', label: 'Planning brief', required: true, defaultValue: 'Design a launch-ready plan for the requested initiative.' },
      { key: 'goals', label: 'Goals', required: true, defaultValue: 'Clarify business objectives, dependencies, and success measures.' },
      { key: 'audience', label: 'Audience', required: false, defaultValue: 'Internal stakeholders and delivery leads' },
      { key: 'deliverables', label: 'Deliverables', required: true, defaultValue: 'Timeline, milestones, owner map, and next actions' },
    ],
  },
  axiom: {
    label: 'Axiom research payload',
    objective: 'Package research asks and evidence expectations for Axiom.',
    inputs: [
      { key: 'researchQuestion', label: 'Research question', required: true, defaultValue: 'What should the team know before shipping this workflow?' },
      { key: 'sources', label: 'Sources', required: false, defaultValue: 'Internal notes, docs, and approved web sources' },
      { key: 'depth', label: 'Depth', required: true, defaultValue: 'Deep synthesis' },
      { key: 'outputFormat', label: 'Output format', required: true, defaultValue: 'Findings with recommendations' },
    ],
  },
  cipher: {
    label: 'Cipher security payload',
    objective: 'Provide scope and risk context for Cipher reviews.',
    inputs: [
      { key: 'policyScope', label: 'Policy scope', required: true, defaultValue: 'Workflow security and data handling' },
      { key: 'riskLevel', label: 'Risk level', required: true, defaultValue: 'Medium' },
      { key: 'systems', label: 'Systems', required: true, defaultValue: 'Supabase, Make, app frontend' },
      { key: 'controls', label: 'Controls', required: false, defaultValue: 'Logging, approval gates, webhook validation' },
    ],
  },
  echo: {
    label: 'Echo content payload',
    objective: 'Shape campaign and follow-up requests for Echo.',
    inputs: [
      { key: 'campaignGoal', label: 'Campaign goal', required: true, defaultValue: 'Convert qualified prospects into booked calls' },
      { key: 'offer', label: 'Offer', required: true, defaultValue: 'Ascentra automation buildout' },
      { key: 'audience', label: 'Audience', required: true, defaultValue: 'High-intent leads in active pipeline' },
      { key: 'channels', label: 'Channels', required: false, defaultValue: 'Email, SMS, CRM task' },
    ],
  },
  forge: {
    label: 'Forge build payload',
    objective: 'Describe build and product execution requests for Forge.',
    inputs: [
      { key: 'productBrief', label: 'Product brief', required: true, defaultValue: 'Build a working feature from the requested business flow.' },
      { key: 'stack', label: 'Stack', required: true, defaultValue: 'React, Vite, Supabase' },
      { key: 'pages', label: 'Pages', required: false, defaultValue: 'Builder, inspector, history, settings' },
      { key: 'integrations', label: 'Integrations', required: false, defaultValue: 'Make, Supabase, email, CRM' },
    ],
  },
  kairos: {
    label: 'Kairos timing payload',
    objective: 'Organize time-bound execution asks for Kairos.',
    inputs: [
      { key: 'timeline', label: 'Timeline', required: true, defaultValue: '2-week sprint' },
      { key: 'milestones', label: 'Milestones', required: true, defaultValue: 'Setup, test, refine, launch' },
      { key: 'timezone', label: 'Timezone', required: false, defaultValue: 'America/New_York' },
      { key: 'constraints', label: 'Constraints', required: false, defaultValue: 'Business hours, approval checkpoints' },
    ],
  },
  lumen: {
    label: 'Lumen insights payload',
    objective: 'Prepare insight and reporting asks for Lumen.',
    inputs: [
      { key: 'datasetSummary', label: 'Dataset summary', required: true, defaultValue: 'Recent workflow and run history records' },
      { key: 'keyQuestions', label: 'Key questions', required: true, defaultValue: 'What is converting, stalling, or failing?' },
      { key: 'metrics', label: 'Metrics', required: false, defaultValue: 'Latency, success rate, branch usage, retries' },
      { key: 'format', label: 'Format', required: false, defaultValue: 'Operator-ready summary' },
    ],
  },
  nexus: {
    label: 'Nexus integration payload',
    objective: 'Coordinate system sync instructions for Nexus.',
    inputs: [
      { key: 'systems', label: 'Systems', required: true, defaultValue: 'App, CRM, and external automation stack' },
      { key: 'syncDirection', label: 'Sync direction', required: true, defaultValue: 'Bidirectional' },
      { key: 'objectType', label: 'Object type', required: true, defaultValue: 'Lead / automation record' },
      { key: 'mappingNotes', label: 'Mapping notes', required: false, defaultValue: 'Normalize statuses and write back run results' },
    ],
  },
  pulse: {
    label: 'Pulse automation payload',
    objective: 'Define orchestration requests for Pulse.',
    inputs: [
      { key: 'triggerEvent', label: 'Trigger event', required: true, defaultValue: 'Manual test or inbound automation event' },
      { key: 'desiredOutcome', label: 'Desired outcome', required: true, defaultValue: 'Route the right atom path and log the run' },
      { key: 'safeguards', label: 'Safeguards', required: false, defaultValue: 'Approval on high-risk actions' },
      { key: 'cadence', label: 'Cadence', required: false, defaultValue: 'On demand' },
    ],
  },
  veyra: {
    label: 'Veyra design payload',
    objective: 'Frame creative generation asks for Veyra.',
    inputs: [
      { key: 'creativeBrief', label: 'Creative brief', required: true, defaultValue: 'Design assets for the current automation request' },
      { key: 'brandTone', label: 'Brand tone', required: true, defaultValue: 'Premium, modern, restrained' },
      { key: 'assets', label: 'Assets', required: false, defaultValue: 'Brand colors, product notes, references' },
      { key: 'format', label: 'Format', required: true, defaultValue: 'UI concepts and handoff-ready directions' },
    ],
  },
  trigger: {
    label: 'Trigger intake payload',
    objective: 'Capture the inbound event that starts a path.',
    inputs: [
      { key: 'event', label: 'Event', required: true, defaultValue: 'manual_test' },
      { key: 'sourceSystem', label: 'Source system', required: true, defaultValue: 'Ascentra Builder' },
      { key: 'urgency', label: 'Urgency', required: false, defaultValue: 'normal' },
      { key: 'submittedBy', label: 'Submitted by', required: false, defaultValue: 'operator' },
    ],
  },
  integration: {
    label: 'Integration action payload',
    objective: 'Define cross-system sync instructions for integration atoms.',
    inputs: [
      { key: 'systemName', label: 'System name', required: true, defaultValue: 'Connected app' },
      { key: 'action', label: 'Action', required: true, defaultValue: 'sync_records' },
      { key: 'records', label: 'Records', required: false, defaultValue: 'Current flow context and outputs' },
      { key: 'fieldMap', label: 'Field map', required: false, defaultValue: 'Map status, owner, and outcome fields' },
    ],
  },
};

function getPayloadSchema(type, agentId, title) {
  if (agentId && AGENT_PAYLOAD_SCHEMAS[agentId]) {
    return AGENT_PAYLOAD_SCHEMAS[agentId];
  }

  if (type === 'trigger') return AGENT_PAYLOAD_SCHEMAS.trigger;
  if (type === 'integration') return AGENT_PAYLOAD_SCHEMAS.integration;

  const preset = getMakePreset(type, agentId, title);
  const presetKey = Object.entries(MAKE_WEBHOOK_PRESETS).find(([, value]) => value === preset)?.[0];
  if (presetKey && AGENT_PAYLOAD_SCHEMAS[presetKey]) {
    return AGENT_PAYLOAD_SCHEMAS[presetKey];
  }

  return AGENT_PAYLOAD_SCHEMAS.integration;
}

function buildPayloadSchema(type, agentId, title) {
  const schemaDef = getPayloadSchema(type, agentId, title);
  const properties = Object.fromEntries(
    (schemaDef?.inputs || []).map((input) => [input.key, { type: 'string', title: input.label }]),
  );
  return {
    type: 'object',
    title: schemaDef?.label || `${title} payload schema`,
    description: schemaDef?.objective || 'Payload schema for the selected Make step.',
    properties,
    required: (schemaDef?.inputs || []).filter((input) => input.required).map((input) => input.key),
  };
}

function buildPayloadTemplate({ type, title, agentId = null, flowName = '', flowSummary = '', planName = '', nodeId = '' }) {
  const schema = getPayloadSchema(type, agentId, title);
  const inputs = Object.fromEntries(
    (schema?.inputs || []).map((field) => [field.key, field.defaultValue]),
  );

  return {
    source: 'ascentra-builder',
    schema: agentId || type || 'integration',
    objective: schema?.objective || 'Deliver the requested automation step.',
    flow: {
      name: flowName || 'Unsaved automation',
      summary: flowSummary || '',
      plan: planName || '',
    },
    node: {
      id: nodeId || '',
      title,
      type,
      agent: agentId || null,
    },
    inputs,
  };
}

function getActiveNodeSchema(node) {
  if (!node) return null;
  return buildPayloadSchema(node.type, node.agentId || null, node.title);
}

function resetNodePayloadToSchema(node, flowName = '', flowSummary = '', planName = '') {
  if (!node || node.type === 'logic') return null;

  const makeConfig = node.makeConfig || createMakeConfig(node.type, node.title, node.agentId || null);

  return {
    ...makeConfig,
    payload: JSON.stringify(
      buildPayloadTemplate({
        type: node.type,
        title: node.title,
        agentId: node.agentId || null,
        flowName,
        flowSummary,
        planName,
        nodeId: node.id,
      }),
      null,
      2,
    ),
    schema: JSON.stringify(getActiveNodeSchema(node), null, 2),
  };
}

function getMakePreset(type, agentId, title) {
  if (agentId && MAKE_WEBHOOK_PRESETS[agentId]) {
    return MAKE_WEBHOOK_PRESETS[agentId];
  }

  if (type === 'trigger') return MAKE_WEBHOOK_PRESETS.trigger;
  if (type === 'integration') return MAKE_WEBHOOK_PRESETS.integration;

  const lower = (title || '').toLowerCase();
  const titleMatch = Object.entries(MAKE_WEBHOOK_PRESETS).find(([key]) => key !== 'trigger' && key !== 'integration' && lower.includes(key));
  return titleMatch?.[1] || null;
}

function createMakeConfig(type, title, agentId = null) {
  const preset = getMakePreset(type, agentId, title);
  const payloadTemplate = buildPayloadTemplate({
    type,
    title,
    agentId,
    flowName: '',
    flowSummary: '',
    planName: '',
    nodeId: '',
  });
  const payloadSchema = buildPayloadSchema(type, agentId, title);

  return {
    enabled: Boolean(preset?.webhookUrl),
    scenarioName: preset?.scenarioName || `${title} scenario`,
    webhookUrl: preset?.webhookUrl || '',
    method: 'POST',
    headers: JSON.stringify({}, null, 2),
    payload: JSON.stringify(payloadTemplate, null, 2),
    schema: JSON.stringify(payloadSchema, null, 2),
    lastStatus: preset?.webhookUrl ? 'Ready' : 'Not connected',
    lastRunAt: '',
    lastResponse: '',
  };
}

function nodeSupportsMake(node) {
  return Boolean(node && (resolveBuilderKind(node) === 'make' || node.makeConfig?.enabled));
}

function defaultNativeConfig(item) {
  return getDefaultAtomConfig(item);
}

function nativeKindOf(node) {
  return resolveBuilderKind(node);
}

function RawJsonEditor({ initial, onChange, placeholder, rows = 3, compact = false }) {
  const [raw, setRaw] = useState(typeof initial === 'string' ? initial : JSON.stringify(initial ?? {}, null, 2));
  return (
    <textarea
      rows={rows}
      value={raw}
      onChange={(event) => {
        const text = event.target.value;
        setRaw(text);
        try {
          onChange(JSON.parse(text || '{}'));
        } catch {
          // not valid JSON yet, keep last parsed value
        }
      }}
      placeholder={placeholder}
      style={{
        width: '100%',
        boxSizing: 'border-box',
        resize: 'vertical',
        borderRadius: 14,
        border: `1px solid ${BUILDER_BORD}`,
        background: 'rgba(255,255,255,0.03)',
        color: '#fff',
        padding: '12px 13px',
        fontFamily: compact ? 'JetBrains Mono, monospace' : 'Manrope, sans-serif',
        fontSize: compact ? 11 : 13,
        lineHeight: 1.5,
        outline: 'none',
      }}
    />
  );
}

const BRANCH_OPERATORS = [
  ['equals', 'equals'],
  ['not_equals', 'not equals'],
  ['greater_than', 'greater than'],
  ['greater_than_or_equal', '>= '],
  ['less_than', 'less than'],
  ['less_than_or_equal', '<= '],
  ['contains', 'contains'],
  ['not_contains', 'not contains'],
  ['exists', 'exists'],
  ['not_exists', 'not exists'],
  ['empty', 'is empty'],
  ['not_empty', 'is not empty'],
  ['starts_with', 'starts with'],
  ['ends_with', 'ends with'],
  ['matches', 'matches'],
];

function inferNativeConfig(row) {
  const item = {
    id: String(row.id || '').split('-')[0],
    type: row.type,
    label: row.title,
  };
  if (row.type === 'logic') {
    const id = String(row.id || '') + String(row.title || '').toLowerCase();
    const kind = /branch|decision|tier/.test(id) ? 'branch'
      : /approval/.test(id) ? 'approval'
        : /delay/.test(id) ? 'delay'
          : 'transform';
    const base = defaultNativeConfig({ id: kind, type: 'logic', label: kind });
    return { ...base };
  }
  if (row.type === 'integration') {
    const id = String(row.id || '').toLowerCase() + String(row.title || '').toLowerCase();
    const kind = /http/.test(id) ? 'http' : /make/.test(id) || /webhook/.test(id) ? 'make' : String(row.id || '').split('-')[0] || 'http';
    return { ...defaultNativeConfig({ id: kind, type: 'integration', label: '' }) };
  }
  return defaultNativeConfig({ id: row.id, type: row.type, label: row.title });
}

function getExecutionOrder(nodes, edges) {
  const nodeMap = new Map(nodes.map((node) => [node.id, node]));
  const incoming = new Map(nodes.map((node) => [node.id, 0]));
  const outgoing = new Map(nodes.map((node) => [node.id, []]));

  edges.forEach((edge) => {
    if (!nodeMap.has(edge.from) || !nodeMap.has(edge.to)) return;
    incoming.set(edge.to, (incoming.get(edge.to) || 0) + 1);
    outgoing.get(edge.from).push(edge.to);
  });

  const queue = nodes
    .filter((node) => (incoming.get(node.id) || 0) === 0)
    .sort((a, b) => a.column - b.column || a.lane - b.lane)
    .map((node) => node.id);

  const ordered = [];

  while (queue.length) {
    const nextId = queue.shift();
    ordered.push(nextId);
    (outgoing.get(nextId) || []).forEach((targetId) => {
      incoming.set(targetId, (incoming.get(targetId) || 0) - 1);
      if ((incoming.get(targetId) || 0) === 0) {
        queue.push(targetId);
      }
    });
  }

  return ordered
    .map((id) => nodeMap.get(id))
    .filter(Boolean);
}

function createTemplates(agents) {
  const byId = Object.fromEntries(agents.map((agent) => [agent.id, agent]));

  const agentAtom = (id, title, subtitle, lane, column) => ({
    id: `${id}-${lane}-${column}`,
    type: 'agent',
    title,
    subtitle,
    lane,
    column,
    color: byId[id].color,
    Icon: byId[id].Icon,
    agentId: id,
    mode: 'Agent run',
    approval: lane === 0 ? 'Required' : 'Optional',
    retries: lane === 0 ? '2' : '1',
    notes: `Use ${byId[id].name} to handle ${subtitle.toLowerCase()}.`,
    makeConfig: createMakeConfig('agent', title, id),
  });

  const starterNodes = [
    { id: 'pulse-intake', type: 'webhook', title: 'Webhook Intake', subtitle: 'External event', lane: -1, column: 0, color: '#ec4899', Icon: Webhook, mode: 'Trigger', approval: 'None', retries: '0', notes: 'Preview path incoming from a signed webhook event.', makeConfig: createMakeConfig('trigger', 'Webhook Intake', 'pulse') },
    agentAtom('pulse', 'Pulse Automation', 'Workflow handoff', -1, 1),
    { id: 'forge-intake', type: 'trigger', title: 'Forge Intake', subtitle: 'Manual launch', lane: 1, column: 0, color: '#ec4899', Icon: CircleDot, mode: 'Trigger', approval: 'None', retries: '0', notes: 'Preview path kicked off by the operator.', makeConfig: createMakeConfig('trigger', 'Forge Intake', 'forge') },
    agentAtom('forge', 'Forge Build Generator', 'App builder atom', 1, 1),
    { id: 'decision-router', type: 'logic', title: 'Decision Router', subtitle: 'Condition split', lane: 0, column: 2, color: '#2563d4', Icon: GitBranch, mode: 'Logic', approval: 'Required', retries: '0', notes: 'Route into different atoms based on score, segment, or urgency.' },
    { id: 'http-sync', type: 'integration', title: 'HTTP Handoff', subtitle: 'Connected API action', lane: -1, column: 3, color: '#f97316', Icon: Rocket, mode: 'Action', approval: 'Optional', retries: '1', notes: 'Send enriched records to a configured API.', makeConfig: createMakeConfig('integration', 'HTTP Handoff', 'nexus'), config: { kind: 'http', url: '', method: 'POST', headers: {}, body: {} } },
    agentAtom('echo', 'Echo Follow-up', 'Campaign response', 1, 3),
  ];

  const starterEdges = [
    ['pulse-intake', 'pulse--1-1'],
    ['forge-intake', 'forge-1-1'],
    ['pulse--1-1', 'decision-router'],
    ['forge-1-1', 'decision-router'],
    ['decision-router', 'http-sync', 'true'],
    ['decision-router', 'echo-1-3', 'false'],
  ];

  const proNodes = [
    { id: 'pro-trigger', type: 'trigger', title: 'Manual Trigger', subtitle: 'Run on demand', lane: 0, column: 0, color: '#ec4899', Icon: CircleDot, mode: 'Trigger', approval: 'None', retries: '0', notes: 'Start this workflow from the Run button.', makeConfig: createMakeConfig('trigger', 'Manual Trigger', 'pulse'), config: { kind: 'manual' } },
    agentAtom('pulse', 'Pulse Recovery Loop', 'Automation sequence', 0, 1),
    { id: 'pro-http', type: 'integration', title: 'HTTP Request', subtitle: 'Send the next action', lane: 0, column: 2, color: '#f97316', Icon: Rocket, mode: 'Action', approval: 'Optional', retries: '1', notes: 'Send the AI result to a configured API.', makeConfig: createMakeConfig('integration', 'HTTP Request', 'nexus'), config: { kind: 'http', url: '', method: 'POST', headers: {}, body: { summary: '{{ previous.output.content }}' } } },
  ];

  const proEdges = [
    ['pro-trigger', 'pulse-0-1'],
    ['pulse-0-1', 'pro-http'],
  ];

  const enterpriseNodes = [
    { id: 'ent-trigger', type: 'webhook', title: 'Webhook Intake', subtitle: 'Qualified inbound event', lane: 0, column: 0, color: '#ec4899', Icon: Webhook, mode: 'Trigger', approval: 'None', retries: '0', notes: 'Listen for a signed inbound event.', makeConfig: createMakeConfig('trigger', 'Webhook Intake', 'nexus'), config: { kind: 'webhook' } },
    agentAtom('axiom', 'Axiom Qualification', 'Decision support atom', 0, 1),
    { id: 'ent-branch', type: 'logic', title: 'Tier Branch', subtitle: 'Segment enterprise vs SMB', lane: 0, column: 2, color: '#2563d4', Icon: GitBranch, mode: 'Logic', approval: 'Required', retries: '0', notes: 'Branch by company size, deal value, or health score.' },
    agentAtom('veyra', 'Veyra Creative Pack', 'Design response', -1, 3),
    agentAtom('forge', 'Forge Solution Draft', 'Technical proposal', 0, 3),
    agentAtom('echo', 'Echo Sequence', 'Follow-up copy', 1, 3),
    { id: 'ent-docs-api', type: 'integration', title: 'Documentation API', subtitle: 'Knowledge handoff', lane: -1, column: 4, color: '#f97316', Icon: Rocket, mode: 'Action', approval: 'Optional', retries: '1', notes: 'Document the creative path through a configured API.', makeConfig: createMakeConfig('integration', 'Documentation API', 'nexus'), config: { kind: 'http', url: '', method: 'POST', headers: {}, body: {} } },
    { id: 'ent-billing-api', type: 'integration', title: 'Billing API', subtitle: 'Commercial handoff', lane: 0, column: 4, color: '#f97316', Icon: Rocket, mode: 'Action', approval: 'Optional', retries: '1', notes: 'Send billing readiness to a configured API.', makeConfig: createMakeConfig('integration', 'Billing API', 'nexus'), config: { kind: 'http', url: '', method: 'POST', headers: {}, body: {} } },
    agentAtom('pulse', 'Pulse Follow-through', 'Automation wrap-up', 1, 4),
  ];

  const enterpriseEdges = [
    ['ent-trigger', 'axiom-0-1'],
    ['axiom-0-1', 'ent-branch'],
    ['ent-branch', 'veyra--1-3', 'true'],
    ['ent-branch', 'forge-0-3', 'false'],
    ['ent-branch', 'echo-1-3', 'false'],
    ['veyra--1-3', 'ent-docs-api'],
    ['forge-0-3', 'ent-billing-api'],
    ['echo-1-3', 'pulse-1-4'],
  ];

  return {
    Starter: {
      name: 'Cross-team launch preview',
      summary: 'A read-only preview showing how multiple agents can merge into a single automation fabric.',
      nodes: starterNodes,
      edges: starterEdges.map(([from, to, label]) => ({ from, to, ...(label ? { label } : {}) })),
      selectedNodeId: 'decision-router',
    },
    Pro: {
      name: 'Revenue recovery loop',
      summary: 'A compact paid automation with up to 3 live atoms.',
      nodes: proNodes,
      edges: proEdges.map(([from, to, label]) => ({ from, to, ...(label ? { label } : {}) })),
      selectedNodeId: 'pulse-0-1',
    },
    Enterprise: {
      name: 'Multi-agent GTM path',
      summary: 'Branch creative, proposal, and outreach work across a larger automation graph.',
      nodes: enterpriseNodes,
      edges: enterpriseEdges.map(([from, to, label]) => ({ from, to, ...(label ? { label } : {}) })),
      selectedNodeId: 'ent-branch',
    },
  };
}

function buildAgentLibrary(agents) {
  return buildAgentAtoms(agents);
}

function buildAtomFromLibrary(item, lane, column) {
  return {
    id: `${item.id}-${lane}-${column}-${Math.random().toString(36).slice(2, 7)}`,
    type: item.type,
    title: item.label,
    subtitle: item.subtitle,
    lane,
    column,
    color: item.color,
    Icon: item.Icon,
    agentId: item.agentId,
    mode: item.type === 'logic' ? 'Logic' : item.type === 'integration' ? 'Integration' : 'Agent run',
    approval: item.type === 'logic' ? 'Required' : 'Optional',
    retries: item.type === 'trigger' ? '0' : '1',
    notes: `Customize ${item.label} inside the inspector.`,
    makeConfig: item.type === 'logic' ? null : createMakeConfig(item.type, item.label, item.agentId || null),
    kind: getNodeDefinition(item).kind,
    nativeKind: getNodeDefinition(item).nativeKind,
    definitionVersion: getNodeDefinition(item).version,
    config: defaultNativeConfig(item),
  };
}

function getPosition(node) {
  if (typeof node.x === 'number' && typeof node.y === 'number') {
    return { x: node.x, y: node.y };
  }
  return {
    x: 170 + node.column * 220,
    y: 300 + node.lane * 132,
  };
}

function cloneGraphNodes(nodes) {
  return nodes.map((node) => ({
    ...node,
    config: node.config ? structuredClone(node.config) : node.config,
    makeConfig: node.makeConfig ? structuredClone(node.makeConfig) : node.makeConfig,
  }));
}

function getPortPosition(node, side = 'right') {
  const pos = getPosition(node);
  return {
    x: pos.x + (side === 'right' ? 92 : -92),
    y: pos.y,
  };
}

function findOpenSlot(nodes, desiredLane, desiredColumn) {
  let lane = desiredLane;
  let column = desiredColumn;
  const laneCycle = [0, -1, 1, -2, 2];
  let laneIndex = laneCycle.indexOf(desiredLane);
  if (laneIndex === -1) laneIndex = 0;

  while (nodes.some((node) => node.lane === lane && node.column === column)) {
    laneIndex = (laneIndex + 1) % laneCycle.length;
    lane = laneCycle[laneIndex];
    if (laneIndex === 0) column += 1;
  }

  return { lane, column };
}

function getAgentVisual(agentMap, row) {
  const agent = agentMap.get(row.agent_id);
  if (agent) {
    return {
      color: row.color || agent.color,
      Icon: agent.Icon,
      agentId: agent.id,
    };
  }
  return {
    color: row.color || '#8b5cf6',
    Icon: Bot,
    agentId: row.agent_id || null,
  };
}

function getIntegrationVisual(row) {
  const match = INTEGRATIONS.find((item) => item.id === row.agent_id || item.label === row.title || row.title?.toLowerCase().includes(item.label.toLowerCase()));
  return {
    color: row.color || match?.color || '#2563d4',
    Icon: match?.Icon || Database,
    agentId: row.agent_id || match?.id || null,
  };
}

function getLogicVisual(row) {
  const match =
    LOGIC_BLOCKS.find((item) => item.label === row.title || row.title?.toLowerCase().includes(item.label.toLowerCase())) ||
    LOGIC_BLOCKS[0];
  return {
    color: row.color || match.color,
    Icon: match.Icon,
    agentId: null,
  };
}

function getTriggerVisual(row) {
  const manual = /manual/i.test(row.subtitle || '') || /manual/i.test(row.title || '');
  return {
    color: row.color || '#ec4899',
    Icon: manual ? CircleDot : Webhook,
    agentId: null,
  };
}

function ConnectionCreate({ onCreated, accent, border, organizationId, credentials = [] }) {
  const [name, setName] = useState('');
  const [provider, setProvider] = useState('http');
  const [credentialId, setCredentialId] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      await createConnection({ organizationId, name: name.trim(), provider, credentialId: credentialId || null });
      onCreated(`Connection "${name.trim()}" created.`);
      setName('');
    } catch (err) {
      onCreated(err.message || 'Failed to create connection.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit} style={{ display: 'grid', gap: 6, padding: 10, borderRadius: 12, background: 'rgba(255,255,255,0.02)', border: `1px solid ${border}` }}>
      <div style={{ color: '#fff', fontFamily: 'Bricolage Grotesque, sans-serif', fontSize: 12, fontWeight: 700 }}>Add connection</div>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="connection name" style={{ padding: '7px 9px', borderRadius: 9, border: `1px solid ${border}`, background: 'rgba(0,0,0,0.3)', color: '#fff', fontFamily: 'Manrope, sans-serif', fontSize: 12 }} />
      <select value={provider} onChange={(e) => setProvider(e.target.value)} style={{ padding: '7px 9px', borderRadius: 9, border: `1px solid ${border}`, background: 'rgba(0,0,0,0.3)', color: '#fff', fontFamily: 'Manrope, sans-serif', fontSize: 12 }}>
        {['http', 'generic', 'stripe', 'resend', 'slack', 'notion', 'openai', 'anthropic', 'gemini'].map((p) => <option key={p} value={p}>{p}</option>)}
      </select>
      <select value={credentialId} onChange={(e) => setCredentialId(e.target.value)} style={{ padding: '7px 9px', borderRadius: 9, border: `1px solid ${border}`, background: 'rgba(0,0,0,0.3)', color: '#fff', fontFamily: 'Manrope, sans-serif', fontSize: 12 }}>
        <option value="">No credential</option>
        {credentials.filter((item) => item.provider === provider || provider === 'generic' || provider === 'http').map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
      </select>
      <button type="submit" disabled={busy || !name.trim()} style={{ padding: '7px 9px', borderRadius: 9, border: 'none', background: accent, color: '#fff', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, fontSize: 11, cursor: 'pointer' }}>{busy ? 'Creating…' : 'Create'}</button>
    </form>
  );
}

function CredentialCreate({ onCreated, accent, border, organizationId }) {
  const [name, setName] = useState('');
  const [secret, setSecret] = useState('');
  const [provider, setProvider] = useState('openai');
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    try {
      await createCredential({ organizationId, name: name.trim(), provider, secret: { apiKey: secret.trim() } });
      onCreated(`Credential "${name.trim()}" stored (encrypted).`);
      setName('');
      setSecret('');
    } catch (err) {
      onCreated(err.message || 'Failed to store credential.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <form onSubmit={submit} style={{ display: 'grid', gap: 6, padding: 10, borderRadius: 12, background: 'rgba(255,255,255,0.02)', border: `1px solid ${border}` }}>
      <div style={{ color: '#fff', fontFamily: 'Bricolage Grotesque, sans-serif', fontSize: 12, fontWeight: 700 }}>Add credential</div>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="credential name" style={{ padding: '7px 9px', borderRadius: 9, border: `1px solid ${border}`, background: 'rgba(0,0,0,0.3)', color: '#fff', fontFamily: 'Manrope, sans-serif', fontSize: 12 }} />
      <select value={provider} onChange={(e) => setProvider(e.target.value)} style={{ padding: '7px 9px', borderRadius: 9, border: `1px solid ${border}`, background: 'rgba(0,0,0,0.3)', color: '#fff', fontFamily: 'Manrope, sans-serif', fontSize: 12 }}>
        {['openai', 'anthropic', 'gemini', 'http', 'generic', 'stripe', 'slack', 'notion'].map((item) => <option key={item} value={item}>{item}</option>)}
      </select>
      <input type="password" autoComplete="new-password" value={secret} onChange={(e) => setSecret(e.target.value)} placeholder="API key or access token" style={{ padding: '7px 9px', borderRadius: 9, border: `1px solid ${border}`, background: 'rgba(0,0,0,0.3)', color: '#fff', fontFamily: 'Manrope, sans-serif', fontSize: 12 }} />
      <button type="submit" disabled={busy || !name.trim() || !secret.trim()} style={{ padding: '7px 9px', borderRadius: 9, border: 'none', background: accent, color: '#fff', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, fontSize: 11, cursor: 'pointer' }}>{busy ? 'Storing…' : 'Store securely'}</button>
    </form>
  );
}

export default function AutomationAtomBuilder({
  agents,
  plans,
  onBack,
  initialPlanName = 'Starter',
  accent = '#00C9A7',
  embedded = false,
  sectionId = 'builder-hub',
  adminMode = false,
  fullScreen = false,
  contextLabel = 'Main hub',
  workspaceContext = null,
}) {
  const templates = useMemo(() => createTemplates(agents), [agents]);
  const libraryAgents = useMemo(() => buildAgentLibrary(agents), [agents]);
  const agentMap = useMemo(() => new Map(agents.map((agent) => [agent.id, agent])), [agents]);
  const canvasRef = useRef(null);
  const graphHistoryRef = useRef({ past: [], future: [] });
  const [activePlanName, setActivePlanName] = useState(templates[initialPlanName] ? initialPlanName : 'Starter');
  const [flowName, setFlowName] = useState(templates[initialPlanName]?.name || templates.Starter.name);
  const [flowSummary, setFlowSummary] = useState(templates[initialPlanName]?.summary || templates.Starter.summary);
  const [nodes, setNodes] = useState(templates[initialPlanName]?.nodes || templates.Starter.nodes);
  const [edges, setEdges] = useState(templates[initialPlanName]?.edges || templates.Starter.edges);
  const [selectedNodeId, setSelectedNodeId] = useState(templates[initialPlanName]?.selectedNodeId || templates.Starter.selectedNodeId);
  const [notice, setNotice] = useState(PLAN_RULES[initialPlanName]?.note || PLAN_RULES.Starter.note);
  const [zoom, setZoom] = useState(100);
  const [libraryQuery, setLibraryQuery] = useState('');
  const [activePalette, setActivePalette] = useState('all');
  const [inspectorTab, setInspectorTab] = useState('settings');
  const [runState, setRunState] = useState('Draft');
  const [simulationResult, setSimulationResult] = useState(null);
  const [workflowVersion, setWorkflowVersion] = useState(null);
  const [canvasMode, setCanvasMode] = useState('build');
  const [dragState, setDragState] = useState(null);
  const [connectState, setConnectState] = useState(null);
  const [pointerPos, setPointerPos] = useState(null);
  const [flowId, setFlowId] = useState(null);
  const [saveBusy, setSaveBusy] = useState(false);
  const [runBusy, setRunBusy] = useState(false);
  const [runLog, setRunLog] = useState([]);
  const [savedFlows, setSavedFlows] = useState([]);
  const [flowsBusy, setFlowsBusy] = useState(false);
  const [backendRuns, setBackendRuns] = useState([]);
  const [runsBusy, setRunsBusy] = useState(false);
  const [activeRunId, setActiveRunId] = useState(null);
  const [activeRunKind, setActiveRunKind] = useState('legacy');
  const [executionStatus, setExecutionStatus] = useState(null);
  const [nativeRuns, setNativeRuns] = useState({});
  const [manualPayload, setManualPayload] = useState('{\n  "body": {\n    "amount": 300,\n    "email": "ops@ascentra.ai"\n  }\n}');
  const [backendStatus, setBackendStatus] = useState(null);
  const [backendStatusBusy, setBackendStatusBusy] = useState(false);
  const [connections, setConnections] = useState(null);
  const [connBusy, setConnBusy] = useState(false);
  const [approvals, setApprovals] = useState([]);
  const [approvalsBusy, setApprovalsBusy] = useState(false);
  const [schedules, setSchedules] = useState([]);
  const [webhooks, setWebhooks] = useState([]);
  const [variables, setVariables] = useState([]);
  const [triggersBusy, setTriggersBusy] = useState(false);
  const [scheduleForm, setScheduleForm] = useState(null);
  const [webhookForm, setWebhookForm] = useState(null);
  const [variableForm, setVariableForm] = useState(null);
  const [historyRevision, setHistoryRevision] = useState(0);
  const [validationOpen, setValidationOpen] = useState(false);
  const [runConsoleOpen, setRunConsoleOpen] = useState(false);
  const [managementOpen, setManagementOpen] = useState(false);
  const [quickAddNodeId, setQuickAddNodeId] = useState(null);
  const [quickAddQuery, setQuickAddQuery] = useState('');
  const [canvasPan, setCanvasPan] = useState({ x: 0, y: 0 });
  const [touchAtomDrag, setTouchAtomDrag] = useState(null);
  const [canvasGesture, setCanvasGesture] = useState(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);
  const clipboardRef = useRef(null);
  const quickAddRef = useRef(null);
  const canvasGestureRef = useRef(null);
  const recentCanvasPanRef = useRef(false);
  const canvasPointersRef = useRef(new Map());
  const pinchRef = useRef(null);
  const recentTouchDropRef = useRef(false);

  const planRule = PLAN_RULES[activePlanName];
  const selectedNode = nodes.find((node) => node.id === selectedNodeId) || null;
  const selectedNodeDefinition = selectedNode ? getNodeDefinition(selectedNode) : null;
  const selectedNodeInputs = selectedNode ? getPorts(selectedNode, 'input') : [];
  const selectedNodeOutputs = selectedNode ? getPorts(selectedNode, 'output') : [];
  const selectedNodeConfigFields = selectedNode ? getConfigFields(selectedNode) : [];
  const selectedNodeSchema = getActiveNodeSchema(selectedNode);
  const liveAtomCount = nodes.length;
  const zoomScale = zoom / 100;
  const organizationId = workspaceContext?.organizationId || null;
  const currentUserId = workspaceContext?.userId || null;
  const canUseWorkspaceBackend = Boolean(hasSupabaseConfig && organizationId && currentUserId);
  const backendLabel = !hasSupabaseConfig
    ? adminMode ? 'Local QA preview' : 'Backend not connected'
    : !canUseWorkspaceBackend
      ? 'Preview mode · sign in to save'
    : backendStatus?.ok
      ? 'Frontend and backend linked'
      : backendStatusBusy
        ? 'Checking backend'
        : 'Supabase configured';
  const validation = useMemo(() => validateWorkflow(nodes, edges), [nodes, edges]);
  const upstreamNodes = useMemo(() => selectedNode ? reachableUpstreamNodes(nodes, edges, selectedNode.id) : [], [nodes, edges, selectedNodeId]);
  const paletteGroups = useMemo(() => buildPaletteGroups(agents), [agents]);
  const paletteItems = useMemo(() => paletteGroups.flatMap((group) => group.items), [paletteGroups]);
  const canUndo = graphHistoryRef.current.past.length > 0;
  const canRedo = graphHistoryRef.current.future.length > 0;

  const graphSnapshot = () => ({ nodes: cloneGraphNodes(nodes), edges: edges.map((edge) => ({ ...edge })), selectedNodeId });

  const recordGraphSnapshot = () => {
    graphHistoryRef.current.past.push(graphSnapshot());
    graphHistoryRef.current.past = graphHistoryRef.current.past.slice(-60);
    graphHistoryRef.current.future = [];
    setHistoryRevision((value) => value + 1);
  };

  const resetGraphHistory = () => {
    graphHistoryRef.current = { past: [], future: [] };
    setHistoryRevision((value) => value + 1);
  };

  const restoreGraphSnapshot = (snapshot) => {
    setNodes(cloneGraphNodes(snapshot.nodes));
    setEdges(snapshot.edges.map((edge) => ({ ...edge })));
    setSelectedNodeId(snapshot.selectedNodeId || snapshot.nodes[0]?.id || null);
    setRunState('Edited');
  };

  const undoGraph = () => {
    const snapshot = graphHistoryRef.current.past.pop();
    if (!snapshot) {
      setNotice('Nothing to undo.');
      return;
    }
    graphHistoryRef.current.future.push(graphSnapshot());
    restoreGraphSnapshot(snapshot);
    setNotice('Last canvas change undone.');
    setHistoryRevision((value) => value + 1);
  };

  const redoGraph = () => {
    const snapshot = graphHistoryRef.current.future.pop();
    if (!snapshot) {
      setNotice('Nothing to redo.');
      return;
    }
    graphHistoryRef.current.past.push(graphSnapshot());
    restoreGraphSnapshot(snapshot);
    setNotice('Canvas change restored.');
    setHistoryRevision((value) => value + 1);
  };

  const runValidation = ({ focus = true } = {}) => {
    setValidationOpen(true);
    if (validation.valid) {
      setNotice(validation.warnings ? `Workflow is ready with ${validation.warnings} warning${validation.warnings === 1 ? '' : 's'}.` : 'Workflow is ready to run.');
      return true;
    }
    const first = validation.issues.find((entry) => entry.severity === 'error');
    if (focus && first?.nodeId) {
      setSelectedNodeId(first.nodeId);
      setInspectorTab('settings');
    }
    setNotice(first?.message || 'Fix the workflow issues before running.');
    return false;
  };

  const runLocalSimulation = () => {
    let triggerPayload = {};
    try {
      triggerPayload = manualPayload.trim() ? JSON.parse(manualPayload) : {};
    } catch (error) {
      setSimulationResult({ ok: false, mode: 'local', trace: [], boundaries: [], validation: { issues: [{ severity: 'error', message: `Test payload is not valid JSON: ${error.message}` }] } });
      setRunState('Needs fixes');
      setNotice('Fix the local test payload before simulating.');
      return;
    }

    const result = simulateWorkflow({ nodes, edges }, { triggerPayload });
    setSimulationResult(result);
    setRunConsoleOpen(true);
    setRunState(result.ok ? 'Simulated' : 'Needs fixes');
    const boundaryCount = result.boundaries.length;
    if (!result.ok) {
      setNotice(result.validation.issues[0]?.message || 'Fix the workflow before simulating.');
      return;
    }
    setNotice(`Local simulation evaluated ${result.trace.length} node${result.trace.length === 1 ? '' : 's'}${boundaryCount ? ` and stopped at ${boundaryCount} external boundar${boundaryCount === 1 ? 'y' : 'ies'}` : ''}.`);
  };

  const fitWorkflow = () => {
    if (!nodes.length) {
      setZoom(100);
      return;
    }
    const positions = nodes.map(getPosition);
    const width = Math.max(...positions.map((point) => point.x)) - Math.min(...positions.map((point) => point.x)) + 240;
    const height = Math.max(...positions.map((point) => point.y)) - Math.min(...positions.map((point) => point.y)) + 180;
    const nextZoom = Math.round(Math.max(70, Math.min(120, Math.min(1120 / width, 610 / height) * 100)) / 10) * 10;
    setZoom(nextZoom);
    setNotice(`Workflow fit to ${nextZoom}%.`);
  };

  const hydrateMakeConfig = (type, title, config) => {
    const presetAgentId = config?.agentId || null;
    if (type === 'logic') return null;
    return {
      ...createMakeConfig(type, title, presetAgentId),
      ...(config || {}),
      headers:
        typeof config?.headers === 'string'
          ? config.headers
          : JSON.stringify(config?.headers || {}, null, 2),
      payload:
        typeof config?.payload === 'string'
          ? config.payload
          : JSON.stringify(config?.payload || JSON.parse(createMakeConfig(type, title, presetAgentId).payload), null, 2),
      schema:
        typeof config?.schema === 'string'
          ? config.schema
          : JSON.stringify(config?.schema || buildPayloadSchema(type, presetAgentId, title), null, 2),
    };
  };

  const resetSelectedNodePayloadTemplate = () => {
    if (!selectedNode || !nodeSupportsMake(selectedNode)) return;

    const nextMakeConfig = resetNodePayloadToSchema(selectedNode, flowName, flowSummary, activePlanName);
    if (!nextMakeConfig) return;

    setNodes((current) =>
      current.map((node) =>
        node.id === selectedNode.id
          ? {
              ...node,
              makeConfig: nextMakeConfig,
            }
          : node,
      ),
    );

    setNotice(`Reset ${selectedNode.title} payload template.`);
  };

  const restoreNode = (row) => {
    const visual =
      row.type === 'agent' || row.type === 'ai'
        ? getAgentVisual(agentMap, row)
        : row.type === 'integration'
          ? getIntegrationVisual(row)
          : row.type === 'logic'
            ? getLogicVisual(row)
            : getTriggerVisual(row);

    return {
      id: row.id,
      title: row.title,
      subtitle: row.subtitle || '',
      type: row.type,
      lane: row.lane ?? 0,
      column: row.column_index ?? 0,
      x: row.x ?? undefined,
      y: row.y ?? undefined,
      color: visual.color,
      Icon: visual.Icon,
      agentId: visual.agentId,
      mode: row.mode || (row.type === 'logic' ? 'Logic' : row.type === 'integration' ? 'Integration' : 'Agent run'),
      approval: row.approval || (row.type === 'logic' ? 'Required' : 'Optional'),
      retries: `${row.retries ?? 0}`,
      notes: row.notes || '',
      makeConfig: hydrateMakeConfig(row.type, row.title, row.make_config),
      config: row.config ?? inferNativeConfig(row),
    };
  };

  const applyPresetToNode = (node) => {
    const withConfig = node.config ? node : { ...node, config: inferNativeConfig(node) };
    if (!nodeSupportsMake(node)) return withConfig;
    if (withConfig.makeConfig?.webhookUrl) return withConfig;
    return {
      ...withConfig,
      makeConfig: {
        ...createMakeConfig(node.type, node.title, node.agentId || null),
        ...(withConfig.makeConfig || {}),
      },
    };
  };

  const createFreshFlow = (planName = 'Pro') => {
    const template = templates[planName] || templates.Pro;
    setActivePlanName(planName);
    setNodes(template.nodes.map(applyPresetToNode));
    setEdges(template.edges);
    setSelectedNodeId(template.selectedNodeId);
    setFlowName(template.name);
    setFlowSummary(template.summary);
    setNotice(`New ${planName} automation draft started.`);
    setRunState(planName === 'Starter' ? 'Preview' : 'Draft');
    setSimulationResult(null);
    setWorkflowVersion(null);
    setCanvasMode('build');
    setDragState(null);
    setConnectState(null);
    setPointerPos(null);
    setFlowId(null);
    setActiveRunId(null);
    setActiveRunKind('legacy');
    setExecutionStatus(null);
    setNativeRuns({});
    setRunLog([]);
    setBackendRuns([]);
    setValidationOpen(false);
    setRunConsoleOpen(false);
    setQuickAddNodeId(null);
    setQuickAddQuery('');
    setCanvasPan({ x: 0, y: 0 });
    setTouchAtomDrag(null);
    setCanvasGesture(null);
    resetGraphHistory();
  };

  const filteredPaletteGroups = paletteGroups
    .map((group) => ({
      ...group,
      items: group.items.filter((item) => {
        const matchesTab = activePalette === 'all' || activePalette === group.id;
        const matchesQuery =
          libraryQuery.trim() === '' ||
          `${item.label} ${item.subtitle}`.toLowerCase().includes(libraryQuery.trim().toLowerCase());
        return matchesTab && matchesQuery;
      }),
    }))
    .filter((group) => group.items.length > 0);

  const incomingCount = selectedNode ? edges.filter((edge) => edge.to === selectedNode.id).length : 0;
  const outgoingCount = selectedNode ? edges.filter((edge) => edge.from === selectedNode.id).length : 0;

  const toCanvasPoint = (clientX, clientY) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0 || rect.height === 0) return null;
    return {
      x: Math.max(52, Math.min(1228, ((clientX - rect.left) / rect.width) * 1280 - canvasPan.x / zoomScale)),
      y: Math.max(72, Math.min(708, ((clientY - rect.top) / rect.height) * 760 - canvasPan.y / zoomScale)),
    };
  };

  const switchPlan = (nextPlan) => {
    createFreshFlow(nextPlan);
    setNotice(PLAN_RULES[nextPlan].note);
  };

  const appendAtom = (item, branch = false, options = {}) => {
    if (!planRule.editable) {
      setNotice('Atom Builder is included with Pro and Enterprise. Starter does not unlock live automation drafting.');
      return;
    }

    if (liveAtomCount >= planRule.atoms) {
      setNotice(`${activePlanName} is capped at ${planRule.atoms} live atoms. Upgrade to add more nodes and branches.`);
      return;
    }

    const source = nodes.find((node) => node.id === options.sourceId) || selectedNode || null;
    const desiredLane = branch ? (source?.lane === 0 ? -1 : 0) : (source?.lane ?? 0);
    const desiredColumn = (source?.column ?? -1) + 1;
    const slot = findOpenSlot(nodes, desiredLane, desiredColumn);
    const slotPos = getPosition({ lane: slot.lane, column: slot.column });
    const newAtom = {
      ...buildAtomFromLibrary(item, slot.lane, slot.column),
      x: options.point?.x ?? slotPos.x,
      y: options.point?.y ?? slotPos.y,
    };

    recordGraphSnapshot();
    setNodes((current) => [...current, newAtom]);
    if (source && options.connect !== false) {
      const connection = buildConnection([...nodes, newAtom], edges, source.id, newAtom.id);
      if (connection.ok) setEdges((current) => [...current, connection.edge]);
      else setNotice(connection.message);
    }
    setSelectedNodeId(newAtom.id);
    setQuickAddNodeId(null);
    setQuickAddQuery('');
    setNotice(`${newAtom.title} added to the ${branch ? 'branch' : 'main'} path.`);
    setRunState('Edited');
  };

  const updateSelectedNode = (field, value) => {
    if (!selectedNode) return;
    if (!planRule.editable && activePlanName === 'Starter') {
      setNotice('Starter does not include Atom Builder editing. Switch to Pro or Enterprise to customize each atom.');
      return;
    }

    setNodes((current) =>
      current.map((node) =>
        node.id === selectedNode.id
          ? {
              ...node,
              [field]: value,
            }
          : node
      )
    );
    setRunState('Edited');
  };

  const updateSelectedNativeConfig = (patch) => {
    if (!selectedNode) return;
    if (!planRule.editable && activePlanName === 'Starter') {
      setNotice('Starter does not include Atom Builder editing. Switch to Pro or Enterprise to customize each atom.');
      return;
    }

    setNodes((current) =>
      current.map((node) =>
        node.id === selectedNode.id
          ? {
              ...node,
              config: {
                ...(node.config || {}),
                ...patch,
              },
            }
          : node
      )
    );
    setRunState('Edited');
  };

  const updateSelectedBranchGroup = (patch) => {
    if (!selectedNode) return;
    const current = {
      ...(selectedNode.config || {}),
      groups: [
        {
          ...((selectedNode.config?.groups || [])[0] || {}),
          ...patch,
        },
      ],
    };
    setNodes((nodesList) =>
      nodesList.map((node) =>
        node.id === selectedNode.id
          ? {
              ...node,
              config: current,
            }
          : node
      )
    );
    setRunState('Edited');
  };

  const updateSelectedBranchCondition = (index, patch) => {
    if (!selectedNode) return;
    const group = (selectedNode.config?.groups || [])[0] || { groupOperator: 'and', conditions: [] };
    const conditions = (group.conditions || []).map((cond, idx) => (idx === index ? { ...cond, ...patch } : cond));
    const config = {
      ...(selectedNode.config || {}),
      groups: [{ ...group, conditions }],
    };
    setNodes((nodesList) =>
      nodesList.map((node) =>
        node.id === selectedNode.id
          ? {
              ...node,
              config,
            }
          : node
      )
    );
    setRunState('Edited');
  };

  const updateSelectedMapping = (key, value) => {
    if (!selectedNode) return;
    const mapping = { ...((selectedNode.config?.mapping || {})) };
    if (key) mapping[key] = value;
    const config = { ...(selectedNode.config || {}), mapping };
    setNodes((nodesList) =>
      nodesList.map((node) =>
        node.id === selectedNode.id
          ? {
              ...node,
              config,
            }
          : node
      )
    );
    setRunState('Edited');
  };

  const updateSelectedMakeConfig = (field, value) => {
    if (!selectedNode || !nodeSupportsMake(selectedNode)) return;
    if (!planRule.editable && activePlanName === 'Starter') {
      setNotice('Starter does not include live Atom Builder connections. Switch to Pro or Enterprise to connect Make scenarios.');
      return;
    }

    setNodes((current) =>
      current.map((node) =>
        node.id === selectedNode.id
          ? {
              ...node,
              makeConfig: {
                ...node.makeConfig,
                [field]: value,
              },
            }
          : node
      )
    );
    setRunState('Edited');
  };

  const refreshSavedFlows = async () => {
    if (!canUseWorkspaceBackend) {
      setSavedFlows([]);
      return;
    }
    setFlowsBusy(true);
    try {
      const flows = await listAutomationFlows({ organizationId });
      setSavedFlows(flows);
    } catch (error) {
      setNotice(error.message || 'Failed to load saved automations.');
    } finally {
      setFlowsBusy(false);
    }
  };

  const refreshRuns = async (targetFlowId = flowId) => {
    if (!canUseWorkspaceBackend || !targetFlowId) {
      setBackendRuns([]);
      return;
    }
    setRunsBusy(true);
    try {
      let runs = [];
      try {
        const native = await listNativeExecutions(targetFlowId, { organizationId });
        runs = native.map((run) => ({ ...run, flow_name: flowName, native: true }));
      } catch (error) {
        const legacy = await listAutomationRuns(targetFlowId, { organizationId });
        runs = legacy.map((run) => ({ ...run, native: false }));
      }
      setBackendRuns(runs);
    } catch (error) {
      setNotice(error.message || 'Failed to load automation run history.');
    } finally {
      setRunsBusy(false);
    }
  };

  const refreshConnections = async () => {
    if (!canUseWorkspaceBackend) {
      setConnections(null);
      return;
    }
    setConnBusy(true);
    try {
      const data = await listConnectionsAndCredentials();
      setConnections(data);
    } catch (error) {
      setNotice(error.message || 'Failed to load connections.');
    } finally {
      setConnBusy(false);
    }
  };

  const refreshApprovals = async () => {
    if (!canUseWorkspaceBackend) {
      setApprovals([]);
      return;
    }
    setApprovalsBusy(true);
    try {
      const data = await listApprovals({ organizationId, status: 'pending' });
      setApprovals(data);
    } catch (error) {
      setApprovals([]);
    } finally {
      setApprovalsBusy(false);
    }
  };

  const handleDecideApproval = async (approvalId, action) => {
    if (!canUseWorkspaceBackend) return;
    try {
      await decideApproval({ approvalId, action });
      setNotice(`Approval ${action === 'approve' ? 'approved' : 'rejected'}.`);
      refreshApprovals();
    } catch (error) {
      setNotice(error.message || 'Failed to update approval.');
    }
  };

  const refreshTriggers = async () => {
    if (!canUseWorkspaceBackend) {
      setSchedules([]);
      setWebhooks([]);
      setVariables([]);
      setTriggersBusy(false);
      return;
    }
    setTriggersBusy(true);
    try {
      const [sch, hooks, vars] = await Promise.all([
        listSchedules({ organizationId, workflowId: flowId || undefined }),
        listWebhooks({ organizationId, workflowId: flowId || undefined }),
        listVariables({ organizationId }),
      ]);
      setSchedules(sch);
      setWebhooks(hooks);
      setVariables(vars);
    } catch (error) {
      setNotice(error.message || 'Failed to load triggers.');
    } finally {
      setTriggersBusy(false);
    }
  };

  const handleSaveSchedule = async () => {
    if (!canUseWorkspaceBackend || !scheduleForm) return;
    try {
      const row = {
        id: scheduleForm.id || undefined,
        organization_id: organizationId,
        workflow_id: flowId,
        name: scheduleForm.name || '',
        trigger_type: scheduleForm.trigger_type || 'interval',
        interval_seconds: scheduleForm.trigger_type === 'interval' ? Number(scheduleForm.interval_seconds) || 3600 : null,
        cron_expr: scheduleForm.trigger_type === 'cron' ? scheduleForm.cron_expr || '' : null,
        schedule_time: scheduleForm.trigger_type === 'time' ? scheduleForm.schedule_time || '09:00' : null,
        timezone: scheduleForm.timezone || 'UTC',
        enabled: scheduleForm.enabled !== false,
      };
      if (!flowId) {
        setNotice('Save the flow first, then create a schedule.');
        return;
      }
      await upsertSchedule(row);
      setNotice('Schedule saved.');
      setScheduleForm(null);
      refreshTriggers();
    } catch (error) {
      setNotice(error.message || 'Failed to save schedule.');
    }
  };

  const handleSaveWebhook = async () => {
    if (!canUseWorkspaceBackend || !webhookForm) return;
    try {
      if (!flowId) {
        setNotice('Save the flow first, then create a webhook.');
        return;
      }
      await createWebhook({ organizationId, workflowId: flowId, name: webhookForm.name || '', method: webhookForm.method || 'POST' });
      setNotice('Webhook created.');
      setWebhookForm(null);
      refreshTriggers();
    } catch (error) {
      setNotice(error.message || 'Failed to create webhook.');
    }
  };

  const handleSaveVariable = async () => {
    if (!canUseWorkspaceBackend || !variableForm) return;
    try {
      let payload = null;
      try {
        payload = JSON.parse(String(variableForm.value ?? ''));
      } catch {
        payload = String(variableForm.value ?? '');
      }
      await upsertVariable({
        organization_id: organizationId,
        key: variableForm.key.trim(),
        value: { __talValue: payload },
        value_type: 'string',
        is_secret: false,
      });
      setNotice('Variable saved.');
      setVariableForm(null);
      refreshTriggers();
    } catch (error) {
      setNotice(error.message || 'Failed to save variable.');
    }
  };

  const confirmPendingDelete = async () => {
    if (!pendingDelete) return;
    const target = pendingDelete;
    setPendingDelete(null);
    try {
      if (target.kind === 'flow') await deleteCurrentFlowFromBackend();
      if (target.kind === 'connection') {
        await deleteConnection(target.id);
        await refreshConnections();
        setNotice('Connection deleted.');
      }
      if (target.kind === 'variable') {
        await deleteVariable(target.id);
        await refreshTriggers();
        setNotice('Variable deleted.');
      }
    } catch (error) {
      setNotice(error.message || `Could not delete ${target.label}.`);
    }
  };

  const refreshBackendStatus = async ({ quiet = false } = {}) => {
    if (!hasSupabaseConfig) {
      setBackendStatus(null);
      return;
    }

    setBackendStatusBusy(true);
    try {
      const status = await getAutomationBackendStatus();
      setBackendStatus(status);
      if (!quiet) {
        setNotice('Frontend and backend handshake confirmed.');
      }
    } catch (error) {
      setBackendStatus({
        ok: false,
        frontendToEdge: false,
        serverCredentials: false,
        error: error.message || 'Backend health check failed.',
      });
      if (!quiet) {
        setNotice(error.message || 'Backend health check failed.');
      }
    } finally {
      setBackendStatusBusy(false);
    }
  };

  const pushRunLog = (entry) => {
    setRunLog((current) => [entry, ...current].slice(0, 10));
  };

  const applyStepResults = (steps) => {
    const stamp = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' });
    const stepMap = new Map((steps || []).map((step) => [step.nodeId, step]));

    setNodes((current) =>
      current.map((node) => {
        const step = stepMap.get(node.id);
        if (!step || !node.makeConfig) return node;
        return {
          ...node,
          makeConfig: {
            ...node.makeConfig,
            lastStatus: step.status,
            lastRunAt: stamp,
            lastResponse: step.detail,
          },
        };
      })
    );

    setRunLog(
      [...(steps || [])]
        .reverse()
        .map((step, index) => ({
          id: `${step.nodeId}-${Date.now()}-${index}`,
          nodeTitle: step.nodeTitle,
          status: step.status,
          detail: step.detail,
        }))
    );
  };

  const saveFlowToBackend = async ({ silent = false } = {}) => {
    if (!canUseWorkspaceBackend) {
      const record = saveDraft({ nodes, edges }, { flowId: flowId || 'untitled', workflowId: flowId, flowName, flowSummary, planName: activePlanName });
      setRunState('Saved locally');
      if (!silent) setNotice(record.storageError ? 'Local save failed. Browser storage is unavailable.' : 'Saved locally. Sign in to persist this workflow to Supabase.');
      return flowId;
    }

    setSaveBusy(true);
    if (!silent) {
      setNotice('Saving this automation graph to Supabase...');
    }

    try {
      const result = await saveAutomationFlow({
        flowId,
        flowName,
        flowSummary,
        planName: activePlanName,
        nodes,
        edges,
        organizationId,
        createdBy: currentUserId,
      });
      setFlowId(result.id);
      let version = null;
      let versionError = null;
      try {
        version = await saveWorkflowVersion(result.id, {
          name: flowName,
          summary: flowSummary,
          nodes,
          edges,
          organizationId,
          createdBy: currentUserId,
          status: 'draft',
          changeSummary: 'Saved from Atom Builder',
        });
        setWorkflowVersion(version.version);
      } catch (error) {
        versionError = error;
      }
      await refreshSavedFlows();
      await refreshRuns(result.id);
      setRunState('Saved');
      if (!silent) {
        setNotice(versionError ? `Flow saved, but version snapshot failed: ${versionError.message || 'unknown error'}` : `Flow saved as version ${version?.version || 1}.`);
      }
      return result.id;
    } catch (error) {
      if (!silent) {
        setNotice(error.message || 'Failed to save to Supabase.');
      }
      throw error;
    } finally {
      setSaveBusy(false);
    }
  };

  const markNodeRun = (nodeId, status, response = '') => {
    const stamp = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' });
    setNodes((current) =>
      current.map((node) =>
        node.id === nodeId && node.makeConfig
          ? {
              ...node,
              makeConfig: {
                ...node.makeConfig,
                lastStatus: status,
                lastRunAt: stamp,
                lastResponse: response,
              },
            }
          : node
      )
    );
  };

  const triggerMakeNode = async (node) => {
    if (!node.makeConfig?.enabled || !node.makeConfig.webhookUrl.trim()) {
      markNodeRun(node.id, 'Skipped', 'No webhook configured');
      pushRunLog({ id: `${node.id}-${Date.now()}`, nodeTitle: node.title, status: 'Skipped', detail: 'No webhook configured' });
      return { skipped: true };
    }

    let parsedPayload = {};
    let parsedHeaders = {};
    try {
      parsedPayload = node.makeConfig.payload.trim() ? JSON.parse(node.makeConfig.payload) : {};
    } catch (error) {
      const message = 'Invalid JSON payload';
      markNodeRun(node.id, 'Payload error', message);
      pushRunLog({ id: `${node.id}-${Date.now()}`, nodeTitle: node.title, status: 'Payload error', detail: message });
      throw new Error(`${node.title}: ${message}`);
    }

    try {
      parsedHeaders = node.makeConfig.headers.trim() ? JSON.parse(node.makeConfig.headers) : {};
    } catch (error) {
      const message = 'Invalid JSON headers';
      markNodeRun(node.id, 'Header error', message);
      pushRunLog({ id: `${node.id}-${Date.now()}`, nodeTitle: node.title, status: 'Header error', detail: message });
      throw new Error(`${node.title}: ${message}`);
    }

    const payload = {
      nodeId: node.id,
      nodeType: node.type,
      nodeTitle: node.title,
      plan: activePlanName,
      flowName,
      flowSummary,
      payload: parsedPayload,
    };

    const response = await fetch(node.makeConfig.webhookUrl, {
      method: node.makeConfig.method || 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...parsedHeaders,
      },
      body: node.makeConfig.method === 'GET' ? undefined : JSON.stringify(payload),
    });

    const responseText = await response.text();
    const preview = responseText.slice(0, 180) || `${response.status} ${response.statusText}`;

    if (!response.ok) {
      markNodeRun(node.id, `HTTP ${response.status}`, preview);
      pushRunLog({ id: `${node.id}-${Date.now()}`, nodeTitle: node.title, status: `HTTP ${response.status}`, detail: preview });
      throw new Error(`${node.title}: HTTP ${response.status}`);
    }

    markNodeRun(node.id, 'Connected', preview);
    pushRunLog({ id: `${node.id}-${Date.now()}`, nodeTitle: node.title, status: 'Connected', detail: preview });
    return { skipped: false };
  };

  const testSelectedMakeNode = async () => {
    if (!selectedNode || !nodeSupportsMake(selectedNode)) {
      setNotice('Select a trigger, agent, or integration atom to send a Make test.');
      return;
    }

    setRunBusy(true);
    setRunState('Sending');
    setNotice(`Sending a test event to ${selectedNode.title}...`);

    try {
      if (canUseWorkspaceBackend) {
        const nextFlowId = await saveFlowToBackend({ silent: true });
        const result = await runAutomationNode({
          flowId: nextFlowId,
          node: selectedNode,
          flowName,
          flowSummary,
          planName: activePlanName,
        });
        applyStepResults(result.steps || []);
        setActiveRunId(result.runId || null);
        await refreshRuns(nextFlowId);
      } else {
        await triggerMakeNode(selectedNode);
      }
      setRunState('Connected');
      setNotice(`${selectedNode.title} test sent to ${canUseWorkspaceBackend ? 'the Supabase backend' : 'Make'}.`);
    } catch (error) {
      setRunState('Error');
      setNotice(error.message || 'Make test failed.');
    } finally {
      setRunBusy(false);
    }
  };

  const applyNativeRunDetail = (execution, nodeRuns, events) => {
    setExecutionStatus(execution?.status || null);
    setNativeRuns(
      Object.fromEntries(
        (nodeRuns || [])
          .filter((run) => ['succeeded', 'failed', 'waiting', 'skipped'].includes(run.status))
          .reverse()
          .map((run) => [
            run.node_id,
            {
              status: run.status,
              branch: run.branch,
              output: run.output,
              error: run.error,
              httpStatus: run.http_status,
              attempt: run.attempt,
            },
          ])
      )
    );

    const ordered = (nodeRuns || [])
      .slice()
      .sort((a, b) => (a.started_at || a.created_at || '').localeCompare(b.started_at || b.created_at || ''));

    const logEntries = ordered
      .slice()
      .reverse()
      .map((run, index) => ({
        id: `${run.node_id}-${run.attempt}-${run.status}-${index}`,
        nodeTitle: run.node_title || run.node_id,
        status: run.status,
        detail:
          run.status === 'failed'
            ? `Attempt ${run.attempt}: ${run.error?.message || run.error || 'Execution failed'}`
            : run.status === 'succeeded'
              ? `${run.branch ? `Route ${String(run.branch).toUpperCase()} · ` : ''}${run.output ? JSON.stringify(run.output).slice(0, 160) : 'Completed'}`
              : `${run.status === 'waiting' ? 'Waiting' : 'Skipped'} · attempt ${run.attempt}`,
        at: run.finished_at || run.started_at || run.created_at,
      }));

    if (logEntries.length) {
      setRunLog(logEntries);
    } else {
      setRunLog((events || []).map((event, index) => ({
        id: `${event.node_id}-event-${index}`,
        nodeTitle: event.node_id || 'Execution',
        status: event.level === 'error' ? 'Error' : event.level === 'warn' ? 'Warning' : 'Info',
        detail: event.message,
        at: event.created_at,
      })));
    }
  };

  const pollExecution = async (executionId) => {
    const deadline = Date.now() + 90000;
    const attempts = Math.max(1, Math.floor(90000 / 1200));
    for (let i = 0; i < attempts; i++) {
      await new Promise((resolve) => setTimeout(resolve, 1200));
      let detail;
      try {
        detail = await getExecutionDetail(executionId);
      } catch (error) {
        setNotice(error.message || 'Execution polling failed.');
        break;
      }
      if (!detail?.execution) break;
      applyNativeRunDetail(detail.execution, detail.nodeRuns, detail.events);
      if (TERMINAL_EXECUTION_STATUSES.has(detail.execution.status)) {
        if (detail.execution.status === 'completed') {
          setRunState('Connected');
          setNotice(`Execution ${executionId.slice(0, 8)} completed successfully.`);
        } else {
          setRunState('Error');
          const msg =
            detail.execution.error?.message ||
            (detail.execution.status === 'canceled' ? 'Execution was canceled.' : `Execution ended as ${detail.execution.status}.`);
          setNotice(msg);
        }
        return detail;
      }
    }
    setNotice('Execution is still running. Refresh run history to see its latest state.');
    return null;
  };

  const activatePath = async () => {
    if (!planRule.editable) {
      setRunState('Locked');
      setNotice('Starter does not include Atom Builder execution. Upgrade to Pro or Enterprise to activate paths.');
      return;
    }

    if (!runValidation()) return;

    let payload = {};
    try {
      payload = manualPayload.trim() ? JSON.parse(manualPayload) : {};
    } catch (error) {
      setRunState('Error');
      setNotice('The manual trigger payload is not valid JSON.');
      return;
    }

    setRunBusy(true);
    setRunConsoleOpen(true);
    setRunLog([]);
    setRunState('Running');
    setExecutionStatus(null);
    setNativeRuns({});

    try {
      if (canUseWorkspaceBackend) {
        setNotice('Saving the graph snapshot and starting a native execution...');
        const nextFlowId = await saveFlowToBackend({ silent: true });
        if (!nextFlowId) throw new Error('Could not save the flow before running.');
        const executionId = await runExecutionNative({
          flowId: nextFlowId,
          nodes,
          edges,
          payload,
          createdBy: currentUserId,
        });
        setActiveRunId(executionId);
        setActiveRunKind('native');
        await refreshRuns(nextFlowId);
        setNotice(`Execution ${executionId.slice(0, 8)} running through the native engine...`);
        await pollExecution(executionId);
      } else {
        const orderedNodes = getExecutionOrder(nodes, edges);
        setRunState('Running');
        for (const node of orderedNodes) {
          if (!nodeSupportsMake(node)) {
            pushRunLog({ id: `${node.id}-${Date.now()}`, nodeTitle: node.title, status: 'Logic', detail: 'Routing handled in builder flow' });
            continue;
          }
          await triggerMakeNode(node);
        }
        setRunState('Connected');
        setNotice('Path run completed through the local browser bridge. Connect Supabase for the native execution engine.');
      }
    } catch (error) {
      setRunState('Error');
      setNotice(error.message || 'Path run failed.');
    } finally {
      setRunBusy(false);
    }
  };

  const loadSavedFlow = async (targetFlowId) => {
    if (!canUseWorkspaceBackend) return;
    setFlowsBusy(true);
    try {
      const payload = await loadAutomationFlow(targetFlowId, { organizationId });
      const restoredNodes = payload.nodes.map(restoreNode);
      const restoredEdges = payload.edges.map((edge) => ({ id: edge.id, from: edge.from_node_id, to: edge.to_node_id, sourcePortId: edge.source_port_id, targetPortId: edge.target_port_id, label: edge.label, sortOrder: edge.sort_order }));
      setFlowId(payload.flow.id);
      setActivePlanName(payload.flow.plan_name || 'Pro');
      setFlowName(payload.flow.name);
      setFlowSummary(payload.flow.summary || '');
      setNodes(restoredNodes.map(applyPresetToNode));
      setEdges(restoredEdges);
      setSelectedNodeId(restoredNodes[0]?.id || null);
      setRunState('Loaded');
      setSimulationResult(null);
      setWorkflowVersion(null);
      setCanvasMode('inspect');
      setNotice(`Loaded ${payload.flow.name} from the backend.`);
      setActiveRunId(null);
      setActiveRunKind('legacy');
      setExecutionStatus(null);
      setNativeRuns({});
      setValidationOpen(false);
      setRunConsoleOpen(false);
      resetGraphHistory();
      await refreshRuns(payload.flow.id);
    } catch (error) {
      setNotice(error.message || 'Failed to load this automation.');
    } finally {
      setFlowsBusy(false);
    }
  };

  const deleteCurrentFlowFromBackend = async () => {
    if (!flowId || !canUseWorkspaceBackend) {
      setNotice('Save the flow first before trying to delete it from the backend.');
      return;
    }
    setFlowsBusy(true);
    try {
      await deleteAutomationFlow(flowId, { organizationId });
      await refreshSavedFlows();
      createFreshFlow(activePlanName === 'Starter' ? 'Pro' : activePlanName);
      setNotice('Saved automation deleted from the backend.');
    } catch (error) {
      setNotice(error.message || 'Failed to delete the automation.');
    } finally {
      setFlowsBusy(false);
    }
  };

  const duplicateCurrentFlow = () => {
    setFlowId(null);
    setFlowName((current) => `${current} Copy`);
    setWorkflowVersion(null);
    setRunState('Edited');
    setNotice('This draft is now detached from the saved flow. Save backend to create a duplicate.');
  };

  const inspectRun = async (runId) => {
    if (!canUseWorkspaceBackend) return;
    setRunsBusy(true);
    setRunConsoleOpen(true);
    try {
      const target = backendRuns.find((run) => run.id === runId);
      if (target?.native) {
        setActiveRunId(runId);
        setActiveRunKind('native');
        const detail = await getExecutionDetail(runId);
        applyNativeRunDetail(detail.execution, detail.nodeRuns, detail.events);
        setNotice('Loaded native execution details into the execution log.');
      } else {
        const steps = await listAutomationRunSteps(runId);
        setActiveRunId(runId);
        setActiveRunKind('legacy');
        setRunLog(
          steps
            .slice()
            .reverse()
            .map((step, index) => ({
              id: `${step.node_id}-${runId}-${index}`,
              nodeTitle: step.node_title,
              status: step.status,
              detail: step.response_preview || 'No response preview',
            }))
        );
        setNotice('Loaded backend run details into the execution log.');
      }
    } catch (error) {
      setNotice(error.message || 'Failed to inspect this run.');
    } finally {
      setRunsBusy(false);
    }
  };

  const handleCancelRun = async (runId) => {
    if (!canUseWorkspaceBackend) return;
    try {
      await cancelExecution(runId);
      setNotice('Execution canceled.');
      refreshRuns();
    } catch (error) {
      setNotice(error.message || 'Failed to cancel execution.');
    }
  };

  const handleRetryRun = async (runId) => {
    if (!canUseWorkspaceBackend) return;
    try {
      await retryExecution(runId);
      setNotice('Execution retried.');
      refreshRuns();
    } catch (error) {
      setNotice(error.message || 'Failed to retry execution.');
    }
  };

  const removeSelectedNode = () => {
    if (!selectedNode || !planRule.editable) {
      setNotice('This path is locked until Pro or Enterprise is selected.');
      return;
    }

    recordGraphSnapshot();
    setNodes((current) => current.filter((node) => node.id !== selectedNode.id));
    setEdges((current) => current.filter((edge) => edge.from !== selectedNode.id && edge.to !== selectedNode.id));
    setSelectedNodeId(nodes.find((node) => node.id !== selectedNode.id)?.id || null);
    setNotice(`${selectedNode.title} removed from the path.`);
    setRunState('Edited');
  };

  const copySelectedNodes = () => {
    if (!selectedNode) return;
    clipboardRef.current = { nodes: [cloneGraphNodes([selectedNode])[0]], edges: [] };
    setNotice(`${selectedNode.title} copied.`);
  };

  const pasteNodes = () => {
    const clip = clipboardRef.current;
    if (!clip?.nodes?.length || !planRule.editable) return;
    const idMap = new Map();
    const pasted = clip.nodes.map((node, index) => {
      const id = `${node.id}-copy-${Date.now().toString(36)}-${index}`;
      idMap.set(node.id, id);
      return { ...cloneGraphNodes([node])[0], id, title: `${node.title} Copy`, x: getPosition(node).x + 40, y: getPosition(node).y + 40 };
    });
    recordGraphSnapshot();
    setNodes((current) => [...current, ...pasted]);
    setEdges((current) => [...current, ...clip.edges.map((edge) => ({ ...edge, id: `${edge.id || 'edge'}-copy-${Date.now().toString(36)}`, from: idMap.get(edge.from), to: idMap.get(edge.to) }))]);
    setSelectedNodeId(pasted[pasted.length - 1].id);
    setRunState('Edited');
    setNotice(`${pasted.length} atom${pasted.length === 1 ? '' : 's'} pasted.`);
  };

  const duplicateSelectedNode = () => {
    if (!selectedNode || !planRule.editable) return;
    if (liveAtomCount >= planRule.atoms) {
      setNotice(`${activePlanName} is capped at ${planRule.atoms} live atoms.`);
      return;
    }
    const slot = findOpenSlot(nodes, selectedNode.lane, selectedNode.column + 1);
    const position = getPosition({ lane: slot.lane, column: slot.column });
    const copy = {
      ...selectedNode,
      id: `${selectedNode.id}-copy-${Math.random().toString(36).slice(2, 7)}`,
      title: `${selectedNode.title} Copy`,
      lane: slot.lane,
      column: slot.column,
      x: position.x,
      y: position.y,
      config: selectedNode.config ? structuredClone(selectedNode.config) : selectedNode.config,
      makeConfig: selectedNode.makeConfig ? structuredClone(selectedNode.makeConfig) : selectedNode.makeConfig,
    };
    recordGraphSnapshot();
    setNodes((current) => [...current, copy]);
    setSelectedNodeId(copy.id);
    setRunState('Edited');
    setNotice(`${selectedNode.title} duplicated.`);
  };

  const removeEdge = (edgeToRemove) => {
    recordGraphSnapshot();
    setEdges((current) => current.filter((edge) => edge !== edgeToRemove));
    setRunState('Edited');
    setNotice('Connection removed.');
  };

  const activePlanCard = plans.find((plan) => plan.name === activePlanName);

  const startDragging = (event, node) => {
    if (event.pointerType && event.pointerType !== 'mouse' && event.button !== 0) return;
    event.stopPropagation();
    event.currentTarget.setPointerCapture?.(event.pointerId);
    const point = toCanvasPoint(event.clientX, event.clientY);
    if (!point) return;
    const pos = getPosition(node);
    recordGraphSnapshot();
    setSelectedNodeId(node.id);
    setDragState({
      id: node.id,
      offsetX: point.x - pos.x,
      offsetY: point.y - pos.y,
      pointerId: event.pointerId,
    });
  };

  const startConnection = (event, nodeId, sourcePortId = null) => {
    event.stopPropagation();
    const sourceNode = nodes.find((node) => node.id === nodeId);
    if (!sourceNode) return;
    setSelectedNodeId(nodeId);
    setConnectState({ sourceId: nodeId, sourcePortId });
    setPointerPos(getPortPosition(sourceNode, 'right'));
    setNotice('Choose a target module to create a connection.');
  };

  const completeConnection = (event, targetId) => {
    event.stopPropagation();
    if (!connectState) return;
    const connection = buildConnection(nodes, edges, connectState.sourceId, targetId, { sourcePortId: connectState.sourcePortId });
    if (!connection.ok) {
      setNotice(connection.message);
      if (connection.code === 'duplicate_connection' || connection.code === 'workflow_cycle') {
        setConnectState(null);
        setPointerPos(null);
      }
      return;
    }
    recordGraphSnapshot();
    setEdges((current) => [...current, connection.edge]);
    setConnectState(null);
    setPointerPos(null);
    setCanvasMode('build');
    setNotice('Connection created.');
    setRunState('Edited');
  };

  useEffect(() => {
    if (!dragState && !connectState) return undefined;

    const handleMove = (event) => {
      const point = toCanvasPoint(event.clientX, event.clientY);
      if (!point) return;

      if (dragState) {
        const position = snapPoint({ x: point.x - dragState.offsetX, y: point.y - dragState.offsetY }, 10);
        setNodes((current) =>
          current.map((node) =>
            node.id === dragState.id
              ? {
                  ...node,
                  ...position,
                }
              : node
          )
        );
      }

      if (connectState) {
        setPointerPos(point);
      }
    };

    const handleUp = () => {
      if (dragState) {
        setDragState(null);
        setNotice('Module position updated.');
        setRunState('Edited');
      }
    };

    window.addEventListener('pointermove', handleMove, { passive: false });
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointercancel', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', handleUp);
    };
  }, [dragState, connectState]);

  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key !== 'Escape') return;
      setQuickAddNodeId(null);
      setQuickAddQuery('');
      setManagementOpen(false);
      setCanvasGesture(null);
    };
    const handleOutsidePointer = (event) => {
      if (!quickAddNodeId) return;
      const target = event.target;
      if (target instanceof Element && (target.closest('.builder-quick-add') || target.closest('.builder-node__addNext'))) return;
      setQuickAddNodeId(null);
      setQuickAddQuery('');
    };
    window.addEventListener('keydown', handleEscape);
    document.addEventListener('pointerdown', handleOutsidePointer);
    return () => {
      window.removeEventListener('keydown', handleEscape);
      document.removeEventListener('pointerdown', handleOutsidePointer);
    };
  }, [quickAddNodeId]);

  useEffect(() => {
    if (!touchAtomDrag && !canvasGesture) return undefined;
    const handleMove = (event) => {
      if (canvasPointersRef.current.has(event.pointerId)) {
        canvasPointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
      }
      if (canvasPointersRef.current.size >= 2) {
        const points = [...canvasPointersRef.current.values()];
        const distance = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
        if (!pinchRef.current) pinchRef.current = { distance, zoom };
        setZoom(Math.max(70, Math.min(140, Math.round((pinchRef.current.zoom * distance / pinchRef.current.distance) / 5) * 5)));
        return;
      }
      if (touchAtomDrag) {
        const point = toCanvasPoint(event.clientX, event.clientY);
        if (point) setTouchAtomDrag((current) => ({ ...current, point }));
      }
      if (canvasGestureRef.current) {
        const gesture = canvasGestureRef.current;
        const dx = event.clientX - gesture.clientX;
        const dy = event.clientY - gesture.clientY;
        if (Math.abs(dx) + Math.abs(dy) > 4) gesture.moved = true;
        setCanvasPan({ x: gesture.originX + dx, y: gesture.originY + dy });
      }
    };
    const handleUp = (event) => {
      canvasPointersRef.current.delete(event.pointerId);
      if (canvasPointersRef.current.size < 2) {
        pinchRef.current = null;
        if (!canvasGestureRef.current) setCanvasGesture(null);
      }
      if (touchAtomDrag) {
        const rect = canvasRef.current?.getBoundingClientRect();
        const insideCanvas = rect && event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom;
        if (insideCanvas && touchAtomDrag.point) {
          appendAtom(touchAtomDrag.item, false, { point: touchAtomDrag.point, connect: false });
          recentTouchDropRef.current = true;
          window.setTimeout(() => { recentTouchDropRef.current = false; }, 250);
        }
        setTouchAtomDrag(null);
      }
      if (canvasGestureRef.current) {
        recentCanvasPanRef.current = canvasGestureRef.current.moved;
        if (recentCanvasPanRef.current) window.setTimeout(() => { recentCanvasPanRef.current = false; }, 120);
        canvasGestureRef.current = null;
        setCanvasGesture(null);
      }
    };
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
    window.addEventListener('pointercancel', handleUp);
    return () => {
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      window.removeEventListener('pointercancel', handleUp);
    };
  }, [touchAtomDrag, canvasGesture]);

  useEffect(() => {
    refreshSavedFlows();
  }, [organizationId]);

  useEffect(() => {
    if (canUseWorkspaceBackend) refreshBackendStatus({ quiet: true });
  }, [canUseWorkspaceBackend]);

  useEffect(() => {
    const handleKeyDown = (event) => {
      const target = event.target;
      const editing = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement || target?.isContentEditable;
      const command = event.metaKey || event.ctrlKey;
      if (command && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) redoGraph();
        else undoGraph();
        return;
      }
      if (!editing && command && event.key.toLowerCase() === 'c' && selectedNode) {
        event.preventDefault();
        copySelectedNodes();
        return;
      }
      if (!editing && command && event.key.toLowerCase() === 'v') {
        event.preventDefault();
        pasteNodes();
        return;
      }
      if (!editing && (event.key === 'Backspace' || event.key === 'Delete') && selectedNode) {
        event.preventDefault();
        removeSelectedNode();
      }
      if (!editing && command && event.key.toLowerCase() === 'd' && selectedNode) {
        event.preventDefault();
        duplicateSelectedNode();
      }
      if (!editing && command && event.key === 'Enter') {
        event.preventDefault();
        activatePath();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  });

  useEffect(() => {
    if (flowId) {
      refreshRuns(flowId);
    }
  }, [flowId]);

  useEffect(() => {
    if (!managementOpen) return;
    refreshSavedFlows();
    refreshConnections();
    refreshApprovals();
    refreshTriggers();
  }, [managementOpen]);

  useEffect(() => {
    setNodes((current) => current.map(applyPresetToNode));
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      saveDraft({ nodes, edges }, { flowId: flowId || 'untitled', flowName, flowSummary, planName: activePlanName });
    }, 250);
    return () => clearTimeout(timer);
  }, [nodes, edges, flowId, flowName, flowSummary, activePlanName]);

  const immersiveMode = fullScreen || contextLabel === 'Admin QA';
  const wrapperPadding = immersiveMode
    ? '0'
    : embedded
      ? '32px 0 12px'
      : '108px 32px 48px';
  const wrapperMinHeight = immersiveMode ? '100vh' : embedded ? 'auto' : '100vh';
  const frameInset = immersiveMode ? 18 : 0;
  const shellOffset = immersiveMode ? 92 : 0;
  const workspaceMinHeight = immersiveMode ? `calc(100vh - ${shellOffset + frameInset * 2}px)` : 'auto';
  const canvasHeight = immersiveMode ? `calc(100vh - ${shellOffset + frameInset * 2 + 220}px)` : 760;
  const WrapperTag = embedded ? 'section' : 'main';

  return (
    <WrapperTag id={sectionId} style={{ minHeight: wrapperMinHeight, padding: wrapperPadding, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(circle at 15% 10%, rgba(168,85,247,0.14), transparent 30%), radial-gradient(circle at 88% 14%, rgba(0,201,167,0.1), transparent 32%), ${BUILDER_BG}` }} />
      <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.03) 1px, transparent 1px)', backgroundSize: '28px 28px', opacity: 0.45 }} />
        {immersiveMode ? (
          <style>{`
            [data-builder-mode="fullscreen"] .builder-layout > :nth-child(2) {
              display: flex;
              flex-direction: column;
              min-height: calc(100vh - 310px);
            }
            [data-builder-mode="fullscreen"] .builder-layout > :nth-child(2) > div:first-child {
              height: calc(100vh - 310px) !important;
              min-height: 780px !important;
            }
            [data-builder-mode="fullscreen"] .builder-layout > :nth-child(2) > div:first-child > div:first-child {
              height: 100%;
            }
            [data-builder-mode="fullscreen"] .builder-layout > :nth-child(1),
            [data-builder-mode="fullscreen"] .builder-layout > :nth-child(3) {
              max-height: calc(100vh - 180px);
              overflow: auto;
              scrollbar-width: thin;
            }
            @media (max-width: 1180px) {
              [data-builder-mode="fullscreen"] .builder-layout {
                grid-template-columns: 1fr;
              }
              [data-builder-mode="fullscreen"] .builder-layout > :nth-child(1),
              [data-builder-mode="fullscreen"] .builder-layout > :nth-child(2),
              [data-builder-mode="fullscreen"] .builder-layout > :nth-child(3) {
                max-height: none;
                min-height: auto;
              }
              [data-builder-mode="fullscreen"] .builder-layout > :nth-child(2) > div:first-child {
                min-height: 70vh !important;
                height: 70vh !important;
              }
            }
          `}</style>
        ) : null}
        <div
          data-builder-mode={immersiveMode ? 'fullscreen' : embedded ? 'embedded' : 'default'}
          style={{
            position: 'relative',
            maxWidth: immersiveMode ? 'none' : 1680,
            width: immersiveMode ? '100vw' : '100%',
            margin: immersiveMode ? '0 calc(50% - 50vw)' : '0 auto',
            minHeight: workspaceMinHeight,
            padding: immersiveMode ? `${frameInset}px` : 0,
          }}
        >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, marginBottom: 18, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            {embedded ? (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 14px', borderRadius: 999, border: `1px solid ${BUILDER_BORD}`, background: BUILDER_SURF, color: 'rgba(255,255,255,0.78)', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase' }}>
                <Workflow size={13} color={accent} /> {contextLabel}
              </div>
            ) : (
              <button onClick={onBack} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 14px', borderRadius: 12, border: `1px solid ${BUILDER_BORD}`, background: BUILDER_SURF, color: 'rgba(255,255,255,0.78)', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                <ArrowRight size={14} style={{ transform: 'rotate(180deg)' }} /> Platform
              </button>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, color: 'rgba(255,255,255,0.72)', fontFamily: 'JetBrains Mono, monospace', fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase' }}>
              <span style={{ color: BUILDER_ACCENT }}>Atom Builder</span>
              <span style={{ opacity: 0.4 }}>/</span>
              <span>{activePlanName}</span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ padding: '8px 12px', borderRadius: 999, border: `1px solid ${BUILDER_BORD}`, background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.76)', fontFamily: 'Manrope, sans-serif', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <Timer size={13} color={accent} /> {runState}
            </div>
            <div style={{ padding: '8px 12px', borderRadius: 999, border: `1px solid ${BUILDER_BORD}`, background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.76)', fontFamily: 'Manrope, sans-serif', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <Link2 size={13} color={accent} /> {edges.length} links
            </div>
          </div>
        </div>

        {!embedded && <div style={{ marginBottom: 18, display: 'flex', justifyContent: 'space-between', gap: 18, flexWrap: 'wrap', alignItems: 'end' }}>
          <div style={{ minWidth: 280, flex: '1 1 520px' }}>
            <div style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontSize: 38, lineHeight: 1.02, fontWeight: 800, color: '#fff', letterSpacing: '-0.04em', marginBottom: 8 }}>
              {adminMode ? 'Validate automation flows before customers use them.' : 'Atom Builder for paid automation teams.'}
            </div>
            <div style={{ maxWidth: 760, fontFamily: 'Manrope, sans-serif', fontSize: 14, lineHeight: 1.6, color: 'rgba(255,255,255,0.56)' }}>
              {adminMode
                ? 'Run the product as an operator, test saved paths, inspect backend runs, and verify that Pro and Enterprise automations behave the way subscribers expect before rollout.'
                : 'Atom Builder is a Pro feature. Pro teams can run compact automation paths with up to 3 live atoms, while Enterprise expands the graph to 10 with deeper branching and approvals.'}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {DEMO_METRICS.map((metric) => (
              <div key={metric.label} style={{ minWidth: 156, padding: '12px 14px', borderRadius: 16, border: `1px solid ${BUILDER_BORD}`, background: 'rgba(255,255,255,0.035)', color: 'rgba(255,255,255,0.76)', fontFamily: 'Manrope, sans-serif', fontSize: 12 }}>
                <div style={{ color: '#fff', fontWeight: 800, fontSize: 18, marginBottom: 2 }}>{metric.value}</div>
                <div>{metric.label}</div>
              </div>
            ))}
          </div>
        </div>}

          <div
            className="builder-layout"
            style={{
              display: 'grid',
              gridTemplateColumns: immersiveMode
                ? '320px minmax(0, 1fr) 360px'
                : '300px minmax(0, 1fr) 340px',
              gap: immersiveMode ? 18 : 16,
              alignItems: 'stretch',
              minHeight: immersiveMode ? `calc(${workspaceMinHeight} - 146px)` : 'auto',
            }}
          >
          <aside className="builder-palette" style={{ borderRadius: 18, border: `1px solid ${BUILDER_BORD}`, background: 'rgba(8,12,22,0.82)', boxShadow: '0 20px 45px rgba(0,0,0,0.25)', overflow: 'hidden' }}>
            <div style={{ padding: '18px 18px 14px', borderBottom: `1px solid ${BUILDER_BORD}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div>
                  <div style={{ fontFamily: 'Bricolage Grotesque, sans-serif', color: '#fff', fontSize: 18, fontWeight: 700 }}>Atoms</div>
                  <div style={{ fontFamily: 'Manrope, sans-serif', color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 4 }}>Click or drag an Atom into the workflow.</div>
                </div>
                <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: `1px solid ${BUILDER_BORD}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Filter size={15} color="rgba(255,255,255,0.72)" />
                </div>
              </div>
              <div style={{ position: 'relative', marginBottom: 12 }}>
                <Search size={14} color="rgba(255,255,255,0.42)" style={{ position: 'absolute', left: 12, top: 12 }} />
                <input
                  value={libraryQuery}
                  onChange={(event) => setLibraryQuery(event.target.value)}
                  placeholder="Search Atoms..."
                  style={{ width: '100%', borderRadius: 12, border: `1px solid ${BUILDER_BORD}`, background: 'rgba(255,255,255,0.04)', color: '#fff', padding: '10px 12px 10px 36px', fontFamily: 'Manrope, sans-serif', fontSize: 13, outline: 'none' }}
                />
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                {PALETTE_TABS.map((tab) => {
                  const active = tab.id === activePalette;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActivePalette(tab.id)}
                      style={{
                        padding: '7px 10px',
                        borderRadius: 999,
                        border: `1px solid ${active ? `${accent}55` : BUILDER_BORD}`,
                        background: active ? `${accent}18` : 'rgba(255,255,255,0.03)',
                        color: active ? '#fff' : 'rgba(255,255,255,0.58)',
                        fontFamily: 'Bricolage Grotesque, sans-serif',
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>
              <div style={{ padding: '8px 10px', borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: `1px solid ${BUILDER_BORD}`, fontFamily: 'JetBrains Mono, monospace', fontSize: 10, letterSpacing: '0.18em', color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase' }}>
                {planRule.label} · {planRule.editable ? `${liveAtomCount}/${planRule.atoms} atoms in draft` : 'Interactive preview'}
              </div>
            </div>
            <div style={{ padding: 18, display: 'grid', gap: 16 }}>
              {filteredPaletteGroups.map((group) => (
                <div key={group.title}>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, letterSpacing: '0.18em', color: 'rgba(255,255,255,0.38)', textTransform: 'uppercase', marginBottom: 10 }}>{group.title}</div>
                  <div style={{ display: 'grid', gap: 8 }}>
                    {group.items.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        draggable={planRule.editable}
                        onPointerDown={(event) => {
                          if (event.pointerType === 'mouse' || !planRule.editable) return;
                          event.preventDefault();
                          setTouchAtomDrag({ item, point: toCanvasPoint(event.clientX, event.clientY) });
                        }}
                        onDragStart={(event) => {
                          event.dataTransfer.setData('application/x-ascentra-atom', item.id);
                          event.dataTransfer.effectAllowed = 'copy';
                        }}
                        onClick={() => { if (!recentTouchDropRef.current) appendAtom(item); }}
                        onContextMenu={(event) => { event.preventDefault(); appendAtom(item); }}
                        style={{
                          width: '100%',
                          textAlign: 'left',
                          padding: '12px 12px',
                          borderRadius: 14,
                          background: 'rgba(255,255,255,0.03)',
                          border: `1px solid ${BUILDER_BORD}`,
                          cursor: 'pointer',
                          display: 'grid',
                          gridTemplateColumns: '36px 1fr',
                          gap: 10,
                          alignItems: 'center',
                        }}
                      >
                        <div style={{ width: 36, height: 36, borderRadius: 12, background: `${item.color}20`, border: `1px solid ${item.color}55`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <item.Icon size={16} color={item.color} />
                        </div>
                        <div>
                          <div style={{ color: '#fff', fontFamily: 'Bricolage Grotesque, sans-serif', fontSize: 14, fontWeight: 700 }}>{item.label}</div>
                          <div style={{ color: 'rgba(255,255,255,0.48)', fontFamily: 'Manrope, sans-serif', fontSize: 11, marginTop: 3 }}>{item.subtitle}</div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </aside>

          <section className="builder-workspace" style={{ borderRadius: 20, border: `1px solid ${BUILDER_BORD}`, background: 'rgba(10,14,22,0.82)', boxShadow: '0 24px 60px rgba(0,0,0,0.28)', overflow: 'hidden' }}>
            <div className="builder-scenario-header" style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '16px 18px', borderBottom: `1px solid ${BUILDER_BORD}`, flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ minWidth: 260, flex: '1 1 320px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
                  <div style={{ padding: '5px 9px', borderRadius: 999, background: 'rgba(255,255,255,0.04)', border: `1px solid ${BUILDER_BORD}`, color: 'rgba(255,255,255,0.72)', fontFamily: 'JetBrains Mono, monospace', fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase' }}>
                    Scenario
                  </div>
                  <div style={{ color: 'rgba(255,255,255,0.42)', fontFamily: 'Manrope, sans-serif', fontSize: 12 }}>
                    {backendLabel}
                  </div>
                </div>
                <input
                  value={flowName}
                  onChange={(event) => {
                    setFlowName(event.target.value);
                    setRunState('Edited');
                  }}
                  style={{ width: '100%', background: 'transparent', border: 'none', outline: 'none', color: '#fff', fontFamily: 'Bricolage Grotesque, sans-serif', fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 6 }}
                />
                <textarea
                  value={flowSummary}
                  onChange={(event) => {
                    setFlowSummary(event.target.value);
                    setRunState('Edited');
                  }}
                  rows={2}
                  style={{ width: '100%', resize: 'none', background: 'transparent', border: 'none', outline: 'none', color: 'rgba(255,255,255,0.55)', fontFamily: 'Manrope, sans-serif', fontSize: 13, lineHeight: 1.5 }}
                />
              </div>
              <div className="builder-scenario-controls" style={{ display: 'grid', gap: 10, minWidth: 300 }}>
                <div className="builder-plan-toggle" style={{ display: 'inline-flex', padding: 4, borderRadius: 999, background: 'rgba(255,255,255,0.04)', border: `1px solid ${BUILDER_BORD}`, alignSelf: 'end', justifySelf: 'end' }}>
                  {Object.keys(PLAN_RULES).map((planName) => {
                    const active = planName === activePlanName;
                    return (
                      <button
                        key={planName}
                        onClick={() => switchPlan(planName)}
                        style={{
                          padding: '7px 14px',
                          borderRadius: 999,
                          border: 'none',
                          background: active ? accent : 'transparent',
                          color: active ? '#000' : 'rgba(255,255,255,0.62)',
                          fontFamily: 'Bricolage Grotesque, sans-serif',
                          fontWeight: 700,
                          fontSize: 12,
                          cursor: 'pointer',
                        }}
                      >
                        {planName}
                      </button>
                    );
                  })}
                </div>
                <div className="builder-scenario-actions" style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                  <button onClick={() => createFreshFlow(activePlanName === 'Starter' ? 'Pro' : activePlanName)} style={{ padding: '11px 14px', borderRadius: 12, border: `1px solid ${BUILDER_BORD}`, background: 'rgba(255,255,255,0.04)', color: '#fff', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <FolderOpen size={14} /> New draft
                  </button>
                  <button onClick={undoGraph} disabled={!canUndo} title="Undo (⌘Z)" aria-label="Undo" style={{ width: 40, height: 40, borderRadius: 12, border: `1px solid ${BUILDER_BORD}`, background: 'rgba(255,255,255,0.04)', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: canUndo ? 'pointer' : 'not-allowed', opacity: canUndo ? 1 : 0.38 }}>
                    <Undo2 size={15} />
                  </button>
                  <button onClick={redoGraph} disabled={!canRedo} title="Redo (⇧⌘Z)" aria-label="Redo" style={{ width: 40, height: 40, borderRadius: 12, border: `1px solid ${BUILDER_BORD}`, background: 'rgba(255,255,255,0.04)', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: canRedo ? 'pointer' : 'not-allowed', opacity: canRedo ? 1 : 0.38 }}>
                    <Redo2 size={15} />
                  </button>
                  <button onClick={runLocalSimulation} style={{ padding: '11px 14px', borderRadius: 12, border: `1px solid ${BUILDER_BORD}`, background: 'rgba(168,85,247,0.08)', color: '#fff', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <Sparkles size={14} /> Simulate
                  </button>
                  <button onClick={() => runValidation()} style={{ padding: '11px 14px', borderRadius: 12, border: `1px solid ${validation.valid ? BUILDER_BORD : 'rgba(248,113,113,0.4)'}`, background: validation.valid ? 'rgba(255,255,255,0.04)' : 'rgba(248,113,113,0.08)', color: '#fff', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <Check size={14} /> Validate{validation.errors ? ` · ${validation.errors}` : ''}
                  </button>
                  <button onClick={() => saveFlowToBackend().catch(() => {})} disabled={saveBusy} style={{ padding: '11px 14px', borderRadius: 12, border: `1px solid ${BUILDER_BORD}`, background: 'rgba(255,255,255,0.04)', color: '#fff', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 8, cursor: saveBusy ? 'wait' : 'pointer', opacity: saveBusy ? 0.72 : 1 }}>
                    <Database size={14} /> {saveBusy ? 'Saving...' : 'Save'}
                  </button>
                  <button onClick={() => setManagementOpen((open) => !open)} aria-expanded={managementOpen} style={{ padding: '11px 14px', borderRadius: 12, border: `1px solid ${BUILDER_BORD}`, background: managementOpen ? `${accent}14` : 'rgba(255,255,255,0.04)', color: '#fff', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <Settings2 size={14} /> More
                  </button>
                  {runBusy && canUseWorkspaceBackend && activeRunId && (
                    <button onClick={() => handleCancelRun(activeRunId)} style={{ padding: '11px 14px', borderRadius: 12, border: '1px solid rgba(248,113,113,0.45)', background: 'rgba(248,113,113,0.1)', color: '#fca5a5', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                      <X size={14} /> Stop
                    </button>
                  )}
                  <button onClick={activatePath} disabled={runBusy} style={{ padding: '11px 15px', borderRadius: 12, border: 'none', background: accent, color: '#000', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 8, cursor: runBusy ? 'wait' : 'pointer', boxShadow: '0 10px 28px rgba(0,201,167,0.26)', opacity: runBusy ? 0.72 : 1 }}>
                    <Play size={14} /> {runBusy ? 'Running...' : planRule.editable ? 'Run' : 'Path locked'}
                  </button>
                </div>
              </div>
            </div>

            <div style={{ padding: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {[
                    { label: planRule.editable ? `${liveAtomCount}/${planRule.atoms} live atoms` : 'Demo only', icon: planRule.editable ? Boxes : Lock },
                    { label: activePlanCard?.vals?.[9] || planRule.label, icon: planRule.editable ? Crown : Eye },
                    { label: 'Approvals + integrations', icon: Settings2 },
                    { label: workflowVersion ? `Version ${workflowVersion}` : 'Draft snapshot', icon: History },
                  ].map((pill) => (
                    <div key={pill.label} style={{ padding: '8px 12px', borderRadius: 999, border: `1px solid ${BUILDER_BORD}`, background: 'rgba(255,255,255,0.035)', color: 'rgba(255,255,255,0.78)', fontFamily: 'Manrope, sans-serif', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                      <pill.icon size={13} color={accent} /> {pill.label}
                    </div>
                  ))}
                </div>
                <div style={{ display: 'inline-flex', gap: 8 }}>
                  <button onClick={() => setZoom((value) => Math.max(70, value - 10))} style={{ width: 34, height: 34, borderRadius: 10, border: `1px solid ${BUILDER_BORD}`, background: 'rgba(255,255,255,0.035)', color: '#fff', cursor: 'pointer' }}>-</button>
                  <div style={{ minWidth: 58, height: 34, borderRadius: 10, border: `1px solid ${BUILDER_BORD}`, background: 'rgba(255,255,255,0.035)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.76)', fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>{zoom}%</div>
                  <button onClick={() => setZoom((value) => Math.min(140, value + 10))} style={{ width: 34, height: 34, borderRadius: 10, border: `1px solid ${BUILDER_BORD}`, background: 'rgba(255,255,255,0.035)', color: '#fff', cursor: 'pointer' }}>+</button>
                  <button onClick={fitWorkflow} style={{ height: 34, padding: '0 11px', borderRadius: 10, border: `1px solid ${BUILDER_BORD}`, background: 'rgba(255,255,255,0.035)', color: '#fff', cursor: 'pointer', fontFamily: 'Manrope, sans-serif', fontSize: 11 }}>Fit</button>
                </div>
              </div>

              <div className="builder-canvas-toolbar">
                <div className="builder-canvas-toolbar__group">
                  {[
                    { id: 'build', label: 'Build', icon: Boxes },
                    { id: 'connect', label: 'Connect', icon: Link2 },
                    { id: 'inspect', label: 'Inspect', icon: Settings2 },
                  ].map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className="builder-canvas-toolbar__button"
                      data-active={canvasMode === item.id}
                      onClick={() => setCanvasMode(item.id)}
                    >
                      <item.icon size={14} color={canvasMode === item.id ? accent : 'rgba(255,255,255,0.7)'} />
                      {item.label}
                    </button>
                  ))}
                </div>
                <div className="builder-canvas-toolbar__group">
                  <div className="builder-canvas-toolbar__pill">{nodes.length} nodes</div>
                  <div className="builder-canvas-toolbar__pill">{edges.length} routes</div>
                  <div className="builder-canvas-toolbar__pill">{connectState ? 'Pick a destination' : 'Canvas focused'}</div>
                </div>
              </div>

              {validationOpen && (
                <div className="builder-validation" data-valid={validation.valid} role="status">
                  <div>
                    <strong>{validation.valid ? 'Ready to run' : `${validation.errors} issue${validation.errors === 1 ? '' : 's'} to fix`}</strong>
                    <span>{validation.valid ? 'The graph and required Atom configuration passed validation.' : 'Select an issue to jump to the Atom that needs attention.'}</span>
                  </div>
                  <div className="builder-validation__issues">
                    {validation.issues.slice(0, 5).map((entry, index) => (
                      <button key={`${entry.code}-${entry.nodeId || index}`} type="button" onClick={() => { if (entry.nodeId) { setSelectedNodeId(entry.nodeId); setInspectorTab('settings'); } }}>
                        <span data-severity={entry.severity}>{entry.severity === 'warning' ? 'Warning' : 'Fix'}</span>{entry.message}
                      </button>
                    ))}
                  </div>
                  <button type="button" className="builder-validation__close" onClick={() => setValidationOpen(false)} aria-label="Close validation"><X size={14} /></button>
                </div>
              )}

              {simulationResult && (
                <div className="builder-simulation" role="status">
                  <div className="builder-simulation__header">
                    <div>
                      <strong>{simulationResult.ok ? 'Local simulation complete' : 'Simulation stopped'}</strong>
                      <span>{simulationResult.ok ? `${simulationResult.trace.length} evaluated · ${simulationResult.boundaries.length} external boundaries` : 'Resolve the validation issues before simulating.'}</span>
                    </div>
                    <button type="button" onClick={() => setSimulationResult(null)} aria-label="Close simulation"><X size={14} /></button>
                  </div>
                  <div className="builder-simulation__trace">
                    {simulationResult.trace.slice(0, 8).map((entry, index) => {
                      const node = nodes.find((candidate) => candidate.id === entry.nodeId);
                      return (
                        <div key={`${entry.nodeId || 'simulation'}-${index}`} data-status={entry.status}>
                          <span>{node?.title || entry.nodeId || 'Simulation'}</span>
                          <strong>{entry.status}</strong>
                          {entry.reason && <small>{entry.reason}</small>}
                        </div>
                      );
                    })}
                    {!simulationResult.trace.length && <div data-status="error"><span>No executable route</span><strong>Waiting</strong><small>Add a trigger and connect the first Atom.</small></div>}
                  </div>
                  {simulationResult.boundaries.length > 0 && <div className="builder-simulation__boundary">External calls are not executed in local mode. Use Run with the native engine when the workspace is connected.</div>}
                </div>
              )}

              <div className="builder-stage" style={{ height: canvasHeight, minHeight: 520 }}>
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(140deg, rgba(255,255,255,0.14), rgba(255,255,255,0))' }} />
                <div
                  ref={canvasRef}
                  onDragOver={(event) => {
                    if (!event.dataTransfer.types.includes('application/x-ascentra-atom')) return;
                    event.preventDefault();
                    event.dataTransfer.dropEffect = 'copy';
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    const atomId = event.dataTransfer.getData('application/x-ascentra-atom');
                    const item = paletteItems.find((entry) => entry.id === atomId);
                    const point = toCanvasPoint(event.clientX, event.clientY);
                    if (item && point) appendAtom(item, false, { point, connect: false });
                  }}
                  onPointerDown={(event) => {
                    if (event.pointerType === 'mouse' && event.button !== 0) return;
                    if (event.target.closest?.('.builder-node, .builder-node__addNext, button')) return;
                    event.preventDefault();
                    event.currentTarget.setPointerCapture?.(event.pointerId);
                    canvasPointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
                    if (canvasPointersRef.current.size >= 2) {
                      const points = [...canvasPointersRef.current.values()];
                      pinchRef.current = { distance: Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y), zoom };
                      canvasGestureRef.current = null;
                      return;
                    }
                    canvasGestureRef.current = { clientX: event.clientX, clientY: event.clientY, originX: canvasPan.x, originY: canvasPan.y, moved: false };
                    setCanvasGesture({ pointerId: event.pointerId });
                  }}
                  onWheel={(event) => {
                    if (!event.ctrlKey) return;
                    event.preventDefault();
                    setZoom((value) => Math.max(70, Math.min(140, value + (event.deltaY < 0 ? 5 : -5))));
                  }}
                  onClick={() => {
                    if (recentCanvasPanRef.current || canvasGestureRef.current?.moved) return;
                    if (connectState) {
                      setConnectState(null);
                      setPointerPos(null);
                      setCanvasMode('build');
                      setNotice('Connection cancelled.');
                    } else {
                      setSelectedNodeId(null);
                      setCanvasMode('build');
                    }
                  }}
                  className="builder-stage__canvas"
                  style={{ touchAction: 'none' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '14px 16px', borderBottom: '1px solid rgba(90,82,110,0.08)', background: 'linear-gradient(180deg, rgba(255,255,255,0.96), rgba(246,242,251,0.92))' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <div style={{ padding: '6px 9px', borderRadius: 999, background: 'rgba(168,85,247,0.12)', color: '#5b2c88', fontFamily: 'JetBrains Mono, monospace', fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase' }}>
                        {adminMode ? 'Admin QA lab' : 'Atom Builder'}
                      </div>
                      <div style={{ padding: '6px 9px', borderRadius: 999, background: 'rgba(17,24,39,0.05)', color: '#493d58', fontFamily: 'JetBrains Mono, monospace', fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase' }}>
                        {planRule.editable ? 'Canvas active' : 'Locked on Starter'}
                      </div>
                      <div style={{ color: 'rgba(73,61,88,0.66)', fontFamily: 'Manrope, sans-serif', fontSize: 12 }}>
                        Click a module, branch the path, and tune each step in the inspector.
                      </div>
                    </div>
                    <div style={{ display: 'inline-flex', gap: 8 }}>
                      <button type="button" onClick={undoGraph} disabled={!canUndo} aria-label="Undo" style={{ width: 34, height: 34, borderRadius: 10, border: '1px solid rgba(110,104,128,0.14)', background: '#fff', color: '#4d425d', cursor: canUndo ? 'pointer' : 'not-allowed', opacity: canUndo ? 1 : 0.42 }}>
                        <Undo2 size={14} style={{ marginTop: 2 }} />
                      </button>
                      <button type="button" onClick={redoGraph} disabled={!canRedo} aria-label="Redo" style={{ width: 34, height: 34, borderRadius: 10, border: '1px solid rgba(110,104,128,0.14)', background: '#fff', color: '#4d425d', cursor: canRedo ? 'pointer' : 'not-allowed', opacity: canRedo ? 1 : 0.42 }}>
                        <Redo2 size={14} style={{ marginTop: 2 }} />
                      </button>
                    </div>
                  </div>
                  <div className="builder-stage__gridWash" />
                  <div className="builder-stage__grid" />
                  <div className="builder-stage__glow" />

                    <div style={{ position: 'absolute', inset: 0, transform: `translate(${canvasPan.x}px, ${canvasPan.y}px) scale(${zoomScale})`, transformOrigin: 'center center' }}>
                    <svg viewBox="0 0 1280 760" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
                      <defs>
                        <linearGradient id="edgeStroke" x1="0%" y1="0%" x2="100%" y2="0%">
                          <stop offset="0%" stopColor="rgba(178,176,186,0.95)" />
                          <stop offset="100%" stopColor="rgba(158,112,243,0.92)" />
                        </linearGradient>
                      </defs>
                      {edges.map((edge) => {
                        const from = nodes.find((node) => node.id === edge.from);
                        const to = nodes.find((node) => node.id === edge.to);
                        if (!from || !to) return null;
                        const start = getPortPosition(from, 'right');
                        const end = getPortPosition(to, 'left');
                        const midX = (start.x + end.x) / 2;
                        const midY = (start.y + end.y) / 2;
                        const path = `M ${start.x} ${start.y} C ${midX - 60} ${start.y}, ${midX + 60} ${end.y}, ${end.x} ${end.y}`;
                        return (
                          <g
                            key={`${edge.from}-${edge.to}-${edge.label || ''}`}
                            role="button"
                            tabIndex="0"
                            aria-label={`Remove connection from ${from.title} to ${to.title}`}
                            onClick={(event) => { event.stopPropagation(); removeEdge(edge); }}
                            onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); removeEdge(edge); } }}
                            style={{ cursor: 'pointer' }}
                          >
                            <path d={path} fill="none" stroke="transparent" strokeWidth="22" />
                            <path d={path} fill="none" stroke="url(#edgeStroke)" strokeWidth="4.5" strokeLinecap="round" opacity="0.92" />
                            <rect x={midX - 33} y={midY - 12} rx="10" width="66" height="24" fill="rgba(255,255,255,0.96)" stroke="rgba(150,136,170,0.24)" />
                            <text x={midX} y={midY + 4} textAnchor="middle" style={{ fill: '#5e506f', fontSize: '12px', fontWeight: 700, fontFamily: 'Manrope, sans-serif' }}>
                              {edge.label || 'route'} ×
                            </text>
                          </g>
                        );
                      })}
                      {connectState && pointerPos && (() => {
                        const from = nodes.find((node) => node.id === connectState.sourceId);
                        if (!from) return null;
                        const start = getPortPosition(from, 'right');
                        const midX = (start.x + pointerPos.x) / 2;
                        const path = `M ${start.x} ${start.y} C ${midX - 60} ${start.y}, ${midX + 60} ${pointerPos.y}, ${pointerPos.x} ${pointerPos.y}`;
                        return <path d={path} fill="none" stroke={BUILDER_ACCENT} strokeWidth="4" strokeDasharray="10 10" strokeLinecap="round" opacity="0.9" />;
                      })()}
                    </svg>

                    <div style={{ position: 'absolute', inset: 0 }}>
                      {nodes.map((node) => {
                        const pos = getPosition(node);
                        const active = node.id === selectedNodeId;
                        const locked = !planRule.editable && activePlanName === 'Starter';
                        const isSource = connectState?.sourceId === node.id;
                        const canReceive = Boolean(connectState && connectState.sourceId !== node.id);
                        const nodeIssue = validation.issues.find((entry) => entry.nodeId === node.id && entry.severity === 'error');
                        const nodeRun = nativeRuns[node.id];
                        const nodeStatus = nodeRun?.status || (nodeIssue ? 'Needs setup' : runBusy ? 'Queued' : 'Ready');
                        const quickItems = paletteItems.filter((item) => `${item.label} ${item.subtitle}`.toLowerCase().includes(quickAddQuery.trim().toLowerCase())).slice(0, 6);
                        return (
                          <div
                            key={node.id}
                            style={{
                              position: 'absolute',
                              left: `calc(${(pos.x / 1280) * 100}% - 92px)`,
                              top: `calc(${(pos.y / 760) * 100}% - 38px)`,
                              width: 184,
                              height: 76,
                              zIndex: quickAddNodeId === node.id ? 12 : active ? 5 : 2,
                            }}
                          >
                            <button
                              type="button"
                              className="builder-node"
                              data-active={active}
                              data-status={nodeStatus.toLowerCase().replace(/\s+/g, '-')}
                              onClick={(event) => {
                                event.stopPropagation();
                                setSelectedNodeId(node.id);
                                setCanvasMode('inspect');
                              }}
                              onPointerDown={(event) => {
                                event.stopPropagation();
                                setCanvasMode('build');
                                startDragging(event, node);
                              }}
                               style={{ '--node-color': node.color, cursor: dragState?.id === node.id ? 'grabbing' : 'grab', opacity: node.disabled ? 0.52 : 1 }}
                            >
                              <span className="builder-node__icon"><node.Icon size={18} /></span>
                              <span className="builder-node__copy">
                                <strong>{node.title}</strong>
                                <small>{node.subtitle || nativeKindOf(node)}</small>
                              </span>
                              <span className="builder-node__status">{nodeRun?.status === 'succeeded' ? 'Success' : nodeStatus}</span>
                            </button>

                            {getPorts(node, 'input').map((port, index) => (
                              <button key={`in-${port.id}`} title={port.label} aria-label={`Connect to ${node.title}, ${port.label}`} onPointerDown={(event) => completeConnection(event, node.id)} disabled={!canReceive} style={{ position: 'absolute', left: -20, top: `calc(${18 + index * 20}% - 10px)`, width: 40, height: 40, padding: 0, borderRadius: '50%', border: '0', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: canReceive ? 'pointer' : 'default', opacity: connectState ? 1 : 0.82, zIndex: 3 }}><div style={{ width: 10, height: 10, borderRadius: '50%', border: '2px solid rgba(82,68,104,0.22)', background: canReceive ? BUILDER_ACCENT : 'rgba(92,81,109,0.4)' }} /></button>
                            ))}

                            {getPorts(node, 'output').map((port, index) => (
                              <button key={`out-${port.id}`} title={port.label} aria-label={`Connect from ${node.title}, ${port.label}`} onPointerDown={(event) => { setCanvasMode('connect'); startConnection(event, node.id, port.id); }} style={{ position: 'absolute', right: -20, top: `calc(${18 + index * 20}% - 10px)`, width: 40, height: 40, padding: 0, borderRadius: '50%', border: '0', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'crosshair', zIndex: 3 }}><div style={{ width: 10, height: 10, borderRadius: '50%', border: '2px solid rgba(82,68,104,0.22)', background: isSource ? BUILDER_ACCENT : 'rgba(92,81,109,0.68)' }} /></button>
                            ))}
                            {planRule.editable && (
                              <button
                                type="button"
                                className="builder-node__addNext"
                                aria-label={`Add next Atom after ${node.title}`}
                                onClick={(event) => { event.stopPropagation(); setSelectedNodeId(node.id); setQuickAddNodeId((current) => current === node.id ? null : node.id); setQuickAddQuery(''); }}
                              >
                                <Plus size={14} />
                              </button>
                            )}
                            {quickAddNodeId === node.id && (
                                <div ref={quickAddRef} className="builder-quick-add" role="dialog" aria-label={`Add an Atom after ${node.title}`} onClick={(event) => event.stopPropagation()}>
                                <div className="builder-quick-add__search">
                                  <Search size={13} />
                                  <input autoFocus value={quickAddQuery} onChange={(event) => setQuickAddQuery(event.target.value)} placeholder="Add next Atom" />
                                </div>
                                <div className="builder-quick-add__list">
                                  {quickItems.map((item) => (
                                    <button key={item.id} type="button" onClick={() => appendAtom(item, false, { sourceId: node.id })}>
                                      <span style={{ background: `${item.color}1a`, color: item.color }}><item.Icon size={14} /></span>
                                      <span><strong>{item.label}</strong><small>{item.subtitle}</small></span>
                                    </button>
                                  ))}
                                  {!quickItems.length && <small className="builder-quick-add__empty">No matching Atoms.</small>}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {!planRule.editable && (
                    <div style={{ position: 'absolute', right: 18, bottom: 18, padding: '12px 14px', borderRadius: 16, background: 'rgba(9,13,23,0.84)', border: `1px solid ${BUILDER_BORD}`, color: 'rgba(255,255,255,0.82)', maxWidth: 320, boxShadow: '0 16px 40px rgba(0,0,0,0.22)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, fontFamily: 'Bricolage Grotesque, sans-serif', fontSize: 15, fontWeight: 700 }}>
                        <Lock size={15} color="#f59e0b" /> Paid feature preview
                      </div>
                      <div style={{ fontFamily: 'Manrope, sans-serif', fontSize: 12, lineHeight: 1.55, color: 'rgba(255,255,255,0.62)' }}>
                        Atom Builder unlocks on Pro with 3 live atoms. Enterprise expands to 10 with deeper branching, approvals, and integrations.
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="builder-stage__footer">
                <div style={{ padding: '14px 16px', borderRadius: 16, background: 'rgba(255,255,255,0.04)', border: `1px solid ${BUILDER_BORD}`, color: 'rgba(255,255,255,0.74)', fontFamily: 'Manrope, sans-serif', fontSize: 13 }}>
                  <span style={{ color: '#fff', fontWeight: 700 }}>Status:</span> {notice}
                </div>
              </div>
              <RunConsole
                open={runConsoleOpen}
                onToggle={() => setRunConsoleOpen((open) => !open)}
                status={executionStatus || (runBusy ? 'Running' : runState)}
                runId={activeRunId}
                entries={runLog}
                nodes={nodes}
                nativeRuns={nativeRuns}
                accent={accent}
                border={BUILDER_BORD}
              />
            </div>
          </section>

          <aside className="builder-inspector" style={{ borderRadius: 18, border: `1px solid ${BUILDER_BORD}`, background: 'rgba(8,12,22,0.82)', boxShadow: '0 20px 45px rgba(0,0,0,0.25)', overflow: 'hidden' }}>
            <div style={{ padding: '18px 18px 14px', borderBottom: `1px solid ${BUILDER_BORD}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div>
                  <div style={{ fontFamily: 'Bricolage Grotesque, sans-serif', color: '#fff', fontSize: 18, fontWeight: 700 }}>Inspector</div>
                  <div style={{ fontFamily: 'Manrope, sans-serif', color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 4 }}>{selectedNode ? 'Configure the selected module.' : 'Select a module on the canvas.'}</div>
                </div>
                <div style={{ width: 34, height: 34, borderRadius: 10, background: 'rgba(255,255,255,0.04)', border: `1px solid ${BUILDER_BORD}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Settings2 size={16} color="rgba(255,255,255,0.72)" />
                </div>
              </div>
              <div style={{ display: 'inline-flex', padding: 4, borderRadius: 999, background: 'rgba(255,255,255,0.04)', border: `1px solid ${BUILDER_BORD}`, marginBottom: 14 }}>
                {[
                  ['settings', 'Settings'],
                  ['data', 'Data'],
                  ['run', 'Run'],
                ].map(([id, label]) => {
                  const active = inspectorTab === id;
                  return (
                    <button
                      key={id}
                      onClick={() => setInspectorTab(id)}
                      style={{
                        padding: '7px 12px',
                        borderRadius: 999,
                        border: 'none',
                        background: active ? `${accent}18` : 'transparent',
                        color: active ? '#fff' : 'rgba(255,255,255,0.58)',
                        fontFamily: 'Bricolage Grotesque, sans-serif',
                        fontWeight: 700,
                        fontSize: 12,
                        cursor: 'pointer',
                      }}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>

              <div style={{ display: 'grid', gap: 10 }}>
                {selectedNode ? (
                  <>
                    <div style={{ padding: 14, borderRadius: 16, background: `${selectedNode.color}14`, border: `1px solid ${selectedNode.color}35` }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                        <div style={{ width: 38, height: 38, borderRadius: 12, background: `${selectedNode.color}26`, border: `1px solid ${selectedNode.color}55`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <selectedNode.Icon size={18} color={selectedNode.color} />
                        </div>
                        <div>
                          <div style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, fontSize: 16, color: '#fff' }}>{selectedNode.title}</div>
                          <div style={{ fontFamily: 'Manrope, sans-serif', color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 2 }}>{selectedNode.subtitle}</div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {[
                          { label: selectedNode.mode, icon: Bot },
                          { label: selectedNode.approval, icon: ShieldCheck },
                          { label: `${selectedNode.retries} retries`, icon: Workflow },
                        ].map((item) => (
                          <div key={item.label} style={{ padding: '6px 9px', borderRadius: 999, background: 'rgba(255,255,255,0.08)', border: `1px solid ${BUILDER_BORD}`, color: 'rgba(255,255,255,0.8)', fontFamily: 'Manrope, sans-serif', fontSize: 11, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                            <item.icon size={12} color={selectedNode.color} /> {item.label}
                          </div>
                        ))}
                      </div>
                      {nativeRuns[selectedNode.id] && (
                        <div style={{ marginTop: 10, padding: '9px 11px', borderRadius: 12, border: `1px solid ${BUILDER_BORD}`, background: 'rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', fontFamily: 'Manrope, sans-serif', fontSize: 12 }}>
                          <span style={{ color: 'rgba(255,255,255,0.72)' }}>Last native run</span>
                          <span style={{ color: nativeRuns[selectedNode.id].status === 'failed' ? '#f87171' : nativeRuns[selectedNode.id].status === 'succeeded' ? accent : '#fbbf24', fontWeight: 700, textTransform: 'uppercase', fontFamily: 'JetBrains Mono, monospace', fontSize: 10, letterSpacing: '0.08em' }}>
                            {nativeRuns[selectedNode.id].status}
                            {nativeRuns[selectedNode.id].branch ? ` · ${nativeRuns[selectedNode.id].branch}` : ''}
                          </span>
                        </div>
                      )}
                    </div>

                    <div style={{ padding: 12, borderRadius: 14, background: 'rgba(255,255,255,0.025)', border: `1px solid ${BUILDER_BORD}` }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 9 }}>
                        <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.42)' }}>Typed ports</span>
                        <span style={{ color: selectedNode.color, fontFamily: 'JetBrains Mono, monospace', fontSize: 10 }}>v{selectedNodeDefinition?.version || 1}</span>
                      </div>
                      <div style={{ display: 'grid', gap: 7 }}>
                        {[['in', selectedNodeInputs], ['out', selectedNodeOutputs]].map(([direction, ports]) => (
                          <div key={direction} style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <span style={{ width: 28, color: 'rgba(255,255,255,0.36)', fontFamily: 'JetBrains Mono, monospace', fontSize: 10, textTransform: 'uppercase' }}>{direction}</span>
                            {ports.map((port) => (
                              <span key={port.id} title={port.description} style={{ padding: '4px 7px', borderRadius: 8, border: `1px solid ${port.required ? 'rgba(248,113,113,0.3)' : 'rgba(255,255,255,0.1)'}`, color: port.required ? '#fecaca' : 'rgba(255,255,255,0.72)', fontFamily: 'JetBrains Mono, monospace', fontSize: 10 }}>
                                {port.id} · {port.dataType}{port.required ? ' *' : ''}
                              </span>
                            ))}
                          </div>
                        ))}
                      </div>
                      <div style={{ marginTop: 9, color: 'rgba(255,255,255,0.4)', fontFamily: 'Manrope, sans-serif', fontSize: 10 }}>{selectedNodeConfigFields.length} schema field{selectedNodeConfigFields.length === 1 ? '' : 's'} · {selectedNodeDefinition?.category || 'atom'}</div>
                    </div>

                    {inspectorTab === 'settings' && (
                      <>
                        {[
                          { label: 'Name', field: 'title', as: 'input' },
                          { label: 'Description', field: 'subtitle', as: 'input' },
                        ].map((field) => (
                          <label key={field.field} style={{ display: 'grid', gap: 7 }}>
                            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, letterSpacing: '0.16em', color: 'rgba(255,255,255,0.38)', textTransform: 'uppercase' }}>{field.label}</span>
                            {field.as === 'textarea' ? (
                              <textarea
                                rows={4}
                                value={selectedNode[field.field]}
                                onChange={(event) => updateSelectedNode(field.field, event.target.value)}
                                style={{ width: '100%', resize: 'vertical', borderRadius: 14, border: `1px solid ${BUILDER_BORD}`, background: 'rgba(255,255,255,0.03)', color: '#fff', padding: '12px 13px', fontFamily: 'Manrope, sans-serif', fontSize: 13, lineHeight: 1.5, outline: 'none' }}
                              />
                            ) : (
                              <input
                                value={selectedNode[field.field]}
                                onChange={(event) => updateSelectedNode(field.field, event.target.value)}
                                style={{ width: '100%', borderRadius: 14, border: `1px solid ${BUILDER_BORD}`, background: 'rgba(255,255,255,0.03)', color: '#fff', padding: '12px 13px', fontFamily: 'Manrope, sans-serif', fontSize: 13, outline: 'none' }}
                              />
                            )}
                          </label>
                        ))}
                        <button type="button" onClick={() => updateSelectedNode('disabled', !selectedNode.disabled)} style={{ padding: '10px 12px', borderRadius: 12, border: `1px solid ${selectedNode.disabled ? 'rgba(251,191,36,0.45)' : BUILDER_BORD}`, background: selectedNode.disabled ? 'rgba(251,191,36,0.12)' : 'rgba(255,255,255,0.03)', color: '#fff', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, fontSize: 12, cursor: 'pointer', textAlign: 'left' }}>
                          {selectedNode.disabled ? 'Enable atom' : 'Disable atom'}
                        </button>

                        {(() => {
                          const kind = nativeKindOf(selectedNode);
                          const cfg = selectedNode.config || {};
                          const editorStyle = { display: 'grid', gap: 10, marginTop: 4, padding: 14, borderRadius: 16, background: 'rgba(255,255,255,0.03)', border: `1px solid ${BUILDER_BORD}` };
                          const labelStyle = { fontFamily: 'JetBrains Mono, monospace', fontSize: 10, letterSpacing: '0.16em', color: 'rgba(255,255,255,0.38)', textTransform: 'uppercase' };
                          const textStyle = { width: '100%', borderRadius: 14, border: `1px solid ${BUILDER_BORD}`, background: 'rgba(255,255,255,0.03)', color: '#fff', padding: '12px 13px', fontFamily: 'Manrope, sans-serif', fontSize: 13, outline: 'none', boxSizing: 'border-box' };
                          const addCondition = () => {
                            const group = cfg.groups?.[0] || { groupOperator: 'and', conditions: [] };
                            updateSelectedBranchGroup({ conditions: [...(group.conditions || []), { path: 'input.body.some_field', operator: 'equals', value: '' }] });
                          };
                          const removeCondition = (index) => {
                            const group = cfg.groups?.[0] || { groupOperator: 'and', conditions: [] };
                            updateSelectedBranchGroup({ conditions: (group.conditions || []).filter((_, idx) => idx !== index) });
                          };
                          const mappingEntries = Object.entries(cfg.mapping || {});
                          let body = null;

                          if (kind === 'manual' || kind === 'trigger' || kind === 'webhook' || kind === 'schedule') {
                            body = (
                              <div style={{ fontFamily: 'Manrope, sans-serif', fontSize: 12, lineHeight: 1.6, color: 'rgba(255,255,255,0.66)' }}>
                                This trigger starts the flow. Set its test payload in the <strong style={{ color: '#fff' }}>Run</strong> tab, then run the path to verify the whole chain end to end.
                              </div>
                            );
                          } else if (kind === 'ai') {
                            const selectedConnection = cfg.connection ? `connection:${cfg.connection}` : cfg.credentialRef ? `credential:${cfg.credentialRef}` : '';
                            body = (
                              <>
                                <label style={{ display: 'grid', gap: 7 }}>
                                  <span style={labelStyle}>Provider</span>
                                  <select value={cfg.provider || 'openai'} onChange={(event) => updateSelectedNativeConfig({ provider: event.target.value, model: event.target.value === 'anthropic' ? 'claude-3-5-haiku-latest' : event.target.value === 'gemini' ? 'gemini-2.0-flash' : 'gpt-4o-mini' })} style={textStyle}>
                                    <option value="openai">OpenAI</option>
                                    <option value="anthropic">Anthropic</option>
                                    <option value="gemini">Google Gemini</option>
                                  </select>
                                </label>
                                <label style={{ display: 'grid', gap: 7 }}>
                                  <span style={labelStyle}>Connection</span>
                                  <select
                                    value={selectedConnection}
                                    onFocus={() => { if (canUseWorkspaceBackend && connections === null) refreshConnections(); }}
                                    onChange={(event) => {
                                      const [type, ...parts] = event.target.value.split(':');
                                      const name = parts.join(':');
                                      updateSelectedNativeConfig(type === 'connection' ? { connection: name, credentialRef: '' } : type === 'credential' ? { connection: '', credentialRef: name } : { connection: '', credentialRef: '' });
                                    }}
                                    style={textStyle}
                                  >
                                    <option value="">Choose a connection</option>
                                    {(connections?.connections || []).filter((item) => !cfg.provider || item.provider === cfg.provider || (cfg.provider === 'gemini' && item.provider === 'google')).map((item) => <option key={`connection:${item.id}`} value={`connection:${item.name}`}>{item.name} · connected</option>)}
                                    {(connections?.credentials || []).filter((item) => !cfg.provider || item.provider === cfg.provider || (cfg.provider === 'gemini' && ['google', 'gemini'].includes(item.provider))).map((item) => <option key={`credential:${item.id}`} value={`credential:${item.name}`}>{item.name} · credential</option>)}
                                  </select>
                                  {!canUseWorkspaceBackend && <small style={{ color: 'rgba(255,255,255,0.46)', fontFamily: 'Manrope, sans-serif' }}>{hasSupabaseConfig ? 'Sign in to use workspace connections and encrypted AI credentials.' : 'Connect Supabase to use encrypted AI credentials.'}</small>}
                                </label>
                                <label style={{ display: 'grid', gap: 7 }}>
                                  <span style={labelStyle}>Prompt</span>
                                  <textarea rows={5} value={cfg.prompt || ''} onChange={(event) => updateSelectedNativeConfig({ prompt: event.target.value })} placeholder="Summarize the previous Atom’s output" style={{ ...textStyle, resize: 'vertical', lineHeight: 1.5 }} />
                                </label>
                                <button type="button" onClick={() => setAdvancedOpen((open) => !open)} style={{ padding: '9px 11px', borderRadius: 12, border: `1px solid ${BUILDER_BORD}`, background: 'rgba(255,255,255,0.03)', color: 'rgba(255,255,255,0.76)', fontFamily: 'Manrope, sans-serif', fontSize: 12, cursor: 'pointer' }}>
                                  {advancedOpen ? 'Hide advanced' : 'Advanced'}
                                </button>
                                {advancedOpen && (
                                  <div style={{ display: 'grid', gap: 9 }}>
                                    <label style={{ display: 'grid', gap: 7 }}><span style={labelStyle}>Model</span><input value={cfg.model || ''} onChange={(event) => updateSelectedNativeConfig({ model: event.target.value })} style={textStyle} /></label>
                                    <label style={{ display: 'grid', gap: 7 }}><span style={labelStyle}>System instructions</span><textarea rows={4} value={cfg.systemPrompt || ''} onChange={(event) => updateSelectedNativeConfig({ systemPrompt: event.target.value })} style={{ ...textStyle, resize: 'vertical' }} /></label>
                                    <label style={{ display: 'grid', gap: 7 }}><span style={labelStyle}>Temperature</span><input type="number" min="0" max="2" step="0.1" value={cfg.temperature ?? 0} onChange={(event) => updateSelectedNativeConfig({ temperature: Number(event.target.value) })} style={textStyle} /></label>
                                    <label style={{ display: 'grid', gap: 7 }}><span style={labelStyle}>Max tokens</span><input type="number" min="1" value={cfg.maxTokens ?? 1024} onChange={(event) => updateSelectedNativeConfig({ maxTokens: Number(event.target.value) })} style={textStyle} /></label>
                                  </div>
                                )}
                              </>
                            );
                          } else if (kind === 'http') {
                            body = (
                              <>
                                <label style={{ display: 'grid', gap: 7 }}>
                                  <span style={labelStyle}>URL</span>
                                  <input value={cfg.url || ''} onChange={(event) => updateSelectedNativeConfig({ url: event.target.value })} placeholder="https://api.example.com/endpoint" style={textStyle} />
                                </label>
                                <div>
                                  <span style={{ ...labelStyle, display: 'block', marginBottom: 7 }}>Method</span>
                                  <div style={{ display: 'inline-flex', padding: 4, borderRadius: 999, background: 'rgba(255,255,255,0.04)', border: `1px solid ${BUILDER_BORD}`, flexWrap: 'wrap', gap: 4 }}>
                                    {['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((method) => {
                                      const active = (cfg.method || 'POST') === method;
                                      return (
                                        <button key={method} onClick={() => updateSelectedNativeConfig({ method })} style={{ padding: '7px 12px', borderRadius: 999, border: 'none', background: active ? `${accent}18` : 'transparent', color: active ? '#fff' : 'rgba(255,255,255,0.58)', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                                          {method}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                                <label style={{ display: 'grid', gap: 7 }}>
                                  <span style={labelStyle}>Authentication</span>
                                  <select value={cfg.connection || cfg.credential || ''} onFocus={() => { if (canUseWorkspaceBackend && connections === null) refreshConnections(); }} onChange={(event) => updateSelectedNativeConfig({ connection: event.target.value, credential: '' })} style={textStyle}>
                                    <option value="">No authentication</option>
                                    {(connections?.connections || []).map((item) => <option key={item.id} value={item.name}>{item.name}</option>)}
                                  </select>
                                </label>
                                <button type="button" onClick={() => setAdvancedOpen((open) => !open)} style={{ padding: '9px 11px', borderRadius: 12, border: `1px solid ${BUILDER_BORD}`, background: 'rgba(255,255,255,0.03)', color: 'rgba(255,255,255,0.76)', fontFamily: 'Manrope, sans-serif', fontSize: 12, cursor: 'pointer' }}>{advancedOpen ? 'Hide advanced' : 'More options'}</button>
                                {advancedOpen && <div style={{ display: 'grid', gap: 10 }}>
                                  <label style={{ display: 'grid', gap: 7 }}><span style={labelStyle}>Headers</span><RawJsonEditor key={`${selectedNode.id}-hdr`} initial={cfg.headers || {}} onChange={(headers) => updateSelectedNativeConfig({ headers })} placeholder='{ "X-Request-ID": "{{ execution.id }}" }' compact /></label>
                                  <label style={{ display: 'grid', gap: 7 }}><span style={labelStyle}>Body</span><RawJsonEditor key={`${selectedNode.id}-body`} initial={cfg.body || {}} onChange={(body) => updateSelectedNativeConfig({ body })} placeholder='{ "summary": "{{ previous.output.content }}" }' compact /></label>
                                  <label style={{ display: 'grid', gap: 7 }}><span style={labelStyle}>Query parameters</span><RawJsonEditor key={`${selectedNode.id}-query`} initial={cfg.query || {}} onChange={(query) => updateSelectedNativeConfig({ query })} placeholder='{ "page": 1 }' compact /></label>
                                  <label style={{ display: 'grid', gap: 7 }}><span style={labelStyle}>Timeout (ms)</span><input type="number" min="100" value={cfg.timeoutMs ?? 15000} onChange={(event) => updateSelectedNativeConfig({ timeoutMs: Number(event.target.value) })} style={textStyle} /></label>
                                </div>}
                              </>
                            );
                          } else if (kind === 'make') {
                            body = (
                              <>
                                <div style={{ fontFamily: 'Manrope, sans-serif', fontSize: 12, lineHeight: 1.6, color: 'rgba(255,255,255,0.66)' }}>
                                  Make webhook nodes run through the native engine's HTTP client with SSRF protection.
                                </div>
                                <label style={{ display: 'grid', gap: 7 }}>
                                  <span style={labelStyle}>Webhook URL</span>
                                  <input value={cfg.url || ''} onChange={(event) => updateSelectedNativeConfig({ url: event.target.value })} placeholder="https://hook.us2.make.com/..." style={textStyle} />
                                </label>
                                <label style={{ display: 'grid', gap: 7 }}>
                                  <span style={labelStyle}>Payload (JSON)</span>
                                  <RawJsonEditor key={`${selectedNode.id}-make`} initial={cfg.body ?? cfg.headers ?? {}} onChange={(headers) => updateSelectedNativeConfig({ headers })} placeholder='{ "body": { "amount": 300 } }' compact />
                                </label>
                              </>
                            );
                          } else if (kind === 'transform' || kind === 'agent') {
                            body = (
                              <>
                                <div style={{ fontFamily: 'Manrope, sans-serif', fontSize: 12, lineHeight: 1.6, color: 'rgba(255,255,255,0.66)' }}>
                                  Map fields to expressions. Upstream output is available as <strong style={{ color: '#fff' }}>previous.output</strong> and the trigger payload as <strong style={{ color: '#fff' }}>input</strong>.
                                </div>
                                {mappingEntries.map(([key, value]) => (
                                  <div key={key} style={{ display: 'grid', gap: 7, padding: 9, borderRadius: 12, border: `1px solid ${BUILDER_BORD}`, background: 'rgba(255,255,255,0.02)' }}>
                                    <div style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
                                      <input aria-label="Output field name" value={key} onChange={(event) => { const entries = Object.entries(cfg.mapping || {}); const next = {}; entries.forEach(([k, v], idx) => { next[idx === entries.findIndex((e) => e[0] === key) ? event.target.value : k] = v; }); updateSelectedNativeConfig({ mapping: next }); }} style={{ ...textStyle, width: '38%', fontFamily: 'JetBrains Mono, monospace', fontSize: 11 }} />
                                      <input aria-label={`Value for ${key}`} value={typeof value === 'string' ? value : JSON.stringify(value)} onChange={(event) => updateSelectedMapping(key, event.target.value)} placeholder="Type a value" style={{ ...textStyle, flex: 1, fontFamily: 'JetBrains Mono, monospace', fontSize: 11 }} />
                                    <button onClick={() => { const next = { ...(cfg.mapping || {}) }; delete next[key]; updateSelectedNativeConfig({ mapping: next }); }} style={{ width: 30, height: 30, borderRadius: 9, border: 'none', background: 'rgba(239,68,68,0.12)', color: '#f87171', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', alignSelf: 'center' }}>
                                      <X size={13} />
                                    </button>
                                    </div>
                                    <select aria-label={`Insert upstream data for ${key}`} value="" onChange={(event) => { if (event.target.value) updateSelectedMapping(key, event.target.value); }} style={{ ...textStyle, padding: '9px 10px', fontSize: 11 }}>
                                      <option value="">Insert data…</option>
                                      <option value="{{ previous.output }}">Previous Atom → entire output</option>
                                      <option value="{{ trigger }}">Trigger → payload</option>
                                      {upstreamNodes.map((upstream) => {
                                        const output = nativeRuns[upstream.id]?.output;
                                        const fields = output && typeof output === 'object' && !Array.isArray(output) ? Object.keys(output).slice(0, 12) : [];
                                        return (
                                          <optgroup key={upstream.id} label={upstream.title}>
                                            <option value={`{{ nodes['${upstream.id}'].output }}`}>Entire output</option>
                                            {fields.map((field) => <option key={field} value={`{{ nodes['${upstream.id}'].output['${field}'] }}`}>{field}</option>)}
                                          </optgroup>
                                        );
                                      })}
                                    </select>
                                  </div>
                                ))}
                                <button onClick={() => updateSelectedMapping(`field_${Date.now()}`, '')} style={{ padding: '9px 11px', borderRadius: 12, border: `1px dashed ${BUILDER_BORD}`, background: 'rgba(255,255,255,0.03)', color: '#fff', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                                  + Add mapping
                                </button>
                              </>
                            );
                          } else if (kind === 'branch') {
                            const group = cfg.groups?.[0] || { groupOperator: 'and', conditions: [] };
                            body = (
                              <>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                                  <span style={labelStyle}>Group operator</span>
                                  <div style={{ display: 'inline-flex', padding: 3, borderRadius: 999, background: 'rgba(255,255,255,0.04)', border: `1px solid ${BUILDER_BORD}` }}>
                                    {['and', 'or'].map((op) => (
                                      <button key={op} onClick={() => updateSelectedBranchGroup({ groupOperator: op })} style={{ padding: '6px 12px', borderRadius: 999, border: 'none', background: (group.groupOperator || 'and') === op ? `${accent}18` : 'transparent', color: (group.groupOperator || 'and') === op ? '#fff' : 'rgba(255,255,255,0.58)', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, fontSize: 12, textTransform: 'uppercase', cursor: 'pointer' }}>
                                        {op}
                                      </button>
                                    ))}
                                  </div>
                                </div>
                                <div style={{ display: 'grid', gap: 8 }}>
                                  {(group.conditions || []).map((cond, index) => (
                                    <div key={index} style={{ display: 'grid', gap: 6, padding: 11, borderRadius: 12, border: `1px solid ${BUILDER_BORD}`, background: 'rgba(255,255,255,0.025)' }}>
                                      <div style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
                                        <input value={cond.path || ''} onChange={(event) => updateSelectedBranchCondition(index, { path: event.target.value })} placeholder="path.to.field" style={{ ...textStyle, width: '42%', fontFamily: 'JetBrains Mono, monospace', fontSize: 11 }} />
                                        <select value={cond.operator || 'equals'} onChange={(event) => updateSelectedBranchCondition(index, { operator: event.target.value })} style={{ ...textStyle, width: '31%', padding: '10px 11px' }}>
                                          {BRANCH_OPERATORS.map(([op, label]) => <option key={op} value={op}>{label}</option>)}
                                        </select>
                                        <button onClick={() => removeCondition(index)} style={{ width: 30, height: 30, borderRadius: 9, border: 'none', background: 'rgba(239,68,68,0.12)', color: '#f87171', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', alignSelf: 'center' }}>
                                          <X size={13} />
                                        </button>
                                      </div>
                                      <input value={typeof cond.value === 'string' ? cond.value : JSON.stringify(cond.value ?? '')} onChange={(event) => updateSelectedBranchCondition(index, { value: event.target.value })} placeholder="expected value" style={{ ...textStyle, fontFamily: 'JetBrains Mono, monospace', fontSize: 11 }} />
                                    </div>
                                  ))}
                                </div>
                                <button onClick={addCondition} style={{ padding: '9px 11px', borderRadius: 12, border: `1px dashed ${BUILDER_BORD}`, background: 'rgba(255,255,255,0.03)', color: '#fff', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                                  + Add condition
                                </button>
                              </>
                            );
                          } else if (kind === 'delay') {
                            body = (
                              <>
                                <div style={{ fontFamily: 'Manrope, sans-serif', fontSize: 12, lineHeight: 1.6, color: 'rgba(255,255,255,0.66)' }}>
                                  Pause the flow for a fixed number of seconds before continuing.
                                </div>
                                <label style={{ display: 'grid', gap: 7 }}>
                                  <span style={labelStyle}>Seconds</span>
                                  <input type="number" min={0} value={cfg.seconds ?? 10} onChange={(event) => updateSelectedNativeConfig({ seconds: Math.max(0, Number(event.target.value) || 0) })} style={textStyle} />
                                </label>
                              </>
                            );
                          } else if (kind === 'approval') {
                            body = (
                              <>
                                <label style={{ display: 'grid', gap: 7 }}>
                                  <span style={labelStyle}>Title</span>
                                  <input value={cfg.title || ''} onChange={(event) => updateSelectedNativeConfig({ title: event.target.value })} style={textStyle} />
                                </label>
                                <label style={{ display: 'grid', gap: 7 }}>
                                  <span style={labelStyle}>Message</span>
                                  <input value={cfg.message || ''} onChange={(event) => updateSelectedNativeConfig({ message: event.target.value })} style={textStyle} />
                                </label>
                              </>
                            );
                          } else {
                            body = (
                              <div style={{ fontFamily: 'Manrope, sans-serif', fontSize: 12, lineHeight: 1.6, color: 'rgba(255,255,255,0.66)' }}>
                                This connector (kind <strong style={{ color: '#fff' }}>{kind}</strong>) is not enabled in the native engine yet. It will stop with a <code style={{ fontFamily: 'JetBrains Mono, monospace' }}>not_enabled</code> error until a connector is shipped.
                              </div>
                            );
                          }

                          return (
                            <div style={editorStyle}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                                <span style={{ fontFamily: 'Bricolage Grotesque, sans-serif', color: '#fff', fontSize: 13, fontWeight: 700 }}>Native config</span>
                                <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, letterSpacing: '0.12em', color: 'rgba(255,255,255,0.42)', textTransform: 'uppercase' }}>{kind}</span>
                              </div>
                              <div style={{ display: 'grid', gap: 10 }}>{body}</div>
                            </div>
                          );
                        })()}

                        {nodeSupportsMake(selectedNode) && (
                          <div style={{ display: 'grid', gap: 10, marginTop: 4, padding: 14, borderRadius: 16, background: 'rgba(255,255,255,0.03)', border: `1px solid ${BUILDER_BORD}` }}>
                            <div>
                              <div style={{ fontFamily: 'Bricolage Grotesque, sans-serif', color: '#fff', fontSize: 15, fontWeight: 700 }}>Make connection</div>
                              <div style={{ fontFamily: 'Manrope, sans-serif', color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 4 }}>
                                Link this atom to the scenario you already built in Make by pasting its webhook here.
                              </div>
                            </div>

                            <button
                              onClick={() => updateSelectedMakeConfig('enabled', !selectedNode.makeConfig?.enabled)}
                              style={{
                                padding: '10px 12px',
                                borderRadius: 12,
                                border: `1px solid ${selectedNode.makeConfig?.enabled ? `${accent}55` : BUILDER_BORD}`,
                                background: selectedNode.makeConfig?.enabled ? `${accent}14` : 'rgba(255,255,255,0.03)',
                                color: '#fff',
                                fontFamily: 'Bricolage Grotesque, sans-serif',
                                fontWeight: 700,
                                fontSize: 13,
                                display: 'inline-flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                cursor: 'pointer',
                              }}
                            >
                              <span>{selectedNode.makeConfig?.enabled ? 'Live Make sync enabled' : 'Make sync disabled'}</span>
                              <span style={{ color: selectedNode.makeConfig?.enabled ? accent : 'rgba(255,255,255,0.44)' }}>
                                {selectedNode.makeConfig?.enabled ? 'ON' : 'OFF'}
                              </span>
                            </button>

                            <label style={{ display: 'grid', gap: 7 }}>
                              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, letterSpacing: '0.16em', color: 'rgba(255,255,255,0.38)', textTransform: 'uppercase' }}>Scenario label</span>
                              <input
                                value={selectedNode.makeConfig?.scenarioName || ''}
                                onChange={(event) => updateSelectedMakeConfig('scenarioName', event.target.value)}
                                style={{ width: '100%', borderRadius: 14, border: `1px solid ${BUILDER_BORD}`, background: 'rgba(255,255,255,0.03)', color: '#fff', padding: '12px 13px', fontFamily: 'Manrope, sans-serif', fontSize: 13, outline: 'none' }}
                              />
                            </label>

                            <label style={{ display: 'grid', gap: 7 }}>
                              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, letterSpacing: '0.16em', color: 'rgba(255,255,255,0.38)', textTransform: 'uppercase' }}>Webhook URL</span>
                              <input
                                value={selectedNode.makeConfig?.webhookUrl || ''}
                                onChange={(event) => updateSelectedMakeConfig('webhookUrl', event.target.value)}
                                placeholder="https://hook.us2.make.com/..."
                                style={{ width: '100%', borderRadius: 14, border: `1px solid ${BUILDER_BORD}`, background: 'rgba(255,255,255,0.03)', color: '#fff', padding: '12px 13px', fontFamily: 'Manrope, sans-serif', fontSize: 13, outline: 'none' }}
                              />
                            </label>

                            <div style={{ display: 'inline-flex', padding: 4, borderRadius: 999, background: 'rgba(255,255,255,0.04)', border: `1px solid ${BUILDER_BORD}`, width: 'fit-content' }}>
                              {['POST', 'GET'].map((method) => {
                                const active = (selectedNode.makeConfig?.method || 'POST') === method;
                                return (
                                  <button
                                    key={method}
                                    onClick={() => updateSelectedMakeConfig('method', method)}
                                    style={{
                                      padding: '7px 12px',
                                      borderRadius: 999,
                                      border: 'none',
                                      background: active ? `${accent}18` : 'transparent',
                                      color: active ? '#fff' : 'rgba(255,255,255,0.58)',
                                      fontFamily: 'Bricolage Grotesque, sans-serif',
                                      fontWeight: 700,
                                      fontSize: 12,
                                      cursor: 'pointer',
                                    }}
                                  >
                                    {method}
                                  </button>
                                );
                              })}
                            </div>

                            {(() => {
                              let parsedSchema = null;
                              try {
                                parsedSchema = JSON.parse(selectedNode.makeConfig?.schema || 'null');
                              } catch {
                                parsedSchema = null;
                              }
                              const schemaFields = Array.isArray(parsedSchema?.inputs)
                                ? parsedSchema.inputs
                                : Array.isArray(parsedSchema?.fields)
                                  ? parsedSchema.fields
                                  : [];

                              return (
                                <div style={{ display: 'grid', gap: 10, padding: 12, borderRadius: 14, border: `1px solid ${BUILDER_BORD}`, background: 'rgba(255,255,255,0.025)' }}>
                                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                                    <div style={{ display: 'grid', gap: 5 }}>
                                      <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, letterSpacing: '0.16em', color: 'rgba(255,255,255,0.38)', textTransform: 'uppercase' }}>
                                        Payload profile
                                      </div>
                                      <div style={{ fontFamily: 'Bricolage Grotesque, sans-serif', color: '#fff', fontSize: 14, fontWeight: 700 }}>
                                        {parsedSchema?.label || `${selectedNode.title} payload`}
                                      </div>
                                      <div style={{ fontFamily: 'Manrope, sans-serif', color: 'rgba(255,255,255,0.6)', fontSize: 12, lineHeight: 1.55 }}>
                                        {parsedSchema?.objective || 'Use this schema to shape the input your Make scenario expects.'}
                                      </div>
                                    </div>

                                    <button
                                      onClick={resetSelectedNodePayloadTemplate}
                                      style={{
                                        padding: '9px 11px',
                                        borderRadius: 11,
                                        border: `1px solid ${BUILDER_BORD}`,
                                        background: 'rgba(255,255,255,0.04)',
                                        color: '#fff',
                                        fontFamily: 'Bricolage Grotesque, sans-serif',
                                        fontWeight: 700,
                                        fontSize: 12,
                                        cursor: 'pointer',
                                        whiteSpace: 'nowrap',
                                      }}
                                    >
                                      Reset payload template
                                    </button>
                                  </div>

                                  <div style={{ display: 'grid', gap: 8 }}>
                                    {schemaFields.length ? schemaFields.map((field) => (
                                      <div
                                        key={field.key || field.name || field.label}
                                        style={{
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'space-between',
                                          gap: 12,
                                          padding: '9px 11px',
                                          borderRadius: 12,
                                          background: 'rgba(255,255,255,0.03)',
                                          border: `1px solid ${BUILDER_BORD}`,
                                        }}
                                      >
                                        <div style={{ display: 'grid', gap: 2 }}>
                                          <div style={{ color: '#fff', fontFamily: 'Manrope, sans-serif', fontSize: 12, fontWeight: 700 }}>
                                            {field.label || field.key || field.name}
                                          </div>
                                          <div style={{ color: 'rgba(255,255,255,0.48)', fontFamily: 'JetBrains Mono, monospace', fontSize: 10 }}>
                                            {field.key || field.name}
                                          </div>
                                        </div>
                                        <div style={{ color: field.required ? '#fda4af' : 'rgba(255,255,255,0.48)', fontFamily: 'JetBrains Mono, monospace', fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                                          {field.required ? 'Required' : 'Optional'}
                                        </div>
                                      </div>
                                    )) : (
                                      <div style={{ color: 'rgba(255,255,255,0.56)', fontFamily: 'Manrope, sans-serif', fontSize: 12, lineHeight: 1.55 }}>
                                        No structured field list is attached to this node yet.
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })()}

                            <label style={{ display: 'grid', gap: 7 }}>
                              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, letterSpacing: '0.16em', color: 'rgba(255,255,255,0.38)', textTransform: 'uppercase' }}>Headers (JSON)</span>
                              <textarea
                                rows={4}
                                value={selectedNode.makeConfig?.headers || ''}
                                onChange={(event) => updateSelectedMakeConfig('headers', event.target.value)}
                                placeholder='{"Authorization":"Bearer ..."}'
                                style={{ width: '100%', resize: 'vertical', borderRadius: 14, border: `1px solid ${BUILDER_BORD}`, background: 'rgba(255,255,255,0.03)', color: '#fff', padding: '12px 13px', fontFamily: 'JetBrains Mono, monospace', fontSize: 12, lineHeight: 1.6, outline: 'none' }}
                              />
                            </label>

                            <label style={{ display: 'grid', gap: 7 }}>
                              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, letterSpacing: '0.16em', color: 'rgba(255,255,255,0.38)', textTransform: 'uppercase' }}>Test payload</span>
                              <textarea
                                rows={7}
                                value={selectedNode.makeConfig?.payload || ''}
                                onChange={(event) => updateSelectedMakeConfig('payload', event.target.value)}
                                style={{ width: '100%', resize: 'vertical', borderRadius: 14, border: `1px solid ${BUILDER_BORD}`, background: 'rgba(255,255,255,0.03)', color: '#fff', padding: '12px 13px', fontFamily: 'JetBrains Mono, monospace', fontSize: 12, lineHeight: 1.6, outline: 'none' }}
                              />
                            </label>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                              <button onClick={testSelectedMakeNode} disabled={runBusy} style={{ padding: '11px 13px', borderRadius: 12, border: `1px solid ${BUILDER_BORD}`, background: 'rgba(255,255,255,0.04)', color: '#fff', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, fontSize: 13, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, cursor: runBusy ? 'wait' : 'pointer', opacity: runBusy ? 0.72 : 1 }}>
                                <Webhook size={14} /> Send test
                              </button>
                              <div style={{ padding: '11px 13px', borderRadius: 12, border: `1px solid ${BUILDER_BORD}`, background: 'rgba(255,255,255,0.03)', color: 'rgba(255,255,255,0.72)', fontFamily: 'Manrope, sans-serif', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                {selectedNode.makeConfig?.lastStatus || 'Not connected'}
                              </div>
                            </div>
                          </div>
                        )}
                      </>
                    )}

                    {inspectorTab === 'data' && (
                      <div style={{ display: 'grid', gap: 10 }}>
                        {[
                          ['Incoming links', `${incomingCount}`],
                          ['Outgoing links', `${outgoingCount}`],
                          ['Mapped fields', `${Object.keys(selectedNode.config?.mapping || {}).length}`],
                          ['Available sources', `${upstreamNodes.length + 1}`],
                          ['Payload mode', nativeKindOf(selectedNode) === 'branch' ? 'Condition set' : 'Structured data'],
                        ].map(([label, value]) => (
                          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '12px 13px', borderRadius: 14, border: `1px solid ${BUILDER_BORD}`, background: 'rgba(255,255,255,0.03)', fontFamily: 'Manrope, sans-serif', fontSize: 13, color: 'rgba(255,255,255,0.74)' }}>
                            <span>{label}</span>
                            <span style={{ color: '#fff', fontWeight: 700 }}>{value}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {inspectorTab === 'run' && (
                      <div style={{ display: 'grid', gap: 10 }}>
                        {nativeKindOf(selectedNode) === 'manual' || nativeKindOf(selectedNode) === 'trigger' ? (
                          <label style={{ display: 'grid', gap: 7 }}>
                            <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, letterSpacing: '0.16em', color: 'rgba(255,255,255,0.38)', textTransform: 'uppercase' }}>Manual trigger payload (JSON)</span>
                            <RawJsonEditor key={`${selectedNode.id}-payload`} initial={(() => { try { return JSON.parse(manualPayload || '{}'); } catch { return { body: {} }; } })()} onChange={(payload) => setManualPayload(JSON.stringify(payload, null, 2))} placeholder='{ "body": { "amount": 300 } }' compact />
                            <span style={{ fontFamily: 'Manrope, sans-serif', fontSize: 11, lineHeight: 1.55, color: 'rgba(255,255,255,0.5)' }}>
                              This payload is sent through the whole graph as <strong style={{ color: '#fff' }}>input</strong> (e.g. <code style={{ fontFamily: 'JetBrains Mono, monospace' }}>input.body.amount</code>).
                            </span>
                          </label>
                        ) : (
                          <div style={{ padding: '11px 13px', borderRadius: 14, border: `1px solid ${BUILDER_BORD}`, background: 'rgba(255,255,255,0.03)', fontFamily: 'Manrope, sans-serif', fontSize: 12, lineHeight: 1.6, color: 'rgba(255,255,255,0.66)' }}>
                            This atom consumes <strong style={{ color: '#fff' }}>previous.output</strong> from the upstream atom and exposes its own output to the next atom in the chain.
                          </div>
                        )}

                        {(() => {
                          const run = nativeRuns[selectedNode.id];
                          const rows = [
                            ['Run id', activeRunId ? activeRunId.slice(0, 8) : '—'],
                            ['Status', run ? run.status : 'Idle'],
                            ['Branch', run && run.branch ? String(run.branch).toUpperCase() : '—'],
                            ['Attempt', run ? `${run.attempt ?? 1}` : '—'],
                            ['HTTP status', run && run.httpStatus ? String(run.httpStatus) : '—'],
                            ['Retries', `${selectedNode.retries}`],
                          ];
                          const runDetail = run ? (run.error ? (typeof run.error === 'string' ? run.error : run.error.message || JSON.stringify(run.error)) : run.output ? (typeof run.output === 'string' ? run.output : JSON.stringify(run.output)) : null) : null;
                          return (
                            <>
                              {rows.map(([label, value]) => (
                                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '12px 13px', borderRadius: 14, border: `1px solid ${BUILDER_BORD}`, background: 'rgba(255,255,255,0.03)', fontFamily: 'Manrope, sans-serif', fontSize: 13, color: 'rgba(255,255,255,0.74)' }}>
                                  <span>{label}</span>
                                  <span style={{ color: '#fff', fontWeight: 700, textAlign: 'right', textTransform: 'uppercase' }}>{value}</span>
                                </div>
                              ))}
                              {runDetail && (
                                <div style={{ padding: 12, borderRadius: 14, border: `1px solid ${BUILDER_BORD}`, background: 'rgba(255,255,255,0.03)' }}>
                                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, letterSpacing: '0.16em', color: 'rgba(255,255,255,0.38)', textTransform: 'uppercase', marginBottom: 8 }}>
                                    Output
                                  </div>
                                  <div style={{ color: 'rgba(255,255,255,0.72)', fontFamily: 'JetBrains Mono, monospace', fontSize: 11, lineHeight: 1.55, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                    {runDetail}
                                  </div>
                                </div>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    )}

                    <div className="builder-actions" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <button onClick={duplicateSelectedNode} style={{ padding: '11px 13px', borderRadius: 12, border: `1px solid ${BUILDER_BORD}`, background: 'rgba(255,255,255,0.04)', color: '#fff', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, fontSize: 13, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, cursor: 'pointer' }}>
                        <CopyPlus size={14} /> Duplicate
                      </button>
                      <button onClick={removeSelectedNode} style={{ padding: '11px 13px', borderRadius: 12, border: `1px solid rgba(239,68,68,0.32)`, background: 'rgba(239,68,68,0.08)', color: '#fff', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, fontSize: 13, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, cursor: 'pointer' }}>
                        <Trash2 size={14} /> Remove
                      </button>
                    </div>
                  </>
                ) : (
                  <div style={{ padding: 18, borderRadius: 16, background: 'rgba(255,255,255,0.03)', border: `1px solid ${BUILDER_BORD}`, color: 'rgba(255,255,255,0.6)', fontFamily: 'Manrope, sans-serif', fontSize: 13 }}>
                    Click an atom in the canvas to inspect it here.
                  </div>
                )}
              </div>
            </div>

            {managementOpen && <div className="builder-management" style={{ padding: 18, display: 'grid', gap: 12 }}>
              <div style={{ padding: 16, borderRadius: 16, background: 'rgba(255,255,255,0.03)', border: `1px solid ${BUILDER_BORD}` }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#fff', fontFamily: 'Bricolage Grotesque, sans-serif', fontSize: 15, fontWeight: 700 }}>
                    <FolderOpen size={15} color={accent} /> Saved automations
                  </div>
                  <button onClick={refreshSavedFlows} disabled={flowsBusy} style={{ width: 32, height: 32, borderRadius: 10, border: `1px solid ${BUILDER_BORD}`, background: 'rgba(255,255,255,0.04)', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: flowsBusy ? 'wait' : 'pointer', opacity: flowsBusy ? 0.72 : 1 }}>
                    <RefreshCw size={14} />
                  </button>
                </div>
                <div style={{ display: 'grid', gap: 8 }}>
                  {savedFlows.length ? savedFlows.map((flow) => {
                    const active = flow.id === flowId;
                    return (
                      <button
                        key={flow.id}
                        onClick={() => loadSavedFlow(flow.id)}
                        style={{
                          width: '100%',
                          textAlign: 'left',
                          padding: '11px 12px',
                          borderRadius: 12,
                          border: `1px solid ${active ? `${accent}55` : BUILDER_BORD}`,
                          background: active ? `${accent}10` : 'rgba(255,255,255,0.03)',
                          color: '#fff',
                          cursor: 'pointer',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                          <div style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontSize: 13, fontWeight: 700 }}>{flow.name}</div>
                          <div style={{ color: accent, fontFamily: 'JetBrains Mono, monospace', fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase' }}>{flow.plan_name}</div>
                        </div>
                        <div style={{ color: 'rgba(255,255,255,0.56)', fontFamily: 'Manrope, sans-serif', fontSize: 11, lineHeight: 1.5 }}>
                          {flow.summary || 'No summary yet.'}
                        </div>
                      </button>
                    );
                  }) : (
                    <div style={{ color: 'rgba(255,255,255,0.58)', fontFamily: 'Manrope, sans-serif', fontSize: 12, lineHeight: 1.6 }}>
                      No saved automations yet. Save to the backend to keep QA drafts and reload them later.
                    </div>
                  )}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
                  <button onClick={() => createFreshFlow(activePlanName === 'Starter' ? 'Pro' : activePlanName)} style={{ padding: '10px 12px', borderRadius: 12, border: `1px solid ${BUILDER_BORD}`, background: 'rgba(255,255,255,0.04)', color: '#fff', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                    New draft
                  </button>
                  <button onClick={() => setPendingDelete({ kind: 'flow', id: flowId, label: flowName })} disabled={!flowId || flowsBusy} style={{ padding: '10px 12px', borderRadius: 12, border: `1px solid rgba(239,68,68,0.32)`, background: 'rgba(239,68,68,0.08)', color: '#fff', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, fontSize: 12, cursor: !flowId || flowsBusy ? 'not-allowed' : 'pointer', opacity: !flowId || flowsBusy ? 0.5 : 1 }}>
                    Delete saved
                  </button>
                </div>
              </div>

              <div style={{ padding: 16, borderRadius: 16, background: 'rgba(255,255,255,0.03)', border: `1px solid ${BUILDER_BORD}` }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#fff', fontFamily: 'Bricolage Grotesque, sans-serif', fontSize: 15, fontWeight: 700 }}>
                    <Database size={15} color={accent} /> Backend status
                  </div>
                  <button onClick={() => refreshBackendStatus()} disabled={backendStatusBusy || !canUseWorkspaceBackend} style={{ width: 32, height: 32, borderRadius: 10, border: `1px solid ${BUILDER_BORD}`, background: 'rgba(255,255,255,0.04)', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: backendStatusBusy || !canUseWorkspaceBackend ? 'not-allowed' : 'pointer', opacity: backendStatusBusy || !canUseWorkspaceBackend ? 0.55 : 1 }}>
                    <RefreshCw size={14} />
                  </button>
                </div>
                <div style={{ color: 'rgba(255,255,255,0.58)', fontFamily: 'Manrope, sans-serif', fontSize: 12, lineHeight: 1.6 }}>
                  {hasSupabaseConfig
                    ? `This builder is ready to save flows and run scenarios through Supabase. ${flowId ? `Flow ID: ${flowId}` : 'Save once to create the first backend record.'}`
                    : 'Supabase keys are not configured in this local app yet, so the builder is still running in local preview mode.'}
                </div>
                <div style={{ display: 'grid', gap: 8, marginTop: 12 }}>
                  {[
                    ['Frontend env', hasSupabaseConfig ? 'Configured' : 'Missing keys'],
                    ['Edge function', hasSupabaseConfig ? (backendStatus?.frontendToEdge ? 'Reachable' : backendStatusBusy ? 'Checking' : 'Unverified') : 'Unavailable'],
                    ['Server credentials', hasSupabaseConfig ? (backendStatus?.serverCredentials ? 'Ready' : backendStatusBusy ? 'Checking' : 'Unverified') : 'Unavailable'],
                  ].map(([label, value]) => (
                    <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '10px 11px', borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: `1px solid ${BUILDER_BORD}`, color: 'rgba(255,255,255,0.7)', fontFamily: 'Manrope, sans-serif', fontSize: 12 }}>
                      <span>{label}</span>
                      <span style={{ color: '#fff', fontWeight: 700, textAlign: 'right' }}>{value}</span>
                    </div>
                  ))}
                </div>
                {backendStatus?.error && (
                  <div style={{ marginTop: 10, color: '#fda4af', fontFamily: 'Manrope, sans-serif', fontSize: 12, lineHeight: 1.55 }}>
                    {backendStatus.error}
                  </div>
                )}
              </div>

              {adminMode && (
                <div style={{ padding: 16, borderRadius: 16, background: 'rgba(255,255,255,0.03)', border: `1px solid ${BUILDER_BORD}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, color: '#fff', fontFamily: 'Bricolage Grotesque, sans-serif', fontSize: 15, fontWeight: 700 }}>
                    <ShieldCheck size={15} color={accent} /> Admin QA checklist
                  </div>
                  {[
                    'Load a Pro or Enterprise draft and confirm the right atom count limit.',
                    'Send a node test and verify the webhook payload plus response preview.',
                    'Activate the full path and inspect backend run history for each step.',
                    'Review locked Starter behavior so subscribers only get what the plan promises.',
                  ].map((item) => (
                    <div key={item} style={{ display: 'flex', alignItems: 'flex-start', gap: 9, marginTop: 8, color: 'rgba(255,255,255,0.68)', fontFamily: 'Manrope, sans-serif', fontSize: 12, lineHeight: 1.5 }}>
                      <Check size={13} color={accent} style={{ marginTop: 2, flexShrink: 0 }} /> {item}
                    </div>
                  ))}
                </div>
              )}

              <div style={{ padding: 16, borderRadius: 16, background: 'rgba(255,255,255,0.03)', border: `1px solid ${BUILDER_BORD}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, color: '#fff', fontFamily: 'Bricolage Grotesque, sans-serif', fontSize: 15, fontWeight: 700 }}>
                  <History size={15} color={accent} /> Execution history
                </div>
                <div style={{ display: 'grid', gap: 8 }}>
                  {backendRuns.length ? backendRuns.map((run) => {
                    const runnableCancel = run.native && ['queued', 'running', 'retry_scheduled', 'waiting', 'awaiting_approval'].includes(run.status);
                    const runnableRetry = run.native && ['failed', 'canceled', 'timed_out'].includes(run.status);
                    return (
                      <div
                        key={run.id}
                        style={{
                          width: '100%',
                          padding: '10px 11px',
                          borderRadius: 12,
                          border: `1px solid ${activeRunId === run.id ? `${accent}55` : BUILDER_BORD}`,
                          background: activeRunId === run.id ? `${accent}10` : 'rgba(255,255,255,0.03)',
                          color: '#fff',
                        }}
                      >
                        <button
                          type="button"
                          onClick={() => inspectRun(run.id)}
                          disabled={runsBusy}
                          style={{ width: '100%', textAlign: 'left', background: 'transparent', border: 'none', color: 'inherit', padding: 0, cursor: runsBusy ? 'wait' : 'pointer', fontFamily: 'inherit' }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                              <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', padding: '2px 6px', borderRadius: 999, background: run.native ? `${accent}18` : 'rgba(255,255,255,0.08)', color: run.native ? accent : 'rgba(255,255,255,0.6)' }}>
                                {run.native ? run.trigger_type || 'manual' : 'make'}
                              </span>
                              <span style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontSize: 13, fontWeight: 700, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{run.flow_name || flowName}</span>
                            </div>
                            <div style={{ color: run.status === 'failed' ? '#f87171' : run.status === 'completed' || run.status === 'succeeded' ? accent : run.native ? '#fbbf24' : 'rgba(255,255,255,0.6)', fontFamily: 'JetBrains Mono, monospace', fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                              {run.status}
                            </div>
                          </div>
                          <div style={{ color: 'rgba(255,255,255,0.56)', fontFamily: 'Manrope, sans-serif', fontSize: 11 }}>
                            {new Date(run.started_at || run.created_at).toLocaleString()}
                          </div>
                        </button>
                        {(runnableCancel || runnableRetry) && (
                          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                            {runnableCancel && (
                              <button type="button" onClick={() => handleCancelRun(run.id)} style={{ flex: 1, padding: '7px 10px', borderRadius: 9, border: `1px solid ${BUILDER_BORD}`, background: 'rgba(248,113,113,0.12)', color: '#fca5a5', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, fontSize: 11, cursor: 'pointer' }}>
                                Cancel
                              </button>
                            )}
                            {runnableRetry && (
                              <button type="button" onClick={() => handleRetryRun(run.id)} style={{ flex: 1, padding: '7px 10px', borderRadius: 9, border: `1px solid ${BUILDER_BORD}`, background: `${accent}18`, color: accent, fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, fontSize: 11, cursor: 'pointer' }}>
                                Retry
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  }) : (
                    <div style={{ color: 'rgba(255,255,255,0.58)', fontFamily: 'Manrope, sans-serif', fontSize: 12, lineHeight: 1.6 }}>
                      No executions yet. Save a flow and run the path to build up native execution history.
                    </div>
                  )}
                </div>
              </div>

              <div style={{ padding: 16, borderRadius: 16, background: 'rgba(255,255,255,0.03)', border: `1px solid ${BUILDER_BORD}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, color: '#fff', fontFamily: 'Bricolage Grotesque, sans-serif', fontSize: 15, fontWeight: 700 }}>
                  <MessageSquare size={15} color={accent} /> Execution log
                </div>
                <div style={{ display: 'grid', gap: 8 }}>
                  {runLog.length ? runLog.map((entry) => (
                    <div key={entry.id} style={{ padding: '10px 11px', borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: `1px solid ${BUILDER_BORD}` }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                        <div style={{ color: '#fff', fontFamily: 'Bricolage Grotesque, sans-serif', fontSize: 13, fontWeight: 700 }}>{entry.nodeTitle}</div>
                        <div style={{ color: entry.status === 'failed' || entry.status === 'error' ? '#f87171' : entry.status === 'succeeded' ? accent : accent, fontFamily: 'JetBrains Mono, monospace', fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase' }}>{entry.status}</div>
                      </div>
                      <div style={{ color: 'rgba(255,255,255,0.58)', fontFamily: 'Manrope, sans-serif', fontSize: 11, lineHeight: 1.5 }}>{entry.detail}</div>
                      {entry.at && <div style={{ color: 'rgba(255,255,255,0.35)', fontFamily: 'Manrope, sans-serif', fontSize: 10, marginTop: 4 }}>{new Date(entry.at).toLocaleString()}</div>}
                    </div>
                  )) : (
                    <div style={{ color: 'rgba(255,255,255,0.58)', fontFamily: 'Manrope, sans-serif', fontSize: 12, lineHeight: 1.6 }}>
                      No logs yet. Run the path to see per-node status, branch routes, and captured output or errors.
                    </div>
                  )}
                </div>
              </div>

              <div style={{ padding: 16, borderRadius: 16, background: 'rgba(255,255,255,0.03)', border: `1px solid ${BUILDER_BORD}` }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#fff', fontFamily: 'Bricolage Grotesque, sans-serif', fontSize: 15, fontWeight: 700 }}>
                    <Link2 size={15} color={accent} /> Connections &amp; credentials
                  </div>
                  {canUseWorkspaceBackend && (
                    <button type="button" onClick={refreshConnections} disabled={connBusy} style={{ padding: '6px 9px', borderRadius: 9, border: `1px solid ${BUILDER_BORD}`, background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.75)', fontFamily: 'Manrope, sans-serif', fontSize: 11, cursor: 'pointer' }}>
                      {connBusy ? 'Refreshing…' : 'Refresh'}
                    </button>
                  )}
                </div>
                {!canUseWorkspaceBackend ? (
                  <div style={{ color: 'rgba(255,255,255,0.58)', fontFamily: 'Manrope, sans-serif', fontSize: 12, lineHeight: 1.6 }}>
                    {hasSupabaseConfig ? 'Sign in to manage workspace connections and encrypted credentials.' : 'Connect Supabase to manage stored connections and encrypted credentials.'} Provider nodes resolve them only at run time.
                  </div>
                ) : (
                  <>
                    <div style={{ display: 'grid', gap: 8 }}>
                      {(connections?.connections || []).map((conn) => (
                        <div key={conn.id} style={{ padding: '10px 11px', borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: `1px solid ${BUILDER_BORD}` }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                            <div>
                              <div style={{ color: '#fff', fontFamily: 'Bricolage Grotesque, sans-serif', fontSize: 13, fontWeight: 700 }}>{conn.name}</div>
                              <div style={{ color: 'rgba(255,255,255,0.56)', fontFamily: 'JetBrains Mono, monospace', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{conn.provider}{conn.credential_id ? ' · linked' : ''}</div>
                            </div>
                            <button type="button" onClick={() => setPendingDelete({ kind: 'connection', id: conn.id, label: conn.name })} style={{ padding: '5px 8px', borderRadius: 8, border: `1px solid ${BUILDER_BORD}`, background: 'rgba(248,113,113,0.1)', color: '#fca5a5', fontFamily: 'Manrope, sans-serif', fontSize: 11, cursor: 'pointer' }}>Delete</button>
                          </div>
                        </div>
                      ))}
                      {(connections?.connections || []).length === 0 && (
                        <div style={{ color: 'rgba(255,255,255,0.52)', fontFamily: 'Manrope, sans-serif', fontSize: 12, lineHeight: 1.6 }}>
                          No connections yet. Create one below, then reference its name from a provider node's inspector.
                        </div>
                      )}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 10 }}>
                      <ConnectionCreate organizationId={organizationId} credentials={connections?.credentials || []} onCreated={(msg) => { setNotice(msg); refreshConnections(); }} accent={accent} border={BUILDER_BORD} />
                      <CredentialCreate organizationId={organizationId} onCreated={(msg) => { setNotice(msg); refreshConnections(); }} accent={accent} border={BUILDER_BORD} />
                    </div>
                    <div style={{ marginTop: 12, color: 'rgba(255,255,255,0.42)', fontFamily: 'Manrope, sans-serif', fontSize: 11, lineHeight: 1.5 }}>
                      Secrets are encrypted server-side with TAL_CREDENTIALS_KEY; the browser never sees ciphertext or payloads.
                    </div>
                  </>
                )}
              </div>

              <div style={{ padding: 16, borderRadius: 16, background: 'rgba(255,255,255,0.03)', border: `1px solid ${BUILDER_BORD}` }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#fff', fontFamily: 'Bricolage Grotesque, sans-serif', fontSize: 15, fontWeight: 700 }}>
                    <GitBranch size={15} color={accent} /> Approvals
                  </div>
                  {canUseWorkspaceBackend && (
                    <button type="button" onClick={refreshApprovals} disabled={approvalsBusy} style={{ padding: '6px 9px', borderRadius: 9, border: `1px solid ${BUILDER_BORD}`, background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.75)', fontFamily: 'Manrope, sans-serif', fontSize: 11, cursor: 'pointer' }}>
                      {approvalsBusy ? 'Refreshing…' : 'Refresh'}
                    </button>
                  )}
                </div>
                {!canUseWorkspaceBackend ? (
                  <div style={{ color: 'rgba(255,255,255,0.58)', fontFamily: 'Manrope, sans-serif', fontSize: 12, lineHeight: 1.6 }}>
                    {hasSupabaseConfig ? 'Sign in to review workspace approval gates.' : 'Connect Supabase to review approval gates.'} Running a workflow with an Approval Atom creates a pending approval here.
                  </div>
                ) : approvals.length ? (
                  <div style={{ display: 'grid', gap: 8 }}>
                    {approvals.map((a) => (
                      <div key={a.id} style={{ padding: '10px 11px', borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: `1px solid ${BUILDER_BORD}` }}>
                        <div style={{ color: '#fff', fontFamily: 'Bricolage Grotesque, sans-serif', fontSize: 13, fontWeight: 700 }}>{a.title || 'Approval required'}</div>
                        {a.message && <div style={{ color: 'rgba(255,255,255,0.58)', fontFamily: 'Manrope, sans-serif', fontSize: 11, lineHeight: 1.5, marginTop: 3 }}>{a.message}</div>}
                        <div style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'JetBrains Mono, monospace', fontSize: 9, marginTop: 5, textTransform: 'uppercase', letterSpacing: '0.08em' }}>run {a.execution_id ? a.execution_id.slice(0, 8) : ''} · {new Date(a.created_at).toLocaleString()}</div>
                        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                          <button type="button" onClick={() => handleDecideApproval(a.id, 'approve')} style={{ flex: 1, padding: '7px 10px', borderRadius: 9, border: 'none', background: accent, color: '#fff', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, fontSize: 11, cursor: 'pointer' }}>Approve</button>
                          <button type="button" onClick={() => handleDecideApproval(a.id, 'reject')} style={{ flex: 1, padding: '7px 10px', borderRadius: 9, border: `1px solid ${BUILDER_BORD}`, background: 'rgba(248,113,113,0.12)', color: '#fca5a5', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, fontSize: 11, cursor: 'pointer' }}>Reject</button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ color: 'rgba(255,255,255,0.52)', fontFamily: 'Manrope, sans-serif', fontSize: 12, lineHeight: 1.6 }}>
                    No pending approvals.
                  </div>
                )}
              </div>

              <div style={{ padding: 16, borderRadius: 16, background: 'rgba(255,255,255,0.03)', border: `1px solid ${BUILDER_BORD}` }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#fff', fontFamily: 'Bricolage Grotesque, sans-serif', fontSize: 15, fontWeight: 700 }}>
                    <CalendarClock size={15} color={accent} /> Triggers & config
                  </div>
                  {canUseWorkspaceBackend && (
                    <button type="button" onClick={refreshTriggers} disabled={triggersBusy} style={{ padding: '6px 9px', borderRadius: 9, border: `1px solid ${BUILDER_BORD}`, background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.75)', fontFamily: 'Manrope, sans-serif', fontSize: 11, cursor: 'pointer' }}>
                      {triggersBusy ? 'Loading…' : 'Refresh'}
                    </button>
                  )}
                </div>
                {!canUseWorkspaceBackend ? (
                  <div style={{ color: 'rgba(255,255,255,0.58)', fontFamily: 'Manrope, sans-serif', fontSize: 12, lineHeight: 1.6 }}>
                    {hasSupabaseConfig ? 'Sign in to manage workspace schedules, webhooks, and variables.' : 'Connect Supabase to manage schedules, webhooks, and variables.'}
                  </div>
                ) : (
                  <div style={{ display: 'grid', gap: 10 }}>
                    <div style={{ padding: '11px 12px', borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: `1px solid ${BUILDER_BORD}` }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6, color: '#fff', fontFamily: 'Bricolage Grotesque, sans-serif', fontSize: 13, fontWeight: 700 }}>
                        <Clock size={14} color={accent} /> Schedules
                      </div>
                      {!schedules.length && <div style={{ color: 'rgba(255,255,255,0.45)', fontFamily: 'Manrope, sans-serif', fontSize: 11, marginBottom: 6 }}>None yet.</div>}
                      {schedules.map((s) => (
                        <div key={s.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '5px 0', borderBottom: `1px solid ${BUILDER_BORD}` }}>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ color: 'rgba(255,255,255,0.8)', fontFamily: 'Manrope, sans-serif', fontSize: 11 }}>{s.name || s.trigger_type}</div>
                            <div style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'JetBrains Mono, monospace', fontSize: 9 }}>
                              {s.trigger_type === 'interval' ? `every ${s.interval_seconds}s` : s.trigger_type === 'cron' ? s.cron_expr : s.schedule_time}
                            </div>
                          </div>
                          <button type="button" onClick={() => { setScheduleForm(s); }} style={{ padding: '4px 8px', borderRadius: 8, border: `1px solid ${BUILDER_BORD}`, background: 'rgba(255,255,255,0.04)', color: 'rgba(255,255,255,0.7)', fontFamily: 'Manrope, sans-serif', fontSize: 10, cursor: 'pointer' }}>Edit</button>
                        </div>
                      ))}
                      <div style={{ marginTop: 8 }}>
                        {scheduleForm ? (
                          <div style={{ display: 'grid', gap: 6 }}>
                            <input value={scheduleForm.name || ''} onChange={(e) => setScheduleForm({ ...scheduleForm, name: e.target.value })} placeholder="name" style={{ padding: '6px 8px', borderRadius: 8, border: `1px solid ${BUILDER_BORD}`, background: 'rgba(0,0,0,0.3)', color: '#fff', fontFamily: 'Manrope, sans-serif', fontSize: 11 }} />
                            <select value={scheduleForm.trigger_type || 'interval'} onChange={(e) => setScheduleForm({ ...scheduleForm, trigger_type: e.target.value })} style={{ padding: '6px 8px', borderRadius: 8, border: `1px solid ${BUILDER_BORD}`, background: 'rgba(0,0,0,0.3)', color: '#fff', fontFamily: 'Manrope, sans-serif', fontSize: 11 }}>
                              <option value="interval">Interval</option>
                              <option value="cron">Cron</option>
                              <option value="time">Daily time</option>
                            </select>
                            {scheduleForm.trigger_type === 'interval' && (
                              <input value={scheduleForm.interval_seconds || ''} onChange={(e) => setScheduleForm({ ...scheduleForm, interval_seconds: e.target.value })} placeholder="seconds (e.g. 3600)" type="number" style={{ padding: '6px 8px', borderRadius: 8, border: `1px solid ${BUILDER_BORD}`, background: 'rgba(0,0,0,0.3)', color: '#fff', fontFamily: 'Manrope, sans-serif', fontSize: 11 }} />
                            )}
                            {scheduleForm.trigger_type === 'cron' && (
                              <input value={scheduleForm.cron_expr || ''} onChange={(e) => setScheduleForm({ ...scheduleForm, cron_expr: e.target.value })} placeholder="cron (e.g. 0 9 * * *)" style={{ padding: '6px 8px', borderRadius: 8, border: `1px solid ${BUILDER_BORD}`, background: 'rgba(0,0,0,0.3)', color: '#fff', fontFamily: 'Manrope, sans-serif', fontSize: 11 }} />
                            )}
                            {scheduleForm.trigger_type === 'time' && (
                              <input value={scheduleForm.schedule_time || ''} onChange={(e) => setScheduleForm({ ...scheduleForm, schedule_time: e.target.value })} placeholder="HH:MM (e.g. 09:00)" style={{ padding: '6px 8px', borderRadius: 8, border: `1px solid ${BUILDER_BORD}`, background: 'rgba(0,0,0,0.3)', color: '#fff', fontFamily: 'Manrope, sans-serif', fontSize: 11 }} />
                            )}
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button type="button" onClick={handleSaveSchedule} style={{ flex: 1, padding: '7px', borderRadius: 8, border: 'none', background: accent, color: '#fff', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, fontSize: 11, cursor: 'pointer' }}>Save</button>
                              <button type="button" onClick={() => setScheduleForm(null)} style={{ flex: 1, padding: '7px', borderRadius: 8, border: `1px solid ${BUILDER_BORD}`, background: 'transparent', color: 'rgba(255,255,255,0.7)', fontFamily: 'Manrope, sans-serif', fontSize: 11, cursor: 'pointer' }}>Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <button type="button" onClick={() => { setScheduleForm({ id: undefined, name: `Schedule ${schedules.length + 1}`, trigger_type: 'interval', interval_seconds: 3600, timezone: 'UTC' }); setWebhookForm(null); setVariableForm(null); }} style={{ width: '100%', padding: '7px', borderRadius: 8, border: `1px dashed ${BUILDER_BORD}`, background: 'transparent', color: 'rgba(255,255,255,0.6)', fontFamily: 'Manrope, sans-serif', fontSize: 11, cursor: 'pointer' }}>+ Schedule</button>
                        )}
                      </div>
                    </div>

                    <div style={{ padding: '11px 12px', borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: `1px solid ${BUILDER_BORD}` }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6, color: '#fff', fontFamily: 'Bricolage Grotesque, sans-serif', fontSize: 13, fontWeight: 700 }}>
                        <Wifi size={14} color={accent} /> Webhooks
                      </div>
                      {!webhooks.length && <div style={{ color: 'rgba(255,255,255,0.45)', fontFamily: 'Manrope, sans-serif', fontSize: 11, marginBottom: 6 }}>None yet.</div>}
                      {webhooks.map((h) => (
                        <div key={h.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '5px 0', borderBottom: `1px solid ${BUILDER_BORD}` }}>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ color: 'rgba(255,255,255,0.8)', fontFamily: 'Manrope, sans-serif', fontSize: 11 }}>{h.name || h.method}</div>
                            <div style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'JetBrains Mono, monospace', fontSize: 8, wordBreak: 'break-all' }}>{h.token}</div>
                          </div>
                          <button type="button" onClick={async () => { await toggleWebhook(h.id, !h.enabled); refreshTriggers(); }} style={{ padding: '4px 8px', borderRadius: 8, border: `1px solid ${BUILDER_BORD}`, background: h.enabled ? 'rgba(52,211,153,0.12)' : 'rgba(255,255,255,0.04)', color: h.enabled ? '#6ee7b7' : 'rgba(255,255,255,0.5)', fontFamily: 'Manrope, sans-serif', fontSize: 10, cursor: 'pointer' }}>{h.enabled ? 'On' : 'Off'}</button>
                        </div>
                      ))}
                      {webhookForm ? (
                        <div style={{ display: 'grid', gap: 6, marginTop: 8 }}>
                          <input autoFocus value={webhookForm.name || ''} onChange={(e) => setWebhookForm({ ...webhookForm, name: e.target.value })} placeholder="name" style={{ padding: '6px 8px', borderRadius: 8, border: `1px solid ${BUILDER_BORD}`, background: 'rgba(0,0,0,0.3)', color: '#fff', fontFamily: 'Manrope, sans-serif', fontSize: 11 }} />
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button type="button" onClick={handleSaveWebhook} style={{ flex: 1, padding: '7px', borderRadius: 8, border: 'none', background: accent, color: '#fff', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, fontSize: 11, cursor: 'pointer' }}>Create</button>
                            <button type="button" onClick={() => setWebhookForm(null)} style={{ flex: 1, padding: '7px', borderRadius: 8, border: `1px solid ${BUILDER_BORD}`, background: 'transparent', color: 'rgba(255,255,255,0.7)', fontFamily: 'Manrope, sans-serif', fontSize: 11, cursor: 'pointer' }}>Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <button type="button" onClick={() => { setWebhookForm({ name: 'Webhook' }); setScheduleForm(null); setVariableForm(null); }} style={{ width: '100%', marginTop: 8, padding: '7px', borderRadius: 8, border: `1px dashed ${BUILDER_BORD}`, background: 'transparent', color: 'rgba(255,255,255,0.6)', fontFamily: 'Manrope, sans-serif', fontSize: 11, cursor: 'pointer' }}>+ Webhook</button>
                      )}
                    </div>

                    <div style={{ padding: '11px 12px', borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: `1px solid ${BUILDER_BORD}` }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 6, color: '#fff', fontFamily: 'Bricolage Grotesque, sans-serif', fontSize: 13, fontWeight: 700 }}>
                        <KeyRound size={14} color={accent} /> Variables
                      </div>
                      {!variables.length && <div style={{ color: 'rgba(255,255,255,0.45)', fontFamily: 'Manrope, sans-serif', fontSize: 11, marginBottom: 6 }}>None yet.</div>}
                      {variables.map((v) => (
                        <div key={v.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '5px 0', borderBottom: `1px solid ${BUILDER_BORD}` }}>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ color: 'rgba(255,255,255,0.8)', fontFamily: 'Manrope, sans-serif', fontSize: 11 }}>{v.key}</div>
                            <div style={{ color: 'rgba(255,255,255,0.4)', fontFamily: 'JetBrains Mono, monospace', fontSize: 9 }}>{v.value_type}</div>
                          </div>
                          <button type="button" onClick={() => setPendingDelete({ kind: 'variable', id: v.id, label: v.key })} style={{ padding: '4px 8px', borderRadius: 8, border: `1px solid rgba(239,68,68,0.35)`, background: 'rgba(239,68,68,0.08)', color: '#fca5a5', fontFamily: 'Manrope, sans-serif', fontSize: 10, cursor: 'pointer' }}>Delete</button>
                        </div>
                      ))}
                      {variableForm ? (
                        <div style={{ display: 'grid', gap: 6, marginTop: 8 }}>
                          <input value={variableForm.key || ''} onChange={(e) => setVariableForm({ ...variableForm, key: e.target.value })} placeholder="key (e.g. api_key)" style={{ padding: '6px 8px', borderRadius: 8, border: `1px solid ${BUILDER_BORD}`, background: 'rgba(0,0,0,0.3)', color: '#fff', fontFamily: 'Manrope, sans-serif', fontSize: 11 }} />
                          <input value={variableForm.value || ''} onChange={(e) => setVariableForm({ ...variableForm, value: e.target.value })} placeholder="value" style={{ padding: '6px 8px', borderRadius: 8, border: `1px solid ${BUILDER_BORD}`, background: 'rgba(0,0,0,0.3)', color: '#fff', fontFamily: 'Manrope, sans-serif', fontSize: 11 }} />
                          <div style={{ color: 'rgba(255,255,255,0.46)', fontFamily: 'Manrope, sans-serif', fontSize: 10, lineHeight: 1.45 }}>Variables are visible workspace data. Store API keys and tokens in Credentials.</div>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button type="button" onClick={handleSaveVariable} style={{ flex: 1, padding: '7px', borderRadius: 8, border: 'none', background: accent, color: '#fff', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, fontSize: 11, cursor: 'pointer' }}>Save</button>
                            <button type="button" onClick={() => setVariableForm(null)} style={{ flex: 1, padding: '7px', borderRadius: 8, border: `1px solid ${BUILDER_BORD}`, background: 'transparent', color: 'rgba(255,255,255,0.7)', fontFamily: 'Manrope, sans-serif', fontSize: 11, cursor: 'pointer' }}>Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <button type="button" onClick={() => { setVariableForm({ key: '', value: '' }); setScheduleForm(null); setWebhookForm(null); }} style={{ width: '100%', marginTop: 8, padding: '7px', borderRadius: 8, border: `1px dashed ${BUILDER_BORD}`, background: 'transparent', color: 'rgba(255,255,255,0.6)', fontFamily: 'Manrope, sans-serif', fontSize: 11, cursor: 'pointer' }}>+ Variable</button>
                      )}
                    </div>
                  </div>
                )}
              </div>

            </div>}
          </aside>
        </div>
      </div>
      {pendingDelete && (
        <div className="builder-confirm" role="dialog" aria-modal="true" aria-labelledby="builder-confirm-title" onClick={() => setPendingDelete(null)}>
          <div className="builder-confirm__card" onClick={(event) => event.stopPropagation()}>
            <span className="builder-confirm__icon"><Trash2 size={18} /></span>
            <div>
              <h2 id="builder-confirm-title">Delete {pendingDelete.label}?</h2>
              <p>This removes the saved item from this workspace. This action cannot be undone.</p>
            </div>
            <div className="builder-confirm__actions">
              <button type="button" onClick={() => setPendingDelete(null)}>Cancel</button>
              <button type="button" data-danger="true" onClick={confirmPendingDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </WrapperTag>
  );
}
