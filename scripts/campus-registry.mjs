import { scenes } from "../src/components/map/campus-data.ts";
import { registrationFor } from "../src/lib/floorplan.ts";
export function campusRegistry() {
  return Object.entries(scenes)
    .filter(([id]) => id !== "campus")
    .map(([id, scene]) => ({
      sceneId: id,
      name: scene.name,
      buildingId: `radar-building-${scene.buildingId ?? "six"}`,
      documentId: `radar-doc-${id}`,
      projectId: `radar-project-${scene.buildingId ?? "six"}`,
      floorId: `radar-floor-${id}`,
      roomIds: scene.rooms.map((r) => r.id),
      sourceRegistration: registrationFor(id),
      storageKey: `radar/floors/${id}.pdf`,
      sortOrder: id.endsWith("2") ? 1 : 0,
    }));
}
const q = (v) => `'${String(v).replaceAll("'", "''")}'`;
const insert = (table, values) =>
  `INSERT INTO ${table} (${Object.keys(values).join(",")}) VALUES (${Object.values(
    values,
  )
    .map((v) => (typeof v === "number" ? v : q(v)))
    .join(",")}) ON CONFLICT(id) DO NOTHING;`;
export function campusSeedSql() {
  const rows = campusRegistry(),
    sql = [
      insert("orgs", {
        id: "radar-org",
        name: "RADAR Campus illustration",
        type: "school",
      }),
      insert("facilities", {
        id: "radar-campus",
        org_id: "radar-org",
        name: "RADAR illustrated campus",
        type: "school",
      }),
    ];
  const buildings = new Set();
  for (const f of rows) {
    if (!buildings.has(f.buildingId)) {
      buildings.add(f.buildingId);
      sql.push(
        insert("buildings", {
          id: f.buildingId,
          facility_id: "radar-campus",
          name: f.name.split(" \u00b7 ")[0],
          floors: rows.filter((r) => r.buildingId === f.buildingId).length,
        }),
      );
      sql.push(
        insert("projects", {
          id: f.projectId,
          building_id: f.buildingId,
          name: "Floorplan review - source illustration",
          status: "draft",
          progress: 0,
        }),
      );
    }
    sql.push(
      insert("documents", {
        id: f.documentId,
        project_id: f.projectId,
        filename: `${f.name}.pdf`,
        storage_key: f.storageKey,
        page_count: 1,
        doc_type: "floorplan",
        mime_type: "application/pdf",
      }),
    );
    sql.push(
      insert("floors", {
        id: f.floorId,
        building_id: f.buildingId,
        label: f.name.split(" \u00b7 ")[1] ?? f.name,
        sort_order: f.sortOrder,
        needs_review: 1,
      }),
    );
    sql.push(
      insert("floor_plan_versions", {
        id: `radar-version-${f.sceneId}`,
        floor_id: f.floorId,
        doc_id: f.documentId,
        page: 1,
        version: 1,
        is_current: 1,
        note: "Illustration imported from RADAR; requires site verification",
      }),
    );
  }
  return sql.join("\n") + "\n";
}
