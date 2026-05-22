import React from 'react';

function statusBadge(status) {
  const map = {
    NORMAL: 'bg-plant-good/15 text-plant-good border-plant-good/40',
    WARNING: 'bg-plant-warn/15 text-plant-warn border-plant-warn/40',
    ALARM: 'bg-plant-bad/15 text-plant-bad border-plant-bad/40',
  };
  return map[status] || map.NORMAL;
}

function Stat({ label, value, sub }) {
  return (
    <div className="bg-plant-card border border-plant-border rounded-md px-4 py-3">
      <div className="text-[11px] uppercase tracking-wider text-plant-muted">{label}</div>
      <div className="text-plant-text font-mono text-xl mt-0.5">{value}</div>
      {sub && <div className="text-[11px] text-plant-muted mt-0.5">{sub}</div>}
    </div>
  );
}

export default function AssetHeader({ asset }) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <span className="font-mono text-plant-accent text-sm">{asset.id}</span>
            <h1 className="text-2xl font-semibold text-plant-text">{asset.name}</h1>
            <span
              className={`text-[11px] px-2 py-0.5 rounded border font-semibold tracking-wide ${statusBadge(
                asset.status
              )}`}
            >
              {asset.status}
            </span>
          </div>
          <div className="text-sm text-plant-muted mt-1">
            {asset.type} · {asset.location} · {asset.runtimeHours.toLocaleString()} runtime hours
            · Last maintenance {asset.lastMaintenance}
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-4 gap-3">
        <Stat
          label="Output"
          value={asset.currentOutputMW != null ? `${asset.currentOutputMW}` : '—'}
          sub={asset.capacityMW ? `of ${asset.capacityMW} MW` : null}
        />
        <Stat label="Health" value={`${asset.healthScore}/100`} />
        <Stat label="Runtime" value={`${(asset.runtimeHours / 1000).toFixed(1)}k h`} />
        <Stat label="Active alerts" value={asset.alerts.length} />
      </div>
    </div>
  );
}
