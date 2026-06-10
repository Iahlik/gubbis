import type { ContextoTurno, GameState, Racion } from '../tipos';
import { clamp } from '../quimica';

const MUMI_POR_GUBBI: Record<Racion, number> = { escasa: 0.6, normal: 1.0, abundante: 1.5 };

/** Fase 2 — Consumo: la tribu come según la ración decidida. El hambre duele. */
export function faseConsumo(estado: GameState, ctx: ContextoTurno): GameState {
  const gubbis = estado.gubbis.map((g) => ({ ...g }));
  const recursos = { ...estado.recursos };
  const necesidad = gubbis.length * MUMI_POR_GUBBI[estado.racion];
  const disponible = recursos.mumi;

  if (disponible >= necesidad) {
    recursos.mumi -= necesidad;
    const efecto = estado.racion === 'abundante' ? +2 : estado.racion === 'escasa' ? -2 : 0;
    for (const g of gubbis) {
      g.animo = clamp(g.animo + efecto, 0, 100);
      g.salud = clamp(g.salud + (estado.racion === 'abundante' ? 1 : 0), 0, 100);
    }
    ctx.log.push(`🍽️ La tribu comió (ración ${estado.racion}): -${necesidad.toFixed(0)} Mumi.`);
  } else {
    const fraccion = disponible / Math.max(1, necesidad);
    recursos.mumi = 0;
    for (const g of gubbis) {
      g.animo = clamp(g.animo - 12 * (1 - fraccion), 0, 100);
      g.salud = clamp(g.salud - 15 * (1 - fraccion), 0, 100);
      g.devocion = clamp(g.devocion - 4 * (1 - fraccion), 0, 100);
    }
    ctx.log.push(`⚠️ ¡No alcanzó la Mumi! La tribu pasa hambre (${(fraccion * 100).toFixed(0)}% de lo necesario).`);
  }
  return { ...estado, gubbis, recursos };
}
