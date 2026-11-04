import { test, expect, type Page } from "@playwright/test";
import { installSchoolService, schoolUser } from "./helpers/school-service";
async function open(page: Page, section: string) {
  await page.goto("/");
  await page
    .getByRole("navigation", { name: "Game navigation" })
    .getByRole("button", { name: "Resources", exact: true })
    .click();
  await page
    .getByRole("navigation", { name: "Preparedness sections" })
    .getByRole("button", { name: section, exact: true })
    .click();
}
test("children can finish matching and scenario activities and keep their badges", async ({
  page,
}) => {
  await open(page, "Children");
  await page
    .getByRole("button", { name: "Shaking starts indoors", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Stay out of the water", exact: true })
    .click();
  await expect(
    page.getByText("Try another action.", { exact: false }),
  ).toBeVisible();
  for (const [s, a] of [
    ["Shaking starts indoors", "Drop, cover and hold on"],
    ["Floodwater covers the path", "Stay out of the water"],
    ["The school fire alarm sounds", "Follow the school evacuation plan"],
  ]) {
    await page.getByRole("button", { name: s, exact: true }).click();
    await page.getByRole("button", { name: a, exact: true }).click();
  }
  await expect(
    page.getByText("Matching badge earned!", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Classroom scenario", exact: true })
    .click();
  for (const choice of [
    "Drop, cover and hold on",
    "School staff following the approved plan",
    "Stay with your group for the headcount",
  ]) {
    await page.getByRole("button", { name: choice, exact: true }).click();
    await page
      .getByRole("button", { name: "Continue story", exact: true })
      .click();
  }
  await expect(
    page.getByText("2 / 2 activity badges on this device."),
  ).toBeVisible();
  await open(page, "Children");
  await expect(
    page.getByText("2 / 2 activity badges on this device."),
  ).toBeVisible();
});
test("nearby map requires explicit search and does not treat mapped schools as shelters", async ({
  page,
}) => {
  let searches = 0;
  await page.addInitScript(() =>
    Object.defineProperty(navigator, "geolocation", {
      value: {
        getCurrentPosition: (success: (p: unknown) => void) =>
          success({ coords: { latitude: 14, longitude: 121 } }),
      },
    }),
  );
  await page.route("https://overpass-api.de/**", (route) => {
    searches++;
    expect(route.request().postData()).toContain("14%2C121");
    return route.fulfill({
      json: {
        elements: [
          {
            type: "node",
            id: 1,
            lat: 14,
            lon: 121,
            tags: { amenity: "school", name: "Example School" },
          },
        ],
      },
    });
  });
  await page.route("https://*.tile.openstreetmap.org/**", (route) =>
    route.abort(),
  );
  await open(page, "Nearby facilities");
  expect(searches).toBe(0);
  await page.getByRole("button", { name: "Use device coordinates" }).click();
  await expect(page.getByLabel("Search latitude")).toHaveValue("14");
  expect(searches).toBe(0);
  await page.getByRole("button", { name: "Search mapped facilities" }).click();
  await expect(page.getByText("Example School", { exact: true })).toBeVisible();
  expect(searches).toBe(1);
  await expect(
    page.getByText("A mapped school is not a verified shelter.", {
      exact: false,
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Open directions" }),
  ).toHaveAttribute(
    "href",
    "https://www.google.com/maps/dir/?api=1&destination=14,121",
  );
});
test("teacher tools publish real requests and participant accounts cannot access admin controls", async ({
  page,
}) => {
  const state = await installSchoolService(page, "teacher");
  await open(page, "School");
  await page
    .getByLabel("Notice title", { exact: true })
    .fill("Scheduled practice");
  await page
    .getByLabel("Notice text", { exact: true })
    .fill("Follow staff instructions during the scheduled drill.");
  await page
    .getByRole("button", { name: "Publish school notice", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Scheduled practice", exact: true }),
  ).toBeVisible();
  expect(state.writes[0].body).toEqual({
    title: "Scheduled practice",
    body: "Follow staff instructions during the scheduled drill.",
    severity: "information",
  });
  await page.getByLabel("Drill title", { exact: true }).fill("Class drill");
  await page
    .getByLabel("Approved meeting location")
    .fill("Staff-designated assembly");
  await page.getByLabel("Drill date and time").fill("2026-12-01T10:00");
  await page
    .getByRole("button", { name: "Schedule drill", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Class drill" }),
  ).toBeVisible();
  await page
    .getByRole("navigation", { name: "Preparedness sections" })
    .getByRole("button", { name: "Admin", exact: true })
    .click();
  await expect(
    page.getByText("Administrator access must be granted", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Grant staff access", exact: true }),
  ).toHaveCount(0);
});
test("sharing records is explicit and can be revoked without sending profile or GPS data", async ({
  page,
}) => {
  const state = await installSchoolService(page);
  await page.addInitScript(
    (id) =>
      localStorage.setItem(
        `campus-preparedness-v1:${id}`,
        JSON.stringify({
          version: 1,
          best: { earthquake: 3 },
          checked: ["plan"],
        }),
      ),
    schoolUser,
  );
  await open(page, "Records");
  await expect(page.getByText("35 / 120 points on this device.")).toBeVisible();
  expect(state.writes).toHaveLength(0);
  await page.getByLabel("Name to share with staff").fill("Practice nickname");
  await page
    .getByRole("button", { name: "Share practice with school staff" })
    .click();
  await expect(
    page.getByRole("button", { name: "Stop sharing practice", exact: true }),
  ).toBeVisible();
  expect(state.writes[0].body).toEqual({
    user_id: schoolUser,
    display_name: "Practice nickname",
    earthquake: 3,
    flood: null,
    fire: null,
    checklist: ["plan"],
  });
  await page
    .getByRole("button", { name: "Stop sharing practice", exact: true })
    .click();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "Confirm stop sharing practice" })
    .click();
  await expect(page.getByText("Shared record removed.")).toBeVisible();
});
test("community posts await moderation and failed receipt verification does not claim success", async ({
  page,
}) => {
  const state = await installSchoolService(page);
  state.tables.explorer_campaigns = [
    {
      id: "00000000-0000-4000-8000-000000000001",
      title: "Test campaign",
      recipient: "Test school",
      wallet: "11111111111111111111111111111111",
      active: true,
    },
  ];
  await open(page, "Community");
  await page
    .getByLabel("Support details")
    .fill("Offer school supplies through the school office.");
  await page
    .getByRole("button", { name: "Submit community post", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "offer · pending" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Approve post" })).toHaveCount(
    0,
  );
  await expect(
    page.getByRole("link", { name: "Review 0.01 SOL in your wallet" }),
  ).toHaveAttribute("href", /^solana:/);
  await page.getByLabel("Finalized transaction signature").fill("1".repeat(88));
  await page
    .getByRole("button", { name: "Verify transfer receipt", exact: true })
    .click();
  await expect(
    page.getByText("Transfer could not be verified.", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByText("Finalized transfer verified.", { exact: false }),
  ).toHaveCount(0);
});
test("unactivated backend is explicitly unavailable rather than presenting fake school data", async ({
  page,
}) => {
  const state = await installSchoolService(page);
  state.missing = true;
  await open(page, "School");
  await expect(
    page.getByText("School services are not activated yet.", { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Publish school notice", exact: true }),
  ).toHaveCount(0);
});

test('administrator can configure a contact and campaign without initiating a payment',async({page})=>{
 const state=await installSchoolService(page,'admin');await open(page,'Admin');
 await page.getByLabel('Verified contact name').fill('School office');await page.getByLabel('Phone with country code').fill('+639123456789');await page.getByRole('button',{name:'Save school contact',exact:true}).click();
 await expect(page.getByText('Saved to the school service.',{exact:true})).toBeVisible();
 await page.getByLabel('Campaign title').fill('School preparedness supplies');await page.getByLabel('Verified recipient name').fill('Test school');await page.getByLabel('Verified Solana mainnet wallet').fill('11111111111111111111111111111111');await page.getByRole('button',{name:'Add verified donation campaign',exact:true}).click();await expect(page.getByRole('heading',{name:'School preparedness supplies · Active'})).toBeVisible();
 await page.getByRole('navigation',{name:'Preparedness sections'}).getByRole('button',{name:'Help',exact:true}).click();await expect(page.getByRole('link',{name:'Call School office: +639123456789'})).toHaveAttribute('href','tel:+639123456789');
 await page.getByLabel('Your location for this request').fill('Building C, Room 101');await page.getByLabel('Help needed').fill('Please send school staff to assist.');await page.getByRole('button',{name:'Send school help request',exact:true}).click();await expect(page.getByText('School help request stored for staff review.',{exact:false})).toBeVisible();
 const report=state.writes.find(w=>w.table==='explorer_reports')!;expect(report.body).toEqual({location:'Building C, Room 101',description:'Please send school staff to assist.',kind:'help'});
});

test('school map notices disappear when their expiry passes while the map stays open',async({page})=>{
 await page.clock.install();
 const state=await installSchoolService(page);
 state.tables.explorer_geo_zones=[{id:'zone-1',label:'Temporary assembly notice',kind:'assembly',lat:14,lon:121,radius:50,expires_at:new Date(Date.now()+20000).toISOString()}];
 await page.route('https://overpass-api.de/**',route=>route.fulfill({json:{elements:[]}}));
 await page.route('https://*.tile.openstreetmap.org/**',route=>route.abort());
 await open(page,'Nearby facilities');
 await page.getByLabel('Search latitude').fill('14');await page.getByLabel('Search longitude').fill('121');await page.getByRole('button',{name:'Search mapped facilities'}).click();
 await expect(page.locator('.leaflet-overlay-pane path')).toHaveCount(2);
 await page.clock.fastForward(25000);
 await expect(page.locator('.leaflet-overlay-pane path')).toHaveCount(1);
});
