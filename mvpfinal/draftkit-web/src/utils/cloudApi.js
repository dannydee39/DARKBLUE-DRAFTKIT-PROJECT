import { DRAFTKIT_API_BASE } from "../constants.js";

async function parseResponse(response) {
  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const message =
      payload?.message ||
      payload?.error ||
      (typeof payload === "string" ? payload : "Request failed.");
    throw new Error(message);
  }

  return payload;
}

export async function cloudRequest(path, options = {}) {
  const response = await fetch(`${DRAFTKIT_API_BASE}${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    ...options,
  });

  return parseResponse(response);
}

export function getCurrentUser() {
  return cloudRequest("/v1/auth/me", { method: "GET" });
}

export function signup(payload) {
  return cloudRequest("/v1/auth/signup", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function login(payload) {
  return cloudRequest("/v1/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function logout() {
  return cloudRequest("/v1/auth/logout", { method: "POST" });
}

export function listCloudDrafts() {
  return cloudRequest("/v1/drafts", { method: "GET" });
}

export function createCloudDraft(draft) {
  return cloudRequest("/v1/drafts", {
    method: "POST",
    body: JSON.stringify({ draft }),
  });
}

export function updateCloudDraft(draft) {
  return cloudRequest(`/v1/drafts/${draft.id}`, {
    method: "PUT",
    body: JSON.stringify({ draft }),
  });
}

export function markCloudDraftOpened(draftId) {
  return cloudRequest(`/v1/drafts/${draftId}/open`, {
    method: "POST",
  });
}

export function deleteCloudDraft(draftId) {
  return cloudRequest(`/v1/drafts/${draftId}`, {
    method: "DELETE",
  });
}
