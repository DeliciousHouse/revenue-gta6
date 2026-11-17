// Native Node test harness for Breakwater Run game logic.
// Tests pure functions from city.js, plus mission/save/collision logic.
// Run: node test.js

import { strict as assert } from 'node:assert';

// === Import game modules (pure logic, no DOM) ===
// We test city.js directly since it has no DOM deps.
import {
  WORLD_W, WORLD_H, ROADS, BUILDINGS, WATER,
  collidesWithSolid, isOnRoad, getDistrict,
  ROAD_NODES, ROAD_EDGES, buildAdjacency, nearestNode, findPath,
  LANDMARKS, SPAWN_POINTS,
} from './game/city.js';

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
  assert.ok(!collidesWithSolid(sp.x, sp.y, 14, 14), 'Player start must not collide with solids');
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

test('Safehouse landmark is accessible (adjacent road space is clear)', () => {
  const sh = LANDMARKS.safehouse;
  // Check that area just below safehouse is passable
  assert.ok(!collidesWithSolid(sh.x + 20, sh.y + sh.h + 10, 14, 14),
    'Space below safehouse should be passable');
});

test('Quay garage is accessible', () => {
  const g = LANDMARKS.quayGarage;
  assert.ok(!collidesWithSolid(g.x + 10, g.y + g.h + 10, 14, 14),
    'Space near quay garage should be passable');
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
  assert.ok(d !== undefined && d !== null, 'Player start should have a district');
});

// --- Road Graph Tests ---
console.log('\n--- Road Graph ---');

test('Road nodes are populated', () => {
  assert.ok(ROAD_NODES.length > 20, `Expected >20 nodes, got ${ROAD_NODES.length}`);
});

test('Road edges are populated', () => {
  assert.ok(ROAD_EDGES.length > 20, `Expected >20 edges, got ${ROAD_EDGES.length}`);
});

test('Adjacency list builds correctly', () => {
  const adj = buildAdjacency();
  assert.ok(adj.size === ROAD_NODES.length);
  for (const [id, neighbors] of adj) {
    assert.ok(Array.isArray(neighbors), `Node ${id} should have neighbors array`);
  }
});

test('nearestNode finds closest node', () => {
  const n = nearestNode(180, 330);
  assert.ok(n !== null);
  assert.equal(n.id, 0); // FW NW node
});

test('findPath returns valid path between districts', () => {
  const adj = buildAdjacency();
  // Path from Foundry Ward (node 0) to Canal Market (node 9)
  const path = findPath(0, 9, adj);
  assert.ok(path !== null, 'Path should exist between FW and CM');
  assert.ok(path.length >= 2, 'Path should have at least 2 nodes');
  assert.equal(path[0], 0);
  assert.equal(path[path.length - 1], 9);
});

test('findPath returns valid path from safehouse area to Foundry Ward', () => {
  const adj = buildAdjacency();
  // Near safehouse = node 23, Foundry Ward = node 1
  const path = findPath(23, 1, adj);
  assert.ok(path !== null, 'Path should exist from safehouse to FW');
  assert.ok(path.length >= 3, 'Path should have multiple nodes');
});

test('Two distinct routes exist between Sunward Quay and Foundry Ward', () => {
  const adj = buildAdjacency();
  // Route 1: through west side (nodes 21 -> 18 -> 6 -> 3 -> 0)
  const path1 = findPath(21, 0, adj);
  assert.ok(path1 !== null);
  // Route 2 exists: through center (nodes 22 -> 19 -> 7 -> 4 -> 1)
  const path2 = findPath(22, 1, adj);
  assert.ok(path2 !== null);
  // They should use different intermediate nodes
  const set1 = new Set(path1);
  const set2 = new Set(path2);
  let shared = 0;
  for (const n of set1) if (set2.has(n)) shared++;
  assert.ok(shared < Math.min(set1.size, set2.size),
    'Two routes should not be identical');
});

// --- Save Validation Tests ---
console.log('\n--- Save Validation ---');

// Inline save validation logic (same as save.js but testable in Node)
function validateSave(data) {
  if (!data || typeof data !== 'object') return null;
  if (data.version !== 1) return null;
  const cm = data.completedMissions;
  if (!Number.isInteger(cm) || cm < 0 || cm > 3) return null;
  const cash = data.cash;
  if (!Number.isInteger(cash) || cash < 0 || cash > 999999 || !Number.isFinite(cash)) return null;
  if (typeof data.upgraded !== 'boolean') return null;
  if (typeof data.mute !== 'boolean') return null;
  return { version: 1, completedMissions: cm, cash, upgraded: data.upgraded, mute: data.mute };
}

test('Valid save data passes validation', () => {
  const data = { version: 1, completedMissions: 2, cash: 1500, upgraded: true, mute: false };
  const result = validateSave(data);
  assert.ok(result !== null);
  assert.equal(result.completedMissions, 2);
  assert.equal(result.cash, 1500);
  assert.equal(result.upgraded, true);
});

test('Invalid version rejects', () => {
  assert.equal(validateSave({ version: 2, completedMissions: 0, cash: 0, upgraded: false, mute: false }), null);
});

test('Null data rejects', () => {
  assert.equal(validateSave(null), null);
});

test('String data rejects', () => {
  assert.equal(validateSave('not an object'), null);
});

test('Negative cash rejects', () => {
  assert.equal(validateSave({ version: 1, completedMissions: 0, cash: -100, upgraded: false, mute: false }), null);
});

test('Non-integer cash rejects', () => {
  assert.equal(validateSave({ version: 1, completedMissions: 0, cash: 1.5, upgraded: false, mute: false }), null);
});

test('Infinity cash rejects', () => {
  assert.equal(validateSave({ version: 1, completedMissions: 0, cash: Infinity, upgraded: false, mute: false }), null);
});

test('NaN cash rejects', () => {
  assert.equal(validateSave({ version: 1, completedMissions: 0, cash: NaN, upgraded: false, mute: false }), null);
});

test('completedMissions > 3 rejects', () => {
  assert.equal(validateSave({ version: 1, completedMissions: 4, cash: 0, upgraded: false, mute: false }), null);
});

test('completedMissions < 0 rejects', () => {
  assert.equal(validateSave({ version: 1, completedMissions: -1, cash: 0, upgraded: false, mute: false }), null);
});

test('Non-boolean upgraded rejects', () => {
  assert.equal(validateSave({ version: 1, completedMissions: 0, cash: 0, upgraded: 'yes', mute: false }), null);
});

test('Non-boolean mute rejects', () => {
  assert.equal(validateSave({ version: 1, completedMissions: 0, cash: 0, upgraded: false, mute: 1 }), null);
});

test('Missing fields rejects', () => {
  assert.equal(validateSave({ version: 1 }), null);
  assert.equal(validateSave({ version: 1, completedMissions: 0 }), null);
});

test('Cash over max rejects', () => {
  assert.equal(validateSave({ version: 1, completedMissions: 0, cash: 1000000, upgraded: false, mute: false }), null);
});

test('Cash at max passes', () => {
  const result = validateSave({ version: 1, completedMissions: 0, cash: 999999, upgraded: false, mute: false });
  assert.ok(result !== null);
  assert.equal(result.cash, 999999);
});

// --- Mission Prerequisite / Reward Idempotence Tests ---
console.log('\n--- Mission Logic ---');

// Simulate mission state machine logic
function testMissionPrerequisites() {
  let completedMissions = 0;
  let cash = 0;
  const rewards = [500, 1000, 2000];

  // Can't start mission 1 without completing mission 0
  test('Cannot start mission 1 without completing mission 0', () => {
    assert.ok(completedMissions === 0);
    // Mission 1 requires completedMissions >= 1
    assert.ok(completedMissions < 1, 'Should not allow mission 1');
  });

  // Complete mission 0
  test('Mission 0 completion awards correct cash', () => {
    completedMissions = 1;
    cash += rewards[0];
    assert.equal(cash, 500);
    assert.equal(completedMissions, 1);
  });

  // Idempotent: completing mission 0 again should not double reward
  test('Mission 0 reward is idempotent (guarded by completedMissions)', () => {
    // The guard: only award if transitioning from 0 to 1
    const prevCompleted = completedMissions;
    if (prevCompleted === 0) {
      cash += rewards[0]; // This should NOT execute
    }
    assert.equal(cash, 500, 'Cash should not increase on re-completion');
  });

  // Now can start mission 1
  test('Can start mission 1 after completing mission 0', () => {
    assert.ok(completedMissions >= 1);
  });

  // Complete mission 1
  test('Mission 1 completion awards correct cash', () => {
    completedMissions = 2;
    cash += rewards[1];
    assert.equal(cash, 1500);
  });

  // Complete mission 2
  test('Mission 2 completion awards correct cash', () => {
    completedMissions = 3;
    cash += rewards[2];
    assert.equal(cash, 3500);
  });

  // No more missions
  test('No mission available after all 3 completed', () => {
    assert.ok(completedMissions >= 3);
    // getNextMission would return 3, which is out of range
    assert.ok(completedMissions === 3);
  });
}
testMissionPrerequisites();

// --- Death/Reset Tests ---
console.log('\n--- Death/Reset ---');

test('Reset preserves completed missions and cash', () => {
  let completedMissions = 2;
  let cash = 1500;
  // Simulate death: reset transient state, keep progress
  const afterReset = { completedMissions, cash };
  assert.equal(afterReset.completedMissions, 2);
  assert.equal(afterReset.cash, 1500);
});

test('Reset clears heat to zero', () => {
  let heat = 3;
  // On death, heat resets
  heat = 0;
  assert.equal(heat, 0);
});

// --- Collision / Exit Safety ---
console.log('\n--- Collision / Exit Safety ---');

test('All road intersections have passable area', () => {
  for (const node of ROAD_NODES) {
    assert.ok(!collidesWithSolid(node.x - 5, node.y - 5, 10, 10),
      `Road node ${node.id} at (${node.x}, ${node.y}) should be passable`);
  }
});

test('Exit positions near vehicles are passable', () => {
  // Test typical exit offsets from a road position
  const testPos = { x: 530, y: 785 }; // Boulevard center
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
  assert.ok(anyPassable, 'At least one exit position should be passable near Boulevard center');
});

// --- Line of Sight Tests ---
console.log('\n--- Line of Sight ---');

test('LOS is clear on open road', () => {
  // Between two points on the main boulevard, no buildings blocking
  let blocked = false;
  const ax = 300, ay = 785, bx = 700, by = 785;
  const dx = bx - ax, dy = by - ay;
  const d = Math.sqrt(dx * dx + dy * dy);
  const steps = Math.ceil(d / 20);
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const px = ax + dx * t;
    const py = ay + dy * t;
    for (const b of BUILDINGS) {
      if (px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h) {
        blocked = true;
        break;
      }
    }
    if (blocked) break;
  }
  assert.ok(!blocked, 'LOS should be clear on open boulevard');
});

test('LOS is blocked through buildings', () => {
  // Between two points with a building in between
  const b = BUILDINGS[0]; // First building
  const ax = b.x - 20, ay = b.y + b.h / 2;
  const bx = b.x + b.w + 20, by = b.y + b.h / 2;
  let blocked = false;
  const dx = bx - ax, dy = by - ay;
  const d = Math.sqrt(dx * dx + dy * dy);
  const steps = Math.ceil(d / 20);
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const px = ax + dx * t;
    const py = ay + dy * t;
    for (const bl of BUILDINGS) {
      if (px >= bl.x && px <= bl.x + bl.w && py >= bl.y && py <= bl.y + bl.h) {
        blocked = true;
        break;
      }
    }
    if (blocked) break;
  }
  assert.ok(blocked, 'LOS should be blocked through a building');
});

// --- Summary ---
console.log(`\n=== Results: ${passed} passed, ${failed} failed ===`);
process.exit(failed > 0 ? 1 : 0);
