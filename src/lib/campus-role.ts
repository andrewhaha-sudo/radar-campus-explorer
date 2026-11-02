export const campusRoles = ["Student", "Teacher", "Staff", "Visitor"] as const;
export type CampusRole = (typeof campusRoles)[number];

const STORAGE_KEY = "campus-explorer-campus-role";

interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function browserStore(): KeyValueStore | null {
  try {
    return globalThis.localStorage;
  } catch {
    return null;
  }
}

function readMap(store: KeyValueStore): Record<string, string> {
  try {
    const parsed = JSON.parse(store.getItem(STORAGE_KEY) ?? "{}") as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      return {};
    return parsed as Record<string, string>;
  } catch {
    return {};
  }
}

export function isCampusRole(value: string): value is CampusRole {
  return (campusRoles as readonly string[]).includes(value);
}

export function readCampusRole(
  userId: string,
  store?: KeyValueStore | null,
): CampusRole | "" {
  const storage = store === undefined ? browserStore() : store;
  if (!storage || !userId) return "";
  const value = readMap(storage)[userId] ?? "";
  return isCampusRole(value) ? value : "";
}

export function writeCampusRole(
  userId: string,
  role: CampusRole | "",
  store?: KeyValueStore | null,
) {
  const storage = store === undefined ? browserStore() : store;
  if (!storage || !userId) return;
  const map = readMap(storage);
  if (!role) delete map[userId];
  else map[userId] = role;
  if (Object.keys(map).length === 0) storage.removeItem(STORAGE_KEY);
  else storage.setItem(STORAGE_KEY, JSON.stringify(map));
}
