// Save/load with localStorage validation and denial fallback.
// Key: breakwater-run.v1
// Schema: {version:1, completedMissions:0-3, cash:int>=0, upgraded:bool, mute:bool}

const SAVE_KEY = 'breakwater-run.v1';
const MAX_CASH = 999999;

export function createSaveSystem() {
  let storageAvailable = true;
  let saveNotice = '';

  function testStorage() {
    try {
      const test = '__bwr_test__';
      window.localStorage.setItem(test, '1');
      window.localStorage.removeItem(test);
      return true;
    } catch {
      return false;
    }
  }

  storageAvailable = testStorage();
  if (!storageAvailable) {
    saveNotice = 'Saving unavailable; progress lasts this visit.';
  }

  function validate(data) {
    if (!data || typeof data !== 'object') return null;
    if (data.version !== 1) return null;
    const cm = data.completedMissions;
    if (!Number.isInteger(cm) || cm < 0 || cm > 3) return null;
    const cash = data.cash;
    if (!Number.isInteger(cash) || cash < 0 || cash > MAX_CASH || !Number.isFinite(cash)) return null;
    if (typeof data.upgraded !== 'boolean') return null;
    if (typeof data.mute !== 'boolean') return null;
    return {
      version: 1,
      completedMissions: cm,
      cash: cash,
      upgraded: data.upgraded,
      mute: data.mute,
    };
  }

  function load() {
    if (!storageAvailable) return null;
    try {
      const raw = window.localStorage.getItem(SAVE_KEY);
      if (raw === null) return null;
      const parsed = JSON.parse(raw);
      const valid = validate(parsed);
      if (!valid) {
        saveNotice = 'Save data was corrupted. Start a New Game.';
        return null;
      }
      return valid;
    } catch {
      saveNotice = 'Could not read save data. Start a New Game.';
      return null;
    }
  }

  function save(completedMissions, cash, upgraded, mute) {
    const data = {
      version: 1,
      completedMissions: Math.max(0, Math.min(3, completedMissions || 0)),
      cash: Math.max(0, Math.min(MAX_CASH, cash || 0)),
      upgraded: !!upgraded,
      mute: !!mute,
    };
    if (!storageAvailable) return false;
    try {
      window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
      return true;
    } catch {
      saveNotice = 'Saving unavailable; progress lasts this visit.';
      storageAvailable = false;
      return false;
    }
  }

  function hasSave() {
    if (!storageAvailable) return false;
    try {
      const raw = window.localStorage.getItem(SAVE_KEY);
      if (raw === null) return false;
      const parsed = JSON.parse(raw);
      return validate(parsed) !== null;
    } catch {
      return false;
    }
  }

  function clearSave() {
    if (!storageAvailable) return;
    try {
      window.localStorage.removeItem(SAVE_KEY);
    } catch {
      // ignore
    }
  }

  return {
    load, save, hasSave, clearSave, validate,
    get notice() { return saveNotice; },
    set notice(v) { saveNotice = v; },
    get storageAvailable() { return storageAvailable; },
    get completedMissions() { return load()?.completedMissions || 0; },
    get cash() { return load()?.cash || 0; },
    get upgraded() { return load()?.upgraded || false; },
    get mute() { return load()?.mute || false; },
  };
}
