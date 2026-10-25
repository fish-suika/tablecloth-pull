// ===== 起動・メインループ・入力・ゲームの流れ =====
// state：title → enter（テーブルが滑り込む）→ aim（スワイプ待ち）→ resolve（結果の演出）→ enter … / over
(function boot() {
  const $ = id => document.getElementById(id);
  const stage = $('stage'), view = $('view');
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  view.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  buildWorld(scene);
  const camera = new THREE.PerspectiveCamera(40, 9 / 16, 0.1, 80);
  const C = CFG.cam;
  let shakeAmp = 0;
  function shake(a) { shakeAmp = Math.max(shakeAmp, a); }

  function fit() {
    const w = view.clientWidth, h = view.clientHeight;
    renderer.setSize(w, h);
    document.documentElement.style.setProperty('--u', stage.clientWidth / 100 + 'px');
    camera.aspect = w / h;
    const hf = C.hfov * Math.PI / 180;                       // 横の画角を一定にして縦の画角を決める（細い画面でもテーブルが収まる）
    camera.fov = 2 * Math.atan(Math.tan(hf / 2) / camera.aspect) * 180 / Math.PI;
    camera.position.set(C.pos[0], C.pos[1], C.pos[2]);
    camera.lookAt(C.look[0], C.look[1], C.look[2]);
    camera.updateProjectionMatrix();
  }
  addEventListener('resize', fit); fit();

  // ---- 保存（使えないときは保存しないだけ） ----
  const KEY = 'tablecloth-pull-best';
  let best = 0;
  try { best = parseInt(localStorage.getItem(KEY) || '0', 10) || 0; } catch (e) { }
  function saveBest() { try { localStorage.setItem(KEY, String(best)); } catch (e) { } }

  // ---- 状態 ----
  let state = 'title', streak = 0, round = null, outgoing = null, range = null;
  let enterT = 0, resT = 0, popped = false, advanced = false, failAt = 0, drag = null, nextIds = null;
  let showZone = CFG.showZoneDefault;

  const hud = $('hud'), meter = $('meter'), mZone = $('meterZone'), mMark = $('meterMark'), mVal = $('meterVal'), hint = $('hint');

  function refreshHud() {
    $('streak').textContent = streak; $('best').textContent = best; $('titleBest').textContent = best;
    $('streakBox').className = 'chip t' + glowTier(streak);
  }
  function pop(text, cls) {
    const d = document.createElement('div'); d.className = 'pop ' + cls; d.textContent = text;
    $('pops').appendChild(d); setTimeout(() => d.remove(), 1250);
  }
  function confetti(n) {
    const box = $('confetti'), cols = ['#ff6b6b', '#ffd43b', '#51cf66', '#339af0', '#da77f2', '#ff922b'];
    for (let i = 0; i < n; i++) {
      const d = document.createElement('div'); d.className = 'cf';
      d.style.left = (Math.random() * 100) + '%'; d.style.background = cols[i % cols.length];
      d.style.setProperty('--dx', ((Math.random() - 0.5) * 30) + 'vw'); d.style.setProperty('--rot', (360 + Math.random() * 720) + 'deg');
      d.style.animationDuration = (1.4 + Math.random() * 1.2) + 's'; d.style.animationDelay = (Math.random() * 0.25) + 's';
      box.appendChild(d); setTimeout(() => d.remove(), 3200);
    }
  }
  function showNames(ids) { $('names').textContent = ids.map(id => CFG.items[id].name).join('・'); }
  function setZoneView() {
    $('zoneBtn').classList.toggle('off', !showZone);
    if (!range || range.empty) { mZone.style.display = 'none'; return; }
    mZone.style.left = (range.lo / CFG.speedMax * 100) + '%';
    mZone.style.width = ((range.hi - range.lo) / CFG.speedMax * 100) + '%';
    mZone.classList.toggle('pre', state === 'aim' || state === 'enter');
    mZone.style.display = (showZone || state === 'resolve' || state === 'over') ? 'block' : 'none';
  }
  function setMark(speed, bad) {
    mMark.style.left = (meterPos(speed, CFG) * 100) + '%';
    mMark.classList.toggle('bad', !!bad);
    mVal.textContent = '速さ ' + speed.toFixed(1);
  }
  $('soundBtn').classList.toggle('off', SFX.isMuted());
  $('soundBtn').addEventListener('click', e => { e.stopPropagation(); SFX.unlock(); SFX.setMuted(!SFX.isMuted()); $('soundBtn').classList.toggle('off', SFX.isMuted()); if (!SFX.isMuted()) setTimeout(SFX.blip, 80); });
  for (const ev of ['pointerdown', 'pointerup', 'touchend', 'click']) addEventListener(ev, () => SFX.unlock(), { capture: true });
  $('zoneBtn').addEventListener('click', e => { e.stopPropagation(); showZone = !showZone; setZoneView(); });

  function spawnRound() {
    const ids = nextIds || pickTable(streak, Math.random, CFG);
    nextIds = null;
    range = tableRange(ids, streak, CFG);
    round = makeRound(ids);
    round.ids = ids;
    round.onShatter = it => { SFX.shatter(it.id); shake(CFG.shake.shatter); };
    showNames(ids);
    round.group.position.x = CFG.world.slideX;
    scene.add(round.group);
    state = 'enter'; enterT = 0; popped = false; advanced = false;
    mMark.style.left = '0%'; mMark.classList.remove('bad'); mVal.textContent = '';
    mMark.style.opacity = 0;
    setZoneView();
    meter.classList.add('on'); hint.classList.remove('on');
  }

  function startGame() {
    $('titleScr').classList.remove('on'); $('overScr').classList.remove('on');
    streak = 0; refreshHud();
    hud.classList.add('on');
    if (outgoing) { scene.remove(outgoing.group); outgoing.dispose(); outgoing = null; }
    if (round) { scene.remove(round.group); round.dispose(); round = null; }
    spawnRound();
  }

  let lastResult = { streak: 0, best: 0, title: '' };

  // ---- X 共有：スマホは画像つき（Web Share API）、PC は X の投稿画面（文章＋URL。画像は自動では付けられない） ----
  function resultCanvas() {
    const c = document.createElement('canvas'); c.width = 1080; c.height = 1350;
    const g = c.getContext('2d'), F = '"Hiragino Kaku Gothic ProN","Yu Gothic","Meiryo",sans-serif';
    const bg = g.createLinearGradient(0, 0, 0, 1350); bg.addColorStop(0, '#3b2a5c'); bg.addColorStop(1, '#1d1530');
    g.fillStyle = bg; g.fillRect(0, 0, 1080, 1350);
    for (let i = 0; i < 60; i++) { g.fillStyle = ['#ff6b6b', '#ffd43b', '#51cf66', '#339af0', '#da77f2'][i % 5]; g.save(); g.translate((i * 197) % 1080, (i * 331) % 1350); g.rotate(i); g.fillRect(0, 0, 18, 30); g.restore(); }
    g.textAlign = 'center'; g.fillStyle = '#fff'; g.font = '900 64px ' + F; g.fillText('テーブルクロス引き（仮）', 540, 190);
    g.fillStyle = '#ffd43b'; g.font = '900 360px ' + F; g.fillText(String(lastResult.streak), 540, 700);
    g.fillStyle = '#fff'; g.font = '900 72px ' + F; g.fillText('連続成功', 540, 810);
    g.fillStyle = '#ffd43b'; g.font = '900 64px ' + F; g.fillText('称号：' + rankFor(lastResult.streak, CFG), 540, 930);
    g.fillStyle = '#fff'; g.font = '700 48px ' + F; g.fillText(lastResult.title, 540, 1030);
    g.fillStyle = '#c9c0e0'; g.font = '700 44px ' + F; g.fillText('自己ベスト ' + lastResult.best + ' 連続', 540, 1110);
    g.fillText('#' + CFG.share.hashtag, 540, 1250);
    return c;
  }
  async function share() {
    const url = CFG.share.url || (/^https?:/.test(location.href) ? location.href.split('#')[0] : '');
    const text = shareText(lastResult.streak, lastResult.best, CFG, url);
    if (matchMedia('(pointer: coarse)').matches && navigator.share && navigator.canShare) {
      try {
        const blob = await new Promise(r => resultCanvas().toBlob(r, 'image/png'));
        const file = new File([blob], 'tablecloth-pull.png', { type: 'image/png' });
        if (navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], text: text + (url ? ' ' + url : '') }); return; }
      } catch (e) { if (e && e.name === 'AbortError') return; }
    }
    window.open(tweetUrl(text, url), '_blank', 'noopener');
  }
  $('shareBtn').addEventListener('click', share);

  function gameOver(kind) {
    state = 'over';
    SFX.fail();
    const isNew = streak > best;
    if (isNew) { best = streak; saveBest(); }
    refreshHud();
    const names = failedNames(round.ids, round.verdict, CFG), title = overTitle(names, kind, failedFate(round.ids, round.verdict, CFG));
    $('overTitle').textContent = title;
    $('overScore').textContent = streak;
    $('overNew').classList.toggle('on', isNew);
    $('overRank').textContent = '称号：' + rankFor(streak, CFG);
    $('overBest').textContent = '自己ベスト ' + best + ' 連続';
    lastResult = { streak, best, title };
    $('overScr').classList.add('on');
    hint.classList.remove('on');
  }

  // 引いた結果をここで決める（指を離した瞬間）
  function commitPull(speed) {
    const verdict = judgeTable(speed, round.ids, streak, CFG);
    round.pull(speed, verdict);
    SFX.whip(speed); shake(pullShake(speed, CFG));
    if (verdict.result === 'slow') setTimeout(SFX.drag, 120); else if (verdict.result === 'fast') setTimeout(SFX.launch, 60);
    else if (verdict.near) setTimeout(SFX.slowmo, 150);
    state = 'resolve'; resT = 0; popped = false; advanced = false; failAt = 0;
    round.verdict = verdict;
    setMark(speed, verdict.result !== 'ok');
    mMark.style.opacity = 1;
    setZoneView();
    hint.classList.remove('on');
  }

  // ---- 入力：画面の下側で下へスワイプ ----
  function pt(e) {
    const r = stage.getBoundingClientRect();
    return { t: e.timeStamp, x: (e.clientX - r.left) / r.height, y: (e.clientY - r.top) / r.height };
  }
  stage.addEventListener('pointerdown', e => {
    if (state !== 'aim' || e.target.closest('button')) return;
    const p = pt(e);
    if (p.y < CFG.startY) return;
    drag = { id: e.pointerId, trail: [p] };
    try { stage.setPointerCapture(e.pointerId); } catch (er) { }
    mMark.style.opacity = 1;
  });
  stage.addEventListener('pointermove', e => {
    if (!drag || e.pointerId !== drag.id) return;
    drag.trail.push(pt(e));
    const m = measureSpeed(drag.trail, CFG);
    setMark(m.speed, false);
  });
  function release(e, cancel) {
    if (!drag || e.pointerId !== drag.id) return;
    const d = drag; drag = null;
    if (cancel || state !== 'aim') return;
    d.trail.push(pt(e));
    const m = measureSpeed(d.trail, CFG);
    if (isShortPull(m.dist, CFG)) {
      pop('もっと引いて', 'bad'); mMark.style.opacity = 0; return;
    }
    commitPull(m.speed);
  }
  stage.addEventListener('pointerup', e => release(e, false));
  stage.addEventListener('pointercancel', e => release(e, true));
  $('startBtn').addEventListener('click', startGame);
  $('againBtn').addEventListener('click', startGame);

  // ---- メインループ ----
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (outgoing) {
      outgoing.update(dt);
      outgoing.group.position.x -= dt * 22;
      if (outgoing.group.position.x < -CFG.world.slideX) { scene.remove(outgoing.group); outgoing.dispose(); outgoing = null; }
    }
    if (round) {
      const slowNear = state === "resolve" && round.verdict && round.verdict.result === "ok" && round.verdict.near && resT < CFG.fx.slowTime;
      round.update(slowNear ? dt * CFG.fx.slowScale : dt);
      if (state === "enter") {
        enterT += dt;
        const k = Math.min(1, enterT / CFG.fx.enter);
        round.group.position.x = CFG.world.slideX * (1 - ease.out(k));
        if (k >= 1) { state = 'aim'; hint.classList.add('on'); setZoneView(); }
      } else if (state === 'resolve') {
        resT += dt;
        const v = round.verdict;
        if (v.result === 'ok') {
          if (!popped && resT > (v.near ? CFG.fx.nearPopAt : 0.28)) {
            popped = true;
            streak++; refreshHud();
            const sb = $('streakBox'); sb.classList.remove('bump'); void sb.offsetWidth; sb.classList.add('bump');
            const pr = praiseFor(streak, v.near, Math.random, CFG);
            pop(pr.text, pr.cls);
            if (v.near) SFX.near(); else SFX.success(streak);
            confetti(confettiCount(streak, CFG));
            if (isMilestone(streak, CFG)) { pop(streak + '連続！', 'mile'); SFX.milestone(); shake(CFG.shake.milestone); }
          }
          if (!advanced && resT > (v.near ? CFG.fx.nearHold : CFG.fx.okHold)) {
            advanced = true;
            outgoing = round; spawnRound();
          }
        } else {
          if (!popped && resT > 0.12) { popped = true; pop(failWord(v.result, Math.random, CFG), 'bad'); }
          if (round.shattered && !failAt) failAt = resT;
          if ((failAt && resT > failAt + CFG.fx.failHold) || resT > 3.5) gameOver(v.result);
        }
      }
    }
    if (shakeAmp > 0.0005) {                                  // 画面の揺れ：だんだん収まる
      camera.position.set(C.pos[0] + (Math.random() - .5) * shakeAmp * 2, C.pos[1] + (Math.random() - .5) * shakeAmp * 2, C.pos[2]);
      camera.lookAt(C.look[0], C.look[1], C.look[2]);
      shakeAmp *= Math.exp(-CFG.shake.decay * dt);
    } else if (shakeAmp > 0) { shakeAmp = 0; camera.position.set(C.pos[0], C.pos[1], C.pos[2]); camera.lookAt(C.look[0], C.look[1], C.look[2]); }
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  refreshHud();
  requestAnimationFrame(frame);

  // 検証用：スワイプなしで、指定の速さで引いたことにする
  window.__tc = {
    mem: () => JSON.stringify(renderer.info.memory) + ' tex=' + renderer.info.memory.textures,
    pressShare: () => share(),
    shareImage: () => resultCanvas().toDataURL(),
    setResult: r => { lastResult = r; },
    spawn: ids => { if (round) { scene.remove(round.group); round.dispose(); } nextIds = ids; spawnRound(); },
    pull: s => { if (state === 'aim') commitPull(s); return state; },
    state: () => ({ state, streak, best, range, shattered: round && round.shattered }),
  };
})();
