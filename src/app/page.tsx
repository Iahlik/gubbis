'use client';

import { useEffect, useReducer, useRef, useState } from 'react';
import { gameReducer, initUI, rolEfectivo, guardarPartida, borrarPartidaGuardada } from '@/ui/gameReducer';
import { describir, CATALOGO_EDIFICIOS, COSTO_HUEVO, calcularPoderDefensa } from '@/sim';
import type { Racion, Rol, TipoEdificio } from '@/sim';
import Overworld from '@/ui/Overworld';
import Guia from '@/ui/Guia';
import type { PasoGuia } from '@/ui/Guia';
import Portada from '@/ui/Portada';
import FichaGubbi from '@/ui/FichaGubbi';
import { sonido, setSilencio, getSilencio } from '@/ui/audio';

const ROLES: { valor: Rol; etiqueta: string }[] = [
  { valor: 'granja', etiqueta: '🍑 Granja' },
  { valor: 'leñador', etiqueta: '🪵 Leñador' },
  { valor: 'mina', etiqueta: '🪨 Mina' },
  { valor: 'templo', etiqueta: '🕯️ Templo' },
  { valor: 'defensa', etiqueta: '🛡️ Defensa' },
  { valor: 'descanso', etiqueta: '😴 Descanso' },
];

const RACIONES: Racion[] = ['escasa', 'normal', 'abundante'];

const TIP: Record<string, string> = {
  mumi: 'La fruta que alimenta a la tribu. Se consume cada día según la ración. Si falta, los Gubbis enferman y pierden fe en ti.',
  oro: 'Se obtiene de la mina y los mercados. Sirve para construir.',
  madera: 'La cortan los leñadores. Material principal de construcción.',
  piedra: 'La sacan los mineros. Necesaria para edificios grandes.',
  fe: 'Cuánto creen en ti. La genera el templo y las victorias. Si cae demasiado, la tribu reniega de su dios (derrota).',
  prestigio: 'La fama de tu tribu entre las islas. Al llegar a 50, ganas.',
  conocimiento: 'Saberes antiguos. Alimentará la investigación (próximamente).',
  felicidad: 'El ánimo medio de la tribu. Emerge de cada individuo: hambre, duelos y riñas la bajan; victorias y buena comida la suben.',
  salud: 'La salud media. El hambre la destruye; los hospitales la recuperan.',
  seguridad: 'Qué tan lista está la defensa frente a la próxima oleada (defensores + cuarteles vs. su tamaño).',
  racion: 'Escasa ahorra Mumi pero baja el ánimo. Abundante anima y sana, pero cuesta 50% más.',
  sembrar: 'Inviertes Mumi hoy y cosechas ×2.5 en 5 días. No siembres lo que necesitas para comer.',
  composicion: 'Cada tipo pide otra aptitud: bruto → fortachones · enjambre → ágiles · volador → mágicos. Arma la defensa según lo que viene.',
  huevo: 'Crea un Gubbi nuevo. Eclosiona en 3 días, es cría 3 días más y al 7º día ya es adulto (y parte a su peregrinaje). Si hay una pareja feliz, la cría hereda sus talentos.',
  quien: 'Talento dominante + rasgos marcados. Los rasgos cambian la química del grupo: júntalos con cabeza.',
  animo: 'La moral individual. Con ánimo bajo rinden menos y pueden irse de la isla.',
  devocion: 'Cuánto te obedece este Gubbi. Los escépticos infelices se rebelan.',
};

export default function Pagina() {
  const [ui, dispatch] = useReducer(gameReducer, undefined, () => initUI());
  const [siembra, setSiembra] = useState(0);
  const [listo, setListo] = useState(false);
  const [confirmando, setConfirmando] = useState(false);
  const [transicion, setTransicion] = useState<{ dia: number; faltan: number } | null>(null);
  const [fichaId, setFichaId] = useState<string | null>(null);
  const [mudo, setMudo] = useState(false);
  const [enPortada, setEnPortada] = useState(true);
  const [pasoGuia, setPasoGuia] = useState(0); // 0 = guía cerrada
  const [gubbiGuia, setGubbiGuia] = useState<string | null>(null);

  // La semilla es aleatoria: la partida solo se crea/renderiza en el cliente (evita hydration mismatch)
  useEffect(() => {
    setListo(true);
    try {
      const m = window.localStorage.getItem('gubbis-mudo') === '1';
      setMudo(m); setSilencio(m);
    } catch { /* ok */ }
  }, []);

  // Autoguardado: cada vez que el sim produce un estado nuevo
  useEffect(() => { guardarPartida(ui.partida); }, [ui.partida]);

  const salirDePortada = () => {
    setEnPortada(false);
    try {
      if (!window.localStorage.getItem('gubbis-guia-vista')) setPasoGuia(1);
    } catch { setPasoGuia(1); }
  };

  const cerrarGuia = () => {
    setPasoGuia(0);
    try { window.localStorage.setItem('gubbis-guia-vista', '1'); } catch { /* ok */ }
  };

  // La guía avanza cuando el jugador HACE lo pedido
  const clicEnGubbi = (id: string) => {
    setGubbiGuia(id);
    setPasoGuia((p) => {
      if (p === 1) return 2;
      if (p === 0) setFichaId(id); // sin guía: abre la ficha
      return p;
    });
  };
  useEffect(() => {
    const objetivoGuia = gubbiGuia && ui.partida.gubbis.find((g) => g.id === gubbiGuia)?.etapa !== 'cría' ? gubbiGuia : null;
    if (pasoGuia === 2 && ui.pendientes.some((d) => d.tipo === 'asignarRol' && (!objetivoGuia || d.gubbiId === objetivoGuia))) setPasoGuia(3);
    if (pasoGuia === 3 && ui.pendientes.some((d) => d.tipo === 'sembrar')) setPasoGuia(4);
    if (pasoGuia === 5 && ui.pendientes.some((d) => d.tipo === 'bendecirHuevo')) setPasoGuia(6);
  }, [ui.pendientes, pasoGuia, gubbiGuia, ui.partida.gubbis]);
  useEffect(() => {
    if (pasoGuia === 6 && ui.partida.dia >= 1) setPasoGuia(7);
  }, [ui.partida.dia, pasoGuia]);

  useEffect(() => {
    if (!confirmando) return;
    const t = setTimeout(() => setConfirmando(false), 4000);
    return () => clearTimeout(t);
  }, [confirmando]);

  // Transición entre días: se dispara cuando el sim resolvió un turno
  const diaPrevio = useRef(ui.partida.dia);
  useEffect(() => {
    if (ui.partida.dia > diaPrevio.current && ui.partida.estado === 'jugando') {
      const faltanAhora = ui.partida.proximaOleada.turnoObjetivo - ui.partida.dia;
      if (ui.partida.log.some((l) => l.includes('LA OLEADA'))) sonido.rugido();
      else if (faltanAhora <= 2) sonido.alerta();
      else sonido.tambor();
      if (ui.partida.log.some((l) => l.includes('🐣') || l.includes('🏅'))) setTimeout(() => sonido.pop(), 600);
      setTransicion({ dia: ui.partida.dia, faltan: faltanAhora });
      const t = setTimeout(() => setTransicion(null), 1700);
      return () => clearTimeout(t);
    }
    diaPrevio.current = ui.partida.dia;
  }, [ui.partida.dia, ui.partida.estado, ui.partida.proximaOleada.turnoObjetivo]);
  useEffect(() => { diaPrevio.current = ui.partida.dia; }, [ui.partida.dia]);

  if (!listo) {
    return <main className="cargando dato">Amanece sobre la isla…</main>;
  }

  if (enPortada) {
    return <Portada alComenzar={salirDePortada} />;
  }

  const { partida } = ui;
  const faltan = partida.proximaOleada.turnoObjetivo - partida.dia;
  const defensa = Math.round(calcularPoderDefensa(partida));
  const fichaGubbi = fichaId ? partida.gubbis.find((g) => g.id === fichaId) : undefined;

  const elegido = gubbiGuia ? partida.gubbis.find((g) => g.id === gubbiGuia) : undefined;
  const rolEtiqueta = (r: Rol) => ROLES.find((x) => x.valor === r)?.etiqueta ?? r;
  const PASOS: Record<number, PasoGuia> = {
    1: {
      contenido: <>Bienvenido al mundo de los <b>Gubbis</b>. Eres su dios: ellos no te ven, pero te sienten. Conozcámoslos — <b>haz clic sobre un Gubbi</b> en el mapa.</>,
      esperaAccion: 'esperando tu clic en el mapa…',
      destacar: 'mapa',
    },
    2: {
      contenido: elegido && elegido.etapa !== 'cría'
        ? <>Este se llama <b>{elegido.nombre}</b>: es <b>{describir(elegido)}</b> y hoy trabaja en <b>{rolEtiqueta(elegido.rolAsignado)}</b>. El color de su cuerpo es su talento. Tu poder es asignar bien: búscalo en la tabla <b>La tribu</b> y <b>cámbiale la tarea a él</b> con el selector.</>
        : <>Cada Gubbi tiene nombre, talento (su color) y manías. Tu poder es asignar bien: en la tabla <b>La tribu</b>, cambia la tarea de alguien con el selector.</>,
      esperaAccion: elegido && elegido.etapa !== 'cría' ? `esperando que cambies la tarea de ${elegido.nombre}…` : 'esperando que cambies una tarea…',
      destacar: 'tribu',
    },
    3: {
      contenido: <>La tribu come <b>Mumi</b> cada día (mira el panel Recursos). Para no pasar hambre mañana, hay que sembrar hoy: en <b>Decisiones del día</b>, <b>siembra 10 de Mumi</b> — rinde ×2.5 en 5 días.</>,
      esperaAccion: 'esperando tu siembra…',
      destacar: 'decisiones',
    },
    4: {
      contenido: <>Ahora lo importante: el <b>volcán Escarlata</b>. Cada ~12 días baja una oleada de criaturas — el panel de arriba dice cuánto falta, su tamaño y composición: <b>bruto</b> → fortachones, <b>enjambre</b> → ágiles, <b>volador</b> → mágicos. Ten defensores listos <b>antes</b>; el humo del volcán se enciende cuando se acerca.</>,
      esperaAccion: null,
      destacar: 'volcan',
    },
    5: {
      contenido: <>La tribu también crece: <b>bendice un huevo</b> en Decisiones (cuesta 20 🍑 + 10 🕯️). Eclosiona en 3 días y al 7º ya es adulto… que parte al volcán en su peregrinaje. Las parejas felices a veces ponen huevos gratis.</>,
      esperaAccion: 'esperando tu huevo…',
      destacar: 'decisiones',
    },
    6: {
      contenido: <>Todo listo. Tus decisiones no ocurren hasta que el día termina: <b>pulsa «Terminar el día 0»</b> y lee el <b>Reporte</b> a la derecha — ahí la isla te cuenta lo que pasó.</>,
      esperaAccion: 'esperando el fin del día…',
      destacar: 'terminar',
    },
    7: {
      contenido: <>¡La isla es tuya! 🌅 Recuerda: prepara la defensa <b>antes</b> de cada oleada, cuida el ánimo (los infelices se van) y lee a tu tribu. Si necesitas repasar, el botón <b>❓</b> reabre esta guía. Buena suerte, dios de los Gubbis.</>,
      esperaAccion: null,
      destacar: null,
    },
  };
  const guia = pasoGuia >= 1 ? PASOS[pasoGuia] : undefined;
  // Mientras la guía está abierta: la zona del paso brilla, TODO lo demás queda bloqueado
  const claseGuia = (zona: string) => {
    if (!guia) return '';
    return guia.destacar === zona ? ' guia-destacado' : ' guia-bloqueo';
  };

  if (partida.estado !== 'jugando') {
    return (
      <main>
        <div className="panel fin">
          <h2>{partida.estado === 'victoria' ? '👑 Victoria' : '☠️ Derrota'}</h2>
          <p>{partida.motivoFin}</p>
          <p className="dato">Sobreviviste {partida.dia} días y {partida.oleadasSobrevividas} oleada(s) · semilla {partida.semilla}</p>
          <button className="primario" onClick={() => { borrarPartidaGuardada(); dispatch({ type: 'NUEVA_PARTIDA' }); }}>Nueva partida</button>
          {partida.cronica.length > 0 && (
            <div className="cronica">
              <h2>📜 Crónica de la tribu</h2>
              {partida.cronica.map((linea, i) => <p key={i}>{linea}</p>)}
            </div>
          )}
        </div>
        <PanelLog log={partida.log} />
      </main>
    );
  }

  return (
    <main>
      <header className="encabezado">
        <h1>Gubbis <span className="dia">Día {partida.dia} · semilla {partida.semilla}</span></h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => { const m = !mudo; setMudo(m); setSilencio(m); try { window.localStorage.setItem('gubbis-mudo', m ? '1' : '0'); } catch { /* ok */ } }}
            aria-label={mudo ? 'Activar sonido' : 'Silenciar'}>{mudo ? '🔇' : '🔊'}</button>
          <button onClick={() => { setPasoGuia(1); setGubbiGuia(null); }} aria-label="Abrir la guía interactiva">❓ Cómo se juega</button>
          <button disabled={!!guia} onClick={() => { borrarPartidaGuardada(); dispatch({ type: 'NUEVA_PARTIDA' }); }}>Reiniciar</button>
        </div>
      </header>

      {/* El latido del juego, arriba de todo */}
      <section className={`panel panel-volcan ${faltan <= 3 ? 'alerta' : ''}${claseGuia('volcan')}`}>
        <h2>🌋 El volcán Escarlata</h2>
        <p className="dato" style={{ margin: 0 }}>
          Próxima oleada en <span className={faltan <= 5 ? 'cuenta-grande' : ''}>{faltan} día(s)</span> · tamaño
          estimado <b>{partida.proximaOleada.tamano}</b> ·{' '}
          <span data-tip={TIP.composicion} tabIndex={0}>composición: {partida.proximaOleada.composicion.join(' + ')}</span>
          {' · '}tu defensa estimada:{' '}
          <span className={defensa >= partida.proximaOleada.tamano ? 'defensa-ok' : 'defensa-mal'}
            data-tip="Suma de tus defensores (según aptitudes, ánimo, química y títulos) más cuarteles, contra la composición que viene. Si está en rojo, te falta músculo." tabIndex={0}>
            {defensa} {defensa >= partida.proximaOleada.tamano ? '✓' : '⚠️'}
          </span>
        </p>
        <div className="mecha" aria-hidden>
          <div style={{ width: `${Math.max(4, 100 - (faltan / 14) * 100)}%` }} />
        </div>
      </section>

      {/* Recursos a la izquierda, mundo a la derecha */}
      <div className="tablero">
        <section className={`panel${claseGuia('recursos')}`}>
          <h2>Recursos</h2>
          <div className="recursos">
            <span className="dato">👥 Gubbis <b>{partida.gubbis.length}</b></span>
            <span className="dato"><span data-tip={TIP.mumi} tabIndex={0}>🍑 Mumi</span> <b>{partida.recursos.mumi.toFixed(0)}</b></span>
            <span className="dato"><span data-tip={TIP.oro} tabIndex={0}>🪙 Oro</span> <b>{partida.recursos.oro.toFixed(0)}</b></span>
            <span className="dato"><span data-tip={TIP.madera} tabIndex={0}>🪵 Madera</span> <b>{partida.recursos.madera.toFixed(0)}</b></span>
            <span className="dato"><span data-tip={TIP.piedra} tabIndex={0}>🪨 Piedra</span> <b>{partida.recursos.piedra.toFixed(0)}</b></span>
            <span className="dato"><span data-tip={TIP.fe} tabIndex={0}>🕯️ Fe</span> <b>{partida.recursos.fe.toFixed(0)}</b></span>
            <span className="dato"><span data-tip={TIP.prestigio} tabIndex={0}>⭐ Prestigio</span> <b>{partida.recursos.prestigio.toFixed(0)} / 50</b></span>
            <span className="dato"><span data-tip={TIP.conocimiento} tabIndex={0}>📜 Conocimiento</span> <b>{partida.recursos.conocimiento.toFixed(0)}</b></span>
            <div className="separador" />
            <span className="dato stat"><span data-tip={TIP.felicidad} tabIndex={0}>😊 Felicidad</span> <b>{partida.stats.felicidad}</b></span>
            <span className="dato stat"><span data-tip={TIP.salud} tabIndex={0}>❤️ Salud</span> <b>{partida.stats.salud}</b></span>
            <span className="dato stat"><span data-tip={TIP.seguridad} tabIndex={0}>🛡️ Seguridad</span> <b>{partida.stats.seguridad}</b></span>
          </div>
        </section>

        <section className={`panel panel-mapa${claseGuia('mapa')}`}>
          <Overworld estado={partida} alClicGubbi={clicEnGubbi} />
          <div className="leyenda" aria-label="Leyenda del mapa">
            <span className="chip"><span className="punto" style={{ background: '#e2604a' }} /> fortachón</span>
            <span className="chip"><span className="punto" style={{ background: '#9fd06b' }} /> ágil</span>
            <span className="chip"><span className="punto" style={{ background: '#c9a3ff' }} /> mágico</span>
            <span className="chip"><span className="punto" style={{ background: '#6fc2cf' }} /> inteligente</span>
            <span className="chip">· toca un Gubbi para ver su nombre</span>
          </div>
          <p className="ayuda-mapa">🖱️ rueda: zoom · arrastra el mapa: paneo · doble clic: reiniciar vista · ✋ arrastra un Gubbi para moverlo (volverá caminando a su tarea)</p>
        </section>

        <PanelLog log={partida.log} extra={claseGuia('reporte')} />
      </div>

      {/* La tribu y las decisiones, lado a lado */}
      <div className="zona-baja">
        <section className={`panel${claseGuia('tribu')}`}>
          <h2>La tribu</h2>
          <div className="scroll-x">
            <table>
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th className="col-quien"><span data-tip={TIP.quien} tabIndex={0}>Quién es</span></th>
                  <th className="num">Edad</th>
                  <th className="num"><span data-tip={TIP.animo} tabIndex={0}>Ánimo</span></th>
                  <th className="num"><span data-tip={TIP.devocion} tabIndex={0}>Dev.</span></th>
                  <th>Tarea</th>
                </tr>
              </thead>
              <tbody>
                {partida.gubbis.map((g) => (
                  <tr key={g.id} className={g.etapa === 'cría' ? 'cria' : ''}>
                    <td>
                      <span className="nombre-clicable" role="button" tabIndex={0}
                        onClick={() => setFichaId(g.id)}
                        onKeyDown={(e) => e.key === 'Enter' && setFichaId(g.id)}>
                        {g.nombre}
                      </span>
                      {g.titulo && <span title={g.titulo}> 🏅</span>}
                      {g.etapa === 'cría' && ' 🐣'}{g.etapa === 'anciano' && ' 🧓'}
                    </td>
                    <td className="etiqueta-rasgo col-quien">{describir(g)}</td>
                    <td className="num">{g.edad}</td>
                    <td className="num">{g.animo.toFixed(0)}</td>
                    <td className="num">{g.devocion.toFixed(0)}</td>
                    <td>
                      {g.etapa === 'cría' ? 'creciendo' : (
                        <select
                          value={rolEfectivo(ui, g.id)}
                          onChange={(e) => dispatch({ type: 'ASIGNAR_ROL', gubbiId: g.id, rol: e.target.value as Rol })}
                          aria-label={`Tarea de ${g.nombre}`}
                        >
                          {ROLES.map((r) => <option key={r.valor} value={r.valor}>{r.etiqueta}</option>)}
                        </select>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className={`panel${claseGuia('decisiones')}`}>
          <h2>Decisiones del día</h2>

          {partida.peticiones.map((pe) => {
            const g = partida.gubbis.find((x) => x.id === pe.gubbiId);
            if (!g) return null;
            const resuelta = ui.pendientes.find((d) => d.tipo === 'resolverPeticion' && d.gubbiId === pe.gubbiId);
            return (
              <div key={pe.gubbiId} className="peticion dato">
                🙏 <b>{g.nombre}</b> pide pasar a <b>{rolEtiqueta(pe.rolDeseado)}</b>
                {resuelta && resuelta.tipo === 'resolverPeticion' ? (
                  <p className="etiqueta-rasgo" style={{ margin: '4px 0 0' }}>→ {resuelta.respuesta === 'permitir' ? 'permitirás' : 'negarás'} al terminar el día</p>
                ) : (
                  <div className="acciones">
                    <button onClick={() => { sonido.click(); dispatch({ type: 'RESOLVER_PETICION', gubbiId: pe.gubbiId, respuesta: 'permitir' }); }}>✓ Permitir</button>
                    <button onClick={() => { sonido.click(); dispatch({ type: 'RESOLVER_PETICION', gubbiId: pe.gubbiId, respuesta: 'negar' }); }}>✕ Negar</button>
                  </div>
                )}
              </div>
            );
          })}

          <p className="dato">
            <span data-tip={TIP.racion} tabIndex={0}>Ración</span>:{' '}
            <select
              value={(ui.pendientes.find((d) => d.tipo === 'racion') as { nivel: Racion } | undefined)?.nivel ?? partida.racion}
              onChange={(e) => dispatch({ type: 'SET_RACION', nivel: e.target.value as Racion })}
              aria-label="Nivel de ración"
            >
              {RACIONES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </p>

          <p className="dato">
            <span data-tip={TIP.sembrar} tabIndex={0}>Sembrar Mumi</span>:{' '}
            <input
              type="number" min={0} max={Math.floor(partida.recursos.mumi)} value={siembra}
              style={{ width: 70 }}
              onChange={(e) => {
                const v = Number(e.target.value) || 0;
                setSiembra(v);
                dispatch({ type: 'SEMBRAR', cantidad: v });
              }}
              aria-label="Mumi a sembrar"
            />
          </p>

          <p className="dato">
            <button
              data-tip={TIP.huevo}
              disabled={partida.recursos.mumi < COSTO_HUEVO.mumi || partida.recursos.fe < COSTO_HUEVO.fe}
              onClick={() => dispatch({ type: 'BENDECIR_HUEVO' })}
            >
              🥚 Bendecir un huevo
            </button>{' '}
            <span className="etiqueta-rasgo">🍑{COSTO_HUEVO.mumi} 🕯️{COSTO_HUEVO.fe}</span>
          </p>
          {partida.huevos.length > 0 && (
            <p className="etiqueta-rasgo dato">
              En el nido: {partida.huevos.map((h) => `🥚 ${Math.max(0, h.diaEclosion - partida.dia)}d`).join(' · ')}
            </p>
          )}

          <h2 style={{ marginTop: 16 }}>Construir</h2>
          {(Object.keys(CATALOGO_EDIFICIOS) as TipoEdificio[]).map((tipo) => {
            const c = CATALOGO_EDIFICIOS[tipo];
            const alcanza = partida.recursos.madera >= c.madera && partida.recursos.piedra >= c.piedra && partida.recursos.oro >= c.oro;
            return (
              <p key={tipo} className="dato" style={{ margin: '7px 0' }}>
                <button disabled={!alcanza} data-tip={c.descripcion} onClick={() => dispatch({ type: 'CONSTRUIR', edificio: tipo })}>
                  {tipo}
                </button>{' '}
                <span className="etiqueta-rasgo">🪵{c.madera} 🪨{c.piedra} 🪙{c.oro}</span>
              </p>
            );
          })}
          {partida.edificios.length > 0 && (
            <p className="etiqueta-rasgo dato">En pie: {partida.edificios.map((e) => e.tipo).join(', ')}</p>
          )}
        </section>
      </div>

      <footer className="pie">Desarrollado por Ignacio Larraín · 2026</footer>

      {transicion && (
        <div className={`transicion-dia${transicion.faltan <= 5 ? ' transicion-alerta' : ''}`} aria-hidden>
          <p className="transicion-icono">{transicion.faltan <= 5 ? '🌋' : '☀️'}</p>
          <p className="transicion-titulo">Día {transicion.dia}</p>
          {transicion.faltan <= 5 && transicion.faltan > 0 && (
            <p className="transicion-aviso">la oleada llega en {transicion.faltan} día{transicion.faltan === 1 ? '' : 's'}</p>
          )}
          {transicion.faltan <= 0 && <p className="transicion-aviso">¡LA OLEADA ESTÁ AQUÍ!</p>}
        </div>
      )}

      {faltan <= 5 && !guia && (
        <div className="vigneta-oleada" style={{ opacity: (6 - faltan) * 0.13 }} aria-hidden />
      )}

      {fichaGubbi && !guia && (
        <FichaGubbi gubbi={fichaGubbi} partida={partida} alCerrar={() => setFichaId(null)} />
      )}

      {guia && (
        <Guia
          paso={pasoGuia}
          total={7}
          datos={guia}
          alContinuar={() => (pasoGuia >= 7 ? cerrarGuia() : setPasoGuia(pasoGuia + 1))}
          alOmitirPaso={() => (pasoGuia >= 7 ? cerrarGuia() : setPasoGuia(pasoGuia + 1))}
          alSalir={cerrarGuia}
        />
      )}

      <div className={`barra-inferior${claseGuia('terminar')}`}>
        {ui.pendientes.length > 0 && <span className="pendiente dato">{ui.pendientes.length} decisión(es)</span>}
        {confirmando ? (
          <>
            <button className="fantasma" onClick={() => setConfirmando(false)}>Cancelar</button>
            <button className="primario" autoFocus
              onClick={() => { setConfirmando(false); dispatch({ type: 'TERMINAR_TURNO' }); setSiembra(0); }}>
              ✓ Confirmar fin del día {partida.dia}
            </button>
          </>
        ) : (
          <button className="primario" disabled={!!guia && guia.destacar !== 'terminar'}
            onClick={() => { sonido.click(); setConfirmando(true); }}>
            Terminar el día {partida.dia} →
          </button>
        )}
      </div>
    </main>
  );
}

function PanelLog({ log, extra = '' }: { log: string[]; extra?: string }) {
  return (
    <section className={`panel panel-log${extra}`}>
      <h2>Reporte</h2>
      <div className="log">
        {log.map((linea, i) => <p key={i}>{linea}</p>)}
      </div>
    </section>
  );
}
