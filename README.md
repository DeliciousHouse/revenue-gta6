# Breakwater Run

[![make.fun bounty](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![make.fun rank](https://make.fun/badge/gta6-01/DeliciousHouse/revenue-gta6/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard)
[![make.fun reward](https://make.fun/badge/gta6-01/DeliciousHouse/revenue-gta6/reward.svg)](https://make.fun/bounty/gta6-01)

An original top-down open-world crime game set in **Pelican Reach**, a fictional sunlit harbor city. Play as courier **Mara Venn**, caught between a cargo theft ring and crooked harbor security. Contact **Ivo Reed** offers three jobs and a way out.

## Controls

| Action | Key |
|--------|-----|
| Move (on foot) | WASD / Arrow keys |
| Accelerate (in car) | W / Up |
| Brake / Reverse (in car) | S / Down |
| Steer (in car) | A / D |
| Handbrake | Space |
| Enter/Exit car, Interact | E |
| Aim | Mouse |
| Fire (on foot) | Left Click |
| Pause | Esc / P |
| Mute | M |

Menus support Tab/Enter/Space navigation with visible focus indicators.

## Story

Mara Venn is a courier working the docks of Pelican Reach. When a cargo theft ring pulls her in, Ivo Reed — a contact with connections on both sides — offers three jobs as a way out.

**Three districts:**
- **Sunward Quay** — waterfront promenade with quay cranes and the marina
- **Foundry Ward** — cargo sheds and orange freight buildings in the industrial north
- **Canal Market** — awnings, courtyards and narrow streets along the canal bend

**Three missions:**
1. **Borrowed Wheels** — steal a marked Finch and deliver it to the quay garage
2. **Hot Cargo** — take the Hauler, grab the manifest, trigger a police response, lose the heat, then deliver
3. **Last Crossing** — retrieve Ivo's case from Canal Market, deal with the guard, evade police and reach the safehouse

After all three missions, free roam continues with the full city.

## First Mission Tutorial (5 Steps)

1. **Start**: Press New Game. You begin near the safehouse (blue building, east side of the boulevard).
2. **Accept**: Walk to the safehouse and press E to accept "Borrowed Wheels".
3. **Steal**: Head south to the marked Finch (yellow diamond "F" on minimap). Press E near it to enter.
4. **Deliver**: Drive west to the Quay Garage (yellow "G" on minimap). Slow down when you arrive — it won't accept a speeding delivery.
5. **Cash**: Mission complete! $500 earned. Return to safehouse for the next job.

## Systems

- **Three vehicle classes**: Finch (compact, nimble), Hauler (van, slow but tough), Stray (coupe, fast). Each has distinct acceleration, top speed, handling and silhouette.
- **Vehicle physics**: acceleration, drag, braking, reverse, speed-sensitive steering, handbrake, substep collision to prevent tunneling.
- **Traffic**: up to 16 civilian cars follow the road network, slow for obstacles and turn at intersections. Up to 24 pedestrians walk sidewalks and flee nearby violence.
- **Heat 0-3**: witnessed theft, gunfire and harming actors raise heat with a cooldown. Police PATROL/CHASE/SEARCH with line-of-sight through buildings. Break sight, wait ~10 seconds per level to decay. HUD shows "Spotted" or "Searching: Ns".
- **Combat**: mouse-aimed projectile fire on foot with cadence, lifetime, solid/actor hit detection, damage invulnerability. Police fire back and vehicle collisions deal damage.
- **Death/Retry**: at 0 health or wrecked vehicle, retry clears pursuit and places player at safehouse. Completed missions and banked cash are preserved.
- **Upgrade**: spend $800 at the safehouse for a vehicle handling upgrade.

## Save System

- **Key**: `breakwater-run.v1` in localStorage
- **Schema**: `{version:1, completedMissions:0-3, cash:int, upgraded:bool, mute:bool}`
- **Saves on**: mission completion, upgrade purchase, mute toggle
- **Continue**: resumes at safehouse with progress, no heat
- **Limitations**: active mission checkpoints are session-only. If you close the tab mid-mission, you resume at the safehouse with the mission available to restart.
- **Denied storage**: game plays in-memory with "Saving unavailable" notice
- **Malformed data**: shows recovery notice, New Game works

## Module Reference

| File | Purpose |
|------|---------|
| `game/index.html` | Entry point, canvas + DOM overlay |
| `game/style.css` | HUD plates, menus, focus styles, responsive layout |
| `game/main.js` | Game loop, screen FSM, input, camera |
| `game/city.js` | Handcrafted map data, road graph, collision, spawn points |
| `game/world.js` | Player, vehicles, traffic, pedestrians, physics |
| `game/crime.js` | Heat 0-3, police PATROL/CHASE/SEARCH, combat |
| `game/missions.js` | Three mission state machines, rewards, dialogue |
| `game/save.js` | localStorage validation, denial fallback |
| `game/render.js` | Canvas world/HUD/minimap rendering |
| `game/audio.js` | Web Audio synthesis (engine, siren, gunfire, ambient) |
| `main.ts` | Deterministic output: copies game/ + screenshots/ to output, writes dossier.json |
| `test.js` | Node test harness for collision, save, mission, pathfinding logic |
| `serve.ts` | Local dev server for game/ |

## Running Locally

```bash
# Serve the game
node serve.ts
# Open http://localhost:8080 in desktop Chrome

# Run tests
node test.js

# Build output (requires screenshots/ with 3-4 valid JPEG/PNG captures)
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

## Test Results

59 tests covering:
- City collision (bounds, buildings, roads, spawn safety)
- District identification
- Road graph (adjacency, pathfinding, multi-route verification)
- Save validation (actual module: valid data, type checks, range checks, malformed input, corrupt data)
- World (actual module: spawn, mission car lifecycle, driver ownership, traffic behavior)
- Crime (actual module: heat persistence, line-of-sight, projectile hit, pursuit reset)
- Missions (actual module: prerequisites, VEHICLE_TYPES import, Hot Cargo delivery, vehicle leak, rewards)
- 13 regression tests for independently verified production defects

## Original Assets

All city names, characters, vehicles, story, visual art, effects and audio are original.
No commercial game names, logos, characters, maps or assets are used.

- **City**: Pelican Reach (fictional)
- **Characters**: Mara Venn (protagonist), Ivo Reed (contact)
- **Vehicles**: Finch, Hauler, Stray (original names and designs)
- **Art**: Canvas-drawn with original color palette
- **Audio**: Web Audio API synthesized tones (no sampled audio)

## Browser-Verified

Real browser keyboard play at 1280x720 confirmed:
- First mission (Borrowed Wheels): accept, steal Finch, deliver, $500 reward
- Driving physics, enter/exit vehicle
- On-foot firing, HEAT 1 with Search timer decay
- HUD readability (HP, cash, heat stars, objective, minimap with legend)
- Three genuine screenshots captured from browser session

## Unverified Checks

The following require additional browser testing and are not yet verified:
- Full three-mission playthrough (missions 2 and 3)
- Audio listening (Web Audio synthesis)
- Pointer-to-world coordinate mapping at different viewport sizes
- Responsive layout at 1440x900, 1024x768
- Mobile advisory at 390x844
- Web Audio user-gesture initialization
- Reduced-motion preference behavior
- 60-second busy pursuit performance measurement
- Canvas fallback when unavailable
- Unit module tests are not browser proof (run in Node.js)

## License

MIT
