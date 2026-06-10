// Capa de render del mapa: SOLO presentación. El terreno vive en el sim
// (src/sim/isla.ts) porque el juego necesita conocerlo para construir.

import type { Edificio, Rol } from '@/sim';
import { ALDEA, ISLA_ALTO, ISLA_ANCHO } from '@/sim';

export { generarMapa, VOLCAN, ALDEA } from '@/sim';
export type { Tile, MapaIsla } from '@/sim';

export const ANCHO = ISLA_ANCHO;
export const ALTO = ISLA_ALTO;
export const TILE = 24; // px

/** Zona donde "vive" cada rol: el sprite del Gubbi deambula cerca de ella. */
export function zonaDeRol(rol: Rol, edificios: Edificio[]): { x: number; y: number } {
  const edif = (tipo: string) => edificios.find((e) => e.tipo === tipo)?.posicion;
  const porDefecto: Record<Rol, { x: number; y: number }> = {
    granja: { x: 7, y: 14 },
    'leñador': { x: 5, y: 7 },
    mina: { x: 21, y: 8 },
    templo: { x: 15, y: 10 },
    defensa: { x: 18, y: 9 },
    descanso: ALDEA,
  };
  const anclas: Partial<Record<Rol, { x: number; y: number } | undefined>> = {
    granja: edif('granja'),
    'leñador': edif('aserradero'),
    mina: edif('mina'),
    templo: edif('templo'),
    defensa: edif('cuartel'),
  };
  return anclas[rol] ?? porDefecto[rol];
}

export const COLOR_TILE: Record<string, number> = {
  agua: 0x1d4e5e, arena: 0xd9b380, pasto: 0x4f7a3a, bosque: 0x35592a, roca: 0x6b5b50,
};

/** Color del cuerpo según aptitud dominante: la personalidad debe leerse de lejos. */
export const COLOR_APTITUD: Record<string, number> = {
  fortaleza: 0xe2604a, agilidad: 0x9fd06b, magia: 0xc9a3ff, inteligencia: 0x6fc2cf,
};
