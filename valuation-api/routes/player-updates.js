const express = require("express");
const { requireApiKey } = require("../middleware/auth");
const {
  createPlayerUpdate,
  listPlayerUpdates,
  subscribeToPlayerUpdates,
} = require("../services/playerUpdates");

const router = express.Router();

router.get("/", requireApiKey, (req, res) => {
  const { limit, since } = req.query;
  const updates = listPlayerUpdates({ limit, since });

  res.json({
    count: updates.length,
    sort: "created_at desc",
    updates,
  });
});

router.get("/stream", requireApiKey, (req, res) => {
  const { limit, since } = req.query;
  const snapshot = listPlayerUpdates({ limit, since });

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();
  res.write("retry: 5000\n\n");
  res.write(`event: snapshot\ndata: ${JSON.stringify({ updates: snapshot })}\n\n`);

  const unsubscribe = subscribeToPlayerUpdates((update) => {
    res.write(`event: player-update\ndata: ${JSON.stringify({ update })}\n\n`);
  });

  const heartbeatId = setInterval(() => {
    res.write(": keepalive\n\n");
  }, 15000);

  req.on("close", () => {
    clearInterval(heartbeatId);
    unsubscribe();
    res.end();
  });
});

router.post("/", requireApiKey, (req, res) => {
  try {
    const update = createPlayerUpdate(req.body || {});
    const updates = listPlayerUpdates({ limit: 10 });

    res.status(201).json({
      update,
      updates,
    });
  } catch (error) {
    res.status(error.status || 400).json({
      error: "Bad Request",
      code: error.code || "INVALID_PLAYER_UPDATE",
      message: error.message || "Could not create player update.",
    });
  }
});

module.exports = router;
