import { useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  Building2,
  Camera,
  ChevronRight,
  Info,
  MapPin,
  ShieldAlert,
  X,
} from "lucide-react";
import { allRooms, scenes } from "../map/campus-data";
import { CampusLabels } from "../map/CampusLabels";
import type { Place, Room } from "../map/campus-data";
import type { CampusStudent } from "../../lib/student-profile";
import type { RadarAction } from "./RadarDashboard";

function useRestoreDialogFocus() {
  const [opener] = useState(() => document.activeElement);
  return (event: Event) => {
    event.preventDefault();
    // Do not steal focus when this dialog opens another dialog or a new scene.
    requestAnimationFrame(() => {
      if (document.querySelector('[role="dialog"]')) return;
      const target = opener?.isConnected
        ? opener
        : document.getElementById("campus-map");
      if (target instanceof HTMLElement || target instanceof SVGElement)
        target.focus({ preventScroll: true });
    });
  };
}

export function BuildingPopup({
  place,
  gps,
  onClose,
  onWalk,
  onExplore,
  onFloorPlan,
  onHazards,
}: {
  place: Place;
  gps: boolean;
  onClose: () => void;
  onWalk: () => void;
  onExplore: () => void;
  onFloorPlan: () => void;
  onHazards: () => void;
}) {
  const restoreFocus = useRestoreDialogFocus();
  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="student-overlay" />
        <Dialog.Content
          className="radar-dialog neon-frame"
          aria-describedby="building-description"
          onCloseAutoFocus={restoreFocus}
        >
          <header>
            <Building2 />
            <Dialog.Title>{place.name}</Dialog.Title>
            <Dialog.Close aria-label="Close building information">
              <X />
            </Dialog.Close>
          </header>
          <p className="radar-dialog-kicker">{place.kind}</p>
          <Dialog.Description id="building-description">
            {place.description}
          </Dialog.Description>
          {place.interior && (
            <p>
              {scenes[place.interior].rooms.length} room
              {scenes[place.interior].rooms.length === 1 ? "" : "s"} on the
              first floor. Classroom doors open their own photo cards.
            </p>
          )}
          <div className="radar-building-preview">
            <svg
              viewBox={
                place.bounds.x +
                " " +
                place.bounds.y +
                " " +
                place.bounds.width +
                " " +
                place.bounds.height
              }
              role="img"
              aria-label={place.name + " on the supplied campus map"}
            >
              <image href="/maps/campus.jpg" width="1254" height="1254" />
              <CampusLabels />
            </svg>
          </div>
          <div className="radar-dialog-actions">
            {place.arrival && (
              <button
                className="game-nav-button"
                disabled={gps}
                onClick={onWalk}
              >
                <MapPin />
                Walk to entrance
              </button>
            )}
            {place.interior && (
              <>
                <button
                  className="game-nav-button is-active"
                  disabled={gps}
                  onClick={onExplore}
                >
                  Explore building
                  <ChevronRight />
                </button>
                <button
                  className="game-nav-button"
                  disabled={gps}
                  onClick={onFloorPlan}
                >
                  Floor plan
                </button>
              </>
            )}
            <button className="game-nav-button" onClick={onHazards}>
              <ShieldAlert />
              Hazard information
            </button>
          </div>
          <p className="radar-muted">
            {gps
              ? "GPS controls your character. Choose Explore manually in location settings before entering an illustrated interior."
              : "Building locations follow the supplied artwork. Hazard assessments are not connected."}
          </p>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

const descriptions: Record<string, { title: string; text: string }> = {
  hazards: {
    title: "Hazard Map",
    text: "Verified hazard assessments are not connected for this campus. The illustration and exploration paths do not indicate a verified safe evacuation route.",
  },
  alerts: {
    title: "Alerts & Updates",
    text: "No live school alert or disaster feed is configured. Campus safety status is unverified; this screen cannot confirm that conditions are safe.",
  },
  emergency: {
    title: "Emergency assistance",
    text: "No emergency dispatch or school contact is configured. No alert has been sent. In an emergency, contact local emergency services directly using your phone and follow school staff instructions.",
  },
  report: {
    title: "Report Hazard",
    text: "Hazard reporting is unavailable until a school reporting service is configured. No report has been submitted. You can keep a room photo on this device using a classroom card.",
  },
  message: {
    title: "Message School",
    text: "School messaging is not connected. No message has been sent. A verified school contact or authenticated messaging service must be configured first.",
  },
  scan: {
    title: "Room Scan (AI)",
    text: "AI room analysis is not connected. You can open a classroom card to upload reference photos, but this app will not label them as AI hazard assessments.",
  },
  students: {
    title: "Students",
    text: "Only signed-in students who choose to share their exploration character appear here. GPS locations are never shared.",
  },
  resources: {
    title: "Preparedness resources",
    text: "Use official guidance and your school's approved procedures. The illustrated campus routes are for exploration.",
  },
  routes: {
    title: "Evacuation Routes",
    text: "Verified evacuation routes have not been configured. You can view illustrated walking routes to explore the supplied map; these are not emergency directions.",
  },
};
export function DashboardDialog({
  action,
  onClose,
  onRoom,
  onInspect,
  onProfile,
  students,
  onStudent,
}: {
  action: RadarAction;
  onClose: () => void;
  onRoom: (room: Room) => void;
  onInspect: () => void;
  onProfile: () => void;
  students: CampusStudent[];
  onStudent: (id: string) => void;
}) {
  const info = descriptions[action] ?? descriptions.resources;
  const restoreFocus = useRestoreDialogFocus();
  const handoff = useRef(false);
  const [roomId, setRoomId] = useState(allRooms[0].id);
  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="student-overlay" />
        <Dialog.Content
          className="radar-dialog neon-frame"
          onCloseAutoFocus={(event) => {
            if (handoff.current) event.preventDefault();
            else restoreFocus(event);
          }}
        >
          <header>
            <Info />
            <Dialog.Title>{info.title}</Dialog.Title>
            <Dialog.Close aria-label="Close dashboard panel">
              <X />
            </Dialog.Close>
          </header>
          <Dialog.Description>{info.text}</Dialog.Description>
          {action === "alerts" && (
            <div className="radar-notification">
              <strong>Application notice</strong>
              <p>
                Live data services need configuration. Check official sources
                for current advisories.
              </p>
              <a
                href="https://www.pagasa.dost.gov.ph/"
                target="_blank"
                rel="noreferrer"
              >
                PAGASA weather and warnings ↗
              </a>
              <a
                href="https://www.phivolcs.dost.gov.ph/"
                target="_blank"
                rel="noreferrer"
              >
                PHIVOLCS advisories ↗
              </a>
            </div>
          )}
          {(action === "scan" || action === "report") && (
            <div className="radar-room-picker">
              <label>
                Classroom
                <select
                  value={roomId}
                  onChange={(event) => setRoomId(event.target.value)}
                >
                  {allRooms.map((room) => (
                    <option key={room.id} value={room.id}>
                      {room.name}
                    </option>
                  ))}
                </select>
              </label>
              <button
                className="game-nav-button"
                onClick={() =>
                  onRoom(allRooms.find((room) => room.id === roomId)!)
                }
              >
                <Camera />
                Open classroom card
              </button>
            </div>
          )}
          {action === "routes" && (
            <button
              className="game-nav-button"
              onClick={() => {
                handoff.current = true;
                onInspect();
              }}
            >
              Open illustrated route controls
            </button>
          )}
          {action === "students" && (
            <div className="radar-student-list">
              {students.length ? (
                students.map((student, i) => (
                  <button
                    className="game-nav-button"
                    key={student.user_id}
                    onClick={() => onStudent(student.user_id)}
                  >
                    {student.name || "Student " + (i + 1)}
                    <ChevronRight />
                  </button>
                ))
              ) : (
                <p>No other students are sharing a character right now.</p>
              )}
              <button className="game-nav-button" onClick={onProfile}>
                My profile & account
              </button>
            </div>
          )}
          {action === "resources" && (
            <ul>
              <li>During earthquake shaking: drop, cover and hold on.</li>
              <li>
                Follow staff instructions and the school's approved evacuation
                plan.
              </li>
              <li>
                Keep exits clear and take part in school preparedness drills.
              </li>
              <li>
                <a
                  href="https://www.phivolcs.dost.gov.ph/"
                  target="_blank"
                  rel="noreferrer"
                >
                  Read current PHIVOLCS guidance ↗
                </a>
              </li>
            </ul>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
