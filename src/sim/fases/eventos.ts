import type { ContextoTurno, GameState } from '../tipos';
import { rasgo } from '../gubbi';
import { clamp } from '../quimica';

/** Fase 3 — Eventos aleatorios: pequeños giros positivos y negativos. */
export function faseEventos(estado: GameState, ctx: ContextoTurno): GameState {
  if (!ctx.rng.chance(0.35)) return estado;

  const gubbis = estado.gubbis.map((g) => ({ ...g }));
  const recursos = { ...estado.recursos };
  const adultos = gubbis.filter((g) => g.etapa === 'adulto');

  const eventos: Array<() => void> = [
    () => {
      const oro = ctx.rng.entero(5, 15);
      recursos.oro += oro;
      ctx.log.push(`🛶 Comerciantes de otra isla dejaron ${oro} de oro.`);
    },
    () => {
      const extra = ctx.rng.entero(8, 20);
      recursos.mumi += extra;
      ctx.log.push(`☀️ Día radiante: la Mumi maduró de más (+${extra}).`);
    },
    () => {
      const perdida = Math.min(recursos.mumi, ctx.rng.entero(6, 18));
      recursos.mumi -= perdida;
      ctx.log.push(`🐛 Una plaga royó las reservas de Mumi (-${perdida.toFixed(0)}).`);
    },
    () => {
      recursos.conocimiento += 1;
      ctx.log.push(`📜 Un Gubbi curioso descifró marcas antiguas cerca del volcán (+1 Conocimiento).`);
    },
    () => {
      const conflictivos = adultos.filter((g) => rasgo(g, 'caracter') < -0.4);
      if (conflictivos.length >= 2) {
        const [a, b] = [ctx.rng.elegir(conflictivos), ctx.rng.elegir(conflictivos)];
        if (a.id !== b.id) {
          a.animo = clamp(a.animo - 8, 0, 100);
          b.animo = clamp(b.animo - 8, 0, 100);
          ctx.log.push(`💢 Riña entre ${a.nombre} y ${b.nombre}: el campamento quedó tenso.`);
          return;
        }
      }
      recursos.influencia += 1;
      ctx.log.push(`🔥 Noche de fogata: historias y cantos (+1 Influencia).`);
    },
  ];

  ctx.rng.elegir(eventos)();
  return { ...estado, gubbis, recursos };
}
