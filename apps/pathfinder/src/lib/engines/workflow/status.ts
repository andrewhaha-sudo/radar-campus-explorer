// Project review workflow (Epic E4). Pure status-transition state machine and
// progress mapping - no DB. The server enforces these transitions so a project
// can only move along legal edges, and the UI offers only the legal actions.

export type ProjectStatus = 'draft' | 'in_review' | 'approved' | 'archived';

export const PROJECT_STATUSES: ProjectStatus[] = ['draft', 'in_review', 'approved', 'archived'];

/** Legal transitions: draft submits to review; review approves or returns;
 *  approved archives or reopens; archived restores to draft. */
const TRANSITIONS: Record<ProjectStatus, ProjectStatus[]> = {
	draft: ['in_review', 'archived'],
	in_review: ['approved', 'draft'],
	approved: ['archived', 'in_review'],
	archived: ['draft']
};

/** Human label for the action that performs a given transition. */
export const TRANSITION_LABEL: Record<string, string> = {
	'draft->in_review': 'Submit for review',
	'draft->archived': 'Archive',
	'in_review->approved': 'Approve',
	'in_review->draft': 'Return to draft',
	'approved->archived': 'Archive',
	'approved->in_review': 'Reopen review',
	'archived->draft': 'Restore'
};

export function canTransition(from: ProjectStatus, to: ProjectStatus): boolean {
	return TRANSITIONS[from]?.includes(to) ?? false;
}

/** The legal next states from a given status, as {to,label} actions. */
export function availableTransitions(from: ProjectStatus): Array<{ to: ProjectStatus; label: string }> {
	return (TRANSITIONS[from] ?? []).map((to) => ({
		to,
		label: TRANSITION_LABEL[`${from}->${to}`] ?? `Move to ${to}`
	}));
}

/** Canonical progress percentage for a status (used when a stage completes;
 *  manual progress can still override within a stage). */
export function progressForStatus(status: ProjectStatus): number {
	switch (status) {
		case 'draft':
			return 10;
		case 'in_review':
			return 60;
		case 'approved':
			return 100;
		case 'archived':
			return 100;
	}
}

export function isValidStatus(s: unknown): s is ProjectStatus {
	return typeof s === 'string' && (PROJECT_STATUSES as string[]).includes(s);
}

// --- Project membership roles (E4) ---

export type MemberRole = 'reviewer' | 'viewer';
export const MEMBER_ROLES: MemberRole[] = ['reviewer', 'viewer'];

export function isValidMemberRole(r: unknown): r is MemberRole {
	return typeof r === 'string' && (MEMBER_ROLES as string[]).includes(r);
}
