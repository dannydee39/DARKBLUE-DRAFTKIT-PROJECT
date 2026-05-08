// middleware/auth.js - API key authentication and optional IP allowlisting.
const { findLicenseByKey } = require("../lib/db");

/**
 * Validates X-License-Key against configured API keys, then enforces an
 * optional IP allowlist. Leave API_IP_WHITELIST and API_KEY_IP_WHITELIST empty
 * to keep existing demo behavior open.
 */
function requireApiKey(req, res, next) {
  const key = req.headers["x-license-key"];

  if (!key) {
    return res.status(401).json({
      error: "Unauthorized",
      message: "Missing X-License-Key header. Register at darkbluevalue.anythingavenue.com.",
      code: "NO_KEY",
    });
  }

  const envKeys = getEnvKeys();
  const envKeyAllowed = envKeys.has(key);
  const license = envKeyAllowed ? null : findLicenseByKey(key);
  if (!envKeyAllowed && !license) {
    return res.status(401).json({
      error: "Unauthorized",
      message: "Invalid license key. Verify your key at darkbluevalue.anythingavenue.com.",
      code: "INVALID_KEY",
    });
  }

  const clientIp = getClientIp(req);
  const keyWhitelists = parsePerKeyWhitelist(process.env.API_KEY_IP_WHITELIST);
  const globalWhitelist = parseRuleList(process.env.API_IP_WHITELIST);
  const licenseWhitelist = license ? parseRuleList(license.allowed_ips) : [];
  const perKeyWhitelist = keyWhitelists.get(key);
  const whitelist = perKeyWhitelist || (licenseWhitelist.length > 0 ? licenseWhitelist : globalWhitelist);
  if (whitelist.length > 0 && !isIpAllowed(clientIp, whitelist)) {
    return res.status(403).json({
      error: "Forbidden",
      message: "This license key is not allowed from the current IP address.",
      code: "IP_NOT_ALLOWED",
    });
  }

  next();
}

function getEnvKeys() {
  return new Set(
    (process.env.API_KEYS || "DB-2026-DEMO-0001")
      .split(",")
      .map((k) => k.trim())
      .filter(Boolean),
  );
}

function parsePerKeyWhitelist(value = "") {
  const map = new Map();
  String(value || "")
    .split(";")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .forEach((entry) => {
      const separator = entry.indexOf("=");
      if (separator <= 0) return;
      const key = entry.slice(0, separator).trim();
      const rules = parseRuleList(entry.slice(separator + 1));
      if (key && rules.length > 0) map.set(key, rules);
    });
  return map;
}

function parseRuleList(value = "") {
  return String(value || "")
    .split(/[,\s|]+/)
    .map((rule) => rule.trim())
    .filter(Boolean);
}

function getClientIp(req) {
  const cfIp = firstHeaderValue(req.headers["cf-connecting-ip"]);
  if (cfIp) return normalizeIp(cfIp);

  const forwardedFor = firstHeaderValue(req.headers["x-forwarded-for"]);
  if (forwardedFor) return normalizeIp(forwardedFor);

  return normalizeIp(req.ip || req.socket?.remoteAddress || "");
}

function firstHeaderValue(value) {
  const raw = Array.isArray(value) ? value[0] : value;
  return String(raw || "").split(",")[0].trim();
}

function normalizeIp(ip) {
  const value = String(ip || "").trim();
  if (value.startsWith("::ffff:")) return value.slice(7);
  return value;
}

function isIpAllowed(ip, rules = []) {
  const normalizedIp = normalizeIp(ip);
  return rules.some((rule) => ipMatchesRule(normalizedIp, rule));
}

function ipMatchesRule(ip, rule) {
  const normalizedRule = normalizeIp(rule);
  if (!normalizedRule) return false;
  if (normalizedRule === "*" || normalizedRule === "0.0.0.0/0" || normalizedRule === "::/0") {
    return true;
  }

  if (!normalizedRule.includes("/")) {
    return ip === normalizedRule;
  }

  const [network, prefixValue] = normalizedRule.split("/");
  const prefixLength = Number(prefixValue);
  const ipInt = ipv4ToInt(ip);
  const networkInt = ipv4ToInt(network);
  if (ipInt == null || networkInt == null || !Number.isInteger(prefixLength)) {
    return false;
  }
  if (prefixLength < 0 || prefixLength > 32) return false;

  const mask = prefixLength === 0 ? 0 : (0xffffffff << (32 - prefixLength)) >>> 0;
  return (ipInt & mask) === (networkInt & mask);
}

function ipv4ToInt(ip) {
  const parts = String(ip || "").split(".");
  if (parts.length !== 4) return null;

  let result = 0;
  for (const part of parts) {
    if (!/^\d+$/.test(part)) return null;
    const value = Number(part);
    if (value < 0 || value > 255) return null;
    result = (result << 8) + value;
  }
  return result >>> 0;
}

module.exports = {
  requireApiKey,
  getClientIp,
  isIpAllowed,
  ipMatchesRule,
  parsePerKeyWhitelist,
  parseRuleList,
};
