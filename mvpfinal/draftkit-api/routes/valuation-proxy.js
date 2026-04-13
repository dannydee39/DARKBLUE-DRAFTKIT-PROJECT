const express = require("express");

const router = express.Router();

const VALUATION_API_BASE = (
  process.env.VALUATION_API_BASE || "http://localhost:3001"
).replace(/\/+$/, "");
const VALUATION_API_KEY = (
  process.env.VALUATION_API_KEY || "DB-2026-DEMO-0001"
).trim();
const UPSTREAM_TIMEOUT_MS = Number(process.env.VALUATION_PROXY_TIMEOUT_MS || 7000);

async function readPayload(response) {
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return response.json();
  }
  return response.text();
}

function respond(res, status, payload) {
  if (typeof payload === "string") {
    return res.status(status).send(payload);
  }
  return res.status(status).json(payload);
}

async function fetchUpstream(path, options = {}) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);
  const headers = {
    "X-License-Key": VALUATION_API_KEY,
    ...(options.headers || {}),
  };

  if (options.body != null && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  try {
    return await fetch(`${VALUATION_API_BASE}${path}`, {
      ...options,
      signal: controller.signal,
      headers,
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

router.get("/players", async (req, res) => {
  const queryString = req.originalUrl.includes("?")
    ? req.originalUrl.slice(req.originalUrl.indexOf("?"))
    : "";

  try {
    const response = await fetchUpstream(`/v1/players${queryString}`, { method: "GET" });
    const payload = await readPayload(response);
    return respond(res, response.status, payload);
  } catch (error) {
    return res.status(502).json({
      error: "Bad Gateway",
      message:
        error?.name === "AbortError"
          ? "Valuation service timed out while loading players."
          : "Could not reach the valuation service.",
    });
  }
});

router.post("/valuate", async (req, res) => {
  try {
    const payload =
      req.body && typeof req.body === "object" ? { ...req.body } : {};
    const response = await fetchUpstream("/v1/valuate", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    const upstreamPayload = await readPayload(response);
    return respond(res, response.status, upstreamPayload);
  } catch (error) {
    return res.status(502).json({
      error: "Bad Gateway",
      message:
        error?.name === "AbortError"
          ? "Valuation service timed out while calculating a bid."
          : "Could not reach the valuation service.",
    });
  }
});

module.exports = router;
