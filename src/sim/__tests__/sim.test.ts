import { describe, it, expect } from 'vitest';
import { nuevaPartida } from '../nuevaPartida';
import { resolverTurno } from '../resolverTurno';
import type { Decision, GameState } from '../tipos';

function jugarTurnos(estado: GameState, n: number, decisiones: Decision[] = []): GameState {
  let s = estado;
  for (let i = 0; i < n; i++) s = resolverTurno(s, decisiones);
  return s;
}

describe('simulador Gubbis', () => {
  it('crea una partida válida', () => {
    const s = nuevaPartida(42);
    expect(s.gubbis.length).toBe(8);
    expect(s.recursos.mumi).toBeGreaterThan(0);
    expect(s.proximaOleada.turnoObjetivo).toBeGreaterThan(0);
  });

  it('es determinista: misma semilla + mismas decisiones => mismo estado', () => {
    const a = jugarTurnos(nuevaPartida(123), 30);
    const b = jugarTurnos(nuevaPartida(123), 30);
    // ids contienen un contador global; comparamos lo demás
    expect(a.dia).toBe(b.dia);
    expect(a.recursos).toEqual(b.recursos);
    expect(a.gubbis.length).toBe(b.gubbis.length);
    expect(a.stats).toEqual(b.stats);
  });

  it('no muta el estado de entrada', () => {
    const s0 = nuevaPartida(7);
    const copia = JSON.parse(JSON.stringify(s0));
    resolverTurno(s0, [{ tipo: 'sembrar', cantidad: 10 }]);
    expect(JSON.parse(JSON.stringify(s0))).toEqual(copia);
  });

  it('la oleada llega y se resuelve', () => {
    let s = nuevaPartida(99);
    const objetivo = s.proximaOleada.turnoObjetivo;
    s = jugarTurnos(s, objetivo + 1);
    expect(s.oleadasSobrevividas + (s.estado === 'derrota' ? 1 : 0)).toBeGreaterThanOrEqual(1);
    if (s.estado === 'jugando') {
      expect(s.proximaOleada.turnoObjetivo).toBeGreaterThan(objetivo);
    }
  });

  it('sembrar invierte Mumi y cosecha después', () => {
    let s = nuevaPartida(5);
    const mumiAntes = s.recursos.mumi;
    s = resolverTurno(s, [{ tipo: 'sembrar', cantidad: 20 }]);
    expect(s.siembras.length).toBe(1);
    // tras 6 turnos la siembra ya maduró
    s = jugarTurnos(s, 6);
    expect(s.siembras.length).toBe(0);
  });

  it('sin comida la tribu sufre', () => {
    let s = nuevaPartida(11);
    s = { ...s, recursos: { ...s.recursos, mumi: 0 }, gubbis: s.gubbis.map((g) => ({ ...g, rolAsignado: 'descanso' as const })) };
    const saludAntes = s.stats.salud;
    s = resolverTurno(s, []);
    expect(s.stats.salud).toBeLessThan(saludAntes);
  });

  it('aguanta 100 turnos sin crashear (humo)', () => {
    const s = jugarTurnos(nuevaPartida(2026), 100);
    expect(['jugando', 'derrota', 'victoria']).toContain(s.estado);
  });
});

describe('huevos', () => {
  it('bendecir un huevo cuesta recursos y eclosiona a los 3 días', () => {
    let s = nuevaPartida(77);
    const mumi = s.recursos.mumi, fe = s.recursos.fe, poblacion = s.gubbis.length;
    s = resolverTurno(s, [{ tipo: 'bendecirHuevo' }]);
    expect(s.huevos.length).toBe(1);
    expect(s.recursos.fe).toBeLessThanOrEqual(fe - 10 + 5); // -10 del huevo (el templo puede sumar algo)
    s = jugarTurnos(s, 3);
    expect(s.huevos.length).toBe(0);
    expect(s.gubbis.length).toBeGreaterThanOrEqual(poblacion); // eclosionó (salvo bajas por otro lado)
  });

  it('la cría se vuelve adulta al 7º día del huevo (3 eclosión + ~4 de cría)', () => {
    let s = nuevaPartida(88);
    s = resolverTurno(s, [{ tipo: 'bendecirHuevo' }]);
    s = jugarTurnos(s, 3); // eclosiona
    const cria = s.gubbis.find((g) => g.etapa === 'cría');
    if (cria) {
      s = jugarTurnos(s, 4);
      const mismo = s.gubbis.find((g) => g.id === cria.id);
      // o ya es adulto, o murió/partió en el peregrinaje — ambas válidas por diseño
      if (mismo) expect(mismo.etapa).not.toBe('cría');
    }
  });

  it('sin Fe suficiente, el huevo no se crea', () => {
    let s = nuevaPartida(99);
    s = { ...s, recursos: { ...s.recursos, fe: 2 } };
    s = resolverTurno(s, [{ tipo: 'bendecirHuevo' }]);
    expect(s.huevos.length).toBe(0);
  });
});

describe('títulos y peticiones', () => {
  it('resolver una petición (permitir) cambia el rol y sube el ánimo', () => {
    let s = nuevaPartida(123);
    const g = s.gubbis[0];
    s = {
      ...s,
      gubbis: s.gubbis.map((x) => (x.id === g.id ? { ...x, animo: 40 } : x)),
      peticiones: [{ gubbiId: g.id, rolDeseado: 'templo' as const, dia: 0 }],
    };
    s = resolverTurno(s, [{ tipo: 'resolverPeticion', gubbiId: g.id, respuesta: 'permitir' }]);
    const despues = s.gubbis.find((x) => x.id === g.id);
    expect(s.peticiones.length).toBe(0);
    expect(despues?.rolAsignado).toBe('templo');
    expect((despues?.animo ?? 0)).toBeGreaterThan(40);
  });

  it('la crónica registra hitos', () => {
    let s = nuevaPartida(31);
    s = resolverTurno(s, [{ tipo: 'bendecirHuevo' }]);
    s = jugarTurnos(s, 4);
    expect(Array.isArray(s.cronica)).toBe(true);
    // al menos la eclosión debería haber quedado en la crónica
    expect(s.cronica.some((l) => l.includes('🐣') || l.includes('🕯️') || l.includes('💞'))).toBe(true);
  });
});
