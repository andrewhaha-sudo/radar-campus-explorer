export interface RoomPhoto {
  roomId: string;
  blob: Blob;
  name: string;
  updatedAt: number;
}
export interface PublishedPhoto {
  src: string;
  caption?: string;
}
const DATABASE = "campus-explorer-photos";
const STORE = "room-photos";
const TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () =>
      request.result.createObjectStore(STORE, { keyPath: "roomId" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(new Error("Photo storage is unavailable in this browser."));
    request.onblocked = () =>
      reject(new Error("Close other Campus Explorer tabs and try again."));
  });
}

export async function readRoomPhoto(roomId: string): Promise<RoomPhoto | null> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE, "readonly");
    const request = transaction.objectStore(STORE).get(roomId);
    transaction.oncomplete = () => {
      database.close();
      resolve(request.result ?? null);
    };
    transaction.onabort = transaction.onerror = () => {
      database.close();
      reject(new Error("Your saved photo could not be loaded."));
    };
  });
}

export async function saveRoomPhoto(
  roomId: string,
  file: File,
): Promise<RoomPhoto> {
  if (!TYPES.has(file.type))
    throw new Error("Choose a JPG, PNG, WebP or GIF image.");
  if (!file.size || file.size > 10 * 1024 * 1024)
    throw new Error("Choose an image smaller than 10 MB.");
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
  } catch {
    throw new Error(
      "This file could not be opened as an image. Try another photo.",
    );
  } finally {
    URL.revokeObjectURL(url);
  }
  const photo = { roomId, blob: file, name: file.name, updatedAt: Date.now() };
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE, "readwrite");
    transaction.objectStore(STORE).put(photo);
    transaction.oncomplete = () => {
      database.close();
      resolve(photo);
    };
    transaction.onabort = transaction.onerror = () => {
      database.close();
      reject(
        new Error(
          "The photo could not be saved. Your browser storage may be full.",
        ),
      );
    };
  });
}

export async function publishedRoomPhoto(
  roomId: string,
): Promise<PublishedPhoto | null> {
  const response = await fetch("/room-photos.json");
  if (!response.ok)
    throw new Error("Published room photos could not be loaded.");
  const manifest: Record<string, PublishedPhoto | undefined> =
    await response.json();
  const photo = manifest[roomId];
  if (!photo || typeof photo.src !== "string") return null;
  const url = new URL(photo.src, location.origin);
  if (
    url.origin !== location.origin ||
    !url.pathname.startsWith("/room-photos/")
  )
    return null;
  return {
    src: url.href,
    caption: typeof photo.caption === "string" ? photo.caption : undefined,
  };
}
