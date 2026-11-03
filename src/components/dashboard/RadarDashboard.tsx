import { useEffect, useRef, useState } from "react";
import * as Dropdown from "@radix-ui/react-dropdown-menu";
import {
  Bell,
  BookOpen,
  Camera,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  CloudRain,
  Compass,
  Crosshair,
  GraduationCap,
  Layers,
  Mail,
  MapPin,
  Minus,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Trees,
  TriangleAlert,
  Users,
  Waves,
  Wind,
  X,
  Zap,
  Flame,
  Droplets,
  Phone,
  CalendarDays,
  Footprints,
  School,
  IdCard,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Scene } from "../map/campus-data";
import { CampusLabels } from "../map/CampusLabels";
import type { Point } from "../map/navigation";
import { useStudentProfile } from "../student/student-context";
import { CharacterPortrait } from "../student/StudentSprite";
import { cn } from "../../lib/cn";
import { configuredSchools } from "../../lib/dashboard-config";
import "./radar-dashboard.css";

export type RadarAction =
  | "map"
  | "inspect"
  | "hazards"
  | "scan"
  | "alerts"
  | "routes"
  | "profile"
  | "emergency"
  | "students"
  | "resources"
  | "settings"
  | "report"
  | "message";
export interface DashboardActions {
  active: RadarAction;
  onAction: (action: RadarAction) => void;
}
const schools = configuredSchools;

export function RadarEmblem({ className = "" }: { className?: string }) {
  return (
    <span className={cn("radar-emblem", className)} aria-hidden="true">
      <i />
    </span>
  );
}
export function GameIcon({
  icon: Icon,
  color = "cyan",
}: {
  icon: LucideIcon;
  color?: string;
}) {
  return (
    <span className={"game-icon game-icon-" + color} aria-hidden="true">
      <Icon strokeWidth={2.6} />
    </span>
  );
}
export function RadarHeader({ onAction }: Pick<DashboardActions, "onAction">) {
  const { identity, profile, user, signOut } = useStudentProfile();
  const [school, setSchool] = useState(schools[0].id);
  const [now, setNow] = useState(() => new Date());
  const [error, setError] = useState("");
  const menuHandoff = useRef(false);
  const navigateFromMenu = (action: RadarAction) => {
    menuHandoff.current = true;
    onAction(action);
  };
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  return (
    <header className="radar-header">
      <button
        className="radar-brand"
        aria-label="Return to campus map"
        onClick={() => onAction("map")}
      >
        <RadarEmblem />
        <span>
          <h1 aria-label="Campus Explorer">RADAR</h1>
          <small>
            Real-time AI-Powered Disaster
            <br />
            Awareness and Response
          </small>
        </span>
      </button>
      <label className="game-frame radar-school">
        <School aria-hidden="true" />
        <select
          aria-label="School"
          value={school}
          onChange={(event) => {
            setSchool(event.target.value);
            onAction("map");
          }}
        >
          {schools.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
        <ChevronDown aria-hidden="true" />
      </label>
      <button
        className="game-frame radar-safety"
        onClick={() => onAction("alerts")}
      >
        <ShieldCheck aria-hidden="true" />
        <span>
          Status not verified<small>No live alert feed</small>
        </span>
      </button>
      <time className="game-frame radar-clock" dateTime={now.toISOString()}>
        <CalendarDays aria-hidden="true" />
        <span>
          {now.toLocaleDateString("en-US", {
            weekday: "short",
            month: "short",
            day: "numeric",
            year: "numeric",
            timeZone: "Asia/Manila",
          })}
          <strong>
            {now.toLocaleTimeString("en-US", {
              hour: "2-digit",
              minute: "2-digit",
              timeZone: "Asia/Manila",
            })}
          </strong>
        </span>
      </time>
      <button
        className="game-frame radar-bell"
        aria-label="Open notifications"
        onClick={() => onAction("alerts")}
      >
        <GameIcon icon={Bell} color="gold" />
        <span className="radar-badge">1</span>
      </button>
      <div className="game-frame radar-student-menu">
        <button
          aria-label="Student profile"
          onClick={() => onAction("profile")}
        >
          <span className="radar-avatar">
            <CharacterPortrait avatar={profile.avatar} />
          </span>
          <span>
            {identity.displayName || profile.name || identity.role}
            <small>
              {profile.grade
                ? profile.grade +
                  (profile.section ? " – " + profile.section : "")
                : user
                  ? "Campus account"
                  : "On this device"}
            </small>
          </span>
        </button>
        <Dropdown.Root
          onOpenChange={(open) => {
            if (open) menuHandoff.current = false;
          }}
        >
          <Dropdown.Trigger
            className="radar-menu-trigger"
            aria-label="Open account menu"
          >
            <ChevronDown />
          </Dropdown.Trigger>
          <Dropdown.Portal>
            <Dropdown.Content
              className="radar-dropdown"
              sideOffset={8}
              align="end"
              onCloseAutoFocus={(event) => {
                if (menuHandoff.current) event.preventDefault();
              }}
            >
              <Dropdown.Item onSelect={() => navigateFromMenu("profile")}>
                My profile
              </Dropdown.Item>
              <Dropdown.Item onSelect={() => navigateFromMenu("settings")}>
                Identity & location settings
              </Dropdown.Item>
              {user ? (
                <Dropdown.Item
                  onSelect={() => {
                    void signOut().catch(() =>
                      setError("Sign out failed. Please try again."),
                    );
                  }}
                >
                  Sign out
                </Dropdown.Item>
              ) : (
                <Dropdown.Item onSelect={() => navigateFromMenu("profile")}>
                  Student sign in
                </Dropdown.Item>
              )}
            </Dropdown.Content>
          </Dropdown.Portal>
        </Dropdown.Root>
      </div>
      {error && (
        <p role="alert" className="radar-header-error">
          {error}
        </p>
      )}
    </header>
  );
}
const leftItems: {
  action: RadarAction;
  label: string;
  icon: LucideIcon;
  color: string;
}[] = [
  { action: "map", label: "Campus Map", icon: MapPin, color: "cyan" },
  { action: "hazards", label: "Hazard Map", icon: Layers, color: "cyan" },
  { action: "scan", label: "Room Scan (AI)", icon: Camera, color: "silver" },
  { action: "alerts", label: "Alerts & Updates", icon: Bell, color: "gold" },
  {
    action: "routes",
    label: "Evacuation Routes",
    icon: Footprints,
    color: "green",
  },
  { action: "profile", label: "My Profile", icon: IdCard, color: "cyan" },
  { action: "emergency", label: "Emergency", icon: Phone, color: "silver" },
];
export function SidebarNavigation({ active, onAction }: DashboardActions) {
  return (
    <nav className="radar-left-nav neon-frame" aria-label="Main navigation">
      <div className="radar-nav-buttons">
        {leftItems.map(({ action, label, icon, color }) => (
          <button
            key={action}
            aria-label={label}
            className={cn(
              "game-nav-button",
              active === action && "is-active",
              action === "emergency" && "is-emergency",
            )}
            aria-current={active === action ? "page" : undefined}
            onClick={() => onAction(action)}
          >
            <GameIcon icon={icon} color={color} />
            <span>{label}</span>
            {action === "alerts" && <span className="radar-badge">1</span>}
          </button>
        ))}
      </div>
      <div className="radar-nav-landscape" aria-hidden="true">
        <RadarEmblem />
      </div>
    </nav>
  );
}
const bottomItems: { action: RadarAction; label: string; icon: LucideIcon }[] =
  [
    { action: "map", label: "Map", icon: MapPin },
    { action: "inspect", label: "Inspect", icon: Search },
    { action: "scan", label: "Scan", icon: Camera },
    { action: "alerts", label: "Alerts", icon: Bell },
    { action: "routes", label: "Routes", icon: Footprints },
    { action: "students", label: "Students", icon: Users },
    { action: "resources", label: "Resources", icon: BookOpen },
    { action: "settings", label: "Settings", icon: Settings },
  ];
export function BottomNavigation({ active, onAction }: DashboardActions) {
  return (
    <nav className="radar-bottom-nav" aria-label="Game navigation">
      {bottomItems.map(({ action, label, icon }, i) => (
        <div key={action} className="radar-bottom-item">
          {i === 4 && (
            <button
              className="radar-center-emblem"
              aria-label="Return to campus overview"
              onClick={() => onAction("map")}
            >
              <RadarEmblem />
            </button>
          )}
          <button
            className={cn("game-nav-button", active === action && "is-active")}
            onClick={() => onAction(action)}
            aria-current={active === action ? "page" : undefined}
          >
            <GameIcon
              icon={icon}
              color={action === "alerts" ? "silver" : "cyan"}
            />
            <span>{label}</span>
          </button>
        </div>
      ))}
    </nav>
  );
}
export function RadarMapHeading({
  indoor,
  onIndoor,
  disabled,
}: {
  indoor: boolean;
  onIndoor: () => void;
  disabled: boolean;
}) {
  return (
    <div className="radar-map-heading">
      <div className="radar-element-icons" aria-hidden="true">
        <Trees />
        <Droplets />
        <Zap />
        <Flame />
      </div>
      <div className="radar-map-title">
        <strong>
          SCHOOL <em>EARTHQUAKE</em>
        </strong>
        <b>HAZARD MAP</b>
        <span>CAMPUS REGION – SAFETY ROUTE MAP</span>
      </div>
      <button
        className="radar-floor-button"
        aria-label={indoor ? "Back to explorer" : "Indoor floor plans"}
        title="Indoor floor plans"
        disabled={disabled}
        onClick={onIndoor}
      >
        <GraduationCap />
        <Layers />
      </button>
    </div>
  );
}
export function MapLegend() {
  return (
    <div className="radar-map-legend">
      <strong>LEGEND</strong>
      <span>
        <i className="legend-route" />
        Illustrated
        <br />
        walking route
      </span>
      <span>
        <i className="legend-field" />
        Court / field
      </span>
      <span>
        <i className="legend-road" />
        Road / walkway
      </span>
      <span>
        <School />
        Building
      </span>
    </div>
  );
}
function Panel({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: LucideIcon;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  return (
    <section className="radar-panel neon-frame">
      <h2>
        <Icon aria-hidden="true" />
        {title}
        <button
          aria-label={(open ? "Collapse " : "Expand ") + title}
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          {open ? <X /> : <Plus />}
        </button>
      </h2>
      {open && children}
    </section>
  );
}
export function LiveConditions() {
  return (
    <Panel title="Live Conditions" icon={Zap}>
      <div className="radar-weather">
        <CloudRain className="radar-weather-icon" aria-hidden="true" />
        <div>
          <h3>Not connected</h3>
          <span className="radar-feed-label">LIVE DATA UNAVAILABLE</span>
        </div>
        <strong>— °C</strong>
        <div>
          <span>
            <Wind /> Wind: —
          </span>
          <span>
            <Droplets /> Humidity: —
          </span>
        </div>
      </div>
      <DisasterWatch />
    </Panel>
  );
}
export function DisasterWatch() {
  return (
    <div className="radar-disaster-watch">
      <h3>
        Disaster Watch <small>(PAGASA & PHIVOLCS)</small>
      </h3>
      {[
        { label: "Typhoon", icon: Wind },
        { label: "Earthquake", icon: Zap },
        { label: "Volcanic", icon: Flame },
        { label: "Flood", icon: Waves },
      ].map(({ label, icon: Icon }) => (
        <div key={label}>
          <Icon aria-hidden="true" />
          <span>
            {label} <b>— Not verified</b>
          </span>
        </div>
      ))}
    </div>
  );
}
export function MiniMap({
  scene,
  point,
  onZoom,
  onCenter,
}: {
  scene: Scene;
  point: Point | null;
  onZoom: (amount: number) => void;
  onCenter: () => void;
}) {
  const crop =
    scene.image === "/maps/campus.jpg"
      ? {
          x: 32,
          y: Math.max(245, Math.min(700, (point?.y ?? 775) - 530)),
          width: 1190,
          height: 550,
        }
      : scene.crop;
  return (
    <Panel title="Mini Map" icon={Compass}>
      <div className="radar-minimap-body">
        <svg
          viewBox={crop.x + " " + crop.y + " " + crop.width + " " + crop.height}
          aria-label="Mini map showing your current displayed position"
          role="img"
        >
          {scene.artworkPieces ? (
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
                />
              </svg>
            ))
          ) : (
            <image
              href={scene.image}
              width={scene.imageWidth}
              height={scene.imageHeight}
            />
          )}
          {scene.image === "/maps/campus.jpg" && <CampusLabels />}
          {point && (
            <g transform={"translate(" + point.x + "," + point.y + ")"}>
              <circle r={crop.width / 28} fill="#0aeaff" fillOpacity=".25" />
              <path
                d="M0 -26L-17 20 0 10 17 20Z"
                fill="#15d8ff"
                stroke="#fff"
                strokeWidth="6"
              />
            </g>
          )}
        </svg>
        <div className="radar-minimap-tools">
          <button aria-label="Mini map zoom in" onClick={() => onZoom(0.25)}>
            <Plus />
          </button>
          <button aria-label="Mini map zoom out" onClick={() => onZoom(-0.25)}>
            <Minus />
          </button>
          <button aria-label="Center map on your character" onClick={onCenter}>
            <Crosshair />
          </button>
        </div>
      </div>
    </Panel>
  );
}
export function QuickActions({ onAction }: Pick<DashboardActions, "onAction">) {
  return (
    <Panel title="Quick Actions" icon={Zap}>
      <div className="radar-quick-actions">
        {(
          [
            { action: "scan", label: "Scan Room", icon: Camera },
            { action: "report", label: "Report Hazard", icon: TriangleAlert },
            { action: "emergency", label: "SOS Emergency", icon: Phone },
            { action: "message", label: "Message School", icon: Mail },
          ] as const
        ).map(({ action, label, icon: Icon }) => (
          <button
            key={action}
            className={"quick-" + action}
            onClick={() => onAction(action)}
          >
            <Icon />
            <span>{label}</span>
          </button>
        ))}
      </div>
    </Panel>
  );
}
export function CurrentMission({
  count,
  onNext,
}: {
  count: number;
  onNext: () => void;
}) {
  return (
    <button className="radar-current-mission game-frame" onClick={onNext}>
      <span>
        <ClipboardList />
        Current Mission
      </span>
      <div>
        <ClipboardList />
        <p>
          <strong>Explore classrooms ({Math.min(count, 3)}/3)</strong>
          <small>
            {count >= 3
              ? "Complete! Keep exploring your campus."
              : "Open three different classroom cards."}
          </small>
        </p>
        <ChevronRight />
      </div>
    </button>
  );
}
export function RadarAssistant() {
  const [open, setOpen] = useState(false);
  return (
    <div className="radar-assistant">
      <svg
        viewBox="0 0 100 120"
        className="radar-mascot"
        role="img"
        aria-label="Original RADAR owl assistant"
      >
        <path
          d="M16 43L5 8 36 25Q50 16 64 25L95 8 84 43Q98 75 76 96L82 114H58L52 101 44 114H20L26 96Q3 76 16 43Z"
          fill="#ffc83d"
          stroke="#101c47"
          strokeWidth="4"
        />
        <path
          d="M18 62Q0 74 5 91L28 81M82 62Q100 74 95 91L73 81"
          fill="#19b4e7"
          stroke="#101c47"
          strokeWidth="4"
        />
        <path
          d="M28 76H72L79 103H21Z"
          fill="#f0f8ff"
          stroke="#101c47"
          strokeWidth="3"
        />
        <path
          d="M44 78L50 91 57 78M50 91V105"
          fill="none"
          stroke="#1469c0"
          strokeWidth="3"
        />
        <ellipse cx="33" cy="53" rx="17" ry="21" fill="white" />
        <ellipse cx="67" cy="53" rx="17" ry="21" fill="white" />
        <ellipse cx="37" cy="54" rx="7" ry="12" fill="#13254c" />
        <ellipse cx="63" cy="54" rx="7" ry="12" fill="#13254c" />
        <path d="M43 67H57L50 76Z" fill="#e97624" />
        <path
          d="M15 33Q17 12 48 13Q74 13 78 32Z"
          fill="#f9fbff"
          stroke="#101c47"
          strokeWidth="3"
        />
        <path
          d="M14 32H89L85 39H13Z"
          fill="#168dce"
          stroke="#101c47"
          strokeWidth="3"
        />
        <path d="M44 18H55V30H44Z" fill="#e03f51" />
        <path d="M40 22H59V26H40Z" fill="#e03f51" />
        <path
          d="M62 84L87 80 93 107 68 111Z"
          fill="#226ee2"
          stroke="#101c47"
          strokeWidth="3"
        />
        <path d="M68 88L83 86 86 100 71 103Z" fill="#7deaff" />
      </svg>
      <button
        className="radar-speech"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <strong>RADAR Assistant</strong>
        <span>
          {open
            ? "Use WASD or arrows to explore. Click a building for its details. Room cards can hold your photos. GPS needs verified calibration. Static help · AI is not connected."
            : "Explore the campus, view rooms, and get to know your school!"}
        </span>
        <ChevronDown />
      </button>
    </div>
  );
}
