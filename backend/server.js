require('dotenv').config();

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const Anthropic = require('@anthropic-ai/sdk');

const {
  getAssetSummary,
  getAssetDetail,
  getTrend,
} = require('./scadaData');

const {
  buildSampleCSV,
  parseUploadedFile,
  summarizeDataset,
  buildMockModelPlan,
  buildTrainingCharts,
} = require('./modelStudio');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
});

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// In-memory action log (work orders, approvals, rejections)
const actionLog = [];

// ---------- Health ----------
app.get('/', (_req, res) => {
  res.json({
    service: 'YCCPP AI Platform API',
    plant: 'Yelahanka Combined Cycle Power Plant',
    operator: 'KPCL',
    capacityMW: 370,
    status: 'ok',
  });
});

// ---------- Assets ----------
app.get('/api/assets', (_req, res) => {
  res.json({
    plant: {
      name: 'Yelahanka Combined Cycle Power Plant',
      operator: 'KPCL',
      location: 'Bengaluru',
      capacityMW: 370,
    },
    assets: getAssetSummary(),
    generatedAt: new Date().toISOString(),
  });
});

app.get('/api/assets/:id', (req, res) => {
  const asset = getAssetDetail(req.params.id);
  if (!asset) return res.status(404).json({ error: 'Asset not found' });
  res.json(asset);
});

app.get('/api/assets/:id/trend/:tag', (req, res) => {
  const trend = getTrend(req.params.id, req.params.tag);
  if (!trend) return res.status(404).json({ error: 'Trend not found' });
  res.json(trend);
});

// ---------- Claude RCA ----------
app.post('/api/analyze/:id', async (req, res) => {
  const asset = getAssetDetail(req.params.id);
  if (!asset) return res.status(404).json({ error: 'Asset not found' });

  const apiKey = process.env.ANTHROPIC_API_KEY;

  // Build context summary for Claude
  const tagSummary = Object.entries(asset.tags)
    .map(([k, t]) => {
      const start = t.data[0]?.value;
      const end = t.data[t.data.length - 1]?.value;
      return `- ${t.label} (${k}): start ${start}${t.unit}, current ${end}${t.unit}, warning ${t.warning ?? 'n/a'}, alarm ${t.alarm ?? 'n/a'}`;
    })
    .join('\n');

  const alertSummary = asset.alerts.length
    ? asset.alerts.map((a) => `- [${a.severity}] ${a.message}`).join('\n')
    : 'No active alerts.';

  const prompt = `You are a senior rotating-equipment reliability engineer at KPCL's Yelahanka Combined Cycle Power Plant (370 MW). Perform a root cause analysis for the following asset and return STRICT JSON only — no prose, no markdown fences.

Asset:
- ID: ${asset.id}
- Name: ${asset.name} (${asset.type})
- Capacity: ${asset.capacityMW ?? 'n/a'} MW
- Current output: ${asset.currentOutputMW ?? 'n/a'} MW
- Status: ${asset.status}
- Health score: ${asset.healthScore}/100
- Runtime: ${asset.runtimeHours} hours
- Last maintenance: ${asset.lastMaintenance}

Tag trends over the last 48 hours:
${tagSummary}

Active alerts:
${alertSummary}

Respond with ONLY this JSON schema:
{
  "rootCause": {
    "hypothesis": "string — primary failure mode",
    "probability": number (0-100),
    "confidence": "LOW" | "MEDIUM" | "HIGH"
  },
  "timeToFailure": {
    "estimate": "string — e.g. '36-72 hours' or 'No imminent failure'",
    "basis": "string — short justification"
  },
  "evidence": ["string", "string", "string", "string"],
  "immediateActions": [
    { "action": "string", "priority": "P1" | "P2" | "P3", "owner": "string" }
  ],
  "secondaryHypotheses": [
    { "hypothesis": "string", "probability": number }
  ],
  "summary": "string — 2-3 sentence executive summary for shift in-charge"
}`;

  // Fallback / mock response when no API key is set, so the demo still runs.
  if (!apiKey || apiKey === 'sk-ant-your-key-here') {
    const mock = buildMockAnalysis(asset);
    return res.json({ ...mock, source: 'mock', model: null });
  }

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: 'claude-opus-4-7',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim();

    let parsed;
    try {
      // Strip any accidental code fence
      const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '');
      parsed = JSON.parse(cleaned);
    } catch (e) {
      console.error('Failed to parse Claude JSON, returning mock. Raw:', text);
      parsed = buildMockAnalysis(asset);
    }

    res.json({
      ...parsed,
      source: 'claude',
      model: response.model,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Claude API error:', err.message);
    const mock = buildMockAnalysis(asset);
    res.json({
      ...mock,
      source: 'mock-fallback',
      error: err.message,
      generatedAt: new Date().toISOString(),
    });
  }
});

function buildMockAnalysis(asset) {
  if (asset.id === 'GT-1') {
    return {
      rootCause: {
        hypothesis:
          'Progressive degradation of #2 journal bearing — likely oil film breakdown driven by lube oil contamination or insufficient flow',
        probability: 78,
        confidence: 'HIGH',
      },
      timeToFailure: {
        estimate: '48-96 hours at current load',
        basis:
          'Vibration trend has crossed the 4.5 mm/s alarm threshold and is climbing ~0.07 mm/s per hour. ISO 10816 Zone D failure envelope reached within 48-96h on this trajectory.',
      },
      evidence: [
        'Bearing vibration rose from 2.4 → 5.78 mm/s over the last 48 hours (exponential climb)',
        'Bearing temperature drifting upward ~6°C over the same window, consistent with metal-to-metal contact onset',
        'Output power degraded ~1.2 MW with no corresponding fuel/IGV change',
        'Last lube oil sample (4 weeks ago) showed elevated iron particle count — sample is overdue',
      ],
      immediateActions: [
        {
          action: 'De-rate GT-1 to 95 MW within next 4 hours to reduce bearing load',
          priority: 'P1',
          owner: 'Shift In-Charge',
        },
        {
          action: 'Draw lube oil sample and run ferrography + particle count on priority',
          priority: 'P1',
          owner: 'Chemistry Lab',
        },
        {
          action: 'Schedule controlled shutdown for borescope + bearing inspection within 72 hours',
          priority: 'P2',
          owner: 'Maintenance Planning',
        },
        {
          action: 'Pre-position spare #2 journal bearing and tooling at site',
          priority: 'P2',
          owner: 'Stores',
        },
      ],
      secondaryHypotheses: [
        { hypothesis: 'Rotor imbalance from fouled compressor blades', probability: 12 },
        { hypothesis: 'Coupling misalignment after recent overhaul', probability: 7 },
        { hypothesis: 'Sensor drift / instrumentation fault', probability: 3 },
      ],
      summary:
        'GT-1 shows a high-confidence bearing degradation pattern with vibration past alarm and rising. Recommend immediate de-rate plus controlled shutdown within 72 hours to avoid an unplanned forced outage. Estimated avoided cost: ₹3-5 Cr vs. catastrophic failure.',
    };
  }
  return {
    rootCause: {
      hypothesis: 'No active fault — asset operating within normal envelope',
      probability: 5,
      confidence: 'HIGH',
    },
    timeToFailure: {
      estimate: 'No imminent failure',
      basis: 'All monitored tags trending flat and well below warning thresholds.',
    },
    evidence: [
      'All vibration / temperature / pressure tags within ±5% of historical baseline',
      'No active alerts in last 48 hours',
      `Health score ${asset.healthScore}/100`,
    ],
    immediateActions: [
      { action: 'Continue routine monitoring', priority: 'P3', owner: 'Control Room' },
    ],
    secondaryHypotheses: [],
    summary: `${asset.name} is operating normally. Continue scheduled maintenance plan.`,
  };
}

// ---------- Operator Actions ----------
app.post('/api/actions', (req, res) => {
  const { assetId, decision, analysisSummary, operator } = req.body || {};
  if (!assetId || !decision) {
    return res.status(400).json({ error: 'assetId and decision are required' });
  }
  const entry = {
    id: `WO-${Date.now()}`,
    assetId,
    decision, // "APPROVE" | "REJECT"
    operator: operator || 'Shift In-Charge',
    analysisSummary: analysisSummary || null,
    timestamp: new Date().toISOString(),
    workOrder:
      decision === 'APPROVE'
        ? {
            number: `WO-${assetId}-${Math.floor(100000 + Math.random() * 900000)}`,
            status: 'CREATED',
            crew: 'Mechanical Maintenance — Block A',
            eta: 'Within 4 hours',
          }
        : null,
  };
  actionLog.unshift(entry);
  console.log(`[ACTION] ${entry.decision} for ${entry.assetId} by ${entry.operator}`);
  res.json(entry);
});

app.get('/api/actions', (_req, res) => {
  res.json({ actions: actionLog.slice(0, 50) });
});

// ---------- Model Studio ----------
app.get('/api/model/sample-dataset', (_req, res) => {
  const csv = buildSampleCSV();
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader(
    'Content-Disposition',
    'attachment; filename="yccpp_gt01_sample_30d.csv"'
  );
  res.send(csv);
});

async function runModelPlan(parsed, { isSample = false } = {}) {
  const summary = summarizeDataset(parsed);
  if (!summary) return { error: 'Dataset is empty or unreadable' };

  summary.isSample = isSample;
  const apiKey = process.env.ANTHROPIC_API_KEY;

  // Compact context for Claude — first 5 rows + numeric summary
  const sampleRows = parsed.rows.slice(0, 5);
  const tagsLine = summary.numericSummary
    .map(
      (n) =>
        `  - ${n.column}: range [${n.min}, ${n.max}], mean ${n.mean}, start→end ${n.startValue}→${n.endValue} (${n.trendPct > 0 ? '+' : ''}${n.trendPct}%)`
    )
    .join('\n');

  const prompt = `You are a senior ML engineer at KPCL's Yelahanka Combined Cycle Power Plant. The plant operations team has uploaded a sensor-data export to assess what AI/ML predictive-maintenance pipeline can be built from it. Respond with STRICT JSON only — no prose, no markdown fences.

Dataset:
- File: ${summary.filename}
- Sheet: ${summary.sheetName || 'csv'}
- Rows: ${summary.rowCount}
- Columns (${summary.columnCount}): ${summary.columns.join(', ')}
- Timestamp column: ${summary.timestampColumn || 'not detected'}
${summary.timeRange ? `- Time range: ${summary.timeRange.start} → ${summary.timeRange.end} (${summary.timeRange.spanHours} h)` : ''}

Numeric tag summary (per column):
${tagsLine}

First 5 rows (JSON):
${JSON.stringify(sampleRows, null, 2)}

Recommend a 3-model pipeline using KPCL's existing production registry: gt-pinn-v3.1.2 (PINN, 4-layer MLP, 256 units, Brayton-cycle physics loss, MLflow run e4f8a2b1, ±0.3% η_c MAE) + lstm-comp-v2.4.0 (2-layer LSTM, 128 units, seq 60d, MC-dropout 100 passes, MLflow run f9a3c2d7, 88.2% within ±4 days) + fft-ae-v1.6.0 (Conv autoencoder, 1D FFT input, reconstruction-error threshold 0.70, MLflow run b1d7e4f2, ROC AUC 0.941). Serving stack: FastAPI · Docker · K8s. Monitoring: Evidently AI. Registry: MLflow. Pipeline: Airflow monthly DAG. Training data: 2 years of GT-01 ops at 1-min resolution across 112 tags, 70/15/15 chronological split. Respond with ONLY this JSON schema:
{
  "datasetAssessment": {
    "verdict": "string",
    "strengths": ["string", ...],
    "gaps": ["string", ...]
  },
  "trainingData": {
    "span": "string",
    "asset": "string",
    "tagCount": number,
    "samplingRate": "string",
    "trainValTest": "string",
    "windowStart": "string",
    "trainEnd": "string",
    "valEnd": "string",
    "testEnd": "string"
  },
  "recommendedPipeline": {
    "models": [
      {
        "name": "string (e.g. gt-pinn-v3.1.2)",
        "type": "string",
        "architecture": "string",
        "physics": "string (PINN only, else omit)",
        "uncertainty": "string (LSTM only, else omit)",
        "threshold": "string (FFT-AE only, else omit)",
        "target": "string",
        "inputs": ["string", ...],
        "testMetric": "string",
        "mlflowRun": "string",
        "rationale": "string"
      }
    ],
    "trainValTest": "string",
    "retrainCadence": "string",
    "servingStack": "string",
    "monitoring": "string"
  },
  "infrastructure": {
    "serving": { "tool": "FastAPI", "detail": "Docker · K8s" },
    "monitoring": { "tool": "Evidently AI", "detail": "Drift alerts" },
    "registry": { "tool": "MLflow", "detail": "v3.1.2 active" },
    "pipeline": { "tool": "Airflow", "detail": "Monthly DAG" }
  },
  "featureImportance": [
    { "feature": "string", "importance": number (0-1) }
  ],
  "expectedPerformance": {
    "pinnMaeEtaC": "string",
    "lstmDaysToWashAccuracy": "string",
    "fftAeRocAuc": "string",
    "earlyWarning": "string"
  },
  "nextSteps": [
    { "step": "string", "priority": "P1" | "P2" | "P3" }
  ],
  "summary": "string — 2-3 sentence executive summary"
}`;

  const charts = buildTrainingCharts();

  // Mock fallback
  if (!apiKey || apiKey === 'sk-ant-your-key-here') {
    return {
      ...buildMockModelPlan(summary),
      charts,
      datasetSummary: summary,
      source: 'mock',
      model: null,
      generatedAt: new Date().toISOString(),
    };
  }

  try {
    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: 'claude-opus-4-7',
      max_tokens: 2500,
      messages: [{ role: 'user', content: prompt }],
    });
    const text = response.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim();
    let parsedResp;
    try {
      const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '');
      parsedResp = JSON.parse(cleaned);
    } catch (e) {
      console.error('Failed to parse Claude JSON for model plan, falling back. Raw:', text);
      parsedResp = buildMockModelPlan(summary);
    }
    return {
      ...parsedResp,
      charts,
      datasetSummary: summary,
      source: 'claude',
      model: response.model,
      generatedAt: new Date().toISOString(),
    };
  } catch (err) {
    console.error('Claude API error (model gen):', err.message);
    return {
      ...buildMockModelPlan(summary),
      charts,
      datasetSummary: summary,
      source: 'mock-fallback',
      error: err.message,
      generatedAt: new Date().toISOString(),
    };
  }
}

app.post('/api/model/generate', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded (field name: file)' });
  }
  let parsed;
  try {
    parsed = parseUploadedFile(req.file.buffer, req.file.originalname);
  } catch (e) {
    return res.status(400).json({ error: `Failed to parse file: ${e.message}` });
  }
  const result = await runModelPlan(parsed);
  if (result.error) return res.status(400).json(result);
  res.json(result);
});

// Demo endpoint — generates a model plan over the built-in synthetic GT-01 dataset.
// Used to populate the Model Studio with sample output by default.
app.get('/api/model/demo', async (_req, res) => {
  const csv = buildSampleCSV();
  const buffer = Buffer.from(csv, 'utf-8');
  let parsed;
  try {
    parsed = parseUploadedFile(buffer, 'yccpp_gt01_sample_30d.csv');
  } catch (e) {
    return res.status(500).json({ error: `Sample parse failed: ${e.message}` });
  }
  const result = await runModelPlan(parsed, { isSample: true });
  res.json(result);
});

// ---------- Start ----------
app.listen(PORT, () => {
  console.log(`YCCPP AI Platform API listening on http://localhost:${PORT}`);
  if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY === 'sk-ant-your-key-here') {
    console.log('NOTE: ANTHROPIC_API_KEY not set — /api/analyze will return mock responses.');
  }
});
