#!/usr/bin/env node
// winvoice: Windows SAPI speech -> WAV + engine timing track ({t, v} list).
// usage: node tools/winvoice.cjs "text" out.wav [--voice=David|Zira] [--rate=-10..10] [--track=out.json]
// Windows 22 visemes (0..21) -> engine's 9 mouth shapes. Merged groups:
//  0 silence -> rest | 21 p,b,m -> mbp | 18 f,v -> fv | 14 l, 17 th/dh, 19 t,d,n -> l (tongue up)
//  1 ae,ah, 2 aa, 9 aw, 11 ay, 12 h, 20 k,g,ng -> ah | 3 ao, 8 ow, 10 oy -> oh
//  4 eh,ey,uh, 6 iy,ih,y, 15 s,z -> ee | 7 w,uw -> oo | 5 er, 13 r, 16 sh,ch,jh -> wq
const { spawnSync } = require('child_process'), fs = require('fs'), path = require('path');
const a = process.argv.slice(2), pos = a.filter(x => !x.startsWith('--'));
const opt = k => (a.find(x => x.startsWith('--' + k + '=')) || '').split('=')[1];
const [text, out] = pos;
if (!text || !out) { console.error('usage: winvoice.cjs "text" out.wav [--voice=David|Zira] [--rate=N] [--track=out.json]'); process.exit(2); }
const voice = opt('voice') || 'David', rate = opt('rate') || '0';
const track = opt('track') || out.replace(/\.wav$/i, '') + '.json';
const tmp = out + '.raw.json';
const MAP = ['rest','ah','ah','oh','ee','wq','ee','oo','oh','ah','oh','ah','ah','wq','l','ee','wq','l','fv','l','ah','mbp'];
const r = spawnSync('powershell', ['-NoProfile','-ExecutionPolicy','Bypass','-File', path.join(__dirname,'winvoice.ps1'),
  '-Text', text, '-Out', path.resolve(out), '-Voice', voice, '-Rate', rate, '-Json', path.resolve(tmp)], { encoding: 'utf8' });
if (!fs.existsSync(tmp)) { console.error(r.stderr || r.stdout); process.exit(1); }
const raw = JSON.parse(fs.readFileSync(tmp, 'utf8').replace(/^﻿/, '')); fs.unlinkSync(tmp);
const tr = []; for (const e of raw.visemes.filter(e => e.t < 99)) { const v = MAP[e.v]; if (tr.length && tr[tr.length-1].t === e.t) tr.pop(); if (!tr.length || tr[tr.length-1].v !== v) tr.push({ t: e.t, v }); }
if (!tr.length || tr[0].t > 0) tr.unshift({ t: 0, v: 'rest' });
const dur = parseFloat(spawnSync('ffprobe', ['-v','error','-show_entries','format=duration','-of','csv=p=0', out], { encoding: 'utf8' }).stdout);
while (tr.length > 1 && tr[tr.length-1].t >= dur) tr.pop();
if (tr[tr.length-1].v !== 'rest') tr.push({ t: +Math.max(dur - 0.05, tr[tr.length-1].t + 0.05).toFixed(3), v: 'rest' });
fs.writeFileSync(track, JSON.stringify(tr)); fs.writeFileSync(track.replace(/\.json$/, '.words.json'), JSON.stringify(raw.words));
console.log(dur.toFixed(3));
