import test from "node:test";
import assert from "node:assert/strict";
import {
  callTarget,
  createAlert,
  createHazard,
  emptyRecords,
  recordSos,
  reviewHazard,
  saveInspection,
} from "../src/lib/radar-records.ts";
import { safetyGuidance } from "../src/lib/safety-guidance.ts";

test("a hazard stays a demo report until a person reviews it", () => {
  const hazard = createHazard({
    category: "blocked_pathway",
    buildingId: "b",
    roomId: "B-101",
    description: "Practice blockage",
    severity: "high",
  });
  assert.equal(hazard.source, "DEMO");
  assert.equal(hazard.status, "reported");
  const reviewed = reviewHazard(
    { ...emptyRecords(), hazards: [hazard] },
    hazard.id,
    "reviewed",
  );
  assert.equal(reviewed.hazards[0].status, "reviewed");
  assert.notEqual(reviewed.hazards[0].status, "confirmed");
});

test("alerts and sos stay on the device and do not claim dispatch", () => {
  const withAlert = createAlert(emptyRecords(), {
    title: "Practice",
    message: "This is a drill note.",
    severity: "info",
    authority: "",
    expiresAt: "2026-11-02T08:00:00.000Z",
  });
  assert.equal(withAlert.alerts[0].sms, "NOT CONFIGURED");
  assert.equal(withAlert.alerts[0].authority, "Not a school authority");
  const withSos = recordSos(emptyRecords(), "Practice help");
  assert.equal(withSos.sos[0].status, "recorded_on_device");
  assert.equal(callTarget(""), null);
  assert.equal(callTarget("0917 123 4567"), "tel:09171234567");
});

test("inspection drafts do not invent an ai result", () => {
  const saved = saveInspection(emptyRecords(), {
    roomId: "B-101",
    exitVisible: true,
    passageClear: false,
    equipmentVisible: true,
    notes: "Door visible",
  });
  assert.equal(saved.inspections[0].ai, "Not evaluated");
});

test("shaking never produces an evacuation route", () => {
  assert.equal(safetyGuidance(true).route, null);
  assert.equal(safetyGuidance(true).mode, "shelter");
  assert.match(safetyGuidance(true).title, /Drop, Cover, and Hold On/);
  assert.equal(safetyGuidance(false).route, null);
  assert.match(safetyGuidance(false).title, /ROUTE UNVERIFIED/);
});
