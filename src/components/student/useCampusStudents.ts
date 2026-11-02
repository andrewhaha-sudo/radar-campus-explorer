import { useEffect, useRef, useState } from "react";
import { studentCloud, listCampusStudents } from "../../lib/student-cloud";
import type { CampusStudent, Direction } from "../../lib/student-profile";
import { useStudentProfile } from "./student-context";

export function useCampusStudents(pose: {
  scene: string;
  x: number;
  y: number;
  direction: Direction;
  moving: boolean;
}) {
  const { user, profile, loading } = useStudentProfile();
  const latest = useRef(pose);
  useEffect(() => {
    latest.current = pose;
  }, [pose]);
  const [result, setResult] = useState<{
    owner: string;
    students: CampusStudent[];
    error: string;
  } | null>(null);
  const id = user?.id;
  useEffect(() => {
    if (!studentCloud || !id || loading) return;
    let active = true;
    let busy = false;
    const client = studentCloud;
    const tick = async () => {
      if (busy || !active) return;
      busy = true;
      try {
        if (document.hidden || !profile.sharing) {
          await client.from("explorer_presence").delete().eq("user_id", id);
        } else {
          const sent = await client
            .from("explorer_presence")
            .upsert({ user_id: id, ...latest.current });
          if (sent.error)
            throw new Error(
              "Your character could not connect to other students.",
            );
        }
        if (!document.hidden) {
          const peers = await listCampusStudents();
          if (active) setResult({ owner: id, students: peers, error: "" });
        }
      } catch (cause) {
        // Do not leave stale classmates visible after a failed authorization read.
        if (active)
          setResult({
            owner: id,
            students: [],
            error:
              cause instanceof Error
                ? cause.message
                : "Other students are unavailable.",
          });
      } finally {
        busy = false;
      }
    };
    void tick();
    const timer = window.setInterval(tick, 3000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      active = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
      void client
        .from("explorer_presence")
        .delete()
        .eq("user_id", id)
        .then(() => {});
    };
  }, [id, profile.sharing, loading]);
  return {
    students: id && !loading && result?.owner === id ? result.students : [],
    error: id && result?.owner === id ? result.error : "",
  };
}
