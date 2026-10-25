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
