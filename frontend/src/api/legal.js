import { api } from './client.js';

export async function getLegalSources() {
  return await api.get('/api/v1/legal/sources');
}

export async function searchLegalProvisions(query, topK = 5) {
  if (!query || query.trim().length < 2) {
    throw new Error('Search query must be at least 2 characters long.');
  }
  const params = new URLSearchParams({
    q: query.trim(),
    top_k: topK.toString(),
  });
  return await api.get(`/api/v1/legal/search?${params.toString()}`);
}

export async function getLegalStatus() {
  return await api.get('/api/v1/legal/status');
}
