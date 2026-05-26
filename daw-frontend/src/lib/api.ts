import axios, { type InternalAxiosRequestConfig } from "axios";

/**
 * GATEWAY: API Infrastructure
 * Orchestrates service-specific clients and global security interceptors.
 */

// SYSTEM CONFIGURATION
const DEFAULT_API_URL = "/api";

// Enforce consistent base URL formatting by stripping trailing slashes
const normalizeBaseUrl = (url?: string): string => {
  if (!url || url.trim() === "") {
    return DEFAULT_API_URL;
  }
  return url.endsWith("/") ? url.slice(0, -1) : url;
};

// Synchronize environment-specific endpoints
export const API_URL = normalizeBaseUrl(import.meta.env.VITE_API_URL);
export const DAW_API_URL = normalizeBaseUrl(
  import.meta.env.VITE_DAW_API_URL || import.meta.env.VITE_API_URL,
);
export const BASE_UPLOAD_URL = API_URL.replace(/\/api$/, "") + "/uploads";

// NETWORK CLIENTS
// Initialize dedicated instances for CMS and Enterprise Core services
const api = axios.create({
  baseURL: API_URL,
});
export const dawApi = axios.create({
  baseURL: DAW_API_URL,
});

// MIDDLEWARE PIPELINE
// Authorize outgoing requests via Bearer token injection
const injectToken = (config: InternalAxiosRequestConfig) => {
  const token = localStorage.getItem("daw_token");

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
};

// Invalidate stale sessions and purge storage on 401 Unauthorized
const handleAuthError = (error: unknown) => {
  if (
    (typeof error === "object" && error !== null && "response" in error
      ? (error as any).response?.status
      : undefined) === 401
  ) {
    // console.warn(
    //   "⚠️ [AUTH] Token expired or invalid. Auto-cleaning storage...",
    // );
    localStorage.removeItem("daw_token");
    localStorage.removeItem("daw_user");

    window.dispatchEvent(new Event("auth:unauthorized"));
  }
  return Promise.reject(error);
};

// Apply interceptor pipeline to all initialized client instances
api.interceptors.request.use(injectToken);
dawApi.interceptors.request.use(injectToken);

api.interceptors.response.use((res) => res, handleAuthError);
dawApi.interceptors.response.use((res) => res, handleAuthError);

export default api;
