import type { Rng } from './tipos';

// mulberry32: RNG con semilla, rápido y determinista.
// Imprescindible para testear balance, reproducir bugs y guardar/cargar (Handoff §15).
export function crearRng(semilla: number): Rng {
  let a = semilla >>> 0;
  const next = () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    entre: (min, max) => min + next() * (max - min),
    entero: (min, max) => Math.floor(min + next() * (max - min + 1)),
    chance: (p) => next() < p,
    elegir: (arr) => arr[Math.floor(next() * arr.length)],
  };
}

// RNG derivado por turno: mismo estado + mismo día => mismos eventos.
export function rngDeTurno(semilla: number, dia: number): Rng {
  return crearRng((semilla ^ Math.imul(dia + 1, 0x9e3779b1)) >>> 0);
}
