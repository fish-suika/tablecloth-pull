// ===== 調整用の数値（遊んで直す） =====
// 速さの単位は「画面の高さ／秒」。例：画面の半分を 0.125 秒でなぞる＝ 4
const CFG = {
  speedMax: 9,            // 速さメーターの右端
  minPull: 0.10,          // これ未満しか引かなかったら「引いていない」扱い（画面の高さの割合）
  window: 0.10,           // 速さを測る時間窓＝指を離す直前の何秒か
  startY: 0.42,           // この高さ（画面上端からの割合）より下で指を置いたときだけ受け付ける
  nearRatio: 0.12,        // 幅の端からこの割合以内ならギリギリ
  nearMin: 0.15,          // ギリギリの最小幅（速さの単位）
  widthScale: 1.3,        // すべての物の成功の幅に掛ける倍率（難しさのつまみ。大きいほど易しい）
  widen: 1.4,             // 最初の数テーブルは幅を広げる倍率
  widenTables: 3,         // 広げるテーブル数
  showZoneDefault: true,  // 成功の幅を引く前から見せるか（「幅」ボタンで切り替え）
  items: {
    // lo〜hi が「ちょうどいい速さ」。遅いと引きずられ、速いと跳ねる
    // 軽い物は速すぎると飛ぶ（上限が低い）、重い物は速めでないと引きずる（下限が高い）、背が高い物は幅が狭い
    paperCup: { name: '紙コップ', lo: 1.4, hi: 3.6 },
    plate:    { name: 'お皿', lo: 2.0, hi: 5.6 },
    glass:    { name: 'グラス', lo: 2.2, hi: 5.0 },
    candle:   { name: 'ろうそく', lo: 2.6, hi: 4.4 },
    pot:      { name: '鉄鍋', lo: 4.0, hi: 7.2 },
    cake:     { name: 'ケーキ', lo: 2.8, hi: 4.8 },
    tower:    { name: 'シャンパンタワー', lo: 3.0, hi: 4.6 },
  },
  // 難しさの目標：[連続数, そのテーブル全体の成功の幅の目標]（間は直線でつなぐ。20連続以降は最後の値）。
  // 載る物は、tier の条件を満たす組み合わせのうち、この目標の幅に近いものを選ぶ → 連続するほど幅が狭くなる
  difficulty: [[0, 4.7], [1, 3.7], [2, 2.9], [3, 2.7], [7, 2.3], [12, 1.7], [20, 1.0]],
  // 連続成功数ごとの載る物。upTo＝この連続数未満のあいだ。top＝目標に近い上位何個からランダムに選ぶか（既定3。1なら毎回いちばん近いもの＝序盤は決まった順）、count＝物の数、must＝このうち1つは必ず入れる、
  // minW＝幅の重なりがこれ未満になる組み合わせは出さない（理不尽防止）
  tiers: [
    { upTo: 3,  count: [1, 1], pool: ['paperCup', 'plate', 'glass'], minW: 0, top: 1 },
    { upTo: 7,  count: [2, 3], pool: ['plate', 'glass', 'paperCup', 'candle', 'pot'], minW: 1.0 },
    { upTo: 12, count: [1, 3], pool: ['cake', 'tower', 'candle', 'glass', 'plate', 'paperCup', 'pot'], must: ['cake', 'tower'], minW: 0.8 },
    { upTo: Infinity, count: [2, 3], pool: ['paperCup', 'plate', 'glass', 'candle', 'pot', 'cake', 'tower'], minW: 0.7 },
  ],
  // 褒め言葉：from 連続以上で使う。連続数が増えるほど大きく褒める。near はギリギリ成功のとき
  praise: {
    ok: [
      { from: 1,  words: ['お見事！', 'ナイス！', 'いい引き！'] },
      { from: 4,  words: ['すごい！', 'うまい！', 'さすが！'] },
      { from: 8,  words: ['天才！', '名人！', 'プロの技！'] },
      { from: 13, words: ['神業！', '伝説！', '人間国宝！'] },
      { from: 20, words: ['人間じゃない！', 'ありえない！', '世界一！'] },
    ],
    near: ['ギリギリ！', 'あぶなっ！', '神業！'],
    slow: ['ずるずる〜！', '遅すぎ！', '引きずった！'],
    fast: ['ロケット発射！', '速すぎ！', '飛んでった！'],
    milestoneEvery: 5,      // この連続数ごとに「N連続！」を大きく出す
    confettiMax: 80,        // 紙吹雪の最大数（3連続から出る）
  },
  // 割れたときの破片の色（[おもな色, 差し色]）
  shard: {
    paperCup: [0xffffff, 0xe8575a], plate: [0xf6efe3, 0xf29bb7], glass: [0xcfeeff, 0xff5d73], candle: [0xfff3d6, 0xffb43a],
    pot: [0x34353b, 0x888b94], cake: [0xfff0f3, 0xe03148], tower: [0xcfeeff, 0xffd86b],
  },
  // 画面の揺れ（カメラ）：pull＝引いた瞬間（速さに比例）、shatter＝割れた瞬間、milestone＝節目
  shake: { pull: 0.012, pullMax: 0.1, shatter: 0.16, milestone: 0.08, decay: 5 },
  // 演出の時間（秒）
  // 引く動きの長さ＝ durK ÷ 速さ（秒）を durMin〜durMax に収める。遅く引くと布もゆっくり動く
  // ギリギリ成功のスロー：slowScale 倍の速さで slowTime 秒（実時間）。そのあと nearPopAt 秒で褒め、nearHold 秒で次へ
  fx: { enter: 0.38, okHold: 0.7, failHold: 0.5, durK: 1.0, durMin: 0.16, durMax: 1.2,
        slowScale: 0.3, slowTime: 1.0, nearPopAt: 0.95, nearHold: 1.5 },
  world: { tableTop: 1.0, tableW: 3.4, tableD: 2.0, drape: 1.0, clothW: 3.9, slideX: 9 },
  // カメラ：横の画角を固定して、斜め上から見下ろす
  cam: { hfov: 36, pos: [0, 5.0, 6.6], look: [0, 1.5, 0.3] },
};
