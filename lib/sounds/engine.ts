/**
 * Hisaabook sound engine — Web Audio synthesis, zero audio assets.
 * Lazy AudioContext on first user gesture; master gain → dynamics compressor → out.
 * Persisted preference: localStorage 'hissabook:sound:v1'.
 */

export type SoundState = {
  enabled: boolean;
  /** 0 = low, 1 = medium, 2 = full */
  volume: 0 | 1 | 2;
  haptics: boolean;
};

const STORAGE_KEY = 'hissabook:sound:v1';
const VOLUME_MAP = [0.28, 0.55, 0.85] as const;
export const DEFAULT_SOUND_STATE: SoundState = { enabled: true, volume: 1, haptics: true };

let audioContext: AudioContext | null = null;
let masterGain: GainNode | null = null;
let state: SoundState = { ...DEFAULT_SOUND_STATE };
let restored = false;
const listeners = new Set<(s: SoundState) => void>();

function loadState(): SoundState {
  if (typeof window === 'undefined') return { ...DEFAULT_SOUND_STATE };
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_SOUND_STATE };
    const parsed = JSON.parse(raw) as Partial<SoundState>;
    return {
      enabled: typeof parsed.enabled === 'boolean' ? parsed.enabled : true,
      volume: parsed.volume === 0 || parsed.volume === 2 ? parsed.volume : 1,
      haptics: typeof parsed.haptics === 'boolean' ? parsed.haptics : true,
    };
  } catch {
    return { ...DEFAULT_SOUND_STATE };
  }
}

function persist() {
  if (typeof window === 'undefined') return;
  try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* private mode */ }
  document.documentElement.dataset.sound = state.enabled ? 'on' : 'off';
  listeners.forEach((fn) => fn(state));
}

export function getSoundState(): SoundState {
  if (!restored) { state = loadState(); restored = true; }
  return state;
}

export function setSoundState(patch: Partial<SoundState>) {
  if (!restored) { state = loadState(); restored = true; }
  state = { ...state, ...patch };
  applyMasterVolume();
  persist();
}

export function subscribeSoundState(fn: (s: SoundState) => void): () => void {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key !== STORAGE_KEY) return;
    state = loadState();
    applyMasterVolume();
    document.documentElement.dataset.sound = state.enabled ? 'on' : 'off';
    listeners.forEach((fn) => fn(state));
  });
}

function applyMasterVolume() {
  if (masterGain && audioContext) {
    masterGain.gain.setTargetAtTime(state.enabled ? VOLUME_MAP[state.volume] : 0, audioContext.currentTime, 0.02);
  }
}

export function ensureAudio(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!restored) { state = loadState(); restored = true; }
  if (!state.enabled) return null;
  if (!audioContext) {
    const Ctor: typeof AudioContext | undefined = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    audioContext = new Ctor();
    masterGain = audioContext.createGain();
    const compressor = audioContext.createDynamicsCompressor();
    compressor.threshold.value = -18;
    compressor.knee.value = 12;
    compressor.ratio.value = 6;
    masterGain.gain.value = VOLUME_MAP[state.volume];
    masterGain.connect(compressor);
    compressor.connect(audioContext.destination);
  }
  if (audioContext.state === 'suspended') void audioContext.resume();
  return audioContext;
}

/** Master output bus for cues. Null when sound is disabled/unavailable. */
export function output(): GainNode | null {
  ensureAudio();
  return masterGain;
}

/** Fire-and-forget one-shot oscillator with exponential decay envelope. */
export function tone({
  freq, endFreq, type = 'sine', attack = 0.008, decay = 0.3, gain = 0.16, when = 0, detune = 0,
}: {
  freq: number; endFreq?: number; type?: OscillatorType; attack?: number; decay?: number;
  gain?: number; when?: number; detune?: number;
}) {
  const ctx = ensureAudio(); const out = masterGain;
  if (!ctx || !out) return;
  const t0 = ctx.currentTime + when;
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, t0 + attack + decay * 0.6);
  osc.detune.value = detune;
  amp.gain.setValueAtTime(0, t0);
  amp.gain.linearRampToValueAtTime(gain, t0 + attack);
  amp.gain.exponentialRampToValueAtTime(0.0008, t0 + attack + decay);
  osc.connect(amp); amp.connect(out);
  osc.start(t0); osc.stop(t0 + attack + decay + 0.02);
}

/** Shaped noise burst (whoosh / register cha-ching body). */
export function noiseSweep({
  from = 400, to = 1800, duration = 0.22, gain = 0.12, when = 0, type = 'bandpass', q = 1.1,
}: {
  from?: number; to?: number; duration?: number; gain?: number; when?: number; type?: BiquadFilterType; q?: number;
}) {
  const ctx = ensureAudio(); const out = masterGain;
  if (!ctx || !out) return;
  const t0 = ctx.currentTime + when;
  const bufferSize = Math.max(1, Math.floor(ctx.sampleRate * duration));
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
  const src = ctx.createBufferSource(); src.buffer = buffer;
  const filter = ctx.createBiquadFilter(); filter.type = type; filter.Q.value = q;
  filter.frequency.setValueAtTime(from, t0);
  filter.frequency.exponentialRampToValueAtTime(Math.max(40, to), t0 + duration);
  const amp = ctx.createGain();
  amp.gain.setValueAtTime(0, t0);
  amp.gain.linearRampToValueAtTime(gain, t0 + duration * 0.25);
  amp.gain.exponentialRampToValueAtTime(0.0008, t0 + duration);
  src.connect(filter); filter.connect(amp); amp.connect(out);
  src.start(t0); src.stop(t0 + duration + 0.02);
}

/** Inharmonic metallic hit — cash-register / ledger confirmations. */
export function metallicHit(baseFreq: number, gain = 0.14, when = 0) {
  const partials = [1, 2.51, 4.18, 5.43];
  const weights = [1, 0.55, 0.32, 0.18];
  partials.forEach((partial, i) => {
    tone({ freq: baseFreq * partial, type: 'sine', attack: 0.004, decay: 0.34 - i * 0.06, gain: gain * weights[i], when, detune: i * 3 });
  });
}
