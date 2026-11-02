import { createContext, useContext } from "react";
import type { User } from "@supabase/supabase-js";
import type { StudentProfile } from "../../lib/student-profile";
import type { MapIdentity } from "../../lib/map-identity";

export interface ProfilesContext {
  identity: MapIdentity;
  saveIdentity: (identity: MapIdentity) => void;
  profile: StudentProfile;
  photo: Blob | null;
  user: User | null;
  loading: boolean;
  saving: boolean;
  error: string;
  configured: boolean;
  save: (
    profile: StudentProfile,
    photo: Blob | null,
    photoChanged?: boolean,
  ) => Promise<void>;
  reload: () => void;
  signOut: () => Promise<void>;
}
export const StudentProfileContext = createContext<ProfilesContext | null>(
  null,
);

export function useStudentProfile() {
  const context = useContext(StudentProfileContext);
  if (!context) throw new Error("Student profile provider is missing.");
  return context;
}
