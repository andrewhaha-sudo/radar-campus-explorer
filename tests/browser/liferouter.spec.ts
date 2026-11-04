import { test, expect, type Page } from "@playwright/test";

async function selectEngine(page: Page) {
  await page.goto("/");
  await page.getByLabel("Routing engine").selectOption("liferouter");
}
async function clickGround(page: Page) {
  const map = page.locator("#campus-map > svg");
  await map.scrollIntoViewIfNeeded();
  const p = await map.evaluate((el) => {
    const p = new DOMPoint(720, 490).matrixTransform((el as SVGSVGElement).getScreenCTM()!);
    return { x: p.x, y: p.y };
  });
  await page.mouse.click(p.x, p.y);
}
test("LifeRouter failure is visible and does not silently move using local routing", async ({ page }) => {
  await page.route("**/api/liferouter/route", route => route.fulfill({ status: 503 }));
  await selectEngine(page);
  const actor = page.locator(".campus-student");
  const before = await actor.getAttribute("transform");
  await clickGround(page);
  await expect(page.locator(".campus-status")).toContainText("LifeRouter is unavailable");
  await expect(actor).toHaveAttribute("transform", before!);
  await page.getByLabel("Routing engine").selectOption("local");
  await clickGround(page);
  await expect(actor).not.toHaveAttribute("transform", before!);
});
test("switching engine cancels a pending LifeRouter request", async ({ page }) => {
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/api/liferouter/route", async route => {
    await pending;
    await route.fulfill({ status: 422, json: { error: "late response" } }).catch(() => {});
  });
  await selectEngine(page);
  await clickGround(page);
  await expect(page.locator(".campus-status")).toContainText("calculating");
  await page.getByLabel("Routing engine").selectOption("local");
  release();
  await expect(page.locator(".campus-status")).toContainText("Simulation routing selected");
  await expect(page.locator("[data-route-arrows]")).toHaveCount(0);
});
test("real LifeRouter route moves the character and reaches a second-floor room", async ({ page }) => {
  test.skip(!process.env.LIFEROUTER_TEST_URL, "Start the Go bridge and set LIFEROUTER_TEST_URL to run the engine integration.");
  const requests: unknown[] = [];
  await page.route("**/api/liferouter/route", async route => {
    const body = route.request().postDataJSON();
    requests.push(body);
    const response = await fetch(`${process.env.LIFEROUTER_TEST_URL}/api/liferouter/route`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    await route.fulfill({ status: response.status, contentType: "application/json", body: await response.text() });
  });
  await selectEngine(page);
  await clickGround(page);
  await expect(page.locator(".campus-status")).toContainText("You reached this spot", { timeout: 30_000 });
  await page.locator("#campus-room").selectOption("B-201");
  await expect(page.locator(".campus-status")).toContainText("Room B-201 · Floor 2. You have reached", { timeout: 45_000 });
  expect(requests.length).toBeGreaterThanOrEqual(4);
  for (const request of requests) {
    expect(Object.keys(request as object).sort()).toEqual(["goal", "start"]);
  }
});

test("private location sessions disable LifeRouter even after returning to manual movement", async ({ page }) => {
  const { installDeviceLocation, sendLocation } = await import("./helpers/device-location");
  await installDeviceLocation(page);
  let calls = 0;
  page.on("request", request => { if (request.url().includes("/api/liferouter/")) calls++; });
  await selectEngine(page);
  await page.getByRole("button", { name: "Enable location sync", exact: true }).click();
  await sendLocation(page, 620, 490);
  await expect(page.getByLabel("Routing engine")).toHaveValue("local");
  await expect(page.getByLabel("Routing engine")).toBeDisabled();
  await page.getByRole("button", { name: "Explore manually", exact: true }).click();
  await expect(page.getByLabel("Routing engine").locator('option[value="liferouter"]')).toHaveAttribute("disabled", "");
  await clickGround(page);
  expect(calls).toBe(0);
});
