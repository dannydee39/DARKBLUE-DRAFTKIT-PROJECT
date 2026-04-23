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
 * @param {string} props.name - Player's full name
 * @param {number} [props.size=52] - Diameter in pixels
 * @param {string|null} [props.photoUrl] - URL to player headshot image
 * @returns {JSX.Element}
 */
export default function PlayerAvatar({ name, size = 52, photoUrl = null }) {
  const [imgError, setImgError] = useState(false);
  const isBlankAvatar = photoUrl === "__blank__";

  const initials = name
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const colorIndex =
    name
      .split("")
      .reduce((acc, char) => acc + char.charCodeAt(0), 0) %
    AVATAR_PALETTE.length;
  const avatarColor = AVATAR_PALETTE[colorIndex];

  const containerStyle = {
    width: size,
    height: size,
    flexShrink: 0,
    borderRadius: "50%",
    overflow: "hidden",
    border: `2px solid ${avatarColor}55`,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: `${avatarColor}18`,
  };

  if (isBlankAvatar) {
    return (
      <div
        className="player-avatar player-avatar-blank"
        aria-hidden="true"
        style={{
          ...containerStyle,
          border: "1px solid rgba(148, 163, 184, 0.3)",
          background:
            "radial-gradient(circle at 50% 32%, rgba(255,255,255,0.12) 0 22%, transparent 23%), linear-gradient(180deg, rgba(71,85,105,0.34) 0%, rgba(30,41,59,0.48) 100%)",
        }}
      />
    );
  }

  if (photoUrl && !imgError) {
    return (
      <div className="player-avatar" style={containerStyle}>
        <img
          src={photoUrl}
          alt={name}
          width={size}
          height={size}
          style={{ objectFit: "cover", width: "100%", height: "100%" }}
          onError={() => setImgError(true)}
        />
      </div>
    );
  }

  return (
    <div
      className="player-avatar"
      style={{
        ...containerStyle,
        color: avatarColor,
        fontSize: size * 0.34,
        fontWeight: 800,
        letterSpacing: "-0.02em",
      }}
    >
      {initials}
    </div>
  );
}
