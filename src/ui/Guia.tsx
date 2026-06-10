'use client';

// Guía interactiva: un walkthrough que avanza cuando el jugador HACE las cosas,
// no cuando lee. Cada paso resalta el panel correspondiente.

import type { ReactNode } from 'react';

export interface PasoGuia {
  contenido: ReactNode;
  /** Si es null, el paso avanza con el botón "Entendido"; si no, espera la acción. */
  esperaAccion: string | null;
  destacar: 'mapa' | 'tribu' | 'decisiones' | 'volcan' | 'terminar' | null;
}

export default function Guia({
  paso, total, datos, alContinuar, alOmitirPaso, alSalir,
}: {
  paso: number;
  total: number;
  datos: PasoGuia;
  alContinuar: () => void;
  alOmitirPaso: () => void;
  alSalir: () => void;
}) {
  return (
    <aside className="guia-card" role="status" aria-live="polite">
      <p className="guia-num">Guía · paso {paso} de {total}</p>
      <div className="guia-texto">{datos.contenido}</div>
      <div className="guia-acciones">
        {datos.esperaAccion ? (
          <span className="guia-espera">✦ {datos.esperaAccion}</span>
        ) : (
          <button className="primario guia-boton" onClick={alContinuar}>Entendido →</button>
        )}
        <span style={{ flex: 1 }} />
        {datos.esperaAccion && <button className="fantasma" onClick={alOmitirPaso}>Omitir paso</button>}
        <button className="fantasma" onClick={alSalir}>Salir de la guía</button>
      </div>
    </aside>
  );
}
