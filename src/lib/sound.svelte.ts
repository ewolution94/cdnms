// Sounds, made on the spot with Web Audio: no files, no third parties. On by default, switched per
// device in Settings (`cdnms:sound`). A browser only plays sound after a tap, so the context starts
// on the first pointer or key press. On a call each device plays its own.

const KEY = 'cdnms:sound';

function stored() {
  try {
    return localStorage.getItem(KEY) !== 'off';
  } catch {
    return true;
  }
}

export const sound = $state({ on: stored() });

export function setSound(on: boolean) {
  sound.on = on;
  try {
    localStorage.setItem(KEY, on ? 'on' : 'off');
  } catch {
    // not kept
  }
}

let ctx: AudioContext | null = null;

function context() {
  if (!sound.on) return null;
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

/** Unlocks audio on the first gesture (browsers start contexts suspended until then). */
export function unlockOnGesture() {
  const go = () => {
    context();
    removeEventListener('pointerdown', go);
    removeEventListener('keydown', go);
  };
  addEventListener('pointerdown', go);
  addEventListener('keydown', go);
}

/** One soft note: a sine with a quick attack and a decay. */
function note(freq: number, at: number, length: number, gain = 0.12, type: OscillatorType = 'sine') {
  const c = context();
  if (!c) return;
  const t = c.currentTime + at;
  const osc = c.createOscillator();
  const amp = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  amp.gain.setValueAtTime(0.0001, t);
  amp.gain.exponentialRampToValueAtTime(gain, t + 0.015);
  amp.gain.exponentialRampToValueAtTime(0.0001, t + length);
  osc.connect(amp).connect(c.destination);
  osc.start(t);
  osc.stop(t + length + 0.05);
}

/** A short burst of noise through a band-pass: a typewriter key, a stamp. */
function click(at: number, freq: number, length = 0.05, gain = 0.18) {
  const c = context();
  if (!c) return;
  const t = c.currentTime + at;
  const frames = Math.max(1, Math.floor(c.sampleRate * length));
  const buffer = c.createBuffer(1, frames, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < frames; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / frames) ** 3;
  const src = c.createBufferSource();
  src.buffer = buffer;
  const band = c.createBiquadFilter();
  band.type = 'bandpass';
  band.frequency.value = freq;
  band.Q.value = 1.2;
  const amp = c.createGain();
  amp.gain.value = gain;
  src.connect(band).connect(amp).connect(c.destination);
  src.start(t);
}

export const play = {
  /** A clue goes out: three typewriter keys and the bell. */
  clue: () => {
    click(0, 2400);
    click(0.09, 2100);
    click(0.17, 2600);
    note(2093, 0.3, 0.35, 0.05);
  },
  /** It's your move: give the clue, or guess. */
  yourTurn: () => {
    note(587.3, 0, 0.14, 0.1, 'triangle');
    note(784, 0.12, 0.24, 0.1, 'triangle');
  },
  /** Your team found one of its agents: the stamp, then a bright note. */
  agent: () => {
    click(0, 180, 0.12, 0.5);
    note(880, 0.06, 0.18);
    note(1318.5, 0.14, 0.3);
  },
  /** A bystander: the stamp, a dull note. */
  bystander: () => {
    click(0, 160, 0.12, 0.45);
    note(220, 0.04, 0.3, 0.08, 'triangle');
  },
  /** The other team's agent. */
  opponent: () => {
    click(0, 160, 0.12, 0.45);
    note(392, 0.05, 0.18, 0.08, 'triangle');
    note(311.1, 0.18, 0.34, 0.08, 'triangle');
  },
  /** The assassin. */
  assassin: () => {
    click(0, 120, 0.25, 0.6);
    [146.8, 155.6, 207.7].forEach((f) => note(f, 0.05, 1.2, 0.07, 'sawtooth'));
  },
  /** The last seconds. */
  tick: () => note(1200, 0, 0.05, 0.05, 'square'),
  /** A case closed. */
  fanfare: () => [523.3, 659.3, 784, 1046.5].forEach((f, i) => note(f, i * 0.12, 0.4, 0.09, 'triangle')),
};
