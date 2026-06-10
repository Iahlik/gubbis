import type { ContextoTurno, GameState, Gubbi, Huevo } from '../tipos';
import { generarGubbi, rasgo, clonarGubbi } from '../gubbi';
import { clamp } from '../quimica';

export const EDAD_ADULTO = 4;  // eclosiona (día 3) + 3 días de cría => adulto al 7º día del huevo
const EDAD_ANCIANO = 90;
const EDAD_MAX = 110;

/** Fase 5 — Nacimientos, vínculos y muertes naturales. */
export function faseVida(estado: GameState, ctx: ContextoTurno): GameState {
  let gubbis = estado.gubbis.map(clonarGubbi);

  formarVinculos(gubbis, ctx);

  // Eclosión: los huevos que cumplen 3 días se abren (§9 + mecánica de huevos)
  const nuevos: Gubbi[] = [];
  const huevos: Huevo[] = [];
  for (const h of estado.huevos) {
    if (estado.dia >= h.diaEclosion) {
      const cria = generarGubbi(ctx.rng, { etapa: 'cría', edad: 0 });
      const p1 = h.padresIds ? gubbis.find((x) => x.id === h.padresIds![0]) : undefined;
      const p2 = h.padresIds ? gubbis.find((x) => x.id === h.padresIds![1]) : undefined;
      if (p1 && p2) {
        heredar(cria, p1, p2, ctx);
        ctx.log.push(`🐣 ¡Eclosionó ${cria.nombre}, cría de ${p1.nombre} y ${p2.nombre}!`);
      } else {
        ctx.log.push(`🐣 ¡Eclosionó ${cria.nombre}! Un Gubbi nuevo bajo tu cuidado.`);
      }
      nuevos.push(cria);
    } else {
      huevos.push(h);
    }
  }

  // Puesta natural: una pareja feliz y bien comida a veces pone un huevo gratis
  if (estado.recursos.mumi > gubbis.length * 1.2) {
    const vistos = new Set<string>();
    for (const g of gubbis) {
      const par = g.relaciones.find((r) => r.tipo === 'pareja');
      if (!par || vistos.has(g.id) || vistos.has(par.conId)) continue;
      vistos.add(g.id); vistos.add(par.conId);
      const otro = gubbis.find((x) => x.id === par.conId);
      if (!otro) continue;
      if (g.animo > 60 && otro.animo > 60 && ctx.rng.chance(0.04)) {
        huevos.push({
          id: `h${estado.dia}-${Math.floor(ctx.rng.next() * 1e6).toString(36)}`,
          diaEclosion: estado.dia + 3,
          padresIds: [g.id, otro.id],
        });
        ctx.log.push(`🥚 ${g.nombre} y ${otro.nombre} pusieron un huevo en el nido.`);
      }
    }
  }
  gubbis = [...gubbis, ...nuevos];

  // Muertes naturales: hambre extrema o vejez
  const muertos = new Set<string>();
  for (const g of gubbis) {
    if (g.salud <= 0) { muertos.add(g.id); ctx.log.push(`🕯️ ${g.nombre} murió de hambre y debilidad.`); continue; }
    if (g.edad > EDAD_ANCIANO) {
      const p = (g.edad - EDAD_ANCIANO) / (EDAD_MAX - EDAD_ANCIANO);
      if (ctx.rng.chance(p * 0.2)) { muertos.add(g.id); ctx.log.push(`🍂 ${g.nombre} murió en paz, rodeado de los suyos.`); }
    }
  }
  if (muertos.size > 0) {
    gubbis = gubbis.filter((g) => !muertos.has(g.id));
    for (const g of gubbis) {
      for (const rel of g.relaciones) {
        if (muertos.has(rel.conId)) {
          g.animo = clamp(g.animo - (rel.tipo === 'pareja' ? 20 : 8) * rel.intensidad, 0, 100);
          // Experiencia bisagra: perder a la pareja agria el carácter (§8)
          if (rel.tipo === 'pareja') ajustarRasgo(g, 'animo', -0.3);
        }
      }
      g.relaciones = g.relaciones.filter((r) => !muertos.has(r.conId));
    }
  }

  return { ...estado, gubbis, huevos };
}

/** Fase 6 — Envejecimiento y peregrinaje al volcán (§9). */
export function faseEnvejecimiento(estado: GameState, ctx: ContextoTurno): GameState {
  let gubbis = estado.gubbis.map(clonarGubbi);
  const recursos = { ...estado.recursos };
  const muertos = new Set<string>();

  for (const g of gubbis) {
    g.edad += 1;
    // Recuperación ligera de ánimo en descanso
    if (g.rolAsignado === 'descanso') g.animo = clamp(g.animo + 3, 0, 100);

    if (g.etapa === 'cría' && g.edad >= EDAD_ADULTO) {
      g.etapa = 'adulto';
      // Peregrinaje obligatorio al volcán Escarlata: vuelve transformado o no vuelve.
      const valor = rasgo(g, 'valor');
      const capacidad = (g.aptitudes.fortaleza.valor + g.aptitudes.agilidad.valor + g.aptitudes.magia.valor) / 3;
      const exito = clamp(0.7 + valor * 0.15 + capacidad / 200, 0.5, 0.97);
      if (ctx.rng.chance(exito)) {
        g.haPeregrinado = true;
        g.devocion = clamp(g.devocion + 10, 0, 100);
        recursos.prestigio += 1;
        if (valor < 0) {
          ajustarRasgo(g, 'valor', +0.6); // el miedoso que sobrevive vuelve valiente (§8)
          ctx.log.push(`🌋 ${g.nombre} volvió del volcán con su trofeo… y sin el miedo de antes.`);
        } else {
          ctx.log.push(`🌋 ${g.nombre} regresó del peregrinaje con un trofeo del volcán Escarlata.`);
        }
      } else {
        muertos.add(g.id);
        ctx.log.push(`🌋 ${g.nombre} partió al volcán Escarlata y no regresó.`);
      }
    } else if (g.etapa === 'adulto' && g.edad >= EDAD_ANCIANO) {
      g.etapa = 'anciano';
      g.rolAsignado = 'descanso'; // retiro: pasa a mentor (simplificado en v1)
      ctx.log.push(`🧓 ${g.nombre} se retiró de la labor dura; ahora aconseja a los jóvenes.`);
    }

    // Irse de la isla: inquietos e infelices se escurren (§9)
    if (g.etapa === 'adulto' && !muertos.has(g.id)) {
      const inquieto = rasgo(g, 'inquietud');
      const pTirar = clamp((inquieto * 0.5 + (40 - g.animo) / 100 + (30 - g.devocion) / 200) * 0.02, 0, 0.04);
      if (ctx.rng.chance(pTirar)) {
        muertos.add(g.id);
        ctx.log.push(`⛵ ${g.nombre} miró el horizonte una última vez y se fue de la isla.`);
      }
    }
  }

  gubbis = gubbis.filter((g) => !muertos.has(g.id));
  for (const g of gubbis) g.relaciones = g.relaciones.filter((r) => !muertos.has(r.conId));
  return { ...estado, gubbis, recursos };
}

function formarVinculos(gubbis: Gubbi[], ctx: ContextoTurno): void {
  const adultos = gubbis.filter((g) => g.etapa !== 'cría');
  if (adultos.length < 2) return;
  // Algunos encuentros por turno entre compañeros de rol
  for (let i = 0; i < Math.min(3, adultos.length); i++) {
    const a = ctx.rng.elegir(adultos);
    const candidatos = adultos.filter((b) => b.id !== a.id && b.rolAsignado === a.rolAsignado);
    if (candidatos.length === 0) continue;
    const b = ctx.rng.elegir(candidatos);
    const existente = a.relaciones.find((r) => r.conId === b.id);
    if (existente) {
      existente.intensidad = clamp(existente.intensidad + 0.1, 0, 1);
      const espejo = b.relaciones.find((r) => r.conId === a.id);
      if (espejo) espejo.intensidad = existente.intensidad;
      // Amistad fuerte entre adultos sin pareja puede volverse pareja
      if (existente.tipo === 'amistad' && existente.intensidad >= 0.7 &&
          !a.relaciones.some((r) => r.tipo === 'pareja') && !b.relaciones.some((r) => r.tipo === 'pareja') &&
          ctx.rng.chance(0.3)) {
        existente.tipo = 'pareja';
        const esp = b.relaciones.find((r) => r.conId === a.id);
        if (esp) esp.tipo = 'pareja';
        ctx.log.push(`💞 ${a.nombre} y ${b.nombre} ahora son pareja.`);
      }
      continue;
    }
    const afinidad = rasgo(a, 'sociabilidad') + rasgo(b, 'sociabilidad') - Math.abs(rasgo(a, 'animo') - rasgo(b, 'animo'));
    const conflicto = rasgo(a, 'caracter') < -0.4 && rasgo(b, 'caracter') < -0.4;
    const tipo = conflicto || afinidad < -0.8 ? 'rivalidad' : 'amistad';
    a.relaciones.push({ conId: b.id, tipo, intensidad: 0.2 });
    b.relaciones.push({ conId: a.id, tipo, intensidad: 0.2 });
  }
}

function heredar(cria: Gubbi, p1: Gubbi, p2: Gubbi, ctx: ContextoTurno): void {
  // Herencia parcial: techos y rasgos mezclan a los padres con ruido (§7)
  for (const apt of ['fortaleza', 'agilidad', 'magia', 'inteligencia'] as const) {
    const media = (p1.aptitudes[apt].techo + p2.aptitudes[apt].techo) / 2;
    cria.aptitudes[apt].techo = Math.round(clamp(media + ctx.rng.entre(-15, 15), 10, 100));
    cria.aptitudes[apt].valor = ctx.rng.entero(3, 10);
  }
  for (const r of cria.rasgos) {
    const v1 = rasgo(p1, r.eje), v2 = rasgo(p2, r.eje);
    r.valor = clamp((v1 + v2) / 2 + ctx.rng.entre(-0.4, 0.4), -1, 1);
  }
}

function ajustarRasgo(g: Gubbi, eje: Gubbi['rasgos'][number]['eje'], delta: number): void {
  const r = g.rasgos.find((x) => x.eje === eje);
  if (r) r.valor = clamp(r.valor + delta, -1, 1);
}
