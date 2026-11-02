import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { readAccountPhoto, readSharedStudent } from "../../lib/student-cloud";
import type { SharedStudent } from "../../lib/student-profile";
import { usePhotoUrl } from "./usePhotoUrl";
import { useStudentProfile } from "./student-context";
import { StudentProfileCard } from "./StudentProfileCard";
import { StudentProfileEditor } from "./StudentProfileEditor";
import { CharacterSwitcher } from "./CharacterSwitcher";
import { StudentAccount } from "./StudentAccount";
import "./student-profile.css";

function SharedProfile({ id }: { id: string }) {
  const { user } = useStudentProfile();
  const viewerId = user?.id;
  const [student, setStudent] = useState<SharedStudent | null>(null);
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const photoUrl = usePhotoUrl(photo);
  useEffect(() => {
    let active = true;
    let busy = false;
    let revision = "";
    if (!viewerId) return;
    const refresh = async () => {
      if (busy || document.hidden) return;
      busy = true;
      try {
        const next = await readSharedStudent(id);
        if (!active) return;
        if (!next) {
          setStudent(null);
          setPhoto(null);
          setError("This student is no longer sharing their profile.");
          return;
        }
        setStudent(next);
        setError("");
        if (!next.photo_available) {
          setPhoto(null);
          revision = "";
        } else if (revision !== next.updated_at) {
          setPhoto(null);
          try {
            const blob = await readAccountPhoto(id);
            if (active) setPhoto(blob);
          } catch {
            // Keep permitted fields visible when the photo is unavailable.
            if (active) setPhoto(null);
          }
          if (active) revision = next.updated_at;
        }
      } catch (cause) {
        if (active) {
          setStudent(null);
          setPhoto(null);
          setError(
            cause instanceof Error
              ? cause.message
              : "This profile is unavailable.",
          );
        }
      } finally {
        busy = false;
        if (active) setLoading(false);
      }
    };
    void refresh();
    const timer = window.setInterval(refresh, 3000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      active = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [id, viewerId]);
  if (!user)
    return (
      <p className="student-help">
        Sign in to view profiles that other students choose to share.
      </p>
    );
  return (
    <>
      {loading && <p role="status">Loading student profile…</p>}
      {student && <StudentProfileCard profile={student} photoUrl={photoUrl} />}
      {error && (
        <p className="student-error" role="alert">
          {error}
        </p>
      )}
    </>
  );
}

export function StudentProfileModal({
  studentId,
  onClose,
  onRestoreFocus,
}: {
  studentId: string;
  onClose: () => void;
  onRestoreFocus: () => void;
}) {
  const {
    profile,
    photo,
    user,
    loading,
    saving,
    error,
    configured,
    reload,
    signOut,
  } = useStudentProfile();
  const photoUrl = usePhotoUrl(photo);
  const [view, setView] = useState<"card" | "edit" | "character" | "account">(
    "card",
  );
  const [notice, setNotice] = useState("");
  const [accountError, setAccountError] = useState("");
  const own = studentId === "self" || studentId === user?.id;
  const title = !own
    ? "Student profile"
    : view === "edit"
      ? "Edit Student Profile"
      : view === "character"
        ? "Change Character"
        : view === "account"
          ? "Student account"
          : "Your student profile";
  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open && !saving) onClose();
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="student-overlay" />
        <Dialog.Content
          className="student-modal"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            onRestoreFocus();
          }}
          onEscapeKeyDown={(event) => {
            if (saving) event.preventDefault();
          }}
          onPointerDownOutside={(event) => {
            if (saving) event.preventDefault();
          }}
        >
          <header className="student-modal-heading">
            <div>
              <Dialog.Title>{title}</Dialog.Title>
              <Dialog.Description>
                {own
                  ? user
                    ? "Your Campus Explorer account"
                    : "Your profile on this device"
                  : "Only information this student has chosen to share appears here."}
              </Dialog.Description>
            </div>
            <Dialog.Close
              className="student-modal-close"
              aria-label="Close student profile"
              disabled={saving}
            >
              <X size={20} />
            </Dialog.Close>
          </header>
          {!own ? (
            <SharedProfile id={studentId} />
          ) : loading ? (
            <div className="student-loading" role="status">
              Loading your profile…
            </div>
          ) : (
            <>
              {view === "card" && (
                <>
                  <StudentProfileCard
                    profile={profile}
                    photoUrl={photoUrl}
                    own
                  />
                  {notice && (
                    <p role="status" className="student-success">
                      {notice}
                    </p>
                  )}
                  {error && (
                    <div className="student-error" role="alert">
                      {error}{" "}
                      <button className="campus-secondary" onClick={reload}>
                        Reload profile
                      </button>
                    </div>
                  )}
                  <div className="student-actions student-card-actions">
                    <button
                      className="campus-primary"
                      onClick={() => {
                        setNotice("");
                        setView("edit");
                      }}
                    >
                      Edit Student Profile
                    </button>
                    <button
                      className="campus-secondary"
                      onClick={() => setView("character")}
                    >
                      Change Character
                    </button>
                  </div>
                  <div className="student-account-bar">
                    <p>
                      {user
                        ? profile.sharing
                          ? "Your character is visible to signed-in students. Field and photo sharing follow your settings."
                          : "Your profile and character are hidden from other students."
                        : "Saved on this device. Online accounts keep a separate profile."}
                    </p>
                    {user ? (
                      <button
                        className="campus-secondary"
                        onClick={async () => {
                          setAccountError("");
                          try {
                            await signOut();
                          } catch (cause) {
                            setAccountError(
                              cause instanceof Error
                                ? cause.message
                                : "Sign out failed.",
                            );
                          }
                        }}
                      >
                        Sign out
                      </button>
                    ) : (
                      <button
                        className="campus-secondary"
                        onClick={() => setView("account")}
                      >
                        {configured
                          ? "Student sign in"
                          : "About online accounts"}
                      </button>
                    )}
                  </div>
                  {accountError && (
                    <p role="alert" className="student-error">
                      {accountError}
                    </p>
                  )}
                </>
              )}
              {view === "edit" && (
                <StudentProfileEditor
                  key={profile.user_id}
                  onDone={(saved) => {
                    if (saved)
                      setNotice(
                        user
                          ? "Profile saved to your account."
                          : "Profile saved on this device.",
                      );
                    setView("card");
                  }}
                />
              )}
              {view === "character" && (
                <CharacterSwitcher
                  onDone={(saved) => {
                    if (saved)
                      setNotice(
                        "Character changed. Your profile information and photo are unchanged.",
                      );
                    setView("card");
                  }}
                />
              )}
              {view === "account" && (
                <StudentAccount onDone={() => setView("card")} />
              )}
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
