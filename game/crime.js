// Heat, police AI (PATROL/CHASE/SEARCH), combat/projectiles.

import {
  ROAD_NODES, buildAdjacency, nearestNode, findPath,
  BUILDINGS, collidesWithSolid, SPAWN_POINTS,
} from './city.js';
import { VEHICLE_TYPES } from './world.js';

const MAX_HEAT = 3;
const HEAT_COOLDOWN = 2;
const SEARCH_TIME = 10;
const POLICE_SIGHT_RANGE = 400;
const POLICE_FIRE_RANGE = 300;
const POLICE_FIRE_COOLDOWN = 1.2;
const POLICE_DAMAGE = 8;
const PLAYER_FIRE_COOLDOWN = 0.25;
const PLAYER_DAMAGE = 20;
const PROJECTILE_SPEED = 500;
const PROJECTILE_LIFE = 0.8;
const MAX_PROJECTILES = 40;
const MAX_POLICE = 6;

export function createCrimeSystem(world) {
  const adj = buildAdjacency();

  let heat = 0;
  let heatCooldownTimer = 0;
  let searchTimer = 0;
  let spotted = false;
  const police = [];
  let lastSeenX = 0, lastSeenY = 0;
  let playerFireTimer = 0;

  function raiseHeat(amount) {
    if (heatCooldownTimer > 0) return;
    heat = Math.min(MAX_HEAT, heat + amount);
    heatCooldownTimer = HEAT_COOLDOWN;
    updatePoliceCount();
  }

  function decayHeat() {
    if (heat > 0) {
      heat--;
      if (heat === 0) {
        for (const p of police) p.state = 'PATROL';
      }
    }
  }

  function updatePoliceCount() {
    const target = heat === 0 ? 0 : Math.min(MAX_POLICE, heat * 2);
    while (police.length < target) {
      spawnPolice();
    }
  }

  function spawnPolice() {
    if (police.length >= MAX_POLICE) return;
    // Spawn at a road node far from player
    const px = world.player.x;
    const py = world.player.y;
    let bestNode = ROAD_NODES[0];
    let bestDist = 0;
    for (const n of ROAD_NODES) {
      const d = (n.x - px) ** 2 + (n.y - py) ** 2;
      if (d > bestDist && d > 300 * 300) {
        bestDist = d;
        bestNode = n;
      }
    }
    const vt = VEHICLE_TYPES.stray;
    police.push({
      id: Date.now() + police.length,
      x: bestNode.x, y: bestNode.y,
      w: vt.w + 4, h: vt.h + 2,
      angle: 0, speed: 0,
      state: heat > 0 ? 'CHASE' : 'PATROL',
      targetNode: null,
      path: null,
      pathIdx: 0,
      fireTimer: POLICE_FIRE_COOLDOWN,
      lightPhase: 0,
      lastSeenX: px, lastSeenY: py,
    });
  }

  // Line of sight check: raycast from police to player, blocked by buildings
  function hasLineOfSight(ax, ay, bx, by) {
    const dx = bx - ax;
    const dy = by - ay;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d > POLICE_SIGHT_RANGE) return false;
    const steps = Math.ceil(d / 20);
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const px = ax + dx * t;
      const py = ay + dy * t;
      for (const b of BUILDINGS) {
        if (px >= b.x && px <= b.x + b.w && py >= b.y && py <= b.y + b.h) return false;
      }
    }
    return true;
  }

  function updatePolice(dt) {
    const px = world.player.x + world.player.w / 2;
    const py = world.player.y + world.player.h / 2;

    spotted = false;
    let anyCanSee = false;

    for (const p of police) {
      p.lightPhase += dt * 6;
      p.fireTimer -= dt;

      const cx = p.x + p.w / 2;
      const cy = p.y + p.h / 2;
      const canSee = hasLineOfSight(cx, cy, px, py);

      if (canSee && heat > 0) {
        anyCanSee = true;
        spotted = true;
        p.lastSeenX = px;
        p.lastSeenY = py;
        lastSeenX = px;
        lastSeenY = py;
        if (p.state !== 'CHASE') p.state = 'CHASE';
        searchTimer = SEARCH_TIME;
      }

      switch (p.state) {
        case 'PATROL': {
          // Random patrol between road nodes
          if (!p.targetNode || dist(p, ROAD_NODES[p.targetNode]) < 40) {
            p.targetNode = Math.floor(Math.random() * ROAD_NODES.length);
          }
          const target = ROAD_NODES[p.targetNode];
          driveToward(p, target.x, target.y, 80, dt);
          break;
        }
        case 'CHASE': {
          // Drive toward player
          driveToward(p, px, py, 160, dt);
          // Fire at player when close
          if (canSee && dist(p, world.player) < POLICE_FIRE_RANGE && p.fireTimer <= 0) {
            firePoliceProjectile(p, px, py);
            p.fireTimer = POLICE_FIRE_COOLDOWN;
          }
          break;
        }
        case 'SEARCH': {
          driveToward(p, p.lastSeenX, p.lastSeenY, 60, dt);
          break;
        }
      }

      // Vehicle collision damage to player
      if (Math.abs(p.speed) > 40) {
        if (world.rectsOverlap(p, world.player.inVehicle || world.player)) {
          const dmg = Math.abs(p.speed) * 0.12;
          if (world.player.inVehicle) {
            world.damageVehicle(world.player.inVehicle, dmg);
          }
          world.damagePlayer(dmg);
          p.speed *= 0.3;
        }
      }
    }

    // Search/decay logic
    if (heat > 0 && !anyCanSee) {
      if (police.some(p => p.state === 'CHASE')) {
        for (const p of police) {
          if (p.state === 'CHASE') p.state = 'SEARCH';
        }
      }
      searchTimer -= dt;
      if (searchTimer <= 0) {
        decayHeat();
        searchTimer = SEARCH_TIME;
        if (heat > 0) {
          for (const p of police) p.state = 'SEARCH';
        }
      }
    }

    if (heatCooldownTimer > 0) heatCooldownTimer -= dt;
  }

  function dist(a, b) {
    const ax = a.x + (a.w || 0) / 2;
    const ay = a.y + (a.h || 0) / 2;
    const bx = b.x || 0;
    const by = b.y || 0;
    return Math.sqrt((ax - bx) ** 2 + (ay - by) ** 2);
  }

  function driveToward(p, tx, ty, maxSpeed, dt) {
    const dx = tx - (p.x + p.w / 2);
    const dy = ty - (p.y + p.h / 2);
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d < 5) { p.speed *= 0.9; return; }

    p.angle = Math.atan2(dy, dx);
    p.speed += (maxSpeed - p.speed) * 2 * dt;
    p.speed = Math.min(maxSpeed, Math.max(-20, p.speed));

    const mx = Math.cos(p.angle) * p.speed * dt;
    const my = Math.sin(p.angle) * p.speed * dt;

    const nx = p.x + mx;
    const ny = p.y + my;
    if (!collidesWithSolid(nx, ny, p.w, p.h)) {
      p.x = nx; p.y = ny;
    } else if (!collidesWithSolid(nx, p.y, p.w, p.h)) {
      p.x = nx;
    } else if (!collidesWithSolid(p.x, ny, p.w, p.h)) {
      p.y = ny;
    } else {
      p.speed = 0;
    }
  }

  function firePoliceProjectile(p, tx, ty) {
    if (world.projectiles.length >= MAX_PROJECTILES) return;
    const cx = p.x + p.w / 2;
    const cy = p.y + p.h / 2;
    const angle = Math.atan2(ty - cy, tx - cx);
    world.projectiles.push({
      x: cx, y: cy, angle, speed: PROJECTILE_SPEED * 0.7,
      life: PROJECTILE_LIFE, owner: 'police', damage: POLICE_DAMAGE,
    });
  }

  function playerFire(aimAngle, dt) {
    playerFireTimer -= dt;
    if (playerFireTimer > 0) return false;
    if (world.projectiles.length >= MAX_PROJECTILES) return false;
    if (world.player.inVehicle) return false;

    playerFireTimer = PLAYER_FIRE_COOLDOWN;
    const px = world.player.x + world.player.w / 2;
    const py = world.player.y + world.player.h / 2;
    world.projectiles.push({
      x: px, y: py, angle: aimAngle, speed: PROJECTILE_SPEED,
      life: PROJECTILE_LIFE, owner: 'player', damage: PLAYER_DAMAGE,
    });
    return true;
  }

  function checkProjectileHits() {
    const hits = [];
    for (let i = world.projectiles.length - 1; i >= 0; i--) {
      const proj = world.projectiles[i];
      const pr = { x: proj.x - 3, y: proj.y - 3, w: 6, h: 6 };

      if (proj.owner === 'player') {
        // Hit police
        for (const p of police) {
          if (world.rectsOverlap(pr, p)) {
            p.hp = (p.hp || 50) - proj.damage;
            p.hitFlash = 0.15;
            world.projectiles.splice(i, 1);
            hits.push({ type: 'police', target: p });
            if (p.hp <= 0) {
              const idx = police.indexOf(p);
              if (idx >= 0) police.splice(idx, 1);
            }
            break;
          }
        }
        // Hit pedestrians
        for (let j = world.pedestrians.length - 1; j >= 0; j--) {
          const ped = world.pedestrians[j];
          if (world.rectsOverlap(pr, ped)) {
            world.pedestrians.splice(j, 1);
            world.projectiles.splice(i, 1);
            hits.push({ type: 'pedestrian' });
            raiseHeat(2);
            break;
          }
        }
        // Hit traffic
        for (const t of world.traffic) {
          if (world.rectsOverlap(pr, t)) {
            t.hp -= proj.damage;
            t.hitFlash = 0.15;
            world.projectiles.splice(i, 1);
            hits.push({ type: 'traffic', target: t });
            break;
          }
        }
      } else {
        // Police projectile hits player
        if (world.player.inVehicle) {
          if (world.rectsOverlap(pr, world.player.inVehicle)) {
            world.damageVehicle(world.player.inVehicle, proj.damage);
            world.damagePlayer(proj.damage * 0.5);
            world.projectiles.splice(i, 1);
            hits.push({ type: 'playerHit' });
          }
        } else {
          if (world.rectsOverlap(pr, world.player)) {
            world.damagePlayer(proj.damage);
            world.projectiles.splice(i, 1);
            hits.push({ type: 'playerHit' });
          }
        }
      }
    }
    return hits;
  }

  function update(dt) {
    updatePolice(dt);
    const hits = checkProjectileHits();
    if (playerFireTimer > 0) playerFireTimer -= dt;
    return { hits, spotted, searchTimer: spotted ? 0 : Math.max(0, searchTimer) };
  }

  function resetPursuit() {
    heat = 0;
    heatCooldownTimer = 0;
    searchTimer = 0;
    spotted = false;
    police.length = 0;
    playerFireTimer = 0;
  }

  return {
    get heat() { return heat; },
    set heat(v) { heat = Math.max(0, Math.min(MAX_HEAT, v)); updatePoliceCount(); },
    get spotted() { return spotted; },
    get searchTimer() { return Math.max(0, searchTimer); },
    police,
    raiseHeat,
    playerFire,
    update,
    resetPursuit,
    hasLineOfSight,
  };
}
