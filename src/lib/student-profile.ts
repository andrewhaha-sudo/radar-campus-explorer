export type Character = "boy" | "girl";
export type Direction = "up" | "down" | "left" | "right";
export const identityFields = [
  "name",
  "grade",
  "section",
  "teacher",
  "sex",
] as const;
export type IdentityField = (typeof identityFields)[number];
export type Visibility = Record<IdentityField | "photo", boolean>;
export interface StudentProfile {
  user_id: string;
  avatar: Character;
  name: string;
  grade: string;
  section: string;
  teacher: string;
  sex: string;
  visibility: Visibility;
  sharing: boolean;
  photo_available: boolean;
  updated_at?: string;
}
export interface SharedStudent {
  user_id: string;
  avatar: Character;
  name: string | null;
  grade: string | null;
  section: string | null;
  teacher: string | null;
  sex: string | null;
  photo_available: boolean;
  updated_at: string;
}
export interface CampusStudent {
  user_id: string;
  avatar: Character;
  name: string | null;
  scene: string;
  x: number;
  y: number;
  direction: Direction;
  moving: boolean;
}
export const grades = [
  "Kindergarten",
  ...Array.from({ length: 12 }, (_, i) => `Grade ${i + 1}`),
  "College",
];
export function emptyStudent(userId = "device"): StudentProfile {
  return {
    user_id: userId,
    avatar: "boy",
    name: "",
    grade: "",
    section: "",
    teacher: "",
    sex: "",
    visibility: {
      name: false,
      grade: false,
      section: false,
      teacher: false,
      sex: false,
      photo: false,
    },
    sharing: false,
    photo_available: false,
  };
}
export function validateStudent(profile: StudentProfile): StudentProfile {
  if (!["boy", "girl"].includes(profile.avatar))
    throw new Error("Choose a boy or girl character.");
  const result = { ...profile, visibility: { ...profile.visibility } };
  for (const field of identityFields) {
    if (typeof profile[field] !== "string")
      throw new Error(`Enter a valid ${field}.`);
    result[field] = profile[field].trim();
    if (result[field].length > 80)
      throw new Error(`${field} must be 80 characters or fewer.`);
  }
  if (result.grade && !grades.includes(result.grade))
    throw new Error("Choose a grade from the list.");
  if (!["", "Male", "Female"].includes(result.sex))
    throw new Error("Choose Male, Female or Not specified.");
  for (const field of [...identityFields, "photo"] as const)
    result.visibility[field] = profile.visibility[field] === true;
  result.sharing = profile.sharing === true;
  return result;
}
