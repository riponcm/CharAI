// A small label with the current mood, beside the walking character (feature-moods-change-the-walk).
(() => {
  const dark = window.__theme === 'dark';
  const el = document.createElement('div');
  el.style.cssText = 'position:fixed;left:739px;top:386px;height:26px;padding:0 11px;border-radius:8px;z-index:5;display:flex;align-items:center;font:500 13px system-ui,"Segoe UI",Helvetica,Arial,sans-serif;background:' + (dark ? '#262421' : '#efe9df') + ';border:1px solid ' + (dark ? 'rgba(239,233,222,.08)' : 'rgba(31,27,22,.08)') + ';color:' + (dark ? '#efe9de' : '#1f1b16');
  const txt = document.createElement('span');
    el.append(txt); document.body.appendChild(el);
  const M = [[0, 'happy', '#f0a030'], [2.35, 'sad', '#5b8fd6'], [3.55, 'angry', '#e2554a'], [4.75, 'happy', '#f0a030']];
  window.__frame = t => { let m = M[0]; for (const k of M) if (t >= k[0]) m = k; txt.textContent = m[1]; };
})();
