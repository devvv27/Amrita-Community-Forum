import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import Button from "../components/Button";
import Input from "../components/Input";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [submittedReset, setSubmittedReset] = useState(false);
  const [submittedUpdate, setSubmittedUpdate] = useState(false);

  async function requestReset(event) {
    event.preventDefault();
    setSubmittedReset(true);
    setError("");
    setMessage("");
    setLoading(true);

    try {
      const response = await api.post("/auth/forgot-password", { email });
      setResetToken(response.data.resetToken || "");
      setMessage("Reset code generated. Use it below to set a new password.");
    } catch (apiError) {
      setError(apiError.response?.data?.message || "Unable to start password reset");
    } finally {
      setLoading(false);
    }
  }

  async function submitNewPassword(event) {
    event.preventDefault();
    setSubmittedUpdate(true);
    setError("");
    setMessage("");
    setLoading(true);

    try {
      await api.post("/auth/reset-password", {
        email,
        resetToken,
        newPassword,
      });
      setMessage("Password updated successfully. You can log in now.");
      setNewPassword("");
      setResetToken("");
    } catch (apiError) {
      setError(apiError.response?.data?.message || "Unable to reset password");
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="mx-auto max-w-md card fade-in space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Forgot Password</h1>
        <p className="mt-1 text-sm text-text/70">Request a reset code and create a new password.</p>
      </div>

      <form noValidate onSubmit={requestReset} className="space-y-3">
        <Input
          label="Registered email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          error={submittedReset && !email ? "Email is required" : ""}
          required
        />
        <Button variant="secondary" className="w-full" type="submit" disabled={loading}>
          {loading ? "Generating code..." : "Generate reset code"}
        </Button>
      </form>

      <form noValidate onSubmit={submitNewPassword} className="space-y-3 border-t border-white/10 pt-5">
        <Input
          label="Reset code"
          type="text"
          autoComplete="one-time-code"
          value={resetToken}
          onChange={(event) => setResetToken(event.target.value)}
          error={submittedUpdate && !resetToken ? "Reset code is required" : ""}
          required
        />
        <Input
          label="New password"
          type="password"
          autoComplete="new-password"
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
          error={submittedUpdate && !newPassword ? "New password is required" : ""}
          required
        />
        <Button className="btn-primary w-full" type="submit" disabled={loading}>
          {loading ? "Updating..." : "Reset password"}
        </Button>
      </form>

      {message && <p className="text-sm text-neon">{message}</p>}
      {error && <p className="text-sm text-danger">{error}</p>}

      <p className="text-sm text-text/70">
        Back to <Link to="/auth" className="text-danger font-semibold">Login</Link>
      </p>
    </section>
  );
}