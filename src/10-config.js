// ===== 調整用の数値（遊んで直す） =====
// 速さの単位は「画面の高さ／秒」。例：画面の半分を 0.125 秒でなぞる＝ 4
const CFG = {
  speedMax: 9,            // 速さメーターの右端
  minPull: 0.10,          // これ未満しか引かなかったら「引いていない」扱い（画面の高さの割合）
  window: 0.10,           // 速さを測る時間窓＝指を離す直前の何秒か
  startY: 0.42,           // この高さ（画面上端からの割合）より下で指を置いたときだけ受け付ける
  nearRatio: 0.12,        // 幅の端からこの割合以内ならギリギリ
  nearMin: 0.15,          // ギリギリの最小幅（速さの単位）
  widen: 1.4,             // 最初の数テーブルは幅を広げる倍率
  widenTables: 3,         // 広げるテーブル数
  showZoneDefault: true,  // 成功の幅を引く前から見せるか（「幅」ボタンで切り替え）
  items: {
    // lo〜hi が「ちょうどいい速さ」。遅いと引きずられ、速いと跳ねる
    glass: { name: 'グラス', lo: 2.2, hi: 5.0 },
  },
  firstItem: 'glass',
  // 演出の時間（秒）
  // 引く動きの長さ＝ durK ÷ 速さ（秒）を durMin〜durMax に収める。遅く引くと布もゆっくり動く
  fx: { enter: 0.38, okHold: 0.7, failHold: 0.5, durK: 1.0, durMin: 0.16, durMax: 1.2 },
  world: { tableTop: 1.0, tableW: 3.4, tableD: 2.0, drape: 1.0, clothW: 3.9, slideX: 9 },
  // カメラ：横の画角を固定して、斜め上から見下ろす
  cam: { hfov: 31, pos: [0, 5.0, 6.6], look: [0, 0.7, 0.3] },
};
