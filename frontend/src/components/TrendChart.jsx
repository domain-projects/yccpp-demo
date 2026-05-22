import React from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  CartesianGrid,
} from 'recharts';

function formatTime(ts) {
  const d = new Date(ts);
  return `${d.getHours().toString().padStart(2, '0')}:${d
    .getMinutes()
    .toString()
    .padStart(2, '0')}`;
}

export default function TrendChart({ trend }) {
  if (!trend) return null;

  const data = trend.data.map((p) => ({
    time: formatTime(p.timestamp),
    fullTime: p.timestamp,
    value: p.value,
  }));

  const overAlarm = trend.alarm != null && trend.current >= trend.alarm;
  const overWarning = trend.warning != null && trend.current >= trend.warning;
  const lineColor = overAlarm ? '#ef4444' : overWarning ? '#f59e0b' : '#00d4ff';

  return (
    <div className="bg-plant-card border border-plant-border rounded-lg p-5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="text-xs uppercase tracking-wider text-plant-muted">
            48-hour trend
          </div>
          <div className="text-plant-text font-semibold text-lg mt-0.5">
            {trend.label}{' '}
            <span className="text-plant-muted font-normal text-sm">({trend.unit})</span>
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs uppercase tracking-wider text-plant-muted">Current</div>
          <div
            className={`text-2xl font-mono font-bold ${
              overAlarm
                ? 'text-plant-bad'
                : overWarning
                ? 'text-plant-warn'
                : 'text-plant-text'
            }`}
          >
            {trend.current} <span className="text-sm text-plant-muted">{trend.unit}</span>
          </div>
        </div>
      </div>

      <div className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1f2a3d" />
            <XAxis
              dataKey="time"
              stroke="#7c8aa0"
              tick={{ fontSize: 11 }}
              interval={Math.floor(data.length / 8)}
            />
            <YAxis stroke="#7c8aa0" tick={{ fontSize: 11 }} domain={['auto', 'auto']} />
            <Tooltip
              contentStyle={{
                background: '#0f1520',
                border: '1px solid #1f2a3d',
                borderRadius: 6,
                fontSize: 12,
              }}
              labelStyle={{ color: '#7c8aa0' }}
              formatter={(v) => [`${v} ${trend.unit}`, trend.label]}
            />
            {trend.warning != null && (
              <ReferenceLine
                y={trend.warning}
                stroke="#f59e0b"
                strokeDasharray="5 5"
                label={{
                  value: `Warning (${trend.warning})`,
                  position: 'insideTopRight',
                  fill: '#f59e0b',
                  fontSize: 11,
                }}
              />
            )}
            {trend.alarm != null && (
              <ReferenceLine
                y={trend.alarm}
                stroke="#ef4444"
                strokeDasharray="5 5"
                label={{
                  value: `Alarm (${trend.alarm})`,
                  position: 'insideTopRight',
                  fill: '#ef4444',
                  fontSize: 11,
                }}
              />
            )}
            <Line
              type="monotone"
              dataKey="value"
              stroke={lineColor}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
