require("dotenv").config();

const cors = require("cors");
const express = require("express");
const rateLimit = require("express-rate-limit");

const authRouter = require("./routes/auth");
const draftsRouter = require("./routes/drafts");
const valuationProxyRouter = require("./routes/valuation-proxy");
const { deleteExpiredSessions } = require("./lib/db");

function createApp(options = {}) {
  const app = express();
  const NODE_ENV = options.nodeEnv || process.env.NODE_ENV || "development";
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || "http://localhost:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  const rateLimitWindowMs = Number(
    options.rateLimitWindowMs ?? process.env.RATE_LIMIT_WINDOW_MS ?? 60 * 1000,
  );
  const rateLimitMax = Number(
    options.rateLimitMax ?? process.env.RATE_LIMIT_MAX ?? 120,
  );
  const sessionCleanupMs = Number(
    process.env.SESSION_CLEANUP_MS || 15 * 60 * 1000,
  );

  setInterval(() => {
    try {
      deleteExpiredSessions();
    } catch (error) {
      console.error("Session cleanup failed:", error.message);
    }
  }, sessionCleanupMs).unref();

  app.use(
    cors({
      origin: (origin, callback) => {
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin) || NODE_ENV === "development") {
          return callback(null, true);
        }
        return callback(new Error("Not allowed by CORS policy"));
      },
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
      allowedHeaders: ["Content-Type"],
    }),
  );

  app.use(
    rateLimit({
      windowMs: rateLimitWindowMs,
      max: rateLimitMax,
      standardHeaders: true,
      legacyHeaders: false,
      message: {
        error: "Too Many Requests",
        message: "Draft Kit API rate limit exceeded. Please retry shortly.",
      },
    }),
  );

  app.use(express.json({ limit: "1mb" }));

  app.use("/v1/auth", authRouter);
  app.use("/v1/drafts", draftsRouter);
  app.use("/v1", valuationProxyRouter);

  app.get("/health", async (_req, res) => {
    const valuationBase =
      (process.env.VALUATION_API_BASE || "http://localhost:3001").replace(/\/+$/, "");

    let dependencyStatus = "unknown";
    let dependencyCode = null;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      const response = await fetch(`${valuationBase}/health`, {
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      dependencyStatus = response.ok ? "online" : "offline";
      dependencyCode = response.status;
    } catch {
      dependencyStatus = "offline";
    }

    const degraded = dependencyStatus === "offline";
    res.status(degraded ? 503 : 200).json({
      status: degraded ? "degraded" : "online",
      service: "DB Draft Kit API",
      product: "DB Draft Kit",
      version: "1.0.0",
      timestamp: new Date().toISOString(),
      environment: NODE_ENV,
      dependencies: {
        valuation: {
          product: "Dark Blue MLB Valuation API",
          base_url: valuationBase,
          status: dependencyStatus,
          status_code: dependencyCode,
        },
      },
    });
  });

  app.get("/", (_req, res) => {
    res.json({
      product: "DB Draft Kit",
      service: "DB Draft Kit API",
      description:
        "Backend for Draft Kit accounts, cloud draft persistence, and server-side valuation proxying.",
      docs: {
        auth: "/v1/auth/*",
        drafts: "/v1/drafts",
        valuation_proxy: ["/v1/players", "/v1/valuate"],
      },
    });
  });

  app.use((req, res) => {
    res.status(404).json({
      error: "Not Found",
      message: `Route ${req.method} ${req.path} not found.`,
    });
  });

  app.use((err, _req, res, _next) => {
    console.error(err.stack);
    res.status(500).json({
      error: "Internal Server Error",
      message:
        NODE_ENV === "development"
          ? err.message
          : "An unexpected Draft Kit API error occurred.",
    });
  });

  return app;
}

const app = createApp();

if (require.main === module) {
  const PORT = process.env.PORT || 3002;
  const NODE_ENV = process.env.NODE_ENV || "development";
  app.listen(PORT, () => {
    console.log(`\n🟢 DB Draft Kit API`);
    console.log(`   Port:        ${PORT}`);
    console.log(`   Environment: ${NODE_ENV}`);
    console.log(`   Health:      http://localhost:${PORT}/health`);
    console.log(`   Auth:        http://localhost:${PORT}/v1/auth`);
    console.log(`   Drafts:      http://localhost:${PORT}/v1/drafts`);
    console.log(`   Proxy:       http://localhost:${PORT}/v1/players, /v1/valuate`);
    console.log(
      `   Valuation:   ${(process.env.VALUATION_API_BASE || "http://localhost:3001").replace(/\/+$/, "")}`,
    );
  });
}

module.exports = app;
module.exports.createApp = createApp;
