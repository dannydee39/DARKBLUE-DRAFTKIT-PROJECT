const crypto = require("crypto");
const express = require("express");
const rateLimit = require("express-rate-limit");
const {
  createSession,
  createUser,
  deleteSessionByTokenHash,
  findUserByEmail,
} = require("../lib/db");
const {
  createSessionExpiry,
  createSessionToken,
  deriveDisplayName,
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

router.use(attachSessionUser);

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

router.post("/logout", (req, res) => {
  if (req.session?.token) {
    deleteSessionByTokenHash(hashSessionToken(req.session.token));
  }
  clearSessionCookie(res);
  res.json({ ok: true });
});

module.exports = router;
