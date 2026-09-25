export const WORKFLOW_SCHEMA_VERSION = 1;
export const NODE_DEFINITION_VERSION = 1;

export const DATA_TYPES = Object.freeze({
  ANY: 'any',
  ARRAY: 'array',
  BOOLEAN: 'boolean',
  NUMBER: 'number',
  OBJECT: 'object',
  STRING: 'string',
});

const port = (id, label, dataType = DATA_TYPES.ANY, options = {}) => Object.freeze({
  id,
  label,
  dataType,
  required: options.required === true,
  multiple: options.multiple === true,
  description: options.description || '',
});

const field = (key, label, type = 'string', options = {}) => Object.freeze({
  key,
  label,
  type,
  required: options.required === true,
  default: options.default,
  options: options.options || null,
  placeholder: options.placeholder || '',
  description: options.description || '',
  secret: options.secret === true,
});

const input = (id = 'input', label = 'Input', options = {}) => port(id, label, options.dataType || DATA_TYPES.ANY, { required: options.required, multiple: options.multiple, description: options.description });
const output = (id = 'output', label = 'Output', options = {}) => port(id, label, options.dataType || DATA_TYPES.ANY, { required: options.required, multiple: options.multiple, description: options.description });

const commonOutput = output('output', 'Output');

const definitions = {
  manual: {
    kind: 'manual',
    version: NODE_DEFINITION_VERSION,
    category: 'trigger',
    isTrigger: true,
    nativeKind: 'manual',
    inputs: [],
    outputs: [output('payload', 'Payload')],
    configFields: [],
    defaults: { kind: 'manual' },
    sideEffects: false,
    simulation: 'execute',
  },
  trigger: {
    kind: 'trigger',
    version: NODE_DEFINITION_VERSION,
    category: 'trigger',
    isTrigger: true,
    nativeKind: 'manual',
    inputs: [],
    outputs: [output('payload', 'Payload')],
    configFields: [],
    defaults: { kind: 'manual' },
    sideEffects: false,
    simulation: 'execute',
  },
  webhook: {
    kind: 'webhook',
    version: NODE_DEFINITION_VERSION,
    category: 'trigger',
    isTrigger: true,
    nativeKind: 'webhook',
    inputs: [],
    outputs: [output('payload', 'Webhook payload')],
    configFields: [
      field('secret', 'Signing secret', 'secret', { secret: true }),
    ],
    defaults: { kind: 'webhook' },
    sideEffects: false,
    simulation: 'execute',
  },
  schedule: {
    kind: 'schedule',
    version: NODE_DEFINITION_VERSION,
    category: 'trigger',
    isTrigger: true,
    nativeKind: 'schedule',
    inputs: [],
    outputs: [output('payload', 'Scheduled payload')],
    configFields: [
      field('cronExpr', 'Cron expression', 'string', { placeholder: '0 9 * * 1-5' }),
      field('timezone', 'Timezone', 'string', { default: 'UTC', placeholder: 'America/New_York' }),
    ],
    defaults: { kind: 'schedule', timezone: 'UTC' },
    sideEffects: false,
    simulation: 'execute',
  },
  ai: {
    kind: 'ai',
    version: NODE_DEFINITION_VERSION,
    category: 'ai',
    nativeKind: 'ai',
    inputs: [input('input', 'Input', { required: true })],
    outputs: [commonOutput],
    configFields: [
      field('provider', 'Provider', 'select', { default: 'openai', options: ['openai', 'anthropic', 'gemini'] }),
      field('model', 'Model', 'string', { default: 'gpt-4o-mini' }),
      field('prompt', 'Prompt', 'textarea', { required: true, placeholder: 'Summarize {{ input.body }}' }),
      field('systemPrompt', 'System prompt', 'textarea', {}),
      field('temperature', 'Temperature', 'number', { default: 0, options: { min: 0, max: 2, step: 0.1 } }),
      field('maxTokens', 'Max tokens', 'number', { default: 1024, options: { min: 1, max: 32768, step: 1 } }),
      field('connection', 'Connection', 'string', { required: true, placeholder: 'Select a connection' }),
      field('credentialRef', 'Credential reference', 'string', { secret: true }),
    ],
    defaults: {
      kind: 'ai',
      provider: 'openai',
      model: 'gpt-4o-mini',
      prompt: '{{ previous.output }}',
      systemPrompt: '',
      temperature: 0,
      maxTokens: 1024,
      connection: '',
      credentialRef: '',
    },
    sideEffects: true,
    simulation: 'boundary',
  },
  agent: {
    kind: 'agent',
    version: NODE_DEFINITION_VERSION,
    category: 'ai',
    nativeKind: 'ai',
    inputs: [input('input', 'Input', { required: true })],
    outputs: [commonOutput],
    configFields: [
      field('provider', 'Provider', 'select', { default: 'openai', options: ['openai', 'anthropic', 'gemini'] }),
      field('model', 'Model', 'string', { default: 'gpt-4o-mini' }),
      field('prompt', 'Task instructions', 'textarea', { required: true }),
      field('systemPrompt', 'System instructions', 'textarea'),
      field('temperature', 'Temperature', 'number', { default: 0, options: { min: 0, max: 2, step: 0.1 } }),
      field('maxTokens', 'Max tokens', 'number', { default: 1024, options: { min: 1, max: 32768, step: 1 } }),
      field('connection', 'Connection', 'string', { required: true }),
      field('credentialRef', 'Credential reference', 'string', { secret: true }),
    ],
    defaults: { kind: 'agent', provider: 'openai', model: 'gpt-4o-mini', prompt: '{{ previous.output }}', systemPrompt: '', temperature: 0, maxTokens: 1024, connection: '', credentialRef: '' },
    sideEffects: true,
    simulation: 'boundary',
  },
  http: {
    kind: 'http',
    version: NODE_DEFINITION_VERSION,
    category: 'integration',
    nativeKind: 'http',
    inputs: [input('input', 'Request input', { required: true })],
    outputs: [output('response', 'HTTP response')],
    configFields: [
      field('url', 'Request URL', 'url', { required: true, placeholder: 'https://api.example.com/v1/resource' }),
      field('method', 'Method', 'select', { default: 'GET', options: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] }),
      field('headers', 'Headers', 'json', { default: {} }),
      field('query', 'Query', 'json', { default: {} }),
      field('body', 'Body', 'json', { default: {} }),
      field('credential', 'Credential reference', 'string', { secret: true }),
    ],
    defaults: { kind: 'http', url: '', method: 'GET', headers: {}, query: {}, body: {}, credential: '' },
    sideEffects: true,
    simulation: 'boundary',
  },
  branch: {
    kind: 'branch',
    version: NODE_DEFINITION_VERSION,
    category: 'logic',
    nativeKind: 'branch',
    inputs: [input('input', 'Input', { required: true })],
    outputs: [output('true', 'True route'), output('false', 'False route')],
    configFields: [
      field('groups', 'Condition groups', 'conditions', { required: true }),
    ],
    defaults: {
      kind: 'branch',
      groups: [{ groupOperator: 'and', conditions: [{ path: 'trigger.body.amount', operator: 'greater_than', value: 100 }] }],
    },
    sideEffects: false,
    simulation: 'execute',
  },
  approval: {
    kind: 'approval',
    version: NODE_DEFINITION_VERSION,
    category: 'logic',
    nativeKind: 'approval',
    inputs: [input('input', 'Input', { required: true })],
    outputs: [commonOutput],
    configFields: [
      field('title', 'Review title', 'string', { default: 'Review request' }),
      field('message', 'Review message', 'textarea', { default: 'Confirm before continuing' }),
    ],
    defaults: { kind: 'approval', title: 'Review request', message: 'Confirm before continuing' },
    sideEffects: false,
    simulation: 'waiting',
  },
  delay: {
    kind: 'delay',
    version: NODE_DEFINITION_VERSION,
    category: 'logic',
    nativeKind: 'delay',
    inputs: [input('input', 'Input', { required: true })],
    outputs: [commonOutput],
    configFields: [field('seconds', 'Delay seconds', 'number', { required: true, default: 10, options: { min: 0, max: 604800, step: 1 } })],
    defaults: { kind: 'delay', seconds: 10 },
    sideEffects: false,
    simulation: 'execute',
  },
  transform: {
    kind: 'transform',
    version: NODE_DEFINITION_VERSION,
    category: 'data',
    nativeKind: 'transform',
    inputs: [input('input', 'Input', { required: true })],
    outputs: [output('output', 'Mapped output')],
    configFields: [field('mapping', 'Field mapping', 'mapping', { required: true })],
    defaults: { kind: 'transform', mapping: {} },
    sideEffects: false,
    simulation: 'execute',
  },
  make: {
    kind: 'make',
    version: NODE_DEFINITION_VERSION,
    category: 'integration',
    nativeKind: 'make',
    inputs: [input('input', 'Input', { required: true })],
    outputs: [output('response', 'Make response')],
    configFields: [
      field('url', 'Make webhook URL', 'url', { required: true, placeholder: 'https://hook.example.com/...' }),
      field('method', 'Method', 'select', { default: 'POST', options: ['POST', 'GET'] }),
    ],
    defaults: { kind: 'make', url: '', method: 'POST' },
    sideEffects: true,
    simulation: 'boundary',
  },
  provider: {
    kind: 'provider',
    version: NODE_DEFINITION_VERSION,
    category: 'integration',
    nativeKind: 'provider',
    inputs: [input('input', 'Input', { required: true })],
    outputs: [commonOutput],
    configFields: [field('connection', 'Connection', 'string', { required: true })],
    defaults: { kind: 'provider', connection: '' },
    sideEffects: true,
    simulation: 'boundary',
  },
};

export const NODE_DEFINITIONS = Object.freeze(definitions);
export const SUPPORTED_NATIVE_KINDS = new Set(Object.values(definitions).map((definition) => definition.nativeKind).filter(Boolean));

function cloneValue(value) {
  if (Array.isArray(value)) return value.map(cloneValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, cloneValue(entry)]));
  }
  return value;
}

function valueMatchesKind(value, kind) {
  if (value === undefined || value === null || value === '') return false;
  if (kind === 'number') return typeof value === 'number' && Number.isFinite(value);
  if (kind === 'boolean') return typeof value === 'boolean';
  if (kind === 'array') return Array.isArray(value);
  if (kind === 'object') return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
  if (kind === 'json' || kind === 'conditions' || kind === 'mapping') return Boolean(value) && typeof value === 'object';
  if (kind === 'select' || kind === 'url' || kind === 'textarea' || kind === 'string' || kind === 'secret') return typeof value === 'string';
  return true;
}

function definitionKindFromNode(node) {
  if (!node) return 'manual';
  if (typeof node === 'string') return node.toLowerCase();
  const explicit = String(node.config?.kind || node.kind || '').toLowerCase();
  if (explicit && definitions[explicit]) return explicit;
  const type = String(node.type || '').toLowerCase();
  if (type === 'trigger') return 'manual';
  if (type === 'agent' || type === 'ai') return type;
  if (definitions[type]) return type;
  const identity = `${node.id || ''} ${node.title || ''}`.toLowerCase();
  for (const kind of ['branch', 'approval', 'delay', 'transform', 'http', 'make', 'webhook', 'schedule']) {
    if (identity.includes(kind)) return kind;
  }
  return type || 'manual';
}

export function getNodeDefinition(nodeOrKind) {
  const kind = definitionKindFromNode(nodeOrKind);
  return NODE_DEFINITIONS[kind] || NODE_DEFINITIONS.provider;
}

export function getNodeKind(node) {
  return getNodeDefinition(node).nativeKind;
}

export function getDefinitionKind(node) {
  return getNodeDefinition(node).kind;
}

export function getPorts(node, direction = 'all') {
  const definition = getNodeDefinition(node);
  if (direction === 'input') return [...definition.inputs];
  if (direction === 'output') return [...definition.outputs];
  return [...definition.inputs, ...definition.outputs];
}

export function getPort(node, portId, direction = 'all') {
  return getPorts(node, direction).find((entry) => entry.id === portId) || null;
}

export function getConfigFields(node) {
  return [...getNodeDefinition(node).configFields];
}

export function getDefaultConfigForKind(kindOrNode) {
  const definition = getNodeDefinition(kindOrNode);
  if (definition.kind === 'agent') return { ...cloneValue(NODE_DEFINITIONS.ai.defaults), kind: 'ai' };
  return { ...cloneValue(definition.defaults || {}) };
}

export function getDefinitionVersion(node) {
  return getNodeDefinition(node).version;
}

export function arePortTypesCompatible(sourceType, targetType) {
  if (!sourceType || !targetType) return true;
  if (sourceType === DATA_TYPES.ANY || targetType === DATA_TYPES.ANY) return true;
  return sourceType === targetType;
}

export function validateConfigValue(configValue, descriptor) {
  if (!descriptor) return { valid: true, issues: [] };
  if (descriptor.required && (configValue === undefined || configValue === null || configValue === '')) {
    return { valid: false, issues: [{ code: 'config_required', field: descriptor.key, message: `${descriptor.label} is required.` }] };
  }
  if (configValue === undefined || configValue === null || configValue === '') return { valid: true, issues: [] };
  const valid = valueMatchesKind(configValue, descriptor.type);
  if (valid) return { valid: true, issues: [] };
  return { valid: false, issues: [{ code: 'config_type', field: descriptor.key, message: `${descriptor.label} has an invalid value.` }] };
}

export function getDefinitionCatalog() {
  return Object.values(NODE_DEFINITIONS).map((definition) => ({
    ...definition,
    inputs: [...definition.inputs],
    outputs: [...definition.outputs],
    configFields: [...definition.configFields],
    defaults: cloneValue(definition.defaults),
  }));
}
