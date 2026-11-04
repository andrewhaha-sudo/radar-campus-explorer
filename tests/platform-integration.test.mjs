import test from "node:test";
import assert from "node:assert/strict";
import { campusRegistry, campusSeedSql } from "../scripts/campus-registry.mjs";
import { allRooms } from "../src/components/map/campus-data.ts";

test("every RADAR floor and room maps to a distinct shared Pathfinder document", () => {
  const registry = campusRegistry();
  assert.equal(registry.length, 11);
  assert.equal(new Set(registry.map((f) => f.documentId)).size, 11);
  assert.equal(registry.flatMap((f) => f.roomIds).length, allRooms.length);
  assert.ok(
    registry.every(
      (f) => f.floorId && f.projectId && f.buildingId && f.sourceRegistration,
    ),
  );
});
test("campus initialization is idempotent and preserves shared edits", () => {
  const sql = campusSeedSql();
  assert.match(sql, /ON CONFLICT\(id\) DO NOTHING/);
  assert.doesNotMatch(
    sql,
    /DELETE|DROP|UPDATE|password_hash|INSERT INTO annotations/i,
  );
  assert.match(sql, /radar-doc-b2/);
});
