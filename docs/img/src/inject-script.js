// Typed .char lines beside the character (used by feature-one-line-of-script). Film pixels: the card is x 430..850, y 372..632.
(() => {
  const dark = window.__theme === 'dark';
  const col = dark ? { bg: '#262421', bd: 'rgba(239,233,222,.08)', ink: '#efe9de', dim: '#8a847a', name: '#efe9de', call: '#aaa398', caret: '#efe9de' } : { bg: '#efe9df', bd: 'rgba(31,27,22,.08)', ink: '#1f1b16', dim: '#7b7266', name: '#1f1b16', call: '#5e554a', caret: '#1f1b16' };
  const box = document.createElement('div');
  box.style.cssText = 'position:fixed;left:448px;top:440px;width:226px;height:92px;border-radius:10px;padding:13px 0 0 14px;z-index:5;font:500 14.5px/25px Consolas,"SF Mono",Menlo,monospace;white-space:pre;color:' + col.ink + ';background:' + col.bg + ';border:1px solid ' + col.bd + '';
  document.body.appendChild(box);
  const L = [{ t0: -1, time: '0.6 ', name: 'Tess', call: ': jump()' }, { t0: 1.55, time: '+0  ', name: 'Tess', call: ': wave()' }], CPS = 22;
  const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  window.__frame = t => {
    let html = '', caret = false;
    L.forEach((l, i) => {
      const n = Math.max(0, Math.min(l.time.length + l.name.length + l.call.length, Math.floor((t - l.t0) * CPS)));
      if (t < l.t0) return;
      const a = l.time.slice(0, n), b = l.name.slice(0, Math.max(0, n - l.time.length)), c = l.call.slice(0, Math.max(0, n - l.time.length - l.name.length));
      html += '<span style="color:' + col.dim + '">' + esc(a) + '</span><span style="color:' + col.name + '">' + esc(b) + '</span><span style="color:' + col.call + '">' + esc(c) + '</span>';
      const done = n >= l.time.length + l.name.length + l.call.length;
      if (i < L.length - 1 && t >= L[i + 1].t0) html += '\n'; else { html += '\n'; }
      if (!done || i === L.length - 1 || t < L[i + 1].t0) caret = i;
    });
    const parts = html.split('\n');
    const idx = caret === false ? 0 : Math.min(caret, parts.length - 1);
    parts[idx] = (parts[idx] || '') + (Math.floor(t * 2.2) % 2 === 0 ? '<span style="color:' + col.caret + '">▍</span>' : '');
    box.innerHTML = parts.join('\n');
    box.style.opacity = Math.max(0, Math.min(1, (3.95 - t) / 0.3));
  };
})();
