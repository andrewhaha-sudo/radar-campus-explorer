import { scenes } from "../components/map/campus-data.ts";
import type { SceneId } from "../components/map/campus-data.ts";
import type { Point, Rect } from "../components/map/navigation.ts";
import type { Annotation, AnnotationType } from "../vendor/pathfinder/types.ts";
import { DEFAULT_COLOR } from "../vendor/pathfinder/types.ts";
import { toNorm } from "../vendor/pathfinder/coords.ts";
import {
  buildExport,
  importEnvelope,
} from "../vendor/pathfinder/export-json.ts";

export const floorIds = Object.keys(scenes).filter(
  (id) => id !== "campus",
) as SceneId[];
export const draftKey = (id: SceneId) => `radar-pathfinder-floor-v1:${id}`;
export const MAX_ANNOTATIONS = 200;
export const MAX_IMPORT_BYTES = 1_000_000;
export function registrationFor(id: SceneId) {
  const scene = scenes[id];
  return {
    image: scene.image,
    imageWidth: scene.imageWidth,
    imageHeight: scene.imageHeight,
    crop: { ...scene.crop },
    artworkPieces: (scene.artworkPieces ?? []).map((piece) => ({
      source: { ...piece.source }, target: { ...piece.target },
    })),
  };
}
export function annotationAt(
  type: AnnotationType,
  point: Point,
  crop: Rect,
): Annotation {
  return {
    id: crypto.randomUUID(),
    page: 1,
    type,
    ...toNorm(point.x, point.y, 0, 0, crop),
    color: DEFAULT_COLOR,
    text: "",
    createdAt: new Date().toISOString(),
  };
}
export function createFloorDocument(id: SceneId, annotations: Annotation[]) {
  return {
    ...buildExport(
      `radar-floor-${id}`,
      scenes[id].name,
      annotations,
      new Date().toISOString(),
    ),
    radar: { version: 1, sceneId: id, registration: registrationFor(id) },
  };
}
const types = new Set([
  "circle",
  "rect",
  "arrow",
  "freehand",
  "comment",
  "correction",
  "aed",
  "stairs",
  "door",
  "overhead",
  "exit",
  "fireext",
]);
const object = (v: unknown): v is Record<string, unknown> =>
  v !== null && typeof v === "object" && !Array.isArray(v);
const unit = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v) && v >= 0 && v <= 1;
const invalid = (): never => {
  throw new Error(
    "Invalid floorplan JSON. Check annotation geometry, IDs and limits.",
  );
};
/** Validate completely before replacing a saved floor. Never infer a floor from its label. */
export function parseFloorDocument(raw: string, id: SceneId): Annotation[] {
  if (new TextEncoder().encode(raw).length > MAX_IMPORT_BYTES)
    throw new Error("Floorplan file is too large (maximum 1 MB).");
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error("The file is not valid JSON.");
  }
  if (!object(data) || !object(data.radar) || !object(data.document))
    return invalid();
  if (
    data.radar.version !== 1 ||
    data.radar.sceneId !== id ||
    data.document.id !== `radar-floor-${id}`
  )
    throw new Error(
      "This file belongs to a different floor or format. Select its original floor.",
    );
  if (
    JSON.stringify(data.radar.registration) !==
    JSON.stringify(registrationFor(id))
  )
    throw new Error(
      "The source drawing has changed. Re-register the annotations before importing.",
    );
  const pages = data.document.pages;
  if (!Array.isArray(pages) || pages.length > 1) return invalid();
  const ids = new Set<string>();
  let count = 0;
  for (const page of pages) {
    if (
      !object(page) ||
      page.pageNumber !== 1 ||
      !Array.isArray(page.annotations) ||
      page.annotations.length > MAX_ANNOTATIONS
    )
      return invalid();
    for (const a of page.annotations) {
      if (
        !object(a) ||
        typeof a.id !== "string" ||
        !a.id ||
        a.id.length > 128 ||
        ids.has(a.id) ||
        !types.has(String(a.type))
      )
        return invalid();
      ids.add(a.id);
      count++;
      if (
        !unit(a.x) ||
        !unit(a.y) ||
        typeof a.w !== "number" ||
        typeof a.h !== "number" ||
        !unit(a.x + a.w) ||
        !unit(a.y + a.h)
      )
        return invalid();
      if (typeof a.color !== "string" || !/^#[a-fA-F0-9]{6}$/.test(a.color))
        return invalid();
      for (const key of ["text", "createdAt", "createdBy"])
        if (
          a[key] !== undefined &&
          (typeof a[key] !== "string" || (a[key] as string).length > 2000)
        )
          return invalid();
      if (a.resolved !== undefined && typeof a.resolved !== "boolean")
        return invalid();
      if (
        a.images !== undefined &&
        (!Array.isArray(a.images) || a.images.length !== 0)
      )
        throw new Error(
          "Attached images are not supported in floorplan imports.",
        );
      if (
        a.points !== undefined &&
        (!Array.isArray(a.points) ||
          a.points.length > 2000 ||
          a.points.some(
            (p) => !Array.isArray(p) || p.length !== 2 || !p.every(unit),
          ))
      )
        return invalid();
      if (
        a.type === "freehand" &&
        (!Array.isArray(a.points) || a.points.length < 2)
      )
        return invalid();
    }
  }
  if (data.document.totalAnnotations !== count) return invalid();
  return importEnvelope(
    data as unknown as ReturnType<typeof createFloorDocument>,
  ).map(
    (a) =>
      Object.fromEntries(
        Object.entries(a).filter(([, v]) => v !== undefined),
      ) as unknown as Annotation,
  );
}
