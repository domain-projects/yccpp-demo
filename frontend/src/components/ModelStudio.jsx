import React, { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import TrainingCharts from './TrainingCharts';

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

function Kpi({ label, value, sub, color = 'text-plant-text' }) {
  return (
    <div className="bg-plant-card border border-plant-border rounded-md px-4 py-3">
      <div className="text-[11px] uppercase tracking-wider text-plant-muted">{label}</div>
      <div className={`font-mono text-xl mt-0.5 ${color}`}>{value}</div>
      {sub && <div className="text-[11px] text-plant-muted mt-0.5">{sub}</div>}
    </div>
  );
}

export default function ModelStudio() {
  const [file, setFile] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [loadingDemo, setLoadingDemo] = useState(true);
  const inputRef = useRef(null);

  // Auto-load sample model output on mount so the page lands populated.
  useEffect(() => {
    let cancelled = false;
    setLoadingDemo(true);
    api
      .demoModel()
      .then((r) => {
        if (!cancelled) setResult(r);
      })
      .catch((e) => {
        if (!cancelled) setError(`Could not load sample: ${e.message}`);
      })
      .finally(() => {
        if (!cancelled) setLoadingDemo(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const resetToSample = async () => {
    setFile(null);
    setError(null);
    setLoadingDemo(true);
    try {
      const r = await api.demoModel();
      setResult(r);
    } catch (e) {
      setError(`Could not reload sample: ${e.message}`);
    } finally {
      setLoadingDemo(false);
    }
  };

  const onPick = (f) => {
    setError(null);
    setFile(f || null);
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files?.[0]) onPick(e.dataTransfer.files[0]);
  };

  const onGenerate = async () => {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const r = await api.generateModel(file);
      setResult(r);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const [downloading, setDownloading] = useState(false);
  const downloadSample = async () => {
    setDownloading(true);
    try {
      const res = await fetch(api.sampleDatasetUrl());
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'yccpp_gt01_sample_30d.csv';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(`Sample download failed: ${e.message}`);
    } finally {
      setDownloading(false);
    }
  };

  const formatBytes = (b) => {
    if (b < 1024) return `${b} B`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
    return `${(b / 1024 / 1024).toFixed(2)} MB`;
  };

  return (
    <div className="p-6 space-y-5 max-w-7xl mx-auto">
      {/* Intro */}
      <div className="bg-plant-card border border-plant-border rounded-lg p-5">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs uppercase tracking-wider text-plant-muted">AI Model Studio</div>
            <div className="text-xl font-semibold text-plant-text mt-1">
              Generate a predictive-maintenance model from customer SCADA data
            </div>
            <div className="text-sm text-plant-muted mt-2 max-w-3xl leading-relaxed">
              A sample analysis (synthetic GT-01 30-day dataset) is shown below by default.
              Upload a customer SCADA / historian export (XLSX, XLS, or CSV) to replace it with
              a tailored pipeline plan — Claude reviews the schema, assesses data fitness, and
              proposes a 3-model pipeline (PINN + LSTM + FFT autoencoder) with expected
              performance, feature importance, and next steps.
            </div>
          </div>
          <button
            onClick={downloadSample}
            disabled={downloading}
            className="shrink-0 ml-4 px-4 py-2 rounded-md border border-plant-border text-sm text-plant-text hover:border-plant-accent hover:text-plant-accent disabled:opacity-60"
          >
            {downloading ? 'Preparing…' : '↓ Download sample dataset'}
          </button>
        </div>
      </div>

      {/* Upload */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`bg-plant-card border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
          dragOver ? 'border-plant-accent bg-plant-accent/5' : 'border-plant-border'
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          className="hidden"
          onChange={(e) => onPick(e.target.files?.[0])}
        />
        <div className="flex flex-col items-center gap-3">
          <div className="w-14 h-14 rounded-full bg-plant-accent/10 border border-plant-accent/30 flex items-center justify-center">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#00d4ff" strokeWidth="2">
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          {!file ? (
            <>
              <div className="text-plant-text font-medium">
                Drop SCADA export here, or{' '}
                <button
                  onClick={() => inputRef.current?.click()}
                  className="text-plant-accent hover:underline"
                >
                  browse
                </button>
              </div>
              <div className="text-xs text-plant-muted">
                Accepts .csv, .xlsx, .xls · up to 20 MB
              </div>
            </>
          ) : (
            <>
              <div className="text-plant-text font-medium">{file.name}</div>
              <div className="text-xs text-plant-muted">{formatBytes(file.size)}</div>
              <div className="flex gap-2 mt-2">
                <button
                  onClick={onGenerate}
                  disabled={busy}
                  className="px-5 py-2 rounded-md bg-plant-accent text-black font-semibold text-sm hover:bg-plant-accent/90 disabled:opacity-60"
                >
                  {busy ? 'Generating model…' : 'Generate AI Model'}
                </button>
                <button
                  onClick={() => onPick(null)}
                  disabled={busy}
                  className="px-4 py-2 rounded-md border border-plant-border text-sm text-plant-text hover:border-plant-muted disabled:opacity-60"
                >
                  Clear
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="border border-plant-bad/40 bg-plant-bad/10 rounded-md p-3 text-sm text-plant-bad">
          Generation failed: {error}
        </div>
      )}

      {(busy || loadingDemo) && (
        <div className="bg-plant-card border border-plant-border rounded-lg p-5 flex items-center gap-3 text-plant-muted text-sm">
          <span className="w-2 h-2 rounded-full bg-plant-accent pulse-dot" />
          {busy
            ? 'Parsing dataset · profiling columns · sending compact summary to Claude…'
            : 'Loading sample analysis (synthetic GT-01 dataset)…'}
        </div>
      )}

      {result && (
        <ModelResult
          result={result}
          onResetToSample={result?.datasetSummary?.isSample ? null : resetToSample}
        />
      )}
    </div>
  );
}

function ModelResult({ result, onResetToSample }) {
  const ds = result.datasetSummary;
  const isSample = !!ds?.isSample;
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-plant-card border border-plant-border rounded-lg overflow-hidden">
        <div className="px-5 py-3 border-b border-plant-border bg-plant-panel flex items-center justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="w-2 h-2 rounded-full bg-plant-accent pulse-dot" />
            <span className="text-sm font-semibold text-plant-text">Generated Model Plan</span>
            <span className="text-[10px] uppercase tracking-wider text-plant-muted">
              {result.source === 'claude' ? `Claude · ${result.model || ''}` : 'Mock (no API key)'}
            </span>
            {isSample && (
              <span className="text-[10px] px-2 py-0.5 rounded border border-plant-accent/40 bg-plant-accent/10 text-plant-accent font-semibold tracking-wide">
                SAMPLE DATASET
              </span>
            )}
            <span className="text-[10px] px-2 py-0.5 rounded border border-plant-border text-plant-muted font-mono">
              {ds?.filename}
            </span>
          </div>
          <div className="flex items-center gap-3">
            {onResetToSample && (
              <button
                onClick={onResetToSample}
                className="text-[11px] text-plant-muted hover:text-plant-accent"
              >
                ↺ Reset to sample
              </button>
            )}
            <span className="text-[10px] text-plant-muted">
              {new Date(result.generatedAt).toLocaleString('en-IN', { hour12: false })}
            </span>
          </div>
        </div>

        <div className="p-5 space-y-4">
          <div className="bg-plant-panel border border-plant-border rounded-md p-3 text-sm text-plant-text leading-relaxed">
            {result.summary}
          </div>

          {/* Dataset KPIs */}
          <div className="grid grid-cols-4 gap-3">
            <Kpi label="Rows" value={ds.rowCount.toLocaleString()} sub={ds.timeRange ? `${ds.timeRange.spanHours} h span` : null} />
            <Kpi label="Columns" value={ds.columnCount} sub={ds.timestampColumn ? `ts: ${ds.timestampColumn}` : 'no timestamp'} />
            <Kpi
              label="Verdict"
              value={result.datasetAssessment.verdict.split(' ')[0]}
              sub={result.datasetAssessment.verdict}
              color="text-plant-good"
            />
            <Kpi
              label="Early warning"
              value={result.expectedPerformance.earlyWarning}
              color="text-plant-accent"
            />
          </div>
        </div>
      </div>

      {/* Training KPI strip — matches kpcl_showcase_demo */}
      {result.trainingData && (
        <div className="grid grid-cols-6 gap-3">
          <Kpi
            label="Training data"
            value={result.trainingData.span}
            sub={`${result.trainingData.asset} · ${result.trainingData.tagCount} tags · ${result.trainingData.samplingRate}`}
          />
          <Kpi
            label="PINN MAE"
            value="±0.3%"
            sub="η_c on OEM test data"
            color="text-plant-good"
          />
          <Kpi
            label="LSTM accuracy"
            value="88.2%"
            sub="±4 day wash prediction"
            color="text-plant-good"
          />
          <Kpi
            label="FFT-AE AUC"
            value="0.941"
            sub="Bearing anomaly ROC"
            color="text-plant-good"
          />
          <Kpi
            label="Train/Val/Test"
            value={result.trainingData.trainValTest}
            sub="% of GT historian"
          />
          <Kpi
            label="Retrain"
            value="Monthly"
            sub="Auto MLflow pipeline"
          />
        </div>
      )}

      {/* Dataset split timeline */}
      {result.trainingData && (
        <div className="bg-plant-card border border-plant-border rounded-lg p-5">
          <div className="text-[11px] uppercase tracking-wider text-plant-muted mb-3">
            Dataset — train / validation / test split ({result.trainingData.windowStart} – {result.trainingData.testEnd})
          </div>
          <div className="flex h-8 rounded overflow-hidden border border-plant-border">
            <div className="bg-plant-accent/40 flex items-center justify-center text-[11px] text-plant-text font-mono" style={{ width: '70%' }}>
              Training · 70% · {result.trainingData.windowStart} → {result.trainingData.trainEnd}
            </div>
            <div className="bg-plant-warn/40 flex items-center justify-center text-[11px] text-plant-text font-mono" style={{ width: '15%' }}>
              Val · 15%
            </div>
            <div className="bg-blue-500/40 flex items-center justify-center text-[11px] text-plant-text font-mono" style={{ width: '15%' }}>
              Test · 15%
            </div>
          </div>
          <div className="flex gap-4 mt-2 text-[10px] text-plant-muted">
            <span>● Training (2 wash cycles)</span>
            <span>● Validation</span>
            <span>● Test (held-out, OEM commissioning data)</span>
          </div>
        </div>
      )}

      {/* Training charts — loss curves, scatter, confusion, ROC */}
      <TrainingCharts charts={result.charts} />

      {/* Strengths / gaps */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-plant-card border border-plant-border rounded-lg p-5">
          <div className="text-[11px] uppercase tracking-wider text-plant-good mb-2">
            Dataset strengths
          </div>
          <ul className="space-y-1.5">
            {result.datasetAssessment.strengths.map((s, i) => (
              <li key={i} className="text-sm text-plant-text flex gap-2">
                <span className="text-plant-good mt-0.5">✓</span>
                <span>{s}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="bg-plant-card border border-plant-border rounded-lg p-5">
          <div className="text-[11px] uppercase tracking-wider text-plant-warn mb-2">
            Gaps to address
          </div>
          <ul className="space-y-1.5">
            {result.datasetAssessment.gaps.map((g, i) => (
              <li key={i} className="text-sm text-plant-text flex gap-2">
                <span className="text-plant-warn mt-0.5">!</span>
                <span>{g}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Recommended pipeline */}
      <div className="bg-plant-card border border-plant-border rounded-lg p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-[11px] uppercase tracking-wider text-plant-muted">
              Recommended pipeline
            </div>
            <div className="text-plant-text font-semibold text-base mt-0.5">
              {result.recommendedPipeline.models.length}-model ensemble
            </div>
          </div>
          <div className="flex gap-2 text-[10px]">
            <span className="px-2 py-1 rounded bg-plant-panel border border-plant-border text-plant-muted">
              {result.recommendedPipeline.trainValTest}
            </span>
            <span className="px-2 py-1 rounded bg-plant-panel border border-plant-border text-plant-muted">
              Retrain: {result.recommendedPipeline.retrainCadence}
            </span>
            <span className="px-2 py-1 rounded bg-plant-panel border border-plant-border text-plant-muted">
              {result.recommendedPipeline.servingStack}
            </span>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {result.recommendedPipeline.models.map((m, i) => (
            <div key={i} className="bg-plant-panel border border-plant-border rounded-md p-4">
              <div className="flex items-center justify-between">
                <span className="font-mono text-plant-accent text-sm">{m.name}</span>
                {m.testMetric && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-plant-good/15 text-plant-good font-mono">
                    {m.testMetric}
                  </span>
                )}
              </div>
              <div className="text-plant-text font-semibold mt-1">{m.type}</div>
              <div className="text-[11px] text-plant-muted mt-2 leading-relaxed">
                {m.architecture}
              </div>
              {(m.physics || m.uncertainty || m.threshold) && (
                <div className="mt-2 text-[11px]">
                  {m.physics && (
                    <div>
                      <span className="text-plant-muted">Physics: </span>
                      <span className="text-plant-text">{m.physics}</span>
                    </div>
                  )}
                  {m.uncertainty && (
                    <div>
                      <span className="text-plant-muted">Uncertainty: </span>
                      <span className="text-plant-text">{m.uncertainty}</span>
                    </div>
                  )}
                  {m.threshold && (
                    <div>
                      <span className="text-plant-muted">Threshold: </span>
                      <span className="text-plant-text">{m.threshold}</span>
                    </div>
                  )}
                </div>
              )}
              <div className="mt-3 text-[11px]">
                <div className="text-plant-muted uppercase tracking-wider">Target</div>
                <div className="text-plant-text">{m.target}</div>
              </div>
              <div className="mt-2 text-[11px]">
                <div className="text-plant-muted uppercase tracking-wider">Inputs</div>
                <div className="text-plant-text">{m.inputs.join(' · ')}</div>
              </div>
              <div className="mt-3 text-[12px] text-plant-text leading-relaxed border-t border-plant-border pt-2">
                {m.rationale}
              </div>
              {m.mlflowRun && (
                <div className="mt-2 text-[10px] text-plant-muted flex items-center justify-between">
                  <span>MLflow run</span>
                  <span className="font-mono text-plant-text">{m.mlflowRun}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Infrastructure / production stack — matches kpcl_showcase_demo */}
      {result.infrastructure && (
        <div className="bg-plant-card border border-plant-border rounded-lg p-5">
          <div className="text-[11px] uppercase tracking-wider text-plant-muted mb-3">
            Production stack
          </div>
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'SERVING', info: result.infrastructure.serving },
              { label: 'MONITORING', info: result.infrastructure.monitoring },
              { label: 'REGISTRY', info: result.infrastructure.registry },
              { label: 'PIPELINE', info: result.infrastructure.pipeline },
            ].map((b, i) => (
              <div
                key={i}
                className="bg-plant-panel border border-plant-border rounded-md p-3 text-center"
              >
                <div className="text-[9px] uppercase tracking-wider text-plant-muted">
                  {b.label}
                </div>
                <div className="font-mono text-plant-accent font-semibold text-sm mt-1">
                  {b.info.tool}
                </div>
                <div className="text-[10px] text-plant-muted mt-0.5">{b.info.detail}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Feature importance + performance */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-plant-card border border-plant-border rounded-lg p-5">
          <div className="text-[11px] uppercase tracking-wider text-plant-muted mb-3">
            Feature importance (predicted)
          </div>
          <div className="space-y-2">
            {result.featureImportance.map((f, i) => {
              const pct = Math.round((f.importance || 0) * 100);
              return (
                <div key={i}>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-plant-text font-mono">{f.feature}</span>
                    <span className="text-plant-muted">{pct}%</span>
                  </div>
                  <div className="h-1.5 bg-plant-border rounded overflow-hidden">
                    <div className="h-full bg-plant-accent" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="bg-plant-card border border-plant-border rounded-lg p-5">
          <div className="text-[11px] uppercase tracking-wider text-plant-muted mb-3">
            Expected performance
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-plant-muted">PINN MAE (η_c)</span>
              <span className="text-plant-good font-mono">{result.expectedPerformance.pinnMaeEtaC}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-plant-muted">LSTM days-to-wash</span>
              <span className="text-plant-good font-mono">{result.expectedPerformance.lstmDaysToWashAccuracy}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-plant-muted">FFT-AE ROC AUC</span>
              <span className="text-plant-good font-mono">{result.expectedPerformance.fftAeRocAuc}</span>
            </div>
            <div className="flex justify-between border-t border-plant-border pt-2">
              <span className="text-plant-muted">Early warning lead</span>
              <span className="text-plant-accent font-semibold">{result.expectedPerformance.earlyWarning}</span>
            </div>
          </div>
          <div className="mt-4 text-[11px] text-plant-muted">
            Monitoring: {result.recommendedPipeline.monitoring}
          </div>
        </div>
      </div>

      {/* Next steps */}
      <div className="bg-plant-card border border-plant-border rounded-lg p-5">
        <div className="text-[11px] uppercase tracking-wider text-plant-muted mb-3">
          Next steps
        </div>
        <div className="space-y-2">
          {result.nextSteps.map((s, i) => (
            <div
              key={i}
              className="flex items-center gap-3 bg-plant-panel border border-plant-border rounded-md px-3 py-2"
            >
              <PriorityPill priority={s.priority} />
              <span className="text-sm text-plant-text">{s.step}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Column profile */}
      {ds.numericSummary?.length > 0 && (
        <div className="bg-plant-card border border-plant-border rounded-lg p-5">
          <div className="text-[11px] uppercase tracking-wider text-plant-muted mb-3">
            Column profile ({ds.numericSummary.length} numeric)
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] text-plant-muted uppercase tracking-wider border-b border-plant-border">
                  <th className="py-2 pr-4">Column</th>
                  <th className="py-2 pr-4">Min</th>
                  <th className="py-2 pr-4">Mean</th>
                  <th className="py-2 pr-4">Max</th>
                  <th className="py-2 pr-4">Start → End</th>
                  <th className="py-2 pr-4">Trend</th>
                </tr>
              </thead>
              <tbody>
                {ds.numericSummary.map((n, i) => (
                  <tr key={i} className="border-b border-plant-border/50">
                    <td className="py-1.5 pr-4 font-mono text-plant-text">{n.column}</td>
                    <td className="py-1.5 pr-4 text-plant-muted font-mono">{n.min}</td>
                    <td className="py-1.5 pr-4 text-plant-text font-mono">{n.mean}</td>
                    <td className="py-1.5 pr-4 text-plant-muted font-mono">{n.max}</td>
                    <td className="py-1.5 pr-4 text-plant-text font-mono">
                      {n.startValue} → {n.endValue}
                    </td>
                    <td
                      className={`py-1.5 pr-4 font-mono ${
                        n.trendPct > 1
                          ? 'text-plant-warn'
                          : n.trendPct < -1
                          ? 'text-plant-bad'
                          : 'text-plant-good'
                      }`}
                    >
                      {n.trendPct > 0 ? '+' : ''}
                      {n.trendPct}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
