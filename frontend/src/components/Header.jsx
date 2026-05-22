import React from 'react';

export default function Header({ generatedAt }) {
  const time = generatedAt ? new Date(generatedAt) : new Date();
  return (
    <header className="border-b border-plant-border bg-plant-panel">
      <div className="px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded bg-plant-accent/10 border border-plant-accent/40 flex items-center justify-center">
            <span className="text-plant-accent font-bold text-lg">Y</span>
          </div>
          <div>
            <div className="text-plant-text font-semibold text-base tracking-wide">
              YCCPP AI Platform
              <span className="text-plant-muted font-normal"> | 370 MW | KPCL Bengaluru</span>
            </div>
            <div className="text-xs text-plant-muted">
              Yelahanka Combined Cycle Power Plant · Predictive Maintenance
            </div>
          </div>
        </div>
        <div className="flex items-center gap-6 text-xs">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-plant-good pulse-dot" />
            <span className="text-plant-muted">LIVE</span>
          </div>
          <div className="text-plant-muted">
            Plant time:{' '}
            <span className="text-plant-text font-mono">
              {time.toLocaleTimeString('en-IN', { hour12: false })}
            </span>
          </div>
          <div className="text-plant-muted">
            Shift: <span className="text-plant-text">A (06:00 — 14:00)</span>
          </div>
        </div>
      </div>
    </header>
  );
}
