// Escena Phaser del overworld. Lee GameState y lo DRAMATIZA: el movimiento es
// cosmético (Handoff §15) — el sim ya decidió todo; aquí solo se ve.
// Interacción: rueda = zoom hacia el cursor, arrastrar mapa = paneo,
// doble clic = reiniciar vista, arrastrar un Gubbi = moverlo (volverá solo).

import Phaser from 'phaser';
import type { GameState, Gubbi, TipoEdificio } from '@/sim';
import { aptitudDominante, crearRng } from '@/sim';
import { ANCHO, ALTO, TILE, VOLCAN, ALDEA, generarMapa, zonaDeRol, COLOR_APTITUD } from './mapa';
import type { Tile } from './mapa';

const EMOJI_EDIFICIO: Record<TipoEdificio, string> = {
  granja: '🌾', aserradero: '🪵', mina: '⛏️', mercado: '⚖️',
  hospital: '🛖', cuartel: '🛡️', templo: '⛩️',
};

// Variaciones de color por tile: el césped plano era el 80% del problema visual
const PASTOS = [0x4f7a3a, 0x4a7236, 0x558142, 0x4d7d3c];
const AGUAS = [0x1d4e5e, 0x1b4858, 0x205565];
const ARENAS = [0xd9b380, 0xd2ab77, 0xe0bb88];

interface SpriteGubbi {
  cont: Phaser.GameObjects.Container;
  cuerpo: Phaser.GameObjects.Image;
  cara: Phaser.GameObjects.Image;
  etiqueta: Phaser.GameObjects.Text;
  destino: Phaser.Math.Vector2;
  hogar: Phaser.Math.Vector2;
  velocidad: number;
  arrastrando: boolean;
  fase: number; // desfase del rebote al caminar
}

export class EscenaIsla extends Phaser.Scene {
  private sprites = new Map<string, SpriteGubbi>();
  private capaEdificios?: Phaser.GameObjects.Group;
  private humo?: Phaser.GameObjects.Particles.ParticleEmitter;
  private resplandor?: Phaser.GameObjects.Arc;
  private listo = false;
  private ultimoDia = -1;
  private semillaMapa?: number;
  private arrastrandoGubbi = false;
  private ultimoClick = 0;
  private mapa?: Tile[][];
  private temblor?: Phaser.Time.TimerEvent;

  constructor() { super('isla'); }

  create(): void {
    this.crearTexturas();
    const estado = this.registry.get('estado') as GameState | undefined;
    if (estado) this.dibujarMapa(estado.semilla);

    this.configurarCamara();

    this.registry.events.on('changedata-estado', (_p: unknown, valor: GameState) => this.sincronizar(valor));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.registry.events.off('changedata-estado');
    });

    this.listo = true;
    if (estado) this.sincronizar(estado);
  }

  // ---------- cámara: zoom hacia el cursor, paneo, doble clic ----------

  private configurarCamara(): void {
    const cam = this.cameras.main;
    cam.setBounds(0, 0, ANCHO * TILE, ALTO * TILE);

    this.input.on('wheel', (pointer: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => {
      const antes = cam.getWorldPoint(pointer.x, pointer.y);
      cam.setZoom(Phaser.Math.Clamp(cam.zoom * (dy > 0 ? 0.88 : 1.14), 1, 2.8));
      const despues = cam.getWorldPoint(pointer.x, pointer.y);
      cam.scrollX += antes.x - despues.x;
      cam.scrollY += antes.y - despues.y;
    });

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (pointer.isDown && !this.arrastrandoGubbi && cam.zoom > 1.01) {
        cam.scrollX -= (pointer.x - pointer.prevPosition.x) / cam.zoom;
        cam.scrollY -= (pointer.y - pointer.prevPosition.y) / cam.zoom;
      }
    });

    this.input.on('pointerdown', () => {
      const ahora = this.time.now;
      if (ahora - this.ultimoClick < 300) {
        this.tweens.add({ targets: cam, zoom: 1, scrollX: 0, scrollY: 0, duration: 250, ease: 'Sine.easeOut' });
      }
      this.ultimoClick = ahora;
    });
  }

  // ---------- texturas generadas (placeholders con cariño) ----------

  private crearTexturas(): void {
    const g = this.add.graphics();
    // Cuerpo de Gubbi: blob blanco (se tiñe por aptitud) con patitas y brillo
    g.fillStyle(0xffffff, 1);
    g.fillEllipse(8, 9, 14, 13);
    g.fillEllipse(4, 15, 4, 3);
    g.fillEllipse(12, 15, 4, 3);
    g.generateTexture('gubbi-cuerpo', 16, 17);
    g.clear();
    // Cara: ojos + brillo del pelaje (no se tiñe)
    g.fillStyle(0xffffff, 0.35); g.fillEllipse(5.5, 5, 5, 3);
    g.fillStyle(0xffffff, 1); g.fillCircle(5, 7, 2.6); g.fillCircle(11, 7, 2.6);
    g.fillStyle(0x10181d, 1); g.fillCircle(5.6, 7.3, 1.2); g.fillCircle(11.6, 7.3, 1.2);
    g.generateTexture('gubbi-cara', 16, 17);
    g.clear();
    // Dino
    g.fillStyle(0xffffff, 1);
    g.fillTriangle(2, 18, 10, 2, 18, 18);
    g.fillTriangle(14, 12, 24, 8, 16, 18);
    g.generateTexture('dino', 24, 20);
    g.clear();
    // Humo
    g.fillStyle(0xbbbbbb, 1); g.fillCircle(6, 6, 6);
    g.generateTexture('humo', 12, 12);
    g.destroy();
  }

  private dibujarMapa(semilla: number): void {
    this.semillaMapa = semilla;
    const { tiles: mapa, rio } = generarMapa(semilla);
    this.mapa = mapa;
    const rng = crearRng((semilla ^ 0xdec0) >>> 0);
    const g = this.add.graphics().setDepth(0);

    for (let y = 0; y < ALTO; y++) {
      for (let x = 0; x < ANCHO; x++) {
        const t = mapa[y][x];
        const px = x * TILE, py = y * TILE;
        if (t === 'agua') {
          g.fillStyle(AGUAS[rng.entero(0, AGUAS.length - 1)], 1);
          g.fillRect(px, py, TILE, TILE);
        } else if (t === 'arena') {
          g.fillStyle(ARENAS[rng.entero(0, ARENAS.length - 1)], 1);
          g.fillRect(px, py, TILE, TILE);
          if (rng.chance(0.25)) { g.fillStyle(0xc49b66, 0.7); g.fillCircle(px + rng.entero(4, 20), py + rng.entero(4, 20), 1.4); }
        } else { // pasto, bosque y roca comparten suelo verde con matices
          g.fillStyle(t === 'roca' ? 0x6b5b50 : PASTOS[rng.entero(0, PASTOS.length - 1)], 1);
          g.fillRect(px, py, TILE, TILE);
          if (t === 'pasto' && rng.chance(0.12)) { // matas de hierba
            g.fillStyle(0x5d8f48, 0.9);
            g.fillRect(px + rng.entero(3, 18), py + rng.entero(3, 18), 2, 4);
          }
          if (t === 'pasto' && rng.chance(0.035)) { // flores
            g.fillStyle(rng.chance(0.5) ? 0xff9ec4 : 0xffd479, 1);
            g.fillCircle(px + rng.entero(4, 20), py + rng.entero(4, 20), 1.8);
          }
          if (t === 'roca' && rng.chance(0.4)) {
            g.fillStyle(0x7d6c60, 1); g.fillCircle(px + rng.entero(5, 19), py + rng.entero(5, 19), 3);
          }
        }
      }
    }

    // Árboles con tronco y copa a dos tonos (encima del suelo)
    const arboles = this.add.graphics().setDepth(1);
    for (let y = 0; y < ALTO; y++) {
      for (let x = 0; x < ANCHO; x++) {
        if (mapa[y][x] !== 'bosque') continue;
        const cx = x * TILE + TILE / 2 + rng.entero(-3, 3);
        const cy = y * TILE + TILE / 2 + rng.entero(-2, 2);
        arboles.fillStyle(0x5d4030, 1);
        arboles.fillRect(cx - 1.5, cy - 1, 3, 8);
        arboles.fillStyle(0x2c4d24, 1);
        arboles.fillCircle(cx, cy - 5, 7.5);
        arboles.fillStyle(0x3a6330, 1);
        arboles.fillCircle(cx - 2, cy - 7, 5);
        if (rng.chance(0.3)) { arboles.fillStyle(0xffab76, 1); arboles.fillCircle(cx + 3, cy - 4, 1.6); } // frutas Mumi
      }
    }

    // Destellos en el agua cerca de la costa
    for (let i = 0; i < 16; i++) {
      const x = rng.entero(1, ANCHO - 2), y = rng.entero(1, ALTO - 2);
      if (mapa[y][x] !== 'agua') continue;
      const destello = this.add.rectangle(x * TILE + rng.entero(4, 20), y * TILE + rng.entero(4, 20), rng.entero(4, 8), 1.5, 0xbfe8f0, 0.0).setDepth(0.5);
      this.tweens.add({
        targets: destello, alpha: { from: 0, to: 0.55 },
        duration: rng.entero(900, 1600), yoyo: true, repeat: -1, delay: rng.entero(0, 2500),
      });
    }

    // El río brilla y nace en cascada desde las rocas del volcán
    for (let i = 0; i < rio.length; i += 3) {
      const t = rio[i];
      const brillo = this.add.rectangle(t.x * TILE + TILE / 2, t.y * TILE + TILE / 2, 6, 1.5, 0xbfe8f0, 0).setDepth(0.5);
      this.tweens.add({ targets: brillo, alpha: 0.6, duration: rng.entero(700, 1300), yoyo: true, repeat: -1, delay: rng.entero(0, 1500) });
    }
    if (rio.length > 1) {
      const cab = rio[0];
      const cx = cab.x * TILE + TILE / 2, cy = cab.y * TILE;
      this.add.particles(cx, cy - 6, 'humo', {
        tint: 0xdff4f8, speedY: { min: 30, max: 60 }, speedX: { min: -4, max: 4 },
        scale: { start: 0.35, end: 0.08 }, alpha: { start: 0.8, end: 0 },
        lifespan: 550, frequency: 70,
      }).setDepth(1.6);
      const espuma = this.add.ellipse(cx, cy + 8, 14, 5, 0xffffff, 0.35).setDepth(0.6);
      this.tweens.add({ targets: espuma, alpha: 0.55, scaleX: 1.2, duration: 800, yoyo: true, repeat: -1 });
    }

    this.crearFauna(mapa, rng);

    // El volcán Escarlata: montaña por capas, cráter y resplandor que respira
    const vx = VOLCAN.x * TILE, vy = VOLCAN.y * TILE;
    this.resplandor = this.add.circle(vx, vy - 20, 30, 0xff5a3d, 0.16).setDepth(1.5);
    this.tweens.add({ targets: this.resplandor, alpha: 0.3, scale: 1.15, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    const vol = this.add.graphics().setDepth(2);
    vol.fillStyle(0x3a2a25, 1);
    vol.fillTriangle(vx - 42, vy + 32, vx, vy - 30, vx + 42, vy + 32);
    vol.fillStyle(0x4a3530, 1);
    vol.fillTriangle(vx - 30, vy + 32, vx, vy - 22, vx + 30, vy + 32);
    vol.fillStyle(0x2c1f1b, 1); // grietas
    vol.fillRect(vx - 4, vy - 8, 2, 18); vol.fillRect(vx + 6, vy - 2, 2, 14);
    vol.fillStyle(0xff6a3d, 1);
    vol.fillEllipse(vx, vy - 24, 24, 10);
    vol.fillStyle(0xe2483d, 1);
    vol.fillEllipse(vx, vy - 24, 16, 6);

    this.humo = this.add.particles(vx, vy - 28, 'humo', {
      speedY: { min: -22, max: -10 },
      speedX: { min: -6, max: 6 },
      scale: { start: 0.5, end: 1.7 },
      alpha: { start: 0.5, end: 0 },
      lifespan: 2800,
      frequency: 420,
      tint: 0x999999,
    }).setDepth(3);
  }

  // ---------- fauna ambiente: mariposas, pájaros y peces ----------

  private crearFauna(mapa: Tile[][], rng: ReturnType<typeof crearRng>): void {
    // Tiles útiles
    const tierra: { x: number; y: number }[] = [];
    const costa: { x: number; y: number }[] = [];
    for (let y = 1; y < ALTO - 1; y++) {
      for (let x = 1; x < ANCHO - 1; x++) {
        if (mapa[y][x] === 'pasto') tierra.push({ x, y });
        if (mapa[y][x] === 'agua' && (mapa[y][x - 1] !== 'agua' || mapa[y][x + 1] !== 'agua' || mapa[y - 1][x] !== 'agua' || mapa[y + 1][x] !== 'agua')) {
          costa.push({ x, y });
        }
      }
    }

    // Mariposas: revolotean entre flores
    const colores = [0xffd479, 0xff9ec4, 0xc9a3ff];
    for (let i = 0; i < 5; i++) {
      const inicio = rng.elegir(tierra);
      const m = this.add.rectangle(inicio.x * TILE, inicio.y * TILE, 3, 3, rng.elegir(colores), 0.95).setDepth(5.5);
      this.tweens.add({ targets: m, y: '-=3', duration: 260, yoyo: true, repeat: -1 }); // aleteo
      const volar = () => {
        if (!m.active) return;
        const destino = rng.elegir(tierra);
        this.tweens.add({
          targets: m, x: destino.x * TILE + rng.entero(-8, 8), y: destino.y * TILE + rng.entero(-8, 8),
          duration: rng.entero(2800, 5200), ease: 'Sine.easeInOut', onComplete: volar,
        });
      };
      volar();
    }

    // Pájaros: cruzan el cielo de cuando en cuando
    const lanzarPajaro = () => {
      const y = Phaser.Math.Between(16, 90);
      const izqADer = Math.random() < 0.5;
      const p = this.add.text(izqADer ? -16 : ANCHO * TILE + 16, y, '🕊️', { fontSize: '11px' })
        .setOrigin(0.5).setDepth(6.5).setAlpha(0.9).setFlipX(!izqADer);
      this.tweens.add({ targets: p, y: y + 6, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this.tweens.add({
        targets: p, x: izqADer ? ANCHO * TILE + 16 : -16, duration: Phaser.Math.Between(7000, 11000),
        onComplete: () => p.destroy(),
      });
    };
    this.time.addEvent({ delay: 9000, loop: true, callback: lanzarPajaro });
    this.time.delayedCall(2500, lanzarPajaro);

    // Peces: saltan cerca de la costa
    this.time.addEvent({
      delay: 4800, loop: true, callback: () => {
        if (costa.length === 0) return;
        const c = costa[Phaser.Math.Between(0, costa.length - 1)];
        const px = c.x * TILE + TILE / 2, py = c.y * TILE + TILE / 2;
        const pez = this.add.ellipse(px, py, 7, 3.5, 0x8fc7d8, 1).setDepth(0.8);
        this.tweens.chain({
          targets: pez,
          tweens: [
            { y: py - 12, angle: -40, duration: 280, ease: 'Sine.easeOut' },
            { y: py + 2, angle: -120, duration: 280, ease: 'Sine.easeIn' },
          ],
          onComplete: () => {
            const gota = this.add.particles(px, py, 'humo', {
              tint: 0x9fd8e8, speed: { min: 20, max: 50 }, scale: { start: 0.3, end: 0 }, lifespan: 350, emitting: false,
            }).setDepth(0.9);
            gota.explode(5, px, py);
            this.time.delayedCall(500, () => { gota.destroy(); pez.destroy(); });
          },
        });
      },
    });
  }

  // ---------- sincronización con el GameState ----------

  sincronizar(estado: GameState): void {
    if (!this.listo) return;
    if (this.semillaMapa !== undefined && this.semillaMapa !== estado.semilla) {
      this.scene.restart();
      return;
    }

    this.dibujarEdificios(estado);
    this.sincronizarGubbis(estado);
    this.ajustarVolcan(estado);

    const esTurnoNuevo = estado.dia !== this.ultimoDia;
    this.ultimoDia = estado.dia;
    if (esTurnoNuevo && estado.log.some((l) => l.includes('LA OLEADA'))) {
      this.animarOleada(Math.min(10, Math.ceil(estado.proximaOleada.tamano / 3)));
    }
  }

  private dibujarEdificios(estado: GameState): void {
    this.capaEdificios?.clear(true, true);
    this.capaEdificios = this.add.group();

    const conSombra = (x: number, y: number, emoji: string, tam = 26) => {
      const patch = this.add.ellipse(x, y + 11, 30, 10, 0x1a2a20, 0.45).setDepth(3.5);
      const t = this.add.text(x, y, emoji, { fontSize: `${tam}px` }).setOrigin(0.5).setDepth(4);
      t.setShadow(1, 2, '#00000088', 2);
      this.capaEdificios!.add(patch);
      this.capaEdificios!.add(t);
    };

    for (const e of estado.edificios) conSombra(e.posicion.x * TILE, e.posicion.y * TILE, EMOJI_EDIFICIO[e.tipo] ?? '🏠');
    conSombra(ALDEA.x * TILE, ALDEA.y * TILE, '⛺', 30);
    estado.huevos.forEach((_, i) => {
      conSombra(ALDEA.x * TILE + 18 + (i % 3) * 12, ALDEA.y * TILE + 10 + Math.floor(i / 3) * 12, '🥚', 14);
    });
  }

  private sincronizarGubbis(estado: GameState): void {
    const vivos = new Set(estado.gubbis.map((g) => g.id));

    for (const [id, s] of this.sprites) {
      if (!vivos.has(id)) {
        this.tweens.add({ targets: s.cont, alpha: 0, y: s.cont.y - 8, duration: 900, onComplete: () => s.cont.destroy() });
        this.sprites.delete(id);
      }
    }

    for (const g of estado.gubbis) {
      const zona = zonaDeRol(g.rolAsignado, estado.edificios);
      const hogar = new Phaser.Math.Vector2(zona.x * TILE, zona.y * TILE);
      const existente = this.sprites.get(g.id);
      if (existente) {
        const cambioZona = existente.hogar.distance(hogar) > 1;
        existente.hogar = hogar;
        if (cambioZona && !existente.arrastrando) existente.destino = this.puntoCerca(hogar);
        existente.cuerpo.setTint(COLOR_APTITUD[aptitudDominante(g)]);
        existente.cont.setScale(g.etapa === 'cría' ? 0.62 : g.etapa === 'anciano' ? 0.88 : 1);
        existente.cont.setAlpha(g.etapa === 'anciano' ? 0.85 : 1);
        existente.etiqueta.setText(g.nombre);
      } else {
        this.crearSpriteGubbi(g, hogar);
      }
    }
  }

  private crearSpriteGubbi(g: Gubbi, hogar: Phaser.Math.Vector2): void {
    const sombra = this.add.ellipse(0, 8, 13, 4.5, 0x000000, 0.28);
    const cuerpo = this.add.image(0, 0, 'gubbi-cuerpo').setTint(COLOR_APTITUD[aptitudDominante(g)]);
    const cara = this.add.image(0, 0, 'gubbi-cara');
    const etiqueta = this.add.text(0, -15, g.nombre, {
      fontSize: '9px', color: '#f2e8d8', backgroundColor: '#10181dcc', padding: { x: 3, y: 1 },
    }).setOrigin(0.5).setVisible(false);

    const inicio = this.puntoCerca(hogar);
    const cont = this.add.container(inicio.x, inicio.y, [sombra, cuerpo, cara, etiqueta]).setDepth(5);
    cont.setScale(g.etapa === 'cría' ? 0.62 : 1).setAlpha(0);
    this.tweens.add({ targets: cont, alpha: 1, duration: 600 });

    const spr: SpriteGubbi = {
      cont, cuerpo, cara, etiqueta, hogar,
      destino: this.puntoCerca(hogar),
      velocidad: 18 + Math.random() * 14,
      arrastrando: false,
      fase: Math.random() * Math.PI * 2,
    };

    // Interacción: clic muestra el nombre; arrastrar lo lleva en volandas
    cont.setSize(18, 19);
    cont.setInteractive({ useHandCursor: true });
    this.input.setDraggable(cont);

    cont.on('dragstart', () => {
      spr.arrastrando = true;
      this.arrastrandoGubbi = true;
      cont.setDepth(7);
      this.tweens.add({ targets: cont, scaleX: cont.scaleX * 1.25, scaleY: cont.scaleY * 0.85, duration: 120, yoyo: true });
    });
    cont.on('drag', (_p: Phaser.Input.Pointer, dragX: number, dragY: number) => {
      cont.x = Phaser.Math.Clamp(dragX, TILE / 2, ANCHO * TILE - TILE / 2);
      cont.y = Phaser.Math.Clamp(dragY, TILE / 2, ALTO * TILE - TILE / 2);
    });
    cont.on('dragend', () => {
      this.arrastrandoGubbi = false;
      cont.setDepth(5);
      const tile = this.tileEn(cont.x, cont.y);
      const enVolcan = Phaser.Math.Distance.Between(cont.x, cont.y, VOLCAN.x * TILE, VOLCAN.y * TILE) < 3.4 * TILE || tile === 'roca';
      if (tile === 'agua') {
        this.efectoAgua(spr);
        return;
      }
      if (enVolcan) {
        this.efectoFuego(spr);
        return;
      }
      spr.arrastrando = false;
      spr.destino = new Phaser.Math.Vector2(cont.x, cont.y); // se queda un rato donde lo soltaste…
      // …y el aplastón de aterrizaje
      this.tweens.add({ targets: cont, scaleY: cont.scaleY * 0.7, duration: 90, yoyo: true });
      etiqueta.setVisible(true);
      this.time.delayedCall(1800, () => etiqueta.setVisible(false));
    });
    cont.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (pointer.getDistance() < 6) { // fue un clic, no un arrastre
        etiqueta.setVisible(!etiqueta.visible);
        this.time.delayedCall(2500, () => etiqueta.setVisible(false));
        this.game.events.emit('gubbi-click', g.id);
      }
    });

    this.sprites.set(g.id, spr);
  }

  private ajustarVolcan(estado: GameState): void {
    const faltan = estado.proximaOleada.turnoObjetivo - estado.dia;
    if (this.humo) {
      if (faltan <= 1) { this.humo.frequency = 50; this.humo.particleTint = 0xe2483d; }
      else if (faltan <= 3) { this.humo.frequency = 120; this.humo.particleTint = 0xcc7755; }
      else { this.humo.frequency = 420; this.humo.particleTint = 0x999999; }
    }
    if (this.resplandor) {
      this.resplandor.setFillStyle(0xff5a3d, faltan <= 3 ? 0.34 : 0.16);
    }
    // Los últimos días, la isla entera tiembla de cuando en cuando
    if (faltan <= 2 && faltan > 0 && !this.temblor) {
      this.temblor = this.time.addEvent({
        delay: 2800, loop: true,
        callback: () => this.cameras.main.shake(200, 0.0016),
      });
    } else if ((faltan > 2 || faltan <= 0) && this.temblor) {
      this.temblor.destroy();
      this.temblor = undefined;
    }
  }

  /** Dramatiza la oleada YA resuelta por el sim. */
  private animarOleada(cantidad: number): void {
    this.cameras.main.shake(500, 0.004);
    const origen = { x: VOLCAN.x * TILE, y: VOLCAN.y * TILE + 14 };
    for (let i = 0; i < cantidad; i++) {
      const dino = this.add.image(origen.x + Phaser.Math.Between(-14, 14), origen.y, 'dino')
        .setTint(0xe2483d).setDepth(6).setAlpha(0).setFlipX(true);
      this.tweens.chain({
        targets: dino,
        tweens: [
          { alpha: 1, duration: 200, delay: i * 160 },
          { x: ALDEA.x * TILE + Phaser.Math.Between(-30, 30), y: ALDEA.y * TILE + Phaser.Math.Between(-16, 16), duration: 1400, ease: 'Sine.easeIn' },
          { alpha: 0, scale: 0.6, duration: 450 },
        ],
        onComplete: () => dino.destroy(),
      });
    }
    this.time.delayedCall(900, () => this.cameras.main.flash(250, 226, 72, 61, false));
  }

  // ---------- travesuras del dios: agua y fuego ----------

  private tileEn(px: number, py: number): Tile | undefined {
    if (!this.mapa) return undefined;
    const tx = Phaser.Math.Clamp(Math.floor(px / TILE), 0, ANCHO - 1);
    const ty = Phaser.Math.Clamp(Math.floor(py / TILE), 0, ALTO - 1);
    return this.mapa[ty][tx];
  }

  /** La tierra firme más cercana (búsqueda en espiral). */
  private orillaMasCercana(px: number, py: number): Phaser.Math.Vector2 {
    const tx = Math.floor(px / TILE), ty = Math.floor(py / TILE);
    for (let r = 1; r < 12; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const x = tx + dx, y = ty + dy;
          if (x < 0 || y < 0 || x >= ANCHO || y >= ALTO) continue;
          if (this.mapa && this.mapa[y][x] !== 'agua') {
            return new Phaser.Math.Vector2(x * TILE + TILE / 2, y * TILE + TILE / 2);
          }
        }
      }
    }
    return new Phaser.Math.Vector2(ALDEA.x * TILE, ALDEA.y * TILE);
  }

  private textoFlotante(x: number, y: number, texto: string, color = '#bfe8f0'): void {
    const t = this.add.text(x, y - 10, texto, {
      fontSize: '12px', color, fontStyle: 'bold', stroke: '#10181d', strokeThickness: 3,
    }).setOrigin(0.5).setDepth(8);
    this.tweens.add({ targets: t, y: y - 30, alpha: 0, duration: 1100, ease: 'Sine.easeOut', onComplete: () => t.destroy() });
  }

  /** ¡SPLASH! Se hunde, chapotea hasta la orilla y vuelve corriendo a lo suyo. */
  private efectoAgua(spr: SpriteGubbi): void {
    const { cont } = spr;
    spr.arrastrando = true; // congela su IA mientras dura el chapuzón
    const gotas = this.add.particles(cont.x, cont.y, 'humo', {
      tint: 0x9fd8e8, speed: { min: 50, max: 110 }, angle: { min: 210, max: 330 },
      scale: { start: 0.45, end: 0 }, lifespan: 550, emitting: false,
    }).setDepth(7);
    gotas.explode(16, cont.x, cont.y);
    this.time.delayedCall(800, () => gotas.destroy());
    this.textoFlotante(cont.x, cont.y, '¡SPLASH!');
    this.cameras.main.shake(120, 0.002);

    const orilla = this.orillaMasCercana(cont.x, cont.y);
    const escala = { x: cont.scaleX, y: cont.scaleY };
    this.tweens.chain({
      targets: cont,
      tweens: [
        { scaleY: escala.y * 0.4, alpha: 0.55, y: cont.y + 6, duration: 280, ease: 'Sine.easeIn' },        // se hunde
        { x: orilla.x, y: orilla.y, duration: 700, ease: 'Sine.easeInOut' },                                // nada a la orilla
        { scaleY: escala.y, alpha: 1, duration: 180 },                                                      // se sacude
      ],
      onComplete: () => {
        spr.arrastrando = false;
        spr.destino = this.puntoCerca(spr.hogar);
        const vel = spr.velocidad;
        spr.velocidad = vel * 2.4; // corre empapado de vuelta a la tierra
        this.time.delayedCall(3000, () => { spr.velocidad = vel; });
      },
    });
  }

  /** 🔥 Sale ardiendo y corre al centro del mapa hasta que se apaga. */
  private efectoFuego(spr: SpriteGubbi): void {
    const { cont } = spr;
    spr.arrastrando = false;
    this.textoFlotante(cont.x, cont.y, '¡AY AY AY!', '#ff5a4e');
    this.cameras.main.shake(150, 0.003);
    const llama = this.add.text(0, -11, '🔥', { fontSize: '12px' }).setOrigin(0.5);
    cont.add(llama);

    spr.destino = new Phaser.Math.Vector2((ANCHO * TILE) / 2, (ALTO * TILE) / 2); // ¡al centro del mapa!
    const vel = spr.velocidad;
    spr.velocidad = vel * 3.2;

    this.time.delayedCall(2300, () => {
      const puf = this.add.particles(cont.x, cont.y - 8, 'humo', {
        tint: 0x888888, speed: { min: 10, max: 30 }, scale: { start: 0.4, end: 0 }, lifespan: 600, emitting: false,
      }).setDepth(7);
      puf.explode(8, cont.x, cont.y - 8);
      this.time.delayedCall(800, () => puf.destroy());
      llama.destroy();
      spr.velocidad = vel;
      spr.destino = this.puntoCerca(spr.hogar);
    });
  }

  // ---------- vida ambiente ----------

  private puntoCerca(centro: Phaser.Math.Vector2): Phaser.Math.Vector2 {
    for (let intento = 0; intento < 10; intento++) {
      const candidato = new Phaser.Math.Vector2(
        Phaser.Math.Clamp(centro.x + Phaser.Math.Between(-26, 26), TILE, (ANCHO - 1) * TILE),
        Phaser.Math.Clamp(centro.y + Phaser.Math.Between(-20, 20), TILE, (ALTO - 1) * TILE),
      );
      const tile = this.tileEn(candidato.x, candidato.y);
      if (tile && tile !== 'agua') return candidato; // nada de pasearse por el mar
    }
    const tile = this.tileEn(centro.x, centro.y);
    return tile && tile !== 'agua' ? centro.clone() : this.orillaMasCercana(centro.x, centro.y);
  }

  update(time: number, delta: number): void {
    const dt = delta / 1000;
    for (const s of this.sprites.values()) {
      if (s.arrastrando) continue;
      const pos = new Phaser.Math.Vector2(s.cont.x, s.cont.y);
      const dist = pos.distance(s.destino);
      if (dist < 3) {
        s.cuerpo.y = 0; s.cara.y = 0;
        if (Math.random() < 0.008) s.destino = this.puntoCerca(s.hogar); // vuelve a la querencia
        continue;
      }
      const dir = s.destino.clone().subtract(pos).normalize();
      s.cont.x += dir.x * s.velocidad * dt;
      s.cont.y += dir.y * s.velocidad * dt;
      const rebote = -Math.abs(Math.sin(time / 110 + s.fase)) * 1.8; // trote saltarín
      s.cuerpo.y = rebote; s.cara.y = rebote;
      s.cuerpo.setFlipX(dir.x < 0);
      s.cara.setFlipX(dir.x < 0);
    }
  }
}
