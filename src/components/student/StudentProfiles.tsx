import { useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
import { emptyStudent, validateStudent } from "../../lib/student-profile";
import type { StudentProfile } from "../../lib/student-profile";
import { readLocalStudent, saveLocalStudent } from "../../lib/local-student";
import {
  studentCloud,
  readAccountPhoto,
  readAccountProfile,
  saveAccountProfile,
} from "../../lib/student-cloud";

import { StudentProfileContext } from "./student-context";
import {
  identityKey,
  readIdentity,
  validateIdentity,
} from "../../lib/map-identity";
import type { MapIdentity } from "../../lib/map-identity";

export function StudentProfilesProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(!studentCloud);
  const [loaded, setLoaded] = useState<{
    identity: string;
    revision: number;
    profile: StudentProfile;
    photo: Blob | null;
    error: string;
  } | null>(null);
  const [saving, setSaving] = useState(false);
  const [revision, setRevision] = useState(0);
  const identity = user?.id ?? "device";
  const [localIdentities, setLocalIdentities] = useState<
    Record<string, MapIdentity>
  >({});
  const mapIdentity = useMemo(
    () => localIdentities[identity] ?? readIdentity(identity),
    [localIdentities, identity],
  );
  const currentIdentity = useRef(identity);
  const current =
    loaded?.identity === identity && loaded?.revision === revision
      ? loaded
      : null;
  const profile = current?.profile ?? emptyStudent(identity);
  const photo = current?.photo ?? null;
  const error = current?.error ?? "";
  const loading = !authReady || !current;
  useEffect(() => {
    if (!studentCloud) return;
    const { data } = studentCloud.auth.onAuthStateChange((_event, session) => {
      currentIdentity.current = session?.user.id ?? "device";
      setUser(session?.user ?? null);
      setAuthReady(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    if (!authReady) return;
    let active = true;
    (async () => {
      let account = emptyStudent(identity);
      let blob: Blob | null = null;
      let failure = "";
      try {
        if (identity === "device") {
          const local = await readLocalStudent();
          account = validateStudent(local.profile);
          blob = local.photo;
        } else {
          account = await readAccountProfile(identity);
          if (account.photo_available) blob = await readAccountPhoto(identity);
        }
      } catch (cause) {
        failure =
          cause instanceof Error
            ? cause.message
            : "Your student profile could not be loaded.";
      }
      if (active)
        setLoaded({
          identity,
          revision,
          profile: account,
          photo: blob,
          error: failure,
        });
    })();
    return () => {
      active = false;
    };
  }, [identity, authReady, revision]);

  const save = async (
    draft: StudentProfile,
    draftPhoto: Blob | null,
    photoChanged = false,
  ) => {
    const owner = identity;
    if (loading || saving || draft.user_id !== owner)
      throw new Error("Wait for your profile to load before saving.");
    if (photoChanged && profile.photo_available && !photo)
      throw new Error(
        "Load your existing photo before replacing it. Close this window and choose Reload profile.",
      );
    const next = validateStudent({
      ...draft,
      photo_available: photoChanged
        ? Boolean(draftPhoto)
        : profile.photo_available,
    });
    setSaving(true);
    try {
      const saved =
        owner === "device"
          ? (await saveLocalStudent(next, draftPhoto), next)
          : await saveAccountProfile(
              next,
              profile,
              draftPhoto,
              photo,
              photoChanged,
            );
      if (currentIdentity.current !== owner)
        throw new Error("Your account changed. Reopen your current profile.");
      setLoaded({
        identity: owner,
        revision,
        profile: saved,
        photo: draftPhoto,
        error: "",
      });
    } finally {
      setSaving(false);
    }
  };
  return (
    <StudentProfileContext.Provider
      value={{
        identity: mapIdentity,
        saveIdentity: (value) => {
          const valid = validateIdentity(value);
          localStorage.setItem(identityKey(identity), JSON.stringify(valid));
          setLocalIdentities((previous) => ({
            ...previous,
            [identity]: valid,
          }));
        },
        // Never briefly render one account's identity while another is loading.
        profile:
          profile.user_id === identity ? profile : emptyStudent(identity),
        photo: profile.user_id === identity ? photo : null,
        user,
        loading: loading || !authReady || profile.user_id !== identity,
        saving,
        error,
        configured: Boolean(studentCloud),
        save,
        reload: () => setRevision((value) => value + 1),
        signOut: async () => {
          const { error } = await studentCloud!.auth.signOut();
          if (error)
            throw new Error(
              "Sign out could not be completed. Please try again.",
            );
        },
      }}
    >
      {children}
    </StudentProfileContext.Provider>
  );
}
