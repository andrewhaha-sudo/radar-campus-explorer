import { test, expect } from "@playwright/test";
import {
  actorPosition,
  geoAt,
  installDeviceLocation,
  sendLocation,
  testCalibration,
} from "./helpers/device-location";

test("calibration is required, uses verified references and persists without starting GPS", async ({
  page,
}) => {
  await installDeviceLocation(page, false);
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Enable location sync", exact: true }),
  ).toBeDisabled();
  expect(await page.evaluate(() => (window as any).__gps.calls.length)).toBe(0);
  await page
    .getByRole("button", { name: "Calibrate map", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByLabel("Latitude", { exact: true }).first(),
  ).toHaveValue("");
  await dialog.getByLabel("Import calibration", { exact: true }).setInputFiles({
    name: "verified-campus.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(testCalibration)),
  });
  await expect(
    dialog.getByRole("group", { name: "Reference 4", exact: true }),
  ).toBeVisible();
  await dialog
    .getByLabel(
      "I have checked these reference points against the physical campus.",
    )
    .check();
  await dialog
    .getByRole("button", { name: "Save calibration", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Enable location sync", exact: true }),
  ).toBeEnabled();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Enable location sync", exact: true }),
  ).toBeEnabled();
  expect(await page.evaluate(() => (window as any).__gps.calls.length)).toBe(0);
  await page
    .getByRole("button", { name: "Edit map calibration", exact: true })
    .click();
  // Collinear image coordinates must not overwrite the saved alignment.
  for (const input of await dialog.getByLabel("Image X", { exact: true }).all())
    await input.fill("500");
  await dialog
    .getByLabel(
      "I have checked these reference points against the physical campus.",
    )
    .check();
  await dialog
    .getByRole("button", { name: "Save calibration", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toContainText("straight line");
  expect(
    await page.evaluate(
      () =>
        JSON.parse(localStorage.getItem("campus-explorer-map-calibration-v1")!)
          .points[0].x,
    ),
  ).toBe(50);
});

test("device fixes drive the avatar, reject drift and low accuracy, recover signal, and stop without saving GPS history", async ({
  page,
}) => {
  await installDeviceLocation(page);
  await page.clock.install();
  await page.goto("/");
  const status = page.locator(".location-status");
  await page
    .getByRole("button", { name: "Enable location sync", exact: true })
    .click();
  await expect(status).toHaveAttribute("data-status", "locating");
  await expect(page.locator(".campus-student")).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).__gps.calls[0])).toEqual({
    enableHighAccuracy: true,
    maximumAge: 0,
    timeout: 15000,
  });
  await sendLocation(page, 620, 490);
  await expect(status).toHaveAttribute("data-status", "live");
  expect((await actorPosition(page)).x).toBeCloseTo(620, 2);
  await expect(
    page.getByRole("button", {
      name: "Walk east",
      exact: true,
      includeHidden: true,
    }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Indoor floor plans", exact: true }),
  ).toBeDisabled();
  await page.clock.runFor(1000);
  await sendLocation(page, 624, 493);
  expect((await actorPosition(page)).x).toBeCloseTo(620, 2);
  await page.clock.runFor(1000);
  await sendLocation(page, 670, 490, { heading: 90, speed: 1.5 });
  await expect
    .poll(async () => (await actorPosition(page)).x)
    .toBeCloseTo(670, 2);
  await expect(page.locator(".campus-student .student-sprite")).toHaveAttribute(
    "data-direction",
    "right",
  );
  await expect(page.locator(".location-heading")).toHaveCount(1);
  await page.clock.runFor(1300);
  await expect(page.locator(".campus-student .student-sprite")).toHaveClass(
    /sprite-idle/,
  );
  await sendLocation(page, 720, 490, { accuracy: 80 });
  await expect(status).toHaveAttribute("data-status", "uncertain");
  await expect(page.getByTestId("location-accuracy")).toHaveText("±80 m");
  expect((await actorPosition(page)).x).toBeCloseTo(670, 2);
  await page.clock.runFor(22_000);
  await expect(status).toHaveAttribute("data-status", "unavailable");
  expect((await actorPosition(page)).x).toBeCloseTo(670, 2);
  await sendLocation(page, 720, 490, { heading: 180, speed: 1 });
  await expect(status).toHaveAttribute("data-status", "live");
  expect((await actorPosition(page)).x).toBeCloseTo(720, 2);
  await page
    .getByRole("button", { name: "Disable location sync", exact: true })
    .click();
  expect(await page.evaluate(() => (window as any).__gps.active())).toBe(0);
  await page.clock.runFor(1000);
  await sendLocation(page, 750, 490, { late: true });
  await expect(status).toHaveAttribute("data-status", "inactive");
  expect((await actorPosition(page)).x).toBeCloseTo(720, 2);
  await page
    .getByRole("button", { name: "Enable location sync", exact: true })
    .click();
  await page.clock.runFor(1000);
  await sendLocation(page, 750, 490, { accuracy: 80 });
  await expect(status).toHaveAttribute("data-status", "uncertain");
  expect((await actorPosition(page)).x).toBeCloseTo(720, 2);
  await page.evaluate(
    (point) =>
      (window as any).__gps.emit({
        coords: { ...point, accuracy: 5, heading: null, speed: null },
        timestamp: Date.now() + 86_400_000,
      }),
    geoAt(750, 490),
  );
  await expect(status).toHaveAttribute("data-status", "unavailable");
  await page.clock.runFor(1000);
  await sendLocation(page, 750, 490);
  await expect(status).toHaveAttribute("data-status", "live");
  expect((await actorPosition(page)).x).toBeCloseTo(750, 2);
  await page
    .getByRole("button", { name: "Disable location sync", exact: true })
    .click();
  const saved = await page.evaluate(() => JSON.stringify(localStorage));
  expect(saved).not.toContain(String(geoAt(720, 490).latitude));
  expect(
    await page.evaluate(async () =>
      (await indexedDB.databases()).map((db) => db.name),
    ),
  ).not.toContain("gps-history");
  await page.reload();
  await expect(status).toHaveAttribute("data-status", "inactive");
  await expect(page.locator(".location-uncertainty")).toHaveCount(0);
  expect(await page.evaluate(() => (window as any).__gps.calls.length)).toBe(0);
});

test("permission denial clears the watch; hidden pages pause it and late callbacks cannot move the character", async ({
  page,
}) => {
  await installDeviceLocation(page);
  await page.goto("/");
  const enable = page.getByRole("button", {
    name: "Enable location sync",
    exact: true,
  });
  await enable.click();
  await page.evaluate(() => (window as any).__gps.fail(1));
  await expect(page.locator(".location-status")).toHaveAttribute(
    "data-status",
    "denied",
  );
  expect(await page.evaluate(() => (window as any).__gps.active())).toBe(0);
  await enable.click();
  await sendLocation(page, 620, 490);
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: true,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(page.locator(".location-status")).toHaveAttribute(
    "data-status",
    "paused",
  );
  expect(await page.evaluate(() => (window as any).__gps.active())).toBe(0);
  await sendLocation(page, 720, 490, { late: true });
  expect((await actorPosition(page)).x).toBeCloseTo(620, 2);
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", {
      configurable: true,
      value: false,
    });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  expect(await page.evaluate(() => (window as any).__gps.active())).toBe(1);
  await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
  expect(await page.evaluate(() => (window as any).__gps.active())).toBe(0);
  await expect(page.locator(".location-status")).toHaveAttribute(
    "data-status",
    "inactive",
  );
});

test("indoor fixes never choose a room or floor; manual correction is explicit and stops the device watch", async ({
  page,
}) => {
  await installDeviceLocation(page);
  await page.clock.install();
  await page.goto("/");
  await page
    .getByRole("button", { name: "Enable location sync", exact: true })
    .click();
  await sendLocation(page, 620, 490);
  await page.clock.runFor(1000);
  await sendLocation(page, 600, 340);
  await expect(page.locator(".location-status")).toContainText(
    "cannot identify a classroom or floor",
  );
  await expect(page.locator("#campus-map > svg")).toHaveAttribute(
    "aria-label",
    "Outdoor campus interactive map",
  );
  expect((await actorPosition(page)).x).toBeCloseTo(620, 2);
  await page
    .getByRole("button", { name: "Correct location manually", exact: true })
    .click();
  expect(await page.evaluate(() => (window as any).__gps.active())).toBe(0);
  const map = page.locator("#campus-map > svg");
  await map.scrollIntoViewIfNeeded();
  const destination = await map.evaluate((element) => {
    const screen = new DOMPoint(720, 490).matrixTransform(
      (element as SVGSVGElement).getScreenCTM()!,
    );
    return { x: screen.x, y: screen.y };
  });
  await page.mouse.click(destination.x, destination.y);
  await expect(page.locator(".campus-status")).toContainText(
    "Location set manually",
  );
  expect((await actorPosition(page)).x).toBeCloseTo(720, -1);
  await page
    .getByRole("button", { name: "Indoor floor plans", exact: true })
    .click();
  await page
    .getByRole("button", {
      name: "Building C 2 floors · 10 rooms",
      exact: false,
    })
    .click();
  await expect(page.locator("#campus-map > svg")).toHaveAttribute(
    "aria-label",
    /Building C.*Floor 1/,
  );
  expect(await page.evaluate(() => (window as any).__gps.active())).toBe(0);
});

test("nickname, role, avatar and uniform color persist locally and remain visible during GPS sync", async ({
  page,
}) => {
  await installDeviceLocation(page);
  await page.goto("/");
  await page
    .getByRole("button", { name: "Edit identity", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Display name", { exact: true }).fill("Alex");
  await dialog
    .getByRole("combobox", { name: "User role", exact: true })
    .selectOption("Teacher");
  await dialog
    .getByRole("combobox", { name: "Uniform color", exact: true })
    .selectOption("Blue");
  await dialog.getByRole("radio", { name: "Girl", exact: true }).check();
  await dialog
    .getByRole("button", { name: "Save identity", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await page.reload();
  await expect(page.locator(".campus-own-label")).toHaveText("Alex");
  await expect(page.locator(".location-overview")).toContainText("Teacher");
  await page
    .getByRole("button", { name: "Enable location sync", exact: true })
    .click();
  await sendLocation(page, 620, 490);
  await expect(page.locator(".campus-student .student-sprite")).toHaveAttribute(
    "data-avatar",
    "girl",
  );
  await expect(page.locator(".campus-student .student-sprite")).toHaveAttribute(
    "data-color",
    "Blue",
  );
  await expect(page.locator(".campus-own-label")).toHaveText("Alex");
  await page
    .getByRole("button", { name: "Student profile", exact: true })
    .click();
  await expect(page.getByTestId("profile-map-identity")).toContainText(
    "Alex · Teacher · Blue uniform",
  );
});

test("browser geolocation permission and successive device positions use the actual watchPosition integration", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ ...geoAt(620, 490), accuracy: 5 });
  await page.addInitScript(
    (calibration) =>
      localStorage.setItem(
        "campus-explorer-map-calibration-v1",
        JSON.stringify(calibration),
      ),
    testCalibration,
  );
  await page.goto("/");
  await page
    .getByRole("button", { name: "Enable location sync", exact: true })
    .click();
  await expect(page.locator(".location-status")).toHaveAttribute(
    "data-status",
    "live",
  );
  expect((await actorPosition(page)).x).toBeCloseTo(620, 2);
  await context.setGeolocation({ ...geoAt(670, 490), accuracy: 5 });
  await expect
    .poll(async () => (await actorPosition(page)).x)
    .toBeCloseTo(670, 2);
  await page
    .getByRole("button", { name: "Disable location sync", exact: true })
    .click();
  await context.setGeolocation({ ...geoAt(720, 490), accuracy: 5 });
  await expect(page.locator(".location-status")).toHaveAttribute(
    "data-status",
    "inactive",
  );
  expect((await actorPosition(page)).x).toBeCloseTo(670, 2);
});
