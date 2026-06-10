// Títulos con buff de aura (Handoff §8) + peticiones de voluntad propia (§9).

import type { ContextoTurno, GameState, Rol } from './tipos';
import { clonarGubbi, rasgo, APTITUDES } from './gubbi';
import { clamp } from './quimica';

export const TITULOS = {
  campeon: 'Campeón',
  cultivadora: 'Maestra Cultivadora',
  sacerdote: 'Sumo Sacerdote',
  sabio: 'Anciano Sabio',
} as const;

/** El rol donde brillaría cada aptitud (para peticiones: la petición es una pista). */
const ROL_DE_APTITUD: Record<string, Rol> = {
  inteligencia: 'granja',
  magia: 'templo',
  fortaleza: 'defensa',
  agilidad: 'defensa',
};

/** Fase 7 — Títulos y peticiones: reconocimientos y voluntad propia. */
export function faseTitulos(estado: GameState, ctx: ContextoTurno): GameState {
  const gubbis = estado.gubbis.map(clonarGubbi);
  const recursos = { ...estado.recursos };
  const tiene = (t: string) => gubbis.some((g) => g.titulo === t);

  for (const g of gubbis) {
    if (g.titulo || g.etapa === 'cría') continue;
    let nuevo: string | undefined;
    if (g.etapa === 'anciano' && APTITUDES.some((a) => g.aptitudes[a].valor >= 70) && !tiene(TITULOS.sabio)) {
      nuevo = TITULOS.sabio;
    } else if (g.rolAsignado === 'defensa' && g.aptitudes.fortaleza.valor >= 70 && g.haPeregrinado && !tiene(TITULOS.campeon)) {
      nuevo = TITULOS.campeon;
    } else if (g.rolAsignado === 'granja' && g.aptitudes.inteligencia.valor >= 65 && !tiene(TITULOS.cultivadora)) {
      nuevo = TITULOS.cultivadora;
    } else if (g.rolAsignado === 'templo' && g.aptitudes.magia.valor >= 60 && !tiene(TITULOS.sacerdote)) {
      nuevo = TITULOS.sacerdote;
    }
    if (nuevo) {
      g.titulo = nuevo;
      recursos.prestigio += 2;
      ctx.log.push(`🏅 ¡${g.nombre} se ha ganado el título de ${nuevo}! Su aura inspira a la cuadrilla (+2 Prestigio).`);
    }
  }

  // El Sumo Sacerdote eleva la devoción de toda la tribu, gota a gota
  if (tiene(TITULOS.sacerdote)) {
    for (const g of gubbis) g.devocion = clamp(g.devocion + 0.6, 0, 100);
  }

  // Peticiones: un Gubbi infeliz y mal encajado empuja por cambiar (la petición es una pista)
  const peticiones = estado.peticiones
    .map((pe) => ({ ...pe }))
    .filter((pe) => gubbis.some((g) => g.id === pe.gubbiId)); // limpiar muertos/idos

  for (const g of gubbis) {
    if (g.etapa !== 'adulto' || g.animo >= 48) continue;
    if (peticiones.some((pe) => pe.gubbiId === g.id) || peticiones.length >= 3) continue;
    const mejor = APTITUDES.reduce((m, a) => (g.aptitudes[a].valor > g.aptitudes[m].valor ? a : m), APTITUDES[0]);
    const rolDeseado = ROL_DE_APTITUD[mejor];
    if (!rolDeseado || rolDeseado === g.rolAsignado || g.aptitudes[mejor].valor < 25) continue;
    const insistencia = 0.06 + (rasgo(g, 'devocion') < 0 ? 0.04 : 0); // los escépticos presionan más
    if (ctx.rng.chance(insistencia)) {
      peticiones.push({ gubbiId: g.id, rolDeseado, dia: estado.dia });
      ctx.log.push(`🙏 ${g.nombre} pide trabajar en ${rolDeseado}: dice que ahí está su verdadero talento.`);
    }
  }

  return { ...estado, gubbis, recursos, peticiones };
}
