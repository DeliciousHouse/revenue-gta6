// World simulation: player, vehicles, traffic, pedestrians, collision.
// No rendering or browser APIs; pure state updates.

import {
  WORLD_W, WORLD_H, ROADS, BUILDINGS, WATER, SIDEWALKS,
  SPAWN_POINTS, ROAD_NODES, buildAdjacency, nearestNode, findPath,
  collidesWithSolid, isOnRoad, getDistrict,
} from './city.js';

export const STEP = 1 / 60;
export const MAX_FRAME = 0.25;
export const MAX_STEPS = 6;

// Vehicle class definitions
export const VEHICLE_TYPES = {
  finch:  { name: 'Finch',  w: 30, h: 18, accel: 180, topSpeed: 280, grip: 0.85, brakeForce: 300, color: '#5BC4E0', label: 'Compact' },
  hauler: { name: 'Hauler', w: 40, h: 22, accel: 100, topSpeed: 220, grip: 0.70, brakeForce: 250, color: '#E0A05B', label: 'Van' },
  stray:  { name: 'Stray',  w: 34, h: 18, accel: 220, topSpeed: 350, grip: 0.78, brakeForce: 350, color: '#D45B7A', label: 'Coupe' },
};

const PLAYER_SPEED = 120;
const PLAYER_W = 14;
const PLAYER_H = 14;
const ENTER_RANGE = 50;
const STEAL_MAX_SPEED = 60;
const DAMAGE_INVULN = 0.5;
const PLAYER_MAX_HP = 100;
const VEHICLE_MAX_HP = 150;
const MAX_TRAFFIC = 16;
const MAX_PEDESTRIANS = 24;
const TRAFFIC_SPAWN_DIST = 800;
const TRAFFIC_DESPAWN_DIST = 1200;
const PED_SPEED = 40;
const PED_FLEE_SPEED = 100;
const PED_FLEE_RANGE = 200;
const PED_FLEE_TIME = 6;

let nextId = 1;
function genId() { return nextId++; }

export function createWorld() {
  const adj = buildAdjacency();

  const player = {
    x: SPAWN_POINTS.playerStart.x,
    y: SPAWN_POINTS.playerStart.y,
    w: PLAYER_W, h: PLAYER_H,
    angle: 0,
    hp: PLAYER_MAX_HP,
    maxHp: PLAYER_MAX_HP,
    invulnTimer: 0,
    inVehicle: null,
    hitFlash: 0,
  };

  const vehicles = [];
  const traffic = [];
  const pedestrians = [];
  const projectiles = [];
  const effects = [];
  let exitBlocked = false;

  // Spawn parked cars
  for (const sp of SPAWN_POINTS.parkedCars) {
    const vt = VEHICLE_TYPES[sp.type];
    vehicles.push({
      id: genId(), type: sp.type, x: sp.x, y: sp.y,
      w: vt.w, h: vt.h, angle: 0,
      speed: 0, steer: 0,
      hp: VEHICLE_MAX_HP, maxHp: VEHICLE_MAX_HP,
      color: vt.color, driver: null,
      parked: true, missionId: null,
      hitFlash: 0,
    });
  }

  function spawnMissionCar(key, missionId) {
    const sp = SPAWN_POINTS.missionCars[key];
    if (!sp) return null;
    const vt = VEHICLE_TYPES[sp.type];
    const car = {
      id: genId(), type: sp.type, x: sp.x, y: sp.y,
      w: vt.w, h: vt.h, angle: 0,
      speed: 0, steer: 0,
      hp: VEHICLE_MAX_HP, maxHp: VEHICLE_MAX_HP,
      color: vt.color, driver: null,
      parked: true, missionId,
      hitFlash: 0,
    };
    vehicles.push(car);
    return car;
  }

  // Collision: slide along solids
  function tryMove(entity, dx, dy) {
    const nx = entity.x + dx;
    const ny = entity.y + dy;
    if (!collidesWithSolid(nx, ny, entity.w, entity.h)) {
      entity.x = nx;
      entity.y = ny;
      return true;
    }
    if (!collidesWithSolid(nx, entity.y, entity.w, entity.h)) {
      entity.x = nx;
      return true;
    }
    if (!collidesWithSolid(entity.x, ny, entity.w, entity.h)) {
      entity.y = ny;
      return true;
    }
    return false;
  }

  function rectsOverlap(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function dist(a, b) {
    const dx = (a.x + (a.w || 0) / 2) - (b.x + (b.w || 0) / 2);
    const dy = (a.y + (a.h || 0) / 2) - (b.y + (b.h || 0) / 2);
    return Math.sqrt(dx * dx + dy * dy);
  }

  // Player on-foot movement
  function movePlayerOnFoot(input, dt) {
    let dx = 0, dy = 0;
    if (input.up) dy -= PLAYER_SPEED * dt;
    if (input.down) dy += PLAYER_SPEED * dt;
    if (input.left) dx -= PLAYER_SPEED * dt;
    if (input.right) dx += PLAYER_SPEED * dt;
    if (dx !== 0 && dy !== 0) {
      const f = 0.7071;
      dx *= f; dy *= f;
    }
    if (dx !== 0 || dy !== 0) {
      player.angle = Math.atan2(dy, dx);
      tryMove(player, dx, dy);
    }
  }

  // Vehicle physics
  function updateVehicle(car, accelInput, steerInput, brakeInput, handbrake, dt) {
    const vt = VEHICLE_TYPES[car.type];
    const maxSteer = 2.5;
    const speedFactor = 1 - Math.min(Math.abs(car.speed) / vt.topSpeed, 0.8) * 0.7;

    if (accelInput > 0) {
      car.speed += vt.accel * dt * accelInput;
    } else if (accelInput < 0) {
      if (car.speed > 10) {
        car.speed -= vt.brakeForce * dt;
        if (car.speed < 0) car.speed = 0;
      } else {
        car.speed -= vt.accel * 0.5 * dt;
      }
    }

    // Drag
    car.speed *= (1 - 0.3 * dt);

    // Top speed clamp
    car.speed = Math.max(-vt.topSpeed * 0.3, Math.min(vt.topSpeed, car.speed));

    // Handbrake: strong lateral friction loss
    if (handbrake && Math.abs(car.speed) > 20) {
      car.speed *= (1 - 1.5 * dt);
    }

    // Braking deceleration
    if (brakeInput && car.speed > 0) {
      car.speed -= vt.brakeForce * dt;
      if (car.speed < 0) car.speed = 0;
    }

    // Steering (speed-sensitive)
    if (Math.abs(car.speed) > 5) {
      const turnRate = maxSteer * speedFactor * steerInput * dt;
      car.angle += turnRate * (car.speed > 0 ? 1 : -1);
    }

    // Movement with substeps to prevent tunneling
    const absSpeed = Math.abs(car.speed);
    const moveX = Math.cos(car.angle) * car.speed * dt;
    const moveY = Math.sin(car.angle) * car.speed * dt;
    const steps = Math.max(1, Math.min(4, Math.ceil(absSpeed * dt / 10)));
    const sx = moveX / steps;
    const sy = moveY / steps;

    for (let i = 0; i < steps; i++) {
      if (!tryMove(car, sx, sy)) {
        car.speed *= -0.3;
        break;
      }
    }
  }

  // Find nearest enterable vehicle
  function nearestVehicle() {
    let best = null;
    let bestDist = ENTER_RANGE;
    for (const v of vehicles) {
      const d = dist(player, v);
      if (d < bestDist) {
        if (v.driver && v.driver !== 'player') {
          if (Math.abs(v.speed) > STEAL_MAX_SPEED) continue;
        }
        bestDist = d;
        best = v;
      }
    }
    for (const v of traffic) {
      const d = dist(player, v);
      if (d < bestDist) {
        if (Math.abs(v.speed) > STEAL_MAX_SPEED) continue;
        bestDist = d;
        best = v;
      }
    }
    return best;
  }

  function enterVehicle(car) {
    const hadDriver = car.driver && car.driver !== 'player';
    car.driver = 'player';
    car.parked = false;
    player.inVehicle = car;
    return hadDriver;
  }

  function exitVehicle() {
    const car = player.inVehicle;
    if (!car) return false;

    // Try 4 directions for safe exit
    const offsets = [
      { dx: -(car.w / 2 + PLAYER_W + 4), dy: 0 },
      { dx: car.w / 2 + 4, dy: 0 },
      { dx: 0, dy: -(car.h / 2 + PLAYER_H + 4) },
      { dx: 0, dy: car.h / 2 + 4 },
    ];
    const cx = car.x + car.w / 2;
    const cy = car.y + car.h / 2;

    for (const off of offsets) {
      const tx = cx + off.dx - PLAYER_W / 2;
      const ty = cy + off.dy - PLAYER_H / 2;
      if (!collidesWithSolid(tx, ty, PLAYER_W, PLAYER_H)) {
        player.x = tx;
        player.y = ty;
        player.inVehicle = null;
        car.driver = null;
        car.parked = true;
        exitBlocked = false;
        return true;
      }
    }
    exitBlocked = true;
    return false;
  }

  // Traffic AI
  function spawnTraffic(camX, camY) {
    if (traffic.length >= MAX_TRAFFIC) return;
    const routes = SPAWN_POINTS.trafficRoutes;
    const ri = Math.floor(Math.random() * routes.length);
    const route = routes[ri];
    const start = route[0];
    const end = route[1];

    // Don't spawn near player
    const dx = start.x - camX;
    const dy = start.y - camY;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d < 300) return;

    // Don't spawn on top of existing cars
    const types = ['finch', 'hauler', 'stray'];
    const type = types[Math.floor(Math.random() * types.length)];
    const vt = VEHICLE_TYPES[type];

    for (const t of traffic) {
      if (Math.abs(t.x - start.x) < 60 && Math.abs(t.y - start.y) < 60) return;
    }

    const angle = Math.atan2(end.y - start.y, end.x - start.x);
    traffic.push({
      id: genId(), type, x: start.x, y: start.y,
      w: vt.w, h: vt.h, angle,
      speed: 60 + Math.random() * 40,
      targetSpeed: 60 + Math.random() * 40,
      steer: 0,
      hp: 50, maxHp: 50,
      color: vt.color, driver: 'npc',
      parked: false, missionId: null,
      hitFlash: 0,
      route: { start, end, progress: 0 },
    });
  }

  function updateTraffic(dt, camX, camY) {
    for (let i = traffic.length - 1; i >= 0; i--) {
      const t = traffic[i];
      if (t.driver === 'player') continue;

      // Move toward route end
      const target = t.route.end;
      const dx = target.x - t.x;
      const dy = target.y - t.y;
      const d = Math.sqrt(dx * dx + dy * dy);

      if (d < 30) {
        // Despawn when reaching route end if far from camera
        const dCam = Math.sqrt((t.x - camX) ** 2 + (t.y - camY) ** 2);
        if (dCam > TRAFFIC_DESPAWN_DIST) {
          traffic.splice(i, 1);
          continue;
        }
        // Otherwise loop back
        const tmp = t.route.start;
        t.route.start = t.route.end;
        t.route.end = tmp;
        continue;
      }

      t.angle = Math.atan2(dy, dx);

      // Slow for obstacles ahead
      let slowdown = 1;
      const lookX = t.x + Math.cos(t.angle) * 60;
      const lookY = t.y + Math.sin(t.angle) * 60;
      for (const other of traffic) {
        if (other === t) continue;
        if (Math.abs(other.x - lookX) < 40 && Math.abs(other.y - lookY) < 40) {
          slowdown = 0.3;
          break;
        }
      }
      // Slow for player car ahead
      if (player.inVehicle) {
        const pCar = player.inVehicle;
        if (Math.abs(pCar.x - lookX) < 50 && Math.abs(pCar.y - lookY) < 50) {
          slowdown = 0.2;
        }
      }

      t.speed += (t.targetSpeed * slowdown - t.speed) * 2 * dt;
      t.speed = Math.max(0, Math.min(t.targetSpeed, t.speed));

      const mx = Math.cos(t.angle) * t.speed * dt;
      const my = Math.sin(t.angle) * t.speed * dt;
      tryMove(t, mx, my);
    }

    // Spawn new traffic periodically
    if (Math.random() < 0.02) spawnTraffic(camX, camY);
  }

  // Pedestrians
  function spawnPedestrian(camX, camY) {
    if (pedestrians.length >= MAX_PEDESTRIANS) return;
    const zones = SPAWN_POINTS.pedestrianZones;
    const zone = zones[Math.floor(Math.random() * zones.length)];
    const px = zone.x + Math.random() * zone.w;
    const py = zone.y;

    const dx = px - camX;
    const dy = py - camY;
    if (Math.sqrt(dx * dx + dy * dy) < 200) return;

    pedestrians.push({
      id: genId(), x: px, y: py, w: 8, h: 8,
      speed: PED_SPEED, angle: Math.random() * Math.PI * 2,
      fleeing: false, fleeTimer: 0,
      walkTimer: 2 + Math.random() * 4,
      color: ['#E8D080', '#D09060', '#80A0C0', '#A0D080'][Math.floor(Math.random() * 4)],
    });
  }

  function updatePedestrians(dt, camX, camY, violenceX, violenceY) {
    for (let i = pedestrians.length - 1; i >= 0; i--) {
      const p = pedestrians[i];
      const dCam = Math.sqrt((p.x - camX) ** 2 + (p.y - camY) ** 2);
      if (dCam > TRAFFIC_DESPAWN_DIST) {
        pedestrians.splice(i, 1);
        continue;
      }

      // Flee from violence
      if (violenceX !== null) {
        const dv = Math.sqrt((p.x - violenceX) ** 2 + (p.y - violenceY) ** 2);
        if (dv < PED_FLEE_RANGE) {
          p.fleeing = true;
          p.fleeTimer = PED_FLEE_TIME;
          p.angle = Math.atan2(p.y - violenceY, p.x - violenceX);
        }
      }

      if (p.fleeing) {
        p.fleeTimer -= dt;
        if (p.fleeTimer <= 0) p.fleeing = false;
        const sp = PED_FLEE_SPEED;
        tryMove(p, Math.cos(p.angle) * sp * dt, Math.sin(p.angle) * sp * dt);
      } else {
        p.walkTimer -= dt;
        if (p.walkTimer <= 0) {
          p.angle = Math.random() * Math.PI * 2;
          p.walkTimer = 2 + Math.random() * 4;
        }
        tryMove(p, Math.cos(p.angle) * p.speed * dt, Math.sin(p.angle) * p.speed * dt);
      }
    }

    if (Math.random() < 0.03) spawnPedestrian(camX, camY);
  }

  // Damage
  function damagePlayer(amount) {
    if (player.invulnTimer > 0) return false;
    player.hp -= amount;
    player.invulnTimer = DAMAGE_INVULN;
    player.hitFlash = 0.15;
    if (player.hp <= 0) player.hp = 0;
    return true;
  }

  function damageVehicle(car, amount) {
    car.hp -= amount;
    car.hitFlash = 0.15;
    if (car.hp <= 0) car.hp = 0;
  }

  // Vehicle-to-vehicle collision
  function checkVehicleCollisions(dt) {
    const all = [...vehicles, ...traffic];
    for (let i = 0; i < all.length; i++) {
      for (let j = i + 1; j < all.length; j++) {
        const a = all[i];
        const b = all[j];
        if (rectsOverlap(a, b)) {
          const relSpeed = Math.abs(a.speed - b.speed);
          if (relSpeed > 30) {
            if (a.driver === 'player') {
              damagePlayer(relSpeed * 0.1);
              damageVehicle(a, relSpeed * 0.2);
            }
            if (b.driver === 'player') {
              damagePlayer(relSpeed * 0.1);
              damageVehicle(b, relSpeed * 0.2);
            }
          }
          // Push apart
          const cx = (a.x + a.w / 2) - (b.x + b.w / 2);
          const cy = (a.y + a.h / 2) - (b.y + b.h / 2);
          const len = Math.sqrt(cx * cx + cy * cy) || 1;
          const push = 2;
          tryMove(a, cx / len * push, cy / len * push);
          tryMove(b, -cx / len * push, -cy / len * push);
          a.speed *= 0.5;
          b.speed *= 0.5;
        }
      }
    }

    // Player on foot hit by car
    if (!player.inVehicle) {
      for (const car of [...vehicles, ...traffic]) {
        if (Math.abs(car.speed) < 20) continue;
        if (rectsOverlap(player, car)) {
          damagePlayer(Math.abs(car.speed) * 0.15);
        }
      }
    }
  }

  function update(input, dt, events) {
    // Update timers
    if (player.invulnTimer > 0) player.invulnTimer -= dt;
    if (player.hitFlash > 0) player.hitFlash -= dt;
    for (const v of vehicles) if (v.hitFlash > 0) v.hitFlash -= dt;
    for (const t of traffic) if (t.hitFlash > 0) t.hitFlash -= dt;

    // Player movement
    if (player.inVehicle) {
      const car = player.inVehicle;
      let accel = 0;
      if (input.up) accel = 1;
      else if (input.down) accel = -1;
      let steer = 0;
      if (input.left) steer = -1;
      else if (input.right) steer = 1;
      updateVehicle(car, accel, steer, input.down && car.speed > 10, input.space, dt);
      player.x = car.x + car.w / 2 - player.w / 2;
      player.y = car.y + car.h / 2 - player.h / 2;
      player.angle = car.angle;
    } else {
      movePlayerOnFoot(input, dt);
    }

    // Camera position (centered on player)
    const camX = player.x + player.w / 2;
    const camY = player.y + player.h / 2;

    // Violence position for pedestrian fleeing
    let violenceX = null, violenceY = null;
    if (events.shotFired) {
      violenceX = player.x;
      violenceY = player.y;
    }

    updateTraffic(dt, camX, camY);
    updatePedestrians(dt, camX, camY, violenceX, violenceY);
    checkVehicleCollisions(dt);

    // Update projectiles
    for (let i = projectiles.length - 1; i >= 0; i--) {
      const p = projectiles[i];
      p.life -= dt;
      if (p.life <= 0) { projectiles.splice(i, 1); continue; }
      p.x += Math.cos(p.angle) * p.speed * dt;
      p.y += Math.sin(p.angle) * p.speed * dt;

      // Hit solids
      if (collidesWithSolid(p.x - 2, p.y - 2, 4, 4)) {
        effects.push({ x: p.x, y: p.y, timer: 0.3, type: 'spark' });
        projectiles.splice(i, 1);
        continue;
      }
    }

    // Decay effects
    for (let i = effects.length - 1; i >= 0; i--) {
      effects[i].timer -= dt;
      if (effects[i].timer <= 0) effects.splice(i, 1);
    }

    return { camX, camY };
  }

  function reset(keepProgress) {
    player.x = SPAWN_POINTS.playerStart.x;
    player.y = SPAWN_POINTS.playerStart.y;
    player.hp = PLAYER_MAX_HP;
    player.invulnTimer = 0;
    player.hitFlash = 0;
    player.inVehicle = null;
    exitBlocked = false;
    projectiles.length = 0;
    effects.length = 0;
    // Don't remove parked/mission vehicles, just reset traffic
    traffic.length = 0;
    pedestrians.length = 0;
  }

  return {
    player, vehicles, traffic, pedestrians, projectiles, effects,
    get exitBlocked() { return exitBlocked; },
    adj,
    nearestVehicle, enterVehicle, exitVehicle,
    tryMove, rectsOverlap, dist, damagePlayer, damageVehicle,
    update, reset, spawnMissionCar,
    PLAYER_MAX_HP, VEHICLE_MAX_HP,
  };
}
