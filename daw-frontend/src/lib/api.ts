import axios from "axios";

export const API_URL =
  import.meta.env.VITE_API_URL || "http://172.30.1.20:5550/api";

// http://172.30.1.20:5550/api
// http://localhost:5000/api
export const BASE_UPLOAD_URL = API_URL.replace("/api", "") + "/uploads";

const api = axios.create({
  baseURL: API_URL,
});

// --- INTERCEPTOR ---
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("daw_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
