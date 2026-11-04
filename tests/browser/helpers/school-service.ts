import type { Page } from "@playwright/test";
import { readFileSync } from "node:fs";
const config = JSON.parse(
  readFileSync(
    new URL("../../../src/lib/student-project.json", import.meta.url),
    "utf8",
  ),
);
export const schoolUser = "11111111-1111-4111-8111-111111111111";
export async function installSchoolService(page: Page, role = "student") {
  const user = {
    id: schoolUser,
    email: "learner@example.test",
    aud: "authenticated",
    role: "authenticated",
    app_metadata: {},
    user_metadata: {},
    created_at: new Date().toISOString(),
  };
  const exp = Math.floor(Date.now() / 1000) + 3600;
  const token = `${Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url")}.${Buffer.from(JSON.stringify({ sub: schoolUser, role: "authenticated", exp })).toString("base64url")}.signature`;
  await page.addInitScript(
    (session) =>
      localStorage.setItem(
        "campus-explorer-student-auth",
        JSON.stringify(session),
      ),
    {
      access_token: token,
      refresh_token: "test-refresh",
      expires_at: exp,
      expires_in: 3600,
      token_type: "bearer",
      user,
    },
  );
  const state = {
    role,
    missing: false,
    writes: [] as {
      table: string;
      method: string;
      body: Record<string, unknown>;
    }[],
    tables: {} as Record<string, Record<string, unknown>[]>,
  };
  await page.route(`${config.url}/**`, async (route) => {
    const req = route.request(),
      url = new URL(req.url()),
      method = req.method();
    const headers = {
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "*",
      "access-control-allow-methods": "*",
    };
    const json = (body: unknown, status = 200) =>
      route.fulfill({ json: body, status, headers });
    if (method === "OPTIONS") return route.fulfill({ status: 204, headers });
    if (url.pathname === "/auth/v1/user") return json(user);
    if (url.pathname.includes("/functions/"))
      return json({ error: "Verifier not deployed" }, 503);
    if (url.pathname.includes("/rpc/")) return json([]);
    const table = url.pathname.split("/").at(-1)!;
    if (table === "explorer_profiles")
      return json([
        {
          user_id: schoolUser,
          avatar: "boy",
          name: "",
          grade: "",
          section: "",
          teacher: "",
          sex: "",
          sharing: false,
          photo_available: false,
          visibility: {
            name: false,
            grade: false,
            section: false,
            teacher: false,
            sex: false,
            photo: false,
          },
          updated_at: new Date().toISOString(),
        },
      ]);
    if (table === "explorer_presence") return json([]);
    if (state.missing)
      return json({ code: "42P01", message: "table missing" }, 404);
    if (table === "explorer_staff" && method === "GET")
      return json(
        state.role === "student"
          ? []
          : [{ user_id: schoolUser, role: state.role, label: "Staff" }],
      );
    const rows = (state.tables[table] ??= []);
    if (method === "GET") return json(rows);
    const body = method === "DELETE" ? {} : req.postDataJSON();
    state.writes.push({ table, method, body });
    if (method === "DELETE") {
      state.tables[table] = [];
      return json([]);
    }
    if (method === "PATCH") {
      const id = url.searchParams.get("id")?.slice(3);
      const found = rows.find((r) => r.id === id);
      if (!found) return json([]);
      Object.assign(found, body);
      return json([found]);
    }
    if (method === "POST") {
      const row = {
        id: `00000000-0000-4000-8000-${String(rows.length + 1).padStart(12, "0")}`,
        user_id: schoolUser,
        created_at: new Date().toISOString(),
        active: true,
        cancelled: false,
        ...body,
      };
      if (table === "explorer_community") row.status = "pending";
      if (table === "explorer_reports") row.status = "submitted";
      rows.push(row);
      return json([row]);
    }
    return json([]);
  });
  return state;
}
