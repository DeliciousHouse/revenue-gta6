// Web Audio synthesis: engine, siren, gunfire, ambient, mission sounds.
// Initialized on first user gesture. Mute persists through save.

export function createAudio() {
  let ctx = null;
  let muted = false;
  let initialized = false;
  let masterGain = null;

  // Active sound state
  let engineOsc = null;
  let engineGain = null;
  let sirenOsc = null;
  let sirenGain = null;
  let sirenLfo = null;
  let ambientNode = null;
  let ambientGain = null;

  function init() {
    if (initialized) return;
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      masterGain = ctx.createGain();
      masterGain.gain.value = muted ? 0 : 0.3;
      masterGain.connect(ctx.destination);
      initialized = true;
      startAmbient();
    } catch {
      // Audio unavailable - game remains playable
    }
  }

  function ensureContext() {
    if (!ctx) return false;
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    return true;
  }

  function setMute(m) {
    muted = m;
    if (masterGain) {
      masterGain.gain.value = m ? 0 : 0.3;
    }
  }

  function startAmbient() {
    if (!ensureContext()) return;
    try {
      // Low filtered noise for harbor ambience
      const bufSize = ctx.sampleRate * 2;
      const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < bufSize; i++) {
        data[i] = (Math.random() * 2 - 1) * 0.08;
      }
      ambientNode = ctx.createBufferSource();
      ambientNode.buffer = buf;
      ambientNode.loop = true;

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 200;

      ambientGain = ctx.createGain();
      ambientGain.gain.value = 0.4;

      ambientNode.connect(filter);
      filter.connect(ambientGain);
      ambientGain.connect(masterGain);
      ambientNode.start();
    } catch {
      // ignore
    }
  }

  function updateEngine(speed, active) {
    if (!ensureContext()) return;
    try {
      if (active && speed > 5) {
        if (!engineOsc) {
          engineOsc = ctx.createOscillator();
          engineOsc.type = 'sawtooth';
          engineGain = ctx.createGain();
          engineGain.gain.value = 0;
          engineOsc.connect(engineGain);
          engineGain.connect(masterGain);
          engineOsc.start();
        }
        const freq = 60 + speed * 0.4;
        engineOsc.frequency.setTargetAtTime(freq, ctx.currentTime, 0.05);
        engineGain.gain.setTargetAtTime(Math.min(0.15, speed * 0.001), ctx.currentTime, 0.05);
      } else if (engineOsc) {
        engineGain.gain.setTargetAtTime(0, ctx.currentTime, 0.1);
      }
    } catch {
      // ignore
    }
  }

  function updateSiren(active) {
    if (!ensureContext()) return;
    try {
      if (active) {
        if (!sirenOsc) {
          sirenOsc = ctx.createOscillator();
          sirenOsc.type = 'square';
          sirenOsc.frequency.value = 600;
          sirenGain = ctx.createGain();
          sirenGain.gain.value = 0.06;

          sirenLfo = ctx.createOscillator();
          sirenLfo.type = 'sine';
          sirenLfo.frequency.value = 2;
          const lfoGain = ctx.createGain();
          lfoGain.gain.value = 200;
          sirenLfo.connect(lfoGain);
          lfoGain.connect(sirenOsc.frequency);

          sirenOsc.connect(sirenGain);
          sirenGain.connect(masterGain);
          sirenOsc.start();
          sirenLfo.start();
        }
      } else if (sirenOsc) {
        try {
          sirenOsc.stop();
          sirenLfo.stop();
        } catch { /* */ }
        sirenOsc = null;
        sirenLfo = null;
        sirenGain = null;
      }
    } catch {
      // ignore
    }
  }

  function playShot() {
    if (!ensureContext()) return;
    try {
      const bufSize = ctx.sampleRate * 0.08;
      const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < bufSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.02));
      }
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const g = ctx.createGain();
      g.gain.value = 0.3;
      src.connect(g);
      g.connect(masterGain);
      src.start();
    } catch {
      // ignore
    }
  }

  function playHit() {
    if (!ensureContext()) return;
    try {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = 300;
      const g = ctx.createGain();
      g.gain.value = 0.2;
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      osc.connect(g);
      g.connect(masterGain);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } catch {
      // ignore
    }
  }

  function playSuccess() {
    if (!ensureContext()) return;
    try {
      const notes = [523, 659, 784, 1047];
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        osc.type = 'sine';
        osc.frequency.value = freq;
        const g = ctx.createGain();
        g.gain.value = 0.15;
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.15 + 0.3);
        osc.connect(g);
        g.connect(masterGain);
        osc.start(ctx.currentTime + i * 0.15);
        osc.stop(ctx.currentTime + i * 0.15 + 0.3);
      });
    } catch {
      // ignore
    }
  }

  function suspend() {
    if (ctx && ctx.state === 'running') {
      ctx.suspend().catch(() => {});
    }
  }

  function resume() {
    if (ctx && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
  }

  return {
    init, setMute, updateEngine, updateSiren,
    playShot, playHit, playSuccess,
    suspend, resume,
    get muted() { return muted; },
    get initialized() { return initialized; },
  };
}
