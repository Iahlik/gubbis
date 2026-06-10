import type { GameState } from './tipos';
import { crearRng } from './rng';
import { generarGubbi } from './gubbi';
import { programarOleada } from './fases/oleada';
import { posicionEnTierra, ALDEA } from './isla';

export function nuevaPartida(semilla: number = Date.now() % 2147483647): GameState {
  const rng = crearRng(semilla);
  const gubbis = Array.from({ length: 8 }, () => generarGubbi(rng));

  // Asignación inicial sensata para que el día 1 no sea un funeral
  const roles = ['granja', 'granja', 'granja', 'leñador', 'mina', 'defensa', 'defensa', 'templo'] as const;
  gubbis.forEach((g, i) => { g.rolAsignado = roles[i % roles.length]; });

  return {
    dia: 0,
    semilla,
    gubbis,
    recursos: { mumi: 40, oro: 10, madera: 20, piedra: 10, conocimiento: 0, influencia: 0, fe: 50, prestigio: 0 },
    stats: { felicidad: 65, salud: 90, seguridad: 30 },
    edificios: [
      { tipo: 'granja', nivel: 1, posicion: posicionEnTierra(semilla, rng, ALDEA, 5) },
      { tipo: 'templo', nivel: 1, posicion: posicionEnTierra(semilla, rng, ALDEA, 5) },
    ],
    siembras: [],
    huevos: [],
    peticiones: [],
    racion: 'normal',
    proximaOleada: programarOleada(0, gubbis.length, 0, rng),
    oleadasSobrevividas: 0,
    estado: 'jugando',
    log: ['🌅 Amanece sobre la isla. Los Gubbis miran al cielo y te sienten cerca.'],
    cronica: [],
  };
}
