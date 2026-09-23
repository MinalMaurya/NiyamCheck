import { api, ApiError } from './client.js';

/**
 * Product Management API Client (Sufiya Module)
 * Directly connects to FastAPI backend /api/v1/products endpoints.
 */

export async function listProducts({ vendorId = null, category = null, status = null, search = null } = {}) {
  const params = new URLSearchParams();
  if (vendorId) params.append('vendor_id', vendorId);
  if (category && category !== 'ALL') params.append('category', category);
  if (status && status !== 'ALL') params.append('status', status);
  if (search && search.trim()) params.append('search', search.trim());

  const queryStr = params.toString() ? `?${params.toString()}` : '';
  const response = await api.get(`/api/v1/products${queryStr}`);
  return response.items || [];
}

export async function getProduct(productId) {
  if (!productId) throw new Error('Product ID is required');
  return await api.get(`/api/v1/products/${encodeURIComponent(productId)}`);
}

export async function createProduct(productData) {
  return await api.post('/api/v1/products', productData);
}

export async function updateProduct(productId, updates) {
  if (!productId) throw new Error('Product ID is required');
  return await api.put(`/api/v1/products/${encodeURIComponent(productId)}`, updates);
}

export async function deleteProduct(productId) {
  if (!productId) throw new Error('Product ID is required');
  return await api.delete(`/api/v1/products/${encodeURIComponent(productId)}`);
}

export async function linkProductInspection(productId, inspectionId, overrideStatus = null) {
  if (!productId || !inspectionId) throw new Error('Product ID and Inspection ID are required');
  const queryStr = overrideStatus ? `?override_status=${encodeURIComponent(overrideStatus)}` : '';
  return await api.post(`/api/v1/products/${encodeURIComponent(productId)}/link_inspection/${encodeURIComponent(inspectionId)}${queryStr}`);
}
