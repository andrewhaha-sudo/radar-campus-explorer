export const hazardCategories = [
  "earthquake",
  "fire",
  "weather",
  "flood",
  "blocked_pathway",
  "other",
] as const;
export type HazardCategory = (typeof hazardCategories)[number];
export type HazardStatus = "reported" | "reviewed" | "rejected";

export interface HazardReport {
  id: string;
  category: HazardCategory;
  buildingId: string;
  roomId: string;
  description: string;
  severity: "low" | "moderate" | "high";
  source: "DEMO";
  status: HazardStatus;
  createdAt: string;
  reviewedAt: string;
}

export interface RoomInspection {
  roomId: string;
  exitVisible: boolean;
  passageClear: boolean;
  equipmentVisible: boolean;
  notes: string;
  updatedAt: string;
  ai: "Not evaluated";
}

export interface LocalAlert {
  id: string;
  title: string;
  severity: "info" | "watch" | "warning";
  message: string;
  authority: string;
  createdAt: string;
  expiresAt: string;
  sms: "NOT CONFIGURED";
}

export interface SosRecord {
  id: string;
  note: string;
  createdAt: string;
  status: "recorded_on_device";
}

export interface SafetyCheckIn {
  status: "safe" | "need_help" | "unknown";
  note: string;
  updatedAt: string;
}

export interface RosterPerson {
  id: string;
  name: string;
  role: "student" | "teacher" | "guardian";
  section: string;
  linkedTo: string;
}

export interface AttendanceMark {
  id: string;
  personId: string;
  status: "present" | "absent" | "late";
  day: string;
}

export interface EquipmentItem {
  id: string;
  name: string;
  location: string;
  quantity: number;
  minimum: number;
  condition: "good" | "needs_repair" | "retired";
}

export interface RecoveryTask {
  id: string;
  title: string;
  status: "open" | "done";
  createdAt: string;
}

export interface VisitorEntry {
  id: string;
  name: string;
  host: string;
  arrivedAt: string;
  leftAt: string;
}

export interface RadarRecords {
  hazards: HazardReport[];
  inspections: RoomInspection[];
  alerts: LocalAlert[];
  sos: SosRecord[];
  checkIn: SafetyCheckIn | null;
  emergencyNumber: string;
  drill: boolean;
  demoRain: boolean;
  shaking: boolean;
  people: RosterPerson[];
  attendance: AttendanceMark[];
  equipment: EquipmentItem[];
  tasks: RecoveryTask[];
  visitors: VisitorEntry[];
  readAlertIds: string[];
  workspaceName: string;
  stamps: string[];
}

interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const STORAGE_KEY = "campus-explorer-radar-records";

export function emptyRecords(): RadarRecords {
  return {
    hazards: [],
    inspections: [],
    alerts: [],
    sos: [],
    checkIn: null,
    emergencyNumber: "",
    drill: false,
    demoRain: false,
    shaking: false,
    people: [],
    attendance: [],
    equipment: [],
    tasks: [],
    visitors: [],
    readAlertIds: [],
    workspaceName: "This device",
    stamps: [],
  };
}

export function hazardsForBuilding(records: RadarRecords, buildingId: string) {
  return records.hazards.filter(
    (hazard) => hazard.buildingId === buildingId && hazard.status !== "rejected",
  );
}

export function createHazard(
  input: Omit<HazardReport, "id" | "source" | "status" | "createdAt" | "reviewedAt">,
  now = new Date().toISOString(),
): HazardReport {
  const description = input.description.trim();
  if (!description) throw new Error("Describe what you observed.");
  return {
    ...input,
    description,
    id: `hazard-${now}-${description.length}`,
    source: "DEMO",
    status: "reported",
    createdAt: now,
    reviewedAt: "",
  };
}

export function reviewHazard(
  records: RadarRecords,
  id: string,
  decision: "reviewed" | "rejected",
  now = new Date().toISOString(),
): RadarRecords {
  return {
    ...records,
    hazards: records.hazards.map((hazard) =>
      hazard.id === id
        ? { ...hazard, status: decision, reviewedAt: now }
        : hazard,
    ),
  };
}

export function saveInspection(
  records: RadarRecords,
  inspection: Omit<RoomInspection, "updatedAt" | "ai">,
  now = new Date().toISOString(),
): RadarRecords {
  const next: RoomInspection = {
    ...inspection,
    notes: inspection.notes.trim(),
    updatedAt: now,
    ai: "Not evaluated",
  };
  return {
    ...records,
    inspections: [
      next,
      ...records.inspections.filter((item) => item.roomId !== inspection.roomId),
    ],
  };
}

export function createAlert(
  records: RadarRecords,
  input: Omit<LocalAlert, "id" | "createdAt" | "sms">,
  now = new Date().toISOString(),
): RadarRecords {
  const title = input.title.trim();
  const message = input.message.trim();
  if (!title || !message) throw new Error("Enter an alert title and message.");
  const alert: LocalAlert = {
    ...input,
    title,
    message,
    authority: input.authority.trim() || "Not a school authority",
    id: `alert-${now}`,
    createdAt: now,
    sms: "NOT CONFIGURED",
  };
  return { ...records, alerts: [alert, ...records.alerts] };
}

export function recordSos(
  records: RadarRecords,
  note: string,
  now = new Date().toISOString(),
): RadarRecords {
  const entry: SosRecord = {
    id: `sos-${now}`,
    note: note.trim(),
    createdAt: now,
    status: "recorded_on_device",
  };
  return { ...records, sos: [entry, ...records.sos] };
}

export function collectStamp(records: RadarRecords, placeId: string): RadarRecords {
  if (!placeId || records.stamps.includes(placeId)) return records;
  return { ...records, stamps: [...records.stamps, placeId] };
}

export function addPerson(
  records: RadarRecords,
  input: Omit<RosterPerson, "id" | "linkedTo"> & { linkedTo?: string },
  now = new Date().toISOString(),
): RadarRecords {
  const name = input.name.trim();
  if (!name) throw new Error("Enter a practice name.");
  const person: RosterPerson = {
    id: `person-${now}`,
    name,
    role: input.role,
    section: input.section.trim(),
    linkedTo: input.linkedTo ?? "",
  };
  return { ...records, people: [person, ...records.people] };
}

export function markAttendance(
  records: RadarRecords,
  personId: string,
  status: AttendanceMark["status"],
  day = new Date().toISOString().slice(0, 10),
): RadarRecords {
  const mark: AttendanceMark = {
    id: `attendance-${personId}-${day}`,
    personId,
    status,
    day,
  };
  return {
    ...records,
    attendance: [
      mark,
      ...records.attendance.filter((item) => item.id !== mark.id),
    ],
  };
}

export function addEquipment(
  records: RadarRecords,
  input: Omit<EquipmentItem, "id">,
  now = new Date().toISOString(),
): RadarRecords {
  const name = input.name.trim();
  if (!name) throw new Error("Name the equipment.");
  const item: EquipmentItem = {
    ...input,
    name,
    location: input.location.trim(),
    id: `equipment-${now}`,
    quantity: Math.max(0, Math.floor(input.quantity)),
    minimum: Math.max(0, Math.floor(input.minimum)),
  };
  return { ...records, equipment: [item, ...records.equipment] };
}

export function lowStock(records: RadarRecords) {
  return records.equipment.filter(
    (item) => item.condition !== "retired" && item.quantity <= item.minimum,
  );
}

export function addTask(
  records: RadarRecords,
  title: string,
  now = new Date().toISOString(),
): RadarRecords {
  const cleaned = title.trim();
  if (!cleaned) throw new Error("Describe the task.");
  const task: RecoveryTask = {
    id: `task-${now}`,
    title: cleaned,
    status: "open",
    createdAt: now,
  };
  return { ...records, tasks: [task, ...records.tasks] };
}

export function finishTask(records: RadarRecords, id: string): RadarRecords {
  return {
    ...records,
    tasks: records.tasks.map((task) =>
      task.id === id ? { ...task, status: "done" } : task,
    ),
  };
}

export function addVisitor(
  records: RadarRecords,
  input: { name: string; host: string },
  now = new Date().toISOString(),
): RadarRecords {
  const name = input.name.trim();
  if (!name) throw new Error("Enter the visitor name.");
  const visitor: VisitorEntry = {
    id: `visitor-${now}`,
    name,
    host: input.host.trim(),
    arrivedAt: now,
    leftAt: "",
  };
  return { ...records, visitors: [visitor, ...records.visitors] };
}

export function visitorLeaves(
  records: RadarRecords,
  id: string,
  now = new Date().toISOString(),
): RadarRecords {
  return {
    ...records,
    visitors: records.visitors.map((visitor) =>
      visitor.id === id ? { ...visitor, leftAt: now } : visitor,
    ),
  };
}

export function checkInWithCode(code: string, rooms: { id: string }[]) {
  const roomId = code.trim().replace(/^RADAR:/i, "");
  return rooms.some((room) => room.id === roomId) ? roomId : null;
}

export function recordsCsv(records: RadarRecords) {
  const lines = ["kind,id,summary,status,when"];
  const cell = (value: string) => `"${value.replaceAll('"', '""')}"`;
  for (const hazard of records.hazards) {
    lines.push(
      ["hazard", hazard.id, hazard.description, hazard.status, hazard.createdAt]
        .map(cell)
        .join(","),
    );
  }
  for (const mark of records.attendance) {
    lines.push(
      ["attendance", mark.id, mark.personId, mark.status, mark.day].map(cell).join(","),
    );
  }
  for (const item of records.equipment) {
    lines.push(
      [
        "equipment",
        item.id,
        `${item.name} x${item.quantity}`,
        item.condition,
        item.location,
      ]
        .map(cell)
        .join(","),
    );
  }
  return lines.join("\n");
}

export function searchRecords(records: RadarRecords, query: string) {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  const hits: { kind: string; label: string }[] = [];
  for (const hazard of records.hazards) {
    if (hazard.description.toLowerCase().includes(needle))
      hits.push({ kind: "hazard", label: hazard.description });
  }
  for (const person of records.people) {
    if (person.name.toLowerCase().includes(needle))
      hits.push({ kind: person.role, label: person.name });
  }
  for (const item of records.equipment) {
    if (item.name.toLowerCase().includes(needle))
      hits.push({ kind: "equipment", label: item.name });
  }
  for (const alert of records.alerts) {
    if (alert.title.toLowerCase().includes(needle))
      hits.push({ kind: "alert", label: alert.title });
  }
  return hits;
}

export const externalProviders = [
  ["PAGASA", "NOT CONFIGURED"],
  ["PHIVOLCS", "NOT CONFIGURED"],
  ["Twilio SMS", "NOT CONFIGURED"],
  ["Web push", "NOT CONFIGURED"],
  ["Vision model", "NOT CONFIGURED"],
] as const;

export function callTarget(number: string) {
  const trimmed = number.trim();
  if (!/^[0-9+().\-\s]{6,20}$/.test(trimmed)) return null;
  return `tel:${trimmed.replace(/[^\d+]/g, "")}`;
}

export function loadRecords(store?: KeyValueStore | null): RadarRecords {
  const storage = store === undefined ? browserStore() : store;
  if (!storage) return emptyRecords();
  try {
    const parsed = JSON.parse(storage.getItem(STORAGE_KEY) ?? "null") as
      | Partial<RadarRecords>
      | null;
    if (!parsed || typeof parsed !== "object") return emptyRecords();
    const empty = emptyRecords();
    return {
      ...empty,
      ...parsed,
      hazards: Array.isArray(parsed.hazards) ? parsed.hazards : [],
      inspections: Array.isArray(parsed.inspections) ? parsed.inspections : [],
      alerts: Array.isArray(parsed.alerts) ? parsed.alerts : [],
      sos: Array.isArray(parsed.sos) ? parsed.sos : [],
      people: Array.isArray(parsed.people) ? parsed.people : [],
      attendance: Array.isArray(parsed.attendance) ? parsed.attendance : [],
      equipment: Array.isArray(parsed.equipment) ? parsed.equipment : [],
      tasks: Array.isArray(parsed.tasks) ? parsed.tasks : [],
      visitors: Array.isArray(parsed.visitors) ? parsed.visitors : [],
      readAlertIds: Array.isArray(parsed.readAlertIds) ? parsed.readAlertIds : [],
      stamps: Array.isArray(parsed.stamps) ? parsed.stamps : [],
      workspaceName:
        typeof parsed.workspaceName === "string" && parsed.workspaceName.trim()
          ? parsed.workspaceName.trim()
          : empty.workspaceName,
    };
  } catch {
    return emptyRecords();
  }
}

export function saveRecords(records: RadarRecords, store?: KeyValueStore | null) {
  const storage = store === undefined ? browserStore() : store;
  storage?.setItem(STORAGE_KEY, JSON.stringify(records));
}

function browserStore(): KeyValueStore | null {
  try {
    return globalThis.localStorage;
  } catch {
    return null;
  }
}
