// ===== 効果音（Web Audio で合成。音源ファイルなし） =====
// 使えない環境・まだ操作がない状態では何もしない（遊びは止まらない）
const SFX = (function () {
  let ctx = null, master = null, noiseBuf = null, muted = false;
  try { muted = localStorage.getItem('tablecloth-pull-mute') === '1'; } catch (e) { }

  function unlock() {                         // 最初の操作のときに呼ぶ（iPhone などは操作の中でしか音を出せない）
    try {
      if (!ctx) {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
        master = ctx.createGain(); master.gain.value = muted ? 0 : 0.8; master.connect(ctx.destination);
        noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 1.5, ctx.sampleRate);
        const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      }
      if (ctx.state === 'suspended') ctx.resume();
    } catch (e) { ctx = null; }
  }
  function setMuted(m) {
    muted = m; try { localStorage.setItem('tablecloth-pull-mute', m ? '1' : '0'); } catch (e) { }
    if (master) master.gain.value = m ? 0 : 0.8;
  }
  const ok = () => ctx && ctx.state === 'running' && !muted;

  // 雑音：filter の周波数を f0→f1 に動かし、vol で鳴らして dur 秒で消える
  function noise(type, f0, f1, dur, vol, delay, q) {
    if (!ok()) return;
    const t = ctx.currentTime + (delay || 0);
    const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    const f = ctx.createBiquadFilter(); f.type = type; f.Q.value = q || 1;
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.02, dur / 3)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(master);
    s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }
  // 音程：f0→f1
  function tone(type, f0, f1, dur, vol, delay) {
    if (!ok()) return;
    const t = ctx.currentTime + (delay || 0);
    const o = ctx.createOscillator(); o.type = type;
    o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.015); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(master); o.start(t); o.stop(t + dur + 0.05);
  }

  // 歓声：連続数が増えるほど長く・大きく・拍手が増える
  function cheer(level) {
    const l = Math.min(10, level);
    noise('bandpass', 900, 1700, 0.5 + l * 0.07, 0.10 + l * 0.02, 0, 0.7);
    noise('bandpass', 1800, 2600, 0.4 + l * 0.05, 0.05 + l * 0.01, 0.05, 0.9);
    for (let i = 0; i < 3 + l * 2; i++) noise('highpass', 2500, 4000, 0.05, 0.16, 0.1 + Math.random() * (0.35 + l * 0.04), 0.7);   // 拍手
  }

  return {
    unlock, setMuted, isMuted: () => muted,
    // 引いた瞬間：風切り音＋最後にパチンという音
    whip(speed) {
      const d = Math.max(0.12, 0.34 - speed * 0.03);
      noise('bandpass', 700, 5200, d, 0.5, 0, 1.2);
      noise('highpass', 5000, 7000, 0.06, 0.4, d * 0.8);
    },
    // 成功：連続数に応じて上がるファンファーレ＋歓声
    success(count) {
      const base = 523.25 * Math.pow(2, Math.min(count, 12) / 24);
      [1, 1.25, 1.5, 2].forEach((m, i) => tone('triangle', base * m, base * m * 1.01, 0.22, 0.22, i * 0.07));
      cheer(count);
    },
    near() { tone('sine', 880, 1320, 0.25, 0.25); tone('triangle', 1318, 1760, 0.3, 0.2, 0.1); cheer(8); },
    slowmo() { tone('sine', 220, 55, 0.7, 0.35); },                      // ギリギリのスロー：低くうなる
    drag() { noise('lowpass', 500, 220, 0.6, 0.45, 0, 2); },             // 引きずられる
    launch() { tone('sine', 280, 1400, 0.45, 0.22); noise('bandpass', 1200, 3000, 0.4, 0.15); },   // ロケットのように飛ぶ
    shatter(kind) {
      for (let i = 0; i < 10; i++) noise('highpass', 3000 + Math.random() * 2500, 6000, 0.07, 0.3, Math.random() * 0.22, 0.8);
      if (kind === 'pot') { tone('square', 190, 90, 0.35, 0.28); noise('lowpass', 900, 200, 0.3, 0.4); }          // 鉄鍋はガラスでなくガシャン
      else if (kind === 'cake') { noise('lowpass', 700, 150, 0.25, 0.4); tone('sine', 180, 60, 0.25, 0.3); }      // ケーキはぐしゃ
      else { for (let i = 0; i < 4; i++) tone('sine', 2200 + Math.random() * 2800, 2000, 0.12, 0.12, Math.random() * 0.2); }
    },
    fail() { [392, 330, 262, 196].forEach((f, i) => tone('triangle', f, f * 0.96, 0.28, 0.22, 0.25 + i * 0.16)); },   // しょんぼりした下降
    milestone() { [523, 659, 784, 1047, 1319].forEach((f, i) => tone('square', f, f, 0.12, 0.12, i * 0.06)); cheer(10); },
  };
})();
