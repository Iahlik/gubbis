'use client';

// Monta Phaser solo en el cliente (import dinámico dentro de useEffect: cero SSR).
// El overworld es presentación pura: recibe el GameState y lo refleja.

import { useEffect, useRef } from 'react';
import type { GameState } from '@/sim';
import { ANCHO, ALTO, TILE } from '@/render/mapa';

export default function Overworld({ estado, alClicGubbi }: { estado: GameState; alClicGubbi?: (id: string) => void }) {
  const contenedorRef = useRef<HTMLDivElement>(null);
  const juegoRef = useRef<import('phaser').Game | null>(null);
  const estadoRef = useRef(estado);
  estadoRef.current = estado;
  const clicRef = useRef(alClicGubbi);
  clicRef.current = alClicGubbi;

  useEffect(() => {
    let cancelado = false;
    (async () => {
      const Phaser = (await import('phaser')).default;
      const { EscenaIsla } = await import('@/render/EscenaIsla');
      if (cancelado || !contenedorRef.current || juegoRef.current) return;

      const juego = new Phaser.Game({
        type: Phaser.AUTO,
        parent: contenedorRef.current,
        width: ANCHO * TILE,
        height: ALTO * TILE,
        backgroundColor: '#16323e',
        scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_HORIZONTALLY },
        scene: [EscenaIsla],
      });
      juego.registry.set('estado', estadoRef.current);
      juego.events.on('gubbi-click', (id: string) => clicRef.current?.(id));
      juegoRef.current = juego;
    })();

    return () => {
      cancelado = true;
      juegoRef.current?.destroy(true);
      juegoRef.current = null;
    };
  }, []);

  // Cada vez que cambia el estado (turno resuelto, decisión), la escena se entera.
  useEffect(() => {
    juegoRef.current?.registry.set('estado', estado);
  }, [estado]);

  return (
    <div
      ref={contenedorRef}
      style={{ width: '100%', aspectRatio: `${ANCHO} / ${ALTO}`, lineHeight: 0 }}
      aria-label="Mapa de la isla"
    />
  );
}
