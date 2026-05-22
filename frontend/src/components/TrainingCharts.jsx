import React from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  ScatterChart,
  Scatter,
  ReferenceLine,
  AreaChart,
  Area,
} from 'recharts';

const CHART_GRID = '#1f2a3d';
const CHART_AXIS = '#7c8aa0';
const TOOLTIP_STYLE = {
  background: '#0f1520',
  border: '1px solid #1f2a3d',
  borderRadius: 6,
  fontSize: 11,
};
const TOOLTIP_LABEL = { color: '#7c8aa0' };

function CardShell({ title, children, accent = 'text-plant-text' }) {
  return (
    <div className="bg-plant-card border border-plant-border rounded-lg p-4">
      <div className={`text-xs font-semibold mb-2 ${accent}`}>{title}</div>
      <div className="h-48">{children}</div>
    </div>
  );
}

function LossChart({ data, yLabel, color }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
        <XAxis dataKey="epoch" stroke={CHART_AXIS} tick={{ fontSize: 10 }} />
        <YAxis stroke={CHART_AXIS} tick={{ fontSize: 10 }} />
        <Tooltip contentStyle={TOOLTIP_STYLE} labelStyle={TOOLTIP_LABEL} />
        <Legend wrapperStyle={{ fontSize: 10, color: CHART_AXIS }} />
        <Line type="monotone" dataKey="train" name={`train ${yLabel}`} stroke={color} strokeWidth={2} dot={false} isAnimationActive={false} />
        <Line type="monotone" dataKey="val" name={`val ${yLabel}`} stroke="#f59e0b" strokeWidth={2} strokeDasharray="4 3" dot={false} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

function ScatterPlot({ data }) {
  // y = x reference
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ScatterChart margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
        <XAxis
          type="number"
          dataKey="actual"
          name="Actual η_c (%)"
          stroke={CHART_AXIS}
          tick={{ fontSize: 10 }}
          domain={['dataMin - 0.2', 'dataMax + 0.2']}
        />
        <YAxis
          type="number"
          dataKey="predicted"
          name="Predicted η_c (%)"
          stroke={CHART_AXIS}
          tick={{ fontSize: 10 }}
          domain={['dataMin - 0.2', 'dataMax + 0.2']}
        />
        <Tooltip
          cursor={{ strokeDasharray: '3 3' }}
          contentStyle={TOOLTIP_STYLE}
          labelStyle={TOOLTIP_LABEL}
          formatter={(v, name) => [`${v}%`, name]}
        />
        <ReferenceLine
          segment={[
            { x: 82, y: 82 },
            { x: 88, y: 88 },
          ]}
          stroke="#7c8aa0"
          strokeDasharray="4 3"
        />
        <Scatter data={data} fill="#00d4ff" />
      </ScatterChart>
    </ResponsiveContainer>
  );
}

function RocChart({ data }) {
  // AUC area
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
        <defs>
          <linearGradient id="rocFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#22c55e" stopOpacity={0.4} />
            <stop offset="100%" stopColor="#22c55e" stopOpacity={0.05} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={CHART_GRID} />
        <XAxis dataKey="fpr" stroke={CHART_AXIS} tick={{ fontSize: 10 }} domain={[0, 1]} type="number" />
        <YAxis stroke={CHART_AXIS} tick={{ fontSize: 10 }} domain={[0, 1]} />
        <Tooltip
          contentStyle={TOOLTIP_STYLE}
          labelStyle={TOOLTIP_LABEL}
          formatter={(v, name) => [v.toFixed(3), name === 'tpr' ? 'TPR' : name]}
          labelFormatter={(l) => `FPR ${Number(l).toFixed(2)}`}
        />
        <ReferenceLine
          segment={[
            { x: 0, y: 0 },
            { x: 1, y: 1 },
          ]}
          stroke="#7c8aa0"
          strokeDasharray="4 3"
        />
        <Area
          type="monotone"
          dataKey="tpr"
          stroke="#22c55e"
          strokeWidth={2}
          fill="url(#rocFill)"
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function ConfusionMatrix({ cm }) {
  const total = cm.truePositive + cm.falsePositive + cm.trueNegative + cm.falseNegative;
  const cells = [
    {
      label: 'True Positive',
      value: cm.truePositive,
      pct: (cm.truePositive / total) * 100,
      color: 'bg-plant-good/30 text-plant-good border-plant-good/50',
    },
    {
      label: 'False Negative',
      value: cm.falseNegative,
      pct: (cm.falseNegative / total) * 100,
      color: 'bg-plant-bad/20 text-plant-bad border-plant-bad/40',
    },
    {
      label: 'False Positive',
      value: cm.falsePositive,
      pct: (cm.falsePositive / total) * 100,
      color: 'bg-plant-warn/20 text-plant-warn border-plant-warn/40',
    },
    {
      label: 'True Negative',
      value: cm.trueNegative,
      pct: (cm.trueNegative / total) * 100,
      color: 'bg-plant-good/30 text-plant-good border-plant-good/50',
    },
  ];
  const precision = cm.truePositive / (cm.truePositive + cm.falsePositive);
  const recall = cm.truePositive / (cm.truePositive + cm.falseNegative);
  const f1 = (2 * precision * recall) / (precision + recall);
  const accuracy = (cm.truePositive + cm.trueNegative) / total;

  return (
    <div className="h-full flex flex-col">
      <div className="grid grid-cols-[40px_1fr_1fr] gap-1 flex-1">
        <div />
        <div className="text-[9px] text-plant-muted text-center self-end pb-1">
          Pred: Anomaly
        </div>
        <div className="text-[9px] text-plant-muted text-center self-end pb-1">
          Pred: Normal
        </div>
        <div className="text-[9px] text-plant-muted self-center text-right pr-1">
          Anomaly
        </div>
        {cells.slice(0, 2).map((c, i) => (
          <div
            key={i}
            className={`border rounded flex flex-col items-center justify-center ${c.color}`}
          >
            <div className="text-base font-mono font-bold">{c.value}</div>
            <div className="text-[9px] opacity-80">{c.label}</div>
          </div>
        ))}
        <div className="text-[9px] text-plant-muted self-center text-right pr-1">Normal</div>
        {cells.slice(2, 4).map((c, i) => (
          <div
            key={i}
            className={`border rounded flex flex-col items-center justify-center ${c.color}`}
          >
            <div className="text-base font-mono font-bold">{c.value}</div>
            <div className="text-[9px] opacity-80">{c.label}</div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-4 gap-1 mt-1 text-center text-[10px]">
        <div>
          <div className="text-plant-muted">Acc</div>
          <div className="font-mono text-plant-text">{(accuracy * 100).toFixed(1)}%</div>
        </div>
        <div>
          <div className="text-plant-muted">Prec</div>
          <div className="font-mono text-plant-text">{(precision * 100).toFixed(1)}%</div>
        </div>
        <div>
          <div className="text-plant-muted">Rec</div>
          <div className="font-mono text-plant-text">{(recall * 100).toFixed(1)}%</div>
        </div>
        <div>
          <div className="text-plant-muted">F1</div>
          <div className="font-mono text-plant-text">{f1.toFixed(3)}</div>
        </div>
      </div>
    </div>
  );
}

export default function TrainingCharts({ charts }) {
  if (!charts) return null;
  return (
    <>
      {/* Loss curves row */}
      <div className="grid grid-cols-3 gap-3">
        <CardShell title="PINN — training & validation loss" accent="text-plant-accent">
          <LossChart data={charts.pinnLoss} yLabel="MSE" color="#00d4ff" />
        </CardShell>
        <CardShell title="LSTM — fouling forecast MAE" accent="text-plant-accent">
          <LossChart data={charts.lstmLoss} yLabel="days" color="#00d4ff" />
        </CardShell>
        <CardShell title="FFT autoencoder — reconstruction error" accent="text-plant-accent">
          <LossChart data={charts.fftLoss} yLabel="recon" color="#00d4ff" />
        </CardShell>
      </div>

      {/* Scatter + confusion */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-plant-card border border-plant-border rounded-lg p-4">
          <div className="text-xs font-semibold mb-2 text-plant-text">
            PINN — predicted vs actual η_c (test set · OEM commissioning data)
          </div>
          <div className="h-56">
            <ScatterPlot data={charts.scatter} />
          </div>
        </div>
        <div className="bg-plant-card border border-plant-border rounded-lg p-4">
          <div className="text-xs font-semibold mb-2 text-plant-text">
            Alarm classifier — confusion matrix (bearing anomaly)
          </div>
          <div className="h-56">
            <ConfusionMatrix cm={charts.confusionMatrix} />
          </div>
        </div>
      </div>

      {/* ROC */}
      <div className="bg-plant-card border border-plant-border rounded-lg p-4">
        <div className="text-xs font-semibold mb-2 text-plant-text">
          ROC curve — FFT autoencoder bearing anomaly (AUC = 0.941)
        </div>
        <div className="h-56">
          <RocChart data={charts.rocCurve} />
        </div>
      </div>
    </>
  );
}
