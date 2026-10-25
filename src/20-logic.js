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
  const k = (cfg.widthScale || 1) * (tableNo < cfg.widenTables ? cfg.widen : 1);
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
// 難しさの目標の幅（連続数 → そのテーブル全体の成功の幅）。cfg.difficulty の点の間を直線でつなぐ
function targetWidth(streak, cfg) {
  const d = cfg.difficulty;
  if (streak <= d[0][0]) return d[0][1];
  for (let i = 1; i < d.length; i++) {
    if (streak <= d[i][0]) { const k = (streak - d[i - 1][0]) / (d[i][0] - d[i - 1][0]); return d[i - 1][1] + (d[i][1] - d[i - 1][1]) * k; }
  }
  return d[d.length - 1][1];
}
// 載せる物の組み合わせのテーブル全体の成功の幅（倍率はかけ、最初の数テーブルの広げは含めない）
function tableWidth(ids, cfg) { const r = combineRanges(ids.map(id => itemRange(cfg.items[id], 99, cfg))); return r.empty ? 0 : r.hi - r.lo; }

// 条件を満たす組み合わせを集め、目標の幅に近い順の上位 t.top（既定3）個からランダムに1つ選ぶ（毎回同じにならないように）
function pickTable(streak, rng, cfg) {
  const t = tierOf(streak, cfg), target = targetWidth(streak, cfg), seen = new Set(), cands = [];
  for (let k = 0; k < 80; k++) {
    const n = Math.min(t.pool.length, t.count[0] + Math.floor(rng() * (t.count[1] - t.count[0] + 1)));
    const ids = [];
    if (t.must) ids.push(t.must[Math.floor(rng() * t.must.length)]);
    while (ids.length < n) {
      const id = t.pool[Math.floor(rng() * t.pool.length)];
      if (!ids.includes(id)) ids.push(id);
    }
    const key = ids.slice().sort().join();
    if (seen.has(key)) continue;
    seen.add(key);
    const w = tableWidth(ids, cfg);
    if (w > 0 && w >= t.minW) cands.push({ ids, d: Math.abs(w - target) });
  }
  if (!cands.length) return [t.must ? t.must[0] : t.pool[0]];          // 見つからなければ1つだけ載せる
  cands.sort((a, b) => a.d - b.d);
  return cands[Math.floor(rng() * Math.min(t.top || 3, cands.length))].ids;
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

// ---- 演出の選び方（褒め言葉・紙吹雪・節目） ----
// count＝この成功で何連続になるか。rng は 0〜1 の乱数。cls は見た目の大きさ（good → great → epic）
function praiseFor(count, near, rng, cfg) {
  const pick = a => a[Math.floor(rng() * a.length) % a.length];
  let tier = cfg.praise.ok[0];
  for (const t of cfg.praise.ok) if (count >= t.from) tier = t;
  const cls = count >= cfg.praise.ok[3].from ? 'epic' : (near || count >= cfg.praise.ok[2].from ? 'great' : 'good');
  return { text: near ? pick(cfg.praise.near) : pick(tier.words), cls };
}
function failWord(result, rng, cfg) { const a = cfg.praise[result]; return a[Math.floor(rng() * a.length) % a.length]; }
function isMilestone(count, cfg) { return count > 0 && count % cfg.praise.milestoneEvery === 0; }
// 紙吹雪の数：3連続から。連続数に比例、節目は倍
function confettiCount(count, cfg) {
  if (count < 3) return 0;
  const n = Math.min(cfg.praise.confettiMax, 8 + count * 3);
  return isMilestone(count, cfg) ? Math.min(cfg.praise.confettiMax * 1.5, n * 2) : n;
}
// 連続数に応じた連続数チップの光り方（0〜3）
function glowTier(count) { return count >= 20 ? 3 : count >= 12 ? 2 : count >= 5 ? 1 : 0; }
// 引いた瞬間の画面の揺れの強さ（速いほど強い）
function pullShake(speed, cfg) { return Math.min(cfg.shake.pullMax, speed * cfg.shake.pull); }

// ---- 結果画面・共有 ----
// 称号（連続数に応じて）
function rankFor(streak, cfg) { let r = cfg.rank[0]; for (const x of cfg.rank) if (streak >= x.from) r = x; return r.name; }
// 失敗した物の名前（判定の per から）。例：['グラス', '鉄鍋']
function failedNames(ids, verdict, cfg) { return ids.filter((id, i) => verdict.per[i].result !== 'ok').map(id => cfg.items[id].name); }
// 失敗の見出し。例：「グラスと鉄鍋が引きずられて落ちた…」
function overTitle(names, result, allSoft) {
  const who = names.length ? names.join('と') + 'が' : '';
  return who + (result === 'slow' ? '引きずられて落ちた…' : allSoft ? '跳ね上がって散った…' : '跳ね上がって割れた…');
}
// 失敗した物がぜんぶ「割れない物」（猫・雪だるま）か
function failedAllSoft(ids, verdict, cfg) { const f = ids.filter((id, i) => verdict.per[i].result !== 'ok'); return f.length > 0 && f.every(id => cfg.items[id].soft); }
// X に投稿する文章（url が空なら文章だけ）
function shareText(streak, best, cfg, url) {
  const head = streak > 0 ? 'テーブルクロス引きで ' + streak + '連続成功！（' + rankFor(streak, cfg) + '）' : 'テーブルクロス引きに挑戦！';
  return head + (best > streak ? ' 自己ベスト' + best + '連続' : '') + ' #' + cfg.share.hashtag;
}
// PC 用：X の投稿画面を開く URL
function tweetUrl(text, url) { return 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(text) + (url ? '&url=' + encodeURIComponent(url) : ''); }
