import {
  BookOpen,
  GraduationCap,
  IdCard,
  Users,
  VenusAndMars,
} from "lucide-react";
import { readCampusRole } from "../../lib/campus-role";
import type { SharedStudent, StudentProfile } from "../../lib/student-profile";
import { CharacterPortrait, StudentSprite } from "./StudentSprite";

const fields = [
  { key: "name", label: "NAME", fallback: "YOUR NAME", icon: IdCard },
  { key: "grade", label: "GRADE", fallback: "GRADE __", icon: GraduationCap },
  { key: "section", label: "SECTION", fallback: "SECTION __", icon: Users },
  {
    key: "teacher",
    label: "TEACHER",
    fallback: "TEACHER NAME",
    icon: BookOpen,
  },
  { key: "sex", label: "SEX", fallback: "NOT SPECIFIED", icon: VenusAndMars },
] as const;
export function StudentProfileCard({
  profile,
  photoUrl,
  own = false,
}: {
  profile: StudentProfile | SharedStudent;
  photoUrl: string | null;
  own?: boolean;
}) {
  const role = own ? readCampusRole(profile.user_id) : "";
  return (
    <article
      className="trainer-card"
      aria-label={own ? "Your student trainer card" : "Student trainer card"}
    >
      <span className="trainer-corner corner-tl" aria-hidden="true" />
      <span className="trainer-corner corner-tr" aria-hidden="true" />
      <span className="trainer-corner corner-bl" aria-hidden="true" />
      <span className="trainer-corner corner-br" aria-hidden="true" />
      <div className="trainer-topline" aria-hidden="true">
        <span>◆ ◇ ⚡ ◆</span>
        <span>◆ ◇ ◆ ◇</span>
      </div>
      <header className="trainer-title">
        <i className="trainer-orb" aria-hidden="true" />
        <h3>
          STUDENT <em>PROFILE</em>
        </h3>
        <i className="trainer-orb" aria-hidden="true" />
      </header>
      <p className="trainer-ribbon">— CAMPUS TRAINER CARD —</p>
      <div className="trainer-school" aria-hidden="true">
        <img src="/students/campus.png" alt="" />
      </div>
      <div className="trainer-content">
        <div className="trainer-portrait-column">
          <div className="trainer-portrait-frame">
            <div className="trainer-portrait">
              {photoUrl ? (
                <img
                  className="trainer-real-photo"
                  src={photoUrl}
                  alt={
                    own ? "Your profile photo" : "Shared student profile photo"
                  }
                />
              ) : (
                <CharacterPortrait avatar={profile.avatar} />
              )}
            </div>
          </div>
          <div className="trainer-character-label">
            <svg viewBox="-12 -34 26 36" aria-hidden="true">
              <StudentSprite avatar={profile.avatar} />
            </svg>
            <span>{profile.avatar === "boy" ? "Boy" : "Girl"} character</span>
          </div>
        </div>
        <dl className="trainer-fields">
          {own && (
            <div className="trainer-field">
              <span className="trainer-field-icon">
                <IdCard aria-hidden="true" strokeWidth={2.5} />
              </span>
              <div>
                <dt>ROLE:</dt>
                <dd>{role || "NOT SET"}</dd>
              </div>
            </div>
          )}
          {fields.map(({ key, label, fallback, icon: Icon }) => (
            <div key={key} className="trainer-field">
              <span className="trainer-field-icon">
                <Icon aria-hidden="true" strokeWidth={2.5} />
              </span>
              <div>
                <dt>{label}:</dt>
                <dd>
                  {profile[key] === null
                    ? "PRIVATE"
                    : profile[key] || (own ? fallback : "NOT SET")}
                </dd>
              </div>
            </div>
          ))}
        </dl>
      </div>
      <footer className="trainer-footer">
        <span aria-hidden="true">❯❯</span> RADAR SCHOOL ID{" "}
        <span aria-hidden="true">❮❮</span>
      </footer>
    </article>
  );
}
