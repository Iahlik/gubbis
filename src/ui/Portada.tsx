'use client';

// Cortina de intro: la caja del juego, como en los tiempos del Amiga.

import { useState } from 'react';

export default function Portada({ alComenzar }: { alComenzar: () => void }) {
  const [saliendo, setSaliendo] = useState(false);

  return (
    <div
      className={`portada ${saliendo ? 'portada-saliendo' : ''}`}
      onTransitionEnd={(e) => { if (saliendo && e.propertyName === 'opacity') alComenzar(); }}
      role="dialog"
      aria-label="Pantalla de inicio de Gubbis"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/portada.png?v=2" alt="Gubbis — portada del juego" className="portada-img" />
      <div className="portada-pie">
        <button className="primario portada-boton" onClick={() => setSaliendo(true)} autoFocus>
          ▶ Comenzar
        </button>
        <p className="portada-credito dato">un juego de gestión de tribu · desarrollado por Ignacio Larraín · MMXXVI</p>
      </div>
    </div>
  );
}
