import axios from "axios";

const API_BASE_URL = import.meta.env.DEV
  ? "/api"
  : import.meta.env.VITE_API_BASE_URL || "/api";

export const api = axios.create({
  baseURL: API_BASE_URL,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("acf_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export async function apiCall(url, options = {}) {
  const method = String(options.method || "GET").toLowerCase();
  const data = options.body;

  const response = await api.request({
    url,
    method,
    data,
  });

  return response.data;
}
