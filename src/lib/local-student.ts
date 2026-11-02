import type { StudentProfile } from "./student-profile";
import { emptyStudent } from "./student-profile";
interface LocalStudent {
  profile: StudentProfile;
  photo: Blob | null;
}
function database(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("campus-explorer-student", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("self");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(
        new Error(
          "Device storage is unavailable. Enable site storage to save your profile.",
        ),
      );
  });
}
export async function readLocalStudent(): Promise<LocalStudent> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction("self", "readonly");
    const request = tx.objectStore("self").get("profile");
    tx.oncomplete = () => {
      db.close();
      resolve(request.result ?? { profile: emptyStudent(), photo: null });
    };
    tx.onerror = tx.onabort = () => {
      db.close();
      reject(new Error("Your device profile could not be loaded."));
    };
  });
}
export async function saveLocalStudent(
  profile: StudentProfile,
  photo: Blob | null,
) {
  const db = await database();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction("self", "readwrite");
    tx.objectStore("self").put(
      { profile: { ...profile, user_id: "device" }, photo },
      "profile",
    );
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = tx.onabort = () => {
      db.close();
      reject(
        new Error(
          "Your profile could not be saved. Device storage may be full.",
        ),
      );
    };
  });
}
