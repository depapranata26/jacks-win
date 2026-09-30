/* Jacks Win Logic — engine video poker Jacks or Better (UMD, Node & browser)
 * Kartu: int 0..51, rank = c>>2 (0=2 .. 12=A), suit = c&3 (0=♠ 1=♥ 2=♦ 3=♣)
 * Strategi: untuk tiap 32 opsi tahan/buang, hitung EXACT expected value
 * dengan enumerasi semua kemungkinan draw dari 47 sisa kartu. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.JacksEngine = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var RANK_CHARS = '23456789TJQKA';
  var RANK_NAMES = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  var SUIT_CHARS = ['♠', '♥', '♦', '♣'];

  // Kategori: 0 zonk, 1 JoB, 2 two pair, 3 trips, 4 straight, 5 flush,
  // 6 full house, 7 quads, 8 straight flush, 9 royal flush
  var CAT_NAMES = ['Tidak bayar', 'Jacks or Better', 'Two Pair', 'Three of a Kind',
    'Straight', 'Flush', 'Full House', 'Four of a Kind', 'Straight Flush', 'ROYAL FLUSH'];

  // Paytable umum JoB (per 1 koin; royal 5 koin = 800)
  var PAYTABLES = {
    '9/6': { label: '9/6 Full Pay', fh: 9, fl: 6 },
    '9/5': { label: '9/5', fh: 9, fl: 5 },
    '8/6': { label: '8/6', fh: 8, fl: 6 },
    '8/5': { label: '8/5', fh: 8, fl: 5 },
    '7/5': { label: '7/5', fh: 7, fl: 5 }
  };
  function payouts(ptKey, coins) {
    var pt = PAYTABLES[ptKey] || PAYTABLES['9/6'];
    // koin AKTUAL utk bet `coins` (royal: bonus 800 khusus 5 koin)
    var p = [0, 1, 2, 3, 4, pt.fl, pt.fh, 25, 50, 0].map(function (x) { return x * coins; });
    p[9] = coins === 5 ? 800 : 250 * coins;
    return p;
  }

  function rank(c) { return c >> 2; }
  function suit(c) { return c & 3; }
  function cardStr(c) { return RANK_CHARS[c >> 2] + SUIT_CHARS[c & 3]; }

  // Evaluasi 5 kartu -> kategori 0..9
  function evalCat(h) {
    var rc0 = 0, rc1 = 0, rc2 = 0, rc3 = 0, rc4 = 0, rc5 = 0, rc6 = 0,
        rc7 = 0, rc8 = 0, rc9 = 0, rc10 = 0, rc11 = 0, rc12 = 0;
    var s0 = 0, s1 = 0, s2 = 0, s3 = 0, mask = 0;
    for (var i = 0; i < 5; i++) {
      var r = h[i] >> 2, s = h[i] & 3;
      if (r === 0) rc0++; else if (r === 1) rc1++; else if (r === 2) rc2++;
      else if (r === 3) rc3++; else if (r === 4) rc4++; else if (r === 5) rc5++;
      else if (r === 6) rc6++; else if (r === 7) rc7++; else if (r === 8) rc8++;
      else if (r === 9) rc9++; else if (r === 10) rc10++; else if (r === 11) rc11++;
      else rc12++;
      if (s === 0) s0++; else if (s === 1) s1++; else if (s === 2) s2++; else s3++;
      mask |= 1 << r;
    }
    var flush = (s0 === 5 || s1 === 5 || s2 === 5 || s3 === 5);
    var straight = false, royal = false;
    if ((mask & 0x100F) === 0x100F) straight = true; // wheel A-2-3-4-5
    else {
      for (var st = 0; st <= 8; st++) {
        if (((mask >> st) & 31) === 31) { straight = true; if (st === 8) royal = true; break; }
      }
    }
    if (flush && straight) return royal ? 9 : 8;
    var c2 = 0, c3 = 0, c4 = 0;
    var cnt = [rc0, rc1, rc2, rc3, rc4, rc5, rc6, rc7, rc8, rc9, rc10, rc11, rc12];
    for (var k = 0; k < 13; k++) {
      if (cnt[k] === 2) c2++;
      else if (cnt[k] === 3) c3++;
      else if (cnt[k] === 4) c4++;
    }
    if (c4) return 7;
    if (c3 && c2) return 6;
    if (flush) return 5;
    if (straight) return 4;
    if (c3) return 3;
    if (c2 === 2) return 2;
    if (c2 === 1) {
      if (rc9 === 2 || rc10 === 2 || rc11 === 2 || rc12 === 2) return 1;
      return 0;
    }
    return 0;
  }

  // Iterasi kombinasi: pilih k dari arr, panggil cb(index array)
  function eachCombo(n, k, cb) {
    if (k === 0) { cb([]); return; }
    var idx = [];
    for (var i = 0; i < k; i++) idx[i] = i;
    for (;;) {
      cb(idx);
      var j = k - 1;
      while (j >= 0 && idx[j] === n - k + j) j--;
      if (j < 0) return;
      idx[j]++;
      for (var m = j + 1; m < k; m++) idx[m] = idx[m - 1] + 1;
    }
  }

  // EV (koin aktual utk bet `coins`) menahan `held` dari `dealt` (5 kartu)
  function holdEV(dealt, held, pay) {
    var rest = [];
    for (var c = 0; c < 52; c++) {
      var skip = false;
      for (var d = 0; d < 5; d++) if (dealt[d] === c) { skip = true; break; }
      if (!skip) rest.push(c);
    }
    var need = 5 - held.length;
    var hand = held.slice();
    while (hand.length < 5) hand.push(0);
    var total = 0, n = 0;
    eachCombo(rest.length, need, function (idx) {
      for (var j = 0; j < need; j++) hand[held.length + j] = rest[idx[j]];
      total += pay[evalCat(hand)];
      n++;
    });
    return total / n;
  }

  // Opsi tahan terbaik (exact): kembalikan mask, kartu yg ditahan, EV, dsb.
  function bestHold(dealt, ptKey, coins) {
    var pay = payouts(ptKey, coins);
    var opts = [];
    var best = null;
    for (var mask = 0; mask < 32; mask++) {
      var held = [];
      for (var i = 0; i < 5; i++) if ((mask >> i) & 1) held.push(dealt[i]);
      var ev = holdEV(dealt, held, pay) / coins; // per koin bet (standar)
      var o = { mask: mask, held: held, ev: ev, n: held.length };
      opts.push(o);
      if (!best || ev > best.ev + 1e-9 ||
          (Math.abs(ev - best.ev) <= 1e-9 && held.length > best.held.length)) {
        best = o;
      }
    }
    opts.sort(function (a, b) { return b.ev - a.ev; });
    return {
      hold: best.held, mask: best.mask, ev: best.ev,
      rtp: best.ev * 100,
      name: describeHold(best.held),
      alts: opts.slice(1, 4).map(function (o) {
        return { name: describeHold(o.held), ev: o.ev, n: o.n };
      })
    };
  }

  // Apakah ranks mengandung straight-5
  function containsStraight5(ranks) {
    var s = {};
    for (var i = 0; i < ranks.length; i++) s[ranks[i]] = 1;
    for (var st = 0; st <= 8; st++) {
      var ok = true;
      for (var k = 0; k < 5; k++) if (!s[st + k]) { ok = false; break; }
      if (ok) return true;
    }
    return !!(s[12] && s[0] && s[1] && s[2] && s[3]);
  }
  // Jumlah rank yg melengkapi straight (utk 3-4 kartu): 8=terbuka, 4=dalam
  function straightOuts(ranks) {
    var set = {};
    for (var i = 0; i < ranks.length; i++) set[ranks[i]] = 1;
    var outs = 0;
    for (var r = 0; r < 13; r++) {
      if (set[r]) continue;
      var t = [];
      for (var k in set) t.push(+k);
      t.push(r);
      if (containsStraight5(t)) outs++;
    }
    return outs;
  }

  // Nama pola tahan — penjelasan manusiawi utk opsi terbaik
  function describeHold(held) {
    var n = held.length;
    if (n === 0) return 'Buang semua — ambil 5 kartu baru';
    var ranks = held.map(function (c) { return c >> 2; });
    var suits = held.map(function (c) { return c & 3; });
    var flush = true;
    for (var i = 1; i < n; i++) if (suits[i] !== suits[0]) { flush = false; break; }
    var rcount = {};
    for (var j = 0; j < n; j++) rcount[ranks[j]] = (rcount[ranks[j]] || 0) + 1;
    var pairR = [], tripR = null;
    for (var rk in rcount) {
      if (rcount[rk] === 2) pairR.push(+rk);
      else if (rcount[rk] >= 3) tripR = +rk;
    }
    var royalOnly = ranks.every(function (r) { return r >= 8; }); // T J Q K A
    var outs = (n === 4 || n === 3) ? straightOuts(ranks) : 0;
    function rn(r) { return RANK_NAMES[r]; }
    if (n === 5) return 'Pertahankan — ' + CAT_NAMES[evalCat(held)];
    if (n === 4) {
      if (flush && royalOnly) return '4 kartu menuju ROYAL FLUSH 👑';
      if (flush && outs > 0) return '4 kartu menuju Straight Flush';
      if (flush) return '4 kartu Flush';
      if (pairR.length === 2) return 'Two Pair — tahan keempatnya';
      if (pairR.length === 1) return 'Pair ' + rn(pairR[0]) + ' — tahan pairnya';
      if (outs === 8) return '4 kartu Straight terbuka';
      if (outs === 4) return '4 kartu Straight dalam';
      return 'Tahan 4 kartu';
    }
    if (n === 3) {
      if (tripR !== null) return 'Three of a Kind';
      if (flush && royalOnly) return '3 kartu menuju Royal';
      if (flush && outs >= 4) return '3 kartu menuju Straight Flush';
      if (pairR.length === 1) return 'Pair ' + rn(pairR[0]);
      return 'Tahan 3 kartu';
    }
    if (n === 2) {
      if (pairR.length === 1) {
        return pairR[0] >= 9
          ? 'Pair ' + rn(pairR[0]) + ' (Jacks or Better)'
          : 'Pair kecil ' + rn(pairR[0]);
      }
      if (flush && royalOnly) return '2 kartu suited menuju Royal (' + ranks.map(rn).join(' ') + ')';
      if (flush && ranks.every(function (r) { return r >= 9; })) return '2 kartu tinggi suited (' + ranks.map(rn).join(' ') + ')';
      return 'Tahan 2 kartu';
    }
    return '1 kartu tinggi ' + rn(ranks[0]);
  }

  // Rekomendasi kalimat Bahasa Indonesia
  function advice(res, coins) {
    var rtp = res.rtp;
    var q = rtp >= 140 ? 'Kartu bagus!' : rtp >= 100 ? 'Kartu lumayan.' : rtp >= 60 ? 'Kartu jelek,' : 'Kartu sampah,';
    return q + ' tahan: ' + res.name + '. EV ' + res.ev.toFixed(2) +
      ' koin per koin bet (RTP ' + rtp.toFixed(2) + '% @ ' + coins + ' koin).';
  }

  return {
    RANK_CHARS: RANK_CHARS, SUIT_CHARS: SUIT_CHARS, CAT_NAMES: CAT_NAMES,
    PAYTABLES: PAYTABLES, payouts: payouts,
    rank: rank, suit: suit, cardStr: cardStr,
    evalCat: evalCat, holdEV: holdEV, bestHold: bestHold,
    describeHold: describeHold, advice: advice
  };
});
