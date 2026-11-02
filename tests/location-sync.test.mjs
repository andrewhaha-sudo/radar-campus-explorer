import test from "node:test";
import assert from "node:assert/strict";
import {
  assessFix,
  directionFromHeading,
  distanceMeters,
  LocationWatcher,
  movementMode,
  acceptNewerFix,
  fixClock,
  gpsMoveGate,
  predictReading,
  readingWithMotion,
  shouldHeartbeat,
  shouldPublishPose,
} from "../src/lib/location-sync.ts";
import {
  demoCalibrationFromHere,
  fitAffine,
  geographicToPixel,
  pixelToGeographic,
  projectAffine,
  readCalibration,
  writeCalibration,
} from "../src/lib/map-calibration.ts";
import { googleMapView } from "../src/lib/google-map.ts";
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

test("manual exploration stays distinct from location follow", () => {
  assert.equal(movementMode({ enabled: false, paused: false, status: "disabled" }).id, "manual");
  assert.equal(
    movementMode({ enabled: true, paused: false, status: "calibration_required" }).label,
    "Manual exploration",
  );
  assert.equal(movementMode({ enabled: true, paused: false, status: "connected" }).id, "follow");
  assert.equal(
    movementMode({ enabled: true, paused: true, status: "connected" }).id,
    "manual",
  );
  assert.equal(
    movementMode({ enabled: true, paused: false, status: "low_accuracy" }).id,
    "approximate",
  );
});

test("small GPS noise does not move the character and a real step does", () => {
  assert.equal(gpsMoveGate(null, reading({ accuracy: 5 })).reason, "first");
  const stood = gpsMoveGate(
    { latitude: 14, longitude: 121 },
    reading({ latitude: 14.00001, longitude: 121, accuracy: 5 }),
  );
  assert.equal(stood.accept, false);
  assert.equal(stood.reason, "jitter");
  const step = gpsMoveGate(
    { latitude: 14, longitude: 121 },
    reading({
      latitude: 14,
      longitude: 121 + 15 / (111_320 * Math.cos((14 * Math.PI) / 180)),
      accuracy: 5,
    }),
  );
  assert.equal(step.accept, true);
  assert.equal(step.reason, "trusted");
  const stride = gpsMoveGate(
    { latitude: 14, longitude: 121 },
    reading({ latitude: 14 + 2.5 / 111_320, longitude: 121, accuracy: 5 }),
  );
  assert.equal(stride.accept, true);
  const coarse = gpsMoveGate(
    { latitude: 14, longitude: 121 },
    reading({ latitude: 14.00005, longitude: 121, accuracy: 20 }),
  );
  assert.equal(coarse.accept, false);
  assert.equal(coarse.reason, "jitter");
});

test("a quiet phone is fresh, then holding, then hidden", () => {
  assert.equal(fixClock(1_000, 2_000), "fresh");
  assert.equal(fixClock(1_000, 5_000), "stale");
  assert.equal(fixClock(1_000, 12_000), "hidden");
  assert.equal(shouldHeartbeat(1_000, 2_500, false), false);
  assert.equal(shouldHeartbeat(1_000, 3_000, false), true);
  assert.equal(shouldHeartbeat(1_000, 9_000, true), false);
  assert.equal(acceptNewerFix(reading({ timestamp: 2_000 }), reading({ timestamp: 1_500 })), false);
  const moved = readingWithMotion(
    reading({ latitude: 14, longitude: 121, timestamp: 1_000, speed: null, heading: null }),
    reading({ latitude: 14, longitude: 121.00002, timestamp: 2_000, speed: null, heading: null }),
  );
  assert.ok(moved.speed > 0.4 && moved.speed <= 5);
  assert.ok(moved.heading > 45 && moved.heading < 135);
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

test("pixel coordinates convert back to the surveyed latitude and longitude", () => {
  const calibration = { points: surveyed };
  const geographic = pixelToGeographic({ x: 868, y: 411 }, calibration);
  assert.equal(geographic.ok, true);
  if (!geographic.ok) return;
  assert.ok(Math.abs(geographic.latitude - 14) < 1e-6);
  assert.ok(Math.abs(geographic.longitude - 121.01) < 1e-6);
  assert.deepEqual(
    googleMapView({ apiKey: "", latitude: 14, longitude: 121 }),
    {
      mode: "not_configured",
      openUrl: "https://www.google.com/maps/search/?api=1&query=14,121",
    },
  );
  assert.equal(
    googleMapView({ apiKey: "browser-key", latitude: null, longitude: null }).mode,
    "needs_location",
  );
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
