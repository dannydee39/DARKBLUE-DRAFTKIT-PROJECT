import { useEffect, useState } from "react";

export default function AuthModal({
  open,
  user,
  busy = false,
  error = "",
  onClose,
  onLogin,
  onSignup,
  onLogout,
}) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");

  useEffect(() => {
    if (!open) return;
    setPassword("");
    if (user) {
      setMode("account");
      setEmail(user.email || "");
      setDisplayName(user.displayName || "");
    } else {
      setMode("login");
    }
  }, [open, user]);

  useEffect(() => {
    if (!open) return undefined;

    function onKeyDown(event) {
      if (event.key === "Escape") onClose?.();
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  async function handleSubmit(event) {
    event.preventDefault();
    if (busy) return;

    if (mode === "signup") {
      await onSignup?.({
        email,
        password,
        displayName,
      });
      return;
    }

    await onLogin?.({ email, password });
  }

  return (
    <div className="auth-modal-backdrop" onClick={() => onClose?.()}>
      <div
        className="auth-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="auth-modal-header">
          <div>
            <div className="auth-modal-kicker">Draft Kit Cloud</div>
            <h2 id="auth-modal-title">
              {user
                ? "Account & cloud library"
                : mode === "signup"
                  ? "Create your account"
                  : "Sign in"}
            </h2>
          </div>
          <button
            type="button"
            className="auth-modal-close"
            onClick={() => onClose?.()}
            aria-label="Close account dialog"
          >
            ×
          </button>
        </div>

        {user ? (
          <div className="auth-account-state">
            <div className="auth-account-card">
              <div className="auth-account-label">Signed in as</div>
              <div className="auth-account-name">
                {user.displayName || user.email}
              </div>
              <div className="auth-account-email">{user.email}</div>
            </div>
            <p className="auth-help-text">
              Draft instances now save to your VPS-backed cloud library instead
              of local-only browser storage.
            </p>
            {error ? <div className="auth-error">{error}</div> : null}
            <div className="auth-actions">
              <button
                type="button"
                className="auth-submit-btn secondary"
                onClick={() => onLogout?.()}
                disabled={busy}
              >
                {busy ? "Signing out…" : "Sign Out"}
              </button>
            </div>
          </div>
        ) : (
          <form className="auth-form" onSubmit={handleSubmit}>
            <div className="auth-mode-toggle">
              <button
                type="button"
                className={mode === "login" ? "active" : ""}
                onClick={() => setMode("login")}
              >
                Login
              </button>
              <button
                type="button"
                className={mode === "signup" ? "active" : ""}
                onClick={() => setMode("signup")}
              >
                Sign Up
              </button>
            </div>

            {mode === "signup" ? (
              <label className="auth-field">
                <span>Display Name</span>
                <input
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  placeholder="Commissioner Name"
                  autoComplete="name"
                />
              </label>
            ) : null}

            <label className="auth-field">
              <span>Email</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@anythingavenue.com"
                autoComplete="email"
                required
              />
            </label>

            <label className="auth-field">
              <span>Password</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Minimum 8 characters"
                autoComplete={
                  mode === "signup" ? "new-password" : "current-password"
                }
                required
              />
            </label>

            {error ? <div className="auth-error">{error}</div> : null}

            <div className="auth-actions">
              <button
                type="submit"
                className="auth-submit-btn"
                disabled={busy}
              >
                {busy
                  ? mode === "signup"
                    ? "Creating account…"
                    : "Signing in…"
                  : mode === "signup"
                    ? "Create Account"
                    : "Sign In"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
