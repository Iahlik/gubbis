// API pública del simulador. Ninguna capa de presentación toca nada más adentro.
export * from './tipos';
export { resolverTurno } from './resolverTurno';
export { nuevaPartida } from './nuevaPartida';
export { describir, aptitudDominante, APTITUDES, APTITUD_DE_ROL } from './gubbi';
export { CATALOGO_EDIFICIOS, COSTO_HUEVO } from './edificios';
export { crearRng } from './rng';
export { generarMapa, posicionEnTierra, VOLCAN, ALDEA, ISLA_ANCHO, ISLA_ALTO } from './isla';
export type { Tile, MapaIsla } from './isla';
export { calcularPoderDefensa } from './fases/oleada';
export { TITULOS } from './titulos';
