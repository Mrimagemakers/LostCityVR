(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  if (typeof Phaser === 'undefined') {
    $('loading').textContent = 'THE ENGINE DID NOT LOAD';
    return;
  }
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const NAMES = { king: 'KING LO', rivet: 'RIVET' };
  const PORTRAIT = { king: 'assets/klo_portrait.png', rivet: 'assets/rivet_portrait.png' };
  const TEX = { king: 'klo', rivet: 'rivet' };

  const IMG = {
    bg: 'assets/garage_backdrop.webp',
    bgPortrait: 'assets/garage_backdrop_portrait.webp',
    floorFront: 'assets/bay_floor_front.webp',
    spark: 'assets/impact_fx_01_hit_spark.webp',
    dust: 'assets/impact_fx_02_dust_puff.webp',
    smoke: 'assets/impact_fx_03_smoke_puff.webp',
    ring: 'assets/impact_fx_04_shockwave_ring.webp',
    flame: 'assets/impact_fx_05_exhaust_flame.webp',
    klo_idle: 'assets/klo_idle.png',
    klo_light: 'assets/klo_light.png',
    klo_heavy: 'assets/klo_heavy.png',
    klo_block: 'assets/klo_block.png',
    klo_hurt: 'assets/klo_hurt.png',
    klo_special: 'assets/klo_special.png',
    rivet_idle: 'assets/rivet_idle.png',
    rivet_light: 'assets/rivet_light.png',
    rivet_heavy: 'assets/rivet_heavy.png',
    rivet_block: 'assets/rivet_block.png',
    rivet_hurt: 'assets/rivet_hurt.png',
    rivet_special: 'assets/rivet_special.png'
  };
  const POSES = ['idle', 'light', 'heavy', 'block', 'hurt', 'special'];
  ['klo', 'rivet'].forEach((id) => {
    POSES.forEach((p) => {
      IMG['refl_' + id + '_' + p] = 'assets/refl_' + id + '_' + p + '.webp';
      IMG['reflx_' + id + '_' + p] = 'assets/reflx_' + id + '_' + p + '.webp';
      IMG['shd_' + id + '_' + p] = 'assets/shd_' + id + '_' + p + '.webp';
    });
    IMG['down_' + id] = 'assets/down_' + id + '.png';
    IMG['downrefl_' + id] = 'assets/downrefl_' + id + '.webp';
    IMG['downreflp_' + id] = 'assets/downreflp_' + id + '.webp';
    IMG['downshd_' + id] = 'assets/downshd_' + id + '.webp';
  });

  const SFX = {
    punch_light: 'sfx/punch_light.mp3',
    punch_heavy: 'sfx/punch_heavy.mp3',
    block_clang: 'sfx/block_clang.mp3',
    whoosh_swing: 'sfx/whoosh_swing.mp3',
    special_rev: 'sfx/special_rev.mp3',
    special_slam: 'sfx/special_slam.mp3',
    ko_gong: 'sfx/ko_gong.mp3',
    ui_start: 'sfx/ui_start.mp3',
    garage_ambience: 'sfx/garage_ambience.mp3',
    crowd_roar: 'sfx/crowd_roar.mp3'
  };

  const G = {
    ready: false,
    mode: 'title',
    playerId: 'king',
    rivalId: 'rivet',
    round: 1,
    wins: { player: 0, rival: 0 },
    timer: 45,
    bestCombo: 0,
    aiHold: 0,
    firstAttackPending: false,
    hintSeen: false,
    scene: null,
    muted: false
  };

  const Sound = {
    ctx: null,
    master: null,
    buffers: {},
    muted: false,
    unlocked: false,
    amb: null,
    pendingAmb: false,
    voices: 0,
    boot() {
      if (this.ctx) return;
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.muted ? 0 : 0.78;
        this.master.connect(this.ctx.destination);
        Object.keys(SFX).forEach((name) => {
          fetch(SFX[name])
            .then((r) => { if (!r.ok) throw new Error('audio'); return r.arrayBuffer(); })
            .then((buf) => this.ctx.decodeAudioData(buf))
            .then((decoded) => {
              this.buffers[name] = decoded;
              if (name === 'garage_ambience' && this.unlocked) this.startAmbience();
            })
            .catch(() => {});
        });
      } catch (e) { this.ctx = null; }
    },
    unlock() {
      this.boot();
      if (!this.ctx) return;
      this.unlocked = true;
      if (this.ctx.state !== 'running') {
        this.ctx.resume().then(() => this.startAmbience()).catch(() => {});
      } else {
        this.startAmbience();
      }
    },
    startAmbience() {
      if (!this.ctx || !this.buffers.garage_ambience || this.amb) return;
      try {
        const src = this.ctx.createBufferSource();
        src.buffer = this.buffers.garage_ambience;
        src.loop = true;
        const gain = this.ctx.createGain();
        gain.gain.value = 0.20;
        src.connect(gain);
        gain.connect(this.master);
        src.start(0);
        this.amb = src;
      } catch (e) {}
    },
    play(name, opts) {
      if (!this.ctx || !this.buffers[name] || this.muted) return;
      const o = opts || {};
      if (this.voices > 22) return;
      try {
        const src = this.ctx.createBufferSource();
        src.buffer = this.buffers[name];
        src.playbackRate.value = o.rate || 1;
        const gain = this.ctx.createGain();
        gain.gain.value = o.vol == null ? 0.7 : o.vol;
        let node = gain;
        if (this.ctx.createStereoPanner && o.pan != null) {
          const pan = this.ctx.createStereoPanner();
          pan.pan.value = clamp(o.pan, -1, 1);
          gain.connect(pan);
          node = pan;
        }
        src.connect(gain);
        node.connect(this.master);
        src.onended = () => { this.voices = Math.max(0, this.voices - 1); };
        this.voices++;
        src.start(0);
      } catch (e) {}
    },
    setMuted(m) {
      this.muted = !!m;
      if (this.master) this.master.gain.value = this.muted ? 0 : 0.78;
      try { localStorage.setItem('klf_mute', this.muted ? '1' : '0'); } catch (e) {}
      const b = $('soundBtn');
      if (b) {
        b.textContent = this.muted ? 'SOUND OFF' : 'SOUND ON';
        b.classList.toggle('off', this.muted);
      }
    }
  };

  const ui = {
    _calloutTimer: null,
    _comboTimer: null,
    _hudAcc: 0,
    hudOn() { $('hud').classList.add('on'); $('touch').classList.remove('off'); document.body.classList.add('fighting'); },
    hudOff() { $('hud').classList.remove('on'); $('touch').classList.add('off'); document.body.classList.remove('fighting'); },
    hideTitle() { $('titleScreen').classList.add('hidden'); },
    showTitle() { $('titleScreen').classList.remove('hidden'); },
    setHint(on) { $('hint').classList.toggle('on', !!on); },
    bar(el, v) { if (el) el.style.transform = 'scaleX(' + clamp(v, 0, 1) + ')'; },
    hud() {
      const s = G.scene;
      if (!s) return;
      const p = s.players.player, r = s.players.rival;
      this.bar($('p1Health'), p.health / 100);
      this.bar($('p2Health'), r.health / 100);
      this.bar($('p1Super'), p.super / 100);
      this.bar($('p2Super'), r.super / 100);
      const pLow = $('p1Health').closest('.barRow');
      const rLow = $('p2Health').closest('.barRow');
      pLow.classList.toggle('low', p.health > 0 && p.health <= 15);
      rLow.classList.toggle('low', r.health > 0 && r.health <= 15);
      const pSup = $('p1Super').closest('.barRow');
      const rSup = $('p2Super').closest('.barRow');
      pSup.classList.toggle('ready', p.super >= 100);
      rSup.classList.toggle('ready', r.super >= 100);
      const sb = document.querySelector('.tbtn.special');
      if (sb) sb.classList.toggle('ready', p.super >= 100 && G.mode === 'fight');
    },
    timer(n) {
      const t = $('timer');
      const v = Math.max(0, Math.ceil(n));
      if (t.textContent !== String(v)) t.textContent = String(v);
      t.classList.toggle('urgent', v <= 10 && G.mode === 'fight');
    },
    combo(n) {
      const plate = $('comboPlate');
      if (n >= 2) {
        $('comboNum').textContent = String(n);
        plate.classList.add('on');
      } else {
        plate.classList.remove('on');
      }
      clearTimeout(this._comboTimer);
      if (n >= 2) {
        this._comboTimer = setTimeout(() => plate.classList.remove('on'), 1600);
      }
    },
    fighters() {
      $('p1Portrait').src = PORTRAIT[G.playerId];
      $('p2Portrait').src = PORTRAIT[G.rivalId];
      $('p1Name').textContent = NAMES[G.playerId];
      $('p2Name').textContent = NAMES[G.rivalId];
    },
    selection() {
      $('pickKing').classList.toggle('sel', G.playerId === 'king');
      $('pickRivet').classList.toggle('sel', G.playerId === 'rivet');
      $('startBtn').disabled = !G.ready;
    },
    pips() {
      const pips = document.querySelectorAll('#pips .pip');
      let pi = 0, ri = 0;
      pips.forEach((el, i) => {
        if (i < 2) { el.classList.toggle('lit', pi < G.wins.player); pi++; }
        else { el.classList.toggle('lit', ri < G.wins.rival); ri++; }
      });
    },
    damage(x, y, text, cls) {
      const s = G.scene;
      if (!s) return;
      const cam = s.cameras.main;
      const gameRect = $('game').getBoundingClientRect();
      const cssScale = gameRect.width / s.W;
      const sx = (x - cam.worldView.x) * cam.zoom * cssScale;
      const sy = (y - cam.worldView.y) * cam.zoom * cssScale;
      const d = document.createElement('div');
      d.className = 'dmg ' + (cls || '');
      d.textContent = text;
      d.style.left = sx + 'px';
      d.style.top = sy + 'px';
      $('dmgLayer').appendChild(d);
      setTimeout(() => d.remove(), 900);
    },
    chip(side) {
      const el = $(side === 'player' ? 'p1Health' : 'p2Health');
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const c = document.createElement('div');
      c.className = 'chip';
      const x = side === 'player' ? rect.right - 4 : rect.left - 4;
      c.style.left = x + 'px';
      c.style.top = (rect.top + rect.height * 0.35) + 'px';
      c.style.setProperty('--dx', (Math.random() * 34 - 17).toFixed(0) + 'px');
      c.style.setProperty('--dy', (95 + Math.random() * 90).toFixed(0) + 'px');
      c.style.setProperty('--rot', (140 + Math.random() * 240).toFixed(0) + 'deg');
      $('dmgLayer').appendChild(c);
      setTimeout(() => c.remove(), 1150);
    },
    edgeFlash() {
      const e = $('edgeflash');
      e.classList.remove('flash');
      void e.offsetWidth;
      e.classList.add('flash');
    },
    callout(text, cls, dur) {
      const c = $('callout');
      clearTimeout(this._calloutTimer);
      c.innerHTML = '<div class="calloutText ' + (cls || '') + '">' + text + '</div>';
      c.classList.toggle('koOn', cls === 'ko');
      c.classList.add('on');
      this._calloutTimer = setTimeout(() => {
        c.classList.remove('on');
        c.classList.remove('koOn');
        c.innerHTML = '';
      }, dur || 900);
    },
    controlsFade(on) {
      const t = $('touch');
      if (t) t.classList.toggle('endfade', !!on);
    },
    matchOver(winnerSide) {
      const won = winnerSide === 'player';
      $('moTitle').textContent = won ? 'YOU WIN' : NAMES[G.rivalId] + ' WINS';
      $('moSub').textContent = G.round + (G.round === 1 ? ' ROUND' : ' ROUNDS') + ' · BEST COMBO ' + G.bestCombo;
      $('matchOver').classList.add('on');
    },
    hideMatchOver() { $('matchOver').classList.remove('on'); }
  };

  class BayScene extends Phaser.Scene {
    constructor() { super({ key: 'bay' }); }

    preload() {
      Object.keys(IMG).forEach((k) => this.load.image(k, IMG[k]));
    }

    create() {
      G.scene = this;
      this.W = this.scale.width;
      this.H = this.scale.height;
      this.portrait = this.H > this.W * 1.05;
      this.hitstop = 0;
      this.zooming = false;
      this.timer = 45;
      this.round = 1;
      this.wins = { player: 0, rival: 0 };
      this.aiT = 0.5;
      this.aiMove = 0;

      this.bg = this.add.image(0, 0, 'bg').setOrigin(0.5, 0).setDepth(0);
      this.bgP = this.add.image(0, 0, 'bgPortrait').setOrigin(0.5, 0).setDepth(0).setVisible(false);
      this.floorPlate = this.add.image(0, 0, 'floorFront').setOrigin(0.5, 0).setDepth(1.8);
      this.floorGlow = this.add.image(0, 0, 'floorFront').setOrigin(0.5, 0).setDepth(1.85).setBlendMode(Phaser.BlendModes.ADD).setAlpha(0);
      this.makeFighterTextures();
      this.players = {
        player: this.makeFighter(G.playerId, 'player'),
        rival: this.makeFighter(G.rivalId, 'rival')
      };

      this.layout();
      this.scale.on('resize', () => this.layout());

      this.time.delayedCall(120, () => this.entrance());

      G.ready = true;
      ui.selection();
      ui.fighters();
      $('loading').classList.add('gone');
      const sign = $('sign');
      sign.classList.remove('stamp');
      void sign.offsetWidth;
      sign.classList.add('stamp');
      facade.ready();
    }

    makeFighterTextures() {
      if (!this.textures.exists('contactShadow')) {
        const c = this.textures.createCanvas('contactShadow', 128, 64);
        const ctx = c.getContext();
        const g = ctx.createRadialGradient(64, 34, 3, 64, 34, 60);
        g.addColorStop(0, 'rgba(0,0,0,0.85)');
        g.addColorStop(0.42, 'rgba(0,0,0,0.52)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 128, 64);
        c.refresh();
      }
    }

    makeFighter(id, side) {
      const img = this.add.image(0, 0, TEX[id] + '_idle').setOrigin(0.5, 1).setDepth(5);
      const shadow = this.add.image(0, 0, 'contactShadow').setOrigin(0.5, 0.5).setDepth(3.97).setAlpha(0.8);
      const core = this.add.image(0, 0, 'contactShadow').setOrigin(0.5, 0.5).setDepth(3.975).setAlpha(0);
      const sep = this.add.image(0, 0, 'contactShadow').setOrigin(0.5, 0.5).setDepth(2.5).setAlpha(0);
      const gsh = this.add.image(0, 0, 'shd_' + TEX[id] + '_idle').setOrigin(0.5, 0).setDepth(3.95).setAlpha(0.9);
      const refl = this.add.image(0, 0, 'refl_' + TEX[id] + '_idle').setOrigin(0.5, 0).setDepth(3.85).setAlpha(1);
      const cast = this.add.image(0, 0, TEX[id] + '_idle').setOrigin(0.5, 1).setDepth(4.6).setVisible(false);
      const down = this.add.image(0, 0, 'down_' + TEX[id]).setOrigin(0.5, 1).setDepth(5).setVisible(false).setFlipX(side === 'rival');
      const downRefl = this.add.image(0, 0, 'downrefl_' + TEX[id]).setOrigin(0.5, 0).setDepth(3.84).setVisible(false).setFlipX(side === 'rival');
      const downShad = this.add.image(0, 0, 'downshd_' + TEX[id]).setOrigin(0.5, 0).setDepth(3.96).setVisible(false).setFlipX(side === 'rival');
      return {
        id, side, img, refl, shadow, core, sep, cast, gsh, downImg: down, downRefl, downShad, downScale: 1,
        fx: side === 'player' ? 0.36 : 0.64,
        homeFx: side === 'player' ? 0.36 : 0.64,
        x: 0, lunge: 0, scale: 1,
        health: 100, super: 0, wins: 0,
        state: 'idle', pose: 'idle', attack: null, buffer: null,
        blocking: false, hurtT: 0, combo: 0, comboT: 0,
        bobT: Math.random() * 5, stepT: 0, walkDir: 0,
        facing: side === 'player' ? 1 : -1,
        aiMove: 0, down: false
      };
    }

    reflKey(f, pose) {
      return (this.portrait ? 'reflx_' : 'refl_') + TEX[f.id] + '_' + (pose || f.pose || 'idle');
    }

    downReflKey(f) {
      return (this.portrait ? 'downreflp_' : 'downrefl_') + TEX[f.id];
    }

    applyScale(f) {
      const tex = this.textures.get(TEX[f.id] + '_idle').getSourceImage();
      f.scale = this.fighterH / tex.height;
      if (f.pose) {
        f.img.setTexture(TEX[f.id] + '_' + f.pose);
      }
      f.img.setScale(f.scale).setFlipX(f.side === 'rival');
      f.refl.setTexture(this.reflKey(f));
      f.refl.setScale(f.scale).setFlipX(f.side === 'rival');
      f.gsh.setTexture('shd_' + TEX[f.id] + '_' + (f.pose || 'idle'));
      f.gsh.setScale(f.scale).setFlipX(f.side === 'rival');
      f.cast.setTexture(TEX[f.id] + '_idle').setScale(f.scale * (this.portrait ? 1.026 : 1.018)).setFlipX(f.side === 'rival');
      const dtex = this.textures.get('down_' + TEX[f.id]).getSourceImage();
      f.downScale = this.fighterH / dtex.width;
      f.downImg.setTexture('down_' + TEX[f.id]).setScale(f.downScale).setFlipX(f.side === 'rival');
      f.downRefl.setTexture(this.downReflKey(f)).setScale(f.downScale).setFlipX(f.side === 'rival');
      f.downShad.setTexture('downshd_' + TEX[f.id]).setScale(f.downScale).setFlipX(f.side === 'rival');
    }

    layout() {
      const W = this.scale.width, H = this.scale.height;
      this.W = W; this.H = H;
      this.portrait = H > W * 1.05;
      let s, bgX, bgY;
      if (this.portrait) {
        this.groundY = H * 0.755;
        this.fighterH = H * 0.40;
        const plateTopP = H * 0.725;
        const src = 1024;
        const focus = 0.54;
        const sp = Math.max(
          plateTopP / src,
          W / (2 * focus * src),
          W / (2 * (1 - focus) * src)
        ) * 1.06;
        this.bgP.setScale(sp).setPosition(
          W / 2 - (focus - 0.5) * src * sp,
          plateTopP - src * sp
        );
        this.bgP.setVisible(true);
        this.bg.setVisible(false);
      } else {
        s = Math.max(W / 1536, H / 1024);
        const bgH = 1024 * s;
        const floorLine = (737 / 1024) * bgH;
        this.groundY = clamp(floorLine - H * 0.07, H * 0.70, H * 0.80);
        this.fighterH = H * 0.60;
        bgY = 0;
        bgX = W / 2;
        this.bg.setScale(s).setPosition(bgX, bgY);
        this.bg.setVisible(true);
        this.bgP.setVisible(false);
      }
      const plateTop = this.portrait ? H * 0.725 : H * 0.72;
      this.floorPlate.setPosition(W / 2, plateTop);
      this.floorPlate.setDisplaySize(W, H - plateTop + 2);
      this.floorGlow.setPosition(W / 2, plateTop);
      this.floorGlow.setDisplaySize(W, H - plateTop + 2);
      this.floorGlow.setAlpha(0);
      this.floorGlow.setVisible(false);


      this.home = {
        player: this.portrait ? 0.30 : 0.38,
        rival: this.portrait ? 0.66 : 0.66
      };
      this.minGap = this.portrait ? W * 0.345 : W * 0.17;
      let halfW = 0;
      Object.values(this.players).forEach((f) => {
        const tex = this.textures.get(TEX[f.id] + '_idle').getSourceImage();
        if (tex && tex.height) halfW = Math.max(halfW, (tex.width / tex.height) * this.fighterH / 2);
      });
      const edgePad = W * 0.02;
      this.loBound = clamp(Math.max(W * 0.11, halfW + edgePad), 0, W * 0.5);
      this.hiBound = clamp(Math.min(W * 0.89, W - halfW - edgePad), W * 0.5, W);

      Object.values(this.players).forEach((f) => {
        f.homeFx = this.home[f.side];
        this.applyScale(f);
        f.refl.setAlpha(1);
        f.gsh.setAlpha(0.9);
        f.img.y = this.groundY;
        f.refl.y = this.groundY;
        this.sizeShadow(f);
        f.shadow.setPosition(f.fx * this.W, this.groundY + this.fighterH * 0.008);
        f.core.setPosition(f.fx * this.W, this.groundY + this.fighterH * 0.004);
        if (G.mode === 'title') f.fx = f.homeFx;
        f.fx = this.edgeClamp(f.fx);
        this.place(f);
      });
    }

    edgeClamp(x) {
      return clamp(x, this.loBound / this.W, this.hiBound / this.W);
    }

    sizeShadow(f) {
      if (this.portrait) {
        f.shadow.setDisplaySize(this.fighterH * 1.16, this.fighterH * 0.26);
        f.shadow.setAlpha(1);
        f.core.setDisplaySize(this.fighterH * 0.60, this.fighterH * 0.10);
        f.core.setAlpha(1);
        f.core.setVisible(true);
        f.sep.setAlpha(0);
        f.sep.setVisible(false);
        f.cast.setAlpha(0);
        f.cast.setVisible(false);
        f.img.clearTint();
        f.downImg.clearTint();
      } else {
        f.img.clearTint();
        f.downImg.clearTint();
        f.shadow.setDisplaySize(this.fighterH * 1.0, this.fighterH * 0.20);
        f.shadow.setAlpha(0.8);
        f.core.setAlpha(0);
        f.core.setVisible(false);
        f.sep.setAlpha(0);
        f.sep.setVisible(false);
        f.cast.setAlpha(0.10);
        f.cast.setScale(f.scale * 1.018);
      }
    }

    place(f) {
      f.x = f.fx * this.W + (f.lunge || 0);
      f.img.x = f.x;
      if (f.state !== 'ko') f.img.y = this.groundY;
      f.refl.x = f.x + Math.sin(f.bobT * 1.9 + (f.side === 'player' ? 0 : 1.3)) * this.fighterH * 0.004;
      f.refl.y = this.groundY;
      f.refl.angle = 0;
      f.gsh.x = f.x + (f.side === 'player' ? -1 : 1) * this.fighterH * 0.02;
      f.gsh.y = this.groundY - this.fighterH * 0.005;
      f.shadow.x = f.x;
      f.shadow.y = this.groundY + this.fighterH * 0.008;
      f.core.x = f.x;
      f.core.y = this.groundY + this.fighterH * 0.004;
      f.sep.x = f.x;
      f.sep.y = this.groundY - this.fighterH * 0.42;
      f.cast.x = f.x + this.fighterH * 0.028;
      f.cast.y = this.groundY + this.fighterH * 0.018;
      f.cast.angle = f.img.angle;
      f.downImg.x = f.x;
      f.downImg.y = this.groundY + this.fighterH * 0.015;
      f.downRefl.x = f.x;
      f.downRefl.y = this.groundY + this.fighterH * 0.012;
      f.downShad.x = f.x;
      f.downShad.y = this.groundY + this.fighterH * 0.008;
    }

    setPose(f, pose) {
      if (f.pose === pose) return;
      f.pose = pose;
      const key = TEX[f.id] + '_' + pose;
      if (!this.textures.exists(key)) return;
      f.img.setTexture(key);
      const rkey = this.reflKey(f, pose);
      const skey = 'shd_' + TEX[f.id] + '_' + pose;
      if (this.textures.exists(rkey)) f.refl.setTexture(rkey);
      if (this.textures.exists(skey)) f.gsh.setTexture(skey);
      f.cast.setTexture(key);
      f.img.setScale(f.scale).setFlipX(f.side === 'rival');
      f.refl.setScale(f.scale).setFlipX(f.side === 'rival');
      f.gsh.setScale(f.scale).setFlipX(f.side === 'rival');
      f.cast.setScale(f.scale * (this.portrait ? 1.026 : 1.018)).setFlipX(f.side === 'rival');
      f.img.setAngle(0);
    }

    entrance() {
      const p = this.players.player, r = this.players.rival;
      if (G.mode !== 'title') return;
      p.fx = -0.17; r.fx = 1.17;
      this.place(p); this.place(r);
      this.setPose(p, 'idle'); this.setPose(r, 'idle');
      const walk = (f, delay) => {
        this.tweens.add({
          targets: f, fx: f.homeFx, duration: 1000, delay, ease: 'Cubic.easeOut',
          onUpdate: () => { this.place(f); if (Math.random() < 0.06) this.dustAt(f.x, 0.25); },
          onComplete: () => { this.dustAt(f.x, 0.45); }
        });
      };
      walk(p, 0);
      walk(r, 140);
    }

    startMatch() {
      if (!G.ready || G.mode !== 'title') return;
      G.mode = 'intro';
      G.round = 1;
      G.wins = { player: 0, rival: 0 };
      G.bestCombo = 0;
      this.round = 1;
      this.wins = { player: 0, rival: 0 };
      this.aiT = 0.6;
      ui.hideTitle();
      ui.hudOn();
      ui.fighters();
      ui.pips();
      ui.combo(0);
      this.resetRound(true);
      Sound.play('ui_start', { vol: 0.8 });
      this.sweep();
      this.time.delayedCall(360, () => {
        ui.callout('FIGHT', 'fight', 950);
        Sound.play('ko_gong', { vol: 0.5, rate: 1.16 });
        Sound.play('crowd_roar', { vol: 0.38 });
        this.cameras.main.shake(150, 0.004);
      });
      this.time.delayedCall(980, () => {
        if (G.mode !== 'intro') return;
        G.mode = 'fight';
        G.timer = 45;
        this.timer = 45;
        G.aiHold = 1.2;
        G.firstAttackPending = true;
        G.hintSeen = false;
        ui.setHint(true);
        this.time.delayedCall(8000, () => ui.setHint(false));
        ui.hud();
        this.time.delayedCall(430, () => {
          const p = this.players.player;
          if (G.mode === 'fight' && G.firstAttackPending && !p.attack && p.state === 'idle') {
            this.startAttack(p, 'light');
          }
        });
      });
    }

    resetRound(first) {
      const p = this.players.player, r = this.players.rival;
      [p, r].forEach((f) => {
        f.health = 100;
        if (first) f.super = 0;
        f.state = 'idle';
        f.attack = null;
        f.buffer = null;
        f.blocking = false;
        f.hurtT = 0;
        f.lunge = 0;
        f.combo = 0;
        f.down = false;
        f.fx = f.homeFx;
        f.img.setOrigin(0.5, 1);
        f.cast.setVisible(false);
        this.sizeShadow(f);
        f.img.setAngle(0).setAlpha(1).setVisible(true);
        f.refl.setTexture(this.reflKey(f, 'idle')).setVisible(true).setAlpha(1);
        f.gsh.setVisible(true).setAlpha(0.9);
        f.downImg.setVisible(false).setAlpha(1);
        f.downRefl.setTexture(this.downReflKey(f)).setVisible(false).setAlpha(1);
        f.downShad.setVisible(false).setAlpha(1);
        f.img.y = this.groundY;
        f.refl.y = this.groundY;
        this.setPose(f, 'idle');
        this.place(f);
      });
      this.timer = 45;
      G.timer = 45;
      this.hitstop = 0;
      this.aiT = 0.7;
      this.aiMove = 0;
      ui.controlsFade(false);
      ui.hud();
      ui.timer(45);
      ui.combo(0);
    }

    setSelection(id) {
      if (!['king', 'rivet'].includes(id)) return;
      G.playerId = id;
      G.rivalId = id === 'king' ? 'rivet' : 'king';
      const p = this.players.player, r = this.players.rival;
      p.id = G.playerId; r.id = G.rivalId;
      p.pose = ''; r.pose = '';
      this.applyScale(p); this.applyScale(r);
      this.setPose(p, p.state === 'block' ? 'block' : p.state === 'hurt' ? 'hurt' : 'idle');
      this.setPose(r, r.state === 'block' ? 'block' : r.state === 'hurt' ? 'hurt' : 'idle');
      p.img.setFlipX(false); r.img.setFlipX(true);
      p.refl.setFlipX(false); r.refl.setFlipX(true);
      ui.fighters();
      ui.selection();
    }

    canMove(f) {
      return G.mode === 'fight' && !f.attack && f.state !== 'hurt' && f.state !== 'ko' && f.state !== 'special' && !f.down;
    }

    canAct(f) {
      return G.mode === 'fight' && !f.down && f.state !== 'ko' && f.state !== 'hurt' && f.state !== 'special';
    }

    playerAttack(kind) {
      if (G.mode !== 'fight') return;
      if (!G.hintSeen) {
        G.hintSeen = true;
        ui.setHint(false);
      }
      this.startAttack(this.players.player, kind);
    }

    playerSpecial() {
      if (G.mode !== 'fight') return;
      const p = this.players.player;
      if (p.super < 100) {
        Sound.play('block_clang', { vol: 0.18, rate: 1.7 });
        return;
      }
      this.startSpecial(p);
    }

    startAttack(f, kind) {
      if (!this.canAct(f)) return;
      if (f.attack) {
        f.buffer = kind;
        return;
      }
      if (f.state === 'special') return;
      f.attack = {
        kind, t: 0,
        total: kind === 'light' ? 0.32 : 0.55,
        hitAt: kind === 'light' ? 0.10 : 0.22,
        done: false,
        forward: (kind === 'light' ? 0.016 : 0.030) * this.W * f.facing
      };
      f.blocking = false;
      f.state = 'attack';
      this.setPose(f, kind === 'light' ? 'light' : 'heavy');
      Sound.play('whoosh_swing', { vol: kind === 'light' ? 0.28 : 0.48, rate: kind === 'light' ? 1.3 : 0.9 });
    }

    setBlock(f, on) {
      if (f.state === 'hurt' || f.state === 'ko' || f.state === 'special' || f.attack || f.down) {
        f.blocking = false;
        return;
      }
      f.blocking = !!on;
      if (on) {
        f.state = 'block';
        this.setPose(f, 'block');
      } else if (f.state === 'block') {
        f.state = 'idle';
        this.setPose(f, 'idle');
      }
    }

    resolveHit(a, d, kind) {
      if (d.state === 'ko' || d.state === 'special' || d.down) return;
      const ax = a.fx * this.W + (a.lunge || 0);
      const dx = d.fx * this.W;
      const gap = Math.abs(dx - ax);
      let reach = this.fighterH * (kind === 'light' ? 0.95 : 1.10);
      if (a.side === 'player' && G.firstAttackPending) reach *= 2.6;
      if ((dx - ax) * a.facing <= 0) return;
      if (gap > reach) return;
      if (a.side === 'player') G.firstAttackPending = false;

      const contactX = dx - a.facing * this.fighterH * 0.10;
      const contactY = this.groundY - this.fighterH * 0.62;
      const blocked = d.blocking || d.state === 'block';
      const pan = clamp((dx / this.W - 0.5) * 1.2, -0.8, 0.8);

      if (blocked) {
        d.super = Math.min(100, d.super + 3);
        a.super = Math.min(100, a.super + 2);
        Sound.play('block_clang', { vol: 0.55, rate: 0.96 + Math.random() * 0.12, pan });
        this.spark(contactX, contactY, 'small');
        ui.edgeFlash();
        ui.damage(contactX, contactY, 'BLOCK', 'blocked');
        this.cameras.main.shake(90, 0.0024);
        d.fx = this.edgeClamp(d.fx + a.facing * 0.012);
        this.place(d);
        this.hitstop = 0.04;
      } else {
        let dmg = kind === 'light' ? 8 : 15;
        if (a.side === 'player' && a.combo >= 2) dmg += kind === 'light' ? 3 : 4;
        d.health = Math.max(0, d.health - dmg);
        d.super = Math.min(100, d.super + 5);
        a.super = Math.min(100, a.super + (kind === 'light' ? 10 : 14));
        d.state = 'hurt';
        d.hurtT = kind === 'light' ? 0.26 : 0.42;
        d.attack = null;
        d.buffer = null;
        d.blocking = false;
        d.lunge = 0;
        this.setPose(d, 'hurt');
        d.fx = this.edgeClamp(d.fx + a.facing * (kind === 'light' ? 0.014 : 0.027));
        this.place(d);
        Sound.play(kind === 'light' ? 'punch_light' : 'punch_heavy', {
          vol: kind === 'light' ? 0.6 : 0.95,
          rate: 0.94 + Math.random() * 0.12,
          pan
        });
        this.spark(contactX, contactY, kind);
        ui.edgeFlash();
        this.cameras.main.shake(kind === 'light' ? 130 : 230, kind === 'light' ? 0.0038 : 0.0078);
        this.punchIn(kind);
        ui.damage(contactX, contactY, String(dmg), kind === 'heavy' ? 'special' : '');
        ui.chip(d.side);
        this.dustAt(d.fx * this.W, kind === 'light' ? 0.35 : 0.7);
        this.hitstop = kind === 'light' ? 0.05 : 0.09;

        const t = performance.now();
        if (t - a.comboT < 1500) a.combo += 1;
        else a.combo = 1;
        a.comboT = t;
        if (a.side === 'player') {
          G.bestCombo = Math.max(G.bestCombo, a.combo);
          ui.combo(a.combo);
        }
        if (d.health <= 0) this.knockout(d);
      }
      ui.hud();
    }

    knockout(f) {
      f.state = 'ko';
      f.down = true;
      f.attack = null;
      f.buffer = null;
      f.blocking = false;
      this.setPose(f, 'hurt');
      f.refl.setVisible(false);
      f.gsh.setVisible(false);
      Sound.play('ko_gong', { vol: 0.85 });
      Sound.play('punch_heavy', { vol: 0.8, rate: 0.78 });
      Sound.play('crowd_roar', { vol: 0.45 });
      this.cameras.main.shake(430, 0.012);
      this.spark(f.x, this.groundY - this.fighterH * 0.5, 'special');
      this.dustAt(f.x, 1.4, true);
      this.smoke(f.x, this.groundY - this.fighterH * 0.22, 1.1);
      this.debris(f.x, this.groundY, 8);
      ui.callout('K.O.', 'ko', 1500);
      G.mode = 'roundEnd';
      ui.controlsFade(true);
      const winner = f.side === 'player' ? 'rival' : 'player';
      if (this.portrait) {
        const w = winner === 'player' ? this.players.player : this.players.rival;
        const away = (w.fx >= f.fx) ? 1 : -1;
        const winnerFx = this.edgeClamp(w.fx + away * 0.13);
        this.tweens.add({
          targets: w,
          fx: winnerFx,
          duration: 460,
          ease: 'Quad.easeOut',
          onUpdate: () => this.place(w)
        });
        w.refl.setVisible(true).setAlpha(1);
        w.gsh.setVisible(true).setAlpha(1);
        w.shadow.setAlpha(1);
        this.sizeShadow(w);
      }
      const fh = this.fighterH;
      const halfBody = fh / 2;
      const padKO = this.W * 0.02;
      const safeX = clamp(
        f.x,
        Math.min(halfBody + padKO, this.W / 2),
        Math.max(this.W - halfBody - padKO, this.W / 2)
      );
      f.cast.setVisible(false);
      f.core.setVisible(false);
      f.sep.setVisible(false);
      f.img.setVisible(false);
      f.refl.setVisible(false);
      f.gsh.setVisible(false);
      f.downImg.setVisible(true).setAlpha(0);
      f.downRefl.setVisible(true).setAlpha(0);
      f.downShad.setVisible(true).setAlpha(0);
      const targetFx = f.side === 'player'
        ? clamp(f.x, this.W * 0.40, this.W * 0.46)
        : clamp(f.x, this.W * 0.54, this.W * 0.60);
      this.tweens.add({ targets: f.downImg, alpha: 1, duration: 240, ease: 'Quad.easeOut' });
      this.tweens.add({ targets: f.downRefl, alpha: 1, duration: 320, ease: 'Quad.easeOut' });
      this.tweens.add({ targets: f.downShad, alpha: 1, duration: 320, ease: 'Quad.easeOut' });
      this.tweens.add({
        targets: f,
        fx: targetFx / this.W,
        duration: 420,
        ease: 'Quad.easeOut'
      });
      f.shadow.setDisplaySize(fh * 1.5, fh * 0.22);
      f.shadow.setAlpha(0.55);
      this.time.delayedCall(1900, () => this.finishRound(winner));
    }

    finishRound(winner) {
      if (G.mode === 'matchEnd') return;
      this.wins[winner] += 1;
      G.wins = this.wins;
      ui.pips();
      if (this.wins[winner] >= 2) {
        this.endMatch(winner);
        return;
      }
      G.round += 1;
      this.round = G.round;
      this.time.delayedCall(900, () => {
        this.resetRound(false);
        ui.callout('ROUND ' + G.round, 'round', 1200);
        this.time.delayedCall(1250, () => {
          if (G.mode === 'matchEnd') return;
          G.mode = 'fight';
          this.aiT = 0.55;
          G.aiHold = 0.85;
          G.firstAttackPending = true;
          ui.callout('FIGHT', 'fight', 800);
          Sound.play('ko_gong', { vol: 0.4, rate: 1.18 });
          this.sweep();
          ui.hud();
        });
      });
      G.mode = 'roundEnd';
    }

    endMatch(winner) {
      G.mode = 'matchEnd';
      ui.callout('', '', 1);
      ui.matchOver(winner);
      Sound.play('crowd_roar', { vol: 0.5 });
      Sound.play('ko_gong', { vol: 0.45, rate: 0.9 });
    }

    timeUp() {
      if (G.mode !== 'fight') return;
      G.mode = 'roundEnd';
      const winner = this.players.player.health >= this.players.rival.health ? 'player' : 'rival';
      ui.callout('TIME', 'round', 1300);
      Sound.play('ko_gong', { vol: 0.5 });
      this.time.delayedCall(1400, () => this.finishRound(winner));
    }

    startSpecial(f) {
      if (!this.canAct(f) || f.super < 100) return;
      f.super = 0;
      f.state = 'special';
      f.attack = null;
      f.buffer = null;
      f.blocking = false;
      f.lunge = 0;
      this.setPose(f, 'special');
      const other = f === this.players.player ? this.players.rival : this.players.player;
      ui.hud();
      Sound.play('special_rev', { vol: 0.9 });
      Sound.play('crowd_roar', { vol: 0.5 });
      this.flame(f);
      this.dustAt(f.x, 1.1);
      this.debris(f.x, this.groundY, 5);
      this.ring(f.x, this.groundY, 1.0);
      document.getElementById('app').classList.add('bloom');
      this.zooming = true;
      this.tweens.add({ targets: this.cameras.main, zoom: 1.09, duration: 750, ease: 'Sine.easeInOut' });
      this.time.delayedCall(1250, () => {
        if (G.mode === 'matchEnd') return;
        const desired = this.edgeClamp(other.fx - f.facing * (this.portrait ? 0.19 : 0.10));
        f.fx = desired;
        f.lunge = 0;
        this.place(f);
        this.setPose(f, 'light');
        Sound.play('special_slam', { vol: 1 });
        Sound.play('punch_heavy', { vol: 0.75, rate: 0.8 });
        this.cameras.main.shake(460, 0.014);
        this.tweens.add({ targets: this.cameras.main, zoom: 1, duration: 220, ease: 'Sine.easeOut' });
        this.spark(other.x, this.groundY - this.fighterH * 0.58, 'special');
        this.ring(other.x, this.groundY, 1.8);
        this.debris(other.x, this.groundY, 12);
        this.dustAt(other.x, 1.8, true);
        this.smoke(other.x, this.groundY - this.fighterH * 0.25, 1.2);
        this.specialHit(other, f);
        document.getElementById('app').classList.remove('bloom');
      });
      this.time.delayedCall(2750, () => {
        document.getElementById('app').classList.remove('bloom');
        if (f.state === 'special') {
          f.state = 'idle';
          this.setPose(f, 'idle');
        }
        const cam = this.cameras.main;
        if (cam.zoom > 1) cam.zoom = 1;
        this.zooming = false;
      });
    }

    specialHit(d, a) {
      if (d.state === 'ko' || d.down) return;
      const wasBlocked = d.blocking || d.state === 'block';
      const dmg = wasBlocked ? 13 : 28;
      d.health = Math.max(0, d.health - dmg);
      d.super = Math.min(100, d.super + 6);
      d.attack = null;
      d.buffer = null;
      d.blocking = false;
      d.lunge = 0;
      d.state = 'hurt';
      d.hurtT = wasBlocked ? 0.5 : 1.0;
      this.setPose(d, 'hurt');
      ui.damage(d.x, this.groundY - this.fighterH * 0.56, String(dmg), 'special');
      ui.chip(d.side);
      ui.hud();
      if (!wasBlocked) {
        d.fx = this.edgeClamp(d.fx + a.facing * 0.035);
        this.place(d);
      }
      if (d.health <= 0) this.knockout(d);
    }

    update(time, delta) {
      const dt = Math.min(delta, 50) / 1000;
      if (!this.players) return;
      this.updateCamera(dt);
      this.updateFighters(dt);
      this.updateHud(dt);
      if (G.mode === 'fight') {
        this.timer -= dt;
        if (this.timer <= 0) {
          this.timer = 0;
          ui.timer(0);
          this.timeUp();
        }
        G.timer = this.timer;
      }
    }

    updateHud(dt) {
      this._hudAcc = (this._hudAcc || 0) + dt;
      if (this._hudAcc > 0.08) {
        this._hudAcc = 0;
        ui.hud();
        ui.timer(this.timer);
      }
    }

    updateCamera(dt) {
      const cam = this.cameras.main;
      if (this.zooming) return;
      if (G.mode === 'title') {
        cam.zoom = 1.012 + Math.sin(performance.now() / 9000) * 0.008;
        cam.scrollX = Math.sin(performance.now() / 12000) * 10;
      } else {
        const p = this.players.player, r = this.players.rival;
        const mid = (p.x + r.x) / 2;
        const target = (mid - this.W / 2) * 0.018;
        cam.scrollX += (target - cam.scrollX) * Math.min(1, dt * 2.3);
        if (cam.zoom > 1.001) {
          cam.zoom += (1 - cam.zoom) * Math.min(1, dt * 5);
        } else {
          cam.zoom = 1;
        }
      }
      cam.scrollY = 0;
    }

    punchIn(kind) {
      const cam = this.cameras.main;
      const z = kind === 'light' ? 1.022 : 1.048;
      this.zooming = false;
      this.zooming = true;
      this.tweens.add({
        targets: cam, zoom: z, duration: 80, yoyo: true, hold: 70, ease: 'Sine.easeOut',
        onComplete: () => { cam.zoom = 1; this.zooming = false; }
      });
    }

    updateFighters(dt) {
      const p = this.players.player, r = this.players.rival;
      if (this.hitstop > 0) {
        this.hitstop -= dt;
        this.place(p); this.place(r);
        return;
      }
      if (G.mode === 'fight') {
        let dir = 0;
        if (keys.left) dir -= 1;
        if (keys.right) dir += 1;
        dir += touchMove;
        dir += padMove();
        dir = clamp(dir, -1, 1);
        const speed = this.fighterH * 0.60;
        if (this.canMove(p)) {
          p.blocking = !!(keys.block || touchBlock || padBlock());
          if (p.blocking && p.state !== 'block') this.setBlock(p, true);
          if (!p.blocking && p.state === 'block') this.setBlock(p, false);
          const mult = p.blocking ? 0.32 : 1;
          p.fx += (dir * speed * mult * dt) / this.W;
          p.walkDir = dir;
          p.stepT += Math.abs(dir) * dt;
          if (Math.abs(dir) > 0.05 && p.stepT > 0.34) {
            p.stepT = 0;
            this.dustAt(p.x, 0.22);
          }
        }
        if (this.aiMove === 0) this.updateAI(dt);
        else this.updateAI(dt);
        if (this.canMove(r)) {
          const toward = Math.sign(p.fx - r.fx) || -1;
          r.fx += (this.aiMove * toward * speed * 0.82 * dt) / this.W;
          r.walkDir = this.aiMove * toward;
          if (Math.abs(this.aiMove) > 0.05) r.stepT += dt;
          if (Math.abs(this.aiMove) > 0.05 && r.stepT > 0.4) {
            r.stepT = 0;
            this.dustAt(r.x, 0.18);
          }
        }
        p.fx = this.edgeClamp(p.fx);
        r.fx = this.edgeClamp(r.fx);
        this.separate();
      }
      this.updateAttack(p, dt, r);
      this.updateAttack(r, dt, p);
      this.updateHurt(p, dt);
      this.updateHurt(r, dt);
      this.updateCombo(p, dt);
      this.updateCombo(r, dt);
      this.animate(p, dt);
      this.animate(r, dt);
      this.place(p);
      this.place(r);
    }

    separate() {
      const p = this.players.player, r = this.players.rival;
      let gap = (r.fx - p.fx) * this.W;
      if (gap < this.minGap) {
        const push = (this.minGap - gap) / 2 / this.W;
        p.fx -= push;
        r.fx += push;
      }
      p.fx = this.edgeClamp(p.fx);
      r.fx = this.edgeClamp(r.fx);
      gap = (r.fx - p.fx) * this.W;
      if (gap < this.minGap) {
        if (p.fx <= this.loBound / this.W + 0.001) r.fx = p.fx + this.minGap / this.W;
        else p.fx = r.fx - this.minGap / this.W;
      }
    }

    updateAI(dt) {
      const f = this.players.rival, p = this.players.player;
      if (G.mode !== 'fight' || f.state === 'hurt' || f.state === 'ko' || f.state === 'special' || f.attack || f.down) {
        this.aiMove = 0;
        return;
      }
      if (G.aiHold > 0) {
        G.aiHold -= dt;
        this.aiMove = 0;
        return;
      }
      this.aiT -= dt;
      if (this.aiT > 0) return;
      this.aiT = 0.28 + Math.random() * 0.34;
      const gap = Math.abs(p.x - f.x);
      const reach = this.fighterH * 0.98;

      if (f.super >= 100 && gap < this.fighterH * 1.5 && Math.random() < 0.08) {
        this.aiMove = 0;
        this.startSpecial(f);
        return;
      }
      if (p.state === 'attack' && gap < reach * 1.15 && Math.random() < 0.24) {
        this.aiMove = 0;
        this.setBlock(f, true);
        this.time.delayedCall(360 + Math.random() * 280, () => {
          if (f.state === 'block' && G.mode === 'fight') this.setBlock(f, false);
        });
        return;
      }
      if (gap > reach * 1.03) {
        this.aiMove = 0.9;
        return;
      }
      if (gap < this.minGap * 1.12) {
        this.aiMove = -0.7;
        return;
      }
      this.aiMove = 0;
      const roll = Math.random();
      if (roll < 0.44) this.startAttack(f, 'light');
      else if (roll < 0.63) this.startAttack(f, 'heavy');
      else if (roll < 0.79) {
        this.setBlock(f, true);
        this.time.delayedCall(420 + Math.random() * 380, () => {
          if (f.state === 'block' && G.mode === 'fight') this.setBlock(f, false);
        });
      } else if (roll < 0.9) {
        this.aiMove = -0.75;
      } else {
        this.aiMove = 0;
      }
    }

    updateAttack(f, dt, target) {
      const a = f.attack;
      if (!a) return;
      a.t += dt;
      const k = Math.sin(clamp(a.t / a.total, 0, 1) * Math.PI);
      f.lunge = a.forward * k;
      if (!a.done && a.t >= a.hitAt) {
        a.done = true;
        this.resolveHit(f, target, a.kind);
      }
      if (a.t >= a.total) {
        f.attack = null;
        f.lunge = 0;
        f.state = f.blocking ? 'block' : 'idle';
        this.setPose(f, f.blocking ? 'block' : 'idle');
        if (f.buffer) {
          const b = f.buffer;
          f.buffer = null;
          this.startAttack(f, b);
        }
      }
    }

    updateHurt(f, dt) {
      if (f.state !== 'hurt') return;
      f.hurtT -= dt;
      if (f.hurtT <= 0) {
        f.state = 'idle';
        this.setPose(f, 'idle');
      }
    }

    updateCombo(f, dt) {
      if (f.combo > 0 && performance.now() - f.comboT > 1500) {
        f.combo = 0;
        if (f.side === 'player') ui.combo(0);
      }
    }

    animate(f, dt) {
      f.bobT += dt;
      if (f.state === 'ko' || f.state === 'special' || f.state === 'hurt' || f.attack) {
        return;
      }
      const moving = Math.abs(f.walkDir) > 0.05;
      const bob = moving
        ? Math.sin(f.bobT * 12) * this.fighterH * 0.006
        : Math.sin(f.bobT * 2.6 + (f.side === 'player' ? 0 : 1.7)) * this.fighterH * 0.0035;
      f.img.y = this.groundY - bob;
      f.img.angle = moving ? f.walkDir * 2.4 : Math.sin(f.bobT * 2.6) * 0.5;
    }

    spark(x, y, kind) {
      const big = kind === 'heavy' || kind === 'special';
      const s = (big ? 0.62 : kind === 'small' ? 0.24 : 0.4) * this.fighterH / 475;
      const img = this.add.image(x, y, 'spark').setDepth(8).setBlendMode(Phaser.BlendModes.ADD)
        .setScale(s).setAngle(Math.random() * 360).setAlpha(0.95);
      this.tweens.add({
        targets: img, scaleX: s * 1.8, scaleY: s * 1.8, alpha: 0, angle: img.angle + 35,
        duration: big ? 320 : 220, ease: 'Quad.easeOut', onComplete: () => img.destroy()
      });
    }

    dustAt(x, power, big) {
      const n = big ? 4 : 2;
      for (let i = 0; i < n; i++) {
        const img = this.add.image(x + (Math.random() * 2 - 1) * this.fighterH * 0.10, this.groundY - this.fighterH * 0.02, 'dust')
          .setDepth(4).setScale((0.10 + Math.random() * 0.08) * (this.fighterH / 280) * (0.8 + power))
          .setAlpha(0.36 + Math.random() * 0.16).setTint(0xa88256)
          .setAngle(Math.random() * 60 - 30).setFlipX(Math.random() < 0.5);
        this.tweens.add({
          targets: img,
          y: img.y - this.fighterH * (0.07 + Math.random() * 0.08) * (0.7 + power),
          scaleX: img.scaleX * 1.8, scaleY: img.scaleY * 1.8,
          alpha: 0, duration: 420 + Math.random() * 280, ease: 'Quad.easeOut',
          onComplete: () => img.destroy()
        });
      }
    }

    smoke(x, y, power) {
      const img = this.add.image(x, y, 'smoke').setDepth(7)
        .setScale(0.16 * (this.fighterH / 453) * (power || 1))
        .setAlpha(0.48).setTint(0x8f8a84).setAngle(Math.random() * 30);
      this.tweens.add({
        targets: img, y: y - this.fighterH * 0.18, scaleX: img.scaleX * 2.6, scaleY: img.scaleY * 2.6,
        alpha: 0, duration: 1000, ease: 'Quad.easeOut', onComplete: () => img.destroy()
      });
    }

    ring(x, y, power) {
      const img = this.add.image(x, y - 4, 'ring').setDepth(4)
        .setScale(0.12 * power * (this.fighterH / 491)).setAlpha(0.9).setBlendMode(Phaser.BlendModes.ADD);
      this.tweens.add({
        targets: img, scaleX: img.scaleX * 7, scaleY: img.scaleY * 7, alpha: 0,
        duration: 720, ease: 'Cubic.easeOut', onComplete: () => img.destroy()
      });
    }

    debris(x, y, n) {
      const colors = [0x9b968c, 0x6a5f52, 0x3b342c, 0xc4a05b];
      for (let i = 0; i < n; i++) {
        const w = 3 + Math.random() * 7;
        const h = 2 + Math.random() * 5;
        const r = this.add.rectangle(x, y - this.fighterH * 0.08, w, h, colors[i % colors.length])
          .setDepth(8).setAngle(Math.random() * 180);
        this.tweens.add({
          targets: r,
          x: x + (Math.random() * 2 - 1) * this.fighterH * 0.55,
          y: y - this.fighterH * (0.18 + Math.random() * 0.45),
          angle: r.angle + (Math.random() * 2 - 1) * 500,
          alpha: 0,
          duration: 520 + Math.random() * 500,
          ease: 'Quad.easeOut',
          onComplete: () => r.destroy()
        });
      }
    }

    flame(f) {
      const img = this.add.image(f.x - f.facing * this.fighterH * 0.22, this.groundY - this.fighterH * 0.20, 'flame')
        .setDepth(6).setBlendMode(Phaser.BlendModes.ADD)
        .setDisplaySize(this.fighterH * 0.46, this.fighterH * 0.22)
        .setAlpha(0.9).setFlipX(f.facing < 0);
      this.tweens.add({
        targets: img, alpha: 0.25, duration: 90, yoyo: true, repeat: 9,
        onComplete: () => this.tweens.add({ targets: img, alpha: 0, scaleX: img.scaleX * 1.3, duration: 160, onComplete: () => img.destroy() })
      });
    }

    sweep() {
      const h = $('headlight');
      if (!h) return;
      h.style.animation = 'none';
      void h.offsetWidth;
      h.style.animation = '';
    }

    rematch() {
      if (G.mode !== 'matchEnd') return;
      ui.hideMatchOver();
      G.mode = 'title';
      this.startMatch();
    }

    toTitle() {
      ui.hideMatchOver();
      ui.hudOff();
      ui.callout('', '', 1);
      ui.showTitle();
      ui.setHint(false);
      ui.combo(0);
      G.mode = 'title';
      G.round = 1;
      G.wins = { player: 0, rival: 0 };
      this.round = 1;
      this.wins = { player: 0, rival: 0 };
      ui.pips();
      this.resetRound(true);
      ui.selection();
      const cam = this.cameras.main;
      cam.zoom = 1;
      cam.scrollX = 0;
    }

  }

  const keys = { left: false, right: false, block: false };
  const padMove = () => { const P = window.LCPad; if (!P || !P.connected) return 0; const x = P.move().x; return Math.abs(x) > 0.25 ? Math.sign(x) : 0; };
  const padBlock = () => { const P = window.LCPad; return !!(P && P.connected && (P.down(4) || P.down(5) || P.down(6) || P.down(7))); };
  let touchMove = 0;
  let touchBlock = false;

  const facade = {
    ready() {
      $('startBtn').disabled = false;
      ui.selection();
    },
    select(id) {
      if (!G.scene || G.mode !== 'title') return;
      G.scene.setSelection(id);
    },
    start() {
      if (!G.ready) return;
      if (G.mode === 'title') G.scene.startMatch();
      else if (G.mode === 'matchEnd') G.scene.rematch();
    },
    rematch() { if (G.mode === 'matchEnd') G.scene.rematch(); },
    change() { if (G.mode === 'matchEnd') G.scene.toTitle(); }
  };

  function bindUI() {
    $('pickKing').addEventListener('click', () => { Sound.unlock(); facade.select('king'); });
    $('pickRivet').addEventListener('click', () => { Sound.unlock(); facade.select('rivet'); });
    $('startBtn').addEventListener('click', () => { Sound.unlock(); facade.start(); });
    $('rematchBtn').addEventListener('click', () => { Sound.unlock(); facade.rematch(); });
    $('changeBtn').addEventListener('click', () => { Sound.unlock(); facade.change(); });
    $('soundBtn').addEventListener('click', () => { Sound.unlock(); Sound.setMuted(!Sound.muted); });

    const stick = $('stick');
    const knob = $('stickKnob');
    let sid = null;
    let sx = 0;
    const resetStick = () => {
      sid = null;
      touchMove = 0;
      knob.style.transform = '';
    };
    stick.addEventListener('pointerdown', (e) => {
      if (G.mode !== 'fight') return;
      Sound.unlock();
      sid = e.pointerId;
      sx = e.clientX;
      try { stick.setPointerCapture(e.pointerId); } catch (err) {}
      e.preventDefault();
    });
    stick.addEventListener('pointermove', (e) => {
      if (sid === null || e.pointerId !== sid) return;
      const max = Math.max(26, stick.clientWidth * 0.20);
      const dx = clamp(e.clientX - sx, -max, max);
      touchMove = dx / max;
      knob.style.transform = 'translate(' + (dx * 0.55).toFixed(1) + 'px,' + (Math.abs(dx) * 0.10).toFixed(1) + 'px)';
      e.preventDefault();
    });
    stick.addEventListener('pointerup', resetStick);
    stick.addEventListener('pointercancel', resetStick);
    stick.addEventListener('pointerleave', (e) => { if (sid !== null && e.pointerId === sid) resetStick(); });

    document.querySelectorAll('.tbtn').forEach((btn) => {
      const kind = btn.dataset.btn;
      const down = (e) => {
        if (G.mode !== 'fight') return;
        Sound.unlock();
        btn.classList.add('press');
        setTimeout(() => btn.classList.remove('press'), 120);
        if (kind === 'light' || kind === 'heavy') G.scene.playerAttack(kind);
        else if (kind === 'special') G.scene.playerSpecial();
        else if (kind === 'block') { touchBlock = true; G.scene.setBlock(G.scene.players.player, true); }
        try { btn.setPointerCapture(e.pointerId); } catch (err) {}
        e.preventDefault();
      };
      const up = () => {
        if (kind === 'block') { touchBlock = false; }
      };
      btn.addEventListener('pointerdown', down);
      btn.addEventListener('pointerup', up);
      btn.addEventListener('pointercancel', up);
      btn.addEventListener('pointerleave', up);
    });

    window.addEventListener('keydown', (e) => {
      const k = e.key.toLowerCase();
      Sound.unlock();
      if (k === ' ' || k === 'spacebar' || k === 'enter') {
        e.preventDefault();
        if (G.mode === 'title') facade.start();
        else if (G.mode === 'matchEnd') facade.rematch();
        return;
      }
      if (G.mode === 'title') {
        if (k === 'arrowleft' || k === 'a') { e.preventDefault(); facade.select('king'); }
        if (k === 'arrowright' || k === 'd') { e.preventDefault(); facade.select('rivet'); }
        return;
      }
      if (G.mode === 'matchEnd') return;
      if (k === 'arrowleft' || k === 'a') { keys.left = true; e.preventDefault(); }
      if (k === 'arrowright' || k === 'd') { keys.right = true; e.preventDefault(); }
      if (k === 'l') { keys.block = true; e.preventDefault(); }
      if (k === 'j') { G.scene.playerAttack('light'); e.preventDefault(); }
      if (k === 'k') { G.scene.playerAttack('heavy'); e.preventDefault(); }
      if (k === 'i') { G.scene.playerSpecial(); e.preventDefault(); }
    });
    window.addEventListener('keyup', (e) => {
      const k = e.key.toLowerCase();
      if (k === 'arrowleft' || k === 'a') keys.left = false;
      if (k === 'arrowright' || k === 'd') keys.right = false;
      if (k === 'l') keys.block = false;
    });
    window.addEventListener('blur', () => {
      keys.left = false; keys.right = false; keys.block = false;
      touchMove = 0; touchBlock = false;
    });
    window.addEventListener('pointerdown', () => Sound.unlock(), { once: true });

    // Xbox / PlayStation controller: fighter selection, garage fight and match end
    if (window.LCPad) window.LCPad.on((ev) => {
      if (ev.type === 'connect') { const h = $('padHint'); if (h) h.hidden = false; return; }
      if (ev.type === 'disconnect') { const h = $('padHint'); if (h) h.hidden = true; return; }
      Sound.unlock();
      if (G.mode === 'title') {
        if (ev.type === 'dir' && ev.dir === 'left') facade.select('king');
        if (ev.type === 'dir' && ev.dir === 'right') facade.select('rivet');
        if (ev.type === 'press' && (ev.button === 0 || ev.button === 9)) facade.start();
        if (ev.type === 'press' && ev.button === 2) facade.start();
        return;
      }
      if (G.mode === 'matchEnd') {
        if (ev.type === 'press' && (ev.button === 0 || ev.button === 9)) facade.rematch();
        if (ev.type === 'press' && ev.button === 1) facade.change();
        return;
      }
      if (ev.type !== 'press' || !G.scene) return;
      if (ev.button === 2) G.scene.playerAttack('light');
      if (ev.button === 3) G.scene.playerAttack('heavy');
      if (ev.button === 1 || ev.button === 0) G.scene.playerSpecial();
    });
    window.addEventListener('keydown', () => Sound.unlock(), { once: true });
  }

  function initSound() {
    let muted = false;
    try { muted = localStorage.getItem('klf_mute') === '1'; } catch (e) {}
    Sound.setMuted(muted);
  }

  window.addEventListener('DOMContentLoaded', () => {
    bindUI();
    initSound();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const startW = Math.max(1, Math.round(window.innerWidth * dpr));
    const startH = Math.max(1, Math.round(window.innerHeight * dpr));
    let game;
    try {
      game = new Phaser.Game({
        type: Phaser.AUTO,
        parent: 'game',
        backgroundColor: '#070605',
        width: startW,
        height: startH,
        scale: {
          mode: Phaser.Scale.NONE,
          autoCenter: Phaser.Scale.NO_CENTER
        },
        render: { antialias: true, pixelArt: false, roundPixels: false },
        scene: [BayScene]
      });
      window.addEventListener('resize', () => {
        game.scale.resize(
          Math.max(1, Math.round(window.innerWidth * dpr)),
          Math.max(1, Math.round(window.innerHeight * dpr))
        );
      });
    } catch (e) {
      $('loading').textContent = 'THE ENGINE DID NOT START';
    }
  });
})();
