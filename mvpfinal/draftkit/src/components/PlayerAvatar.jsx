// ─────────────────────────────────────────────────────────────────────────────
// components/PlayerAvatar.jsx
//
// Renders a player's avatar — either a real headshot photo or a colored
// initials circle as a fallback.
//
// ── ADDING REAL PLAYER PHOTOS ─────────────────────────────────────────────────
// To add a real photo for a player:
//
//   1. In mvpfinal/api/data/players.json, set the "photoUrl" field for that
//      player. Example:
//        { "name": "Shohei Ohtani", "photoUrl": "https://your-cdn.com/ohtani.jpg", ... }
//
//   2. The PlayerAvatar component reads player.photoUrl automatically.
//      If it's a non-null string, it renders an <img> tag.
//      If the image fails to load, it automatically falls back to initials.
//
//   3. MLB official headshot URL format (requires MLB player ID):
//      https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_213,q_auto:best/v1/people/{MLB_PLAYER_ID}/headshot/67/current
//
//   4. Alternative: use a CDN or static /public folder in the draftkit app.
//      Example: "/headshots/shohei-ohtani.jpg" (place files in draftkit/public/headshots/)
//
// ── BULK PHOTO LOADING ────────────────────────────────────────────────────────
//   To add photos for all players at once, edit generate-players.js to:
//   1. Read a mapping file: { "Shohei Ohtani": "https://...", ... }
//   2. Set photoUrl on each generated player object
//   3. Re-run: node mvpfinal/api/scripts/generate-players.js
// ─────────────────────────────────────────────────────────────────────────────

import { useState } from "react";
import { AVATAR_PALETTE } from "../constants.js";

/**
 * PlayerAvatar
 *
 * Displays a player's avatar. Uses photoUrl if available, falls back to a
 * colored initials circle. The avatar color is deterministically derived from
 * the player's name so it's always consistent.
 *
 * @param {Object} props
 * @param {string}      props.name     - Player's full name (used for initials + color hash)
 * @param {number}      [props.size=52]- Diameter in pixels
 * @param {string|null} [props.photoUrl]- URL to player headshot image (or null for initials)
 * @returns {JSX.Element}
 */
export default function PlayerAvatar({ name, size = 52, photoUrl = null }) {
  // Track whether the photo failed to load so we can fall back to initials
  const [imgError, setImgError] = useState(false);

  // ── Compute initials ──────────────────────────────────────────────────────
  // Take the first letter of each word in the player's name, max 2 characters.
  // e.g. "Shohei Ohtani" → "SO", "Juan Soto" → "JS"
  const initials = name
    .split(" ")
    .filter(Boolean)
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  // ── Pick a consistent avatar color based on the name ─────────────────────
  // We hash the character codes of the name to pick a color from AVATAR_PALETTE.
  // Same name always gets the same color — no randomness.
  const colorIndex = name
    .split("")
    .reduce((acc, char) => acc + char.charCodeAt(0), 0) % AVATAR_PALETTE.length;
  const avatarColor = AVATAR_PALETTE[colorIndex];

  // ── Shared container styles ───────────────────────────────────────────────
  // The outer div maintains the circular shape regardless of content.
  const containerStyle = {
    width: size,
    height: size,
    flexShrink: 0,
    borderRadius: "50%",
    overflow: "hidden",           // clips the image to a circle
    border: `2px solid ${avatarColor}55`, // semi-transparent border using avatar color
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: `${avatarColor}18`, // very subtle tinted background
  };

  // ── Render: photo mode ────────────────────────────────────────────────────
  // If we have a photoUrl AND the img hasn't errored, show the photo.
  // The onError handler switches imgError to true, triggering the initials fallback.
  //
  // ▶ TO ENABLE REAL PHOTOS: set photoUrl on player objects in players.json
  //   The UI handles everything else automatically.
  if (photoUrl && !imgError) {
    return (
      <div className="player-avatar" style={containerStyle}>
        <img
          src={photoUrl}
          alt={name}
          width={size}
          height={size}
          style={{ objectFit: "cover", width: "100%", height: "100%" }}
          onError={() => setImgError(true)} // fallback to initials if photo fails
        />
      </div>
    );
  }

  // ── Render: initials mode (default) ──────────────────────────────────────
  // Shows a colored circle with the player's initials.
  return (
    <div
      className="player-avatar"
      style={{
        ...containerStyle,
        color: avatarColor,
        fontSize: size * 0.34, // scale font proportionally to circle size
        fontWeight: 800,
        letterSpacing: "-0.02em",
      }}
    >
      {initials}
    </div>
  );
}
