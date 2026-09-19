import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api, errMsg } from "../api";

const AuthContext = createContext(null);
const TOKEN_KEY = "edumind-token";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Restore the session on load if a token is present.
  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return setLoading(false);
    api
      .get("/api/auth/me")
      .then(({ data }) => setUser(data.user))
      .catch(() => localStorage.removeItem(TOKEN_KEY))
      .finally(() => setLoading(false));
  }, []);

  const persist = (data) => {
    localStorage.setItem(TOKEN_KEY, data.token);
    setUser(data.user);
    return data.user;
  };

  const login = useCallback(async (email, password) => {
    const { data } = await api.post("/api/auth/login", { email, password });
    return persist(data);
  }, []);

  const register = useCallback(async (payload) => {
    const { data } = await api.post("/api/auth/register", payload);
    return persist(data);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setUser(null);
  }, []);

  const updateProfile = useCallback(async (patch) => {
    const { data } = await api.put("/api/auth/me", patch);
    setUser(data.user);
    return data.user;
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, updateProfile, errMsg }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
