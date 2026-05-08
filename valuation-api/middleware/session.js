const { findPrimaryLicenseForUser, findSessionByTokenHash, touchSession } = require("../lib/db");
const {
  createSessionExpiry,
  hashSessionToken,
  sanitizeUser,
} = require("../lib/security");

const SESSION_COOKIE_NAME =
  process.env.VALUATION_SESSION_COOKIE_NAME || "darkblue_value_session";

function parseCookies(header = "") {
  return header.split(";").reduce((acc, part) => {
    const [rawKey, ...rest] = part.trim().split("=");
    if (!rawKey) return acc;
    acc[rawKey] = decodeURIComponent(rest.join("=") || "");
    return acc;
  }, {});
}

function cookieOptions() {
  const isProd = (process.env.NODE_ENV || "development") === "production";
  const domain = process.env.VALUATION_SESSION_COOKIE_DOMAIN || process.env.SESSION_COOKIE_DOMAIN || undefined;
  const sameSite = process.env.SESSION_COOKIE_SAMESITE || "lax";
  return {
    httpOnly: true,
    secure: isProd,
    sameSite,
    path: "/",
    maxAge: Number(process.env.SESSION_COOKIE_MAX_AGE_MS || 30 * 24 * 60 * 60 * 1000),
    ...(domain ? { domain } : {}),
  };
}

function clearSessionCookie(res) {
  const options = cookieOptions();
  delete options.maxAge;
  res.clearCookie(SESSION_COOKIE_NAME, options);
}

async function attachSessionUser(req, _res, next) {
  const cookies = parseCookies(req.headers.cookie || "");
  const rawToken = cookies[SESSION_COOKIE_NAME];
  if (!rawToken) {
    req.sessionUser = null;
    req.session = null;
    return next();
  }

  const session = findSessionByTokenHash(hashSessionToken(rawToken));
  if (!session || new Date(session.expires_at).getTime() <= Date.now()) {
    req.sessionUser = null;
    req.session = null;
    return next();
  }

  const nextExpiry = createSessionExpiry();
  touchSession(session.id, nextExpiry);

  req.session = {
    id: session.id,
    userId: session.user_id,
    expiresAt: nextExpiry,
    token: rawToken,
  };
  req.sessionUser = sanitizeUser(session, findPrimaryLicenseForUser(session.user_id));
  return next();
}

function requireSession(req, res, next) {
  if (!req.sessionUser || !req.session) {
    return res.status(401).json({
      error: "Unauthorized",
      message: "Sign in is required for this action.",
      code: "AUTH_REQUIRED",
    });
  }
  return next();
}

module.exports = {
  SESSION_COOKIE_NAME,
  cookieOptions,
  clearSessionCookie,
  attachSessionUser,
  requireSession,
};
