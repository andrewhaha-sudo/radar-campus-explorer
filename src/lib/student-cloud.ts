import { createClient } from "@supabase/supabase-js";
import type {
  StudentProfile,
  SharedStudent,
  CampusStudent,
} from "./student-profile";
import { emptyStudent } from "./student-profile";
import project from "./student-project.json";

const url = import.meta.env.VITE_STUDENT_SUPABASE_URL ?? project.url;
const key =
  import.meta.env.VITE_STUDENT_SUPABASE_PUBLISHABLE_KEY ??
  project.publishableKey;
export const studentCloud =
  url && key
    ? createClient(url, key, {
        auth: {
          storageKey: "campus-explorer-student-auth",
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      })
    : null;
const BUCKET = "explorer-student-photos";
const photoPath = (id: string) => `${id}/portrait.webp`;
function cloud() {
  if (!studentCloud)
    throw new Error(
      "Online student accounts are not enabled for this site yet.",
    );
  return studentCloud;
}
export async function readAccountProfile(id: string): Promise<StudentProfile> {
  const client = cloud();
  const { data, error } = await client
    .from("explorer_profiles")
    .select("*")
    .eq("user_id", id)
    .maybeSingle();
  if (error)
    throw new Error(
      "Your account profile could not be loaded. Please try again.",
    );
  if (data) return data;
  const profile = emptyStudent(id);
  const inserted = await client
    .from("explorer_profiles")
    .upsert(profile, { onConflict: "user_id", ignoreDuplicates: true });
  if (inserted.error)
    throw new Error(
      "Your student profile could not be created. Please try again.",
    );
  const current = await client
    .from("explorer_profiles")
    .select("*")
    .eq("user_id", id)
    .single();
  if (current.error)
    throw new Error("Your student profile could not be loaded.");
  return current.data;
}
export async function readAccountPhoto(id: string): Promise<Blob> {
  const { data, error } = await cloud()
    .storage.from(BUCKET)
    .download(photoPath(id));
  if (error || !data)
    throw new Error("This profile photo is unavailable or no longer shared.");
  return data;
}
export async function saveAccountProfile(
  next: StudentProfile,
  previous: StudentProfile,
  photo: Blob | null,
  oldPhoto: Blob | null,
  photoChanged: boolean,
) {
  const client = cloud();
  const bucket = client.storage.from(BUCKET);
  const path = photoPath(next.user_id);
  let hidden = false;
  let changed = false;
  try {
    if (photoChanged) {
      // Hide the object before changing its bytes so a newly private photo is
      // never briefly readable using the previous visibility settings.
      const hide = await client
        .from("explorer_profiles")
        .update({ photo_available: false })
        .eq("user_id", next.user_id)
        .select("user_id")
        .single();
      if (hide.error) throw hide.error;
      hidden = true;
      changed = true;
      const result = photo
        ? await bucket.upload(path, photo, {
            contentType: "image/webp",
            upsert: true,
            cacheControl: "0",
          })
        : await bucket.remove([path]);
      if (result.error) throw result.error;
    }
    const { updated_at: _timestamp, ...values } = next;
    const { data, error } = await client
      .from("explorer_profiles")
      .update(values)
      .eq("user_id", next.user_id)
      .select("*")
      .single();
    if (error) throw error;
    return data as StudentProfile;
  } catch {
    // Restore the old bytes before restoring access if the metadata save fails.
    // Failed saves never silently fall back to a different account or device.
    let restored = !changed;
    if (changed) {
      const rollback = oldPhoto
        ? await bucket.upload(path, oldPhoto, {
            contentType: "image/webp",
            upsert: true,
            cacheControl: "0",
          })
        : await bucket.remove([path]);
      restored = !rollback.error;
    }
    if (hidden && restored)
      await client
        .from("explorer_profiles")
        .update({ photo_available: previous.photo_available })
        .eq("user_id", next.user_id);
    throw new Error(
      "Your changes could not be saved. Reload your profile and try again.",
    );
  }
}
export async function readSharedStudent(
  id: string,
): Promise<SharedStudent | null> {
  const { data, error } = await cloud().rpc("get_explorer_student", {
    target_id: id,
  });
  if (error) throw new Error("This student's profile could not be loaded.");
  return data;
}
export async function listCampusStudents(): Promise<CampusStudent[]> {
  const { data, error } = await cloud().rpc("list_explorer_students");
  if (error) throw new Error("Other students are temporarily unavailable.");
  return data ?? [];
}
