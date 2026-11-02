import { test, expect } from "@playwright/test";

test("student identity, sex and character persist independently; cancel leaves saved identity intact", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Student profile", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("button", { name: "Edit Student Profile", exact: true })
    .click();
  await dialog.getByLabel("Name", { exact: true }).fill("Ana Reyes");
  await dialog
    .getByRole("combobox", { name: "Grade", exact: true })
    .selectOption("Grade 10");
  await dialog.getByLabel("Section", { exact: true }).fill("Emerald");
  await dialog.getByLabel("Teacher", { exact: true }).fill("Ms. Santos");
  await dialog
    .getByRole("combobox", { name: "Sex", exact: true })
    .selectOption("Female");
  await dialog
    .getByRole("button", { name: "Save Changes", exact: true })
    .click();
  await expect(dialog.getByRole("status")).toContainText(
    "Profile saved on this device",
  );
  await expect(dialog.locator(".trainer-fields")).toContainText("Ana Reyes");
  await expect(dialog.locator(".trainer-fields")).toContainText("Female");
  await dialog
    .getByRole("button", { name: "Change Character", exact: true })
    .click();
  await dialog.getByRole("radio", { name: "Girl", exact: true }).check();
  await dialog
    .getByRole("button", { name: "Use this character", exact: true })
    .click();
  await expect(dialog.locator(".trainer-fields")).toContainText("Ana Reyes");
  await dialog
    .getByRole("button", { name: "Edit Student Profile", exact: true })
    .click();
  await dialog.getByLabel("Name", { exact: true }).fill("Unsaved Name");
  await dialog.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(dialog.locator(".trainer-fields")).not.toContainText(
    "Unsaved Name",
  );
  await dialog
    .getByRole("button", { name: "Close student profile", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Student profile", exact: true }),
  ).toBeFocused();
  await expect(page.locator(".campus-student .student-sprite")).toHaveAttribute(
    "data-avatar",
    "girl",
  );
  await page.reload();
  await expect(page.locator(".campus-student .student-sprite")).toHaveAttribute(
    "data-avatar",
    "girl",
  );
  await page
    .getByRole("button", { name: "Your character", exact: true })
    .click();
  await expect(dialog.locator(".trainer-fields")).toContainText("Ana Reyes");
});

test("real photo crops to the fixed frame, survives reload and does not change with the walking character", async ({
  page,
}) => {
  await page.goto("/");
  const photo = Buffer.from(
    await page.evaluate(() => {
      const canvas = document.createElement("canvas");
      canvas.width = 2400;
      canvas.height = 1600;
      const context = canvas.getContext("2d")!;
      context.fillStyle = "#2b7a91";
      context.fillRect(0, 0, 2400, 1600);
      context.fillStyle = "#f3c462";
      context.fillRect(1200, 0, 1200, 1600);
      return canvas.toDataURL("image/png").split(",")[1];
    }),
    "base64",
  );
  await page
    .getByRole("button", { name: "Student profile", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog
    .getByRole("button", { name: "Edit Student Profile", exact: true })
    .click();
  await dialog
    .getByLabel("Upload profile photo", { exact: true })
    .setInputFiles({
      name: "portrait.png",
      mimeType: "image/png",
      buffer: photo,
    });
  await expect(
    dialog.getByRole("region", { name: "Crop profile photo", exact: true }),
  ).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Save Changes", exact: true }),
  ).toBeDisabled();
  await dialog.getByLabel("Zoom", { exact: false }).focus();
  await dialog.getByLabel("Zoom", { exact: false }).press("End");
  await dialog.getByLabel("Horizontal position", { exact: true }).press("End");
  await dialog.getByLabel("Vertical position", { exact: true }).press("Home");
  await dialog
    .getByRole("button", { name: "Use cropped photo", exact: true })
    .click();
  await expect(
    dialog.getByRole("img", {
      name: "Your selected profile photo",
      exact: true,
    }),
  ).toBeVisible();
  await dialog
    .getByRole("button", { name: "Save Changes", exact: true })
    .click();
  await expect(
    dialog.getByRole("img", { name: "Your profile photo", exact: true }),
  ).toBeVisible();
  const frameClass = await dialog
    .locator(".trainer-portrait-frame")
    .getAttribute("class");
  await dialog
    .getByRole("button", { name: "Change Character", exact: true })
    .click();
  await dialog.getByRole("radio", { name: "Girl", exact: true }).check();
  await dialog
    .getByRole("button", { name: "Use this character", exact: true })
    .click();
  await expect(
    dialog.getByRole("img", { name: "Your profile photo", exact: true }),
  ).toBeVisible();
  await expect(dialog.locator(".trainer-portrait-frame")).toHaveAttribute(
    "class",
    frameClass!,
  );
  await page.reload();
  await page
    .getByRole("button", { name: "Student profile", exact: true })
    .click();
  await expect(
    dialog.getByRole("img", { name: "Your profile photo", exact: true }),
  ).toBeVisible();
  const dimensions = await dialog
    .getByRole("img", { name: "Your profile photo", exact: true })
    .evaluate((element) => ({
      width: (element as HTMLImageElement).naturalWidth,
      height: (element as HTMLImageElement).naturalHeight,
    }));
  expect(dimensions).toEqual({ width: 640, height: 800 });
  await dialog
    .getByRole("button", { name: "Edit Student Profile", exact: true })
    .click();
  await dialog
    .getByLabel("Upload profile photo", { exact: true })
    .setInputFiles({
      name: "fake.jpg",
      mimeType: "image/jpeg",
      buffer: Buffer.from("not an image"),
    });
  await expect(dialog.getByRole("alert")).toContainText("valid JPG");
  await expect(
    dialog.getByRole("img", {
      name: "Your selected profile photo",
      exact: true,
    }),
  ).toBeVisible();
  await dialog
    .getByRole("button", { name: "Remove photo", exact: true })
    .click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Remove from profile", exact: true })
    .click();
  await dialog
    .getByRole("button", { name: "Save Changes", exact: true })
    .click();
  await expect(
    dialog.getByRole("img", { name: "Your profile photo", exact: true }),
  ).toHaveCount(0);
  await expect(
    dialog.getByRole("img", { name: "Girl student portrait", exact: true }),
  ).toBeVisible();
  await page.reload();
  await page
    .getByRole("button", { name: "Student profile", exact: true })
    .click();
  await expect(
    dialog.getByRole("img", { name: "Your profile photo", exact: true }),
  ).toHaveCount(0);
});

test("camera permission failure keeps the upload option usable", async ({
  page,
}) => {
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      throw new DOMException("Denied", "NotAllowedError");
    };
  });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Student profile", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Edit Student Profile", exact: true })
    .click();
  await page.getByRole("button", { name: "Take photo", exact: true }).click();
  const camera = page.getByRole("dialog", {
    name: "Take a profile photo",
    exact: true,
  });
  await expect(camera.getByRole("alert")).toContainText(
    "unavailable or was declined",
  );
  await camera
    .getByRole("button", { name: "Close camera", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Upload photo", exact: true }),
  ).toBeEnabled();
});

test("camera capture stops the stream and saves through the same crop workflow", async ({
  page,
}) => {
  await page.addInitScript(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      const canvas = document.createElement("canvas");
      canvas.width = 320;
      canvas.height = 400;
      const context = canvas.getContext("2d")!;
      const stream = canvas.captureStream(10);
      const timer = window.setInterval(() => {
        context.fillStyle = "#367f92";
        context.fillRect(0, 0, 320, 400);
      }, 50);
      for (const track of stream.getTracks()) {
        const stop = track.stop.bind(track);
        track.stop = () => {
          clearInterval(timer);
          stop();
        };
      }
      (window as unknown as { cameraTracks: MediaStreamTrack[] }).cameraTracks =
        stream.getTracks();
      return stream;
    };
  });
  await page.goto("/");
  await page
    .getByRole("button", { name: "Student profile", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Edit Student Profile", exact: true })
    .click();
  await page.getByRole("button", { name: "Take photo", exact: true }).click();
  await page
    .getByRole("dialog", { name: "Take a profile photo", exact: true })
    .getByRole("button", { name: "Capture photo", exact: true })
    .click();
  await expect(
    page.getByRole("dialog", { name: "Take a profile photo", exact: true }),
  ).toHaveCount(0);
  await expect
    .poll(() =>
      page.evaluate(() =>
        (
          window as unknown as { cameraTracks: MediaStreamTrack[] }
        ).cameraTracks.every((track) => track.readyState === "ended"),
      ),
    )
    .toBe(true);
  await page
    .getByRole("button", { name: "Use cropped photo", exact: true })
    .click();
  await page.getByRole("button", { name: "Save Changes", exact: true }).click();
  await expect(
    page.getByRole("img", { name: "Your profile photo", exact: true }),
  ).toBeVisible();
});

test("selected student has four walking directions and phone portrait stays inside its frame", async ({
  page,
}) => {
  await page.goto("/");
  const sprite = page.locator(".campus-student .student-sprite");
  for (const [key, direction] of [
    ["ArrowLeft", "left"],
    ["ArrowUp", "up"],
    ["ArrowRight", "right"],
    ["ArrowDown", "down"],
  ]) {
    await page.locator("#campus-map").focus();
    await page.keyboard.down(key);
    await expect(sprite).toHaveAttribute("data-direction", direction);
    await page.keyboard.up(key);
  }
  await page
    .getByRole("button", { name: "Student profile", exact: true })
    .click();
  const portrait = await page.locator(".trainer-portrait").boundingBox();
  const fields = await page.locator(".trainer-fields").boundingBox();
  expect(portrait!.x + portrait!.width).toBeLessThanOrEqual(fields!.x);
  await expect(
    page.getByRole("img", { name: "Boy student portrait", exact: true }),
  ).toBeVisible();
});
