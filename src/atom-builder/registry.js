import {
  Bot,
  CircleDot,
  GitBranch,
  Rocket,
  ShieldCheck,
  SlidersHorizontal,
  Timer,
  Webhook,
  CalendarClock,
} from 'lucide-react';
import { getDefaultConfigForKind, getNodeDefinition, SUPPORTED_NATIVE_KINDS as DEFINITION_NATIVE_KINDS } from './definitions.js';

export const ATOM_CATEGORIES = [
  { id: 'trigger', label: 'Triggers' },
  { id: 'ai', label: 'AI' },
  { id: 'action', label: 'Actions' },
  { id: 'logic', label: 'Logic' },
  { id: 'data', label: 'Data' },
  { id: 'integration', label: 'Integrations' },
];

export const CORE_ATOMS = [
  {
    id: 'manual',
    label: 'Manual Trigger',
    subtitle: 'Run on demand',
    category: 'trigger',
    color: '#ec4899',
    Icon: CircleDot,
    type: 'trigger',
    functional: true,
  },
  {
    id: 'webhook',
    label: 'Webhook Trigger',
    subtitle: 'Receive an external event',
    category: 'trigger',
    color: '#ec4899',
    Icon: Webhook,
    type: 'webhook',
    functional: true,
  },
  {
    id: 'schedule',
    label: 'Schedule Trigger',
    subtitle: 'Run at a planned time',
    category: 'trigger',
    color: '#f59e0b',
    Icon: CalendarClock,
    type: 'schedule',
    functional: true,
  },
  {
    id: 'ai',
    label: 'AI Action',
    subtitle: 'Prompt a connected model',
    category: 'ai',
    color: '#8b5cf6',
    Icon: Bot,
    type: 'ai',
    functional: true,
  },
  {
    id: 'http',
    label: 'HTTP Request',
    subtitle: 'Call an API securely',
    category: 'action',
    color: '#f97316',
    Icon: Rocket,
    type: 'integration',
    functional: true,
  },
  {
    id: 'branch',
    label: 'Condition',
    subtitle: 'Route on matching rules',
    category: 'logic',
    color: '#2563d4',
    Icon: GitBranch,
    type: 'logic',
    functional: true,
  },
  {
    id: 'approval',
    label: 'Approval',
    subtitle: 'Wait for human review',
    category: 'logic',
    color: '#f59e0b',
    Icon: ShieldCheck,
    type: 'logic',
    functional: true,
  },
  {
    id: 'delay',
    label: 'Delay',
    subtitle: 'Pause before continuing',
    category: 'logic',
    color: '#06b6d4',
    Icon: Timer,
    type: 'logic',
    functional: true,
  },
  {
    id: 'transform',
    label: 'Transform Data',
    subtitle: 'Shape fields visually',
    category: 'data',
    color: '#8b5cf6',
    Icon: SlidersHorizontal,
    type: 'logic',
    functional: true,
  },
  {
    id: 'make',
    label: 'Make Webhook',
    subtitle: 'Call an existing Make scenario',
    category: 'integration',
    color: '#a855f7',
    Icon: Webhook,
    type: 'integration',
    functional: true,
  },
];

export const SUPPORTED_NATIVE_KINDS = new Set([...DEFINITION_NATIVE_KINDS, 'trigger', 'provider']);

function decorateAtom(atom) {
  const definition = getNodeDefinition(atom);
  return {
    ...atom,
    definitionVersion: definition.version,
    nativeKind: definition.nativeKind,
    inputs: definition.inputs,
    outputs: definition.outputs,
    configFields: definition.configFields,
  };
}

export function buildAgentAtoms(agents = []) {
  return agents.map((agent) => decorateAtom({
    id: agent.id,
    label: agent.name,
    subtitle: agent.specialty,
    category: 'ai',
    color: agent.color,
    Icon: agent.Icon,
    type: 'agent',
    agentId: agent.id,
    functional: true,
  }));
}

export function buildPaletteGroups(agents = []) {
  const atoms = [...CORE_ATOMS.map(decorateAtom), ...buildAgentAtoms(agents)];
  return ATOM_CATEGORIES.map((category) => ({
    ...category,
    title: category.label,
    items: atoms.filter((atom) => atom.category === category.id && atom.functional),
  })).filter((group) => group.items.length > 0);
}

export function findAtomDefinition(id) {
  return CORE_ATOMS.find((atom) => atom.id === id) || null;
}

export function getDefaultAtomConfig(item) {
  if (!item) return null;
  if (item.config && !item.id) return { ...item.config };
  return getDefaultConfigForKind(getNodeDefinition(item));
}

export function resolveBuilderKind(node) {
  if (!node) return null;
  if (node.config?.kind) return String(node.config.kind).toLowerCase();
  if (node.type === 'trigger') return 'manual';
  if (node.type === 'webhook' || node.type === 'schedule') return node.type;
  if (node.type === 'agent' || node.type === 'ai') return 'ai';
  if (node.type === 'logic' || node.type === 'integration') {
    const value = `${node.id || ''} ${node.title || ''}`.toLowerCase();
    for (const kind of ['branch', 'approval', 'delay', 'transform', 'http', 'make']) {
      if (value.includes(kind)) return kind;
    }
  }
  return String(node.type || '').toLowerCase();
}

export function visualForNode(node) {
  const kind = resolveBuilderKind(node);
  const match = CORE_ATOMS.find((atom) => atom.id === kind || (kind === 'manual' && atom.id === 'manual'));
  return match || findAtomDefinition('transform');
}
