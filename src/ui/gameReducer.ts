'use client';

// useReducer como motor de turno en cliente (Handoff §15):
// la UI acumula decisiones y, al terminar el turno, invoca la función pura resolverTurno.

import { nuevaPartida, resolverTurno } from '@/sim';
import type { Decision, GameState, Racion, Rol, TipoEdificio } from '@/sim';

export interface UIState {
  partida: GameState;
  pendientes: Decision[]; // decisiones tomadas este turno, aún sin resolver
}

export type UIAction =
  | { type: 'NUEVA_PARTIDA'; semilla?: number }
  | { type: 'ASIGNAR_ROL'; gubbiId: string; rol: Rol }
  | { type: 'SET_RACION'; nivel: Racion }
  | { type: 'SEMBRAR'; cantidad: number }
  | { type: 'CONSTRUIR'; edificio: TipoEdificio }
  | { type: 'BENDECIR_HUEVO' }
  | { type: 'RESOLVER_PETICION'; gubbiId: string; respuesta: 'permitir' | 'negar' }
  | { type: 'TERMINAR_TURNO' };

const CLAVE_SAVE = 'gubbis-save';

export function initUI(semilla?: number): UIState {
  // Continuar la partida guardada (solo en cliente, solo si sigue viva)
  if (typeof window !== 'undefined' && semilla === undefined) {
    try {
      const crudo = window.localStorage.getItem(CLAVE_SAVE);
      if (crudo) {
        const partida = JSON.parse(crudo) as GameState;
        if (partida?.estado === 'jugando' && Array.isArray(partida.gubbis)) {
          // Campos nuevos que un save viejo podría no tener
          partida.huevos ??= [];
          partida.peticiones ??= [];
          partida.cronica ??= [];
          return { partida, pendientes: [] };
        }
      }
    } catch { /* save corrupto: partida nueva */ }
  }
  return { partida: nuevaPartida(semilla), pendientes: [] };
}

export function guardarPartida(partida: GameState): void {
  try {
    if (partida.estado === 'jugando') window.localStorage.setItem(CLAVE_SAVE, JSON.stringify(partida));
    else window.localStorage.removeItem(CLAVE_SAVE);
  } catch { /* sin storage, sin drama */ }
}

export function borrarPartidaGuardada(): void {
  try { window.localStorage.removeItem(CLAVE_SAVE); } catch { /* ok */ }
}

export function gameReducer(state: UIState, action: UIAction): UIState {
  switch (action.type) {
    case 'NUEVA_PARTIDA':
      return initUI(action.semilla);

    case 'ASIGNAR_ROL': {
      // La UI refleja la asignación de inmediato (optimista) y la guarda como decisión.
      const pendientes = [
        ...state.pendientes.filter((d) => !(d.tipo === 'asignarRol' && d.gubbiId === action.gubbiId)),
        { tipo: 'asignarRol', gubbiId: action.gubbiId, rol: action.rol } as Decision,
      ];
      return { ...state, pendientes };
    }

    case 'SET_RACION':
      return {
        ...state,
        pendientes: [
          ...state.pendientes.filter((d) => d.tipo !== 'racion'),
          { tipo: 'racion', nivel: action.nivel },
        ],
      };

    case 'SEMBRAR':
      return {
        ...state,
        pendientes: [
          ...state.pendientes.filter((d) => d.tipo !== 'sembrar'),
          ...(action.cantidad > 0 ? [{ tipo: 'sembrar', cantidad: action.cantidad } as Decision] : []),
        ],
      };

    case 'CONSTRUIR':
      return { ...state, pendientes: [...state.pendientes, { tipo: 'construir', edificio: action.edificio }] };

    case 'BENDECIR_HUEVO':
      return { ...state, pendientes: [...state.pendientes, { tipo: 'bendecirHuevo' }] };

    case 'RESOLVER_PETICION':
      return {
        ...state,
        pendientes: [
          ...state.pendientes.filter((d) => !(d.tipo === 'resolverPeticion' && d.gubbiId === action.gubbiId)),
          { tipo: 'resolverPeticion', gubbiId: action.gubbiId, respuesta: action.respuesta },
        ],
      };

    case 'TERMINAR_TURNO':
      return { partida: resolverTurno(state.partida, state.pendientes), pendientes: [] };

    default:
      return state;
  }
}

/** Rol efectivo de un Gubbi considerando las decisiones aún pendientes. */
export function rolEfectivo(state: UIState, gubbiId: string): Rol | undefined {
  const pendiente = state.pendientes.find((d) => d.tipo === 'asignarRol' && d.gubbiId === gubbiId);
  if (pendiente && pendiente.tipo === 'asignarRol') return pendiente.rol;
  return state.partida.gubbis.find((g) => g.id === gubbiId)?.rolAsignado;
}
