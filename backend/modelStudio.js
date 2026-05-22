// Model Studio: synthesize a customer-style dataset and parse uploaded files.
// In a real deployment, the customer would upload their actual SCADA export.

const XLSX = require('xlsx');

// ----- Synthetic sample dataset (GT-01 style) -----
// Produces a 30-day, 1-hour-resolution CSV with a realistic degradation signature.
function buildSampleCSV() {
  const headers = [
    'timestamp',
    'ambient_temp_c',
    'rel_humidity_pct',
    'compressor_inlet_pressure_bar',
    'compressor_discharge_pressure_bar',
    'compressor_discharge_temp_c',
    'turbine_inlet_temp_c',
    'exhaust_temp_c',
    'fuel_flow_kg_s',
    'bearing_vibration_mms',
    'bearing_temp_c',
    'shaft_speed_rpm',
    'gross_output_mw',
    'isentropic_efficiency_pct',
  ];

  const rows = [headers.join(',')];
  const start = new Date('2026-04-22T00:00:00Z').getTime();
  const points = 30 * 24; // 30 days hourly

  // Pseudo-random with seed for reproducibility
  let s = 1337;
  const rand = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };

  for (let i = 0; i < points; i++) {
    const t = new Date(start + i * 3600 * 1000);
    const progress = i / (points - 1);
    const diurnal = Math.sin((i / 24) * Math.PI * 2);

    const ambient = +(28 + diurnal * 6 + (rand() - 0.5) * 1.2).toFixed(2);
    const humidity = +(60 + diurnal * -15 + (rand() - 0.5) * 4).toFixed(1);
    const inletP = +(0.98 + (rand() - 0.5) * 0.01).toFixed(3);
    // Compressor fouling: discharge pressure drifts down over 30 days
    const dischargeP = +(17.1 - progress * 0.6 + (rand() - 0.5) * 0.08).toFixed(2);
    const dischargeT = +(420 + progress * 8 + (rand() - 0.5) * 2).toFixed(1);
    const tit = +(1340 + (rand() - 0.5) * 8 + progress * 4).toFixed(1);
    const exhaust = +(540 + progress * 6 + (rand() - 0.5) * 3).toFixed(1);
    const fuel = +(13.4 + progress * 0.3 + (rand() - 0.5) * 0.1).toFixed(3);
    // Bearing vibration: gentle climb plus a sub-threshold spectral shift in week 4
    const vib =
      progress < 0.7
        ? +(2.1 + progress * 0.4 + (rand() - 0.5) * 0.15).toFixed(3)
        : +(2.5 + (progress - 0.7) * 4.5 + (rand() - 0.5) * 0.25).toFixed(3);
    const bTemp = +(78 + progress * 4 + (rand() - 0.5) * 0.8).toFixed(2);
    const rpm = +(3000 + (rand() - 0.5) * 2).toFixed(1);
    const power = +(236.8 - progress * 4.2 + (rand() - 0.5) * 0.4).toFixed(2);
    const etaC = +(0.87 - progress * 0.018 + (rand() - 0.5) * 0.002).toFixed(4);

    rows.push(
      [
        t.toISOString(),
        ambient,
        humidity,
        inletP,
        dischargeP,
        dischargeT,
        tit,
        exhaust,
        fuel,
        vib,
        bTemp,
        rpm,
        power,
        (etaC * 100).toFixed(2),
      ].join(',')
    );
  }
  return rows.join('\n');
}

// ----- Parse uploaded file (xlsx, xls, csv) -----
function parseUploadedFile(buffer, filename) {
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = wb.SheetNames[0];
  const sheet = wb.Sheets[sheetName];
  const json = XLSX.utils.sheet_to_json(sheet, { defval: null });

  if (!json.length) return { rows: [], columns: [], rowCount: 0, filename };

  const columns = Object.keys(json[0]);
  return {
    filename,
    sheetName,
    columns,
    rowCount: json.length,
    rows: json,
  };
}

// ----- Summarize dataset for the LLM (so we don't ship megabytes) -----
function summarizeDataset(parsed) {
  const { columns, rows, rowCount } = parsed;
  if (!rowCount) return null;

  // Detect timestamp column
  const tsKey = columns.find((c) => /time|date|timestamp/i.test(c));
  let timeRange = null;
  if (tsKey) {
    try {
      const first = new Date(rows[0][tsKey]);
      const last = new Date(rows[rowCount - 1][tsKey]);
      if (!isNaN(first) && !isNaN(last)) {
        timeRange = {
          start: first.toISOString(),
          end: last.toISOString(),
          spanHours: +((last - first) / 3600000).toFixed(1),
        };
      }
    } catch (_) {}
  }

  const numericColumns = columns
    .filter((c) => c !== tsKey)
    .map((col) => {
      const values = rows
        .map((r) => r[col])
        .filter((v) => typeof v === 'number' && !isNaN(v));
      if (!values.length) return null;
      const min = Math.min(...values);
      const max = Math.max(...values);
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const start = values[0];
      const end = values[values.length - 1];
      const trendPct = start ? ((end - start) / Math.abs(start)) * 100 : 0;
      return {
        column: col,
        count: values.length,
        min: +min.toFixed(3),
        max: +max.toFixed(3),
        mean: +mean.toFixed(3),
        startValue: +start.toFixed(3),
        endValue: +end.toFixed(3),
        trendPct: +trendPct.toFixed(2),
      };
    })
    .filter(Boolean);

  return {
    filename: parsed.filename,
    sheetName: parsed.sheetName,
    rowCount,
    columnCount: columns.length,
    columns,
    timestampColumn: tsKey,
    timeRange,
    numericSummary: numericColumns,
  };
}

// ----- Mock model recommendation (fallback when no API key) -----
// Numbers/versions mirror kpcl_showcase_demo.html production registry.
function buildMockModelPlan(summary) {
  const hasVib = (summary.columns || []).some((c) => /vib/i.test(c));
  const hasEff = (summary.columns || []).some((c) => /eff|isentropic|eta/i.test(c));
  const driftedDown =
    (summary.numericSummary || []).find((c) => /discharge_pressure|efficiency|eta/i.test(c.column))
      ?.trendPct < -1;

  return {
    datasetAssessment: {
      verdict: 'Suitable for predictive maintenance modeling',
      strengths: [
        `${summary.rowCount.toLocaleString()} rows across ${summary.columnCount} columns — sufficient signal density`,
        summary.timeRange
          ? `Continuous coverage over ${summary.timeRange.spanHours} hours`
          : 'Multi-variate sensor data detected',
        hasVib ? 'Bearing vibration tag present — enables FFT autoencoder branch' : 'Process-variable focus — efficiency modelling viable',
        hasEff ? 'Efficiency tag present — physics-informed loss can be applied' : 'Power output present — derivable performance metric',
      ],
      gaps: [
        'Maintenance event labels not detected — recommend joining with CMMS work-order history',
        'Sampling rate appears uniform but no quality flags — add validity column from DCS',
      ],
    },
    trainingData: {
      span: '2 yrs',
      asset: 'GT-01 ops',
      tagCount: 112,
      samplingRate: '1-min',
      trainValTest: '70/15/15',
      windowStart: 'Apr 2024',
      trainEnd: 'Sep 2025',
      valEnd: 'Jan 2026',
      testEnd: 'Apr 2026',
    },
    recommendedPipeline: {
      models: [
        {
          name: 'gt-pinn-v3.1.2',
          type: 'Physics-Informed Neural Network',
          architecture: '4-layer MLP · 256 units · physics loss',
          physics: 'Brayton cycle · Dittus-Boelter',
          target: 'Compressor isentropic efficiency baseline (η_c)',
          inputs: ['ambient_temp', 'humidity', 'inlet_pressure', 'discharge_pressure', 'fuel_flow'],
          testMetric: '±0.3% η_c MAE',
          mlflowRun: 'e4f8a2b1',
          rationale:
            'Establishes a physics-anchored expectation for η_c at every operating point so SCADA bands become dynamic rather than fixed. Suppresses false alarms on hot monsoon days.',
        },
        {
          name: 'lstm-comp-v2.4.0',
          type: '2-layer LSTM forecaster',
          architecture: '2-layer LSTM · 128 units · seq 60d',
          uncertainty: 'MC dropout · 100 passes',
          target: 'Compressor fouling trajectory · days to offline wash',
          inputs: ['η_c residual from PINN', 'discharge_pressure', 'exhaust_temp', 'fuel_flow'],
          testMetric: '88.2% within ±4 days',
          mlflowRun: 'f9a3c2d7',
          rationale: driftedDown
            ? 'Detected downward drift in pressure / efficiency in the upload — LSTM can project days-to-threshold with uncertainty bands.'
            : 'Captures slow degradation that point-in-time SCADA cannot see; flags wash window 3 weeks early.',
        },
        {
          name: 'fft-ae-v1.6.0',
          type: 'Convolutional Autoencoder',
          architecture: 'Conv autoencoder · 1D FFT input',
          threshold: 'Reconstruction error > 0.70',
          target: 'Sub-threshold bearing wear signatures',
          inputs: ['bearing_vibration time-series → FFT spectrogram'],
          testMetric: 'ROC AUC 0.941',
          mlflowRun: 'b1d7e4f2',
          rationale: hasVib
            ? 'Vibration tag enables spectral-shift detection 4–6 weeks before ISO 10816 amplitude alarm.'
            : 'Add vibration sensor stream to unlock this branch.',
        },
      ],
      trainValTest: '70 / 15 / 15 chronological split',
      retrainCadence: 'Monthly (Airflow DAG)',
      servingStack: 'FastAPI · Docker · Kubernetes',
      monitoring: 'Evidently AI for drift · MLflow registry',
    },
    infrastructure: {
      serving: { tool: 'FastAPI', detail: 'Docker · K8s' },
      monitoring: { tool: 'Evidently AI', detail: 'Drift alerts' },
      registry: { tool: 'MLflow', detail: 'v3.1.2 active' },
      pipeline: { tool: 'Airflow', detail: 'Monthly DAG' },
    },
    featureImportance: [
      { feature: 'compressor_discharge_pressure', importance: 0.28 },
      { feature: 'turbine_inlet_temp', importance: 0.21 },
      { feature: 'exhaust_temp', importance: 0.17 },
      { feature: 'ambient_temp', importance: 0.13 },
      { feature: 'fuel_flow', importance: 0.11 },
      { feature: 'bearing_vibration', importance: 0.10 },
    ],
    expectedPerformance: {
      pinnMaeEtaC: '±0.3% η_c (OEM test data)',
      lstmDaysToWashAccuracy: '88.2% within ±4 days',
      fftAeRocAuc: '0.941 (bearing anomaly)',
      earlyWarning: '3–6 weeks before SCADA threshold',
    },
    nextSteps: [
      { step: 'Join with CMMS / SAP PM maintenance event log to label failure windows', priority: 'P1' },
      { step: 'Add DCS quality / validity flags to filter sensor dropouts', priority: 'P1' },
      { step: 'Pilot deployment on GT-01 shadow mode for 30 days before alerts go live', priority: 'P2' },
      { step: 'Wire MLflow + Evidently AI drift monitors to ops Slack', priority: 'P2' },
      { step: 'Schedule monthly Airflow retrain DAG on rolling 60-day window', priority: 'P3' },
    ],
    summary:
      'Dataset is well-suited for the KPCL YCCPP 3-model production pipeline (gt-pinn-v3.1.2 + lstm-comp-v2.4.0 + fft-ae-v1.6.0). Expect 3–6 week early-warning lead time on compressor fouling and bearing wear — consistent with PINN MAE ±0.3% η_c, LSTM 88.2% within ±4 days, and FFT-AE ROC AUC 0.941 on the held-out OEM commissioning data.',
  };
}

// ----- Synthetic training-chart data (mirrors kpcl_showcase_demo charts) -----
function seededRand2(seed) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function buildTrainingCharts() {
  // Loss curves: exponential decay + noise, val plateau slightly above train
  const buildLoss = (seed, startTrain, endTrain, valOffset, jitter, epochs = 50) => {
    const rand = seededRand2(seed);
    const out = [];
    for (let i = 0; i < epochs; i++) {
      const t = i / (epochs - 1);
      const train = +(endTrain + (startTrain - endTrain) * Math.exp(-3 * t) + (rand() - 0.5) * jitter).toFixed(5);
      const val = +(train + valOffset + (rand() - 0.5) * jitter * 1.2).toFixed(5);
      out.push({ epoch: i + 1, train, val });
    }
    return out;
  };

  const pinnLoss = buildLoss(11, 0.42, 0.018, 0.006, 0.012); // MSE on η_c
  const lstmLoss = buildLoss(22, 6.5, 1.1, 0.35, 0.18);      // MAE in days
  const fftLoss = buildLoss(33, 0.85, 0.12, 0.04, 0.025);    // recon error

  // Scatter: predicted η_c vs actual η_c near y=x with tight residuals
  const rand = seededRand2(44);
  const scatter = [];
  for (let i = 0; i < 80; i++) {
    const actual = +(0.82 + rand() * 0.06).toFixed(4); // 82–88%
    const noise = (rand() - 0.5) * 0.008;
    const predicted = +(actual + noise).toFixed(4);
    scatter.push({ actual: +(actual * 100).toFixed(2), predicted: +(predicted * 100).toFixed(2) });
  }

  // Confusion matrix: bearing-anomaly binary classifier (slightly imbalanced)
  const confusionMatrix = {
    truePositive: 47,
    falsePositive: 3,
    trueNegative: 312,
    falseNegative: 5,
    classes: ['Anomaly', 'Normal'],
  };

  // ROC curve: smooth concave curve consistent with AUC ~0.941
  const rocCurve = [];
  const rocRand = seededRand2(55);
  for (let i = 0; i <= 20; i++) {
    const fpr = i / 20;
    // tpr = 1 - (1 - fpr)^k where k controls curvature; k≈4.5 ~ AUC 0.94
    const tpr = +(1 - Math.pow(1 - fpr, 4.5) + (rocRand() - 0.5) * 0.012).toFixed(4);
    rocCurve.push({ fpr: +fpr.toFixed(3), tpr: Math.max(0, Math.min(1, tpr)) });
  }

  return {
    pinnLoss,
    lstmLoss,
    fftLoss,
    scatter,
    confusionMatrix,
    rocCurve,
  };
}

module.exports = {
  buildSampleCSV,
  parseUploadedFile,
  summarizeDataset,
  buildMockModelPlan,
  buildTrainingCharts,
};
