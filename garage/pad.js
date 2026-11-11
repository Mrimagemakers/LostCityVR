/* Xbox and PlayStation controllers, wired or wireless, through the browser Gamepad API.
   Standard mapping: 0 A/Cross, 1 B/Circle, 2 X/Square, 3 Y/Triangle, 4 LB/L1, 5 RB/R1, 6 LT/L2, 7 RT/R2,
   8 View/Share, 9 Menu/Options, 10 L3, 11 R3, 12-15 d-pad up/down/left/right. Axes 0,1 left stick, 2,3 right stick. */
(() => {
  'use strict';
  const DEAD = 0.18;
  const LABELS = {
    xbox: { 0: 'A', 1: 'B', 2: 'X', 3: 'Y', 4: 'LB', 5: 'RB', 6: 'LT', 7: 'RT', 9: 'MENU', name: 'XBOX CONTROLLER' },
    playstation: { 0: '✕', 1: '○', 2: '□', 3: '△', 4: 'L1', 5: 'R1', 6: 'L2', 7: 'R2', 9: 'OPTIONS', name: 'PLAYSTATION CONTROLLER' }
  };
  const subs = [];
  let activeIndex = null;
  const dirPrev = { up: false, down: false, left: false, right: false };
  const P = {
    connected: false,
    type: 'xbox',
    axes: [0, 0, 0, 0],
    held: {},
    label(i) { return (LABELS[this.type] || LABELS.xbox)[i] || ''; },
    name() { return (LABELS[this.type] || LABELS.xbox).name; },
    on(fn) { subs.push(fn); return () => { const k = subs.indexOf(fn); if (k >= 0) subs.splice(k, 1); }; },
    down(i) { return !!this.held[i]; },
    // move vector: left stick or d-pad, y up is positive
    move() {
      let x = this.axes[0], y = -this.axes[1];
      if (this.held[14]) x = -1; if (this.held[15]) x = 1;
      if (this.held[12]) y = 1; if (this.held[13]) y = -1;
      return { x, y };
    }
  };
  const emit = (ev) => subs.slice().forEach((fn) => { try { fn(ev); } catch (e) { console.error(e); } });
  const kind = (id) => (/xbox|xinput|045e/i.test(id) ? 'xbox' : /(054c|playstation|dualshock|dualsense|wireless controller|sony)/i.test(id) ? 'playstation' : 'xbox');

  function pick() {
    const list = navigator.getGamepads ? navigator.getGamepads() : [];
    let best = null;
    for (const g of list) { if (g && g.connected && g.mapping === 'standard' && (!best || g.timestamp > best.timestamp)) best = g; }
    return best;
  }
  function poll() {
    const g = pick();
    if (activeIndex !== (g?.index ?? null)) {
      activeIndex = g?.index ?? null;
      P.held = {};
      for (const key of Object.keys(dirPrev)) dirPrev[key] = false;
      P.connected = false;
      document.body.classList.remove('pad', 'padps');
      if (!g) emit({ type: 'disconnect' });
    }
    if (!g) {
      requestAnimationFrame(poll); return;
    }
    if (!P.connected) { P.connected = true; P.type = kind(g.id); document.body.classList.add('pad'); document.body.classList.toggle('padps', P.type === 'playstation'); emit({ type: 'connect', name: P.name() }); }
    const ax = [0, 1, 2, 3].map((i) => { const v = g.axes[i] || 0; return Math.abs(v) < DEAD ? 0 : (v - Math.sign(v) * DEAD) / (1 - DEAD); });
    P.axes = ax;
    for (let i = 0; i < Math.min(g.buttons.length, 17); i++) {
      const b = g.buttons[i];
      const on = !!(b && (b.pressed || b.value > 0.5));
      const wasHeld = !!P.held[i];
      P.held[i] = on;
      if (on !== wasHeld) emit({ type: on ? 'press' : 'release', button: i });
    }
    // stick and d-pad as direction presses, for menus and choices
    const d = { up: ax[1] < -0.6 || P.held[12], down: ax[1] > 0.6 || P.held[13], left: ax[0] < -0.6 || P.held[14], right: ax[0] > 0.6 || P.held[15] };
    Object.keys(d).forEach((k) => { if (d[k] && !dirPrev[k]) emit({ type: 'dir', dir: k }); dirPrev[k] = !!d[k]; });
    requestAnimationFrame(poll);
  }
  window.LCPad = P;
  requestAnimationFrame(poll);
})();
