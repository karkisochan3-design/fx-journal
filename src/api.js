const BASE = '/api';

async function req(path, options = {}) {
  const res = await fetch(BASE + path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      if (body?.error) msg = body.error;
    } catch {}
    throw new Error(msg);
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  health: () => req('/health'),
  list: () => req('/trades'),
  get: (id) => req(`/trades/${id}`),
  create: (trade) => req('/trades', { method: 'POST', body: JSON.stringify(trade) }),
  update: (id, trade) => req(`/trades/${id}`, { method: 'PUT', body: JSON.stringify(trade) }),
  remove: (id) => req(`/trades/${id}`, { method: 'DELETE' }),
  clearAll: () => req('/trades', { method: 'DELETE' }),
  bulk: (trades) => req('/trades/bulk', { method: 'POST', body: JSON.stringify(trades) }),
  seed: (force = false) => req(`/seed${force ? '?force=1' : ''}`, { method: 'POST' }),
};
