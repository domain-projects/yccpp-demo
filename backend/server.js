require('dotenv').config();

const express = require('express');
const cors = require('cors');
const Anthropic = require('@anthropic-ai/sdk');

const {
  getAssetSummary,
  getAssetDetail,
  getTrend,
} = require('./scadaData');

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

// ---------- Start ----------
app.listen(PORT, () => {
  console.log(`YCCPP AI Platform API listening on http://localhost:${PORT}`);
  if (!process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_API_KEY === 'sk-ant-your-key-here') {
    console.log('NOTE: ANTHROPIC_API_KEY not set — /api/analyze will return mock responses.');
  }
});
