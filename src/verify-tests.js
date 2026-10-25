// ===== 検証（three.js を使わない純粋ロジック） =====
const $out = document.getElementById('out');
let nOk = 0, nNg = 0;
function check(name, cond, why) {
  const d = document.createElement('div'); d.className = 'r ' + (cond ? 'ok' : 'ng'); d.textContent = name;
  if (!cond) { nNg++; const w = document.createElement('div'); w.className = 'why'; w.textContent = why || ''; d.appendChild(w); } else nOk++;
  $out.appendChild(d);
}
const near = (x, y, e) => Math.abs(x - y) <= (e || 1e-9);

// ---- 速さの測り方 ----
// 0.1 秒で画面の 40% を等速でなぞる → 4
const fast = [0, 25, 50, 75, 100].map((t, i) => ({ t, x: .5, y: .5 + .1 * i }));
check('等速：0.1秒で画面の40% → 速さ4', near(measureSpeed(fast, CFG).speed, 4, 1e-6), String(measureSpeed(fast, CFG).speed));
check('距離は始点からの下向きの量', near(measureSpeed(fast, CFG).dist, 0.4, 1e-9));
const slow = Array.from({ length: 20 }, (_, i) => ({ t: i * 50, x: .5, y: .45 + .02 * i }));   // 1秒で 38% → 0.4/s
check('ゆっくりなぞる → 速さ0.4', near(measureSpeed(slow, CFG).speed, 0.4, 1e-6), String(measureSpeed(slow, CFG).speed));
const held = fast.concat([{ t: 400, x: .5, y: .9 }]);   // 最後は止めてから離した
check('止めてから離すと速さはほぼ0（直前の時間窓で測る）', measureSpeed(held, CFG).speed < 0.2, String(measureSpeed(held, CFG).speed));
const accel = [{ t: 0, x: .5, y: .5 }, { t: 400, x: .5, y: .55 }, { t: 450, x: .5, y: .8 }, { t: 500, x: .5, y: 1.0 }];
check('最後に加速 → 離す直前の速さで測る（平均より速い）', measureSpeed(accel, CFG).speed > 3.5, String(measureSpeed(accel, CFG).speed));
check('上向きになぞったら速さ0', measureSpeed([{ t: 0, x: .5, y: .8 }, { t: 100, x: .5, y: .5 }], CFG).speed === 0);
check('点が1つだけなら速さ0・距離0', (() => { const m = measureSpeed([{ t: 0, x: .5, y: .5 }], CFG); return m.speed === 0 && m.dist === 0; })());
check('点が2つで同時刻でも割り算で壊れない', Number.isFinite(measureSpeed([{ t: 5, x: .5, y: .5 }, { t: 5, x: .5, y: .6 }], CFG).speed));
check('短すぎる引きは「引いていない」', isShortPull(0.05, CFG) && !isShortPull(0.15, CFG));

// ---- 幅 ----
const g = CFG.items.glass;
check('最初の数テーブルは幅が広い（中心は同じ）', (() => {
  const a = itemRange(g, 0, CFG), b = itemRange(g, CFG.widenTables, CFG);
  return near((a.lo + a.hi) / 2, (b.lo + b.hi) / 2) && (a.hi - a.lo) > (b.hi - b.lo);
})());
check('widenTables を過ぎたら元の幅', (() => { const b = itemRange(g, CFG.widenTables, CFG); return near(b.lo, g.lo) && near(b.hi, g.hi); })());
check('幅の重なり：狭いほうに合う', (() => { const r = combineRanges([{ lo: 2, hi: 5 }, { lo: 3, hi: 7 }]); return r.lo === 3 && r.hi === 5 && !r.empty; })());
check('重なりがなければ empty', combineRanges([{ lo: 1, hi: 2 }, { lo: 3, hi: 4 }]).empty);
check('1つだけならその幅', (() => { const r = combineRanges([{ lo: 2, hi: 5 }]); return r.lo === 2 && r.hi === 5; })());

// ---- 判定 ----
const R = { lo: 2, hi: 5 };
check('幅より遅い → slow', judge(1.5, R, CFG).result === 'slow');
check('幅より速い → fast', judge(5.5, R, CFG).result === 'fast');
check('幅の中 → ok', judge(3.5, R, CFG).result === 'ok');
check('端ちょうどは ok', judge(2, R, CFG).result === 'ok' && judge(5, R, CFG).result === 'ok');
check('中央は ギリギリ ではない', !judge(3.5, R, CFG).near);
check('端の近くは ギリギリ', judge(2.1, R, CFG).near && judge(4.9, R, CFG).near);
check('外れた量が返る', near(judge(1.5, R, CFG).off, 0.5) && near(judge(6, R, CFG).off, 1));
check('幅が狭くても ギリギリ の最小幅がある', (() => { const n = { lo: 3, hi: 3.4 }; return judge(3.1, n, CFG).near && !judge(3.2, n, CFG).near; })());
check('設定の幅が速さメーターの中に収まる', Object.values(CFG.items).every(i => i.lo > 0 && i.hi < CFG.speedMax && i.lo < i.hi));
check('広げた最初の幅もメーターの中に収まる', Object.values(CFG.items).every(i => { const r = itemRange(i, 0, CFG); return r.lo > 0 && r.hi < CFG.speedMax; }));

// ---- メーター ----
check('メーター位置は0〜1に収まる', meterPos(-1, CFG) === 0 && meterPos(100, CFG) === 1 && near(meterPos(CFG.speedMax / 2, CFG), 0.5));

const sumEl = document.getElementById('sum');
sumEl.textContent = nNg === 0 ? ('全 ' + nOk + ' 件 PASS') : (nNg + ' 件 FAIL / ' + (nOk + nNg) + ' 件');
sumEl.style.color = nNg === 0 ? '#6bd07a' : '#ff6b6b';
