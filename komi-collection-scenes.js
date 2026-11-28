'use strict';
(() => {
const cards = [
  {
    "name": "Кэн Канэки",
    "series": "Токийский гуль",
    "rarity": "Легендарная",
    "rarityId": "legendary",
    "cropY": "0%",
    "description": "Кэн Канэки в полный рост. Стоит в дождливом переулке и поправляет чёрную маску.",
    "id": "kaneki",
    "portrait": "/assets/collection/live-scenes-v1/kaneki/portrait.webp"
  },
  {
    "name": "Монки Д. Луффи",
    "series": "One Piece",
    "rarity": "Эпическая",
    "rarityId": "epic",
    "cropY": "0%",
    "description": "Монки Д. Луффи в полный рост. Стоит на палубе и придерживает соломенную шляпу.",
    "id": "luffy",
    "portrait": "/assets/collection/live-scenes-v1/luffy/portrait.webp"
  },
  {
    "name": "Коми Сёко",
    "series": "У Коми проблемы с общением",
    "rarity": "Редкая",
    "rarityId": "rare",
    "cropY": "12%",
    "description": "Коми Сёко в полный рост. Стоит у окна в классе и прижимает блокнот к груди.",
    "id": "komi",
    "portrait": "/assets/collection/live-scenes-v1/komi/portrait.webp"
  }
];

const W = 768;
const H = 1024;
const TAU = Math.PI * 2;
const LOOP_SECONDS = 2.6;
const SCENE_SECONDS = 4.8;
const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const mix = (a, b, t) => a + (b - a) * t;
const ease = (a, b, value) => {
  const t = clamp((value - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const beat = (time, enter, apex, release, end) => ease(enter, apex, time) * (1 - ease(release, end, time));

function polygon(ctx, points) {
  ctx.beginPath();
  ctx.moveTo(...points[0]);
  for (const point of points.slice(1)) ctx.lineTo(...point);
  ctx.closePath();
}

function patch(ctx, art, shape, x, y, dx, dy, angle = 0) {
  ctx.save();
  polygon(ctx, shape);
  ctx.clip();
  ctx.translate(x + dx, y + dy);
  ctx.rotate(angle);
  ctx.drawImage(art, -x, -y, W, H);
  ctx.restore();
}

function dot(ctx, x, y, rx, ry, color) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
  ctx.fillStyle = color;
  ctx.fill();
}

function stroke(ctx, x, y, toX, toY, width, color) {
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(toX, toY);
  ctx.lineWidth = width;
  ctx.strokeStyle = color;
  ctx.stroke();
}

function base(ctx, img, zoom = 1, x = W / 2, y = H / 2) {
  ctx.setTransform(ctx.canvas.width / W, 0, 0, ctx.canvas.height / H, 0, 0);
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(zoom, zoom);
  ctx.drawImage(img, -x, -y, W, H);
  ctx.restore();
}

function rain(ctx, time, wide) {
  const cycle = (time % LOOP_SECONDS) / LOOP_SECONDS;
  for (let i = 0; i < (wide ? 68 : 29); i++) {
    const x = (i * 191 + 29) % W;
    const depth = (i % 5) / 5;
    const y = (((i * 0.173 + cycle * (i % 3 + 1)) % 1) * (H + 100)) - 50;
    const length = 10 + depth * 30;
    const warm = x < 175 && y > 115 && y < 480;
    stroke(ctx, x + y * 0.035, y, x + (y + length) * 0.035, y + length, 0.7 + depth * 1.2,
      warm ? `rgba(255,213,165,${0.13 + depth * 0.18})` : `rgba(179,206,220,${0.11 + depth * 0.22})`);
  }
  if (!wide) return;
  for (const [x, y, phase] of [[103, 854, 0.12], [689, 812, 0.68], [223, 956, 0.44], [580, 962, 0.91]]) {
    const t = (cycle * 2 + phase) % 1;
    ctx.beginPath();
    ctx.ellipse(x, y, 5 + 20 * t, 1 + t * 4, 0, 0, TAU);
    ctx.lineWidth = 1.3;
    ctx.strokeStyle = `rgba(207,219,217,${Math.sin(Math.PI * t) * 0.29})`;
    ctx.stroke();
  }
}

const kanekiHair = [[68, 29], [303, 0], [560, 3], [666, 115], [616, 172], [591, 121], [459, 101], [294, 84], [143, 109], [72, 81]];
const kanekiGrip = [[460, 405], [519, 393], [603, 418], [647, 501], [631, 570], [602, 640], [512, 616], [470, 554], [467, 496]];

function kanekiBlink(ctx, blink) {
  if (blink < 0.01) return;
  ctx.save();
  polygon(ctx, [[332, 326], [359, 316], [405, 314], [441, 319], [433, 339], [412, 352], [365, 350], [338, 341]]);
  ctx.clip();
  ctx.globalAlpha = blink;
  ctx.fillStyle = '#b19a89';
  ctx.fillRect(325, 308, 125, 51);
  ctx.beginPath();
  ctx.moveTo(334, 338);
  ctx.quadraticCurveTo(390, 352, 440, 327);
  ctx.strokeStyle = '#2c2222';
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.restore();
}

function kanekiPortrait(ctx, art, time, action, ambient = time) {
  base(ctx, art);
  const sway = Math.sin(time / LOOP_SECONDS * TAU);
  patch(ctx, art, kanekiHair, 310, 70, sway * 2.5, sway * 1.5, sway * 0.007);
  const grip = action ? beat(time, 0.18, 0.63, 0.87, 1.35) : 0;
  if (grip) patch(ctx, art, kanekiGrip, 510, 445, -5 * grip, -9 * grip, grip * -0.012);
  const blinkAt = action ? 1.48 : 1.7;
  kanekiBlink(ctx, beat(time, blinkAt - 0.11, blinkAt, blinkAt + 0.045, blinkAt + 0.16));

  if (action) {
    const drop = ease(0.76, 1.5, time);
    const light = beat(time, 0.98, 1.22, 1.36, 1.7);
    if (drop > 0 && drop < 1) {
      const y = 464 + 440 * drop * drop;
      dot(ctx, 621 + drop * 18, y, 3.9 - drop * 1.6, 4.4 + drop * 6, 'rgba(227,231,223,0.76)');
    }
    if (light) {
      ctx.save();
      polygon(ctx, [[388, 323], [423, 322], [420, 337], [409, 346], [391, 346]]);
      ctx.clip();
      dot(ctx, 409, 334, 18, 9, `rgba(208,71,54,${0.43 * light})`);
      dot(ctx, 415, 329, 3.1, 2.1, `rgba(255,225,180,${0.72 * light})`);
      ctx.restore();
    }
  } else {
    const crawl = ease(0.11, 1.48, time);
    const visible = beat(time, 0.11, 0.34, 1.26, 1.54);
    if (visible) {
      const x = 550 - crawl * 13;
      const y = 48 + crawl * 157;
      dot(ctx, x, y, 2.3, 4 + 3 * crawl, `rgba(54,71,83,${0.78 * visible})`);
      dot(ctx, x - 1.4, y - 2, 1.7, 3.1, `rgba(240,232,210,${0.87 * visible})`);
    }
  }
  rain(ctx, ambient, false);
}

const luffyBrim = [[537, 82], [641, 82], [720, 96], [765, 139], [768, 228], [743, 287], [697, 374], [647, 450], [607, 483], [634, 425], [674, 357], [691, 275], [655, 225], [604, 194], [562, 143]];
const luffyGrip = [[56, 119], [116, 57], [183, 43], [243, 69], [287, 110], [289, 155], [240, 184], [202, 230], [134, 260], [84, 241], [59, 200]];
const luffyVest = [[542, 701], [618, 721], [715, 795], [764, 869], [767, 1023], [662, 1024], [640, 940], [599, 832]];

function sea(ctx, time, horizon, ranges) {
  for (const [left, right] of ranges) {
    for (let i = 0; i < 13; i++) {
      const t = Math.sin((time / LOOP_SECONDS + i * 0.27) * TAU);
      const y = horizon + (i * 17) % 72;
      const x = left + ((i * 67) % Math.max(1, right - left - 27));
      stroke(ctx, x + 4 * t, y, Math.min(right, x + 8 + 17 * (i % 3) / 2 + 4 * t), y,
        1.4, `rgba(234,231,204,${0.10 + 0.1 * (t + 1)})`);
    }
  }
}

function luffyPortrait(ctx, art, time, action) {
  base(ctx, art);
  const gust = action ? beat(time, 0.04, 0.32, 0.54, 0.95) : beat(time, 0.10, 0.57, 0.72, 1.47);
  const cloth = Math.sin(time / LOOP_SECONDS * TAU);
  patch(ctx, art, luffyVest, 625, 825, cloth * 2, cloth * 2.5, cloth * 0.009);
  if (gust) {
    patch(ctx, art, luffyBrim, 564, 145, 0, -gust * 3.4, -gust * 0.043);
    const catchHat = ease(0.28, 0.43, time) * (1 - ease(0.56, 0.84, time));
    patch(ctx, art, luffyGrip, 189, 131, 4 * catchHat, -5 * catchHat, 0.017 * catchHat);
  }
  sea(ctx, time, 620, [[575, 768]]);
}

const komiHair = [[601, 457], [632, 437], [636, 566], [638, 622], [645, 690], [609, 694], [602, 652], [613, 598], [611, 526]];

function komiEyes(ctx, gaze) {
  if (gaze < 0.01) return;
  for (const left of [true, false]) {
    ctx.save();
    ctx.beginPath();
    if (left) {
      ctx.moveTo(269, 380);
      ctx.bezierCurveTo(321, 378, 366, 381, 402, 402);
      ctx.quadraticCurveTo(408, 409, 397, 418);
      ctx.lineTo(304, 418);
      ctx.quadraticCurveTo(283, 416, 269, 380);
    } else {
      ctx.moveTo(496, 412);
      ctx.bezierCurveTo(510, 387, 559, 385, 596, 390);
      ctx.quadraticCurveTo(584, 418, 571, 425);
      ctx.quadraticCurveTo(536, 427, 498, 423);
    }
    ctx.closePath();
    ctx.clip();
    ctx.globalAlpha = ease(0, 0.35, gaze);
    ctx.fillStyle = '#e9cdd2';
    ctx.fillRect(254, 374, 355, 58);
    ctx.fillStyle = '#b9a1b1';
    ctx.fillRect(254, 374, 355, left ? 18 : 30);
    const x = (left ? 352 : 532) + gaze * (left ? 1.5 : -2.8);
    const y = (left ? 384 : 388) - gaze * 8.7;
    dot(ctx, x, y, left ? 33 : 29, 46, '#2d2231');
    dot(ctx, x, y - 1, left ? 30 : 26, 44, '#47314d');
    dot(ctx, x, y + 26, left ? 22 : 19, 14, '#66446b');
    dot(ctx, x + 1.7, y + 6, 9.5, 17, '#2c2230');
    ctx.restore();
  }
}

function page(ctx, t, turn) {
  if (t < 0.006) return;
  const lift = turn ? Math.sin(Math.PI * t) : t;
  const edge = turn ? mix(552, 352, t) : 558;
  ctx.beginPath();
  ctx.moveTo(328, 584);
  ctx.quadraticCurveTo(421, 571 - 83 * lift, edge, 571 - 29 * lift);
  ctx.lineTo(mix(552, 356, turn ? t : 0), 574 - 18 * lift);
  ctx.quadraticCurveTo(428, 576 - 67 * lift, 334, 588);
  ctx.closePath();
  ctx.fillStyle = turn && t > 0.54 ? '#dfc9b4' : '#fff1d8';
  ctx.fill();
  ctx.strokeStyle = '#453b3f';
  ctx.lineWidth = 2.2;
  ctx.stroke();
}

function komiPortrait(ctx, art, time, action) {
  base(ctx, art);
  const hair = Math.sin(time / LOOP_SECONDS * TAU);
  patch(ctx, art, komiHair, 618, 554, hair * 2.1, 0, hair * 0.009);
  const lift = action ? ease(0.18, 1.03, time) : beat(time, 0.49, 0.89, 1.29, 2.15) * 0.28;
  const turn = action ? ease(0.11, 0.86, time) : 0;
  if (turn < 0.99) page(ctx, lift, action ? true : false);
  if (action) {
    const hold = beat(time, 0.66, 0.91, 1.13, 1.5);
    patch(ctx, art, [[478, 621], [550, 580], [597, 615], [629, 671], [608, 759], [547, 770], [500, 714]],
      552, 655, -5 * hold, -8 * hold, -0.018 * hold);
  }
  const gaze = action ? ease(0.83, 1.55, time) : beat(time, 0.89, 1.42, 1.78, 2.53);
  komiEyes(ctx, gaze);
}

function curtain(ctx, time) {
  const wave = Math.sin(time * 1.57);
  const edge = 696 + wave * 18;
  ctx.beginPath();
  ctx.moveTo(682, 0);
  ctx.lineTo(768, 0);
  ctx.lineTo(768, 488);
  ctx.quadraticCurveTo(edge + 27, 495, edge, 465);
  ctx.bezierCurveTo(edge + 40, 314, 655 - wave * 14, 170, 682, 0);
  ctx.fillStyle = 'rgba(237,204,188,0.72)';
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(710, 0);
  ctx.bezierCurveTo(682 - wave * 8, 175, edge + 63, 319, edge + 19, 474);
  ctx.quadraticCurveTo(edge + 24, 478, edge + 34, 482);
  ctx.bezierCurveTo(edge + 69, 310, 716 - wave * 4, 170, 727, 0);
  ctx.fillStyle = 'rgba(162,119,130,0.37)';
  ctx.fill();
}

function desk(ctx) {
  polygon(ctx, [[0, 772], [101, 804], [286, 933], [135, 1024], [0, 1024]]);
  ctx.fillStyle = '#966953';
  ctx.fill();
  ctx.strokeStyle = '#48353b';
  ctx.lineWidth = 4;
  ctx.stroke();
  polygon(ctx, [[0, 982], [258, 918], [286, 933], [135, 1024], [0, 1024]]);
  ctx.fillStyle = '#78534b';
  ctx.fill();
  stroke(ctx, 0, 792, 263, 931, 4, '#b48668');
}

function luffyLow(ctx, art, time) {
  base(ctx, art);
  const wind = Math.sin(time * 3.5);
  patch(ctx, art, [[74, 10], [224, 12], [281, 57], [244, 121], [191, 202], [204, 252], [242, 336], [215, 375], [67, 410]],
    136, 11, wind * 2, wind * 4, wind * 0.015);
  patch(ctx, art, [[480, 91], [573, 110], [608, 217], [633, 353], [640, 488], [611, 517], [517, 447], [528, 365], [491, 268]],
    549, 112, wind * -2, wind * 3, wind * -0.012);
}

function luffyTurn(ctx, art, time) {
  base(ctx, art);
  const breeze = Math.sin(time * 4);
  patch(ctx, art, [[188, 632], [255, 597], [314, 630], [387, 740], [414, 1023], [190, 1024]], 244, 707,
    breeze * 2.5, breeze * 2, breeze * 0.006);
  sea(ctx, time, 761, [[0, 128], [647, 767]]);
  if (time < 0.37) {
    const openness = time < 0.12 ? 0.29 : time < 0.24 ? 0.55 : 0.79;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(426, 346);
    ctx.quadraticCurveTo(515, 318, 554, 345);
    ctx.quadraticCurveTo(554, 405, 514, 411);
    ctx.quadraticCurveTo(453, 417, 426, 375);
    ctx.closePath();
    ctx.clip();
    ctx.fillStyle = '#fab073';
    ctx.fillRect(424, 328, 134, 90);
    ctx.translate(0, 350 * (1 - openness));
    ctx.scale(1, openness);
    ctx.drawImage(art, 424, 329, 134, 84, 424, 329, 134, 84);
    ctx.restore();
  }
}

const portraitAnimations = { kaneki: kanekiPortrait, luffy: luffyPortrait, komi: komiPortrait };

function drawPortrait(ctx, card, time) {
  portraitAnimations[card.id](ctx, card.image, time % LOOP_SECONDS, false);
}

function drawScene(ctx, card, assets, time, ambient, still) {
  if (time >= 3.2) {
    base(ctx, assets.final);
    if (!still && card.id === 'kaneki') rain(ctx, ambient, true);
    if (card.id === 'komi') curtain(ctx, still ? 0 : ambient);
    return;
  }

  if (time < 1.08) {
    if (card.id === 'luffy') {
      luffyLow(ctx, assets.low, time);
    } else if (card.id === 'komi') {
      base(ctx, assets.final);
      curtain(ctx, time);
      desk(ctx);
    } else {
      base(ctx, assets.final, 1 + ease(0, 1.08, time) * 0.086, 400, 308);
      rain(ctx, ambient, true);
    }
    return;
  }

  const actionTime = time - 1.08;
  if (card.id === 'luffy' && actionTime >= 1.03) {
    luffyTurn(ctx, assets.turn, actionTime - 1.03);
  } else {
    portraitAnimations[card.id](ctx, card.image, actionTime, true, ambient);
  }
}

const grid = document.querySelector('#grid');
const template = document.querySelector('#card-template');
const detail = document.querySelector('dialog');
const frame = detail.querySelector('.scene-frame');
const sceneContext = frame.getContext('2d', { alpha: false });
const detailName = detail.querySelector('.detail-name');
const detailSeries = detail.querySelector('.detail-series');
const detailRarity = detail.querySelector('.detail-rarity');
const status = detail.querySelector('.scene-status');
const skip = detail.querySelector('#skip');
const replay = detail.querySelector('#replay');
const sound = detail.querySelector('#sound');
const close = detail.querySelector('.close');
const animateCards = document.querySelector('#animate-cards');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const visibleCards = new Set();
const imageRequests = new Map();
let active = null;
let soundEnabled = false;
let animationFrame = 0;
let previousFrame = 0;
let previousDraw = 0;

function loadImage(url) {
  if (!imageRequests.has(url)) {
    const img = new Image();
    img.src = url;
    imageRequests.set(url, img.decode().then(() => img).catch(error => {
      imageRequests.delete(url);
      throw error;
    }));
  }
  return imageRequests.get(url);
}

const byCard = new Map();
const viewportObserver = new IntersectionObserver(entries => {
  for (const entry of entries) {
    const card = byCard.get(entry.target);
    if (entry.isIntersecting && entry.intersectionRatio > 0) visibleCards.add(card);
    else visibleCards.delete(card);
  }
  scheduleFrame();
});

for (const card of cards) {
  const item = template.content.cloneNode(true);
  const button = item.querySelector('.card');
  const poster = item.querySelector('.portrait');
  card.canvas = item.querySelector('.portrait-loop');
  card.context = card.canvas.getContext('2d', { alpha: false });
  card.time = 0;
  card.painted = false;
  card.image = null;
  button.dataset.rarity = card.rarityId;
  button.style.setProperty('--crop-y', card.cropY);
  grid.append(item);
  poster.src = card.portrait;
  card.ready = poster.decode().then(() => {
    card.image = poster;
    scheduleFrame();
    return poster;
  }).catch(() => null);
  button.querySelector('.rarity').textContent = card.rarity;
  button.querySelector('.character').textContent = card.name;
  button.querySelector('.series').textContent = card.series;
  button.addEventListener('click', () => openScene(card, button));
  viewportObserver.observe(button);
  byCard.set(button, card);
}

function setPlayback(state, message = '') {
  detail.dataset.playback = state;
  status.textContent = message;
  status.hidden = !message;
  skip.disabled = state !== 'playing';
  replay.disabled = state !== 'finished' && state !== 'error';
  sound.disabled = reduced.matches || (state !== 'playing' && state !== 'finished');
  syncAudio();
}

function showFinal(scene, staticMode = reduced.matches) {
  if (!scene.assets.final) return;
  scene.time = SCENE_SECONDS;
  scene.painted = true;
  setPlayback(staticMode ? 'reduced' : 'finished');
  drawScene(sceneContext, scene.card, scene.assets, SCENE_SECONDS, scene.ambient, staticMode);
  frame.classList.add('is-ready');
  scheduleFrame();
}

function play(scene) {
  scene.time = 0;
  scene.ambient = 0;
  scene.painted = true;
  drawScene(sceneContext, scene.card, scene.assets, 0, 0, false);
  frame.classList.add('is-ready');
  setPlayback('playing');
  scheduleFrame();
}

async function prepareScene(scene, autoplay) {
  const request = Symbol();
  scene.request = request;
  const current = () => active === scene && scene.request === request && detail.open;
  if (!scene.assets.final) {
    frame.classList.remove('is-ready');
    setPlayback('loading', 'Загружаем сцену…');
  }
  try {
    const folder = `/assets/collection/live-scenes-v1/${scene.card.id}`;
    scene.assets.final = await loadImage(`${folder}/final.webp`);
    if (!current()) return;
    if (reduced.matches) {
      showFinal(scene);
      return;
    }
    if (scene.card.id === 'luffy' && !scene.assets.low) {
      const [low, turn] = await Promise.all([
        loadImage(`${folder}/low.webp`), loadImage(`${folder}/turn.webp`)
      ]);
      scene.assets.low = low;
      scene.assets.turn = turn;
    }
    const portrait = await scene.card.ready;
    if (!current()) return;
    if (!portrait) throw new Error('Portrait unavailable');
    scene.assets.ready = true;
    if (!autoplay || reduced.matches) showFinal(scene);
    else play(scene);
  } catch {
    if (current()) setPlayback('error', 'Сцена не загрузилась. Нажмите «Повторить».');
  }
}

function openScene(card, trigger) {
  active = { card, trigger, assets: {}, time: 0, ambient: 0 };
  detailName.textContent = card.name;
  detailSeries.textContent = card.series;
  detailRarity.textContent = card.rarity;
  detailRarity.dataset.rarity = card.rarityId;
  frame.setAttribute('aria-label', card.description);
  stopFrame();
  detail.showModal();
  prepareScene(active, true);
}

close.addEventListener('click', () => detail.close());
detail.addEventListener('close', () => {
  if (detail.open) return;
  active?.trigger.focus({ preventScroll: true });
  active = null;
  stopFrame();
  syncAudio();
  scheduleFrame();
});
skip.addEventListener('click', () => {
  showFinal(active);
  replay.focus({ preventScroll: true });
});
replay.addEventListener('click', () => {
  if (active.assets.ready) {
    play(active);
    skip.focus({ preventScroll: true });
  } else {
    prepareScene(active, true);
    close.focus({ preventScroll: true });
  }
});

function needsFrame() {
  if (document.hidden || reduced.matches) return false;
  if (!detail.open) return animateCards.checked && [...visibleCards].some(card => card.image);
  return detail.dataset.playback === 'playing';
}

function stopFrame() {
  cancelAnimationFrame(animationFrame);
  animationFrame = 0;
  previousFrame = 0;
  previousDraw = 0;
}

function scheduleFrame() {
  if (!animationFrame && needsFrame()) animationFrame = requestAnimationFrame(tick);
}

function tick(now) {
  animationFrame = 0;
  if (!needsFrame()) {
    previousFrame = 0;
    previousDraw = 0;
    return;
  }
  const frameInterval = detail.open ? 1000 / 24 : 1000 / 16;
  if (!previousFrame) previousFrame = now;
  if (!previousDraw || now - previousDraw >= frameInterval - 1) {
    const dt = clamp((now - previousFrame) / 1000, 0, 0.12);
    previousFrame = now;
    previousDraw = now;
    if (detail.open) {
      active.ambient += dt;
      if (detail.dataset.playback === 'playing') {
        active.time = Math.min(SCENE_SECONDS, active.time + dt);
        if (active.time >= SCENE_SECONDS) {
          const skipHadFocus = document.activeElement === skip;
          showFinal(active);
          if (skipHadFocus) replay.focus({ preventScroll: true });
          return;
        }
      }
      drawScene(sceneContext, active.card, active.assets, active.time, active.ambient, false);
    } else {
      for (const card of visibleCards) {
        if (!card.image) continue;
        card.time = (card.time + dt) % LOOP_SECONDS;
        drawPortrait(card.context, card, card.time);
        if (!card.painted) {
          card.painted = true;
          card.canvas.classList.add('is-ready');
        }
      }
    }
  }
  scheduleFrame();
}

reduced.addEventListener('change', () => {
  animateCards.disabled = reduced.matches;
  stopFrame();
  if (active?.assets.final) {
    if (reduced.matches || active.assets.ready) showFinal(active);
    else prepareScene(active, false);
  }
  syncAudio();
  scheduleFrame();
});
animateCards.disabled = reduced.matches;
animateCards.addEventListener('change', () => {
  stopFrame();
  scheduleFrame();
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) stopFrame();
  syncAudio();
  scheduleFrame();
});

let audio;
let track;
const tones = {
  kaneki: { hz: 1520, gain: 0.16, q: 0.45 },
  luffy: { hz: 430, gain: 0.20, q: 0.75 },
  komi: { hz: 700, gain: 0.075, q: 0.46 }
};

function syncAudio() {
  const audible = detail.dataset.playback === 'playing' || detail.dataset.playback === 'finished';
  const listening = audio && soundEnabled && active && detail.open && audible && !reduced.matches && !document.hidden;
  const id = listening ? active.card.id : null;
  if (track?.id === id) return;
  if (track) {
    const { source, gain } = track;
    gain.gain.setTargetAtTime(0, audio.currentTime, 0.045);
    source.stop(audio.currentTime + 0.2);
    track = null;
  }
  if (!id) return;
  const length = audio.sampleRate * 2;
  const buffer = audio.createBuffer(1, length, audio.sampleRate);
  const samples = buffer.getChannelData(0);
  let noise = 0;
  for (let index = 0; index < length; index++) {
    noise = 0.65 * noise + (Math.random() * 2 - 1) * 0.35;
    samples[index] = noise;
  }
  const { hz, gain: level, q } = tones[id];
  const source = audio.createBufferSource();
  const filter = audio.createBiquadFilter();
  const gain = audio.createGain();
  source.buffer = buffer;
  source.loop = true;
  filter.type = 'lowpass';
  filter.frequency.value = hz;
  filter.Q.value = q;
  gain.gain.value = 0;
  source.connect(filter).connect(gain).connect(audio.destination);
  gain.gain.setTargetAtTime(level, audio.currentTime, 0.18);
  source.start();
  track = { id, source, gain };
}

sound.addEventListener('click', async () => {
  soundEnabled = !soundEnabled;
  if (soundEnabled) {
    try {
      audio ??= new AudioContext();
      await audio.resume();
    } catch {
      soundEnabled = false;
    }
  }
  sound.setAttribute('aria-pressed', String(soundEnabled));
  sound.textContent = soundEnabled ? 'Звук вкл.' : 'Звук выкл.';
  syncAudio();
});

})();
