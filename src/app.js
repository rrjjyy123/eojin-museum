/* ══════════════════════════════════════════════════════════
   온라인 어진 박물관
   ══════════════════════════════════════════════════════════ */
(function () {
'use strict';

const T = window.THREE;
const $ = (s) => document.querySelector(s);
const el = (t, c, p) => { const n = document.createElement(t); if (c) n.className = c; if (p) p.appendChild(n); return n; };
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ─── 공간 치수 ─────────────────────────────────────── */
const WALL_H = 4.4, EYE = 1.58, MARGIN = 0.5;
const RECTS = [
  { id:'lobby', x:[-10,10],     z:[6,24]    },
  { id:'c1',    x:[-2.2,2.2],   z:[-1,7]    },
  { id:'hall',  x:[-13.5,13.5], z:[-15,0]   },
  { id:'c2',    x:[-2.2,2.2],   z:[-22,-14] },
  { id:'sp',    x:[-15,15],     z:[-37,-21] }
];


/* ─── 상태 ──────────────────────────────────────────── */
const S = {
  room: 'lobby',
  near: null,
  yaw: 0.95, pitch: 0,
  pos: new T.Vector3(5, EYE, 18),
  move: { f:0, s:0 }
};

/* ─── 이미지 로딩 ───────────────────────────────────── */
const IMG = {};
const TEX = {};

function loadAll(onProgress) {
  const keys = Object.keys(ASSETS);
  let done = 0;
  return Promise.all(keys.map(k => new Promise(res => {
    const im = new Image();
    im.onload = im.onerror = () => { IMG[k] = im; done++; onProgress(done / keys.length); res(); };
    im.src = ASSETS[k];
  })));
}

function tex(key) {
  if (TEX[key]) return TEX[key];
  const t = new T.Texture(IMG[key]);
  t.colorSpace = T.SRGBColorSpace;
  t.anisotropy = Math.min(4, maxAniso);
  t.minFilter = T.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.needsUpdate = true;
  TEX[key] = t;
  return t;
}

/* ─── 렌더러 ────────────────────────────────────────── */
const canvas = $('#stage');
const renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
renderer.outputColorSpace = T.SRGBColorSpace;
const maxAniso = renderer.capabilities.getMaxAnisotropy();

const scene = new T.Scene();
scene.background = new T.Color(0x0b0d0f);
scene.fog = new T.Fog(0x0b0d0f, 26, 62);

const camera = new T.PerspectiveCamera(64, 1, 0.08, 140);
camera.rotation.order = 'YXZ';

function resize() {
  const w = window.innerWidth, h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.fov = w < 620 ? 72 : 64;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);

/* ─── 재질 ──────────────────────────────────────────── */
const MAT = {
  wall:    new T.MeshLambertMaterial({ color: 0x4c525a }),
  wallSp:  new T.MeshLambertMaterial({ color: 0x3c332d }),
  floor:   new T.MeshLambertMaterial({ color: 0x2b2f34 }),
  floorSp: new T.MeshLambertMaterial({ color: 0x241e1b }),
  ceil:    new T.MeshLambertMaterial({ color: 0x1b1e21 }),
  frame:   new T.MeshLambertMaterial({ color: 0x0d0e10 }),
  door:    new T.MeshLambertMaterial({ color: 0x3a2f27 })
};

/* ─── 기하 도우미 ───────────────────────────────────── */
function box(w, h, d, mat, x, y, z) {
  const m = new T.Mesh(new T.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  scene.add(m);
  return m;
}
// 벽: (x1,z1)-(x2,z2) 선분을 두께 0.3 벽으로
function wall(x1, z1, x2, z2, mat) {
  const dx = x2 - x1, dz = z2 - z1;
  const len = Math.hypot(dx, dz);
  if (len < 0.01) return;
  const m = new T.Mesh(new T.BoxGeometry(len, WALL_H, 0.3), mat || MAT.wall);
  m.position.set((x1 + x2) / 2, WALL_H / 2, (z1 + z2) / 2);
  m.rotation.y = -Math.atan2(dz, dx);
  scene.add(m);
}
function slab(x1, z1, x2, z2, y, mat) {
  const g = new T.PlaneGeometry(Math.abs(x2 - x1), Math.abs(z2 - z1));
  const m = new T.Mesh(g, mat);
  m.rotation.x = y > 2 ? Math.PI / 2 : -Math.PI / 2;
  m.position.set((x1 + x2) / 2, y, (z1 + z2) / 2);
  scene.add(m);
}

/* 캔버스 텍스트 패널 */
function textPanel(lines, opt) {
  opt = opt || {};
  const W = opt.W || 1024, H = opt.H || 512;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = opt.bg || '#16181b'; g.fillRect(0, 0, W, H);
  if (opt.rule) { g.fillStyle = opt.rule; g.fillRect(64, 96, 120, 3); }
  let y = opt.top || 150;
  lines.forEach(ln => {
    g.font = `${ln.w || 400} ${ln.s || 34}px "Gowun Batang", serif`;
    g.fillStyle = ln.c || '#d8dcd9';
    g.textAlign = opt.align || 'left';
    const x = opt.align === 'center' ? W / 2 : 64;
    g.fillText(ln.t, x, y);
    y += (ln.gap || (ln.s || 34) * 1.55);
  });
  const t = new T.CanvasTexture(c);
  t.colorSpace = T.SRGBColorSpace;
  return t;
}
function panelMesh(texture, w, h, x, y, z, ry) {
  const m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshBasicMaterial({ map: texture }));
  m.position.set(x, y, z); m.rotation.y = ry || 0;
  scene.add(m);
  return m;
}

/* ─── 건물 짓기 (통로 개구부 반영) ─────────────────── */
function buildRooms() {
  const W = MAT.wall, WS = MAT.wallSp;

  const zones = [
    { x:[-10,10],    z:[6,24],    f:MAT.floor   },
    { x:[-2.2,2.2],  z:[0,6],     f:MAT.floor   },
    { x:[-13.5,13.5],z:[-15,0],   f:MAT.floor   },
    { x:[-2.2,2.2],  z:[-21,-15], f:MAT.floorSp },
    { x:[-15,15],    z:[-37,-21], f:MAT.floorSp }
  ];
  zones.forEach(zn => {
    slab(zn.x[0], zn.z[0], zn.x[1], zn.z[1], 0, zn.f);
    slab(zn.x[0], zn.z[0], zn.x[1], zn.z[1], WALL_H, MAT.ceil);
  });

  const side = (x, z0, z1, m) => wall(x, z0, x, z1, m);
  side(-10, 6, 24, W);        side(10, 6, 24, W);
  side(-2.2, 0, 6, W);        side(2.2, 0, 6, W);
  side(-13.5, -15, 0, W);     side(13.5, -15, 0, W);
  side(-2.2, -21, -15, WS);   side(2.2, -21, -15, WS);
  side(-15, -37, -21, WS);    side(15, -37, -21, WS);

  const cross = (z, x0, x1, m) => { wall(x0, z, -2.2, z, m); wall(2.2, z, x1, z, m); };
  wall(-10, 24, 10, 24, W);            // 로비 입구벽
  cross(6, -10, 10, W);
  cross(0, -13.5, 13.5, W);
  cross(-15, -13.5, 13.5, W);
  cross(-21, -15, 15, WS);
  wall(-15, -37, 15, -37, WS);         // 특별관 안쪽 끝
}

/* ─── 바닥 유도선 ──────────────────────────────────── */
function buildGuide() {
  const segs = [[22, 6.4], [6.4, -0.4], [-0.4, -14.6], [-14.6, -21.4], [-21.4, -35]];
  const mat = new T.MeshBasicMaterial({ color: 0xc8a24e, transparent: true, opacity: 0.16 });
  segs.forEach(([z0, z1]) => {
    const g = new T.Mesh(new T.PlaneGeometry(0.16, Math.abs(z0 - z1)), mat);
    g.rotation.x = -Math.PI / 2;
    g.position.set(0, 0.015, (z0 + z1) / 2);
    scene.add(g);
  });
}

/* ─── 조명 ──────────────────────────────────────────── */
function buildLights() {
  scene.add(new T.AmbientLight(0xffffff, 0.62));
  scene.add(new T.HemisphereLight(0xd6dcda, 0x14171a, 0.5));
  const lamps = [
    [0, 3.7, 19, 0xfff2dc, 42, 26],
    [0, 3.7, 12, 0xfff2dc, 48, 28],
    [0, 3.7, 3, 0xfff2dc, 22, 16],
    [-9.5, 3.7, -3, 0xfff4e2, 46, 24],
    [9.5, 3.7, -3, 0xfff4e2, 46, 24],
    [-9.5, 3.7, -10, 0xfff4e2, 58, 26],
    [0, 3.7, -8, 0xfff4e2, 40, 22],
    [9.5, 3.7, -10, 0xfff4e2, 58, 26],
    [0, 3.6, -18, 0xffd9b0, 20, 15],
    [-9, 3.6, -23, 0xffc48c, 40, 24],
    [9, 3.6, -23, 0xffc48c, 40, 24],
    [-9, 3.6, -29, 0xffc48c, 40, 24],
    [9, 3.6, -29, 0xffc48c, 40, 24],
    [-9, 3.6, -34.5, 0xffb87a, 36, 22],
    [9, 3.6, -34.5, 0xffb87a, 36, 22],
    [0, 3.6, -33, 0xffb87a, 30, 22]
  ];
  const fixGeo = new T.CircleGeometry(0.26, 16);
  const fixMat = new T.MeshBasicMaterial({ color: 0xfff0d8 });
  lamps.forEach(([x, y, z, c, i, d]) => {
    const L = new T.PointLight(c, i, d, 2);
    L.position.set(x, y, z);
    scene.add(L);
    const f = new T.Mesh(fixGeo, fixMat);
    f.rotation.x = Math.PI / 2;
    f.position.set(x, WALL_H - 0.02, z);
    scene.add(f);
  });
}

/* ─── 작품 배치 ─────────────────────────────────────── */
const artObjects = [];   // {data, mesh, pos:Vector3, normal:Vector3, view:{x,z,yaw}}

function hangArt(data, x, z, ry, maxH, maxW) {
  const im = IMG[data.img];
  const ar = (im && im.naturalWidth) ? im.naturalWidth / im.naturalHeight : 0.7;
  let h = maxH, w = h * ar;
  if (maxW && w > maxW) { w = maxW; h = w / ar; }
  const cy = Math.min(h / 2 + 1.05, 4.05 - h / 2);
  const n = new T.Vector3(Math.sin(ry), 0, Math.cos(ry));

  const fr = new T.Mesh(new T.BoxGeometry(w + 0.18, h + 0.18, 0.1), MAT.frame);
  fr.position.set(x, cy, z); fr.rotation.y = ry; scene.add(fr);

  const m = new T.Mesh(new T.PlaneGeometry(w, h),
    new T.MeshBasicMaterial({ map: tex(data.img) }));
  m.position.set(x + n.x * 0.07, cy, z + n.z * 0.07);
  m.rotation.y = ry;
  scene.add(m);

  // 벽에 붙은 작은 실물 라벨
  const lab = textPanel([
    { t: data.name, s: 40, c: '#e6e9e6' },
    { t: data.king + ' · ' + data.place, s: 27, c: '#959e9b' }
  ], { W: 640, H: 180, top: 66, bg: '#101315' });
  panelMesh(lab, 1.15, 0.32, x + n.x * 0.09, cy - h / 2 - 0.3, z + n.z * 0.09, ry);

  const viewDist = 2.9;
  artObjects.push({
    data, pos: new T.Vector3(x, cy, z), normal: n,
    view: { x: x + n.x * viewDist, z: z + n.z * viewDist, yaw: ry }
  });
}

function buildArt() {
  // 제1전시실 — 여섯 점을 한 벽에. 가운데는 특별관으로 가는 문.
  const wallZ = -14.82;
  const xs = [-11.2, -7.5, -3.8, 3.8, 7.5, 11.2];
  ART.forEach((a, i) => hangArt(a, xs[i], wallZ, 0, 2.9, 2.6));

  // 특별관 — 좌우 벽에 일곱 점씩
  const zs = [-22.8, -24.9, -27.0, -29.1, -31.2, -33.3, -35.4];
  SPECIAL.forEach((a, i) => {
    const left = i < 7;
    hangArt(a, left ? -14.82 : 14.82, zs[i % 7], left ? Math.PI / 2 : -Math.PI / 2, 2.3, 2.0);
  });
}

/* ─── 계보의 방 벽 ──────────────────────────────────── */
let lineageTex, lineageMesh;
const LIN = { W: 2048, H: 560, cols: 9, rows: 3 };

function drawLineage() {
  const c = lineageTex.image, g = c.getContext('2d');
  const cw = LIN.W / LIN.cols, ch = (LIN.H - 96) / LIN.rows;
  g.fillStyle = '#191c1f'; g.fillRect(0, 0, LIN.W, LIN.H);

  g.fillStyle = '#8d9693';
  g.font = '500 30px "IBM Plex Sans KR", sans-serif';
  g.fillText('조선의 임금  스물일곱 분', 26, 52);
  g.fillStyle = '#2a2f33'; g.fillRect(0, 74, LIN.W, 2);

  for (let i = 0; i < 27; i++) {
    const col = i % LIN.cols, row = (i / LIN.cols) | 0;
    const x = col * cw + 10, y = 96 + row * ch + 6;
    const w = cw - 20, h = ch - 12;

    g.fillStyle = '#131619';
    g.fillRect(x, y, w, h);
    g.strokeStyle = '#262b2e';
    g.lineWidth = 2;
    g.strokeRect(x + 1, y + 1, w - 2, h - 2);

    g.font = '500 26px "IBM Plex Sans KR", sans-serif';
    g.fillStyle = '#8b9491';
    g.textAlign = 'center';
    g.fillText((i + 1) + '  ' + KINGS[i], x + w / 2, y + h / 2 + 10);
    g.textAlign = 'left';
  }
  lineageTex.needsUpdate = true;
}

function buildLobby() {
  const c = document.createElement('canvas'); c.width = LIN.W; c.height = LIN.H;
  lineageTex = new T.CanvasTexture(c);
  lineageTex.colorSpace = T.SRGBColorSpace;
  drawLineage();
  lineageMesh = panelMesh(lineageTex, 15.4, 4.2, -9.83, 2.25, 15, Math.PI / 2);

  // 반대편 안내 패널
  panelMesh(textPanel([
    { t: '온라인 어진 박물관', s: 62, c: '#e8ebe8' },
    { t: '어진(御眞)은 임금의 초상화입니다.', s: 34, c: '#a9b1ae' },
    { t: '조선에는 임금이 스물일곱 분 계셨습니다.', s: 34, c: '#a9b1ae' },
    { t: '그런데 지금 우리가 볼 수 있는 얼굴은', s: 34, c: '#a9b1ae' },
    { t: '몇 분일까요?', s: 34, c: '#c8a24e' }
  ], { W: 1024, H: 560, top: 150, rule: '#c8a24e' }), 6.4, 3.5, 9.83, 2.2, 15, -Math.PI / 2);

  // 입구 안내
  panelMesh(textPanel([
    { t: '앞쪽으로 걸어가면 전시실이 이어집니다', s: 36, c: '#98a09d' }
  ], { W: 1024, H: 128, top: 78, bg: '#111417', align: 'center' }), 5.2, 0.65, 0, 3.4, 5.86, 0);
}

/* ─── 전시실 안내 패널 ──────────────────────────────── */
function buildSigns() {
  const sign = (title, sub, x, z, ry, w) => panelMesh(
    textPanel([{ t: title, s: 54, c: '#e9ece9' }, { t: sub, s: 28, c: '#98a19e' }],
      { W: 1024, H: 220, top: 84, bg: '#191d21' }), w || 4.6, (w || 4.6) / 4.6, x, 3.15, z, ry);

  sign('제1전시실  어진 전시실', '지금 남아 있는 어진', -2.03, 3.2, Math.PI / 2, 3.9);
  sign('특별관  1954, 불에 탄 얼굴들', '화재로 훼손된 어진', -2.03, -18, Math.PI / 2, 3.9);

  // 특별관 정면 대형 패널
  panelMesh(textPanel([
    { t: '1954년 12월 26일', s: 62, c: '#e6b183' },
    { t: '부산 동광동', s: 44, c: '#c9917a' },
    { t: '한국전쟁이 끝난 이듬해인 1954년 12월 26일,', s: 31, c: '#a89a92' },
    { t: '어진 마흔여덟 점을 비롯한 궁중문화재 4천여 점이', s: 31, c: '#a89a92' },
    { t: '보관되어 있던 부산시 동광동 부산국악원 창고에', s: 31, c: '#a89a92' },
    { t: '화재가 발생하였습니다.', s: 31, c: '#a89a92' },
    { t: '궁중문화재 3천4백여 점이 소실되었으며', s: 31, c: '#d8c3b4' },
    { t: '상당수의 어진도 이때 소실되거나 훼손되었습니다.', s: 31, c: '#e6b183' }
  ], { W: 1200, H: 700, top: 128, bg: '#1c1613', rule: '#c9714a' }), 8.6, 5.0, 0, 2.55, -36.8, 0);
}

/* ─── 충돌 & 이동 ───────────────────────────────────── */
function walkable(x, z) {
  for (const r of RECTS) {
    if (x > r.x[0] + MARGIN && x < r.x[1] - MARGIN &&
        z > r.z[0] + MARGIN && z < r.z[1] - MARGIN) return true;
  }
  return false;
}
function tryMove(dx, dz) {
  const p = S.pos;
  if (walkable(p.x + dx, p.z + dz)) { p.x += dx; p.z += dz; return; }
  if (walkable(p.x + dx, p.z)) { p.x += dx; return; }
  if (walkable(p.x, p.z + dz)) { p.z += dz; }
}
function currentRoom() {
  const z = S.pos.z;
  if (z >= 5) return 'lobby';
  if (z >= -16) return 'hall';
  return 'sp';
}

/* ─── 입력 ──────────────────────────────────────────── */
const keys = {};
addEventListener('keydown', e => {
  if (e.repeat) return;
  keys[e.code] = true;
  if (e.code === 'Escape') closeViewer();
});
addEventListener('keyup', e => { keys[e.code] = false; });

const stick = { active: false, id: null, ox: 0, oy: 0, dx: 0, dy: 0 };
const look = { id: null, lx: 0, ly: 0 };
const stickEl = $('#stick'), knobEl = $('#knob');

function isUI(t) { return !!(t.closest && t.closest('.ui')); }

canvas.parentElement.addEventListener('pointerdown', e => {
  if (isUI(e.target)) return;
  const half = window.innerWidth * 0.5;
  if (e.pointerType !== 'mouse' && e.clientX < half && stick.id === null) {
    stick.id = e.pointerId; stick.active = true;
    stick.ox = e.clientX; stick.oy = e.clientY; stick.dx = stick.dy = 0;
    stickEl.style.left = e.clientX + 'px'; stickEl.style.top = e.clientY + 'px';
    stickEl.classList.add('on');
  } else if (look.id === null) {
    look.id = e.pointerId; look.lx = e.clientX; look.ly = e.clientY;
  }
  e.target.setPointerCapture && e.target.setPointerCapture(e.pointerId);
}, { passive: true });

addEventListener('pointermove', e => {
  if (e.pointerId === stick.id) {
    const dx = e.clientX - stick.ox, dy = e.clientY - stick.oy;
    const R = 52, len = Math.hypot(dx, dy), k = len > R ? R / len : 1;
    stick.dx = dx * k / R; stick.dy = dy * k / R;
    knobEl.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
  } else if (e.pointerId === look.id) {
    const sp = 0.0045;
    S.yaw -= (e.clientX - look.lx) * sp;
    S.pitch -= (e.clientY - look.ly) * sp;
    S.pitch = Math.max(-0.85, Math.min(0.85, S.pitch));
    look.lx = e.clientX; look.ly = e.clientY;
  }
}, { passive: true });

function endPointer(e) {
  if (e.pointerId === stick.id) {
    stick.id = null; stick.active = false; stick.dx = stick.dy = 0;
    stickEl.classList.remove('on'); knobEl.style.transform = '';
  }
  if (e.pointerId === look.id) look.id = null;
}
addEventListener('pointerup', endPointer);
addEventListener('pointercancel', endPointer);

/* ─── 명패 UI ───────────────────────────────────────── */
const plate = $('#plate');
function renderPlate(a) {
  const [label, cls] = STATE_LABEL[a.state];
  plate.innerHTML = `
    <div class="pl-top">
      <div>
        <div class="pl-name">${a.name}</div>
        <div class="pl-sub">${a.king}${a.sub ? ' · ' + a.sub : ''}</div>
      </div>
      <span class="pill p-${cls}">${label}</span>
    </div>
    <div class="pl-grid">
      <span>그려진 때</span><b>${a.year}</b>
      <span>그린 사람</span><b>${a.maker}</b>
      <span>지금 있는 곳</span><b>${a.place}${a.desig !== '—' ? ' · ' + a.desig : ''}</b>
      <span>보이는 것</span><b>${a.look.join(' · ')}</b>
    </div>
    <button class="pl-more ui" type="button">자세히 보기</button>`;
  plate.querySelector('.pl-more').addEventListener('click', () => openViewer(a));
  plate.classList.add('on');
}

function updateNear() {
  const fwd = new T.Vector3(-Math.sin(S.yaw), 0, -Math.cos(S.yaw));
  let best = null, bestD = 5.2;
  for (const o of artObjects) {
    const d = Math.hypot(o.pos.x - S.pos.x, o.pos.z - S.pos.z);
    if (d > bestD) continue;
    const to = new T.Vector3(o.pos.x - S.pos.x, 0, o.pos.z - S.pos.z).normalize();
    if (to.dot(fwd) < 0.35) continue;
    if (o.normal.dot(to) > -0.25) continue;   // 그림 뒷면이면 제외
    best = o; bestD = d;
  }
  const id = best ? best.data.id : null;
  if (id !== S.near) {
    S.near = id;
    if (best) renderPlate(best.data); else plate.classList.remove('on');
  }
}

/* ─── 자세히 보기 ───────────────────────────────────── */
const viewer = $('#viewer');
const vImg = $('#vImg');
const vz = { s: 1, x: 0, y: 0, drag: false, px: 0, py: 0, pinch: 0 };

function applyZoom() {
  vImg.style.transform = `translate(${vz.x}px, ${vz.y}px) scale(${vz.s})`;
}
function setView(src) {
  vImg.src = ASSETS[src];
  vz.s = 1; vz.x = 0; vz.y = 0; applyZoom();
}
function openViewer(a) {
  const [label, cls] = STATE_LABEL[a.state];
  $('#vTitle').textContent = a.name;
  $('#vMeta').innerHTML = `${a.king} · ${a.place} <span class="pill p-${cls}">${label}</span>`;
  $('#vStory').innerHTML = a.story.map(s => `<p>${s}</p>`).join('') +
    (a.facts ? `<p class="vfact">${a.facts}</p>` : '');
  const tabs = $('#vTabs');
  tabs.innerHTML = '';
  a.views.forEach(([key, name], i) => {
    const b = el('button', 'vtab ui', tabs);
    b.type = 'button'; b.textContent = name;
    if (i === 0) b.classList.add('on');
    b.addEventListener('click', () => {
      tabs.querySelectorAll('.vtab').forEach(x => x.classList.remove('on'));
      b.classList.add('on'); setView(key);
    });
  });
  tabs.style.display = a.views.length > 1 ? '' : 'none';
  setView(a.views[0][0]);
  viewer.classList.add('on');
}
function closeViewer() { viewer.classList.remove('on'); }
$('#vClose').addEventListener('click', closeViewer);
viewer.addEventListener('click', e => { if (e.target === viewer) closeViewer(); });

const vStageEl = $('#vStage');
vStageEl.addEventListener('wheel', e => {
  e.preventDefault();
  vz.s = Math.max(1, Math.min(6, vz.s * (e.deltaY < 0 ? 1.18 : 1 / 1.18)));
  if (vz.s === 1) { vz.x = 0; vz.y = 0; }
  applyZoom();
}, { passive: false });

let vPointers = new Map();
vStageEl.addEventListener('pointerdown', e => {
  vPointers.set(e.pointerId, [e.clientX, e.clientY]);
  vz.drag = true; vz.px = e.clientX; vz.py = e.clientY;
  vStageEl.setPointerCapture(e.pointerId);
});
vStageEl.addEventListener('pointermove', e => {
  if (!vPointers.has(e.pointerId)) return;
  vPointers.set(e.pointerId, [e.clientX, e.clientY]);
  if (vPointers.size === 2) {
    const [a, b] = [...vPointers.values()];
    const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
    if (vz.pinch) { vz.s = Math.max(1, Math.min(6, vz.s * (d / vz.pinch))); applyZoom(); }
    vz.pinch = d;
  } else if (vz.drag && vz.s > 1) {
    vz.x += e.clientX - vz.px; vz.y += e.clientY - vz.py;
    vz.px = e.clientX; vz.py = e.clientY; applyZoom();
  }
});
function vEnd(e) { vPointers.delete(e.pointerId); if (vPointers.size < 2) vz.pinch = 0; if (!vPointers.size) vz.drag = false; }
vStageEl.addEventListener('pointerup', vEnd);
vStageEl.addEventListener('pointercancel', vEnd);
$('#vZoomIn').addEventListener('click', () => { vz.s = Math.min(6, vz.s * 1.4); applyZoom(); });
$('#vZoomOut').addEventListener('click', () => { vz.s = Math.max(1, vz.s / 1.4); if (vz.s === 1) { vz.x = 0; vz.y = 0; } applyZoom(); });

/* ─── 전시실 목록 / 순간이동 ────────────────────────── */
const roomList = $('#rooms');
function syncRoomList() {
  roomList.querySelectorAll('.rm').forEach(b => {
    b.classList.toggle('cur', b.dataset.id === S.room);
  });
}
function buildRoomList() {
  ROOMS.forEach(r => {
    const b = el('button', 'rm ui', roomList);
    b.type = 'button'; b.dataset.id = r.id; b.title = r.name;
    b.innerHTML = `<i class="rm-dot"></i><span class="rm-txt">
      <b>${r.name}</b><span class="rm-sub">${r.sub}</span></span>`;
    b.addEventListener('click', () => {
      S.pos.set(r.spawn[0], EYE, r.spawn[1]);
      S.yaw = r.spawn[2]; S.pitch = 0;
      closePanels();
    });
  });
  syncRoomList();
}

/* ─── 작품 앞으로 이동 ──────────────────────────────── */
function gotoArt(id) {
  const o = artObjects.find(a => a.data.id === id);
  if (!o) return;
  S.pos.set(o.view.x, EYE, o.view.z);
  S.yaw = o.view.yaw; S.pitch = 0;
  closePanels();
}
/* ─── 패널 토글 ─────────────────────────────────────── */
function closePanels() {
  document.querySelectorAll('.sheet').forEach(s => s.classList.remove('on'));
  $('#intro').classList.remove('on');
}
function toggle(sel) {
  const n = $(sel), was = n.classList.contains('on');
  closePanels();
  if (!was) n.classList.add('on');
}
$('#helpBtn').addEventListener('click', () => toggle('#helpSheet'));
document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', closePanels));

/* 토스트 */
let toastTimer;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg; t.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('on'), 2200);
}

/* ─── 루프 ──────────────────────────────────────────── */
const clock = new T.Clock();
let bob = 0;

function frame() {
  requestAnimationFrame(frame);
  const dt = Math.min(clock.getDelta(), 0.05);

  let f = 0, s = 0;
  if (keys.KeyW || keys.ArrowUp) f += 1;
  if (keys.KeyS || keys.ArrowDown) f -= 1;
  if (keys.KeyA || keys.ArrowLeft) s -= 1;
  if (keys.KeyD || keys.ArrowRight) s += 1;
  if (stick.active) { f -= stick.dy; s += stick.dx; }
  const mag = Math.hypot(f, s);
  if (mag > 1) { f /= mag; s /= mag; }

  const SPEED = 3.4;
  if (mag > 0.02) {
    const sinY = Math.sin(S.yaw), cosY = Math.cos(S.yaw);
    const dx = (-sinY * f + cosY * s) * SPEED * dt;
    const dz = (-cosY * f - sinY * s) * SPEED * dt;
    tryMove(dx, dz);
    if (!REDUCED) bob += dt * 9 * Math.min(1, mag);
  }

  camera.position.set(S.pos.x, EYE + (REDUCED ? 0 : Math.sin(bob) * 0.022), S.pos.z);
  camera.rotation.set(S.pitch, S.yaw, 0);

  const r = currentRoom();
  if (r !== S.room) {
    S.room = r;
    const rd = ROOMS.find(x => x.id === r);
    $('#hereName').textContent = rd.name;
    $('#hereSub').textContent = rd.sub;
    syncRoomList();
  }
  updateNear();
  renderer.render(scene, camera);
}

/* ─── 시작 ──────────────────────────────────────────── */
function start() {
  resize();
  buildRooms();
  buildLights();
  buildGuide();
  buildGuide();
  buildLobby();
  buildSigns();
  buildArt();
  buildRoomList();
  $('#hereName').textContent = '계보의 방';
  $('#hereSub').textContent = ROOMS[0].sub;
  frame();
}

const bar = $('#bar');
document.fonts.ready.then(() => loadAll(p => { bar.style.width = (p * 100).toFixed(0) + '%'; }))
  .then(() => {
    start();
    setTimeout(() => {
      $('#loading').classList.add('gone');
      $('#intro').classList.add('on');
    }, 250);
  })
  .catch(err => {
    $('#loading').innerHTML = '<p style="color:#e0755e">자료를 불러오지 못했습니다.<br>새로고침해 주세요.</p>';
    console.error(err);
  });

$('#introStart').addEventListener('click', closePanels);

/* 외부 제어 훅 */
window.museum = {
  state: S,
  go: gotoArt,
  room: (id) => { const r = ROOMS.find(x => x.id === id); if (r) { S.pos.set(r.spawn[0], EYE, r.spawn[1]); S.yaw = r.spawn[2]; } },
  at: (x, z, yaw) => { S.pos.set(x, EYE, z); if (yaw !== undefined) S.yaw = yaw; },
  arts: artObjects
};

})();
