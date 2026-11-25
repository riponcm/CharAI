// element.js - the <char-stage> web component. Appended to the bundle by tools/build.cjs.
// Attributes: src (film script URL; or put the script text inside the element), skins, actions (space/comma
// separated script URLs), width, height, autoplay, loop, controls. Methods: seek(t), play(), pause().
// Property: duration. Event: ready. Transparent background; the host supplies the scenery.
(function (module, exports, require) {
  const G = typeof globalThis !== 'undefined' ? globalThis : this;
  if (typeof G.HTMLElement === 'undefined' || !G.customElements || !G.document) return;   // no DOM (Node)
  const loaded = {};
  const loadScript = url => loaded[url] || (loaded[url] = new Promise((res, rej) => {
    const s = document.createElement('script');
    s.src = url; s.onload = () => res(); s.onerror = () => rej(Error('cannot load ' + url));
    document.head.appendChild(s);
  }));
  const list = v => (v || '').split(/[\s,]+/).filter(Boolean);

  class CharStage extends HTMLElement {
    static get observedAttributes() { return ['src', 'skins', 'actions', 'width', 'height', 'controls']; }
    constructor() {
      super();
      this._m = null; this._t = 0; this._playing = false; this._t0 = 0; this._raf = 0; this._gen = 0; this._ready = false;
      const root = this.attachShadow({ mode: 'open' });
      root.innerHTML = '<style>:host{display:inline-block;position:relative;background:transparent}' +
        '#layer{position:relative;width:100%;height:100%}#layer svg{display:block;width:100%;height:100%}' +
        '#bar{position:absolute;left:0;right:0;bottom:0;display:none;gap:8px;align-items:center;padding:4px 8px;background:rgba(0,0,0,.45);font:12px sans-serif;color:#fff}' +
        ':host([controls]) #bar{display:flex}#bar input{flex:1}#bar button{font:inherit}</style>' +
        '<div id="layer"></div><div id="bar"><button id="pp">play</button><input id="r" type="range" min="0" max="1" step="0.01" value="0"></div>';
      this._layer = root.getElementById('layer');
      this._pp = root.getElementById('pp'); this._r = root.getElementById('r');
      this._pp.onclick = () => this._playing ? this.pause() : this.play();
      this._r.oninput = () => { this.pause(); this.seek(+this._r.value); };
    }
    connectedCallback() { this._size(); this._load(); }
    disconnectedCallback() { this.pause(); this._gen++; if (this._m) this._m.destroy(); this._m = null; }
    attributeChangedCallback(n) { if (!this.isConnected) return; if (n === 'width' || n === 'height') this._size(); else if (n !== 'controls') this._load(); }
    get duration() { return this._m ? this._m.duration : 0; }
    get currentTime() { return this._t; }
    get ready() { return this._ready; }
    get diagnostics() { return this._m ? this._m.diagnostics : []; }
    _size() {
      const w = this.getAttribute('width'), h = this.getAttribute('height');
      const px = v => /^\d+(\.\d+)?$/.test(v) ? v + 'px' : v;
      if (w) this.style.width = px(w); if (h) this.style.height = px(h);
    }
    async _load() {
      const gen = ++this._gen;
      this.pause(); this._ready = false;
      try {
        for (const u of list(this.getAttribute('skins')).concat(list(this.getAttribute('actions')))) await loadScript(new URL(u, document.baseURI).href);
        let script = this.getAttribute('src');
        if (script) script = await (await fetch(new URL(script, document.baseURI))).text();
        else { const s = this.querySelector('script'); script = (s || this).textContent; }
        if (gen !== this._gen) return;
        if (this._m) this._m.destroy();
        const el = document.createElement('div'); el.style.cssText = 'width:100%;height:100%';
        this._layer.textContent = ''; this._layer.appendChild(el);
        this._m = G.Char.mount(el, { script, skins: G.CharSkins });
        this._r.max = this._m.duration;
        this.seek(0);
        this._ready = true;
        this.dispatchEvent(new CustomEvent('ready', { detail: { duration: this._m.duration } }));
        if (this.hasAttribute('autoplay')) this.play();
      } catch (e) { console.warn('<char-stage>: ' + e.message); this.dispatchEvent(new CustomEvent('error', { detail: e })); }
    }
    seek(t) {
      if (!this._m) return;
      this._t = Math.max(0, Math.min(this._m.duration, +t || 0));
      this._m.seek(this._t); this._r.value = this._t;
    }
    play() {
      if (!this._m || this._playing) return;
      this._playing = true; this._t0 = 0; this._pp.textContent = 'pause';
      const tick = now => {
        if (!this._playing) return;
        if (!this._t0) this._t0 = now - this._t * 1000;
        let t = (now - this._t0) / 1000;
        if (t >= this._m.duration) {
          if (this.hasAttribute('loop')) { t = 0; this._t0 = now; } else { this.seek(this._m.duration); this.pause(); return; }
        }
        this.seek(t);
        this._raf = requestAnimationFrame(tick);
      };
      this._raf = requestAnimationFrame(tick);
    }
    pause() { this._playing = false; if (this._raf) cancelAnimationFrame(this._raf); this._raf = 0; this._pp.textContent = 'play'; }
  }
  if (!customElements.get('char-stage')) customElements.define('char-stage', CharStage);
}).call(this);
