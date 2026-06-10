'use client';

import { useState } from 'react';

const PASOS: { titulo: string; texto: string }[] = [
  {
    titulo: 'Eres el dios de los Gubbis 🌅',
    texto: 'Esta tribu vive en la isla desde hace generaciones. No administras números: cuidas individuos, cada uno con talentos, manías y relaciones. Si los mantienes felices y fieles, prosperan. Si no… se apagan, se rebelan o se van.',
  },
  {
    titulo: 'Cada día, decides ☀️',
    texto: 'Asigna una tarea a cada Gubbi (granja, leña, mina, templo, defensa o descanso), elige la ración, siembra Mumi (rinde ×2.5 en 5 días) y construye. Cuando estés listo, pulsa «Terminar el día»: el mundo avanza y recibes el reporte.',
  },
  {
    titulo: 'El volcán Escarlata 🌋',
    texto: 'Cada ~12 días desciende una oleada de criaturas. Siempre sabrás cuándo y qué tan grande. La clave es prepararse ANTES: cada tipo pide algo distinto — brutos → fortachones, enjambres → ágiles, voladores → mágicos. El humo del volcán se enciende cuando se acerca.',
  },
  {
    titulo: 'El ciclo de la vida 🥚',
    texto: 'Para crecer la tribu, bendice un huevo (20 Mumi + 10 Fe): eclosiona en 3 días, la cría es joven 3 días más y al 7º día se vuelve adulta… y parte de inmediato a su peregrinaje al volcán — vuelve transformada, o no vuelve. Las parejas felices a veces ponen huevos gratis, y las crías heredan los talentos de sus padres.',
  },
  {
    titulo: 'Lee a tu tribu 👀',
    texto: 'En el mapa, el color de cada Gubbi es su talento: rojo fortachón, verde ágil, lila mágico, cian inteligente (tócalos para ver su nombre). Los rasgos importan: dos conflictivos juntos son pólvora; un carismático calma a la cuadrilla. Asignar bien es tu verdadero poder.',
  },
];

export default function Tutorial({ alCerrar }: { alCerrar: () => void }) {
  const [paso, setPaso] = useState(0);
  const ultimo = paso === PASOS.length - 1;

  return (
    <div className="velo" role="dialog" aria-modal="true" aria-label="Tutorial de Gubbis">
      <div className="modal">
        <p className="paso-num">Paso {paso + 1} de {PASOS.length}</p>
        <h3>{PASOS[paso].titulo}</h3>
        <p>{PASOS[paso].texto}</p>
        <div className="acciones">
          <div className="puntos" aria-hidden>
            {PASOS.map((_, i) => <span key={i} className={i === paso ? 'activo' : ''} />)}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {paso > 0 && <button className="fantasma" onClick={() => setPaso(paso - 1)}>← Atrás</button>}
            {!ultimo && <button className="fantasma" onClick={alCerrar}>Saltar</button>}
            <button className="primario" style={{ fontSize: '0.9rem', padding: '7px 16px' }}
              onClick={() => (ultimo ? alCerrar() : setPaso(paso + 1))}>
              {ultimo ? 'Que comience el día 0' : 'Siguiente →'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
