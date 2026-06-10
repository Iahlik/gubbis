import type { Aptitud, EjeRasgo, Gubbi, Rasgo, Rng, Rol } from './tipos';
import { generarNombre } from './nombres';

export const APTITUDES: Aptitud[] = ['fortaleza', 'agilidad', 'magia', 'inteligencia'];
export const EJES: EjeRasgo[] = ['animo', 'sociabilidad', 'valor', 'devocion', 'caracter', 'inquietud'];

let contadorId = 0;
export function nuevoId(rng: Rng): string {
  contadorId += 1;
  return `g${contadorId}-${Math.floor(rng.next() * 1e6).toString(36)}`;
}

/** Genera un Gubbi al azar. Los techos son la apuesta a largo plazo (Handoff §6). */
export function generarGubbi(rng: Rng, opts?: Partial<Pick<Gubbi, 'etapa' | 'edad'>>): Gubbi {
  const aptitudes = {} as Gubbi['aptitudes'];
  for (const a of APTITUDES) {
    const techo = rng.entero(20, 100);            // techo sorteado: los raros se sienten raros
    const valor = rng.entero(5, Math.min(30, techo));
    aptitudes[a] = { valor, techo };
  }
  const rasgos: Rasgo[] = EJES.map((eje) => ({ eje, valor: redondear(rng.entre(-1, 1)) }));
  const etapa = opts?.etapa ?? 'adulto';
  return {
    id: nuevoId(rng),
    nombre: generarNombre(rng),
    etapa,
    edad: opts?.edad ?? (etapa === 'cría' ? 0 : rng.entero(20, 50)),
    aptitudes,
    rasgos,
    rolAsignado: etapa === 'adulto' ? 'descanso' : 'descanso',
    relaciones: [],
    animo: rng.entero(55, 80),
    devocion: rng.entero(40, 80),
    salud: rng.entero(80, 100),
    haPeregrinado: etapa !== 'cría',
    posicion: { x: rng.entero(2, 28), y: rng.entero(2, 18) },
  };
}

export function rasgo(g: Gubbi, eje: EjeRasgo): number {
  return g.rasgos.find((r) => r.eje === eje)?.valor ?? 0;
}

export function aptitudDominante(g: Gubbi): Aptitud {
  return APTITUDES.reduce((mejor, a) =>
    g.aptitudes[a].valor > g.aptitudes[mejor].valor ? a : mejor, APTITUDES[0]);
}

/** Lectura "aptitud dominante + 1-2 rasgos" (Handoff §6). */
export function describir(g: Gubbi): string {
  const apt = aptitudDominante(g);
  const etiquetas: Record<Aptitud, string> = {
    fortaleza: 'fortachón', agilidad: 'ágil', magia: 'mágico', inteligencia: 'inteligente',
  };
  const extremos: [EjeRasgo, string, string][] = [
    ['animo', 'gruñón', 'optimista'],
    ['sociabilidad', 'solitario', 'sociable'],
    ['valor', 'miedoso', 'valiente'],
    ['devocion', 'escéptico', 'devoto'],
    ['caracter', 'conflictivo', 'carismático'],
    ['inquietud', 'hogareño', 'aventurero'],
  ];
  const marcados = extremos
    .map(([eje, neg, pos]) => ({ eje, v: rasgo(g, eje), neg, pos }))
    .filter((r) => Math.abs(r.v) > 0.45)
    .sort((a, b) => Math.abs(b.v) - Math.abs(a.v))
    .slice(0, 2)
    .map((r) => (r.v < 0 ? r.neg : r.pos));
  return [etiquetas[apt], ...marcados].join(' ');
}

/** Aptitud relevante para cada rol. */
export const APTITUD_DE_ROL: Record<Rol, Aptitud | null> = {
  granja: 'inteligencia',
  'leñador': 'fortaleza',
  mina: 'fortaleza',
  templo: 'magia',
  defensa: 'fortaleza', // en la oleada también pesan agilidad y magia según composición
  descanso: null,
};

function redondear(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Clon profundo de un Gubbi (las fases nunca deben mutar el estado de entrada). */
export function clonarGubbi(g: Gubbi): Gubbi {
  return {
    ...g,
    aptitudes: {
      fortaleza: { ...g.aptitudes.fortaleza },
      agilidad: { ...g.aptitudes.agilidad },
      magia: { ...g.aptitudes.magia },
      inteligencia: { ...g.aptitudes.inteligencia },
    },
    rasgos: g.rasgos.map((r) => ({ ...r })),
    relaciones: g.relaciones.map((r) => ({ ...r })),
    posicion: { ...g.posicion },
  };
}
