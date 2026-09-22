// WFAudit · graph — mini motor de grafo force-directed en SVG, sin dependencias.
// Física de fuerzas (repulsión + muelles + gravedad), arrastrar nodos (se fijan),
// zoom con rueda, pan con fondo, clic y doble-clic. Pensado para el mapa de recon.
const SVGNS = 'http://www.w3.org/2000/svg';

class ForceGraph {
  constructor(svg, opts = {}) {
    this.svg = svg;
    this.o = Object.assign({ charge: -4800, link: 130, center: 0.018, damp: 0.9,
      minZoom: 0.25, maxZoom: 3.5, maxDist: 900 }, opts);
    this.nodes = []; this.links = []; this.byId = {};
    this.k = 1; this.tx = 0; this.ty = 0; this.alpha = 0; this.raf = null;
    this.cb = {}; this._els = {}; this._lines = [];
    this._build();
  }

  on(ev, cb) { this.cb[ev] = cb; return this; }
  _emit(ev, ...a) { if (this.cb[ev]) this.cb[ev](...a); }
  _size() { const r = this.svg.getBoundingClientRect(); return { w: r.width || 800, h: r.height || 520 }; }

  _build() {
    this.vp = document.createElementNS(SVGNS, 'g');
    this.linkG = document.createElementNS(SVGNS, 'g');
    this.nodeG = document.createElementNS(SVGNS, 'g');
    this.vp.appendChild(this.linkG); this.vp.appendChild(this.nodeG);
    this.svg.appendChild(this.vp);
    this._applyTransform();
    // zoom con rueda
    this._onWheel = e => {
      e.preventDefault();
      const rect = this.svg.getBoundingClientRect(), mx = e.clientX - rect.left, my = e.clientY - rect.top;
      const f = e.deltaY < 0 ? 1.12 : 1 / 1.12;
      const k2 = Math.max(this.o.minZoom, Math.min(this.o.maxZoom, this.k * f));
      this.tx = mx - (mx - this.tx) * (k2 / this.k);
      this.ty = my - (my - this.ty) * (k2 / this.k);
      this.k = k2; this._applyTransform();
    };
    this.svg.addEventListener('wheel', this._onWheel, { passive: false });
    // pan con el fondo
    this._onDown = e => {
      if (e.target.closest('.gnode')) return;
      const sx = e.clientX, sy = e.clientY, tx0 = this.tx, ty0 = this.ty;
      const mv = ev => { this.tx = tx0 + (ev.clientX - sx); this.ty = ty0 + (ev.clientY - sy); this._applyTransform(); };
      const up = () => { document.removeEventListener('pointermove', mv); document.removeEventListener('pointerup', up); };
      document.addEventListener('pointermove', mv); document.addEventListener('pointerup', up);
    };
    this.svg.addEventListener('pointerdown', this._onDown);
  }

  _applyTransform() { this.vp.setAttribute('transform', `translate(${this.tx},${this.ty}) scale(${this.k})`); }
  _toGraph(clientX, clientY) { const r = this.svg.getBoundingClientRect(); return { x: (clientX - r.left - this.tx) / this.k, y: (clientY - r.top - this.ty) / this.k }; }

  setData(nodes, links) {
    const old = this.byId, { w, h } = this._size(); this.byId = {};
    this.nodes = nodes.map(n => {
      const p = old[n.id], nn = Object.assign({ vx: 0, vy: 0 }, n);
      if (p) { nn.x = p.x; nn.y = p.y; nn.vx = p.vx; nn.vy = p.vy; nn.fx = p.fx; nn.fy = p.fy; }
      else if (n.x != null && n.y != null) { nn.x = n.x; nn.y = n.y; if (n.pin) { nn.fx = n.x; nn.fy = n.y; } } // pin=fijado; si no, sólo semilla
      if (nn.x == null) nn.x = w / 2 + (Math.random() - 0.5) * Math.min(w, h) * 0.7;
      if (nn.y == null) nn.y = h / 2 + (Math.random() - 0.5) * Math.min(w, h) * 0.7;
      this.byId[n.id] = nn; return nn;
    });
    this.links = links.map(l => ({ source: this.byId[l.source], target: this.byId[l.target] })).filter(l => l.source && l.target);
    this._render();
    this.kick(0.9);
  }

  // Refresca sólo propiedades visuales (color, estado, etiqueta, radio) de nodos
  // existentes SIN reiniciar posiciones ni la física (para el polling).
  update(nodes) {
    let changed = false;
    for (const nn of nodes) {
      const n = this.byId[nn.id]; if (!n) continue;
      if (n.color !== nn.color || n.running !== nn.running || n.label !== nn.label || n.r !== nn.r) {
        n.color = nn.color; n.running = nn.running; n.label = nn.label; n.r = nn.r; changed = true;
      }
    }
    if (changed) { this._render(); this._draw(); }
  }

  _render() {
    this.linkG.textContent = ''; this.nodeG.textContent = ''; this._els = {}; this._lines = [];
    for (const l of this.links) {
      const ln = document.createElementNS(SVGNS, 'line');
      ln.setAttribute('stroke', 'var(--b1)'); ln.setAttribute('stroke-width', '1.4'); ln.setAttribute('stroke-opacity', '0.55');
      this.linkG.appendChild(ln); this._lines.push({ el: ln, l });
    }
    for (const n of this.nodes) {
      const g = document.createElementNS(SVGNS, 'g');
      g.setAttribute('class', 'gnode' + (n.hub ? ' hub' : '')); g.setAttribute('data-id', n.id); g.style.cursor = 'pointer';
      const c = document.createElementNS(SVGNS, 'circle');
      c.setAttribute('r', n.r || 12); c.setAttribute('fill', n.color || 'var(--c)');
      c.setAttribute('stroke', n.running ? 'var(--y)' : (n.hub ? 'var(--t2)' : 'rgba(255,255,255,.55)'));
      c.setAttribute('stroke-width', n.running ? 3 : 1.6);
      if (n.running) { const an = document.createElementNS(SVGNS, 'animate'); an.setAttribute('attributeName', 'stroke-opacity'); an.setAttribute('values', '1;.25;1'); an.setAttribute('dur', '1.1s'); an.setAttribute('repeatCount', 'indefinite'); c.appendChild(an); }
      const t = document.createElementNS(SVGNS, 'text');
      t.setAttribute('text-anchor', 'middle'); t.setAttribute('y', (n.r || 12) + 14);
      t.setAttribute('fill', 'var(--t1)'); t.setAttribute('font-size', n.hub ? '12' : '11'); t.setAttribute('font-weight', n.hub ? '700' : '500');
      t.style.pointerEvents = 'none'; t.style.fontFamily = "'JetBrains Mono',monospace";
      t.textContent = n.label || n.id;
      if (n.pin) { const pin = document.createElementNS(SVGNS, 'circle'); pin.setAttribute('r', 2.6); pin.setAttribute('cx', (n.r || 12) - 3); pin.setAttribute('cy', -(n.r || 12) + 3); pin.setAttribute('fill', 'var(--t2)'); g.appendChild(pin); }
      g.appendChild(c); g.appendChild(t);
      this._bindNode(g, n);
      this.nodeG.appendChild(g); this._els[n.id] = g;
    }
  }

  _bindNode(g, n) {
    g.addEventListener('pointerdown', e => {
      e.stopPropagation();
      const start = { x: e.clientX, y: e.clientY }; let moved = false;
      const mv = ev => {
        if (Math.abs(ev.clientX - start.x) + Math.abs(ev.clientY - start.y) > 3) moved = true;
        n.center = false;   // arrastrar suelta el anclaje al centro (p.ej. del gateway)
        const p = this._toGraph(ev.clientX, ev.clientY); n.fx = p.x; n.fy = p.y; this.kick(0.5);
      };
      const up = () => {
        document.removeEventListener('pointermove', mv); document.removeEventListener('pointerup', up);
        if (moved) { n.pin = true; this._render(); this._draw(); this._emit('nodeMove', n.id, Math.round(n.x), Math.round(n.y)); }
        else this._emit('nodeClick', n.id);
      };
      document.addEventListener('pointermove', mv); document.addEventListener('pointerup', up);
    });
    g.addEventListener('dblclick', e => { e.stopPropagation(); n.fx = null; n.fy = null; n.pin = false; this._render(); this.kick(0.8); this._emit('nodeUnpin', n.id); });
  }

  kick(a = 0.85) { this.alpha = Math.max(this.alpha, a); if (!this.raf) this._loop(); }
  _loop() { this.raf = requestAnimationFrame(() => this._loop()); this._tick(); if (this.alpha < 0.004) { cancelAnimationFrame(this.raf); this.raf = null; this.alpha = 0; } }

  _tick() {
    const ns = this.nodes, o = this.o, { w, h } = this._size(), cx = w / 2, cy = h / 2;
    for (const n of ns) { n._ax = 0; n._ay = 0; }
    for (let i = 0; i < ns.length; i++) for (let j = i + 1; j < ns.length; j++) {
      const a = ns[i], b = ns[j]; let dx = a.x - b.x, dy = a.y - b.y, d2 = dx * dx + dy * dy; if (d2 < 1) d2 = 1;
      const d = Math.sqrt(d2); if (d > o.maxDist) continue;
      const f = o.charge / d2, fx = (dx / d) * f, fy = (dy / d) * f;
      a._ax += fx; a._ay += fy; b._ax -= fx; b._ay -= fy;
    }
    for (const l of this.links) {
      let dx = l.target.x - l.source.x, dy = l.target.y - l.source.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
      const f = (d - o.link) * 0.018, fx = (dx / d) * f, fy = (dy / d) * f;
      l.source._ax += fx; l.source._ay += fy; l.target._ax -= fx; l.target._ay -= fy;
    }
    for (const n of ns) {
      if (n.center) { n.x = cx; n.y = cy; n.vx = 0; n.vy = 0; continue; }   // gateway anclado al centro
      if (n.fx != null) { n.x = n.fx; n.vx = 0; } else { n._ax += (cx - n.x) * o.center; n.vx = (n.vx + n._ax) * o.damp; n.x += n.vx * this.alpha; }
      if (n.fy != null) { n.y = n.fy; n.vy = 0; } else { n._ay += (cy - n.y) * o.center; n.vy = (n.vy + n._ay) * o.damp; n.y += n.vy * this.alpha; }
    }
    // colisión: separa nodos solapados (garantiza que no se pisen)
    for (let i = 0; i < ns.length; i++) for (let j = i + 1; j < ns.length; j++) {
      const a = ns[i], b = ns[j]; let dx = b.x - a.x, dy = b.y - a.y, d = Math.sqrt(dx * dx + dy * dy) || 0.01;
      const min = (a.r || 12) + (b.r || 12) + 20;
      if (d < min) { const s = (min - d) / d * 0.5, px = dx * s, py = dy * s; if (a.fx == null) { a.x -= px; a.y -= py; } if (b.fx == null) { b.x += px; b.y += py; } }
    }
    this.alpha *= 0.988;
    this._draw();
  }

  _draw() {
    for (const { el, l } of this._lines) { el.setAttribute('x1', l.source.x); el.setAttribute('y1', l.source.y); el.setAttribute('x2', l.target.x); el.setAttribute('y2', l.target.y); }
    for (const n of this.nodes) { const g = this._els[n.id]; if (g) g.setAttribute('transform', `translate(${n.x},${n.y})`); }
  }

  fit() {
    if (!this.nodes.length) return;
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const n of this.nodes) { minX = Math.min(minX, n.x); minY = Math.min(minY, n.y); maxX = Math.max(maxX, n.x); maxY = Math.max(maxY, n.y); }
    const { w, h } = this._size(), gw = (maxX - minX) || 1, gh = (maxY - minY) || 1, pad = 70;
    this.k = Math.max(this.o.minZoom, Math.min(this.o.maxZoom, Math.min((w - pad) / gw, (h - pad) / gh, 1.4)));
    this.tx = w / 2 - ((minX + maxX) / 2) * this.k; this.ty = h / 2 - ((minY + maxY) / 2) * this.k;
    this._applyTransform();
  }

  destroy() {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.svg.removeEventListener('wheel', this._onWheel);
    this.svg.removeEventListener('pointerdown', this._onDown);
    this.svg.textContent = '';
  }
}
