const express = require("express");
const {
  deleteDraftForUser,
  findDraftForUser,
  listDraftsForUser,
  touchDraftOpened,
  upsertDraftForUser,
} = require("../lib/db");
const { attachSessionUser, requireSession } = require("../middleware/session");

const router = express.Router();

router.use(attachSessionUser);
router.use(requireSession);

router.get("/", (req, res) => {
  const drafts = listDraftsForUser(req.session.userId);
  res.json({
    count: drafts.length,
    drafts,
  });
});

router.post("/", (req, res) => {
  const draft = req.body?.draft;
  if (!draft || !draft.id || !draft.league) {
    return res.status(400).json({
      error: "Bad Request",
      message: "A complete draft payload is required.",
    });
  }

  const saved = upsertDraftForUser(req.session.userId, {
    ...draft,
    source: "cloud",
  });

  res.status(201).json({
    ok: true,
    draft: saved,
  });
});

router.put("/:id", (req, res) => {
  const draft = req.body?.draft;
  const draftId = String(req.params.id || "");
  if (!draft || !draftId || draft.id !== draftId) {
    return res.status(400).json({
      error: "Bad Request",
      message: "Draft id mismatch.",
    });
  }

  const saved = upsertDraftForUser(req.session.userId, {
    ...draft,
    source: "cloud",
  });

  res.json({
    ok: true,
    draft: saved,
  });
});

router.post("/:id/open", (req, res) => {
  const updated = touchDraftOpened(req.session.userId, req.params.id);
  if (!updated) {
    return res.status(404).json({
      error: "Not Found",
      message: "Draft not found.",
    });
  }

  res.json({
    ok: true,
    draft: updated,
  });
});

router.delete("/:id", (req, res) => {
  const removed = deleteDraftForUser(req.session.userId, req.params.id);
  if (!removed) {
    return res.status(404).json({
      error: "Not Found",
      message: "Draft not found.",
    });
  }

  res.json({ ok: true });
});

module.exports = router;
