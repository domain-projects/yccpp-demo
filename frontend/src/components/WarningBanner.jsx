import React from 'react';

export default function WarningBanner({ alerts }) {
  if (!alerts || alerts.length === 0) return null;
  const a = alerts[0];
  const severityClass =
    a.severity === 'ALARM'
      ? 'bg-plant-bad/10 border-plant-bad/50 text-plant-bad'
      : 'bg-plant-warn/10 border-plant-warn/50 text-plant-warn';
  return (
    <div className={`border rounded-lg px-4 py-3 flex items-start gap-3 ${severityClass}`}>
      <div className="w-8 h-8 rounded-full bg-current/10 flex items-center justify-center shrink-0">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="font-semibold tracking-wide text-sm">{a.severity}</span>
          <span className="text-xs opacity-70">
            Active since {new Date(a.since).toLocaleString('en-IN', { hour12: false })}
          </span>
        </div>
        <div className="text-sm mt-0.5 text-plant-text">{a.message}</div>
      </div>
    </div>
  );
}
