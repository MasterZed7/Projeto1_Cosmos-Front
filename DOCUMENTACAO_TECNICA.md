# Documentação Técnica — Cosmos Plataforma 2D

Roteiro de estudos para apresentação acadêmica do projeto.  
Stack: **HTML5 Canvas + JavaScript puro** (sem bibliotecas externas).

---

## 1. A Arquitetura "Hitbox Decoupled"

### O que é?

No nosso jogo, o personagem existe em **duas camadas independentes**:

| Camada | O que é | O que controla |
|--------|---------|----------------|
| **Física (Hitbox)** | Uma caixa invisível retangular | Posição, velocidade, colisões |
| **Arte (Sprite)** | A imagem visível do personagem | Apenas o desenho na tela |

A hitbox do player é definida assim:

```javascript
const player = {
  x: 80, y: 200,
  width: 38, height: 68,
  velX: 0, velY: 0,
  grounded: false,
  sprite: null, // arte — preenchida depois da seleção
};
```

Toda a lógica de movimento, gravidade, pulo e colisão opera **somente** nesses números (`x`, `y`, `width`, `height`, `velX`, `velY`). A arte **não calcula física** — ela apenas **lê** a posição da hitbox e desenha por cima.

### Como a arte se conecta à física?

A função `drawPlayerSprite()` pega `player.x`, `player.y`, `player.width` e `player.height` e usa esses valores para desenhar o PNG (ou o retângulo colorido de fallback). A arte segue a hitbox; a hitbox nunca segue a arte.

### Por que isso é vantajoso em equipe?

1. **Trabalho paralelo** — O programador ajusta colisão e movimento sem precisar do PNG final. O artista pode entregar sprites com tamanhos diferentes sem quebrar a física.
2. **Troca fácil de personagem** — Basta alterar o catálogo `CHARACTERS` (caminho da imagem, cor de fallback). A hitbox permanece a mesma para todos.
3. **Debug visual** — Com `DEBUG_MODE = true`, desenhamos contornos vermelhos nas hitboxes. Isso permite auditar se a matemática de colisão está correta, independentemente do sprite.

> **Analogia para a apresentação:** pense na hitbox como o esqueleto invisível de um boneco de olhos fechados. O sprite é a roupa por cima. Você sente o chão com os pés (hitbox), não com a camiseta (sprite).

---

## 2. O Motor do Jogo — O Game Loop

### O coração: `requestAnimationFrame`

O navegador redesenha a tela cerca de **60 vezes por segundo**. O `requestAnimationFrame` é a API que sincroniza nosso código com esse ciclo de atualização da tela.

O jogo **não inicia** ao abrir a página. O loop só começa depois que o jogador escolhe um operador na tela de seleção:

```javascript
function startGame() {
  gameStarted = true;
  charSelectOverlay.classList.add('hidden');
  requestAnimationFrame(gameLoop); // ← aqui o motor liga
}
```

### As 4 etapas de cada frame

A função `gameLoop` executa, a cada frame:

```
1. Calcular delta time   → quanto tempo passou desde o último frame
2. updatePhysics()       → mover o player, aplicar gravidade, resolver colisões
3. render()              → limpar o canvas e desenhar tudo de novo
4. requestAnimationFrame → pedir ao navegador o próximo frame
```

Fluxo visual:

```
┌─────────────────────────────────────────┐
│  requestAnimationFrame(gameLoop)        │
│              ↓                          │
│  1. delta time (timestamp)              │
│              ↓                          │
│  2. updatePhysics()                     │
│     • input → velocidade                │
│     • gravidade → velY                  │
│     • posição → x, y                    │
│     • colisões → ajuste de posição      │
│              ↓                          │
│  3. render()                            │
│     • fundo → plataformas → sprite      │
│     • debug (hitboxes vermelhas)        │
│              ↓                          │
│  4. agenda próximo frame ───────────────┘
```

### Por que não usar `setInterval`?

O `requestAnimationFrame` pausa automaticamente quando a aba do navegador não está visível (economia de bateria e CPU). Ele também se alinha ao refresh rate do monitor, evitando frames desperdiçados ou "tearing" visual.

---

## 3. Física e Colisão

### Gravidade e movimento

A cada frame, `updatePhysics()` aplica as regras na seguinte ordem:

| Etapa | Constante | Efeito |
|-------|-----------|--------|
| Movimento horizontal | `MOVE_SPEED = 4` | Define velocidade ao pressionar ← → ou A D |
| Atrito | `FRICTION = 0.82` | Desacelera o player quando nenhuma tecla está pressionada |
| Pulo | `JUMP_FORCE = -11` | Só funciona se `grounded === true` (pés no chão) |
| Gravidade | `GRAVITY = 0.6` | Soma à `velY` a cada frame, puxando para baixo |
| Limite de queda | `MAX_FALL_SPEED = 14` | Impede queda infinitamente rápida |

Depois de calcular as velocidades, a posição é atualizada:

```javascript
player.x += player.velX;
player.y += player.velY;
```

### Colisão AABB (Axis-Aligned Bounding Box)

**AABB** significa: duas caixas retangulares alinhadas aos eixos (sem rotação). É o método mais simples e eficiente para jogos 2D de plataforma.

#### Passo 1 — Detectar sobreposição

A função `aabbOverlap` verifica se o player e uma plataforma se cruzam:

```
Condição: os dois retângulos se tocam em X E em Y ao mesmo tempo.

  player.x < plataforma.x + plataforma.w   (borda esquerda do player antes da direita da plataforma)
  player.x + player.width > plataforma.x  (borda direita do player depois da esquerda da plataforma)
  (mesma lógica para Y)
```

#### Passo 2 — Resolver a colisão

Quando há sobreposição, calculamos **quanto cada retângulo invadiu o outro** em cada direção (esquerda, direita, cima, baixo). Resolvemos pelo **menor overlap** — ou seja, empurramos o player pelo lado onde ele menos penetrou:

- **Overlap horizontal menor** → colisão lateral (bate na parede, zera `velX`)
- **Overlap vertical menor** → colisão vertical
  - Por cima → player pousa no chão (`grounded = true`, `velY = 0`)
  - Por baixo → player bate no teto (`velY = 0`)

#### Bordas da tela

Além das plataformas do nível, limitamos o player horizontalmente:

```javascript
if (player.x < 0) { player.x = 0; player.velX = 0; }
if (player.x + player.width > canvas.width) {
  player.x = canvas.width - player.width;
  player.velX = 0;
}
```

O canvas tem **800 × 450 pixels**. Não há limite vertical — o player pode cair para fora da tela (comportamento aceitável nesta versão).

#### Nível atual

```javascript
Level.platforms = [
  { x: 0,   y: 400, w: 800, h: 50 },  // chão fixo
  { x: 150, y: 300, w: 120, h: 16 },  // plataforma suspensa 1
  { x: 500, y: 220, w: 140, h: 16 },  // plataforma suspensa 2
];
```

---

## 4. Sistema de Seleção e Fallback

### Tela de seleção (overlay HTML)

Antes do jogo começar, um overlay escuro cobre o canvas com o título **"SELECIONE SEU OPERADOR"** e 4 botões — um para cada membro da equipe:

| Operador | Acesso | Cor de fallback |
|----------|--------|-----------------|
| Henri | Livre | `#4ecdc4` (ciano) |
| Isaque | Livre | `#ffe66d` (amarelo) |
| Guilherme | Livre | `#a29bfe` (roxo) |
| Christopher 🔒 | Protegido por senha | `#e94560` (vermelho) |

O overlay é HTML/CSS puro (`#char-select-overlay`), posicionado por cima do canvas com `position: absolute`. Ao iniciar o jogo, recebe a classe `hidden` (`display: none`).

### Catálogo de personagens (`CHARACTERS`)

Todos os perfis ficam centralizados em um único objeto:

```javascript
const CHARACTERS = {
  christopher: {
    id: 'christopher',
    nome: 'Christopher',
    src: './assets/christopher_sprite_semBG.png',
    fallbackColor: '#e94560',
    isPrivado: true,
  },
  // ... henri, isaque, guilherme
};
```

Para adicionar um novo personagem no futuro, basta incluir uma entrada aqui — sem alterar física nem colisão.

### Trava do Tech Lead (autenticação)

Apenas Christopher tem `isPrivado: true`. O fluxo ao clicar no botão dele:

```
Clique em Christopher
       ↓
prompt("Senha do Chris:")
       ↓
  ┌────┴────┐
  │         │
Senha      Senha errada
correta    ou cancelamento
  │         │
  ↓         ↓
Inicia    alert("Acesso Negado...")
o jogo    overlay permanece aberto
```

A senha está na constante `SENHA_TECH_LEAD` (valor atual: `"2103"`).

Os outros três operadores iniciam o jogo imediatamente, sem autenticação.

### Renderização segura (fallback)

Nem todos os membros da equipe têm PNG pronto. O sistema **nunca trava** por falta de imagem.

Ao selecionar um personagem, `loadCharacterSprite()` cria um `new Image()` e tenta carregar o `src`:

```javascript
image.onload  → marca imageReady = true  (PNG encontrado)
image.onerror → marca loadFailed = true  (PNG ausente ou corrompido)
```

Na hora de desenhar, `drawPlayerSprite()` decide:

```
image existe?
  E imageReady === true?
  E loadFailed === false?
  E image.complete === true?
       ↓ SIM                    ↓ NÃO
ctx.drawImage(png)         ctx.fillRect(cor do personagem)
```

**Resultado prático hoje:**
- **Christopher** → exibe o sprite PNG (arquivo existe em `assets/`)
- **Henri, Isaque, Guilherme** → exibem retângulos coloridos nas cores definidas em `fallbackColor`, até que os PNGs sejam adicionados

O jogo continua jogável em todos os casos.

---

## Estrutura de arquivos do projeto

```
Cosmos Projeto 1/
├── index.html                  # Página + overlay de seleção + estilos
├── js/
│   └── main.js                 # Motor completo (física, render, input, seleção)
├── assets/
│   └── christopher_sprite_semBG.png
└── DOCUMENTACAO_TECNICA.md     # Este documento
```

---

## Glossário rápido para a apresentação

| Termo | Significado em uma frase |
|-------|--------------------------|
| **Hitbox** | Caixa invisível que representa o corpo físico do personagem |
| **Sprite** | Imagem visível desenhada sobre a hitbox |
| **AABB** | Detecção de colisão entre dois retângulos alinhados |
| **Game Loop** | Ciclo infinito de atualizar lógica → desenhar → repetir |
| **Fallback** | Plano B visual quando a imagem não carrega |
| **Overlay** | Camada HTML por cima do canvas (tela de seleção) |
| **grounded** | Flag que indica se o player está com os pés no chão (pode pular) |

---

*Documento gerado para o projeto Cosmos — Plataforma 2D Vanilla JS.*
