/**
 * Hierarchy dev seed (Epic E3 - Org Hierarchy & Dashboards). Emits idempotent
 * INSERT ... ON CONFLICT SQL to stdout for a small demo tree so the roll-up
 * dashboard and the browse/breadcrumb routes have real content:
 *
 *   Org: ELS911
 *     District: Wellsboro Area School District
 *       Facility: Wellsboro Area High School   (2 buildings, 2 projects)
 *       Facility: Don Gill Elementary School   (1 building, 1 project)
 *     Facility (standalone): Tioga County 911 Center (1 building)
 *
 * Plus a SECOND org (Northgate School District) so the seeded CLIENT user
 * (client@test.com, org 'Northgate School District') sees exactly one org and
 * org-scoping is demonstrable. IDs are deterministic so E2E can navigate by
 * stable URLs. LOCAL ONLY - no real data.
 *
 * Usage (see package.json db:seed:hierarchy:local):
 *   node scripts/seed-hierarchy.mjs | wrangler d1 execute pathfinder --local --file=/dev/stdin
 */

function esc(s) {
	return String(s).replace(/'/g, "''");
}

const lines = ['-- LOCAL hierarchy seed (idempotent).'];

// --- helpers that emit idempotent UPSERTs ---

function org(id, name, type) {
	lines.push(
		`INSERT INTO orgs (id, name, type) VALUES ('${id}', '${esc(name)}', '${type}')\n` +
			`ON CONFLICT(id) DO UPDATE SET name=excluded.name, type=excluded.type;`
	);
}

function district(id, orgId, name) {
	lines.push(
		`INSERT INTO districts (id, org_id, name) VALUES ('${id}', '${orgId}', '${esc(name)}')\n` +
			`ON CONFLICT(id) DO UPDATE SET org_id=excluded.org_id, name=excluded.name;`
	);
}

function facility(id, districtId, orgId, name, type, address, zip, phone) {
	const d = districtId ? `'${districtId}'` : 'NULL';
	lines.push(
		`INSERT INTO facilities (id, district_id, org_id, name, type, address, zip, phone)\n` +
			`VALUES ('${id}', ${d}, '${orgId}', '${esc(name)}', '${type}', '${esc(address)}', '${esc(zip)}', '${esc(phone)}')\n` +
			`ON CONFLICT(id) DO UPDATE SET district_id=excluded.district_id, org_id=excluded.org_id,\n` +
			`  name=excluded.name, type=excluded.type, address=excluded.address, zip=excluded.zip, phone=excluded.phone;`
	);
}

function building(id, facilityId, name, floors) {
	lines.push(
		`INSERT INTO buildings (id, facility_id, name, floors) VALUES ('${id}', '${facilityId}', '${esc(name)}', ${floors})\n` +
			`ON CONFLICT(id) DO UPDATE SET facility_id=excluded.facility_id, name=excluded.name, floors=excluded.floors;`
	);
}

function project(id, buildingId, name, status, progress) {
	lines.push(
		`INSERT INTO projects (id, building_id, name, status, progress)\n` +
			`VALUES ('${id}', '${buildingId}', '${esc(name)}', '${status}', ${progress})\n` +
			`ON CONFLICT(id) DO UPDATE SET building_id=excluded.building_id, name=excluded.name,\n` +
			`  status=excluded.status, progress=excluded.progress;`
	);
}

// --- ELS911 org (the flagship operator deployment's demo tenant) ---
const ORG_ELS = 'org-els911-0000-0000-0000-000000000001';
org(ORG_ELS, 'ELS911', '911_center');

const DIST_WELLS = 'dist-wellsboro-0000-0000-000000000001';
district(DIST_WELLS, ORG_ELS, 'Wellsboro Area School District');

const FAC_WAHS = 'fac-wahs-0000-0000-0000-000000000001';
facility(FAC_WAHS, DIST_WELLS, ORG_ELS, 'Wellsboro Area High School', 'school', '225 Nichols St', '16901', '570-724-3500');

const FAC_DGE = 'fac-dongill-0000-0000-0000-00000000001';
facility(FAC_DGE, DIST_WELLS, ORG_ELS, 'Don Gill Elementary School', 'school', '24 Pearl St', '16901', '570-724-1234');

const FAC_911 = 'fac-tioga911-0000-0000-000000000001';
facility(FAC_911, null, ORG_ELS, 'Tioga County 911 Center', '911_center', '116 Nichols St', '16901', '570-724-9111');

// Buildings.
const B_WAHS_MAIN = 'bld-wahs-main-0000-000000000001';
const B_WAHS_GYM = 'bld-wahs-gym-0000-0000000000001';
building(B_WAHS_MAIN, FAC_WAHS, 'Main Building', 3);
building(B_WAHS_GYM, FAC_WAHS, 'Gymnasium', 1);

const B_DGE_MAIN = 'bld-dge-main-0000-0000000000001';
building(B_DGE_MAIN, FAC_DGE, 'Main Building', 2);

const B_911_OPS = 'bld-911-ops-0000-00000000000001';
building(B_911_OPS, FAC_911, 'Operations Center', 1);

// Projects (give roll-ups something to count).
project('proj-wahs-egress-000000000001', B_WAHS_MAIN, 'Egress mapping review', 'in_review', 60);
project('proj-wahs-nfpa-0000000000001', B_WAHS_MAIN, 'NFPA 170 marker pass', 'draft', 20);
project('proj-dge-floorplan-00000001', B_DGE_MAIN, 'Floorplan annotation', 'approved', 100);

// --- Documents + annotations + map markers (Epics E5/E6 demo content) ---
function document(id, projectId, filename, storageKey, pageCount) {
	lines.push(
		`INSERT INTO documents (id, project_id, filename, storage_key, page_count, doc_type, mime_type)\n` +
			`VALUES ('${id}', '${projectId}', '${esc(filename)}', '${esc(storageKey)}', ${pageCount}, 'floorplan', 'application/pdf')\n` +
			`ON CONFLICT(id) DO UPDATE SET project_id=excluded.project_id, filename=excluded.filename,\n` +
			`  storage_key=excluded.storage_key, page_count=excluded.page_count;`
	);
}
function annotation(id, docId, page, type, nx, ny, nw, nh, color, text) {
	const t = text === null ? 'NULL' : `'${esc(text)}'`;
	lines.push(
		`INSERT INTO annotations (id, document_id, page_number, type, nx, ny, nw, nh, color, text)\n` +
			`VALUES ('${id}', '${docId}', ${page}, '${type}', ${nx}, ${ny}, ${nw}, ${nh}, '${color}', ${t})\n` +
			`ON CONFLICT(id) DO UPDATE SET nx=excluded.nx, ny=excluded.ny, nw=excluded.nw, nh=excluded.nh,\n` +
			`  type=excluded.type, color=excluded.color, text=excluded.text;`
	);
}
function marker(id, docId, page, type, label, nx, ny) {
	lines.push(
		`INSERT INTO map_markers (id, doc_id, page, type, label, nx, ny)\n` +
			`VALUES ('${id}', '${docId}', ${page}, '${type}', '${esc(label)}', ${nx}, ${ny})\n` +
			`ON CONFLICT(id) DO UPDATE SET type=excluded.type, label=excluded.label, nx=excluded.nx, ny=excluded.ny;`
	);
}

const DOC_WAHS_F1 = 'doc-wahs-main-f1-000000000001';
document(DOC_WAHS_F1, 'proj-wahs-egress-000000000001', 'WAHS Main - Floor 1.pdf', 'demo/wahs-main-f1.pdf', 1);
annotation('ann-wahs-aed-00000000000001', DOC_WAHS_F1, 1, 'aed', 0.32, 0.41, 0, 0, '#1565C0', null);
annotation('ann-wahs-exit-0000000000001', DOC_WAHS_F1, 1, 'exit', 0.78, 0.22, 0, 0, '#059669', null);
annotation('ann-wahs-note-0000000000001', DOC_WAHS_F1, 1, 'comment', 0.5, 0.6, 0, 0, '#B22234', 'Verify door swing direction with facility staff.');
annotation('ann-wahs-rect-0000000000001', DOC_WAHS_F1, 1, 'rect', 0.15, 0.15, 0.2, 0.12, '#B22234', null);
marker('mk-wahs-stair-000000000001', DOC_WAHS_F1, 1, 'stairs', 'S1', 0.2, 0.8);
marker('mk-wahs-door-0000000000001', DOC_WAHS_F1, 1, 'door', 'A', 0.6, 0.3);

// A dedicated scratch document (no annotations) for write/persist e2e so the
// mutation tests do not disturb the read-only-count assertions on DOC_WAHS_F1.
document('doc-wahs-scratch-00000000001', 'proj-wahs-egress-000000000001', 'WAHS scratch sheet.pdf', 'demo/scratch.pdf', 1);

// Media assets (Epic E7/E8 demo). Binaries are not seeded (no real scans in a
// public repo); the 3D viewer degrades gracefully to its "unavailable" state.
function media(id, buildingId, type, filename, key, tier, served, version, captureDate, surveyor, floor) {
	lines.push(
		`INSERT INTO media_assets (id, building_id, type, filename, r2_key, storage_tier, served, version, capture_date, surveyor, floor, status)\n` +
			`VALUES ('${id}', '${buildingId}', '${type}', '${esc(filename)}', '${esc(key)}', '${tier}', ${served}, ${version}, '${captureDate}', '${esc(surveyor)}', ${floor}, 'active')\n` +
			`ON CONFLICT(id) DO UPDATE SET type=excluded.type, filename=excluded.filename, r2_key=excluded.r2_key,\n` +
			`  storage_tier=excluded.storage_tier, served=excluded.served, version=excluded.version,\n` +
			`  capture_date=excluded.capture_date, surveyor=excluded.surveyor, floor=excluded.floor;`
	);
}
media('med-wahs-splat-f1-00000001', B_WAHS_MAIN, 'splat', 'WAHS Main Floor 1.spz', 'hot/splat/bld-wahs-main/v1/wahs_f1.spz', 'hot', 1, 1, '2026-05-12', 'J. Porterfield', 1);
media('med-wahs-video-f1-0000001', B_WAHS_MAIN, 'walkthrough_video', 'WAHS Main Floor 1 walkthrough.mp4', 'hot/video/bld-wahs-main/v1/wahs_f1.mp4', 'hot', 1, 1, '2026-05-12', 'J. Porterfield', 1);
media('med-wahs-ply-f1-000000001', B_WAHS_MAIN, 'point_cloud', 'WAHS Main Floor 1 master.ply', 'cold/pointcloud/bld-wahs-main/v1/wahs_f1.ply', 'cold', 0, 1, '2026-05-12', 'J. Porterfield', 1);
media('med-wahs-pdf-f1-000000001', B_WAHS_MAIN, 'floorplan_pdf', 'WAHS Main Floor 1.pdf', 'hot/docs/bld-wahs-main/v1/wahs_f1.pdf', 'hot', 1, 1, '2026-05-12', 'J. Porterfield', 1);
media('med-wahs-img-f1-000000001', B_WAHS_MAIN, 'reference_image', 'WAHS entrance photo.jpg', 'hot/ref/bld-wahs-main/v1/entrance.jpg', 'hot', 1, 1, '2026-05-12', 'J. Porterfield', 1);

// --- Search index seed (Epic E10) so /search returns hits without a manual
//     reindex. Index-on-write keeps it current as entities are created. ---
function searchRow(type, id, title, subtitle, url) {
	lines.push(
		`INSERT INTO search_index (entity_type, entity_id, title, subtitle, url)\n` +
			`VALUES ('${type}', '${id}', '${esc(title)}', '${esc(subtitle)}', '${esc(url)}');`
	);
}
// Rebuild the demo rows idempotently: clear any prior seed of these ids first.
lines.push(`DELETE FROM search_index WHERE entity_type IN ('facility','building','project','document','marker');`);
searchRow('facility', FAC_WAHS, 'Wellsboro Area High School', 'school', `/facilities/${FAC_WAHS}`);
searchRow('facility', FAC_DGE, 'Don Gill Elementary School', 'school', `/facilities/${FAC_DGE}`);
searchRow('facility', FAC_911, 'Tioga County 911 Center', '911_center', `/facilities/${FAC_911}`);
searchRow('building', B_WAHS_MAIN, 'Main Building', 'Building', `/buildings/${B_WAHS_MAIN}`);
searchRow('building', B_WAHS_GYM, 'Gymnasium', 'Building', `/buildings/${B_WAHS_GYM}`);
searchRow('document', DOC_WAHS_F1, 'WAHS Main - Floor 1.pdf', 'Floorplan', `/documents/${DOC_WAHS_F1}`);
searchRow('marker', 'mk-wahs-stair-000000000001', 'S1', 'stairs marker', `/documents/${DOC_WAHS_F1}`);
searchRow('marker', 'mk-wahs-door-0000000000001', 'A', 'door marker', `/documents/${DOC_WAHS_F1}`);

// --- A second org so the client user sees exactly one (org-scoping demo) ---
const ORG_NORTH = 'org-northgate-0000-0000-000000000001';
org(ORG_NORTH, 'Northgate School District', 'school');
const FAC_NORTH = 'fac-northgate-0000-0000-00000000001';
facility(FAC_NORTH, null, ORG_NORTH, 'Northgate Middle School', 'school', '100 Main St', '15202', '412-555-0100');
building('bld-north-main-0000-000000000001', FAC_NORTH, 'Main Building', 2);

process.stdout.write(lines.join('\n') + '\n');
