import { test, expect } from "@playwright/test";

test("dashboard navigation opens real controls and explicitly unavailable services", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("combobox", { name: "School", exact: true }),
  ).toHaveValue("reference-campus");
  await expect(page.locator(".radar-safety")).toContainText(
    "Status not verified",
  );
  await expect(page.locator(".radar-weather")).toContainText("Not connected");
  const navigation = page.getByRole("navigation", { name: "Main navigation" });
  for (const [label, message] of [
    ["Hazard Map", "Verified hazard assessments are not connected"],
    ["Room Scan (AI)", "AI room analysis is not connected"],
    ["Alerts & Updates", "Government disaster feeds are not configured"],
    [
      "Evacuation Routes",
      "Verified evacuation routes have not been configured",
    ],
    ["Emergency", "No alert has been sent"],
  ]) {
    const button = navigation.getByRole("button", { name: label, exact: true });
    await button.click();
    await expect(page.getByRole("dialog")).toContainText(message);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(button).toBeFocused();
  }
  for (const [label, message] of [
    ["Report Hazard", "No report has been submitted"],
    ["Message School", "No message has been sent"],
  ]) {
    await page
      .locator(".radar-quick-actions")
      .getByRole("button", { name: label, exact: true })
      .click();
    await expect(page.getByRole("dialog")).toContainText(message);
    await page.getByRole("button", { name: "Close dashboard panel" }).click();
  }
  await page.getByRole("button", { name: "Open account menu" }).click();
  await expect(
    page.getByRole("menuitem", { name: "Student sign in" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await page
    .getByRole("navigation", { name: "Game navigation" })
    .getByRole("button", { name: "Students", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText("No other students");
  await page.keyboard.press("Escape");
  await navigation
    .getByRole("button", { name: "Evacuation Routes", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Open illustrated route controls" })
    .click();
  await expect(page.locator("#radar-inspect")).toBeInViewport();
  await expect(page.locator("#radar-inspect")).toBeFocused();
  await page.getByRole("button", { name: "Open account menu" }).click();
  await page
    .getByRole("menuitem", { name: "Identity & location settings" })
    .click();
  await expect(page.locator("#radar-settings")).toBeInViewport();
  await expect(page.locator("#radar-settings")).toBeFocused();
});

test("building details preserve hit areas, keyboard focus and correct interiors", async ({
  page,
}) => {
  await page.goto("/");
  const building = page.getByRole("button", {
    name: "Explore Building C",
    exact: true,
  });
  await building.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading")).toHaveText("Building C");
  await expect(dialog).toContainText("5 rooms on the first floor");
  await page.keyboard.press("Escape");
  await expect(building).toBeFocused();
  await page.keyboard.press("Enter");
  await dialog
    .getByRole("button", { name: "Explore building", exact: true })
    .click();
  await expect(page.locator(".campus-map-toolbar")).toContainText(
    "Building C · Floor 1",
  );
  await expect(page.locator(".campus-hotspot[data-room-id]")).toHaveCount(5);
  await page
    .getByRole("navigation", { name: "Game navigation" })
    .getByRole("button", { name: "Map", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Explore Building E", exact: true })
    .click();
  await dialog
    .getByRole("button", { name: "Explore building", exact: true })
    .click();
  await expect(page.locator(".campus-hotspot[data-room-id]")).toHaveCount(3);
  // The shortened E hallway must be composed identically in both maps.
  await expect(page.locator(".radar-minimap-body > svg > svg")).not.toHaveCount(
    0,
  );
});

test("mission counts unique opened room cards and display preferences survive reload", async ({
  page,
}) => {
  await page.goto("/");
  const mission = page.locator(".radar-current-mission");
  await expect(mission).toContainText("(0/3)");
  for (let count = 1; count <= 3; count++) {
    await mission.click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page
      .getByRole("button", { name: "Close room photo", exact: true })
      .click();
    await expect(mission).toContainText(`(${count}/3)`);
  }
  await page.getByLabel("Breeze animation", { exact: true }).uncheck();
  await page.getByLabel("Show route arrows", { exact: true }).uncheck();
  await page.reload();
  await expect(mission).toContainText("(3/3)");
  await expect(
    page.getByLabel("Breeze animation", { exact: true }),
  ).not.toBeChecked();
  await expect(
    page.getByLabel("Show route arrows", { exact: true }),
  ).not.toBeChecked();
  await page
    .locator(".radar-quick-actions")
    .getByRole("button", { name: "Scan Room", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Open classroom card", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Close room photo", exact: true })
    .click();
  const visits = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("campus-room-visits:device")!),
  );
  expect(visits).toHaveLength(3);
});

test("mini-map controls, collapsible panels and layout work at reference and phone sizes", async ({
  page,
  isMobile,
}) => {
  if (!isMobile) await page.setViewportSize({ width: 1672, height: 941 });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Mini map zoom in", exact: true })
    .click();
  await expect(page.locator(".campus-map-toolbar output")).toHaveText("125%");
  await page
    .getByRole("button", { name: "Mini map zoom out", exact: true })
    .click();
  await expect(page.locator(".campus-map-toolbar output")).toHaveText("100%");
  await page
    .getByRole("button", { name: "Center map on your character", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Collapse Live Conditions", exact: true })
    .click();
  await expect(page.locator(".radar-weather")).toHaveCount(0);
  await page
    .getByRole("button", { name: "Expand Live Conditions", exact: true })
    .click();
  await expect(page.locator(".radar-weather")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  if (!isMobile) {
    const mission = await page.locator(".radar-current-mission").boundingBox();
    const nav = await page.locator(".radar-bottom-nav").boundingBox();
    expect(mission!.y + mission!.height).toBeLessThan(nav!.y);
    const legend = await page.locator(".radar-map-legend").boundingBox();
    const missionLabel = await page
      .locator(".radar-current-mission > span")
      .boundingBox();
    expect(legend!.y + legend!.height).toBeLessThanOrEqual(missionLabel!.y);
    await page.locator(".radar-speech").click();
    await expect(page.locator(".radar-speech")).toContainText(
      "AI is not connected",
    );
  }
});
