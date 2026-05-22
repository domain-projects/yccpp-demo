import React, { useState } from 'react';

function ConfidenceBadge({ confidence }) {
  const map = {
    HIGH: 'bg-plant-good/15 text-plant-good border-plant-good/40',
    MEDIUM: 'bg-plant-warn/15 text-plant-warn border-plant-warn/40',
    LOW: 'bg-plant-muted/15 text-plant-muted border-plant-muted/40',
  };
  const cls = map[confidence] || map.MEDIUM;
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded border font-semibold tracking-wide ${cls}`}>
      {confidence} CONFIDENCE
    </span>
  );
}

function PriorityPill({ priority }) {
  const map = {
    P1: 'bg-plant-bad/15 text-plant-bad',
    P2: 'bg-plant-warn/15 text-plant-warn',
    P3: 'bg-plant-good/15 text-plant-good',
  };
  return (
    <span className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold ${map[priority] || map.P3}`}>
      {priority}
    </span>
  );
}

export default function AIAnalysisCard({ analysis, onApprove, onReject, decision, workOrder }) {
  const [busy, setBusy] = useState(null);

  if (!analysis) return null;

  const handleApprove = async () => {
    setBusy('approve');
    try {
      await onApprove();
    } finally {
      setBusy(null);
    }
  };

  const handleReject = async () => {
    setBusy('reject');
    try {
      await onReject();
    } finally {
      setBusy(null);
    }
  };

  const prob = analysis.rootCause?.probability ?? 0;

  return (
    <div className="bg-plant-card border border-plant-border rounded-lg overflow-hidden">
      <div className="px-5 py-3 border-b border-plant-border bg-plant-panel flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-plant-accent pulse-dot" />
          <span className="text-sm font-semibold text-plant-text">AI Root Cause Analysis</span>
          <span className="text-[10px] uppercase tracking-wider text-plant-muted">
            {analysis.source === 'claude' ? `Claude · ${analysis.model || ''}` : 'Mock (no API key)'}
          </span>
        </div>
        {analysis.rootCause?.confidence && <ConfidenceBadge confidence={analysis.rootCause.confidence} />}
      </div>

      <div className="p-5 space-y-5">
        {/* Executive summary */}
        {analysis.summary && (
          <div className="bg-plant-panel border border-plant-border rounded-md p-3 text-sm text-plant-text leading-relaxed">
            {analysis.summary}
          </div>
        )}

        {/* Root cause + TTF */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-plant-muted mb-1">
              Root cause hypothesis
            </div>
            <div className="text-plant-text text-sm leading-relaxed">
              {analysis.rootCause?.hypothesis}
            </div>
            <div className="mt-3">
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-plant-muted">Probability</span>
                <span className="font-mono text-plant-text font-semibold">{prob}%</span>
              </div>
              <div className="h-2 bg-plant-border rounded overflow-hidden">
                <div
                  className={`h-full ${
                    prob >= 70 ? 'bg-plant-bad' : prob >= 40 ? 'bg-plant-warn' : 'bg-plant-good'
                  }`}
                  style={{ width: `${prob}%` }}
                />
              </div>
            </div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wider text-plant-muted mb-1">
              Estimated time to failure
            </div>
            <div className="text-plant-bad text-xl font-semibold">
              {analysis.timeToFailure?.estimate}
            </div>
            <div className="text-xs text-plant-muted mt-2 leading-relaxed">
              {analysis.timeToFailure?.basis}
            </div>
          </div>
        </div>

        {/* Evidence */}
        {analysis.evidence?.length > 0 && (
          <div>
            <div className="text-[11px] uppercase tracking-wider text-plant-muted mb-2">
              Evidence
            </div>
            <ul className="space-y-1.5">
              {analysis.evidence.map((e, i) => (
                <li key={i} className="text-sm text-plant-text flex gap-2">
                  <span className="text-plant-accent mt-0.5">›</span>
                  <span>{e}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Immediate actions */}
        {analysis.immediateActions?.length > 0 && (
          <div>
            <div className="text-[11px] uppercase tracking-wider text-plant-muted mb-2">
              Recommended immediate actions
            </div>
            <div className="space-y-2">
              {analysis.immediateActions.map((a, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 bg-plant-panel border border-plant-border rounded-md px-3 py-2"
                >
                  <PriorityPill priority={a.priority} />
                  <div className="flex-1 text-sm text-plant-text">{a.action}</div>
                  <div className="text-xs text-plant-muted shrink-0">{a.owner}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Secondary hypotheses */}
        {analysis.secondaryHypotheses?.length > 0 && (
          <div>
            <div className="text-[11px] uppercase tracking-wider text-plant-muted mb-2">
              Secondary hypotheses
            </div>
            <div className="space-y-1">
              {analysis.secondaryHypotheses.map((h, i) => (
                <div key={i} className="flex items-center gap-3 text-sm">
                  <span className="font-mono text-plant-muted w-10">{h.probability}%</span>
                  <span className="text-plant-text">{h.hypothesis}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action buttons */}
        {!decision && (
          <div className="flex items-center gap-3 pt-2 border-t border-plant-border">
            <button
              onClick={handleApprove}
              disabled={!!busy}
              className="px-5 py-2 rounded-md bg-plant-good text-black font-semibold text-sm hover:bg-plant-good/90 disabled:opacity-50"
            >
              {busy === 'approve' ? 'Creating work order…' : 'Approve & Create Work Order'}
            </button>
            <button
              onClick={handleReject}
              disabled={!!busy}
              className="px-5 py-2 rounded-md bg-plant-card border border-plant-border text-plant-text font-semibold text-sm hover:border-plant-muted disabled:opacity-50"
            >
              {busy === 'reject' ? 'Logging…' : 'Reject Recommendation'}
            </button>
            <span className="text-xs text-plant-muted ml-auto">
              Decision will be logged to the audit trail
            </span>
          </div>
        )}

        {/* Decision confirmation */}
        {decision === 'APPROVE' && workOrder && (
          <div className="border border-plant-good/40 bg-plant-good/10 rounded-md p-4">
            <div className="flex items-center gap-2">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2.5">
                <path d="M20 6L9 17l-5-5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="text-plant-good font-semibold">Work Order Created</span>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-3 text-sm">
              <div>
                <div className="text-[10px] uppercase text-plant-muted">Work Order</div>
                <div className="font-mono text-plant-text">{workOrder.number}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase text-plant-muted">Crew</div>
                <div className="text-plant-text">{workOrder.crew}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase text-plant-muted">ETA</div>
                <div className="text-plant-text">{workOrder.eta}</div>
              </div>
            </div>
          </div>
        )}
        {decision === 'REJECT' && (
          <div className="border border-plant-muted/40 bg-plant-muted/10 rounded-md p-4 text-sm text-plant-text">
            Recommendation rejected. Decision logged to audit trail. Continue monitoring.
          </div>
        )}
      </div>
    </div>
  );
}
