// server.js — Dark Blue Valuation API
// Standalone headless REST service. Deploy to VPS separately from Draft Kit.
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");

const valuateRouter = require("./routes/valuate");
const playersRouter = require("./routes/players");

const app = express();
const PORT = process.env.PORT || 3001;
const NODE_ENV = process.env.NODE_ENV || "development";

// ── CORS ─────────────────────────────────────────────────────────────────────
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "http://localhost:5173")
  .split(",")
  .map((o) => o.trim());

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. curl, Postman, server-to-server)
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin) || NODE_ENV === "development") {
        return callback(null, true);
      }
      callback(new Error("Not allowed by CORS policy"));
    },
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "X-License-Key"],
  })
);

// ── RATE LIMITING ─────────────────────────────────────────────────────────────
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 120,            // 120 requests per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too Many Requests", message: "Rate limit exceeded. Please wait 60 seconds." },
});
app.use(limiter);

// ── BODY PARSING ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: "1mb" }));

// ── ROUTES ────────────────────────────────────────────────────────────────────
app.use("/v1/valuate", valuateRouter);
app.use("/v1/players", playersRouter);

// Health check (no auth required)
app.get("/health", (req, res) => {
  res.json({
    status: "online",
    service: "Dark Blue Valuation API",
    version: "1.0.0",
    timestamp: new Date().toISOString(),
    environment: NODE_ENV,
  });
});

// API info / landing (no auth required)
app.get("/", (req, res) => {
  res.json({
    name: "Dark Blue Valuation API",
    version: "1.0.0",
    description: "Dynamic player valuation engine for fantasy baseball auction drafts.",
    endpoints: {
      health: "GET /health",
      valuate: "POST /v1/valuate  [requires X-License-Key]",
      players: "GET /v1/players   [requires X-License-Key]",
    },
    docs: "https://api.darkblue.io/docs",
    register: "https://api.darkblue.io/register",
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: "Not Found",
    message: `Route ${req.method} ${req.path} not found.`,
  });
});

// Global error handler
app.use((err, req, res, _next) => {
  console.error(err.stack);
  res.status(500).json({
    error: "Internal Server Error",
    message: NODE_ENV === "development" ? err.message : "An unexpected error occurred.",
  });
});

// ── START ──────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🟢 Dark Blue Valuation API`);
  console.log(`   Port:        ${PORT}`);
  console.log(`   Environment: ${NODE_ENV}`);
  console.log(`   Health:      http://localhost:${PORT}/health`);
  console.log(`   Valuate:     POST http://localhost:${PORT}/v1/valuate`);
  console.log(`   Players:     GET  http://localhost:${PORT}/v1/players`);
  console.log(
    `\n   API Keys:    ${(process.env.API_KEYS || "DB-2026-DEMO-0001").split(",").length} key(s) active`
  );
  console.log(`\n   Deploy to VPS: set PORT, API_KEYS, ALLOWED_ORIGINS in .env\n`);
});

module.exports = app;
