import { useEffect, useRef, useState } from "react";
import { scenes } from "../map/campus-data";
import type { SceneId } from "../map/campus-data";
import type { Annotation } from "../../vendor/pathfinder/types";
import { renderAnnotations } from "../../vendor/pathfinder/render";
import { commentNumbers } from "../../vendor/pathfinder/export-json";
import { draftKey, parseFloorDocument } from "../../lib/floorplan";

/** The same normalized Pathfinder layer on the interactive scene, without intercepting navigation. */
export function FloorplanOverlay({ sceneId }: { sceneId: SceneId }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const crop = scenes[sceneId].crop;
  useEffect(() => {
    const load = () => {
      try {
        const raw = localStorage.getItem(draftKey(sceneId));
        setAnnotations(raw ? parseFloorDocument(raw, sceneId) : []);
      } catch {
        setAnnotations([]);
      }
    };
    load();
    window.addEventListener("storage", load);
    window.addEventListener("radar-floorplan-change", load);
    return () => {
      window.removeEventListener("storage", load);
      window.removeEventListener("radar-floorplan-change", load);
    };
  }, [sceneId]);
  useEffect(() => {
    const ctx = canvas.current?.getContext("2d");
    if (ctx)
      renderAnnotations(
        ctx,
        annotations,
        1,
        crop,
        commentNumbers(annotations),
        null,
      );
  }, [annotations, crop]);
  return (
    <g
      pointerEvents="none"
      data-floorplan-annotations={annotations.length}
      aria-label={`${annotations.length} saved floorplan annotations`}
    >
      <title>
        Device-only floorplan notes, not verified evacuation guidance
      </title>
      <foreignObject
        x={crop.x}
        y={crop.y}
        width={crop.width}
        height={crop.height}
      >
        <canvas
          ref={canvas}
          width={crop.width}
          height={crop.height}
          style={{ width: "100%", height: "100%", pointerEvents: "none" }}
          aria-hidden="true"
        />
      </foreignObject>
    </g>
  );
}
