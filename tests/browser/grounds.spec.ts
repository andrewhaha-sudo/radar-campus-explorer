import { test, expect } from "@playwright/test";

test("clicking open grass routes the character there and allows manual walking across the lawn", async ({ page }) => {
  await page.goto("/");
  const map = page.locator("#campus-map > svg");
  await map.scrollIntoViewIfNeeded();
  const target = await map.evaluate((element) => {
    const matrix = (element as SVGSVGElement).getScreenCTM()!;
    const point = new DOMPoint(720, 490).matrixTransform(matrix);
    // MouseEvent coordinates use CSS pixels. On a small screen one CSS pixel
    // covers several map pixels, so compare against the actual rounded click.
    const x = Math.floor(point.x), y = Math.floor(point.y);
    const destination = new DOMPoint(x, y).matrixTransform(matrix.inverse());
    return { x, y, destination: { x: destination.x, y: destination.y } };
  });
  await page.mouse.click(target.x, target.y);
  const actorPosition = () => page.locator(".campus-student").evaluate((element) => {
    const transform = (element as SVGGraphicsElement).transform.baseVal.getItem(0).matrix;
    return { x: transform.e, y: transform.f };
  });
  await expect.poll(async () => {
    const point = await actorPosition();
    return Math.hypot(point.x - target.destination.x, point.y - target.destination.y);
  }, { timeout: 20_000 }).toBeLessThan(1);
  await page.locator("#campus-map").focus();
  await page.keyboard.down("ArrowRight");
  await expect.poll(async () => (await actorPosition()).x).toBeGreaterThan(735);
  await page.keyboard.up("ArrowRight");

  for (const destination of [
    { name: "Canteen", x: 1172, y: 732 },
    { name: "Pond", x: 247, y: 714 },
  ]) {
    await page.getByRole("button", { name: `Explore ${destination.name}`, exact: true }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Walk to entrance", exact: true }).click();
    await expect.poll(async () => {
      const point = await actorPosition();
      return Math.hypot(point.x - destination.x, point.y - destination.y);
    }, { timeout: 25_000 }).toBeLessThan(1);
  }
});

test("breeze moves foliage, can be disabled, respects reduced motion and pauses offscreen", async ({ page }) => {
  await page.goto("/");
  const breeze = page.locator(".campus-breeze");
  await expect(breeze).toHaveAttribute("data-active", "true");
  for (const selector of [".campus-tree-sway", ".campus-grass-sway"]) {
    const part = page.locator(selector).first();
    const before = await part.evaluate((element) => getComputedStyle(element).transform);
    await expect.poll(() => part.evaluate((element) => getComputedStyle(element).transform)).not.toBe(before);
  }
  await page.getByLabel("Breeze animation", { exact: true }).uncheck();
  await expect(breeze).toHaveCount(0);
  await page.getByLabel("Breeze animation", { exact: true }).check();
  await expect(breeze).toHaveCount(1);
  await page.emulateMedia({ reducedMotion: "reduce" });
  for (const selector of [".campus-tree-sway", ".campus-grass-sway"]) {
    await expect(page.locator(selector).first()).toHaveCSS("animation-name", "none");
    await expect(page.locator(selector).first()).toHaveCSS("transform", "none");
  }
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.setViewportSize({ width: 390, height: 500 });
  await page.locator(".campus-footer").scrollIntoViewIfNeeded();
  await expect(breeze).toHaveAttribute("data-active", "false");
  await expect(page.locator(".campus-tree-sway").first()).toHaveCSS("animation-play-state", "paused");
  await page.getByLabel("Original artwork only", { exact: true }).check();
  await expect(breeze).toHaveCount(0);
});
