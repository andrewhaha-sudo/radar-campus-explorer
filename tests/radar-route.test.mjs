import test from "node:test";
import assert from "node:assert/strict";
import { formatRoute, parseRoute } from "../src/lib/radar-route.ts";

test("section links survive as hashes and unknown links return to campus", () => {
  assert.equal(parseRoute(""), "campus");
  assert.equal(parseRoute("#hazards"), "hazards");
  assert.equal(parseRoute("#not-a-section"), "campus");
  assert.equal(formatRoute("sos"), "#sos");
});
