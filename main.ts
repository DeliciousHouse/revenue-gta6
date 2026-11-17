// Breakwater Run — entry program for gta6-01 competition
// An original open-world crime game set in Pelican Reach, a fictional sunlit harbor city.
// Courier Mara Venn runs three connected missions through Sunward Quay, Foundry Ward
// and Canal Market while evading police and building a reputation.
//
// Three vehicle classes (Finch compact, Hauler van, Stray coupe), heat 0-3 police system,
// mouse-aimed combat, three mission state machines, single-slot save with validation,
// Web Audio synthesis and a handcrafted ~2200x1800 world-unit city.
//
// Deterministic output: copies game/ and screenshots/ to MAKEFUN_OUTPUT_DIR, writes dossier.json.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const TITLE = 'Breakwater Run';
const VERSION = '1.0.0';
const CITY = 'Pelican Reach';
const DISTRICTS = ['Sunward Quay', 'Foundry Ward', 'Canal Market'];
const VEHICLES = ['Finch', 'Hauler', 'Stray'];
const PROTAGONIST = 'Mara Venn';
const CONTACT = 'Ivo Reed';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);

console.log(`${TITLE} v${VERSION} — ${CITY} (${DISTRICTS.join(', ')})`);
console.log(`Protagonist: ${PROTAGONIST} | Contact: ${CONTACT} | Vehicles: ${VEHICLES.join(', ')}`);
console.log(`Output written to ${out}`);
