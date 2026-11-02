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
  };
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
    id: `hazard-${now}`,
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
