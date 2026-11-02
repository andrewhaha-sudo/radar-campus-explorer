import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { HelpCircle, Radar } from "lucide-react";
import { CampusExplorer } from "../map/CampusExplorer";
import { allRooms, places } from "../map/campus-data";
import { illustrationBuilding } from "../map/campus-data";
import {
  callTarget,
  createAlert,
  createHazard,
  hazardCategories,
  recordSos,
  reviewHazard,
  saveInspection,
} from "../../lib/radar-records";
import { safetyGuidance } from "../../lib/safety-guidance";
import { useRadar } from "./radar-context";
import { PeopleScreen, ReportsScreen, ResourcesScreen } from "./Operations";
import { checkInWithCode } from "../../lib/radar-records";
import { formatRoute, parseRoute, radarScreens } from "../../lib/radar-route";
import "./radar.css";

const screenLabels: Record<(typeof radarScreens)[number], string> = {
  campus: "Campus",
  hazards: "Hazards",
  inspect: "Inspect",
  alerts: "Alerts",
  safety: "Safety",
  sos: "SOS",
  people: "People",
  resources: "Resources",
  reports: "Reports",
};

export function RadarShell() {
  const [screen, setScreen] = useState(() => parseRoute(window.location.hash));
  const [guide, setGuide] = useState<"play" | "safety" | null>(null);
  const { records } = useRadar();
  useEffect(() => {
    const sync = () => setScreen(parseRoute(window.location.hash));
    window.addEventListener("hashchange", sync);
    return () => window.removeEventListener("hashchange", sync);
  }, []);
  const open = (id: (typeof radarScreens)[number]) => {
    const next = formatRoute(id);
    if (window.location.hash === next) setScreen(id);
    else window.location.hash = next;
  };
  return (
    <>
      <header className="radar-brandbar">
        <div className="radar-brand">
          <span className="radar-logo" aria-hidden="true">
            <Radar size={22} strokeWidth={1.8} />
          </span>
          <span>
            <strong>
              RADAR<span>.</span>
            </strong>
            <small>KNOW YOUR CAMPUS. FIND YOUR WAY.</small>
          </span>
        </div>
        <button type="button" className="radar-help" onClick={() => setGuide("play")}>
          <HelpCircle size={16} />
          How to play
        </button>
      </header>
      <nav className="radar-nav" aria-label="RADAR sections">
        {radarScreens.map((id) => (
          <button
            key={id}
            type="button"
            aria-current={screen === id ? "page" : undefined}
            onClick={() => open(id)}
          >
            {screenLabels[id]}
            {id === "alerts" && records.alerts.length > 0
              ? ` (${records.alerts.length})`
              : ""}
          </button>
        ))}
        <button type="button" onClick={() => setGuide("safety")}>
          Safety guide
        </button>
      </nav>
      <Dialog.Root open={guide !== null} onOpenChange={(open) => !open && setGuide(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="radar-guide-modal" />
          <Dialog.Content className="radar-guide-card radar-guide">
            <Dialog.Title>
              {guide === "safety"
                ? "Explore with awareness."
                : "Your campus adventure starts here."}
            </Dialog.Title>
            <Dialog.Description>
              {guide === "safety"
                ? "Demonstration information, not an official emergency plan."
                : "The illustrated campus, your character, and the records already on this device."}
            </Dialog.Description>
            {guide === "safety" ? (
              <>
                <p>
                  Colored areas appear only where this device has a saved DEMO
                  hazard report. They are not a school risk assessment.
                </p>
                <p>
                  The assembly preview walks toward the Covered Court on the
                  artwork. It is not a verified evacuation route. During marked
                  shaking, the app does not start that walk.
                </p>
                <p>
                  In a real emergency, follow school personnel and the official
                  plan. SOS on this app is recorded on the device and is not a
                  dispatch.
                </p>
              </>
            ) : (
              <>
                <p>
                  Walk by clicking open ground, or use the arrow keys and W A S
                  D. Press E near a door, stair, or exit.
                </p>
                <p>
                  Choose a place to collect its stamp and walk there. Save my
                  location stores a DEMO map calibration from this phone. GPS
                  stays off until you turn it on, and that position is not sent
                  to other students.
                </p>
                <p>
                  Indoor floor plans use the supplied artwork. A GPS reading
                  does not change your floor or room.
                </p>
              </>
            )}
            <Dialog.Close className="campus-primary" type="button">
              Close
            </Dialog.Close>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
      {records.drill && (
        <p className="radar-banner radar-banner--drill" role="status">
          SIMULATION. Drill mode is on. These records are practice on this device.
        </p>
      )}
      {screen === "campus" && <CampusExplorer />}
      {screen === "hazards" && <HazardsScreen />}
      {screen === "inspect" && <InspectScreen />}
      {screen === "alerts" && <AlertsScreen />}
      {screen === "safety" && <SafetyScreen />}
      {screen === "sos" && <SosScreen />}
      {screen === "people" && <PeopleScreen />}
      {screen === "resources" && <ResourcesScreen />}
      {screen === "reports" && <ReportsScreen />}
    </>
  );
}

function HazardsScreen() {
  const { records, update } = useRadar();
  const [buildingId, setBuildingId] = useState("b");
  const [roomId, setRoomId] = useState("");
  const [category, setCategory] = useState<(typeof hazardCategories)[number]>("blocked_pathway");
  const [severity, setSeverity] = useState<"low" | "moderate" | "high">("moderate");
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const rooms = illustrationBuilding(buildingId).flatMap((floor) => floor.rooms);
  return (
    <section className="radar-screen">
      <h1>Hazard reports</h1>
      <p className="campus-small">
        DEMO reports stay on this device. Reviewing one does not make it a
        school-verified hazard.
      </p>
      <form
        className="radar-form"
        onSubmit={(event) => {
          event.preventDefault();
          try {
            const hazard = createHazard({
              category,
              buildingId,
              roomId,
              description,
              severity,
            });
            update((current) => ({
              ...current,
              hazards: [hazard, ...current.hazards],
            }));
            setDescription("");
            setError("");
          } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Could not save.");
          }
        }}
      >
        <label>
          Building
          <select value={buildingId} onChange={(event) => {
            setBuildingId(event.target.value);
            setRoomId("");
          }}>
            {places.filter((place) => illustrationBuilding(place.id).length).map((place) => (
              <option key={place.id} value={place.id}>{place.name}</option>
            ))}
          </select>
        </label>
        <label>
          Room
          <select value={roomId} onChange={(event) => setRoomId(event.target.value)}>
            <option value="">Not a specific room</option>
            {rooms.map((room) => (
              <option key={room.id} value={room.id}>{room.name}</option>
            ))}
          </select>
        </label>
        <label>
          Category
          <select value={category} onChange={(event) => setCategory(event.target.value as typeof category)}>
            {hazardCategories.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <label>
          Severity
          <select value={severity} onChange={(event) => setSeverity(event.target.value as typeof severity)}>
            <option>low</option>
            <option>moderate</option>
            <option>high</option>
          </select>
        </label>
        <label>
          What did you observe?
          <textarea value={description} onChange={(event) => setDescription(event.target.value)} />
        </label>
        <button className="campus-primary" type="submit">Save DEMO report</button>
        {error && <p role="alert">{error}</p>}
      </form>
      <ul className="radar-list">
        {records.hazards.map((hazard) => (
          <li key={hazard.id}>
            <strong>{hazard.status.toUpperCase()}</strong> {hazard.category} · {hazard.severity}
            <p>{hazard.description}</p>
            <p className="campus-small">Source: DEMO. Room: {hazard.roomId || "unspecified"}.</p>
            {hazard.status === "reported" && (
              <div className="campus-location-actions">
                <button type="button" className="campus-secondary" onClick={() => update((current) => reviewHazard(current, hazard.id, "reviewed"))}>
                  Mark reviewed
                </button>
                <button type="button" className="campus-secondary" onClick={() => update((current) => reviewHazard(current, hazard.id, "rejected"))}>
                  Reject
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function RoomCodeCheck() {
  const [code, setCode] = useState("");
  const [result, setResult] = useState("");
  return (
    <form
      className="radar-form"
      onSubmit={(event) => {
        event.preventDefault();
        const roomId = checkInWithCode(code, allRooms);
        setResult(
          roomId
            ? `Checked in at ${roomId} on this device.`
            : "That room code is not on this map.",
        );
      }}
    >
      <label>
        Check in with a room code
        <input value={code} onChange={(event) => setCode(event.target.value)} placeholder="RADAR:B-101" />
      </label>
      <button className="campus-secondary" type="submit">Check in</button>
      {result && <p role="status">{result}</p>}
    </form>
  );
}

function InspectScreen() {
  const { records, update } = useRadar();
  const [roomId, setRoomId] = useState(allRooms[0]?.id ?? "");
  const saved = records.inspections.find((item) => item.roomId === roomId);
  const [exitVisible, setExitVisible] = useState(saved?.exitVisible ?? false);
  const [passageClear, setPassageClear] = useState(saved?.passageClear ?? false);
  const [equipmentVisible, setEquipmentVisible] = useState(saved?.equipmentVisible ?? false);
  const [notes, setNotes] = useState(saved?.notes ?? "");
  return (
    <section className="radar-screen">
      <h1>Room inspection</h1>
      <p className="campus-small">
        Checklist answers stay on this device. AI review: Not evaluated. No model
        is connected, and a photo cannot certify structural or fire safety.
      </p>
      <form
        className="radar-form"
        onSubmit={(event) => {
          event.preventDefault();
          update((current) =>
            saveInspection(current, {
              roomId,
              exitVisible,
              passageClear,
              equipmentVisible,
              notes,
            }),
          );
        }}
      >
        <label>
          Room
          <select
            value={roomId}
            onChange={(event) => {
              const next = event.target.value;
              const existing = records.inspections.find((item) => item.roomId === next);
              setRoomId(next);
              setExitVisible(existing?.exitVisible ?? false);
              setPassageClear(existing?.passageClear ?? false);
              setEquipmentVisible(existing?.equipmentVisible ?? false);
              setNotes(existing?.notes ?? "");
            }}
          >
            {allRooms.map((room) => (
              <option key={room.id} value={room.id}>{room.name}</option>
            ))}
          </select>
        </label>
        <label><input type="checkbox" checked={exitVisible} onChange={(event) => setExitVisible(event.target.checked)} /> Exit is visible</label>
        <label><input type="checkbox" checked={passageClear} onChange={(event) => setPassageClear(event.target.checked)} /> Passage is clear</label>
        <label><input type="checkbox" checked={equipmentVisible} onChange={(event) => setEquipmentVisible(event.target.checked)} /> Emergency equipment is visible</label>
        <label>
          Notes
          <textarea value={notes} onChange={(event) => setNotes(event.target.value)} />
        </label>
        <button className="campus-primary" type="submit">Save inspection draft</button>
      </form>
      <p className="campus-small">Room code: RADAR:{roomId}</p>
      <RoomCodeCheck />
      {saved && (
        <p role="status">Saved {saved.updatedAt}. AI review: {saved.ai}.</p>
      )}
    </section>
  );
}

function AlertsScreen() {
  const { records, update } = useRadar();
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [severity, setSeverity] = useState<"info" | "watch" | "warning">("info");
  const [authority, setAuthority] = useState("Not a school authority");
  const [error, setError] = useState("");
  return (
    <section className="radar-screen">
      <h1>Alerts</h1>
      <p className="campus-small">
        Alerts are stored on this device. SMS is NOT CONFIGURED. Nothing is sent
        to a school or responder.
      </p>
      <form
        className="radar-form"
        onSubmit={(event) => {
          event.preventDefault();
          try {
            const expires = new Date(Date.now() + 60 * 60 * 1000).toISOString();
            update((current) =>
              createAlert(current, { title, message, severity, authority, expiresAt: expires }),
            );
            setTitle("");
            setMessage("");
            setError("");
          } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Could not save.");
          }
        }}
      >
        <label>Title <input value={title} onChange={(event) => setTitle(event.target.value)} /></label>
        <label>
          Severity
          <select value={severity} onChange={(event) => setSeverity(event.target.value as typeof severity)}>
            <option>info</option>
            <option>watch</option>
            <option>warning</option>
          </select>
        </label>
        <label>Issuing authority <input value={authority} onChange={(event) => setAuthority(event.target.value)} /></label>
        <label>Message <textarea value={message} onChange={(event) => setMessage(event.target.value)} /></label>
        <button className="campus-primary" type="submit">Save alert on this device</button>
        {error && <p role="alert">{error}</p>}
      </form>
      <ul className="radar-list">
        {records.alerts.map((alert) => (
          <li key={alert.id}>
            <strong>{alert.severity}</strong> {alert.title}
            <p>{alert.message}</p>
            <p className="campus-small">
              {alert.authority}. SMS: {alert.sms}. Expires {alert.expiresAt}.
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function SafetyScreen() {
  const { records, update } = useRadar();
  const guidance = safetyGuidance(records.shaking);
  return (
    <section className="radar-screen">
      <h1>Safety</h1>
      <label>
        <input
          type="checkbox"
          checked={records.shaking}
          onChange={(event) =>
            update((current) => ({ ...current, shaking: event.target.checked }))
          }
        />
        Mark earthquake shaking
      </label>
      <label>
        <input
          type="checkbox"
          checked={records.drill}
          onChange={(event) =>
            update((current) => ({ ...current, drill: event.target.checked }))
          }
        />
        Drill mode
      </label>
      <label>
        <input
          type="checkbox"
          checked={records.demoRain}
          onChange={(event) =>
            update((current) => ({ ...current, demoRain: event.target.checked }))
          }
        />
        DEMO rain on the campus illustration
      </label>
      <article className="radar-guidance" data-safety-mode={guidance.mode}>
        <h2>{guidance.title}</h2>
        <p>{guidance.detail}</p>
      </article>
      <h2>Check in</h2>
      <p className="campus-small">
        A check-in does not prove anyone is safe, and it is not a location.
      </p>
      <div className="campus-location-actions">
        {(["safe", "need_help", "unknown"] as const).map((status) => (
          <button
            key={status}
            type="button"
            className="campus-secondary"
            onClick={() =>
              update((current) => ({
                ...current,
                checkIn: {
                  status,
                  note: "",
                  updatedAt: new Date().toISOString(),
                },
              }))
            }
          >
            {status === "need_help" ? "Need help" : status}
          </button>
        ))}
      </div>
      {records.checkIn && (
        <p role="status">
          Check-in: {records.checkIn.status}. Saved {records.checkIn.updatedAt}.
        </p>
      )}
    </section>
  );
}

function SosScreen() {
  const { records, update } = useRadar();
  const [note, setNote] = useState("");
  const [number, setNumber] = useState(records.emergencyNumber);
  const target = callTarget(records.emergencyNumber);
  return (
    <section className="radar-screen">
      <h1>SOS</h1>
      <p className="campus-small">
        A record here stays on this device. No rescue is dispatched and no SMS
        is sent.
      </p>
      <form
        className="radar-form"
        onSubmit={(event) => {
          event.preventDefault();
          update((current) => recordSos(current, note));
          setNote("");
        }}
      >
        <label>
          What should a person nearby know?
          <textarea value={note} onChange={(event) => setNote(event.target.value)} />
        </label>
        <button className="campus-primary" type="submit">Record SOS on this device</button>
      </form>
      <form
        className="radar-form"
        onSubmit={(event) => {
          event.preventDefault();
          update((current) => ({ ...current, emergencyNumber: number.trim() }));
        }}
      >
        <label>
          Emergency number for this device
          <input
            value={number}
            onChange={(event) => setNumber(event.target.value)}
            inputMode="tel"
            placeholder="Not configured"
          />
        </label>
        <button className="campus-secondary" type="submit">Save number</button>
      </form>
      {target ? (
        <a className="campus-primary" href={target}>Call saved number</a>
      ) : (
        <p>No emergency number configured.</p>
      )}
      <ul className="radar-list">
        {records.sos.map((entry) => (
          <li key={entry.id}>
            <strong>Recorded on this device</strong>
            <p>{entry.note || "No note."}</p>
            <p className="campus-small">{entry.createdAt}. No rescue was dispatched.</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
