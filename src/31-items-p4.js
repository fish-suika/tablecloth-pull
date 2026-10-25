// ===== Phase 4 の物：13連続〜の高そうな物、20連続〜のばかばかしい物 =====
// 30-scene.js の std / add / castAll を使う。原点は物の底、高さはおよそ 0.9〜1.4

// 金魚の水槽：丸いガラスの鉢に水と金魚
function buildFishbowl() {
  const g = new THREE.Group();
  add(g, new THREE.CylinderGeometry(0.3, 0.34, 0.08, 20), std(0xb98a4f, { roughness: 0.5 }), 0, 0.04, 0);
  add(g, new THREE.SphereGeometry(0.5, 24, 18), std(0xbfe6ff, { transparent: true, opacity: 0.35, roughness: 0.05, side: THREE.DoubleSide }), 0, 0.58, 0);
  add(g, new THREE.SphereGeometry(0.46, 24, 14, 0, Math.PI * 2, Math.PI * 0.32, Math.PI * 0.68), std(0x62b8ff, { transparent: true, opacity: 0.5, roughness: 0.1 }), 0, 0.58, 0);
  const fish = std(0xff8a1f, { roughness: 0.4 });
  add(g, new THREE.SphereGeometry(0.1, 12, 10), fish, 0.05, 0.55, 0).scale.set(1.5, 1, 0.8);
  add(g, new THREE.ConeGeometry(0.07, 0.14, 8), fish, -0.13, 0.55, 0).rotation.z = Math.PI / 2;
  add(g, new THREE.SphereGeometry(0.02, 6, 6), std(0x222222), 0.14, 0.58, 0.07);
  add(g, new THREE.TorusGeometry(0.2, 0.025, 8, 24), std(0xdff3ff, { transparent: true, opacity: 0.6 }), 0, 1.04, 0).rotation.x = Math.PI / 2;
  return castAll(g);
}

// 高そうな花瓶：白地に青い帯、金のふち、花つき
function buildVase() {
  const g = new THREE.Group();
  const pts = [[0, 0], [0.22, 0], [0.24, 0.05], [0.4, 0.35], [0.42, 0.55], [0.3, 0.85], [0.16, 1.05], [0.15, 1.25], [0.22, 1.35], [0.2, 1.36], [0, 1.3]].map(p => new THREE.Vector2(p[0], p[1]));
  add(g, new THREE.LatheGeometry(pts, 28), std(0xf4f7ff, { roughness: 0.2, side: THREE.DoubleSide }), 0, 0, 0);
  add(g, new THREE.CylinderGeometry(0.415, 0.405, 0.1, 28), std(0x2f5fd0, { roughness: 0.3 }), 0, 0.45, 0);
  add(g, new THREE.CylinderGeometry(0.28, 0.26, 0.07, 24), std(0x2f5fd0, { roughness: 0.3 }), 0, 0.88, 0);
  add(g, new THREE.TorusGeometry(0.21, 0.02, 8, 24), std(0xe8b923, { metalness: 0.7, roughness: 0.3 }), 0, 1.36, 0).rotation.x = Math.PI / 2;
  const flowers = [[0xff6b8b, -0.05, 1.5], [0xffd43b, 0.08, 1.46], [0xffa8c5, 0.0, 1.58]];
  for (const [c, x, y] of flowers) add(g, new THREE.SphereGeometry(0.09, 10, 8), std(c, { roughness: 0.6 }), x, y, 0);
  add(g, new THREE.CylinderGeometry(0.01, 0.01, 0.3, 6), std(0x2f9e44), 0, 1.4, 0);
  return castAll(g);
}

// トランプタワー：A 字に立てかけたカードを3段
function buildCardTower() {
  const g = new THREE.Group();
  const card = std(0xffffff, { roughness: 0.5 }), back = std(0xe03148, { roughness: 0.5 });
  const cw = 0.36, ch = 0.5, lean = 0.34, tiers = 3;
  for (let t = 0; t < tiers; t++) {
    const n = tiers - t, y = t * (ch * Math.cos(lean) + 0.02), width = n * 0.34;
    for (let i = 0; i < n; i++) {
      const cx = -width / 2 + 0.17 + i * 0.34;
      for (const s of [-1, 1]) {
        const m = add(g, new THREE.BoxGeometry(cw, ch, 0.012), (i + t) % 2 ? back : card, cx + s * 0.085, y + ch / 2 * Math.cos(lean) + 0.01, 0);
        m.rotation.z = -s * lean;
        m.rotation.y = 0.0;
      }
    }
    // 段の天板
    if (n > 0) add(g, new THREE.BoxGeometry(width + 0.1, 0.012, cw), card, 0, y + ch * Math.cos(lean) + 0.02, 0);
  }
  return castAll(g);
}

// 寝ている猫：丸まったオレンジの猫。目は閉じ、しっぽを巻く
function buildCat() {
  const g = new THREE.Group();
  const fur = std(0xf2a65a, { roughness: 0.9 }), cream = std(0xfff3e0, { roughness: 0.9 });
  add(g, new THREE.SphereGeometry(0.42, 20, 16), fur, 0, 0.3, 0).scale.set(1.15, 0.7, 0.9);
  add(g, new THREE.SphereGeometry(0.27, 18, 14), fur, 0.38, 0.36, 0.1);
  add(g, new THREE.SphereGeometry(0.14, 12, 10), cream, 0.5, 0.3, 0.2).scale.set(1, 0.7, 1);
  for (const s of [-1, 1]) {
    add(g, new THREE.ConeGeometry(0.075, 0.16, 8), fur, 0.36, 0.62, 0.1 + s * 0.15);
    add(g, new THREE.BoxGeometry(0.1, 0.012, 0.012), std(0x4a2f1a), 0.55, 0.42, 0.1 + s * 0.09);   // 閉じた目
  }
  add(g, new THREE.SphereGeometry(0.03, 8, 6), std(0xe8758a), 0.64, 0.34, 0.1);
  const tail = add(g, new THREE.TorusGeometry(0.3, 0.07, 10, 20, Math.PI * 1.3), fur, -0.1, 0.12, 0.22); tail.rotation.x = Math.PI / 2; tail.rotation.z = 2.4;
  for (let i = 0; i < 3; i++) add(g, new THREE.BoxGeometry(0.06, 0.012, 0.012), std(0xd9822b), -0.1 + i * 0.12, 0.52 - Math.abs(i - 1) * 0.02, 0);   // しま
  return castAll(g);
}

// 王様の冠：金の輪、とがった先、宝石、赤いクッション
function buildCrown() {
  const g = new THREE.Group();
  const gold = std(0xffd43b, { metalness: 0.8, roughness: 0.25 });
  add(g, new THREE.CylinderGeometry(0.34, 0.38, 0.12, 24), std(0xb3243c, { roughness: 0.9 }), 0, 0.06, 0);
  add(g, new THREE.CylinderGeometry(0.3, 0.3, 0.22, 24, 1, true), gold, 0, 0.23, 0).material.side = THREE.DoubleSide;
  const gems = [0xe03148, 0x339af0, 0x51cf66, 0xda77f2, 0xff922b];
  for (let i = 0; i < 5; i++) {
    const a = i / 5 * Math.PI * 2, x = Math.cos(a) * 0.27, z = Math.sin(a) * 0.27;
    add(g, new THREE.ConeGeometry(0.075, 0.28, 6), gold, x, 0.48, z);
    add(g, new THREE.SphereGeometry(0.04, 8, 6), std(gems[i], { roughness: 0.2 }), x, 0.64, z);
    add(g, new THREE.SphereGeometry(0.035, 8, 6), std(gems[(i + 2) % 5], { roughness: 0.2 }), Math.cos(a) * 0.3, 0.23, Math.sin(a) * 0.3);
  }
  return castAll(g);
}

// 雪だるま：2段の雪玉、にんじんの鼻、ボタン、黒い帽子
function buildSnowman() {
  const g = new THREE.Group();
  const snow = std(0xffffff, { roughness: 0.95 });
  add(g, new THREE.SphereGeometry(0.42, 20, 16), snow, 0, 0.4, 0);
  add(g, new THREE.SphereGeometry(0.3, 20, 16), snow, 0, 0.98, 0);
  add(g, new THREE.ConeGeometry(0.04, 0.22, 8), std(0xff8a1f), 0, 1.0, 0.33).rotation.x = Math.PI / 2;
  for (const s of [-1, 1]) add(g, new THREE.SphereGeometry(0.03, 8, 6), std(0x222222), s * 0.1, 1.08, 0.27);
  for (let i = 0; i < 3; i++) add(g, new THREE.SphereGeometry(0.04, 8, 6), std(0x222222), 0, 0.6 - i * 0.14, 0.4 - i * 0.03);
  add(g, new THREE.CylinderGeometry(0.2, 0.2, 0.04, 20), std(0x222233), 0, 1.24, 0);
  add(g, new THREE.CylinderGeometry(0.14, 0.14, 0.2, 20), std(0x222233), 0, 1.35, 0);
  add(g, new THREE.CylinderGeometry(0.145, 0.145, 0.04, 20), std(0xe03148), 0, 1.29, 0);
  return castAll(g);
}

Object.assign(ITEM_BUILDERS, { fishbowl: buildFishbowl, vase: buildVase, cardTower: buildCardTower, cat: buildCat, crown: buildCrown, snowman: buildSnowman });
