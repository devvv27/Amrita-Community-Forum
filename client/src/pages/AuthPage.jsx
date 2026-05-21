import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Card from "../components/Card";
import Button from "../components/Button";
import Input from "../components/Input";

export default function AuthPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, register, isAuthenticated } = useAuth();
  const intendedPath = location.state?.from?.pathname || "/profile";
  const [mode, setMode] = useState("login");

  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [registerForm, setRegisterForm] = useState({ name: "", email: "", password: "", skills: "" });
  const [loginError, setLoginError] = useState("");
  const [registerError, setRegisterError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [registerLoading, setRegisterLoading] = useState(false);
  const [loginSubmitted, setLoginSubmitted] = useState(false);
  const [registerSubmitted, setRegisterSubmitted] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      navigate(intendedPath, { replace: true });
    }
  }, [isAuthenticated, intendedPath, navigate]);

  async function handleLoginSubmit(event) {
    event.preventDefault();
    setLoginSubmitted(true);
    setLoginError("");
    setLoginLoading(true);

    try {
      await login(loginForm.email, loginForm.password);
      navigate(intendedPath, { replace: true });
    } catch (apiError) {
      setLoginError(apiError.response?.data?.message || "Login failed");
    } finally {
      setLoginLoading(false);
    }
  }

  async function handleRegisterSubmit(event) {
    event.preventDefault();
    setRegisterSubmitted(true);
    setRegisterError("");
    setRegisterLoading(true);

    try {
      await register({
        name: registerForm.name,
        email: registerForm.email,
        password: registerForm.password,
        skills: registerForm.skills
          .split(",")
          .map((skill) => skill.trim())
          .filter(Boolean),
      });
      navigate("/profile", { replace: true });
    } catch (apiError) {
      setRegisterError(apiError.response?.data?.message || "Registration failed");
    } finally {
      setRegisterLoading(false);
    }
  }

  return (
    <section className="fade-in space-y-6">
      <Card accent className="overflow-hidden border border-white/10 bg-gradient-to-br from-surface via-obsidian to-surface">
        <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="space-y-4">
            <p className="text-xs uppercase tracking-[0.3em] text-muted">Account Access</p>
            <h1 className="text-3xl font-semibold tracking-tight text-text">One secure account, one clean interface.</h1>
            <p className="max-w-xl text-sm text-text/70">
              Switch between login and registration without leaving the page.
            </p>
            {location.state?.from?.pathname && (
              <p className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-text/80">
                Sign in to continue to {location.state.from.pathname}
              </p>
            )}

            <div className="inline-flex rounded-full border border-white/10 bg-white/5 p-1">
              <button
                type="button"
                onClick={() => setMode("login")}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${mode === "login" ? "bg-white text-obsidian" : "text-text/70 hover:text-text"}`}
              >
                Login
              </button>
              <button
                type="button"
                onClick={() => setMode("register")}
                className={`rounded-full px-4 py-2 text-sm font-medium transition ${mode === "register" ? "bg-white text-obsidian" : "text-text/70 hover:text-text"}`}
              >
                Register
              </button>
            </div>
          </div>

          <div className="relative">
            <div className="absolute inset-0 rounded-3xl bg-white/5 blur-2xl" />
            <Card className="relative border border-white/10 bg-surface/90 shadow-2xl">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold">{mode === "login" ? "Login" : "Register"}</h2>
                  <p className="mt-1 text-sm text-text/70">
                    {mode === "login" ? "Access your existing account." : "Create a new community account."}
                  </p>
                </div>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-text/60">
                  {mode === "login" ? "Welcome back" : "Join now"}
                </span>
              </div>

              {mode === "login" ? (
                <form noValidate onSubmit={handleLoginSubmit} className="space-y-3">
                  <Input
                    label="Email"
                    type="email"
                    autoComplete="email"
                    value={loginForm.email}
                    onChange={(event) => setLoginForm((prev) => ({ ...prev, email: event.target.value }))}
                    error={loginSubmitted && !loginForm.email ? "Email is required" : ""}
                    required
                  />
                  <Input
                    label="Password"
                    type="password"
                    autoComplete="current-password"
                    value={loginForm.password}
                    onChange={(event) => setLoginForm((prev) => ({ ...prev, password: event.target.value }))}
                    error={loginSubmitted && !loginForm.password ? "Password is required" : ""}
                    required
                  />
                  {loginError && <p className="text-sm text-danger">{loginError}</p>}
                  <Button className="w-full" type="submit" disabled={loginLoading}>
                    {loginLoading ? "Logging in..." : "Login"}
                  </Button>
                  <div className="flex items-center justify-between text-sm">
                    <button type="button" onClick={() => setMode("register")} className="text-text/70 hover:text-text">
                      Need an account?
                    </button>
                    <Link to="/forgot-password" className="text-text/70 hover:text-text">
                      Forgot password?
                    </Link>
                  </div>
                </form>
              ) : (
                <form noValidate onSubmit={handleRegisterSubmit} className="space-y-3">
                  <Input
                    label="Name"
                    type="text"
                    autoComplete="name"
                    value={registerForm.name}
                    onChange={(event) => setRegisterForm((prev) => ({ ...prev, name: event.target.value }))}
                    error={registerSubmitted && !registerForm.name ? "Name is required" : ""}
                    required
                  />
                  <Input
                    label="Email"
                    type="email"
                    autoComplete="email"
                    value={registerForm.email}
                    onChange={(event) => setRegisterForm((prev) => ({ ...prev, email: event.target.value }))}
                    error={registerSubmitted && !registerForm.email ? "Email is required" : ""}
                    required
                  />
                  <Input
                    label="Password"
                    type="password"
                    autoComplete="new-password"
                    value={registerForm.password}
                    onChange={(event) => setRegisterForm((prev) => ({ ...prev, password: event.target.value }))}
                    error={registerSubmitted && !registerForm.password ? "Password is required" : ""}
                    required
                  />
                  <Input
                    label="Skills"
                    type="text"
                    autoComplete="off"
                    value={registerForm.skills}
                    onChange={(event) => setRegisterForm((prev) => ({ ...prev, skills: event.target.value }))}
                    hint="Optional. Separate skills with commas."
                  />
                  {registerError && <p className="text-sm text-danger">{registerError}</p>}
                  <Button className="w-full" type="submit" disabled={registerLoading}>
                    {registerLoading ? "Creating account..." : "Register"}
                  </Button>
                  <button type="button" onClick={() => setMode("login")} className="text-sm text-text/70 hover:text-text">
                    Already have an account? Login
                  </button>
                </form>
              )}
            </Card>
          </div>
        </div>
      </Card>
    </section>
  );
}
