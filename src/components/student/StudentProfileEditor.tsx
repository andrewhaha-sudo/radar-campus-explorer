import { useState } from "react";
import { roles } from "../../lib/map-identity";
import { grades, identityFields } from "../../lib/student-profile";
import { CharacterSelection } from "./CharacterSelection";
import { ProfilePhotoUploader } from "./ProfilePhotoUploader";
import { useStudentProfile } from "./student-context";

export function StudentProfileEditor({
  onDone,
}: {
  onDone: (saved?: boolean) => void;
}) {
  const { profile, photo, user, saving, save, identity, saveIdentity } =
    useStudentProfile();
  const [draft, setDraft] = useState({
    ...profile,
    visibility: { ...profile.visibility },
  });
  const [draftPhoto, setDraftPhoto] = useState(photo);
  const [photoChanged, setPhotoChanged] = useState(false);
  const [photoPending, setPhotoPending] = useState(false);
  const [chooseCharacter, setChooseCharacter] = useState(false);
  const [role, setRole] = useState(identity.role);
  const [error, setError] = useState("");
  return (
    <form
      className="student-editor"
      onSubmit={async (event) => {
        event.preventDefault();
        setError("");
        if (photoPending) return;
        try {
          await save(draft, draftPhoto, photoChanged);
          saveIdentity({ ...identity, role });
          onDone(true);
        } catch (cause) {
          setError(
            cause instanceof Error
              ? cause.message
              : "Your profile could not be saved.",
          );
        }
      }}
    >
      <fieldset disabled={saving} className="student-identity-fields">
        <legend>Your student information</legend>
        <label>
          Name
          <input
            autoComplete="name"
            maxLength={80}
            value={draft.name}
            onChange={(event) =>
              setDraft({ ...draft, name: event.target.value })
            }
            placeholder="Your name"
          />
        </label>
        <label>
          Grade
          <select
            value={draft.grade}
            onChange={(event) =>
              setDraft({ ...draft, grade: event.target.value })
            }
          >
            <option value="">Select grade</option>
            {grades.map((grade) => (
              <option key={grade}>{grade}</option>
            ))}
          </select>
        </label>
        <label>
          Section
          <input
            maxLength={80}
            value={draft.section}
            onChange={(event) =>
              setDraft({ ...draft, section: event.target.value })
            }
            placeholder="Your section"
          />
        </label>
        <label>
          Teacher
          <input
            maxLength={80}
            value={draft.teacher}
            onChange={(event) =>
              setDraft({ ...draft, teacher: event.target.value })
            }
            placeholder="Teacher's name"
          />
        </label>
        <label>
          Role on this device
          <select
            aria-label="Role on this device"
            value={role}
            onChange={(event) => setRole(event.target.value as typeof role)}
          >
            {roles.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <p className="campus-small">
          Student, Teacher, Staff or Visitor. This role stays in this browser.
          It is not sent with the student account and other students cannot see
          it.
        </p>
        <label>
          Sex
          <select
            value={draft.sex}
            onChange={(event) =>
              setDraft({ ...draft, sex: event.target.value })
            }
          >
            <option value="">Not specified</option>
            <option>Male</option>
            <option>Female</option>
          </select>
        </label>
      </fieldset>
      <div className="student-character-setting">
        <span>
          Character: <strong>{draft.avatar === "boy" ? "Boy" : "Girl"}</strong>
        </span>
        <button
          type="button"
          className="campus-secondary"
          disabled={saving}
          aria-expanded={chooseCharacter}
          onClick={() => setChooseCharacter(!chooseCharacter)}
        >
          Change Character
        </button>
      </div>
      {chooseCharacter && (
        <CharacterSelection
          value={draft.avatar}
          onChange={(avatar) => setDraft({ ...draft, avatar })}
          disabled={saving}
        />
      )}
      <ProfilePhotoUploader
        photo={draftPhoto}
        avatar={draft.avatar}
        disabled={saving}
        onPendingChange={setPhotoPending}
        onChange={(value) => {
          setDraftPhoto(value);
          setPhotoChanged(true);
        }}
      />
      <fieldset className="student-privacy" disabled={saving || !user}>
        <legend>Who can see your profile?</legend>
        <label>
          <input
            type="checkbox"
            checked={draft.sharing}
            onChange={(event) =>
              setDraft({ ...draft, sharing: event.target.checked })
            }
          />
          Show my character to signed-in students
        </label>
        <p>
          Choose what appears when another student clicks your character.
          Everything starts private.
        </p>
        <div className="student-privacy-fields">
          {[...identityFields, "photo" as const].map((field) => (
            <label key={field}>
              <input
                type="checkbox"
                checked={draft.visibility[field]}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    visibility: {
                      ...draft.visibility,
                      [field]: event.target.checked,
                    },
                  })
                }
              />
              Share my {field}
            </label>
          ))}
        </div>
      </fieldset>
      {!user && (
        <p className="student-help">
          This profile is saved only on this device. Sign in to a student
          account to save online and choose what other students can see.
        </p>
      )}
      {photoPending && (
        <p className="student-help">
          Finish or cancel the photo crop before saving your profile.
        </p>
      )}
      {error && (
        <p role="alert" className="student-error">
          {error}
        </p>
      )}
      <div className="student-actions student-save-actions">
        <button
          type="button"
          className="campus-secondary"
          onClick={() => onDone()}
          disabled={saving}
        >
          Cancel
        </button>
        <button className="campus-primary" disabled={saving || photoPending}>
          {saving ? "Saving changes…" : "Save Changes"}
        </button>
      </div>
    </form>
  );
}
