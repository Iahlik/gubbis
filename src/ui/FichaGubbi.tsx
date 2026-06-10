'use client';

// Ficha de un Gubbi: el sim ya sabe todo esto — ahora también el jugador.

import type { GameState, Gubbi, Aptitud } from '@/sim';
import { describir } from '@/sim';

const NOMBRE_APT: Record<Aptitud, string> = {
  fortaleza: '💪 Fortaleza', agilidad: '🏃 Agilidad', magia: '✨ Magia', inteligencia: '🧠 Inteligencia',
};

export default function FichaGubbi({ gubbi, partida, alCerrar }: {
  gubbi: Gubbi; partida: GameState; alCerrar: () => void;
}) {
  const nombreDe = (id: string) => partida.gubbis.find((g) => g.id === id)?.nombre ?? '(ya no está)';
  const tipoRel = { pareja: '💞 pareja de', amistad: '🤝 amistad con', rivalidad: '⚡ rivalidad con' } as const;

  return (
    <div className="velo" onClick={alCerrar} role="dialog" aria-modal="true" aria-label={`Ficha de ${gubbi.nombre}`}>
      <div className="modal ficha" onClick={(e) => e.stopPropagation()}>
        <div className="ficha-encabezado">
          <h3>
            {gubbi.nombre}
            {gubbi.etapa === 'cría' && ' 🐣'}
            {gubbi.etapa === 'anciano' && ' 🧓'}
          </h3>
          <button className="fantasma" onClick={alCerrar} aria-label="Cerrar ficha">✕</button>
        </div>
        <p className="etiqueta-rasgo" style={{ marginTop: 0 }}>
          {describir(gubbi)} · {gubbi.edad} días
          {gubbi.titulo && <> · <b style={{ color: 'var(--oro)' }}>🏅 {gubbi.titulo}</b></>}
        </p>

        <div className="ficha-stats dato">
          <span>😊 Ánimo <b>{gubbi.animo.toFixed(0)}</b></span>
          <span>🙏 Devoción <b>{gubbi.devocion.toFixed(0)}</b></span>
          <span>❤️ Salud <b>{gubbi.salud.toFixed(0)}</b></span>
          <span>🌋 {gubbi.haPeregrinado ? 'Peregrinó al volcán' : 'Aún no peregrina'}</span>
        </div>

        <h2 style={{ marginTop: 14 }}>Aptitudes <span className="etiqueta-rasgo" style={{ textTransform: 'none', letterSpacing: 0 }}>(nivel / techo de talento)</span></h2>
        {(Object.keys(NOMBRE_APT) as Aptitud[]).map((a) => {
          const { valor, techo } = gubbi.aptitudes[a];
          return (
            <div key={a} className="apt-fila dato">
              <span className="apt-nombre">{NOMBRE_APT[a]}</span>
              <div className="apt-barra" title={`${valor} de ${techo}`}>
                <div className="apt-techo" style={{ width: `${techo}%` }} />
                <div className="apt-valor" style={{ width: `${valor}%` }} />
              </div>
              <span className="apt-num">{valor}/{techo}</span>
            </div>
          );
        })}

        <h2 style={{ marginTop: 14 }}>Vínculos</h2>
        {gubbi.relaciones.length === 0 ? (
          <p className="etiqueta-rasgo dato">Todavía no forma vínculos.</p>
        ) : (
          <ul className="ficha-vinculos dato">
            {gubbi.relaciones.map((r) => (
              <li key={r.conId}>
                {tipoRel[r.tipo]} <b>{nombreDe(r.conId)}</b>
                <span className="etiqueta-rasgo"> · intensidad {(r.intensidad * 100).toFixed(0)}%</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
