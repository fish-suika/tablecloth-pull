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

// ---- Phase 2：載る物の選び方・テーブルの判定 ----
function seeded(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
const tiersOk = (lo, hi, test) => { for (let st = lo; st < hi; st++) for (let seed = 1; seed <= 200; seed++) { const ids = pickTable(st, seeded(seed * 7919 + st), CFG); if (!test(ids, st)) return false; } return true; };
check('最初（0〜2連続）は1つだけ載る', tiersOk(0, 3, ids => ids.length === 1));
check('4〜7（3〜6連続）は2〜3個載る', tiersOk(3, 7, ids => ids.length >= 2 && ids.length <= 3));
check('8〜12（7〜11連続）はケーキかタワーが必ず載る', tiersOk(7, 12, ids => ids.includes('cake') || ids.includes('tower')));
check('同じ物が1つのテーブルに重複して載らない', tiersOk(0, 30, ids => new Set(ids).size === ids.length));
check('どのテーブルも幅の重なりがあり、tier の最小幅以上（理不尽な組み合わせが出ない）', tiersOk(0, 30, (ids, st) => {
  const r = tableRange(ids, 99, CFG), t = tierOf(st, CFG);   // 99＝広げない幅
  return !r.empty && (r.hi - r.lo >= t.minW - 1e-9 || ids.length === 1);
}));
check('載っている物は設定にある物だけ', tiersOk(0, 30, ids => ids.every(id => CFG.items[id])));
check('同じ乱数なら同じ組み合わせ（検証が再現できる）', JSON.stringify(pickTable(5, seeded(42), CFG)) === JSON.stringify(pickTable(5, seeded(42), CFG)));
check('7種類すべてがどこかで出る', (() => { const seen = new Set(); for (let st = 0; st < 40; st++) for (let s = 1; s < 60; s++) pickTable(st, seeded(s * 31 + st), CFG).forEach(i => seen.add(i)); return Object.keys(CFG.items).every(k => seen.has(k)); })());
check('軽い紙コップは速すぎるとダメ・重い鉄鍋は遅いとダメ（性格の差）', CFG.items.paperCup.hi < CFG.items.glass.hi && CFG.items.pot.lo > CFG.items.glass.lo);
check('紙コップと鉄鍋は同時に載らない（幅が重ならない）', combineRanges([CFG.items.paperCup, CFG.items.pot]).empty);
const jt = (sp, ids, no) => judgeTable(sp, ids, no === undefined ? 99 : no, CFG);
check('テーブル判定：重なりの中なら成功', jt(3.0, ['glass', 'plate']).result === 'ok');
check('テーブル判定：重い物と一緒だと、グラス単独で成功の速さでも遅くて失敗', jt(3.0, ['glass', 'pot']).result === 'slow' && judge(3.0, CFG.items.glass, CFG).result === 'ok');
check('テーブル判定：軽い物と一緒だと速すぎて失敗', jt(4.5, ['plate', 'paperCup']).result === 'fast');
check('テーブル判定：物ごとの結果が返る（外れた物だけ失敗）', (() => { const j = jt(3.0, ['glass', 'pot']); return j.per[0].result === 'ok' && j.per[1].result === 'slow'; })());
check('テーブル判定：全員成功なら全員 ok', jt(4.2, ['glass', 'plate', 'pot']).per.every(p => p.result === 'ok'));
check('テーブル判定：どれかがギリギリなら near', jt(2.25, ['paperCup', 'glass']).near && !jt(3.0, ['plate']).near);
check('失敗のときは near にならない', !jt(0.5, ['glass']).near);
check('最初の数テーブルは広い幅で判定される', jt(1.8, ['glass'], 0).result === 'ok' && jt(1.8, ['glass'], 5).result === 'slow');
check('tableRange は judgeTable の range と同じ', (() => { const a = tableRange(['glass', 'cake'], 2, CFG), b = jt(3, ['glass', 'cake'], 2).range; return a.lo === b.lo && a.hi === b.hi; })());

