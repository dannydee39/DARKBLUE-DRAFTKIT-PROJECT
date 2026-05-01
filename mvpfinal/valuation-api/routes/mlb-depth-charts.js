const express = require("express");
const { requireApiKey } = require("../middleware/auth");
const { getMlbDepthCharts } = require("../services/mlbDepthCharts");

const router = express.Router();

router.get("/depth-charts", requireApiKey, async (req, res) => {
  const forceRefresh = req.query.refresh === "1" || req.query.refresh === "true";
  const payload = await getMlbDepthCharts({ forceRefresh });
  res.json(payload);
});

module.exports = router;
