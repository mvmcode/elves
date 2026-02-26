/* Sound engine — Web Audio API oscillator-based sounds with no audio file dependencies. */

/** All available sound effect names. */
export type SoundName = "spawn" | "typing" | "complete" | "error" | "chat" | "deploy";

/** Global sound settings. */
interface SoundSettings {
  enabled: boolean;
  volume: number;
}

const settings: SoundSettings = {
  enabled: true,
  volume: 0.5,
};

/** Lazily-initialized AudioContext (created on first user interaction). */
let audioContext: AudioContext | null = null;

/** Returns the shared AudioContext, creating it on first call. */
function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined" || !window.AudioContext) {
    return null;
  }
  if (!audioContext) {
    audioContext = new AudioContext();
  }
  return audioContext;
}

/** Set whether sounds are enabled globally. */
export function setSoundEnabled(enabled: boolean): void {
  settings.enabled = enabled;
}

/** Set the global volume (0.0 to 1.0). */
export function setSoundVolume(volume: number): void {
  settings.volume = Math.max(0, Math.min(1, volume));
}

/** Returns whether sounds are currently enabled. */
export function isSoundEnabled(): boolean {
  return settings.enabled;
}

/** Returns the current volume level (0.0 to 1.0). */
export function getSoundVolume(): number {
  return settings.volume;
}

/**
 * Creates a gain node connected to the audio context destination with the current volume.
 * @param context - The AudioContext to use
 */
function createGain(context: AudioContext): GainNode {
  const gain = context.createGain();
  gain.gain.value = settings.volume * 0.3; /* Scale down to avoid being too loud */
  gain.connect(context.destination);
  return gain;
}

/** Spawn sound: sine wave 400Hz -> 800Hz sweep over 200ms. */
function playSpawn(context: AudioContext): void {
  const oscillator = context.createOscillator();
  const gain = createGain(context);
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(400, context.currentTime);
  oscillator.frequency.linearRampToValueAtTime(800, context.currentTime + 0.2);
  gain.gain.setValueAtTime(settings.volume * 0.3, context.currentTime);
  gain.gain.linearRampToValueAtTime(0, context.currentTime + 0.2);
  oscillator.connect(gain);
  oscillator.start(context.currentTime);
  oscillator.stop(context.currentTime + 0.2);
}

/** Typing sound: short click at 800Hz, 50ms. */
function playTyping(context: AudioContext): void {
  const oscillator = context.createOscillator();
  const gain = createGain(context);
  oscillator.type = "square";
  oscillator.frequency.setValueAtTime(800, context.currentTime);
  gain.gain.setValueAtTime(settings.volume * 0.1, context.currentTime);
  gain.gain.linearRampToValueAtTime(0, context.currentTime + 0.05);
  oscillator.connect(gain);
  oscillator.start(context.currentTime);
  oscillator.stop(context.currentTime + 0.05);
}

/** Complete sound: C-E-G ascending chord (523Hz, 659Hz, 784Hz). */
function playComplete(context: AudioContext): void {
  const notes = [523, 659, 784];
  const durations = [0.1, 0.1, 0.2];
  let offset = 0;

  for (let i = 0; i < notes.length; i++) {
    const oscillator = context.createOscillator();
    const gain = createGain(context);
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(notes[i]!, context.currentTime + offset);
    gain.gain.setValueAtTime(settings.volume * 0.25, context.currentTime + offset);
    gain.gain.linearRampToValueAtTime(0, context.currentTime + offset + durations[i]!);
    oscillator.connect(gain);
    oscillator.start(context.currentTime + offset);
    oscillator.stop(context.currentTime + offset + durations[i]!);
    offset += durations[i]!;
  }
}

/** Error sound: sawtooth 400Hz -> 200Hz sweep over 300ms. */
function playError(context: AudioContext): void {
  const oscillator = context.createOscillator();
  const gain = createGain(context);
  oscillator.type = "sawtooth";
  oscillator.frequency.setValueAtTime(400, context.currentTime);
  oscillator.frequency.linearRampToValueAtTime(200, context.currentTime + 0.3);
  gain.gain.setValueAtTime(settings.volume * 0.2, context.currentTime);
  gain.gain.linearRampToValueAtTime(0, context.currentTime + 0.3);
  oscillator.connect(gain);
  oscillator.start(context.currentTime);
  oscillator.stop(context.currentTime + 0.3);
}

/** Chat sound: soft pop at 600Hz, 100ms. */
function playChat(context: AudioContext): void {
  const oscillator = context.createOscillator();
  const gain = createGain(context);
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(600, context.currentTime);
  oscillator.frequency.linearRampToValueAtTime(400, context.currentTime + 0.1);
  gain.gain.setValueAtTime(settings.volume * 0.2, context.currentTime);
  gain.gain.linearRampToValueAtTime(0, context.currentTime + 0.1);
  oscillator.connect(gain);
  oscillator.start(context.currentTime);
  oscillator.stop(context.currentTime + 0.1);
}

/** Deploy sound: rising whoosh, sine sweep 200Hz -> 1200Hz over 500ms. */
function playDeploy(context: AudioContext): void {
  const oscillator = context.createOscillator();
  const gain = createGain(context);
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(200, context.currentTime);
  oscillator.frequency.exponentialRampToValueAtTime(1200, context.currentTime + 0.5);
  gain.gain.setValueAtTime(settings.volume * 0.15, context.currentTime);
  gain.gain.linearRampToValueAtTime(settings.volume * 0.3, context.currentTime + 0.25);
  gain.gain.linearRampToValueAtTime(0, context.currentTime + 0.5);
  oscillator.connect(gain);
  oscillator.start(context.currentTime);
  oscillator.stop(context.currentTime + 0.5);
}

/** Map of sound names to their play functions. */
const SOUND_PLAYERS: Record<SoundName, (context: AudioContext) => void> = {
  spawn: playSpawn,
  typing: playTyping,
  complete: playComplete,
  error: playError,
  chat: playChat,
  deploy: playDeploy,
};

/**
 * Plays a named sound effect using Web Audio API oscillators.
 * Does nothing if sounds are disabled or AudioContext is unavailable.
 * @param name - The sound effect to play
 */
export function playSound(name: SoundName): void {
  if (!settings.enabled) return;

  const context = getAudioContext();
  if (!context) return;

  /* Resume audio context if it was suspended (browser autoplay policy) */
  if (context.state === "suspended") {
    void context.resume();
  }

  const player = SOUND_PLAYERS[name];
  player(context);
}

/** All valid sound names, exported for testing and iteration. */
export const ALL_SOUND_NAMES: readonly SoundName[] = [
  "spawn",
  "typing",
  "complete",
  "error",
  "chat",
  "deploy",
] as const;
