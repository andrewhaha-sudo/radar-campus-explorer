import type { Character } from "../../lib/student-profile";
import { CharacterPortrait } from "./StudentSprite";
import { cn } from "../../lib/cn";

export function CharacterSelection({
  value,
  onChange,
  disabled = false,
}: {
  value: Character;
  onChange: (avatar: Character) => void;
  disabled?: boolean;
}) {
  return (
    <fieldset className="character-selection" disabled={disabled}>
      <legend>Choose your character</legend>
      <div className="character-choices">
        {(["boy", "girl"] as const).map((avatar) => (
          <label
            key={avatar}
            className={cn("character-choice", value === avatar && "is-chosen")}
          >
            <input
              type="radio"
              name="student-character"
              aria-label={avatar === "boy" ? "Boy" : "Girl"}
              value={avatar}
              checked={value === avatar}
              onChange={() => onChange(avatar)}
            />
            <CharacterPortrait avatar={avatar} />
            <span>{avatar === "boy" ? "Boy" : "Girl"}</span>
          </label>
        ))}
      </div>
      <p>Your character is separate from your profile photo and sex.</p>
    </fieldset>
  );
}
