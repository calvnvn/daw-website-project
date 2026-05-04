import axios, { type InternalAxiosRequestConfig } from "axios";

const DEFAULT_API_URL = "/api";

/**
 * Normalizes the base URL by removing trailing slashes.
 * Falls back to the default API path if undefined or empty.
 */
const normalizeBaseUrl = (url?: string): string => {
  if (!url || url.trim() === "") {
    return DEFAULT_API_URL;
  }
  return url.endsWith("/") ? url.slice(0, -1) : url;
};

// Internal CMS API URL
export const API_URL = normalizeBaseUrl(import.meta.env.VITE_API_URL);

// OWL/ERP Core API URL (Fallback to API_URL if undefined)
export const DAW_API_URL = normalizeBaseUrl(
  import.meta.env.VITE_DAW_API_URL || import.meta.env.VITE_API_URL,
);

// Resolves the base upload directory (e.g., replaces '/api' with '/uploads')
export const BASE_UPLOAD_URL = API_URL.replace(/\/api$/, "") + "/uploads";

// Instance 1: Content Management API
const api = axios.create({
  baseURL: API_URL,
});

// Instance 2: Core Enterprise API (Login, Approvals)
export const dawApi = axios.create({
  baseURL: DAW_API_URL,
});

/**
 * Request Interceptor: Injects the authorization token globally.
 */
const injectToken = (config: InternalAxiosRequestConfig) => {
  const token = localStorage.getItem("daw_token");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
};

api.interceptors.request.use(injectToken);
dawApi.interceptors.request.use(injectToken);

export default api;
