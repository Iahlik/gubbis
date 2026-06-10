import type { TipoEdificio } from './tipos';

export interface CostoEdificio { madera: number; piedra: number; oro: number; descripcion: string; }

export const CATALOGO_EDIFICIOS: Record<TipoEdificio, CostoEdificio> = {
  granja:     { madera: 15, piedra: 0,  oro: 0,  descripcion: '+15% producción de Mumi' },
  aserradero: { madera: 10, piedra: 5,  oro: 0,  descripcion: '+15% producción de Madera' },
  mina:       { madera: 10, piedra: 10, oro: 0,  descripcion: '+15% Piedra y Oro' },
  mercado:    { madera: 20, piedra: 10, oro: 10, descripcion: '+1.5 Oro por turno' },
  hospital:   { madera: 20, piedra: 15, oro: 5,  descripcion: 'Recupera salud de la tribu' },
  cuartel:    { madera: 25, piedra: 20, oro: 0,  descripcion: '+4 de defensa en la oleada' },
  templo:     { madera: 15, piedra: 25, oro: 5,  descripcion: '+15% Fe; sede de la mentoría' },
};

/** Costo de bendecir un huevo: crear vida gasta la fe que te tienen. */
export const COSTO_HUEVO = { mumi: 20, fe: 10 };
