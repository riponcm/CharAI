// speech.js - CharSpeech: mouth shapes (visemes) over time from a track, word timings or plain text.
// UMD: window.CharSpeech in the browser, module.exports in Node. Pure functions, no state.
//
//   VISEMES                       rest mbp ah ee oh oo fv l wq
//   SHAPE[v]                      { open, wide, round, teeth, tongue } 0..1, for drawn-from-numbers mouths
//   cues(args, dur, tracks)       -> [{ t, v, k, stress, emph }] (k = strength 0..1.3), times from 0
//   at(cues, tau)                 -> { a, b, u, open, wide, round, teeth, tongue, stress, emph } blended
//   fromText(text, dur)           English spelling rules (or an open-close fallback for other scripts)
//   fromTrack(data, dur)          Rhubarb mouth-cue JSON or a list of { t, v }
//   fromWords(words, text, dur)   "0:Good 0.3:morning ..." word start times
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.CharSpeech = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';
  const VISEMES = ['rest', 'mbp', 'ah', 'ee', 'oh', 'oo', 'fv', 'l', 'wq'];
  const SHAPE = {
    rest: { open: 0, wide: 1, round: 0, teeth: 0, tongue: 0 },
    mbp: { open: 0, wide: 0.92, round: 0, teeth: 0, tongue: 0 },
    ah: { open: 1, wide: 1, round: 0, teeth: 0.2, tongue: 0.3 },
    ee: { open: 0.35, wide: 1.25, round: 0, teeth: 1, tongue: 0 },
    oh: { open: 0.75, wide: 0.75, round: 0.6, teeth: 0, tongue: 0.2 },
    oo: { open: 0.32, wide: 0.5, round: 1, teeth: 0, tongue: 0 },
    fv: { open: 0.15, wide: 0.95, round: 0, teeth: 1, tongue: 0 },
    l: { open: 0.6, wide: 0.95, round: 0, teeth: 0.5, tongue: 1 },
    wq: { open: 0.3, wide: 0.55, round: 0.9, teeth: 0, tongue: 0 },
  };
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const smooth = u => { u = clamp(u, 0, 1); return u * u * (3 - 2 * u); };
  const hash = n => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
  const FUNC = new Set('a an the of to and or in on at by for with is it its i you he she we they me my your his her our their be am are was were do does did not no so but as if this that there then than from up out'.split(' '));
  const PREFIX = /^(a|be|de|re|un|in|en|ex|pre|pro|con|com)(?=[a-z]{3,})/;

  // one word -> [{ v, d (relative length), syl (vowel group index or -1) }]
  function wordUnits(w) {
    const out = [], s = w.toLowerCase().replace(/[^a-z']/g, '');
    let i = 0, syl = -1, inV = false;
    const V = 'aeiouy';
    const push = (v, d, vowel) => { if (vowel && !inV) syl++; inV = vowel; out.push({ v, d, syl: vowel ? syl : -1 }); };
    while (i < s.length) {
      const c = s[i], two = s.slice(i, i + 2), three = s.slice(i, i + 3);
      if (c === "'") { i++; continue; }
      if (three === 'igh') { push('ah', 1.4, true); push('ee', 0.8, true); i += 3; continue; }
      const DI = { th: ['l', 1], sh: ['wq', 1.1], ch: ['wq', 1.1], ph: ['fv', 1], wh: ['wq', 1], ck: ['ee', 0.6], ng: ['ee', 0.7], qu: ['wq', 1],
        oo: ['oo', 1.8, 1], ou: ['oh', 1.2, 1], ow: ['oh', 1.2, 1], ee: ['ee', 1.8, 1], ea: ['ee', 1.7, 1], ie: ['ee', 1.6, 1], ey: ['ee', 1.4, 1],
        ai: ['ah', 1.6, 1], ay: ['ah', 1.6, 1], ei: ['ah', 1.4, 1], oa: ['oh', 1.8, 1], oe: ['oh', 1.6, 1], au: ['oh', 1.6, 1], aw: ['oh', 1.6, 1], oi: ['oh', 1.4, 1], oy: ['oh', 1.4, 1] };
      if (DI[two]) {
        const [v, d, vow] = DI[two];
        push(v, d, !!vow);
        if (two === 'ou' || two === 'ow') push('wq', 0.6, true);
        if (two === 'oi' || two === 'oy' || two === 'ai' || two === 'ay') push('ee', 0.6, true);
        i += 2; continue;
      }
      if (c === 'e' && i === s.length - 1 && s.length > 3 && !V.includes(s[i - 1])) { i++; continue; }   // silent final e
      if ('mbp'.includes(c)) push('mbp', 1.1, false);
      else if ('fv'.includes(c)) push('fv', 1, false);
      else if (c === 'w') push('wq', 1, false);
      else if (c === 'r') push('wq', 0.7, false);
      else if (c === 'l') push('l', 0.9, false);
      else if (c === 'a') push('ah', 1.6, true);
      else if (c === 'e') push('ee', 1.3, true);
      else if (c === 'i') push('ee', 1.2, true);
      else if (c === 'o') push('oh', 1.6, true);
      else if (c === 'u') push('ah', 1.2, true);
      else if (c === 'y') push(i === 0 ? 'ee' : 'ee', i === 0 ? 0.7 : 1.2, i > 0);
      else push('ee', 0.6, false);   // t d n s z k g c h x j: a slightly open mouth, teeth showing
      i++;
    }
    return { units: out, syllables: syl + 1, word: s };
  }
  function stressedSyllable(word, n) {
    if (n <= 1) return FUNC.has(word) ? -1 : 0;
    return PREFIX.test(word) ? 1 : 0;
  }
  // English text -> cues over dur seconds (or an open-close fallback for text that is not Latin script)
  function fromText(text, dur) {
    text = String(text || '');
    const letters = (text.match(/[a-z]/gi) || []).length, other = (text.replace(/[\s\p{P}\d]/gu, '').length) || 1;
    const items = [];   // { v, d, stress, emph } with d in relative units; rests for pauses
    if (letters / other < 0.5) {
      // open-close fallback: each character (or vowel-ish run) is a syllable
      const chars = [...text];
      chars.forEach((ch, i) => {
        if (/[\s]/.test(ch)) { items.push({ v: 'rest', d: 0.6 }); return; }
        if (/[\p{P}]/u.test(ch)) { items.push({ v: 'rest', d: /[,，、]/.test(ch) ? 2.5 : 4 }); return; }
        const h = hash(i + 1.7);
        items.push({ v: h < 0.5 ? 'ah' : h < 0.75 ? 'oh' : 'ee', d: 1.6, k: 0.7 + 0.4 * hash(i * 3.3), stress: i % 3 === 0 }, { v: h < 0.3 ? 'mbp' : 'rest', d: 0.7 });
      });
    } else {
      const toks = text.match(/[A-Za-z']+|[.,!?;:—-]+/g) || [];
      const sentEnds = new Set();
      toks.forEach((tk, i) => { if (/[!]/.test(tk)) for (let j = i - 1; j >= 0 && /[A-Za-z]/.test(toks[j]); j--) { if (!FUNC.has(toks[j].toLowerCase())) { sentEnds.add(j); break; } } });
      toks.forEach((tk, i) => {
        if (!/[A-Za-z]/.test(tk)) { items.push({ v: 'rest', d: /[,;:—-]/.test(tk) ? 2.6 : 4.5 }); return; }
        const W = wordUnits(tk), ss = stressedSyllable(W.word, W.syllables);
        const emph = sentEnds.has(i) || (tk.length > 1 && tk === tk.toUpperCase());
        for (const u of W.units) {
          const st = u.syl >= 0 && u.syl === ss;
          items.push({ v: u.v, d: u.d * (st ? 1.35 : 1), k: st ? 1.15 : (u.syl >= 0 ? 0.85 : 0.75), stress: st && u.syl >= 0, emph: st && emph });
        }
        items.push({ v: 'rest', d: 0.25, gap: true });
      });
    }
    while (items.length && items[items.length - 1].v === 'rest') items.pop();
    const total = items.reduce((s, q) => s + q.d, 0) || 1;
    const speak = Math.max(0.1, dur - 0.12);   // the mouth comes to rest a little before the end
    const out = [];
    let t = 0;
    for (const q of items) { out.push({ t, v: q.v, k: q.k === undefined ? 1 : q.k, stress: !!q.stress, emph: !!q.emph }); t += q.d / total * speak; }
    out.push({ t: speak, v: 'rest', k: 1 });
    return merge(out);
  }
  // join neighbours with the same shape; a word gap between two consonants is dropped
  function merge(cs) {
    const out = [];
    for (const c of cs) { const p = out[out.length - 1]; if (p && p.v === c.v && !c.stress) continue; out.push(c); }
    return out;
  }
  const RHUBARB = { A: 'mbp', B: 'ee', C: 'ah', D: 'ah', E: 'oh', F: 'oo', G: 'fv', H: 'l', X: 'rest' };
  function fromTrack(data, dur) {
    let list = [];
    if (data && Array.isArray(data.mouthCues)) list = data.mouthCues.map(c => ({ t: +c.start, v: RHUBARB[c.value] || 'rest', k: c.value === 'C' ? 0.75 : 1 }));
    else if (Array.isArray(data)) list = data.map(c => ({ t: +c.t, v: VISEMES.includes(String(c.v).toLowerCase()) ? String(c.v).toLowerCase() : (RHUBARB[c.v] || 'rest'), k: 1 }));
    list = list.filter(c => isFinite(c.t)).sort((a, b) => a.t - b.t);
    // stress: the start of each open stretch after a closed or rest one
    list.forEach((c, i) => { c.stress = (c.v === 'ah' || c.v === 'oh') && (i === 0 || ['rest', 'mbp'].includes(list[i - 1].v)); });
    if (!list.length || list[list.length - 1].v !== 'rest') list.push({ t: list.length ? list[list.length - 1].t + 0.15 : 0, v: 'rest', k: 1 });
    return list;
  }
  // words: "0:Good 0.3:morning 0.85:little" (start times; the text of each word is spoken in its slot)
  function fromWords(words, text, dur) {
    const ws = String(words || '').trim().split(/\s+/).map(s => { const m = s.match(/^([\d.]+):(.+)$/); return m ? { t: +m[1], w: m[2] } : null; }).filter(Boolean);
    if (!ws.length) return fromText(text, dur);
    const out = [];
    ws.forEach((w, i) => {
      const end = i + 1 < ws.length ? ws[i + 1].t : Math.min(dur, w.t + 0.45 + 0.08 * w.w.length);
      const part = fromText(w.w, Math.max(0.12, end - w.t) + 0.12).slice(0, -1);
      for (const c of part) out.push(Object.assign({}, c, { t: w.t + c.t }));
      if (i + 1 < ws.length && ws[i + 1].t - end > 0.05) out.push({ t: end, v: 'rest', k: 1 });
    });
    out.push({ t: Math.min(dur, out.length ? out[out.length - 1].t + 0.15 : 0), v: 'rest', k: 1 });
    return out.sort((a, b) => a.t - b.t);
  }
  function cues(args, dur, tracks) {
    if (args.visemes) {   // a fixed parade of shapes, for looking at a skin's mouths
      const vs = String(args.visemes).split(/[\s,]+/).filter(v => VISEMES.includes(v));
      return vs.map((v, i) => ({ t: i * dur / vs.length, v, k: 1 })).concat([{ t: dur, v: 'rest', k: 1 }]);
    }
    if (args.track && tracks && tracks[args.track]) return fromTrack(tracks[args.track], dur);
    if (args.words) return fromWords(args.words, args.text, dur);
    return fromText(args.text, dur);
  }
  // estimated speaking time for a text: about 4.5 syllables a second plus pauses
  function estimate(text) {
    const s = String(text || '');
    const syl = (s.toLowerCase().match(/[aeiouy]+/g) || []).length || Math.ceil([...s.replace(/\s/g, '')].length / 1.2);
    const pauses = (s.match(/[,;:]/g) || []).length * 0.2 + (s.match(/[.!?]/g) || []).length * 0.3;
    return Math.max(0.5, syl / 4.5 + pauses + 0.2);
  }
  // the mouth at time tau: shape params blended across cue boundaries (coarticulation, 70 ms)
  function at(cs, tau) {
    const R = Object.assign({ a: 'rest', b: 'rest', u: 0, stress: 0, emph: 0 }, SHAPE.rest);
    if (!cs || !cs.length || tau < 0) return R;
    let i = 0;
    while (i + 1 < cs.length && cs[i + 1].t <= tau) i++;
    const c = cs[i], n = cs[i + 1];
    const X = 0.07;
    let u = 0;
    if (n) u = smooth((tau - (n.t - X / 2)) / X);
    const A = SHAPE[c.v] || SHAPE.rest, B = n ? (SHAPE[n.v] || SHAPE.rest) : A, ka = c.k || 1, kb = n ? (n.k || 1) : ka;
    // closed shapes (mbp) must reach closure: do not blend them open early
    if (c.v === 'mbp') u = n ? smooth((tau - n.t + 0.01) / 0.05) : 0;
    const out = { a: c.v, b: n ? n.v : c.v, u };
    for (const f of Object.keys(A)) out[f] = (A[f] * (f === 'open' ? ka : 1)) * (1 - u) + (B[f] * (f === 'open' ? kb : 1)) * u;
    // stress and emphasis pulses (for head bobs and brow lifts): 0..1, peaking 60 ms into a stressed cue
    let st = 0, em = 0;
    for (let j = Math.max(0, i - 2); j <= i; j++) {
      const d = tau - cs[j].t;
      if (d >= 0 && d < 0.35) { const p = Math.sin(Math.PI * d / 0.35); if (cs[j].stress) st = Math.max(st, p); if (cs[j].emph) em = Math.max(em, p); }
    }
    out.stress = st; out.emph = em;
    return out;
  }
  return { VISEMES, SHAPE, cues, at, fromText, fromTrack, fromWords, estimate, wordUnits };
});
