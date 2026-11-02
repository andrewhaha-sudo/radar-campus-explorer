import { readCampusRole } from "./campus-role.ts";
export const roles = ["Student", "Teacher", "School Staff", "Visitor"] as const;
export const uniformColors = {
  Green: "#39794a",
  Blue: "#2169ac",
  Red: "#aa3d49",
  Gold: "#9a7019",
} as const;
export type UniformColor = keyof typeof uniformColors;
export interface MapIdentity {
  displayName: string;
  role: (typeof roles)[number];
  color: UniformColor;
}
export const defaultIdentity: MapIdentity = {
  displayName: "",
  role: "Student",
  color: "Green",
};
export const identityKey = (id: string) => "campus-explorer-identity:" + id;
export function validateIdentity(value: MapIdentity): MapIdentity {
  if (
    typeof value.displayName !== "string" ||
    value.displayName.trim().length > 50 ||
    !roles.includes(value.role) ||
    !Object.hasOwn(uniformColors, value.color)
  )
    throw new Error(
      "Use a nickname of up to 50 characters and choose a role and uniform color.",
    );
  return {
    displayName: value.displayName.trim(),
    role: value.role,
    color: value.color,
  };
}
export function readIdentity(id: string): MapIdentity {
  try {
    return validateIdentity(
      JSON.parse(localStorage.getItem(identityKey(id)) || "null"),
    );
  } catch {
    const oldRole = readCampusRole(id);
    return {
      ...defaultIdentity,
      role: oldRole === "Staff" ? "School Staff" : oldRole || "Student",
    };
  }
}
