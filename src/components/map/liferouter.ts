import { canTravel, type Point, type Rect } from "./navigation";

/** Only illustration coordinates belong in this API. Never pass GPS fixes. */
export async function requestLifeRoute(
  scene: string, start: Point, goal: Point, areas: Rect[], signal: AbortSignal,
): Promise<Point[]> {
  const response = await fetch("/api/liferouter/route", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ start: { scene, x: start.x, y: start.y }, goal: { scene, x: goal.x, y: goal.y } }),
    signal: AbortSignal.any([signal, AbortSignal.timeout(12_000)]),
  });
  if (!response.ok) {
    if (response.status === 429) throw new Error("LifeRouter is busy. Please try again.");
    if (response.status === 400 || response.status === 422)
      throw new Error("LifeRouter could not route to that spot. Choose another open area.");
    throw new Error("LifeRouter is unavailable. Start the routing service or select Local routing.");
  }
  const result: unknown = await response.json();
  if (!result || typeof result !== "object" || !("engine" in result) || result.engine !== "LifeRouter" ||
      !("simulation" in result) || result.simulation !== true ||
      !("points" in result) || !Array.isArray(result.points) || !result.points.length || result.points.length > 20_000)
    throw new Error("Invalid LifeRouter response.");
  const points: Point[] = [{ x: start.x, y: start.y }];
  for (const p of result.points) {
    if (!p || p.scene !== scene || !Number.isFinite(p.x) || !Number.isFinite(p.y) ||
        !canTravel(points[points.length - 1], p, areas))
      throw new Error("LifeRouter returned an incompatible route. Use the stairs or select another destination.");
    points.push({ x: p.x, y: p.y });
  }
  const last = points[points.length - 1];
  if (Math.hypot(last.x - goal.x, last.y - goal.y) > 4 || !canTravel(last, goal, areas))
    throw new Error("LifeRouter did not reach the destination.");
  points.push({ x: goal.x, y: goal.y });
  // Keep every turn, but remove collinear grid samples so animation speed does
  // not depend on the engine's four-pixel cell resolution.
  const turns: Point[] = [];
  for (const point of points) {
    const a = turns.at(-2), b = turns.at(-1);
    if (a && b) {
      const ux = b.x - a.x, uy = b.y - a.y;
      const vx = point.x - b.x, vy = point.y - b.y;
      if (Math.abs(ux * vy - uy * vx) < 1e-6 && ux * vx + uy * vy >= 0)
        turns.pop();
    }
    turns.push(point);
  }
  return turns;
}
