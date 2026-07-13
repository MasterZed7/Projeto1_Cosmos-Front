// ============================================================
// Space Shooter Arcade — Fase 1 (Espaço)
// Arquitetura "Hitbox Decoupled": arte NUNCA afeta a física.
// ============================================================

const DEBUG_MODE = false;
const SENHA_TECH_LEAD = '2103';
const FASE1_DURACAO_MS = 60000;

// --- Catálogo de operadores (src sempre .png) ---
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
    src: './assets/nave_Henri.png',
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
    src: './assets/nave_Isaque.png',
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
    src: './assets/nave_Guilherme.png',
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

// --- 3 classes de asteroides (espelham os 3 PNGs em assets/) ---
const ASTEROID_TYPES = {
  pequeno: {
    hp: 25,
    width: 28,
    height: 24,
    velX: -3,
    danoColisao: 10,
    color: '#a08060',
    src: './assets/asteroide_pequeno.png',
  },
  medio: {
    hp: 40,
    width: 48,
    height: 44,
    velX: -2.5,
    danoColisao: 20,
    color: '#8b6350',
    src: './assets/asteroide_medio.png',
  },
  colossal: {
    hp: 200,
    width: 360,
    height: 360,
    velX: -0.8,
    danoColisao: 50,
    color: '#4a3020',
    src: './assets/asteroide_colossal.png',
  },
};

// Imagens globais dos asteroides (arte decoupled da hitbox)
const asteroidImages = {
  pequeno: new Image(),
  medio: new Image(),
  colossal: new Image(),
};

asteroidImages.pequeno.src = ASTEROID_TYPES.pequeno.src;
asteroidImages.medio.src = ASTEROID_TYPES.medio.src;
asteroidImages.colossal.src = ASTEROID_TYPES.colossal.src;

const DROP_CHANCE = 0.7;
const DROP_VALOR_MUNICAO = 30;
const DROP_VALOR_COMBUSTIVEL = 30;

// --- Canvas e overlays ---
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const charSelectOverlay = document.getElementById('char-select-overlay');
const gameOverOverlay = document.getElementById('game-over-overlay');
const gameOverReasonEl = document.getElementById('game-over-reason');
const pauseOverlay = document.getElementById('pause-overlay');
const mainMenuOverlay = document.getElementById('main-menu-overlay');

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

// --- Entidades de combate / fase ---
const lasers = [];
const asteroids = [];
const drops = [];

const planeta = {
  active: false,
  x: 0,
  y: 0,
  width: 1000,
  height: 600,
  velX: -1.2,
};

let gameStarted = false;
let gameOver = false;
let gameOverReason = '';
let fase1Completa = false;
let isPaused = false;
let tempoFase1 = 0;
let ultimoColossalTempo = 0;
let lastTime = 0;
let spawnFrameCounter = 0;
let playerBlinkFrames = 0;
let spawningAsteroids = true;

const SPAWN_INTERVAL = 90;
const COLOSSAL_COOLDOWN_MS = 5000;

// --- Fundo infinito (imagem de cenário) ---
const SpaceBackground = {
  x: 0,
  vel: 1,
  image: new Image(),
};

SpaceBackground.image.src = './assets/fase1_espaco.png';

function initSpaceBackground() {
  SpaceBackground.x = 0;
}

// --- Planeta (transição Fase 2) ---
const planetaImage = new Image();
planetaImage.src = './assets/fase2_planeta.png';

// --- Input Handler ---
const keys = new Set();

window.addEventListener('keydown', (e) => {
  // ESC abre/fecha o menu de pausa durante a partida
  if (e.code === 'Escape') {
    e.preventDefault();
    if (gameStarted && !gameOver && !fase1Completa) {
      if (isPaused) resumeGame();
      else pauseGame();
    }
    return;
  }

  if (!gameStarted || gameOver || fase1Completa || isPaused) return;
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

  image.onload = () => {
    if (player.sprite && player.sprite.profile.id === profile.id) {
      player.sprite.imageReady = true;
      player.sprite.loadFailed = false;
    }
  };

  image.onerror = () => {
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
    loadFailed: false,
  };
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

function resetPhaseState() {
  tempoFase1 = 0;
  ultimoColossalTempo = 0;
  spawningAsteroids = true;
  fase1Completa = false;
  planeta.active = false;
  lasers.length = 0;
  asteroids.length = 0;
  drops.length = 0;
  spawnFrameCounter = 0;
  playerBlinkFrames = 0;
}

function pauseGame() {
  if (isPaused || !gameStarted || gameOver || fase1Completa) return;
  isPaused = true;
  keys.clear();
  pauseOverlay.classList.remove('hidden');
}

function resumeGame() {
  if (!isPaused) return;
  isPaused = false;
  pauseOverlay.classList.add('hidden');
  lastTime = 0; // evita salto de delta após a pausa
  requestAnimationFrame(gameLoop);
}

function backToMenu() {
  isPaused = false;
  gameStarted = false;
  gameOver = false;
  gameOverReason = '';
  fase1Completa = false;
  keys.clear();
  resetPhaseState();

  player.sprite = null;
  player.velX = 0;
  player.velY = 0;
  player.x = 80;
  player.y = 200;

  pauseOverlay.classList.add('hidden');
  gameOverOverlay.classList.add('hidden');
  charSelectOverlay.classList.add('hidden');
  mainMenuOverlay.classList.remove('hidden');

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#050510';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function closeGame() {
  window.close();

  // Fallback se o navegador bloquear window.close()
  document.body.innerHTML = `
    <div style="
      min-height:100vh;display:flex;align-items:center;justify-content:center;
      background:#000;color:#fff;font-family:Arial,sans-serif;text-align:center;padding:24px;
    ">
      <h1 style="letter-spacing:0.15em;font-size:2rem;">SISTEMA DESLIGADO</h1>
    </div>
  `;
}

function openCharacterSelect() {
  mainMenuOverlay.classList.add('hidden');
  charSelectOverlay.classList.remove('hidden');
}

function backToMainMenuFromSelect() {
  charSelectOverlay.classList.add('hidden');
  mainMenuOverlay.classList.remove('hidden');
}

function startGame() {
  gameStarted = true;
  gameOver = false;
  gameOverReason = '';
  isPaused = false;
  resetPhaseState();
  initSpaceBackground();
  charSelectOverlay.classList.add('hidden');
  gameOverOverlay.classList.add('hidden');
  pauseOverlay.classList.add('hidden');
  lastTime = 0;

  document.documentElement.requestFullscreen().catch((err) => {
    console.log('Erro de fullscreen:', err);
  });

  requestAnimationFrame(gameLoop);
}

function resetGame() {
  if (!player.sprite) return;

  const profile = player.sprite.profile;

  gameOver = false;
  gameOverReason = '';
  isPaused = false;
  gameOverOverlay.classList.add('hidden');
  pauseOverlay.classList.add('hidden');

  player.hp = profile.hpMax;
  player.combustivel = profile.combustivelMax;
  player.municao = profile.municaoMax;
  player.velX = 0;
  player.velY = 0;
  player.x = 60;
  player.y = (canvas.height - player.height) / 2;

  resetPhaseState();
  lastTime = 0;
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
document.getElementById('btn-resume').addEventListener('click', resumeGame);
document.getElementById('btn-back-menu').addEventListener('click', backToMenu);
document.getElementById('btn-close-game').addEventListener('click', closeGame);
document.getElementById('btn-start').addEventListener('click', openCharacterSelect);
document.getElementById('btn-close').addEventListener('click', closeGame);
document.getElementById('btn-back-main-menu').addEventListener('click', backToMainMenuFromSelect);

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
  if (gameOver || fase1Completa) return;

  gameOver = true;
  gameOverReason = reason;
  player.velX = 0;
  player.velY = 0;

  gameOverReasonEl.textContent = reason;
  gameOverOverlay.classList.remove('hidden');
}

function completeFase1() {
  if (fase1Completa) return;

  fase1Completa = true;
  player.velX = 0;
  player.velY = 0;

  // Limpa o canvas e desenha a tela de transição
  ctx.fillStyle = '#000000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  const mensagem = 'Após navegar pelo espaço, chegamos a um planeta para procurarmos por recursos naturais.';
  const maxWidth = canvas.width - 80;
  const lineHeight = 28;
  const words = mensagem.split(' ');
  const lines = [];
  let current = '';

  for (const word of words) {
    const test = current ? `${current} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth) {
      lines.push(current);
      current = word;
    } else {
      current = test;
    }
  }
  if (current) lines.push(current);

  const startY = canvas.height / 2 - ((lines.length - 1) * lineHeight) / 2;
  lines.forEach((line, i) => {
    ctx.fillText(line, canvas.width / 2, startY + i * lineHeight);
  });

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
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
  if (gameOver || fase1Completa) return;

  for (let i = lasers.length - 1; i >= 0; i--) {
    lasers[i].x += lasers[i].velX;
    if (lasers[i].x > canvas.width) {
      lasers.splice(i, 1);
    }
  }
}

// --- Spawner de asteroides (3 tipos) ---
function pickAsteroidType() {
  const roll = Math.random();
  // Colossal: no máximo 2%
  if (roll < 0.02) return 'colossal';
  if (roll < 0.45) return 'medio';
  return 'pequeno';
}

function spawnAsteroid() {
  let tipo = pickAsteroidType();

  // Cooldown do Colossal: mínimo 5s entre um e outro
  if (tipo === 'colossal') {
    if (tempoFase1 - ultimoColossalTempo <= COLOSSAL_COOLDOWN_MS) {
      tipo = 'medio';
    } else {
      ultimoColossalTempo = tempoFase1;
    }
  }

  const cfg = ASTEROID_TYPES[tipo];
  const maxY = Math.max(0, canvas.height - cfg.height);

  asteroids.push({
    tipo,
    x: canvas.width + 50,
    y: Math.random() * maxY,
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
  const lootGarantido = asteroideTipo === 'colossal';

  if (!lootGarantido && Math.random() >= DROP_CHANCE) return;

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

function spawnPlaneta() {
  if (planeta.active) return;

  planeta.active = true;
  planeta.width = 1000;
  planeta.height = 600;
  planeta.x = canvas.width;
  planeta.y = (canvas.height - 600) / 2;
  planeta.velX = -1.2;
}

function updateAsteroids() {
  if (gameOver || fase1Completa) return;

  if (spawningAsteroids) {
    spawnFrameCounter += 1;
    if (spawnFrameCounter >= SPAWN_INTERVAL) {
      spawnAsteroid();
      spawnFrameCounter = 0;
    }
  }

  for (let i = asteroids.length - 1; i >= 0; i--) {
    asteroids[i].x += asteroids[i].velX;
    if (asteroids[i].x < -asteroids[i].width) {
      asteroids.splice(i, 1);
    }
  }
}

function updatePlaneta() {
  if (gameOver || fase1Completa || !planeta.active) return;
  planeta.x += planeta.velX;
}

function updateDrops() {
  if (gameOver || fase1Completa) return;

  for (let i = drops.length - 1; i >= 0; i--) {
    drops[i].x += drops[i].velX;
    if (drops[i].x < -drops[i].width) {
      drops.splice(i, 1);
    }
  }
}

function updateFase1Timer(delta) {
  if (gameOver || fase1Completa) return;

  // Evita salto enorme no primeiro frame
  const dt = Math.min(delta || 0, 100);
  tempoFase1 += dt;

  if (tempoFase1 >= FASE1_DURACAO_MS && spawningAsteroids) {
    spawningAsteroids = false;
    spawnPlaneta();
  }
}

// --- Colisões ---
function checkLaserAsteroidCollisions() {
  if (gameOver || fase1Completa || !player.sprite) return;

  const { arma } = player.sprite.profile;

  for (let li = lasers.length - 1; li >= 0; li--) {
    for (let ai = asteroids.length - 1; ai >= 0; ai--) {
      if (!aabbOverlap(lasers[li], asteroids[ai])) continue;

      const asteroide = asteroids[ai];

      let dano;
      if (arma.tipo === 'percentual') {
        // 50% do hpMax → destrói em exatamente 2 tiros
        dano = asteroide.hpMax * arma.multiplicador;
      } else {
        dano = arma.dano || 15;
      }

      asteroide.hp -= dano;

      // Trava de arredondamento + destruição
      if (asteroide.hp <= 0) {
        asteroide.hp = 0;
      }

      lasers.splice(li, 1);

      if (asteroide.hp <= 0) {
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
  if (gameOver || fase1Completa) return;

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
  if (gameOver || fase1Completa || !player.sprite) return;

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

function checkPlayerPlanetaCollision() {
  if (gameOver || fase1Completa || !planeta.active) return;
  if (!aabbOverlap(player, planeta)) return;
  completeFase1();
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
  if (gameOver || fase1Completa || !player.sprite) return;

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
  if (gameOver || fase1Completa || !player.sprite) return;

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
  if (gameOver || fase1Completa) return;

  SpaceBackground.x -= SpaceBackground.vel;
  if (SpaceBackground.x <= -canvas.width) {
    SpaceBackground.x += canvas.width;
  }
}

// --- Arte: SEMPRE lê a hitbox. Hitbox NUNCA lê a arte. ---
function canDrawImage(image, imageReady, loadFailed) {
  return !!(
    image &&
    imageReady &&
    !loadFailed &&
    image.complete &&
    image.naturalWidth > 0
  );
}

function drawPlayerSprite() {
  if (!player.sprite) return;

  // Feedback visual de dano — pisca a nave (arte), sem alterar hitbox
  if (playerBlinkFrames > 0 && Math.floor(playerBlinkFrames / 4) % 2 === 0) return;

  const { x, y, width, height } = player;
  const { profile, image, imageReady, loadFailed } = player.sprite;

  // Fallback obrigatório: nunca deixa quadrado vazio/transparente
  if (!canDrawImage(image, imageReady, loadFailed)) {
    ctx.fillStyle = profile.fallbackColor;
    ctx.fillRect(x, y, width, height);
    return;
  }

  ctx.drawImage(
    image,
    0, 0, image.naturalWidth, image.naturalHeight,
    x, y, width, height
  );
}

function drawSpaceBackground() {
  const img = SpaceBackground.image;
  const ready = img && img.complete && img.naturalWidth > 0;

  if (!ready) {
    // Fallback: fundo preto
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    return;
  }

  // Esteira infinita: desenha a imagem duas vezes
  ctx.drawImage(img, SpaceBackground.x, 0, canvas.width, canvas.height);
  ctx.drawImage(img, SpaceBackground.x + canvas.width, 0, canvas.width, canvas.height);
}

function drawLasers() {
  ctx.fillStyle = '#00ffcc';
  for (const laser of lasers) {
    ctx.fillRect(laser.x, laser.y, laser.width, laser.height);
  }
}

function drawAsteroids() {
  for (const ast of asteroids) {
    const img = asteroidImages[ast.tipo];
    const ready = img && img.complete && img.naturalWidth > 0;

    if (ready) {
      // Arte segue a hitbox (x, y, width, height)
      ctx.drawImage(img, ast.x, ast.y, ast.width, ast.height);
    } else {
      // Fallback defensivo
      ctx.fillStyle = ast.color;
      ctx.fillRect(ast.x, ast.y, ast.width, ast.height);
    }
  }
}

function drawPlaneta() {
  if (!planeta.active) return;

  const ready = planetaImage && planetaImage.complete && planetaImage.naturalWidth > 0;

  if (ready) {
    // Arte segue a hitbox do planeta
    ctx.drawImage(
      planetaImage,
      planeta.x,
      planeta.y,
      planeta.width,
      planeta.height
    );
  } else {
    // Fallback visual se a imagem quebrar
    ctx.fillStyle = '#2e86ab';
    ctx.fillRect(planeta.x, planeta.y, planeta.width, planeta.height);
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

function drawOutlinedText(text, x, y) {
  ctx.font = 'bold 14px Arial';
  ctx.lineWidth = 3;
  ctx.strokeStyle = 'black';
  ctx.fillStyle = 'white';
  ctx.strokeText(text, x, y);
  ctx.fillText(text, x, y);
}

function drawStatBar(x, y, w, h, ratio, fillColor, lowColor, threshold) {
  // Track (fundo máximo da barra)
  ctx.fillStyle = '#333';
  ctx.fillRect(x, y, w, h);

  // Preenchimento colorido
  const safeRatio = Math.max(0, Math.min(1, ratio));
  ctx.fillStyle = safeRatio < threshold ? lowColor : fillColor;
  ctx.fillRect(x, y, w * safeRatio, h);
}

function drawHUD() {
  if (!player.sprite) return;

  const { hpMax, combustivelMax, municaoMax } = player.sprite.profile;
  const barW = 200;
  const barH = 14;
  const startX = 16;
  const gap = 8;

  const hpRatio = player.hp / hpMax;
  const fuelRatio = player.combustivel / combustivelMax;
  const ammoRatio = player.municao / municaoMax;

  const row1Y = 12;
  const row2Y = row1Y + barH + gap;
  const row3Y = row2Y + barH + gap;

  drawStatBar(startX, row1Y, barW, barH, hpRatio, '#2ecc71', '#ff0040', 0.3);
  drawOutlinedText(`VIDA ${Math.floor(player.hp)}/${hpMax}`, startX + 6, row1Y + 12);

  drawStatBar(startX, row2Y, barW, barH, fuelRatio, '#f39c12', '#ff0040', 0.2);
  drawOutlinedText(
    `COMB. ${Math.floor(player.combustivel)}/${combustivelMax}`,
    startX + 6,
    row2Y + 12
  );

  drawStatBar(startX, row3Y, barW, barH, ammoRatio, '#74b9ff', '#636e72', 0.15);
  drawOutlinedText(
    `MUNIÇÃO ${Math.floor(player.municao)}/${municaoMax}`,
    startX + 6,
    row3Y + 12
  );

  // Timer da Fase 1 (mesmo estilo arcade)
  const restante = Math.max(0, Math.ceil((FASE1_DURACAO_MS - tempoFase1) / 1000));
  const timerLabel = spawningAsteroids ? `FASE 1: ${restante}s` : 'PLANETA À VISTA';
  drawOutlinedText(timerLabel, canvas.width - 160, 28);
}

function drawDebugHitboxes() {
  ctx.strokeStyle = '#ff0040';
  ctx.lineWidth = 2;
  ctx.strokeRect(player.x, player.y, player.width, player.height);

  if (planeta.active) {
    ctx.strokeStyle = '#74b9ff';
    ctx.strokeRect(planeta.x, planeta.y, planeta.width, planeta.height);
    ctx.strokeStyle = '#ff0040';
  }

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
  if (fase1Completa) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);

  drawSpaceBackground();
  drawPlaneta();
  drawDrops();
  drawAsteroids();
  drawLasers();
  drawPlayerSprite();
  drawHUD();

  if (DEBUG_MODE) drawDebugHitboxes();
}

// --- Game Loop ---
function gameLoop(timestamp) {
  // Pausa: congela a física e o timer, mas mantém o último frame na tela
  if (isPaused) return;

  // 1. Delta time
  if (!lastTime) lastTime = timestamp;
  const delta = timestamp - lastTime;
  lastTime = timestamp;

  // 2. Sistemas da Fase 1
  updateFase1Timer(delta);
  updateSpaceBackground();
  updateFuel();
  updatePhysics();
  updateLasers();
  updateAsteroids();
  updatePlaneta();
  updateDrops();
  checkLaserAsteroidCollisions();
  checkPlayerAsteroidCollisions();
  checkPlayerDropCollisions();
  checkPlayerPlanetaCollision();
  updateBlink();

  // 3. Render
  render();

  // 4. Próximo frame — para no game over, fim da Fase 1 ou pausa
  if (!gameOver && !fase1Completa && !isPaused) {
    requestAnimationFrame(gameLoop);
  }
}
