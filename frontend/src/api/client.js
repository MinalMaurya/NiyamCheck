/**
 * NiyamCheck API Client
 * Centralized fetch client handling baseURL, timeouts, error normalization, and multipart uploads.
 */

const API_BASE = (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE_URL) || '';

class ApiError extends Error {
  constructor(message, status = null, details = null, stage = null, errorCode = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.details = details;
    this.stage = stage;
    this.errorCode = errorCode;
  }
}

async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const defaultHeaders = {};

  if (!(options.body instanceof FormData)) {
    defaultHeaders['Content-Type'] = 'application/json';
  }

  const config = {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  };

  try {
    const response = await fetch(url, config);

    if (!response.ok) {
      let errorDetail = `Request failed with status ${response.status}`;
      let stage = null;
      let errorCode = null;
      let details = null;

      try {
        const text = await response.text();
        try {
          const errorData = JSON.parse(text);
          if (errorData) {
            if (errorData.message) {
              errorDetail = errorData.message;
            } else if (errorData.detail) {
              errorDetail = typeof errorData.detail === 'string'
                ? errorData.detail
                : JSON.stringify(errorData.detail);
            }
            stage = errorData.stage || null;
            errorCode = errorData.error_code || null;
            details = errorData.details || null;
          }
        } catch {
          if (text && text.trim()) {
            errorDetail = text.trim();
          }
        }
      } catch {
        // Response stream could not be read
      }
      throw new ApiError(errorDetail, response.status, details, stage, errorCode);
    }


    // Check for binary/attachment downloads
    const contentType = response.headers.get('content-type') || '';
    if (contentType.includes('application/pdf') || contentType.includes('application/octet-stream')) {
      return await response.blob();
    }

    if (response.status === 204) {
      return null;
    }

    return await response.json();
  } catch (err) {
    if (err instanceof ApiError) {
      throw err;
    }
    // Network or connection errors
    throw new ApiError(
      `Unable to connect to NiyamCheck backend. Please ensure FastAPI server is running on http://127.0.0.1:8000. (${err.message})`,
      0
    );
  }
}

export const api = {
  get: (endpoint, options) => request(endpoint, { ...options, method: 'GET' }),
  post: (endpoint, body, options) => request(endpoint, { ...options, method: 'POST', body: JSON.stringify(body) }),
  postForm: (endpoint, formData, options) => request(endpoint, { ...options, method: 'POST', body: formData }),
  delete: (endpoint, options) => request(endpoint, { ...options, method: 'DELETE' }),
  getBaseUrl: () => API_BASE || 'http://127.0.0.1:8000',
};

export { ApiError };
