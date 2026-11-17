// Breakwater Run — main loop, screens, input, camera.
// Ties together world, crime, missions, save, render, audio.

import { WORLD_W, WORLD_H, LANDMARKS, getDistrict } from './city.js';
import { createWorld, STEP, MAX_FRAME, MAX_STEPS } from './world.js';
import { createCrimeSystem } from './crime.js';
import { createMissionSystem } from './missions.js';
import { createSaveSystem } from './save.js';
import { createRenderer } from './render.js';
import { createAudio } from './audio.js';

// --- Screens ---
const SCREEN_TITLE = 'title';
const SCREEN_PLAY = 'play';
const SCREEN_PAUSED = 'paused';
const SCREEN_DEAD = 'dead';

// --- Input ---
const keys = {};
let mouseX = 0, mouseY = 0;
let mouseDown = false;
let mouseClicked = false;
let interactPressed = false;
let pausePressed = false;
let mutePressed = false;

function setupInput(canvas, renderer) {
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    keys[e.code] = true;
    if (e.code === 'KeyE') interactPressed = true;
    if (e.code === 'Escape' || e.code === 'KeyP') pausePressed = true;
    if (e.code === 'KeyM') mutePressed = true;
    if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','KeyW','KeyA','KeyS','KeyD','KeyE','KeyP','KeyM','Escape'].includes(e.code)) {
      e.preventDefault();
    }
  });

  window.addEventListener('keyup', (e) => {
    keys[e.code] = false;
  });

  window.addEventListener('blur', () => {
    for (const k in keys) keys[k] = false;
    mouseDown = false;
    mouseClicked = false;
    interactPressed = false;
  });

  canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    mouseX = (e.clientX - rect.left) * dpr;
    mouseY = (e.clientY - rect.top) * dpr;
  });

  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) {
      mouseDown = true;
      mouseClicked = true;
    }
  });

  canvas.addEventListener('mouseup', (e) => {
    if (e.button === 0) mouseDown = false;
  });

  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
}

function getInput() {
  return {
    up: !!(keys['KeyW'] || keys['ArrowUp']),
    down: !!(keys['KeyS'] || keys['ArrowDown']),
    left: !!(keys['KeyA'] || keys['ArrowLeft']),
    right: !!(keys['KeyD'] || keys['ArrowRight']),
    space: !!keys['Space'],
  };
}

// --- Boot ---
function boot() {
  const canvas = document.getElementById('game');
  const overlay = document.getElementById('overlay');
  const menuEl = document.getElementById('menu');
  const menuTitle = document.getElementById('menu-title');
  const menuSub = document.getElementById('menu-subtitle');
  const menuButtons = document.getElementById('menu-buttons');
  const menuControls = document.getElementById('menu-controls');
  const statusEl = document.getElementById('status');
  const mobileAdvisory = document.getElementById('mobile-advisory');
  const mobileDismiss = document.getElementById('mobile-dismiss');

  // Mobile check
  const isMobile = window.innerWidth < 700 && 'ontouchstart' in window;
  if (isMobile) {
    mobileAdvisory.classList.remove('hidden');
    mobileDismiss.addEventListener('click', () => {
      mobileAdvisory.classList.add('hidden');
    });
  }

  const renderer = createRenderer(canvas);
  if (!renderer) {
    document.body.innerHTML = '<div style="padding:40px;font-size:20px;color:#FFF4D6;background:#12363B;min-height:100vh"><h1>Breakwater Run</h1><p>Canvas is not available in this browser. Please use a desktop browser like Chrome.</p></div>';
    return;
  }

  const audio = createAudio();
  const save = createSaveSystem();
  let world, crime, missions;
  let screen = SCREEN_TITLE;
  let accumulator = 0;
  let lastTime = 0;
  let camX = WORLD_W / 2;
  let camY = 700;
  let userGestured = false;
  let reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  setupInput(canvas, renderer);

  function announce(msg) {
    statusEl.textContent = msg;
  }

  function initGame(loadSave) {
    world = createWorld();
    crime = createCrimeSystem(world);

    let saveData = { completedMissions: 0, cash: 0, upgraded: false, mute: false };
    if (loadSave) {
      const loaded = save.load();
      if (loaded) saveData = loaded;
    }

    missions = createMissionSystem(world, crime, {
      completedMissions: saveData.completedMissions,
      cash: saveData.cash,
      upgraded: saveData.upgraded,
      save: (cm, cash, up) => save.save(cm, cash, up, audio.muted),
    });

    audio.setMute(saveData.mute);
    camX = world.player.x;
    camY = world.player.y;
  }

  // --- Menu system ---
  function showMenu(title, subtitle, buttons, controls) {
    overlay.classList.remove('hidden');
    menuTitle.textContent = title;
    menuSub.innerHTML = subtitle;
    menuButtons.innerHTML = '';
    for (const btn of buttons) {
      const el = document.createElement('button');
      el.className = `btn ${btn.primary ? 'btn-primary' : ''}`;
      el.textContent = btn.label;
      if (btn.disabled) {
        el.disabled = true;
        el.title = btn.reason || '';
      }
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!userGestured) {
          userGestured = true;
          audio.init();
        }
        btn.action();
      });
      menuButtons.appendChild(el);
    }
    menuControls.innerHTML = controls || '';
    // Focus first enabled button
    const firstBtn = menuButtons.querySelector('button:not(:disabled)');
    if (firstBtn) setTimeout(() => firstBtn.focus(), 50);
  }

  function hideMenu() {
    overlay.classList.add('hidden');
  }

  function showTitle() {
    screen = SCREEN_TITLE;
    const hasSave = save.hasSave();
    const notice = save.notice;

    const buttons = [
      {
        label: 'New Game', primary: !hasSave,
        action: () => {
          if (hasSave) {
            if (!confirm('Start a new game? This will replace your saved progress.')) return;
            save.clearSave();
          }
          initGame(false);
          hideMenu();
          screen = SCREEN_PLAY;
          accumulator = 0;
          lastTime = performance.now();
          announce('Playing. Go to the safehouse to start your first job.');
        },
      },
      {
        label: 'Continue', primary: hasSave,
        disabled: !hasSave,
        reason: hasSave ? '' : 'No saved progress',
        action: () => {
          initGame(true);
          hideMenu();
          screen = SCREEN_PLAY;
          accumulator = 0;
          lastTime = performance.now();
          announce('Continuing. ' + missions.objective);
        },
      },
      {
        label: 'Help',
        action: () => showHelp(true),
      },
      {
        label: audio.muted ? 'Sound: OFF' : 'Sound: ON',
        action: () => {
          audio.setMute(!audio.muted);
          save.save(save.completedMissions, save.cash, save.upgraded, audio.muted);
          showTitle();
        },
      },
    ];

    let subtitle = 'Courier Mara Venn navigates Pelican Reach—<br>a sunlit harbor city of cargo thieves and crooked security.';
    if (notice) subtitle += `<br><small style="color:${audio.muted ? '#AE303A' : '#70BBAE'}">${notice}</small>`;

    const controlsText = 'WASD/Arrows: Move &bull; E: Enter car/Interact &bull; Mouse: Aim &bull; Click: Fire<br>Space: Handbrake &bull; Esc/P: Pause &bull; M: Mute';

    showMenu('BREAKWATER RUN', subtitle, buttons, controlsText);
    renderer.drawTitleBackdrop(camX, camY);
  }

  function showPause() {
    screen = SCREEN_PAUSED;
    audio.suspend();
    showMenu('PAUSED', '', [
      { label: 'Resume', primary: true, action: () => { hideMenu(); screen = SCREEN_PLAY; audio.resume(); lastTime = performance.now(); accumulator = 0; announce('Playing.'); } },
      { label: 'Help', action: () => showHelp(false) },
      { label: audio.muted ? 'Sound: OFF' : 'Sound: ON', action: () => { audio.setMute(!audio.muted); if (missions) save.save(missions.completedMissions, missions.cash, missions.upgraded, audio.muted); showPause(); } },
      { label: 'Return to Title', action: () => { hideMenu(); showTitle(); } },
    ], '');
    announce('Paused.');
  }

  function showHelp(fromTitle) {
    showMenu('CONTROLS', '', [
      { label: 'Back', primary: true, action: () => fromTitle ? showTitle() : showPause() },
    ],
    `<strong>On Foot:</strong> WASD/Arrows move. Mouse aims. Click fires.<br>
     <strong>In Car:</strong> W/Up accelerate. S/Down brake/reverse. A/D steer. Space handbrake.<br>
     <strong>E:</strong> Enter/exit cars, accept missions, interact.<br>
     <strong>Esc/P:</strong> Pause. <strong>M:</strong> Mute.<br><br>
     <strong>Missions:</strong> Go to the safehouse (blue building) to accept jobs.<br>
     <strong>Saving:</strong> Progress saves on mission completion and upgrades.<br>
     Active mission checkpoints are session-only.<br>
     <strong>Heat:</strong> Crimes raise your wanted level (1-3 stars).<br>
     Break line of sight with buildings to escape police.`);
  }

  function showDeath(reason) {
    screen = SCREEN_DEAD;
    audio.suspend();
    showMenu(reason === 'wrecked' ? 'WRECKED' : 'BUSTED', 'You went down in Pelican Reach.', [
      {
        label: 'Retry', primary: true,
        action: () => {
          crime.resetPursuit();
          world.reset();
          missions.resetMissionState();
          hideMenu();
          screen = SCREEN_PLAY;
          audio.resume();
          accumulator = 0;
          lastTime = performance.now();
          announce('Retrying. ' + missions.objective);
        },
      },
      { label: 'Return to Title', action: () => { hideMenu(); showTitle(); } },
    ], '');
    announce(reason === 'wrecked' ? 'Vehicle destroyed.' : 'You were busted.');
  }

  // --- Visibility ---
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      showPause();
    }
  });

  // --- Main loop ---
  function frame(now) {
    requestAnimationFrame(frame);

    if (screen === SCREEN_TITLE) {
      renderer.drawTitleBackdrop(camX, camY);
      return;
    }

    if (screen !== SCREEN_PLAY) return;

    const rawDt = (now - lastTime) / 1000;
    const dt = Math.min(rawDt, MAX_FRAME);
    lastTime = now;
    accumulator += dt;

    // Consume one-shot actions
    if (pausePressed) {
      pausePressed = false;
      showPause();
      return;
    }

    if (mutePressed) {
      mutePressed = false;
      audio.setMute(!audio.muted);
      if (missions) save.save(missions.completedMissions, missions.cash, missions.upgraded, audio.muted);
    }

    const input = getInput();
    const events = { shotFired: false };

    // Fire weapon (only when overlay is hidden to prevent menu clicks firing)
    if (mouseDown && !world.player.inVehicle && overlay.classList.contains('hidden')) {
      const worldPos = renderer.screenToWorld(mouseX, mouseY, camX, camY);
      const aimAngle = Math.atan2(
        worldPos.y - (world.player.y + world.player.h / 2),
        worldPos.x - (world.player.x + world.player.w / 2)
      );
      world.player.angle = aimAngle;
      if (crime.playerFire(aimAngle, STEP)) {
        events.shotFired = true;
        audio.playShot();
        crime.raiseHeat(1);
      }
    }

    // Consume interact before the step loop (edge-triggered, once per press)
    let didInteract = false;
    if (interactPressed) {
      interactPressed = false;
      didInteract = true;
    }

    // Fixed-step simulation
    let steps = 0;
    while (accumulator >= STEP && steps < MAX_STEPS) {
      // Handle interaction on first step only
      if (didInteract && steps === 0) {
        missions.handleInteract(world.player.x, world.player.y);
      }

      const worldResult = world.update(input, STEP, events);
      camX += (worldResult.camX - camX) * 0.1;
      camY += (worldResult.camY - camY) * 0.1;

      // Clamp camera
      const hw = renderer.VIEW_W / 2;
      const hh = renderer.VIEW_H / 2;
      camX = Math.max(hw, Math.min(WORLD_W - hw, camX));
      camY = Math.max(hh, Math.min(WORLD_H - hh, camY));

      // Crime update
      const crimeResult = crime.update(STEP);
      if (crimeResult.hits.some(h => h.type === 'playerHit')) {
        audio.playHit();
      }

      // Mission update (pass interact flag for mission-specific interactions)
      const prevCompleted = missions.completedMissions;
      missions.update(STEP, world.player.x, world.player.y, didInteract && steps === 0);
      if (missions.completedMissions > prevCompleted) {
        audio.playSuccess();
      }

      // Death check
      if (world.player.hp <= 0) {
        showDeath('busted');
        return;
      }
      if (world.player.inVehicle && world.player.inVehicle.hp <= 0) {
        showDeath('wrecked');
        return;
      }

      accumulator -= STEP;
      steps++;
    }
    if (steps >= MAX_STEPS) accumulator = 0;

    // Audio
    if (world.player.inVehicle) {
      audio.updateEngine(Math.abs(world.player.inVehicle.speed), true);
    } else {
      audio.updateEngine(0, false);
    }
    audio.updateSiren(crime.heat > 0 && crime.spotted);

    // Render
    renderer.drawFrame({
      player: world.player,
      vehicles: world.vehicles,
      traffic: world.traffic,
      pedestrians: world.pedestrians,
      projectiles: world.projectiles,
      effects: world.effects,
      crime,
      missions,
      camX, camY,
      exitBlocked: world.exitBlocked,
    });

    // Reset click state
    mouseClicked = false;
  }

  // Start
  showTitle();
  announce('Breakwater Run. Pelican Reach awaits.');
  requestAnimationFrame(frame);
}

boot();
