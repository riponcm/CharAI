// A small label with the current mood, beside the walking character (feature-moods-change-the-walk).
(() => {
  const dark = window.__theme === 'dark';
  const el = document.createElement('div');
  el.style.cssText = 'position:fixed;left:739px;top:386px;height:26px;padding:0 13px 0 10px;border-radius:13px;z-index:5;display:flex;align-items:center;gap:7px;font:700 13px "Segoe UI",Helvetica,Arial,sans-serif;background:' + (dark ? '#1f2850' : '#fffdf8') + ';border:1.5px solid ' + (dark ? '#34417a' : '#ecd9b6') + ';color:' + (dark ? '#f6f0e4' : '#2e2430');
  const dot = document.createElement('i'), txt = document.createElement('span');
  dot.style.cssText = 'width:9px;height:9px;border-radius:50%;display:block';
  el.append(dot, txt); document.body.appendChild(el);
  const M = [[0, 'happy', '#f0a030'], [2.35, 'sad', '#5b8fd6'], [3.55, 'angry', '#e2554a'], [4.75, 'happy', '#f0a030']];
  window.__frame = t => { let m = M[0]; for (const k of M) if (t >= k[0]) m = k; txt.textContent = m[1]; dot.style.background = m[2]; el.style.width = (m[1] === 'happy' ? 80 : 68) + 'px'; };
})();
