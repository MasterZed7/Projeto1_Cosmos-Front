// ============================================================
// Motor de Plataforma 2D — Arquitetura "Hitbox Decoupled"
// Física (hitbox) e Arte (sprite) são objetos independentes.
// ============================================================

const DEBUG_MODE = true;
const SENHA_TECH_LEAD = '2103';

// --- Catálogo de personagens ---
const CHARACTERS = {
  christopher: {
    id: 'christopher',
    nome: 'Christopher',
    src: './assets/christopher_sprite_semBG.png',
    fallbackColor: '#e94560',
    isPrivado: true,
  },
  henri: {
    id: 'henri',
    nome: 'Henri',
    src: './assets/henri_sprite.png',
    fallbackColor: '#4ecdc4',
    isPrivado: false,
  },
  isaque: {
    id: 'isaque',
    nome: 'Isaque',
    src: './assets/isaque_sprite.png',
    fallbackColor: '#ffe66d',
    isPrivado: false,
  },
  guilherme: {
    id: 'guilherme',
    nome: 'Guilherme',
    src: './assets/guilherme_sprite.png',
    fallbackColor: '#a29bfe',
    isPrivado: false,
  },
};

// --- Canvas e overlay ---
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const charSelectOverlay = document.getElementById('char-select-overlay');

// --- Constantes de física ---
const GRAVITY = 0.6;
const JUMP_FORCE = -11;
const MOVE_SPEED = 4;
const FRICTION = 0.82;
const MAX_FALL_SPEED = 14;

// --- Nível: plataformas estáticas { x, y, w, h } ---
const Level = {
  platforms: [
    { x: 0, y: 400, w: 800, h: 50 },
    { x: 150, y: 300, w: 120, h: 16 },
    { x: 500, y: 220, w: 140, h: 16 },
  ],
};

// --- Player: hitbox de física + sprite ativo (arte) ---
const player = {
  x: 80,
  y: 200,
  width: 38,
  height: 68, // Quase o dobro da largura — proporção mais anatômica
  velX: 0,
  velY: 0,
  grounded: false,
  sprite: null, // preenchido após seleção de personagem
};

let gameStarted = false;
let lastTime = 0;

// --- Input Handler ---
const keys = new Set();

window.addEventListener('keydown', (e) => {
  if (!gameStarted) return;
  keys.add(e.code);
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) {
    e.preventDefault();
  }
});

window.addEventListener('keyup', (e) => {
  keys.delete(e.code);
});

function isMovingLeft() {
  return keys.has('ArrowLeft') || keys.has('KeyA');
}

function isMovingRight() {
  return keys.has('ArrowRight') || keys.has('KeyD');
}

function wantsJump() {
  return keys.has('ArrowUp') || keys.has('KeyW') || keys.has('Space');
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

  return {
    profile,
    image,
    imageReady: false,
    loadFailed,
  };
}

function activateCharacter(charId) {
  const profile = CHARACTERS[charId];
  player.sprite = loadCharacterSprite(profile);
}

function startGame() {
  gameStarted = true;
  charSelectOverlay.classList.add('hidden');
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

// Vincula os botões do overlay
document.querySelectorAll('[data-char]').forEach((btn) => {
  btn.addEventListener('click', () => handleCharacterSelect(btn.dataset.char));
});

// --- Colisão AABB ---
function aabbOverlap(a, b) {
  return (
    a.x < b.x + b.w &&
    a.x + a.width > b.x &&
    a.y < b.y + b.h &&
    a.y + a.height > b.y
  );
}

function resolveCollisions() {
  player.grounded = false;

  for (const plat of Level.platforms) {
    if (!aabbOverlap(player, plat)) continue;

    const overlapLeft = (player.x + player.width) - plat.x;
    const overlapRight = (plat.x + plat.w) - player.x;
    const overlapTop = (player.y + player.height) - plat.y;
    const overlapBottom = (plat.y + plat.h) - player.y;

    const minOverlapX = Math.min(overlapLeft, overlapRight);
    const minOverlapY = Math.min(overlapTop, overlapBottom);

    if (minOverlapX < minOverlapY) {
      if (overlapLeft < overlapRight) {
        player.x = plat.x - player.width;
      } else {
        player.x = plat.x + plat.w;
      }
      player.velX = 0;
    } else {
      if (overlapTop < overlapBottom) {
        player.y = plat.y - player.height;
        player.velY = 0;
        player.grounded = true;
      } else {
        player.y = plat.y + plat.h;
        player.velY = 0;
      }
    }
  }
}

// --- Física do Player (opera somente na hitbox) ---
function updatePhysics() {
  if (isMovingLeft()) player.velX = -MOVE_SPEED;
  else if (isMovingRight()) player.velX = MOVE_SPEED;
  else player.velX *= FRICTION;

  if (wantsJump() && player.grounded) {
    player.velY = JUMP_FORCE;
    player.grounded = false;
  }

  player.velY += GRAVITY;
  if (player.velY > MAX_FALL_SPEED) player.velY = MAX_FALL_SPEED;

  player.x += player.velX;
  player.y += player.velY;

  if (player.x < 0) { player.x = 0; player.velX = 0; }
  if (player.x + player.width > canvas.width) {
    player.x = canvas.width - player.width;
    player.velX = 0;
  }

  resolveCollisions();
}

// --- Arte: lê x/y/width/height da hitbox; fallback seguro se imagem falhar ---
function drawPlayerSprite() {
  if (!player.sprite) return;

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

function drawPlatforms() {
  ctx.fillStyle = '#6c5ce7';
  for (const plat of Level.platforms) {
    ctx.fillRect(plat.x, plat.y, plat.w, plat.h);
  }
}

function drawDebugHitboxes() {
  ctx.strokeStyle = '#ff0040';
  ctx.lineWidth = 2;
  ctx.strokeRect(player.x, player.y, player.width, player.height);

  for (const plat of Level.platforms) {
    ctx.strokeRect(plat.x, plat.y, plat.w, plat.h);
  }
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#16213e';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  drawPlatforms();
  drawPlayerSprite();

  if (DEBUG_MODE) drawDebugHitboxes();
}

// --- Game Loop (requestAnimationFrame) — só roda após seleção ---
function gameLoop(timestamp) {
  // 1. Calcula delta time (reservado para física frame-independent no futuro)
  const delta = timestamp - lastTime;
  lastTime = timestamp;

  // 2. Atualiza lógica do jogo
  updatePhysics();

  // 3. Desenha o frame atual no canvas
  render();

  // 4. Agenda o próximo frame
  requestAnimationFrame(gameLoop);
}
