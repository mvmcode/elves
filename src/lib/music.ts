/* music.ts — Oscillator-based 8-bit background music engine for the workshop.
 * Generates a cozy looping melody using Web Audio API with no audio file dependencies.
 * Supports play, pause, stop, and volume control. */

/** Current playback state of the music engine. */
export type MusicPlayState = "stopped" | "playing" | "paused";

/** Music engine singleton state. */
interface MusicState {
  context: AudioContext | null;
  masterGain: GainNode | null;
  playState: MusicPlayState;
  volume: number;
  schedulerTimer: number | null;
  nextNoteTime: number;
  currentStep: number;
}

const state: MusicState = {
  context: null,
  masterGain: null,
  playState: "stopped",
  volume: 0.3,
  schedulerTimer: null,
  nextNoteTime: 0,
  currentStep: 0,
};

/** Tempo in BPM — cozy, not frantic. */
const BPM = 100;
const STEP_DURATION = 60 / BPM / 2; /* Eighth notes */

/** How far ahead to schedule notes (seconds). */
const LOOKAHEAD = 0.1;
/** How often the scheduler runs (ms). */
const SCHEDULER_INTERVAL = 25;

/**
 * Melody pattern — MIDI-style note numbers (0 = rest).
 * A cozy pentatonic workshop melody that loops every 32 steps.
 */
const MELODY: readonly number[] = [
  67, 0, 64, 0, 60, 0, 64, 0,
  67, 0, 72, 0, 71, 0, 67, 0,
  64, 0, 60, 0, 62, 0, 64, 0,
  60, 0, 0, 0, 60, 0, 0, 0,
];

/** Bass line — simple root notes for warmth. */
const BASS: readonly number[] = [
  48, 0, 0, 0, 48, 0, 0, 0,
  52, 0, 0, 0, 52, 0, 0, 0,
  53, 0, 0, 0, 53, 0, 0, 0,
  48, 0, 0, 0, 48, 0, 0, 0,
];

/** Arpeggiated chords — subtle texture layer. */
const ARPEGGIO: readonly number[] = [
  60, 64, 67, 64, 60, 64, 67, 64,
  60, 64, 67, 64, 60, 64, 67, 64,
  65, 69, 72, 69, 65, 69, 72, 69,
  60, 64, 67, 64, 60, 64, 67, 64,
];

/** Convert MIDI note number to frequency in Hz. */
function midiToFreq(note: number): number {
  return 440 * Math.pow(2, (note - 69) / 12);
}

/** Initialize the AudioContext and master gain. */
function ensureContext(): AudioContext {
  if (!state.context) {
    state.context = new AudioContext();
    state.masterGain = state.context.createGain();
    state.masterGain.gain.value = state.volume * 0.15;
    state.masterGain.connect(state.context.destination);
  }
  return state.context;
}

/** Schedule a single note on an oscillator. */
function scheduleNote(
  context: AudioContext,
  freq: number,
  time: number,
  duration: number,
  type: OscillatorType,
  volume: number,
): void {
  if (!state.masterGain) return;

  const osc = context.createOscillator();
  const gain = context.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, time);

  gain.gain.setValueAtTime(volume, time);
  gain.gain.setValueAtTime(volume, time + duration * 0.7);
  gain.gain.linearRampToValueAtTime(0, time + duration);

  osc.connect(gain);
  gain.connect(state.masterGain);

  osc.start(time);
  osc.stop(time + duration);
}

/** Schedule all notes for the current step. */
function scheduleStep(context: AudioContext, time: number, step: number): void {
  const patternStep = step % MELODY.length;

  /* Melody — square wave, classic 8-bit feel */
  const melodyNote = MELODY[patternStep]!;
  if (melodyNote > 0) {
    scheduleNote(context, midiToFreq(melodyNote), time, STEP_DURATION * 0.8, "square", 0.3);
  }

  /* Bass — triangle wave, warm low end */
  const bassNote = BASS[patternStep]!;
  if (bassNote > 0) {
    scheduleNote(context, midiToFreq(bassNote), time, STEP_DURATION * 1.5, "triangle", 0.4);
  }

  /* Arpeggio — sine wave, subtle shimmer */
  const arpNote = ARPEGGIO[patternStep]!;
  if (arpNote > 0) {
    scheduleNote(context, midiToFreq(arpNote + 12), time, STEP_DURATION * 0.5, "sine", 0.1);
  }
}

/** The main scheduler loop — runs on a timer, schedules notes ahead. */
function scheduler(): void {
  const context = state.context;
  if (!context || state.playState !== "playing") return;

  while (state.nextNoteTime < context.currentTime + LOOKAHEAD) {
    scheduleStep(context, state.nextNoteTime, state.currentStep);
    state.nextNoteTime += STEP_DURATION;
    state.currentStep++;
  }
}

/** Start or resume music playback. */
export function playMusic(): void {
  const context = ensureContext();

  if (context.state === "suspended") {
    void context.resume();
  }

  if (state.playState === "paused") {
    /* Resume from where we left off */
    state.nextNoteTime = context.currentTime;
    state.playState = "playing";
  } else if (state.playState === "stopped") {
    state.nextNoteTime = context.currentTime;
    state.currentStep = 0;
    state.playState = "playing";
  } else {
    return; /* Already playing */
  }

  if (state.schedulerTimer !== null) {
    clearInterval(state.schedulerTimer);
  }
  state.schedulerTimer = window.setInterval(scheduler, SCHEDULER_INTERVAL);
}

/** Pause music playback — retains position for resume. */
export function pauseMusic(): void {
  if (state.playState !== "playing") return;
  state.playState = "paused";

  if (state.schedulerTimer !== null) {
    clearInterval(state.schedulerTimer);
    state.schedulerTimer = null;
  }
}

/** Stop music playback — resets to beginning. */
export function stopMusic(): void {
  state.playState = "stopped";

  if (state.schedulerTimer !== null) {
    clearInterval(state.schedulerTimer);
    state.schedulerTimer = null;
  }

  state.currentStep = 0;
  state.nextNoteTime = 0;
}

/** Set music volume (0.0 to 1.0). */
export function setMusicVolume(volume: number): void {
  state.volume = Math.max(0, Math.min(1, volume));
  if (state.masterGain) {
    state.masterGain.gain.setValueAtTime(state.volume * 0.15, state.context?.currentTime ?? 0);
  }
}

/** Get the current music volume (0.0 to 1.0). */
export function getMusicVolume(): number {
  return state.volume;
}

/** Get the current playback state. */
export function getMusicPlayState(): MusicPlayState {
  return state.playState;
}
