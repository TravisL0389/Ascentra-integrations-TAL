import { normalizeWorkflow, workflowFingerprint } from './model.js';

export const DRAFT_SCHEMA_VERSION = 1;
export const DRAFT_STORAGE_PREFIX = 'tal:atom-builder:draft:';

function storageOrDefault(storage) {
  if (storage) return storage;
  try {
    return typeof globalThis !== 'undefined' ? globalThis.localStorage : null;
  } catch {
    return null;
  }
}

function storageKey(flowId) {
  return `${DRAFT_STORAGE_PREFIX}${String(flowId || 'untitled')}`;
}

export function createDraftRecord(workflow, metadata = {}) {
  const normalized = normalizeWorkflow(workflow);
  return {
    schemaVersion: DRAFT_SCHEMA_VERSION,
    flowId: String(metadata.flowId || metadata.workflowId || 'untitled'),
    workflowId: metadata.workflowId == null ? null : String(metadata.workflowId),
    revision: workflowFingerprint(normalized),
    savedAt: metadata.savedAt || new Date().toISOString(),
    graph: normalized,
    ...metadata,
  };
}

export function serializeDraftRecord(workflow, metadata = {}) {
  return JSON.stringify(createDraftRecord(workflow, metadata));
}

export function saveDraft(workflow, metadata = {}, storage) {
  const target = storageOrDefault(storage);
  const record = createDraftRecord(workflow, metadata);
  if (!target?.setItem) return record;
  try {
    target.setItem(storageKey(record.flowId), JSON.stringify(record));
  } catch {
    return { ...record, storageError: true };
  }
  return record;
}

export function loadDraft(flowId, storage) {
  const target = storageOrDefault(storage);
  if (!target?.getItem) return null;
  try {
    const raw = target.getItem(storageKey(flowId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.schemaVersion !== DRAFT_SCHEMA_VERSION || !parsed.graph) return null;
    return { ...parsed, graph: normalizeWorkflow(parsed.graph), revision: parsed.revision || workflowFingerprint(parsed.graph) };
  } catch {
    return null;
  }
}

export function clearDraft(flowId, storage) {
  const target = storageOrDefault(storage);
  if (!target?.removeItem) return false;
  try {
    target.removeItem(storageKey(flowId));
    return true;
  } catch {
    return false;
  }
}

export function listDrafts(storage) {
  const target = storageOrDefault(storage);
  if (!target) return [];
  const records = [];
  try {
    for (let index = 0; index < target.length; index += 1) {
      const key = target.key(index);
      if (!key?.startsWith(DRAFT_STORAGE_PREFIX)) continue;
      const value = target.getItem(key);
      if (!value) continue;
      try {
        const record = JSON.parse(value);
        if (record?.schemaVersion === DRAFT_SCHEMA_VERSION) records.push({ ...record, graph: normalizeWorkflow(record.graph) });
      } catch {
        records.push({ storageKey: key, invalid: true });
      }
    }
  } catch {
    return records;
  }
  return records.sort((left, right) => String(right.savedAt || '').localeCompare(String(left.savedAt || '')));
}

export function buildVersionPayload(workflow, metadata = {}) {
  const normalized = normalizeWorkflow(workflow);
  return {
    graph: normalized,
    version: metadata.version ?? null,
    status: metadata.status || 'draft',
    changeSummary: metadata.changeSummary || '',
    revision: workflowFingerprint(normalized),
  };
}

export function nextVersionNumber(versions = []) {
  const numbers = (Array.isArray(versions) ? versions : [])
    .map((version) => Number(version?.version ?? version))
    .filter((version) => Number.isInteger(version) && version >= 0);
  return numbers.length ? Math.max(...numbers) + 1 : 1;
}

export function compareRevisions(left, right) {
  if (left === right) return 'same';
  return left && right ? 'different' : left || right ? 'missing' : 'empty';
}

export function detectSaveConflict({ expectedRevision, remoteGraph, localGraph, remoteRevision } = {}) {
  const actualRevision = remoteRevision || (remoteGraph ? workflowFingerprint(remoteGraph) : null);
  const localRevision = localGraph ? workflowFingerprint(localGraph) : null;
  if (!expectedRevision) return { conflict: false, expectedRevision: null, actualRevision, localRevision, relation: compareRevisions(actualRevision, localRevision) };
  if (actualRevision === expectedRevision) return { conflict: false, expectedRevision, actualRevision, localRevision, relation: 'same' };
  return { conflict: true, expectedRevision, actualRevision, localRevision, relation: 'different' };
}

export function buildConflictPayload({ expectedRevision, remoteGraph, localGraph } = {}) {
  return {
    expectedRevision: expectedRevision || null,
    remoteGraph: remoteGraph ? normalizeWorkflow(remoteGraph) : null,
    localGraph: localGraph ? normalizeWorkflow(localGraph) : null,
  };
}
