import { useId } from "react";
import type { Point } from "./navigation";

export function RouteOverlay({ points }: { points: Point[] }) {
  const arrowId = useId();
  const arrows: { point: Point; angle: number }[] = [];
  for (let i = 1; i < points.length; i++) {
    const from = points[i - 1],
      to = points[i];
    const dx = to.x - from.x,
      dy = to.y - from.y,
      length = Math.hypot(dx, dy);
    for (let offset = 20; offset < length - 10; offset += 32) {
      arrows.push({
        point: {
          x: from.x + (dx * offset) / length,
          y: from.y + (dy * offset) / length,
        },
        angle: (Math.atan2(dy, dx) * 180) / Math.PI,
      });
    }
  }
  return (
    <g
      className="campus-route"
      data-route-arrows="true"
      aria-label="Walking route to selected destination"
      pointerEvents="none"
    >
      <defs>
        <marker
          id={arrowId}
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="4"
          markerHeight="4"
          orient="auto-start-reverse"
        >
          <path
            d="M1 1L9 5L1 9Z"
            fill="#ffe48a"
            stroke="#514077"
            strokeWidth="1"
          />
        </marker>
      </defs>
      <polyline
        points={points.map((point) => `${point.x},${point.y}`).join(" ")}
        fill="none"
        stroke="#574084"
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
        markerEnd={`url(#${arrowId})`}
      />
      {arrows.map((arrow, index) => (
        <path
          key={index}
          d="M-5-5L1 0L-5 5"
          transform={`translate(${arrow.point.x},${arrow.point.y}) rotate(${arrow.angle})`}
          fill="none"
          stroke="#ffe48a"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </g>
  );
}
