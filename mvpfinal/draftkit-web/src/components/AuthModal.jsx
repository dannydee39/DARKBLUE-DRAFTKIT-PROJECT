import { useEffect, useState } from "react";

export default function AuthModal({
  open,
  user,
  drafts = [],
  activeDraftId = null,
  storageMode = "local",
  cloudSyncMessage = "",
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

  const activeDraft = drafts.find((draft) => draft.id === activeDraftId) || null;
  const cloudDraftCount = drafts.filter(
    (draft) => (draft.source || "").toLowerCase() === "cloud",
  ).length;
  const lastSavedDraft =
    drafts
      .slice()
      .sort((a, b) => {
        const aTime = new Date(a.updatedAt || a.lastOpenedAt || 0).getTime();
        const bTime = new Date(b.updatedAt || b.lastOpenedAt || 0).getTime();
        return bTime - aTime;
      })[0] || null;

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
            <div className="auth-modal-kicker">DB Draft Kit</div>
            <h2 id="auth-modal-title">
              {user
                ? "Cloud Library"
                : mode === "signup"
                  ? "Create Draft Kit Account"
                  : "Sign In"}
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
              <div className="auth-account-top">
                <div className="auth-account-avatar" aria-hidden="true">
                  {user.initials || user.displayName?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || "D"}
                </div>
                <div>
                  <div className="auth-account-label">Signed in as</div>
                  <div className="auth-account-name">
                    {user.displayName || user.email}
                  </div>
                  <div className="auth-account-email">{user.email}</div>
                </div>
              </div>
            </div>

            {cloudSyncMessage ? (
              <div className="auth-sync-banner">{cloudSyncMessage}</div>
            ) : null}

            <div className="auth-library-grid">
              <div className="auth-library-card auth-library-card-primary">
                <div className="auth-library-kicker">Library Status</div>
                <div className="auth-library-title">Cloud sync is ready</div>
                <p className="auth-library-copy">
                  Draft rooms created while signed in stay attached to your
                  Draft Kit account and reopen from the library screen.
                </p>
                <div className="auth-stat-grid">
                  <div className="auth-stat-card">
                    <span>Saved Drafts</span>
                    <strong>{drafts.length}</strong>
                  </div>
                  <div className="auth-stat-card">
                    <span>Cloud Drafts</span>
                    <strong>{cloudDraftCount}</strong>
                  </div>
                  <div className="auth-stat-card">
                    <span>Storage</span>
                    <strong>{storageMode === "cloud" ? "Cloud" : "Local"}</strong>
                  </div>
                </div>
              </div>

              <div className="auth-library-card">
                <div className="auth-library-kicker">Current Workspace</div>
                <div className="auth-library-title">
                  {activeDraft?.league?.name || "No draft open"}
                </div>
                <div className="auth-library-list">
                  <div className="auth-library-row">
                    <span>Season</span>
                    <strong>{activeDraft?.league?.season || "2025"}</strong>
                  </div>
                  <div className="auth-library-row">
                    <span>Pool</span>
                    <strong>{formatPool(activeDraft?.league?.pool)}</strong>
                  </div>
                  <div className="auth-library-row">
                    <span>Last Saved</span>
                    <strong>{formatTimestamp(lastSavedDraft?.updatedAt || lastSavedDraft?.lastOpenedAt)}</strong>
                  </div>
                </div>
              </div>
            </div>

            <div className="auth-library-panel">
              <div className="auth-library-kicker">What your account does</div>
              <div className="auth-library-title">Draft Kit keeps your room moving</div>
              <ul className="auth-benefit-list">
                <li>Syncs saved draft rooms to your account.</li>
                <li>Lets you reopen the same league from the draft library.</li>
                <li>Keeps commissioners signed in across sessions.</li>
              </ul>
            </div>

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
            <div className="auth-library-panel auth-library-panel-primary">
              <div className="auth-library-kicker">Draft Kit Cloud</div>
              <div className="auth-library-title">
                Save your draft rooms to your account
              </div>
              <p className="auth-library-copy">
                Sign in to keep leagues, draft progress, and library access tied
                to your Draft Kit profile instead of one browser only.
              </p>
              <ul className="auth-benefit-list">
                <li>Resume draft rooms from the library screen.</li>
                <li>Keep commissioner workspaces organized in one place.</li>
                <li>Stay signed in for repeat draft sessions.</li>
              </ul>
            </div>

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

function formatTimestamp(timestamp) {
  if (!timestamp) return "Not saved yet";
  try {
    return new Date(timestamp).toLocaleDateString();
  } catch {
    return String(timestamp);
  }
}

function formatPool(pool) {
  if (pool === "AL") return "AL Only";
  if (pool === "NL") return "NL Only";
  return "MLB (All)";
}
