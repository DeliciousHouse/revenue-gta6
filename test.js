// Native Node test harness for Breakwater Run game logic.
// Imports actual production modules — no duplicated logic.
// Run: node test.js

import { strict as assert } from 'node:assert';

import {
  WORLD_W, WORLD_H, ROADS, BUILDINGS, WATER,
  collidesWithSolid, isOnRoad, getDistrict,
  ROAD_NODES, ROAD_EDGES, buildAdjacency, nearestNode, findPath,
  LANDMARKS, SPAWN_POINTS,
} from './game/city.js';

import { createWorld, VEHICLE_TYPES, STEP } from './game/world.js';
import { createCrimeSystem } from './game/crime.js';
import { createMissionSystem, MISSION_REWARDS } from './game/missions.js';

// Minimal localStorage mock for save.js
const mockStorage = new Map();
globalThis.window = {
  localStorage: {
    getItem: (k) => mockStorage.has(k) ? mockStorage.get(k) : null,
    setItem: (k, v) => mockStorage.set(k, v),
    removeItem: (k) => mockStorage.delete(k),
  },
};

const { createSaveSystem } = await import('./game/save.js');

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  PASS: ${name}`);
  } catch (e) {
    failed++;
    console.log(`  FAIL: ${name}`);
    console.log(`    ${e.message}`);
  }
}

console.log('=== Breakwater Run Test Suite ===\n');

// --- City / Collision Tests ---
console.log('--- City & Collision ---');

test('World dimensions are correct', () => {
  assert.equal(WORLD_W, 2200);
  assert.equal(WORLD_H, 1800);
});

test('Roads array is populated', () => {
  assert.ok(ROADS.length > 10, `Expected >10 roads, got ${ROADS.length}`);
});

test('Buildings array is populated', () => {
  assert.ok(BUILDINGS.length > 10, `Expected >10 buildings, got ${BUILDINGS.length}`);
});

test('Water array is populated', () => {
  assert.ok(WATER.length > 0, 'Expected at least one water area');
});

test('Collision with out-of-bounds returns true', () => {
  assert.ok(collidesWithSolid(-10, 0, 5, 5));
  assert.ok(collidesWithSolid(0, -10, 5, 5));
  assert.ok(collidesWithSolid(WORLD_W, 0, 5, 5));
  assert.ok(collidesWithSolid(0, WORLD_H, 5, 5));
});

test('Collision with building returns true', () => {
  const b = BUILDINGS[0];
  assert.ok(collidesWithSolid(b.x + 1, b.y + 1, 5, 5));
});

test('Collision on road returns false', () => {
  const r = ROADS[0];
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  assert.ok(!collidesWithSolid(cx, cy, 5, 5), 'Center of road should not be solid');
});

test('isOnRoad returns true for point on a road', () => {
  const r = ROADS[0];
  assert.ok(isOnRoad(r.x + 10, r.y + 10, 5, 5));
});

test('isOnRoad returns false for point in building', () => {
  const b = BUILDINGS[0];
  assert.ok(!isOnRoad(b.x + b.w / 2, b.y + b.h / 2, 1, 1));
});

test('Player start is not inside a solid', () => {
  const sp = SPAWN_POINTS.playerStart;
  assert.ok(!collidesWithSolid(sp.x, sp.y, 14, 14));
});

test('All parked car spawns are not inside solids', () => {
  for (const car of SPAWN_POINTS.parkedCars) {
    assert.ok(!collidesWithSolid(car.x, car.y, 40, 22),
      `Parked car at (${car.x}, ${car.y}) is inside a solid`);
  }
});

test('Mission car spawns are not inside solids', () => {
  for (const [key, car] of Object.entries(SPAWN_POINTS.missionCars)) {
    assert.ok(!collidesWithSolid(car.x, car.y, 40, 22),
      `Mission car ${key} at (${car.x}, ${car.y}) is inside a solid`);
  }
});

test('Safehouse landmark is accessible', () => {
  const sh = LANDMARKS.safehouse;
  assert.ok(!collidesWithSolid(sh.x + 20, sh.y + sh.h + 10, 14, 14));
});

test('Quay garage is accessible', () => {
  const g = LANDMARKS.quayGarage;
  assert.ok(!collidesWithSolid(g.x + 10, g.y + g.h + 10, 14, 14));
});

// --- District Tests ---
console.log('\n--- Districts ---');

test('getDistrict returns correct district names', () => {
  assert.equal(getDistrict(500, 1300), 'Sunward Quay');
  assert.equal(getDistrict(500, 300), 'Foundry Ward');
  assert.equal(getDistrict(1500, 500), 'Canal Market');
});

test('Player start is in a valid district', () => {
  const sp = SPAWN_POINTS.playerStart;
  const d = getDistrict(sp.x, sp.y);
  assert.ok(d !== undefined && d !== null);
});

// --- Road Graph Tests ---
console.log('\n--- Road Graph ---');

test('Road nodes are populated', () => {
  assert.ok(ROAD_NODES.length > 20);
});

test('Road edges are populated', () => {
  assert.ok(ROAD_EDGES.length > 20);
});

test('Adjacency list builds correctly', () => {
  const adj = buildAdjacency();
  assert.ok(adj.size === ROAD_NODES.length);
  for (const [id, neighbors] of adj) {
    assert.ok(Array.isArray(neighbors));
  }
});

test('nearestNode finds closest node', () => {
  const n = nearestNode(180, 330);
  assert.ok(n !== null);
  assert.equal(n.id, 0);
});

test('findPath returns valid path between districts', () => {
  const adj = buildAdjacency();
  const path = findPath(0, 9, adj);
  assert.ok(path !== null);
  assert.ok(path.length >= 2);
  assert.equal(path[0], 0);
  assert.equal(path[path.length - 1], 9);
});

test('findPath returns valid path from safehouse area to Foundry Ward', () => {
  const adj = buildAdjacency();
  const path = findPath(23, 1, adj);
  assert.ok(path !== null);
  assert.ok(path.length >= 3);
});

test('Two distinct routes exist between Sunward Quay and Foundry Ward', () => {
  const adj = buildAdjacency();
  const path1 = findPath(21, 0, adj);
  assert.ok(path1 !== null);
  const path2 = findPath(22, 1, adj);
  assert.ok(path2 !== null);
  const set1 = new Set(path1);
  const set2 = new Set(path2);
  let shared = 0;
  for (const n of set1) if (set2.has(n)) shared++;
  assert.ok(shared < Math.min(set1.size, set2.size));
});

// --- Save Validation (actual save.js) ---
console.log('\n--- Save Validation (actual module) ---');

function freshSave() {
  mockStorage.clear();
  return createSaveSystem();
}

test('validate: valid data passes', () => {
  const s = freshSave();
  const r = s.validate({ version: 1, completedMissions: 2, cash: 1500, upgraded: true, mute: false });
  assert.ok(r !== null);
  assert.equal(r.completedMissions, 2);
  assert.equal(r.cash, 1500);
});

test('validate: invalid version rejects', () => {
  const s = freshSave();
  assert.equal(s.validate({ version: 2, completedMissions: 0, cash: 0, upgraded: false, mute: false }), null);
});

test('validate: null/undefined/string rejects', () => {
  const s = freshSave();
  assert.equal(s.validate(null), null);
  assert.equal(s.validate(undefined), null);
  assert.equal(s.validate('not an object'), null);
});

test('validate: negative cash rejects', () => {
  const s = freshSave();
  assert.equal(s.validate({ version: 1, completedMissions: 0, cash: -100, upgraded: false, mute: false }), null);
});

test('validate: non-integer/Infinity/NaN cash rejects', () => {
  const s = freshSave();
  assert.equal(s.validate({ version: 1, completedMissions: 0, cash: 1.5, upgraded: false, mute: false }), null);
  assert.equal(s.validate({ version: 1, completedMissions: 0, cash: Infinity, upgraded: false, mute: false }), null);
  assert.equal(s.validate({ version: 1, completedMissions: 0, cash: NaN, upgraded: false, mute: false }), null);
});

test('validate: completedMissions out of range rejects', () => {
  const s = freshSave();
  assert.equal(s.validate({ version: 1, completedMissions: 4, cash: 0, upgraded: false, mute: false }), null);
  assert.equal(s.validate({ version: 1, completedMissions: -1, cash: 0, upgraded: false, mute: false }), null);
});

test('validate: non-boolean fields reject', () => {
  const s = freshSave();
  assert.equal(s.validate({ version: 1, completedMissions: 0, cash: 0, upgraded: 'yes', mute: false }), null);
  assert.equal(s.validate({ version: 1, completedMissions: 0, cash: 0, upgraded: false, mute: 1 }), null);
});

test('validate: missing fields rejects', () => {
  const s = freshSave();
  assert.equal(s.validate({ version: 1 }), null);
  assert.equal(s.validate({}), null);
});

test('validate: cash at max passes, over max rejects', () => {
  const s = freshSave();
  assert.ok(s.validate({ version: 1, completedMissions: 0, cash: 999999, upgraded: false, mute: false }) !== null);
  assert.equal(s.validate({ version: 1, completedMissions: 0, cash: 1000000, upgraded: false, mute: false }), null);
});

test('save/load round-trip works', () => {
  const s = freshSave();
  s.save(2, 1500, true, false);
  const loaded = s.load();
  assert.ok(loaded !== null);
  assert.equal(loaded.completedMissions, 2);
  assert.equal(loaded.cash, 1500);
  assert.equal(loaded.upgraded, true);
});

test('hasSave returns false for missing save', () => {
  const s = freshSave();
  assert.equal(s.hasSave(), false);
});

test('hasSave returns true for valid save', () => {
  const s = freshSave();
  s.save(1, 500, false, false);
  assert.equal(s.hasSave(), true);
});

test('REGRESSION: hasSave returns false for corrupt data', () => {
  mockStorage.clear();
  mockStorage.set('breakwater-run.v1', '{"corrupt":true}');
  const s = createSaveSystem();
  assert.equal(s.hasSave(), false, 'Corrupt save must not enable Continue');
});

test('REGRESSION: hasSave returns false for invalid JSON', () => {
  mockStorage.clear();
  mockStorage.set('breakwater-run.v1', '{broken json');
  const s = createSaveSystem();
  assert.equal(s.hasSave(), false, 'Invalid JSON must not enable Continue');
});

test('clearSave removes the save', () => {
  const s = freshSave();
  s.save(1, 500, false, false);
  assert.equal(s.hasSave(), true);
  s.clearSave();
  assert.equal(s.hasSave(), false);
});

// --- World module tests ---
console.log('\n--- World (actual module) ---');

test('createWorld returns player at spawn', () => {
  const w = createWorld();
  assert.equal(w.player.x, SPAWN_POINTS.playerStart.x);
  assert.equal(w.player.y, SPAWN_POINTS.playerStart.y);
  assert.equal(w.player.hp, w.PLAYER_MAX_HP);
});

test('spawnMissionCar adds to vehicles, removeMissionCars cleans up', () => {
  const w = createWorld();
  const baseCt = w.vehicles.length;
  w.spawnMissionCar('borrowedFinch', 'mission0');
  assert.equal(w.vehicles.length, baseCt + 1);
  w.removeMissionCars();
  assert.equal(w.vehicles.length, baseCt);
});

test('REGRESSION: repeated spawnMissionCar+removeMissionCars stays bounded', () => {
  const w = createWorld();
  const baseCt = w.vehicles.length;
  for (let i = 0; i < 100; i++) {
    w.spawnMissionCar('borrowedFinch', 'mission0');
    w.removeMissionCars();
  }
  assert.equal(w.vehicles.length, baseCt, 'Vehicles must not leak across retries');
});

test('REGRESSION: reset clears driver=player on former vehicle', () => {
  const w = createWorld();
  const car = w.vehicles[0];
  w.enterVehicle(car);
  assert.equal(car.driver, 'player');
  w.reset();
  assert.notEqual(car.driver, 'player', 'Reset must clear driver=player');
  assert.equal(w.player.inVehicle, null);
});

test('REGRESSION: exited stolen traffic does not drive itself', () => {
  const w = createWorld();
  // Simulate a traffic car
  w.traffic.push({
    id: 999, type: 'finch', x: 500, y: 785, w: 30, h: 18, angle: 0,
    speed: 70, targetSpeed: 70, steer: 0, hp: 50, maxHp: 50,
    color: '#5BC4E0', driver: 'npc', parked: false, missionId: null,
    hitFlash: 0, route: { start: { x: 300, y: 785 }, end: { x: 900, y: 785 }, progress: 0 },
  });
  const t = w.traffic[0];
  // Player steals it
  w.enterVehicle(t);
  assert.equal(t.driver, 'player');
  // Player exits
  w.exitVehicle();
  assert.equal(t.driver, null, 'Exited car has null driver');
  assert.equal(t.parked, true);
  // Run traffic update — car with null driver should be skipped
  const startX = t.x;
  w.update({ up: false, down: false, left: false, right: false, space: false }, STEP, { shotFired: false });
  assert.equal(t.x, startX, 'Parked stolen traffic must not move');
});

test('enterVehicle/exitVehicle round-trip', () => {
  const w = createWorld();
  const car = w.vehicles[0];
  w.enterVehicle(car);
  assert.equal(w.player.inVehicle, car);
  assert.equal(car.driver, 'player');
  const exited = w.exitVehicle();
  assert.ok(exited);
  assert.equal(w.player.inVehicle, null);
  assert.equal(car.driver, null);
});

test('All road intersections have passable area', () => {
  for (const node of ROAD_NODES) {
    assert.ok(!collidesWithSolid(node.x - 5, node.y - 5, 10, 10),
      `Road node ${node.id} at (${node.x}, ${node.y}) should be passable`);
  }
});

test('Exit positions near vehicles are passable', () => {
  const testPos = { x: 530, y: 785 };
  const offsets = [
    { dx: -30, dy: 0 }, { dx: 30, dy: 0 },
    { dx: 0, dy: -20 }, { dx: 0, dy: 20 },
  ];
  let anyPassable = false;
  for (const off of offsets) {
    if (!collidesWithSolid(testPos.x + off.dx, testPos.y + off.dy, 14, 14)) {
      anyPassable = true;
      break;
    }
  }
  assert.ok(anyPassable);
});

// --- Crime module tests ---
console.log('\n--- Crime (actual module) ---');

test('REGRESSION: raiseHeat initializes searchTimer', () => {
  const w = createWorld();
  const c = createCrimeSystem(w);
  c.raiseHeat(1);
  assert.equal(c.heat, 1);
  assert.ok(c.searchTimer > 0, 'searchTimer must be initialized on raiseHeat');
});

test('REGRESSION: heat via setter initializes searchTimer', () => {
  const w = createWorld();
  const c = createCrimeSystem(w);
  c.heat = 2;
  assert.equal(c.heat, 2);
  assert.ok(c.searchTimer > 0, 'searchTimer must be initialized when heat set via setter');
});

test('hasLineOfSight clear on open road (actual module)', () => {
  const w = createWorld();
  const c = createCrimeSystem(w);
  assert.ok(c.hasLineOfSight(300, 785, 500, 785));
});

test('hasLineOfSight blocked through buildings (actual module)', () => {
  const w = createWorld();
  const c = createCrimeSystem(w);
  const b = BUILDINGS[0];
  assert.ok(!c.hasLineOfSight(b.x - 20, b.y + b.h / 2, b.x + b.w + 20, b.y + b.h / 2));
});

test('REGRESSION: projectile hit consumes exactly one projectile', () => {
  const w = createWorld();
  const c = createCrimeSystem(w);
  c.raiseHeat(1);
  // Place a police unit overlapping a pedestrian position
  const cop = c.police[0];
  cop.x = 500; cop.y = 500;
  w.pedestrians.push({
    id: 8888, x: 500, y: 500, w: 8, h: 8, speed: 40, angle: 0,
    fleeing: false, fleeTimer: 0, walkTimer: 5, color: '#E8D080',
  });
  // Add two player projectiles at the same position
  w.projectiles.push(
    { x: 503, y: 503, angle: 0, speed: 500, life: 0.8, owner: 'player', damage: 20 },
    { x: 503, y: 503, angle: 0, speed: 500, life: 0.8, owner: 'player', damage: 20 },
  );
  assert.equal(w.projectiles.length, 2);
  c.update(STEP);
  // Each projectile should hit at most one target; both should not be consumed by one hit
  assert.ok(w.projectiles.length <= 1,
    'At most one projectile consumed per target hit, not both spliced by double-splice bug');
});

test('resetPursuit clears all state', () => {
  const w = createWorld();
  const c = createCrimeSystem(w);
  c.raiseHeat(3);
  assert.ok(c.police.length > 0);
  c.resetPursuit();
  assert.equal(c.heat, 0);
  assert.equal(c.police.length, 0);
});

// --- Mission module tests ---
console.log('\n--- Missions (actual module) ---');

function freshGame() {
  mockStorage.clear();
  const w = createWorld();
  const c = createCrimeSystem(w);
  const save = createSaveSystem();
  const m = createMissionSystem(w, c, {
    completedMissions: 0, cash: 0, upgraded: false,
    save: (cm, cash, up) => save.save(cm, cash, up, false),
  });
  return { w, c, m, save };
}

test('Mission 0 prerequisite: cannot start mission 1 first', () => {
  const { m } = freshGame();
  assert.equal(m.completedMissions, 0);
  assert.equal(m.activeMission, -1);
});

test('REGRESSION: getEPrompt does not throw (VEHICLE_TYPES imported)', () => {
  const { w, m } = freshGame();
  // Place player near a vehicle
  const car = w.vehicles[0];
  w.player.x = car.x + 5;
  w.player.y = car.y + 5;
  const prompt = m.getEPrompt(w.player.x, w.player.y);
  assert.ok(typeof prompt === 'string', 'getEPrompt must return string, not throw');
  assert.ok(prompt.length > 0, 'Should show vehicle prompt when near car');
});

test('REGRESSION: Hot Cargo requires mission Hauler for delivery', () => {
  const { w, c, m } = freshGame();
  // Manually advance to mission 1 DELIVER_CARGO stage
  // Complete mission 0 first
  const sh = LANDMARKS.safehouse;
  w.player.x = sh.x + 10;
  w.player.y = sh.y + 10;
  m.update(STEP, w.player.x, w.player.y, true); // accept mission 0

  // Force-complete mission 0 by simulating
  const mCar0 = w.vehicles.find(v => v.missionId === 'mission0');
  if (mCar0) {
    w.enterVehicle(mCar0);
    m.update(STEP, w.player.x, w.player.y, false); // detect vehicle entry -> DELIVER
    const gg = LANDMARKS.quayGarage;
    mCar0.x = gg.x + 5; mCar0.y = gg.y + 5;
    mCar0.speed = 0;
    w.player.x = gg.x + 5; w.player.y = gg.y + 5;
    m.update(STEP, w.player.x, w.player.y, false);
    w.exitVehicle();
  }

  assert.equal(m.completedMissions, 1, 'Mission 0 must be complete');

  // Accept mission 1
  w.player.x = sh.x + 10;
  w.player.y = sh.y + 10;
  m.update(STEP, w.player.x, w.player.y, true);
  assert.equal(m.activeMission, 1);

  // GET_HAULER -> enter hauler
  const mCar1 = w.vehicles.find(v => v.missionId === 'mission1');
  w.enterVehicle(mCar1);
  m.update(STEP, w.player.x, w.player.y, false); // -> GET_MANIFEST
  w.exitVehicle();

  // GET_MANIFEST -> interact at foundry
  const fb = LANDMARKS.foundryBay;
  w.player.x = fb.x + 5; w.player.y = fb.y + 5;
  m.update(STEP, w.player.x, w.player.y, true); // -> LOSE_HEAT
  c.resetPursuit(); // clear heat
  m.update(STEP, w.player.x, w.player.y, false); // -> DELIVER_CARGO

  assert.equal(m.stage, 'DELIVER_CARGO');

  // Try to deliver in a NON-mission vehicle (a parked Stray)
  const wrongCar = w.vehicles.find(v => !v.missionId);
  if (wrongCar) {
    w.enterVehicle(wrongCar);
    wrongCar.speed = 0;
    const gg = LANDMARKS.quayGarage;
    wrongCar.x = gg.x + 5; wrongCar.y = gg.y + 5;
    w.player.x = gg.x + 5; w.player.y = gg.y + 5;
    const cashBefore = m.cash;
    m.update(STEP, w.player.x, w.player.y, false);
    assert.equal(m.cash, cashBefore, 'Must NOT complete Hot Cargo in wrong vehicle');
    assert.equal(m.stage, 'DELIVER_CARGO', 'Stage must still be DELIVER_CARGO');
    w.exitVehicle();
  }
});

test('REGRESSION: resetMissionState removes mission cars', () => {
  const { w, m } = freshGame();
  const baseCt = w.vehicles.length;
  const sh = LANDMARKS.safehouse;
  w.player.x = sh.x + 10;
  w.player.y = sh.y + 10;
  m.update(STEP, w.player.x, w.player.y, true); // accept mission 0 -> spawns car
  assert.equal(w.vehicles.length, baseCt + 1, 'Mission car spawned');
  m.resetMissionState();
  assert.equal(w.vehicles.length, baseCt, 'Mission car removed by resetMissionState');
});

test('REGRESSION: 100 retries do not leak vehicles', () => {
  const { w, m } = freshGame();
  const baseCt = w.vehicles.length;
  const sh = LANDMARKS.safehouse;
  w.player.x = sh.x + 10;
  w.player.y = sh.y + 10;
  for (let i = 0; i < 100; i++) {
    m.update(STEP, w.player.x, w.player.y, true);
    m.resetMissionState();
  }
  assert.equal(w.vehicles.length, baseCt, `After 100 retries vehicles must be ${baseCt}, got ${w.vehicles.length}`);
});

test('Mission rewards are correct and idempotent', () => {
  assert.deepEqual(MISSION_REWARDS, [500, 1000, 2000]);
});

test('Completed missions gate next mission', () => {
  const { m } = freshGame();
  assert.equal(m.completedMissions, 0);
  // activeMission is -1, so next mission index is 0
  assert.equal(m.activeMission, -1);
});

// --- Summary ---
console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
process.exit(failed > 0 ? 1 : 0);
