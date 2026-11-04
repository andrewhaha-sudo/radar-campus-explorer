import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

async function open(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Edit floorplan", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "Floorplan editor" });
  await expect(dialog).toBeVisible();
  return dialog;
}

test("Pathfinder annotations persist per floor and appear over the indoor explorer", async ({
  page,
}) => {
  const dialog = await open(page);
  await dialog.getByRole("button", { name: "Exit", exact: true }).click();
  const drawing = dialog.getByRole("application", {
    name: "Floorplan drawing",
  });
  await drawing.scrollIntoViewIfNeeded();
  const box = await drawing.boundingBox();
  await drawing.click({
    position: { x: box!.width * 0.5, y: box!.height * 0.5 },
  });
  await expect(
    dialog.getByRole("heading", { name: "Annotations (1)", exact: true }),
  ).toBeVisible();
  await dialog.getByLabel("Label / note").fill("Assembly exit draft");
  await dialog
    .getByRole("button", { name: "Save annotation", exact: true })
    .click();
  await expect(dialog.getByRole("status")).toHaveText("Saved on this device.");
  await dialog.getByLabel("Building and floor").selectOption("b2");
  await expect(
    dialog.getByRole("heading", { name: "Annotations (0)", exact: true }),
  ).toBeVisible();
  await dialog.getByLabel("Building and floor").selectOption("a1");
  await expect(
    dialog.getByRole("button", {
      name: "Exit 1 · Assembly exit draft",
      exact: true,
    }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Close floorplan editor" }).click();
  await expect(
    page.getByRole("button", { name: "Edit floorplan", exact: true }),
  ).toBeFocused();
  await page.reload();
  await page
    .getByRole("button", { name: "Edit floorplan", exact: true })
    .click();
  await expect(
    page.getByRole("button", {
      name: "Exit 1 · Assembly exit draft",
      exact: true,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Close floorplan editor" }).click();
  await page
    .getByRole("button", { name: "Indoor floor plans", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "Building A 1 floor · 2 classrooms",
      exact: true,
    })
    .click();
  await expect(page.locator('[data-floorplan-annotations="1"]')).toBeVisible();
  await page
    .getByRole("button", { name: "Open Room A-101 photo", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Room A-101", exact: true }),
  ).toBeVisible();
});

test("keyboard placement, deletion, undo and redo use Pathfinder history", async ({
  page,
}) => {
  const dialog = await open(page);
  await dialog.getByRole("button", { name: "AED", exact: true }).click();
  const drawing = dialog.getByRole("application", {
    name: "Floorplan drawing",
  });
  await drawing.focus();
  await drawing.press("ArrowRight");
  await drawing.press("Enter");
  await expect(
    dialog.getByRole("button", { name: "AED 1", exact: true }),
  ).toBeVisible();
  await dialog
    .getByRole("button", { name: "Delete annotation", exact: true })
    .click();
  await expect(
    dialog.getByRole("heading", { name: "Annotations (0)", exact: true }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Undo", exact: true }).click();
  await expect(
    dialog.getByRole("button", { name: "AED 1", exact: true }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Redo", exact: true }).click();
  await expect(
    dialog.getByRole("heading", { name: "Annotations (0)", exact: true }),
  ).toBeVisible();
});

test("drawn areas export and import with floor registration; invalid imports preserve the draft", async ({
  page,
}) => {
  const dialog = await open(page);
  await dialog.getByRole("button", { name: "Area", exact: true }).click();
  const drawing = dialog.getByRole("application", {
    name: "Floorplan drawing",
  });
  await drawing.scrollIntoViewIfNeeded();
  const box = (await drawing.boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.3);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.4, box.y + box.height * 0.5);
  await page.mouse.up();
  await expect(
    dialog.getByRole("button", { name: "Area 1", exact: true }),
  ).toBeVisible();
  const download = page.waitForEvent("download");
  await dialog.getByRole("button", { name: "Export floor JSON" }).click();
  const file = await download;
  const raw = await readFile((await file.path())!, "utf8");
  const data = JSON.parse(raw);
  expect(data.radar.sceneId).toBe("a1");
  expect(data.document.pages[0].annotations[0].w).toBeCloseTo(0.2, 2);
  expect(data.document.totalAnnotations).toBe(1);
  await dialog
    .getByRole("button", { name: "Delete annotation", exact: true })
    .click();
  await dialog
    .getByLabel("Import floor JSON")
    .setInputFiles({
      name: "floor.json",
      mimeType: "application/json",
      buffer: Buffer.from(raw),
    });
  await expect(
    dialog.getByRole("button", { name: "Area 1", exact: true }),
  ).toBeVisible();
  await dialog
    .getByLabel("Import floor JSON")
    .setInputFiles({
      name: "invalid.json",
      mimeType: "application/json",
      buffer: Buffer.from("{bad"),
    });
  await expect(dialog.getByRole("alert")).toContainText("not valid JSON");
  await expect(
    dialog.getByRole("button", { name: "Area 1", exact: true }),
  ).toBeVisible();
  await dialog.getByLabel("Building and floor").selectOption("b2");
  await dialog
    .getByLabel("Import floor JSON")
    .setInputFiles({
      name: "wrong-floor.json",
      mimeType: "application/json",
      buffer: Buffer.from(raw),
    });
  await expect(dialog.getByRole("alert")).toContainText("different floor");
  await expect(
    dialog.getByRole("heading", { name: "Annotations (0)", exact: true }),
  ).toBeVisible();
});

test("storage failures stay explicit and the editor offers license and corresponding source", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (key.startsWith("radar-pathfinder-floor-"))
        throw new DOMException("Quota exceeded", "QuotaExceededError");
      return original.call(this, key, value);
    };
  });
  const dialog = await open(page);
  await dialog.getByRole("button", { name: "Exit", exact: true }).click();
  const drawing = dialog.getByRole("application", {
    name: "Floorplan drawing",
  });
  await drawing.focus();
  await drawing.press("Enter");
  await expect(dialog.getByRole("alert")).toContainText("have not been saved");
  await expect(dialog.getByRole("status")).toContainText("only in memory");
  expect((await page.request.get("/licenses/AGPL-3.0.txt")).status()).toBe(200);
  const source = await page.request.get("/source/radar-campus-explorer.tar.gz");
  expect(source.status()).toBe(200);
  expect((await source.body()).subarray(0, 2)).toEqual(
    Buffer.from([0x1f, 0x8b]),
  );
});
