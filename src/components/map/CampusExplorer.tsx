import { useCallback, useEffect, useRef, useState } from "react";
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
  IdCard,
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
import type { Point } from "./navigation";
import { LocationSyncPanel } from "./LocationSyncPanel";
import { useLocationSync } from "./useLocationSync";
import "./campus-explorer.css";
import { cn } from "../../lib/cn";

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
}: {
  position: Point;
  direction: Direction;
  moving: boolean;
  avatar: Character;
  animate: boolean;
  onOpen: () => void;
}) {
  return (
    <g
      transform={`translate(${position.x},${position.y})`}
      className="campus-student"
      data-animate={animate}
      data-player="you"
      data-x={position.x}
      data-y={position.y}
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
      <StudentSprite avatar={avatar} direction={direction} moving={moving} />
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
  const [showRoute, setShowRoute] = useState(true);
  const [breeze, setBreeze] = useState(true);
  const [photoRoom, setPhotoRoom] = useState<Room | null>(null);
  const [studentId, setStudentId] = useState<string | null>(null);
  const profileReturnFocus = useRef<HTMLElement | null>(null);
  const [mapVisible, setMapVisible] = useState(true);
  const photoReturnFocus = useRef<HTMLElement | null>(null);
  const [zoom, setZoom] = useState(1);
  const [artOnly, setArtOnly] = useState(false);
  const [showAreas, setShowAreas] = useState(false);
  const [floorSheet, setFloorSheet] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState("");
  const player = useRef(position);
  const path = useRef<Point[]>([]);
  const arrival = useRef<(() => void) | null>(null);
  const held = useRef(new Set<string>());
  const pendingRoom = useRef<Room | null>(null);
  const svg = useRef<SVGSVGElement>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const explorer = useRef<HTMLDivElement>(null);
  const scene = scenes[sceneId];
  const [gpsPausedByUser, setGpsPausedByUser] = useState(false);
  const [calibrationPick, setCalibrationPick] = useState<number | null>(null);
  const [pickedPixel, setPickedPixel] = useState<{
    index: number;
    x: number;
    y: number;
  } | null>(null);
  const routeSource = useRef<"user" | "gps" | null>(null);
  const gps = useLocationSync(
    sceneId !== "campus",
    !artOnly && !floorSheet && !photoRoom && !studentId,
  );
  const gpsHeading = useRef(gps.heading);
  const { profile, user } = useStudentProfile();
  const { students, error: studentsError } = useCampusStudents(
    {
      scene: sceneId,
      ...position,
      direction,
      moving,
    },
    gps.enabled,
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

  const cancelMovement = useCallback(() => {
    path.current = [];
    arrival.current = null;
    pendingRoom.current = null;
    routeSource.current = null;
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
    (point: Point, onArrival?: () => void, source: "user" | "gps" = "user") => {
      const next = findPath(player.current, point, scenes[sceneId].walkable);
      if (!next) {
        setMessage(
          source === "gps"
            ? "The GPS fix is not on a connected outdoor path. The character stayed in place."
            : "That spot is blocked. Choose open grass, a walkway or a destination.",
        );
        return false;
      }
      if (source === "user") setGpsPausedByUser(true);
      held.current.clear();
      routeSource.current = source;
      path.current = next.slice(1);
      arrival.current = onArrival ?? null;
      setRoute(next);
      setMoving(true);
      return true;
    },
    [sceneId],
  );

  const choosePlace = (place: Place) => {
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
  };

  useEffect(() => {
    const room = pendingRoom.current;
    if (!room || sceneId === "campus") return;
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
  }, [sceneId, scene, walkTo, changeScene]);

  useEffect(() => {
    gpsHeading.current = gps.heading;
  }, [gps.heading]);

  useEffect(() => {
    const point = gps.placement;
    if (
      !point ||
      gpsPausedByUser ||
      sceneId !== "campus" ||
      artOnly ||
      floorSheet
    )
      return;
    if (distance(player.current, point) < 12) {
      if (gpsHeading.current) setDirection(gpsHeading.current);
      return;
    }
    walkTo(
      point,
      () => {
        if (gpsHeading.current) setDirection(gpsHeading.current);
      },
      "gps",
    );
  }, [artOnly, floorSheet, gps.placement, gpsPausedByUser, sceneId, walkTo]);

  useEffect(() => {
    if (artOnly || floorSheet || photoRoom || studentId) return;
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
  }, [scene, sceneId, artOnly, floorSheet, zoom, photoRoom, studentId]);

  useEffect(() => {
    if (!expanded) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const close = (event: globalThis.KeyboardEvent) => {
      if (
        event.key === "Escape" &&
        !event.defaultPrevented &&
        !photoRoom &&
        !studentId
      )
        setExpanded(false);
    };
    window.addEventListener("keydown", close);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", close);
    };
  }, [expanded, photoRoom, studentId]);

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
      (event.target as HTMLElement).matches("input, select, textarea, button")
    )
      return;
    const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
    if (movementKeys[key]) {
      event.preventDefault();
      setGpsPausedByUser(true);
      if (!held.current.has(key)) cancelMovement();
      held.current.add(key);
    } else if (key === "e") {
      event.preventDefault();
      interact();
    }
  };
  const clickMap = (event: React.MouseEvent<SVGSVGElement>) => {
    if (artOnly || floorSheet || photoRoom || studentId) return;
    const matrix = svg.current?.getScreenCTM();
    if (!matrix) return;
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(
      matrix.inverse(),
    );
    if (calibrationPick !== null && sceneId === "campus") {
      setPickedPixel({ index: calibrationPick, x: point.x, y: point.y });
      setCalibrationPick(null);
      setMessage(
        "Map pixel saved in the calibration form. Add the surveyed latitude and longitude, then save.",
      );
      return;
    }
    cancelMovement();
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
  const crop = floorSheet
    ? { x: 0, y: 0, width: 2048, height: 682 }
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
          disabled={artOnly || floorSheet}
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

  return (
    <div
      ref={explorer}
      className={cn("campus-explorer", expanded && "campus-explorer--expanded")}
      onKeyDown={keyDown}
    >
      <header className="campus-heading">
        <div>
          <span className="campus-eyebrow">
            <span /> EXPLORE YOUR CAMPUS
          </span>
          <h1>Campus Explorer</h1>
          <p>
            Your school map, brought to life. Pick a destination and explore.
          </p>
        </div>
        <div className="campus-profile-actions">
          <button
            type="button"
            className="campus-primary campus-save-location"
            onClick={() => {
              setGpsPausedByUser(false);
              gps.saveDemoAt({ x: player.current.x, y: player.current.y });
            }}
            disabled={gps.savingDemo || sceneId !== "campus" || floorSheet}
          >
            <MapPin size={16} />
            {gps.savingDemo ? "Reading location…" : "Save my location"}
          </button>
          <button
            className="campus-secondary"
            onClick={() => openStudent("self")}
          >
            <IdCard size={16} />
            Student profile
          </button>
          <button
            className="campus-secondary"
            onClick={() => {
              cancelMovement();
              setFloorSheet(!floorSheet);
              setZoom(1);
            }}
          >
            <Layers size={16} />
            {floorSheet ? "Back to explorer" : "Indoor floor plans"}
          </button>
        </div>
      </header>

      <div className="campus-layout">
        <section
          className="campus-map-panel"
          aria-label="Interactive school artwork"
        >
          <div className="campus-map-toolbar">
            <span>
              <MapPin size={15} />
              <strong>
                {floorSheet ? "Original school floor plans" : scene.name}
              </strong>
              {gps.tracking && (
                <span className="campus-live">Live location</span>
              )}
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
            aria-label="Map controls: arrow keys or WASD to walk, E to interact"
            onBlur={() => held.current.clear()}
          >
            <svg
              ref={svg}
              viewBox={`${crop.x} ${crop.y} ${crop.width} ${crop.height}`}
              style={{ width: `${zoom * 100}%` }}
              onClick={clickMap}
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
                    <CampusBreeze paused={Boolean(photoRoom || studentId)} />
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
                  {showRoute && route.length > 0 && (
                    <RouteOverlay points={[position, ...route]} />
                  )}
                  {sceneId === "campus" && (
                    <g aria-label="Building E sign" pointerEvents="none">
                      <rect
                        x="301"
                        y="477"
                        width="87"
                        height="24"
                        fill="#fff6d8"
                      />
                      <text
                        x="344"
                        y="498"
                        textAnchor="middle"
                        fontFamily="Arial, sans-serif"
                        fontWeight="700"
                        fontSize="25"
                        textLength="87"
                        lengthAdjust="spacingAndGlyphs"
                        fill="#181719"
                      >
                        Bldg. E
                      </text>
                    </g>
                  )}
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
                          choosePlace(place);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            choosePlace(place);
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
                  {gps.marker && sceneId === "campus" && (
                    <g className="campus-gps-marker" pointerEvents="none">
                      {gps.marker.radius && (
                        <circle
                          cx={gps.marker.point.x}
                          cy={gps.marker.point.y}
                          r={gps.marker.radius}
                          fill="#2f9d6218"
                          stroke="#1f7a49"
                          strokeDasharray="4 3"
                        />
                      )}
                      <text
                        x={gps.marker.point.x}
                        y={gps.marker.point.y - (gps.marker.radius ?? 12) - 6}
                        textAnchor="middle"
                        fill="#1f7a49"
                        fontSize="11"
                        fontWeight="700"
                      >
                        GPS
                      </text>
                    </g>
                  )}
                  <Student
                    position={position}
                    direction={direction}
                    moving={moving}
                    avatar={profile.avatar}
                    animate={mapVisible && !studentId && !photoRoom}
                    onOpen={() => openStudent("self")}
                  />
                </>
              )}
            </svg>
          </div>
          {!artOnly && !floorSheet && (
            <div className="campus-mobile-controls">
              <span>HOLD A DIRECTION TO WALK</span>
              {directionPad}
            </div>
          )}
          <div className="campus-map-bottom">
            <label>
              <input
                type="checkbox"
                checked={artOnly}
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
          </div>
          {!artOnly && !floorSheet && (
            <div className="campus-status" role="status">
              <span className="campus-status-icon">
                <Footprints size={18} />
              </span>
              <p>{message}</p>
              {(nearbyBuilding || nearStairs || nearExit) && (
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
        </section>

        <aside className="campus-sidebar">
          <LocationSyncPanel
            status={gps.status}
            statusLabel={gps.statusLabel}
            message={gps.message}
            accuracy={gps.accuracy}
            lastUpdate={gps.lastUpdate}
            enabled={gps.enabled}
            tracking={gps.tracking}
            pausedByUser={gpsPausedByUser}
            onEnable={gps.enable}
            onDisable={() => {
              if (routeSource.current === "gps") cancelMovement();
              setGpsPausedByUser(false);
              gps.disable();
            }}
            onResume={() => setGpsPausedByUser(false)}
            calibration={gps.calibration}
            onSaveCalibration={gps.saveCalibration}
            onClearCalibration={gps.clearCalibration}
            picking={calibrationPick}
            onPick={setCalibrationPick}
            pickedPixel={pickedPixel}
          />
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
                  Choose a building to explore its hallways. Click a room door
                  to view or add a photo.
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
                  Building 6’s outdoor entrance is unassigned. This view opens
                  its interior independently.
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
                          disabled={artOnly}
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
                        <p className="campus-small">
                          No places match “{query}”.
                        </p>
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
                        disabled={artOnly}
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
                  disabled={artOnly}
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
              <b>W A S D</b> to take over. Turn route arrows on to see the
              direction of travel. Click a room door to view its photo.
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
            artwork. These are illustrative walking routes, not verified
            evacuation guidance.
          </p>
        </aside>
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
    </div>
  );
}
