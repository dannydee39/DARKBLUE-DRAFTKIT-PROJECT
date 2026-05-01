const express = require("express");
const {
  createDraftNoteForUser,
  deleteDraftForUser,
  deleteDraftNoteForUser,
  findDraftForUser,
  findDraftNoteForUser,
  listDraftNotesForUser,
  listDraftsForUser,
  touchDraftOpened,
  upsertDraftForUser,
} = require("../lib/db");
const { attachSessionUser, requireSession } = require("../middleware/session");

const router = express.Router();
const noteClientsByDraft = new Map();

router.use(attachSessionUser);
router.use(requireSession);

function noteClientKey(userId, draftId) {
  // Draft-note streams are per user and per draft so one league's notes never
  // leak into another signed-in user's board.
  return `${userId}:${draftId}`;
}

function sendSse(res, event, payload) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function broadcastDraftNote(userId, draftId, event, payload) {
  const clients = noteClientsByDraft.get(noteClientKey(userId, draftId));
  if (!clients) return;
  for (const client of clients) {
    sendSse(client, event, payload);
  }
}

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

router.get("/:id/notes", (req, res) => {
  const limit = req.query.limit || 25;
  const notes = listDraftNotesForUser(req.session.userId, req.params.id, { limit });
  if (!notes) {
    return res.status(404).json({
      error: "Not Found",
      message: "Draft not found.",
    });
  }

  res.json({
    count: notes.length,
    updates: notes,
    notes,
  });
});

router.post("/:id/notes", (req, res) => {
  try {
    const note = createDraftNoteForUser(
      req.session.userId,
      req.params.id,
      req.body && typeof req.body === "object" ? req.body : {},
    );
    if (!note) {
      return res.status(404).json({
        error: "Not Found",
        message: "Draft not found.",
      });
    }

    const notes = listDraftNotesForUser(req.session.userId, req.params.id, {
      limit: req.query.limit || 25,
    });
    broadcastDraftNote(req.session.userId, req.params.id, "draft-note", {
      update: note,
      note,
    });

    return res.status(201).json({
      ok: true,
      update: note,
      note,
      updates: notes,
      notes,
    });
  } catch (error) {
    if (error.statusCode === 400) {
      return res.status(400).json({
        error: "Bad Request",
        message: error.message,
      });
    }
    throw error;
  }
});

router.get("/:id/notes/stream", (req, res) => {
  const draft = findDraftForUser(req.session.userId, req.params.id);
  if (!draft) {
    return res.status(404).json({
      error: "Not Found",
      message: "Draft not found.",
    });
  }

  const key = noteClientKey(req.session.userId, req.params.id);
  const clients = noteClientsByDraft.get(key) || new Set();
  clients.add(res);
  noteClientsByDraft.set(key, clients);

  // Server-sent events are enough here: the browser only needs one-way live
  // delivery when another tab publishes or removes a commissioner note.
  res.status(200);
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();

  const notes = listDraftNotesForUser(req.session.userId, req.params.id, {
    limit: req.query.limit || 25,
  });
  sendSse(res, "snapshot", { updates: notes, notes });

  req.on("close", () => {
    clients.delete(res);
    if (clients.size === 0) {
      noteClientsByDraft.delete(key);
    }
  });
  return undefined;
});

router.delete("/:id/notes/:noteId", (req, res) => {
  const draft = findDraftForUser(req.session.userId, req.params.id);
  if (!draft) {
    return res.status(404).json({
      error: "Not Found",
      message: "Draft not found.",
    });
  }

  const note = findDraftNoteForUser(
    req.session.userId,
    req.params.id,
    req.params.noteId,
  );
  if (!note) {
    return res.status(404).json({
      error: "Not Found",
      message: "Draft note not found.",
    });
  }

  const removed = deleteDraftNoteForUser(
    req.session.userId,
    req.params.id,
    req.params.noteId,
  );
  if (!removed) {
    return res.status(404).json({
      error: "Not Found",
      message: "Draft note not found.",
    });
  }

  broadcastDraftNote(req.session.userId, req.params.id, "draft-note-delete", {
    id: req.params.noteId,
    update: note,
    note,
  });
  return res.json({ ok: true });
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
