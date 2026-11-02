import { expect, test } from "@playwright/test";

test("gps stays off the character until the device is calibrated", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: 14, longitude: 121.01, accuracy: 5 });
  await page.goto("/");
  await expect(page.locator("[data-gps-status]")).toHaveAttribute(
    "data-gps-status",
    "disabled",
  );
  const player = page.locator("[data-player='you']");
  await expect(player).toHaveAttribute("data-x", "387");
  await page.getByRole("button", { name: "Enable GPS" }).click();
  await expect(page.locator("[data-gps-status]")).toHaveAttribute(
    "data-gps-status",
    "calibration_required",
  );
  await expect(page.getByText("Map Calibration Required").first()).toBeVisible();
  await expect(player).toHaveAttribute("data-x", "387");
  await expect(player).toHaveAttribute("data-y", "785");
});

test("a calibrated accurate fix walks the existing character and disable stops it", async ({
  page,
  context,
}) => {
  test.setTimeout(90_000);
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: 14, longitude: 121.01, accuracy: 5 });
  await page.goto("/");
  await page.getByText("Calibrate this device").click();
  const points = [
    ["1", "14", "121", "387", "785"],
    ["2", "14", "121.01", "868", "411"],
    ["3", "13.99", "121", "547", "1057"],
  ];
  for (const [index, latitude, longitude, x, y] of points) {
    await page.getByLabel(`Calibration point ${index} latitude`).fill(latitude);
    await page.getByLabel(`Calibration point ${index} longitude`).fill(longitude);
    await page.getByLabel(`Calibration point ${index} map x`).fill(x);
    await page.getByLabel(`Calibration point ${index} map y`).fill(y);
  }
  await page.getByRole("button", { name: "Save calibration on this device" }).click();
  await page.getByRole("button", { name: "Enable GPS" }).click();
  await expect(page.locator("[data-gps-status]")).toHaveAttribute(
    "data-gps-status",
    "connected",
    { timeout: 20_000 },
  );
  const player = page.locator("[data-player='you']");
  await expect
    .poll(
      async () => {
        const x = Number(await player.getAttribute("data-x"));
        const y = Number(await player.getAttribute("data-y"));
        return Math.hypot(x - 868, y - 411);
      },
      { timeout: 45_000 },
    )
    .toBeLessThan(20);
  await page.getByRole("button", { name: "Disable GPS" }).click();
  await expect(page.locator("[data-gps-status]")).toHaveAttribute(
    "data-gps-status",
    "disabled",
  );
  const stopped = {
    x: Number(await player.getAttribute("data-x")),
    y: Number(await player.getAttribute("data-y")),
  };
  await context.setGeolocation({ latitude: 13.99, longitude: 121, accuracy: 5 });
  await page.waitForTimeout(1500);
  await expect(player).toHaveAttribute("data-x", String(stopped.x));
  await expect(player).toHaveAttribute("data-y", String(stopped.y));
});

test("a low-accuracy fix does not move the character", async ({ page, context }) => {
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: 14, longitude: 121.01, accuracy: 80 });
  await page.addInitScript(() => {
    localStorage.setItem(
      "campus-explorer-map-calibration",
      JSON.stringify({
        points: [
          { id: "gate", label: "Gate", latitude: 14, longitude: 121, x: 387, y: 785 },
          {
            id: "building-a",
            label: "Building A",
            latitude: 14,
            longitude: 121.01,
            x: 868,
            y: 411,
          },
          { id: "garden", label: "Garden", latitude: 13.99, longitude: 121, x: 547, y: 1057 },
        ],
      }),
    );
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Enable GPS" }).click();
  await expect(page.locator("[data-gps-status]")).toHaveAttribute(
    "data-gps-status",
    "low_accuracy",
    { timeout: 20_000 },
  );
  await expect(page.getByText("Approximate location").first()).toBeVisible();
  const player = page.locator("[data-player='you']");
  await expect(player).toHaveAttribute("data-x", "387");
  await expect(player).toHaveAttribute("data-y", "785");
});

test("saving the current location creates a demo calibration the character can follow", async ({
  page,
  context,
}) => {
  test.setTimeout(90_000);
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ latitude: 14, longitude: 121, accuracy: 5 });
  await page.goto("/");
  await page.getByRole("button", { name: "Save my location" }).click();
  await expect(page.getByText("DEMO calibration saved").first()).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.locator("[data-gps-status]")).toHaveAttribute(
    "data-gps-status",
    "connected",
    { timeout: 20_000 },
  );
  const player = page.locator("[data-player='you']");
  await expect
    .poll(async () => Number(await player.getAttribute("data-x")))
    .toBeLessThan(400);
  await context.setGeolocation({
    latitude: 14,
    longitude: 121 + 15 / (111_320 * Math.cos((14 * Math.PI) / 180)),
    accuracy: 5,
  });
  await expect
    .poll(async () => Number(await player.getAttribute("data-x")), {
      timeout: 30_000,
    })
    .toBeGreaterThan(470);
});

test("the device role is editable and stays separate from the walking character", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Student profile" }).click();
  await expect(page.getByText("NOT SET").first()).toBeVisible();
  await page.getByRole("button", { name: "Edit Student Profile" }).click();
  await page.getByLabel("Role on this device").selectOption("Teacher");
  await page.locator("form.student-editor").getByRole("button", { name: "Save Changes" }).click();
  await expect(page.locator(".trainer-fields")).toContainText("Teacher");
  await page.reload();
  await page.getByRole("button", { name: "Student profile" }).click();
  await expect(page.locator(".trainer-fields")).toContainText("Teacher");
  await expect(page.locator("[data-player='you']")).toBeVisible();
});
