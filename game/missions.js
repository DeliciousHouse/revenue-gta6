// Three mission state machines with prerequisites, rewards, dialogue.
// Stage transitions guarded by explicit checks. Rewards fire once.

import { LANDMARKS, SPAWN_POINTS } from './city.js';

export const MISSION_NAMES = [
  'Borrowed Wheels',
  'Hot Cargo',
  'Last Crossing',
];

export const MISSION_REWARDS = [500, 1000, 2000];

export function createMissionSystem(world, crime, save) {
  let completedMissions = save.completedMissions || 0;
  let cash = save.cash || 0;
  let upgraded = save.upgraded || false;

  let activeMission = -1;
  let stage = 'IDLE';
  let missionCar = null;
  let objective = '';
  let radioMessage = '';
  let radioTimer = 0;
  let guardSpawned = false;
  let guardDefeated = false;
  let casePickedUp = false;
  let rewardGiven = false;

  const UPGRADE_COST = 800;

  function getNextMission() {
    return completedMissions;
  }

  function canAcceptMission() {
    return activeMission === -1 && completedMissions < 3;
  }

  function isNearSafehouse(px, py) {
    const sh = LANDMARKS.safehouse;
    return px > sh.x - 60 && px < sh.x + sh.w + 60 &&
           py > sh.y - 60 && py < sh.y + sh.h + 60;
  }

  function isNearQuayGarage(px, py) {
    const g = LANDMARKS.quayGarage;
    return px > g.x - 30 && px < g.x + g.w + 30 &&
           py > g.y - 30 && py < g.y + g.h + 30;
  }

  function isNearFoundryBay(px, py) {
    const b = LANDMARKS.foundryBay;
    return px > b.x - 40 && px < b.x + b.w + 40 &&
           py > b.y - 40 && py < b.y + b.h + 40;
  }

  function isNearCanalPickup(px, py) {
    const c = LANDMARKS.canalPickup;
    return px > c.x - 50 && px < c.x + c.w + 50 &&
           py > c.y - 50 && py < c.y + c.h + 50;
  }

  function showRadio(msg, duration) {
    radioMessage = msg;
    radioTimer = duration || 4;
  }

  function tryAcceptMission(px, py) {
    if (!canAcceptMission()) return false;
    const nextIdx = getNextMission();

    if (nextIdx === 0 && isNearSafehouse(px, py)) {
      startMission0();
      return true;
    }
    if (nextIdx === 1 && isNearSafehouse(px, py)) {
      startMission1();
      return true;
    }
    if (nextIdx === 2 && isNearSafehouse(px, py)) {
      startMission2();
      return true;
    }
    return false;
  }

  function startMission0() {
    activeMission = 0;
    stage = 'STEAL';
    rewardGiven = false;
    missionCar = world.spawnMissionCar('borrowedFinch', 'mission0');
    objective = 'Steal the marked Finch near Sunward Quay';
    showRadio('Ivo: "Need you to grab a Finch by the quay. Keys are in it. Bring it to the garage."', 5);
  }

  function startMission1() {
    activeMission = 1;
    stage = 'GET_HAULER';
    rewardGiven = false;
    missionCar = world.spawnMissionCar('hotCargoHauler', 'mission1');
    objective = 'Take the Hauler at Foundry Ward';
    showRadio('Ivo: "Big job. Take the Hauler at the foundry, grab the manifest, and get out clean."', 5);
  }

  function startMission2() {
    activeMission = 2;
    stage = 'GO_TO_CANAL';
    rewardGiven = false;
    guardSpawned = false;
    guardDefeated = false;
    casePickedUp = false;
    objective = 'Head to Canal Market for the case';
    showRadio('Ivo: "Last one. My case is at Canal Market. Watch for the guard. Get it and come home."', 6);
  }

  function completeMission(idx) {
    if (rewardGiven) return;
    rewardGiven = true;
    completedMissions = idx + 1;
    cash += MISSION_REWARDS[idx];
    activeMission = -1;
    stage = 'IDLE';
    missionCar = null;
    save.save(completedMissions, cash, upgraded);

    if (idx === 0) {
      showRadio('Ivo: "Good run. Payment sent. Got something bigger for you."', 5);
    } else if (idx === 1) {
      showRadio('Ivo: "Clean work. Cash is yours. One last thing..."', 5);
    } else {
      showRadio('Ivo: "It\'s done. You\'re clear. Pelican Reach is yours now. Keep exploring."', 7);
    }
  }

  function getObjectiveMarker() {
    switch (activeMission) {
      case 0:
        if (stage === 'STEAL' && missionCar) return { x: missionCar.x, y: missionCar.y, label: 'F' };
        if (stage === 'DELIVER') return { x: LANDMARKS.quayGarage.x, y: LANDMARKS.quayGarage.y, label: 'G' };
        break;
      case 1:
        if (stage === 'GET_HAULER' && missionCar) return { x: missionCar.x, y: missionCar.y, label: 'H' };
        if (stage === 'GET_MANIFEST') return { x: LANDMARKS.foundryBay.x, y: LANDMARKS.foundryBay.y, label: 'M' };
        if (stage === 'LOSE_HEAT') return null;
        if (stage === 'DELIVER_CARGO') return { x: LANDMARKS.quayGarage.x, y: LANDMARKS.quayGarage.y, label: 'D' };
        break;
      case 2:
        if (stage === 'GO_TO_CANAL') return { x: LANDMARKS.canalPickup.x, y: LANDMARKS.canalPickup.y, label: 'C' };
        if (stage === 'ESCAPE') return { x: LANDMARKS.safehouse.x, y: LANDMARKS.safehouse.y, label: 'S' };
        break;
    }
    if (activeMission === -1 && completedMissions < 3) {
      return { x: LANDMARKS.safehouse.x, y: LANDMARKS.safehouse.y, label: 'I' };
    }
    return null;
  }

  function update(dt, px, py, interactPressed) {
    if (radioTimer > 0) radioTimer -= dt;

    if (activeMission === -1 && interactPressed) {
      tryAcceptMission(px, py);
      return;
    }

    switch (activeMission) {
      case 0: updateMission0(px, py, interactPressed); break;
      case 1: updateMission1(px, py, interactPressed); break;
      case 2: updateMission2(px, py, interactPressed); break;
    }
  }

  function updateMission0(px, py, interact) {
    if (stage === 'STEAL') {
      if (world.player.inVehicle && world.player.inVehicle.missionId === 'mission0') {
        stage = 'DELIVER';
        objective = 'Deliver the Finch to the Quay Garage (slow down!)';
        showRadio('Ivo: "Nice. Now take it to the garage by the quay. Easy on the gas."', 4);
      }
    } else if (stage === 'DELIVER') {
      if (world.player.inVehicle && world.player.inVehicle.missionId === 'mission0') {
        if (isNearQuayGarage(px, py)) {
          if (Math.abs(world.player.inVehicle.speed) < 30) {
            completeMission(0);
            objective = 'Mission complete! Return to safehouse for next job.';
          } else {
            objective = 'Slow down to deliver!';
          }
        }
      } else {
        objective = 'Get back in the marked Finch!';
      }
    }
  }

  function updateMission1(px, py, interact) {
    if (stage === 'GET_HAULER') {
      if (world.player.inVehicle && world.player.inVehicle.missionId === 'mission1') {
        stage = 'GET_MANIFEST';
        objective = 'Go to the loading bay on foot to get the manifest';
        showRadio('Ivo: "Park near the loading bay and grab the manifest."', 4);
      }
    } else if (stage === 'GET_MANIFEST') {
      if (!world.player.inVehicle && isNearFoundryBay(px, py) && interact) {
        stage = 'LOSE_HEAT';
        objective = 'Lose the police before delivering!';
        crime.heat = 2;
        showRadio('Radio: "All units, cargo theft at Foundry Ward!"', 4);
      }
    } else if (stage === 'LOSE_HEAT') {
      if (crime.heat === 0) {
        stage = 'DELIVER_CARGO';
        objective = 'Deliver the cargo to the garage';
        showRadio('Ivo: "Coast is clear. Bring it to the garage."', 4);
      }
    } else if (stage === 'DELIVER_CARGO') {
      if (crime.heat > 0) {
        objective = 'Lose the tail first!';
        return;
      }
      if (world.player.inVehicle && isNearQuayGarage(px, py)) {
        if (Math.abs(world.player.inVehicle.speed) < 30) {
          completeMission(1);
          objective = 'Mission complete! Return to safehouse.';
        }
      }
    }
  }

  function updateMission2(px, py, interact) {
    if (stage === 'GO_TO_CANAL') {
      if (isNearCanalPickup(px, py) && !world.player.inVehicle) {
        if (!guardSpawned) {
          guardSpawned = true;
          // Spawn hostile guard
          world.pedestrians.push({
            id: 9999, x: LANDMARKS.canalPickup.x + 30, y: LANDMARKS.canalPickup.y + 30,
            w: 12, h: 12, speed: 60, angle: Math.PI,
            fleeing: false, fleeTimer: 0, walkTimer: 999,
            color: '#AA2020', isGuard: true, hp: 60,
          });
          showRadio('"Hey! That case isn\'t yours!"', 3);
          objective = 'Deal with the guard and grab the case!';
        }

        // Check if guard is defeated
        const guard = world.pedestrians.find(p => p.isGuard);
        if (!guard) guardDefeated = true;

        if ((guardDefeated || !world.pedestrians.find(p => p.isGuard)) && interact && !casePickedUp) {
          casePickedUp = true;
          stage = 'ESCAPE';
          crime.heat = 2;
          objective = 'Get to a car and escape to the safehouse!';
          showRadio('Ivo: "Got it? Get out of there! Head to the safehouse!"', 4);
        }
      }
    } else if (stage === 'ESCAPE') {
      if (isNearSafehouse(px, py) && crime.heat === 0) {
        completeMission(2);
        objective = 'All missions complete. Keep exploring Pelican Reach!';
      } else if (crime.heat > 0) {
        objective = 'Lose the police and get to the safehouse!';
      } else {
        objective = 'Return to the safehouse';
      }
    }
  }

  function tryUpgrade() {
    if (upgraded) return { ok: false, reason: 'Already upgraded' };
    if (cash < UPGRADE_COST) return { ok: false, reason: `Need $${UPGRADE_COST} (have $${cash})` };
    cash -= UPGRADE_COST;
    upgraded = true;
    save.save(completedMissions, cash, upgraded);
    return { ok: true };
  }

  function getEPrompt(px, py) {
    // Near safehouse and mission available
    if (isNearSafehouse(px, py)) {
      if (activeMission === -1 && completedMissions < 3) {
        return `Press E: Accept "${MISSION_NAMES[completedMissions]}"`;
      }
      if (activeMission === -1 && !upgraded && cash >= UPGRADE_COST) {
        return `Press E: Buy upgrade ($${UPGRADE_COST})`;
      }
    }
    // Near vehicle
    if (!world.player.inVehicle) {
      const v = world.nearestVehicle();
      if (v) {
        const spd = Math.abs(v.speed);
        if (v.driver && v.driver !== 'player' && spd > 60) {
          return 'Too fast to steal';
        }
        const name = VEHICLE_TYPES[v.type]?.name || 'Car';
        return v.driver && v.driver !== 'player'
          ? `Press E: Steal ${name} (slow/stopped)`
          : `Press E: Enter ${name}`;
      }
    } else {
      return 'Press E: Exit vehicle';
    }
    // Near mission interact points
    if (activeMission === 1 && stage === 'GET_MANIFEST' && isNearFoundryBay(px, py) && !world.player.inVehicle) {
      return 'Press E: Grab manifest';
    }
    if (activeMission === 2 && stage === 'GO_TO_CANAL' && isNearCanalPickup(px, py) && !world.player.inVehicle) {
      if (guardSpawned && !guardDefeated && world.pedestrians.find(p => p.isGuard)) {
        return 'Defeat the guard first!';
      }
      return 'Press E: Take the case';
    }
    return '';
  }

  function handleInteract(px, py) {
    // Mission interactions first
    if (activeMission === -1 && isNearSafehouse(px, py)) {
      if (completedMissions < 3) return; // handled in update()
      if (!upgraded && cash >= UPGRADE_COST) {
        tryUpgrade();
        showRadio('Vehicle handling upgraded!', 3);
        return;
      }
    }

    // Vehicle enter/exit
    if (world.player.inVehicle) {
      world.exitVehicle();
    } else {
      const v = world.nearestVehicle();
      if (v) {
        const hadDriver = world.enterVehicle(v);
        if (hadDriver) {
          crime.raiseHeat(1);
          showRadio('Witnessed theft!', 2);
        }
      }
    }
  }

  function resetMissionState() {
    if (activeMission >= 0) {
      // Reset to beginning of current mission
      const idx = activeMission;
      activeMission = -1;
      stage = 'IDLE';
      missionCar = null;
      guardSpawned = false;
      guardDefeated = false;
      casePickedUp = false;
      rewardGiven = false;
      objective = completedMissions < 3
        ? 'Go to the safehouse to start your next job'
        : 'All missions complete. Keep exploring!';
    }
  }

  // Initialize
  if (completedMissions >= 3) {
    objective = 'All missions complete. Keep exploring Pelican Reach!';
  } else {
    objective = 'Go to the safehouse to start your next job';
  }

  return {
    get activeMission() { return activeMission; },
    get stage() { return stage; },
    get objective() { return objective; },
    get radioMessage() { return radioTimer > 0 ? radioMessage : ''; },
    get completedMissions() { return completedMissions; },
    get cash() { return cash; },
    get upgraded() { return upgraded; },
    get missionCar() { return missionCar; },
    getObjectiveMarker,
    getEPrompt,
    update,
    handleInteract,
    tryUpgrade,
    resetMissionState,
    UPGRADE_COST,
  };
}
