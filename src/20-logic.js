// ===== 判定ロジック（three.js を使わない。verify.html で検証する） =====

// 指の軌跡から速さを測る。trail は [{t(ms), y(画面の高さに対する割合・下向きが正), x}]
// 戻り値：{speed（画面の高さ/秒）, dist（始点からの下向きの距離）}
function measureSpeed(trail, cfg) {
  const n = trail.length;
  if (n < 2) return { speed: 0, dist: 0 };
  const last = trail[n - 1];
  const dist = last.y - trail[0].y;
  let base = last;
  for (let i = n - 2; i >= 0; i--) {
    if (last.t - trail[i].t <= cfg.window * 1000) base = trail[i]; else break;
  }
  if (base === last) base = trail[n - 2];
  const dt = Math.max((last.t - base.t) / 1000, 0.008);
  return { speed: Math.max(0, (last.y - base.y) / dt), dist };
}

// 物の「ちょうどいい速さ」の幅。最初の数テーブルは中心を保ったまま広げる
function itemRange(def, tableNo, cfg) {
  const c = (def.lo + def.hi) / 2, w = def.hi - def.lo;
  const k = tableNo < cfg.widenTables ? cfg.widen : 1;
  return { lo: c - w * k / 2, hi: c + w * k / 2 };
}

// 載っている物の幅の重なり。重なりがなければ empty
function combineRanges(ranges) {
  let lo = -Infinity, hi = Infinity;
  for (const r of ranges) { lo = Math.max(lo, r.lo); hi = Math.min(hi, r.hi); }
  return { lo, hi, empty: lo > hi };
}

// 判定：{ result: 'ok'|'slow'|'fast', near: ギリギリか, off: 幅から外れた量 }
function judge(speed, range, cfg) {
  if (speed < range.lo) return { result: 'slow', near: false, off: range.lo - speed };
  if (speed > range.hi) return { result: 'fast', near: false, off: speed - range.hi };
  const m = Math.max(cfg.nearMin, (range.hi - range.lo) * cfg.nearRatio);
  return { result: 'ok', near: Math.min(speed - range.lo, range.hi - speed) < m, off: 0 };
}

// 引いている長さが足りないか
function isShortPull(dist, cfg) { return dist < cfg.minPull; }

// 速さ→メーター上の位置（0〜1）
function meterPos(speed, cfg) { return Math.min(1, Math.max(0, speed / cfg.speedMax)); }

// ---- 載る物の選び方（連続成功数に応じたエスカレート） ----
function tierOf(streak, cfg) { return cfg.tiers.find(t => streak < t.upTo); }

// 連続成功数 streak のテーブルに載せる物の id の配列。rng は 0〜1 の乱数（検証では固定の乱数を渡す）
function pickTable(streak, rng, cfg) {
  const t = tierOf(streak, cfg);
  for (let k = 0; k < 60; k++) {
    const n = Math.min(t.pool.length, t.count[0] + Math.floor(rng() * (t.count[1] - t.count[0] + 1)));
    const ids = [];
    if (t.must) ids.push(t.must[Math.floor(rng() * t.must.length)]);
    while (ids.length < n) {
      const id = t.pool[Math.floor(rng() * t.pool.length)];
      if (!ids.includes(id)) ids.push(id);
    }
    const r = combineRanges(ids.map(id => cfg.items[id]));
    if (!r.empty && r.hi - r.lo >= t.minW) return ids;
  }
  return [t.must ? t.must[0] : t.pool[0]];          // 見つからなければ1つだけ載せる
}

// そのテーブルの判定。全員の幅の重なり（最初の数テーブルは広げた幅）の中なら成功。
// per＝物ごとの判定（成功した物は残り、外れた物だけ遅い／速いで失敗する演出に使う）
function judgeTable(speed, ids, tableNo, cfg) {
  const ranges = ids.map(id => itemRange(cfg.items[id], tableNo, cfg));
  const range = combineRanges(ranges);
  const per = ranges.map(r => judge(speed, r, cfg));
  let result = 'ok', off = 0;
  if (speed < range.lo) { result = 'slow'; off = range.lo - speed; }
  else if (speed > range.hi) { result = 'fast'; off = speed - range.hi; }
  return { result, off, near: result === 'ok' && per.some(p => p.near), per, range };
}

// そのテーブル全体の成功の幅
function tableRange(ids, tableNo, cfg) { return combineRanges(ids.map(id => itemRange(cfg.items[id], tableNo, cfg))); }
