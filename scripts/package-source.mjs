// Package corresponding web-app source, including local changes, without Git metadata,
// environment files, dependency caches or the generated bundle itself.
import { readdir, readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const files = [];
async function collect(dir) {
  for (const entry of (
    await readdir(path.join(root, dir), { withFileTypes: true })
  ).sort((a, b) => a.name.localeCompare(b.name))) {
    if (
      entry.name.startsWith(".") ||
      entry.name === "node_modules" ||
      entry.name === "source" ||
      entry.name === "__screenshots__"
    )
      continue;
    const name = path.posix.join(dir, entry.name);
    if (entry.isDirectory()) await collect(name);
    else if (entry.isFile()) files.push(name);
  }
}
for (const dir of ["src", "public", "scripts", "tests", "docs", ".github"])
  await collect(dir);
for (const name of [
  "package.json",
  "package-lock.json",
  "index.html",
  "vite.config.ts",
  "playwright.config.ts",
  "tsconfig.json",
  "tsconfig.app.json",
  "tsconfig.node.json",
  ".oxlintrc.json",
  ".gitignore",
  "README.md",
  "LICENSE",
  "THIRD_PARTY_NOTICES.md",
])
  files.push(name);
for (const dir of [
  "src",
  "scripts",
  "tests",
  "docs",
  "migrations",
  ".github",
]) {
  try {
    await collect(`apps/pathfinder/${dir}`);
  } catch (cause) {
    if (cause.code !== "ENOENT") throw cause;
  }
}
for (const name of [
  "AGENTS.md",
  "README.md",
  "LICENSE",
  "package.json",
  "package-lock.json",
  "svelte.config.js",
  "vite.config.ts",
  "tsconfig.json",
  "playwright.config.ts",
  "vitest.config.ts",
  "wrangler.toml",
  ".gitignore",
  "UPSTREAM.md",
])
  files.push(`apps/pathfinder/${name}`);
for (const dir of ["src", "upstream"]) await collect(`apps/indoor-map/${dir}`);
for (const file of ["package.json", "package-lock.json", "index.html", "LICENSE.txt", "UPSTREAM.md"]) files.push(`apps/indoor-map/${file}`);
files.push("wrangler.toml");
const blocks = [];
for (const file of files.sort()) {
  const body = await readFile(path.join(root, file));
  const header = Buffer.alloc(512);
  const full = "radar-campus-explorer/" + file;
  let name = full,
    prefix = "";
  if (Buffer.byteLength(name) > 100) {
    const slash = full.lastIndexOf("/");
    prefix = full.slice(0, slash);
    name = full.slice(slash + 1);
  }
  if (Buffer.byteLength(name) > 100 || Buffer.byteLength(prefix) > 155)
    throw Error("Source path too long: " + file);
  const text = (value, offset, length) =>
    header.write(value, offset, length, "utf8");
  const octal = (value, offset, length) =>
    text(value.toString(8).padStart(length - 1, "0") + "\0", offset, length);
  text(name, 0, 100);
  octal(0o644, 100, 8);
  octal(0, 108, 8);
  octal(0, 116, 8);
  octal(body.length, 124, 12);
  octal(0, 136, 12);
  header.fill(32, 148, 156);
  text("0", 156, 1);
  text("ustar\0", 257, 6);
  text("00", 263, 2);
  text(prefix, 345, 155);
  const sum = header.reduce((a, b) => a + b, 0);
  text(sum.toString(8).padStart(6, "0") + "\0 ", 148, 8);
  blocks.push(header, body, Buffer.alloc((512 - (body.length % 512)) % 512));
}
blocks.push(Buffer.alloc(1024));
const output = path.join(root, "public/source");
await mkdir(output, { recursive: true });
await writeFile(
  path.join(output, "radar-campus-explorer.tar.gz"),
  gzipSync(Buffer.concat(blocks)),
);
console.log(
  `Packaged ${files.length} web source files for the AGPL source download.`,
);
