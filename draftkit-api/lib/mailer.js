const nodemailer = require("nodemailer");

function getResetBaseUrl() {
  const explicit = String(process.env.PASSWORD_RESET_BASE_URL || "").trim();
  if (explicit) return explicit.replace(/\/+$/, "");

  const firstOrigin = String(process.env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((origin) => origin.trim())
    .find(Boolean);
  return (firstOrigin || "http://localhost:5173").replace(/\/+$/, "");
}

function buildPasswordResetUrl(token) {
  const url = new URL(getResetBaseUrl());
  url.searchParams.set("resetToken", token);
  return url.toString();
}

function mailerIsConfigured() {
  if (process.env.MAIL_TRANSPORT === "json") return true;
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_FROM);
}

function createTransport() {
  if (process.env.MAIL_TRANSPORT === "json") {
    return nodemailer.createTransport({ jsonTransport: true });
  }

  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 587),
    secure: String(process.env.SMTP_SECURE || "").toLowerCase() === "true",
    auth:
      process.env.SMTP_USER || process.env.SMTP_PASS
        ? {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
          }
        : undefined,
  });
}

async function sendPasswordResetEmail({ to, displayName, resetUrl }) {
  if (!mailerIsConfigured()) {
    const error = new Error("Password reset email is not configured.");
    error.code = "MAIL_NOT_CONFIGURED";
    throw error;
  }

  const from = process.env.SMTP_FROM || "Draft Kit <no-reply@anythingavenue.com>";
  const name = displayName || "Draft Kit user";
  const transport = createTransport();

  return transport.sendMail({
    from,
    to,
    subject: "Reset your Draft Kit password",
    text: [
      `Hi ${name},`,
      "",
      "Use the link below to reset your Draft Kit password. This link expires soon and can only be used once.",
      "",
      resetUrl,
      "",
      "If you did not request this reset, you can ignore this email.",
    ].join("\n"),
    html: [
      `<p>Hi ${escapeHtml(name)},</p>`,
      "<p>Use the link below to reset your Draft Kit password. This link expires soon and can only be used once.</p>",
      `<p><a href="${escapeHtml(resetUrl)}">Reset your password</a></p>`,
      "<p>If you did not request this reset, you can ignore this email.</p>",
    ].join(""),
  });
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

module.exports = {
  buildPasswordResetUrl,
  mailerIsConfigured,
  sendPasswordResetEmail,
};
