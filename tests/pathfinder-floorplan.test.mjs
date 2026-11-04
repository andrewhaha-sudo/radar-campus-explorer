import test from "node:test";
import assert from "node:assert/strict";
import {
  createFloorDocument,
  parseFloorDocument,
  annotationAt,
  registrationFor,
} from "../src/lib/floorplan.ts";
import { scenes } from "../src/components/map/campus-data.ts";
import {
  newHistory,
  pushUndo,
  undo,
  redo,
} from "../src/vendor/pathfinder/undo.ts";

const marker = () => annotationAt("exit", { x: 272, y: 178.5 }, scenes.a1.crop);

test("floor coordinates use the displayed crop, independently of the source image offset", () => {
  const a = marker();
  assert.equal(a.nx, 0.5);
  assert.equal(a.ny, 0.5);
  assert.equal(a.nw, 0);
  assert.equal(a.nh, 0);
  const corner = annotationAt("aed", { x: 0, y: 0 }, scenes.a1.crop);
  assert.equal(corner.nx, 0);
});
test("Pathfinder JSON round trip retains marker identity, geometry, note and floor registration", () => {
  const a = { ...marker(), text: "Exit requires site review" };
  const data = createFloorDocument("a1", [a]);
  const parsed = parseFloorDocument(JSON.stringify(data), "a1");
  assert.deepEqual(parsed, [a]);
  assert.equal(data.document.totalAnnotations, 1);
  assert.deepEqual(data.radar.registration, registrationFor("a1"));
});
test("imports cannot silently attach markers to a different floor or changed drawing", () => {
  const data = createFloorDocument("a1", [marker()]);
  assert.throws(() => parseFloorDocument(JSON.stringify(data), "d1"), /floor/i);
  data.radar.registration.crop.x += 1;
  assert.throws(
    () => parseFloorDocument(JSON.stringify(data), "a1"),
    /drawing/i,
  );
});
test("malformed or oversized imports and unsafe geometry fail atomically", () => {
  for (const mutate of [
    (d) => (d.document.pages[0].annotations[0].x = 2),
    (d) => (d.document.pages[0].annotations[0].color = "url(bad)"),
    (d) => (d.document.pages[0].annotations[0].type = "unknown"),
    (d) =>
      d.document.pages[0].annotations.push({
        ...d.document.pages[0].annotations[0],
      }),
    (d) => (d.document.pages[0].pageNumber = 2),
  ]) {
    const d = createFloorDocument("a1", [marker()]);
    mutate(d);
    assert.throws(() => parseFloorDocument(JSON.stringify(d), "a1"));
  }
  assert.throws(() => parseFloorDocument("{", "a1"));
  assert.throws(
    () => parseFloorDocument(" ".repeat(1_000_001), "a1"),
    /large/i,
  );
});
test("Pathfinder history restores both annotation removal and redo", () => {
  const h = newHistory(),
    first = [marker()];
  pushUndo(h, []);
  assert.deepEqual(undo(h, first), []);
  assert.deepEqual(redo(h, []), first);
});
