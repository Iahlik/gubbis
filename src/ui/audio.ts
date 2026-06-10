'use client';

// Sonido sintetizado con Web Audio: cero assets, cero descargas.
// Tambores para el día, rugido para la oleada, pop para la eclosión.

let ctx: AudioContext | null = null;
let silencio = false;

export function setSilencio(s: boolean) { silencio = s; }
export function getSilencio() { return silencio; }

function ac(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  try {
    if (!ctx) ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    if (ctx.state === 'suspended') void ctx.resume();
    return ctx;
  } catch { return null; }
}

function tono(freqInicio: number, freqFin: number, dur: number, vol: number, tipo: OscillatorType = 'sine') {
  const a = ac(); if (!a || silencio) return;
  const osc = a.createOscillator();
  const gain = a.createGain();
  osc.type = tipo;
  osc.frequency.setValueAtTime(freqInicio, a.currentTime);
  osc.frequency.exponentialRampToValueAtTime(Math.max(20, freqFin), a.currentTime + dur);
  gain.gain.setValueAtTime(vol, a.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, a.currentTime + dur);
  osc.connect(gain).connect(a.destination);
  osc.start();
  osc.stop(a.currentTime + dur + 0.05);
}

function ruido(dur: number, vol: number, freqFiltro: number) {
  const a = ac(); if (!a || silencio) return;
  const frames = Math.floor(a.sampleRate * dur);
  const buffer = a.createBuffer(1, frames, a.sampleRate);
  const datos = buffer.getChannelData(0);
  for (let i = 0; i < frames; i++) datos[i] = (Math.random() * 2 - 1) * (1 - i / frames);
  const src = a.createBufferSource();
  src.buffer = buffer;
  const filtro = a.createBiquadFilter();
  filtro.type = 'lowpass';
  filtro.frequency.setValueAtTime(freqFiltro, a.currentTime);
  filtro.frequency.exponentialRampToValueAtTime(80, a.currentTime + dur);
  const gain = a.createGain();
  gain.gain.setValueAtTime(vol, a.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, a.currentTime + dur);
  src.connect(filtro).connect(gain).connect(a.destination);
  src.start();
}

export const sonido = {
  click: () => tono(440, 330, 0.07, 0.12, 'square'),
  /** El tambor del fin del día. */
  tambor: () => { tono(120, 45, 0.28, 0.5); setTimeout(() => tono(100, 40, 0.32, 0.4), 180); },
  /** Latidos graves: la oleada se acerca. */
  alerta: () => { tono(75, 40, 0.22, 0.55); setTimeout(() => tono(70, 38, 0.26, 0.45), 240); },
  /** El rugido de la oleada. */
  rugido: () => { ruido(1.3, 0.5, 420); tono(90, 30, 1.1, 0.35, 'sawtooth'); },
  /** Eclosión y cosas alegres. */
  pop: () => tono(520, 940, 0.12, 0.2),
  fanfarria: () => { tono(523, 523, 0.12, 0.18, 'triangle'); setTimeout(() => tono(659, 659, 0.12, 0.18, 'triangle'), 130); setTimeout(() => tono(784, 784, 0.22, 0.2, 'triangle'), 260); },
};
