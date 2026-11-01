import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

test("retiring the previous worker clears only shell caches and leaves saved offline data intact", async () => {
  const handlers = new Map();
  const deleted = [];
  const reloaded = [];
  let unregistered = false;
  const existing = [
    "radar-shell-v1-shell",
    "radar-shell-v2-assets",
    "radar:offline-pack",
    "unrelated-cache",
  ];
  runInNewContext(
    readFileSync(new URL("../public/sw.js", import.meta.url), "utf8"),
    {
      self: {
        addEventListener: (name, callback) => handlers.set(name, callback),
        skipWaiting: async () => {},
        registration: {
          unregister: async () => {
            unregistered = true;
          },
        },
        clients: {
          matchAll: async () => [
            {
              url: "https://campus.example/",
              navigate: async (url) => reloaded.push(url),
            },
          ],
        },
      },
      caches: {
        keys: async () => existing,
        delete: async (name) => deleted.push(name),
      },
    },
  );
  let activation;
  handlers.get("activate")({
    waitUntil: (promise) => {
      activation = promise;
    },
  });
  await activation;
  assert.deepEqual(deleted, ["radar-shell-v1-shell", "radar-shell-v2-assets"]);
  assert.equal(unregistered, true);
  assert.deepEqual(reloaded, ["https://campus.example/"]);
  assert.equal(
    handlers.has("fetch"),
    false,
    "the retired worker must not intercept the new site",
  );
});
