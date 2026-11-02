import { useState } from "react";
import { CharacterSelection } from "./CharacterSelection";
import { useStudentProfile } from "./student-context";

export function CharacterSwitcher({
  onDone,
}: {
  onDone: (saved?: boolean) => void;
}) {
  const { profile, photo, save, saving } = useStudentProfile();
  const [avatar, setAvatar] = useState(profile.avatar);
  const [error, setError] = useState("");
  return (
    <form
      className="student-editor"
      onSubmit={async (event) => {
        event.preventDefault();
        setError("");
        try {
          await save({ ...profile, avatar }, photo);
          onDone(true);
        } catch (cause) {
          setError(
            cause instanceof Error
              ? cause.message
              : "Your character could not be changed.",
          );
        }
      }}
    >
      <CharacterSelection
        value={avatar}
        onChange={setAvatar}
        disabled={saving}
      />
      <p>Your saved identity and profile photo will stay with you.</p>
      {error && (
        <p role="alert" className="student-error">
          {error}
        </p>
      )}
      <div className="student-actions">
        <button
          type="button"
          className="campus-secondary"
          onClick={() => onDone()}
          disabled={saving}
        >
          Cancel
        </button>
        <button className="campus-primary" disabled={saving}>
          {saving ? "Saving…" : "Use this character"}
        </button>
      </div>
    </form>
  );
}
