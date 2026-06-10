# Gubbis — Fase 1 (jugar ya, sin backend)

Juego de gestión de tribu por turnos. Eres el dios de los Gubbis: mantenlos vivos,
felices y fieles mientras el volcán Escarlata incuba oleadas de dinosaurios.

Este repo implementa la **Fase 1** del handoff técnico:

- `src/sim/` — **simulador en TypeScript puro** (sin React, sin DB). El corazón es
  la función pura `resolverTurno(estado, decisiones)`, dividida en fases:
  decisiones → producción → consumo → eventos → oleada → vida → envejecimiento → stats.
- `src/ui/gameReducer.ts` — `useReducer` como motor de turno en cliente.
- `src/app/` — HUD de Next.js (tablas, números, íconos).
- `src/render/` + `src/ui/Overworld.tsx` — **capa gráfica (Phaser)**: la isla como
  tilemap procedural determinista, Gubbis como sprites que deambulan cerca de su
  tarea, el volcán humea más fuerte cuando la oleada se acerca, y el día de la
  oleada los dinos bajan a la aldea (animación que dramatiza un resultado YA
  calculado por el sim — el movimiento es cosmético, Handoff §15).

## Arrancar

```bash
npm install
npm run dev        # http://localhost:3000
```

## Tests del simulador

```bash
npm test           # vitest: determinismo, no-mutación, oleadas, hambre, humo 100 turnos
npm run typecheck
```

## Cómo jugar (v1)

1. Asigna una tarea a cada Gubbi adulto (granja, leñador, mina, templo, defensa, descanso).
2. Decide la ración y cuánta Mumi sembrar (cosecha ×2.5 en 5 días).
3. Construye edificios si alcanzan los recursos.
4. **Terminar el día** resuelve el turno y muestra el reporte.
5. Cada ~12 días baja una oleada del volcán: prepara defensores *antes*.
   La composición (bruto / enjambre / volador) pide aptitudes distintas.

## Estructura

```
src/sim/
  tipos.ts            # GameState, Gubbi, Decision, Oleada… (Handoff §18)
  rng.ts              # RNG con semilla (determinista)
  gubbi.ts            # generarGubbi, describir ("fortachón gruñón"), techos de talento
  quimica.ts          # química de grupo y modificador de valor (§7)
  edificios.ts        # catálogo y costos
  fases/
    produccion.ts     # producción + subir por uso (§8)
    consumo.ts        # raciones y hambre
    eventos.ts        # eventos aleatorios
    oleada.ts         # la columna vertebral (§5)
    vida.ts           # vínculos, parejas, nacimientos, muertes, peregrinaje (§7, §9)
  resolverTurno.ts    # la función pura central (§13–15)
  nuevaPartida.ts
  index.ts            # API pública del sim
```

## Decisiones ya tomadas (no re-litigar)

Ver `Handoff_Gubbis_v3` §19. En resumen: individuos persistentes, relaciones con
memoria, oleada desde v1, sim puro desacoplado, overworld después, backend Node
(Fase 2: saves JSONB en Postgres), Python solo como laboratorio de balance offline.

## La capa gráfica (decisiones)

- **Phaser** sobre Pixi (§20 resuelto): tilemaps, tweens, partículas y cámara ya
  incluidos; el camino más corto a un overworld vivo.
- **Placeholders generados por código** (blobs con ojos, emojis para edificios):
  cero assets que mantener. Cuando haya arte real: la isla pasa a un tilemap de
  *Tiled* y los Gubbis a sprite sheets — solo cambia `src/render/`, el sim ni se entera.
- Lectura visual: color del cuerpo = aptitud dominante (rojo fortachón, verde ágil,
  lila mágico, cian inteligente); crías pequeñas, ancianos tenues. Tocar un Gubbi
  muestra su nombre.

## Sistemas completos (v9)

- **Autoguardado** en localStorage: F5 ya no mata la partida; Reiniciar la borra.
- **Ficha de Gubbi** (clic en el nombre o en el sprite): aptitudes con techos, vínculos, título.
- **Defensa estimada** visible en el panel del volcán (verde ✓ / rojo ⚠️ contra el tamaño).
- **Títulos con aura** (§8): Campeón (+20% defensa), Maestra Cultivadora (+20% Mumi),
  Sumo Sacerdote (+25% Fe y devoción de toda la tribu), Anciano Sabio (los jóvenes
  suben más rápido). Cada título da +2 Prestigio.
- **Peticiones de voluntad propia** (§9): Gubbis infelices y mal encajados piden rol;
  permitir/negar con consecuencias. La petición es una pista del talento oculto.
- **Crónica**: los hitos de la partida (nacimientos, caídos, títulos, parejas, oleadas)
  se cuentan al final.
- **Sonido sintetizado** (Web Audio, sin assets): tambor del día, latidos de alerta,
  rugido de oleada. Botón 🔊/🔇.
- **Balance verificado**: bot con estrategia decente gana por Prestigio ~día 128;
  las derrotas tardías (117–185) son la carrera final contra oleadas que escalan.

## Próximos pasos sugeridos

- Afinar los "dos relojes" (cadencia de oleadas vs. generaciones) — §20.
- Títulos con buff de aura (Campeón, Maestra Cultivadora…).
- Peticiones de cambio de rol por voluntad propia (permitir / obligar).
- Fase 2: API routes de Next + Postgres (save = GameState como JSONB).
- Laboratorio de balance en Python (miles de partidas headless).
