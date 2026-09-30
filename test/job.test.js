/* Test engine Jacks Win Logic — jalankan: node test/job.test.js */
var E = require('../engine.js');
var pass = 0, fail = 0;
function ok(cond, name, extra) {
  if (cond) { pass++; }
  else { fail++; console.log('FAIL: ' + name + (extra ? ' | ' + extra : '')); }
}
function approx(a, b, tol) { return Math.abs(a - b) <= tol; }
// kartu: 'Ah' -> rank*4+suit ; suit s=0 h=1 d=2 c=3
function C(s) {
  var r = '23456789TJQKA'.indexOf(s[0]);
  var su = { s: 0, h: 1, d: 2, c: 3 }[s[1]];
  return r * 4 + su;
}
function H() { return Array.prototype.map.call(arguments, C); }
function maskStr(m) { var s = ''; for (var i = 0; i < 5; i++) s = (((m >> i) & 1) ? '1' : '0') + s; return s; }

// 1. evalCat — semua kategori
ok(E.evalCat(H('Th', 'Jh', 'Qh', 'Kh', 'Ah')) === 9, 'royal flush');
ok(E.evalCat(H('Ah', '2h', '3h', '4h', '5h')) === 8, 'wheel straight flush');
ok(E.evalCat(H('9h', 'Th', 'Jh', 'Qh', 'Kh')) === 8, 'straight flush');
ok(E.evalCat(H('5h', '5d', '5c', '5s', '9h')) === 7, 'four of a kind');
ok(E.evalCat(H('5h', '5d', '5c', '9s', '9h')) === 6, 'full house');
ok(E.evalCat(H('Ah', '3h', '5h', '7h', '9h')) === 5, 'flush');
ok(E.evalCat(H('5h', '6d', '7c', '8s', '9h')) === 4, 'straight');
ok(E.evalCat(H('Ah', '2d', '3c', '4s', '5h')) === 4, 'wheel straight');
ok(E.evalCat(H('Th', 'Jd', 'Qc', 'Ks', 'Ah')) === 4, 'broadway straight');
ok(E.evalCat(H('5h', '5d', '5c', '9s', 'Kh')) === 3, 'three of a kind');
ok(E.evalCat(H('5h', '5d', '9c', '9s', 'Kh')) === 2, 'two pair');
ok(E.evalCat(H('Jh', 'Jd', '2c', '5s', '9h')) === 1, 'pair Jacks');
ok(E.evalCat(H('Qh', 'Qd', '2c', '5s', '9h')) === 1, 'pair Queens');
ok(E.evalCat(H('Kh', 'Kd', '2c', '5s', '9h')) === 1, 'pair Kings');
ok(E.evalCat(H('Ah', 'Ad', '2c', '5s', '9h')) === 1, 'pair Aces');
ok(E.evalCat(H('Th', 'Td', '2c', '5s', '9h')) === 0, 'pair Tens = zonk');
ok(E.evalCat(H('2h', '2d', '5c', '9s', 'Kh')) === 0, 'pair kecil = zonk');
ok(E.evalCat(H('Ah', 'Kd', '2c', '5s', '9h')) === 0, 'high card = zonk');

// 2. payouts
var p96 = E.payouts('9/6', 5);
ok(p96[9] === 800 && p96[8] === 250 && p96[5] === 30 && p96[6] === 45, 'paytable 9/6 5 koin');
ok(E.payouts('9/6', 1)[9] === 250, 'royal 1 koin = 250');
ok(E.payouts('9/6', 2)[9] === 500, 'royal 2 koin = 500');
var p85 = E.payouts('8/5', 5);
ok(p85[5] === 25 && p85[6] === 40, 'paytable 8/5');
ok(E.payouts('9/5', 5)[5] === 25, 'paytable 9/5 flush=25');

// 3. bestHold — strategi klasik (9/6, 5 koin). Dealt selalu urutan argumen.
var t0 = Date.now();
// 4 to royal > segalanya
var r1 = E.bestHold(H('Th', 'Jh', 'Qh', 'Kh', '9c'), '9/6', 5);
ok(r1.mask === 15, '4-to-royal: tahan 4 hati', maskStr(r1.mask));
ok(approx(r1.ev, 5.9787, 0.01), 'EV 4-to-royal = 5.9787/koin', r1.ev.toFixed(4));
ok(r1.name.indexOf('ROYAL') >= 0, 'nama royal draw', r1.name);
// low pair vs 4 flush -> tahan flush
var r2 = E.bestHold(H('5h', '5c', '7h', '9h', 'Jh'), '9/6', 5);
ok(r2.mask === 29, 'pair kecil vs 4 flush -> tahan flush', maskStr(r2.mask) + ' ' + r2.name);
ok(approx(r2.ev, 1.2128, 0.01), 'EV 4-flush = 1.2128/koin', r2.ev.toFixed(4));
// high pair vs 4 flush -> tahan pair
var r3 = E.bestHold(H('Jh', 'Jc', '7h', '9h', 'Kh'), '9/6', 5);
ok(r3.mask === 3, 'pair Jack vs 4 flush -> tahan pair', maskStr(r3.mask) + ' ' + r3.name);
ok(approx(r3.ev, 1.5365, 0.01), 'EV pair Jack = 1.5365/koin', r3.ev.toFixed(4));
// two pair -> tahan 4 kartu (kejar full house)
var r4 = E.bestHold(H('5h', '5c', '9h', '9c', 'Kd'), '9/6', 5);
ok(r4.mask === 15, 'two pair -> tahan 4 kartu', maskStr(r4.mask));
ok(approx(r4.ev, 2.5957, 0.01), 'EV two pair (4 kartu) = 2.5957/koin', r4.ev.toFixed(4));
// made flush -> tahan semua
var r5 = E.bestHold(H('Ah', '3h', '5h', '7h', '9h'), '9/6', 5);
ok(r5.mask === 31, 'flush jadi -> tahan semua', maskStr(r5.mask));
ok(approx(r5.ev, 6.0, 0.001), 'EV flush jadi = 6.0/koin', r5.ev.toFixed(4));
// kartu sampah total -> buang semua
var r6 = E.bestHold(H('2c', '5d', '7h', '9s', 'Tc'), '9/6', 5);
ok(r6.mask === 0, 'sampah -> buang semua', maskStr(r6.mask) + ' ' + r6.name);
ok(r6.ev > 0.30 && r6.ev < 0.45, 'EV buang semua masuk akal', r6.ev.toFixed(3));
// 4 to straight flush
var r7 = E.bestHold(H('5h', '6h', '7h', '8h', '2c'), '9/6', 5);
ok(r7.mask === 15, '4-to-SF: tahan 4 hati', maskStr(r7.mask));
ok(r7.name.indexOf('Straight Flush') >= 0, 'nama SF draw', r7.name);
// 4 to royal mengalahkan straight jadi (Broadway + 4 royal? tidak mungkin) —
// straight jadi biasa vs 3-to-royal: straight menang
var r8 = E.bestHold(H('5c', '6d', '7h', '8s', '9c'), '9/6', 5);
ok(r8.mask === 31, 'straight jadi -> tahan', maskStr(r8.mask));

// 4. deterministik
var ra = E.bestHold(H('Th', 'Jh', 'Qh', 'Kh', '9c'), '9/6', 5);
var rb = E.bestHold(H('Th', 'Jh', 'Qh', 'Kh', '9c'), '9/6', 5);
ok(ra.mask === rb.mask && ra.ev === rb.ev, 'bestHold deterministik');

// 5. paytable lain mengubah hasil (8/5: flush lebih murah -> pair kecil vs 4 flush?)
var r9 = E.bestHold(H('5h', '5c', '7h', '9h', 'Jh'), '8/5', 5);
ok(r9.mask === 29, '8/5: tetap tahan 4 flush', maskStr(r9.mask));

// 6. describeHold & advice
ok(E.describeHold([C('Jh'), C('Jd')]).indexOf('Jacks or Better') >= 0, 'nama pair Jack');
ok(E.describeHold([]) === 'Buang semua — ambil 5 kartu baru', 'nama buang semua');
ok(E.advice(r1, 5).length > 20, 'advice string');

// 7. alternatif terurut
ok(r2.alts.length === 3 && r2.alts[0].ev <= r2.ev + 1e-9, 'alts terurut desc');

console.log('waktu: ' + ((Date.now() - t0) / 1000).toFixed(1) + 's');
console.log('\n' + pass + ' lolos, ' + fail + ' gagal');
process.exit(fail ? 1 : 0);
