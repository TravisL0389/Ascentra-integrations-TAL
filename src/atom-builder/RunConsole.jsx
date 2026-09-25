import React from 'react';
import { Check, ChevronDown, MessageSquare, X } from 'lucide-react';
import { normalizeExecutionStatus, summarizeNodeRuns } from './execution.js';

function statusColor(status, accent) {
  const normalized = String(status || '').toLowerCase();
  if (normalized.includes('fail') || normalized.includes('error')) return '#f87171';
  if (normalized.includes('run') || normalized.includes('queue') || normalized.includes('wait')) return '#fbbf24';
  if (normalized.includes('success') || normalized.includes('complete') || normalized.includes('connect')) return accent;
  return 'rgba(255,255,255,0.62)';
}

export default function RunConsole({ open, onToggle, status, runId, entries, nodes, nativeRuns, accent, border }) {
  const nativeSummary = summarizeNodeRuns(Object.values(nativeRuns || {}));
  const completed = nativeSummary.summary.succeeded + nativeSummary.summary.skipped;
  const failed = nativeSummary.summary.failed;
  const normalizedStatus = normalizeExecutionStatus(status);
  return (
    <section className="builder-run-console" data-open={open} aria-label="Run console">
      <button type="button" className="builder-run-console__summary" onClick={onToggle} aria-expanded={open}>
        <span className="builder-run-console__title"><MessageSquare size={15} color={accent} /> Run console</span>
        <span className="builder-run-console__meta">
          <span style={{ color: statusColor(status, accent) }}>{status || 'Idle'}</span>
          <span>{completed}/{nodes.length} completed</span>
          {failed > 0 && <span style={{ color: '#f87171' }}>{failed} failed</span>}
          {runId && <span>{runId.slice(0, 8)}</span>}
          <ChevronDown size={14} style={{ transform: open ? 'rotate(180deg)' : 'none' }} />
        </span>
      </button>
      {open && (
        <div className="builder-run-console__body">
          {entries.length ? entries.map((entry) => (
            <div key={entry.id} className="builder-run-console__entry">
              <span className="builder-run-console__entryIcon"><Check size={12} color={statusColor(entry.status, accent)} /></span>
              <span>
                <strong>{entry.nodeTitle}</strong>
                <small>{entry.detail || 'No output recorded.'}</small>
              </span>
              <em style={{ color: statusColor(entry.status, accent) }}>{entry.status}</em>
            </div>
          )) : (
            <div className="builder-run-console__empty">Run this workflow to see each Atom’s status, output, and errors.</div>
          )}
          <button type="button" className="builder-run-console__close" onClick={onToggle}><X size={13} /> Close</button>
        </div>
      )}
    </section>
  );
}
