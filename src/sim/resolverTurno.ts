import type { ContextoTurno, Decision, GameState } from './tipos';
import { rngDeTurno } from './rng';
import { faseProduccion } from './fases/produccion';
import { faseConsumo } from './fases/consumo';
import { faseEventos } from './fases/eventos';
import { faseOleada } from './fases/oleada';
import { faseVida, faseEnvejecimiento } from './fases/vida';
import { faseTitulos } from './titulos';
import { CATALOGO_EDIFICIOS } from './edificios';
import { clamp } from './quimica';
import { rasgo } from './gubbi';
import { COSTO_HUEVO } from './edificios';
import { posicionEnTierra, ALDEA } from './isla';

/** La pareja con mejor ánimo conjunto, si existe. */
function mejorPareja(s: GameState): [string, string] | undefined {
  let mejor: [string, string] | undefined;
  let mejorAnimo = -1;
  const vistos = new Set<string>();
  for (const g of s.gubbis) {
    const par = g.relaciones.find((r) => r.tipo === 'pareja');
    if (!par || vistos.has(g.id) || vistos.has(par.conId)) continue;
    vistos.add(g.id); vistos.add(par.conId);
    const otro = s.gubbis.find((x) => x.id === par.conId);
    if (!otro) continue;
    const animo = g.animo + otro.animo;
    if (animo > mejorAnimo) { mejorAnimo = animo; mejor = [g.id, otro.id]; }
  }
  return mejor;
}

/**
 * Corazón del juego — función pura (Handoff §13):
 *   nuevoEstado = resolverTurno(estadoActual, decisionesDelJugador)
 *
 * Turno = secuencia de fases puras ordenadas (§15):
 *   decisiones → producción → consumo → eventos → oleada → vida → envejecimiento → stats
 */
export function resolverTurno(estado: GameState, decisiones: Decision[]): GameState {
  if (estado.estado !== 'jugando') return estado;

  const ctx: ContextoTurno = { rng: rngDeTurno(estado.semilla, estado.dia), log: [] };
  ctx.log.push(`— Día ${estado.dia + 1} —`);

  let s = aplicarDecisiones(estado, decisiones, ctx);
  s = faseProduccion(s, ctx);
  s = faseConsumo(s, ctx);
  s = faseEventos(s, ctx);
  s = faseOleada(s, ctx);
  s = faseVida(s, ctx);
  s = faseEnvejecimiento(s, ctx);
  s = faseTitulos(s, ctx);
  s = recalcularStats(s, ctx);
  s = chequearFin(s, ctx);

  const HITOS = ['🏅', '🐣', '🕯️', '⛵', '💞', '👑', '🦖', '🌋'];
  const hitos = ctx.log
    .filter((l) => HITOS.some((h) => l.includes(h)) && !l.includes('retumba'))
    .map((l) => `Día ${s.dia + 1}: ${l}`);
  const cronica = [...s.cronica, ...hitos].slice(-300);

  return { ...s, dia: s.dia + 1, log: ctx.log, cronica };
}

function aplicarDecisiones(estado: GameState, decisiones: Decision[], ctx: ContextoTurno): GameState {
  let s: GameState = {
    ...estado,
    gubbis: estado.gubbis.map((g) => ({ ...g })),
    recursos: { ...estado.recursos },
    edificios: estado.edificios.map((e) => ({ ...e })),
    siembras: estado.siembras.map((x) => ({ ...x })),
    huevos: estado.huevos.map((x) => ({ ...x })),
    peticiones: estado.peticiones.map((x) => ({ ...x })),
  };

  for (const d of decisiones) {
    switch (d.tipo) {
      case 'racion':
        s.racion = d.nivel;
        break;
      case 'sembrar': {
        const cant = Math.min(Math.max(0, Math.floor(d.cantidad)), Math.floor(s.recursos.mumi));
        if (cant > 0) {
          s.recursos.mumi -= cant;
          s.siembras.push({ diaCosecha: s.dia + 5, mumiInvertida: cant });
          ctx.log.push(`🌱 Sembraste ${cant} de Mumi (cosecha el día ${s.dia + 5}).`);
        }
        break;
      }
      case 'construir': {
        const costo = CATALOGO_EDIFICIOS[d.edificio];
        if (s.recursos.madera >= costo.madera && s.recursos.piedra >= costo.piedra && s.recursos.oro >= costo.oro) {
          s.recursos.madera -= costo.madera;
          s.recursos.piedra -= costo.piedra;
          s.recursos.oro -= costo.oro;
          s.edificios.push({ tipo: d.edificio, nivel: 1, posicion: posicionEnTierra(s.semilla, ctx.rng, ALDEA, 6) });
          ctx.log.push(`🏗️ Se construyó un ${d.edificio}.`);
        } else {
          ctx.log.push(`❌ No alcanzan los recursos para construir ${d.edificio}.`);
        }
        break;
      }
      case 'bendecirHuevo': {
        const c = COSTO_HUEVO;
        if (s.recursos.mumi >= c.mumi && s.recursos.fe >= c.fe) {
          s.recursos.mumi -= c.mumi;
          s.recursos.fe -= c.fe;
          // Si hay una pareja feliz, el huevo es suyo (la cría hereda); si no, lo crea el dios.
          const pareja = mejorPareja(s);
          s.huevos.push({
            id: `h${s.dia}-${Math.floor(ctx.rng.next() * 1e6).toString(36)}`,
            diaEclosion: s.dia + 3,
            padresIds: pareja,
          });
          ctx.log.push(pareja
            ? `🥚 Bendijiste un huevo: una pareja lo cuidará en el nido (eclosiona el día ${s.dia + 3}).`
            : `🥚 Bendijiste un huevo surgido de tu voluntad (eclosiona el día ${s.dia + 3}).`);
        } else {
          ctx.log.push(`❌ Bendecir un huevo requiere ${c.mumi} de Mumi y ${c.fe} de Fe.`);
        }
        break;
      }
      case 'resolverPeticion': {
        const idx = s.peticiones.findIndex((pe) => pe.gubbiId === d.gubbiId);
        const g = s.gubbis.find((x) => x.id === d.gubbiId);
        if (idx < 0 || !g) break;
        const pe = s.peticiones[idx];
        s.peticiones = s.peticiones.filter((_, i) => i !== idx);
        if (d.respuesta === 'permitir') {
          g.rolAsignado = pe.rolDeseado;
          g.animo = clamp(g.animo + 15, 0, 100);
          g.devocion = clamp(g.devocion + 6, 0, 100);
          ctx.log.push(`🌱 Permitiste que ${g.nombre} pase a ${pe.rolDeseado}. Se le ve radiante.`);
        } else {
          const esceptico = rasgo(g, 'devocion') < -0.3;
          g.animo = clamp(g.animo - 12, 0, 100);
          g.devocion = clamp(g.devocion - (esceptico ? 15 : 6), 0, 100);
          ctx.log.push(`😞 Negaste la petición de ${g.nombre}.${esceptico ? ' Murmura contra su dios.' : ' Acata, cabizbajo.'}`);
        }
        break;
      }
      case 'asignarRol': {
        const g = s.gubbis.find((x) => x.id === d.gubbiId);
        if (!g || g.etapa === 'cría') break;
        if (g.rolAsignado === d.rol) break;
        // Voluntad propia (§9): obligar a un escéptico infeliz tiene costo
        const dev = rasgo(g, 'devocion');
        g.rolAsignado = d.rol;
        if (dev < -0.4 && g.animo < 40) {
          g.devocion = clamp(g.devocion - 5, 0, 100);
          ctx.log.push(`😒 ${g.nombre} obedece la reasignación a ${d.rol}… a regañadientes.`);
        }
        break;
      }
    }
  }
  return s;
}

/** Estadísticas del reino: emergen de abajo hacia arriba (§10). */
function recalcularStats(estado: GameState, ctx: ContextoTurno): GameState {
  const gubbis = estado.gubbis.map((g) => ({ ...g }));
  const n = gubbis.length || 1;

  // Hospital recupera salud
  const hospitales = estado.edificios.filter((e) => e.tipo === 'hospital').reduce((s, e) => s + e.nivel, 0);
  if (hospitales > 0) for (const g of gubbis) g.salud = clamp(g.salud + hospitales * 2, 0, 100);

  const felicidad = gubbis.reduce((s, g) => s + g.animo, 0) / n;
  const salud = gubbis.reduce((s, g) => s + g.salud, 0) / n;
  const defensores = gubbis.filter((g) => g.rolAsignado === 'defensa').length;
  const cuarteles = estado.edificios.filter((e) => e.tipo === 'cuartel').length;
  const seguridad = clamp((defensores * 8 + cuarteles * 12) / Math.max(1, estado.proximaOleada.tamano / 10), 0, 100);

  return { ...estado, gubbis, stats: { felicidad: Math.round(felicidad), salud: Math.round(salud), seguridad: Math.round(seguridad) } };
}

function chequearFin(estado: GameState, ctx: ContextoTurno): GameState {
  if (estado.gubbis.length === 0) {
    ctx.log.push(`☠️ No queda ningún Gubbi. La isla guarda silencio.`);
    return { ...estado, estado: 'derrota', motivoFin: 'La tribu se extinguió.' };
  }
  const devocionMedia = estado.gubbis.reduce((s, g) => s + g.devocion, 0) / estado.gubbis.length;
  if (devocionMedia < 15 && estado.stats.felicidad < 25) {
    ctx.log.push(`🔥 Los Gubbis derribaron tus altares. Ya no creen en ti.`);
    return { ...estado, estado: 'derrota', motivoFin: 'Rebelión: la tribu renegó de su dios.' };
  }
  if (estado.recursos.prestigio >= 50) {
    ctx.log.push(`👑 El nombre de tu tribu se canta en todas las islas.`);
    return { ...estado, estado: 'victoria', motivoFin: 'Prestigio legendario alcanzado.' };
  }
  return estado;
}
