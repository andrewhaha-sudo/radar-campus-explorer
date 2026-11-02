import type { Character, Direction } from "../../lib/student-profile";
import { cn } from "../../lib/cn";
import { uniformColors } from "../../lib/map-identity";
import type { UniformColor } from "../../lib/map-identity";

export function StudentSprite({
  avatar,
  direction = "down",
  moving = false,
  color = "Green",
}: {
  avatar: Character;
  direction?: Direction;
  moving?: boolean;
  color?: UniformColor;
}) {
  const side = direction === "left" || direction === "right";
  const back = direction === "up";
  return (
    <g
      className={cn(
        "student-sprite",
        moving ? "sprite-walking" : "sprite-idle",
      )}
      data-avatar={avatar}
      data-direction={direction}
      data-color={color}
    >
      <ellipse cx="0" cy="-1" rx="8" ry="3" fill="#14182d" opacity=".25" />
      <g
        className="student-sprite-figure"
        shapeRendering="crispEdges"
        stroke="#28213d"
        strokeWidth="1"
      >
        <g transform={direction === "left" ? "scale(-1,1)" : undefined}>
          <path
            className="sprite-leg-a"
            d="M-6-8h5v7h-6v-3h1z"
            fill="#263b48"
          />
          <path className="sprite-leg-b" d="M1-8h5v7H1z" fill="#263b48" />
          {avatar === "girl" && (
            <path d="M-6-13H5L8-5H-8z" fill={uniformColors[color]} />
          )}
          <path
            d={side ? "M-5-18H4v10H-5z" : "M-7-18H7v10H-7z"}
            fill="#f8f5e8"
          />
          {side ? (
            <path d="M-8-18h4v11h-4z" fill={uniformColors[color]} />
          ) : back ? (
            <path
              d="M-6-18H6v11H-6zM-3-15H3v5H-3z"
              fill={uniformColors[color]}
            />
          ) : (
            <path
              d="M-5-18h2v8h-2zm8 0h2v8H3zM-1-17H1v7H-1z"
              fill={uniformColors[color]}
            />
          )}
          <path
            className="sprite-arm"
            d={side ? "M3-16H6v8H3z" : "M-10-16h3v8h-3zm17 0h3v8H7z"}
            fill="#f5bd84"
          />
          {avatar === "girl" && (
            <path
              d={side ? "M-9-27h4v14h-6v-7h2z" : "M7-27h4v14H7v-5H5v-7h2z"}
              fill="#65402e"
            />
          )}
          <path
            d={side ? "M-5-28H5v5h3v6H5v2H-6v-9h1z" : "M-6-28H5v3h3v9H-7v-9h1z"}
            fill="#f5bd84"
          />
          <path
            d={
              back
                ? "M-6-30H5v3h3v12H-8v-11h2z"
                : "M-7-29h4v-3h4v2h5v3h3v7H5v-5H1v3h-4v-3h-3v7h-3v-8h2z"
            }
            fill="#65402e"
          />
          <path d="M-5-28h4v-2H1v3H-2v2h-3z" fill="#a66a3c" stroke="none" />
          {!back && (
            <path
              d={side ? "M4-22h2v3H4z" : "M-4-22h2v3h-2zm6 0h2v3H2z"}
              fill="#28213d"
              stroke="none"
            />
          )}
          {avatar === "girl" && <path d="M6-27h4v2H6z" fill="#48a446" />}
        </g>
      </g>
    </g>
  );
}
export function CharacterPortrait({ avatar }: { avatar: Character }) {
  return (
    <svg
      viewBox={avatar === "boy" ? "0 0 768 1024" : "768 0 768 1024"}
      role="img"
      aria-label={`${avatar === "boy" ? "Boy" : "Girl"} student portrait`}
      preserveAspectRatio="xMidYMax meet"
    >
      <image href="/students/portraits.png" width="1536" height="1024" />
    </svg>
  );
}
