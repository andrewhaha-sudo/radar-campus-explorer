import test from "node:test";
import assert from "node:assert/strict";
import { publishFloorDraft } from "../src/lib/pathfinder-client.ts";
import { createFloorDocument, annotationAt } from "../src/lib/floorplan.ts";
import { scenes } from "../src/components/map/campus-data.ts";
import { campusRegistry } from "../scripts/campus-registry.mjs";
const doc = () =>
  createFloorDocument("a1", [
    annotationAt("exit", { x: 200, y: 100 }, scenes.a1.crop),
  ]);
test("anonymous publishing fails before any document mutation", async () => {
  const calls = [];
  await assert.rejects(
    publishFloorDraft("a1", doc(), async (url) => {
      calls.push(url);
      return new Response("{}", { status: 401 });
    }),
    /sign in/i,
  );
  assert.equal(calls.length, 1);
});
test("publishing creates a separate shared document and leaves the base untouched", async () => {
  const calls = [];
  const fake = async (url, init) => {
    calls.push({ url, init });
    if (url === "/api/auth/me")
      return Response.json({ user: { role: "staff" } });
    if (url === "/campus-registry.json") return Response.json(campusRegistry());
    if (init?.method === "HEAD") return new Response(null, { status: 200 });
    if (url === "/api/documents")
      return Response.json(
        { document: { id: "new-shared-draft" } },
        { status: 201 },
      );
    if (url === "/api/documents/new-shared-draft/annotations")
      return Response.json({ ok: true, count: 1 });
    throw Error("Unexpected operation " + url);
  };
  assert.equal(await publishFloorDraft("a1", doc(), fake), "new-shared-draft");
  assert.ok(
    calls.some((c) => c.url === "/api/documents" && c.init.method === "POST"),
  );
  assert.ok(
    !calls.some((c) => c.url === "/api/documents/radar-doc-a1/annotations"),
  );
});
test("a changed source registration is rejected before publishing", async () => {
  const registry = campusRegistry();
  registry[0].sourceRegistration.crop.x++;
  const fake = async (url) =>
    url === "/api/auth/me"
      ? Response.json({ user: { role: "admin" } })
      : Response.json(registry);
  await assert.rejects(publishFloorDraft("a1", doc(), fake), /drawing/i);
});
