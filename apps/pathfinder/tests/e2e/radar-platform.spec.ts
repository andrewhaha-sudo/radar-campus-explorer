import { test, expect } from "@playwright/test";
// Combined login, campus, PDF and WebGL flows include real local object storage.
test.setTimeout(60_000);
test.use({ trace: "retain-on-failure" });

test("RADAR campus and the complete protected facility workspace share one application", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("link", { name: "Campus explorer", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("link", { name: "Campus explorer", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Edit floorplan", exact: true }),
  ).toBeVisible();
  await page.goto("/campus-workspace");
  await expect(page).toHaveURL(/\/login/);
  await page.locator('html[data-hydrated="true"]').waitFor();
  await page.getByLabel("Email address").fill("test@test.com");
  await page.getByLabel("Password").fill("test1234");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL("**/campus-workspace");
  await page.goto("/campus-workspace");
  await expect(page.getByTestId("radar-floor")).toHaveCount(11);
  await page
    .getByTestId("radar-floor-a1")
    .getByRole("link", { name: "Open shared floorplan" })
    .click();
  await expect(page.getByTestId("annotation-canvas")).toBeVisible();
  await expect(page.getByTestId("page-indicator")).toContainText("Page 1");
  const pdf = await page.request.get("/api/documents/radar-doc-a1/file");
  expect(pdf.status()).toBe(200);
  expect((await pdf.body()).subarray(0, 4).toString()).toBe("%PDF");
  await page.screenshot({
    path: ".wrangler/test-screenshots/radar-shared-floorplan.png",
    fullPage: true,
  });
});

test("a device draft becomes a separate authenticated document without overwriting the base floor", async ({
  page,
}) => {
  await page.goto("/login");
  await page.locator('html[data-hydrated="true"]').waitFor();
  await page.getByLabel("Email address").fill("test@test.com");
  await page.getByLabel("Password").fill("test1234");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL("**/dashboard");
  const baseline = await (
    await page.request.get("/api/documents/radar-doc-a1/annotations")
  ).json();
  await page.goto("/campus/");
  await page
    .getByRole("button", { name: "Edit floorplan", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "Floorplan editor" });
  await dialog.getByRole("button", { name: "Exit", exact: true }).click();
  const canvas = dialog.getByRole("application", { name: "Floorplan drawing" });
  await canvas.focus();
  await canvas.press("Enter");
  await dialog
    .getByRole("button", { name: "Publish new shared draft", exact: true })
    .click();
  const link = dialog.getByRole("link", {
    name: "Open published draft",
    exact: true,
  });
  await expect(link).toBeVisible();
  const href = (await link.getAttribute("href"))!;
  expect(href).not.toBe("/documents/radar-doc-a1");
  const saved = await (
    await page.request.get("/api" + href + "/annotations")
  ).json();
  expect(saved.annotations).toHaveLength(1);
  expect(saved.annotations[0].type).toBe("exit");
  expect(
    await (
      await page.request.get("/api/documents/radar-doc-a1/annotations")
    ).json(),
  ).toEqual(baseline);
  await link.click();
  await expect(page.getByTestId("annotation-count")).toHaveText(/1 annotation/);
  await page.screenshot({
    path: ".wrangler/test-screenshots/radar-published-draft.png",
    fullPage: true,
  });
});

test("a supported SPZ fixture actually decodes in the 3D viewer", async ({
  page,
}) => {
  await page.goto("/login");
  await page.locator('html[data-hydrated="true"]').waitFor();
  await page.getByLabel("Email address").fill("test@test.com");
  await page.getByLabel("Password").fill("test1234");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL("**/dashboard");
  await page.goto("/scans/radar-synthetic-scan");
  await expect(page.getByTestId("splat-host")).toHaveAttribute(
    "data-loaded-splats",
    "3",
    { timeout: 30000 },
  );
  await expect(page.getByTestId("splat-host").locator("canvas")).toBeVisible();
  await expect(page.getByTestId("splat-status")).toHaveCount(0);
  // Check actual rendered color, not just a decoded model or an empty canvas.
  await expect.poll(async () => page.getByTestId('splat-host').locator('canvas').evaluate(canvas => new Promise<number>(resolve => requestAnimationFrame(() => {
    const gl = (canvas as HTMLCanvasElement).getContext('webgl2');
    if(!gl) { resolve(0); return; }
    const pixels = new Uint8Array(gl.drawingBufferWidth * gl.drawingBufferHeight * 4);
    gl.readPixels(0, 0, gl.drawingBufferWidth, gl.drawingBufferHeight, gl.RGBA, gl.UNSIGNED_BYTE, pixels);
    let count = 0;
    for(let i=0;i<pixels.length;i+=4) if(Math.max(pixels[i],pixels[i+1],pixels[i+2])>120) count++;
    resolve(count);
  }))), { timeout: 10000 }).toBeGreaterThan(0);

  await page.screenshot({
    path: ".wrangler/test-screenshots/radar-3d-synthetic.png",
    fullPage: true,
  });
  await page
    .getByTestId("related-scans")
    .getByRole("button", { name: /Splat.*v2/ })
    .click();
  await expect(page.getByTestId("splat-host")).toHaveAttribute(
    "data-loaded-splats",
    "1",
    { timeout: 30000 },
  );
});

test("the integrated workspace remains usable at phone width", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/login");
  await page.locator('html[data-hydrated="true"]').waitFor();
  await page.getByLabel("Email address").fill("test@test.com");
  await page.getByLabel("Password").fill("test1234");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.waitForURL("**/dashboard");
  await page.goto("/campus-workspace");
  await expect(page.getByTestId("radar-floor")).toHaveCount(11);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: ".wrangler/test-screenshots/radar-workspace-mobile.png",
    fullPage: true,
  });
});

for (const mobile of [false, true]) {
  test(`Indoor Map preserves campus and Pathfinder (${mobile ? 'phone' : 'desktop'})`, async ({ page }) => {
    if (mobile) await page.setViewportSize({ width: 390, height: 844 });
    const failures: string[] = [];
    page.on('pageerror', e => failures.push(e.message));
    await page.goto('/indoor-map/');
    // Software WebGL may compile shaders slowly after the SPZ viewer checks.
    await expect(page.locator('body')).toHaveAttribute('data-ready', 'true', { timeout: 20_000 });
    await expect(page.locator('body')).toHaveAttribute('data-floor', 'a1');
    await expect(page.getByLabel('Floor', { exact: true }).locator('option')).toHaveCount(11);
    await page.getByLabel('Floor', { exact: true }).selectOption('b1');
    await expect(page.locator('body')).toHaveAttribute('data-floor', 'b1');
    // Stable room identifiers are supplied by the existing campus registry.
    const registry = await (await page.request.get('/campus-registry.json')).json();
    const lower = registry.find((f: {sceneId: string}) => f.sceneId === 'b1');
    const upper = registry.find((f: {sceneId: string}) => f.sceneId === 'b2');
    await page.getByLabel('Route from').selectOption(lower.roomIds[0]);
    await page.getByLabel('Route to').selectOption(upper.roomIds[0]);
    await page.getByRole('button', {name: 'Show walking path'}).click();
    await expect(page.locator('#route-status')).toContainText('Stairs required');
    await expect(page.locator('#steps button')).toHaveCount(2);
    await page.locator('#steps button').nth(1).click();
    await expect(page.locator('body')).toHaveAttribute('data-floor','b2');
    await expect(page.locator('#document')).toHaveAttribute('href','/documents/radar-doc-b2');
    await page.getByRole('button',{name:'Show 3D',exact:true}).click();
    await expect(page.getByRole('button',{name:'Show 2D',exact:true})).toHaveAttribute('aria-pressed','true');
    await page.getByLabel('Search rooms').fill('Building C');
    await expect(page.locator('#results button').first()).toBeVisible();
    await page.locator('#results button').first().click();
    await expect(page.locator('body')).toHaveAttribute('data-floor','c1');
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await page.screenshot({path:`../../.wrangler/test-screenshots/indoor-map-${mobile?'phone':'desktop'}.png`});
    expect(failures).toEqual([]);
    await page.getByRole('link',{name:'Campus explorer',exact:true}).click();
    await expect(page.getByRole('button',{name:'Edit floorplan',exact:true})).toBeVisible();
    await page.goto('/campus-workspace');
    await expect(page).toHaveURL(/\/login/);
  });
}
