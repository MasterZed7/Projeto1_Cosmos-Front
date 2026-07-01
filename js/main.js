// ============================================================
// Space Shooter Arcade — Arquitetura "Hitbox Decoupled"
// Física (hitbox) e Arte (sprite) são objetos independentes.
// ============================================================

const DEBUG_MODE = true;
const SENHA_TECH_LEAD = '2103';

// --- Catálogo de operadores ---
const CHARACTERS = {
  christopher: {
    id: 'christopher',
    nome: 'Christopher',
    src: './assets/nave_Chris.png',
    fallbackColor: '#e94560',
    isPrivado: true,
    hpMax: 100,
    combustivelMax: 100,
    municaoMax: 50,
    velocidadeBase: 3,
    gastoCombustivel: 0.05,
    arma: { tipo: 'percentual', multiplicador: 0.5 },
    temNitro: true,
    velocidadeNitro: 8,
    custoNitro: 0.2,
  },
  henri: {
    id: 'henri',
    nome: 'Henri',
    src: './assets/henri_sprite.png',
    fallbackColor: '#4ecdc4',
    isPrivado: false,
    hpMax: 75,
    combustivelMax: 100,
    municaoMax: 40,
    velocidadeBase: 5,
    gastoCombustivel: 0.07,
    arma: { tipo: 'fixo', dano: 18 },
    temNitro: false,
  },
  isaque: {
    id: 'isaque',
    nome: 'Isaque',
    src: './assets/isaque_sprite.png',
    fallbackColor: '#ffe66d',
    isPrivado: false,
    hpMax: 90,
    combustivelMax: 100,
    municaoMax: 45,
    velocidadeBase: 4,
    gastoCombustivel: 0.055,
    arma: { tipo: 'fixo', dano: 15 },
    temNitro: false,
  },
  guilherme: {
    id: 'guilherme',
    nome: 'Guilherme',
    src: './assets/guilherme_sprite.png',
    fallbackColor: '#a29bfe',
    isPrivado: false,
    hpMax: 120,
    combustivelMax: 100,
    municaoMax: 60,
    velocidadeBase: 2.5,
    gastoCombustivel: 0.04,
    arma: { tipo: 'fixo', dano: 12 },
    temNitro: false,
  },
};

// --- Classes de asteroides ---
const ASTEROID_TYPES = {
  pequeno:   { hp: 25,  width: 20,  height: 20,  velX: -3,   danoColisao: 10, color: '#a08060' },
  medio:     { hp: 40,  width: 40,  height: 40,  velX: -2.5, danoColisao: 20, color: '#8b6350' },
  grande:    { hp: 60,  width: 60,  height: 60,  velX: -2,   danoColisao: 30, color: '#6b4a30' },
  colossal:  { hp: 100, width: 100, height: 100, velX: -1.5, danoColisao: 50, color: '#4a3020' },
};

const DROP_CHANCE = 0.7;
const DROP_VALOR_MUNICAO = 30;
const DROP_VALOR_COMBUSTIVEL = 30;

// --- Canvas e overlay ---
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const charSelectOverlay = document.getElementById('char-select-overlay');
const gameOverOverlay = document.getElementById('game-over-overlay');
const gameOverReasonEl = document.getElementById('game-over-reason');

// --- Player: hitbox de física + sprite ativo (arte) ---
const player = {
  x: 80,
  y: 200,
  width: 38,
  height: 68,
  velX: 0,
  velY: 0,
  hp: 100,
  combustivel: 100,
  municao: 0,
  sprite: null,
};

// --- Entidades de combate ---
const lasers = [];
const asteroids = [];
const drops = [];

let gameStarted = false;
let gameOver = false;
let gameOverReason = '';
let lastTime = 0;
let spawnFrameCounter = 0;
let playerBlinkFrames = 0;

const SPAWN_INTERVAL = 90;

// --- Fundo infinito (parallax) ---
const SpaceBackground = {
  x: 0,
  vel: 1,
  stars: [],
};

function initSpaceBackground() {
  SpaceBackground.x = 0;
  SpaceBackground.stars = [];
  for (let i = 0; i < 80; i++) {
    SpaceBackground.stars.push({
      x: (i * 137) % canvas.width,
      y: (i * 89) % canvas.height,
    });
  }
}

// --- Input Handler ---
const keys = new Set();

window.addEventListener('keydown', (e) => {
  if (!gameStarted || gameOver) return;
  keys.add(e.code);

  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
    e.preventDefault();
  }

  if (e.code === 'Space' && !e.repeat) {
    fireLaser();
  }
});

window.addEventListener('keyup', (e) => {
  keys.delete(e.code);
});

function isMovingLeft()  { return keys.has('ArrowLeft')  || keys.has('KeyA'); }
function isMovingRight() { return keys.has('ArrowRight') || keys.has('KeyD'); }
function isMovingUp()    { return keys.has('ArrowUp')    || keys.has('KeyW'); }
function isMovingDown()  { return keys.has('ArrowDown')  || keys.has('KeyS'); }

function isNitroActive() {
  if (!player.sprite) return false;
  const profile = player.sprite.profile;
  return (
    profile.temNitro &&
    player.combustivel > 0 &&
    (keys.has('ShiftLeft') || keys.has('ShiftRight'))
  );
}

// --- Seleção de personagem ---
function loadCharacterSprite(profile) {
  const image = new Image();
  let loadFailed = false;

  image.onload = () => {
    if (player.sprite && player.sprite.profile.id === profile.id) {
      player.sprite.imageReady = true;
    }
  };

  image.onerror = () => {
    loadFailed = true;
    if (player.sprite && player.sprite.profile.id === profile.id) {
      player.sprite.imageReady = false;
      player.sprite.loadFailed = true;
    }
  };

  image.src = profile.src;

  return { profile, image, imageReady: false, loadFailed };
}

function activateCharacter(charId) {
  const profile = CHARACTERS[charId];
  player.sprite = loadCharacterSprite(profile);
  player.hp = profile.hpMax;
  player.combustivel = profile.combustivelMax;
  player.municao = profile.municaoMax;
  player.velX = 0;
  player.velY = 0;
}

function startGame() {
  gameStarted = true;
  gameOver = false;
  gameOverReason = '';
  playerBlinkFrames = 0;
  lasers.length = 0;
  asteroids.length = 0;
  drops.length = 0;
  spawnFrameCounter = 0;
  initSpaceBackground();
  charSelectOverlay.classList.add('hidden');
  gameOverOverlay.classList.add('hidden');
  requestAnimationFrame(gameLoop);
}

function resetGame() {
  if (!player.sprite) return;

  const profile = player.sprite.profile;

  gameOver = false;
  gameOverReason = '';
  gameOverOverlay.classList.add('hidden');

  player.hp = profile.hpMax;
  player.combustivel = profile.combustivelMax;
  player.municao = profile.municaoMax;
  player.velX = 0;
  player.velY = 0;
  player.x = 60;
  player.y = (canvas.height - player.height) / 2;

  playerBlinkFrames = 0;
  lasers.length = 0;
  asteroids.length = 0;
  drops.length = 0;
  spawnFrameCounter = 0;

  requestAnimationFrame(gameLoop);
}

function handleCharacterSelect(charId) {
  const profile = CHARACTERS[charId];

  if (profile.isPrivado) {
    const senha = prompt('Senha do Chris:');
    if (senha !== SENHA_TECH_LEAD) {
      alert('Acesso Negado. Este personagem é exclusivo do Chris.');
      return;
    }
  }

  activateCharacter(charId);
  startGame();
}

document.querySelectorAll('[data-char]').forEach((btn) => {
  btn.addEventListener('click', () => handleCharacterSelect(btn.dataset.char));
});

document.getElementById('btn-restart').addEventListener('click', resetGame);

// --- Colisão AABB ---
function aabbOverlap(a, b) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

function triggerGameOver(reason) {
  if (gameOver) return;

  gameOver = true;
  gameOverReason = reason;
  player.velX = 0;
  player.velY = 0;

  gameOverReasonEl.textContent = reason;
  gameOverOverlay.classList.remove('hidden');
}

// --- Disparo de lasers ---
function fireLaser() {
  if (!player.sprite || player.municao <= 0) return;

  player.municao -= 1;
  lasers.push({
    x: player.x + player.width,
    y: player.y + player.height / 2 - 2,
    width: 15,
    height: 4,
    velX: 10,
  });
}

function updateLasers() {
  if (gameOver) return;

  for (let i = lasers.length - 1; i >= 0; i--) {
    lasers[i].x += lasers[i].velX;
    if (lasers[i].x > canvas.width) {
      lasers.splice(i, 1);
    }
  }
}

// --- Spawner de asteroides por classe ---
function pickAsteroidType() {
  const roll = Math.random();
  if (roll < 0.05) return 'colossal';
  if (roll < 0.35) return 'grande';
  if (roll < 0.65) return 'medio';
  return 'pequeno';
}

function spawnAsteroid() {
  const tipo = pickAsteroidType();
  const cfg = ASTEROID_TYPES[tipo];

  asteroids.push({
    tipo,
    x: canvas.width + 50,
    y: Math.random() * (canvas.height - cfg.height),
    width: cfg.width,
    height: cfg.height,
    velX: cfg.velX,
    hp: cfg.hp,
    hpMax: cfg.hp,
    danoColisao: cfg.danoColisao,
    color: cfg.color,
  });
}

function trySpawnDrop(x, y, asteroideTipo) {
  const lootGarantido = asteroideTipo === 'grande' || asteroideTipo === 'colossal';

  // Chance base 70% — Grande e Colossal sempre dropam
  if (!lootGarantido && Math.random() >= DROP_CHANCE) return;

  // Pity System — evita soft lock por falta de munição ou combustível
  let tipo;
  const combustivelMax = player.sprite?.profile.combustivelMax ?? 100;
  const combustivelBaixo = player.combustivel / combustivelMax < 0.2;

  if (player.municao <= 5) {
    tipo = 'municao';
  } else if (combustivelBaixo) {
    tipo = 'combustivel';
  } else {
    tipo = Math.random() < 0.5 ? 'municao' : 'combustivel';
  }

  drops.push({
    x,
    y,
    width: 16,
    height: 16,
    velX: -1,
    tipo,
    valor: tipo === 'municao' ? DROP_VALOR_MUNICAO : DROP_VALOR_COMBUSTIVEL,
  });
}

function updateAsteroids() {
  if (gameOver) return;

  spawnFrameCounter += 1;
  if (spawnFrameCounter >= SPAWN_INTERVAL) {
    spawnAsteroid();
    spawnFrameCounter = 0;
  }

  for (let i = asteroids.length - 1; i >= 0; i--) {
    asteroids[i].x += asteroids[i].velX;
    if (asteroids[i].x < -asteroids[i].width) {
      asteroids.splice(i, 1);
    }
  }
}

function updateDrops() {
  if (gameOver) return;

  for (let i = drops.length - 1; i >= 0; i--) {
    drops[i].x += drops[i].velX;
    if (drops[i].x < -drops[i].width) {
      drops.splice(i, 1);
    }
  }
}

// --- Colisões avançadas ---
function checkLaserAsteroidCollisions() {
  if (gameOver || !player.sprite) return;

  const { arma } = player.sprite.profile;

  for (let li = lasers.length - 1; li >= 0; li--) {
    for (let ai = asteroids.length - 1; ai >= 0; ai--) {
      if (!aabbOverlap(lasers[li], asteroids[ai])) continue;

      const asteroide = asteroids[ai];

      // Cálculo de dano conforme tipo da arma
      let dano;
      if (arma.tipo === 'percentual') {
        dano = asteroide.hp * arma.multiplicador;
      } else {
        dano = arma.dano || 15;
      }

      asteroide.hp -= dano;

      // Trava de arredondamento — elimina frações decimais infinitas
      if (asteroide.hp < 1) {
        asteroide.hp = 0;
      }

      // Remove o laser — um tiro não atravessa dois alvos
      lasers.splice(li, 1);

      // Destruição e drops no ponto exato da destruição
      if (asteroide.hp === 0) {
        const dropX = asteroide.x;
        const dropY = asteroide.y;
        const asteroideTipo = asteroide.tipo;
        asteroids.splice(ai, 1);
        trySpawnDrop(dropX, dropY, asteroideTipo);
      }

      break;
    }
  }
}

function checkPlayerAsteroidCollisions() {
  if (gameOver) return;

  for (let i = asteroids.length - 1; i >= 0; i--) {
    if (!aabbOverlap(player, asteroids[i])) continue;

    player.hp -= asteroids[i].danoColisao;
    asteroids.splice(i, 1);
    playerBlinkFrames = 30;

    if (player.hp <= 0) {
      player.hp = 0;
      triggerGameOver('NAVE DESTRUÍDA');
    }
    break;
  }
}

function checkPlayerDropCollisions() {
  if (gameOver || !player.sprite) return;

  const { combustivelMax, municaoMax } = player.sprite.profile;

  for (let i = drops.length - 1; i >= 0; i--) {
    if (!aabbOverlap(player, drops[i])) continue;

    if (drops[i].tipo === 'municao') {
      player.municao = Math.min(municaoMax, player.municao + drops[i].valor);
    } else {
      player.combustivel = Math.min(combustivelMax, player.combustivel + drops[i].valor);
    }

    drops.splice(i, 1);
  }
}

// --- Física 4-Way com Nitro ---
function clampToScreen() {
  if (player.x < 0) { player.x = 0; player.velX = 0; }
  if (player.y < 0) { player.y = 0; player.velY = 0; }
  if (player.x + player.width > canvas.width) {
    player.x = canvas.width - player.width;
    player.velX = 0;
  }
  if (player.y + player.height > canvas.height) {
    player.y = canvas.height - player.height;
    player.velY = 0;
  }
}

function updatePhysics() {
  if (gameOver || !player.sprite) return;

  const profile = player.sprite.profile;
  const speed = isNitroActive() ? profile.velocidadeNitro : profile.velocidadeBase;

  player.velX = 0;
  player.velY = 0;

  if (isMovingLeft())  player.velX = -speed;
  if (isMovingRight()) player.velX =  speed;
  if (isMovingUp())    player.velY = -speed;
  if (isMovingDown())  player.velY =  speed;

  player.x += player.velX;
  player.y += player.velY;

  clampToScreen();
}

function updateFuel() {
  if (gameOver || !player.sprite) return;

  const profile = player.sprite.profile;
  const gasto = isNitroActive() ? profile.custoNitro : profile.gastoCombustivel;
  player.combustivel -= gasto;

  if (player.combustivel <= 0) {
    player.combustivel = 0;
    triggerGameOver('Combustível esgotado');
  }
}

function updateBlink() {
  if (playerBlinkFrames > 0) playerBlinkFrames -= 1;
}

function updateSpaceBackground() {
  if (gameOver) return;

  SpaceBackground.x -= SpaceBackground.vel;
  if (SpaceBackground.x <= -canvas.width) {
    SpaceBackground.x += canvas.width;
  }
}

// --- Arte: lê x/y/width/height da hitbox; fallback seguro se imagem falhar ---
function drawPlayerSprite() {
  if (!player.sprite) return;

  // Feedback visual de dano — pisca a nave
  if (playerBlinkFrames > 0 && Math.floor(playerBlinkFrames / 4) % 2 === 0) return;

  const { x, y, width, height } = player;
  const { profile, image, imageReady, loadFailed } = player.sprite;
  const canDrawImage = image && imageReady && !loadFailed && image.complete;

  if (canDrawImage) {
    ctx.drawImage(image, x, y, width, height);
  } else {
    ctx.fillStyle = profile.fallbackColor;
    ctx.fillRect(x, y, width, height);
  }
}

function drawSpaceBackground() {
  ctx.fillStyle = '#050510';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  function drawStarTile(offsetX) {
    ctx.fillStyle = '#ffffff';
    for (const star of SpaceBackground.stars) {
      ctx.fillRect(star.x + offsetX, star.y, 2, 2);
    }
  }

  drawStarTile(SpaceBackground.x);
  drawStarTile(SpaceBackground.x + canvas.width);
}

function drawLasers() {
  ctx.fillStyle = '#00ffcc';
  for (const laser of lasers) {
    ctx.fillRect(laser.x, laser.y, laser.width, laser.height);
  }
}

function drawAsteroids() {
  for (const ast of asteroids) {
    ctx.fillStyle = ast.color;
    ctx.fillRect(ast.x, ast.y, ast.width, ast.height);
  }
}

function drawDrops() {
  for (const drop of drops) {
    ctx.fillStyle = drop.tipo === 'municao' ? '#74b9ff' : '#fdcb6e';
    ctx.fillRect(drop.x, drop.y, drop.width, drop.height);
    ctx.fillStyle = '#fff';
    ctx.font = '10px system-ui, sans-serif';
    ctx.fillText(drop.tipo === 'municao' ? 'M' : 'C', drop.x + 4, drop.y + 12);
  }
}

function drawStatBar(x, y, w, h, ratio, fillColor, lowColor, threshold) {
  ctx.fillStyle = '#2a2a3e';
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = ratio < threshold ? lowColor : fillColor;
  ctx.fillRect(x, y, w * Math.max(0, Math.min(1, ratio)), h);
  ctx.strokeStyle = '#555';
  ctx.lineWidth = 1;
  ctx.strokeRect(x, y, w, h);
}

function drawHUD() {
  if (!player.sprite) return;

  const { hpMax, combustivelMax, municaoMax } = player.sprite.profile;
  const barW = 180;
  const barH = 14;
  const startX = 16;
  const gap = 8;

  const hpRatio = player.hp / hpMax;
  drawStatBar(startX, 10, barW, barH, hpRatio, '#2ecc71', '#ff0040', 0.3);
  ctx.fillStyle = '#f0f0f0';
  ctx.font = 'bold 11px system-ui, sans-serif';
  ctx.fillText(`VIDA ${Math.floor(player.hp)}/${hpMax}`, startX + 4, 21);

  const fuelRatio = player.combustivel / combustivelMax;
  drawStatBar(startX, 10 + barH + gap, barW, barH, fuelRatio, '#f39c12', '#ff0040', 0.2);
  ctx.fillText(`COMB. ${Math.floor(player.combustivel)}/${combustivelMax}`, startX + 4, 21 + barH + gap);

  const ammoRatio = player.municao / municaoMax;
  drawStatBar(startX, 10 + (barH + gap) * 2, barW, barH, ammoRatio, '#74b9ff', '#636e72', 0.15);
  ctx.fillText(`MUNIÇÃO ${Math.floor(player.municao)}/${municaoMax}`, startX + 4, 21 + (barH + gap) * 2);
}

function drawDebugHitboxes() {
  ctx.strokeStyle = '#ff0040';
  ctx.lineWidth = 2;
  ctx.strokeRect(player.x, player.y, player.width, player.height);

  for (const laser of lasers) {
    ctx.strokeRect(laser.x, laser.y, laser.width, laser.height);
  }
  for (const ast of asteroids) {
    ctx.strokeRect(ast.x, ast.y, ast.width, ast.height);
  }
  for (const drop of drops) {
    ctx.strokeRect(drop.x, drop.y, drop.width, drop.height);
  }
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  drawSpaceBackground();
  drawDrops();
  drawAsteroids();
  drawLasers();
  drawPlayerSprite();
  drawHUD();

  if (DEBUG_MODE) drawDebugHitboxes();
}

// --- Game Loop (requestAnimationFrame) — só roda após seleção ---
function gameLoop(timestamp) {
  // 1. Calcula delta time (reservado para física frame-independent no futuro)
  const delta = timestamp - lastTime;
  lastTime = timestamp;

  // 2. Atualiza sistemas do jogo
  updateSpaceBackground();
  updateFuel();
  updatePhysics();
  updateLasers();
  updateAsteroids();
  updateDrops();
  checkLaserAsteroidCollisions();
  checkPlayerAsteroidCollisions();
  checkPlayerDropCollisions();
  updateBlink();

  // 3. Desenha o frame atual no canvas
  render();

  // 4. Agenda o próximo frame — para no game over
  if (!gameOver) {
    requestAnimationFrame(gameLoop);
  }
}
