// Synthetic SCADA data generator for YCCPP (Yelahanka Combined Cycle Power Plant)
// 370 MW total capacity, KPCL, Bengaluru
// Generates realistic 48-hour trends for 4 assets

const HOURS = 48;
const POINTS_PER_HOUR = 6; // 10-minute resolution
const TOTAL_POINTS = HOURS * POINTS_PER_HOUR;

// Seeded pseudo-random for reproducibility within a tag
function seededRand(seed) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function generateTimestamps() {
  const now = Date.now();
  const stepMs = (60 * 60 * 1000) / POINTS_PER_HOUR;
  const out = [];
  for (let i = TOTAL_POINTS - 1; i >= 0; i--) {
    out.push(new Date(now - i * stepMs).toISOString());
  }
  return out;
}

// GT-1: Bearing vibration anomaly rising from 2.4 → 5.8 mm/s over 48h
function gt1Vibration(timestamps) {
  const rand = seededRand(42);
  return timestamps.map((ts, i) => {
    const progress = i / (TOTAL_POINTS - 1);
    // Gentle exponential climb with noise
    const baseline = 2.4 + (5.8 - 2.4) * Math.pow(progress, 1.6);
    const noise = (rand() - 0.5) * 0.25;
    return {
      timestamp: ts,
      value: +(baseline + noise).toFixed(3),
    };
  });
}

// GT-1 Bearing temperature - mild creep
function gt1BearingTemp(timestamps) {
  const rand = seededRand(43);
  return timestamps.map((ts, i) => {
    const progress = i / (TOTAL_POINTS - 1);
    const baseline = 78 + progress * 6.5;
    const noise = (rand() - 0.5) * 1.2;
    return {
      timestamp: ts,
      value: +(baseline + noise).toFixed(2),
    };
  });
}

// GT-1 Output power - slightly degraded
function gt1Power(timestamps) {
  const rand = seededRand(44);
  return timestamps.map((ts, i) => {
    const progress = i / (TOTAL_POINTS - 1);
    const baseline = 116.5 - progress * 1.2;
    const noise = (rand() - 0.5) * 0.6;
    return {
      timestamp: ts,
      value: +(baseline + noise).toFixed(2),
    };
  });
}

// Normal asset trend generator
function normalTrend(seed, mean, jitter) {
  const rand = seededRand(seed);
  const timestamps = generateTimestamps();
  return timestamps.map((ts) => ({
    timestamp: ts,
    value: +(mean + (rand() - 0.5) * jitter).toFixed(3),
  }));
}

function buildAssets() {
  const timestamps = generateTimestamps();

  return [
    {
      id: 'GT-1',
      name: 'Gas Turbine 1',
      type: 'Gas Turbine',
      capacityMW: 118,
      status: 'WARNING',
      healthScore: 62,
      currentOutputMW: 115.4,
      location: 'Block A',
      runtimeHours: 48213,
      lastMaintenance: '2025-11-12',
      tags: {
        vibration: {
          label: 'Bearing Vibration',
          unit: 'mm/s',
          warning: 3.5,
          alarm: 4.5,
          current: 5.78,
          data: gt1Vibration(timestamps),
        },
        bearingTemp: {
          label: 'Bearing Temperature',
          unit: '°C',
          warning: 85,
          alarm: 92,
          current: 84.6,
          data: gt1BearingTemp(timestamps),
        },
        power: {
          label: 'Output Power',
          unit: 'MW',
          warning: null,
          alarm: null,
          current: 115.4,
          data: gt1Power(timestamps),
        },
      },
      alerts: [
        {
          severity: 'WARNING',
          message: 'Bearing vibration exceeded alarm threshold (4.5 mm/s) — currently 5.78 mm/s',
          since: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
        },
      ],
    },
    {
      id: 'GT-2',
      name: 'Gas Turbine 2',
      type: 'Gas Turbine',
      capacityMW: 118,
      status: 'NORMAL',
      healthScore: 94,
      currentOutputMW: 117.2,
      location: 'Block A',
      runtimeHours: 47980,
      lastMaintenance: '2025-12-04',
      tags: {
        vibration: {
          label: 'Bearing Vibration',
          unit: 'mm/s',
          warning: 3.5,
          alarm: 4.5,
          current: 2.31,
          data: normalTrend(100, 2.3, 0.25),
        },
        bearingTemp: {
          label: 'Bearing Temperature',
          unit: '°C',
          warning: 85,
          alarm: 92,
          current: 79.4,
          data: normalTrend(101, 79.5, 1.2),
        },
        power: {
          label: 'Output Power',
          unit: 'MW',
          warning: null,
          alarm: null,
          current: 117.2,
          data: normalTrend(102, 117.2, 0.8),
        },
      },
      alerts: [],
    },
    {
      id: 'ST-1',
      name: 'Steam Turbine',
      type: 'Steam Turbine',
      capacityMW: 133,
      status: 'NORMAL',
      healthScore: 91,
      currentOutputMW: 131.8,
      location: 'Block B',
      runtimeHours: 46220,
      lastMaintenance: '2026-01-18',
      tags: {
        vibration: {
          label: 'Shaft Vibration',
          unit: 'mm/s',
          warning: 4.0,
          alarm: 5.5,
          current: 1.92,
          data: normalTrend(200, 1.9, 0.3),
        },
        steamPressure: {
          label: 'Main Steam Pressure',
          unit: 'bar',
          warning: 105,
          alarm: 110,
          current: 98.3,
          data: normalTrend(201, 98.3, 0.6),
        },
        power: {
          label: 'Output Power',
          unit: 'MW',
          warning: null,
          alarm: null,
          current: 131.8,
          data: normalTrend(202, 131.8, 0.9),
        },
      },
      alerts: [],
    },
    {
      id: 'HRSG-1',
      name: 'Heat Recovery Steam Generator',
      type: 'HRSG',
      capacityMW: null,
      status: 'NORMAL',
      healthScore: 96,
      currentOutputMW: null,
      location: 'Block A/B Link',
      runtimeHours: 47950,
      lastMaintenance: '2025-10-22',
      tags: {
        drumPressure: {
          label: 'HP Drum Pressure',
          unit: 'bar',
          warning: 112,
          alarm: 118,
          current: 104.2,
          data: normalTrend(300, 104.2, 0.7),
        },
        stackTemp: {
          label: 'Stack Temperature',
          unit: '°C',
          warning: 145,
          alarm: 160,
          current: 128.6,
          data: normalTrend(301, 128.6, 2.0),
        },
        feedWaterFlow: {
          label: 'Feedwater Flow',
          unit: 't/h',
          warning: null,
          alarm: null,
          current: 312.4,
          data: normalTrend(302, 312.4, 3.5),
        },
      },
      alerts: [],
    },
  ];
}

// Cache assets but allow slight drift so the UI auto-refresh feels live
let cachedAssets = buildAssets();
let lastRebuild = Date.now();

function getAssets() {
  // Rebuild every 30s for some realism
  if (Date.now() - lastRebuild > 30000) {
    cachedAssets = buildAssets();
    lastRebuild = Date.now();
  }
  // Apply tiny live drift to "current" values
  return cachedAssets.map((a) => {
    const drift = (Math.random() - 0.5) * 0.05;
    return {
      ...a,
      currentOutputMW:
        a.currentOutputMW != null
          ? +(a.currentOutputMW + drift).toFixed(2)
          : null,
    };
  });
}

function getAssetSummary() {
  return getAssets().map((a) => ({
    id: a.id,
    name: a.name,
    type: a.type,
    capacityMW: a.capacityMW,
    status: a.status,
    healthScore: a.healthScore,
    currentOutputMW: a.currentOutputMW,
    location: a.location,
    alertCount: a.alerts.length,
  }));
}

function getAssetDetail(id) {
  return getAssets().find((a) => a.id === id) || null;
}

function getTrend(id, tag) {
  const asset = getAssetDetail(id);
  if (!asset) return null;
  const t = asset.tags[tag];
  if (!t) return null;
  return {
    assetId: id,
    tag,
    label: t.label,
    unit: t.unit,
    warning: t.warning,
    alarm: t.alarm,
    current: t.current,
    data: t.data,
  };
}

module.exports = {
  getAssets,
  getAssetSummary,
  getAssetDetail,
  getTrend,
};
