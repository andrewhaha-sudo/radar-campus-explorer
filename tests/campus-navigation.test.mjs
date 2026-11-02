import test from "node:test";
import assert from "node:assert/strict";
import {
  advanceToward,
  findPath,
  canTravel,
  isWalkable,
  subtractObstacles,
} from "../src/components/map/navigation.ts";
import {
  scenes,
  places,
  allRooms,
  entranceForScene,
} from "../src/components/map/campus-data.ts";

test("every mapped campus entrance is reachable without crossing a blocked area", () => {
  const { spawn, walkable } = scenes.campus;
  for (const place of places.filter((place) => place.arrival)) {
    const route = findPath(spawn, place.arrival, walkable);
    assert.ok(route, `${place.name} must be reachable`);
    assert.deepEqual(route.at(-1), place.arrival);
    for (let i = 1; i < route.length; i++)
      assert.ok(canTravel(route[i - 1], route[i], walkable));
  }
});

test("all 35 room doors and every floor's stairs have connected approaches", () => {
  assert.deepEqual(
    ["a1", "b1", "b2", "c1", "c2", "lab1", "d1", "e1", "e2", "six1", "six2"].map(
      (id) => scenes[id].rooms.length,
    ),
    [2, 2, 2, 5, 5, 1, 2, 3, 3, 5, 5],
  );
  for (const scene of Object.values(scenes).filter(
    (scene) => scene.rooms.length,
  )) {
    for (const target of [
      ...scene.rooms.map((room) => room.point),
      ...(scene.stairs ? [scene.stairs.point] : []),
    ]) {
      const route = findPath(scene.spawn, target, scene.walkable);
      assert.ok(route, `${scene.name} has a disconnected destination`);
      for (let i = 1; i < route.length; i++)
        assert.ok(canTravel(route[i - 1], route[i], scene.walkable));
    }
    if (scene.stairs) {
      const other = scenes[scene.stairs.to];
      assert.equal(
        scenes[other.stairs.to],
        scene,
        "stairs must connect back to the originating floor",
      );
    }
  }
});

test("pond, trees, buildings, fence and decorative regions are non-walkable", () => {
  for (const point of [
    { x: 212, y: 620 },
    { x: 700, y: 950 },
    { x: 604, y: 350 },
    { x: 800, y: 759 },
    { x: 620, y: 80 },
    { x: 600, y: 1150 },
  ]) {
    assert.equal(isWalkable(point, scenes.campus.walkable), false);
    assert.equal(
      findPath(scenes.campus.spawn, point, scenes.campus.walkable),
      null,
    );
  }
});

test("movement cannot tunnel through a wall even during a long step", () => {
  const areas = [
    { x: 0, y: 0, width: 20, height: 20 },
    { x: 24, y: 0, width: 20, height: 20 },
  ];
  assert.equal(canTravel({ x: 10, y: 10 }, { x: 34, y: 10 }, areas), false);
  assert.equal(findPath({ x: 10, y: 10 }, { x: 34, y: 10 }, areas), null);
});

test("A* follows an L-shaped hallway without cutting its corner", () => {
  const areas = [
    { x: 0, y: 0, width: 100, height: 20 },
    { x: 80, y: 0, width: 20, height: 100 },
  ];
  const from = { x: 10, y: 10 },
    to = { x: 90, y: 90 };
  assert.equal(canTravel(from, to, areas), false);
  const route = findPath(from, to, areas);
  assert.ok(route);
  for (let i = 1; i < route.length; i++)
    assert.ok(canTravel(route[i - 1], route[i], areas));
});

test("interiors have unique photo IDs and return to their matching outdoor entrances", () => {
  assert.equal(allRooms.length, 35);
  assert.equal(new Set(allRooms.map((room) => room.id)).size, allRooms.length);
  for (const [sceneId, buildingId] of [
    ["c1", "c"],
    ["lab1", "lab"],
    ["d1", "d"],
    ["e1", "e"],
  ]) {
    const building = entranceForScene(sceneId);
    assert.equal(building.id, buildingId);
    assert.equal(building.interior, sceneId);
    assert.ok(
      findPath(scenes.campus.spawn, building.arrival, scenes.campus.walkable),
    );
    for (const room of scenes[sceneId].rooms) {
      assert.ok(
        findPath(room.point, scenes[sceneId].exit, scenes[sceneId].walkable),
      );
    }
  }
  const pondSide = places.find((place) => place.id === "e");
  assert.equal(pondSide.name, "Building E");
  assert.ok(pondSide.bounds.x < 400);
  assert.equal(pondSide.interior, "e1");
  for (const buildingId of ["c", "e"]) {
    assert.equal(entranceForScene(`${buildingId}2`).id, buildingId);
    assert.equal(scenes[`${buildingId}2`].stairs.to, `${buildingId}1`);
  }
  assert.equal(entranceForScene("six1"), undefined);
});

test("grass, pond bank, court and garden clearings connect through the campus gates", () => {
  const { spawn, walkable } = scenes.campus;
  for (const target of [
    { x: 720, y: 490 }, { x: 470, y: 610 }, { x: 1100, y: 660 },
    { x: 247, y: 714 }, { x: 547, y: 1057 }, { x: 215, y: 1035 },
    { x: 624, y: 660 }, { x: 862, y: 736 },
  ]) {
    const route = findPath(spawn, target, walkable);
    assert.ok(route, `Open ground at ${JSON.stringify(target)} must be reachable`);
    assert.deepEqual(route.at(-1), target);
    for (let index = 1; index < route.length; index++)
      assert.ok(canTravel(route[index - 1], route[index], walkable));
  }
});

test("gps follow catches up in a straight line and stops at a wall", () => {
  const open = [{ x: 0, y: 0, width: 200, height: 40 }];
  const arrived = advanceToward({ x: 10, y: 20 }, { x: 150, y: 20 }, open, 1);
  assert.ok(Math.abs(arrived.x - 150) < 1);
  assert.ok(Math.abs(arrived.y - 20) < 1);
  const blocked = subtractObstacles(open, [{ x: 80, y: 0, width: 20, height: 40 }]);
  const stopped = advanceToward({ x: 10, y: 20 }, { x: 150, y: 20 }, blocked, 1);
  assert.ok(stopped.x < 80);
  assert.ok(stopped.x > 10);
  assert.equal(canTravel({ x: 10, y: 20 }, stopped, blocked), true);
});

test("carving an obstacle leaves connected ground without allowing travel through it", () => {
  const areas = subtractObstacles(
    [{ x: 0, y: 0, width: 100, height: 100 }],
    [{ x: 35, y: 20, width: 30, height: 60 }],
  );
  const from = { x: 10, y: 50 }, to = { x: 90, y: 50 };
  assert.equal(isWalkable({ x: 50, y: 50 }, areas), false);
  assert.equal(canTravel(from, to, areas), false);
  const route = findPath(from, to, areas);
  assert.ok(route);
  for (let index = 1; index < route.length; index++)
    assert.ok(canTravel(route[index - 1], route[index], areas));
});
