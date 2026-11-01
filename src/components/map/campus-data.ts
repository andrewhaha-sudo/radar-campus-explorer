import type { Point, Rect } from "./navigation";
import { subtractObstacles } from "./navigation.ts";

export type SceneId =
  "campus" | "a1" | "b1" | "b2" | "c1" | "c2" | "lab1" | "d1" | "e1" | "e2" | "six1" | "six2";
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
    kind: "2 floors · 10 rooms",
    bounds: rect(80, 260, 208, 143),
    arrival: { x: 181, y: 409 },
    interior: "c1",
    description:
      "Five classrooms on each of two floors, connected by the staircase on the left. Click any door to view or add its photo.",
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
    kind: "2 floors · 6 rooms",
    bounds: rect(286, 452, 111, 253),
    arrival: { x: 347, y: 716 },
    interior: "e1",
    description:
      "The pond-side building has three classrooms on each of two floors, connected by an internal staircase.",
  },
  {
    id: "court",
    name: "Covered Court",
    kind: "Court & field",
    bounds: rect(490, 536, 269, 151),
    arrival: { x: 624, y: 660 },
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
    arrival: { x: 1172, y: 732 },
    description:
      "Walk across the eastern lawn to the dining building's striped awning and entrance.",
  },
  {
    id: "pond",
    name: "Pond",
    kind: "Landscape feature",
    bounds: rect(161, 543, 96, 155),
    arrival: { x: 247, y: 714 },
    description:
      "Visit the grassy bank beside the pond. Follow the lawn around the southern end of its fence.",
  },
  {
    id: "lawn",
    name: "Central Lawn",
    kind: "Open grass",
    bounds: rect(610, 477, 30, 30),
    arrival: { x: 625, y: 492 },
    description: "An open grassy area beside the court. Click the grass or use the movement controls to explore.",
  },
  {
    id: "garden",
    name: "Garden Grounds",
    kind: "Grass & trees",
    bounds: rect(532, 1042, 30, 30),
    arrival: { x: 547, y: 1057 },
    description: "Explore the grass and clearings among the trees south of the school gates.",
  },
  {
    id: "gazebo",
    name: "Gazebo",
    kind: "Garden shelter",
    bounds: rect(826, 658, 75, 72),
    arrival: { x: 862, y: 736 },
    description: "A quiet garden shelter reached across the lawn beside the covered court.",
  },
  {
    id: "flag",
    name: "Flagpole",
    kind: "Campus landmark",
    bounds: rect(710, 293, 56, 117),
    arrival: { x: 738, y: 419 },
    description: "Visit the flagpole along the main campus road.",
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

// The five-door source hallway already includes stairs on both floors. E uses
// the first three doors and the original end wall, leaving the central exit intact.
function classroomFloor(
  building: "c" | "e" | "six",
  floor: 1 | 2,
  count: 3 | 5,
): Scene {
  const id = `${building}${floor}` as SceneId;
  const upper = floor === 2;
  const y = upper ? 242 : 410;
  const height = upper ? 167 : 229;
  return {
    ...indoor,
    buildingId: building,
    name: `Building ${building === "six" ? "6" : building.toUpperCase()} · Floor ${floor}`,
    crop: rect(1241, y, count === 3 ? 553 : 759, height),
    spawn: upper ? { x: 1334, y: 381 } : { x: 1626, y: 607 },
    walkable: [
      rect(1296, upper ? 370 : 528, count === 3 ? 472 : 678, 24),
      ...(!upper ? [rect(1607, 540, 39, 87)] : []),
    ],
    rooms: rooms(id, [1493, 1597, 1700, 1801, 1904].slice(0, count), upper ? 315 : 473, floor),
    stairs: { point: { x: 1334, y: upper ? 381 : 539 }, to: `${building}${upper ? 1 : 2}` as SceneId },
    ...(!upper ? { exit: { x: 1626, y: 607 } } : {}),
    ...(count === 3 ? {
      artworkPieces: [
        { source: rect(1241, y, 491, height), target: { x: 1241, y } },
        { source: rect(1938, y, 62, upper ? height : 162), target: { x: 1732, y } },
        ...(!upper ? [
          { source: rect(1732, 572, 62, 67), target: { x: 1732, y: 572 } },
        ] : []),
        // Match the blank wall above the plant, without the clipped lamp tip.
        { source: rect(1720, upper ? 280 : 440, 12, 14), target: { x: 1732, y: upper ? 280 : 440 } },
      ],
    } : {}),
  };
}

// Open lawns and garden clearings connect to the existing roads and two gates.
// Solid buildings, pond water, fences and dense tree clusters are cut out first.
const campusWalkable = subtractObstacles([
  rect(34, 275, 1184, 469),
  rect(34, 780, 1184, 316),
  rect(374, 736, 26, 84),
  rect(970, 736, 58, 80),
], [
  rect(80, 286, 208, 115), rect(305, 319, 189, 80),
  rect(503, 286, 204, 117), rect(774, 327, 192, 77),
  rect(1005, 328, 204, 76), rect(291, 452, 108, 254),
  rect(996, 513, 73, 192), rect(961, 475, 140, 60),
  rect(1121, 422, 97, 298), rect(710, 296, 56, 112),
  rect(491, 538, 266, 88), rect(491, 624, 45, 63), rect(712, 624, 45, 63),
  rect(830, 659, 66, 70),
  // Pond, its western woods, and its separate fence.
  rect(34, 452, 170, 279), rect(186, 544, 54, 155), rect(165, 568, 88, 113),
  rect(266, 473, 13, 258), rect(207, 473, 59, 19),
  // Campus trees and shrubs, leaving the grass between them open.
  rect(43, 275, 33, 45), rect(35, 335, 47, 59),
  rect(42, 399, 36, 43), rect(958, 280, 38, 54), rect(969, 353, 35, 53),
  rect(857, 462, 47, 57), rect(892, 539, 68, 65), rect(885, 592, 58, 39),
  rect(1073, 572, 42, 60), rect(773, 656, 52, 79), rect(905, 673, 54, 75),
  rect(433, 684, 61, 58), rect(499, 695, 51, 49),
  rect(560, 699, 48, 45), rect(626, 699, 49, 45), rect(699, 695, 78, 49),
  // Trees and rocks in the lower garden. Routes wind through the clearings.
  rect(34, 780, 101, 143), rect(34, 934, 69, 149),
  rect(207, 829, 171, 142), rect(390, 841, 397, 107),
  rect(305, 949, 165, 112), rect(468, 936, 79, 74),
  rect(597, 950, 188, 130), rect(802, 825, 194, 132),
  rect(835, 940, 198, 122), rect(998, 829, 171, 146),
  rect(1120, 781, 98, 139), rect(1142, 949, 76, 143),
  rect(806, 1044, 55, 52), rect(235, 981, 45, 33),
  rect(258, 1052, 63, 35), rect(1070, 1002, 50, 39),
]);

export const scenes: Record<SceneId, Scene> = {
  campus: {
    name: "Outdoor campus",
    image: "/maps/campus.jpg",
    imageWidth: 1254,
    imageHeight: 1254,
    crop: rect(0, 0, 1254, 1254),
    spawn: { x: 387, y: 785 },
    rooms: [],
    walkable: campusWalkable,
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
  c1: classroomFloor("c", 1, 5),
  c2: classroomFloor("c", 2, 5),
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
  e1: classroomFloor("e", 1, 3),
  e2: classroomFloor("e", 2, 3),
  six1: classroomFloor("six", 1, 5),
  six2: classroomFloor("six", 2, 5),
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
