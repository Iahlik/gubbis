// La isla: terreno determinista por semilla. Vive en el SIM (no en render) porque
// el juego necesita conocerla (¿dónde se puede construir?). El render solo la pinta.

import { crearRng } from './rng';
import type { Rng } from './tipos';

export const ISLA_ANCHO = 30; // en tiles
export const ISLA_ALTO = 20;

export type Tile = 'agua' | 'arena' | 'pasto' | 'bosque' | 'roca';

export const VOLCAN = { x: 24, y: 4 };
export const ALDEA = { x: 12, y: 13 };

export interface MapaIsla {
  tiles: Tile[][];
  rio: { x: number; y: number }[]; // del nacimiento (volcán) a la desembocadura
}

const cache = new Map<number, MapaIsla>();

export function generarMapa(semilla: number): MapaIsla {
  const guardado = cache.get(semilla);
  if (guardado) return guardado;

  const rng = crearRng((semilla ^ 0xa11a) >>> 0);
  const cx = ISLA_ANCHO / 2, cy = ISLA_ALTO / 2;
  const mapa: Tile[][] = [];

  for (let y = 0; y < ISLA_ALTO; y++) {
    const fila: Tile[] = [];
    for (let x = 0; x < ISLA_ANCHO; x++) {
      const dx = (x - cx) / (cx - 1.5);
      const dy = (y - cy) / (cy - 1.5);
      const d = Math.sqrt(dx * dx + dy * dy) + rng.entre(-0.07, 0.07);
      if (d > 1) fila.push('agua');
      else if (d > 0.86) fila.push('arena');
      else fila.push('pasto');
    }
    mapa.push(fila);
  }

  // Falda rocosa alrededor del volcán
  for (let y = 0; y < ISLA_ALTO; y++) {
    for (let x = 0; x < ISLA_ANCHO; x++) {
      const d = Math.hypot(x - VOLCAN.x, y - VOLCAN.y);
      if (d < 3.2 && mapa[y][x] === 'pasto') mapa[y][x] = 'roca';
    }
  }

  // Río: nace en la falda del volcán y serpentea hasta el mar
  const rio: { x: number; y: number }[] = [];
  let rx = VOLCAN.x - 3, ry = VOLCAN.y + 3;
  for (let paso = 0; paso < 80; paso++) {
    if (rx < 0 || ry >= ISLA_ALTO || rx >= ISLA_ANCHO || ry < 0) break;
    if (mapa[ry][rx] === 'agua') break;
    if (mapa[ry][rx] !== 'roca') { mapa[ry][rx] = 'agua'; rio.push({ x: rx, y: ry }); }
    const cercaAldea = Math.hypot(rx - ALDEA.x, ry - ALDEA.y) < 2.5;
    const r = rng.next();
    if (cercaAldea || r < 0.55) ry += 1;
    else if (r < 0.85) rx -= 1;
    else rx += 1;
  }

  // Bosques dispersos en el pasto (lejos de la aldea)
  for (let i = 0; i < 90; i++) {
    const x = rng.entero(1, ISLA_ANCHO - 2);
    const y = rng.entero(1, ISLA_ALTO - 2);
    if (mapa[y][x] === 'pasto' && Math.hypot(x - ALDEA.x, y - ALDEA.y) > 3.5 &&
        Math.hypot(x - VOLCAN.x, y - VOLCAN.y) > 4.5 && rng.chance(0.5)) {
      mapa[y][x] = 'bosque';
    }
  }

  const resultado = { tiles: mapa, rio };
  cache.set(semilla, resultado);
  return resultado;
}

/** Una posición de pasto firme, opcionalmente cerca de un punto. Para construir. */
export function posicionEnTierra(
  semilla: number,
  rng: Rng,
  cerca?: { x: number; y: number },
  radio = 5,
): { x: number; y: number } {
  const { tiles } = generarMapa(semilla);
  for (let intento = 0; intento < 60; intento++) {
    const x = cerca
      ? Math.max(1, Math.min(ISLA_ANCHO - 2, cerca.x + rng.entero(-radio, radio)))
      : rng.entero(2, ISLA_ANCHO - 3);
    const y = cerca
      ? Math.max(1, Math.min(ISLA_ALTO - 2, cerca.y + rng.entero(-radio, radio)))
      : rng.entero(2, ISLA_ALTO - 3);
    if (tiles[y][x] === 'pasto') return { x, y };
  }
  return { ...ALDEA }; // siempre hay aldea
}
