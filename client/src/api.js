import axios from "axios";

/**
 * In production VITE_API_URL points at Render.
 * In dev it is blank, and vite.config.js proxies /api to localhost:5000.
 */
const baseURL = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

export const api = axios.create({ baseURL, timeout: 45000 });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("edumind-token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  const model = localStorage.getItem("edumind-ai-model");
  if (model) config.headers["X-AI-Model"] = model;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    // A 401 anywhere means the token is dead — clear it and bounce to login.
    if (err.response?.status === 401 && !err.config.url.includes("/auth/login")) {
      localStorage.removeItem("edumind-token");
      if (!window.location.pathname.startsWith("/login")) window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);

/** Pull a readable message out of any axios failure. */
export function errMsg(err, fallback = "Something went wrong. Try again.") {
  if (err?.code === "ECONNABORTED") return "The server took too long. Free Render instances sleep — try once more.";
  if (err?.message === "Network Error") return "Can't reach the server. Check that the API is running and VITE_API_URL is correct.";
  return err?.response?.data?.message || fallback;
}
