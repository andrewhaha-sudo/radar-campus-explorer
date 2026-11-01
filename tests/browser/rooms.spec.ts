import { test, expect } from "@playwright/test";

const photo = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jZ1kAAAAASUVORK5CYII=",
  "base64",
);

test("new C, lab and D interiors are connected, have correct room counts, and exit at their own buildings", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await page.goto("/");
  await expect(page.locator('[aria-label="Building E sign"]')).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Explore Building E", exact: true }),
  ).toBeVisible();
  for (const destination of [
    { room: "C-101", building: "Building C", count: 1, x: 181, y: 409 },
    { room: "LAB-101", building: "Chemistry Lab", count: 1, x: 408, y: 408 },
    { room: "D-102", building: "Building D", count: 2, x: 1112, y: 411 },
  ]) {
    await page.locator("#campus-room").selectOption(destination.room);
    await expect(page.locator(".campus-status")).toContainText(
      `Room ${destination.room} · Floor 1. You have reached`,
      { timeout: 30_000 },
    );
    await expect(page.locator(".campus-map-toolbar")).toContainText(
      `${destination.building} · Floor 1`,
    );
    await expect(page.locator(".campus-hotspot[data-room-id]")).toHaveCount(
      destination.count,
    );
    await page
      .getByRole("button", { name: "Walk to exit", exact: true })
      .click();
    await expect(page.locator(".campus-map-toolbar")).toContainText(
      "Outdoor campus",
    );
    await expect(page.locator(".campus-student")).toHaveAttribute(
      "transform",
      `translate(${destination.x},${destination.y})`,
    );
  }
});

test("route arrows can be hidden and shown while the character continues along the connected route", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Show route arrows").uncheck();
  await page.locator("#campus-room").selectOption("B-201");
  await expect(page.locator("[data-route-arrows]")).toHaveCount(0);
  const position = await page
    .locator(".campus-student")
    .getAttribute("transform");
  await expect(page.locator(".campus-student")).not.toHaveAttribute(
    "transform",
    position!,
  );
  await page.getByLabel("Show route arrows").check();
  await expect(page.locator("[data-route-arrows]")).toBeVisible();
  await expect(page.locator("[data-route-arrows] marker")).toHaveCount(1);
  await page.locator("#campus-map").focus();
  await page.keyboard.press("ArrowDown");
  await expect(page.locator("[data-route-arrows]")).toHaveCount(0);
});

test("room photo upload survives reload, stays scoped to its room, and rejects corrupt files", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Indoor floor plans", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Building D 1 floor · 2 rooms", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Open Room D-101 photo", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("heading", { name: "Room D-101", exact: true }),
  ).toBeVisible();
  await expect(dialog.getByText("No photo for this room yet")).toBeVisible();
  await dialog
    .getByLabel("Add room photo", { exact: true })
    .setInputFiles({
      name: "classroom.png",
      mimeType: "image/png",
      buffer: photo,
    });
  await expect(dialog.getByRole("status")).toHaveText(
    "Photo saved. Click this room again to view it.",
  );
  await expect(
    dialog.getByRole("img", { name: "Photo of Room D-101", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Open Room D-101 photo", exact: true }),
  ).toBeFocused();
  await page.reload();
  await page
    .getByRole("button", { name: "Indoor floor plans", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Building D 1 floor · 2 rooms", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Open Room D-101 photo", exact: true })
    .click();
  await expect(
    dialog.getByRole("img", { name: "Photo of Room D-101", exact: true }),
  ).toBeVisible();
  await expect(dialog.getByText("Saved in this browser")).toBeVisible();
  await dialog
    .getByLabel("Replace room photo", { exact: true })
    .setInputFiles({
      name: "broken.png",
      mimeType: "image/png",
      buffer: Buffer.from("not an image"),
    });
  await expect(dialog.getByRole("alert")).toContainText("could not be opened");
  await expect(
    dialog.getByRole("img", { name: "Photo of Room D-101", exact: true }),
  ).toBeVisible();
  await dialog
    .getByRole("button", { name: "Close room photo", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Open Room D-102 photo", exact: true })
    .click();
  await expect(dialog.getByText("No photo for this room yet")).toBeVisible();
  await expect(dialog.getByRole("img")).toHaveCount(0);
});

test("every interior door and original-sheet room opens the matching photo viewer", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Indoor floor plans", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Open Room B-202 photo", exact: true })
    .click();
  await expect(
    page
      .getByRole("dialog")
      .getByRole("heading", { name: "Room B-202", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Close room photo", exact: true })
    .click();
  for (const building of [
    "Building C 1 floor · 1 room",
    "Chemistry Lab 1 floor · 1 room",
    "Building A 1 floor · 2 classrooms",
    "Building 6 2 floors · 10 classrooms",
  ]) {
    await page
      .getByRole("button", { name: "Indoor floor plans", exact: true })
      .click();
    await page.getByRole("button", { name: building, exact: true }).click();
    const doors = page.locator(".campus-hotspot[data-room-id]");
    for (let index = 0; index < (await doors.count()); index++) {
      const id = await doors.nth(index).getAttribute("data-room-id");
      await doors.nth(index).click();
      await expect(
        page
          .getByRole("dialog")
          .getByRole("heading", { name: `Room ${id}`, exact: true }),
      ).toBeVisible();
      await page
        .getByRole("button", { name: "Close room photo", exact: true })
        .click();
    }
  }
});

test("published photos work without local storage and a failed upload never reports success", async ({
  page,
}) => {
  await page.route("**/room-photos.json", (route) =>
    route.fulfill({
      json: {
        "A-101": { src: "/room-photos/room.png", caption: "Our classroom" },
      },
    }),
  );
  await page.route("**/room-photos/room.png", (route) =>
    route.fulfill({ contentType: "image/png", body: photo }),
  );
  await page.addInitScript(() => {
    indexedDB.open = () => {
      throw new DOMException("Unavailable in this test", "SecurityError");
    };
  });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Indoor floor plans", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Open Room A-101 photo", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("img", { name: "Photo of Room A-101", exact: true }),
  ).toBeVisible();
  await expect(dialog.getByText("Published with this site")).toBeVisible();
  await dialog
    .getByLabel("Replace room photo", { exact: true })
    .setInputFiles({
      name: "classroom.png",
      mimeType: "image/png",
      buffer: photo,
    });
  await expect(dialog.getByRole("alert")).toBeVisible();
  await expect(
    dialog.getByText("Photo saved. Click this room again to view it."),
  ).toHaveCount(0);
});
