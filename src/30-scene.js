// ===== 3D の場面：テーブル・クロス・物・割れる破片 =====
// 物理エンジンは使わない。結果は判定ロジックで先に決まっていて、ここはその結果に合う動きを再生するだけ。
// クロスは「経路（テーブルの上→手前の垂れ→床）」に沿って布の点が滑っていく作り。

const GRAV = 22;
const CLOTH_NX = 12, CLOTH_NM = 56;
const EDGE = CFG.world.tableD / 2;               // テーブル手前の縁の z
const TOP = CFG.world.tableTop;
const ITEM_Z0 = 0.3;                              // 物を置く z（縁寄りにして、引きずられると縁に届くように）
const CLOTH_LEN = CFG.world.tableD + CFG.world.drape + 0.1;
const OFFSET_END = 9.5;                           // 布がこれだけ滑ったら画面から消えている

const ease = { out: t => 1 - (1 - t) * (1 - t), inQ: t => Math.pow(t, 1.6) };

function buildWorld(scene) {
  scene.background = new THREE.Color(0x2a1f3d);
  const hemi = new THREE.HemisphereLight(0xfff4e0, 0x5a4470, 0.75);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffffff, 0.85);
  sun.position.set(3, 7, 5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  const sc = sun.shadow.camera; sc.left = -6; sc.right = 6; sc.top = 6; sc.bottom = -6; sc.near = 1; sc.far = 20;
  scene.add(sun);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshStandardMaterial({ color: 0x8a5a38, roughness: 0.85 }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true;
  scene.add(floor);
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(40, 16), new THREE.MeshStandardMaterial({ color: 0x4a3470, roughness: 1 }));
  wall.position.set(0, 8, -6);
  scene.add(wall);
  // 壁のかざり（丸いランプ）
  for (let i = -2; i <= 2; i++) {
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.28, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffe9a8 }));
    lamp.position.set(i * 2.2, 4.2, -5.8);
    scene.add(lamp);
  }
}

let _clothTex = null;
function clothTexture() {
  if (_clothTex) return _clothTex;
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#fbf6ee'; g.fillRect(0, 0, 128, 128);
  g.fillStyle = '#e8575a'; g.fillRect(0, 0, 64, 64); g.fillRect(64, 64, 64, 64);
  _clothTex = new THREE.CanvasTexture(c);
  _clothTex.wrapS = _clothTex.wrapT = THREE.RepeatWrapping;
  _clothTex.repeat.set(4, CLOTH_LEN / (CFG.world.clothW / 4));
  return _clothTex;
}

// 布の経路上の位置：s は経路に沿った長さ（0＝テーブルの奥の縁）
function pathAt(s, progress) {
  const D = CFG.world.tableD, H = CFG.world.drape;
  if (s <= D) return { y: TOP + 0.012, z: -D / 2 + s };
  if (s <= D + H) {
    const k = (s - D) / H;
    return { y: TOP - (s - D) + 0.012 * (1 - k), z: EDGE + 0.14 * Math.sin(Math.PI * Math.min(1, k * 1.15)) + 0.012 };
  }
  const f = s - D - H;
  const y = 0.02 + Math.max(0, 0.5 * progress * Math.sin(f * 1.9)) * Math.min(1, f);
  return { y, z: EDGE + 0.012 + f };
}

function buildGlass() {
  const g = new THREE.Group();
  const pts = [[0, 0], [0.26, 0], [0.26, 0.035], [0.04, 0.075], [0.04, 0.5], [0.12, 0.62], [0.3, 0.78], [0.3, 1.18], [0.27, 1.18], [0.27, 0.8], [0.0, 0.72]]
    .map(p => new THREE.Vector2(p[0], p[1]));
  const body = new THREE.Mesh(new THREE.LatheGeometry(pts, 24),
    new THREE.MeshStandardMaterial({ color: 0xcfeeff, transparent: true, opacity: 0.55, roughness: 0.1, metalness: 0.1, side: THREE.DoubleSide }));
  body.castShadow = true;
  g.add(body);
  const juice = new THREE.Mesh(new THREE.CylinderGeometry(0.255, 0.18, 0.28, 20), new THREE.MeshStandardMaterial({ color: 0xff5d73, roughness: 0.4 }));
  juice.position.y = 0.92;
  g.add(juice);
  g.scale.setScalar(0.95);
  g.userData.radius = 0.3;
  return g;
}
function std(color, o) { return new THREE.MeshStandardMaterial(Object.assign({ color, roughness: 0.6 }, o || {})); }
function castAll(g) { g.traverse(o => { if (o.isMesh) o.castShadow = true; }); return g; }
function add(g, geo, mat, x, y, z) { const m = new THREE.Mesh(geo, mat); m.position.set(x || 0, y || 0, z || 0); g.add(m); return m; }

// 紙コップ：軽い。白に赤い縞
function buildPaperCup() {
  const g = new THREE.Group();
  add(g, new THREE.CylinderGeometry(0.27, 0.19, 0.5, 20), std(0xffffff, { roughness: 0.9 }), 0, 0.25, 0);
  add(g, new THREE.CylinderGeometry(0.262, 0.222, 0.14, 20), std(0xe8575a, { roughness: 0.9 }), 0, 0.26, 0);
  add(g, new THREE.TorusGeometry(0.27, 0.025, 8, 20), std(0xf1ece0), 0, 0.5, 0).rotation.x = Math.PI / 2;
  return castAll(g);
}
// お皿：平たい。ドーナツつき
function buildPlate() {
  const g = new THREE.Group();
  add(g, new THREE.CylinderGeometry(0.5, 0.36, 0.07, 28), std(0xf6efe3, { roughness: 0.3 }), 0, 0.035, 0);
  add(g, new THREE.CylinderGeometry(0.3, 0.3, 0.02, 24), std(0xdbe7f7, { roughness: 0.3 }), 0, 0.075, 0);
  const d = add(g, new THREE.TorusGeometry(0.13, 0.065, 12, 20), std(0xf29bb7, { roughness: 0.5 }), 0, 0.15, 0);
  d.rotation.x = Math.PI / 2;
  return castAll(g);
}
// ろうそく：細くて背が高い。炎つき
function buildCandle() {
  const g = new THREE.Group();
  add(g, new THREE.CylinderGeometry(0.24, 0.26, 0.06, 20), std(0xc9a54a, { metalness: 0.5, roughness: 0.35 }), 0, 0.03, 0);
  add(g, new THREE.CylinderGeometry(0.075, 0.08, 0.95, 16), std(0xfff3d6, { roughness: 0.8 }), 0, 0.535, 0);
  add(g, new THREE.SphereGeometry(0.075, 12, 10), new THREE.MeshBasicMaterial({ color: 0xffb43a }), 0, 1.12, 0).scale.set(0.8, 1.5, 0.8);
  return castAll(g);
}
// 鉄鍋：重い。黒くて低い。取っ手つき
function buildPot() {
  const g = new THREE.Group();
  add(g, new THREE.CylinderGeometry(0.42, 0.36, 0.5, 24), std(0x34353b, { metalness: 0.6, roughness: 0.4 }), 0, 0.25, 0);
  add(g, new THREE.CylinderGeometry(0.44, 0.44, 0.05, 24), std(0x4a4b52, { metalness: 0.6, roughness: 0.4 }), 0, 0.52, 0);
  add(g, new THREE.SphereGeometry(0.07, 10, 8), std(0x888b94, { metalness: 0.7 }), 0, 0.6, 0);
  const h = add(g, new THREE.TorusGeometry(0.1, 0.035, 8, 14), std(0x34353b, { metalness: 0.6 }), 0.5, 0.42, 0); h.rotation.y = Math.PI / 2;
  return castAll(g);
}
// ケーキ：3段。いちごが載る
function buildCake() {
  const g = new THREE.Group();
  const cream = std(0xfff0f3, { roughness: 0.7 }), sponge = std(0xf3c98b, { roughness: 0.8 });
  add(g, new THREE.CylinderGeometry(0.5, 0.5, 0.28, 28), sponge, 0, 0.14, 0);
  add(g, new THREE.CylinderGeometry(0.51, 0.51, 0.1, 28), cream, 0, 0.3, 0);
  add(g, new THREE.CylinderGeometry(0.38, 0.38, 0.26, 28), sponge, 0, 0.48, 0);
  add(g, new THREE.CylinderGeometry(0.39, 0.39, 0.09, 28), cream, 0, 0.64, 0);
  add(g, new THREE.CylinderGeometry(0.26, 0.26, 0.24, 28), sponge, 0, 0.78, 0);
  add(g, new THREE.CylinderGeometry(0.27, 0.27, 0.08, 28), cream, 0, 0.93, 0);
  add(g, new THREE.SphereGeometry(0.1, 12, 10), std(0xe03148, { roughness: 0.4 }), 0, 1.03, 0);
  return castAll(g);
}
// シャンパンタワー：段になった皿を細い脚で重ねる
function buildTower() {
  const g = new THREE.Group();
  const glassM = std(0xcfeeff, { transparent: true, opacity: 0.6, roughness: 0.1 });
  add(g, new THREE.CylinderGeometry(0.22, 0.26, 0.04, 20), glassM, 0, 0.02, 0);
  const tiers = [[0.5, 0.32], [0.36, 0.7], [0.22, 1.06]];
  for (const [r, y] of tiers) {
    add(g, new THREE.CylinderGeometry(0.035, 0.035, 0.34, 8), glassM, 0, y - 0.18, 0);
    add(g, new THREE.CylinderGeometry(r, r * 0.55, 0.12, 22), glassM, 0, y, 0);
    add(g, new THREE.CylinderGeometry(r * 0.88, r * 0.88, 0.04, 22), std(0xffd86b, { roughness: 0.3 }), 0, y + 0.04, 0);
  }
  add(g, new THREE.SphereGeometry(0.06, 10, 8), std(0xffd86b), 0, 1.2, 0);
  return castAll(g);
}
const ITEM_BUILDERS = { glass: buildGlass, paperCup: buildPaperCup, plate: buildPlate, candle: buildCandle, pot: buildPot, cake: buildCake, tower: buildTower };

function buildTable() {
  const g = new THREE.Group();
  const wood = new THREE.MeshStandardMaterial({ color: 0x5b3a22, roughness: 0.7 });
  const top = new THREE.Mesh(new THREE.BoxGeometry(CFG.world.tableW, 0.12, CFG.world.tableD), wood);
  top.position.y = TOP - 0.06; top.castShadow = true; top.receiveShadow = true;
  g.add(top);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.14, TOP - 0.12, 0.14), wood);
    leg.position.set(sx * (CFG.world.tableW / 2 - 0.15), (TOP - 0.12) / 2, sz * (CFG.world.tableD / 2 - 0.15));
    leg.castShadow = true;
    g.add(leg);
  }
  return g;
}

function buildClothMesh() {
  const nx = CLOTH_NX, nm = CLOTH_NM;
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array((nx + 1) * (nm + 1) * 3);
  const uv = new Float32Array((nx + 1) * (nm + 1) * 2);
  const idx = [];
  for (let j = 0; j <= nm; j++) for (let i = 0; i <= nx; i++) {
    const k = j * (nx + 1) + i;
    uv[k * 2] = i / nx; uv[k * 2 + 1] = j / nm;
    if (i < nx && j < nm) { const a = k, b = k + 1, c = k + nx + 1, d = k + nx + 2; idx.push(a, c, b, b, c, d); }
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geo.setIndex(idx);
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ map: clothTexture(), side: THREE.DoubleSide, roughness: 0.95 }));
  mesh.castShadow = true; mesh.receiveShadow = true; mesh.frustumCulled = false;
  return mesh;
}

// ---- 1テーブル分 ----
function makeRound(itemIds) {
  const group = new THREE.Group();
  group.add(buildTable());
  const cloth = buildClothMesh();
  group.add(cloth);
  const shardsGroup = new THREE.Group();
  group.add(shardsGroup);

  const n = itemIds.length, spread = n === 1 ? 0 : n === 2 ? 0.75 : 1.15;   // 物を横に並べる（2つ＝±0.75、3つ＝±1.15）
  const items = itemIds.map((id, k) => {
    const mesh = ITEM_BUILDERS[id]();
    const x = n === 1 ? 0 : -spread + 2 * spread * k / (n - 1);
    const it = { id, mesh, x, y: TOP, z: ITEM_Z0 + (n > 1 && k % 2 ? -0.25 : 0), rx: 0, rz: 0, vx: 0, vy: 0, vz: 0, wx: 0, wz: 0, mode: 'rest', wob: 0, wobAmp: 0, t: 0 };
    group.add(mesh);
    return it;
  });

  const R = {
    group, items,
    phase: 'idle',        // idle → pulling → done
    offset: 0, pt: 0, dur: 1, verdict: null, speed: 0,
    shards: [], shattered: false, settled: false, onShatter: null, onSettle: null,
    elapsed: 0,
  };

  function writeCloth() {
    const pa = cloth.geometry.attributes.position.array;
    const prog = Math.min(1, R.offset / 3);
    const hw = CFG.world.clothW / 2;
    for (let j = 0; j <= CLOTH_NM; j++) {
      const m = j / CLOTH_NM * CLOTH_LEN;
      const p = pathAt(m + R.offset, prog);
      for (let i = 0; i <= CLOTH_NX; i++) {
        const k = (j * (CLOTH_NX + 1) + i) * 3;
        const u = i / CLOTH_NX * 2 - 1;
        const flare = m + R.offset > CFG.world.tableD + CFG.world.drape ? 1 + 0.25 * prog : 1;
        pa[k] = u * hw * flare;
        pa[k + 1] = p.y + (m + R.offset > CFG.world.tableD ? 0.05 * u * u * prog : 0);
        pa[k + 2] = p.z;
      }
    }
    cloth.geometry.attributes.position.needsUpdate = true;
    cloth.geometry.computeVertexNormals();
  }
  writeCloth();

  function syncItem(it) {
    it.mesh.position.set(it.x, it.y, it.z);
    it.mesh.rotation.set(it.rx, 0, it.rz);
  }
  items.forEach(syncItem);

  function shatter(it) {
    it.mode = 'gone'; it.mesh.visible = false;
    const n = 18;
    for (let i = 0; i < n; i++) {
      const sz = 0.05 + Math.random() * 0.08;
      const m = new THREE.Mesh(new THREE.BoxGeometry(sz, sz * 0.5, sz * 1.4),
        new THREE.MeshStandardMaterial({ color: i % 4 === 0 ? 0xff5d73 : 0xcfeeff, transparent: true, opacity: 0.8 }));
      m.position.set(it.x, Math.max(it.y, 0.05) + 0.2, it.z);
      const a = Math.random() * Math.PI * 2, sp = 1 + Math.random() * 2.6;
      shardsGroup.add(m);
      R.shards.push({ m, vx: Math.cos(a) * sp, vy: 2 + Math.random() * 3.5, vz: Math.sin(a) * sp, wx: (Math.random() - .5) * 14, wz: (Math.random() - .5) * 14, life: 1.6 });
    }
    R.shattered = true;
    if (R.onShatter) R.onShatter(it);
  }

  function updateItem(it, dt, clothVel) {
    it.t += dt;
    if (it.mode === 'rest') {
      it.wob += dt;
      it.rz = it.wobAmp * Math.exp(-2.6 * it.wob) * Math.sin(17 * it.wob);
      it.rx = it.wobAmp * 0.6 * Math.exp(-2.6 * it.wob) * Math.sin(13 * it.wob + 1);
    } else if (it.mode === 'drag') {
      it.z += clothVel * 0.92 * dt;
      it.rx = Math.min(0.5, Math.max(0, (it.z - ITEM_Z0)) * 0.25);
      it.rz = Math.sin(it.t * 30) * 0.05;
      if (R.offset > ITEM_Z0 + EDGE + 0.1 && it.z < EDGE) { it.mode = 'rest'; it.wobAmp = 0.3; it.wob = 0; }   // 引きずられきらず取り残された（まず起きない）
      if (it.z > EDGE + 0.02) { it.mode = 'fall'; it.vz = clothVel * 0.6; it.vy = 0; it.wx = 3.5; }
    } else if (it.mode === 'hop') {
      it.vy -= GRAV * dt; it.y += it.vy * dt;
      if (it.y <= TOP) { it.y = TOP; it.mode = 'rest'; it.wob = 0; }
    } else if (it.mode === 'launch' || it.mode === 'fall') {
      it.vy -= GRAV * dt; it.y += it.vy * dt; it.z += it.vz * dt; it.x += it.vx * dt;
      it.rx += it.wx * dt; it.rz += it.wz * dt;
      const overTable = Math.abs(it.z) < EDGE + 0.05 && Math.abs(it.x) < CFG.world.tableW / 2;
      if (overTable && it.y <= TOP && it.vy < 0) { it.y = TOP; shatter(it); }
      else if (it.y <= 0.02) { it.y = 0.02; shatter(it); }
    }
    syncItem(it);
  }

  R.pull = function (speed, verdict) {
    R.speed = speed; R.verdict = verdict; R.phase = 'pulling'; R.pt = 0;
    R.dur = Math.min(CFG.fx.durMax, Math.max(CFG.fx.durMin, CFG.fx.durK / Math.max(speed, 0.5)));
    // 物ごとの判定（verdict.per）で動きが決まる。全部成功ならギリギリの物ほど大きく揺れ、一部だけ外れたら外れた物だけ失敗する
    items.forEach((it, k) => {
      const v = verdict.per[k];
      if (v.result === 'ok') {
        it.mode = 'hop'; it.vy = v.near ? 1.2 : 2.4; it.wobAmp = v.near ? 0.42 : 0.14; it.wob = 0;
      } else if (v.result === 'slow') {
        it.mode = 'drag';
      } else {
        it.mode = 'launch';
        it.vy = 8.5 + Math.min(4, v.off) * 0.6; it.vz = 0.5 + Math.random() * 1.2; it.vx = (Math.random() - .5) * 1.2;
        it.wx = 5 + Math.random() * 3; it.wz = (Math.random() - .5) * 8;
      }
    });
  };

  R.update = function (dt) {
    R.elapsed += dt;
    let clothVel = 0;
    if (R.phase === 'pulling') {
      const prev = R.offset;
      R.pt = Math.min(1, R.pt + dt / R.dur);
      R.offset = OFFSET_END * ease.inQ(R.pt);
      clothVel = (R.offset - prev) / Math.max(dt, 1e-4);
      writeCloth();
      if (R.pt >= 1) { R.phase = 'done'; cloth.visible = false; }
    }
    for (const it of items) if (it.mode !== 'gone') updateItem(it, dt, clothVel);
    for (let i = R.shards.length - 1; i >= 0; i--) {
      const s = R.shards[i];
      s.life -= dt;
      s.vy -= GRAV * dt;
      s.m.position.x += s.vx * dt; s.m.position.y += s.vy * dt; s.m.position.z += s.vz * dt;
      const floorY = (Math.abs(s.m.position.z) < EDGE && Math.abs(s.m.position.x) < CFG.world.tableW / 2 && s.m.position.y > TOP - 0.3) ? TOP : 0.03;
      if (s.m.position.y < floorY) { s.m.position.y = floorY; s.vy *= -0.3; s.vx *= 0.7; s.vz *= 0.7; s.wx *= 0.6; s.wz *= 0.6; }
      s.m.rotation.x += s.wx * dt; s.m.rotation.z += s.wz * dt;
      if (s.life < 0.5) s.m.scale.setScalar(Math.max(0.01, s.life / 0.5));
      if (s.life <= 0) { shardsGroup.remove(s.m); s.m.geometry.dispose(); s.m.material.dispose(); R.shards.splice(i, 1); }
    }
  };

  R.dispose = function () {
    group.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material && o.material !== cloth.material) o.material.dispose(); });
    cloth.material.dispose();
  };
  return R;
}
