/**
 * Dev seed (Epic E2). Emits idempotent UPSERT SQL for a small set of demo
 * users to stdout. Passwords are hashed with the SAME PBKDF2-SHA256 approach
 * as src/lib/server/auth.ts (100000 iters, SHA-256, 256-bit, base64url) so the
 * login route validates them correctly.
 *
 * LOCAL ONLY. No real users. Usage (see package.json db:seed:local):
 *   node scripts/seed-dev.mjs | wrangler d1 execute pathfinder --local --file=/dev/stdin
 */
import { webcrypto } from 'node:crypto';

const subtle = webcrypto.subtle;
const getRandomValues = (buf) => webcrypto.getRandomValues(buf);

function b64url(buf) {
	return Buffer.from(buf).toString('base64url');
}

function uuid() {
	const b = new Uint8Array(16);
	getRandomValues(b);
	b[6] = (b[6] & 0x0f) | 0x40;
	b[8] = (b[8] & 0x3f) | 0x80;
	const h = Buffer.from(b).toString('hex');
	return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

async function hashPassword(password, salt) {
	const enc = new TextEncoder();
	const km = await subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
	const bits = await subtle.deriveBits(
		{ name: 'PBKDF2', salt: enc.encode(salt), iterations: 100000, hash: 'SHA-256' },
		km,
		256
	);
	return b64url(bits);
}

function esc(s) {
	return String(s).replace(/'/g, "''");
}

// Demo users. The admin test@test.com / test1234 backs the E2E login specs.
const USERS = [
	{ name: 'Test Admin', email: 'test@test.com', password: 'test1234', role: 'admin', org: 'Pathfinder LiDAR' },
	{ name: 'Demo Staff', email: 'staff@test.com', password: 'test1234', role: 'staff', org: 'Pathfinder LiDAR' },
	{ name: 'Demo Client', email: 'client@test.com', password: 'test1234', role: 'client', org: 'Northgate School District' }
];

const lines = ['-- LOCAL dev seed (idempotent). Passwords: test1234'];

for (const u of USERS) {
	const id = uuid();
	const salt = uuid();
	const hash = await hashPassword(u.password, salt);
	lines.push(
		`INSERT INTO users (id, name, email, password_hash, salt, role, org, active, mfa_enabled, token_version, created_at)\n` +
			`VALUES ('${id}', '${esc(u.name)}', '${esc(u.email)}', '${hash}', '${salt}', '${u.role}', '${esc(u.org)}', 1, 0, 0, datetime('now'))\n` +
			`ON CONFLICT(email) DO UPDATE SET\n` +
			`  password_hash=excluded.password_hash, salt=excluded.salt,\n` +
			`  name=excluded.name, role=excluded.role, org=excluded.org, active=1,\n` +
			`  token_version=0;`
	);
}

process.stdout.write(lines.join('\n') + '\n');
