import React from 'react';

function statusColors(status) {
  switch (status) {
    case 'WARNING':
      return { bg: 'bg-plant-warn/15', text: 'text-plant-warn', dot: 'bg-plant-warn' };
    case 'ALARM':
      return { bg: 'bg-plant-bad/15', text: 'text-plant-bad', dot: 'bg-plant-bad' };
    default:
      return { bg: 'bg-plant-good/15', text: 'text-plant-good', dot: 'bg-plant-good' };
  }
}

function healthBarColor(score) {
  if (score >= 85) return 'bg-plant-good';
  if (score >= 65) return 'bg-plant-warn';
  return 'bg-plant-bad';
}

export default function AssetSidebar({ assets, selectedId, onSelect }) {
  const totalMW = assets
    .filter((a) => a.currentOutputMW)
    .reduce((s, a) => s + a.currentOutputMW, 0);

  return (
    <aside className="w-80 shrink-0 border-r border-plant-border bg-plant-panel flex flex-col">
      <div className="px-4 py-3 border-b border-plant-border">
        <div className="text-xs uppercase tracking-wider text-plant-muted">Plant Output</div>
        <div className="flex items-baseline gap-2 mt-1">
          <div className="text-2xl font-bold text-plant-text font-mono">
            {totalMW.toFixed(1)}
          </div>
          <div className="text-sm text-plant-muted">/ 370 MW</div>
        </div>
        <div className="mt-2 h-1.5 bg-plant-border rounded overflow-hidden">
          <div
            className="h-full bg-plant-accent"
            style={{ width: `${Math.min(100, (totalMW / 370) * 100)}%` }}
          />
        </div>
      </div>

      <div className="px-4 pt-4 pb-2 text-xs uppercase tracking-wider text-plant-muted">
        Assets ({assets.length})
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-4 space-y-1.5">
        {assets.map((a) => {
          const c = statusColors(a.status);
          const selected = a.id === selectedId;
          return (
            <button
              key={a.id}
              onClick={() => onSelect(a.id)}
              className={`w-full text-left rounded-md border transition-all px-3 py-3 ${
                selected
                  ? 'border-plant-accent bg-plant-accent/5'
                  : 'border-plant-border bg-plant-card hover:border-plant-muted'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${c.dot} ${a.status !== 'NORMAL' ? 'pulse-dot' : ''}`} />
                  <span className="font-mono text-sm text-plant-text font-semibold">
                    {a.id}
                  </span>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded ${c.bg} ${c.text} font-semibold tracking-wide`}>
                  {a.status}
                </span>
              </div>
              <div className="mt-1 text-xs text-plant-muted">{a.name}</div>
              <div className="mt-3 flex items-center justify-between text-[11px] text-plant-muted">
                <span>Health</span>
                <span className="font-mono text-plant-text">{a.healthScore}/100</span>
              </div>
              <div className="mt-1 h-1.5 bg-plant-border rounded overflow-hidden">
                <div
                  className={`h-full ${healthBarColor(a.healthScore)}`}
                  style={{ width: `${a.healthScore}%` }}
                />
              </div>
              <div className="mt-2 flex items-center justify-between text-[11px]">
                <span className="text-plant-muted">
                  {a.capacityMW ? `${a.capacityMW} MW` : a.type}
                </span>
                <span className="font-mono text-plant-text">
                  {a.currentOutputMW != null ? `${a.currentOutputMW} MW` : '—'}
                </span>
              </div>
              {a.alertCount > 0 && (
                <div className="mt-2 text-[11px] text-plant-warn">
                  {a.alertCount} active alert{a.alertCount > 1 ? 's' : ''}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </aside>
  );
}
