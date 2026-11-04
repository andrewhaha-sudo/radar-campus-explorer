// Project review-workflow DAL (Epic E4). Scoped project reads (via the building
// -> facility -> org chain), guarded status transitions, and member assignment.
// Status edges are validated by the pure workflow engine; the server is the
// authority. Transitions and membership changes are written to the activity log.

import { uuid } from './auth';
import { canSeeOrg, type ScopeUser } from './hierarchy';
import { logActivity } from './collab';
import { canTransition, progressForStatus, type ProjectStatus, type MemberRole } from '$lib/engines/workflow/status';

type Env = { DB: D1Database };

export interface ProjectRow {
	id: string;
	building_id: string | null;
	name: string;
	status: ProjectStatus;
	progress: number;
	created_by: string | null;
	created_at: string;
	updated_at: string | null;
}

async function projectOrgName(env: Env, projectId: string): Promise<string | null> {
	const row = await env.DB.prepare(
		`SELECT o.name AS n FROM projects p
		   JOIN buildings b ON b.id = p.building_id
		   JOIN facilities f ON f.id = b.facility_id
		   JOIN orgs o ON o.id = f.org_id
		  WHERE p.id = ?`
	)
		.bind(projectId)
		.first<{ n: string }>();
	return row?.n ?? null;
}

/** Is `userId` a member of `projectId`? (Clients see only projects they are
 *  members of - AC-4.2.1/4.5.1.) */
export async function isMember(env: Env, projectId: string, userId: string): Promise<boolean> {
	const row = await env.DB.prepare('SELECT 1 AS x FROM project_members WHERE project_id = ? AND user_id = ?')
		.bind(projectId, userId)
		.first();
	return !!row;
}

/** Member role for a user on a project ('reviewer'|'viewer'), or null. */
export async function memberRole(env: Env, projectId: string, userId: string): Promise<MemberRole | null> {
	const row = await env.DB.prepare('SELECT role FROM project_members WHERE project_id = ? AND user_id = ?')
		.bind(projectId, userId)
		.first<{ role: MemberRole }>();
	return row?.role ?? null;
}

/** Fetch a project with access control. Staff/admin: org scope. Client: org
 *  scope AND project membership (losing membership loses access next request). */
export async function getProject(
	env: Env,
	user: ScopeUser & { id?: string },
	id: string
): Promise<ProjectRow | null> {
	const row = await env.DB.prepare('SELECT * FROM projects WHERE id = ?').bind(id).first<ProjectRow>();
	if (!row) return null;
	const org = await projectOrgName(env, id);
	if (org === null) return user.role !== 'client' ? row : null;
	if (!canSeeOrg(user, org)) return null;
	if (user.role === 'client') {
		if (!user.id || !(await isMember(env, id, user.id))) return null;
	}
	return row;
}

export async function createProject(
	env: Env,
	input: { name: string; building_id: string; created_by: string }
): Promise<ProjectRow> {
	const id = uuid();
	await env.DB.prepare(
		"INSERT INTO projects (id, building_id, name, status, progress, created_by, updated_at) VALUES (?, ?, ?, 'draft', 10, ?, datetime('now'))"
	)
		.bind(id, input.building_id, input.name.trim(), input.created_by)
		.run();
	await logActivity(env, input.created_by, 'project.create', 'project', id, input.name);
	return (await env.DB.prepare('SELECT * FROM projects WHERE id = ?').bind(id).first<ProjectRow>())!;
}

export interface TransitionResult {
	ok: boolean;
	error?: string;
	status?: ProjectStatus;
	progress?: number;
}

/** Transition a project's status along a legal edge, stamping progress + time
 *  and logging activity. Rejects illegal edges. */
export async function transitionStatus(
	env: Env,
	actorId: string,
	project: ProjectRow,
	to: ProjectStatus
): Promise<TransitionResult> {
	if (!canTransition(project.status, to)) {
		return { ok: false, error: `Cannot move a project from ${project.status} to ${to}.` };
	}
	const progress = progressForStatus(to);
	await env.DB.prepare("UPDATE projects SET status = ?, progress = ?, updated_at = datetime('now') WHERE id = ?")
		.bind(to, progress, project.id)
		.run();
	await logActivity(env, actorId, `project.${to}`, 'project', project.id, `${project.name}: ${project.status} -> ${to}`);
	return { ok: true, status: to, progress };
}

export interface MemberRow {
	project_id: string;
	user_id: string;
	role: MemberRole;
	added_at: string;
	name?: string;
	email?: string;
}

export async function listMembers(env: Env, projectId: string): Promise<MemberRow[]> {
	const { results } = await env.DB.prepare(
		`SELECT pm.*, u.name, u.email FROM project_members pm
		   JOIN users u ON u.id = pm.user_id WHERE pm.project_id = ? ORDER BY u.name`
	)
		.bind(projectId)
		.all<MemberRow>();
	return results ?? [];
}

export async function addMember(
	env: Env,
	actorId: string,
	projectId: string,
	userId: string,
	role: MemberRole
): Promise<void> {
	await env.DB.prepare(
		`INSERT INTO project_members (project_id, user_id, role) VALUES (?, ?, ?)
		 ON CONFLICT(project_id, user_id) DO UPDATE SET role = excluded.role`
	)
		.bind(projectId, userId, role)
		.run();
	await logActivity(env, actorId, 'project.member.add', 'project', projectId, `added member as ${role}`);
}

export async function removeMember(env: Env, actorId: string, projectId: string, userId: string): Promise<void> {
	await env.DB.prepare('DELETE FROM project_members WHERE project_id = ? AND user_id = ?')
		.bind(projectId, userId)
		.run();
	await logActivity(env, actorId, 'project.member.remove', 'project', projectId, 'removed member');
}

// --- Versions + approvals (E4) ---

export interface VersionRow {
	id: string;
	project_id: string;
	version: number;
	status: string;
	notes: string | null;
	published_by: string | null;
	published_at: string;
}

export async function listVersions(env: Env, projectId: string): Promise<VersionRow[]> {
	const { results } = await env.DB.prepare(
		'SELECT * FROM project_versions WHERE project_id = ? ORDER BY version DESC'
	)
		.bind(projectId)
		.all<VersionRow>();
	return results ?? [];
}

/**
 * Publish a new review version (AC-4.3.1/4.3.2): increments the version, marks
 * the project in_review, notifies every member, and logs activity. Prior
 * versions (and their approvals) are retained. Returns the new version number.
 */
export async function publishVersion(
	env: Env,
	actorId: string,
	project: ProjectRow,
	notes: string | null
): Promise<number> {
	const last = await env.DB.prepare('SELECT MAX(version) AS v FROM project_versions WHERE project_id = ?')
		.bind(project.id)
		.first<{ v: number | null }>();
	const version = (last?.v ?? 0) + 1;
	await env.DB.batch([
		env.DB.prepare(
			"INSERT INTO project_versions (id, project_id, version, status, notes, published_by) VALUES (?, ?, ?, 'in_review', ?, ?)"
		).bind(uuid(), project.id, version, notes, actorId),
		env.DB.prepare("UPDATE projects SET status = 'in_review', progress = 60, updated_at = datetime('now') WHERE id = ?").bind(project.id)
	]);
	// Notify members (batched digest later) that a version awaits review.
	const { results } = await env.DB.prepare('SELECT user_id FROM project_members WHERE project_id = ?')
		.bind(project.id)
		.all<{ user_id: string }>();
	const stmts = (results ?? [])
		.filter((m) => m.user_id !== actorId)
		.map((m) =>
			env.DB.prepare(
				'INSERT INTO notifications (id, recipient_id, actor_id, kind, resource_url, excerpt) VALUES (?, ?, ?, ?, ?, ?)'
			).bind(uuid(), m.user_id, actorId, 'reply', `/buildings/${project.building_id}`, `${project.name} v${version} awaiting review`)
		);
	if (stmts.length) await env.DB.batch(stmts);
	await logActivity(env, actorId, 'project.version.publish', 'project', project.id, `${project.name} v${version}`);
	return version;
}

/** Record an approval of the current version by a reviewer (AC-4.4.1). The
 *  caller verifies the actor is an allowed reviewer first. */
export async function recordApproval(
	env: Env,
	approverId: string,
	project: ProjectRow,
	version: number
): Promise<void> {
	await env.DB.batch([
		env.DB.prepare('INSERT INTO project_approvals (id, project_id, version, approver_id) VALUES (?, ?, ?, ?)').bind(
			uuid(),
			project.id,
			version,
			approverId
		),
		env.DB.prepare("UPDATE project_versions SET status = 'approved' WHERE project_id = ? AND version = ?").bind(project.id, version),
		env.DB.prepare("UPDATE projects SET status = 'approved', progress = 100, updated_at = datetime('now') WHERE id = ?").bind(project.id)
	]);
	await logActivity(env, approverId, 'project.approve', 'project', project.id, `approved v${version}`);
}

export async function listApprovals(env: Env, projectId: string): Promise<Array<{ version: number; approver_id: string; created_at: string }>> {
	const { results } = await env.DB.prepare(
		'SELECT version, approver_id, created_at FROM project_approvals WHERE project_id = ? ORDER BY created_at DESC'
	)
		.bind(projectId)
		.all<{ version: number; approver_id: string; created_at: string }>();
	return results ?? [];
}
