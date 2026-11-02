export interface Point {
  x: number;
  y: number;
}
export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

// Subtract solid scenery from open grounds to keep one collision mask for both
// click-to-walk routes and keyboard movement. Adjacent pieces remain connected.
export function subtractObstacles(grounds: Rect[], obstacles: Rect[]): Rect[] {
  return obstacles.reduce((areas, obstacle) => areas.flatMap((area) => {
    const left = Math.max(area.x, obstacle.x);
    const top = Math.max(area.y, obstacle.y);
    const right = Math.min(area.x + area.width, obstacle.x + obstacle.width);
    const bottom = Math.min(area.y + area.height, obstacle.y + obstacle.height);
    if (left >= right || top >= bottom) return [area];
    return [
      { x: area.x, y: area.y, width: area.width, height: top - area.y },
      { x: area.x, y: bottom, width: area.width, height: area.y + area.height - bottom },
      { x: area.x, y: top, width: left - area.x, height: bottom - top },
      { x: right, y: top, width: area.x + area.width - right, height: bottom - top },
    ].filter((piece) => piece.width > 0 && piece.height > 0);
  }), grounds);
}

// A positive walkability mask keeps fences, water and buildings solid.
// Coordinates are always source-image pixels, independent of display size or zoom.
export function isWalkable(point: Point, areas: Rect[], radius = 3) {
  return [
    [0, 0],
    [-radius, 0],
    [radius, 0],
    [0, -radius],
    [0, radius],
  ].every(([dx, dy]) =>
    areas.some(
      (r) =>
        point.x + dx >= r.x &&
        point.x + dx <= r.x + r.width &&
        point.y + dy >= r.y &&
        point.y + dy <= r.y + r.height,
    ),
  );
}

export function canTravel(from: Point, to: Point, areas: Rect[]) {
  const steps = Math.max(
    1,
    Math.ceil(Math.hypot(to.x - from.x, to.y - from.y) / 2),
  );
  for (let i = 0; i <= steps; i++) {
    if (
      !isWalkable(
        {
          x: from.x + ((to.x - from.x) * i) / steps,
          y: from.y + ((to.y - from.y) * i) / steps,
        },
        areas,
      )
    )
      return false;
  }
  return true;
}

interface PathNode { point: Point; cost: number; remaining: number }
const priority = (a: PathNode, b: PathNode) =>
  a.cost + a.remaining - b.cost - b.remaining || a.remaining - b.remaining;

// A heap avoids scanning the entire frontier for every step across the open lawns.
class PathQueue {
  private nodes: PathNode[] = [];
  get length() { return this.nodes.length; }
  push(node: PathNode) {
    this.nodes.push(node);
    let index = this.nodes.length - 1;
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (priority(this.nodes[parent], node) <= 0) break;
      this.nodes[index] = this.nodes[parent];
      index = parent;
    }
    this.nodes[index] = node;
  }
  pop() {
    const first = this.nodes[0];
    const last = this.nodes.pop()!;
    if (this.nodes.length) {
      let index = 0;
      while (index * 2 + 1 < this.nodes.length) {
        let child = index * 2 + 1;
        if (child + 1 < this.nodes.length && priority(this.nodes[child + 1], this.nodes[child]) < 0) child++;
        if (priority(last, this.nodes[child]) <= 0) break;
        this.nodes[index] = this.nodes[child];
        index = child;
      }
      this.nodes[index] = last;
    }
    return first;
  }
}

/** Straight clear routes, or four-way A* without cutting blocked corners. */
export function findPath(
  from: Point,
  to: Point,
  areas: Rect[],
): Point[] | null {
  const size = 4;
  const snap = (point: Point): Point | null => {
    const x = Math.round(point.x / size) * size;
    const y = Math.round(point.y / size) * size;
    const candidates: Point[] = [];
    for (let dy = -8; dy <= 8; dy += size)
      for (let dx = -8; dx <= 8; dx += size) {
        const p = { x: x + dx, y: y + dy };
        if (isWalkable(p, areas) && canTravel(point, p, areas))
          candidates.push(p);
      }
    return (
      candidates.sort(
        (a, b) =>
          Math.hypot(a.x - point.x, a.y - point.y) -
          Math.hypot(b.x - point.x, b.y - point.y),
      )[0] ?? null
    );
  };
  if (!isWalkable(from, areas) || !isWalkable(to, areas)) return null;
  if (canTravel(from, to, areas)) return [from, to];
  const start = snap(from),
    goal = snap(to);
  if (!start || !goal) return null;
  const key = (p: Point) => `${p.x},${p.y}`;
  const heuristic = (p: Point) =>
    Math.abs(p.x - goal.x) + Math.abs(p.y - goal.y);
  const open = new PathQueue();
  open.push({ point: start, cost: 0, remaining: heuristic(start) });
  const cost = new Map([[key(start), 0]]);
  const parent = new Map<string, Point>();
  const closed = new Set<string>();
  while (open.length) {
    const node = open.pop();
    const current = node.point;
    const currentKey = key(current);
    if (closed.has(currentKey) || node.cost !== cost.get(currentKey)) continue;
    if (currentKey === key(goal)) {
      const points = [to, goal];
      let cursor = current;
      while (parent.has(key(cursor))) {
        cursor = parent.get(key(cursor))!;
        points.push(cursor);
      }
      points.push(from);
      return shortenPath(
        points.reverse().filter(
          (p, i, all) =>
            i === 0 ||
            i === all.length - 1 ||
            !(
              (all[i - 1].x === p.x && p.x === all[i + 1].x) ||
              (all[i - 1].y === p.y && p.y === all[i + 1].y)
            ),
        ),
        areas,
      );
    }
    closed.add(currentKey);
    for (const [dx, dy] of [
      [size, 0],
      [-size, 0],
      [0, size],
      [0, -size],
    ]) {
      const next = { x: current.x + dx, y: current.y + dy },
        nextKey = key(next);
      if (closed.has(nextKey) || !canTravel(current, next, areas)) continue;
      const nextCost = cost.get(currentKey)! + size;
      if (nextCost >= (cost.get(nextKey) ?? Infinity)) continue;
      open.push({ point: next, cost: nextCost, remaining: heuristic(next) });
      cost.set(nextKey, nextCost);
      parent.set(nextKey, current);
    }
  }
  return null;
}

function shortenPath(points: Point[], areas: Rect[]) {
  if (points.length < 3) return points;
  const kept = [points[0]];
  let anchor = 0;
  for (let index = 2; index < points.length; index += 1) {
    if (!canTravel(points[anchor], points[index], areas)) {
      kept.push(points[index - 1]);
      anchor = index - 1;
    }
  }
  kept.push(points[points.length - 1]);
  return kept;
}

// Glide toward an accepted GPS point. Fast enough to cross the illustration,
// slow enough that the character does not teleport.
export const GPS_GLIDE_PX_PER_SEC = 640;

export function gpsGlideStride(length: number, dt: number) {
  return Math.min(length, GPS_GLIDE_PX_PER_SEC * dt);
}

export function advanceToward(
  from: Point,
  to: Point,
  areas: Rect[],
  dt: number,
) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  if (length < 2) return { x: to.x, y: to.y };
  const stride = gpsGlideStride(length, dt);
  const at = (t: number): Point => ({
    x: from.x + dx * t,
    y: from.y + dy * t,
  });
  let lo = 0;
  let hi = stride / length;
  if (canTravel(from, at(hi), areas)) return at(hi);
  for (let i = 0; i < 8; i++) {
    const mid = (lo + hi) / 2;
    if (mid > 0 && canTravel(from, at(mid), areas)) lo = mid;
    else hi = mid;
  }
  return lo < 0.001 ? { x: from.x, y: from.y } : at(lo);
}
