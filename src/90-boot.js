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
  let state = 'title', streak = 0, round = null, outgoing = null, range = null, def = null;
  let enterT = 0, resT = 0, popped = false, advanced = false, failAt = 0, drag = null;
  let showZone = CFG.showZoneDefault;

  const hud = $('hud'), meter = $('meter'), mZone = $('meterZone'), mMark = $('meterMark'), mVal = $('meterVal'), hint = $('hint');

  function refreshHud() { $('streak').textContent = streak; $('best').textContent = best; $('titleBest').textContent = best; }
  function pop(text, cls) {
    const d = document.createElement('div'); d.className = 'pop ' + cls; d.textContent = text;
    $('pops').appendChild(d); setTimeout(() => d.remove(), 1250);
  }
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
  $('zoneBtn').addEventListener('click', e => { e.stopPropagation(); showZone = !showZone; setZoneView(); });

  function spawnRound() {
    const ids = [CFG.firstItem];
    def = CFG.items[ids[0]];
    range = combineRanges(ids.map(id => itemRange(CFG.items[id], streak, CFG)));
    round = makeRound(ids);
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

  function gameOver(kind) {
    state = 'over';
    if (streak > best) { best = streak; saveBest(); }
    refreshHud();
    $('overTitle').textContent = kind === 'slow' ? '引きずって落ちた…' : '跳ねて割れた…';
    $('overScore').textContent = streak;
    $('overBest').textContent = '自己ベスト ' + best + ' 連続';
    $('overScr').classList.add('on');
    hint.classList.remove('on');
  }

  // 引いた結果をここで決める（指を離した瞬間）
  function commitPull(speed) {
    const verdict = judge(speed, range, CFG);
    round.pull(speed, verdict);
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
      round.update(dt);
      if (state === 'enter') {
        enterT += dt;
        const k = Math.min(1, enterT / CFG.fx.enter);
        round.group.position.x = CFG.world.slideX * (1 - ease.out(k));
        if (k >= 1) { state = 'aim'; hint.classList.add('on'); setZoneView(); }
      } else if (state === 'resolve') {
        resT += dt;
        const v = round.verdict;
        if (v.result === 'ok') {
          if (!popped && resT > 0.28) {
            popped = true;
            if (v.near) pop('ギリギリ！', 'great'); else pop('お見事！', 'good');
          }
          if (!advanced && resT > CFG.fx.okHold) {
            advanced = true; streak++; refreshHud();
            const sb = $('streakBox'); sb.classList.remove('bump'); void sb.offsetWidth; sb.classList.add('bump');
            outgoing = round; spawnRound();
          }
        } else {
          if (!popped && resT > 0.12) { popped = true; pop(v.result === 'slow' ? '遅すぎ！' : '速すぎ！', 'bad'); }
          if (round.shattered && !failAt) failAt = resT;
          if ((failAt && resT > failAt + CFG.fx.failHold) || resT > 3.5) gameOver(v.result);
        }
      }
    }
    renderer.render(scene, camera);
    requestAnimationFrame(frame);
  }
  refreshHud();
  requestAnimationFrame(frame);

  // 検証用：スワイプなしで、指定の速さで引いたことにする
  window.__tc = {
    pull: s => { if (state === 'aim') commitPull(s); return state; },
    state: () => ({ state, streak, best, range, shattered: round && round.shattered }),
  };
})();
