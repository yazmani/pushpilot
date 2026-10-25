import { browser } from 'wxt/browser';

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

function play(choice: string, src?: string | null) {
  if (choice === 'custom' && src) {
    const el = new Audio(src);
    el.volume = 0.8;
    void el.play().catch(() => synth(SOUNDS.takeoff!));
    return;
  }
  synth(SOUNDS[choice] ?? SOUNDS.takeoff!);
}

const area = document.getElementById('clip') as HTMLTextAreaElement;

// Offscreen documents can't take focus, so the async Clipboard API is
// unavailable; execCommand on a textarea is the supported route.
function copy(text: string) {
  area.value = text;
  area.select();
  document.execCommand('copy');
  area.value = '';
}

function paste(): string {
  area.value = '';
  area.focus();
  document.execCommand('paste');
  const text = area.value;
  area.value = '';
  return text;
}

browser.runtime.onMessage.addListener((msg: unknown, _sender, sendResponse) => {
  const m = msg as { offscreen?: boolean; action?: string; text?: string; choice?: string; src?: string | null };
  if (!m?.offscreen) return;
  if (m.action === 'sound') play(m.choice ?? 'takeoff', m.src);
  if (m.action === 'copy' && m.text) copy(m.text);
  if (m.action === 'paste') {
    sendResponse(paste());
    return;
  }
  sendResponse(true);
});
