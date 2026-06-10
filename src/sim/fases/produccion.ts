import type { ContextoTurno, GameState, Gubbi, Rol } from '../tipos';
import { APTITUD_DE_ROL, clonarGubbi } from '../gubbi';
import { quimicaDeGrupo, clamp } from '../quimica';
import { TITULOS } from '../titulos';

const TASA_BASE: Partial<Record<Rol, number>> = {
  granja: 2.4,   // Mumi por punto-trabajo
  'leñador': 0.9,
  mina: 0.7,
  templo: 0.8,
};

/** Fase 1 — Producción: cada cuadrilla produce según aptitud, química y edificios. */
export function faseProduccion(estado: GameState, ctx: ContextoTurno): GameState {
  const gubbis = estado.gubbis.map(clonarGubbi);
  const recursos = { ...estado.recursos };

  const porRol = agrupar(gubbis.filter((g) => g.etapa !== 'cría' && g.salud > 15));

  const nivelEdif = (tipo: string) =>
    estado.edificios.filter((e) => e.tipo === tipo).reduce((s, e) => s + e.nivel, 0);

  const haySabio = gubbis.some((g) => g.titulo === TITULOS.sabio);

  const producir = (rol: Rol): number => {
    const grupo = porRol[rol] ?? [];
    if (grupo.length === 0) return 0;
    const quimica = quimicaDeGrupo(grupo);
    const apt = APTITUD_DE_ROL[rol];
    let aura = 1;
    if (rol === 'granja' && grupo.some((g) => g.titulo === TITULOS.cultivadora)) aura = 1.2;
    if (rol === 'templo' && grupo.some((g) => g.titulo === TITULOS.sacerdote)) aura = 1.25;
    let puntos = 0;
    for (const g of grupo) {
      const habilidad = apt ? g.aptitudes[apt].valor : 20;
      const moral = 0.6 + (g.animo / 100) * 0.6;       // el ánimo pesa
      const mentor = g.etapa === 'anciano' ? 0.5 : 1;  // ancianos ayudan a media jornada
      puntos += (0.6 + habilidad / 40) * moral * mentor;
      subirPorUso(g, rol, ctx, haySabio);               // progresión: suben por uso (§8)
    }
    return puntos * quimica * aura * (TASA_BASE[rol] ?? 0);
  };

  const bonus = (tipo: string) => 1 + nivelEdif(tipo) * 0.15;

  const mumi = producir('granja') * bonus('granja');
  const madera = producir('leñador') * bonus('aserradero');
  const piedraPuntos = producir('mina') * bonus('mina');
  const fe = producir('templo') * bonus('templo');

  recursos.mumi += mumi;
  recursos.madera += madera;
  recursos.piedra += piedraPuntos;
  recursos.oro += piedraPuntos * 0.25 + nivelEdif('mercado') * 1.5;
  recursos.fe = clamp(recursos.fe + fe * 0.5, 0, 100);

  // Cosechas de siembras que maduran hoy
  const siembras = [];
  for (const s of estado.siembras) {
    if (s.diaCosecha <= estado.dia) {
      const cosecha = s.mumiInvertida * 2.5;
      recursos.mumi += cosecha;
      ctx.log.push(`🌱 Cosecha: ${cosecha.toFixed(0)} de Mumi (siembra del día ${s.diaCosecha - 5}).`);
    } else {
      siembras.push(s);
    }
  }

  if (mumi > 0) ctx.log.push(`🍑 Producción de Mumi: +${mumi.toFixed(0)}.`);
  if (madera > 0) ctx.log.push(`🪵 Madera: +${madera.toFixed(0)}.`);
  if (piedraPuntos > 0) ctx.log.push(`🪨 Piedra: +${piedraPuntos.toFixed(0)} · 🪙 Oro: +${(piedraPuntos * 0.25).toFixed(0)}.`);
  if (fe > 0) ctx.log.push(`🕯️ El templo eleva la Fe.`);

  return { ...estado, gubbis, recursos, siembras };
}

function subirPorUso(g: Gubbi, rol: Rol, ctx: ContextoTurno, haySabio = false): void {
  const apt = APTITUD_DE_ROL[rol];
  if (!apt) return;
  const nivel = g.aptitudes[apt];
  const prob = 0.35 + (haySabio && g.edad < 40 ? 0.15 : 0); // el Anciano Sabio acelera a los jóvenes
  if (nivel.valor < nivel.techo && ctx.rng.chance(prob)) {
    nivel.valor = Math.min(nivel.techo, nivel.valor + 1);
    if (nivel.valor === nivel.techo) {
      ctx.log.push(`⭐ ${g.nombre} alcanzó su techo de talento en ${apt}.`);
    }
  }
}

function agrupar(gubbis: Gubbi[]): Partial<Record<Rol, Gubbi[]>> {
  const m: Partial<Record<Rol, Gubbi[]>> = {};
  for (const g of gubbis) (m[g.rolAsignado] ??= []).push(g);
  return m;
}
