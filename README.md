# YCCPP AI Platform — Demo

Predictive-maintenance demo for **Yelahanka Combined Cycle Power Plant** (370 MW, KPCL, Bengaluru).

Monitors 4 assets (GT-1, GT-2, ST-1, HRSG-1), surfaces a simulated bearing-vibration anomaly on GT-1, and uses **Claude** (Anthropic) to perform root cause analysis with operator approve / reject workflow + work-order creation.

```
yccpp-demo/
├── backend/    Node + Express API · synthetic SCADA · Claude RCA
└── frontend/   React + Recharts + Tailwind (dark theme)
```

## Quick Start

### 1. Backend

```bash
cd backend
cp .env.example .env
# edit .env and set ANTHROPIC_API_KEY=sk-ant-...
npm install
npm start
# → http://localhost:3001
```

If `ANTHROPIC_API_KEY` is not set, `/api/analyze/:id` returns a high-quality mock so the demo still works end-to-end.

### 2. Frontend

```bash
cd frontend
npm install
npm start
# → http://localhost:3000
```

CRA proxies `/api/*` to `http://localhost:3001` (see `frontend/package.json`).

## API

| Method | Path                              | Description                          |
| ------ | --------------------------------- | ------------------------------------ |
| GET    | `/api/assets`                     | Plant + asset summary with health    |
| GET    | `/api/assets/:id`                 | Full asset detail incl. tags         |
| GET    | `/api/assets/:id/trend/:tag`      | 48-hour 10-min-resolution trend      |
| POST   | `/api/analyze/:id`                | Claude RCA — returns structured JSON |
| POST   | `/api/actions`                    | Log approve / reject + work order    |
| GET    | `/api/actions`                    | Recent action log                    |
| GET    | `/api/model/sample-dataset`       | Download a synthetic GT-01 CSV       |
| POST   | `/api/model/generate`             | Upload XLSX/XLS/CSV → Claude returns ML pipeline plan |

## Demo Flow

1. Open the app — sidebar lists all 4 assets with live health.
2. **GT-1** shows `WARNING` (amber). Click it.
3. The 48-hour vibration trend climbs from 2.4 → ~5.8 mm/s, crossing both the warning (3.5) and alarm (4.5) reference lines.
4. Click **Run AI Analysis** — Claude returns:
   - Root cause hypothesis with probability
   - Time-to-failure estimate
   - Evidence list
   - Prioritized immediate actions
5. Click **Approve & Create Work Order** — work-order number, crew, and ETA are confirmed.

### AI Model Studio

Switch to the **AI Model Studio** tab in the header to demo the model-generation flow:

1. Click **↓ Download sample dataset** to grab a synthetic 30-day GT-01 CSV (compressor fouling + late-onset bearing wear baked in).
2. Drop the same file back into the upload zone (or any XLSX/XLS/CSV from a customer).
3. Click **Generate AI Model** — Claude profiles the schema and returns: dataset assessment, recommended 3-model pipeline (PINN + LSTM + FFT-AE), expected performance, feature importance, and next steps. Falls back to a curated mock if no API key is set.

## Deployment

### Backend → Render

`backend/render.yaml` is committed. In Render, create a new Blueprint from the repo. Set the `ANTHROPIC_API_KEY` secret in the dashboard.

### Frontend → Vercel

`frontend/vercel.json` is committed. In Vercel:

1. Import the repo, set **root directory** to `frontend`.
2. Set env var `REACT_APP_API_BASE` to the deployed Render URL (e.g. `https://yccpp-backend.onrender.com`).
3. Deploy.

## Notes

- Synthetic data only — no real plant connectivity.
- The Claude prompt requests strict JSON; the server falls back to a curated mock if parsing fails or the API key is missing, so a live demo cannot break.
- Dark UI tuned for industrial control-room screens.
