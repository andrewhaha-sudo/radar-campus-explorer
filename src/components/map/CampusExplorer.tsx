import { CampusLabels } from "./CampusLabels";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowUpRight,
  Building2,
  Image as PhotoIcon,
  Check,
  ChevronLeft,
  Crosshair,
  Footprints,
  Layers,
  MapPin,
  Maximize2,
  Minus,
  Plus,
  RotateCcw,
} from "lucide-react";
import {
  allRooms,
  places,
  scenes,
  interiorBuildings,
  entranceForScene,
} from "./campus-data";
import { RoomPhotoDialog } from "./RoomPhotoDialog";
import { RouteOverlay } from "./RouteOverlay";
import { CampusBreeze } from "./CampusBreeze";
import { StudentSprite } from "../student/StudentSprite";
import { StudentProfileModal } from "../student/StudentProfileModal";
import { useStudentProfile } from "../student/student-context";
import { useCampusStudents } from "../student/useCampusStudents";
import type { Character, Direction } from "../../lib/student-profile";
import type { Place, Room, SceneId } from "./campus-data";
import { canTravel, findPath, isWalkable } from "./navigation";
import { requestLifeRoute } from "./liferouter";
import type { Point } from "./navigation";
import "./campus-explorer.css";
import { cn } from "../../lib/cn";
import { LiveLocationPanel } from "../location/LiveLocationPanel";
import { CalibrationDialog } from "../location/CalibrationDialog";
import { IdentityDialog } from "../location/IdentityDialog";
import { useDeviceLocation } from "../location/useDeviceLocation";
import { loadCalibration } from "../../lib/map-calibration";
import type { Calibration } from "../../lib/map-calibration";
import type { UniformColor } from "../../lib/map-identity";
import {
  RadarHeader,
  SidebarNavigation,
  BottomNavigation,
  RadarMapHeading,
  LiveConditions,
  MiniMap,
  QuickActions,
  CurrentMission,
  RadarAssistant,
  MapLegend,
} from "../dashboard/RadarDashboard";
import type { RadarAction } from "../dashboard/RadarDashboard";
import { BuildingPopup, DashboardDialog } from "../dashboard/DashboardDialogs";

const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const movementKeys: Record<string, Point> = {
  ArrowUp: { x: 0, y: -1 },
  w: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
  s: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 },
  a: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  d: { x: 1, y: 0 },
};

function Student({
  position,
  direction,
  moving,
  avatar,
  animate,
  onOpen,
  name,
  color,
  live = false,
  smooth = false,
}: {
  position: Point;
  direction: Direction;
  moving: boolean;
  avatar: Character;
  animate: boolean;
  onOpen: () => void;
  name: string;
  color: UniformColor;
  live?: boolean;
  smooth?: boolean;
}) {
  return (
    <g
      transform={`translate(${position.x},${position.y})`}
      className="campus-student"
      data-animate={animate}
      data-player="you"
      data-x={position.x}
      data-y={position.y}
      data-location={live}
      data-smooth={smooth}
      style={
        live
          ? { transform: `translate(${position.x}px, ${position.y}px)` }
          : undefined
      }
      role="button"
      tabIndex={0}
      aria-label="Your character"
      onClick={(event) => {
        event.stopPropagation();
        onOpen();
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          event.stopPropagation();
          onOpen();
        }
      }}
    >
      <title>Open your student profile</title>
      <StudentSprite
        avatar={avatar}
        direction={direction}
        moving={moving}
        color={color}
      />
      <text y="-40" className="campus-own-label">
        {name.slice(0, 24)}
      </text>
    </g>
  );
}

function RoomDoor({
  room,
  selected,
  onOpen,
}: {
  room: Room;
  selected: boolean;
  onOpen: (room: Room) => void;
}) {
  return (
    <g
      role="button"
      tabIndex={0}
      data-room-id={room.id}
      aria-label={`Open ${room.name} photo`}
      className={cn("campus-hotspot", selected && "campus-hotspot--selected")}
      onClick={(event) => {
        event.stopPropagation();
        onOpen(room);
      }}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          event.stopPropagation();
          onOpen(room);
        }
      }}
    >
      <title>{room.name} — view or add a photo</title>
      <rect {...room.door} />
    </g>
  );
}

// Preferences never include location permission, GPS coordinates, or location history.
const preferenceKey = "campus-display-preferences-v1";
function readPreference(name: string, fallback: boolean): boolean {
  try {
    const value = JSON.parse(localStorage.getItem(preferenceKey) || "{}")[name];
    return typeof value === "boolean" ? value : fallback;
  } catch {
    return fallback;
  }
}

export function CampusExplorer() {
  const [sceneId, setSceneId] = useState<SceneId>("campus");
  const [position, setPosition] = useState<Point>(scenes.campus.spawn);
  const [direction, setDirection] = useState<Direction>("down");
  const [moving, setMoving] = useState(false);
  const [selected, setSelected] = useState<Place | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [message, setMessage] = useState(
    "Welcome! Choose a building, or walk in through the main gate.",
  );
  const [route, setRoute] = useState<Point[]>([]);
  const [routeEngine, setRouteEngine] = useState<"local" | "liferouter">("local");
  const [routeLoading, setRouteLoading] = useState(false);
  const routeRequest = useRef<AbortController | null>(null);
  useEffect(() => () => routeRequest.current?.abort(), []);
  const [showRoute, setShowRoute] = useState(() =>
    readPreference("showRoute", true),
  );
  const [breeze, setBreeze] = useState(() => readPreference("breeze", true));
  const [photoRoom, setPhotoRoom] = useState<Room | null>(null);
  const [studentId, setStudentId] = useState<string | null>(null);
  const profileReturnFocus = useRef<HTMLElement | null>(null);
  const [mapVisible, setMapVisible] = useState(true);
  const photoReturnFocus = useRef<HTMLElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [artOnly, setArtOnly] = useState(false);
  const [showAreas, setShowAreas] = useState(() =>
    readPreference("showAreas", false),
  );
  const [floorSheet, setFloorSheet] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState("");
  const [dashboardAction, setDashboardAction] = useState<RadarAction>("map");
  const [dashboardDialog, setDashboardDialog] = useState<RadarAction | null>(
    null,
  );
  const [buildingPopup, setBuildingPopup] = useState<Place | null>(null);
  const [mapAspect, setMapAspect] = useState(1.5);
  const [cameraCentered, setCameraCentered] = useState(false);
  const [visitedByOwner, setVisitedByOwner] = useState<
    Record<string, string[]>
  >({});
  const [calibration, setCalibration] = useState<Calibration | null>(
    loadCalibration,
  );
  const [locationView, setLocationView] = useState(false);
  const [privateSession, setPrivateSession] = useState(false);
  const [correction, setCorrection] = useState(false);
  const [locationDialog, setLocationDialog] = useState<
    "identity" | "calibration" | null
  >(null);
  const player = useRef(position);
  const path = useRef<Point[]>([]);
  const arrival = useRef<(() => void) | null>(null);
  const held = useRef(new Set<string>());
  const pendingRoom = useRef<Room | null>(null);
  const svg = useRef<SVGSVGElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const explorer = useRef<HTMLDivElement>(null);
  const scene = scenes[sceneId];
  const { profile, user, identity } = useStudentProfile();
  const ownerId = user?.id ?? "device";
  const visitedRooms = useMemo(() => {
    if (visitedByOwner[ownerId]) return visitedByOwner[ownerId];
    try {
      const ids = JSON.parse(
        localStorage.getItem("campus-room-visits:" + ownerId) || "[]",
      );
      return Array.isArray(ids)
        ? (ids.filter((id: unknown) =>
            allRooms.some((room) => room.id === id),
          ) as string[])
        : [];
    } catch {
      return [];
    }
  }, [visitedByOwner, ownerId]);
  useEffect(() => {
    try {
      localStorage.setItem(
        preferenceKey,
        JSON.stringify({ showRoute, breeze, showAreas }),
      );
    } catch {
      /* Device storage may be unavailable. */
    }
  }, [showRoute, breeze, showAreas]);
  const location = useDeviceLocation(calibration, user?.id ?? "device");
  const { students, error: studentsError } = useCampusStudents(
    {
      scene: sceneId,
      ...position,
      direction,
      moving,
    },
    !privateSession,
  );
  const nearbyStudents = students.filter(
    (student) =>
      student.scene === sceneId && isWalkable(student, scene.walkable),
  );

  useEffect(() => {
    let intersecting = true;
    const update = () => setMapVisible(intersecting && !document.hidden);
    const observer = new IntersectionObserver(([entry]) => {
      intersecting = entry.isIntersecting;
      update();
    });
    if (viewport.current) observer.observe(viewport.current);
    document.addEventListener("visibilitychange", update);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", update);
    };
  }, []);

  useEffect(() => {
    const observer = new ResizeObserver(([entry]) => {
      if (entry.contentRect.width > 0 && entry.contentRect.height > 0)
        setMapAspect(entry.contentRect.width / entry.contentRect.height);
    });
    if (viewport.current) observer.observe(viewport.current);
    return () => observer.disconnect();
  }, []);

  const cancelMovement = useCallback(() => {
    routeRequest.current?.abort();
    routeRequest.current = null;
    setRouteLoading(false);
    path.current = [];
    arrival.current = null;
    pendingRoom.current = null;
    setRoute([]);
    setMoving(false);
  }, []);

  const openStudent = (id: string) => {
    cancelMovement();
    held.current.clear();
    profileReturnFocus.current = document.activeElement as HTMLElement | null;
    setStudentId(id);
  };

  const changeScene = useCallback((id: SceneId, spawn?: Point) => {
    routeRequest.current?.abort();
    routeRequest.current = null;
    setRouteLoading(false);
    const point = spawn ?? scenes[id].spawn;
    path.current = [];
    arrival.current = null;
    held.current.clear();
    player.current = point;
    setSceneId(id);
    setPosition(point);
    setRoute([]);
    setMoving(false);
    setZoom(1);
    setFloorSheet(false);
    viewport.current?.scrollTo(0, 0);
    setMessage(
      `${scenes[id].name}. Click a destination or use the arrow keys to explore.`,
    );
  }, []);

  const walkTo = useCallback(
    (point: Point, onArrival?: () => void) => {
      if (locationView) return false;
      if (routeEngine === "liferouter") {
        if (privateSession || correction) return false;
        routeRequest.current?.abort();
        const controller = new AbortController();
        routeRequest.current = controller;
        held.current.clear();
        path.current = [];
        arrival.current = null;
        setRoute([]);
        setMoving(false);
        setRouteLoading(true);
        void requestLifeRoute(sceneId, { x: player.current.x, y: player.current.y }, point, scenes[sceneId].walkable, controller.signal)
          .then((next) => {
            if (controller.signal.aborted) return;
            path.current = next.slice(1);
            arrival.current = onArrival ?? null;
            setRoute(next);
            setMoving(true);
            setMessage("Following LifeRouter simulation route…");
          })
          .catch((error: unknown) => {
            if (controller.signal.aborted) return;
            pendingRoom.current = null;
            setMessage(error instanceof Error && error.name !== "TypeError" ? error.message :
              "LifeRouter is unavailable. Start the routing service or select Local routing.");
          })
          .finally(() => {
            if (routeRequest.current === controller) {
              routeRequest.current = null;
              setRouteLoading(false);
            }
          });
        return true;
      }
      const next = findPath(player.current, point, scenes[sceneId].walkable);
      if (!next) {
        setMessage(
          "That spot is blocked. Choose open grass, a walkway or a destination.",
        );
        return false;
      }
      held.current.clear();
      path.current = next.slice(1);
      arrival.current = onArrival ?? null;
      setRoute(next);
      setMoving(true);
      return true;
    },
    [sceneId, locationView, routeEngine, privateSession, correction],
  );

  const choosePlace = (place: Place) => {
    if (locationView) return;
    cancelMovement();
    setSelected(place);
    setSelectedRoom(null);
    if (!place.arrival) {
      setMessage(place.description);
      return;
    }
    setMessage(`Walking to ${place.name}…`);
    walkTo(place.arrival, () =>
      setMessage(
        place.interior
          ? `You reached ${place.name}. Press E or choose Enter building.`
          : place.description,
      ),
    );
    viewport.current?.focus({ preventScroll: true });
  };

  const chooseRoom = (room: Room) => {
    if (locationView) return;
    cancelMovement();
    setSelectedRoom(room);
    pendingRoom.current = room;
    if (sceneId === "campus") {
      const building = entranceForScene(room.scene);
      if (!building?.arrival || !building.interior) {
        setMessage(
          "Building 6’s outdoor entrance is not identified. Open its floor-plan view to explore.",
        );
        pendingRoom.current = null;
        return;
      }
      setSelected(building);
      setMessage(`Walking to ${room.name} via ${building.name}…`);
      if (!walkTo(building.arrival, () => changeScene(building.interior!)))
        pendingRoom.current = null;
    } else if (sceneId === room.scene) {
      pendingRoom.current = null;
      walkTo(room.point, () =>
        setMessage(
          `${room.name} · Floor ${room.scene.endsWith("2") ? 2 : 1}. You have reached the classroom door.`,
        ),
      );
    } else if (scene.stairs && scene.stairs.to === room.scene) {
      walkTo(scene.stairs.point, () =>
        changeScene(room.scene, scenes[room.scene].stairs!.point),
      );
    }
  };

  const openRoomPhoto = (room: Room) => {
    cancelMovement();
    held.current.clear();
    photoReturnFocus.current = document.activeElement as HTMLElement | null;
    setSelectedRoom(room);
    setPhotoRoom(room);
    if (!visitedRooms.includes(room.id)) {
      const next = [...visitedRooms, room.id];
      setVisitedByOwner((previous) => ({ ...previous, [ownerId]: next }));
      try {
        localStorage.setItem(
          "campus-room-visits:" + ownerId,
          JSON.stringify(next),
        );
      } catch {
        /* Progress still works for this session. */
      }
    }
  };

  useEffect(() => {
    const room = pendingRoom.current;
    if (!room || sceneId === "campus" || locationView) return;
    if (room.scene === sceneId) {
      pendingRoom.current = null;
      walkTo(room.point, () =>
        setMessage(
          `${room.name} · Floor ${room.scene.endsWith("2") ? 2 : 1}. You have reached the classroom door.`,
        ),
      );
    } else if (scene.stairs?.to === room.scene) {
      walkTo(scene.stairs.point, () =>
        changeScene(room.scene, scenes[room.scene].stairs!.point),
      );
    }
  }, [sceneId, scene, walkTo, changeScene, locationView]);

  useEffect(() => {
    if (
      artOnly ||
      floorSheet ||
      photoRoom ||
      studentId ||
      locationView ||
      locationDialog ||
      buildingPopup ||
      dashboardDialog
    )
      return;
    let frame = 0,
      previous = 0;
    const animate = (time: number) => {
      const dt = Math.min((time - (previous || time)) / 1000, 0.25);
      previous = time;
      const key = [...held.current].at(-1);
      const manual = key ? movementKeys[key] : null;
      const target = path.current[0];
      let next: Point | null = null;
      if (manual) {
        const stride = (sceneId === "campus" ? 110 : 145) * dt;
        next = {
          x: player.current.x + manual.x * stride,
          y: player.current.y + manual.y * stride,
        };
      } else if (target) {
        const length = distance(player.current, target),
          stride = (sceneId === "campus" ? 155 : 190) * dt;
        if (length <= stride) {
          next = target;
          path.current.shift();
          setRoute([...path.current]);
        } else
          next = {
            x:
              player.current.x +
              ((target.x - player.current.x) / length) * stride,
            y:
              player.current.y +
              ((target.y - player.current.y) / length) * stride,
          };
      }
      if (next && canTravel(player.current, next, scene.walkable)) {
        const dx = next.x - player.current.x,
          dy = next.y - player.current.y;
        if (dx || dy)
          setDirection(
            Math.abs(dx) > Math.abs(dy)
              ? dx > 0
                ? "right"
                : "left"
              : dy > 0
                ? "down"
                : "up",
          );
        player.current = next;
        setPosition(next);
        setMoving(Boolean(dx || dy));
        if (zoom > 1 && svg.current && viewport.current) {
          const matrix = svg.current.getScreenCTM();
          if (matrix) {
            const pt = new DOMPoint(next.x, next.y).matrixTransform(matrix),
              box = viewport.current.getBoundingClientRect();
            if (
              pt.x < box.left + 80 ||
              pt.x > box.right - 80 ||
              pt.y < box.top + 80 ||
              pt.y > box.bottom - 80
            ) {
              viewport.current.scrollBy({
                left: pt.x - box.left - box.width / 2,
                top: pt.y - box.top - box.height / 2,
                behavior: "smooth",
              });
            }
          }
        }
      } else if (next) {
        path.current = [];
        arrival.current = null;
        setMoving(false);
      }
      if (!manual && !path.current.length) {
        setMoving(false);
        if (arrival.current) {
          const callback = arrival.current;
          arrival.current = null;
          setRoute([]);
          callback();
        }
      }
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    const release = () => held.current.clear();
    const keyUp = (event: globalThis.KeyboardEvent) =>
      held.current.delete(
        event.key.length === 1 ? event.key.toLowerCase() : event.key,
      );
    window.addEventListener("keyup", keyUp);
    window.addEventListener("blur", release);
    document.addEventListener("visibilitychange", release);
    return () => {
      cancelAnimationFrame(frame);
      release();
      window.removeEventListener("keyup", keyUp);
      window.removeEventListener("blur", release);
      document.removeEventListener("visibilitychange", release);
    };
  }, [
    scene,
    sceneId,
    artOnly,
    floorSheet,
    zoom,
    photoRoom,
    studentId,
    locationView,
    locationDialog,
    buildingPopup,
    dashboardDialog,
  ]);

  useEffect(() => {
    if (!expanded) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const close = (event: globalThis.KeyboardEvent) => {
      if (
        event.key === "Escape" &&
        !event.defaultPrevented &&
        !photoRoom &&
        !studentId &&
        !locationDialog &&
        !buildingPopup &&
        !dashboardDialog
      )
        setExpanded(false);
    };
    window.addEventListener("keydown", close);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", close);
    };
  }, [
    expanded,
    photoRoom,
    studentId,
    locationDialog,
    buildingPopup,
    dashboardDialog,
  ]);

  const nearbyBuilding =
    sceneId === "campus"
      ? places.find(
          (p) => p.interior && p.arrival && distance(position, p.arrival) < 18,
        )
      : null;
  const nearStairs =
    scene.stairs && distance(position, scene.stairs.point) < 18;
  const nearExit = scene.exit && distance(position, scene.exit) < 18;
  const exitBuilding = () => {
    cancelMovement();
    if (sceneId.startsWith("six")) {
      setFloorSheet(true);
      setMessage("Building 6 has no assigned outdoor entrance.");
      return;
    }
    const building = entranceForScene(sceneId);
    changeScene("campus", building?.arrival);
  };
  const interact = () => {
    if (locationView) return;
    if (nearbyBuilding?.interior) changeScene(nearbyBuilding.interior);
    else if (nearStairs && scene.stairs) {
      cancelMovement();
      changeScene(scene.stairs.to, scenes[scene.stairs.to].stairs!.point);
    } else if (nearExit) exitBuilding();
  };
  const keyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (
      artOnly ||
      floorSheet ||
      photoRoom ||
      studentId ||
      locationView ||
      locationDialog ||
      buildingPopup ||
      dashboardDialog ||
      (event.target as HTMLElement).matches("input, select, textarea, button")
    )
      return;
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    if (movementKeys[key]) {
      event.preventDefault();
      if (!held.current.has(key)) cancelMovement();
      held.current.add(key);
    } else if (key === "e") {
      event.preventDefault();
      interact();
    }
  };
  const clickMap = (event: React.MouseEvent<SVGSVGElement>) => {
    if (
      artOnly ||
      floorSheet ||
      photoRoom ||
      studentId ||
      locationView ||
      locationDialog ||
      buildingPopup ||
      dashboardDialog
    )
      return;
    const matrix = svg.current?.getScreenCTM();
    if (!matrix) return;
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(
      matrix.inverse(),
    );
    cancelMovement();
    if (correction) {
      if (!isWalkable(point, scene.walkable)) {
        setMessage(
          "Choose open ground or a hallway for your manual correction.",
        );
        return;
      }
      player.current = { x: point.x, y: point.y };
      setPosition(player.current);
      setCorrection(false);
      setMessage(
        "Location set manually. GPS is off; this correction stays private on this device.",
      );
      return;
    }
    if (
      walkTo(point, () =>
        setMessage(
          "You reached this spot. Click another place or keep exploring.",
        ),
      )
    )
      setMessage("Walking to this spot…");
    viewport.current?.focus({ preventScroll: true });
  };
  const touchStart = (key: string, event: PointerEvent<HTMLButtonElement>) => {
    if (locationView) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    cancelMovement();
    held.current.add(key);
  };
  const displayedRooms = allRooms.filter((room) =>
    sceneId === "campus"
      ? !room.scene.startsWith("six")
      : scenes[room.scene].buildingId === scene.buildingId,
  );
  const visiblePlaces = places.filter((p) =>
    `${p.name} ${p.kind}`.toLowerCase().includes(query.toLowerCase()),
  );
  const cameraPoint = locationView
    ? (location.fix?.point ?? position)
    : position;
  // Keep the artwork's printed title/legend outside the gameplay camera.
  // Coordinates stay in original image pixels, including all walkable gardens.
  const outdoorHeight = Math.min(920, 1190 / Math.max(0.5, mapAspect));
  const baseTop = Math.min(180, 1100 - outdoorHeight);
  const outdoorTop = Math.max(
    0,
    Math.min(
      1100 - outdoorHeight,
      cameraCentered
        ? cameraPoint.y - outdoorHeight / 2
        : Math.max(baseTop, cameraPoint.y - outdoorHeight + 65),
    ),
  );
  const crop = floorSheet
    ? { x: 0, y: 0, width: 2048, height: 682 }
    : sceneId === "campus" && !artOnly
      ? { x: 32, y: outdoorTop, width: 1190, height: outdoorHeight }
      : scene.crop;
  const indoor = floorSheet || sceneId !== "campus";

  const directionPad = (
    <div className="campus-dpad" aria-label="Touch movement controls">
      {[
        {
          key: "ArrowUp",
          icon: ArrowUp,
          label: "Walk north",
          area: "up",
        },
        {
          key: "ArrowLeft",
          icon: ArrowLeft,
          label: "Walk west",
          area: "left",
        },
        {
          key: "ArrowDown",
          icon: ArrowDown,
          label: "Walk south",
          area: "down",
        },
        {
          key: "ArrowRight",
          icon: ArrowRight,
          label: "Walk east",
          area: "right",
        },
      ].map((control) => (
        <button
          key={control.key}
          style={{ gridArea: control.area }}
          aria-label={control.label}
          disabled={artOnly || floorSheet || locationView}
          onPointerDown={(e) => touchStart(control.key, e)}
          onPointerUp={() => held.current.delete(control.key)}
          onPointerCancel={() => held.current.clear()}
          onLostPointerCapture={() => held.current.clear()}
          onKeyDown={(e) => {
            if (e.key === " " || e.key === "Enter") {
              e.preventDefault();
              cancelMovement();
              held.current.add(control.key);
            }
          }}
          onKeyUp={() => held.current.clear()}
          onBlur={() => held.current.clear()}
        >
          <control.icon size={19} />
        </button>
      ))}
    </div>
  );

  const displayedPosition = locationView
    ? (location.fix?.point ?? null)
    : position;
  const centerOnPlayer = () => {
    setCameraCentered(true);
    requestAnimationFrame(() => {
      if (!displayedPosition || !svg.current || !viewport.current) return;
      const matrix = svg.current.getScreenCTM();
      if (!matrix) return;
      const point = new DOMPoint(
        displayedPosition.x,
        displayedPosition.y,
      ).matrixTransform(matrix);
      const box = viewport.current.getBoundingClientRect();
      viewport.current.scrollBy({
        left: point.x - box.left - box.width / 2,
        top: point.y - box.top - box.height / 2,
      });
    });
  };
  const navigateDashboard = (action: RadarAction) => {
    cancelMovement();
    held.current.clear();
    setDashboardAction(action);
    if (action === "profile") {
      openStudent("self");
      return;
    }
    if (action === "map") {
      if (!locationView) changeScene("campus");
      setArtOnly(false);
      setFloorSheet(false);
      explorer.current?.scrollTo(0, 0);
      window.scrollTo(0, 0);
      return;
    }
    if (action === "inspect" || action === "settings") {
      const target = document.getElementById(
        action === "settings" ? "radar-settings" : "radar-inspect",
      );
      requestAnimationFrame(() => {
        target?.scrollIntoView({ block: "start" });
        target?.focus({ preventScroll: true });
      });
      return;
    }
    setDashboardDialog(action);
  };
  const openBuilding = (place: Place) => {
    cancelMovement();
    held.current.clear();
    setSelected(place);
    setBuildingPopup(place);
  };
  const locationPanel = (
    <LiveLocationPanel
      location={location}
      calibrated={Boolean(calibration)}
      privateSession={privateSession}
      locationView={locationView}
      correction={correction}
      onEnable={() => {
        cancelMovement();
        held.current.clear();
        setPrivateSession(true);
        setRouteEngine("local");
        setCorrection(false);
        if (sceneId !== "campus") changeScene("campus");
        setFloorSheet(false);
        setArtOnly(false);
        setLocationView(true);
        setMessage(
          "Device location controls your character. Use the live location panel to stop or correct it.",
        );
        location.enable();
      }}
      onIdentity={() => {
        cancelMovement();
        held.current.clear();
        setLocationDialog("identity");
      }}
      onCalibrate={() => {
        location.stop();
        cancelMovement();
        held.current.clear();
        setLocationDialog("calibration");
      }}
      onManual={() => {
        location.stop();
        setLocationView(false);
        setCorrection(false);
        setMessage(
          "Manual exploration resumed at your previous exploration position. This is not a GPS location.",
        );
      }}
      onCorrect={() => {
        setPrivateSession(true);
        setRouteEngine("local");
        location.stop();
        cancelMovement();
        held.current.clear();
        setLocationView(false);
        setCorrection(true);
        setMessage(
          "Tap open ground to set your location manually, or choose a building and floor in Indoor floor plans.",
        );
      }}
    />
  );
  const explorerTools = (
    <aside className="campus-sidebar">
      {user && (
        <section className="campus-directory">
          <span className="campus-eyebrow">STUDENTS HERE</span>
          <p className="campus-small">
            {nearbyStudents.length
              ? `${nearbyStudents.length} other student${nearbyStudents.length === 1 ? "" : "s"} in this area. Click a character to view their shared profile.`
              : "No other students are sharing a character in this area right now."}
          </p>
          {studentsError && (
            <p className="student-error" role="status">
              {studentsError}
            </p>
          )}
        </section>
      )}
      <section className="campus-directory">
        <span className="campus-eyebrow">YOUR NEXT STOP</span>
        <h2>{indoor ? "Inside the school" : "Campus directory"}</h2>
        {floorSheet ? (
          <>
            <p className="campus-small">
              Choose a building to explore its hallways. Click a room door to
              view or add a photo.
            </p>
            {interiorBuildings.map((building) => (
              <button
                className="campus-location"
                key={building.scene}
                onClick={() => {
                  cancelMovement();
                  setSelectedRoom(null);
                  changeScene(building.scene);
                }}
              >
                <span className="campus-location-icon">
                  <Building2 size={18} />
                </span>
                <span>
                  <strong>{building.name}</strong>
                  <small>{building.kind}</small>
                </span>
                <ArrowUpRight size={15} />
              </button>
            ))}
            <p className="campus-small">
              Building 6’s outdoor entrance is unassigned. This view opens its
              interior independently.
            </p>
          </>
        ) : (
          <>
            {sceneId !== "campus" && (
              <button
                className="campus-back"
                onClick={() => {
                  cancelMovement();
                  changeScene("campus");
                  setSelectedRoom(null);
                }}
              >
                <ChevronLeft size={15} /> Campus overview
              </button>
            )}
            {sceneId === "campus" && (
              <>
                <input
                  className="campus-search"
                  placeholder="Find a place…"
                  aria-label="Find a place in the illustrated campus"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
                <div className="campus-locations">
                  {visiblePlaces.map((place) => (
                    <button
                      key={place.id}
                      className={cn(
                        "campus-location",
                        selected?.id === place.id && "is-selected",
                      )}
                      onClick={() => choosePlace(place)}
                      disabled={artOnly || locationView}
                    >
                      <span className="campus-location-icon">
                        {place.id === "court" ? (
                          <Crosshair size={18} />
                        ) : (
                          <Building2 size={18} />
                        )}
                      </span>
                      <span>
                        <strong>{place.name}</strong>
                        <small>{place.kind}</small>
                      </span>
                      {selected?.id === place.id ? (
                        <Check size={15} />
                      ) : (
                        <ArrowUpRight size={15} />
                      )}
                    </button>
                  ))}
                  {!visiblePlaces.length && (
                    <p className="campus-small">No places match “{query}”.</p>
                  )}
                </div>
              </>
            )}
            {selected && sceneId === "campus" && (
              <div className="campus-place-details">
                <strong>{selected.name}</strong>
                <p>{selected.description}</p>
                {selected.interior && (
                  <button
                    className="campus-primary"
                    disabled={artOnly || locationView}
                    onClick={() => {
                      cancelMovement();
                      walkTo(selected.arrival!, () =>
                        changeScene(selected.interior!),
                      );
                    }}
                  >
                    Walk inside <ArrowRight size={14} />
                  </button>
                )}
              </div>
            )}
            {sceneId.startsWith("six") && (
              <p className="campus-small">
                Building 6 · Interior preview. Outdoor entrance unassigned.
              </p>
            )}
            <label className="campus-room-label" htmlFor="campus-room">
              Go to a classroom
            </label>
            <select
              id="campus-room"
              value={selectedRoom?.id ?? ""}
              disabled={artOnly || locationView}
              onChange={(e) => {
                const room = allRooms.find((r) => r.id === e.target.value);
                if (room) chooseRoom(room);
              }}
            >
              <option value="">Choose a room…</option>
              {displayedRooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name} · Floor {r.scene.endsWith("2") ? 2 : 1}
                </option>
              ))}
            </select>
            {selectedRoom && (
              <button
                className="campus-secondary campus-room-photo-button"
                disabled={artOnly}
                onClick={() => openRoomPhoto(selectedRoom)}
              >
                <PhotoIcon size={16} /> View / add room photo
              </button>
            )}
            {scene.stairs && (
              <button
                className="campus-secondary campus-wide"
                disabled={artOnly}
                onClick={() => {
                  cancelMovement();
                  walkTo(scene.stairs!.point, () =>
                    changeScene(
                      scene.stairs!.to,
                      scenes[scene.stairs!.to].stairs!.point,
                    ),
                  );
                }}
              >
                <Layers size={16} /> Walk to floor{" "}
                {scene.stairs.to.endsWith("2") ? 2 : 1}
              </button>
            )}
            {scene.exit && (
              <button
                className="campus-secondary campus-wide"
                disabled={artOnly}
                onClick={() => {
                  cancelMovement();
                  walkTo(scene.exit!, exitBuilding);
                }}
              >
                <ChevronLeft size={16} /> Walk to exit
              </button>
            )}
          </>
        )}
      </section>
      <section className="campus-controls">
        <span className="campus-eyebrow">A LITTLE EXPLORATION</span>
        <h2>Make your way around.</h2>
        <p>
          Click a place or open grass to walk there. Use the arrow keys or{" "}
          <b>W A S D</b> to take over. Turn route arrows on to see the direction
          of travel. Click a room door to view its photo.
        </p>
        {directionPad}
        <label className="campus-walking-toggle">
          <input
            type="checkbox"
            checked={showAreas}
            onChange={(e) => setShowAreas(e.target.checked)}
          />{" "}
          Show mapped walking areas
        </label>
        <button
          className="campus-reset"
          disabled={locationView}
          onClick={() => {
            cancelMovement();
            changeScene(sceneId);
          }}
        >
          <RotateCcw size={13} /> Return to entrance
        </button>
      </section>
      <p className="campus-note">
        <span>REFERENCE MAP</span>Exploration routes illustrate the supplied
        artwork. These are illustrative walking routes, not verified evacuation
        guidance.
      </p>
    </aside>
  );
  const manualControls = (
    <div className="radar-manual-controls">
      <div className="campus-map-bottom">
        <label>
          <input
            type="checkbox"
            checked={artOnly}
            disabled={locationView}
            onChange={(e) => {
              cancelMovement();
              held.current.clear();
              setArtOnly(e.target.checked);
            }}
          />{" "}
          Original artwork only
        </label>
        {sceneId === "campus" && !floorSheet && (
          <label>
            <input
              type="checkbox"
              checked={breeze}
              onChange={(event) => setBreeze(event.target.checked)}
              disabled={artOnly}
            />{" "}
            Breeze animation
          </label>
        )}
        <label>
          <input
            type="checkbox"
            checked={showRoute}
            onChange={(event) => setShowRoute(event.target.checked)}
            disabled={artOnly || floorSheet}
          />{" "}
          Show route arrows
        </label>
        <label>
          Routing engine{" "}
          <select aria-label="Routing engine" value={routeEngine}
            disabled={locationView || artOnly || floorSheet}
            onChange={(event) => {
              cancelMovement();
              setRouteEngine(event.target.value as "local" | "liferouter");
              setMessage("Simulation routing selected. Click an open area or room to walk there.");
            }}>
            <option value="local">Local</option>
            <option value="liferouter" disabled={privateSession || correction}>LifeRouter (simulation)</option>
          </select>
          {privateSession && <small> LifeRouter stays off during this private location session.</small>}
        </label>
      </div>
      {!artOnly && !floorSheet && (
        <div className="campus-status" role="status">
          <span className="campus-status-icon">
            <Footprints size={18} />
          </span>
          <p>{routeLoading ? "LifeRouter is calculating a simulation route…" : message}</p>
          {!locationView && (nearbyBuilding || nearStairs || nearExit) && (
            <button className="campus-primary" onClick={interact}>
              {nearbyBuilding
                ? "Enter building"
                : nearStairs
                  ? "Use stairs"
                  : "Exit building"}{" "}
              <kbd>E</kbd>
            </button>
          )}
        </div>
      )}
    </div>
  );
  return (
    <div
      ref={explorer}
      className={cn(
        "campus-explorer radar-dashboard",
        expanded && "campus-explorer--expanded",
      )}
      onKeyDown={keyDown}
    >
      <div className="radar-stage">
        <svg
          className="radar-landscape-background"
          viewBox="32 800 1190 295"
          preserveAspectRatio="xMidYMax slice"
          aria-hidden="true"
        >
          <image href="/maps/campus.jpg" width="1254" height="1254" />
        </svg>
        <RadarHeader onAction={navigateDashboard} />
        <div className="campus-layout radar-game-grid">
          <div className="radar-left-column">
            <SidebarNavigation
              active={dashboardAction}
              onAction={navigateDashboard}
            />
            <RadarAssistant />
          </div>
          <section
            className="campus-map-panel"
            aria-label="Interactive school artwork"
          >
            <RadarMapHeading
              indoor={floorSheet}
              disabled={locationView}
              onIndoor={() => {
                cancelMovement();
                setFloorSheet(!floorSheet);
                setZoom(1);
              }}
            />
            <div className="campus-map-toolbar">
              <span>
                <MapPin size={15} />
                <strong>
                  {floorSheet ? "Original school floor plans" : scene.name}
                </strong>
              </span>
              <div>
                <button
                  aria-label="Zoom out"
                  disabled={zoom <= 1}
                  onClick={() => setZoom((z) => Math.max(1, z - 0.25))}
                >
                  <Minus size={16} />
                </button>
                <output aria-label="Map zoom">{Math.round(zoom * 100)}%</output>
                <button
                  aria-label="Zoom in"
                  disabled={zoom >= 2.5}
                  onClick={() => setZoom((z) => Math.min(2.5, z + 0.25))}
                >
                  <Plus size={16} />
                </button>
                <button
                  aria-label="Reset map zoom"
                  onClick={() => {
                    setZoom(1);
                    viewport.current?.scrollTo(0, 0);
                  }}
                >
                  <Crosshair size={16} />
                </button>
                <button
                  aria-label={expanded ? "Exit expanded map" : "Expand map"}
                  aria-pressed={expanded}
                  onClick={() => setExpanded((e) => !e)}
                >
                  <Maximize2 size={16} />
                </button>
              </div>
            </div>
            <div
              id="campus-map"
              data-zoomed={zoom > 1}
              className={cn(
                "campus-viewport",
                indoor && "campus-viewport--indoor",
              )}
              ref={viewport}
              tabIndex={0}
              aria-label={
                locationView
                  ? "Device location map; manual walking is paused"
                  : "Map controls: arrow keys or WASD to walk, E to interact"
              }
              onBlur={() => held.current.clear()}
            >
              <svg
                ref={svg}
                viewBox={`${crop.x} ${crop.y} ${crop.width} ${crop.height}`}
                style={{ width: `${zoom * 100}%` }}
                onClick={clickMap}
                onClickCapture={
                  correction
                    ? (event) => {
                        // A correction chooses a map point, even under another marker.
                        event.stopPropagation();
                        clickMap(event);
                      }
                    : undefined
                }
                role="group"
                aria-label={
                  floorSheet
                    ? "Original floor plans for Buildings A, B and 6"
                    : `${scene.name} interactive map`
                }
              >
                {!floorSheet && scene.artworkPieces ? (
                  scene.artworkPieces.map((piece, index) => (
                    <svg
                      key={index}
                      x={piece.target.x}
                      y={piece.target.y}
                      width={piece.source.width}
                      height={piece.source.height}
                      viewBox={`${piece.source.x} ${piece.source.y} ${piece.source.width} ${piece.source.height}`}
                      overflow="hidden"
                    >
                      <image
                        href={scene.image}
                        width={scene.imageWidth}
                        height={scene.imageHeight}
                        style={{ imageRendering: "pixelated" }}
                      />
                    </svg>
                  ))
                ) : (
                  <image
                    href={floorSheet ? "/maps/floor-plans.jpg" : scene.image}
                    width={floorSheet ? 2048 : scene.imageWidth}
                    height={floorSheet ? 682 : scene.imageHeight}
                    style={{ imageRendering: "pixelated" }}
                  />
                )}
                {floorSheet &&
                  !artOnly &&
                  allRooms
                    .filter((room) =>
                      ["a1", "b1", "b2", "six1", "six2"].includes(room.scene),
                    )
                    .map((room) => (
                      <RoomDoor
                        key={room.id}
                        room={room}
                        selected={selectedRoom?.id === room.id}
                        onOpen={(room) => {
                          changeScene(room.scene);
                          openRoomPhoto(room);
                        }}
                      />
                    ))}
                {!artOnly && !floorSheet && (
                  <>
                    {sceneId === "campus" && breeze && (
                      <CampusBreeze
                        paused={Boolean(
                          photoRoom ||
                          studentId ||
                          locationDialog ||
                          buildingPopup ||
                          dashboardDialog,
                        )}
                      />
                    )}
                    {showAreas &&
                      scene.walkable.map((r, i) => (
                        <rect
                          key={i}
                          {...r}
                          fill="#78e9d6"
                          fillOpacity=".4"
                          stroke="#143845"
                          strokeWidth="1"
                          pointerEvents="none"
                        />
                      ))}
                    {!locationView && showRoute && route.length > 0 && (
                      <RouteOverlay points={[position, ...route]} />
                    )}
                    {sceneId === "campus" && <CampusLabels labelled />}
                    {sceneId === "campus" &&
                      places.map((place) => (
                        <g
                          key={place.id}
                          role="button"
                          tabIndex={0}
                          aria-label={`Explore ${place.name}`}
                          className={cn(
                            "campus-hotspot",
                            selected?.id === place.id &&
                              "campus-hotspot--selected",
                          )}
                          onClick={(e) => {
                            e.stopPropagation();
                            e.currentTarget.focus();
                            openBuilding(place);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              openBuilding(place);
                            }
                          }}
                        >
                          <title>{place.name}</title>
                          <rect {...place.bounds} rx="4" />
                        </g>
                      ))}
                    {scene.rooms.map((room) => (
                      <RoomDoor
                        key={room.id}
                        room={room}
                        selected={selectedRoom?.id === room.id}
                        onOpen={openRoomPhoto}
                      />
                    ))}
                    {scene.stairs && (
                      <g
                        role="button"
                        tabIndex={0}
                        aria-label={`Use stairs to floor ${scene.stairs.to.endsWith("2") ? 2 : 1}`}
                        className="campus-hotspot"
                        onClick={(e) => {
                          e.stopPropagation();
                          cancelMovement();
                          walkTo(scene.stairs!.point, () =>
                            changeScene(
                              scene.stairs!.to,
                              scenes[scene.stairs!.to].stairs!.point,
                            ),
                          );
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            cancelMovement();
                            walkTo(scene.stairs!.point, () =>
                              changeScene(
                                scene.stairs!.to,
                                scenes[scene.stairs!.to].stairs!.point,
                              ),
                            );
                          }
                        }}
                      >
                        <rect
                          x={scene.stairs.point.x - 27}
                          y={scene.stairs.point.y - 83}
                          width={56}
                          height={90}
                        />
                      </g>
                    )}
                    {nearbyStudents.map((student, index) => (
                      <g
                        key={student.user_id}
                        className="campus-other-student"
                        role="button"
                        tabIndex={0}
                        data-student-id={student.user_id}
                        data-animate={mapVisible && !studentId && !photoRoom}
                        transform={`translate(${student.x},${student.y})`}
                        aria-label={`View ${student.name || `student ${index + 1}`} profile`}
                        onClick={(event) => {
                          event.stopPropagation();
                          openStudent(student.user_id);
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            event.stopPropagation();
                            openStudent(student.user_id);
                          }
                        }}
                      >
                        <StudentSprite
                          avatar={student.avatar}
                          direction={student.direction}
                          moving={student.moving}
                        />
                        <text y="-38" className="campus-peer-label">
                          {student.name ? student.name.slice(0, 20) : "Student"}
                        </text>
                      </g>
                    ))}
                    {locationView && location.fix && location.alignment && (
                      <g pointerEvents="none">
                        <circle
                          className="location-uncertainty"
                          data-stale={location.status !== "live"}
                          cx={location.fix.point.x}
                          cy={location.fix.point.y}
                          r={
                            (location.fix.reading.accuracy +
                              location.alignment.residualMeters) *
                            location.alignment.metersToPixels
                          }
                        >
                          <title>
                            {location.status === "live"
                              ? "Approximate GPS accuracy area"
                              : "Last reliable position; current location uncertain or inactive"}
                          </title>
                        </circle>
                        {location.status === "live" &&
                          location.fix.heading !== null && (
                            <path
                              className="location-heading"
                              d="M0 -24 L-6 -12 L6 -12 Z"
                              transform={`translate(${location.fix.point.x},${location.fix.point.y}) rotate(${location.fix.heading})`}
                            />
                          )}
                      </g>
                    )}
                    {(!locationView || location.fix) && (
                      <Student
                        position={locationView ? location.fix!.point : position}
                        direction={
                          locationView ? location.fix!.direction : direction
                        }
                        moving={
                          locationView
                            ? location.enabled &&
                              location.status === "live" &&
                              location.fix!.moving
                            : moving
                        }
                        avatar={profile.avatar}
                        name={identity.displayName || profile.name || "You"}
                        color={identity.color}
                        live={locationView}
                        smooth={
                          locationView &&
                          location.status === "live" &&
                          Boolean(location.fix?.smooth)
                        }
                        animate={
                          mapVisible &&
                          !studentId &&
                          !photoRoom &&
                          !locationDialog &&
                          !buildingPopup &&
                          !dashboardDialog
                        }
                        onOpen={() => openStudent("self")}
                      />
                    )}
                  </>
                )}
              </svg>
            </div>
            {!artOnly && !floorSheet && !locationView && (
              <div className="campus-mobile-controls">
                <span>HOLD A DIRECTION TO WALK</span>
                {directionPad}
              </div>
            )}
            <MapLegend />
            <CurrentMission
              count={visitedRooms.length}
              onNext={() =>
                openRoomPhoto(
                  allRooms.find((room) => !visitedRooms.includes(room.id)) ??
                    allRooms[0],
                )
              }
            />
          </section>

          <div className="radar-right-column">
            <LiveConditions />
            <MiniMap
              scene={
                floorSheet
                  ? {
                      ...scene,
                      image: "/maps/floor-plans.jpg",
                      imageWidth: 2048,
                      imageHeight: 682,
                      artworkPieces: undefined,
                      crop: { x: 0, y: 0, width: 2048, height: 682 },
                    }
                  : scene
              }
              point={floorSheet ? null : displayedPosition}
              onZoom={(amount) =>
                setZoom((value) => Math.min(2.5, Math.max(1, value + amount)))
              }
              onCenter={centerOnPlayer}
            />
            <QuickActions onAction={navigateDashboard} />
          </div>
        </div>
        <BottomNavigation
          active={dashboardAction}
          onAction={navigateDashboard}
        />
      </div>
      <div className="radar-control-deck" id="radar-settings" tabIndex={-1}>
        {locationPanel}
        <div id="radar-inspect" tabIndex={-1}>
          {manualControls}
        </div>
        {explorerTools}
      </div>
      <footer className="campus-footer">
        <span>
          Campus Explorer <i>✦</i> A familiar place. A new perspective.
        </span>
        <span>Click to explore · E to interact</span>
      </footer>
      {photoRoom && (
        <RoomPhotoDialog
          key={photoRoom.id}
          room={photoRoom}
          onClose={() => setPhotoRoom(null)}
          onWalk={() => {
            const room = photoRoom;
            setPhotoRoom(null);
            chooseRoom(room);
          }}
          onRestoreFocus={() => {
            if (photoReturnFocus.current?.isConnected)
              photoReturnFocus.current.focus({ preventScroll: true });
            else viewport.current?.focus({ preventScroll: true });
          }}
        />
      )}
      {studentId && (
        <StudentProfileModal
          key={`${studentId}:${user?.id ?? "device"}`}
          studentId={studentId}
          onClose={() => setStudentId(null)}
          onRestoreFocus={() => {
            if (profileReturnFocus.current?.isConnected)
              profileReturnFocus.current.focus({ preventScroll: true });
            else viewport.current?.focus({ preventScroll: true });
          }}
        />
      )}
      {buildingPopup && (
        <BuildingPopup
          place={buildingPopup}
          gps={locationView}
          onClose={() => setBuildingPopup(null)}
          onWalk={() => {
            const place = buildingPopup;
            setBuildingPopup(null);
            choosePlace(place);
          }}
          onExplore={() => {
            if (buildingPopup.interior) changeScene(buildingPopup.interior);
            setBuildingPopup(null);
          }}
          onFloorPlan={() => {
            if (buildingPopup.interior) changeScene(buildingPopup.interior);
            setBuildingPopup(null);
          }}
          onHazards={() => {
            setBuildingPopup(null);
            setDashboardDialog("hazards");
          }}
        />
      )}
      {dashboardDialog && (
        <DashboardDialog
          ownerId={ownerId}
          action={dashboardDialog}
          onClose={() => setDashboardDialog(null)}
          onRoom={(room) => {
            setDashboardDialog(null);
            openRoomPhoto(room);
          }}
          onInspect={() => {
            setDashboardDialog(null);
            setShowRoute(true);
            requestAnimationFrame(() => navigateDashboard("inspect"));
          }}
          onProfile={() => {
            setDashboardDialog(null);
            openStudent("self");
          }}
          students={nearbyStudents}
          onStudent={(id) => {
            setDashboardDialog(null);
            openStudent(id);
          }}
        />
      )}
      {locationDialog === "identity" && (
        <IdentityDialog
          key={user?.id ?? "device"}
          onClose={() => setLocationDialog(null)}
        />
      )}
      {locationDialog === "calibration" && (
        <CalibrationDialog
          value={calibration}
          onClose={() => setLocationDialog(null)}
          onClear={() => {
            location.reset();
            setCalibration(null);
            setLocationView(false);
            setCorrection(false);
            setLocationDialog(null);
          }}
          onSave={(value) => {
            location.reset();
            setCalibration(value);
            setLocationView(false);
            setCorrection(false);
            setLocationDialog(null);
            setMessage(
              "Map calibration saved on this device. Enable location sync when you are on campus.",
            );
          }}
        />
      )}
    </div>
  );
}
