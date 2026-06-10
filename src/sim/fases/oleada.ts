import type { ContextoTurno, GameState, Gubbi, Oleada, Rng, TipoDino } from '../tipos';
import { rasgo, clonarGubbi } from '../gubbi';
import { TITULOS } from '../titulos';
import { modificadorValor, quimicaDeGrupo, clamp } from '../quimica';

const INTERVALO_BASE = 12; // días entre oleadas (a vigilar: "dos relojes", Handoff §20)

/** Genera la siguiente oleada: escala con el día y la población (prosperidad ↔ peligro). */
export function programarOleada(dia: number, poblacion: number, numero: number, rng: Rng): Oleada {
  const tamano = Math.round(4 + numero * 3 + poblacion * 0.35 + rng.entre(-2, 2));
  const tipos: TipoDino[] = ['bruto', 'enjambre', 'volador'];
  const n = Math.min(3, 1 + Math.floor(numero / 2));
  const composicion: TipoDino[] = [];
  for (let i = 0; i < n; i++) composicion.push(rng.elegir(tipos));
  return {
    turnoObjetivo: dia + INTERVALO_BASE + rng.entero(-1, 2),
    tamano: Math.max(4, tamano),
    composicion: [...new Set(composicion)],
  };
}

/** Poder de defensa actual contra la PRÓXIMA oleada. Lo usa el combate y también la UI. */
export function calcularPoderDefensa(estado: GameState): number {
  const defensores = estado.gubbis.filter((g) => g.rolAsignado === 'defensa' && g.etapa !== 'cría');
  const cuarteles = estado.edificios.filter((e) => e.tipo === 'cuartel').reduce((s, e) => s + e.nivel, 0);
  const pesos = pesosPorComposicion(estado.proximaOleada.composicion);
  let poder = 0;
  for (const g of defensores) {
    const apt =
      g.aptitudes.fortaleza.valor * pesos.bruto +
      g.aptitudes.agilidad.valor * pesos.enjambre +
      g.aptitudes.magia.valor * pesos.volador;
    poder += (apt / 6) * (0.6 + g.animo / 150) * (g.salud / 100);
  }
  poder *= quimicaDeGrupo(defensores) * modificadorValor(defensores);
  if (defensores.some((g) => g.titulo === TITULOS.campeon)) poder *= 1.2; // el aura del Campeón
  poder += cuarteles * 4;
  return poder;
}

/** Fase 4 — Oleada: si hoy es el día, los dinos bajan del volcán. */
export function faseOleada(estado: GameState, ctx: ContextoTurno): GameState {
  if (estado.dia < estado.proximaOleada.turnoObjetivo) {
    const faltan = estado.proximaOleada.turnoObjetivo - estado.dia;
    if (faltan <= 3) {
      ctx.log.push(`🌋 El volcán Escarlata retumba… la oleada llega en ${faltan} día(s) (tamaño ~${estado.proximaOleada.tamano}).`);
    }
    return estado;
  }

  const gubbis = estado.gubbis.map(clonarGubbi);
  const recursos = { ...estado.recursos };
  let edificios = estado.edificios.map((e) => ({ ...e }));
  const oleada = estado.proximaOleada;

  const defensores = gubbis.filter((g) => g.rolAsignado === 'defensa' && g.etapa !== 'cría');
  const poder = calcularPoderDefensa({ ...estado, gubbis });

  const ratio = poder / oleada.tamano;
  ctx.log.push(`🦖 ¡LA OLEADA! ${oleada.tamano} criaturas (${oleada.composicion.join(' + ')}) descienden. Defensa: ${poder.toFixed(0)}.`);

  let bajas = 0;
  if (ratio >= 1.2) {
    ctx.log.push(`🛡️ Victoria contundente. La aldea celebra; los defensores vuelven como héroes.`);
    for (const g of defensores) { g.animo = clamp(g.animo + 10, 0, 100); g.devocion = clamp(g.devocion + 5, 0, 100); }
    recursos.prestigio += 4;
    recursos.fe = clamp(recursos.fe + 5, 0, 100);
  } else if (ratio >= 0.8) {
    bajas = elegirBajas(defensores, ctx.rng, 0.15);
    const quemada = Math.min(recursos.mumi, oleada.tamano * 0.8);
    recursos.mumi -= quemada;
    ctx.log.push(`⚔️ La defensa aguantó, con costo: ${bajas} caído(s) y ${quemada.toFixed(0)} de Mumi quemada.`);
    recursos.prestigio += 2;
  } else {
    bajas = elegirBajas(defensores.length ? defensores : gubbis.filter((g) => g.etapa !== 'cría'), ctx.rng, 0.35);
    const quemada = Math.min(recursos.mumi, oleada.tamano * 2);
    recursos.mumi -= quemada;
    if (edificios.length > 0 && ctx.rng.chance(0.7)) {
      const idx = ctx.rng.entero(0, edificios.length - 1);
      ctx.log.push(`🔥 Los dinos destruyeron un ${edificios[idx].tipo}.`);
      edificios = edificios.filter((_, i) => i !== idx);
    }
    for (const g of gubbis) { g.animo = clamp(g.animo - 15, 0, 100); g.devocion = clamp(g.devocion - 8, 0, 100); }
    ctx.log.push(`💀 La oleada arrasó la aldea: ${bajas} muerto(s), ${quemada.toFixed(0)} de Mumi perdida. La fe en su dios tiembla.`);
    recursos.fe = clamp(recursos.fe - 10, 0, 100);
  }

  const sobrevivientes = aplicarBajas(gubbis, defensores, bajas, ctx);

  return {
    ...estado,
    gubbis: sobrevivientes,
    recursos,
    edificios,
    oleadasSobrevividas: estado.oleadasSobrevividas + 1,
    proximaOleada: programarOleada(estado.dia, sobrevivientes.length, estado.oleadasSobrevividas + 1, ctx.rng),
  };
}

function pesosPorComposicion(comp: TipoDino[]): Record<TipoDino, number> {
  const base: Record<TipoDino, number> = { bruto: 0.34, enjambre: 0.33, volador: 0.33 };
  if (comp.length === 0) return base;
  const peso = 1 / comp.length;
  return {
    bruto: comp.includes('bruto') ? peso : 0.08,
    enjambre: comp.includes('enjambre') ? peso : 0.08,
    volador: comp.includes('volador') ? peso : 0.08,
  };
}

/** Los miedosos corren más riesgo; los valientes, menos. */
function elegirBajas(grupo: Gubbi[], rng: Rng, tasaBase: number): number {
  let bajas = 0;
  for (const g of grupo) {
    const riesgo = tasaBase * (1 - rasgo(g, 'valor') * 0.4);
    if (rng.chance(clamp(riesgo, 0.02, 0.6))) bajas++;
  }
  return Math.min(bajas, grupo.length);
}

function aplicarBajas(todos: Gubbi[], enRiesgo: Gubbi[], bajas: number, ctx: ContextoTurno): Gubbi[] {
  if (bajas <= 0) return todos;
  const pool = (enRiesgo.length ? enRiesgo : todos).slice();
  const muertos = new Set<string>();
  for (let i = 0; i < bajas && pool.length > 0; i++) {
    const idx = ctx.rng.entero(0, pool.length - 1);
    const caido = pool.splice(idx, 1)[0];
    muertos.add(caido.id);
    ctx.log.push(`🕯️ ${caido.nombre} cayó defendiendo la aldea.`);
  }
  // Duelo: las parejas y amigos del caído sufren (los vínculos importan, §7)
  const vivos = todos.filter((g) => !muertos.has(g.id));
  for (const g of vivos) {
    for (const rel of g.relaciones) {
      if (muertos.has(rel.conId)) {
        g.animo = clamp(g.animo - (rel.tipo === 'pareja' ? 25 : 10) * rel.intensidad, 0, 100);
      }
    }
    g.relaciones = g.relaciones.filter((r) => !muertos.has(r.conId));
  }
  return vivos;
}
