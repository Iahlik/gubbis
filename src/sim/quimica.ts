import type { Gubbi } from './tipos';
import { rasgo } from './gubbi';

/**
 * Química de grupo (Handoff §7): modificador de rendimiento de una cuadrilla
 * según los rasgos combinados de sus miembros. Devuelve ~0.8 .. 1.2.
 */
export function quimicaDeGrupo(grupo: Gubbi[]): number {
  if (grupo.length <= 1) {
    // Un solitario trabajando solo rinde un poco mejor.
    const solo = grupo[0];
    return solo && rasgo(solo, 'sociabilidad') < -0.4 ? 1.1 : 1.0;
  }
  let mod = 1.0;
  const sociables = grupo.filter((g) => rasgo(g, 'sociabilidad') > 0.4).length;
  const solitarios = grupo.filter((g) => rasgo(g, 'sociabilidad') < -0.4).length;
  const conflictivos = grupo.filter((g) => rasgo(g, 'caracter') < -0.4).length;
  const carismaticos = grupo.filter((g) => rasgo(g, 'caracter') > 0.4).length;
  const grunones = grupo.filter((g) => rasgo(g, 'animo') < -0.4).length;

  mod += sociables * 0.03;            // sociable + sociable: estrechan lazos y rinden
  mod -= solitarios * 0.03;           // los solitarios sufren en grupo
  mod -= conflictivos * grunones * 0.04; // gruñón + conflictivo es pólvora
  mod += Math.min(carismaticos, 1) * 0.05; // un carismático suaviza fricciones (no se apila)
  return clamp(mod, 0.8, 1.2);
}

/** Un valiente baja el pánico del grupo; los miedosos lo suben (para defensa). */
export function modificadorValor(grupo: Gubbi[]): number {
  const valientes = grupo.filter((g) => rasgo(g, 'valor') > 0.4).length;
  const miedosos = grupo.filter((g) => rasgo(g, 'valor') < -0.4).length;
  return clamp(1 + valientes * 0.06 - miedosos * 0.05 + (valientes > 0 ? 0.05 : 0), 0.7, 1.35);
}

export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}
