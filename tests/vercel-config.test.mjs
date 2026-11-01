import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { matchesGlob } from 'node:path';

const config = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
const api = config.functions['api/index.mjs'];

test('Vercel function file rules use supported string globs and include API runtime data', () => {
  // functions.* uses string globs, unlike the legacy builder config API's arrays.
  assert.equal(typeof api.includeFiles, 'string');
  assert.equal(typeof api.excludeFiles, 'string');
  for (const file of [
    'server/http.mjs',
    'server/db.mjs',
    'server/advanced-schema.mjs',
    'server/supabase.mjs',
    'src/data/camarines-norte-schools.json',
  ]) {
    assert.ok(matchesGlob(file, api.includeFiles), `${file} must be included`);
    assert.ok(!matchesGlob(file, api.excludeFiles), `${file} must not be excluded`);
  }
});

test('Vercel excludes local databases, uploaded files, tests and backup archives', () => {
  for (const file of [
    'server/data/radar.db',
    'server/data/workspaces/123456/radar.db-wal',
    'server/uploads/evidence.jpg',
    'tests/vercel.test.mjs',
    '.backups/radar.zip',
    '.backups/2026-11-01/school.db',
  ]) {
    assert.ok(matchesGlob(file, api.excludeFiles), `${file} must be excluded`);
  }
});
