/* Jacks Win Logic — UI */
(function () {
  'use strict';
  var E = window.JacksEngine;
  var RANK_CHARS = '23456789TJQKA', SUIT_CHARS = ['♠', '♥', '♦', '♣'];
  var PTS = ['9/6', '9/5', '8/6', '8/5', '7/5'];
  var picked = [], PT = '9/6', COINS = 5, NOMINAL = 1000;

  function $(id) { return document.getElementById(id); }
  function fmtRp(x) { return 'Rp ' + Math.round(x).toLocaleString('id-ID'); }

  // ---------- config tersimpan ----------
  var CFGKEY = 'jacks_cfg_v1';
  function loadCfg() {
    try {
      var c = JSON.parse(localStorage.getItem(CFGKEY)) || {};
      if (E.PAYTABLES[c.pt]) PT = c.pt;
      if (c.coins >= 1 && c.coins <= 5) COINS = c.coins;
      if (c.nominal >= 100) NOMINAL = c.nominal;
    } catch (e) {}
  }
  function saveCfg() {
    try { localStorage.setItem(CFGKEY, JSON.stringify({ pt: PT, coins: COINS, nominal: NOMINAL })); } catch (e) {}
  }
  loadCfg();

  // ---------- tabs ----------
  document.querySelectorAll('.tabs button').forEach(function (b) {
    b.onclick = function () {
      document.querySelectorAll('.tabs button').forEach(function (x) { x.classList.remove('on'); });
      b.classList.add('on');
      ['main', 'pay', 'hist', 'info'].forEach(function (t) {
        $('t-' + t).hidden = (t !== b.dataset.t);
      });
      if (b.dataset.t === 'hist') renderHist();
      if (b.dataset.t === 'pay') renderPayRp();
    };
  });

  // ---------- picker ----------
  function buildPicker() {
    var w = $('picker'); w.innerHTML = '';
    for (var s = 0; s < 4; s++) {
      (function (s) {
        var row = document.createElement('div'); row.className = 'suitrow';
        var lab = document.createElement('div');
        lab.className = 'suitlab' + ((s === 1 || s === 2) ? ' red' : '');
        lab.textContent = SUIT_CHARS[s];
        row.appendChild(lab);
        var grid = document.createElement('div'); grid.className = 'cgrid';
        for (var r = 0; r < 13; r++) {
          (function (r) {
            var c = r * 4 + s;
            var btn = document.createElement('button');
            btn.className = 'pcard' + ((s === 1 || s === 2) ? ' red' : '');
            btn.dataset.c = c;
            btn.innerHTML = '<span>' + RANK_CHARS[r] + '</span><span class="s">' + SUIT_CHARS[s] + '</span>';
            btn.onclick = function () { toggle(c); };
            grid.appendChild(btn);
          })(r);
        }
        row.appendChild(grid); w.appendChild(row);
      })(s);
    }
  }
  function toggle(c) {
    var i = picked.indexOf(c);
    if (i >= 0) picked.splice(i, 1);
    else if (picked.length < 5) picked.push(c);
    refresh();
  }
  function refresh() {
    document.querySelectorAll('#picker .pcard').forEach(function (b) {
      var c = +b.dataset.c, i = picked.indexOf(c);
      b.classList.toggle('sel', i >= 0);
      var o = b.querySelector('.ord'); if (o) o.remove();
      if (i >= 0) {
        var s = document.createElement('span'); s.className = 'ord'; s.textContent = i + 1;
        b.appendChild(s);
      }
    });
    var tray = $('tray'); tray.innerHTML = '';
    for (var k = 0; k < 5; k++) {
      (function (k) {
        var d = document.createElement('div'); d.className = 'slot';
        if (picked[k] !== undefined) {
          var c = picked[k], r = c >> 2, s = c & 3;
          d.className = 'slot filled' + ((s === 1 || s === 2) ? ' red' : '');
          d.innerHTML = '<b>' + RANK_CHARS[r] + '</b><span>' + SUIT_CHARS[s] + '</span>';
          d.onclick = function () { toggle(c); };
        } else d.textContent = '?';
        tray.appendChild(d);
      })(k);
    }
    if (picked.length === 5) analyze();
    else { $('resultCard').style.display = 'none'; $('result').innerHTML = ''; }
  }

  $('bRandom').onclick = function () {
    picked = [];
    var deck = []; for (var c = 0; c < 52; c++) deck.push(c);
    for (var k = 0; k < 5; k++) picked.push(deck.splice(Math.floor(Math.random() * deck.length), 1)[0]);
    refresh();
  };
  $('bReset').onclick = function () { picked = []; refresh(); };

  // ---------- paytable & coins ----------
  function buildChips() {
    var w = $('ptchips'); w.innerHTML = '';
    PTS.forEach(function (p) {
      var b = document.createElement('button');
      b.className = 'chip' + (p === PT ? ' on' : '');
      b.textContent = p + (p === '9/6' ? ' ★' : '');
      b.onclick = function () {
        PT = p; saveCfg();
        w.querySelectorAll('.chip').forEach(function (x) { x.classList.remove('on'); });
        b.classList.add('on');
        renderPayRp();
        if (picked.length === 5) analyze();
      };
      w.appendChild(b);
    });
  }
  $('cMin').onclick = function () { if (COINS > 1) { COINS--; saveCfg(); $('cVal').textContent = COINS; renderPayRp(); if (picked.length === 5) analyze(); } };
  $('cPlus').onclick = function () { if (COINS < 5) { COINS++; saveCfg(); $('cVal').textContent = COINS; renderPayRp(); if (picked.length === 5) analyze(); } };

  // ---------- nominal rupiah ----------
  var NOMCHIPS = [1000, 5000, 10000, 100000];
  function buildNomChips() {
    var w = $('nomchips'); w.innerHTML = '';
    NOMCHIPS.forEach(function (v) {
      var b = document.createElement('button');
      b.className = 'chip' + (v === NOMINAL ? ' on' : '');
      b.textContent = fmtRp(v);
      b.onclick = function () { setNominal(v); };
      w.appendChild(b);
    });
  }
  function setNominal(v) {
    v = Math.max(100, Math.round(+v) || 1000);
    NOMINAL = v; saveCfg();
    $('nominal').value = v;
    buildNomChips(); renderPayRp();
    if (picked.length === 5) analyze();
  }
  $('nominal').addEventListener('change', function () { setNominal($('nominal').value); });

  // ---------- analysis ----------
  function analyze() {
    $('resultCard').style.display = 'block';
    $('result').innerHTML = '<div class="computing">⏳ Menghitung 32 opsi × semua draw…</div>';
    var dealt = picked.slice(), pt = PT, coins = COINS;
    setTimeout(function () {
      var t0 = performance.now();
      var res = E.bestHold(dealt, pt, coins);
      renderResult(res, dealt, pt, coins, Math.round(performance.now() - t0));
    }, 60);
  }
  function bigCard(c, held) {
    var r = c >> 2, s = c & 3;
    return '<div class="bcard' + ((s === 1 || s === 2) ? ' red' : '') + (held ? ' held' : ' drop') + '">' +
      '<b>' + RANK_CHARS[r] + '</b><span>' + SUIT_CHARS[s] + '</span>' + (held ? '' : '<i>✖</i>') + '</div>';
  }
  function renderResult(res, dealt, pt, coins, ms) {
    var hs = {}; res.hold.forEach(function (c) { hs[c] = 1; });
    var cards = dealt.map(function (c) { return bigCard(c, hs[c]); }).join('');
    var alts = res.alts.map(function (a) {
      return '<div class="alt"><span>' + a.name + '</span><b>' + fmtRp(a.ev * NOMINAL) + '</b></div>';
    }).join('');
    var betRp = coins * NOMINAL, expRp = res.ev * NOMINAL;
    $('result').innerHTML =
      '<div class="reshead">✅ TAHAN: ' + res.name + '</div>' +
      '<div class="bcards">' + cards + '</div>' +
      '<div class="exprp">💰 Ekspektasi kembali <b>' + fmtRp(expRp) + '</b><small>per ronde • bet ' + fmtRp(betRp) + '</small></div>' +
      '<div class="evrow"><div><small>EV / koin</small><b>' + res.ev.toFixed(2) + '</b></div>' +
      '<div><small>RTP</small><b>' + res.rtp.toFixed(2) + '%</b></div>' +
      '<div><small>Bet</small><b>' + fmtRp(betRp) + '</b></div></div>' +
      '<p class="why">' + E.advice(res, coins) + '</p>' +
      '<div class="alts"><div class="altstitle">Alternatif lain (ekspektasi lebih kecil):</div>' + alts + '</div>' +
      '<div class="logrow"><span>Hasil mainmu:</span> ' +
      '<button class="btn win" id="logW">✅ Bayar</button>' +
      '<button class="btn lose" id="logL">❌ Zonk</button></div>' +
      '<small class="ms">exact • paytable ' + pt + ' • ' + ms + ' ms</small>';
    $('logW').onclick = function () { log(1); };
    $('logL').onclick = function () { log(0); };
  }

  // ---------- bayaran dalam rupiah ----------
  function renderPayRp() {
    var el = $('payRp'); if (!el) return;
    var pay = E.payouts(PT, COINS); // koin aktual utk bet ini
    var rp = function (i) { return fmtRp(pay[i] * NOMINAL); };
    el.innerHTML = 'Dengan bet-mu (<b>' + COINS + ' koin × ' + fmtRp(NOMINAL) + ' = ' + fmtRp(COINS * NOMINAL) + '</b>/ronde):<br>' +
      '👑 Royal Flush: <b>' + rp(9) + '</b> • SF: <b>' + rp(8) + '</b> • Four of a Kind: <b>' + rp(7) + '</b><br>' +
      'Full House: <b>' + rp(6) + '</b> • Flush: <b>' + rp(5) + '</b> • Straight: <b>' + rp(4) + '</b>';
  }

  // ---------- history ----------
  var HKEY = 'jacks_hist_v1';
  function getHist() { try { return JSON.parse(localStorage.getItem(HKEY)) || []; } catch (e) { return []; } }
  function log(v) {
    var h = getHist(); h.push(v);
    localStorage.setItem(HKEY, JSON.stringify(h.slice(-300)));
    renderHist();
  }
  window.JacksApp = { log: log };
  $('hReset').onclick = function () { localStorage.removeItem(HKEY); renderHist(); };
  function renderHist() {
    var h = getHist(), n = h.length;
    var wins = h.filter(function (x) { return x === 1; }).length;
    var streak = 0, dir = '';
    if (n) {
      dir = h[n - 1] === 1 ? 'W' : 'L';
      for (var i = n - 1; i >= 0 && h[i] === h[n - 1]; i--) streak++;
    }
    var last = h.slice(-24).map(function (x) {
      return '<span class="dot ' + (x === 1 ? 'w' : 'l') + '"></span>';
    }).join('');
    $('hist').innerHTML =
      '<div class="histstats">' +
      '<div><small>Bayar</small><b>' + (n ? (100 * wins / n).toFixed(1) + '%' : '—') + '</b></div>' +
      '<div><small>Tangan</small><b>' + n + '</b></div>' +
      '<div><small>Streak</small><b>' + (n ? streak + (dir === 'W' ? 'W' : 'L') : '—') + '</b></div>' +
      '</div><div class="dots">' + (last || '<span style="color:#5a6578;font-size:12px">Belum ada data.</span>') + '</div>';
  }

  buildPicker(); buildChips(); buildNomChips();
  $('cVal').textContent = COINS;
  $('nominal').value = NOMINAL;
  refresh(); renderHist(); renderPayRp();
})();
