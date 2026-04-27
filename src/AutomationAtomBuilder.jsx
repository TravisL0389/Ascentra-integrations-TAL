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
} from 'lucide-react';
import { hasSupabaseConfig } from './lib/supabaseClient.js';
import {
  deleteAutomationFlow,
  listAutomationFlows,
  listAutomationRuns,
  listAutomationRunSteps,
  loadAutomationFlow,
  runAutomationNode,
  runAutomationPath,
  saveAutomationFlow,
} from './lib/automationBackend.js';

const BUILDER_BG = '#0c111b';
const BUILDER_SURF = 'rgba(9,14,24,0.76)';
const BUILDER_BORD = 'rgba(255,255,255,0.08)';
const BUILDER_ACCENT = '#a855f7';

const PLAN_RULES = {
  Starter: { atoms: 0, label: 'Preview only', editable: false, note: 'Starter can preview the builder, but live atoms unlock on paid plans.' },
  Pro: { atoms: 3, label: '3 atoms', editable: true, note: 'Pro unlocks up to 3 live atoms per automation.' },
  Enterprise: { atoms: 10, label: '10 atoms', editable: true, note: 'Enterprise unlocks up to 10 live atoms with advanced branching and approvals.' },
};

const INTEGRATIONS = [
  { id: 'hubspot', label: 'HubSpot', subtitle: 'CRM sync', color: '#2563d4', Icon: Database, type: 'integration' },
  { id: 'gmail', label: 'Gmail', subtitle: 'Outbound messages', color: '#d946a8', Icon: Mail, type: 'integration' },
  { id: 'stripe', label: 'Stripe', subtitle: 'Billing events', color: '#6366f1', Icon: CreditCard, type: 'integration' },
  { id: 'notion', label: 'Notion', subtitle: 'Knowledge sync', color: '#14b8a6', Icon: BookMarked, type: 'integration' },
];

const LOGIC_BLOCKS = [
  { id: 'branch', label: 'Branch', subtitle: 'Route on conditions', color: '#2563d4', Icon: GitBranch, type: 'logic' },
  { id: 'approval', label: 'Approval', subtitle: 'Human review step', color: '#f59e0b', Icon: ShieldCheck, type: 'logic' },
  { id: 'transform', label: 'Transform', subtitle: 'Shape payloads', color: '#8b5cf6', Icon: SlidersHorizontal, type: 'logic' },
];

const DEMO_METRICS = [
  { label: 'Integrations Ready', value: '300+' },
  { label: 'Review Gates', value: 'Human-in-loop' },
  { label: 'Upcoming Characters', value: 'Growing roster' },
];

const PALETTE_TABS = [
  { id: 'all', label: 'All' },
  { id: 'trigger', label: 'Triggers' },
  { id: 'agent', label: 'Agents' },
  { id: 'integration', label: 'Apps' },
  { id: 'logic', label: 'Logic' },
];

const EXECUTION_PREVIEW = [
  { label: 'Trigger latency', value: '220 ms' },
  { label: 'Path branches', value: '2 active' },
  { label: 'Last preview', value: 'Just now' },
];

const MAKE_WEBHOOK_PRESETS = {
  atlas: {
    scenarioName: 'Atlas - Planning Generator',
    webhookUrl: 'https://hook.us2.make.com/5nn78rw7tshotuya9j6fvbtpbxapkwu4',
  },
  axiom: {
    scenarioName: 'Axiom - Research Generator',
    webhookUrl: 'https://hook.us2.make.com/vfht8ht188l47b3uu9thetvp9dqz33g3',
  },
  cipher: {
    scenarioName: 'Cipher - Security Generator',
    webhookUrl: 'https://hook.us2.make.com/xleag84gdicobys3w78mrfjfh48j5jhj',
  },
  echo: {
    scenarioName: 'Echo - Content Generator',
    webhookUrl: 'https://hook.us2.make.com/yjl1cdi332bvw5t6iiomo4pgmoswpjm9',
  },
  forge: {
    scenarioName: 'Forge - Build Generator',
    webhookUrl: 'https://hook.us2.make.com/ekix3bff616ma6nlulzfl1w4qtauquxt',
  },
  kairos: {
    scenarioName: 'Kairos - Timing Generator',
    webhookUrl: 'https://hook.us2.make.com/5d27u2x2m2t015mx4okiljrny2fp8qyr',
  },
  lumen: {
    scenarioName: 'Lumen - Insights Generator',
    webhookUrl: 'https://hook.us2.make.com/e1vlrp2cel6a8m5g5ajiw44tajqijqdc',
  },
  nexus: {
    scenarioName: 'Nexus - Integration Generator',
    webhookUrl: 'https://hook.us2.make.com/p7cc7z9vq27ap9io5hafqouufpw5u1p6',
  },
  pulse: {
    scenarioName: 'Pulse - Automation Generator',
    webhookUrl: 'https://hook.us2.make.com/7pdix1a4g8vibbrh6hjnz0eufunhvck6',
  },
  veyra: {
    scenarioName: 'Veyra - Design Generator',
    webhookUrl: 'https://hook.us2.make.com/bv4248f9g78bxn7rf0ug6ukg0cp70yjm',
  },
  trigger: {
    scenarioName: 'TALOS Master Intake',
    webhookUrl: 'https://hook.us2.make.com/19ghu3wt54tf9zsydrr9k6hzsp48xika',
  },
  integration: {
    scenarioName: 'Nexus - Integration Generator',
    webhookUrl: 'https://hook.us2.make.com/p7cc7z9vq27ap9io5hafqouufpw5u1p6',
  },
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
  return node && node.type !== 'logic';
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
    { id: 'pulse-intake', type: 'trigger', title: 'Pulse Intake', subtitle: 'Webhook trigger', lane: -1, column: 0, color: '#ec4899', Icon: Webhook, mode: 'Trigger', approval: 'None', retries: '0', notes: 'Preview path incoming from webhook or app event.', makeConfig: createMakeConfig('trigger', 'Pulse Intake', 'pulse') },
    agentAtom('pulse', 'Pulse Automation', 'Workflow handoff', -1, 1),
    { id: 'forge-intake', type: 'trigger', title: 'Forge Intake', subtitle: 'Manual launch', lane: 1, column: 0, color: '#ec4899', Icon: CircleDot, mode: 'Trigger', approval: 'None', retries: '0', notes: 'Preview path kicked off by the operator.', makeConfig: createMakeConfig('trigger', 'Forge Intake', 'forge') },
    agentAtom('forge', 'Forge Build Generator', 'App builder atom', 1, 1),
    { id: 'decision-router', type: 'logic', title: 'Decision Router', subtitle: 'Condition split', lane: 0, column: 2, color: '#2563d4', Icon: GitBranch, mode: 'Logic', approval: 'Required', retries: '0', notes: 'Route into different atoms based on score, segment, or urgency.' },
    { id: 'nexus-sync', type: 'integration', title: 'Nexus CRM Sync', subtitle: 'HubSpot update', lane: -1, column: 3, color: '#2563d4', Icon: Database, mode: 'Integration', approval: 'Optional', retries: '1', notes: 'Push enriched records back into the CRM.', makeConfig: createMakeConfig('integration', 'Nexus CRM Sync', 'nexus') },
    agentAtom('echo', 'Echo Follow-up', 'Campaign response', 1, 3),
  ];

  const starterEdges = [
    ['pulse-intake', 'pulse--1-1'],
    ['forge-intake', 'forge-1-1'],
    ['pulse--1-1', 'decision-router'],
    ['forge-1-1', 'decision-router'],
    ['decision-router', 'nexus-sync'],
    ['decision-router', 'echo-1-3'],
  ];

  const proNodes = [
    { id: 'pro-trigger', type: 'trigger', title: 'Revenue Trigger', subtitle: 'Stripe invoice event', lane: 0, column: 0, color: '#ec4899', Icon: Webhook, mode: 'Trigger', approval: 'None', retries: '0', notes: 'Wake this automation when a payment event lands.', makeConfig: createMakeConfig('trigger', 'Revenue Trigger', 'pulse') },
    agentAtom('pulse', 'Pulse Recovery Loop', 'Automation sequence', 0, 1),
    { id: 'pro-gmail', type: 'integration', title: 'Gmail Outreach', subtitle: 'Customer follow-up', lane: 0, column: 2, color: '#2563d4', Icon: Mail, mode: 'Integration', approval: 'Optional', retries: '1', notes: 'Send the follow-up sequence after Pulse assembles the next action.', makeConfig: createMakeConfig('integration', 'Gmail Outreach', 'nexus') },
  ];

  const proEdges = [
    ['pro-trigger', 'pulse-0-1'],
    ['pulse-0-1', 'pro-gmail'],
  ];

  const enterpriseNodes = [
    { id: 'ent-trigger', type: 'trigger', title: 'Nexus Intake', subtitle: 'Salesforce lead event', lane: 0, column: 0, color: '#ec4899', Icon: Webhook, mode: 'Trigger', approval: 'None', retries: '0', notes: 'Listen for qualified inbound demand.', makeConfig: createMakeConfig('trigger', 'Nexus Intake', 'nexus') },
    agentAtom('axiom', 'Axiom Qualification', 'Decision support atom', 0, 1),
    { id: 'ent-branch', type: 'logic', title: 'Tier Branch', subtitle: 'Segment enterprise vs SMB', lane: 0, column: 2, color: '#2563d4', Icon: GitBranch, mode: 'Logic', approval: 'Required', retries: '0', notes: 'Branch by company size, deal value, or health score.' },
    agentAtom('veyra', 'Veyra Creative Pack', 'Design response', -1, 3),
    agentAtom('forge', 'Forge Solution Draft', 'Technical proposal', 0, 3),
    agentAtom('echo', 'Echo Sequence', 'Follow-up copy', 1, 3),
    { id: 'ent-notion', type: 'integration', title: 'Notion Workspace', subtitle: 'Knowledge handoff', lane: -1, column: 4, color: '#14b8a6', Icon: BookMarked, mode: 'Integration', approval: 'Optional', retries: '1', notes: 'Document the creative path for the team.', makeConfig: createMakeConfig('integration', 'Notion Workspace', 'nexus') },
    { id: 'ent-stripe', type: 'integration', title: 'Stripe Handoff', subtitle: 'Billing readiness', lane: 0, column: 4, color: '#6366f1', Icon: CreditCard, mode: 'Integration', approval: 'Optional', retries: '1', notes: 'Prepare billing and commercial handoff.', makeConfig: createMakeConfig('integration', 'Stripe Handoff', 'nexus') },
    agentAtom('pulse', 'Pulse Follow-through', 'Automation wrap-up', 1, 4),
  ];

  const enterpriseEdges = [
    ['ent-trigger', 'axiom-0-1'],
    ['axiom-0-1', 'ent-branch'],
    ['ent-branch', 'veyra--1-3'],
    ['ent-branch', 'forge-0-3'],
    ['ent-branch', 'echo-1-3'],
    ['veyra--1-3', 'ent-notion'],
    ['forge-0-3', 'ent-stripe'],
    ['echo-1-3', 'pulse-1-4'],
  ];

  return {
    Starter: {
      name: 'Cross-team launch preview',
      summary: 'A read-only preview showing how multiple agents can merge into a single automation fabric.',
      nodes: starterNodes,
      edges: starterEdges.map(([from, to]) => ({ from, to })),
      selectedNodeId: 'decision-router',
    },
    Pro: {
      name: 'Revenue recovery loop',
      summary: 'A compact paid automation with up to 3 live atoms.',
      nodes: proNodes,
      edges: proEdges.map(([from, to]) => ({ from, to })),
      selectedNodeId: 'pulse-0-1',
    },
    Enterprise: {
      name: 'Multi-agent GTM path',
      summary: 'Branch creative, proposal, and outreach work across a larger automation graph.',
      nodes: enterpriseNodes,
      edges: enterpriseEdges.map(([from, to]) => ({ from, to })),
      selectedNodeId: 'ent-branch',
    },
  };
}

function buildAgentLibrary(agents) {
  return agents.map((agent) => ({
    id: agent.id,
    label: agent.name,
    subtitle: agent.specialty,
    color: agent.color,
    Icon: agent.Icon,
    type: 'agent',
    agentId: agent.id,
  }));
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

function getPortPosition(node, side = 'right') {
  const pos = getPosition(node);
  return {
    x: pos.x + (side === 'right' ? 44 : -44),
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

export default function AutomationAtomBuilder({
  agents,
  plans,
  onBack,
  initialPlanName = 'Starter',
  accent = '#00C9A7',
  embedded = false,
  sectionId = 'builder-hub',
}) {
  const templates = useMemo(() => createTemplates(agents), [agents]);
  const libraryAgents = useMemo(() => buildAgentLibrary(agents), [agents]);
  const agentMap = useMemo(() => new Map(agents.map((agent) => [agent.id, agent])), [agents]);
  const canvasRef = useRef(null);
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

  const planRule = PLAN_RULES[activePlanName];
  const selectedNode = nodes.find((node) => node.id === selectedNodeId) || null;
  const selectedNodeSchema = getActiveNodeSchema(selectedNode);
  const liveAtomCount = nodes.length;
  const zoomScale = zoom / 100;
  const backendLabel = hasSupabaseConfig ? 'Supabase connected' : 'Local preview only';

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
      row.type === 'agent'
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
    };
  };

  const applyPresetToNode = (node) => {
    if (!nodeSupportsMake(node)) return node;
    if (node.makeConfig?.webhookUrl) return node;
    return {
      ...node,
      makeConfig: {
        ...createMakeConfig(node.type, node.title, node.agentId || null),
        ...(node.makeConfig || {}),
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
    setCanvasMode('build');
    setDragState(null);
    setConnectState(null);
    setPointerPos(null);
    setFlowId(null);
    setActiveRunId(null);
    setRunLog([]);
    setBackendRuns([]);
  };

  const paletteGroups = [
    { id: 'trigger', title: 'Triggers', items: [{ id: 'webhook-trigger', label: 'Webhook', subtitle: 'External event', color: '#ec4899', Icon: Webhook, type: 'trigger' }] },
    { id: 'agent', title: 'Agents', items: libraryAgents },
    { id: 'integration', title: 'Integrations', items: INTEGRATIONS },
    { id: 'logic', title: 'Logic', items: LOGIC_BLOCKS },
  ];

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
      x: Math.max(52, Math.min(1228, ((clientX - rect.left) / rect.width) * 1280)),
      y: Math.max(72, Math.min(708, ((clientY - rect.top) / rect.height) * 760)),
    };
  };

  const switchPlan = (nextPlan) => {
    createFreshFlow(nextPlan);
    setNotice(PLAN_RULES[nextPlan].note);
  };

  const appendAtom = (item, branch = false) => {
    if (!planRule.editable) {
      setNotice('Starter can explore the preview, but Pro and Enterprise unlock buildable atoms.');
      return;
    }

    if (liveAtomCount >= planRule.atoms) {
      setNotice(`${activePlanName} is capped at ${planRule.atoms} live atoms. Upgrade to add more nodes and branches.`);
      return;
    }

    const source = selectedNode || nodes[nodes.length - 1];
    const desiredLane = branch ? (source?.lane === 0 ? -1 : 0) : (source?.lane ?? 0);
    const desiredColumn = (source?.column ?? -1) + 1;
    const slot = findOpenSlot(nodes, desiredLane, desiredColumn);
    const slotPos = getPosition({ lane: slot.lane, column: slot.column });
    const newAtom = {
      ...buildAtomFromLibrary(item, slot.lane, slot.column),
      x: slotPos.x,
      y: slotPos.y,
    };

    setNodes((current) => [...current, newAtom]);
    if (source) {
      setEdges((current) => [...current, { from: source.id, to: newAtom.id }]);
    }
    setSelectedNodeId(newAtom.id);
    setNotice(`${newAtom.title} added to the ${branch ? 'branch' : 'main'} path.`);
    setRunState('Edited');
  };

  const updateSelectedNode = (field, value) => {
    if (!selectedNode) return;
    if (!planRule.editable && activePlanName === 'Starter') {
      setNotice('The Starter view is a guided preview. Switch to Pro or Enterprise to customize each atom.');
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

  const updateSelectedMakeConfig = (field, value) => {
    if (!selectedNode || !nodeSupportsMake(selectedNode)) return;
    if (!planRule.editable && activePlanName === 'Starter') {
      setNotice('The Starter view is a guided preview. Switch to Pro or Enterprise to connect live Make scenarios.');
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
    if (!hasSupabaseConfig) return;
    setFlowsBusy(true);
    try {
      const flows = await listAutomationFlows();
      setSavedFlows(flows);
    } catch (error) {
      setNotice(error.message || 'Failed to load saved automations.');
    } finally {
      setFlowsBusy(false);
    }
  };

  const refreshRuns = async (targetFlowId = flowId) => {
    if (!hasSupabaseConfig || !targetFlowId) {
      setBackendRuns([]);
      return;
    }
    setRunsBusy(true);
    try {
      const runs = await listAutomationRuns(targetFlowId);
      setBackendRuns(runs);
    } catch (error) {
      setNotice(error.message || 'Failed to load automation run history.');
    } finally {
      setRunsBusy(false);
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
    if (!hasSupabaseConfig) {
      if (!silent) {
        setNotice('Supabase is not configured yet. Add the project keys to connect a live backend.');
      }
      return null;
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
      });
      setFlowId(result.id);
      await refreshSavedFlows();
      await refreshRuns(result.id);
      setRunState('Saved');
      if (!silent) {
        setNotice('Flow saved to the Supabase backend.');
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
      if (hasSupabaseConfig) {
        const nextFlowId = flowId || (await saveFlowToBackend({ silent: true }));
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
      setNotice(`${selectedNode.title} test sent to ${hasSupabaseConfig ? 'the Supabase backend' : 'Make'}.`);
    } catch (error) {
      setRunState('Error');
      setNotice(error.message || 'Make test failed.');
    } finally {
      setRunBusy(false);
    }
  };

  const activatePath = async () => {
    if (!planRule.editable) {
      setRunState('Preview');
      setNotice('Starter can preview the builder, but live Make activation unlocks on paid plans.');
      return;
    }

    const orderedNodes = getExecutionOrder(nodes, edges);
    setRunBusy(true);
    setRunLog([]);
    setRunState('Running');
    setNotice('Running the current automation path through the connected Make scenarios...');

    try {
      if (hasSupabaseConfig) {
        const nextFlowId = flowId || (await saveFlowToBackend({ silent: true }));
        const result = await runAutomationPath({
          flowId: nextFlowId,
          nodes,
          edges,
          flowName,
          flowSummary,
          planName: activePlanName,
        });
        applyStepResults(result.steps || []);
        setActiveRunId(result.runId || null);
        await refreshRuns(nextFlowId);
      } else {
        for (const node of orderedNodes) {
          if (!nodeSupportsMake(node)) {
            pushRunLog({ id: `${node.id}-${Date.now()}`, nodeTitle: node.title, status: 'Logic', detail: 'Routing handled in builder flow' });
            continue;
          }
          await triggerMakeNode(node);
        }
      }

      setRunState('Connected');
      setNotice(`Path run completed through ${hasSupabaseConfig ? 'the Supabase backend' : 'the local browser bridge'}. Review responses in the run log.`);
    } catch (error) {
      setRunState('Error');
      setNotice(error.message || 'Path run failed.');
    } finally {
      setRunBusy(false);
    }
  };

  const loadSavedFlow = async (targetFlowId) => {
    if (!hasSupabaseConfig) return;
    setFlowsBusy(true);
    try {
      const payload = await loadAutomationFlow(targetFlowId);
      const restoredNodes = payload.nodes.map(restoreNode);
      const restoredEdges = payload.edges.map((edge) => ({ from: edge.from_node_id, to: edge.to_node_id }));
      setFlowId(payload.flow.id);
      setActivePlanName(payload.flow.plan_name || 'Pro');
      setFlowName(payload.flow.name);
      setFlowSummary(payload.flow.summary || '');
      setNodes(restoredNodes.map(applyPresetToNode));
      setEdges(restoredEdges);
      setSelectedNodeId(restoredNodes[0]?.id || null);
      setRunState('Loaded');
      setCanvasMode('inspect');
      setNotice(`Loaded ${payload.flow.name} from the backend.`);
      setActiveRunId(null);
      await refreshRuns(payload.flow.id);
    } catch (error) {
      setNotice(error.message || 'Failed to load this automation.');
    } finally {
      setFlowsBusy(false);
    }
  };

  const deleteCurrentFlowFromBackend = async () => {
    if (!flowId || !hasSupabaseConfig) {
      setNotice('Save the flow first before trying to delete it from the backend.');
      return;
    }
    setFlowsBusy(true);
    try {
      await deleteAutomationFlow(flowId);
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
    setRunState('Edited');
    setNotice('This draft is now detached from the saved flow. Save backend to create a duplicate.');
  };

  const inspectRun = async (runId) => {
    if (!hasSupabaseConfig) return;
    setRunsBusy(true);
    try {
      const steps = await listAutomationRunSteps(runId);
      setActiveRunId(runId);
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
    } catch (error) {
      setNotice(error.message || 'Failed to inspect this backend run.');
    } finally {
      setRunsBusy(false);
    }
  };

  const removeSelectedNode = () => {
    if (!selectedNode || !planRule.editable) {
      setNotice('This preview path is locked until a paid plan is selected.');
      return;
    }

    setNodes((current) => current.filter((node) => node.id !== selectedNode.id));
    setEdges((current) => current.filter((edge) => edge.from !== selectedNode.id && edge.to !== selectedNode.id));
    setSelectedNodeId(nodes.find((node) => node.id !== selectedNode.id)?.id || null);
    setNotice(`${selectedNode.title} removed from the path.`);
    setRunState('Edited');
  };

  const activePlanCard = plans.find((plan) => plan.name === activePlanName);

  const startDragging = (event, node) => {
    const point = toCanvasPoint(event.clientX, event.clientY);
    if (!point) return;
    const pos = getPosition(node);
    setSelectedNodeId(node.id);
    setDragState({
      id: node.id,
      offsetX: point.x - pos.x,
      offsetY: point.y - pos.y,
    });
  };

  const startConnection = (event, nodeId) => {
    event.stopPropagation();
    const sourceNode = nodes.find((node) => node.id === nodeId);
    if (!sourceNode) return;
    setSelectedNodeId(nodeId);
    setConnectState({ sourceId: nodeId });
    setPointerPos(getPortPosition(sourceNode, 'right'));
    setNotice('Choose a target module to create a connection.');
  };

  const completeConnection = (event, targetId) => {
    event.stopPropagation();
    if (!connectState) return;
    if (connectState.sourceId === targetId) {
      setNotice('Choose a different target module.');
      return;
    }
    if (edges.some((edge) => edge.from === connectState.sourceId && edge.to === targetId)) {
      setNotice('These modules are already connected.');
      setConnectState(null);
      setPointerPos(null);
      return;
    }
    setEdges((current) => [...current, { from: connectState.sourceId, to: targetId }]);
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
        setNodes((current) =>
          current.map((node) =>
            node.id === dragState.id
              ? {
                  ...node,
                  x: point.x - dragState.offsetX,
                  y: point.y - dragState.offsetY,
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

    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [dragState, connectState]);

  useEffect(() => {
    refreshSavedFlows();
  }, []);

  useEffect(() => {
    if (flowId) {
      refreshRuns(flowId);
    }
  }, [flowId]);

  useEffect(() => {
    setNodes((current) => current.map(applyPresetToNode));
  }, []);

  const wrapperPadding = embedded ? '32px 0 12px' : '108px 32px 48px';
  const wrapperMinHeight = embedded ? 'auto' : '100vh';
  const WrapperTag = embedded ? 'section' : 'main';

  return (
    <WrapperTag id={sectionId} style={{ minHeight: wrapperMinHeight, padding: wrapperPadding, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, background: `radial-gradient(circle at 15% 10%, rgba(168,85,247,0.14), transparent 30%), radial-gradient(circle at 88% 14%, rgba(0,201,167,0.1), transparent 32%), ${BUILDER_BG}` }} />
      <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.03) 1px, transparent 1px)', backgroundSize: '28px 28px', opacity: 0.45 }} />
      <div style={{ position: 'relative', maxWidth: 1680, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, marginBottom: 18, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            {embedded ? (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 14px', borderRadius: 999, border: `1px solid ${BUILDER_BORD}`, background: BUILDER_SURF, color: 'rgba(255,255,255,0.78)', fontFamily: 'JetBrains Mono, monospace', fontWeight: 700, fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase' }}>
                <Workflow size={13} color={accent} /> Main hub
              </div>
            ) : (
              <button onClick={onBack} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 14px', borderRadius: 12, border: `1px solid ${BUILDER_BORD}`, background: BUILDER_SURF, color: 'rgba(255,255,255,0.78)', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                <ArrowRight size={14} style={{ transform: 'rotate(180deg)' }} /> Platform
              </button>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, color: 'rgba(255,255,255,0.72)', fontFamily: 'JetBrains Mono, monospace', fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase' }}>
              <span style={{ color: BUILDER_ACCENT }}>Automation Builder</span>
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

        <div style={{ marginBottom: 18, display: 'flex', justifyContent: 'space-between', gap: 18, flexWrap: 'wrap', alignItems: 'end' }}>
          <div style={{ minWidth: 280, flex: '1 1 520px' }}>
            <div style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontSize: 38, lineHeight: 1.02, fontWeight: 800, color: '#fff', letterSpacing: '-0.04em', marginBottom: 8 }}>
              Build your own agent-made automation paths.
            </div>
            <div style={{ maxWidth: 760, fontFamily: 'Manrope, sans-serif', fontSize: 14, lineHeight: 1.6, color: 'rgba(255,255,255,0.56)' }}>
              Preview the full builder on Starter, then unlock live atoms on paid plans. Pro caps each path at 3 atoms. Enterprise expands to 10 with richer branching, approvals, and more automation characters as the platform grows.
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
        </div>

        <div className="builder-layout" style={{ display: 'grid', gridTemplateColumns: '300px minmax(0, 1fr) 340px', gap: 16, alignItems: 'start' }}>
          <aside style={{ borderRadius: 18, border: `1px solid ${BUILDER_BORD}`, background: 'rgba(8,12,22,0.82)', boxShadow: '0 20px 45px rgba(0,0,0,0.25)', overflow: 'hidden' }}>
            <div style={{ padding: '18px 18px 14px', borderBottom: `1px solid ${BUILDER_BORD}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div>
                  <div style={{ fontFamily: 'Bricolage Grotesque, sans-serif', color: '#fff', fontSize: 18, fontWeight: 700 }}>Modules</div>
                  <div style={{ fontFamily: 'Manrope, sans-serif', color: 'rgba(255,255,255,0.5)', fontSize: 12, marginTop: 4 }}>Pick agents, apps, and logic blocks for the next step.</div>
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
                  placeholder="Find module..."
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
                        onClick={() => appendAtom(item)}
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

          <section style={{ borderRadius: 20, border: `1px solid ${BUILDER_BORD}`, background: 'rgba(10,14,22,0.82)', boxShadow: '0 24px 60px rgba(0,0,0,0.28)', overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: '16px 18px', borderBottom: `1px solid ${BUILDER_BORD}`, flexWrap: 'wrap', alignItems: 'center' }}>
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
              <div style={{ display: 'grid', gap: 10, minWidth: 300 }}>
                <div style={{ display: 'inline-flex', padding: 4, borderRadius: 999, background: 'rgba(255,255,255,0.04)', border: `1px solid ${BUILDER_BORD}`, alignSelf: 'end', justifySelf: 'end' }}>
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
                <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                  <button onClick={() => createFreshFlow(activePlanName === 'Starter' ? 'Pro' : activePlanName)} style={{ padding: '11px 14px', borderRadius: 12, border: `1px solid ${BUILDER_BORD}`, background: 'rgba(255,255,255,0.04)', color: '#fff', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <FolderOpen size={14} /> New draft
                  </button>
                  <button onClick={() => setNotice('Undo stack is staged for the next interaction pass.')} style={{ width: 40, height: 40, borderRadius: 12, border: `1px solid ${BUILDER_BORD}`, background: 'rgba(255,255,255,0.04)', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                    <Undo2 size={15} />
                  </button>
                  <button onClick={() => setNotice('Redo stack is staged for the next interaction pass.')} style={{ width: 40, height: 40, borderRadius: 12, border: `1px solid ${BUILDER_BORD}`, background: 'rgba(255,255,255,0.04)', color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                    <Redo2 size={15} />
                  </button>
                  <button onClick={() => setNotice('Preview run simulated. Connectors, approvals, and agent prompts are ready to present in sales demos today.')} style={{ padding: '11px 14px', borderRadius: 12, border: `1px solid ${BUILDER_BORD}`, background: 'rgba(255,255,255,0.04)', color: '#fff', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <Eye size={14} /> Preview
                  </button>
                  <button onClick={() => saveFlowToBackend()} disabled={saveBusy} style={{ padding: '11px 14px', borderRadius: 12, border: `1px solid ${BUILDER_BORD}`, background: 'rgba(255,255,255,0.04)', color: '#fff', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 8, cursor: saveBusy ? 'wait' : 'pointer', opacity: saveBusy ? 0.72 : 1 }}>
                    <Database size={14} /> {saveBusy ? 'Saving...' : 'Save backend'}
                  </button>
                  <button onClick={duplicateCurrentFlow} style={{ padding: '11px 14px', borderRadius: 12, border: `1px solid ${BUILDER_BORD}`, background: 'rgba(255,255,255,0.04)', color: '#fff', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <CopyPlus size={14} /> Duplicate
                  </button>
                  <button onClick={() => appendAtom(LOGIC_BLOCKS[0], true)} style={{ padding: '11px 14px', borderRadius: 12, border: `1px solid ${BUILDER_BORD}`, background: 'rgba(255,255,255,0.04)', color: '#fff', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                    <Plus size={14} /> Branch
                  </button>
                  <button onClick={activatePath} disabled={runBusy} style={{ padding: '11px 15px', borderRadius: 12, border: 'none', background: accent, color: '#000', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 8, cursor: runBusy ? 'wait' : 'pointer', boxShadow: '0 10px 28px rgba(0,201,167,0.26)', opacity: runBusy ? 0.72 : 1 }}>
                    <Play size={14} /> {runBusy ? 'Running...' : planRule.editable ? 'Activate path' : 'Preview path'}
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
                </div>
              </div>

              <div style={{ position: 'relative', height: 760, borderRadius: 24, overflow: 'hidden', background: 'linear-gradient(145deg, #d4ccd7, #bdb5c5)' }}>
                <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(140deg, rgba(255,255,255,0.14), rgba(255,255,255,0))' }} />
                <div
                  ref={canvasRef}
                  onClick={() => {
                    if (connectState) {
                      setConnectState(null);
                      setPointerPos(null);
                      setCanvasMode('build');
                      setNotice('Connection cancelled.');
                    }
                  }}
                  style={{ position: 'absolute', left: '4.6%', right: '4.6%', top: '6.5%', bottom: '6.5%', borderRadius: 28, background: 'linear-gradient(180deg, #ffffff, #f5f1f8)', boxShadow: '0 24px 64px rgba(63,15,85,0.18)', borderBottom: '10px solid #a855f7', overflow: 'hidden' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '14px 16px', borderBottom: '1px solid rgba(90,82,110,0.08)', background: 'linear-gradient(180deg, rgba(255,255,255,0.96), rgba(246,242,251,0.92))' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <div style={{ padding: '6px 9px', borderRadius: 999, background: 'rgba(168,85,247,0.12)', color: '#5b2c88', fontFamily: 'JetBrains Mono, monospace', fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase' }}>
                        Beta builder
                      </div>
                      <div style={{ padding: '6px 9px', borderRadius: 999, background: 'rgba(17,24,39,0.05)', color: '#493d58', fontFamily: 'JetBrains Mono, monospace', fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase' }}>
                        {planRule.editable ? 'Canvas active' : 'Preview mode'}
                      </div>
                      <div style={{ color: 'rgba(73,61,88,0.66)', fontFamily: 'Manrope, sans-serif', fontSize: 12 }}>
                        Click a module, branch the path, and tune each step in the inspector.
                      </div>
                    </div>
                    <div style={{ display: 'inline-flex', gap: 8 }}>
                      <button style={{ width: 34, height: 34, borderRadius: 10, border: '1px solid rgba(110,104,128,0.14)', background: '#fff', color: '#4d425d', cursor: 'pointer' }}>
                        <Undo2 size={14} style={{ marginTop: 2 }} />
                      </button>
                      <button style={{ width: 34, height: 34, borderRadius: 10, border: '1px solid rgba(110,104,128,0.14)', background: '#fff', color: '#4d425d', cursor: 'pointer' }}>
                        <Redo2 size={14} style={{ marginTop: 2 }} />
                      </button>
                    </div>
                  </div>
                  <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(246,244,250,0.98), rgba(236,233,241,0.98))' }} />
                  <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(100,93,120,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(100,93,120,0.05) 1px, transparent 1px)', backgroundSize: '72px 72px' }} />
                  <div style={{ position: 'absolute', inset: 0, backgroundImage: 'radial-gradient(circle at center, rgba(168,85,247,0.06) 0, rgba(168,85,247,0.02) 24%, transparent 54%)' }} />

                  <div style={{ position: 'absolute', left: 16, top: 74, display: 'grid', gap: 10, zIndex: 4 }}>
                    <div style={{ minWidth: 208, padding: '12px 14px', borderRadius: 16, background: 'rgba(255,255,255,0.9)', border: '1px solid rgba(150,136,170,0.18)', boxShadow: '0 18px 36px rgba(39,20,58,0.08)' }}>
                      <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, letterSpacing: '0.16em', color: '#7d6b91', textTransform: 'uppercase', marginBottom: 7 }}>
                        Builder lab
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                        <div>
                          <div style={{ color: '#2c2335', fontFamily: 'Bricolage Grotesque, sans-serif', fontSize: 14, fontWeight: 800 }}>
                            {planRule.editable ? 'Live graph ready' : 'Interactive preview'}
                          </div>
                          <div style={{ color: 'rgba(73,61,88,0.65)', fontFamily: 'Manrope, sans-serif', fontSize: 11, marginTop: 3 }}>
                            Drag, connect, and tune your agent path.
                          </div>
                        </div>
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: planRule.editable ? accent : '#f59e0b', boxShadow: `0 0 0 5px ${planRule.editable ? `${accent}18` : 'rgba(245,158,11,0.18)'}` }} />
                      </div>
                    </div>

                    <div style={{ display: 'inline-flex', flexDirection: 'column', gap: 8, padding: 8, borderRadius: 18, background: 'rgba(255,255,255,0.9)', border: '1px solid rgba(150,136,170,0.18)', boxShadow: '0 18px 36px rgba(39,20,58,0.08)' }}>
                      {[
                        { id: 'build', label: 'Build', icon: Boxes },
                        { id: 'connect', label: 'Connect', icon: Link2 },
                        { id: 'inspect', label: 'Inspect', icon: Settings2 },
                      ].map((item) => {
                        const active = canvasMode === item.id;
                        return (
                          <button
                            key={item.id}
                            onClick={() => setCanvasMode(item.id)}
                            style={{
                              width: 108,
                              padding: '10px 12px',
                              borderRadius: 12,
                              border: `1px solid ${active ? `${accent}55` : 'rgba(150,136,170,0.18)'}`,
                              background: active ? `${accent}14` : 'rgba(255,255,255,0.84)',
                              color: active ? '#2c2335' : '#5e506f',
                              fontFamily: 'Bricolage Grotesque, sans-serif',
                              fontSize: 12,
                              fontWeight: 700,
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              cursor: 'pointer',
                            }}
                          >
                            {item.label}
                            <item.icon size={14} color={active ? accent : '#7d6b91'} />
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div style={{ position: 'absolute', right: 16, top: 74, display: 'grid', gap: 10, zIndex: 4 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 8, padding: 10, borderRadius: 18, background: 'rgba(255,255,255,0.9)', border: '1px solid rgba(150,136,170,0.18)', boxShadow: '0 18px 36px rgba(39,20,58,0.08)' }}>
                      {[
                        ['Nodes', `${nodes.length}`],
                        ['Links', `${edges.length}`],
                        ['Mode', canvasMode],
                      ].map(([label, value]) => (
                        <div key={label} style={{ minWidth: 66 }}>
                          <div style={{ color: '#2c2335', fontFamily: 'Bricolage Grotesque, sans-serif', fontSize: 14, fontWeight: 800 }}>{value}</div>
                          <div style={{ color: 'rgba(73,61,88,0.62)', fontFamily: 'Manrope, sans-serif', fontSize: 10 }}>{label}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ padding: '12px 14px', borderRadius: 16, background: 'rgba(255,255,255,0.9)', border: '1px solid rgba(150,136,170,0.18)', boxShadow: '0 18px 36px rgba(39,20,58,0.08)' }}>
                      <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, letterSpacing: '0.16em', color: '#7d6b91', textTransform: 'uppercase', marginBottom: 8 }}>
                        Path status
                      </div>
                      <div style={{ color: '#2c2335', fontFamily: 'Bricolage Grotesque, sans-serif', fontSize: 14, fontWeight: 800, marginBottom: 5 }}>
                        {planRule.editable ? 'Ready for live drafting' : 'Guided preview experience'}
                      </div>
                      <div style={{ color: 'rgba(73,61,88,0.64)', fontFamily: 'Manrope, sans-serif', fontSize: 11, lineHeight: 1.5 }}>
                        {connectState ? 'Choose a destination module to finish the connection.' : 'Use the floating controls to shape your graph without leaving the canvas.'}
                      </div>
                    </div>
                  </div>

                  <div style={{ position: 'absolute', inset: 0, transform: `scale(${zoomScale})`, transformOrigin: 'center center' }}>
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
                          <g key={`${edge.from}-${edge.to}`}>
                            <path d={path} fill="none" stroke="url(#edgeStroke)" strokeWidth="4.5" strokeLinecap="round" opacity="0.92" />
                            <rect x={midX - 33} y={midY - 12} rx="10" width="66" height="24" fill="rgba(255,255,255,0.96)" stroke="rgba(150,136,170,0.24)" />
                            <text x={midX} y={midY + 4} textAnchor="middle" style={{ fill: '#5e506f', fontSize: '12px', fontWeight: 700, fontFamily: 'Manrope, sans-serif' }}>
                              route
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
                        return (
                          <div
                            key={node.id}
                            style={{
                              position: 'absolute',
                              left: `calc(${(pos.x / 1280) * 100}% - 44px)`,
                              top: `calc(${(pos.y / 760) * 100}% - 44px)`,
                              width: 88,
                              height: 88,
                            }}
                          >
                            <button
                              onClick={(event) => {
                                event.stopPropagation();
                                setSelectedNodeId(node.id);
                                setCanvasMode('inspect');
                              }}
                              onMouseDown={(event) => {
                                event.stopPropagation();
                                setCanvasMode('build');
                                startDragging(event, node);
                              }}
                              style={{ position: 'absolute', inset: 0, border: 'none', background: 'transparent', cursor: dragState?.id === node.id ? 'grabbing' : 'grab', padding: 0 }}
                            >
                              <div style={{ position: 'absolute', left: 10, right: 10, bottom: -8, height: 16, borderRadius: '50%', background: 'rgba(0,0,0,0.12)', filter: 'blur(7px)' }} />
                              <div style={{ position: 'absolute', inset: active ? -8 : -2, borderRadius: 999, border: active ? `3px solid ${locked ? '#f59e0b' : BUILDER_ACCENT}` : 'none', opacity: active ? 1 : 0.65 }} />
                              <div style={{ position: 'absolute', inset: 10, borderRadius: 24, background: `radial-gradient(circle at 35% 28%, rgba(255,255,255,0.9), ${node.color})`, boxShadow: `0 16px 24px ${node.color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', transform: 'perspective(600px) rotateX(12deg)' }}>
                                <node.Icon size={24} color="#fff" />
                              </div>
                            </button>

                            <button
                              onClick={(event) => completeConnection(event, node.id)}
                              disabled={!canReceive}
                              style={{
                                position: 'absolute',
                                left: -8,
                                top: 32,
                                width: 20,
                                height: 20,
                                borderRadius: '50%',
                                border: '2px solid rgba(82,68,104,0.22)',
                                background: '#ffffff',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: canReceive ? 'pointer' : 'default',
                                opacity: connectState ? 1 : 0.82,
                                zIndex: 3,
                              }}
                            >
                              <div style={{ width: 8, height: 8, borderRadius: '50%', background: canReceive ? BUILDER_ACCENT : 'rgba(92,81,109,0.4)' }} />
                            </button>

                            <button
                              onClick={(event) => {
                                setCanvasMode('connect');
                                startConnection(event, node.id);
                              }}
                              style={{
                                position: 'absolute',
                                right: -8,
                                top: 32,
                                width: 20,
                                height: 20,
                                borderRadius: '50%',
                                border: '2px solid rgba(82,68,104,0.22)',
                                background: '#ffffff',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'crosshair',
                                zIndex: 3,
                              }}
                            >
                              <div style={{ width: 8, height: 8, borderRadius: '50%', background: isSource ? BUILDER_ACCENT : 'rgba(92,81,109,0.68)' }} />
                            </button>

                            <div style={{ position: 'absolute', left: -34, right: -34, bottom: -40, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, pointerEvents: 'none' }}>
                              <div style={{ padding: '5px 10px', borderRadius: 10, background: 'rgba(255,255,255,0.92)', border: '1px solid rgba(160,160,180,0.28)', color: '#2c2335', fontFamily: 'Bricolage Grotesque, sans-serif', fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap' }}>
                                {node.title}
                              </div>
                              <div style={{ color: 'rgba(55,45,66,0.65)', fontFamily: 'Manrope, sans-serif', fontSize: 11, whiteSpace: 'nowrap' }}>{node.subtitle}</div>
                            </div>
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
                        Starter can explore the full motion and structure of the builder. Pro unlocks 3 live atoms. Enterprise expands to 10 with deeper branching and integrations.
                      </div>
                    </div>
                  )}

                  <div style={{ position: 'absolute', left: 18, bottom: 18, width: 218, padding: '12px 14px', borderRadius: 16, background: 'rgba(255,255,255,0.9)', border: '1px solid rgba(150,136,170,0.18)', boxShadow: '0 18px 36px rgba(39,20,58,0.08)' }}>
                    <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, letterSpacing: '0.16em', color: '#7d6b91', textTransform: 'uppercase', marginBottom: 8 }}>
                      Grid controls
                    </div>
                    <div style={{ display: 'grid', gap: 6, color: '#43374f', fontFamily: 'Manrope, sans-serif', fontSize: 11 }}>
                      <div>Drag modules to rearrange your path.</div>
                      <div>Use right-side ports to start new links.</div>
                      <div>Click a module to bring its settings into focus.</div>
                    </div>
                  </div>

                  <div style={{ position: 'absolute', right: 18, bottom: planRule.editable ? 18 : 154, width: 190, padding: '10px 10px 12px', borderRadius: 16, background: 'rgba(255,255,255,0.9)', border: '1px solid rgba(150,136,170,0.18)', boxShadow: '0 18px 36px rgba(39,20,58,0.08)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 9 }}>
                      <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, letterSpacing: '0.16em', color: '#7d6b91', textTransform: 'uppercase' }}>
                        Minimap
                      </div>
                      <div style={{ color: '#43374f', fontFamily: 'Manrope, sans-serif', fontSize: 10 }}>{zoom}%</div>
                    </div>
                    <div style={{ position: 'relative', height: 110, borderRadius: 12, overflow: 'hidden', background: 'linear-gradient(180deg, rgba(248,246,251,1), rgba(239,235,244,1))', border: '1px solid rgba(150,136,170,0.14)' }}>
                      <svg viewBox="0 0 180 110" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
                        {edges.map((edge) => {
                          const from = nodes.find((node) => node.id === edge.from);
                          const to = nodes.find((node) => node.id === edge.to);
                          if (!from || !to) return null;
                          const fromPos = getPosition(from);
                          const toPos = getPosition(to);
                          return (
                            <line
                              key={`mini-${edge.from}-${edge.to}`}
                              x1={(fromPos.x / 1280) * 180}
                              y1={(fromPos.y / 760) * 110}
                              x2={(toPos.x / 1280) * 180}
                              y2={(toPos.y / 760) * 110}
                              stroke="rgba(145,130,170,0.45)"
                              strokeWidth="1.8"
                              strokeLinecap="round"
                            />
                          );
                        })}
                      </svg>
                      {nodes.map((node) => {
                        const pos = getPosition(node);
                        const active = node.id === selectedNodeId;
                        return (
                          <div
                            key={`mini-${node.id}`}
                            style={{
                              position: 'absolute',
                              left: `calc(${(pos.x / 1280) * 100}% - 4px)`,
                              top: `calc(${(pos.y / 760) * 100}% - 4px)`,
                              width: active ? 10 : 8,
                              height: active ? 10 : 8,
                              borderRadius: '50%',
                              background: active ? accent : node.color,
                              border: active ? '2px solid #fff' : 'none',
                              boxShadow: active ? '0 4px 10px rgba(0,0,0,0.14)' : 'none',
                            }}
                          />
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div style={{ position: 'absolute', left: '50%', bottom: 18, transform: 'translateX(-50%)', display: 'inline-flex', gap: 8, padding: 8, borderRadius: 18, background: 'rgba(255,255,255,0.94)', boxShadow: '0 16px 36px rgba(33,18,48,0.18)', border: '1px solid rgba(180,160,200,0.35)' }}>
                  {[
                    { label: 'Layout', icon: Settings2 },
                    { label: 'Select', icon: CircleDot },
                    { label: 'Branch', icon: GitBranch },
                  ].map((item) => (
                    <button key={item.label} style={{ border: 'none', background: 'transparent', color: '#2f2535', fontFamily: 'Bricolage Grotesque, sans-serif', fontSize: 13, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 10px', cursor: 'pointer' }}>
                      <item.icon size={14} /> {item.label}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: 12, marginTop: 14 }}>
                <div style={{ padding: '14px 16px', borderRadius: 16, background: 'rgba(255,255,255,0.04)', border: `1px solid ${BUILDER_BORD}`, color: 'rgba(255,255,255,0.74)', fontFamily: 'Manrope, sans-serif', fontSize: 13 }}>
                  <span style={{ color: '#fff', fontWeight: 700 }}>Builder note:</span> {notice}
                </div>
                <div style={{ padding: '14px 16px', borderRadius: 16, background: 'rgba(255,255,255,0.04)', border: `1px solid ${BUILDER_BORD}` }}>
                  <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, letterSpacing: '0.16em', color: 'rgba(255,255,255,0.42)', textTransform: 'uppercase', marginBottom: 8 }}>Execution preview</div>
                  <div style={{ display: 'grid', gap: 7 }}>
                    {EXECUTION_PREVIEW.map((item) => (
                      <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontFamily: 'Manrope, sans-serif', fontSize: 12, color: 'rgba(255,255,255,0.7)' }}>
                        <span>{item.label}</span>
                        <span style={{ color: '#fff', fontWeight: 700 }}>{item.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </section>

          <aside style={{ borderRadius: 18, border: `1px solid ${BUILDER_BORD}`, background: 'rgba(8,12,22,0.82)', boxShadow: '0 20px 45px rgba(0,0,0,0.25)', overflow: 'hidden' }}>
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
                    </div>

                    {inspectorTab === 'settings' && (
                      <>
                        {[
                          { label: 'Name', field: 'title', as: 'input' },
                          { label: 'Description', field: 'subtitle', as: 'input' },
                          { label: 'Notes', field: 'notes', as: 'textarea' },
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
                          ['Mapped fields', selectedNode.type === 'integration' ? '7 fields' : '4 fields'],
                          ['Payload mode', selectedNode.type === 'logic' ? 'Condition set' : 'Structured JSON'],
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
                        {[
                          ['Last result', planRule.editable ? 'Passed' : 'Preview only'],
                          ['Execution time', '1.9 sec'],
                          ['Review gate', selectedNode.approval],
                          ['Fallback retries', `${selectedNode.retries}`],
                        ].map(([label, value]) => (
                          <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '12px 13px', borderRadius: 14, border: `1px solid ${BUILDER_BORD}`, background: 'rgba(255,255,255,0.03)', fontFamily: 'Manrope, sans-serif', fontSize: 13, color: 'rgba(255,255,255,0.74)' }}>
                            <span>{label}</span>
                            <span style={{ color: '#fff', fontWeight: 700 }}>{value}</span>
                          </div>
                        ))}

                        {nodeSupportsMake(selectedNode) && (
                          <>
                            {[
                              ['Make status', selectedNode.makeConfig?.lastStatus || 'Not connected'],
                              ['Last sent', selectedNode.makeConfig?.lastRunAt || 'No run yet'],
                              ['Scenario', selectedNode.makeConfig?.scenarioName || 'Unlabeled'],
                              ['Backend route', hasSupabaseConfig ? 'Supabase edge function' : 'Browser direct webhook'],
                            ].map(([label, value]) => (
                              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '12px 13px', borderRadius: 14, border: `1px solid ${BUILDER_BORD}`, background: 'rgba(255,255,255,0.03)', fontFamily: 'Manrope, sans-serif', fontSize: 13, color: 'rgba(255,255,255,0.74)' }}>
                                <span>{label}</span>
                                <span style={{ color: '#fff', fontWeight: 700, textAlign: 'right' }}>{value}</span>
                              </div>
                            ))}

                            <div style={{ padding: 12, borderRadius: 14, border: `1px solid ${BUILDER_BORD}`, background: 'rgba(255,255,255,0.03)' }}>
                              <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 10, letterSpacing: '0.16em', color: 'rgba(255,255,255,0.38)', textTransform: 'uppercase', marginBottom: 8 }}>
                                Last response
                              </div>
                              <div style={{ color: 'rgba(255,255,255,0.72)', fontFamily: 'Manrope, sans-serif', fontSize: 12, lineHeight: 1.55, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                {selectedNode.makeConfig?.lastResponse || 'No response captured yet.'}
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    )}

                    <div className="builder-actions" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                      <button onClick={() => appendAtom(LOGIC_BLOCKS[0], true)} style={{ padding: '11px 13px', borderRadius: 12, border: `1px solid ${BUILDER_BORD}`, background: 'rgba(255,255,255,0.04)', color: '#fff', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, fontSize: 13, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, cursor: 'pointer' }}>
                        <GitBranch size={14} /> Branch
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

            <div style={{ padding: 18, display: 'grid', gap: 12 }}>
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
                      No saved automations yet. Save backend to keep drafts and reload them later.
                    </div>
                  )}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
                  <button onClick={() => createFreshFlow(activePlanName === 'Starter' ? 'Pro' : activePlanName)} style={{ padding: '10px 12px', borderRadius: 12, border: `1px solid ${BUILDER_BORD}`, background: 'rgba(255,255,255,0.04)', color: '#fff', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, fontSize: 12, cursor: 'pointer' }}>
                    New draft
                  </button>
                  <button onClick={deleteCurrentFlowFromBackend} disabled={!flowId || flowsBusy} style={{ padding: '10px 12px', borderRadius: 12, border: `1px solid rgba(239,68,68,0.32)`, background: 'rgba(239,68,68,0.08)', color: '#fff', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 700, fontSize: 12, cursor: !flowId || flowsBusy ? 'not-allowed' : 'pointer', opacity: !flowId || flowsBusy ? 0.5 : 1 }}>
                    Delete saved
                  </button>
                </div>
              </div>

              <div style={{ padding: 16, borderRadius: 16, background: 'rgba(255,255,255,0.03)', border: `1px solid ${BUILDER_BORD}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, color: '#fff', fontFamily: 'Bricolage Grotesque, sans-serif', fontSize: 15, fontWeight: 700 }}>
                  <Database size={15} color={accent} /> Backend status
                </div>
                <div style={{ color: 'rgba(255,255,255,0.58)', fontFamily: 'Manrope, sans-serif', fontSize: 12, lineHeight: 1.6 }}>
                  {hasSupabaseConfig
                    ? `This builder is ready to save flows and run scenarios through Supabase. ${flowId ? `Flow ID: ${flowId}` : 'Save once to create the first backend record.'}`
                    : 'Supabase keys are not configured in this local app yet, so the builder is still running in local preview mode.'}
                </div>
              </div>

              <div style={{ padding: 16, borderRadius: 16, background: 'rgba(255,255,255,0.03)', border: `1px solid ${BUILDER_BORD}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, color: '#fff', fontFamily: 'Bricolage Grotesque, sans-serif', fontSize: 15, fontWeight: 700 }}>
                  <History size={15} color={accent} /> Backend run history
                </div>
                <div style={{ display: 'grid', gap: 8 }}>
                  {backendRuns.length ? backendRuns.map((run) => (
                    <button
                      key={run.id}
                      onClick={() => inspectRun(run.id)}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        padding: '10px 11px',
                        borderRadius: 12,
                        border: `1px solid ${activeRunId === run.id ? `${accent}55` : BUILDER_BORD}`,
                        background: activeRunId === run.id ? `${accent}10` : 'rgba(255,255,255,0.03)',
                        color: '#fff',
                        cursor: runsBusy ? 'wait' : 'pointer',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                        <div style={{ fontFamily: 'Bricolage Grotesque, sans-serif', fontSize: 13, fontWeight: 700 }}>{run.flow_name || flowName}</div>
                        <div style={{ color: accent, fontFamily: 'JetBrains Mono, monospace', fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase' }}>{run.status}</div>
                      </div>
                      <div style={{ color: 'rgba(255,255,255,0.56)', fontFamily: 'Manrope, sans-serif', fontSize: 11 }}>
                        {new Date(run.started_at).toLocaleString()}
                      </div>
                    </button>
                  )) : (
                    <div style={{ color: 'rgba(255,255,255,0.58)', fontFamily: 'Manrope, sans-serif', fontSize: 12, lineHeight: 1.6 }}>
                      No backend runs yet. Save a flow and activate a path to build up execution history.
                    </div>
                  )}
                </div>
              </div>

              <div style={{ padding: 16, borderRadius: 16, background: 'rgba(255,255,255,0.03)', border: `1px solid ${BUILDER_BORD}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, color: '#fff', fontFamily: 'Bricolage Grotesque, sans-serif', fontSize: 15, fontWeight: 700 }}>
                  <MessageSquare size={15} color={accent} /> Make run log
                </div>
                <div style={{ display: 'grid', gap: 8 }}>
                  {runLog.length ? runLog.map((entry) => (
                    <div key={entry.id} style={{ padding: '10px 11px', borderRadius: 12, background: 'rgba(255,255,255,0.03)', border: `1px solid ${BUILDER_BORD}` }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                        <div style={{ color: '#fff', fontFamily: 'Bricolage Grotesque, sans-serif', fontSize: 13, fontWeight: 700 }}>{entry.nodeTitle}</div>
                        <div style={{ color: accent, fontFamily: 'JetBrains Mono, monospace', fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase' }}>{entry.status}</div>
                      </div>
                      <div style={{ color: 'rgba(255,255,255,0.58)', fontFamily: 'Manrope, sans-serif', fontSize: 11, lineHeight: 1.5 }}>{entry.detail}</div>
                    </div>
                  )) : (
                    <div style={{ color: 'rgba(255,255,255,0.58)', fontFamily: 'Manrope, sans-serif', fontSize: 12, lineHeight: 1.6 }}>
                      No path runs yet. Once you connect your Make webhook URLs, tests and full path activations will show up here.
                    </div>
                  )}
                </div>
              </div>

              <div style={{ padding: 16, borderRadius: 16, background: 'rgba(255,255,255,0.03)', border: `1px solid ${BUILDER_BORD}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, color: '#fff', fontFamily: 'Bricolage Grotesque, sans-serif', fontSize: 15, fontWeight: 700 }}>
                  <Crown size={15} color={accent} /> Subscription fit
                </div>
                <div style={{ color: 'rgba(255,255,255,0.58)', fontFamily: 'Manrope, sans-serif', fontSize: 12, lineHeight: 1.6 }}>
                  {activePlanName === 'Starter'
                    ? 'Starter is a sales-ready preview. It shows the builder surface, canvas behavior, and inspector flow without enabling live module creation.'
                    : activePlanName === 'Pro'
                      ? 'Pro is ideal for compact paid automations: one trigger, a small branch or decision layer, and one follow-through atom up to 3 total.'
                      : 'Enterprise opens the full canvas: 10 atoms, more approvals, deeper branching, and room for future automation characters.'}
                </div>
              </div>
              <div style={{ padding: 16, borderRadius: 16, background: 'rgba(255,255,255,0.03)', border: `1px solid ${BUILDER_BORD}` }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, color: '#fff', fontFamily: 'Bricolage Grotesque, sans-serif', fontSize: 15, fontWeight: 700 }}>
                  <Sparkles size={15} color={BUILDER_ACCENT} /> Coming next
                </div>
                {['More automation characters', 'Template marketplace', 'Version compare and rollback'].map((item) => (
                  <div key={item} style={{ display: 'flex', alignItems: 'center', gap: 9, marginTop: 8, color: 'rgba(255,255,255,0.68)', fontFamily: 'Manrope, sans-serif', fontSize: 12 }}>
                    <Check size={13} color={accent} /> {item}
                  </div>
                ))}
              </div>
              <button style={{ padding: '13px 14px', borderRadius: 14, border: 'none', background: BUILDER_ACCENT, color: '#fff', fontFamily: 'Bricolage Grotesque, sans-serif', fontWeight: 800, fontSize: 13, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, cursor: 'pointer' }}>
                <Rocket size={14} /> Open paid rollout plan
              </button>
            </div>
          </aside>
        </div>
      </div>
    </WrapperTag>
  );
}
