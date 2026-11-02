import test from "node:test";
import assert from "node:assert/strict";
import {
  cropBounds,
  validatePhotoFile,
  MAX_PHOTO_BYTES,
} from "../src/lib/profile-photo.ts";
import { emptyStudent, validateStudent } from "../src/lib/student-profile.ts";

test("portrait cropping stays inside wide and tall images at every zoom and position", () => {
  for (const [width, height] of [
    [3000, 1000],
    [800, 1600],
    [640, 800],
  ])
    for (const zoom of [1, 2, 3])
      for (const x of [0, 50, 100])
        for (const y of [0, 50, 100]) {
          const crop = cropBounds(width, height, { zoom, x, y });
          assert.ok(crop.x >= 0 && crop.y >= 0);
          assert.ok(
            crop.x + crop.width <= width + 1e-6 &&
              crop.y + crop.height <= height + 1e-6,
          );
          assert.ok(Math.abs(crop.width / crop.height - 0.8) < 1e-6);
        }
});
test("profile photo type checks reject disguised formats and oversized uploads", async () => {
  await assert.rejects(
    validatePhotoFile(
      new File(["<svg/>"], "photo.jpg", { type: "image/jpeg" }),
    ),
    /valid JPG/,
  );
  await assert.rejects(
    validatePhotoFile(
      new File([new Uint8Array(MAX_PHOTO_BYTES + 1)], "huge.png", {
        type: "image/png",
      }),
    ),
    /15 MB/,
  );
  await assert.rejects(
    validatePhotoFile(new File(["GIF89a"], "photo.gif", { type: "image/gif" })),
    /valid JPG/,
  );
});
test("student profiles default to private and character changes preserve independent identity fields", () => {
  const original = {
    ...emptyStudent(),
    name: "Ana",
    sex: "Female",
    avatar: "boy",
    photo_available: true,
  };
  const changed = validateStudent({ ...original, avatar: "girl" });
  assert.equal(changed.name, "Ana");
  assert.equal(changed.sex, "Female");
  assert.equal(changed.photo_available, true);
  assert.equal(changed.sharing, false);
  assert.ok(
    Object.values(changed.visibility).every((value) => value === false),
  );
  assert.throws(
    () => validateStudent({ ...original, name: "a".repeat(81) }),
    /80 characters/,
  );
});
