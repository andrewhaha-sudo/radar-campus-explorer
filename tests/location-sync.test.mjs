import test from "node:test";
import assert from "node:assert/strict";
import {
  assessFix,
  directionFromHeading,
  distanceMeters,
  LocationWatcher,
  predictReading,
  shouldPublishPose,
} from "../src/lib/location-sync.ts";
import {
  demoCalibrationFromHere,
  fitAffine,
  geographicToPixel,
  projectAffine,
  readCalibration,
  writeCalibration,
} from "../src/lib/map-calibration.ts";
import { readCampusRole, writeCampusRole } from "../src/lib/campus-role.ts";

const surveyed = [
  {
    id: "gate",
    label: "Gate",
    latitude: 14,
    longitude: 121,
    x: 387,
    y: 785,
  },
  {
    id: "building-a",
    label: "Building A",
    latitude: 14,
    longitude: 121.01,
    x: 868,
    y: 411,
  },
  {
    id: "garden",
    label: "Garden",
    latitude: 13.99,
    longitude: 121,
    x: 547,
    y: 1057,
  },
];

const reading = (overrides = {}) => ({
  latitude: 14,
  longitude: 121,
  accuracy: 8,
  timestamp: 1_000,
  speed: 1,
  heading: 0,
  ...overrides,
});

test("three surveyed points project back onto their map pixels", () => {
  const fitted = fitAffine(surveyed);
  assert.equal(fitted.ok, true);
  if (!fitted.ok) return;
  for (const point of surveyed) {
    const projected = projectAffine(fitted.affine, point.latitude, point.longitude);
    assert.ok(Math.abs(projected.x - point.x) < 0.01);
    assert.ok(Math.abs(projected.y - point.y) < 0.01);
  }
  const target = geographicToPixel(14, 121.01, { points: surveyed });
  assert.equal(target.ok, true);
  if (!target.ok) return;
  assert.ok(Math.abs(target.point.x - 868) < 0.01);
  assert.ok(Math.abs(target.point.y - 411) < 0.01);
});

test("missing, collinear, and off-campus calibration do not invent a position", () => {
  assert.deepEqual(geographicToPixel(14, 121, { points: [] }), {
    ok: false,
    reason: "calibration_required",
  });
  const collinear = fitAffine([
    surveyed[0],
    surveyed[1],
    { ...surveyed[1], id: "copy", longitude: 121.02, x: 900, y: 420 },
  ]);
  assert.equal(collinear.ok, false);
  const outside = geographicToPixel(40, 121, { points: surveyed });
  assert.deepEqual(outside, { ok: false, reason: "out_of_range" });
});

test("accuracy, stale fixes, and implausible jumps do not count as reliable", () => {
  const now = 1_000;
  assert.equal(assessFix(reading(), null, now).quality, "reliable");
  assert.equal(
    assessFix(reading({ accuracy: 40 }), null, now).quality,
    "approximate",
  );
  assert.equal(assessFix(reading({ timestamp: now - 30_000 }), null, now).reason, "stale");
  const jumped = assessFix(
    reading({ latitude: 14.01, timestamp: 2_000 }),
    reading(),
    2_000,
  );
  assert.equal(jumped.reason, "implausible_jump");
  assert.ok(distanceMeters(reading(), reading({ latitude: 14.01 })) > 120);
});

test("heading follows the calibrated map axes instead of raw screen direction", () => {
  assert.equal(
    directionFromHeading(0, { north: { x: 0, y: -10 }, east: { x: 10, y: 0 } }),
    "up",
  );
  assert.equal(
    directionFromHeading(90, { north: { x: 0, y: -10 }, east: { x: 10, y: 0 } }),
    "right",
  );
  assert.equal(
    directionFromHeading(180, { north: { x: 0, y: -10 }, east: { x: 10, y: 0 } }),
    "down",
  );
});

test("prediction carries a moving fix forward between phone updates", () => {
  const start = reading({ speed: 2, heading: 0, timestamp: 1_000 });
  const next = predictReading(start, 2_000);
  assert.ok(next.latitude > start.latitude);
  assert.ok(Math.abs(next.longitude - start.longitude) < 1e-8);
  const still = predictReading(reading({ speed: null, heading: null }), 2_000);
  assert.equal(still.latitude, 14);
  assert.equal(still.longitude, 121);
  assert.equal(assessFix(reading({ accuracy: 90 }), null, 1_000).quality, "rejected");
});

test("a location watcher cannot leave two watches running", () => {
  const watches = new Map();
  let next = 0;
  const source = {
    watchPosition(success, error, options) {
      const id = ++next;
      watches.set(id, { success, error, options });
      return id;
    },
    clearWatch(id) {
      watches.delete(id);
    },
  };
  const watcher = new LocationWatcher(source);
  watcher.start(() => {}, () => {});
  watcher.start(() => {}, () => {});
  assert.equal(watches.size, 1);
  assert.equal([...watches.values()][0].options.enableHighAccuracy, true);
  watcher.stop();
  assert.equal(watcher.active, false);
  assert.equal(watches.size, 0);
});

test("a demo calibration anchors the current fix and moves east across the map", () => {
  const built = demoCalibrationFromHere(14, 121, { x: 387, y: 785 });
  assert.equal(built.ok, true);
  if (!built.ok) return;
  assert.equal(built.calibration.demo, true);
  const here = geographicToPixel(14, 121, built.calibration);
  assert.equal(here.ok, true);
  if (!here.ok) return;
  assert.ok(Math.abs(here.point.x - 387) < 0.05);
  assert.ok(Math.abs(here.point.y - 785) < 0.05);
  const fifteenMetersEast =
    121 + 15 / (111_320 * Math.cos((14 * Math.PI) / 180));
  const moved = geographicToPixel(14, fifteenMetersEast, built.calibration);
  assert.equal(moved.ok, true);
  if (!moved.ok) return;
  assert.ok(Math.abs(moved.point.x - (387 + 120)) < 1);
  assert.ok(Math.abs(moved.point.y - 785) < 1);
});

test("gps poses are not published and calibration stays on the supplied store", () => {
  assert.equal(
    shouldPublishPose({ sharing: true, hidden: false, gpsEnabled: false }),
    true,
  );
  assert.equal(
    shouldPublishPose({ sharing: true, hidden: false, gpsEnabled: true }),
    false,
  );
  assert.equal(
    shouldPublishPose({ sharing: false, hidden: false, gpsEnabled: false }),
    false,
  );
  const memory = new Map();
  const store = {
    getItem: (key) => memory.get(key) ?? null,
    setItem: (key, value) => memory.set(key, value),
    removeItem: (key) => memory.delete(key),
  };
  writeCalibration({ points: surveyed }, store);
  assert.equal(readCalibration(store).points.length, 3);
  writeCalibration({ points: [] }, store);
  assert.equal(readCalibration(store).points.length, 0);
  writeCampusRole("device", "Teacher", store);
  assert.equal(readCampusRole("device", store), "Teacher");
  writeCampusRole("device", "", store);
  assert.equal(readCampusRole("device", store), "");
  assert.equal(readCampusRole("other", store), "");
});
