import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function bootstrap() {
      const token = localStorage.getItem("acf_token");
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const response = await api.get("/auth/me");
        setUser(response.data.user);
        localStorage.setItem("acf_session", JSON.stringify(response.data.user));
      } catch (error) {
        localStorage.removeItem("acf_token");
        localStorage.removeItem("acf_session");
        setUser(null);
      } finally {
        setLoading(false);
      }
    }

    bootstrap();
  }, []);

  async function login(email, password) {
    const response = await api.post("/auth/login", { email, password });
    localStorage.setItem("acf_token", response.data.token);
    setUser(response.data.user);
    localStorage.setItem("acf_session", JSON.stringify(response.data.user));
  }

  async function register(payload) {
    const response = await api.post("/auth/register", payload);
    localStorage.setItem("acf_token", response.data.token);
    setUser(response.data.user);
    localStorage.setItem("acf_session", JSON.stringify(response.data.user));
  }

  function logout() {
    localStorage.removeItem("acf_token");
    localStorage.removeItem("acf_session");
    setUser(null);
  }

  const value = useMemo(
    () => ({
      user,
      loading,
      isAuthenticated: Boolean(user),
      login,
      register,
      logout,
    }),
    [user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
