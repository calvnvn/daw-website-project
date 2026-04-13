import axios, { type InternalAxiosRequestConfig } from "axios";

/**
 * API CONFIGURATION
 * CMS_API: Local Content Features
 * OWL_API: Login & Workflow Perusahaan
 */

// URL untuk Backend CMS Pribadi
export const API_URL = import.meta.env.VITE_API_URL;

// URL untuk OWL
export const DAW_API_URL = import.meta.env.VITE_DAW_API_URL;

const cleanDawUrl = DAW_API_URL.endsWith("/")
  ? DAW_API_URL.slice(0, -1)
  : DAW_API_URL;

// URL untuk akses file assets
export const BASE_UPLOAD_URL = API_URL.replace("/api", "") + "/uploads";

/**
 * 🚀 AXIOS INSTANCES
 */

// Instance 1: Untuk CMS internal
const api = axios.create({
  baseURL: API_URL,
});

// Instance 2: untuk nembak OWL (Login & Approval)
export const dawApi = axios.create({
  baseURL: cleanDawUrl,
});

/**
 * REQUEST INTERCEPTORS
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
