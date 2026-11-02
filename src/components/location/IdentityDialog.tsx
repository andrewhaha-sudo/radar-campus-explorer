import { useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { roles, uniformColors } from "../../lib/map-identity";
import type { UniformColor } from "../../lib/map-identity";
import { useStudentProfile } from "../student/student-context";
import { CharacterSelection } from "../student/CharacterSelection";

export function IdentityDialog({ onClose }: { onClose: () => void }) {
  const { identity, saveIdentity, profile, photo, save, saving } =
    useStudentProfile();
  const [draft, setDraft] = useState(identity);
  const [avatar, setAvatar] = useState(profile.avatar);
  const [error, setError] = useState("");
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
          className="student-modal location-modal"
          onEscapeKeyDown={(event) => {
            if (saving) event.preventDefault();
          }}
          onPointerDownOutside={(event) => {
            if (saving) event.preventDefault();
          }}
        >
          <header className="student-modal-heading">
            <div>
              <Dialog.Title>Edit identity</Dialog.Title>
              <Dialog.Description>
                A nickname is enough. No real full name is required.
              </Dialog.Description>
            </div>
            <Dialog.Close
              className="student-modal-close"
              aria-label="Close identity editor"
              disabled={saving}
            >
              <X size={20} />
            </Dialog.Close>
          </header>
          <form
            className="student-editor"
            onSubmit={async (event) => {
              event.preventDefault();
              setError("");
              try {
                if (avatar !== profile.avatar)
                  await save({ ...profile, avatar }, photo);
                saveIdentity(draft);
                onClose();
              } catch (cause) {
                setError(
                  cause instanceof Error
                    ? cause.message
                    : "Your identity could not be saved.",
                );
              }
            }}
          >
            <label>
              Display name
              <input
                maxLength={50}
                autoComplete="nickname"
                placeholder="Your nickname"
                value={draft.displayName}
                onChange={(event) =>
                  setDraft({ ...draft, displayName: event.target.value })
                }
                disabled={saving}
              />
            </label>
            <label>
              User role
              <select
                value={draft.role}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    role: event.target.value as typeof draft.role,
                  })
                }
                disabled={saving}
              >
                {roles.map((role) => (
                  <option key={role}>{role}</option>
                ))}
              </select>
            </label>
            <label>
              Uniform color
              <select
                value={draft.color}
                onChange={(event) =>
                  setDraft({
                    ...draft,
                    color: event.target.value as UniformColor,
                  })
                }
                disabled={saving}
              >
                {Object.keys(uniformColors).map((color) => (
                  <option key={color}>{color}</option>
                ))}
              </select>
            </label>
            <CharacterSelection
              value={avatar}
              onChange={setAvatar}
              disabled={saving}
            />
            <p className="student-help">
              Your nickname, role and color stay on this device, separately for
              each account. Your chosen character also appears on your existing
              student profile.
            </p>
            {error && (
              <p role="alert" className="student-error">
                {error}
              </p>
            )}
            <div className="student-actions">
              <button
                type="button"
                className="campus-secondary"
                onClick={onClose}
                disabled={saving}
              >
                Cancel
              </button>
              <button className="campus-primary" disabled={saving}>
                {saving ? "Saving…" : "Save identity"}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
