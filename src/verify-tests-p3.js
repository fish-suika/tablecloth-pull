// ---- Phase 3：褒め言葉・紙吹雪・節目・揺れ ----
check('褒め言葉は連続数が増えるほど段階が上がる（大きさ good→great→epic）', (() => {
  const r = n => praiseFor(n, false, () => 0, CFG).cls;
  return r(1) === 'good' && r(7) === 'good' && r(8) === 'great' && r(12) === 'great' && r(13) === 'epic' && r(25) === 'epic';
})());
check('ギリギリは序盤でも great 以上で、専用の言葉', (() => { const p = praiseFor(2, true, () => 0, CFG); return p.cls === 'great' && CFG.praise.near.includes(p.text); })());
check('連続数に合った言葉が選ばれる（1連続に「神業」は出ない）', (() => { for (let s = 0; s < 50; s++) { const t = praiseFor(1, false, seeded(s + 1), CFG).text; if (CFG.praise.ok[0].words.indexOf(t) < 0) return false; } return true; })());
check('13連続以上では神業の言葉が出る', (() => { const t = praiseFor(14, false, () => 0, CFG).text; return CFG.praise.ok[3].words.includes(t); })());
check('乱数が 1.0 に近くても言葉の範囲を超えない', (() => { const t = praiseFor(5, false, () => 0.9999999, CFG).text; return typeof t === 'string' && t.length > 0; })());
check('失敗の言葉（遅い・速い）が選ばれる', CFG.praise.slow.includes(failWord('slow', () => 0.5, CFG)) && CFG.praise.fast.includes(failWord('fast', () => 0.5, CFG)));
check('節目は5の倍数（0は節目ではない）', isMilestone(5, CFG) && isMilestone(10, CFG) && !isMilestone(0, CFG) && !isMilestone(7, CFG));
check('紙吹雪：2連続まではなし・3連続から・連続数で増える・上限あり', confettiCount(2, CFG) === 0 && confettiCount(3, CFG) > 0 && confettiCount(4, CFG) > confettiCount(3, CFG) && confettiCount(99, CFG) <= CFG.praise.confettiMax * 1.5);
check('節目の紙吹雪は多い', confettiCount(10, CFG) > confettiCount(9, CFG) && confettiCount(10, CFG) > confettiCount(11, CFG));
check('連続数チップの光り方は 5/12/20 連続で段階が上がる', glowTier(4) === 0 && glowTier(5) === 1 && glowTier(12) === 2 && glowTier(20) === 3);
check('画面の揺れは速いほど強く、上限がある', pullShake(2, CFG) < pullShake(5, CFG) && pullShake(50, CFG) === CFG.shake.pullMax);
check('割れる物すべてに破片の色が決まっている', Object.keys(CFG.items).every(k => CFG.shard[k] && CFG.shard[k].length === 2));

