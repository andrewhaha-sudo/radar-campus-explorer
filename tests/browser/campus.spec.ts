import { test, expect } from "@playwright/test";

test("opens directly to the campus with no login, API, external services or missing assets", async ({
  page,
}) => {
  const requests: string[] = [];
  const failures: string[] = [];
  page.on("request", (request) => requests.push(request.url()));
  page.on("response", (response) => {
    if (response.status() >= 400) failures.push(response.url());
  });
  page.on("pageerror", (error) => failures.push(error.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Campus Explorer", exact: true }),
  ).toBeVisible();
  await expect(page).toHaveURL("/");
  await expect(page).toHaveTitle("Campus Explorer — Interactive School Map");
  await expect(
    page.getByRole("button", {
      name: /sign in|log in|dashboard|geographic map/i,
    }),
  ).toHaveCount(0);
  await page.locator("#campus-map image").first().evaluate(async (element) => {
    const image = new Image();
    image.src = element.getAttribute("href")!;
    await image.decode();
    if (image.naturalWidth !== 1254 || image.naturalHeight !== 1254)
      throw new Error("Wrong campus artwork");
  });
  await page
    .getByRole("button", { name: "Indoor floor plans", exact: true })
    .click();
  await page.locator("#campus-map image").evaluate(async (element) => {
    const image = new Image();
    image.src = element.getAttribute("href")!;
    await image.decode();
    if (image.naturalWidth !== 2048 || image.naturalHeight !== 682)
      throw new Error("Wrong floor artwork");
  });
  expect(failures).toEqual([]);
  expect(
    requests.every(
      (url) =>
        new URL(url).origin === "http://127.0.0.1:4175" &&
        !new URL(url).pathname.startsWith("/api/"),
    ),
  ).toBe(true);
});

test("navigates from campus to a second-floor classroom and back through the stairs", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator("#campus-room").selectOption("B-201");
  await expect(page.locator(".campus-status")).toContainText(
    "Room B-201 · Floor 2. You have reached",
    { timeout: 45_000 },
  );
  await expect(page.locator(".campus-map-toolbar")).toContainText(
    "Building B · Floor 2",
  );
  await page.getByRole("button", { name: "Walk to floor 1" }).click();
  await expect(page.locator(".campus-map-toolbar")).toContainText(
    "Building B · Floor 1",
  );
  await page.getByRole("button", { name: "Walk to exit" }).click();
  await expect(page.locator(".campus-map-toolbar")).toContainText(
    "Outdoor campus",
  );
});

test("preserves Building 6 rooms and supports original-artwork view and controls", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Indoor floor plans", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Building 6 2 floors · 10 classrooms" })
    .click();
  await expect(
    page.locator('.campus-hotspot[data-room-id]'),
  ).toHaveCount(5);
  await page.getByRole("button", { name: "Walk to floor 2" }).click();
  await expect(page.locator(".campus-map-toolbar")).toContainText(
    "Building 6 · Floor 2",
  );
  await expect(
    page.locator('.campus-hotspot[data-room-id]'),
  ).toHaveCount(5);
  await page.getByLabel("Original artwork only").check();
  await expect(page.locator(".campus-student")).toHaveCount(0);
  await expect(page.locator(".campus-hotspot")).toHaveCount(0);
  await page.getByLabel("Original artwork only").uncheck();
  await expect(page.locator(".campus-student")).toHaveCount(1);
  await page.getByRole("button", { name: "Expand map", exact: true }).click();
  await expect(page.locator(".campus-explorer--expanded")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator(".campus-explorer--expanded")).toHaveCount(0);
});

test("keyboard and direction buttons move the character and cancel automatic walking", async ({
  page,
}, testInfo) => {
  await page.goto("/");
  const actor = page.locator(".campus-student");
  await expect(actor).toBeVisible();
  const before = await actor.getAttribute("transform");
  if (testInfo.project.name === "mobile") {
    const north = page
      .locator(".campus-mobile-controls")
      .getByRole("button", { name: "Walk north" });
    await north.scrollIntoViewIfNeeded();
    const box = (await north.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await expect(actor).not.toHaveAttribute("transform", before!);
    await page.mouse.up();
  } else {
    await page.locator("#campus-map").focus();
    await page.keyboard.down("ArrowUp");
    await expect(actor).not.toHaveAttribute("transform", before!);
    await page.keyboard.up("ArrowUp");
  }
  await page.locator("#campus-room").selectOption("B-201");
  await expect(page.locator("#campus-map polyline")).toHaveCount(1);
  await page.locator("#campus-map").focus();
  await page.keyboard.press("ArrowDown");
  await expect(page.locator("#campus-map polyline")).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("radar shell sits on the illustrated campus", async ({ page }, testInfo) => {
  await page.goto("/");
  await expect(page.getByText("RADAR.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Campus Explorer", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Where to?", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Find an assembly point" })).toBeVisible();
  await expect(page.getByText("DEMONSTRATION DATA")).toBeVisible();
  await expect(page.getByText("Not a verified evacuation route")).toBeVisible();
  if (testInfo.project.name === "desktop") {
    await expect(
      page.getByRole("img", { name: /Minimap showing your current position/ }),
    ).toBeVisible();
    await page.screenshot({
      path: "/opt/cursor/artifacts/radar-shell-desktop.png",
      fullPage: true,
    });
  }
  await page.getByRole("button", { name: "How to play", exact: true }).click();
  const guide = page.getByRole("dialog");
  await expect(guide).toContainText("not sent to other students");
  await guide.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("button", { name: "Classrooms", exact: true }).click();
  await expect(page.getByRole("button", { name: /Room B-101/ }).first()).toBeVisible();
  await page.getByRole("button", { name: "Places", exact: true }).click();
  await page.getByRole("button", { name: "Find an assembly point" }).click();
  await expect(page.locator("#campus-map polyline")).toHaveCount(1);
});
