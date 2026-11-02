import { useState } from "react";
import {
  addEquipment,
  addPerson,
  addTask,
  addVisitor,
  externalProviders,
  finishTask,
  lowStock,
  markAttendance,
  recordsCsv,
  searchRecords,
  visitorLeaves,
} from "../../lib/radar-records";
import { useRadar } from "./radar-context";

export function PeopleScreen() {
  const { records, update } = useRadar();
  const [name, setName] = useState("");
  const [role, setRole] = useState<"student" | "teacher" | "guardian">("student");
  const [section, setSection] = useState("");
  const [error, setError] = useState("");
  return (
    <section className="radar-screen">
      <h1>People</h1>
      <p className="campus-small">
        Use practice names only. Do not enter a real child’s private information.
        This list stays on this device and is not a school roster.
      </p>
      <form
        className="radar-form"
        onSubmit={(event) => {
          event.preventDefault();
          try {
            update((current) => addPerson(current, { name, role, section }));
            setName("");
            setError("");
          } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Could not save.");
          }
        }}
      >
        <label>
          Practice name
          <input value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <label>
          Role
          <select value={role} onChange={(event) => setRole(event.target.value as typeof role)}>
            <option value="student">student</option>
            <option value="teacher">teacher</option>
            <option value="guardian">guardian</option>
          </select>
        </label>
        <label>
          Section
          <input value={section} onChange={(event) => setSection(event.target.value)} />
        </label>
        <button className="campus-primary" type="submit">Add person</button>
        {error && <p role="alert">{error}</p>}
      </form>
      <ul className="radar-list">
        {records.people.map((person) => (
          <li key={person.id}>
            <strong>{person.role}</strong> {person.name}
            <p className="campus-small">{person.section || "No section"}</p>
            {person.role === "student" && (
              <div className="campus-location-actions">
                {(["present", "late", "absent"] as const).map((status) => (
                  <button
                    key={status}
                    type="button"
                    className="campus-secondary"
                    onClick={() =>
                      update((current) => markAttendance(current, person.id, status))
                    }
                  >
                    {status}
                  </button>
                ))}
              </div>
            )}
            <p className="campus-small">
              Today:{" "}
              {records.attendance.find(
                (mark) =>
                  mark.personId === person.id &&
                  mark.day === new Date().toISOString().slice(0, 10),
              )?.status ?? "unmarked"}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function ResourcesScreen() {
  const { records, update } = useRadar();
  const [name, setName] = useState("");
  const [location, setLocation] = useState("Building B");
  const [quantity, setQuantity] = useState(1);
  const [minimum, setMinimum] = useState(1);
  const [task, setTask] = useState("");
  const [visitor, setVisitor] = useState("");
  const [host, setHost] = useState("");
  const [error, setError] = useState("");
  const shortages = lowStock(records);
  return (
    <section className="radar-screen">
      <h1>Resources</h1>
      <p className="campus-small">
        Equipment, repair tasks, and visitor notes stay on this device.
      </p>
      {shortages.length > 0 && (
        <p role="status">Low stock: {shortages.map((item) => item.name).join(", ")}</p>
      )}
      <form
        className="radar-form"
        onSubmit={(event) => {
          event.preventDefault();
          try {
            update((current) =>
              addEquipment(current, {
                name,
                location,
                quantity,
                minimum,
                condition: "good",
              }),
            );
            setName("");
            setError("");
          } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Could not save.");
          }
        }}
      >
        <label>
          Equipment
          <input value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <label>
          Location
          <input value={location} onChange={(event) => setLocation(event.target.value)} />
        </label>
        <label>
          Quantity
          <input
            type="number"
            min={0}
            value={quantity}
            onChange={(event) => setQuantity(Number(event.target.value))}
          />
        </label>
        <label>
          Minimum
          <input
            type="number"
            min={0}
            value={minimum}
            onChange={(event) => setMinimum(Number(event.target.value))}
          />
        </label>
        <button className="campus-primary" type="submit">Add equipment</button>
      </form>
      <form
        className="radar-form"
        onSubmit={(event) => {
          event.preventDefault();
          try {
            update((current) => addTask(current, task));
            setTask("");
            setError("");
          } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Could not save.");
          }
        }}
      >
        <label>
          Repair or follow-up task
          <input value={task} onChange={(event) => setTask(event.target.value)} />
        </label>
        <button className="campus-secondary" type="submit">Add task</button>
        {error && <p role="alert">{error}</p>}
      </form>
      <ul className="radar-list">
        {records.tasks.map((item) => (
          <li key={item.id}>
            <strong>{item.status}</strong> {item.title}
            {item.status === "open" && (
              <button
                type="button"
                className="campus-secondary"
                onClick={() => update((current) => finishTask(current, item.id))}
              >
                Mark done
              </button>
            )}
          </li>
        ))}
      </ul>
      <form
        className="radar-form"
        onSubmit={(event) => {
          event.preventDefault();
          try {
            update((current) => addVisitor(current, { name: visitor, host }));
            setVisitor("");
            setHost("");
          } catch (cause) {
            setError(cause instanceof Error ? cause.message : "Could not save.");
          }
        }}
      >
        <label>
          Visitor practice name
          <input value={visitor} onChange={(event) => setVisitor(event.target.value)} />
        </label>
        <label>
          Host
          <input value={host} onChange={(event) => setHost(event.target.value)} />
        </label>
        <button className="campus-secondary" type="submit">Record arrival</button>
      </form>
      <ul className="radar-list">
        {records.visitors.map((item) => (
          <li key={item.id}>
            <strong>{item.leftAt ? "Left" : "On site"}</strong> {item.name}
            <p className="campus-small">Host: {item.host || "unspecified"}</p>
            {!item.leftAt && (
              <button
                type="button"
                className="campus-secondary"
                onClick={() => update((current) => visitorLeaves(current, item.id))}
              >
                Record departure
              </button>
            )}
          </li>
        ))}
      </ul>
      <ul className="radar-list">
        {records.equipment.map((item) => (
          <li key={item.id}>
            {item.name} · {item.quantity} at {item.location || "unspecified"} · min {item.minimum}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function ReportsScreen() {
  const { records, update } = useRadar();
  const [query, setQuery] = useState("");
  const hits = searchRecords(records, query);
  const online = typeof navigator === "undefined" ? true : navigator.onLine;
  return (
    <section className="radar-screen">
      <h1>Reports</h1>
      <p className="campus-small">
        Workspace: {records.workspaceName}. Connection: {online ? "online" : "offline"}.
        Saved records remain on this device either way. Feeds below are not connected.
      </p>
      <label>
        Workspace name
        <input
          value={records.workspaceName}
          onChange={(event) =>
            update((current) => ({
              ...current,
              workspaceName: event.target.value,
            }))
          }
        />
      </label>
      <label>
        Search this device
        <input value={query} onChange={(event) => setQuery(event.target.value)} />
      </label>
      <ul className="radar-list">
        {hits.map((hit) => (
          <li key={`${hit.kind}-${hit.label}`}>
            <strong>{hit.kind}</strong> {hit.label}
          </li>
        ))}
      </ul>
      <button
        type="button"
        className="campus-primary"
        onClick={() => {
          const blob = new Blob([recordsCsv(records)], { type: "text/csv" });
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = "radar-device-records.csv";
          link.click();
          URL.revokeObjectURL(url);
        }}
      >
        Download CSV
      </button>
      <h2>External providers</h2>
      <ul className="radar-list">
        {externalProviders.map(([name, status]) => (
          <li key={name}>
            <strong>{status}</strong> {name}
          </li>
        ))}
      </ul>
    </section>
  );
}
