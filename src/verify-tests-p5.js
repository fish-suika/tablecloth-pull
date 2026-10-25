// ---- Phase 4：13連続以降の物・称号・結果画面・共有 ----
check('12〜19連続（13個目〜20個目）は高そうな物が必ず1つ入る', tiersOk(12, 20, ids => ['fishbowl', 'vase', 'cardTower'].some(k => ids.includes(k))));
check('20連続以降はばかばかしい物が必ず1つ入る', tiersOk(20, 45, ids => ['cat', 'crown', 'snowman'].some(k => ids.includes(k))));
check('13連続より前には高そうな物・ばかばかしい物は出ない', tiersOk(0, 12, ids => !ids.some(k => ['fishbowl', 'vase', 'cardTower', 'cat', 'crown', 'snowman'].includes(k))));
check('13個目〜19個目にはばかばかしい物は出ない', tiersOk(12, 20, ids => !ids.some(k => ['cat', 'crown', 'snowman'].includes(k))));
check('13連続以降もどの回も幅の重なりがある・tier の最小幅以上', tiersOk(12, 60, (ids, st) => { const w = tableWidth(ids, CFG); return w > 0 && w >= tierOf(st, CFG).minW - 1e-9; }));
check('20連続以降の幅はもう狭い（平均 1.7 以下）', avgW(25, 200) <= 1.7);
check('設定にある物はすべて名前・幅・破片の色がある', Object.entries(CFG.items).every(([k, v]) => v.name && v.lo > 0 && v.hi > v.lo && CFG.shard[k]));
check('新しい物の幅（倍率つき・広げなし）がメーターの中に収まる', Object.keys(CFG.items).every(k => { const r = itemRange(CFG.items[k], 99, CFG); return r.lo > 0 && r.hi < CFG.speedMax; }));
check('猫と雪だるまは割れずに散る（soft）、それ以外は割れる', CFG.items.cat.soft && CFG.items.snowman.soft && !CFG.items.glass.soft && !CFG.items.vase.soft);

check('称号は連続数で上がる', rankFor(0, CFG) === 'はじめの一歩' && rankFor(3, CFG) === 'テーブル見習い' && rankFor(10, CFG) === '宴会の達人' && rankFor(99, CFG) === 'テーブルクロス王');
check('称号は下がらない（連続数が増えると同じか上）', (() => { let i = -1; for (let s = 0; s <= 40; s++) { const j = CFG.rank.findIndex(x => x.name === rankFor(s, CFG)); if (j < i) return false; i = j; } return true; })());
check('失敗した物の名前が取れる（成功した物は入らない）', (() => { const ids = ['glass', 'pot']; const v = judgeTable(3.0, ids, 99, CFG); const n = failedNames(ids, v, CFG); return n.length === 1 && n[0] === '鉄鍋'; })());
check('失敗の見出し：遅い・速い・最期の言い方', overTitle(['鉄鍋'], 'slow', 'fly') === '鉄鍋が引きずられて落ちた…' && overTitle(['グラス', 'お皿'], 'fast', 'break') === 'グラスとお皿が跳ね上がって割れた…' && overTitle(['ケーキ'], 'fast', 'crumble') === 'ケーキが跳ね上がって崩れた…' && overTitle(['鉄鍋'], 'fast', 'fly') === '鉄鍋が跳ね上がって吹っ飛んだ…' && overTitle(['グラス', 'ケーキ'], 'fast', 'mixed') === 'グラスとケーキが跳ね上がって大惨事に…');
check('共有の文章：連続数・称号・ハッシュタグ', (() => { const t = shareText(12, 12, CFG, ''); return t.includes('12連続') && t.includes(rankFor(12, CFG)) && t.includes('#' + CFG.share.hashtag); })());
check('共有の文章：自己ベストが上なら併記、同じなら省く', shareText(5, 9, CFG, '').includes('自己ベスト9連続') && !shareText(9, 9, CFG, '').includes('自己ベスト'));
check('共有の文章：0連続でも文章になる', shareText(0, 0, CFG, '').includes('挑戦'));
check('X の投稿 URL：文章と URL がエンコードされる', (() => { const u = tweetUrl('a b#c', 'https://x.example/g?x=1&y=2'); return u.startsWith('https://twitter.com/intent/tweet?text=a%20b%23c') && u.includes('&url=https%3A%2F%2Fx.example%2Fg%3Fx%3D1%26y%3D2'); })());
check('X の投稿 URL：URL がなければ付けない', !tweetUrl('abc', '').includes('url='));

check('失敗した物の最期：同じならそれ・違えば mixed', (() => { const v1 = judgeTable(7.5, ['cat', 'snowman'], 99, CFG), v2 = judgeTable(7.5, ['glass', 'cake'], 99, CFG), v3 = judgeTable(3.2, ['glass', 'pot'], 99, CFG); return failedFate(['cat', 'snowman'], v1, CFG) === 'scatter' && failedFate(['glass', 'cake'], v2, CFG) === 'mixed' && failedFate(['glass', 'pot'], v3, CFG) === 'fly'; })());
check('すべての物に最期（fate）が決まっている', Object.values(CFG.items).every(i => ['break', 'crumble', 'scatter', 'fly'].includes(i.fate)));
check('割れない物（soft）の最期は scatter', Object.values(CFG.items).every(i => !i.soft || i.fate === 'scatter'));
