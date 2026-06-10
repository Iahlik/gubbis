// Sílabas para nombrar Gubbis de forma procedural y legible.
const INICIOS = ['Mu', 'Gu', 'Ta', 'Pi', 'Ko', 'Lu', 'Bra', 'Ni', 'Zu', 'Fa', 'Ro', 'Ye'];
const MEDIOS = ['mi', 'bbi', 'ra', 'lo', 'ki', 'na', 'po', 'ru', 'ta', 'shi'];
const FINALES = ['', 'n', 'k', 'sh', 'm', 'r'];

import type { Rng } from './tipos';

export function generarNombre(rng: Rng): string {
  return rng.elegir(INICIOS) + rng.elegir(MEDIOS) + rng.elegir(FINALES);
}
