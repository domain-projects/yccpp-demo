const BASE = process.env.REACT_APP_API_BASE || '';

async function jsonFetch(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`${res.status} ${res.statusText} ${text}`);
  }
  return res.json();
}

export const api = {
  listAssets: () => jsonFetch('/api/assets'),
  getAsset: (id) => jsonFetch(`/api/assets/${id}`),
  getTrend: (id, tag) => jsonFetch(`/api/assets/${id}/trend/${tag}`),
  analyze: (id) =>
    jsonFetch(`/api/analyze/${id}`, { method: 'POST', body: JSON.stringify({}) }),
  postAction: (payload) =>
    jsonFetch('/api/actions', { method: 'POST', body: JSON.stringify(payload) }),
  sampleDatasetUrl: () => `${BASE}/api/model/sample-dataset`,
  demoModel: () => jsonFetch('/api/model/demo'),
  generateModel: async (file) => {
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch(`${BASE}/api/model/generate`, {
      method: 'POST',
      body: fd,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`${res.status} ${res.statusText} ${text}`);
    }
    return res.json();
  },
};
