// Notification sounds and clipboard access. They need a DOM, so they run in
// Chrome's offscreen page, or directly in Firefox's background page.

let audio: AudioContext | null = null;

interface Note {
  freq: number;
  at: number;
  length: number;
  type?: OscillatorType;
  glide?: number;
}

// Notification sounds are synthesised, so there's no audio to ship.
const SOUNDS: Record<string, Note[]> = {
  // Takeoff: a quick tone that climbs a fifth.
  takeoff: [
    { freq: 880, at: 0, length: 0.32, glide: 0.94 },
    { freq: 1318.5, at: 0.085, length: 0.32, glide: 0.94 },
  ],
  // Three soft notes, rising.
  chime: [
    { freq: 784, at: 0, length: 0.5 },
    { freq: 988, at: 0.11, length: 0.5 },
    { freq: 1175, at: 0.22, length: 0.7 },
  ],
  // One short bubble pop.
  pop: [{ freq: 520, at: 0, length: 0.12, glide: 1.9 }],
  // A single bell-like ding.
  ding: [
    { freq: 1568, at: 0, length: 0.9 },
    { freq: 3136, at: 0, length: 0.35 },
  ],
};

function synth(notes: Note[]) {
  audio ??= new AudioContext();
  const ctx = audio;
  const now = ctx.currentTime;
  const out = ctx.createGain();
  out.gain.value = 0.18;
  out.connect(ctx.destination);
  for (const n of notes) {
    const start = now + n.at;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = n.type ?? 'sine';
    osc.frequency.setValueAtTime(n.freq * (n.glide ?? 1), start);
    osc.frequency.exponentialRampToValueAtTime(n.freq, start + 0.04);
    env.gain.setValueAtTime(0.0001, start);
    env.gain.exponentialRampToValueAtTime(1, start + 0.008);
    env.gain.exponentialRampToValueAtTime(0.0001, start + n.length);
    osc.connect(env).connect(out);
    osc.start(start);
    osc.stop(start + n.length + 0.02);
  }
}

export function play(choice: string, src?: string | null) {
  if (choice === 'custom' && src) {
    const el = new Audio(src);
    el.volume = 0.8;
    void el.play().catch(() => synth(SOUNDS.takeoff!));
    return;
  }
  synth(SOUNDS[choice] ?? SOUNDS.takeoff!);
}

// A hidden textarea to copy from and paste into, created on first use.
let area: HTMLTextAreaElement | null = null;
function textarea() {
  if (!area) {
    area = document.createElement('textarea');
    area.setAttribute('aria-hidden', 'true');
    area.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
    document.body.append(area);
  }
  return area;
}

// Offscreen documents (Chrome) and background pages (Firefox) can't take
// focus, so the async Clipboard API is unavailable; execCommand on a textarea
// is the supported route in both.
export function copy(text: string) {
  const el = textarea();
  el.value = text;
  el.select();
  document.execCommand('copy');
  el.value = '';
}

export function paste(): string {
  const el = textarea();
  el.value = '';
  el.focus();
  document.execCommand('paste');
  const text = el.value;
  el.value = '';
  return text;
}
