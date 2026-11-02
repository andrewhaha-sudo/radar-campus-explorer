import { expect, test } from "@playwright/test";
import { geoAt, testCalibration } from "./helpers/device-location";

test("existing device references remain available but require explicit review before tracking", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ ...geoAt(620, 490), accuracy: 5 });
  await page.addInitScript(
    (points) =>
      localStorage.setItem(
        "campus-explorer-map-calibration",
        JSON.stringify({
          points: points.map((p, i) => ({ ...p, id: String(i) })),
        }),
      ),
    testCalibration.points,
  );
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Enable location sync", exact: true }),
  ).toBeDisabled();
  await expect(page.locator("[data-player='you']")).toHaveAttribute(
    "data-x",
    "387",
  );
  await page
    .getByRole("button", { name: "Calibrate map", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByLabel("Latitude", { exact: true }).first(),
  ).toHaveValue(String(testCalibration.points[0].latitude));
  await dialog
    .getByLabel(
      "I have checked these reference points against the physical campus.",
    )
    .check();
  await dialog
    .getByRole("button", { name: "Save calibration", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Enable location sync", exact: true })
    .click();
  await expect(page.locator(".location-status")).toHaveAttribute(
    "data-status",
    "live",
  );
  await expect
    .poll(async () =>
      Number(await page.locator("[data-player='you']").getAttribute("data-x")),
    )
    .toBeCloseTo(620, 2);
  await page
    .getByRole("button", { name: "Disable location sync", exact: true })
    .click();
  await expect(page.locator(".location-status")).toHaveAttribute(
    "data-status",
    "inactive",
  );
});

test("clearing calibration preserves it on cancel and removes both formats only after confirmation", async ({
  page,
}) => {
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
    .getByRole("button", { name: "Edit map calibration", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Clear calibration", exact: true })
    .click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Keep calibration", exact: true })
    .click();
  expect(
    await page.evaluate(() =>
      Boolean(localStorage.getItem("campus-explorer-map-calibration-v1")),
    ),
  ).toBe(true);
  await page
    .getByRole("button", { name: "Clear calibration", exact: true })
    .click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Clear saved references", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Enable location sync", exact: true }),
  ).toBeDisabled();
});

test("low accuracy never presents the exploration spawn as a measured physical position", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["geolocation"]);
  await context.setGeolocation({ ...geoAt(620, 490), accuracy: 80 });
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
    "uncertain",
  );
  await expect(page.locator("[data-player='you']")).toHaveCount(0);
});

test("existing local roles migrate and profile editing uses the same role as the map identity", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem(
      "campus-explorer-campus-role",
      JSON.stringify({ device: "Staff" }),
    ),
  );
  await page.goto("/");
  await expect(page.locator(".location-overview")).toContainText(
    "School Staff",
  );
  await page
    .getByRole("button", { name: "Student profile", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Edit Student Profile", exact: true })
    .click();
  await page
    .getByLabel("Role on this device", { exact: true })
    .selectOption("Teacher");
  await page.getByRole("button", { name: "Save Changes", exact: true }).click();
  await expect(page.locator(".trainer-fields")).toContainText("Teacher");
  await page.reload();
  await expect(page.locator(".location-overview")).toContainText("Teacher");
  await page
    .getByRole("button", { name: "Student profile", exact: true })
    .click();
  await expect(page.locator(".trainer-fields")).toContainText("Teacher");
});
