// ---- 難しさの並び：簡単な順に、どんどん難しく ----
const avgW = (st, nSeed) => { let s = 0; for (let k = 1; k <= nSeed; k++) s += tableWidth(pickTable(st, seeded(k * 104729 + st), CFG), CFG); return s / nSeed; };
check('目標の幅は連続数が増えるほど狭くなる（単調に減る）', (() => { let p = Infinity; for (let s = 0; s <= 40; s++) { const w = targetWidth(s, CFG); if (w > p + 1e-9) return false; p = w; } return true; })());
check('目標の幅：0連続は広く、20連続以降は最後の値', targetWidth(0, CFG) === CFG.difficulty[0][1] && targetWidth(30, CFG) === CFG.difficulty[CFG.difficulty.length - 1][1]);
check('実際に出る幅の平均も連続数に応じて狭くなる（0→3→7→12→20）', (() => { const a = [0, 3, 7, 12, 20].map(s => avgW(s, 150)); return a.every((w, i) => i === 0 || w < a[i - 1]); })());
check('序盤（0〜2連続）に狭い幅は出ない（どの回も幅 2.8 以上）', tiersOk(0, 3, ids => tableWidth(ids, CFG) >= 2.8));
check('序盤（0〜2連続）は幅の広い順に並ぶ（平均が 0連続 ≧ 1連続 ≧ 2連続）', (() => { const a = [0, 1, 2].map(s => avgW(s, 200)); return a[0] >= a[1] - 1e-9 && a[1] >= a[2] - 1e-9; })());
check('3〜6連続でも幅 1.8 より狭い物は出ない', tiersOk(3, 7, ids => tableWidth(ids, CFG) >= 1.8));
check('20連続以降は狭い（幅の平均が 0連続の半分以下）', avgW(22, 150) <= avgW(0, 150) / 2);
check('どの回も幅の重なりがある（成功できる速さが存在する）', tiersOk(0, 40, ids => tableWidth(ids, CFG) > 0));
check('組み合わせは毎回同じにならない（同じ連続数でも複数の組み合わせが出る）', (() => { const set = new Set(); for (let k = 1; k <= 60; k++) set.add(pickTable(5, seeded(k * 7 + 1), CFG).slice().sort().join()); return set.size >= 3; })());

