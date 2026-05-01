const express = require("express");
const { Readable } = require("stream");

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
  const { timeoutMs = UPSTREAM_TIMEOUT_MS, ...fetchOptions } = options;
  const controller = new AbortController();
  const timeoutId =
    Number.isFinite(timeoutMs) && timeoutMs > 0
      ? setTimeout(() => controller.abort(), timeoutMs)
      : null;
  const headers = {
    "X-License-Key": VALUATION_API_KEY,
    ...(fetchOptions.headers || {}),
  };

  if (fetchOptions.body != null && !headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  try {
    return await fetch(`${VALUATION_API_BASE}${path}`, {
      ...fetchOptions,
      signal: controller.signal,
      headers,
    });
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
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

router.get("/player-updates", async (req, res) => {
  const queryString = req.originalUrl.includes("?")
    ? req.originalUrl.slice(req.originalUrl.indexOf("?"))
    : "";

  try {
    const response = await fetchUpstream(`/v1/player-updates${queryString}`, {
      method: "GET",
    });
    const payload = await readPayload(response);
    return respond(res, response.status, payload);
  } catch (error) {
    return res.status(502).json({
      error: "Bad Gateway",
      message:
        error?.name === "AbortError"
          ? "Valuation service timed out while loading player updates."
          : "Could not reach the valuation service.",
    });
  }
});

router.get("/mlb/depth-charts", async (req, res) => {
  const queryString = req.originalUrl.includes("?")
    ? req.originalUrl.slice(req.originalUrl.indexOf("?"))
    : "";

  try {
    const response = await fetchUpstream(`/v1/mlb/depth-charts${queryString}`, {
      method: "GET",
      timeoutMs: Number(process.env.MLB_DEPTH_PROXY_TIMEOUT_MS || 10000),
    });
    const payload = await readPayload(response);
    return respond(res, response.status, payload);
  } catch (error) {
    return res.status(502).json({
      error: "Bad Gateway",
      message:
        error?.name === "AbortError"
          ? "Valuation service timed out while loading MLB depth charts."
          : "Could not reach the valuation service.",
    });
  }
});

router.get("/player-updates/stream", async (req, res) => {
  const queryString = req.originalUrl.includes("?")
    ? req.originalUrl.slice(req.originalUrl.indexOf("?"))
    : "";

  try {
    const response = await fetchUpstream(`/v1/player-updates/stream${queryString}`, {
      method: "GET",
      headers: { Accept: "text/event-stream" },
      timeoutMs: 0,
    });

    if (!response.ok || !response.body) {
      const payload = await readPayload(response);
      return respond(res, response.status, payload);
    }

    res.status(response.status);
    res.setHeader(
      "Content-Type",
      response.headers.get("content-type") || "text/event-stream",
    );
    res.setHeader(
      "Cache-Control",
      response.headers.get("cache-control") || "no-cache, no-transform",
    );
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders?.();

    const stream = Readable.fromWeb(response.body);
    req.on("close", () => stream.destroy());
    stream.on("error", () => {
      if (!res.writableEnded) res.end();
    });
    stream.pipe(res);
    return undefined;
  } catch (error) {
    return res.status(502).json({
      error: "Bad Gateway",
      message:
        error?.name === "AbortError"
          ? "Valuation service timed out while opening the player update stream."
          : "Could not reach the valuation service.",
    });
  }
});

router.post("/player-updates", async (req, res) => {
  try {
    const payload =
      req.body && typeof req.body === "object" ? { ...req.body } : {};
    const response = await fetchUpstream("/v1/player-updates", {
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
          ? "Valuation service timed out while publishing a player update."
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
