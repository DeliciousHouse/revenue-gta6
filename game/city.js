// Handcrafted map of Pelican Reach: ~2200x1800 world units.
// Three districts connected by multiple road routes.
// Exports: roads, buildings, water, sidewalks, bounds, districts, landmarks, roadGraph, spawnPoints

export const WORLD_W = 2200;
export const WORLD_H = 1800;
export const BOUNDS = { x: 0, y: 0, w: WORLD_W, h: WORLD_H };

export const COLORS = {
  ink: '#12363B',
  paper: '#FFF4D6',
  water: '#70BBAE',
  waterDeep: '#4A9E92',
  street: '#77766A',
  sidewalk: '#D4D0B8',
  roof: '#D47A5B',
  roofShadow: '#A85A3B',
  objective: '#F3C84B',
  danger: '#AE303A',
  grass: '#8CB87A',
  sand: '#E8D9A0',
  cargo: '#D4793B',
  cargoShadow: '#A05520',
  awning: '#C45C3A',
  awningStripe: '#E8A060',
  crane: '#5A5A5A',
  craneCable: '#3A3A3A',
  wall: '#8A7A6A',
  playerOutline: '#FFF4D6',
  police: '#2244AA',
  policeLight1: '#FF2020',
  policeLight2: '#2060FF',
};

// Districts: approximate bounding rects for naming
export const DISTRICTS = [
  { name: 'Sunward Quay', x: 0, y: 1100, w: 1100, h: 700 },
  { name: 'Foundry Ward', x: 0, y: 0, w: 1200, h: 700 },
  { name: 'Canal Market', x: 1200, y: 0, w: 1000, h: 1100 },
];

// Roads: each road is a rectangle {x, y, w, h}
// Main horizontal roads
export const ROADS = [
  // === Foundry Ward horizontal roads ===
  { x: 0, y: 300, w: 1200, h: 60 },    // FW main east-west
  { x: 0, y: 550, w: 1200, h: 60 },    // FW south road

  // === Canal Market horizontal roads ===
  { x: 1100, y: 300, w: 1100, h: 60 },   // CM top road (connects to FW)
  { x: 1200, y: 600, w: 1000, h: 60 },   // CM middle road
  { x: 1200, y: 900, w: 1000, h: 60 },   // CM south road

  // === Cross-district horizontal ===
  { x: 0, y: 750, w: 2200, h: 70 },     // MAIN BOULEVARD (connects all 3)
  { x: 0, y: 1050, w: 1600, h: 60 },    // Mid crosstown

  // === Sunward Quay horizontal roads ===
  { x: 0, y: 1250, w: 1100, h: 60 },    // SQ promenade road
  { x: 0, y: 1500, w: 900, h: 60 },     // SQ waterfront road

  // === Vertical roads - Foundry Ward ===
  { x: 150, y: 0, w: 60, h: 820 },      // FW west vertical
  { x: 500, y: 0, w: 60, h: 820 },      // FW center vertical
  { x: 850, y: 0, w: 60, h: 820 },      // FW east vertical

  // === Vertical roads - connecting ===
  { x: 150, y: 750, w: 60, h: 810 },    // West connector to SQ
  { x: 500, y: 750, w: 60, h: 560 },    // Center connector
  { x: 850, y: 750, w: 60, h: 560 },    // East connector

  // === Vertical roads - Canal Market ===
  { x: 1400, y: 200, w: 60, h: 870 },   // CM west vertical
  { x: 1700, y: 200, w: 60, h: 870 },   // CM center vertical
  { x: 2000, y: 200, w: 60, h: 870 },   // CM east vertical

  // === Extra connectors ===
  { x: 1100, y: 550, w: 160, h: 60 },   // FW to CM bridge south
  { x: 500, y: 1050, w: 60, h: 260 },   // Center to SQ promenade
  { x: 850, y: 1050, w: 60, h: 260 },   // East to SQ promenade
];

// Sidewalks: thin walkable strips adjacent to roads
export const SIDEWALKS = [];
for (const r of ROADS) {
  if (r.w > r.h) {
    SIDEWALKS.push({ x: r.x, y: r.y - 16, w: r.w, h: 16 });
    SIDEWALKS.push({ x: r.x, y: r.y + r.h, w: r.w, h: 16 });
  } else {
    SIDEWALKS.push({ x: r.x - 16, y: r.y, w: 16, h: r.h });
    SIDEWALKS.push({ x: r.x + r.w, y: r.y, w: 16, h: r.h });
  }
}

// Buildings: solid rectangles players/cars cannot enter
export const BUILDINGS = [
  // === Foundry Ward cargo sheds ===
  { x: 230, y: 50, w: 240, h: 220, type: 'cargo', label: 'Cargo Shed A' },
  { x: 580, y: 50, w: 240, h: 220, type: 'cargo', label: 'Cargo Shed B' },
  { x: 930, y: 50, w: 240, h: 220, type: 'cargo', label: 'Cargo Shed C' },
  { x: 230, y: 380, w: 240, h: 140, type: 'cargo', label: 'Loading Bay' },
  { x: 580, y: 380, w: 240, h: 140, type: 'cargo', label: 'Freight Office' },
  { x: 930, y: 380, w: 150, h: 140, type: 'cargo', label: 'Storage' },

  // === Canal Market buildings ===
  { x: 1280, y: 50, w: 100, h: 220, type: 'market', label: 'Fish Market' },
  { x: 1480, y: 50, w: 190, h: 120, type: 'market', label: 'Canal Cafe' },
  { x: 1780, y: 50, w: 190, h: 120, type: 'market', label: 'Spice Hall' },
  { x: 2080, y: 50, w: 100, h: 220, type: 'market', label: 'Canal Store' },
  { x: 1280, y: 380, w: 100, h: 190, type: 'market', label: 'Market Hall' },
  { x: 1480, y: 380, w: 190, h: 190, type: 'awning', label: 'Covered Market' },
  { x: 1780, y: 380, w: 190, h: 190, type: 'awning', label: 'Fruit Stand' },
  { x: 2080, y: 380, w: 100, h: 190, type: 'market', label: 'Corner Shop' },
  { x: 1280, y: 680, w: 100, h: 190, type: 'market', label: 'Tea House' },
  { x: 1480, y: 680, w: 190, h: 190, type: 'awning', label: 'Awning Row' },
  { x: 1780, y: 680, w: 190, h: 190, type: 'awning', label: 'Textile Stall' },
  { x: 2080, y: 680, w: 100, h: 190, type: 'market', label: 'Bookshop' },

  // === Mid-city ===
  { x: 230, y: 630, w: 240, h: 100, type: 'office', label: 'Harbor Office' },
  { x: 580, y: 630, w: 240, h: 100, type: 'office', label: 'Customs House' },
  { x: 930, y: 630, w: 150, h: 100, type: 'office', label: 'Registry' },

  // === Sunward Quay buildings ===
  { x: 230, y: 840, w: 240, h: 180, type: 'residential', label: 'Seaside Apts' },
  { x: 580, y: 840, w: 240, h: 180, type: 'residential', label: 'Quay Tower' },
  { x: 930, y: 840, w: 220, h: 180, type: 'residential', label: 'Marina View' },

  { x: 230, y: 1120, w: 240, h: 100, type: 'shop', label: 'Promenade Shops' },
  { x: 580, y: 1120, w: 100, h: 100, type: 'shop', label: 'Surf Shop' },
  { x: 730, y: 1120, w: 100, h: 100, type: 'residential', label: 'Apt Block' },

  { x: 230, y: 1330, w: 240, h: 140, type: 'residential', label: 'Beach House' },
  { x: 580, y: 1330, w: 240, h: 140, type: 'shop', label: 'Marina Club' },

  // === Safehouse ===
  { x: 920, y: 1120, w: 140, h: 100, type: 'safehouse', label: 'Safehouse' },
];

// Water areas
export const WATER = [
  { x: 0, y: 1580, w: 900, h: 220 },      // SQ harbor water
  { x: 900, y: 1300, w: 400, h: 500 },     // SQ east harbor
  { x: 1200, y: 1000, w: 1000, h: 800 },   // Canal / open water
  { x: 1300, y: 1100, w: 900, h: 700 },    // Deep canal
];

// Landmarks: visual features drawn on the map
export const LANDMARKS = {
  safehouse: { x: 920, y: 1120, w: 140, h: 100 },
  quayGarage: { x: 100, y: 1260, w: 80, h: 50 },
  foundryBay: { x: 230, y: 520, w: 80, h: 30 },
  canalPickup: { x: 1600, y: 340, w: 40, h: 40 },
  cranes: [
    { x: 60, y: 1420, w: 20, h: 120 },
    { x: 200, y: 1450, w: 20, h: 90 },
    { x: 350, y: 1420, w: 20, h: 120 },
  ],
};

// Spawn points for traffic, pedestrians and parked cars
export const SPAWN_POINTS = {
  playerStart: { x: 960, y: 1080 },
  parkedCars: [
    { x: 300, y: 310, type: 'finch' },     // FW road finch
    { x: 600, y: 760, type: 'stray' },     // Boulevard stray
    { x: 180, y: 1260, type: 'hauler' },   // SQ hauler
    { x: 870, y: 760, type: 'finch' },     // Near safehouse
    { x: 1420, y: 310, type: 'stray' },    // CM stray
    { x: 1720, y: 610, type: 'hauler' },   // CM hauler
  ],
  missionCars: {
    borrowedFinch: { x: 180, y: 1260, type: 'finch' },
    hotCargoHauler: { x: 300, y: 560, type: 'hauler' },
  },
  trafficRoutes: [
    // Horizontal routes
    [{ x: 0, y: 320 }, { x: 1200, y: 320 }],
    [{ x: 1200, y: 320 }, { x: 0, y: 320 }],
    [{ x: 0, y: 770 }, { x: 2200, y: 770 }],
    [{ x: 2200, y: 790 }, { x: 0, y: 790 }],
    [{ x: 0, y: 1070 }, { x: 1600, y: 1070 }],
    [{ x: 0, y: 1270 }, { x: 1100, y: 1270 }],
    [{ x: 1200, y: 620 }, { x: 2200, y: 620 }],
    [{ x: 1200, y: 920 }, { x: 2200, y: 920 }],
    // Vertical routes
    [{ x: 170, y: 0 }, { x: 170, y: 1560 }],
    [{ x: 520, y: 0 }, { x: 520, y: 1310 }],
    [{ x: 870, y: 0 }, { x: 870, y: 1310 }],
    [{ x: 1420, y: 200 }, { x: 1420, y: 1060 }],
    [{ x: 1720, y: 200 }, { x: 1720, y: 1060 }],
    [{ x: 2020, y: 200 }, { x: 2020, y: 1060 }],
  ],
  pedestrianZones: [
    { x: 240, y: 284, w: 800, h: 1 },     // FW sidewalk
    { x: 240, y: 734, w: 800, h: 1 },     // Boulevard north
    { x: 240, y: 820, w: 800, h: 1 },     // Boulevard south
    { x: 1290, y: 284, w: 800, h: 1 },    // CM sidewalk
    { x: 240, y: 1234, w: 800, h: 1 },    // SQ promenade
    { x: 1290, y: 574, w: 700, h: 1 },    // CM mid
  ],
};

// Road graph nodes for AI pathfinding (intersections)
export const ROAD_NODES = [
  { id: 0, x: 180, y: 330 },   // FW NW
  { id: 1, x: 530, y: 330 },   // FW NC
  { id: 2, x: 880, y: 330 },   // FW NE
  { id: 3, x: 180, y: 580 },   // FW SW
  { id: 4, x: 530, y: 580 },   // FW SC
  { id: 5, x: 880, y: 580 },   // FW SE
  { id: 6, x: 180, y: 785 },   // Blvd W
  { id: 7, x: 530, y: 785 },   // Blvd C
  { id: 8, x: 880, y: 785 },   // Blvd E
  { id: 9, x: 1430, y: 330 },  // CM NW
  { id: 10, x: 1730, y: 330 }, // CM NC
  { id: 11, x: 2030, y: 330 }, // CM NE
  { id: 12, x: 1430, y: 630 }, // CM MW
  { id: 13, x: 1730, y: 630 }, // CM MC
  { id: 14, x: 2030, y: 630 }, // CM ME
  { id: 15, x: 1430, y: 785 }, // Blvd CM W
  { id: 16, x: 1730, y: 785 }, // Blvd CM C
  { id: 17, x: 2030, y: 785 }, // Blvd CM E
  { id: 18, x: 180, y: 1080 }, // SQ NW
  { id: 19, x: 530, y: 1080 }, // SQ NC
  { id: 20, x: 880, y: 1080 }, // SQ NE
  { id: 21, x: 180, y: 1280 }, // SQ SW
  { id: 22, x: 530, y: 1280 }, // SQ SC
  { id: 23, x: 880, y: 1280 }, // SQ SE (near safehouse)
  { id: 24, x: 180, y: 1530 }, // SQ waterfront
  { id: 25, x: 530, y: 1530 }, // SQ waterfront C
  { id: 26, x: 1430, y: 930 }, // CM SW
  { id: 27, x: 1730, y: 930 }, // CM SC
  { id: 28, x: 2030, y: 930 }, // CM SE
];

// Edges: bidirectional connections between nodes
export const ROAD_EDGES = [
  [0,1],[1,2],[0,3],[1,4],[2,5],[3,4],[4,5],
  [3,6],[4,7],[5,8],[6,7],[7,8],
  [2,9],[9,10],[10,11],
  [5,12],[9,12],[12,13],[13,14],[10,13],[11,14],
  [12,15],[13,16],[14,17],[15,16],[16,17],
  [8,15],
  [6,18],[7,19],[8,20],[18,19],[19,20],
  [18,21],[19,22],[20,23],[21,22],[22,23],
  [21,24],[22,25],
  [15,26],[16,27],[17,28],[26,27],[27,28],
  [9,26],[10,27],[11,28],
];

// Build adjacency list
export function buildAdjacency() {
  const adj = new Map();
  for (const node of ROAD_NODES) adj.set(node.id, []);
  for (const [a, b] of ROAD_EDGES) {
    adj.get(a).push(b);
    adj.get(b).push(a);
  }
  return adj;
}

// Find nearest road node to a world position
export function nearestNode(x, y) {
  let best = null;
  let bestDist = Infinity;
  for (const n of ROAD_NODES) {
    const d = (n.x - x) ** 2 + (n.y - y) ** 2;
    if (d < bestDist) { bestDist = d; best = n; }
  }
  return best;
}

// BFS pathfinding on road graph
export function findPath(fromId, toId, adj) {
  if (fromId === toId) return [fromId];
  const visited = new Set([fromId]);
  const prev = new Map();
  const queue = [fromId];
  let qi = 0;
  while (qi < queue.length) {
    const cur = queue[qi++];
    for (const nb of adj.get(cur)) {
      if (visited.has(nb)) continue;
      visited.add(nb);
      prev.set(nb, cur);
      if (nb === toId) {
        const path = [toId];
        let n = toId;
        while (prev.has(n)) { n = prev.get(n); path.push(n); }
        path.reverse();
        return path;
      }
      queue.push(nb);
    }
  }
  return null;
}

// Check if a rect is on any road or sidewalk
export function isOnRoad(x, y, w, h) {
  for (const r of ROADS) {
    if (x < r.x + r.w && x + w > r.x && y < r.y + r.h && y + h > r.y) return true;
  }
  return false;
}

export function isOnSidewalk(x, y, w, h) {
  for (const s of SIDEWALKS) {
    if (x < s.x + s.w && x + w > s.x && y < s.y + s.h && y + h > s.y) return true;
  }
  return false;
}

// Check if a rect collides with any solid (buildings, water, bounds)
export function collidesWithSolid(x, y, w, h) {
  if (x < 0 || y < 0 || x + w > WORLD_W || y + h > WORLD_H) return true;
  for (const b of BUILDINGS) {
    if (x < b.x + b.w && x + w > b.x && y < b.y + b.h && y + h > b.y) return true;
  }
  for (const wt of WATER) {
    if (x < wt.x + wt.w && x + w > wt.x && y < wt.y + wt.h && y + h > wt.y) return true;
  }
  return false;
}

// Get district name for position
export function getDistrict(x, y) {
  for (const d of DISTRICTS) {
    if (x >= d.x && x < d.x + d.w && y >= d.y && y < d.y + d.h) return d.name;
  }
  return 'Pelican Reach';
}
