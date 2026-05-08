const crypto = require("crypto");
const express = require("express");
const rateLimit = require("express-rate-limit");
const {
  createPasswordResetToken: createPasswordResetTokenRecord,
  createSession,
  createUser,
  deleteSessionByTokenHash,
  deletePasswordResetTokensForUser,
  deleteSessionsForUser,
  findUserByEmail,
  findPasswordResetToken,
  markPasswordResetTokenUsed,
  updateUserPassword,
} = require("../lib/db");
const {
  buildPasswordResetUrl,
  mailerIsConfigured,
  sendPasswordResetEmail,
} = require("../lib/mailer");
const {
  createSessionExpiry,
  createSessionToken,
  createPasswordResetToken,
  deriveDisplayName,
  hashPasswordResetToken,
  hashPassword,
  hashSessionToken,
  normalizeEmail,
  sanitizeUser,
  verifyPassword,
} = require("../lib/security");
const {
  SESSION_COOKIE_NAME,
  attachSessionUser,
  clearSessionCookie,
  cookieOptions,
} = require("../middleware/session");

const router = express.Router();
const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too Many Requests",
    message: "Too many authentication attempts. Please wait a moment.",
  },
});
const passwordResetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: "Too Many Requests",
    message: "Too many password reset attempts. Please wait before trying again.",
  },
});
const PASSWORD_RESET_TTL_MINUTES = Number(process.env.PASSWORD_RESET_TTL_MINUTES || 30);

router.use(attachSessionUser);

function createPasswordResetExpiry() {
  return new Date(
    Date.now() + PASSWORD_RESET_TTL_MINUTES * 60 * 1000,
  ).toISOString();
}

function passwordResetAcceptedPayload(extra = {}) {
  return {
    ok: true,
    message:
      "If that account exists, a password reset link will be sent shortly.",
    ...extra,
  };
}

router.get("/me", (req, res) => {
  res.json({
    authenticated: Boolean(req.sessionUser),
    user: req.sessionUser || null,
  });
});

router.post("/signup", authLimiter, async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const password = String(req.body?.password || "");
  const displayName = String(req.body?.displayName || "").trim() || deriveDisplayName(email);

  if (!email || !email.includes("@")) {
    return res.status(400).json({
      error: "Bad Request",
      message: "A valid email address is required.",
    });
  }

  if (password.length < 8) {
    return res.status(400).json({
      error: "Bad Request",
      message: "Password must be at least 8 characters.",
    });
  }

  if (findUserByEmail(email)) {
    return res.status(409).json({
      error: "Conflict",
      message: "That email is already registered.",
    });
  }

  const passwordHash = await hashPassword(password);
  const user = createUser({
    email,
    displayName,
    passwordHash,
  });

  const sessionToken = createSessionToken();
  const sessionId = crypto.randomUUID();
  const expiresAt = createSessionExpiry();

  createSession({
    id: sessionId,
    userId: user.id,
    tokenHash: hashSessionToken(sessionToken),
    expiresAt,
  });

  res.cookie(SESSION_COOKIE_NAME, sessionToken, cookieOptions());
  res.status(201).json({
    authenticated: true,
    user: sanitizeUser(user),
  });
});

router.post("/login", authLimiter, async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  const password = String(req.body?.password || "");

  if (!email || !password) {
    return res.status(400).json({
      error: "Bad Request",
      message: "Email and password are required.",
    });
  }

  const user = findUserByEmail(email);
  if (!user || !(await verifyPassword(password, user.password_hash))) {
    return res.status(401).json({
      error: "Unauthorized",
      message: "Invalid email or password.",
    });
  }

  const sessionToken = createSessionToken();
  const sessionId = crypto.randomUUID();
  const expiresAt = createSessionExpiry();

  createSession({
    id: sessionId,
    userId: user.id,
    tokenHash: hashSessionToken(sessionToken),
    expiresAt,
  });

  res.cookie(SESSION_COOKIE_NAME, sessionToken, cookieOptions());
  res.json({
    authenticated: true,
    user: sanitizeUser(user),
  });
});

router.post("/password-reset/request", passwordResetLimiter, async (req, res) => {
  const email = normalizeEmail(req.body?.email);
  if (!email || !email.includes("@")) {
    return res.status(400).json({
      error: "Bad Request",
      message: "A valid email address is required.",
    });
  }

  if (!mailerIsConfigured()) {
    return res.status(503).json({
      error: "Service Unavailable",
      code: "MAIL_NOT_CONFIGURED",
      message: "Password reset email is not configured for this deployment.",
    });
  }

  const user = findUserByEmail(email);
  if (!user) {
    return res.status(202).json(passwordResetAcceptedPayload());
  }

  const rawToken = createPasswordResetToken();
  const tokenHash = hashPasswordResetToken(rawToken);
  const resetUrl = buildPasswordResetUrl(rawToken);

  deletePasswordResetTokensForUser(user.id);
  createPasswordResetTokenRecord({
    id: crypto.randomUUID(),
    userId: user.id,
    tokenHash,
    expiresAt: createPasswordResetExpiry(),
    requestIp: req.ip,
    userAgent: req.get("user-agent") || null,
  });

  try {
    await sendPasswordResetEmail({
      to: user.email,
      displayName: user.display_name,
      resetUrl,
    });
  } catch (error) {
    deletePasswordResetTokensForUser(user.id);
    const statusCode = error.code === "MAIL_NOT_CONFIGURED" ? 503 : 502;
    return res.status(statusCode).json({
      error: "Service Unavailable",
      code: "MAIL_DELIVERY_FAILED",
      message: "Password reset email could not be sent. Please try again later.",
    });
  }

  const exposeToken =
    process.env.NODE_ENV !== "production" &&
    process.env.PASSWORD_RESET_EXPOSE_TOKEN === "true";
  return res.status(202).json(
    passwordResetAcceptedPayload(
      exposeToken ? { resetToken: rawToken, resetUrl } : {},
    ),
  );
});

router.post("/password-reset/confirm", passwordResetLimiter, async (req, res) => {
  const token = String(req.body?.token || "").trim();
  const password = String(req.body?.password || "");

  if (!token) {
    return res.status(400).json({
      error: "Bad Request",
      message: "A reset token is required.",
    });
  }

  if (password.length < 8) {
    return res.status(400).json({
      error: "Bad Request",
      message: "Password must be at least 8 characters.",
    });
  }

  const record = findPasswordResetToken(hashPasswordResetToken(token));
  const expired = !record || Date.parse(record.expires_at) <= Date.now();
  if (expired || record.used_at) {
    return res.status(400).json({
      error: "Bad Request",
      code: "INVALID_RESET_TOKEN",
      message: "Reset link is invalid or expired.",
    });
  }

  const passwordHash = await hashPassword(password);
  updateUserPassword(record.user_id, passwordHash);
  markPasswordResetTokenUsed(record.id);
  deletePasswordResetTokensForUser(record.user_id);
  deleteSessionsForUser(record.user_id);
  clearSessionCookie(res);

  return res.json({
    ok: true,
    message: "Password reset complete. Sign in with your new password.",
  });
});

router.post("/logout", (req, res) => {
  if (req.session?.token) {
    deleteSessionByTokenHash(hashSessionToken(req.session.token));
  }
  clearSessionCookie(res);
  res.json({ ok: true });
});

module.exports = router;
