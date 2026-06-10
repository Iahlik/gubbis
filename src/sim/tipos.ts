// ============================================================
// Gubbis — Tipos del simulador (módulo puro, sin React/DB)
// Basado en el Handoff v3 §18. Punto de partida, no definitivo.
// ============================================================

export type Etapa = 'cría' | 'adulto' | 'anciano';

export type Aptitud = 'fortaleza' | 'agilidad' | 'magia' | 'inteligencia';

export type EjeRasgo =
  | 'animo'        // -1 gruñón .. +1 optimista
  | 'sociabilidad' // -1 solitario .. +1 sociable
  | 'valor'        // -1 miedoso .. +1 valiente
  | 'devocion'     // -1 escéptico .. +1 devoto
  | 'caracter'     // -1 conflictivo .. +1 carismático
  | 'inquietud';   // -1 hogareño .. +1 aventurero

export interface Rasgo {
  eje: EjeRasgo;
  valor: number; // -1..+1
}

export type TipoRelacion = 'amistad' | 'rivalidad' | 'pareja';

export interface Relacion {
  conId: string;
  tipo: TipoRelacion;
  intensidad: number; // 0..1
}

export type Rol =
  | 'granja'    // produce Mumi
  | 'leñador'   // produce Madera
  | 'mina'      // produce Piedra y algo de Oro
  | 'templo'    // produce Fe
  | 'defensa'   // protege contra la oleada
  | 'descanso'; // recupera ánimo (crías y por defecto)

export interface NivelAptitud {
  valor: number; // nivel actual (sube por uso)
  techo: number; // techo de talento sorteado al nacer
}

export interface Gubbi {
  id: string;
  nombre: string;
  etapa: Etapa;
  edad: number; // en turnos (días)
  aptitudes: Record<Aptitud, NivelAptitud>;
  rasgos: Rasgo[];
  titulo?: string;          // especialización con buff de aura (capa posterior)
  rolAsignado: Rol;
  relaciones: Relacion[];
  animo: number;            // 0..100 moral individual
  devocion: number;         // 0..100 hacia el dios
  salud: number;            // 0..100
  haPeregrinado: boolean;
  posicion: { x: number; y: number }; // solo para el render overworld (cosmético)
}

export type TipoDino = 'bruto' | 'enjambre' | 'volador';

export interface Oleada {
  turnoObjetivo: number;
  tamano: number; // escala con tiempo y población
  composicion: TipoDino[];
}

export type TipoEdificio =
  | 'granja' | 'aserradero' | 'mina' | 'mercado'
  | 'hospital' | 'cuartel' | 'templo';

export interface Edificio {
  tipo: TipoEdificio;
  nivel: number;
  posicion: { x: number; y: number };
}

export interface Siembra {
  diaCosecha: number;
  mumiInvertida: number;
}

export interface Peticion {
  gubbiId: string;
  rolDeseado: Rol;
  dia: number; // cuándo la pidió
}

export interface Huevo {
  id: string;
  diaEclosion: number;          // puesto el día D, eclosiona D+3
  padresIds?: [string, string]; // si vino de una pareja, la cría hereda
}

export interface Recursos {
  mumi: number;
  oro: number;
  madera: number;
  piedra: number;
  conocimiento: number;
  influencia: number;
  fe: number;
  prestigio: number;
}

export interface StatsReino {
  felicidad: number; // 0..100, emerge del ánimo individual
  salud: number;     // 0..100
  seguridad: number; // 0..100
}

export type Racion = 'escasa' | 'normal' | 'abundante';

export type EstadoPartida = 'jugando' | 'derrota' | 'victoria';

export interface GameState {
  dia: number;
  semilla: number; // RNG determinista
  gubbis: Gubbi[];
  recursos: Recursos;
  stats: StatsReino;
  edificios: Edificio[];
  siembras: Siembra[];
  huevos: Huevo[];
  peticiones: Peticion[];           // voluntad propia: cambios de rol pedidos (§9)
  racion: Racion;
  proximaOleada: Oleada;
  oleadasSobrevividas: number;
  estado: EstadoPartida;
  motivoFin?: string;
  log: string[];     // reporte del último turno resuelto
  cronica: string[]; // hitos memorables de toda la partida
}

// ----- Decisiones del jugador (entrada de resolverTurno) -----

export type Decision =
  | { tipo: 'asignarRol'; gubbiId: string; rol: Rol }
  | { tipo: 'sembrar'; cantidad: number }          // invierte Mumi hoy, cosecha en N días
  | { tipo: 'racion'; nivel: Racion }
  | { tipo: 'construir'; edificio: TipoEdificio }
  | { tipo: 'bendecirHuevo' }               // crea un huevo: cuesta Mumi y Fe
  | { tipo: 'resolverPeticion'; gubbiId: string; respuesta: 'permitir' | 'negar' };

// Contexto interno que fluye entre fases de un mismo turno
export interface ContextoTurno {
  rng: Rng;
  log: string[];
}

export interface Rng {
  next(): number;                 // [0,1)
  entre(min: number, max: number): number;
  entero(min: number, max: number): number; // inclusivo
  chance(p: number): boolean;
  elegir<T>(arr: T[]): T;
}
