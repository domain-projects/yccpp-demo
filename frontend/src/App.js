import React, { useCallback, useEffect, useState } from 'react';
import { api } from './api';
import Header from './components/Header';
import AssetSidebar from './components/AssetSidebar';
import AssetHeader from './components/AssetHeader';
import TrendChart from './components/TrendChart';
import WarningBanner from './components/WarningBanner';
import AIAnalysisCard from './components/AIAnalysisCard';

const PRIMARY_TAG_BY_ASSET = {
  'GT-1': 'vibration',
  'GT-2': 'vibration',
  'ST-1': 'vibration',
  'HRSG-1': 'drumPressure',
};

export default function App() {
  const [assets, setAssets] = useState([]);
  const [plant, setPlant] = useState(null);
  const [generatedAt, setGeneratedAt] = useState(null);
  const [selectedId, setSelectedId] = useState('GT-1');
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [trend, setTrend] = useState(null);
  const [activeTag, setActiveTag] = useState('vibration');

  const [analysis, setAnalysis] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisError, setAnalysisError] = useState(null);
  const [decision, setDecision] = useState(null);
  const [workOrder, setWorkOrder] = useState(null);

  // Initial + auto-refresh asset list every 5 seconds
  const refreshAssets = useCallback(async () => {
    try {
      const data = await api.listAssets();
      setAssets(data.assets);
      setPlant(data.plant);
      setGeneratedAt(data.generatedAt);
    } catch (e) {
      console.error('listAssets failed', e);
    }
  }, []);

  useEffect(() => {
    refreshAssets();
    const id = setInterval(refreshAssets, 5000);
    return () => clearInterval(id);
  }, [refreshAssets]);

  // Reset per-asset state on selection change
  useEffect(() => {
    setAnalysis(null);
    setAnalysisError(null);
    setDecision(null);
    setWorkOrder(null);
    setActiveTag(PRIMARY_TAG_BY_ASSET[selectedId] || 'vibration');
  }, [selectedId]);

  // Load asset detail when selection changes
  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    api
      .getAsset(selectedId)
      .then((a) => {
        if (!cancelled) setSelectedAsset(a);
      })
      .catch((e) => console.error('getAsset failed', e));
    return () => {
      cancelled = true;
    };
  }, [selectedId, generatedAt]);

  // Load trend
  useEffect(() => {
    if (!selectedId || !activeTag) return;
    let cancelled = false;
    api
      .getTrend(selectedId, activeTag)
      .then((t) => {
        if (!cancelled) setTrend(t);
      })
      .catch((e) => console.error('getTrend failed', e));
    return () => {
      cancelled = true;
    };
  }, [selectedId, activeTag, generatedAt]);

  const handleAnalyze = async () => {
    setAnalyzing(true);
    setAnalysisError(null);
    setAnalysis(null);
    setDecision(null);
    setWorkOrder(null);
    try {
      const result = await api.analyze(selectedId);
      setAnalysis(result);
    } catch (e) {
      setAnalysisError(e.message);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleApprove = async () => {
    const result = await api.postAction({
      assetId: selectedId,
      decision: 'APPROVE',
      analysisSummary: analysis?.summary,
      operator: 'Shift In-Charge',
    });
    setDecision('APPROVE');
    setWorkOrder(result.workOrder);
  };

  const handleReject = async () => {
    await api.postAction({
      assetId: selectedId,
      decision: 'REJECT',
      analysisSummary: analysis?.summary,
      operator: 'Shift In-Charge',
    });
    setDecision('REJECT');
  };

  const availableTags = selectedAsset ? Object.entries(selectedAsset.tags) : [];

  return (
    <div className="h-screen flex flex-col bg-plant-bg text-plant-text">
      <Header generatedAt={generatedAt} />
      <div className="flex flex-1 overflow-hidden">
        <AssetSidebar
          assets={assets}
          selectedId={selectedId}
          onSelect={setSelectedId}
        />

        <main className="flex-1 overflow-y-auto p-6 space-y-5">
          {!selectedAsset ? (
            <div className="text-plant-muted">Loading asset…</div>
          ) : (
            <>
              <AssetHeader asset={selectedAsset} />

              {selectedAsset.alerts.length > 0 && (
                <WarningBanner alerts={selectedAsset.alerts} />
              )}

              {/* Tag selector */}
              {availableTags.length > 1 && (
                <div className="flex gap-2">
                  {availableTags.map(([key, t]) => (
                    <button
                      key={key}
                      onClick={() => setActiveTag(key)}
                      className={`text-xs px-3 py-1.5 rounded-md border transition-colors ${
                        activeTag === key
                          ? 'border-plant-accent text-plant-accent bg-plant-accent/10'
                          : 'border-plant-border text-plant-muted hover:text-plant-text hover:border-plant-muted'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              )}

              {trend && <TrendChart trend={trend} />}

              {/* AI analysis trigger */}
              <div className="bg-plant-card border border-plant-border rounded-lg p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-plant-text font-semibold">AI-Powered Root Cause Analysis</div>
                    <div className="text-sm text-plant-muted mt-1">
                      Run Claude over 48 hours of multi-tag sensor data to identify probable
                      failure modes, estimate time to failure, and recommend actions.
                    </div>
                  </div>
                  <button
                    onClick={handleAnalyze}
                    disabled={analyzing}
                    className="px-5 py-2.5 rounded-md bg-plant-accent text-black font-semibold text-sm hover:bg-plant-accent/90 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {analyzing ? 'Analyzing…' : 'Run AI Analysis'}
                  </button>
                </div>
                {analysisError && (
                  <div className="mt-3 text-sm text-plant-bad">
                    Analysis failed: {analysisError}
                  </div>
                )}
              </div>

              {analyzing && (
                <div className="bg-plant-card border border-plant-border rounded-lg p-5 flex items-center gap-3 text-plant-muted text-sm">
                  <span className="w-2 h-2 rounded-full bg-plant-accent pulse-dot" />
                  Querying Claude with multi-tag time-series context…
                </div>
              )}

              {analysis && (
                <AIAnalysisCard
                  analysis={analysis}
                  decision={decision}
                  workOrder={workOrder}
                  onApprove={handleApprove}
                  onReject={handleReject}
                />
              )}
            </>
          )}
        </main>
      </div>

      <footer className="border-t border-plant-border bg-plant-panel px-6 py-2 text-[11px] text-plant-muted flex items-center justify-between">
        <span>
          {plant
            ? `${plant.name} · ${plant.operator} · ${plant.location}`
            : 'YCCPP AI Platform'}
        </span>
        <span>
          Auto-refresh: 5s · Data resolution: 10 min · Last update:{' '}
          {generatedAt
            ? new Date(generatedAt).toLocaleTimeString('en-IN', { hour12: false })
            : '—'}
        </span>
      </footer>
    </div>
  );
}
