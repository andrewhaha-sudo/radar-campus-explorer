import type { Point, Rect } from "./navigation";

export type SceneId =
  "campus" | "a1" | "b1" | "b2" | "c1" | "lab1" | "d1" | "six1" | "six2";
export interface Room {
  id: string;
  name: string;
  scene: SceneId;
  point: Point;
  door: Rect;
}
export interface Scene {
  buildingId?: string;
  name: string;
  image: string;
  imageWidth: number;
  imageHeight: number;
  crop: Rect;
  spawn: Point;
  walkable: Rect[];
  rooms: Room[];
  stairs?: { point: Point; to: SceneId };
  exit?: Point;
  artworkPieces?: { source: Rect; target: Point }[];
}
export interface Place {
  id: string;
  name: string;
  kind: string;
  description: string;
  bounds: Rect;
  arrival?: Point;
  interior?: SceneId;
}
const rect = (x: number, y: number, width: number, height: number): Rect => ({
  x,
  y,
  width,
  height,
});
export const places: Place[] = [
  {
    id: "c",
    name: "Building C",
    kind: "1 floor · 1 room",
    bounds: rect(80, 260, 208, 143),
    arrival: { x: 181, y: 409 },
    interior: "c1",
    description:
      "One classroom in a compact hallway, using the same tiles, green door and cream walls as the supplied floor plan.",
  },
  {
    id: "lab",
    name: "Chemistry Lab",
    kind: "1 floor · 1 room",
    bounds: rect(305, 291, 189, 107),
    arrival: { x: 408, y: 408 },
    interior: "lab1",
    description:
      "A single laboratory room, reached through a hallway in the supplied floor-plan style.",
  },
  {
    id: "b",
    name: "Building B",
    kind: "2 floors · 4 classrooms",
    bounds: rect(503, 260, 204, 144),
    arrival: { x: 605, y: 409 },
    interior: "b1",
    description:
      "Explore two classrooms on each floor. The internal staircase on the left connects both floors.",
  },
  {
    id: "a",
    name: "Building A",
    kind: "1 floor · 2 classrooms",
    bounds: rect(774, 298, 192, 106),
    arrival: { x: 868, y: 411 },
    interior: "a1",
    description:
      "A single hallway with two classroom doors and the original central exit.",
  },
  {
    id: "d",
    name: "Building D",
    kind: "1 floor · 2 rooms",
    bounds: rect(1005, 309, 204, 95),
    arrival: { x: 1112, y: 411 },
    interior: "d1",
    description:
      "The upper-right campus building. Explore its two rooms in a hallway matching the supplied floor plan.",
  },
  {
    id: "e",
    name: "Building E",
    kind: "Campus building",
    bounds: rect(286, 452, 111, 253),
    arrival: { x: 347, y: 716 },
    description:
      "The pond-side building is now named Building E. An interior has not been assigned to this building.",
  },
  {
    id: "court",
    name: "Covered Court",
    kind: "Court & field",
    bounds: rect(490, 536, 269, 151),
    arrival: { x: 624, y: 699 },
    description:
      "The blue-roofed court is labeled as an open area in the supplied artwork. Current assembly status must be confirmed by the school.",
  },
  {
    id: "office",
    name: "Principal’s Office",
    kind: "Administration",
    bounds: rect(961, 475, 140, 231),
    arrival: { x: 1033, y: 713 },
    description:
      "The administration building on the eastern side of campus. No interior floor plan was supplied.",
  },
  {
    id: "canteen",
    name: "Canteen",
    kind: "School dining",
    bounds: rect(1119, 422, 99, 299),
    description:
      "The original dining building and striped awning. A walkable approach has not been mapped for this entrance.",
  },
  {
    id: "pond",
    name: "Pond",
    kind: "Landscape feature",
    bounds: rect(161, 543, 96, 155),
    description:
      "The pond and its surrounding trees are outside the mapped walking areas.",
  },
];

function rooms(
  scene: SceneId,
  xs: number[],
  doorY: number,
  floor: number,
): Room[] {
  const prefix = scene.startsWith("six")
    ? "6"
    : scene.startsWith("lab")
      ? "LAB"
      : scene[0].toUpperCase();
  return xs.map((x, i) => ({
    id: `${prefix}-${floor}0${i + 1}`,
    name: `Room ${prefix}-${floor}0${i + 1}`,
    scene,
    point: { x, y: doorY + 62 },
    door: rect(x - 22, doorY, 44, 55),
  }));
}
const indoor = {
  image: "/maps/floor-plans.jpg",
  imageWidth: 2048,
  imageHeight: 682,
};
// Reuse source sections of the A hallway, omitting its second doorway. The right
// end wall and plant move next to the first section; source image bytes stay intact.
const singleRoomHallway = {
  ...indoor,
  crop: rect(58, 286, 422, 357),
  spawn: { x: 328, y: 602 },
  walkable: [rect(87, 396, 363, 43), rect(308, 428, 41, 199)],
  exit: { x: 328, y: 604 },
  artworkPieces: [
    { source: rect(58, 286, 360, 357), target: { x: 58, y: 286 } },
    { source: rect(540, 286, 62, 357), target: { x: 418, y: 286 } },
  ],
};
export const scenes: Record<SceneId, Scene> = {
  campus: {
    name: "Outdoor campus",
    image: "/maps/campus.jpg",
    imageWidth: 1254,
    imageHeight: 1254,
    crop: rect(0, 0, 1254, 1254),
    spawn: { x: 387, y: 785 },
    rooms: [],
    // Conservative, connected corridors. Unmapped lawn is blocked by default.
    walkable: [
      rect(92, 417, 1045, 27),
      rect(402, 397, 24, 350),
      rect(374, 736, 26, 84),
      rect(384, 730, 42, 18),
      rect(162, 802, 910, 24),
      rect(148, 813, 28, 284),
      rect(165, 398, 32, 40),
      rect(590, 399, 30, 39),
      rect(852, 401, 32, 36),
      rect(1097, 400, 30, 38),
      rect(334, 703, 27, 34),
      rect(347, 726, 68, 14),
      rect(418, 691, 340, 16),
      rect(985, 435, 18, 285),
      rect(994, 706, 52, 16),
    ],
  },
  a1: {
    ...indoor,
    buildingId: "a",
    name: "Building A · Floor 1",
    crop: rect(58, 286, 544, 357),
    spawn: { x: 328, y: 602 },
    walkable: [rect(87, 396, 485, 43), rect(308, 428, 41, 199)],
    rooms: rooms("a1", [183, 483], 338, 1),
    exit: { x: 328, y: 604 },
  },
  b1: {
    ...indoor,
    buildingId: "b",
    name: "Building B · Floor 1",
    crop: rect(637, 410, 567, 229),
    spawn: { x: 936, y: 607 },
    walkable: [rect(697, 528, 477, 24), rect(916, 540, 39, 87)],
    rooms: rooms("b1", [900, 1103], 473, 1),
    stairs: { point: { x: 735, y: 539 }, to: "b2" },
    exit: { x: 936, y: 607 },
  },
  b2: {
    ...indoor,
    buildingId: "b",
    name: "Building B · Floor 2",
    crop: rect(637, 242, 567, 167),
    spawn: { x: 735, y: 381 },
    walkable: [rect(697, 370, 477, 24)],
    rooms: rooms("b2", [900, 1103], 315, 2),
    stairs: { point: { x: 735, y: 381 }, to: "b1" },
  },
  c1: {
    ...singleRoomHallway,
    buildingId: "c",
    name: "Building C · Floor 1",
    rooms: rooms("c1", [183], 338, 1),
  },
  lab1: {
    ...singleRoomHallway,
    buildingId: "lab",
    name: "Chemistry Lab · Floor 1",
    rooms: rooms("lab1", [183], 338, 1),
  },
  d1: {
    ...indoor,
    buildingId: "d",
    name: "Building D · Floor 1",
    crop: rect(58, 286, 544, 357),
    spawn: { x: 328, y: 602 },
    walkable: [rect(87, 396, 485, 43), rect(308, 428, 41, 199)],
    rooms: rooms("d1", [183, 483], 338, 1),
    exit: { x: 328, y: 604 },
  },
  six1: {
    ...indoor,
    buildingId: "six",
    name: "Building 6 · Floor 1",
    crop: rect(1241, 410, 759, 229),
    spawn: { x: 1626, y: 607 },
    walkable: [rect(1296, 528, 678, 24), rect(1607, 540, 39, 87)],
    rooms: rooms("six1", [1493, 1597, 1700, 1801, 1904], 473, 1),
    stairs: { point: { x: 1334, y: 539 }, to: "six2" },
    exit: { x: 1626, y: 607 },
  },
  six2: {
    ...indoor,
    buildingId: "six",
    name: "Building 6 · Floor 2",
    crop: rect(1241, 242, 759, 167),
    spawn: { x: 1334, y: 381 },
    walkable: [rect(1296, 370, 678, 24)],
    rooms: rooms("six2", [1493, 1597, 1700, 1801, 1904], 315, 2),
    stairs: { point: { x: 1334, y: 381 }, to: "six1" },
  },
};

export const allRooms = Object.values(scenes).flatMap((scene) => scene.rooms);

export const interiorBuildings = [
  ...places
    .filter((place): place is Place & { interior: SceneId } =>
      Boolean(place.interior),
    )
    .map((place) => ({
      name: place.name,
      kind: place.kind,
      scene: place.interior,
    })),
  {
    name: "Building 6",
    kind: "2 floors · 10 classrooms",
    scene: "six1" as SceneId,
  },
];

export function entranceForScene(id: SceneId) {
  return places.find((place) => place.id === scenes[id].buildingId);
}
