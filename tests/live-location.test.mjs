import test from "node:test";
import assert from "node:assert/strict";
import {
  calibrate,
  projectLocation,
  projectHeading,
  insideCalibration,
} from "../src/lib/map-calibration.ts";
import { evaluateLocation } from "../src/lib/live-location.ts";
import { validateIdentity } from "../src/lib/map-identity.ts";
import { testCalibration, geoAt } from "./fixtures/location-calibration.mjs";

const alignment = calibrate(testCalibration);
const map = { accepts: () => true, canInterpolate: () => true };
const timestamp = 1_800_000_000_000;
const reading = (x, y, time = timestamp, extra = {}) => ({
  ...geoAt(x, y),
  accuracy: 5,
  timestamp: time,
  heading: null,
  speed: null,
  ...extra,
});
const evaluate = (value, previous = null, mask = map) =>
  evaluateLocation(value, previous, alignment, mask, value.timestamp);

test("calibration maps verified points with rotation, scale and shear without assuming north is image-up", () => {
  const rotated = {
    ...testCalibration,
    points: testCalibration.points.map((p) => ({
      ...p,
      x: 625 + (p.y - 625) * 0.6 + (p.x - 625) * 0.2,
      y: 625 + (p.x - 625) * 0.7,
    })),
  };
  const a = calibrate(rotated);
  const projected = projectLocation(geoAt(670, 490), a);
  assert.ok(Math.abs(projected.x - (625 - 135 * 0.6 + 45 * 0.2)) < 0.001);
  assert.ok(Math.abs(projected.y - (625 + 45 * 0.7)) < 0.001);
  assert.ok(Math.abs(projectHeading(0, a) - 270) < 0.001);
  assert.ok(insideCalibration(projected, a));
  assert.equal(
    insideCalibration(projectLocation(geoAt(-200, -200), a), a),
    false,
  );
});
test("calibration rejects missing, invented defaults, degenerate and inconsistent references", () => {
  assert.throws(() => calibrate(null), /verified/);
  assert.throws(
    () => calibrate({ ...testCalibration, verified: false }),
    /verified/,
  );
  assert.throws(
    () =>
      calibrate({
        ...testCalibration,
        points: testCalibration.points.slice(0, 2),
      }),
    /3–12/,
  );
  assert.throws(
    () =>
      calibrate({
        ...testCalibration,
        points: testCalibration.points.map((p, i) => ({
          ...p,
          ...geoAt(i * 20, 500),
        })),
      }),
    /straight line/,
  );
  assert.throws(
    () =>
      calibrate({
        ...testCalibration,
        points: testCalibration.points.map((p) => ({ ...p, x: 500 })),
      }),
    /straight line/,
  );
  assert.throws(
    () =>
      calibrate({
        ...testCalibration,
        points: testCalibration.points.map((p, i) => ({
          ...p,
          x: p.x + (i === 0 ? 500 : 0),
        })),
      }),
    /disagree/,
  );
  assert.throws(
    () =>
      calibrate({
        ...testCalibration,
        points: testCalibration.points.map((p) => ({ ...p, latitude: NaN })),
      }),
    /valid latitude/,
  );
});
test("stationary drift stays fixed while a measured 10-meter walk moves 50 calibrated pixels", () => {
  const first = evaluate(reading(620, 490));
  assert.equal(first.status, "live");
  const drift = evaluate(reading(624, 493, timestamp + 1000), first.fix);
  assert.deepEqual(drift.fix.point, first.fix.point);
  assert.equal(drift.fix.moving, false);
  const walked = evaluate(
    reading(670, 490, timestamp + 2000, { heading: 90, speed: 1.5 }),
    drift.fix,
  );
  assert.ok(Math.abs(walked.fix.point.x - 670) < 0.001);
  assert.equal(walked.fix.direction, "right");
  assert.ok(Math.abs(walked.fix.heading - 90) < 0.001);
  assert.equal(walked.fix.moving, true);
  assert.equal(walked.fix.smooth, true);
});
test("inaccurate, stale, out-of-order, off-campus and blocked readings preserve the last reliable position", () => {
  const first = evaluate(reading(620, 490)).fix;
  for (const [value, mask, status] of [
    [reading(670, 490, timestamp + 1000, { accuracy: 80 }), map, "uncertain"],
    [reading(670, 490, timestamp - 1000), map, "uncertain"],
    [reading(1300, 490, timestamp + 1000), map, "outside"],
    [
      reading(670, 490, timestamp + 1000),
      { ...map, accepts: () => false },
      "uncertain",
    ],
    [reading(1100, 490, timestamp + 100), map, "uncertain"],
  ]) {
    const result = evaluate(value, first, mask);
    assert.equal(result.status, status);
    assert.deepEqual(result.fix.point, first.point);
    assert.equal(result.fix.moving, false);
  }
  assert.equal(
    evaluateLocation(
      reading(620, 490),
      first,
      alignment,
      map,
      timestamp + 20_000,
    ).status,
    "unavailable",
  );
  assert.equal(
    evaluate(reading(620, 490, timestamp, { latitude: NaN })).fix,
    null,
  );
});
test("measured endpoints never fabricate a route through walls or extrapolate across missing updates", () => {
  const first = evaluate(reading(620, 490)).fix;
  const next = evaluate(reading(670, 490, timestamp + 2000), first, {
    ...map,
    canInterpolate: () => false,
  });
  assert.equal(next.fix.smooth, false);
  assert.ok(Math.abs(next.fix.point.x - 670) < 0.001);
  const resumed = evaluate(reading(720, 490, timestamp + 25_000), first);
  assert.equal(resumed.fix.smooth, false);
});
test("identity accepts nicknames and all roles while rejecting unknown colors or oversized names", () => {
  assert.deepEqual(
    validateIdentity({ displayName: " Alex ", role: "Visitor", color: "Blue" }),
    { displayName: "Alex", role: "Visitor", color: "Blue" },
  );
  for (const role of ["Student", "Teacher", "School Staff", "Visitor"])
    assert.equal(
      validateIdentity({ displayName: "", role, color: "Green" }).role,
      role,
    );
  assert.throws(() =>
    validateIdentity({
      displayName: "x".repeat(51),
      role: "Student",
      color: "Green",
    }),
  );
  assert.throws(() =>
    validateIdentity({
      displayName: "Alex",
      role: "Student",
      color: "__proto__",
    }),
  );
});
