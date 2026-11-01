import { memo, useEffect, useId, useRef, useState } from "react";
import "./campus-breeze.css";

// Small patches of the supplied canopy artwork move inside fixed leaf outlines.
// The map, labels and tree trunks stay still; no replacement map image is needed.
const crowns = [
  [879, 487, 20, 19], [925, 567, 26, 21], [457, 706, 25, 18],
  [525, 716, 23, 16], [586, 718, 21, 16], [651, 718, 23, 16],
  [799, 679, 22, 19], [932, 711, 22, 24], [1092, 596, 18, 20],
  [832, 1068, 24, 18], [512, 976, 24, 19], [353, 997, 24, 20],
];
const grasses = [
  [446, 480], [477, 510], [565, 469], [602, 509], [659, 501], [747, 485],
  [791, 515], [836, 543], [779, 598], [825, 616], [858, 640], [947, 648],
  [464, 646], [467, 578], [568, 703], [679, 713], [1101, 690],
  [1080, 472], [307, 729], [240, 731], [345, 797], [609, 793],
  [203, 1039], [225, 975], [347, 1083], [478, 1081], [559, 1024],
  [576, 977], [793, 985], [792, 1040], [964, 1081], [1045, 1039],
];

export const CampusBreeze = memo(function CampusBreeze({ paused }: { paused: boolean }) {
  const id = useId().replaceAll(":", "");
  const layer = useRef<SVGGElement>(null);
  const [visible, setVisible] = useState(false);
  const [pageVisible, setPageVisible] = useState(true);
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting));
    if (layer.current) observer.observe(layer.current);
    const updateVisibility = () => setPageVisible(!document.hidden);
    updateVisibility();
    document.addEventListener("visibilitychange", updateVisibility);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", updateVisibility);
    };
  }, []);

  return (
    <g
      ref={layer}
      className="campus-breeze"
      data-active={visible && pageVisible && !paused}
      pointerEvents="none"
      aria-hidden="true"
    >
      {crowns.map(([x, y, rx, ry], index) => (
        <svg
          key={`tree-${index}`}
          x={x - rx}
          y={y - ry}
          width={rx * 2}
          height={ry * 2}
          viewBox={`0 0 ${rx * 2} ${ry * 2}`}
          overflow="hidden"
        >
          <defs>
            <clipPath id={`${id}-crown-${index}`}>
              <ellipse cx={rx} cy={ry} rx={rx} ry={ry} />
            </clipPath>
          </defs>
          <g clipPath={`url(#${id}-crown-${index})`}>
            <g
              className="campus-tree-sway"
              style={{
                transformOrigin: `${rx}px ${ry * 2}px`,
                animationDelay: `${-index * 0.63}s`,
                animationDuration: `${4.2 + (index % 3) * 0.6}s`,
              }}
            >
              <image
                href="/maps/campus.jpg"
                x={rx - x}
                y={ry - y}
                width={1254}
                height={1254}
                style={{ imageRendering: "pixelated" }}
              />
            </g>
          </g>
        </svg>
      ))}
      {grasses.map(([x, y], index) => (
        <g key={`grass-${index}`} transform={`translate(${x},${y})`}>
          <g
            className="campus-grass-sway"
            style={{ animationDelay: `${-index * 0.37}s` }}
            shapeRendering="crispEdges"
          >
            <path d="M-2 0h-2v-3h-2v-4h2v3h2zm3 0H0v-8h2v-3h2v5H2zm3 0H3v-3h2v-3h3v2H6v3H4z" fill="#4eaa47" />
            <path d="M-2-1h1v-4h-2v-3h-1v4h2zm3 0h1v-4h2v-4H3v3H1z" fill="#a5cf50" />
          </g>
        </g>
      ))}
    </g>
  );
});
