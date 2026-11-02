import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";

const config = JSON.parse(
  readFileSync(
    new URL("../../src/lib/student-project.json", import.meta.url),
    "utf8",
  ),
);
const alice = "11111111-1111-4111-8111-111111111111";
const bob = "22222222-2222-4222-8222-222222222222";
const carla = "33333333-3333-4333-8333-333333333333";
const privateFields = {
  name: false,
  grade: false,
  section: false,
  teacher: false,
  sex: false,
  photo: false,
};

async function accountService(page: Page, signedIn = true) {
  const image = Buffer.from(
    await page.evaluate(() => {
      const canvas = document.createElement("canvas");
      canvas.width = 80;
      canvas.height = 100;
      const context = canvas.getContext("2d")!;
      context.fillStyle = "#f3bf48";
      context.fillRect(0, 0, 80, 100);
      return canvas.toDataURL("image/png").split(",")[1];
    }),
    "base64",
  );
  const user = {
    id: alice,
    email: "alice@example.test",
    aud: "authenticated",
    role: "authenticated",
    app_metadata: {},
    user_metadata: {},
    created_at: new Date().toISOString(),
  };
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const jwt = `${Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url")}.${Buffer.from(JSON.stringify({ sub: alice, role: "authenticated", exp })).toString("base64url")}.test-signature`;
  const session = {
    access_token: jwt,
    refresh_token: "test-refresh",
    expires_at: exp,
    expires_in: 3600,
    token_type: "bearer",
    user,
  };
  const state = {
    owner: {
      user_id: alice,
      avatar: "boy",
      name: "Alice",
      grade: "Grade 10",
      section: "Emerald",
      teacher: "Ms. Santos",
      sex: "Female",
      visibility: { ...privateFields },
      sharing: false,
      photo_available: false,
      updated_at: "2026-11-02T00:00:00Z",
    },
    photos: new Map<string, Buffer>([[bob, image]]),
    bobPhoto: true,
    failSave: false,
    photoWrites: 0,
    lookedUp: [] as string[],
    authRequests: 0,
  };
  if (signedIn)
    await page.addInitScript(
      (session) =>
        localStorage.setItem(
          "campus-explorer-student-auth",
          JSON.stringify(session),
        ),
      session,
    );
  await page.route(`${config.url}/**`, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();
    const headers = {
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "*",
      "access-control-allow-methods": "*",
    };
    const json = (body: unknown, status = 200) =>
      route.fulfill({ json: body, status, headers });
    if (method === "OPTIONS") return route.fulfill({ status: 204, headers });
    if (url.pathname === "/auth/v1/user") return json(user);
    if (url.pathname === "/auth/v1/token") {
      state.authRequests++;
      return json(session);
    }
    if (url.pathname === "/auth/v1/logout")
      return route.fulfill({ status: 204, headers });
    if (url.pathname === "/rest/v1/explorer_profiles") {
      if (method === "PATCH") {
        const body = request.postDataJSON();
        if (state.failSave && "name" in body) {
          state.failSave = false;
          return json({ message: "Save rejected for test" }, 500);
        }
        state.owner = {
          ...state.owner,
          ...body,
          updated_at: new Date().toISOString(),
        };
        return json(state.owner);
      }
      return json(
        request.headers().accept?.includes("vnd.pgrst.object")
          ? state.owner
          : [state.owner],
      );
    }
    if (url.pathname === "/rest/v1/explorer_presence") return json([]);
    if (url.pathname === "/rest/v1/rpc/list_explorer_students")
      return json([
        {
          user_id: bob,
          name: "Bob",
          avatar: "boy",
          scene: "campus",
          x: 620,
          y: 490,
          direction: "left",
          moving: false,
        },
        {
          user_id: carla,
          name: "Carla",
          avatar: "girl",
          scene: "campus",
          x: 735,
          y: 492,
          direction: "down",
          moving: false,
        },
      ]);
    if (url.pathname === "/rest/v1/rpc/get_explorer_student") {
      const id = request.postDataJSON().target_id;
      state.lookedUp.push(id);
      return json({
        user_id: id,
        name: id === bob ? "Bob" : "Carla",
        avatar: id === bob ? "boy" : "girl",
        grade: "Grade 12",
        section: null,
        teacher: null,
        sex: null,
        photo_available: id === bob && state.bobPhoto,
        updated_at: state.bobPhoto ? "v1" : "v2",
      });
    }
    if (url.pathname.includes("/storage/v1/object/")) {
      if (method === "DELETE") {
        state.photos.delete(alice);
        state.photoWrites++;
        return json([]);
      }
      if (method === "POST" || method === "PUT") {
        const raw = request.postDataBuffer()!;
        const form = await new Response(raw, {
          headers: { "content-type": request.headers()["content-type"] },
        }).formData();
        const file = [...form.values()].find(
          (value) => typeof value !== "string",
        ) as File;
        state.photos.set(alice, Buffer.from(await file.arrayBuffer()));
        state.photoWrites++;
        return json({ Key: `explorer-student-photos/${alice}/portrait.webp` });
      }
      const id = url.pathname.includes(bob) ? bob : alice;
      const photo = state.photos.get(id);
      if (!photo || (id === bob && !state.bobPhoto))
        return json({ message: "Forbidden" }, 403);
      return route.fulfill({ body: photo, contentType: "image/webp", headers });
    }
    return json({ message: `Unexpected test request: ${url.pathname}` }, 500);
  });
  return { state, image };
}

test("clicking another student's character loads that account's permitted card and revokes hidden photos", async ({
  page,
}) => {
  const { state } = await accountService(page);
  await page.goto("/");
  await page.locator(`[data-student-id="${bob}"]`).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.locator(".trainer-fields")).toContainText("Bob");
  await expect(dialog.locator(".trainer-fields")).toContainText("PRIVATE");
  await expect(
    dialog.getByRole("img", {
      name: "Shared student profile photo",
      exact: true,
    }),
  ).toHaveAttribute("src", /^blob:/);
  await expect(
    dialog.getByRole("button", { name: "Edit Student Profile", exact: true }),
  ).toHaveCount(0);
  state.bobPhoto = false;
  await expect(
    dialog.getByRole("img", {
      name: "Shared student profile photo",
      exact: true,
    }),
  ).toHaveCount(0);
  const missingPhoto = page.waitForResponse(
    (response) => response.url().includes(bob) && response.status() === 403,
  );
  state.photos.delete(bob);
  state.bobPhoto = true;
  await missingPhoto;
  await expect(dialog.locator(".trainer-fields")).toContainText("Bob");
  await expect(
    dialog.getByRole("img", { name: "Boy student portrait", exact: true }),
  ).toBeVisible();
  await expect(
    dialog.getByRole("img", {
      name: "Shared student profile photo",
      exact: true,
    }),
  ).toHaveCount(0);
  await dialog
    .getByRole("button", { name: "Close student profile", exact: true })
    .click();
  await page.locator(`[data-student-id="${carla}"]`).click();
  await expect(dialog.locator(".trainer-fields")).toContainText("Carla");
  await expect(
    dialog.getByRole("img", { name: "Girl student portrait", exact: true }),
  ).toBeVisible();
  expect(state.lookedUp).toContain(bob);
  expect(state.lookedUp).toContain(carla);
});

test("account photo saves stay private by default, failed replacements restore bytes, and sign-out clears the account card", async ({
  page,
}) => {
  const { state, image } = await accountService(page);
  await page.goto("/");
  await page
    .getByRole("button", { name: "Student profile", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("button", { name: "Edit Student Profile", exact: true })
    .click();
  await dialog
    .getByLabel("Upload profile photo", { exact: true })
    .setInputFiles({ name: "photo.png", mimeType: "image/png", buffer: image });
  await dialog
    .getByRole("button", { name: "Use cropped photo", exact: true })
    .click();
  await dialog
    .getByRole("button", { name: "Save Changes", exact: true })
    .click();
  await expect(dialog.getByRole("status")).toContainText(
    "saved to your account",
  );
  expect(state.owner.visibility.photo).toBe(false);
  expect(state.owner.sharing).toBe(false);
  expect(state.owner.photo_available).toBe(true);
  const original = Buffer.from(state.photos.get(alice)!);
  await dialog
    .getByRole("button", { name: "Edit Student Profile", exact: true })
    .click();
  await dialog
    .getByLabel("Upload profile photo", { exact: true })
    .setInputFiles({
      name: "replacement.png",
      mimeType: "image/png",
      buffer: image,
    });
  await dialog
    .getByRole("button", { name: "Use cropped photo", exact: true })
    .click();
  state.failSave = true;
  await dialog
    .getByRole("button", { name: "Save Changes", exact: true })
    .click();
  await expect(dialog.getByRole("alert")).toContainText("could not be saved");
  expect(state.photos.get(alice)).toEqual(original);
  expect(state.photoWrites).toBeGreaterThanOrEqual(3);
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(
    dialog.getByRole("img", { name: "Your profile photo", exact: true }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Sign out", exact: true }).click();
  await expect(
    page.getByRole("dialog").locator(".trainer-fields"),
  ).not.toContainText("Alice");
  await expect(
    page
      .getByRole("dialog")
      .getByRole("img", { name: "Your profile photo", exact: true }),
  ).toHaveCount(0);
  await expect(page.locator(".campus-other-student")).toHaveCount(0);
});

test("student sign-in uses the separate account and leaves device identity separate", async ({
  page,
}) => {
  const { state } = await accountService(page, false);
  await page.goto("/");
  await page
    .getByRole("button", { name: "Student profile", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Student sign in", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByLabel("Email", { exact: true })
    .fill("alice@example.test");
  await page
    .getByRole("dialog")
    .getByLabel("Password", { exact: true })
    .fill("example-password");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Sign in to student account", exact: true })
    .click();
  await expect(
    page.getByRole("dialog").locator(".trainer-fields"),
  ).toContainText("Alice");
  expect(state.authRequests).toBe(1);
});
