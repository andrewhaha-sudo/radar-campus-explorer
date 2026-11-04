import { spawn, spawnSync } from "node:child_process";
import { mkdir, cp, readFile, writeFile, rm, access } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { campusRegistry, campusSeedSql } from "./campus-registry.mjs";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const app = path.join(root, "apps/pathfinder");
const state = path.join(root, ".wrangler/state");
const config = path.join(root, "wrangler.toml");
const env = {
  ...process.env,
  VITE_BRAND: "radar",
  CLOUDFLARE_SEND_METRICS: "false",
  WRANGLER_LOG_PATH: path.join(root, ".wrangler/logs"),
};
const command = process.argv[2] ?? "dev";
if (process.env.VERCEL === "1" && command === "build")
  throw Error(
    "The complete Pathfinder backend requires Cloudflare Pages/Workers. See docs/PATHFINDER-PLATFORM.md; Vercel static hosting cannot serve its API.",
  );
async function run(executable, args, cwd = root, extra = {}) {
  await new Promise((resolve, reject) => {
    const child = spawn(executable, args, {
      cwd,
      env: { ...env, ...extra },
      stdio: "inherit",
    });
    child.on("error", reject);
    child.on("exit", (code) =>
      code === 0
        ? resolve()
        : reject(Error(`${executable} ${args[0]} failed (${code})`)),
    );
  });
}
const npm = (args, cwd = root) =>
  run(process.platform === "win32" ? "npm.cmd" : "npm", args, cwd);
const wrangler = (args) =>
  run(process.execPath, [
    path.join(app, "node_modules/wrangler/bin/wrangler.js"),
    ...args,
  ]);
async function prepareCampus() {
  await rm(path.join(app, "static/indoor-map"), { recursive: true, force: true });
  await cp(path.join(root, "apps/indoor-map/dist"), path.join(app, "static/indoor-map"), { recursive: true });
  await cp(path.join(root, "apps/indoor-map/LICENSE.txt"), path.join(app, "static/indoor-map/LICENSE.txt"));
  await mkdir(path.join(app, "static"), { recursive: true });
  await cp(path.join(root, "public"), path.join(app, "static"), {
    recursive: true,
  });
  await rm(path.join(app, "static/campus"), { recursive: true, force: true });
  await cp(path.join(root, ".build/campus"), path.join(app, "static/campus"), {
    recursive: true,
  });
  await writeFile(
    path.join(app, "static/campus-registry.json"),
    JSON.stringify(campusRegistry(), null, 2),
  );
  await mkdir(path.join(root, ".build"), { recursive: true });
  await writeFile(path.join(root, ".build/campus-seed.sql"), campusSeedSql());
  // Generate real one-page PDFs from the existing illustration, including assembled interiors.
  const { jsPDF } = await import(
    "../apps/pathfinder/node_modules/jspdf/dist/jspdf.node.min.js"
  );
  const pdfDir = path.join(root, ".build/floor-pdfs");
  await mkdir(pdfDir, { recursive: true });
  for (const floor of campusRegistry()) {
    const r = floor.sourceRegistration,
      crop = r.crop;
    const bytes = await readFile(path.join(root, "public", r.image));
    const pdf = new jsPDF({
      unit: "px",
      format: [crop.width, crop.height],
      orientation: crop.width >= crop.height ? "landscape" : "portrait",
      hotfixes: ["px_scaling"],
    });
    const pieces = r.artworkPieces.length
      ? r.artworkPieces
      : [{ source: crop, target: { x: crop.x, y: crop.y } }];
    for (const piece of pieces) {
      pdf.saveGraphicsState();
      pdf.rect(
        piece.target.x - crop.x,
        piece.target.y - crop.y,
        piece.source.width,
        piece.source.height,
      );
      pdf.clip();
      pdf.discardPath();
      pdf.addImage(
        bytes,
        "JPEG",
        piece.target.x - piece.source.x - crop.x,
        piece.target.y - piece.source.y - crop.y,
        r.imageWidth,
        r.imageHeight,
      );
      pdf.restoreGraphicsState();
    }
    await writeFile(
      path.join(pdfDir, `${floor.sceneId}.pdf`),
      Buffer.from(pdf.output("arraybuffer")),
    );
  }
}
async function buildCampus() {
  await npm(["run", "build"], path.join(root, "apps/indoor-map"));
  await run(process.execPath, [path.join(root, "scripts/package-source.mjs")]);
  await run(process.execPath, [
    path.join(root, "node_modules/typescript/bin/tsc"),
    "-b",
  ]);
  await run(process.execPath, [
    path.join(root, "node_modules/vite/bin/vite.js"),
    "build",
    "--base",
    "/campus/",
    "--outDir",
    ".build/campus",
  ]);
  await prepareCampus();
}
async function build() {
  await buildCampus();
  await npm(["run", "build"], app);
  await rm(path.join(root, "dist"), { recursive: true, force: true });
  await cp(path.join(app, ".svelte-kit/cloudflare"), path.join(root, "dist"), {
    recursive: true,
  });
}
async function setup(fixtures = false) {
  await mkdir(path.join(root, ".wrangler"), { recursive: true });
  try {
    await access(path.join(root, ".dev.vars"));
  } catch {
    await writeFile(
      path.join(root, ".dev.vars"),
      "JWT_SECRET=" + randomBytes(48).toString("base64url") + "\n",
      { mode: 0o600 },
    );
  }
  await wrangler([
    "d1",
    "migrations",
    "apply",
    "pathfinder",
    "--local",
    "--persist-to",
    state,
  ]);
  await prepareCampus();
  process.env.WRANGLER_LOG_PATH = env.WRANGLER_LOG_PATH;
  process.env.CLOUDFLARE_SEND_METRICS = "false";
  const { getPlatformProxy } = await import(
    "../apps/pathfinder/node_modules/wrangler/wrangler-dist/cli.js"
  );
  const proxy = await getPlatformProxy({
    configPath: config,
    persist: { path: path.join(state, "v3") },
  });
  try {
    // Trusted seed emitters delimit statements with semicolon + newline.
    const execute = async (sql) => {
      const statements = sql
        .replace(/^\s*--.*$/gm, "")
        .split(/;\s*(?:\n|$)/)
        .map((s) => s.trim())
        .filter(Boolean);
      if (statements.length)
        await proxy.env.DB.batch(
          statements.map((sql) => proxy.env.DB.prepare(sql)),
        );
    };
    const existingAdmin = await proxy.env.DB.prepare(
      "SELECT id FROM users WHERE role = 'admin' LIMIT 1",
    ).first();
    for (const script of [
      ...(fixtures || (!existingAdmin && env.RADAR_PRIVATE_SETUP !== "1") ? ["seed-dev.mjs"] : []),
      ...(fixtures ? ["seed-hierarchy.mjs"] : []),
    ]) {
      const result = spawnSync(
        process.execPath,
        [path.join(app, "scripts", script)],
        { env, cwd: app, encoding: "utf8" },
      );
      if (result.status !== 0) throw Error("Local fixture generation failed");
      await execute(result.stdout);
    }
    await execute(campusSeedSql());
    for (const floor of campusRegistry()) {
      if (await proxy.env.DOCUMENTS.head(floor.storageKey)) continue;
      const bytes = await readFile(
        path.join(root, ".build/floor-pdfs", `${floor.sceneId}.pdf`),
      );
      await proxy.env.DOCUMENTS.put(floor.storageKey, new Uint8Array(bytes), {
        httpMetadata: { contentType: "application/pdf" },
      });
    }
    if (fixtures) {
      const { writeScanFixture } = await import("./scan-fixture.mjs");
      const file = path.join(root, ".build/synthetic-test.spz");
      await writeScanFixture(file);
      await execute(
        "INSERT INTO media_assets (id,building_id,type,filename,r2_key,storage_tier,served,version,status) VALUES ('radar-synthetic-scan','radar-building-a','splat','Synthetic three-point test.spz','radar/synthetic-test.spz','hot',1,1,'active') ON CONFLICT(id) DO NOTHING;\n",
      );
      await proxy.env.DOCUMENTS.put(
        "radar/synthetic-test.spz",
        new Uint8Array(await readFile(file)),
        { httpMetadata: { contentType: "application/octet-stream" } },
      );
    }
    if (fixtures) {
      const { writeScanFixture } = await import("./scan-fixture.mjs");
      const file = path.join(root, ".build/synthetic-test-alt.spz");
      await writeScanFixture(file, 1);
      await execute(
        "INSERT INTO media_assets (id,building_id,type,filename,r2_key,storage_tier,served,version,status) VALUES ('radar-synthetic-scan-alt','radar-building-a','splat','Synthetic one-point test.spz','radar/synthetic-test-alt.spz','hot',1,2,'active') ON CONFLICT(id) DO NOTHING;\n",
      );
      await proxy.env.DOCUMENTS.put(
        "radar/synthetic-test-alt.spz",
        new Uint8Array(await readFile(file)),
        { httpMetadata: { contentType: "application/octet-stream" } },
      );
    }
    console.log(
      "Local facilities database and eleven campus PDF objects verified." +
        (fixtures ? " Synthetic test scan ready." : ""),
    );
  } finally {
    await proxy.dispose();
  }
}

function serve(port) {
  return wrangler([
    "pages",
    "dev",
    path.join(root, "dist"),
    "--local",
    "--persist-to",
    state,
    "--port",
    String(port),
    "--ip",
    "0.0.0.0",
  ]);
}
if (command === "check") await npm(["run", "check"], app);
else if (command === "unit") await npm(["run", "test:unit"], app);
else if (command === "build") await build();
else if (command === "build-campus") await buildCampus();
else if (command === "setup-fixtures") {
  await setup(true);
} else if (command === "setup") await setup(false);
else if (command === "test-server") {
  await build();
  await setup(true);
  await serve(4173);
} else if (command === "preview") {
  await serve(Number(process.env.PORT ?? 5173));
} else if (command === "dev") {
  await buildCampus();
  await setup(false);
  await npm(
    [
      "run",
      "dev",
      "--",
      "--host",
      "0.0.0.0",
      "--port",
      process.env.PORT ?? "5173",
      "--strictPort",
    ],
    app,
  );
} else if (command === "deploy") {
  const text = await readFile(config, "utf8");
  if (text.includes("00000000-0000-0000-0000-000000000000"))
    throw Error(
      "Configure your own Cloudflare D1/KV IDs and secrets before deployment. See docs/PATHFINDER-PLATFORM.md.",
    );
  await build();
  await wrangler([
    "pages",
    "deploy",
    path.join(root, "dist"),
    "--project-name",
    "radar-campus-explorer",
  ]);
} else throw Error("Unknown platform command: " + command);
