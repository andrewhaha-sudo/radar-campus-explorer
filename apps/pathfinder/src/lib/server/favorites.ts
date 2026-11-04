// Building favorites DAL (Epic E3, AC-3.5.1). Per-user starred buildings,
// persisted across sessions.

type Env = { DB: D1Database };

export async function isFavorite(env: Env, userId: string, buildingId: string): Promise<boolean> {
	const row = await env.DB.prepare('SELECT 1 AS x FROM favorites WHERE user_id = ? AND building_id = ?')
		.bind(userId, buildingId)
		.first();
	return !!row;
}

export async function setFavorite(env: Env, userId: string, buildingId: string, on: boolean): Promise<void> {
	if (on) {
		await env.DB.prepare('INSERT OR IGNORE INTO favorites (user_id, building_id) VALUES (?, ?)')
			.bind(userId, buildingId)
			.run();
	} else {
		await env.DB.prepare('DELETE FROM favorites WHERE user_id = ? AND building_id = ?')
			.bind(userId, buildingId)
			.run();
	}
}

export async function listFavorites(
	env: Env,
	userId: string
): Promise<Array<{ id: string; name: string }>> {
	const { results } = await env.DB.prepare(
		`SELECT b.id, b.name FROM favorites f JOIN buildings b ON b.id = f.building_id
		  WHERE f.user_id = ? ORDER BY f.created_at DESC`
	)
		.bind(userId)
		.all<{ id: string; name: string }>();
	return results ?? [];
}
