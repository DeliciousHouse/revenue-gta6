// Canvas rendering: world, entities, HUD, minimap.
// Draws to a fixed 1280x720 composition scaled to viewport.

import {
  WORLD_W, WORLD_H, ROADS, BUILDINGS, WATER, SIDEWALKS,
  COLORS, DISTRICTS, LANDMARKS, getDistrict,
} from './city.js';
import { VEHICLE_TYPES } from './world.js';

const VIEW_W = 1280;
const VIEW_H = 720;
const MINIMAP_SIZE = 160;
const MINIMAP_MARGIN = 12;
const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const HUD_BG = 'rgba(18, 54, 59, 0.88)';
const HUD_TEXT = '#FFF4D6';
const OBJECTIVE_COLOR = '#F3C84B';
const DANGER_COLOR = '#AE303A';

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  let staticCanvas = null;
  let staticReady = false;
  let scale = 1;
  let offsetX = 0;
  let offsetY = 0;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    scale = Math.min(canvas.width / VIEW_W, canvas.height / VIEW_H);
    offsetX = (canvas.width - VIEW_W * scale) / 2;
    offsetY = (canvas.height - VIEW_H * scale) / 2;
  }

  function buildStaticMap() {
    const sc = 1;
    staticCanvas = document.createElement('canvas');
    staticCanvas.width = WORLD_W * sc;
    staticCanvas.height = WORLD_H * sc;
    const c = staticCanvas.getContext('2d');

    // Background grass
    c.fillStyle = COLORS.grass;
    c.fillRect(0, 0, WORLD_W, WORLD_H);

    // Water
    c.fillStyle = COLORS.water;
    for (const w of WATER) c.fillRect(w.x, w.y, w.w, w.h);

    // Sidewalks
    c.fillStyle = COLORS.sidewalk;
    for (const s of SIDEWALKS) c.fillRect(s.x, s.y, s.w, s.h);

    // Roads
    c.fillStyle = COLORS.street;
    for (const r of ROADS) c.fillRect(r.x, r.y, r.w, r.h);

    // Road center lines
    c.strokeStyle = '#AAA890';
    c.lineWidth = 1;
    c.setLineDash([8, 12]);
    for (const r of ROADS) {
      c.beginPath();
      if (r.w > r.h) {
        c.moveTo(r.x, r.y + r.h / 2);
        c.lineTo(r.x + r.w, r.y + r.h / 2);
      } else {
        c.moveTo(r.x + r.w / 2, r.y);
        c.lineTo(r.x + r.w / 2, r.y + r.h);
      }
      c.stroke();
    }
    c.setLineDash([]);

    // Buildings with shadows
    for (const b of BUILDINGS) {
      // Shadow
      c.fillStyle = 'rgba(18, 54, 59, 0.3)';
      c.fillRect(b.x + 4, b.y + 4, b.w, b.h);

      // Building body
      if (b.type === 'cargo') {
        c.fillStyle = COLORS.cargo;
      } else if (b.type === 'awning') {
        c.fillStyle = COLORS.awning;
      } else if (b.type === 'safehouse') {
        c.fillStyle = '#4A90A0';
      } else if (b.type === 'market') {
        c.fillStyle = '#C49A6C';
      } else {
        c.fillStyle = COLORS.roof;
      }
      c.fillRect(b.x, b.y, b.w, b.h);

      // Roof highlight
      c.fillStyle = 'rgba(255,255,255,0.1)';
      c.fillRect(b.x + 2, b.y + 2, b.w - 4, 6);

      // Awning stripes
      if (b.type === 'awning') {
        c.fillStyle = COLORS.awningStripe;
        for (let sx = b.x; sx < b.x + b.w; sx += 16) {
          c.fillRect(sx, b.y, 8, b.h);
        }
      }
    }

    // Landmark: Cranes
    c.fillStyle = COLORS.crane;
    for (const cr of LANDMARKS.cranes) {
      c.fillRect(cr.x, cr.y, cr.w, cr.h);
      c.fillRect(cr.x - 15, cr.y, cr.w + 30, 4);
      c.strokeStyle = COLORS.craneCable;
      c.lineWidth = 1;
      c.beginPath();
      c.moveTo(cr.x + cr.w / 2, cr.y);
      c.lineTo(cr.x - 15, cr.y + cr.h * 0.3);
      c.moveTo(cr.x + cr.w / 2, cr.y);
      c.lineTo(cr.x + cr.w + 15, cr.y + cr.h * 0.3);
      c.stroke();
    }

    // Safehouse marker
    const sh = LANDMARKS.safehouse;
    c.strokeStyle = '#4A90A0';
    c.lineWidth = 2;
    c.strokeRect(sh.x - 2, sh.y - 2, sh.w + 4, sh.h + 4);

    // Garage marker
    const gg = LANDMARKS.quayGarage;
    c.fillStyle = COLORS.street;
    c.fillRect(gg.x, gg.y, gg.w, gg.h);
    c.strokeStyle = OBJECTIVE_COLOR;
    c.lineWidth = 1;
    c.strokeRect(gg.x, gg.y, gg.w, gg.h);

    staticReady = true;
  }

  function worldToScreen(wx, wy, camX, camY) {
    const sx = (wx - camX) + VIEW_W / 2;
    const sy = (wy - camY) + VIEW_H / 2;
    return { x: sx, y: sy };
  }

  function screenToWorld(sx, sy, camX, camY) {
    const wx = (sx - offsetX) / scale - VIEW_W / 2 + camX;
    const wy = (sy - offsetY) / scale - VIEW_H / 2 + camY;
    return { x: wx, y: wy };
  }

  function drawWorld(state, camX, camY) {
    if (!staticReady) buildStaticMap();

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = COLORS.ink;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.setTransform(scale, 0, 0, scale, offsetX, offsetY);

    // Draw static map centered on camera
    const srcX = camX - VIEW_W / 2;
    const srcY = camY - VIEW_H / 2;
    ctx.drawImage(staticCanvas, srcX, srcY, VIEW_W, VIEW_H, 0, 0, VIEW_W, VIEW_H);
  }

  function drawVehicle(v, camX, camY, isPlayer, isMission) {
    const s = worldToScreen(v.x + v.w / 2, v.y + v.h / 2, camX, camY);
    if (s.x < -60 || s.x > VIEW_W + 60 || s.y < -60 || s.y > VIEW_H + 60) return;

    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(v.angle);

    // Vehicle body
    const hw = v.w / 2;
    const hh = v.h / 2;

    if (v.hitFlash > 0) {
      ctx.fillStyle = '#FFFFFF';
    } else {
      ctx.fillStyle = v.color || VEHICLE_TYPES[v.type]?.color || '#888';
    }
    ctx.fillRect(-hw, -hh, v.w, v.h);

    // Windshield
    ctx.fillStyle = 'rgba(100,180,220,0.5)';
    ctx.fillRect(hw * 0.3, -hh * 0.6, hw * 0.4, hh * 1.2);

    // Wheels
    ctx.fillStyle = '#333';
    ctx.fillRect(-hw + 2, -hh - 2, 6, 3);
    ctx.fillRect(-hw + 2, hh - 1, 6, 3);
    ctx.fillRect(hw - 8, -hh - 2, 6, 3);
    ctx.fillRect(hw - 8, hh - 1, 6, 3);

    // Player outline
    if (isPlayer) {
      ctx.strokeStyle = COLORS.playerOutline;
      ctx.lineWidth = 2;
      ctx.strokeRect(-hw - 2, -hh - 2, v.w + 4, v.h + 4);
    }

    // Mission marker
    if (isMission) {
      ctx.strokeStyle = OBJECTIVE_COLOR;
      ctx.lineWidth = 2;
      ctx.strokeRect(-hw - 3, -hh - 3, v.w + 6, v.h + 6);
    }

    ctx.restore();
  }

  function drawPolice(p, camX, camY) {
    const s = worldToScreen(p.x + p.w / 2, p.y + p.h / 2, camX, camY);
    if (s.x < -60 || s.x > VIEW_W + 60 || s.y < -60 || s.y > VIEW_H + 60) return;

    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(p.angle);

    const hw = p.w / 2;
    const hh = p.h / 2;

    // Police body
    ctx.fillStyle = p.hitFlash > 0 ? '#FFFFFF' : COLORS.police;
    ctx.fillRect(-hw, -hh, p.w, p.h);

    // Light bar
    const phase = Math.sin(p.lightPhase);
    ctx.fillStyle = phase > 0 ? COLORS.policeLight1 : COLORS.policeLight2;
    ctx.fillRect(-4, -hh - 3, 8, 3);

    // Windshield
    ctx.fillStyle = 'rgba(100,180,220,0.5)';
    ctx.fillRect(hw * 0.2, -hh * 0.5, hw * 0.5, hh);

    ctx.restore();
  }

  function drawPlayer(player, camX, camY) {
    if (player.inVehicle) return;
    const s = worldToScreen(player.x + player.w / 2, player.y + player.h / 2, camX, camY);

    ctx.save();
    ctx.translate(s.x, s.y);

    // Player body (Mara)
    if (player.hitFlash > 0) {
      ctx.fillStyle = '#FFFFFF';
    } else if (player.invulnTimer > 0 && Math.floor(player.invulnTimer * 10) % 2 === 0) {
      ctx.fillStyle = 'rgba(90, 180, 200, 0.5)';
    } else {
      ctx.fillStyle = '#5AB4C8';
    }
    ctx.beginPath();
    ctx.arc(0, 0, player.w / 2, 0, Math.PI * 2);
    ctx.fill();

    // Direction indicator
    ctx.strokeStyle = COLORS.playerOutline;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(player.angle) * 12, Math.sin(player.angle) * 12);
    ctx.stroke();

    // Outline
    ctx.strokeStyle = COLORS.playerOutline;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, player.w / 2 + 1, 0, Math.PI * 2);
    ctx.stroke();

    ctx.restore();
  }

  function drawPedestrian(ped, camX, camY) {
    const s = worldToScreen(ped.x + ped.w / 2, ped.y + ped.h / 2, camX, camY);
    if (s.x < -20 || s.x > VIEW_W + 20 || s.y < -20 || s.y > VIEW_H + 20) return;

    ctx.fillStyle = ped.color;
    ctx.beginPath();
    ctx.arc(s.x, s.y, 4, 0, Math.PI * 2);
    ctx.fill();

    if (ped.isGuard) {
      ctx.strokeStyle = DANGER_COLOR;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(s.x, s.y, 6, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawProjectiles(projectiles, camX, camY) {
    for (const p of projectiles) {
      const s = worldToScreen(p.x, p.y, camX, camY);
      if (s.x < -10 || s.x > VIEW_W + 10 || s.y < -10 || s.y > VIEW_H + 10) continue;
      ctx.fillStyle = p.owner === 'player' ? '#FFE060' : DANGER_COLOR;
      ctx.beginPath();
      ctx.arc(s.x, s.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawEffects(effects, camX, camY) {
    for (const e of effects) {
      const s = worldToScreen(e.x, e.y, camX, camY);
      ctx.fillStyle = `rgba(255, 200, 60, ${e.timer * 3})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, 5 + (0.3 - e.timer) * 10, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawObjectiveMarker(marker, camX, camY) {
    if (!marker) return;
    const s = worldToScreen(marker.x + 20, marker.y - 10, camX, camY);

    // Diamond shape
    ctx.fillStyle = OBJECTIVE_COLOR;
    ctx.beginPath();
    ctx.moveTo(s.x, s.y - 14);
    ctx.lineTo(s.x + 10, s.y);
    ctx.lineTo(s.x, s.y + 14);
    ctx.lineTo(s.x - 10, s.y);
    ctx.closePath();
    ctx.fill();

    // Letter
    ctx.fillStyle = COLORS.ink;
    ctx.font = `bold 12px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(marker.label, s.x, s.y);
  }

  function drawHUD(state) {
    const { player, crime, missions, district } = state;
    ctx.setTransform(scale, 0, 0, scale, offsetX, offsetY);

    // Top-left: district + objective
    ctx.fillStyle = HUD_BG;
    ctx.fillRect(8, 8, 420, 56);
    ctx.font = `bold 18px ${FONT}`;
    ctx.fillStyle = HUD_TEXT;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(district, 16, 14);
    ctx.font = `15px ${FONT}`;
    ctx.fillStyle = OBJECTIVE_COLOR;
    const obj = missions.objective;
    const truncObj = obj.length > 48 ? obj.slice(0, 48) + '...' : obj;
    ctx.fillText(truncObj, 16, 38);

    // Top-right: health, vehicle health, cash, heat
    const rightW = 260;
    ctx.fillStyle = HUD_BG;
    ctx.fillRect(VIEW_W - rightW - 8, 8, rightW, 80);

    // Health bar
    ctx.font = `14px ${FONT}`;
    ctx.fillStyle = HUD_TEXT;
    ctx.fillText('HP', VIEW_W - rightW, 18);
    ctx.fillStyle = '#333';
    ctx.fillRect(VIEW_W - rightW + 24, 16, 100, 14);
    const hpFrac = player.hp / player.maxHp;
    ctx.fillStyle = hpFrac > 0.5 ? '#5BC080' : hpFrac > 0.25 ? OBJECTIVE_COLOR : DANGER_COLOR;
    ctx.fillRect(VIEW_W - rightW + 24, 16, 100 * hpFrac, 14);

    // Vehicle health (if in vehicle)
    if (player.inVehicle) {
      ctx.fillStyle = HUD_TEXT;
      ctx.fillText('CAR', VIEW_W - rightW, 36);
      ctx.fillStyle = '#333';
      ctx.fillRect(VIEW_W - rightW + 30, 34, 94, 14);
      const vhpFrac = player.inVehicle.hp / player.inVehicle.maxHp;
      ctx.fillStyle = vhpFrac > 0.5 ? '#5BC080' : vhpFrac > 0.25 ? OBJECTIVE_COLOR : DANGER_COLOR;
      ctx.fillRect(VIEW_W - rightW + 30, 34, 94 * vhpFrac, 14);
    }

    // Cash
    ctx.font = `bold 16px ${FONT}`;
    ctx.fillStyle = OBJECTIVE_COLOR;
    ctx.fillText(`$${missions.cash}`, VIEW_W - rightW, 60);

    // Heat stars
    ctx.fillStyle = HUD_TEXT;
    ctx.fillText('HEAT', VIEW_W - rightW + 90, 60);
    for (let i = 0; i < 3; i++) {
      ctx.fillStyle = i < crime.heat ? DANGER_COLOR : '#333';
      ctx.beginPath();
      drawStar(ctx, VIEW_W - rightW + 150 + i * 22, 66, 8, 5);
      ctx.fill();
    }

    // Wanted status
    if (crime.heat > 0) {
      ctx.font = `bold 16px ${FONT}`;
      if (crime.spotted) {
        ctx.fillStyle = DANGER_COLOR;
        ctx.fillText('SPOTTED', VIEW_W - 80, 78);
      } else {
        ctx.fillStyle = OBJECTIVE_COLOR;
        ctx.fillText(`Searching: ${Math.ceil(crime.searchTimer)}s`, VIEW_W - 130, 78);
      }
    }
  }

  function drawStar(c, cx, cy, r, points) {
    c.beginPath();
    for (let i = 0; i < points * 2; i++) {
      const a = (i * Math.PI) / points - Math.PI / 2;
      const rad = i % 2 === 0 ? r : r * 0.5;
      if (i === 0) c.moveTo(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad);
      else c.lineTo(cx + Math.cos(a) * rad, cy + Math.sin(a) * rad);
    }
    c.closePath();
  }

  function drawMinimap(state) {
    const { player, crime, missions, camX, camY, police } = state;
    const mx = MINIMAP_MARGIN;
    const my = VIEW_H - MINIMAP_SIZE - MINIMAP_MARGIN;
    const sc = MINIMAP_SIZE / WORLD_W;
    const mh = WORLD_H * sc;

    ctx.fillStyle = HUD_BG;
    ctx.fillRect(mx - 2, my - 2, MINIMAP_SIZE + 4, mh + 4);

    // Mini water
    ctx.fillStyle = COLORS.water;
    for (const w of WATER) {
      ctx.fillRect(mx + w.x * sc, my + w.y * sc, w.w * sc, w.h * sc);
    }

    // Mini roads
    ctx.fillStyle = COLORS.street;
    for (const r of ROADS) {
      ctx.fillRect(mx + r.x * sc, my + r.y * sc, Math.max(1, r.w * sc), Math.max(1, r.h * sc));
    }

    // Mini buildings
    ctx.fillStyle = 'rgba(212, 122, 91, 0.6)';
    for (const b of BUILDINGS) {
      ctx.fillRect(mx + b.x * sc, my + b.y * sc, b.w * sc, b.h * sc);
    }

    // Player dot
    ctx.fillStyle = '#5AB4C8';
    ctx.beginPath();
    ctx.arc(mx + player.x * sc, my + player.y * sc, 3, 0, Math.PI * 2);
    ctx.fill();

    // Objective marker
    const marker = missions.getObjectiveMarker();
    if (marker) {
      ctx.fillStyle = OBJECTIVE_COLOR;
      ctx.beginPath();
      ctx.arc(mx + marker.x * sc, my + marker.y * sc, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Police dots
    ctx.fillStyle = COLORS.policeLight1;
    for (const p of police) {
      ctx.beginPath();
      ctx.arc(mx + (p.x + p.w / 2) * sc, my + (p.y + p.h / 2) * sc, 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Camera viewport outline
    ctx.strokeStyle = 'rgba(255,244,214,0.3)';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(mx + (camX - VIEW_W / 2) * sc, my + (camY - VIEW_H / 2) * sc, VIEW_W * sc, VIEW_H * sc);
  }

  function drawRadioMessage(msg) {
    if (!msg) return;
    const y = VIEW_H - 50;
    ctx.fillStyle = HUD_BG;
    ctx.fillRect(VIEW_W / 2 - 300, y - 4, 600, 36);
    ctx.font = `italic 16px ${FONT}`;
    ctx.fillStyle = HUD_TEXT;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(msg, VIEW_W / 2, y);
  }

  function drawEPrompt(prompt, player, camX, camY) {
    if (!prompt) return;
    const s = worldToScreen(player.x + player.w / 2, player.y - 20, camX, camY);
    ctx.font = `bold 14px ${FONT}`;
    ctx.fillStyle = HUD_BG;
    const tw = ctx.measureText(prompt).width + 12;
    ctx.fillRect(s.x - tw / 2, s.y - 10, tw, 22);
    ctx.fillStyle = OBJECTIVE_COLOR;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(prompt, s.x, s.y);
  }

  function drawExitBlocked() {
    ctx.font = `bold 16px ${FONT}`;
    ctx.fillStyle = HUD_BG;
    ctx.fillRect(VIEW_W / 2 - 80, VIEW_H / 2 + 40, 160, 28);
    ctx.fillStyle = DANGER_COLOR;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('No safe exit', VIEW_W / 2, VIEW_H / 2 + 54);
  }

  function drawTitleBackdrop(camX, camY) {
    if (!staticReady) buildStaticMap();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = COLORS.ink;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(scale, 0, 0, scale, offsetX, offsetY);
    const srcX = WORLD_W / 2 - VIEW_W / 2;
    const srcY = 600;
    ctx.drawImage(staticCanvas, srcX, srcY, VIEW_W, VIEW_H, 0, 0, VIEW_W, VIEW_H);

    // Darken overlay
    ctx.fillStyle = 'rgba(18, 54, 59, 0.6)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }

  function drawFrame(state) {
    const { player, vehicles, traffic, pedestrians, projectiles, effects,
            crime, missions, camX, camY } = state;

    drawWorld(state, camX, camY);

    // Draw all entities sorted by y for depth
    const entities = [];
    for (const v of vehicles) entities.push({ type: 'vehicle', obj: v, y: v.y + v.h });
    for (const t of traffic) {
      if (t.driver !== 'player') entities.push({ type: 'vehicle', obj: t, y: t.y + t.h });
    }
    for (const p of crime.police) entities.push({ type: 'police', obj: p, y: p.y + p.h });
    for (const p of pedestrians) entities.push({ type: 'ped', obj: p, y: p.y + p.h });
    if (!player.inVehicle) entities.push({ type: 'player', obj: player, y: player.y + player.h });

    entities.sort((a, b) => a.y - b.y);

    for (const e of entities) {
      switch (e.type) {
        case 'vehicle': {
          const v = e.obj;
          const isPlayer = player.inVehicle === v;
          const isMission = !!v.missionId;
          drawVehicle(v, camX, camY, isPlayer, isMission);
          break;
        }
        case 'police':
          drawPolice(e.obj, camX, camY);
          break;
        case 'ped':
          drawPedestrian(e.obj, camX, camY);
          break;
        case 'player':
          drawPlayer(player, camX, camY);
          break;
      }
    }

    drawProjectiles(projectiles, camX, camY);
    drawEffects(effects, camX, camY);
    drawObjectiveMarker(missions.getObjectiveMarker(), camX, camY);

    // HUD
    const district = getDistrict(player.x, player.y);
    drawHUD({ player, crime, missions, district });
    drawMinimap({ player, crime, missions, camX, camY, police: crime.police });
    drawRadioMessage(missions.radioMessage);

    const ePrompt = missions.getEPrompt(player.x, player.y);
    drawEPrompt(ePrompt, player, camX, camY);

    if (state.exitBlocked) drawExitBlocked();
  }

  resize();
  window.addEventListener('resize', resize);

  return {
    drawFrame, drawTitleBackdrop, resize,
    screenToWorld, VIEW_W, VIEW_H,
    get scale() { return scale; },
    get offsetX() { return offsetX; },
    get offsetY() { return offsetY; },
  };
}
